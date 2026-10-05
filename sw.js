const CACHE_NAME = 'swipex-v4-shell-28';
const UPDATE_CONTROL_CACHE = 'swipex-update-control-ready-v1';
// رابط مطلق حتى يعمل حارس الرجوع لصفحة التطبيق دون اتصال.
// './' وليس './index.html': الأخير يُعاد توجيهه (307) إلى '/' على Cloudflare
// Workers، وحارس الرجوع يجب أن يكون رابطاً مباشراً لا إعادة توجيه.
const OFFLINE_FALLBACK = new URL('./', self.location.href).href;
const ASSETS_TO_CACHE = [
  './',
  // './index.html' محذوفة عمداً: يُعاد توجيهها من Cloudflare إلى './' أصلاً (نفس المحتوى)،
  // وتخزينها بامتدادها يُنتج رداً "مُعاد توجيهه" لا يصلح للرد على طلبات التصفّح لاحقاً
  './tasks',
  './archive',
  './settings',
  './login',
  './manifest.json',
  './app-version.json',
  './assets/css/style.css',
  './assets/js/boot-prefs.js',
  './assets/js/app.js',
  './assets/js/state.js',
  './assets/js/firebase-init.js',
  './assets/js/firestoreSync.js',
  './assets/js/methods.js',
  './assets/js/shell.js',
  './assets/js/taskStore.js',
  './assets/js/tasks.js',
  './assets/js/scanner.js',
  './assets/js/importExcel.js',
  './assets/js/pdf.js',
  './assets/icons/icon-192.png',
  './assets/icons/logo.png',
  './assets/icons/icon.png',
  './assets/libs/vue.global.min.js',
  './assets/libs/tailwindcss.js',
  './assets/libs/xlsx.full.min.js',
  './assets/libs/Sortable.min.js',
  './assets/libs/quagga.min.js',
  './assets/libs/pdf.min.js',
  './assets/libs/pdf.worker.min.js',
  './assets/libs/fontawesome.min.css',
  './assets/libs/cairo-font.css',
  // Leaflet محلي (كان من unpkg فلم يكن يُخزَّن إطلاقاً)
  './assets/libs/leaflet/leaflet.css',
  './assets/libs/leaflet/leaflet.js',
  './assets/libs/leaflet/images/marker-icon.png',
  './assets/libs/leaflet/images/marker-icon-2x.png',
  './assets/libs/leaflet/images/marker-shadow.png',
  './assets/libs/leaflet/images/layers.png',
  './assets/libs/leaflet/images/layers-2x.png',
  './assets/libs/webfonts/fa-solid-900.woff2',
  './assets/libs/webfonts/fa-brands-400.woff2',
  './assets/libs/webfonts/fa-regular-400.woff2',
  './assets/libs/fonts/cairo.woff2',
  './assets/libs/fonts/cairo-arabic.woff2',
  // Firebase SDK (CDN - للإنترنت فقط)
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
];

// تخزين متسامح مع الأخطاء: كل ملف على حدة، ففشل واحد لا يُسقط البقية
async function cacheAllAssets() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    ASSETS_TO_CACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
  );
  const failed = ASSETS_TO_CACHE.filter((_, i) => results[i].status === 'rejected');
  if (failed.length) {
    console.warn(`[SW] تعذّر تخزين ${failed.length}/${ASSETS_TO_CACHE.length}:`, failed);
  } else {
    console.log(`[SW] تم تخزين ${ASSETS_TO_CACHE.length} ملفاً بنجاح`);
  }
  return cache;
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    cacheAllAssets()
      .then(async () => {
        console.log('[SW] Installation complete - App ready for offline use');
        // One bootstrap update installs the consent UI; later workers wait for approval.
        if (!(await caches.has(UPDATE_CONTROL_CACHE))) return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== UPDATE_CONTROL_CACHE) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// أنواع الطلبات التي يجب أن تذهب للشبكة دائماً (بيانات حيّة)
function isNetworkOnly(url, request) {
  if (request.method !== 'GET') return true;
  if (url.searchParams.has('__connectivity_check')) return true;
  if (url.pathname.endsWith('/app-version.json')) return true;
  if (url.hostname === 'www.gstatic.com' || url.hostname.endsWith('googleapis.com')) return true;
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebaseapp.com')) return true;
  if (url.hostname.endsWith('google-analytics.com')) return true;
  if (url.pathname.startsWith('/api/')) return true;
  return false;
}

// ملفات التطبيق (HTML/JS/CSS) => Cache-First مع تحديث صامت بالخلفية
function isAppShell(url) {
  return (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('/')
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1) بيانات حيّة: شبكة فقط، ولا نلمس الكاش إطلاقاً
  if (isNetworkOnly(url, event.request)) {
    return;
  }

  // 2) ملفات التطبيق: الكاش أولاً (يعمل فوراً دون اتصال) + تحديث صامت
  if (isAppShell(url)) {
    // عنوان الكاش المعتمد هو المسار النهائي بلا امتداد .html.
    const canonicalUrl = url.pathname.endsWith('.html')
      ? new URL(
          url.pathname === '/index.html' ? '/' : url.pathname.slice(0, -5) || './',
          url.origin
        ).href
      : event.request.url;

    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(canonicalUrl).then((cachedResponse) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              // لا نخزّن أي رد نتج عن إعادة توجيه؛ صفحات التنقل تحتاج ردوداً مباشرة.
              if (response && response.status === 200 && !response.redirected) {
                cache.put(canonicalUrl, response.clone());
              }
              return response;
            })
            .catch(() => null);

          if (cachedResponse) {
            // لا ننتظر الشبكة إطلاقاً
            event.waitUntil(networkFetch);
            return cachedResponse;
          }

          // لا يوجد في الكاش بعد: انتظر الشبكة، وإلا ارجع لصفحة التطبيق
          return networkFetch.then((response) => {
            if (response) return response;
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return cache.match(OFFLINE_FALLBACK);
            }
            return new Response('', { status: 504, statusText: 'Offline' });
          });
        })
      )
    );
    return;
  }

  // 3) بقية الملفات الثابتة (صور، خطوط، مكتبة Leaflet): الكاش أولاً
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200 && event.request.method === 'GET' && !response.redirected) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// === نظام التذكيرات في الخلفية ===
let scheduledReminders = [];
let reminderCheckTimer = null;

function startReminderCheck() {
  if (reminderCheckTimer) return;
  reminderCheckTimer = setInterval(() => {
    checkScheduledReminders();
  }, 30000);
}

function checkScheduledReminders() {
  if (scheduledReminders.length === 0) return;
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  const triggered = [];
  scheduledReminders.forEach(r => {
    if (r.time === currentTime) {
      triggered.push(r);
      if (r.type === 'parcel') {
        const body = (r.receiver || '') + '\n' + (r.notes || 'تذكير للطرد');
        self.registration.showNotification('SwiPex - تذكير', {
          body: r.tracking ? `📦 ${r.tracking}\n${body}` : body,
          icon: './assets/icons/icon-192.png',
          badge: './assets/icons/icon-192.png',
          tag: 'swipex-reminder-' + r.id,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          data: { tracking: r.tracking || '' }
        });
      } else {
        self.registration.showNotification('SwiPex - مهمة', {
          body: r.description || 'تذكير بمهمة',
          icon: './assets/icons/icon-192.png',
          badge: './assets/icons/icon-192.png',
          tag: 'swipex-task-' + r.id,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          data: {}
        });
      }
    }
  });
  
  if (triggered.length > 0) {
    scheduledReminders = scheduledReminders.filter(r => !triggered.includes(r));
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_APP_VERSION' && event.ports && event.ports[0]) {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(new URL('./app-version.json', self.location.href));
        const release = response ? await response.json() : null;
        event.ports[0].postMessage({ type: 'APP_VERSION', release });
      } catch (e) {
        event.ports[0].postMessage({ type: 'APP_VERSION', release: null });
      }
    })());
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
  
  // استقبال التذكيرات المجدولة من التطبيق
  if (event.data && event.data.type === 'SYNC_REMINDERS') {
    scheduledReminders = event.data.reminders || [];
    if (scheduledReminders.length > 0) {
      startReminderCheck();
    }
  }
  
  // إظهار إشعار فوري من التطبيق
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      tag: 'swipex-notification-' + Date.now(),
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        tracking: event.data.tracking || ''
      }
    });
  }
});

// عند الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const tracking = event.notification.data?.tracking || '';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // إذا كان التطبيق مفتوح، ركز عليه
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (tracking) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              tracking: tracking
            });
          }
          return;
        }
      }
      // إذا لم يكن مفتوح، افتحه
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
