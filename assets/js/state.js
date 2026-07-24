const appState = {
    currentView: 'main',
    filters: { search: "", municipality: "", status: "", tag: "", favorite: false },
    showFilters: false,
    drawerOpen: false,
    drawerDataExpanded: false,
    drawerYalidineExpanded: false,
    showAddModal: false,
    showImportSummary: false,
    showHistoryModal: false,
    currentHistory: null,
    statusModalParcel: null,
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
        showDuplicates: true,
        smsTemplate: 'مرحبًا {اسم_المستلم}،\nمعكم خدمة التوصيل.\nطلبيتكم برقم التتبع {رقم_التتبع} جاهزة للاستلام.\nثمن الطرد مع التوصيل: {المبلغ} دج.\nشكرًا لكم!',
        tagsEnabled: false,
        tags: [],
        tagMetadata: {},
        smartTagSortingEnabled: false,
        tagOrder: [],
        customStatuses: [],
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
        bulkSmsEnabled: false
    },
    newCustomStatus: { name: '', color: '#9ca3af', icon: 'fa-tag' },
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
    importStats: { total: 0, new: 0, updated: 0, duplicates: 0, favorites: 0 },
    // نظام الإشعارات والتذكيرات
    showNotificationsPanel: false,
    notifications: [],
    tasks: [],
    showAddTaskModal: false,
    newTask: { description: '', reminderTime: '' },
    showReminderPicker: false,
    reminderPickerParcelId: null,
    reminderTime: { hour: '12', minute: '00' },
    notificationCheckInterval: null,
    showEditTaskModal: false,
    editingTask: null,
    showNotificationHistory: false,
    isListeningForTask: false,
    isListeningForEditTask: false,
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
    isProcessingPdf: false,
    pdfProgress: "",
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
        theme: false,
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
    showGuide: false,
    guideExpanded: {},
    // وضع التركيز
    focusModeActive: false,
    focusModeIndex: 0,
    // Confetti
    showConfetti: false,
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
    // Bottom Navigation
    activeTab: 'parcels',
    // Top Menu (three dots)
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
    // ═══════════════════════════════════════════════════════════════
    // 📋 نظام الجلسات التعاونية (Collaborative Sessions)
    // ═══════════════════════════════════════════════════════════════
    // عرض الجلسات
    showSessionsView: false,
    showCreateSessionModal: false,
    showSessionDetailsModal: false,
    showInviteUserModal: false,
    showSessionActivityLog: false,
    showSessionStatsModal: false,
    // بيانات الجلسات
    sessions: [],
    pendingInvites: [], // الدعوات المعلقة
    currentSession: null,
    sessionParcels: [],
    sessionParticipants: [],
    sessionActivity: [],
    sessionStats: null,
    // إنشاء جلسة جديدة
    newSession: {
        name: '',
        description: '',
        useCurrentFilter: true,
        selectedParcels: [],
        invites: []
    },
    // دعوة مستخدمين
    newInvite: {
        email: '',
        role: 'editor' // viewer, editor, admin
    },
    // حالة المزامنة
    sessionSyncStatus: 'idle', // idle, syncing, synced, error
    sessionListeners: {},
    // المشاركون النشطون
    onlineParticipants: [],
    // الطرد المقفل حالياً
    lockedParcels: {},
    // إشعارات الجلسة
    sessionNotifications: [],
    showSessionNotification: false,
    currentSessionNotification: null
};

if (typeof window !== 'undefined') window.appState = appState;
