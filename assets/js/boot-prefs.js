// ============================================
// assets/js/boot-prefs.js
// يُحمَّل في <head> قبل أي سكربت آخر: يقرأ تفضيلات الواجهة المحفوظة محلياً
// ويطبّقها قبل أول paint، لتفادي وميض اللغة/الاتجاه/الثيم عند تحديث الصفحة.
//
// مصدر القراءة:
//   1) 'swipex_prefs' — مفتاح مصغّر (بضعة عشرات بايت) يكتبه التطبيق عند كل
//      تغيير للغة/الاتجاه/الثيم. يُقرأ هنا بلا أي تحليل JSON.
//   2) 'swipex_pro_v2' — مرة واحدة فقط (ترحيل للإصدارات القديمة) إن غاب المفتاح
//      المصغّر، لأن قراءته كاملة قد تكلّف ميغابايتات مع آلاف الطرود.
// ثم يُحذف المفتاح المصغّر بعد الترحيل حتى لا تتكرّر القراءة الثقيلة.
//
// النتيجة تُخزَّن في window.__swipexBootSpecs ليقرأها state.js، فتبقى
// القراءة مرّة واحدة ولا يُعاد تحليل localStorage في أول render.
// ============================================

(function () {
    var PREFS_KEY = "swipex_prefs";
    var LEGACY_KEY = "swipex_pro_v2";

    // اتجاه كل لغة (يعكس meta.dir في ملفات i18n) — لا نستعمل سجل اللغات هنا
    // لأنه يُحمَّل في نهاية الصفحة، بعد هذا السكربت.
    var LANG_DIRS = { ar: "rtl", fr: "ltr", en: "ltr" };
    var THEMES = { auto: 1, light: 1, dark: 1 };

    var stored = null;

    // 1) المفتاح المصغّر (المسار المعتاد)
    try {
        var cached = localStorage.getItem(PREFS_KEY);
        if (cached) stored = JSON.parse(cached);
    } catch (e) {
        stored = null;
    }

    // 2) ترحيل لمرة واحدة: قراءة النسخة القديمة الكاملة إن غاب المفتاح المصغّر
    if (!stored) {
        try {
            var raw = localStorage.getItem(LEGACY_KEY);
            if (raw) stored = (JSON.parse(raw) || {}).settings || null;
        } catch (e) {
            stored = null;
        }
        if (stored) {
            try {
                localStorage.setItem(PREFS_KEY, JSON.stringify(stored));
            } catch (e) {
                /* الحصة الممتلئة: نتجاهل، وسيبقى الترحيل يحاول لاحقاً */
            }
        }
    }
    if (!stored) return;

    var language = LANG_DIRS[stored.language] ? stored.language : null;
    var direction =
        stored.direction === "rtl" || stored.direction === "ltr" ? stored.direction : null;
    var themeMode = THEMES[stored.themeMode] ? stored.themeMode : null;

    // القيم غير الصالحة تُهمَل: state.js يحتفظ بافتراضاته في هذه الحالة
    if (language || direction || themeMode) {
        window.__swipexBootSpecs = {
            language: language,
            direction: direction,
            themeMode: themeMode,
        };
    }

    var html = document.documentElement;
    if (language || direction) {
        var lang = language || "ar";
        // i18n/dir: 'rtl' | 'ltr' يُطبَّقان كما هما، أما 'auto' فيتبع اتجاه اللغة
        html.setAttribute("lang", lang);
        html.setAttribute("dir", direction || LANG_DIRS[lang] || "rtl");
    }

    // 'auto' لا يُحسم هنا: يبقى لapplyTheme في app.js (يراعي تفضيل النظام)
    if (themeMode === "dark") html.classList.add("dark");
})();