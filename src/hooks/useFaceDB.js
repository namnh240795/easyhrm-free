import { useState, useEffect, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

// IndexedDB wrapper class
class FaceDB {
  constructor() {
    this.dbName = 'FaceRecognitionDB';
    this.storeName = 'registeredFaces';
    this.workstationStoreName = 'workstation';
    this.attendanceStoreName = 'attendance';
    this.activeSessionStoreName = 'activeSessions';
    this.db = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 3);

      request.onerror = () => reject(new Error('Failed to open database'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create registered faces store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create workstation store
        if (!db.objectStoreNames.contains(this.workstationStoreName)) {
          db.createObjectStore(this.workstationStoreName, { keyPath: 'id' });
        }

        // Create attendance store
        if (!db.objectStoreNames.contains(this.attendanceStoreName)) {
          const attendanceStore = db.createObjectStore(this.attendanceStoreName, {
            keyPath: 'id',
            autoIncrement: true
          });
          attendanceStore.createIndex('faceId', 'faceId', { unique: false });
          attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
          attendanceStore.createIndex('type', 'type', { unique: false });
          attendanceStore.createIndex('date', 'date', { unique: false });
        }

        // Create active sessions store
        if (!db.objectStoreNames.contains(this.activeSessionStoreName)) {
          const sessionStore = db.createObjectStore(this.activeSessionStoreName, {
            keyPath: 'faceId'
          });
          sessionStore.createIndex('checkInTime', 'checkInTime', { unique: false });
        }
      };
    });
  }

  async addFace(name, descriptor) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      const faceData = {
        name,
        descriptor: Array.from(descriptor),
        createdAt: new Date().toISOString()
      };

      const request = objectStore.add(faceData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to add face'));
    });
  }

  async getAllFaces() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const faces = request.result.map(face => ({
          ...face,
          descriptor: new Float32Array(face.descriptor)
        }));
        resolve(faces);
      };

      request.onerror = () => reject(new Error('Failed to retrieve faces'));
    });
  }

  async deleteFace(id) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to delete face'));
    });
  }

  async getCount() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count faces'));
    });
  }

  async saveWorkstation(workstationData) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.workstationStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.workstationStoreName);

      const data = {
        id: 'config',
        ...workstationData,
        updatedAt: new Date().toISOString()
      };

      const request = objectStore.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error('Failed to save workstation'));
    });
  }

  async getWorkstation() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.workstationStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.workstationStoreName);
      const request = objectStore.get('config');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get workstation'));
    });
  }

  async recordCheckIn(faceId, name, confidence) {
    if (!this.db) await this.open();

    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];

        const ws = await this.getWorkstation().catch(() => null);
        const workstationName = ws?.name || null;
        const workstationLocation = ws?.location || null;

        const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
        const attendanceStore = transaction.objectStore(this.attendanceStoreName);
        const sessionStore = transaction.objectStore(this.activeSessionStoreName);

        const attendanceRecord = {
          faceId,
          name,
          type: 'check-in',
          timestamp: now.toISOString(),
          date: dateKey,
          confidence,
          workstationName,
          workstationLocation,
          detectionMethod: 'motion',
          movementDirection: null,
          zoneTransition: null
        };

        const addRequest = attendanceStore.add(attendanceRecord);

        addRequest.onsuccess = () => {
          const sessionRequest = sessionStore.put({
            faceId,
            name,
            checkInTime: now.toISOString(),
            attendanceId: addRequest.result
          });

          sessionRequest.onsuccess = () => resolve(addRequest.result);
          sessionRequest.onerror = () => reject(new Error('Failed to create session'));
        };

        addRequest.onerror = () => reject(new Error('Failed to record check-in'));
      } catch (error) {
        reject(error);
      }
    });
  }

  async recordCheckOut(faceId, name, confidence) {
    if (!this.db) await this.open();

    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];

        const session = await new Promise((res, rej) => {
          const transaction = this.db.transaction(this.activeSessionStoreName, 'readonly');
          const request = transaction.objectStore(this.activeSessionStoreName).get(faceId);
          request.onsuccess = () => res(request.result);
          request.onerror = () => rej(new Error('Failed to get session'));
        });

        let duration = null;
        if (session) {
          const checkInTime = new Date(session.checkInTime);
          duration = Math.round((now - checkInTime) / 1000 / 60);
        }

        const ws = await this.getWorkstation().catch(() => null);
        const workstationName = ws?.name || null;
        const workstationLocation = ws?.location || null;

        const attendanceRecord = {
          faceId,
          name,
          type: 'check-out',
          timestamp: now.toISOString(),
          date: dateKey,
          confidence,
          duration,
          workstationName,
          workstationLocation,
          detectionMethod: 'motion',
          movementDirection: null,
          zoneTransition: null
        };

        const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
        const attendanceStore = transaction.objectStore(this.attendanceStoreName);
        const sessionStore = transaction.objectStore(this.activeSessionStoreName);

        const addRequest = attendanceStore.add(attendanceRecord);

        addRequest.onsuccess = () => {
          sessionStore.delete(faceId);
          console.log('Check-out recorded:', name, 'Duration:', duration);
          resolve({ id: addRequest.result, duration });
        };

        addRequest.onerror = () => reject(new Error('Failed to record check-out'));
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAllAttendance() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.attendanceStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.attendanceStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      };

      request.onerror = () => reject(new Error('Failed to get attendance'));
    });
  }

  async getActiveSessions() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.activeSessionStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.activeSessionStoreName);
      const request = objectStore.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get active sessions'));
    });
  }

  async isCheckedIn(faceId) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.activeSessionStoreName], 'readonly');
      const objectStore = transaction.objectStore(this.activeSessionStoreName);
      const request = objectStore.get(faceId);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(new Error('Failed to check session'));
    });
  }

  async clearAttendance() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
      const attendanceStore = transaction.objectStore(this.attendanceStoreName);
      const sessionStore = transaction.objectStore(this.activeSessionStoreName);

      attendanceStore.clear().onsuccess = () => {
        sessionStore.clear().onsuccess = () => resolve(true);
      };
    });
  }

  async resetDatabase() {
    if (this.db) {
      this.db.close();
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to delete database'));
    });
  }
}

// Create singleton instance
const faceDB = new FaceDB();

// Custom hook
export function useFaceDB() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await faceDB.open();
        setIsInitialized(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  return {
    isInitialized,
    isLoading,
    error,
    faceDB
  };
}

export { faceDB };
export default useFaceDB;
