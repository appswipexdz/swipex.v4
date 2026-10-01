const appState = {
    // i18n: القيم الداخلية للحالات الثابتة (عربية) — تُستخدم مع statusLabel() للعرض فقط.
    // لا تُترجَم هذه القيم لأنها مفاتيح داخلية مخزَّنة في parcel.status.
    statusMap: {
        no_action: "دون إجراء",
        waiting: "في الإنتظار",
        delivered: "تم التسليم",
        closed: "مغلق",
        no_answer: "لا يرد",
        wrong_number: "رقم خاطئ",
        postponed: "مؤجل للغد",
        cancelled: "إلغاء الطلبية",
    },
    filters: { search: "", municipality: "", status: "", tag: "", favorite: false },
    showFilters: false,
    whatsappLongPressTimer: null,
    whatsappLongPressTriggered: false,
    statusLongPressTimer: null,
    statusLongPressTriggered: false,
    statusLongPressStatus: null,
    drawerOpen: false,
    drawerDataExpanded: false,
    drawerYalidineExpanded: false,
    showAddModal: false,
    showImportSummary: false,
    showHistoryModal: false,
    currentHistory: null,
    statusModalParcel: null,
    // دائرة تأكيد "تم التسليم" المعلّقة في وسط البطاقة (حتى تُلغى أو تنتهي): { parcelId, x, y, token }
    pendingDeliveryConfirm: null,
    showMultiPieceModal: false,
    multiPieceModalParcel: null,
    parcels: [],
    archive: {},
    sessionDate: null,
    newParcel: {
        tracking: "",
        receiver: "",
        phone: "",
        phone2: "",
        address: "",
        municipality: "",
        amount: "",
        content: "",
        sender: "",
        senderPhone: "",
        senderAddress: "",
        isMultiPiece: false,
        piecesCount: 1,
        subTrackings: [],
        openingAllowed: null,
        location: {
            label: "",
            address: "",
            lat: null,
            lng: null,
            mapsUrl: "",
            source: "manual",
            updatedAt: ""
        }
    },
    showPhone2Field: false,
    showSenderFields: false,
    showFabMenu: false,
showYalidineMenu: false,
    settings: { 
        themeMode: 'auto', 
        language: 'ar',
        // اتجاه الواجهة: 'auto' يتبع اللغة (العربية يمين، الفرنسية/الإنجليزية يسار)
        direction: 'auto',
        showDuplicates: true,
        smsTemplate: 'مرحبًا {اسم_المستلم}،\nمعكم خدمة التوصيل.\nطلبيتكم برقم التتبع {رقم_التتبع} جاهزة للاستلام.\nثمن الطرد مع التوصيل: {المبلغ} دج.\nشكرًا لكم!',
        whatsappTemplate: 'مرحبًا {اسم_المستلم}،\nطلبيتكم قد وصلت لدينا، ونحن نتواصل معكم الآن من أجل تحديد مكان الاستلام.\nالمبلغ المطلوب: {المبلغ} دج.\nشكرًا لكم!',
        tagsEnabled: false,
        tags: [],
        tagMetadata: {},
        smartTagSortingEnabled: false,
        tagOrder: [],
        customStatuses: [],
        statusGroups: [],
        smsContentLength: 10,
        smsOnStatusClosed: false,
        smsOnStatusNoAnswer: false,
        smsOnStatusWrongNumber: false,
        smsSaving: false,
        statusActionEnabled: {},
        smsStatusTemplate: 'مرحبًا {اسم_المستلم}،\nحاولنا التواصل معكم بخصوص طلبيتكم برقم {رقم_التتبع} ولم نتمكن من ذلك.\nيرجى التواصل معنا لاستلام طلبيتكم.\nشكرًا لكم!',
        smsWrongNumberTemplate: 'مرحبًا {اسم_المرسل}،\nنود إعلامكم أن رقم الهاتف الخاص بالطلبية رقم {رقم_التتبع} ({البلدية} - {الولاية}) غير صحيح.\nيرجى تزويدنا بالرقم الصحيح في أقرب وقت.\nشكرًا لكم!',
        statusOrder: [],
        favoritePhones: [],
        favoritePhonesEnabled: false,
        bulkSmsEnabled: false,
        deliveryCueEnabled: true,
        archiveSyncEnabled: true
    },
    newCustomStatus: { name: '', color: '#9ca3af', icon: 'fa-tag' },
    statusGroupSelection: {},
    expandedStatusGroupId: null,
    // نافذة تأكيد تغيير الحالة مع SMS
    showStatusSmsConfirm: false,
    statusSmsConfirmParcel: null,
    statusSmsConfirmStatus: null,
    // نظام التمييز
    showTagsDropdown: false,
    showTagPicker: false,
    tagPickerParcelId: null,
    newTagInput: '',
    newTagForm: {
        name: '',
        color: '#8b5cf6',
        scope: 'global',
        municipality: ''
    },
    quickTagInput: '',
    quickTagForm: {
        name: '',
        color: '#8b5cf6',
        scope: 'global',
        municipality: ''
    },
    showQuickTagForm: false,
    importStats: { total: 0, new: 0, updated: 0, duplicates: 0, favorites: 0 },
    // نظام الإشعارات والتذكيرات
    showNotificationsPanel: false,
    notifications: [],
    // نظام المهام الجديد (الشكل الكامل في assets/js/taskStore.js)
    tasks: [],
    showReminderPicker: false,
    reminderPickerParcelId: null,
    reminderTime: { hour: '12', minute: '00' },
    notificationCheckInterval: null,
    showNotificationHistory: false,
    isPageLoading: true,
    toasts: [], // نظام الإشعارات المؤقتة
    statusList: [
        { name: "دون إجراء", color: "border-gray-300", dot: "bg-gray-400", icon: "fa-hourglass-start" },
        { name: "في الإنتظار", color: "border-orange-400", dot: "bg-orange-400", icon: "fa-clock" },
        { name: "تم التسليم", color: "border-green-500", dot: "bg-green-500", icon: "fa-check-circle" },
        { name: "مغلق", color: "border-yellow-400", dot: "bg-yellow-400", icon: "fa-phone-slash" },
        { name: "لا يرد", color: "border-yellow-400", dot: "bg-yellow-400", icon: "fa-phone-alt" },
        { name: "رقم خاطئ", color: "border-yellow-400", dot: "bg-yellow-400", icon: "fa-exclamation-triangle" },
        { name: "مؤجل للغد", color: "border-blue-400", dot: "bg-blue-400", icon: "fa-calendar-day" },
        { name: "إلغاء الطلبية", color: "border-red-500", dot: "bg-red-500", icon: "fa-times-circle" },
    ],
    sortableInstance: null,
    tagSortInstance: null,
    smartTagSortingPaused: false,
    _smartTagSortingTimer: null,
    touchStartX: 0,
    touchStartY: 0,
    currentTouchX: 0,
    activeSwipeId: null,
    isDragging: false,
    SWIPE_THRESHOLD: 80,
    recognition: null,
    activeListeningId: null,
    voiceSearchActive: false,
    micConnected: false,
    isProcessingPdf: false,
    pdfProgress: "",
    initialSyncProgress: null,
    showMunicipalityDropdown: false,
    showScanner: false,
    scannerMode: null,
    lastScannedCode: null,
    scannedCodeCount: 0,
    isProcessingCode: false,
    showPhonePickerModal: false,
    phonePickerParcel: null,
    showLocationPickerModal: false,
    locationPickerParcel: null,
    locationPickerMap: null,
    locationPickerLat: null,
    locationPickerLng: null,
    noteModalParcel: null,
    favInfoParcelId: null,
    lastScrollY: 0,
    headerHidden: false,
    showEditModal: false,
    editParcel: null,
    editParcelId: null,
    // تأكيد تعديل السعر
    showPriceConfirmModal: false,
    pendingPriceChange: null,
    showEditMunicipalityList: false,
    newFavoritePhone: '',
    settingsExpanded: {
        appearance: false,
        duplicates: false,
        tags: false,
        statuses: false,
        sms: false,
        data: false,
        info: false,
        favoritePhones: false,
        password: false
    },
    showUserMenu: false,
    currentUser: null,
    settingsPasswordForm: {
        password: '',
        confirmPassword: ''
    },
    _firestoreLoaded: false,
    syncStatus: 'idle',
    // مفتاح تبديل الصفحة: يُستخدم كـ :key على جذر القالب
    // Force Vue to fully unmount/remount the page tree on SPA navigation,
    // otherwise components with static props (swipex-header) are reused stale.
    pageKey: 'home',
    // الصفحة الحالية — حالة تفاعلية وليست خاصية محسوبة، لأن
    // document.body.dataset غير تفاعلية فكانت القيمة تُخزَّن ولا تتحدث بعد تنقل SPA.
    appPage: (typeof document !== 'undefined' && document.body && document.body.dataset && document.body.dataset.page) || 'home',
    _dirtyParcels: new Set(),
    _dirtyArchive: new Set(),
    _settingsDirty: false,
    _settingsLocalUpdatedAt: null,
    _lastPulledAt: null,
    _deviceId: null,
    showSmsEditor: false,
    smsEditorKey: '',
    smsEditorText: '',
    // متغيرات العمل دون إنترنت
    isOnline: navigator.onLine,
    firestorePersistence: false,
    // مستمع Firestore للمزامنة الفورية
    firestoreUnsub: null,
    // لوحة الإحصائيات
    showDashboard: false,
    showDailySummaryDetails: false,
    showGuide: false,
    guideExpanded: {},
    // وضع التركيز
    focusModeActive: false,
    focusModeIndex: 0,
    // الاحتفال المتدرّج عند التسليم
    deliveryMilestones: [10, 25, 50, 100], // عدّاد الطرود المُسلَّمة التي تُطلق احتفالاً
    celebrationPulse: null,      // { x, y, token } حلقة تأكيد محلية على البطاقة
    celebrationBurst: null,      // { x, y, token } دفعة قصاصات محصورة بالبطاقة
    celebrationMilestone: null,  // { count } شريط المحطة
    celebrationGoal: null,       // { count } بطاقة بلوغ هدف اليوم
    _celebrationToken: 0,
    _celebrationSeen: {},
    // Focus Mode extras
    focusEditingNotes: false,
    focusTouchStartX: 0,
    focusTouchDeltaX: 0,
    focusSwiping: false,
    focusAnimating: false,
    showStatusOrderModal: false,
    statusOrderList: [],
    showDeleteConfirm: false,
    deleteConfirmId: null,
    showClearDataConfirm: false,
    // SMS جماعي
    showBulkSmsModal: false,
    bulkSmsFilter: 'all',
    bulkSmsStatusFilter: '',
    bulkSmsTagFilter: '',
    bulkSmsMunicipalityFilter: '',
    bulkSmsQueue: [],
    bulkSmsIndex: 0,
    bulkSmsSending: false,
    // Bottom Navigation (تعريفها في assets/js/shell.js)
    // Top Menu (three dots) — معرّف في assets/js/shell.js
    showTopMenu: false,
    // Progress bar compact mode
    progressBarCompact: false,
    // الأرشيف
    archiveSearch: '',
    archiveStatusFilter: '',
    archiveVisibleCount: 30,
    // سجل العميل
    showCustomerHistory: false,
    customerHistoryParcel: null,
    customerHistoryData: [],
    customerHistoryPhoneSuggestions: [],
};

if (typeof window !== 'undefined') window.appState = appState;

// i18n/theme: تفضيلات الواجهة تُقرأ من localStorage قبل أول paint
// (assets/js/boot-prefs.js في <head>) وتُحقن هنا، لأن loadData()
// التي تقرأ 'swipex_pro_v2' لا تعمل إلا بعد تأكيد Firebase للمصادقة.
// بدون هذا الحقن يبقى language على 'ar' في أول render، فيظهر نص
// t('app.loading') بلغة خاطئة قبل أن تقفز الواجهة إلى لغة المستخدم.
(function applyBootSpecs() {
    const specs = (typeof window !== 'undefined' && window.__swipexBootSpecs) || null;
    if (!specs) return;
    if (specs.language) appState.settings.language = specs.language;
    if (specs.direction) appState.settings.direction = specs.direction;
    if (specs.themeMode) appState.settings.themeMode = specs.themeMode;
})();
