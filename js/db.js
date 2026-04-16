/**
 * IndexedDB wrapper for face recognition data storage
 * Stores face descriptors locally in the browser
 */

class FaceDB {
    constructor() {
        this.dbName = 'FaceRecognitionDB';
        this.storeName = 'registeredFaces';
        this.workstationStoreName = 'workstation';
        this.db = null;
    }

    /**
     * Open/create the IndexedDB database
     */
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

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
}

// Export for use in other files
const faceDB = new FaceDB();
