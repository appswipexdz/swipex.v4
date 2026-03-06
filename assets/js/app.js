// ============================================
// assets/js/app.js
// ملف التشغيل الرئيسي - يجمع كل المكونات
// ============================================

// تنظيف الـ state قبل البدء
appState.showAddModal = false;
appState.showImportSummary = false;
appState.showHistoryModal = false;
appState.drawerOpen = false;

const { createApp } = Vue;

createApp({
    data() {
        return appState;
    },
    
    computed: {
        uniqueMunicipalities() {
            return appMethods.uniqueMunicipalities.call(this);
        },
        hasActiveFilters() {
            return appMethods.hasActiveFilters.call(this);
        },
        visibleStatusFilters() {
            return appMethods.visibleStatusFilters.call(this);
        },
        filteredParcels() {
            return appMethods.filteredParcels.call(this);
        },
        totalCash() {
            return appMethods.totalCash.call(this);
        },
        remainingCount() {
            return appMethods.remainingCount.call(this);
        },
        editMunicipalitySuggestions() {
            return appMethods.editMunicipalitySuggestions.call(this);
        },
        unreadNotificationsCount() {
            return this.notifications.filter(n => !n.read).length;
        },
        allStatuses() {
            const custom = (this.settings.customStatuses || []).map(s => ({
                name: s.name,
                color: s.color,
                dot: s.dot,
                icon: s.icon,
                isCustom: true
            }));
            const all = [...this.statusList, ...custom];
            const order = this.settings.statusOrder || [];
            if (order.length > 0) {
                const ordered = [];
                order.forEach(name => {
                    const found = all.find(s => s.name === name);
                    if (found) ordered.push(found);
                });
                all.forEach(s => {
                    if (!order.includes(s.name)) ordered.push(s);
                });
                return ordered;
            }
            return all;
        }
    },
    
    watch: {
        'filters.search'() {
            this.saveFilters();
        },
        'filters.municipality'() {
            this.saveFilters();
        },
        'filters.status'() {
            this.saveFilters();
        },
        'filters.tag'() {
            this.saveFilters();
        }
    },
    
    mounted() {
        // تحميل المستخدم أولاً (متزامن)
        console.log('🚀 بدء التطبيق...');
        this.loadCurrentUser();
        
        // تحميل الفلاتر والثيم فوراً
        this.loadFilters();
        this.applyTheme();
        
        // الاستماع لتغييرات الثيم
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.settings.themeMode === 'auto') this.applyTheme();
        });
        
        // انتظار تأكيد المصادقة قبل تحميل البيانات
        const startLoad = () => {
            console.log('⏳ جاري تحميل البيانات...');
            this.loadData().then(() => {
                console.log('✓ اكتمل تحميل البيانات');
                this.syncStatus = 'synced';
            }).catch((e) => {
                console.error('❌ فشل تحميل البيانات:', e);
                this.syncStatus = 'error';
            });
        };
        
        if (firebase.auth().currentUser) {
            startLoad();
        } else {
            const unsubAuth = firebase.auth().onAuthStateChanged(user => {
                unsubAuth();
                startLoad();
            });
            // حماية: إذا لم يستجب خلال 3 ثوانٍ، حمّل البيانات المحلية
            setTimeout(() => {
                if (!firebase.auth().currentUser) {
                    console.log('⚠ تجاوز مهلة المصادقة - تحميل محلي');
                    startLoad();
                }
            }, 3000);
        }
        
        setTimeout(() => this.initSortable(), 500);
        this.detectDuplicates();
        this.initNotifications();
        
        // إخفاء شاشة التحميل بعد تحميل الصفحة
        const hideLoadingScreen = () => {
            this.$nextTick(() => {
                this.showScanner = false;
                this.isPageLoading = false;
            });
        };
        
        // في حالة تحميل الصفحة بسرعة (مُخزن مؤقتاً)
        if (document.readyState === 'complete') {
            hideLoadingScreen();
        } else {
            window.addEventListener('load', hideLoadingScreen);
        }
        
        // ضمان إخفاء شاشة التحميل خلال 3 ثوانٍ كحد أقصى
        setTimeout(() => {
            if (this.isPageLoading) {
                console.log('⏳ إخفاء شاشة التحميل (تجاوز المهلة)');
                hideLoadingScreen();
            }
        }, 3000);
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (this.showMunicipalityDropdown && !e.target.closest('.municipality-dropdown')) {
                this.showMunicipalityDropdown = false;
            }
            if (this.showTagsDropdown && !e.target.closest('.tags-dropdown')) {
                this.showTagsDropdown = false;
            }
            if (this.showTopMenu && !e.target.closest('.top-menu-wrapper')) {
                this.showTopMenu = false;
            }
        });
        
        // Scroll listener for header hide/show
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        
        // استقبال رسائل من Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                    if (event.data.tracking) {
                        this.filters.search = event.data.tracking;
                        this.filters.municipality = '';
                        this.filters.status = '';
                    }
                }
            });
        }
        
        // ملاحظة: initFirestoreListener يتم استدعاؤه في loadCurrentUser بعد تأكيد المصادقة
        
        // تحديث حالة الإنترنت
        this.updateOnlineStatus();
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        
        // حفظ محلي فقط عند إغلاق/تجديد الصفحة (beforeunload)
        // الكتابة غير المتزامنة (Firestore) لا تعمل في beforeunload
        window.addEventListener('beforeunload', () => {
            this.syncLocalStorage();
        });
    },
    
    methods: {
        ...appMethods,
        ...pdfFunctions,
        ...importExcelFunctions,
        ...scannerFunctions,
        
        // تحديث حالة الإنترنت
        updateOnlineStatus() {
            const isOnline = navigator.onLine;
            this.isOnline = isOnline;
            console.log('🌐 حالة الإنترنت:', isOnline ? '✓ متصل' : '❌ غير متصل');
            
            // تحديث Firestore listener إذا كان متصلاً
            if (isOnline) {
                if (!this.firestoreUnsub) {
                    console.log('🔄 تفعيل المستمع الفوري...');
                    this.initFirestoreListener();
                }
                
                // مزامنة فورية عند استعادة الاتصال
                this.syncStatus = 'syncing';
                setTimeout(() => {
                    console.log('🔄 إعادة مزامنة عند استعادة الاتصال...');
                    this.syncNow();
                }, 1000);
            } else {
                this.syncStatus = 'offline';
                console.log('⚠ وضع عدم الاتصال - البيانات من الذاكرة المحلية فقط');
            }
        },
        
        // مستمع التغييرات الفوري في Firestore
        initFirestoreListener() {
            try {
                const uid = firebase.auth().currentUser?.uid;
                if (!uid || !window.db) {
                    console.log('⚠ Firestore listener: لا يوجد uid أو db');
                    return;
                }
                
                // إلغاء المستمع السابق إذا كان موجوداً
                if (this.firestoreUnsub) {
                    this.firestoreUnsub();
                    console.log('⚠ تم إلغاء Firestore listener السابق');
                }
                
                // الاستماع للتغييرات في parcels والإعدادات معاً
                this.firestoreUnsub = window.db
                    .collection('users')
                    .doc(uid)
                    .collection('data')
                    .onSnapshot(
                        (snapshot) => {
                            // إعادة تعيين عدد المحاولات عند النجاح
                            this._firestoreRetries = 0;
                            
                            let updated = false;
                            let shouldRefresh = false;
                            
                            snapshot.docChanges().forEach((change) => {
                                if (change.type === 'modified' || change.type === 'added') {
                                    const doc = change.doc;
                                    const data = doc.data();
                                    
                                    // تحديث الطرود
                                    if (doc.id === 'parcels') {
                                        const parcels = data.data ? JSON.parse(data.data) : [];
                                        if (JSON.stringify(parcels) !== JSON.stringify(this.parcels)) {
                                            console.log('🔄 تحديث الطرود من Firestore:', parcels.length, 'طرد');
                                            this.parcels = parcels;
                                            this.detectDuplicates();
                                            updated = true;
                                            shouldRefresh = true;
                                        }
                                    }
                                    
                                    // تحديث الإعدادات
                                    if (doc.id === 'settings') {
                                        const remoteSettings = data.data ? JSON.parse(data.data) : null;
                                        if (remoteSettings && JSON.stringify(remoteSettings) !== JSON.stringify(this.settings)) {
                                            console.log('🔄 تحديث الإعدادات من Firestore');
                                            this.settings = { ...this.settings, ...remoteSettings };
                                            this.applyTheme();
                                            updated = true;
                                        }
                                    }
                                    
                                    // تحديث الأرشيف
                                    if (doc.id === 'archive') {
                                        const remoteArchive = data.data ? JSON.parse(data.data) : null;
                                        if (remoteArchive && JSON.stringify(remoteArchive) !== JSON.stringify(this.archive)) {
                                            console.log('🔄 تحديث الأرشيف من Firestore');
                                            this.archive = remoteArchive;
                                            updated = true;
                                        }
                                    }
                                    
                                    // تحديث المهام
                                    if (doc.id === 'tasks') {
                                        const remoteTasks = data.data ? JSON.parse(data.data) : [];
                                        if (JSON.stringify(remoteTasks) !== JSON.stringify(this.tasks)) {
                                            console.log('🔄 تحديث المهام من Firestore:', remoteTasks.length, 'مهمة');
                                            this.tasks = remoteTasks;
                                            updated = true;
                                        }
                                    }
                                }
                            });
                            
                            if (updated) {
                                this.saveFilters();
                                this.syncLocalStorage();
                                
                                // إعادة عرض البيانات للمستخدم فوراً
                                if (shouldRefresh) {
                                    this.$nextTick(() => {
                                        // العودة للصفحة الرئيسية إذا كان المستخدم في صفحة أخرى
                                        if (this.currentView !== 'main') {
                                            // تحديث بدون تغيير الصفحة
                                        }
                                        console.log('✓ تم تحديث واجهة التطبيق');
                                    });
                                }
                                
                                console.log('✓ تمت جميع التحديثات من Firestore');
                            }
                        },
                        (error) => {
                            console.error('❌ خطأ في Firestore listener:', error.message);
                            console.log('🔄 محاولة إعادة تفعيل المستمع...');
                            
                            this._firestoreRetries = (this._firestoreRetries || 0) + 1;
                            
                            // تحديد التأخير بناءً على عدد المحاولات (exponential backoff)
                            const retryDelay = Math.min(this._firestoreRetries * 2000, 30000);
                            console.log(`محاولة رقم ${this._firestoreRetries} (بعد ${retryDelay}ms)`);
                            
                            setTimeout(() => {
                                if (navigator.onLine && this._firestoreRetries < 10) {
                                    this.initFirestoreListener();
                                }
                            }, retryDelay);
                        }
                    );
                
                console.log('✓ تم تفعيل Firestore listener للمزامنة الفورية (parcels, settings, archive, tasks)');
            } catch (e) {
                console.error('❌ فشل تفعيل Firestore listener:', e);
            }
        }
    }
}).mount("#app");