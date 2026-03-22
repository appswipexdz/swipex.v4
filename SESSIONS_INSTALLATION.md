# 🚀 تعليمات تثبيت نظام الجلسات التعاونية

## ✅ الملفات المُنشأة

تم إنشاء الملفات التالية بنجاح:

1. ✅ [`assets/js/sessions.js`](assets/js/sessions.js) - مدير الجلسات الرئيسي
2. ✅ [`assets/js/state.js`](assets/js/state.js) - تم تحديثه بمتغيرات الجلسات
3. ✅ [`assets/js/methods.js`](assets/js/methods.js) - تم تحديثه بدوال الجلسات
4. ✅ [`assets/css/style.css`](assets/css/style.css) - تم إضافة أنماط الجلسات
5. ✅ [`sessions-ui.html`](sessions-ui.html) - واجهة المستخدم الكاملة
6. ✅ [`SESSIONS_GUIDE.md`](SESSIONS_GUIDE.md) - دليل الاستخدام الشامل

---

## 📋 خطوات التثبيت

### الخطوة 1: استيراد ملف sessions.js

أضف هذا الكود في [`index.html`](index.html) قبل إغلاق `</body>`:

```html
<!-- استيراد مدير الجلسات -->
<script type="module">
    import sessionsManager from './assets/js/sessions.js';
    window.sessionsManager = sessionsManager;
    console.log('✅ تم تحميل مدير الجلسات');
</script>
```

**الموقع المقترح**: بعد استيراد `app.js` وقبل `</body>`

---

### الخطوة 2: إضافة زر الجلسات في القائمة الرئيسية

ابحث عن القائمة الجانبية أو قائمة الإعدادات في [`index.html`](index.html) وأضف هذا الزر:

```html
<!-- زر الجلسات التعاونية -->
<button @click="openSessionsView()" class="glass-panel p-4 rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-all">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
        <i class="fas fa-users text-white"></i>
    </div>
    <div class="flex-1 text-right">
        <h3 class="font-bold text-gray-800 dark:text-white">الجلسات التعاونية</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">العمل المشترك على الطرود</p>
    </div>
    <i class="fas fa-chevron-left text-gray-400"></i>
</button>
```

**الموقع المقترح**: في صفحة الإعدادات أو القائمة الجانبية، بعد زر "الإحصائيات" أو "الأرشيف"

---

### الخطوة 3: دمج واجهة المستخدم

انسخ محتوى [`sessions-ui.html`](sessions-ui.html) والصقه في [`index.html`](index.html):

**الموقع المقترح**: بعد صفحة الإعدادات وقبل النوافذ المنبثقة (Modals)

يمكنك البحث عن:
```html
<!-- ============ صفحة الإعدادات ============ -->
```

وإضافة محتوى `sessions-ui.html` بعدها.

---

### الخطوة 4: تحديث قواعد Firestore

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اذهب إلى **Firestore Database** > **Rules**
3. أضف هذه القواعد:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // قواعد المستخدمين الحالية
    match /users/{userId}/data/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // قواعد الجلسات التعاونية
    // ═══════════════════════════════════════════════════════════════
    
    match /sessions/{sessionId} {
      // السماح بالقراءة للمشاركين فقط
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid));
      
      // السماح بالكتابة للمالك فقط
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.createdByUid == request.auth.uid;
      
      // المشاركون
      match /participants/{userId} {
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid));
        
        allow create: if request.auth != null;
        
        allow update, delete: if request.auth != null && 
          (request.auth.uid == userId || 
           get(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid)).data.role in ['owner', 'admin']);
      }
      
      // الطرود
      match /parcels/{parcelId} {
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid));
        
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid)).data.role in ['owner', 'admin', 'editor'];
      }
      
      // النشاطات
      match /activity/{activityId} {
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid));
        
        allow create: if request.auth != null;
      }
      
      // الدعوات
      match /invites/{inviteId} {
        allow read: if request.auth != null;
        
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/sessions/$(sessionId)/participants/$(request.auth.uid)).data.role in ['owner', 'admin'];
      }
    }
  }
}
```

4. اضغط على **Publish** لحفظ القواعد

---

### الخطوة 5: اختبار الميزة

1. **افتح التطبيق** في المتصفح
2. **سجل الدخول** بحساب Google
3. **افتح صفحة الجلسات** من القائمة
4. **أنشئ جلسة جديدة**:
   - أدخل اسم الجلسة
   - اختر الطرود (الفلتر الحالي)
   - ادعُ مستخدم آخر (اختياري)
   - اضغط "إنشاء الجلسة"
5. **تحقق من**:
   - ظهور الجلسة في القائمة
   - إمكانية الانضمام للجلسة
   - عرض الطرود بشكل صحيح
   - المزامنة الفورية (افتح التطبيق في نافذتين)

---

## 🔍 التحقق من التثبيت

### افتح Console في المتصفح (F12)

يجب أن ترى:
```
✅ تم تحميل مدير الجلسات
```

### اختبار الدوال

في Console، جرب:
```javascript
// التحقق من وجود مدير الجلسات
console.log(window.sessionsManager);

// التحقق من الدوال
console.log(typeof app.openSessionsView); // should be 'function'
console.log(typeof app.createSession); // should be 'function'
```

---

## ⚠️ استكشاف الأخطاء

### خطأ: "sessionsManager is not defined"

**الحل:**
- تأكد من إضافة كود استيراد `sessions.js` في `index.html`
- تحقق من المسار الصحيح للملف
- أعد تحميل الصفحة (Ctrl+F5)

### خطأ: "Cannot read property 'createSession' of undefined"

**الحل:**
- تأكد من تحديث `methods.js` بدوال الجلسات
- تحقق من عدم وجود أخطاء في Console
- تأكد من تحميل Vue.js بشكل صحيح

### خطأ: "Permission denied" في Firestore

**الحل:**
- تأكد من تطبيق قواعد Firestore الصحيحة
- تحقق من تسجيل الدخول بحساب Google
- راجع قواعد الأمان في Firebase Console

### لا تظهر الأنماط بشكل صحيح

**الحل:**
- تأكد من تحديث `style.css` بأنماط الجلسات
- امسح الكاش (Ctrl+Shift+Delete)
- أعد تحميل الصفحة (Ctrl+F5)

---

## 📊 الأداء والتحسين

### نصائح للأداء الأمثل

1. **حدد عدد الطرود في الجلسة**
   - الحد الأقصى المُوصى به: 100 طرد
   - استخدم الفلاتر لتقليل العدد

2. **أغلق الجلسات غير المستخدمة**
   - أنهِ الجلسات المكتملة
   - احذف الجلسات القديمة بانتظام

3. **راقب استخدام Firestore**
   - كل تحديث = قراءة/كتابة واحدة
   - المزامنة الفورية تستهلك قراءات
   - استخدم الخطة المجانية بحذر (50K قراءة/يوم)

---

## 🎯 الخطوات التالية

بعد التثبيت الناجح:

1. ✅ اقرأ [`SESSIONS_GUIDE.md`](SESSIONS_GUIDE.md) للتعرف على جميع الميزات
2. ✅ جرب إنشاء جلسة تجريبية
3. ✅ ادعُ زميل للاختبار المشترك
4. ✅ راقب الأداء والإحصائيات
5. ✅ قدم ملاحظاتك للتحسين

---

## 📞 الدعم

إذا واجهت أي مشاكل:

- **البريد الإلكتروني**: support@swipex.app
- **التوثيق الكامل**: [`SESSIONS_GUIDE.md`](SESSIONS_GUIDE.md)
- **GitHub Issues**: [github.com/swipex/swipex/issues](https://github.com/swipex/swipex/issues)

---

## 🎉 تهانينا!

تم تثبيت نظام الجلسات التعاونية بنجاح! 🎊

الآن يمكنك العمل مع فريقك على الطرود في الوقت الفعلي.

---

**صُنع بـ ❤️ في الجزائر** 🇩🇿

**SwiPex Pro v4.0** - نظام الجلسات التعاونية
