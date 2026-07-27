const firestoreSync = {
    _saveTimeout: null,
    _debounceMs: 500,
    _maxRetries: 10,
    _retryCount: 0,
    _initialLoadDone: false,  // منع الكتابة قبل اكتمال أول تحميل

    // تخطي التحميل الأولي (يستخدم عند العمل داخل جلسة تعاونية)
    skipInitialLoadCheck() {
        this._initialLoadDone = true;
        console.log('🔓 تم تخطي فحص التحميل الأولي للعمل في الجلسة');
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

    // تحديث حالة syncStatus
    updateSyncStatus(status) {
        if (window.appState) {
            window.appState.syncStatus = status;
            console.log('syncStatus updated to:', status);
        }
    },

    // ============ Save Methods ============

    async saveParcels(parcels, { silent = false } = {}) {
        if (!this._initialLoadDone) {
            console.log('⏳ في انتظار اكتمال التحميل الأولي - تأجيل الحفظ');
            return false;
        }
        if (!silent) this.updateSyncStatus('syncing');
        
        try {
            const ref = this._docRef('parcels');
            if (!ref) {
                if (!silent) this.updateSyncStatus('error');
                return false;
            }
            await ref.set({
                data: JSON.stringify(parcels),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            this._retryCount = 0;
            if (!silent) this.updateSyncStatus(navigator.onLine ? 'synced' : 'offline');
            console.log('✓ تم حفظ الطرود في Firestore بنجاح');
            return true;
        } catch (e) {
            console.error('❌ فشل حفظ الطرود:', e.message);
            if (!silent) this.updateSyncStatus('error');
            
            if (navigator.onLine && this._retryCount < this._maxRetries) {
                this._retryCount++;
                console.log(`🔄 إعادة محاولة الحفظ (محاولة ${this._retryCount}/${this._maxRetries})...`);
                setTimeout(() => {
                    const currentParcels = window.appState ? window.appState.parcels : parcels;
                    this.saveParcels(currentParcels, { silent: true });
                }, Math.min(this._retryCount * 2000, 10000));
            }
            return false;
        }
    },

    async saveSettings(settings) {
        this.updateSyncStatus('syncing');
        try {
            const ref = this._docRef('settings');
            if (!ref) {
                this.updateSyncStatus('error');
                return false;
            }
            await ref.set({
                data: JSON.stringify(settings),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            this.updateSyncStatus(navigator.onLine ? 'synced' : 'offline');
            return true;
        } catch (e) {
            console.error('firestoreSync.saveSettings:', e);
            this.updateSyncStatus('error');
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
            }, { merge: true });
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
            }, { merge: true });
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
        if (!this._initialLoadDone) {
            console.log('⏳ في انتظار اكتمال التحميل الأولي - تأجيل الحفظ');
            return false;
        }
        try {
            const results = await Promise.all([
                data.parcels !== undefined ? this.saveParcels(data.parcels) : true,
                data.settings !== undefined ? this.saveSettings(data.settings) : true,
                data.archive !== undefined ? this.saveArchive(data.archive) : true,
                data.tasks !== undefined ? this.saveTasks(data.tasks) : true
            ]);
            const allOk = results.every(r => r);
            if (allOk) {
                const collections = [];
                if (data.parcels !== undefined) collections.push('parcels');
                if (data.settings !== undefined) collections.push('settings');
                if (data.archive !== undefined) collections.push('archive');
                if (data.tasks !== undefined) collections.push('tasks');
                if (collections.length > 0) {
                    await this.updateMetadata(collections);
                }
            }
            return allOk;
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

    // ============ Load Cloud Metadata (Timestamps) ============
    async loadCloudMetadata() {
        if (!this.isAvailable()) {
            return null;
        }
        
        try {
            const uid = this.getUid();
            const metadataRef = window.db.collection('users').doc(uid).collection('data').doc('_metadata');
            const snap = await metadataRef.get();
            
            if (!snap.exists) {
                console.log('⚠ لا توجد metadata في السحابة');
                return null;
            }
            
            const metadata = snap.data();
            console.log('✓ تم تحميل metadata من السحابة:', {
                parcelsUpdatedAt: metadata.parcelsUpdatedAt?.toMillis?.() || 0,
                settingsUpdatedAt: metadata.settingsUpdatedAt?.toMillis?.() || 0,
                archiveUpdatedAt: metadata.archiveUpdatedAt?.toMillis?.() || 0,
                tasksUpdatedAt: metadata.tasksUpdatedAt?.toMillis?.() || 0
            });
            return metadata;
        } catch (e) {
            console.error('خطأ في تحميل metadata:', e);
            return null;
        }
    },

    // تحديث metadata (يتم استدعاؤه عند الحفظ)
    async updateMetadata(updatedCollections) {
        if (!this.isAvailable()) return false;
        
        try {
            const uid = this.getUid();
            const metadataRef = window.db.collection('users').doc(uid).collection('data').doc('_metadata');
            
            const updateData = {};
            if (updatedCollections.includes('parcels')) {
                updateData.parcelsUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            if (updatedCollections.includes('settings')) {
                updateData.settingsUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            if (updatedCollections.includes('archive')) {
                updateData.archiveUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            if (updatedCollections.includes('tasks')) {
                updateData.tasksUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            await metadataRef.set(updateData, { merge: true });
            return true;
        } catch (e) {
            console.error('خطأ في تحديث metadata:', e);
            return false;
        }
    },

    scheduleSave(data, callback) {
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(async () => {
            const result = await this.saveAll(data);
            this._saveTimeout = null;
            if (callback) callback(result);
        }, this._debounceMs);
    },

    // ============ V2 Incremental Sync Methods ============

    async pushDirtyParcels(dirtySet, getParcelById) {
        if (!dirtySet.size) return true;
        const uid = this.getUid();
        if (!uid) return false;
        const ids = Array.from(dirtySet);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 450) chunks.push(ids.slice(i, i + 450));
        try {
            for (const chunk of chunks) {
                const batch = window.db.batch();
                chunk.forEach(tracking => {
                    const ref = window.db.collection('users').doc(uid).collection('parcels_v2').doc(tracking);
                    const parcel = getParcelById(tracking);
                    if (parcel) {
                        batch.set(ref, { ...parcel, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }, { merge: true });
                    } else {
                        batch.set(ref, { deleted: true, deletedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    }
                });
                await batch.commit();
            }
            dirtySet.clear();
            return true;
        } catch (e) {
            console.error('pushDirtyParcels:', e);
            return false;
        }
    },

    async pushDirtyArchiveEntries(dirtySet, getArchiveEntryById) {
        if (!dirtySet.size) return true;
        const uid = this.getUid();
        if (!uid) return false;
        const ids = Array.from(dirtySet);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 450) chunks.push(ids.slice(i, i + 450));
        try {
            for (const chunk of chunks) {
                const batch = window.db.batch();
                chunk.forEach(tracking => {
                    const ref = window.db.collection('users').doc(uid).collection('archive_v2').doc(tracking);
                    const entry = getArchiveEntryById(tracking);
                    batch.set(ref, { ...entry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                });
                await batch.commit();
            }
            dirtySet.clear();
            return true;
        } catch (e) {
            console.error('pushDirtyArchiveEntries:', e);
            return false;
        }
    },

    async pullChangedParcels(sinceMillis) {
        const uid = this.getUid();
        if (!uid) return [];
        let query = window.db.collection('users').doc(uid).collection('parcels_v2');
        if (sinceMillis) {
            query = query.where('updatedAt', '>', firebase.firestore.Timestamp.fromMillis(sinceMillis));
        }
        const snap = await query.get();
        return snap.docs.map(d => ({ tracking: d.id, ...d.data() }));
    },

    async pullChangedArchive(sinceMillis) {
        const uid = this.getUid();
        if (!uid) return [];
        let query = window.db.collection('users').doc(uid).collection('archive_v2');
        if (sinceMillis) {
            query = query.where('updatedAt', '>', firebase.firestore.Timestamp.fromMillis(sinceMillis));
        }
        const snap = await query.get();
        return snap.docs.map(d => ({ tracking: d.id, ...d.data() }));
    },

    listenToParcelsV2(onChange) {
        const uid = this.getUid();
        if (!uid) return () => {};
        return window.db.collection('users').doc(uid).collection('parcels_v2')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => onChange(change.doc.id, change.doc.data(), change.type));
            }, e => console.error('listenToParcelsV2:', e));
    },

    listenToArchiveV2(onChange) {
        const uid = this.getUid();
        if (!uid) return () => {};
        return window.db.collection('users').doc(uid).collection('archive_v2')
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => onChange(change.doc.id, change.doc.data(), change.type));
            }, e => console.error('listenToArchiveV2:', e));
    }
};

if (typeof window !== 'undefined') window.firestoreSync = firestoreSync;
