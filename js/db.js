/**
 * IndexedDB wrapper for face recognition data storage
 * Stores face descriptors locally in the browser
 */

class FaceDB {
    constructor() {
        this.dbName = 'FaceRecognitionDB';
        this.storeName = 'registeredFaces';
        this.workstationStoreName = 'workstation';
        this.attendanceStoreName = 'attendance';
        this.activeSessionStoreName = 'activeSessions';
        this.db = null;
    }

    /**
     * Open/create the IndexedDB database
     */
    async open() {
        return new Promise((resolve, reject) => {
            // Version 2: Added attendance and activeSessions stores
            const request = indexedDB.open(this.dbName, 2);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Create object store for registered faces
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Create indexes for searching
                    objectStore.createIndex('name', 'name', { unique: false });
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create object store for workstation (single record with key 'config')
                if (!db.objectStoreNames.contains(this.workstationStoreName)) {
                    db.createObjectStore(this.workstationStoreName, { keyPath: 'id' });
                }

                // Create object store for attendance records
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

                // Create object store for active sessions (tracks who's currently checked in)
                if (!db.objectStoreNames.contains(this.activeSessionStoreName)) {
                    const sessionStore = db.createObjectStore(this.activeSessionStoreName, {
                        keyPath: 'faceId'
                    });
                    sessionStore.createIndex('checkInTime', 'checkInTime', { unique: false });
                }
            };
        });
    }

    /**
     * Add a new face to the database
     * @param {string} name - User's name
     * @param {Float32Array} descriptor - Face descriptor (128-dimensional)
     */
    async addFace(name, descriptor) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const faceData = {
                name: name,
                descriptor: Array.from(descriptor), // Convert Float32Array to regular array for storage
                createdAt: new Date().toISOString()
            };

            const request = objectStore.add(faceData);

            request.onsuccess = () => {
                resolve(request.result); // Return the ID of the added record
            };

            request.onerror = () => {
                reject(new Error('Failed to add face to database'));
            };
        });
    }

    /**
     * Get all registered faces from the database
     * @returns {Array} Array of face objects with descriptors converted back to Float32Array
     */
    async getAllFaces() {
        if (!this.db) {
            await this.open();
        }

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

            request.onerror = () => {
                reject(new Error('Failed to retrieve faces from database'));
            };
        });
    }

    /**
     * Delete a face from the database
     * @param {number} id - ID of the face to delete
     */
    async deleteFace(id) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(new Error('Failed to delete face from database'));
            };
        });
    }

    /**
     * Clear all faces from the database
     */
    async clearAll() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(new Error('Failed to clear database'));
            };
        });
    }

    /**
     * Get the count of registered faces
     */
    async getCount() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to count faces in database'));
            };
        });
    }

    // ==================== Workstation Methods ====================

    /**
     * Save or update workstation configuration
     * @param {Object} workstationData - Workstation configuration
     */
    async saveWorkstation(workstationData) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.workstationStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.workstationStoreName);

            const data = {
                id: 'config',
                ...workstationData,
                updatedAt: new Date().toISOString()
            };

            const request = objectStore.put(data);

            request.onsuccess = () => {
                resolve(data);
            };

            request.onerror = () => {
                reject(new Error('Failed to save workstation configuration'));
            };
        });
    }

    /**
     * Get workstation configuration
     * @returns {Object|null} Workstation configuration or null if not set
     */
    async getWorkstation() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.workstationStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.workstationStoreName);
            const request = objectStore.get('config');

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to get workstation configuration'));
            };
        });
    }

    /**
     * Delete workstation configuration
     */
    async deleteWorkstation() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.workstationStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.workstationStoreName);
            const request = objectStore.delete('config');

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(new Error('Failed to delete workstation configuration'));
            };
        });
    }

    /**
     * Check if workstation is configured
     * @returns {boolean} True if workstation is configured
     */
    async isWorkstationConfigured() {
        const ws = await this.getWorkstation();
        return ws !== null;
    }

    // ==================== Attendance Methods ====================

    /**
     * Record check-in
     * @param {number} faceId - Face ID
     * @param {string} name - User name
     * @param {number} confidence - Match confidence
     */
    async recordCheckIn(faceId, name, confidence) {
        if (!this.db) {
            await this.open();
        }

        return new Promise(async (resolve, reject) => {
            try {
                const now = new Date();
                const dateKey = now.toISOString().split('T')[0];

                // Get workstation info first
                let workstationName = null;
                let workstationLocation = null;

                try {
                    const ws = await this.getWorkstation();
                    if (ws) {
                        workstationName = ws.name;
                        workstationLocation = ws.location;
                    }
                } catch (e) {
                    console.log('No workstation configured');
                }

                const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
                const attendanceStore = transaction.objectStore(this.attendanceStoreName);
                const sessionStore = transaction.objectStore(this.activeSessionStoreName);

                const attendanceRecord = {
                    faceId: faceId,
                    name: name,
                    type: 'check-in',
                    timestamp: now.toISOString(),
                    date: dateKey,
                    confidence: confidence,
                    workstationName: workstationName,
                    workstationLocation: workstationLocation,
                    detectionMethod: 'face',
                    movementDirection: null,
                    zoneTransition: null
                };

                const addRequest = attendanceStore.add(attendanceRecord);

                addRequest.onsuccess = () => {
                    // Create active session
                    const sessionRequest = sessionStore.put({
                        faceId: faceId,
                        name: name,
                        checkInTime: now.toISOString(),
                        attendanceId: addRequest.result
                    });

                    sessionRequest.onsuccess = () => {
                        console.log('Check-in recorded successfully:', name);
                        resolve(addRequest.result);
                    };

                    sessionRequest.onerror = () => {
                        reject(new Error('Failed to create active session'));
                    };
                };

                addRequest.onerror = () => {
                    reject(new Error('Failed to record check-in'));
                };

                transaction.onerror = () => {
                    reject(new Error('Transaction failed'));
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Record check-out
     * @param {number} faceId - Face ID
     * @param {string} name - User name
     * @param {number} confidence - Match confidence
     */
    async recordCheckOut(faceId, name, confidence) {
        if (!this.db) {
            await this.open();
        }

        return new Promise(async (resolve, reject) => {
            try {
                const now = new Date();
                const dateKey = now.toISOString().split('T')[0];

                // Get active session first to calculate duration
                const session = await new Promise((res, rej) => {
                    const transaction = this.db.transaction(this.activeSessionStoreName, 'readonly');
                    const request = transaction.objectStore(this.activeSessionStoreName).get(faceId);
                    request.onsuccess = () => res(request.result);
                    request.onerror = () => rej(new Error('Failed to get active session'));
                });

                let duration = null;
                if (session) {
                    const checkInTime = new Date(session.checkInTime);
                    duration = Math.round((now - checkInTime) / 1000 / 60); // Duration in minutes
                }

                // Get workstation info
                let workstationName = null;
                let workstationLocation = null;

                try {
                    const ws = await this.getWorkstation();
                    if (ws) {
                        workstationName = ws.name;
                        workstationLocation = ws.location;
                    }
                } catch (e) {
                    console.log('No workstation configured');
                }

                const attendanceRecord = {
                    faceId: faceId,
                    name: name,
                    type: 'check-out',
                    timestamp: now.toISOString(),
                    date: dateKey,
                    confidence: confidence,
                    duration: duration,
                    workstationName: workstationName,
                    workstationLocation: workstationLocation,
                    detectionMethod: 'face',
                    movementDirection: null,
                    zoneTransition: null
                };

                const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
                const attendanceStore = transaction.objectStore(this.attendanceStoreName);
                const sessionStore = transaction.objectStore(this.activeSessionStoreName);

                const addRequest = attendanceStore.add(attendanceRecord);

                addRequest.onsuccess = () => {
                    // Remove active session
                    sessionStore.delete(faceId);

                    console.log('Check-out recorded successfully:', name, 'Duration:', duration);
                    resolve({ id: addRequest.result, duration: duration });
                };

                addRequest.onerror = () => {
                    reject(new Error('Failed to record check-out'));
                };

                transaction.onerror = () => {
                    reject(new Error('Transaction failed'));
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get attendance records for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async getAttendanceByDate(date) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.attendanceStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.attendanceStoreName);
            const index = objectStore.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => {
                resolve(request.result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
            };

            request.onerror = () => {
                reject(new Error('Failed to get attendance records'));
            };
        });
    }

    /**
     * Get all attendance records
     */
    async getAllAttendance() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.attendanceStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.attendanceStoreName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
            };

            request.onerror = () => {
                reject(new Error('Failed to get attendance records'));
            };
        });
    }

    /**
     * Get all active sessions (currently checked in users)
     */
    async getActiveSessions() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.activeSessionStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.activeSessionStoreName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get active sessions'));
            };
        });
    }

    /**
     * Check if a user is currently checked in
     * @param {number} faceId - Face ID
     */
    async isCheckedIn(faceId) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.activeSessionStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.activeSessionStoreName);
            const request = objectStore.get(faceId);

            request.onsuccess = () => {
                resolve(!!request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to check session status'));
            };
        });
    }

    /**
     * Delete attendance record
     * @param {number} id - Attendance record ID
     */
    async deleteAttendance(id) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.attendanceStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.attendanceStoreName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(new Error('Failed to delete attendance record'));
            };
        });
    }

    /**
     * Clear all attendance records
     */
    async clearAttendance() {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.attendanceStoreName, this.activeSessionStoreName], 'readwrite');
            const attendanceStore = transaction.objectStore(this.attendanceStoreName);
            const sessionStore = transaction.objectStore(this.activeSessionStoreName);

            attendanceStore.clear().onsuccess = () => {
                sessionStore.clear().onsuccess = () => {
                    resolve(true);
                };
            };
        });
    }

    /**
     * Get attendance summary for a user
     * @param {number} faceId - Face ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     */
    async getUserAttendanceSummary(faceId, startDate, endDate) {
        if (!this.db) {
            await this.open();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.attendanceStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.attendanceStoreName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const records = request.result.filter(r => {
                    const recordDate = r.date;
                    return r.faceId === faceId &&
                           recordDate >= startDate &&
                           recordDate <= endDate;
                });

                // Calculate summary
                let totalMinutes = 0;
                let checkIns = 0;
                let checkOuts = 0;

                records.forEach(r => {
                    if (r.type === 'check-in') checkIns++;
                    if (r.type === 'check-out') {
                        checkOuts++;
                        if (r.duration) totalMinutes += r.duration;
                    }
                });

                resolve({
                    records: records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
                    summary: {
                        totalMinutes: totalMinutes,
                        totalHours: (totalMinutes / 60).toFixed(2),
                        checkIns: checkIns,
                        checkOuts: checkOuts
                    }
                });
            };

            request.onerror = () => {
                reject(new Error('Failed to get attendance summary'));
            };
        });
    }
}

// Export for use in other files
const faceDB = new FaceDB();
