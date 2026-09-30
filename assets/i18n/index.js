// ============================================
// assets/i18n/index.js
// سجل اللغات — يجب تحميله قبل state.js / methods.js / app.js
// ============================================

window.i18nDefaultLang = "ar";

window.i18nRegistry = {
  ar: window.i18n_ar,
  fr: window.i18n_fr,
  en: window.i18n_en,
};

// اختيارLang صالح من مخزن محلي أو من الإعدادات المحفوظة
window.i18nResolve = function (lang) {
  return window.i18nRegistry[lang] ? lang : window.i18nDefaultLang;
};