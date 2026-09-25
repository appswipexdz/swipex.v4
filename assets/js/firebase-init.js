// ============================================
// assets/js/firebase-init.js
// تهيئة Firebase + المصادقة + حالة الاتصال (مشترك بين كل الصفحات)
// ملاحظة: هذا الملف منقول حرفياً من الب سكربت المضمّن في index.html
// ============================================

// التحقق من تسجيل الدخول
const firebaseConfig = {
    apiKey: "AIzaSyD6AL3fVe9AoBV4ZdSlYhU8pdsJ1SroeYc",
    authDomain: "swipex-14c78.firebaseapp.com",
    projectId: "swipex-14c78",
    storageBucket: "swipex-14c78.firebasestorage.app",
    messagingSenderId: "797123007567",
    appId: "1:797123007567:web:eaa7fdd2c68d27f6d6463a",
    measurementId: "G-XH91T4GV66",
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// تفعيل كاش Firestore للقراءة من الذاكرة عند انقطاع الإنترنت
window.db = firebase.firestore();

// محاولة تفعيل Persistence (يعمل فقط عندما يكون online)
if (typeof firebase.firestore().enablePersistence === "function") {
    firebase
        .firestore()
        .enablePersistence({ synchronizeTabs: true })
        .then(() => {
            console.log("Firestore Persistence مُفعّل");
            if (typeof appState !== "undefined")
                appState.firestorePersistence = true;
        })
        .catch((err) => {
            if (err.code == "failed-precondition") {
                console.warn(
                    "Firestore Persistence:Multiple tabs open, persistence enabled in only one tab",
                );
            } else if (err.code == "unimplemented") {
                console.warn(
                    "Firestore Persistence: not supported in this browser",
                );
            }
        });
}

// متغير حالة الإنترنت
window.isOnline = navigator.onLine;

// الاستماع لتغييرات حالة الإنترنت
window.addEventListener("online", () => {
    window.isOnline = true;
    console.log("الاتصال بالإنترنت恢复正常");
    // تحديث appState مباشرة
    if (window.appState) {
        window.appState.isOnline = true;
    }
    // تحديث syncStatus
    if (window.firestoreSync) {
        window.firestoreSync.updateSyncStatus("syncing");
    }
    // محاولة المزامنة
    setTimeout(async () => {
        try {
            if (
                window.firestoreSync &&
                window.appState &&
                window.appState.parcels
            ) {
                await window.firestoreSync.saveParcels(window.appState.parcels, {
                    silent: true,
                });
            }
        } catch (e) {
            console.error("فشل المزامنة عند استعادة الاتصال:", e);
        }
    }, 1000);
});

window.addEventListener("offline", () => {
    window.isOnline = false;
    console.log("انقطع الاتصال بالإنترنت - العمل محلياً");
    if (window.appState) {
        window.appState.isOnline = false;
    }
    if (window.firestoreSync) {
        window.firestoreSync.updateSyncStatus("offline");
    }
});

// التحقق من المصادقة
let authChecked = false;
firebase.auth().onAuthStateChanged((user) => {
    if (authChecked) return;
    authChecked = true;

    if (!user || !user.email) {
        window.location.href = "login.html";
    }
});

// حماية إضافية: إذا لم يستجب Firebase خلال 3 ثوانٍ
setTimeout(() => {
    if (!authChecked) {
        const savedUser = localStorage.getItem("swipex_user");
        if (!savedUser) {
            window.location.href = "login.html";
        }
    }
}, 3000);

// تنظيف البيانات المؤقتة من sessionStorage التي قد تحتفظ بـ modal states
sessionStorage.removeItem("showScanner");
sessionStorage.removeItem("showAddModal");
sessionStorage.removeItem("showImportSummary");
sessionStorage.removeItem("showHistoryModal");
