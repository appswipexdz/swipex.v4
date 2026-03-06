const firestoreSync = {
    _saveTimeout: null,
    _debounceMs: 500,
    _maxRetries: 10,
    _retryCount: 0,
    _pendingData: null,
    _isSaving: false,
    _onlineHandlerAttached: false,
    _lastSavedPayload: {
        parcels: null,
        settings: null,
        archive: null,
        tasks: null
    },

    getUid() {
        try {
            return firebase.auth().currentUser?.uid || null;
        } catch (e) {
            console.error('firestoreSync.getUid:', e);
            return null;
        }
    },

    isAvailable() {
        return !!(window.db && firebase.auth().currentUser);
    },

    _docRef(collection) {
        const uid = this.getUid();
        if (!uid || !window.db) return null;
        return window.db.collection('users').doc(uid).collection('data').doc(collection);
    },

    _mergePayload(base, next) {
        const merged = { ...(base || {}) };
        if (!next || typeof next !== 'object') return merged;

        ['parcels', 'settings', 'archive', 'tasks'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(next, key)) {
                merged[key] = next[key];
            }
        });

        return merged;
    },

    _serializePayload(data) {
        const serialized = {};
        if (!data || typeof data !== 'object') return serialized;

        ['parcels', 'settings', 'archive', 'tasks'].forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(data, key)) return;
            serialized[key] = JSON.stringify(data[key] ?? null);
        });

        return serialized;
    },

    _extractChanged(serialized) {
        const changed = {};
        Object.keys(serialized).forEach((key) => {
            if (this._lastSavedPayload[key] !== serialized[key]) {
                changed[key] = serialized[key];
            }
        });
        return changed;
    },

    async _setWithRetry(collection, jsonData) {
        const ref = this._docRef(collection);
        if (!ref) return false;

        let attempt = 0;
        while (attempt <= this._maxRetries) {
            try {
                await ref.set({
                    data: jsonData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return true;
            } catch (e) {
                attempt++;
                this._retryCount = attempt;

                const reachedLimit = attempt > this._maxRetries;
                if (!navigator.onLine || reachedLimit) {
                    console.error(`firestoreSync.${collection}:`, e);
                    return false;
                }

                const backoff = Math.min((2 ** attempt) * 250, 10000);
                const jitter = Math.floor(Math.random() * 250);
                await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
            }
        }

        return false;
    },

    _ensureOnlineHandler() {
        if (this._onlineHandlerAttached || typeof window === 'undefined') return;

        this._onlineHandlerAttached = true;
        window.addEventListener('online', () => {
            this.flushPendingSaves();
        });
    },

    updateSyncStatus(status) {
        if (window.appState) {
            window.appState.syncStatus = status;
            console.log('syncStatus updated to:', status);
        }
    },

    async saveParcels(parcels) {
        return this.saveAll({ parcels });
    },

    async saveSettings(settings) {
        return this.saveAll({ settings });
    },

    async saveArchive(archive) {
        return this.saveAll({ archive });
    },

    async saveTasks(tasks) {
        return this.saveAll({ tasks });
    },

    async loadParcels() {
        this.updateSyncStatus('syncing');

        try {
            const ref = this._docRef('parcels');
            if (!ref) {
                this.updateSyncStatus('idle');
                return [];
            }

            const snap = await ref.get();
            if (!snap.exists) {
                console.log('No parcels in Firestore');
                this.updateSyncStatus('idle');
                return [];
            }

            const raw = snap.data().data;
            const parcels = raw ? JSON.parse(raw) : [];
            this._lastSavedPayload.parcels = JSON.stringify(parcels);
            console.log('Loaded parcels from Firestore:', parcels.length);
            this.updateSyncStatus('synced');
            return parcels;
        } catch (e) {
            console.error('firestoreSync.loadParcels:', e);
            this.updateSyncStatus('error');
            return [];
        }
    },

    async loadSettings() {
        try {
            const ref = this._docRef('settings');
            if (!ref) return null;

            const snap = await ref.get();
            if (!snap.exists) {
                return null;
            }

            const raw = snap.data().data;
            const settings = raw ? JSON.parse(raw) : null;
            if (settings) {
                this._lastSavedPayload.settings = JSON.stringify(settings);
            }
            return settings;
        } catch (e) {
            console.error('firestoreSync.loadSettings:', e);
            return null;
        }
    },

    async loadArchive() {
        try {
            const ref = this._docRef('archive');
            if (!ref) return null;

            const snap = await ref.get();
            if (!snap.exists) {
                return null;
            }

            const raw = snap.data().data;
            const archive = raw ? JSON.parse(raw) : null;
            if (archive) {
                this._lastSavedPayload.archive = JSON.stringify(archive);
            }
            return archive;
        } catch (e) {
            console.error('firestoreSync.loadArchive:', e);
            return null;
        }
    },

    async loadTasks() {
        try {
            const ref = this._docRef('tasks');
            if (!ref) return null;

            const snap = await ref.get();
            if (!snap.exists) {
                return null;
            }

            const raw = snap.data().data;
            const tasks = raw ? JSON.parse(raw) : null;
            if (tasks) {
                this._lastSavedPayload.tasks = JSON.stringify(tasks);
            }
            return tasks;
        } catch (e) {
            console.error('firestoreSync.loadTasks:', e);
            return null;
        }
    },

    async flushPendingSaves() {
        if (this._isSaving) return true;
        if (!this._pendingData) return true;

        this._isSaving = true;
        this.updateSyncStatus('syncing');
        let allOk = true;

        try {
            while (this._pendingData) {
                const currentPayload = this._pendingData;
                this._pendingData = null;

                if (!this.isAvailable()) {
                    this._pendingData = this._mergePayload(currentPayload, this._pendingData);
                    this.updateSyncStatus(navigator.onLine ? 'error' : 'offline');
                    return false;
                }

                const serialized = this._serializePayload(currentPayload);
                const changed = this._extractChanged(serialized);
                const keys = Object.keys(changed);

                if (keys.length === 0) {
                    continue;
                }

                const results = await Promise.all(
                    keys.map((key) => this._setWithRetry(key, changed[key]))
                );
                const ok = results.every(Boolean);

                if (!ok) {
                    this._pendingData = this._mergePayload(currentPayload, this._pendingData);
                    this.updateSyncStatus(navigator.onLine ? 'error' : 'offline');
                    allOk = false;
                    break;
                }

                keys.forEach((key) => {
                    this._lastSavedPayload[key] = changed[key];
                });
                this._retryCount = 0;
            }

            if (allOk) {
                this.updateSyncStatus(navigator.onLine ? 'synced' : 'offline');
            }
            return allOk;
        } catch (e) {
            console.error('firestoreSync.flushPendingSaves:', e);
            this.updateSyncStatus('error');
            return false;
        } finally {
            this._isSaving = false;
        }
    },

    async saveAll(data) {
        this._ensureOnlineHandler();
        this._pendingData = this._mergePayload(this._pendingData, data);
        return this.flushPendingSaves();
    },

    async loadAll() {
        if (!this.isAvailable()) {
            console.log('Firestore unavailable: loading local data');
            return null;
        }

        try {
            const [parcels, settings, archive, tasks] = await Promise.all([
                this.loadParcels(),
                this.loadSettings(),
                this.loadArchive(),
                this.loadTasks()
            ]);

            return { parcels, settings, archive, tasks };
        } catch (e) {
            console.error('firestoreSync.loadAll:', e);
            return null;
        }
    },

    scheduleSave(data, callback) {
        this._ensureOnlineHandler();
        this._pendingData = this._mergePayload(this._pendingData, data);

        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }

        this._saveTimeout = setTimeout(async () => {
            const result = await this.flushPendingSaves();
            this._saveTimeout = null;
            if (callback) callback(result);
        }, this._debounceMs);
    }
};
