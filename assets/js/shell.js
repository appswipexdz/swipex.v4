// ============================================
// assets/js/shell.js
// App Shell مشترك لكل صفحات SwiPex Pro
// - SwipexHeader : هيدر موحّد (رجوع + عنوان + slot + لوغو + حالة المزامنة)
// - SwipexShell  : Bottom Nav (5 عناصر) + زر + العائم + قائمة الإجراءات
//                 + قائمة ياليدين + لوحة الإشعارات + مودالات مشتركة + Toasts
// كل تعديل على اسم/أيقونة/ترتيب عنصر في التنقّل يتم من هذا الملف فقط.
// ============================================

(function (global) {
    "use strict";

    // ---------- جسر ثنائي الاتجاه إلى حالة التطبيق ($root) ----------
    // قوالب المكوّنات لا تصل إلى $root مباشرة، وكل خاصية غير معرّفة على المكوّن
    // تُقرأ undefined (فتفشل v-if) أو تُكتب بصمت (فتفشل v-model / @click).
    // هذه الخصائص المحسوبة القابلة للكتابة تصل بين القالب و appState.
    function rootState(key) {
        return {
            get() {
                return this.$root[key];
            },
            set(v) {
                this.$root[key] = v;
            },
        };
    }

    // ---------- قراءة الصفحة الحالية ----------
    function currentPage() {
        if (typeof document === "undefined") return "home";
        const b = document.body;
        const p = b && b.dataset ? b.dataset.page : "";
        return p || "home";
    }

    // ---------- عناصر الشريط السفلي (الترتيب المطلوب: من اليسار إلى اليمين) ----------
    const NAV_ITEMS = [
        { key: "settings", icon: "fa-user-cog", label: "الإعدادات", href: "settings.html" },
        { key: "tasks", icon: "fa-list-check", label: "المهام", href: "tasks.html", badge: "tasks" },
        { key: "home", icon: "fa-home", label: "الرئيسية", href: "index.html" },
        { key: "yalidine", icon: "fa-shipping-fast", label: "ياليدين", action: "yalidine" },
        { key: "notifications", icon: "fa-bell", label: "الإشعارات", action: "notifications", badge: "notifications" },
    ];

    // ---------- روابط ياليدين (نفسها الحالية، بلا تغيير) ----------
    const YALIDINE_LINKS = [
        {
            href: "https://yalidine.app/app/livraison/livrer_un_colis.php",
            icon: "fa-truck-fast",
            label: "التوزيع",
            color: "text-orange-600 dark:text-orange-400",
            hover: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
        },
        {
            href: "https://yalidine.app/app/demande/ouverture/demande.php",
            icon: "fa-box-open",
            label: "طلب فتح طلبية",
            color: "text-blue-600 dark:text-blue-400",
            hover: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
        },
        {
            href: "https://yalidine.app/app/demande/prix/demande.php",
            icon: "fa-tags",
            label: "طلب تغيير السعر",
            color: "text-green-600 dark:text-green-400",
            hover: "hover:bg-green-50 dark:hover:bg-green-900/20",
        },
    ];

    // ---------- إجراءات زر + (الرئيسية) ----------
    const FAB_ACTIONS_HOME = [
        {
            id: "bulk-sms",
            label: "SMS جماعي",
            icon: "fa-paper-plane",
            gradient: "from-purple-500 to-violet-600",
            run: "openBulkSmsModal",
            requiresFlag: "bulkSmsEnabled",
        },
        {
            id: "focus",
            label: "وضع التركيز",
            icon: "fa-crosshairs",
            gradient: "from-amber-500 to-orange-600",
            run: "enterFocusMode",
        },
        {
            id: "add-parcel",
            label: "إضافة طرد",
            icon: "fa-box",
            gradient: "from-red-500 to-rose-600",
            run: null,
            click: "add-parcel",
        },
    ];

    // ---------- قائمة النقاط الثلاث (موحّدة في كل الصفحات) ----------
    const TOP_MENU = [
        { id: "pdf", label: "استيراد ملف PDF", icon: "fa-file-pdf", color: "text-red-500", run: "triggerPdfInput", homeOnly: true },
        { id: "excel", label: "استيراد ملف Excel", icon: "fa-file-excel", color: "text-blue-500", run: "triggerFileInput", homeOnly: true },
        { divider: true },
        { id: "dashboard", label: "لوحة الإحصائيات", icon: "fa-chart-pie", color: "text-indigo-500", run: "openDashboard", homeOnly: true },
        { id: "archive", label: "الأرشيف", icon: "fa-archive", color: "text-purple-500", href: "archive.html" },
        { id: "export", label: "تصدير النتائج", icon: "fa-file-export", color: "text-green-500", run: "exportExcel", homeOnly: true },
        { divider: true },
        { id: "guide", label: "دليل الاستخدام", icon: "fa-book-open", color: "text-teal-500", run: "showGuide", homeOnly: true },
    ];

    // ============ الهيدر الموحّد ============
    const HeaderTemplate = `
<div class="app-header-bar sticky flex items-center justify-between shadow-lg" style="padding-top: max(6px, env(safe-area-inset-top)); padding-bottom: 6px;">
    <!-- يمين: زر الرجوع + أزرار الصفحة -->
    <div class="flex items-center gap-2 min-w-0">
        <button v-if="showBack" type="button" class="header-action flex-shrink-0" @click="goBack" title="رجوع">
            <i class="fas fa-arrow-right text-sm"></i>
        </button>
        <slot name="actions"></slot>
    </div>

    <!-- الوسط: العنوان (أو لوقو SwiPex في الرئيسية) -->
    <div v-if="showLogo" class="flex items-center justify-center flex-shrink-0">
        <img src="assets/icons/logo.png" alt="SwiPex" class="h-8 rounded-lg" />
    </div>
    <h1 v-else class="text-sm sm:text-base font-bold flex items-center gap-2 min-w-0">
        <i class="fas" :class="[icon, 'text-white/90']"></i>
        <span class="truncate">{{ title }}</span>
    </h1>

    <!-- يسار: اللوغو + حالة المزامنة/الاتصال -->
    <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <img v-if="!showLogo" src="assets/icons/logo.png" alt="SwiPex" class="h-7 rounded-lg hidden sm:block" />
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
            <div v-if="syncStatus === 'syncing'" class="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                <i class="fas fa-circle-notch animate-spin text-sm"></i>
                <span class="hidden sm:inline">مزامنة...</span>
            </div>
            <div v-else-if="syncStatus === 'synced'" class="flex items-center gap-1.5 text-xs font-bold text-green-300">
                <i class="fas fa-check-circle text-sm"></i>
                <span class="hidden sm:inline">محفوظ</span>
            </div>
            <div v-else-if="syncStatus === 'error'" class="flex items-center gap-1.5 text-xs font-bold text-red-300">
                <i class="fas fa-exclamation-circle text-sm"></i>
                <span class="hidden sm:inline">خطأ</span>
            </div>
            <div v-else-if="syncStatus === 'offline'" class="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                <i class="fas fa-pause-circle text-sm"></i>
                <span class="hidden sm:inline">متوقفة</span>
            </div>
            <div v-else class="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                <i class="fas fa-pause-circle text-sm"></i>
                <span class="hidden sm:inline">جاهز</span>
            </div>

            <div class="h-3 w-px bg-white/20"></div>

            <div v-if="isOnline" class="flex items-center gap-1.5 text-xs font-bold text-green-300">
                <i class="fas fa-wifi text-sm"></i>
                <span class="hidden sm:inline">متصل</span>
            </div>
            <div v-else class="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                <i class="fas fa-wifi text-sm relative"><span class="absolute left-[-2px] top-1/2 w-[18px] h-[2px] bg-gray-500 -rotate-45 origin-center"></span></i>
                <span class="hidden sm:inline">منقطع</span>
            </div>
        </div>
    </div>
</div>
`;

    const SwipexHeader = {
        name: "SwipexHeader",
        template: HeaderTemplate,
        props: {
            title: { type: String, default: "" },
            icon: { type: String, default: "fa-box" },
            backHref: { type: String, default: "" },
            hideBack: { type: Boolean, default: false },
            showLogo: { type: Boolean, default: false },
        },
        computed: {
            page() {
                return this.$root.appPage;
            },
            showBack() {
                return !this.hideBack && this.page !== "home";
            },
            syncStatus() {
                return this.$root.syncStatus;
            },
            isOnline() {
                return this.$root.isOnline;
            },
        },
        methods: {
            goBack() {
                const target = this.backHref || "index.html";
                if (this.page === target.replace(/\.html$/, "")) return;
                const root = this.$root;
                if (root && typeof root.navigate === "function") root.navigate(target);
                else window.location.href = target;
            },
        },
    };

    // ============ الشريط السفلي +FAB + المودالات المشتركة ============
    const ShellTemplate = `
<!-- ============ Bottom Navigation Bar ============ -->
<div class="bottom-nav" v-if="navVisible">
    <div class="bottom-nav-inner">
        <template v-for="item in navItems" :key="item.key">

            <!-- الإعدادات + زر + العائم فوقه (يمين الشاشة في RTL) -->
            <div v-if="item.key === 'settings'" class="nav-slot">
                <a class="bottom-nav-item" :class="{ active: page === 'settings' }" :href="item.href"
                    @click.prevent="go(item.href)">
                    <i class="fas" :class="item.icon"></i>
                    <span class="nav-label">{{ item.label }}</span>
                </a>

                <template v-if="fabEnabled">
                    <button type="button" class="fab-float" :class="{ 'rotate-45': fabMenuOpen }"
                        :aria-label="'إجراءات سريعة'" @click.stop="onFabClick()">
                        <span v-if="!fabMenuOpen" class="fab-pulse"></span>
                        <i class="fas fa-plus"></i>
                    </button>
                    <div v-if="fabMenuOpen" class="fab-action-menu" @click.stop>
                        <button v-for="act in fabActions" :key="act.id" type="button" class="fab-action-item"
                            @click="onFabAction(act)">
                            <span class="fab-action-icon bg-gradient-to-br" :class="act.gradient">
                                <i class="fas" :class="act.icon"></i>
                            </span>
                            <span class="fab-action-label">{{ act.label }}</span>
                        </button>
                    </div>
                </template>
            </div>

            <!-- المهام -->
            <div v-else-if="item.key === 'tasks'" class="nav-slot">
                <a class="bottom-nav-item" :class="{ active: page === 'tasks' }" :href="item.href"
                    @click.prevent="go(item.href)">
                    <i class="fas" :class="item.icon"></i>
                    <span class="nav-label">{{ item.label }}</span>
                    <span v-if="pendingTasks > 0" class="nav-badge">{{ pendingTasks > 99 ? '99+' : pendingTasks }}</span>
                </a>
            </div>

            <!-- الرئيسية (أيقونة كبيرة داخل قوس يرتفع فوق البار) -->
            <div v-else-if="item.key === 'home'" class="nav-slot nav-slot-home">
                <a class="bottom-nav-item bottom-nav-item-home" :class="{ active: page === 'home' && !showNotificationsPanel }" :href="item.href"
                    @click.prevent="go(item.href)">
                    <span class="nav-home-arc">
                        <i class="fas" :class="item.icon"></i>
                    </span>
                    <span class="nav-label">{{ item.label }}</span>
                </a>
            </div>

            <!-- ياليدين -->
            <div v-else-if="item.key === 'yalidine'" class="nav-slot">
                <button type="button" class="bottom-nav-item" :class="{ active: showYalidineMenu }"
                    @click.stop="toggleYalidine()">
                    <i class="fas" :class="item.icon"></i>
                    <span class="nav-label">{{ item.label }}</span>
                </button>
                <div v-if="showYalidineMenu" class="yalidine-dropdown" @click.stop>
                    <a v-for="link in yalidineLinks" :key="link.href" :href="link.href" target="_blank"
                        rel="noopener" class="yalidine-dropdown-item" :class="[link.color, link.hover]"
                        @click="showYalidineMenu = false">
                        <i class="fas" :class="link.icon"></i>
                        <span>{{ link.label }}</span>
                    </a>
                </div>
            </div>

            <!-- الإشعارات -->
            <div v-else-if="item.key === 'notifications'" class="nav-slot">
                <button type="button" class="bottom-nav-item" :class="{ active: showNotificationsPanel }"
                    style="position: relative" @click="toggleNotifications()">
                    <i class="fas" :class="item.icon"></i>
                    <span class="nav-label">{{ item.label }}</span>
                    <span v-if="unread > 0" class="nav-badge"
                        style="background:#ef4444">{{ unread > 99 ? '99+' : unread }}</span>
                </button>
            </div>
        </template>
    </div>
</div>

<!-- Click-away overlays -->
<div v-if="showTopMenu" @click="showTopMenu = false" class="fixed inset-0 z-30"></div>
<div v-if="showYalidineMenu" @click="showYalidineMenu = false" class="fixed inset-0 z-40"></div>
<div v-if="showFabMenu" @click="showFabMenu = false; showYalidineMenu = false" class="fixed inset-0 z-[35]"></div>

<!-- ============ Notifications Panel ============ -->
<div v-if="showNotificationsPanel"
    class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-start justify-center pt-16"
    @click="showNotificationsPanel = false">
    <div class="w-full mx-3 max-w-md max-h-[70vh] overflow-hidden rounded-2xl glass-panel border border-gray-200 dark:border-gray-700 shadow-2xl"
        @click.stop>
        <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <i class="fas fa-bell"></i>
                    الإشعارات
                </h3>
                <div class="flex items-center gap-2">
                    <button v-if="notifications.length > 0" @click="clearAllNotifications"
                        class="text-white/80 hover:text-white text-xs">
                        مسح الكل
                    </button>
                    <button @click="showNotificationsPanel = false"
                        class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="max-h-80 overflow-y-auto">
            <div v-if="notifications.length === 0" class="p-8 text-center">
                <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-bell-slash text-2xl text-gray-400"></i>
                </div>
                <p class="text-gray-500 dark:text-gray-400">لا توجد إشعارات</p>
            </div>

            <div v-for="notif in notifications" :key="notif.id"
                class="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                :class="{ 'bg-amber-50/50 dark:bg-amber-900/20': !notif.read }"
                @click="goToNotificationParcel(notif)">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        :class="notif.type === 'task' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-amber-100 dark:bg-amber-900/50'">
                        <i class="fas"
                            :class="notif.type === 'task' ? 'fa-list-check text-blue-600 dark:text-blue-400' : 'fa-bell text-amber-600 dark:text-amber-400'"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-gray-800 dark:text-gray-100 text-sm">
                            {{ notif.title }}
                        </div>
                        <p class="text-gray-600 dark:text-gray-300 text-sm truncate">
                            {{ notif.message }}
                        </p>
                        <span class="text-xs text-gray-400">{{ formatNotificationTime(notif.time) }}</span>
                    </div>
                    <button @click.stop="deleteNotification(notif.id)" class="text-gray-400 hover:text-red-500 p-1">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="p-3 border-t border-gray-200 dark:border-gray-700">
            <button @click="showNotificationHistory = true; showNotificationsPanel = false"
                class="w-full py-2 text-center text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition flex items-center justify-center gap-2">
                <i class="fas fa-history"></i>
                سجل الإشعارات
            </button>
        </div>
    </div>
</div>

<!-- ============ Notification History Modal ============ -->
<div v-if="showNotificationHistory"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    @click="showNotificationHistory = false">
    <div class="modal-glass rounded-2xl w-full max-w-md overflow-hidden flex flex-col" style="max-height: 80vh" @click.stop>
        <div class="bg-gradient-to-r from-gray-600 to-gray-700 p-4 sticky top-0">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <i class="fas fa-history"></i>
                    سجل الإشعارات
                </h3>
                <div class="flex items-center gap-2">
                    <button v-if="notifications.length > 0" @click="clearAllNotifications"
                        class="text-white/80 hover:text-white text-xs">
                        مسح الكل
                    </button>
                    <button @click="showNotificationHistory = false"
                        class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto">
            <div v-if="notifications.length === 0" class="p-8 text-center">
                <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-bell-slash text-2xl text-gray-400"></i>
                </div>
                <p class="text-gray-500 dark:text-gray-400">لا توجد إشعارات سابقة</p>
            </div>

            <div v-for="notif in notifications" :key="notif.id"
                class="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                :class="{ 'bg-amber-50/50 dark:bg-amber-900/20': !notif.read }">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        :class="notif.type === 'task' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-amber-100 dark:bg-amber-900/50'">
                        <i class="fas"
                            :class="notif.type === 'task' ? 'fa-list-check text-blue-600 dark:text-blue-400' : 'fa-bell text-amber-600 dark:text-amber-400'"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-gray-800 dark:text-gray-100 text-sm">{{ notif.title }}</div>
                        <p class="text-gray-600 dark:text-gray-300 text-sm">{{ notif.message }}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs text-gray-400">{{ formatNotificationTime(notif.time) }}</span>
                            <span v-if="notif.tracking"
                                class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">{{ notif.tracking }}</span>
                        </div>
                    </div>
                    <button @click="deleteNotification(notif.id)" class="text-gray-400 hover:text-red-500 p-1">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <button @click="showNotificationHistory = false"
                class="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:opacity-90 transition">
                إغلاق
            </button>
        </div>
    </div>
</div>

<!-- ============ Parcel / Archive History Modal (مشترك) ============ -->
<div v-if="showHistoryModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    @click="showHistoryModal = false">
    <div class="modal-glass rounded-2xl w-full max-w-md overflow-hidden" @click.stop>
        <div class="bg-gradient-to-r from-red-600 via-red-500 to-rose-600 p-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <i class="fas fa-history text-white"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-white">السجل التاريخي</h2>
                        <p class="text-xs text-white/70">معلومات من المحاولات السابقة</p>
                    </div>
                </div>
                <button @click="showHistoryModal = false"
                    class="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>

        <div v-if="currentHistory && currentHistory.length" class="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div class="space-y-3">
                <template v-for="(event, index) in currentHistory" :key="index">
                    <div class="glass-panel p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-flag text-white text-sm"></i>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold">الحالة</div>
                                    <div class="text-base font-bold text-gray-800 dark:text-white">{{ event.status }}</div>
                                </div>
                            </div>
                            <div class="text-[11px] text-gray-500 dark:text-gray-400">
                                {{ formatDate(event.statusUpdatedAt || event.lastUpdate) }}
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div v-if="event.tag"
                                class="glass-panel p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                <div class="text-[11px] font-semibold mb-1">التمييز</div>
                                <div class="font-bold">@{{ event.tag }}</div>
                            </div>
                            <div v-if="event.notes"
                                class="glass-panel p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                                <div class="text-[11px] font-semibold mb-1">الملاحظات</div>
                                <div class="text-sm leading-relaxed">{{ event.notes }}</div>
                            </div>
                        </div>
                        <div v-if="event.location && (event.location.address || event.location.mapsUrl)"
                            class="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                            <div class="text-[11px] font-semibold mb-1">الموقع</div>
                            <div class="text-sm font-bold">{{ getLocationDisplay(event) }}</div>
                            <div v-if="getLocationMeta(event)" class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                {{ getLocationMeta(event) }}
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <div v-else class="p-8 text-center">
            <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-inbox text-2xl text-gray-400"></i>
            </div>
            <p class="text-gray-500 dark:text-gray-400">لا يوجد سجل تاريخي</p>
        </div>

        <div class="p-4 border-t border-gray-200 dark:border-gray-700">
            <button @click="showHistoryModal = false"
                class="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg">
                إغلاق
            </button>
        </div>
    </div>
</div>

<!-- ============ Multi-piece Modal (مشترك) ============ -->
<div v-if="showMultiPieceModal && multiPieceModalParcel"
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    @click="closeMultiPieceModal">
    <div class="modal-glass rounded-2xl w-full max-w-md p-5 max-h-[80vh] flex flex-col" @click.stop>
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <i class="fas fa-layer-group text-indigo-500"></i>
                طرد متعدد القطع
            </h3>
            <button @click="closeMultiPieceModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="mb-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">كود المجموعة</div>
            <div class="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-mono font-bold w-fit cursor-pointer hover:bg-blue-500 transition"
                @click="copyTracking(multiPieceModalParcel.tracking)" title="نسخ كود المجموعة">
                <i class="fas fa-copy text-[10px] opacity-60"></i>
                {{ multiPieceModalParcel.tracking }}
            </div>
            <div v-if="multiPieceModalParcel.receiver" class="text-sm font-bold text-gray-800 dark:text-gray-100 mt-2">
                {{ multiPieceModalParcel.receiver }}
            </div>
            <div v-if="multiPieceModalParcel.amount" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                المبلغ: {{ formatCurrency(multiPieceModalParcel.amount) }}
            </div>
        </div>
        <div class="overflow-y-auto max-h-[45vh] space-y-2 mb-4">
            <div v-for="(sub, idx) in multiPieceModalParcel.subTrackings" :key="idx"
                class="glass-panel rounded-xl p-3 flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex flex-col items-center justify-center flex-shrink-0">
                    <span class="text-[9px] leading-none">قطعة</span>
                    <span class="text-xs font-bold leading-tight">{{ sub.pieceIndex || (idx + 1) }}/{{ multiPieceModalParcel.piecesCount || multiPieceModalParcel.subTrackings.length }}</span>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="font-mono font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{{ sub.tracking }}</div>
                    <div v-if="sub.pin" class="text-[11px] text-gray-500 dark:text-gray-400">
                        PIN: <span class="font-mono">{{ sub.pin }}</span>
                    </div>
                </div>
                <button @click="copyTracking(sub.tracking)" title="نسخ رقم التتبع الفرعي"
                    class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-white hover:bg-indigo-500 transition flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-copy text-xs"></i>
                </button>
            </div>
            <div v-if="!multiPieceModalParcel.subTrackings || multiPieceModalParcel.subTrackings.length === 0"
                class="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                لا توجد أرقام فرعية لهذا الطرد.
            </div>
        </div>
        <div class="flex gap-2">
            <button @click="copyAllSubTrackings"
                class="flex-1 px-4 py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition flex items-center justify-center gap-2">
                <i class="fas fa-copy text-xs"></i>
                نسخ كل الأرقام
            </button>
            <button @click="openYalidine(multiPieceModalParcel.tracking, multiPieceModalParcel)"
                class="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition flex items-center justify-center gap-2">
                <i class="fas fa-box text-xs"></i>
                فتح في ياليدين
            </button>
        </div>
    </div>
</div>

<!-- ============ Toasts ============ -->
<div class="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-[90%] pointer-events-none">
    <transition-group name="toast">
        <div v-for="toast in toasts" :key="toast.id"
            class="px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto backdrop-blur-md animate-toast-in"
            :class="{
                'bg-gray-800/90 text-white': toast.type === 'info',
                'bg-green-600/90 text-white': toast.type === 'success',
                'bg-red-600/90 text-white': toast.type === 'error',
                'bg-amber-500/90 text-white': toast.type === 'warning'
            }">
            <i class="fas" :class="{
                'fa-info-circle': toast.type === 'info',
                'fa-check-circle': toast.type === 'success',
                'fa-exclamation-circle': toast.type === 'error',
                'fa-exclamation-triangle': toast.type === 'warning'
            }"></i>
            <span class="text-sm font-bold">{{ toast.message }}</span>
        </div>
    </transition-group>
</div>

<!-- ============ نافذة إنشاء/تعديل المهمة (مشتركة في كل الصفحات) ============ -->
<div v-if="showTaskComposer"
    class="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="closeComposer">
    <div class="modal-glass rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col"
        @click.stop>
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <i class="fas" :class="isEditing ? 'fa-pen' : 'fa-plus'"
                    :style="{ color: isEditing ? '#f59e0b' : '#3b82f6' }"></i>
                {{ composerTitle }}
            </h3>
            <button @click="closeComposer"
                class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-red-500 transition">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- Body -->
        <div class="p-4 space-y-4 overflow-y-auto">
            <div>
                <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">العنوان *</label>
                <input v-model="draft.title" type="text" placeholder="مثال: إعادة الاتصال بالعميل"
                    class="w-full p-3 rounded-xl glass-input text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
                <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">الوصف</label>
                <textarea v-model="draft.description" rows="2"
                    placeholder="تفاصيل إضافية عن المهمة..."
                    class="w-full p-3 rounded-xl glass-input text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>

            <div>
                <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">الأولوية</label>
                <div class="grid grid-cols-4 gap-2">
                    <button v-for="p in taskPriorities" :key="p.value" type="button"
                        @click="draft.priority = p.value"
                        class="py-2 rounded-xl text-xs font-bold border transition-all"
                        :class="draft.priority === p.value
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                            : 'glass-panel text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'">
                        <i class="fas" :class="p.icon + ' ml-1'"></i>
                        {{ p.label }}
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                        <i class="fas fa-calendar-day text-gray-400"></i>
                        التاريخ
                    </label>
                    <input v-model="draft.dueDate" type="date"
                        class="w-full p-3 rounded-xl glass-input text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                        <i class="fas fa-clock text-gray-400"></i>
                        الوقت
                    </label>
                    <input v-model="draft.dueTime" type="time"
                        class="w-full p-3 rounded-xl glass-input text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            <div>
                <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">الملاحظات</label>
                <textarea v-model="draft.notes" rows="2" placeholder="ملاحظات خاصة..."
                    class="w-full p-3 rounded-xl glass-input text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>

            <!-- ربط بطرد -->
            <div>
                <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    <i class="fas fa-box text-gray-400"></i>
                    الطرد المرتبط
                </label>
                <div v-if="linkedParcel"
                    class="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                    <i class="fas fa-box text-blue-600 dark:text-blue-400"></i>
                    <div class="flex-1 min-w-0">
                        <div class="font-mono font-bold text-sm text-blue-700 dark:text-blue-300 truncate">
                            {{ linkedParcel.tracking }}
                        </div>
                        <div v-if="linkedParcel.receiver" class="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {{ linkedParcel.receiver }}
                        </div>
                    </div>
                    <button @click="clearParcelLink"
                        class="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 transition flex-shrink-0">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <button v-else type="button" @click="toggleParcelPicker"
                    class="w-full py-3 rounded-xl glass-input text-gray-500 dark:text-gray-400 text-sm font-bold hover:border-blue-300 transition flex items-center justify-center gap-2">
                    <i class="fas fa-link"></i>
                    ربط مهمة بطرد
                </button>

                <div v-if="showParcelPicker" class="mt-2 glass-panel rounded-xl overflow-hidden">
                    <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                        <input v-model="linkParcelQuery" type="text"
                            placeholder="ابحث بالرقم أو الاسم أو الهاتف..."
                            class="w-full p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div class="max-h-52 overflow-y-auto">
                        <div v-if="parcelOptions.length === 0" class="p-4 text-center text-gray-400 text-sm">
                            لا توجد طرود مطابقة
                        </div>
                        <button v-for="p in parcelOptions" :key="p.id" type="button" @click="pickParcel(p)"
                            class="w-full p-3 text-right border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition flex items-center gap-2">
                            <div class="min-w-0 flex-1">
                                <div class="font-mono font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
                                    {{ p.tracking }}
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {{ p.receiver || 'بدون اسم' }}
                                </div>
                            </div>
                            <i class="fas fa-chevron-left text-gray-300 text-xs flex-shrink-0"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-shrink-0">
            <button @click="closeComposer"
                class="flex-1 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold transition">
                إلغاء
            </button>
            <button @click="saveTask" :disabled="!canSaveTask"
                class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-lg transition"
                :class="canSaveTask ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'">
                {{ isEditing ? 'حفظ التعديل' : 'إضافة' }}
            </button>
        </div>
    </div>
</div>
`;

    const SwipexShell = {
        name: "SwipexShell",
        template: ShellTemplate,
        computed: {
            page() {
                return this.$root.appPage;
            },
            // --- أعلام الحالة المشتركة (قابلة للقراءة والكتابة عبر $root) ---
            showYalidineMenu: rootState("showYalidineMenu"),
            showFabMenu: rootState("showFabMenu"),
            showTopMenu: rootState("showTopMenu"),
            showNotificationsPanel: rootState("showNotificationsPanel"),
            showNotificationHistory: rootState("showNotificationHistory"),
            showHistoryModal: rootState("showHistoryModal"),
            showMultiPieceModal: rootState("showMultiPieceModal"),
            multiPieceModalParcel: rootState("multiPieceModalParcel"),
            currentHistory: rootState("currentHistory"),
            // --- نافذة المهمة (نظام المهام على $root) ---
            showTaskComposer: rootState("showTaskComposer"),
            linkParcelQuery: rootState("linkParcelQuery"),
            showParcelPicker: rootState("showParcelPicker"),
            draft: rootState("draft"),
            taskPriorities() {
                const ts = this.$root.taskStore;
                return ts && ts.PRIORITIES ? ts.PRIORITIES : [];
            },
            linkedParcel() {
                return this.$root.linkedParcel || null;
            },
            parcelOptions() {
                return this.$root.parcelOptions || [];
            },
            canSaveTask() {
                return String((this.draft && this.draft.title) || "").trim() !== "";
            },
            isEditing() {
                return !!this.$root.editingTaskId;
            },
            composerTitle() {
                return this.$root.composerTitle || "مهمة جديدة";
            },
            navItems() {
                return NAV_ITEMS;
            },
            yalidineLinks() {
                return YALIDINE_LINKS;
            },
            fabActions() {
                return FAB_ACTIONS_HOME.filter(
                    (a) => !a.requiresFlag || this.$root.settings[a.requiresFlag]
                );
            },
            // زر + العائم يظهر في الرئيسية فقط، لأن صفحة المهام لديها زر "مهمة جديدة"
            fabEnabled() {
                return this.page === "home";
            },
            fabMenuOpen() {
                return this.page === "home" && this.showFabMenu === true;
            },
            pendingTasks() {
                const list = this.$root.tasks || [];
                return global.taskStore ? global.taskStore.pendingCount(list) : 0;
            },
            notifications() {
                return this.$root.notifications || [];
            },
            unread() {
                return this.notifications.filter((n) => !n.read).length;
            },
            toasts() {
                return this.$root.toasts || [];
            },
            // نفس شرط الإخفاء القديم، بدون إخفاء الشريط عند فتح الإشعارات
            navVisible() {
                const r = this.$root;
                return !(
                    r.focusModeActive || r.showGuide || r.showDashboard || r.showBulkSmsModal ||
                    r.showAddModal || r.showEditModal || r.showImportSummary || r.showHistoryModal ||
                    r.showReminderPicker || r.showNotificationHistory ||
                    r.showNoteModal || r.favInfoParcelId || r.showCustomerHistory || r.showMultiPieceModal
                );
            },
        },
        methods: {
            // تنقل داخل التطبيق بدون إعادة تحميل الصفحة (يرجع للمواقع القديمة عند الفشل)
            go(url) {
                if (this.$root && typeof this.$root.navigate === "function") {
                    this.$root.navigate(url);
                } else {
                    window.location.href = url;
                }
            },
            toggleYalidine() {
                const r = this.$root;
                r.showYalidineMenu = !r.showYalidineMenu;
                r.showFabMenu = false;
                r.showTopMenu = false;
                r.showNotificationsPanel = false;
            },
            toggleNotifications() {
                const r = this.$root;
                r.showNotificationsPanel = !r.showNotificationsPanel;
                r.showFabMenu = false;
                r.showYalidineMenu = false;
                r.showTopMenu = false;
            },
            onFabClick() {
                const r = this.$root;
                if (this.page === "tasks") {
                    // في صفحة المهام: زر + ينشئ مهمة مباشرة (لا يفتح صفحة المهام)
                    r.showFabMenu = false;
                    global.dispatchEvent(new CustomEvent("swipex:new-task"));
                    return;
                }
                r.showFabMenu = !r.showFabMenu;
                r.showYalidineMenu = false;
                r.showTopMenu = false;
                r.showNotificationsPanel = false;
            },
            onFabAction(act) {
                const r = this.$root;
                r.showFabMenu = false;
                if (act.click === "add-parcel") {
                    if (this.page === "home") r.showAddModal = true;
                    else this.go("index.html#add-parcel");
                    return;
                }
                const fn = r[act.run];
                if (typeof fn === "function") fn.call(r);
            },
            goToNotificationParcel(notif) {
                this.$root.showNotificationsPanel = false;
                if (this.$root.goToNotificationParcel) this.$root.goToNotificationParcel(notif);
            },
            clearAllNotifications() {
                if (this.$root.clearAllNotifications) this.$root.clearAllNotifications();
            },
            deleteNotification(id) {
                if (this.$root.deleteNotification) this.$root.deleteNotification(id);
            },
            formatNotificationTime(t) {
                return this.$root.formatNotificationTime ? this.$root.formatNotificationTime(t) : "";
            },
            formatCurrency(v) {
                return this.$root.formatCurrency ? this.$root.formatCurrency(v) : v;
            },
            formatDate(t) {
                return this.$root.formatDate ? this.$root.formatDate(t) : "";
            },
            getLocationDisplay(t) {
                return this.$root.getLocationDisplay ? this.$root.getLocationDisplay(t) : "";
            },
            getLocationMeta(t) {
                return this.$root.getLocationMeta ? this.$root.getLocationMeta(t) : "";
            },
            copyTracking(t) {
                if (this.$root.copyTracking) this.$root.copyTracking(t);
            },
            copyAllSubTrackings() {
                if (this.$root.copyAllSubTrackings) this.$root.copyAllSubTrackings();
            },
            openYalidine(t, p) {
                if (this.$root.openYalidine) this.$root.openYalidine(t, p);
            },
            closeMultiPieceModal() {
                if (this.$root.closeMultiPieceModal) this.$root.closeMultiPieceModal();
            },

            // ---------- نافذة المهمة المشتركة ----------
            closeComposer() {
                if (this.$root.closeComposer) this.$root.closeComposer();
            },
            saveTask() {
                if (this.$root.saveTask) this.$root.saveTask();
            },
            toggleParcelPicker() {
                if (this.$root.toggleParcelPicker) this.$root.toggleParcelPicker();
            },
            pickParcel(p) {
                if (this.$root.pickParcel) this.$root.pickParcel(p);
            },
            clearParcelLink() {
                if (this.$root.clearParcelLink) this.$root.clearParcelLink();
            },
        },
    };

    // ============ قائمة النقاط الثلاث (موحّدة) ============
    const TopMenuTemplate = `
<div class="relative top-menu-wrapper">
    <button type="button" class="header-action" @click.stop="toggle()" title="القائمة">
        <i class="fas fa-ellipsis-v text-sm"></i>
    </button>
    <div v-if="showTopMenu" class="top-menu-dropdown" @click.stop>
        <template v-for="item in menuItems" :key="item.id || 'div-' + item._i">
            <div v-if="item.divider" class="top-menu-divider"></div>
            <button v-else type="button" class="top-menu-item" @click="onSelect(item)">
                <i class="fas" :class="[item.icon, item.color]"></i>
                <span>{{ item.label }}</span>
            </button>
        </template>
        <div class="top-menu-divider"></div>
        <div class="theme-toggle-row">
            <button @click="setTheme('light')" class="theme-toggle-btn" :class="{ 'active-light': themeMode === 'light' }">
                <i class="fas fa-sun"></i>
            </button>
            <button @click="setTheme('dark')" class="theme-toggle-btn" :class="{ 'active-dark': themeMode === 'dark' }">
                <i class="fas fa-moon"></i>
            </button>
            <button @click="setTheme('auto')" class="theme-toggle-btn" :class="{ 'active-auto': themeMode === 'auto' }">
                <i class="fas fa-magic"></i>
            </button>
        </div>
    </div>
</div>
`;

    const SwipexTopMenu = {
        name: "SwipexTopMenu",
        template: TopMenuTemplate,
        data() {
            let i = 0;
            return {
                menuItems: TOP_MENU.map((it) => (it.divider ? Object.assign({ _i: i++ }, it) : it)),
            };
        },
        computed: {
            page() {
                return this.$root.appPage;
            },
            showTopMenu: rootState("showTopMenu"),
            themeMode() {
                return (this.$root.settings || {}).themeMode;
            },
        },
        methods: {
            toggle() {
                this.showTopMenu = !this.showTopMenu;
            },
            go(url) {
                if (this.$root && typeof this.$root.navigate === "function") {
                    this.$root.navigate(url);
                } else {
                    window.location.href = url;
                }
            },
            onSelect(item) {
                const r = this.$root;
                r.showTopMenu = false;
                if (item.href) {
                    this.go(item.href);
                    return;
                }
                // إجراءات الطرود تعمل في الرئيسية فقط، ومن باقي الصفحات ننتقل إليها
                if (this.page === "home") {
                    const fn = r[item.run];
                    if (typeof fn === "function") fn.call(r);
                } else {
                    this.go("index.html#" + item.id);
                }
            },
            setTheme(mode) {
                if (this.$root.setTheme) this.$root.setTheme(mode);
            },
        },
    };

    // ============ تثبيت المكوّنات ============
    global.SwipexShell = {
        navItems: NAV_ITEMS,
        topMenu: TOP_MENU,
        fabActions: FAB_ACTIONS_HOME,
        page: currentPage,
        install(app) {
            app.component("swipex-header", SwipexHeader);
            app.component("swipex-shell", SwipexShell);
            app.component("swipex-top-menu", SwipexTopMenu);
        },
    };
})(typeof window !== "undefined" ? window : globalThis);
