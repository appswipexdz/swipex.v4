const firestoreSync = {
    _saveTimeout: null,
    _debounceMs: 500,
    _maxRetries: 10,
    _retryCount: 0,
    _initialLoadDone: false,  // منع الكتابة قبل اكتمال أول تحميل

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

    // تحديث حالة syncStatus
    updateSyncStatus(status) {
        if (window.appState) {
            window.appState.syncStatus = status;
            console.log('syncStatus updated to:', status);
        }
    },

    // ============ Save Methods ============

    async saveParcels(parcels) {
        if (!this._initialLoadDone) {
            console.log('⏳ في انتظار اكتمال التحميل الأولي - تأجيل الحفظ');
            return false;
        }
        this.updateSyncStatus('syncing');
        
        try {
            const ref = this._docRef('parcels');
            if (!ref) {
                this.updateSyncStatus('error');
                return false;
            }
            await ref.set({
                data: JSON.stringify(parcels),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._retryCount = 0; // إعادة تعيين عدد المحاولات عند النجاح
            this.updateSyncStatus(navigator.onLine ? 'synced' : 'offline');
            console.log('✓ تم حفظ الطرود في Firestore بنجاح');
            return true;
        } catch (e) {
            console.error('❌ فشل حفظ الطرود:', e.message);
            this.updateSyncStatus('error');
            
            // محاولة إعادة الحفظ في حالة الخطأ المؤقت
            if (navigator.onLine && this._retryCount < this._maxRetries) {
                this._retryCount++;
                console.log(`🔄 إعادة محاولة الحفظ (محاولة ${this._retryCount}/${this._maxRetries})...`);
                setTimeout(() => {
                    const currentParcels = window.appState ? window.appState.parcels : parcels;
                    this.saveParcels(currentParcels);
                }, Math.min(this._retryCount * 2000, 10000));
            }
            return false;
        }
    },

    async saveSettings(settings) {
        try {
            const ref = this._docRef('settings');
            if (!ref) return false;
            await ref.set({
                data: JSON.stringify(settings),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error('firestoreSync.saveSettings:', e);
            return false;
        }
    },

    async saveArchive(archive) {
        try {
            const ref = this._docRef('archive');
            if (!ref) return false;
            await ref.set({
                data: JSON.stringify(archive),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error('firestoreSync.saveArchive:', e);
            return false;
        }
    },

    async saveTasks(tasks) {
        try {
            const ref = this._docRef('tasks');
            if (!ref) return false;
            await ref.set({
                data: JSON.stringify(tasks),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (e) {
            console.error('firestoreSync.saveTasks:', e);
            return false;
        }
    },

    // ============ Load Methods ============

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
                console.log('⚠ لم يتم العثور على طرود في Firestore');
                this._initialLoadDone = true;
                this.updateSyncStatus('idle');
                return [];
            }
            
            const raw = snap.data().data;
            const parcels = raw ? JSON.parse(raw) : [];
            console.log('✓ تم تحميل', parcels.length, 'طرد من Firestore');
            this._initialLoadDone = true;
            this.updateSyncStatus('synced');
            return parcels;
        } catch (e) {
            console.error('❌ خطأ في تحميل الطرود:', e);
            this.updateSyncStatus('error');
            return [];
        }
    },

    async loadSettings() {
        try {
            const ref = this._docRef('settings');
            if (!ref) return null;
            
            const snap = await ref.get();
            if (snap.exists) {
                const raw = snap.data().data;
                const settings = raw ? JSON.parse(raw) : null;
                if (settings) {
                    console.log('✓ تم تحميل الإعدادات من Firestore');
                    return settings;
                }
            }
            
            console.log('⚠ لم يتم العثور على إعدادات في Firestore');
            return null;
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
            if (snap.exists) {
                const raw = snap.data().data;
                const archive = raw ? JSON.parse(raw) : null;
                if (archive) {
                    console.log('✓ تم تحميل الأرشيف من Firestore');
                    return archive;
                }
            }
            
            console.log('⚠ لم يتم العثور على أرشيف في Firestore');
            return null;
        } catch (e) {
            console.error('firestoreSync.loadArchive:', e);
            return null;
        }
    },

    async loadTasks() {
        try {
            // تحميل المهام من Firestore فقط
            const ref = this._docRef('tasks');
            if (!ref) return null;
            const snap = await ref.get();
            if (!snap.exists) return null;
            const raw = snap.data().data;
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('firestoreSync.loadTasks:', e);
            return null;
        }
    },

    async saveAll(data) {
        if (!this.isAvailable()) return false;
        try {
            const results = await Promise.all([
                data.parcels !== undefined ? this.saveParcels(data.parcels) : true,
                data.settings !== undefined ? this.saveSettings(data.settings) : true,
                data.archive !== undefined ? this.saveArchive(data.archive) : true,
                data.tasks !== undefined ? this.saveTasks(data.tasks) : true
            ]);
            return results.every(r => r);
        } catch (e) {
            console.error('firestoreSync.saveAll:', e);
            return false;
        }
    },

    async loadAll() {
        if (!this.isAvailable()) {
            console.log('Firestore غير متاح - سيتم التحميل محلياً');
            return null;
        }
        
        try {
            console.log('بدء تحميل البيانات من السحابة...');
            const [parcels, settings, archive, tasks] = await Promise.all([
                this.loadParcels(),
                this.loadSettings(),
                this.loadArchive(),
                this.loadTasks()
            ]);
            
            console.log('تم تحميل البيانات من السحابة');
            return { parcels, settings, archive, tasks };
        } catch (e) {
            console.error('خطأ في loadAll:', e);
            return null;
        }
    },

    scheduleSave(data, callback) {
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(async () => {
            const result = await this.saveAll(data);
            this._saveTimeout = null;
            if (callback) callback(result);
        }, this._debounceMs);
    }
};
