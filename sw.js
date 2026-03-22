const CACHE_NAME = 'swipex-v3.4-offline';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/state.js',
  './assets/js/methods.js',
  './assets/js/scanner.js',
  './assets/js/importExcel.js',
  './assets/js/pdf.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/libs/vue.global.min.js',
  './assets/libs/tailwindcss.js',
  './assets/libs/xlsx.full.min.js',
  './assets/libs/Sortable.min.js',
  './assets/libs/quagga.min.js',
  './assets/libs/pdf.min.js',
  './assets/libs/pdf.worker.min.js',
  './assets/libs/fontawesome.min.css',
  './assets/libs/cairo-font.css',
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

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching all assets for offline use...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.error('[SW] Failed to cache some assets:', err);
        return Promise.resolve();
      });
    }).then(() => {
      console.log('[SW] Installation complete - App ready for offline use');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Network First للملفات الديناميكية (HTML, JS, CSS)
  const isDynamic = event.request.url.includes('.html') || 
                    event.request.url.includes('.js') || 
                    event.request.url.includes('.css') ||
                    event.request.url.endsWith('/');

  if (isDynamic) {
    // Network First: جرب الشبكة أولاً، ثم الكاش
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200 && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          });
        })
    );
  } else {
    // Cache First للملفات الثابتة (صور، خطوط، مكتبات)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (response.status === 200 && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
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
