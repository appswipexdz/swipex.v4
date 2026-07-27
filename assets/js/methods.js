// ============================================
// assets/js/methods.js
// جميع دوال التطبيق الرئيسية
// ============================================

const appMethods = {
  // ========== UI & Toasts ==========
  showToast(message, type = 'info', duration = 3000) {
    const id = Date.now();
    this.toasts.push({ id, message, type });
    
    // إزالة التوست بعد المدة المحددة
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, duration);

    // إضافة لإشعارات النظام الدائمة أيضاً
    if (type === 'error' || type === 'success') {
      this.addNotification({
        title: type === 'error' ? 'خطأ' : 'نجاح',
        message: message,
        type: type,
        time: new Date().toISOString()
      });
    }
  },

  // ========== Scroll Header ==========
  handleScroll() {
    const currentScrollY = window.scrollY;
    if (currentScrollY > this.lastScrollY && currentScrollY > 80) {
      this.headerHidden = true;
    } else {
      this.headerHidden = false;
    }
    // البيانات تظهر فقط عند الرجوع لأعلى الصفحة تماماً
    this.progressBarCompact = currentScrollY > 50;
    this.lastScrollY = currentScrollY;
  },

  // ========== Theme Methods ==========
  setTheme(mode) {
    this.settings.themeMode = mode;
    this.applyTheme();
    this.saveSettings();
  },

  applyTheme() {
    const body = document.body;
    const html = document.documentElement;
    body.classList.remove("dark-mode");
    html.classList.remove("dark");

    if (this.settings.themeMode === "dark") {
      body.classList.add("dark-mode");
      html.classList.add("dark");
    } else if (
      this.settings.themeMode === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      body.classList.add("dark-mode");
      html.classList.add("dark");
    }
  },

  // ========== Clipboard ==========
  copyTracking(tracking) {
    navigator.clipboard
      .writeText(tracking)
      .then(() => {
        const beep = new Audio(
          "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=",
        );
        beep.play().catch(() => {});
      })
      .catch(() => {});
  },

  // ========== Data Management ==========
  _cloudLoadPromise: null,
  _debouncedSaveTimeout: null,

  debouncedSaveData() {
    if (this._debouncedSaveTimeout) clearTimeout(this._debouncedSaveTimeout);
    this._debouncedSaveTimeout = setTimeout(() => {
      this._debouncedSaveTimeout = null;
      this.saveData();
    }, 1500);
  },

  _nowTimestamp() {
    const d = new Date();
    const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    return date + 'T' + time;
  },

  initDeviceId() {
    if (this._deviceId) return;
    let id = localStorage.getItem('swipex_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      localStorage.setItem('swipex_device_id', id);
    }
    this._deviceId = id;
  },

  createEmptyLocation() {
    return {
      label: "",
      address: "",
      lat: null,
      lng: null,
      mapsUrl: "",
      source: "manual",
      updatedAt: "",
    };
  },

  _normalizeCoord(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },

  _isAbsoluteUrl(value) {
    return /^https?:\/\//i.test((value || "").trim());
  },

  normalizeLocation(location) {
    const base = this.createEmptyLocation();
    if (!location) return base;

    if (typeof location === "string") {
      const text = location.trim();
      if (!text) return base;
      return {
        ...base,
        address: this._isAbsoluteUrl(text) ? "" : text,
        mapsUrl: this._isAbsoluteUrl(text)
          ? text
          : `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}`,
      };
    }

    const normalized = {
      ...base,
      ...location,
      label: (location.label || "").trim(),
      address: (location.address || "").trim(),
      mapsUrl: (location.mapsUrl || "").trim(),
      source: (location.source || "manual").trim() || "manual",
      updatedAt: location.updatedAt || "",
      lat: this._normalizeCoord(location.lat),
      lng: this._normalizeCoord(location.lng),
    };

    if (!normalized.mapsUrl) {
      if (normalized.lat !== null && normalized.lng !== null) {
        normalized.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${normalized.lat},${normalized.lng}`;
      } else if (this._isAbsoluteUrl(normalized.address)) {
        normalized.mapsUrl = normalized.address;
        normalized.address = "";
      } else if (normalized.address) {
        normalized.mapsUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(normalized.address)}`;
      }
    }

    if (!normalized.updatedAt && (normalized.label || normalized.address || normalized.mapsUrl || normalized.lat !== null || normalized.lng !== null)) {
      normalized.updatedAt = new Date().toISOString();
    }

    return normalized;
  },

  normalizeArchiveEntry(entry) {
    if (!entry || typeof entry !== "object") return { location: this.createEmptyLocation() };
    return {
      ...entry,
      location: this.normalizeLocation(entry.location),
    };
  },

  normalizeArchiveMap(archiveMap) {
    const normalized = {};
    Object.entries(archiveMap || {}).forEach(([tracking, entry]) => {
      if (!entry) return;
      const events = this.getArchiveEvents(entry);
      if (events.length === 0) return;
      normalized[tracking] = {
        events,
        latest: events[0],
      };
    });
    return normalized;
  },

  mergeArchiveEntries(localArchive, cloudArchive) {
    const merged = {};
    const allTrackings = new Set([
      ...Object.keys(localArchive || {}),
      ...Object.keys(cloudArchive || {}),
    ]);
    allTrackings.forEach((tracking) => {
      const localEntry = localArchive ? localArchive[tracking] : null;
      const cloudEntry = cloudArchive ? cloudArchive[tracking] : null;
      const localEvents = localEntry ? this.getArchiveEvents(localEntry) : [];
      const cloudEvents = cloudEntry ? this.getArchiveEvents(cloudEntry) : [];
      const allEvents = [...localEvents];
      cloudEvents.forEach((ce) => {
        const exists = allEvents.some(
          (le) => le.lastUpdate === ce.lastUpdate,
        );
        if (!exists) allEvents.push(ce);
      });
      if (allEvents.length === 0) return;
      allEvents.sort(
        (a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0),
      );
      merged[tracking] = { events: allEvents, latest: allEvents[0] };
    });
    return merged;
  },

  getArchiveEvents(archiveEntry) {
    if (!archiveEntry) return [];
    let events = [];
    if (Array.isArray(archiveEntry)) {
      events = archiveEntry.map((event) => this.normalizeArchiveEntry(event));
    } else if (archiveEntry.events && Array.isArray(archiveEntry.events)) {
      events = archiveEntry.events.map((event) => this.normalizeArchiveEntry(event));
    } else {
      events = [this.normalizeArchiveEntry(archiveEntry)];
    }
    events = events.filter(Boolean).sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));
    return events;
  },

  getArchiveLatestEntry(archiveEntry) {
    const events = this.getArchiveEvents(archiveEntry);
    return events.length ? events[0] : null;
  },

  normalizeParcelRecord(parcel) {
    if (!parcel || typeof parcel !== "object") return parcel;
    const normalized = {
      ...parcel,
      location: this.normalizeLocation(parcel.location),
    };
    if (parcel.history && typeof parcel.history === "object") {
      if (Array.isArray(parcel.history)) {
        normalized.history = parcel.history.map((event) => this.normalizeArchiveEntry(event));
      } else {
        normalized.history = [this.normalizeArchiveEntry(parcel.history)];
      }
    }
    return normalized;
  },

  mergeIncomingParcel(localParcel, incoming) {
    const localTime = localParcel?._localUpdatedAt || 0;
    const incomingTime = incoming.updatedAt?.toMillis?.() || 0;
    if (incomingTime >= localTime) {
      return incoming.deleted ? null : this.normalizeParcelRecord(incoming);
    }
    return localParcel;
  },

  applyIncomingParcelChange(tracking, incomingData, changeType) {
    const idx = this.parcels.findIndex(p => (p.tracking || p.id) === tracking);
    const local = idx >= 0 ? this.parcels[idx] : null;
    const merged = this.mergeIncomingParcel(local, incomingData);
    if (merged === null) {
      if (idx >= 0) this.parcels.splice(idx, 1);
    } else if (idx >= 0) {
      this.parcels.splice(idx, 1, merged);
    } else {
      this.parcels.push(merged);
    }
    this.syncLocalStorage();
  },

  async migrateToV2Structure() {
    if (localStorage.getItem('swipex_v2_migrated') === 'true') return;
    if (!firestoreSync.isAvailable()) return;
    try {
      const uid = firestoreSync.getUid();

      // تحقق: هل جهاز آخر بدأ العمل بـ V2 مسبقًا؟
      const existingCheck = await window.db.collection('users').doc(uid).collection('parcels_v2').limit(1).get();
      if (!existingCheck.empty) {
        localStorage.setItem('swipex_v2_migrated', 'true');
        console.log('✓ تم تخطي الهجرة — بيانات V2 موجودة مسبقًا من جهاز آخر');
        return;
      }

      const oldParcels = await firestoreSync.loadParcels();
      const oldArchive = await firestoreSync.loadArchive();

      if (Array.isArray(oldParcels) && oldParcels.length) {
        for (let i = 0; i < oldParcels.length; i += 450) {
          const batch = window.db.batch();
          oldParcels.slice(i, i + 450).forEach(p => {
            const tracking = p.tracking || p.id;
            if (!tracking) return;
            const ref = window.db.collection('users').doc(uid).collection('parcels_v2').doc(tracking);
            batch.set(ref, { ...p, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }, { merge: true });
          });
          await batch.commit();
        }
      }

      if (oldArchive && typeof oldArchive === 'object') {
        const entries = Object.entries(oldArchive);
        for (let i = 0; i < entries.length; i += 450) {
          const batch = window.db.batch();
          entries.slice(i, i + 450).forEach(([tracking, entry]) => {
            const ref = window.db.collection('users').doc(uid).collection('archive_v2').doc(tracking);
            batch.set(ref, { ...entry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          });
          await batch.commit();
        }
      }

      localStorage.setItem('swipex_v2_migrated', 'true');
      console.log('✓ اكتملت هجرة البيانات إلى البنية V2');
    } catch (e) {
      console.error('❌ فشلت هجرة V2:', e);
    }
  },

    // تنظيف سلسلة رقم الهاتف وإعادتها في صيغة محلية: 0xx... (10 أرقام)
  cleanPhoneNumberString(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/\D+/g, '');

    // إزالة بادئات الصفر الدولي مثل 00 أو + (قد تكون قد حُذفت بعملية الإزالة أعلاه)
    // التعامل مع رمز الدولة 213 (الجزائر)
    if (/^0+/.test(digits)) {
      // إزالة بداية متعددة من الأصفار التي قد تم إدخالها عن طريق الخطأ
      digits = digits.replace(/^0+/, '');
    }

    if (digits.startsWith('213')) {
      digits = '0' + digits.slice(3);
    }

    // إذا كان المستخدم لصق رقم محلي بدون صفر (9 أرقام)، أضف الصفر
    if (/^[567]\d{8}$/.test(digits)) {
      digits = '0' + digits;
    }

    // إذا كان لدينا سلسلة أطول، حاول اقتطاع آخر 10 أرقام
    if (digits.length > 10) {
      const last10 = digits.slice(-10);
      if (/^0[567]\d{8}$/.test(last10)) digits = last10;
    }

    // تحقق من النمط المطلوب: يبدأ بـ0 ثم 5/6/7 ويحتوي على 10 أرقام
    if (!/^0[567]\d{8}$/.test(digits)) {
      return '';
    }
    return digits;
  },

  // تنظيف حقل رقم هاتف في نموذج التعديل (مثال: 'phone' أو 'phone2')
  cleanPhoneModel(fieldName) {
    if (!this.editParcel || !fieldName) return;
    const raw = this.editParcel[fieldName] || '';
    const cleaned = this.cleanPhoneNumberString(raw);
    if (cleaned) {
      this.editParcel[fieldName] = cleaned;
      this.showToast('تم تنظيف رقم الهاتف', 'success');
    } else {
      this.showToast('لم يتم تحويل الرقم إلى صيغة صحيحة', 'error');
    }
  },

  hasParcelLocation(target) {
    const location = this.normalizeLocation(target?.location || target);
    return !!(
      location.label ||
      location.address ||
      location.mapsUrl ||
      (location.lat !== null && location.lng !== null)
    );
  },

  canOpenParcelLocation(target) {
    const location = this.normalizeLocation(target?.location || target);
    return !!location.mapsUrl;
  },

  getLocationDisplay(target) {
    const location = this.normalizeLocation(target?.location || target);
    return location.label || location.address || location.mapsUrl || "بدون رابط";
  },

  getLocationMeta(target) {
    const location = this.normalizeLocation(target?.location || target);
    if (location.lat !== null && location.lng !== null) {
      return `${location.lat}, ${location.lng}`;
    }
    return location.address || "";
  },

  getLocationSearchText(target) {
    const location = this.normalizeLocation(target?.location || target);
    return [location.label, location.address, location.mapsUrl]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  },

  touchParcelLocation(parcel) {
    if (!parcel) return;
    parcel.location = this.normalizeLocation(parcel.location);
    parcel.location.updatedAt = new Date().toISOString();
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _lt = (parcel.tracking || '').trim();
    if (_lt && this._dirtyParcels) this._dirtyParcels.add(_lt);
    this.debouncedSaveData();
  },

  async saveParcelCurrentLocation(parcel) {
    if (!parcel) return;

    if (!navigator.geolocation) {
      this.showToast("متصفحك لا يدعم تحديد الموقع الجغرافي.", "error");
      return;
    }

    const getPosition = () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          },
        );
      });

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      parcel.location = this.normalizeLocation({
        lat: latitude,
        lng: longitude,
        address: "",
        label: "الموقع الحالي",
        source: "device",
        updatedAt: new Date().toISOString(),
      });
      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _lct = (parcel.tracking || '').trim();
      if (_lct && this._dirtyParcels) this._dirtyParcels.add(_lct);
      this.saveData();
      this.showToast("تم حفظ الموقع الحالي بنجاح.", "success");
    } catch (error) {
      let message = "تعذر الحصول على الموقع. تأكد من سماح المتصفح بالوصول إلى الموقع.";
      if (error && error.code === 1) {
        message = "تم رفض إذن الموقع. يرجى السماح بالوصول إلى الموقع.";
      } else if (error && error.code === 2) {
        message = "تعذر تحديد الموقع. حاول مرة أخرى أو تأكد من تشغيل GPS.";
      } else if (error && error.code === 3) {
        message = "انتهت مهلة طلب الموقع. حاول مرة أخرى.";
      }
      this.showToast(message, "error", 5000);
    }
  },

  openParcelLocationPicker(parcel) {
    if (!parcel) return;
    this.locationPickerParcel = parcel;
    this.locationPickerLat = this.normalizeLocation(parcel.location).lat;
    this.locationPickerLng = this.normalizeLocation(parcel.location).lng;
    this.showLocationPickerModal = true;
    this.$nextTick(() => {
      setTimeout(() => this.initLocationPickerMap(), 50);
    });
  },

  initLocationPickerMap() {
    if (typeof L === 'undefined') {
      this.showToast('لم يتم تحميل مكتبة الخرائط.', 'error');
      return;
    }

    const mapElement = document.getElementById('location-picker-map');
    if (!mapElement) return;

    if (this.locationPickerMap) {
      this.locationPickerMap.remove();
      this.locationPickerMap = null;
    }

    let center = { lat: 36.7538, lng: 3.0588 };
    if (this.locationPickerLat !== null && this.locationPickerLng !== null) {
      center = { lat: this.locationPickerLat, lng: this.locationPickerLng };
    } else if (this.locationPickerParcel && this.locationPickerParcel.location) {
      const normalized = this.normalizeLocation(this.locationPickerParcel.location);
      if (normalized.lat !== null && normalized.lng !== null) {
        center = { lat: normalized.lat, lng: normalized.lng };
        this.locationPickerLat = normalized.lat;
        this.locationPickerLng = normalized.lng;
      }
    }

    this.locationPickerMap = L.map(mapElement, {
      center,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.locationPickerMap);

    this.locationPickerMap.on('moveend', () => {
      const centerLatLng = this.locationPickerMap.getCenter();
      this.locationPickerLat = Number(centerLatLng.lat.toFixed(6));
      this.locationPickerLng = Number(centerLatLng.lng.toFixed(6));
    });

    this.locationPickerMap.invalidateSize();
    this.locationPickerMap.setView(center);
  },

  async centerLocationPickerToDeviceLocation() {
    if (!navigator.geolocation) {
      this.showToast('متصفحك لا يدعم تحديد الموقع الجغرافي.', 'error');
      return;
    }

    const getPosition = () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          },
        );
      });

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      this.locationPickerLat = Number(latitude.toFixed(6));
      this.locationPickerLng = Number(longitude.toFixed(6));
      if (this.locationPickerMap) {
        this.locationPickerMap.setView([latitude, longitude], this.locationPickerMap.getZoom() || 14);
      }
      this.showToast('تم الانتقال إلى الموقع الحالي.', 'success');
    } catch (error) {
      let message = 'تعذر الحصول على الموقع. تأكد من سماح المتصفح بالوصول إلى الموقع.';
      if (error && error.code === 1) {
        message = 'تم رفض إذن الموقع. يرجى السماح بالوصول إلى الموقع.';
      } else if (error && error.code === 2) {
        message = 'تعذر تحديد الموقع. حاول مرة أخرى أو تأكد من تشغيل GPS.';
      } else if (error && error.code === 3) {
        message = 'انتهت مهلة طلب الموقع. حاول مرة أخرى.';
      }
      this.showToast(message, 'error', 5000);
    }
  },

  selectParcelLocationFromMap() {
    if (!this.locationPickerParcel) return;
    if (this.locationPickerLat === null || this.locationPickerLng === null) {
      this.showToast('لم يتم تحديد موقع صالح.', 'error');
      return;
    }

    this.locationPickerParcel.location = this.normalizeLocation({
      lat: this.locationPickerLat,
      lng: this.locationPickerLng,
      label: 'موقع الخريطة',
      address: '',
      source: 'map',
      updatedAt: new Date().toISOString(),
    });
    this.locationPickerParcel.updatedAt = new Date().toISOString();
    this.locationPickerParcel._localUpdatedAt = Date.now();
    const _mpt = (this.locationPickerParcel.tracking || '').trim();
    if (_mpt && this._dirtyParcels) this._dirtyParcels.add(_mpt);
    this.saveData();
    this.showToast('تم حفظ الموقع المخصص من الخريطة.', 'success');
    this.closeLocationPicker();
  },

  closeLocationPicker() {
    this.showLocationPickerModal = false;
    this.locationPickerParcel = null;
    this.locationPickerLat = null;
    this.locationPickerLng = null;
    if (this.locationPickerMap) {
      this.locationPickerMap.remove();
      this.locationPickerMap = null;
    }
  },

  clearParcelLocation(parcel) {
    if (!parcel) return;
    parcel.location = this.createEmptyLocation();
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _clt = (parcel.tracking || '').trim();
    if (_clt && this._dirtyParcels) this._dirtyParcels.add(_clt);
    this.saveData();
  },

  openParcelLocation(target) {
    const location = this.normalizeLocation(target?.location || target);
    if (!this.hasParcelLocation(location) || !location.mapsUrl) {
      this.showToast("لا يوجد موقع محفوظ لهذا الطرد", "info");
      return;
    }
    window.open(location.mapsUrl, "_blank");
  },

  saveData() {
    // حفظ محلي فوري
    localStorage.setItem(
      "swipex_pro_v2",
      JSON.stringify({
        parcels: this.parcels,
        archive: this.archive,
        settings: this.settings,
        sessionDate: this.sessionDate,
        lastUpdate: new Date().toISOString(),
      }),
    );

    // حفظ في Firestore فوري (بدون تأخير)
    if (firestoreSync.isAvailable()) {
      this.syncStatus = "syncing";

      // دفع الطرود المعدّلة عبر البنية V2
      if (this._dirtyParcels && this._dirtyParcels.size) {
        firestoreSync.pushDirtyParcels(this._dirtyParcels, t => this.parcels.find(p => (p.tracking || '').trim() === t) || null);
      }

      const settingsToSave = JSON.parse(
        JSON.stringify({ ...this.settings, _sessionDate: this.sessionDate }),
      );
      firestoreSync
        .saveAll({
          parcels: this.parcels,
          settings: settingsToSave,
          archive: this.archive,
          tasks: this.tasks,
        })
        .then((ok) => {
          this.syncStatus = ok ? "synced" : "error";
          console.log(
            ok ? "✓ تم حفظ البيانات في Firestore" : "❌ فشل حفظ البيانات",
          );
        })
        .catch((e) => {
          console.error("❌ خطأ في حفظ Firestore:", e);
          this.syncStatus = "error";
        });
    }
  },

  async loadData() {
    const tempKeys = [
      "showScanner",
      "showAddModal",
      "showImportSummary",
      "showHistoryModal",
      "showClearDataConfirm",
    ];
    tempKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });

    // تحميل محلي كخطوة أولية فقط (سيتم استبداله من السحابة)
    const saved = localStorage.getItem("swipex_pro_v2");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // تحميل البيانات المحلية كبيانات مؤقتة
        this.parcels = (data.parcels || []).map((parcel) =>
          this.normalizeParcelRecord(parcel),
        );
        this.archive = this.normalizeArchiveMap(data.archive || {});
        this.sessionDate = data.sessionDate || null;
        const savedSettings = data.settings || {};
        if (
          typeof savedSettings.darkMode !== "undefined" &&
          !savedSettings.themeMode
        ) {
          savedSettings.themeMode = savedSettings.darkMode ? "dark" : "light";
        }
        this.settings = { ...this.settings, ...savedSettings };
        this.normalizeTagSettings();
        if (!this.settings.themeMode) this.settings.themeMode = "auto";
        console.log(
          "✓ تم تحميل البيانات المحلية (مؤقتة):",
          this.parcels.length,
          "طرد",
        );
      } catch (e) {
        console.error("❌ خطأ في تحميل البيانات المحلية:", e);
      }
    } else {
      console.log("⚠ لا توجد بيانات محلية - سيتم التحميل من السحابة فقط");
    }

    // تطبيق الثيم فوراً حتى لو المحلي
    this.applyTheme();

    // تحميل من السحابة (الأساسي) - سيستبدل البيانات المحلية
    console.log("⏳ تحميل البيانات من السحابة...");
    await this.loadFromCloud();

    this.showClearDataConfirm = false;
    this.$nextTick(() => {
      this.showAddModal = false;
      this.showImportSummary = false;
      this.showHistoryModal = false;
      this.drawerOpen = false;
      this.statusModalParcel = null;
      this.currentHistory = null;
      this.showMunicipalityDropdown = false;
    });
  },

  // اختيار أحدث نسخة من البيانات: مقارنة timestamps
  selectLatestVersion(localData, cloudData, cloudMetadata, collectionName) {
    // إذا لا توجد بيانات سحابية، استخدم المحلية
    if (!cloudData) {
      console.log(`📦 استخدام البيانات المحلية (${collectionName}): لا توجد بيانات سحابية`);
      return localData;
    }

    // إذا لا توجد بيانات محلية، استخدم السحابية
    if (!localData) {
      console.log(`☁️ استخدام البيانات السحابية (${collectionName}): لا توجد بيانات محلية`);
      return cloudData;
    }

    // الحصول على timestamps
    const localTimestamp = localData?.lastUpdate ? new Date(localData.lastUpdate).getTime() : 0;
    
    let cloudTimestamp = 0;
    if (cloudMetadata) {
      const metadataKey = `${collectionName}UpdatedAt`;
      if (cloudMetadata[metadataKey]) {
        cloudTimestamp = cloudMetadata[metadataKey].toMillis?.() || new Date(cloudMetadata[metadataKey]).getTime();
      }
    }

    // مقارنة والاختيار
    if (cloudTimestamp > localTimestamp) {
      console.log(
        `☁️ استخدام البيانات السحابية لـ "${collectionName}" (السحابة أحدث بـ ${(cloudTimestamp - localTimestamp) / 1000}s)`,
      );
      return cloudData;
    } else if (localTimestamp > cloudTimestamp) {
      console.log(
        `📦 استخدام البيانات المحلية لـ "${collectionName}" (المحلية أحدث بـ ${(localTimestamp - cloudTimestamp) / 1000}s)`,
      );
      return localData;
    } else {
      console.log(`⚖️ البيانات متطابقة الوقت (${collectionName}) - استخدام السحابية`);
      return cloudData;
    }
  },

  applyCloudData(cloud, cloudMetadata = null) {
    let loaded = false;
    
    // تحميل البيانات المحلية
    const localSaved = localStorage.getItem("swipex_pro_v2");
    const localData = localSaved ? JSON.parse(localSaved) : null;

    if (cloud) {
      // اختيار الطرود الأحدث
      if (cloud.parcels) {
        const selectedParcels = localData?.parcels
          ? this.selectLatestVersion(localData, { parcels: cloud.parcels }, cloudMetadata, 'parcels').parcels
          : cloud.parcels;
        if (selectedParcels && selectedParcels.length > 0) {
          this.parcels = selectedParcels.map((parcel) =>
            this.normalizeParcelRecord(parcel),
          );
          loaded = true;
          console.log("✓ تم تطبيق الطرود الأحدثة:", selectedParcels.length);
        }
      }
      
      // اختيار الإعدادات الأحدثة
      if (cloud.settings && typeof cloud.settings === "object") {
        const selectedSettings = localData?.settings
          ? this.selectLatestVersion(localData, { settings: cloud.settings }, cloudMetadata, 'settings').settings
          : cloud.settings;
        if (selectedSettings) {
          const { _sessionDate, ...restSettings } = selectedSettings;
          // استخدام أحدث sessionDate (لا نعيده لتاريخ أقدم مما هو مسجل محلياً)
          if (_sessionDate) {
            if (!this.sessionDate || new Date(_sessionDate) > new Date(this.sessionDate)) {
              this.sessionDate = _sessionDate;
            }
          }
          this.settings = { ...this.settings, ...restSettings };
          this.normalizeTagSettings();
          console.log("✓ تم تطبيق الإعدادات الأحدثة");
        }
      }
      
      // اختيار الأرشيف الأحدث مع دمج على مستوى كل طرد
      if (cloud.archive && typeof cloud.archive === "object") {
        if (localData?.archive) {
          const merged = this.mergeArchiveEntries(localData.archive, cloud.archive);
          this.archive = this.normalizeArchiveMap(merged);
          console.log("✓ تم دمج الأرشيف (محلي + سحابي)");
        } else {
          this.archive = this.normalizeArchiveMap(cloud.archive);
          console.log("✓ تم تطبيق الأرشيف من السحابة");
        }
      }
      
      // اختيار المهام الأحدثة
      if (cloud.tasks && cloud.tasks.length > 0) {
        const selectedTasks = localData?.tasks
          ? this.selectLatestVersion(localData, { tasks: cloud.tasks }, cloudMetadata, 'tasks').tasks
          : cloud.tasks;
        if (selectedTasks) {
          this.tasks = selectedTasks;
          console.log("✓ تم تطبيق المهام الأحدثة:", selectedTasks.length);
        }
      }
    }
    
    if (loaded) {
      this.syncLocalStorage();
      this.applyTheme();
      this.detectDuplicates();
      this.showClearDataConfirm = false;
      console.log("✓ اكتملت عملية تحميل البيانات من السحابة");
    }
    return loaded;
  },

  async loadFromCloud() {
    // منع التحميل المزدوج المتزامن
    if (this._cloudLoadPromise) {
      console.log("⏳ تحميل سحابي جارٍ بالفعل - انتظار...");
      return this._cloudLoadPromise;
    }

    this._cloudLoadPromise = this._doLoadFromCloud();
    try {
      return await this._cloudLoadPromise;
    } finally {
      this._cloudLoadPromise = null;
    }
  },

  async _doLoadFromCloud() {
    let loaded = false;

    if (firestoreSync.isAvailable()) {
      this.syncStatus = "syncing";
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("CLOUD_TIMEOUT")), 5000),
        );

        // تحميل البيانات و metadata معًا
        const [cloud, cloudMetadata] = await Promise.race([
          Promise.all([firestoreSync.loadAll(), firestoreSync.loadCloudMetadata()]),
          timeoutPromise,
        ]);

        loaded = this.applyCloudData(cloud, cloudMetadata);
        this.syncStatus = loaded ? "synced" : "idle";
      } catch (e) {
        if (e.message === "CLOUD_TIMEOUT") {
          console.log(
            "⏳ تجاوز مهلة التحميل - استخدام البيانات المحلية",
          );
          this.syncStatus = this.parcels.length > 0 ? "idle" : "error";
        } else {
          console.error("❌ خطأ في تحميل البيانات من Firestore:", e);
          this.syncStatus = "error";
        }
        // السماح بالحفظ حتى لو فشل التحميل الأولي
        firestoreSync._initialLoadDone = true;
      }
    }
  },

  syncLocalStorage() {
    localStorage.setItem(
      "swipex_pro_v2",
      JSON.stringify({
        parcels: this.parcels,
        archive: this.archive,
        settings: this.settings,
        sessionDate: this.sessionDate,
        lastUpdate: new Date().toISOString(),
      }),
    );
    console.log("✓ تم حفظ البيانات في localStorage");
  },

  normalizeTagSettings() {
    if (!Array.isArray(this.settings.tags)) {
      this.settings.tags = [];
    }
    if (!this.settings.tagMetadata || typeof this.settings.tagMetadata !== "object") {
      this.settings.tagMetadata = {};
    }

    this.settings.tags.forEach((tag) => {
      const tagName = String(tag || "").trim();
      if (!tagName) return;
      if (!this.settings.tagMetadata[tagName]) {
        this.settings.tagMetadata[tagName] = {
          name: tagName,
          color: "#8b5cf6",
          scope: "global",
          municipality: "",
        };
      }
    });

    Object.keys(this.settings.tagMetadata || {}).forEach((tagName) => {
      if (!this.settings.tags.includes(tagName)) {
        delete this.settings.tagMetadata[tagName];
      }
    });
  },

  getTagNameForDisplay(tagName) {
    return tagName?.startsWith("@") ? tagName : `@${tagName || ""}`;
  },

  getTagDefinition(tagName) {
    const name = String(tagName || "").trim();
    if (!name) return null;
    const tagMetadata = this.settings.tagMetadata || {};
    const fallback = { name, color: "#8b5cf6", scope: "global", municipality: "" };
    return {
      ...fallback,
      ...(tagMetadata[name] || {}),
      name,
    };
  },

  getTagBadgeStyle(tagName) {
    const tag = this.getTagDefinition(tagName);
    const color = tag?.color || "#8b5cf6";
    return {
      backgroundColor: color,
      color: "#ffffff",
      borderColor: color,
    };
  },

  getTagScopeLabel(tagName) {
    const tag = this.getTagDefinition(tagName);
    if (!tag) return "عام";
    return tag.scope === "municipality" && tag.municipality ? `بلدية: ${tag.municipality}` : "عام";
  },

  isTagVisibleForMunicipality(tagName, municipality = "") {
    const tag = this.getTagDefinition(tagName);
    if (!tag) return false;
    if (tag.scope !== "municipality") return true;
    return !!municipality && tag.municipality === municipality;
  },

  getAvailableTagsForMunicipality(municipality = "") {
    return (this.settings.tags || []).filter((tag) => this.isTagVisibleForMunicipality(tag, municipality));
  },

  getTagPickerOptions() {
    const parcel = this.parcels.find((p) => p.id === this.tagPickerParcelId);
    return this.getAvailableTagsForMunicipality(parcel?.municipality || "");
  },

  saveSettings() {
    this.normalizeTagSettings();
    this.saveData();
  },

  // ========== Favorite Phones ==========
  isFavoriteParcel(parcel) {
    if (
      !this.settings.favoritePhonesEnabled ||
      !this.settings.favoritePhones.length
    )
      return false;
    return this.settings.favoritePhones.some(
      (fav) => {
        const favPhone = typeof fav === 'string' ? fav : fav.phone;
        return favPhone === parcel.phone || favPhone === parcel.phone2;
      }
    );
  },

  getFavoriteInfo(parcel) {
    if (!this.settings.favoritePhones.length) return null;
    return this.settings.favoritePhones.find((fav) => {
      const favPhone = typeof fav === 'string' ? fav : fav.phone;
      return favPhone === parcel.phone || favPhone === parcel.phone2;
    }) || null;
  },

  applyFavoriteToParcel(parcel) {
    const fav = this.getFavoriteInfo(parcel);
    if (!fav) return;
    if (typeof fav === 'string') {
      this.showToast('لا توجد بيانات محفوظة - عدّل المفضلة من الإعدادات', 'info');
      return;
    }
    let applied = false;
    if (fav.name) { parcel.receiver = fav.name; applied = true; }
    if (fav.municipality) { parcel.municipality = fav.municipality; applied = true; }
    if (applied) {
      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _fvt = (parcel.tracking || '').trim();
      if (_fvt && this._dirtyParcels) this._dirtyParcels.add(_fvt);
      this.saveData();
      this.showToast('تم تطبيق بيانات المفضلة', 'success');
    } else {
      this.showToast('لا يوجد اسم أو بلدية محفوظة', 'info');
    }
  },

  openFavInfo(parcel) {
    this.favInfoParcelId = parcel.id;
  },

  applyFavInfoToParcel() {
    const parcel = this.parcels.find(p => p.id === this.favInfoParcelId);
    if (parcel) {
      this.applyFavoriteToParcel(parcel);
    }
    this.favInfoParcelId = null;
  },

  openNoteModal(parcel) {
    this.smartTagSortingPaused = true;
    this.noteModalParcel = parcel;
    this.showNoteModal = true;
  },

  closeNoteModal() {
    this.saveData();
    this.showNoteModal = false;
    this.noteModalParcel = null;
    this.resumeSmartTagSorting();
  },

  addFavoritePhone() {
    const phone = (this.newFavoritePhone || "").trim();
    if (!phone) return;
    const exists = this.settings.favoritePhones.some(
      (fav) => (typeof fav === 'string' ? fav : fav.phone) === phone
    );
    if (exists) return;
    this.settings.favoritePhones.push({ phone: phone, name: '', municipality: '' });
    this.newFavoritePhone = "";
    this.saveSettings();
  },

  removeFavoritePhone(phone) {
    this.settings.favoritePhones = this.settings.favoritePhones.filter(
      (fav) => (typeof fav === 'string' ? fav : fav.phone) !== phone,
    );
    this.saveSettings();
  },

  addParcelToFavorites(parcel) {
    if (!this.settings.favoritePhonesEnabled) {
      this.settings.favoritePhonesEnabled = true;
    }
    let added = [];
    const phoneExists = (p) => this.settings.favoritePhones.some(
      (fav) => (typeof fav === 'string' ? fav : fav.phone) === p
    );
    if (parcel.phone && !phoneExists(parcel.phone)) {
      this.settings.favoritePhones.push({
        phone: parcel.phone,
        name: parcel.receiver || '',
        municipality: parcel.municipality || ''
      });
      added.push(parcel.phone);
    }
    if (parcel.phone2 && !phoneExists(parcel.phone2)) {
      this.settings.favoritePhones.push({
        phone: parcel.phone2,
        name: parcel.receiver || '',
        municipality: parcel.municipality || ''
      });
      added.push(parcel.phone2);
    }
    if (added.length > 0) {
      this.saveSettings();
      this.showToast('تمت إضافة ' + added.join(' و ') + ' للمفضلة', 'success');
    } else {
      this.showToast('الرقم موجود بالفعل في المفضلة', 'info');
    }
  },

  // ========== Duplicates Detection ==========
  detectDuplicates() {
    const phoneCount = {};
    this.parcels.forEach((p) => {
      const phones = [p.phone, p.phone2].filter(Boolean);
      const uniquePhones = [...new Set(phones)];
      uniquePhones.forEach((phone) => {
        phoneCount[phone] = (phoneCount[phone] || 0) + 1;
      });
    });
    this.parcels.forEach((p) => {
      const phones = [p.phone, p.phone2].filter(Boolean);
      const uniquePhones = [...new Set(phones)];
      let bestCount = 0;
      let bestPhone = "";
      uniquePhones.forEach((phone) => {
        const count = phoneCount[phone] || 0;
        if (count > bestCount) {
          bestCount = count;
          bestPhone = phone;
        }
      });
      p.duplicateCount = bestCount;
      p.duplicatePhone = bestPhone;
    });
  },

  // ========== Import & Merge ==========
  getTodayString() {
    const now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  },

  archiveCurrentParcels() {
    this.parcels.forEach((p) => {
      const tracking = (p.tracking || "").trim();
      if (!tracking) return;
      const event = {
        status: p.status,
        notes: p.notes || "",
        tag: p.tag || null,
        location: this.normalizeLocation(p.location),
        lastUpdate: new Date().toISOString(),
        amount: p.amount || 0,
        municipality: p.municipality || "",
        receiver: p.receiver || "",
        phone: p.phone || "",
        phone2: p.phone2 || "",
        smsSent: p.smsSent || false,
        senderSmsSent: p.senderSmsSent || false,
        sender: p.sender || "",
        type: p.type || "",
        content: p.content || "",
        createdDate: p.createdDate || p.insertedAt || "",
        senderPhone: p.senderPhone || "",
        recipientAddress: p.recipientAddress || "",
      };

      const existing = this.archive[tracking];
      if (existing) {
        const events = this.getArchiveEvents(existing);
        events.unshift(event);
        this.archive[tracking] = {
          events,
          latest: event,
        };
      } else {
        this.archive[tracking] = {
          events: [event],
          latest: event,
        };
      }
      if (this._dirtyArchive) this._dirtyArchive.add(tracking);
      if (this._dirtyParcels) this._dirtyParcels.add(tracking);
    });

    if (firestoreSync.isAvailable() && this._dirtyArchive && this._dirtyArchive.size) {
      firestoreSync.pushDirtyArchiveEntries(this._dirtyArchive, t => this.archive[t]);
    }
  },

  manualArchive() {
    if (this.parcels.length === 0) {
      this.showToast("لا توجد طرود لأرشفتها", "info");
      return;
    }
    const count = this.parcels.length;
    console.log("📦 أرشفة يدوية: " + count + " طرد...");
    this.archiveCurrentParcels();
    this.parcels = [];
    this.sessionDate = this.getTodayString();
    this.saveData();
    this.showToast("تم أرشفة " + count + " طرد بنجاح", "success");
  },

  exportArchive() {
    const archiveCount = Object.keys(this.archive || {}).length;
    if (!archiveCount) {
      this.showToast("لا يوجد أرشيف للتصدير", "info");
      return;
    }

    const rows = [];
    Object.entries(this.archive).forEach(([tracking, data]) => {
      const events = this.getArchiveEvents(data);
      events.forEach((event, idx) => {
        rows.push({
          "رقم التتبع": tracking,
          "الترتيب": idx + 1,
          "آخر تحديث": event.lastUpdate || "",
          "الحالة": event.status || "",
          "ملاحظات": event.notes || "",
          "التمييز": event.tag || "",
          "المبلغ": event.amount || 0,
          "البلدية": event.municipality || "",
          "المستلم": event.receiver || "",
          "الهاتف": event.phone || "",
          "الهاتف 2": event.phone2 || "",
          "SMS مستلم": event.smsSent ? "نعم" : "لا",
          "SMS مرسل": event.senderSmsSent ? "نعم" : "لا",
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 20 }, { wch: 8 },  { wch: 20 },
      { wch: 15 }, { wch: 40 }, { wch: 15 },
      { wch: 10 }, { wch: 15 }, { wch: 25 },
      { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأرشيف");
    XLSX.writeFile(wb, `SwiPex_Archive_${new Date().toISOString().slice(0, 10)}.xlsx`);
    this.showToast(`تم تصدير ${archiveCount} طرد من الأرشيف`, "success");
  },

  openArchiveImport() {
    if (this.$refs.archiveImportInput) {
      this.$refs.archiveImportInput.click();
    }
  },

  handleArchiveImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const archiveMap = {};
        rows.forEach(row => {
          const tracking = (row["رقم التتبع"] || "").toString().trim();
          if (!tracking) return;
          if (!archiveMap[tracking]) archiveMap[tracking] = [];
          archiveMap[tracking].push({
            status: row["الحالة"] || "",
            notes: row["ملاحظات"] || "",
            tag: row["التمييز"] || null,
            lastUpdate: row["آخر تحديث"] || new Date().toISOString(),
            amount: row["المبلغ"] || 0,
            municipality: row["البلدية"] || "",
            receiver: row["المستلم"] || "",
            phone: row["الهاتف"] || "",
            phone2: row["الهاتف 2"] || "",
            smsSent: row["SMS مستلم"] === "نعم",
            senderSmsSent: row["SMS مرسل"] === "نعم",
          });
        });

        let added = 0;
        let updated = 0;
        Object.entries(archiveMap).forEach(([tracking, rawEvents]) => {
          const cleanTracking = tracking.trim();
          if (!cleanTracking) return;
          rawEvents.sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));
          if (this.archive[cleanTracking]) {
            updated++;
          } else {
            added++;
          }
          this.archive[cleanTracking] = { events: rawEvents, latest: rawEvents[0] };
          if (this._dirtyArchive) this._dirtyArchive.add(cleanTracking);
        });

        this.archiveVisibleCount = 30;
        if (firestoreSync.isAvailable() && this._dirtyArchive && this._dirtyArchive.size) {
          firestoreSync.pushDirtyArchiveEntries(this._dirtyArchive, t => this.archive[t]);
        }
        this.saveData();
        this.showToast(`تم استيراد الأرشيف: ${added} جديد، ${updated} محدث`, "success");
      } catch (error) {
        console.error("Archive import failed:", error);
        this.showToast("تعذر استيراد الأرشيف. تأكد من اختيار ملف Excel صحيح.", "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      this.showToast("تعذر قراءة ملف الأرشيف", "error");
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  },

  findAndMerge(newParcels) {
    let stats = {
      total: newParcels.length,
      new: 0,
      updated: 0,
      duplicates: 0,
      archived: 0,
    };
    const today = this.getTodayString();

    // إذا كان يوم جديد → أرشف الطرود القديمة وابدأ من جديد
    if (
      this.sessionDate &&
      this.sessionDate !== today &&
      this.parcels.length > 0
    ) {
      console.log("📦 أرشفة " + this.parcels.length + " طرد من يوم " + this.sessionDate + "...");
      this.archiveCurrentParcels();
      stats.archived = this.parcels.length;
      this.parcels = [];
      this.sessionDate = today;
      // حفظ فوري للأرشيف قبل متابعة الاستيراد
      this.saveData();
      console.log("✓ تم أرشفة " + stats.archived + " طرد وحفظها");
    }

    // تعيين تاريخ الجلسة إذا لم يكن موجوداً
    if (!this.sessionDate) {
      this.sessionDate = today;
    }

    // بناء خريطة الطرود الحالية بـ tracking
    const existingMap = new Map();
    this.parcels.forEach((p) => {
      const t = (p.tracking || "").trim();
      if (t) existingMap.set(t, p);
    });

    const processedParcels = [...this.parcels];

    newParcels.forEach((newParcel) => {
      const tracking = (newParcel.tracking || "").trim();

      // مكرر في نفس اليوم → تجاهل (الحالة والملاحظات محفوظة)
      if (tracking && existingMap.has(tracking)) {
        stats.duplicates++;
        return;
      }

      // هل له سجل في الأرشيف؟
      const archivedData = this.archive[tracking];
      const archiveEvents = archivedData ? this.getArchiveEvents(archivedData) : [];
      const latestArchivedEvent = archiveEvents.length ? archiveEvents[0] : null;
      const hasImportedStatus =
        newParcel.status && newParcel.status !== "دون إجراء";
      const hasImportedNotes = newParcel.notes && newParcel.notes.trim() !== "";

      if (latestArchivedEvent) {
        const merged = {
          ...newParcel,
          expanded: false,
          isUpdated: true,
          history: archiveEvents,
          smsSent: latestArchivedEvent.smsSent || false,
          senderSmsSent: latestArchivedEvent.senderSmsSent || false,
          insertedAt: this._nowTimestamp(),
          status: hasImportedStatus ? newParcel.status : "دون إجراء",
          notes: hasImportedNotes ? newParcel.notes : "",
          location: this.normalizeLocation(
            newParcel.location || latestArchivedEvent.location,
          ),
          sender: newParcel.sender || latestArchivedEvent.sender || "",
          type: newParcel.type || latestArchivedEvent.type || "",
          content: newParcel.content || latestArchivedEvent.content || "",
          createdDate: newParcel.createdDate || latestArchivedEvent.createdDate || "",
          senderPhone: newParcel.senderPhone || latestArchivedEvent.senderPhone || "",
          recipientAddress: newParcel.recipientAddress || latestArchivedEvent.recipientAddress || "",
        };
        merged.updatedAt = new Date().toISOString();
        processedParcels.push(this.normalizeParcelRecord(merged));
        stats.updated++;
      } else {
        const created = {
          ...newParcel,
          expanded: false,
          isUpdated: false,
          history: null,
          insertedAt: this._nowTimestamp(),
          status: hasImportedStatus ? newParcel.status : "دون إجراء",
          notes: hasImportedNotes ? newParcel.notes : "",
          location: this.normalizeLocation(newParcel.location),
        };
        created.updatedAt = new Date().toISOString();
        processedParcels.push(this.normalizeParcelRecord(created));
        stats.new++;
      }

      existingMap.set(tracking, newParcel);
    });

    this.parcels = processedParcels.map((parcel) =>
      this.normalizeParcelRecord(parcel),
    );
    this.detectDuplicates();

    const phoneCount = {};
    this.parcels.forEach((p) => {
      const phones = [p.phone, p.phone2].filter(Boolean);
      const uniquePhones = [...new Set(phones)];
      uniquePhones.forEach((phone) => {
        phoneCount[phone] = (phoneCount[phone] || 0) + 1;
      });
    });
    stats.duplicates += Object.values(phoneCount).filter(
      (count) => count > 1,
    ).length;

    if (
      this.settings.favoritePhonesEnabled &&
      this.settings.favoritePhones.length
    ) {
      stats.favorites = this.parcels.filter((p) =>
        this.isFavoriteParcel(p),
      ).length;
    }

    this.importStats = stats;
    return stats;
  },

  // ========== Customer History (سجل العميل) ==========
  _buildArchivePhoneMap() {
    const map = {};
    for (const [tracking, data] of Object.entries(this.archive)) {
      const events = this.getArchiveEvents(data);
      const latest = events.length ? events[0] : null;
      if (!latest) continue;
      const phones = [latest.phone, latest.phone2].filter(Boolean);
      phones.forEach(ph => {
        if (!map[ph]) map[ph] = [];
        map[ph].push({ tracking, ...latest });
      });
    }
    for (const key in map) {
      map[key].sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));
    }
    return map;
  },

  getCustomerHistoryCount(parcel) {
    if (!parcel || !parcel.phone || !this._archivePhoneMap) return 0;
    const map = this._archivePhoneMap;
    const seen = new Set();
    const tracking = (parcel.tracking || '').trim();
    [parcel.phone, parcel.phone2].filter(Boolean).forEach(ph => {
      (map[ph] || []).forEach(item => {
        if (item.tracking !== tracking) seen.add(item.tracking);
      });
    });
    return seen.size;
  },

  openCustomerHistory(parcel) {
    const map = this._archivePhoneMap || {};
    const tracking = (parcel.tracking || '').trim();
    const seen = new Set();
    const results = [];
    [parcel.phone, parcel.phone2].filter(Boolean).forEach(ph => {
      (map[ph] || []).forEach(item => {
        if (item.tracking !== tracking && !seen.has(item.tracking)) {
          seen.add(item.tracking);
          results.push(item);
        }
      });
    });
    results.sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));

    const currentPhones = new Set([parcel.phone, parcel.phone2].filter(Boolean));
    const phoneSuggestions = new Set();
    results.forEach(item => {
      [item.phone, item.phone2].filter(Boolean).forEach(ph => {
        if (!currentPhones.has(ph)) phoneSuggestions.add(ph);
      });
    });

    this.customerHistoryParcel = parcel;
    this.customerHistoryData = results;
    this.customerHistoryPhoneSuggestions = Array.from(phoneSuggestions).sort();
    this.showCustomerHistory = true;
  },

  // ========== History ==========
  openArchiveHistory(item) {
    if (!item) return;
    if (!item.events || !item.events.length) return;
    this.currentHistory = this.getArchiveEvents(item);
    this.showHistoryModal = true;
  },

  showHistory(parcel) {
    if (!parcel) return;
    const tracking = (parcel.tracking || "").trim();
    const archivedData = tracking ? this.archive[tracking] : null;
    if (archivedData) {
      this.currentHistory = this.getArchiveEvents(archivedData);
    } else if (parcel.history) {
      const historyEntries = Array.isArray(parcel.history) ? parcel.history : [parcel.history];
      this.currentHistory = historyEntries
        .map((event) => this.normalizeArchiveEntry(event))
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));
    } else {
      return;
    }
    this.showHistoryModal = true;
  },

  hasArchiveHistory(parcel) {
    if (!parcel) return false;
    if (parcel.history && Array.isArray(parcel.history) && parcel.history.length > 0) return true;
    const tracking = (parcel.tracking || "").trim();
    return !!(tracking && this.archive && this.archive[tracking]);
  },

  formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("ar-DZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  // ========== Touch/Swipe Handlers ==========
  touchStart(e, parcel) {
    if (parcel.expanded) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.activeSwipeId = parcel.id;
    this.currentTouchX = 0;
    this.isDragging = true;
  },

  touchMove(e) {
    if (!this.isDragging || this.activeSwipeId === null) return;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = touchX - this.touchStartX;
    const diffY = touchY - this.touchStartY;
    if (Math.abs(diffY) > Math.abs(diffX)) {
      this.isDragging = false;
      this.currentTouchX = 0;
      return;
    }
    if (e.cancelable) e.preventDefault();
    this.currentTouchX = diffX;
  },

  touchEnd(e, parcel) {
    if (!this.isDragging || this.activeSwipeId !== parcel.id) return;
    this.isDragging = false;
    if (this.currentTouchX > this.SWIPE_THRESHOLD) {
      // إذا كان هناك أكثر من رقم، نظهر modal الاختيار
      if (parcel.phone2) {
        this.phonePickerParcel = parcel;
        this.showPhonePickerModal = true;
      } else {
        this.callPhone(parcel.phone);
      }
    } else if (this.currentTouchX < -this.SWIPE_THRESHOLD) {
      this.openYalidine(parcel.tracking);
    }
    this.currentTouchX = 0;
    this.activeSwipeId = null;
  },

  selectPhoneAndCall(phone) {
    this.callPhone(phone);
    this.showPhonePickerModal = false;
    this.phonePickerParcel = null;
  },

  getTransformStyle(parcel) {
    if (this.activeSwipeId === parcel.id && this.currentTouchX !== 0) {
      return { transform: `translateX(${this.currentTouchX}px)` };
    }
    return { transform: "translateX(0)" };
  },

  getSwipeDirection(parcel) {
    if (this.activeSwipeId === parcel.id && this.isDragging) {
      if (this.currentTouchX > 10) return "right";
      if (this.currentTouchX < -10) return "left";
    }
    return null;
  },

  // ========== Filters ==========
  toggleSearch() {
    if (!this.showFilters && this.filters.search) {
      this.clearSearchText();
      return;
    }

    this.showFilters = !this.showFilters;
    if (this.showFilters) {
      this.$nextTick(() => {
        if (this.$refs.searchInput) {
          this.$refs.searchInput.focus();
        }
      });
    }
  },

  clearSearchText() {
    this.filters.search = "";
    this.saveFilters();
  },

  clearFilters() {
    this.filters.search = "";
    this.filters.municipality = "";
    this.filters.status = "";
    this.filters.tag = "";
    this.filters.favorite = false;
    this.saveFilters();
    // إعادة تهيئة Sortable بعد تطبيق المرشح
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  filterByPhone(phone) {
    this.filters.search = phone;
    this.filters.municipality = "";
    this.filters.status = "";
    this.saveFilters();
    // إعادة تهيئة Sortable بعد تطبيق المرشح
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  quickFilterStatus(statusName) {
    this.filters.status = this.filters.status === statusName ? "" : statusName;
    this.saveFilters();
    // إعادة تهيئة Sortable بعد تطبيق المرشح
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  saveFilters() {
    localStorage.setItem("swipex_filters", JSON.stringify(this.filters));
  },

  loadFilters() {
    const saved = localStorage.getItem("swipex_filters");
    if (saved) {
      try {
        const filters = JSON.parse(saved);
        this.filters = { ...this.filters, ...filters };
      } catch (e) {
        console.error("خطأ في تحميل الفلاتر:", e);
      }
    }
  },

  // ========== Sortable ==========
  initSortable() {
    const el = document.getElementById("sortable-list");
    if (!el) return;
    if (this.sortableInstance) this.sortableInstance.destroy();
    this.sortableInstance = Sortable.create(el, {
      handle: ".handle",
      animation: 150,
      delay: 100,
      delayOnTouchOnly: true,
      scroll: true,
      scrollSensitivity: 150,
      scrollSpeed: 20,
      ghostClass: "opacity-50",
      chosenClass: "shadow-2xl",
      dragClass: "cursor-grabbing",
      onEnd: (evt) => {
        const movedParcel = this.filteredParcels[evt.oldIndex];
        const targetParcel = this.filteredParcels[evt.newIndex];

        if (!movedParcel || !targetParcel) return;

        const oldGlobalIndex = this.parcels.findIndex(
          (p) => p.id === movedParcel.id,
        );
        const newGlobalIndex = this.parcels.findIndex(
          (p) => p.id === targetParcel.id,
        );

        if (
          oldGlobalIndex !== -1 &&
          newGlobalIndex !== -1 &&
          oldGlobalIndex !== newGlobalIndex
        ) {
          const item = this.parcels.splice(oldGlobalIndex, 1)[0];
          this.parcels.splice(newGlobalIndex, 0, item);
          this.saveData();
        }
      },
    });
  },

  moveParcelUp(parcel) {
    const idx = this.parcels.findIndex(p => p.id === parcel.id);
    if (idx > 0) {
      const item = this.parcels.splice(idx, 1)[0];
      this.parcels.splice(idx - 1, 0, item);
      this.saveData();
    }
  },

  moveParcelDown(parcel) {
    const idx = this.parcels.findIndex(p => p.id === parcel.id);
    if (idx !== -1 && idx < this.parcels.length - 1) {
      const item = this.parcels.splice(idx, 1)[0];
      this.parcels.splice(idx + 1, 0, item);
      this.saveData();
    }
  },

  // ========== Status Methods ==========
  getStatusColor(status) {
    const s = this.allStatuses.find((x) => x.name === status);
    return s ? s.color : "border-gray-300";
  },

  getStatusDotColor(status) {
    const s = this.allStatuses.find((x) => x.name === status);
    return s ? s.dot : "bg-gray-300";
  },

  openStatusModal(parcel) {
    this.statusModalParcel = parcel;
  },

  changeStatus(parcel, newStatus) {
    const actionEnabled = this.isStatusActionEnabled(newStatus);
    // هل هذه الحالة مفعّلة لإرسال SMS؟
    const statusSmsEnabled =
      (newStatus === "مغلق" && this.settings.smsOnStatusClosed) ||
      (newStatus === "لا يرد" && this.settings.smsOnStatusNoAnswer) ||
      (newStatus === "رقم خاطئ" && this.settings.smsOnStatusWrongNumber);

    if (statusSmsEnabled) {
      // توفير الرسائل: تخطي التأكيد إذا الطرد من يوم سابق وتم مراسله
      const alreadySent = newStatus === "رقم خاطئ" ? parcel.senderSmsSent : parcel.smsSent;
      if (this.settings.smsSaving && parcel.isUpdated && alreadySent) {
        parcel.status = newStatus;
        parcel.updatedAt = new Date().toISOString();
        parcel._localUpdatedAt = Date.now();
        this.statusModalParcel = null;
        const _t = (parcel.tracking || '').trim();
        if (_t && this._dirtyParcels) this._dirtyParcels.add(_t);
        this.saveData();
        if (newStatus === "تم التسليم") this.triggerConfetti();
        if (actionEnabled && !['دون إجراء','في الإنتظار'].includes(newStatus)) this.openYalidine(parcel.tracking);
        return;
      }
      this.statusSmsConfirmParcel = parcel;
      this.statusSmsConfirmStatus = newStatus;
      this.showStatusSmsConfirm = true;
      this.statusModalParcel = null;
      return;
    }

    parcel.status = newStatus;
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    this.statusModalParcel = null;
    const _t2 = (parcel.tracking || '').trim();
    if (_t2 && this._dirtyParcels) this._dirtyParcels.add(_t2);
    this.saveData();

    if (newStatus === "تم التسليم") {
      this.triggerConfetti();
    }
    if (actionEnabled && !['دون إجراء','في الإنتظار'].includes(newStatus)) {
      this.openYalidine(parcel.tracking);
    }
  },

  // بناء رسالة SMS حسب الحالة
  buildSmsMessage(parcel, status) {
    const replaceTags = (template) => {
      const maxLen = this.settings.smsContentLength || 10;
      const content = (parcel.content || "").substring(0, maxLen);
      return template
        .replace(/\{اسم_المستلم\}/g, parcel.receiver || "")
        .replace(/\{رقم_التتبع\}/g, parcel.tracking || "")
        .replace(/\{المبلغ\}/g, parcel.amount || "")
        .replace(/\{المحتوى\}/g, content)
        .replace(/\{البلدية\}/g, parcel.municipality || "")
        .replace(/\{الولاية\}/g, parcel.wilaya || "")
        .replace(/\{اسم_المرسل\}/g, parcel.sender || "");
    };

    if (status === "رقم خاطئ") {
      return replaceTags(this.settings.smsWrongNumberTemplate);
    }
    return replaceTags(this.settings.smsStatusTemplate);
  },

  // هل الرسالة موجهة للمرسل؟
  isSenderSms() {
    return this.statusSmsConfirmStatus === "رقم خاطئ";
  },

  // تأكيد تغيير الحالة مع SMS
  confirmStatusChangeWithSms() {
    if (!this.statusSmsConfirmParcel) return;

    const parcel = this.statusSmsConfirmParcel;
    const newStatus = this.statusSmsConfirmStatus;
    const actionEnabled = this.isStatusActionEnabled(newStatus);

    // تغيير الحالة
    parcel.status = newStatus;
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _ct = (parcel.tracking || '').trim();
    if (_ct && this._dirtyParcels) this._dirtyParcels.add(_ct);
    this.saveData();

    if (newStatus === "تم التسليم") {
      this.triggerConfetti();
    }

    // إنشاء رسالة SMS
    const message = this.buildSmsMessage(parcel, newStatus);

    // تحديد رقم الهاتف: للمرسل أو للمستلم
    const phone =
      newStatus === "رقم خاطئ" ? parcel.senderPhone || "" : parcel.phone || "";

    if (newStatus === "رقم خاطئ") {
      parcel.senderSmsSent = true;
    } else {
      parcel.smsSent = true;
    }
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _ct2 = (parcel.tracking || '').trim();
    if (_ct2 && this._dirtyParcels) this._dirtyParcels.add(_ct2);
    this.saveData();
    const shouldOpenYalidine =
      actionEnabled && !['دون إجراء','في الإنتظار'].includes(newStatus);
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;

    if (shouldOpenYalidine) {
      setTimeout(() => {
        this.openYalidine(parcel.tracking);
      }, 800);
    }

    this.closeStatusSmsConfirm();
  },

  // تأكيد تغيير الحالة بدون SMS
  confirmStatusChangeOnly() {
    if (!this.statusSmsConfirmParcel) return;

    const actionEnabled = this.isStatusActionEnabled(this.statusSmsConfirmStatus);

    this.statusSmsConfirmParcel.status = this.statusSmsConfirmStatus;
    this.statusSmsConfirmParcel.updatedAt = new Date().toISOString();
    this.statusSmsConfirmParcel._localUpdatedAt = Date.now();
    const _ot = (this.statusSmsConfirmParcel.tracking || '').trim();
    if (_ot && this._dirtyParcels) this._dirtyParcels.add(_ot);
    this.saveData();

    if (this.statusSmsConfirmStatus === "تم التسليم") {
      this.triggerConfetti();
    }

    if (actionEnabled && !['دون إجراء','في الإنتظار'].includes(this.statusSmsConfirmStatus)) {
      this.openYalidine(this.statusSmsConfirmParcel.tracking);
    }

    this.closeStatusSmsConfirm();
  },

  // إغلاق نافذة التأكيد
  closeStatusSmsConfirm() {
    this.showStatusSmsConfirm = false;
    this.statusSmsConfirmParcel = null;
    this.statusSmsConfirmStatus = null;
  },

  // ========== Parcel Management ==========
  toggleExpand(id) {
    this.parcels.forEach((p) => {
      if (p.id !== id && p.expanded) {
        p.expanded = false;
        if (this.activeListeningId === p.id && this.recognition) {
          this.recognition.stop();
          this.activeListeningId = null;
        }
      }
    });
    const p = this.parcels.find((x) => x.id === id);
    if (p) {
      p.expanded = !p.expanded;
      if (!p.expanded && this.activeListeningId === id && this.recognition) {
        this.recognition.stop();
        this.activeListeningId = null;
      }
    }
  },

  deleteParcel(id) {
    this.deleteConfirmId = id;
    this.showDeleteConfirm = true;
  },

  confirmDelete() {
    if (this.deleteConfirmId) {
      const _dp = this.parcels.find((p) => p.id === this.deleteConfirmId);
      if (_dp) _dp._localUpdatedAt = Date.now();
      const _dt = _dp ? (_dp.tracking || '').trim() : '';
      this.parcels = this.parcels.filter((p) => p.id !== this.deleteConfirmId);
      if (_dt && this._dirtyParcels) this._dirtyParcels.add(_dt);
      this.saveData([this.deleteConfirmId]);
      this.detectDuplicates();
    }
    this.showDeleteConfirm = false;
    this.deleteConfirmId = null;
    // إعادة تهيئة Sortable بعد الحذف
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  // ========== Edit Parcel Methods ==========
  openEditModal(parcel) {
    this.smartTagSortingPaused = true;
    this.editParcelId = parcel.id;
    this.editParcel = {
      receiver: parcel.receiver || "",
      address: parcel.address || "",
      municipality: parcel.municipality || "",
      wilaya: parcel.wilaya || "",
      phone: parcel.phone || "",
      phone2: parcel.phone2 || "",
      amount: parcel.amount || "",
      newMunicipality: "",
    };
    this.showEditModal = true;
  },

  selectEditMunicipality(muni) {
    this.editParcel.municipality = muni;
    this.showEditMunicipalityList = false;
  },

  saveEditParcel() {
    const parcel = this.parcels.find((p) => p.id === this.editParcelId);
    if (parcel) {
      // إذا تغير المبلغ، اطلب تأكيد المستخدم قبل التحديث
      const oldAmount = parcel.amount || "";
      const newAmount = this.editParcel.amount || "";
      if ((oldAmount + "") !== (newAmount + "")) {
        this.pendingPriceChange = { parcelId: this.editParcelId, old: oldAmount, new: newAmount };
        this.showPriceConfirmModal = true;
        return; // ننتظر تأكيد المستخدم
      }

      parcel.receiver = this.editParcel.receiver;
      parcel.address = this.editParcel.address;
      // إذا اختار إضافة بلدية جديدة
      if (this.editParcel.municipality === "__new__") {
        parcel.municipality = this.editParcel.newMunicipality || "";
      } else {
        parcel.municipality = this.editParcel.municipality;
      }
      parcel.wilaya = this.editParcel.wilaya;
      parcel.phone = this.editParcel.phone;
      parcel.phone2 = this.editParcel.phone2;
      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const t = (parcel.tracking || '').trim();
      if (t && this._dirtyParcels) this._dirtyParcels.add(t);
      this.saveData();
      this.detectDuplicates();
    }
    this.showEditModal = false;
    this.editParcel = null;
    this.editParcelId = null;
    this.resumeSmartTagSorting();
    this.scrollParcelIntoView(parcel.id);
    // إعادة تهيئة Sortable بعد التعديل
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  // تأكيد تغيير السعر: يطبق التعديل ويغلق النوافذ
  confirmPriceChange() {
    if (!this.pendingPriceChange) return;
    const parcel = this.parcels.find((p) => p.id === this.pendingPriceChange.parcelId);
    if (parcel && this.editParcel) {
      // نطبق كل التعديلات بما في ذلك المبلغ الجديد
      parcel.receiver = this.editParcel.receiver;
      parcel.address = this.editParcel.address;
      if (this.editParcel.municipality === "__new__") {
        parcel.municipality = this.editParcel.newMunicipality || "";
      } else {
        parcel.municipality = this.editParcel.municipality;
      }
      parcel.wilaya = this.editParcel.wilaya;
      parcel.phone = this.editParcel.phone;
      parcel.phone2 = this.editParcel.phone2;
      parcel.amount = this.pendingPriceChange.new;

      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const t = (parcel.tracking || '').trim();
      if (t && this._dirtyParcels) this._dirtyParcels.add(t);
      this.saveData();
      this.detectDuplicates();
    }
    this.showPriceConfirmModal = false;
    this.pendingPriceChange = null;
    this.closeEditModal(parcel.id);
    this.scrollParcelIntoView(parcel.id);
    // إعادة تهيئة Sortable بعد التعديل
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  closeEditModal(parcelId = null) {
    this.showEditModal = false;
    this.editParcel = null;
    this.editParcelId = null;
    this.smartTagSortingPaused = false;
    this.showPriceConfirmModal = false;
    this.pendingPriceChange = null;
    if (parcelId) this.scrollParcelIntoView(parcelId);
  },

  // إلغاء تغيير السعر
  cancelPriceChange() {
    this.showPriceConfirmModal = false;
    this.pendingPriceChange = null;
    // اترك نافذة التعديل مفتوحة حتى يتمكن المستخدم من التعديل أو الإلغاء
  },



  editMunicipalitySuggestions() {
    const munis = this.uniqueMunicipalities();
    const search = (this.editParcel?.municipality || "").toLowerCase();
    if (!search) return munis;
    return munis.filter((m) => m.toLowerCase().includes(search));
  },

  addManualParcel() {
    this.parcels.forEach((p) => (p.expanded = false));
    const newP = {
      id: Date.now(),
      ...this.newParcel,
      location: this.normalizeLocation(this.newParcel.location),
      status: "دون إجراء",
      expanded: true,
      isUpdated: false,
      history: null,
      insertedAt: this._nowTimestamp(),
      updatedAt: new Date().toISOString(),
      _localUpdatedAt: Date.now(),
    };
    this.parcels.unshift(newP);
    const t = (newP.tracking || '').trim();
    if (t && this._dirtyParcels) this._dirtyParcels.add(t);
    this.saveData();
    this.detectDuplicates();
    this.showAddModal = false;
    this.showPhone2Field = false;
    this.showSenderFields = false;
    this.newParcel = {
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
      location: this.createEmptyLocation(),
    };
    // إعادة تهيئة Sortable بعد إضافة طرد جديد
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  clearAllData() {
    this.showClearDataConfirm = true;
  },

  confirmClearAllData() {
    // حذف فقط الطرود الظاهرة (المفلترة)
    const visibleIds = new Set(this.filteredParcels.map(p => p.id));
    this.parcels = this.parcels.filter(p => !visibleIds.has(p.id));
    
    // حفظ البيانات دون حذف الأرشيف والإعدادات
    this.saveData();
    this.showClearDataConfirm = false;
    this.currentView = "main";
    
    // إعادة تهيئة Sortable بعد الحذف
    this.$nextTick(() => {
      this.initSortable();
    });
  },

  resetSmsTemplate() {
    this.settings.smsTemplate =
      "مرحبًا {اسم_المستلم}،\nمعكم خدمة التوصيل.\nطلبيتكم برقم التتبع {رقم_التتبع} جاهزة للاستلام.\nثمن الطرد مع التوصيل: {المبلغ} دج.\nشكرًا لكم!";
    this.saveSettings();
  },

  // ========== Formatting & Utilities ==========
  formatCurrency(value) {
    // نستخدم التنسيق الفرنسي-الجزائري للحصول على الترتيب المطلوب (رقم ثم مسافة ثم رمز العملة)
    const formatted = new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      maximumFractionDigits: 0,
    }).format(value);

    // استبدال رمز العملة (الموجود في آخر السلسلة) بـ "دج"
    // نستخدم تعبير نمطي للبحث عن أي حروف غير أرقام في نهاية السلسلة واستبدالها
    return formatted.replace(/\D+$/, " دج");
  },

  formatPhoneForWa(phone) {
    if (!phone) return "";
    return phone.toString().replace(/\D/g, "").replace(/^0/, "");
  },

  // ========== External Actions ==========
  callPhone(phone) {
    window.location.href = `tel:${phone}`;
  },

  openYalidine(tracking) {
    if (!tracking) return;
    window.open(
      `https://yalidine.app/app/livraison/livrer_un_colis.php?tracking=${tracking}`,
      "_blank",
    );
  },

  isStatusActionEnabled(statusName) {
    if (!this.settings.statusActionEnabled) {
      this.settings.statusActionEnabled = {};
    }
    if (typeof this.settings.statusActionEnabled[statusName] === "undefined") {
      this.settings.statusActionEnabled[statusName] = true;
    }
    return this.settings.statusActionEnabled[statusName];
  },

  toggleStatusActionEnabled(statusName, enabled) {
    if (!this.settings.statusActionEnabled) {
      this.settings.statusActionEnabled = {};
    }
    this.settings.statusActionEnabled[statusName] = enabled;
    this.saveSettings();
  },

  getSmsLink(parcel) {
    let message =
      this.settings.smsTemplate ||
      "مرحبًا {اسم_المستلم}،\nطلبيتكم برقم {رقم_التتبع} جاهزة.\nالمبلغ: {المبلغ} دج.";
    const maxLen = this.settings.smsContentLength || 10;
    const content = (parcel.content || "").substring(0, maxLen);
    message = message
      .replace(/\{المبلغ\}/g, parcel.amount || "0")
      .replace(/\{المحتوى\}/g, content)
      .replace(/\{اسم_المستلم\}/g, parcel.receiver || "")
      .replace(/\{رقم_التتبع\}/g, parcel.tracking || "")
      .replace(/\{البلدية\}/g, parcel.municipality || "")
      .replace(/\{الولاية\}/g, parcel.wilaya || "")
      .replace(/\{اسم_المرسل\}/g, parcel.sender || "");
    const phones = parcel.phone2
      ? `${parcel.phone},${parcel.phone2}`
      : parcel.phone;
    return `sms:${phones}?body=${encodeURIComponent(message)}`;
  },

  sendSmsAndMark(parcel) {
    parcel.smsSent = true;
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _smt = (parcel.tracking || '').trim();
    if (_smt && this._dirtyParcels) this._dirtyParcels.add(_smt);
    this.saveData();
    window.location.href = this.getSmsLink(parcel);
  },

  // ========== Bulk SMS ==========
  openBulkSmsModal() {
    this.bulkSmsFilter = "all";
    this.bulkSmsStatusFilter = "";
    this.bulkSmsTagFilter = "";
    this.bulkSmsMunicipalityFilter = "";
    this.bulkSmsQueue = [];
    this.bulkSmsIndex = 0;
    this.bulkSmsSending = false;
    this.showBulkSmsModal = true;
  },

  getBulkSmsRecipients() {
    let list = this.parcels;
    if (this.bulkSmsFilter === "status" && this.bulkSmsStatusFilter) {
      list = list.filter((p) => p.status === this.bulkSmsStatusFilter);
    } else if (this.bulkSmsFilter === "tag" && this.bulkSmsTagFilter) {
      list = list.filter((p) => p.tag === this.bulkSmsTagFilter);
    } else if (
      this.bulkSmsFilter === "municipality" &&
      this.bulkSmsMunicipalityFilter
    ) {
      list = list.filter(
        (p) => p.municipality === this.bulkSmsMunicipalityFilter,
      );
    } else if (this.bulkSmsFilter === "favorite") {
      list = list.filter((p) => this.isFavoriteParcel(p));
    } else if (this.bulkSmsFilter === "filtered") {
      list = this.filteredParcels;
    }
    return list.filter((p) => p.phone);
  },

  startBulkSms() {
    const recipients = this.getBulkSmsRecipients();
    if (recipients.length === 0) return;
    this.bulkSmsQueue = [...recipients];
    this.bulkSmsIndex = 0;
    this.bulkSmsSending = true;
  },

  bulkSmsSendAndNext() {
    const parcel = this.bulkSmsQueue[this.bulkSmsIndex];
    if (parcel) {
      const real = this.parcels.find((p) => p.id === parcel.id);
      if (real) {
        real.smsSent = true;
        real.updatedAt = new Date().toISOString();
        real._localUpdatedAt = Date.now();
        const _bsmt = (real.tracking || '').trim();
        if (_bsmt && this._dirtyParcels) this._dirtyParcels.add(_bsmt);
        this.saveData();
      }
    }
    setTimeout(() => {
      if (this.bulkSmsIndex < this.bulkSmsQueue.length - 1) {
        this.bulkSmsIndex++;
      } else {
        this.bulkSmsSending = false;
        this.showBulkSmsModal = false;
      }
    }, 500);
  },

  bulkSmsSkip() {
    if (this.bulkSmsIndex < this.bulkSmsQueue.length - 1) {
      this.bulkSmsIndex++;
    } else {
      this.bulkSmsSending = false;
      this.showBulkSmsModal = false;
    }
  },

  // ========== Speech Recognition ==========
  initSpeech() {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "ar-DZ";
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const parcel = this.parcels.find(
          (p) => p.id === this.activeListeningId,
        );
        if (parcel) {
          parcel.notes = parcel.notes
            ? parcel.notes + " " + transcript
            : transcript;
    
          parcel.updatedAt = new Date().toISOString();
          parcel._localUpdatedAt = Date.now();
          const _srt2 = (parcel.tracking || '').trim();
          if (_srt2 && this._dirtyParcels) this._dirtyParcels.add(_srt2);
          this.saveData();
        }
        this.activeListeningId = null;
      };
      this.recognition.onend = () => {
        this.activeListeningId = null;
      };
      this.recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        this.activeListeningId = null;
      };
    } else {
      alert("عذرًا، متصفحك لا يدعم خاصية تحويل الصوت إلى نص.");
    }
  },

  toggleSpeech(parcel) {
    if (!this.recognition) {
      this.initSpeech();
      if (!this.recognition) return;
    }
    if (this.activeListeningId === parcel.id) {
      this.recognition.stop();
      this.activeListeningId = null;
    } else {
      if (this.activeListeningId) this.recognition.stop();
      this.activeListeningId = parcel.id;
      this.recognition.start();
    }
  },

  // ========== Voice Search ==========
  startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      this.showToast('متصفحك لا يدعم البحث الصوتي', 'error');
      return;
    }
    if (this.voiceSearchActive) {
      this._voiceSearchRec.stop();
      this.voiceSearchActive = false;
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._voiceSearchRec = new SpeechRecognition();
    this._voiceSearchRec.lang = 'ar-DZ';
    this._voiceSearchRec.continuous = false;
    this._voiceSearchRec.interimResults = false;
    this.voiceSearchActive = true;
    this._voiceSearchRec.onresult = (event) => {
      this.filters.search = event.results[0][0].transcript;
      this.voiceSearchActive = false;
    };
    this._voiceSearchRec.onend = () => { this.voiceSearchActive = false; };
    this._voiceSearchRec.onerror = () => { this.voiceSearchActive = false; };
    this._voiceSearchRec.start();
  },

  // ========== Computed Properties ==========
  uniqueMunicipalities() {
    const munis = new Set(
      this.parcels.map((p) => (p.municipality || "").trim()).filter((m) => m),
    );
    return Array.from(munis).sort();
  },

  hasActiveFilters() {
    return (
      this.filters.search ||
      this.filters.municipality ||
      this.filters.status ||
      this.filters.tag ||
      this.filters.favorite
    );
  },

  visibleStatusFilters() {
    const contextParcels = this.parcels.filter((p) => {
      const query = this.filters.search.toLowerCase();
      const matchesSearch =
        !query ||
        (p.receiver && p.receiver.toLowerCase().includes(query)) ||
        (p.phone && p.phone.includes(query)) ||
        (p.phone2 && p.phone2.includes(query)) ||
        (p.tracking && p.tracking.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query)) ||
        this.getLocationSearchText(p).includes(query);
      const matchesMuni =
        !this.filters.municipality ||
        p.municipality === this.filters.municipality;
      const matchesTag = !this.filters.tag || p.tag === this.filters.tag;
      const matchesFav = !this.filters.favorite || this.isFavoriteParcel(p);
      return matchesSearch && matchesMuni && matchesTag && matchesFav;
    });
    return this.allStatuses
      .map((status) => ({
        ...status,
        count: contextParcels.filter((p) => p.status === status.name).length,
      }))
      .filter((s) => s.count > 0);
  },

  filteredParcels() {
    const query = this.filters.search.toLowerCase();
    let list = [];
    if (query) {
      list = this.parcels.filter((p) =>
        (p.receiver && p.receiver.toLowerCase().includes(query)) ||
        (p.phone && p.phone.includes(query)) ||
        (p.phone2 && p.phone2.includes(query)) ||
        (p.tracking && p.tracking.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query)) ||
        this.getLocationSearchText(p).includes(query)
      );
    } else {
      list = this.parcels.filter((p) => {
        const matchesMuni =
          !this.filters.municipality ||
          p.municipality === this.filters.municipality;
        const matchesStatus =
          !this.filters.status || p.status === this.filters.status;
        const matchesTag = !this.filters.tag || p.tag === this.filters.tag;
        const matchesFav = !this.filters.favorite || this.isFavoriteParcel(p);
        return matchesMuni && matchesStatus && matchesTag && matchesFav;
      });
    }

    const order = Array.isArray(this.settings.tagOrder) && this.settings.tagOrder.length > 0
      ? this.settings.tagOrder
      : this.settings.tags || [];

    if (!this.smartTagSortingPaused && this.settings.smartTagSortingEnabled && order.length > 0) {
      return [...list].sort((a, b) => {
        const indexA = a.tag ? order.indexOf(a.tag) : order.length;
        const indexB = b.tag ? order.indexOf(b.tag) : order.length;
        const normalizedA = indexA === -1 ? order.length : indexA;
        const normalizedB = indexB === -1 ? order.length : indexB;
        if (normalizedA !== normalizedB) {
          return normalizedA - normalizedB;
        }
        return 0;
      });
    }

    return list;
  },

  totalCash() {
    return this.parcels
      .filter((p) => p.status === "تم التسليم")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  },

  remainingCount() {
    return this.parcels.filter(
      (p) => !["تم التسليم", "إلغاء الطلبية", "استرجاع"].includes(p.status),
    ).length;
  },

  getStatsForSettings() {
    const total = this.parcels.length;
    const delivered = this.parcels.filter((p) => p.status === "تم التسليم").length;
    const cancelled = this.parcels.filter((p) => p.status === "إلغاء الطلبية").length;
    const remaining = this.parcels.filter((p) => !["تم التسليم", "إلغاء الطلبية", "استرجاع"].includes(p.status)).length;
    return { total, delivered, cancelled, remaining };
  },

  // ========== Notifications & Reminders ==========
  initNotifications() {
    this.loadNotificationsData();
    this.checkNotifications();
    this.notificationCheckInterval = setInterval(() => {
      this.checkNotifications();
    }, 30000);

    // إعادة التحقق عند العودة للتطبيق (بعد قفل الشاشة أو التبديل)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.checkNotifications();
      }
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // إرسال التذكيرات المجدولة للـ Service Worker
    this.syncRemindersToSW();
  },

  loadNotificationsData() {
    const saved = localStorage.getItem("swipex_notifications");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.notifications = data.notifications || [];
        this.tasks = data.tasks || [];
      } catch (e) {
        console.error("خطأ في تحميل الإشعارات:", e);
      }
    }
  },

  saveNotificationsData() {
    localStorage.setItem(
      "swipex_notifications",
      JSON.stringify({
        notifications: this.notifications,
        tasks: this.tasks,
      }),
    );
    if (firestoreSync.isAvailable()) {
      firestoreSync.saveTasks(this.tasks);
    }
  },

  checkNotifications() {
    const now = new Date();
    const currentTime =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    this.parcels.forEach((parcel) => {
      if (
        parcel.reminderTime &&
        parcel.reminderTime === currentTime &&
        !parcel.reminderTriggered
      ) {
        const message = parcel.notes || "تذكير للطرد";
        const fullMessage = `${parcel.receiver || ""}\n${message}`;

        this.addNotification({
          type: "reminder",
          title: "تذكير بملاحظة",
          message: fullMessage,
          parcelId: parcel.id,
          tracking: parcel.tracking,
          time: now.toISOString(),
        });
        parcel.reminderTriggered = true;
        this.saveData();
        this.showBrowserNotification("تذكير", fullMessage, parcel.tracking);

        // إرسال إشعار للـ Service Worker
        this.sendPushNotification("تذكير", fullMessage, parcel.tracking);
      }
    });

    this.tasks.forEach((task) => {
      if (
        task.reminderTime &&
        task.reminderTime === currentTime &&
        !task.triggered
      ) {
        this.addNotification({
          type: "task",
          title: "تذكير بمهمة",
          message: task.description,
          taskId: task.id,
          time: now.toISOString(),
        });
        task.triggered = true;
        this.saveNotificationsData();
        this.showBrowserNotification("مهمة", task.description);

        // إرسال إشعار للـ Service Worker
        this.sendPushNotification("مهمة", task.description);
      }
    });

    // إعادة مزامنة التذكيرات المتبقية مع SW
    this.syncRemindersToSW();
  },

  sendPushNotification(title, body, tracking = "") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification("SwiPex - " + title, {
          body: tracking ? `📦 ${tracking}\n${body}` : body,
          icon: "assets/icons/icon-192.png",
          badge: "assets/icons/icon-192.png",
          tag: "swipex-notif-" + Date.now(),
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          data: { tracking },
        });
      });
    }
  },

  syncRemindersToSW() {
    if (!("serviceWorker" in navigator)) return;
    const reminders = [];
    this.parcels.forEach((p) => {
      if (p.reminderTime && !p.reminderTriggered) {
        reminders.push({
          type: "parcel",
          id: p.id,
          tracking: p.tracking,
          receiver: p.receiver,
          notes: p.notes,
          time: p.reminderTime,
        });
      }
    });
    this.tasks.forEach((t) => {
      if (t.reminderTime && !t.triggered) {
        reminders.push({
          type: "task",
          id: t.id,
          description: t.description,
          time: t.reminderTime,
        });
      }
    });
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({ type: "SYNC_REMINDERS", reminders });
      }
    });
  },

  showBrowserNotification(title, body, tracking = "") {
    // تشغيل صوت الإشعار
    this.playNotificationSound();

    if ("Notification" in window && Notification.permission === "granted") {
      const notifBody = tracking ? `📦 ${tracking}\n${body}` : body;
      const notification = new Notification("SwiPex - " + title, {
        body: notifBody,
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        tag: "swipex-reminder-" + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
      });

      notification.onclick = () => {
        window.focus();
        if (tracking) {
          this.filters.search = tracking;
          this.filters.municipality = "";
          this.filters.status = "";
        }
        notification.close();
      };
    }
  },

  playNotificationSound() {
    try {
      const audio = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNvfEhAAAAAAD/+9DEAAAIAAaQdAAAgSgptv8xgAB8AwBn/8EIIDAMf/BCCAYMB//ggggMGB//4IQQDh8Hw+H8uD4fh/8H4f/y4Pn/+XB8/h///5cPz+H/8uf/5d//l3//y7/ygf/5cIgoGH/BgwY8IQvCgGCEL3/BC94MePCC97whvCEL/BC//whC973hC/4MH/CC/4MeDB/4QQv/8uHw+H8v//+sLh+H4fz//y4fD5///8u//y5///y7//Lg+H4f/5f/y4fn8v/+AAAAAC0nJycnJycnJycAAAAALScnJycnJycnJwAAAAAupycnJycnJycnJwAAAAC6nJycnJycnJycnAALqcnJycnJycnJycA//tQxBOAAADSAAAAAAAAANIAAAAAS6nJycnJycnJycnJwAC6nJycnJycnJycnAAAAAupycnJycnJycnJycAAAAAtJycnJycnJycnJwAAAAAC0nJycnJycnJycAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxDqAAADSAAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      console.log("Could not play notification sound");
    }
  },

  addNotification(notification) {
    notification.id = Date.now();
    notification.read = false;
    this.notifications.unshift(notification);
    this.saveNotificationsData();
  },

  markNotificationRead(id) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.saveNotificationsData();
    }
  },

  goToNotificationParcel(notif) {
    this.markNotificationRead(notif.id);
    if (notif.tracking) {
      this.filters.search = notif.tracking;
      this.filters.municipality = "";
      this.filters.status = "";
      this.showNotificationsPanel = false;
    }
  },

  deleteNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.saveNotificationsData();
  },

  clearAllNotifications() {
    this.notifications = [];
    this.saveNotificationsData();
  },

  unreadNotificationsCount() {
    return this.notifications.filter((n) => !n.read).length;
  },

  // ========== Reminder Picker ==========
  openReminderPicker(parcelId) {
    this.reminderPickerParcelId = parcelId;
    const parcel = this.parcels.find((p) => p.id === parcelId);
    if (parcel && parcel.reminderTime) {
      const [hour, minute] = parcel.reminderTime.split(":");
      this.reminderTime = { hour, minute };
    } else {
      const now = new Date();
      this.reminderTime = {
        hour: now.getHours().toString().padStart(2, "0"),
        minute: now.getMinutes().toString().padStart(2, "0"),
      };
    }
    this.showReminderPicker = true;
  },

  saveReminder() {
    const parcel = this.parcels.find(
      (p) => p.id === this.reminderPickerParcelId,
    );
    if (parcel) {
      parcel.reminderTime =
        this.reminderTime.hour + ":" + this.reminderTime.minute;
      parcel.reminderTriggered = false;
      parcel._localUpdatedAt = Date.now();
      const _srt = (parcel.tracking || '').trim();
      if (_srt && this._dirtyParcels) this._dirtyParcels.add(_srt);
      this.saveData();
    }
    this.showReminderPicker = false;
    this.reminderPickerParcelId = null;
  },

  updateReminderTime(value) {
    if (value) {
      const [hour, minute] = value.split(":");
      this.reminderTime.hour = hour;
      this.reminderTime.minute = minute;
    }
  },

  cancelReminder() {
    this.showReminderPicker = false;
    this.reminderPickerParcelId = null;
  },

  removeParcelReminder(parcelId) {
    const parcel = this.parcels.find((p) => p.id === parcelId);
    if (parcel) {
      parcel.reminderTime = null;
      parcel.reminderTriggered = false;

      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _rmt = (parcel.tracking || '').trim();
      if (_rmt && this._dirtyParcels) this._dirtyParcels.add(_rmt);
      this.saveData();
    }
  },

  // ========== Tasks ==========
  openAddTaskModal() {
    this.newTask = { description: "", reminderTime: "" };
    this.showAddTaskModal = true;
    this.drawerOpen = false;
  },

  addTask() {
    if (!this.newTask.description.trim()) return;

    const task = {
      id: Date.now(),
      description: this.newTask.description,
      reminderTime: this.newTask.reminderTime || null,
      triggered: false,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.tasks.unshift(task);
    this.saveNotificationsData();
    this.showAddTaskModal = false;
    this.isListeningForTask = false;
    this.newTask = { description: "", reminderTime: "" };
  },

  toggleTaskSpeech() {
    if (!this.recognition) {
      this.initSpeech();
      if (!this.recognition) return;
    }

    if (this.isListeningForTask) {
      this.recognition.stop();
      this.isListeningForTask = false;
    } else {
      if (this.activeListeningId) this.recognition.stop();
      this.activeListeningId = null;
      this.isListeningForTask = true;
      this.isListeningForEditTask = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.newTask.description = this.newTask.description
          ? this.newTask.description + " " + transcript
          : transcript;
        this.isListeningForTask = false;
      };
      this.recognition.onend = () => {
        this.isListeningForTask = false;
      };
      this.recognition.start();
    }
  },

  toggleEditTaskSpeech() {
    if (!this.recognition) {
      this.initSpeech();
      if (!this.recognition) return;
    }

    if (this.isListeningForEditTask) {
      this.recognition.stop();
      this.isListeningForEditTask = false;
    } else {
      if (this.activeListeningId) this.recognition.stop();
      this.activeListeningId = null;
      this.isListeningForEditTask = true;
      this.isListeningForTask = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.editingTask.description = this.editingTask.description
          ? this.editingTask.description + " " + transcript
          : transcript;
        this.isListeningForEditTask = false;
      };
      this.recognition.onend = () => {
        this.isListeningForEditTask = false;
      };
      this.recognition.start();
    }
  },

  toggleTaskComplete(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this.saveNotificationsData();
    }
  },

  deleteTask(taskId) {
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this.saveNotificationsData();
    this.showEditTaskModal = false;
    this.editingTask = null;
  },

  openEditTaskModal(task) {
    this.editingTask = { ...task };
    this.showEditTaskModal = true;
  },

  saveEditTask() {
    const task = this.tasks.find((t) => t.id === this.editingTask.id);
    if (task) {
      task.description = this.editingTask.description;
      task.reminderTime = this.editingTask.reminderTime;
      task.triggered = false;
      this.saveNotificationsData();
    }
    this.showEditTaskModal = false;
    this.editingTask = null;
  },

  toggleEditingTaskComplete() {
    if (this.editingTask) {
      const task = this.tasks.find((t) => t.id === this.editingTask.id);
      if (task) {
        task.completed = !task.completed;
        this.editingTask.completed = task.completed;
        this.saveNotificationsData();
      }
    }
  },

  formatNotificationTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString("ar-DZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  // ========== Tags (التمييز) ==========
  addTag() {
    const name = String(this.newTagForm?.name || "").trim();
    if (!name) return;

    let tagName = name;
    if (!tagName.startsWith("@")) {
      tagName = "@" + tagName;
    }

    if (!this.settings.tags.includes(tagName)) {
      this.settings.tags.push(tagName);
    }
    if (!Array.isArray(this.settings.tagOrder)) {
      this.settings.tagOrder = [];
    }
    if (!this.settings.tagOrder.includes(tagName)) {
      this.settings.tagOrder.push(tagName);
    }

    this.settings.tagMetadata = this.settings.tagMetadata || {};
    this.settings.tagMetadata[tagName] = {
      name: tagName,
      color: this.newTagForm?.color || "#8b5cf6",
      scope: this.newTagForm?.scope === "municipality" ? "municipality" : "global",
      municipality: this.newTagForm?.scope === "municipality" ? String(this.newTagForm?.municipality || "").trim() : "",
    };

    this.saveSettings();
    this.newTagForm = {
      name: "",
      color: "#8b5cf6",
      scope: "global",
      municipality: "",
    };
  },

  // ========== Custom Statuses ==========
  addCustomStatus() {
    const name = this.newCustomStatus.name.trim();
    if (!name) return;
    const exists = this.allStatuses.some((s) => s.name === name);
    if (exists) return;
    const colorMap = {
      "#9ca3af": { border: "border-gray-400", dot: "bg-gray-400" },
      "#f97316": { border: "border-orange-400", dot: "bg-orange-400" },
      "#eab308": { border: "border-yellow-400", dot: "bg-yellow-400" },
      "#3b82f6": { border: "border-blue-400", dot: "bg-blue-400" },
      "#10b981": { border: "border-green-500", dot: "bg-green-500" },
      "#ef4444": { border: "border-red-500", dot: "bg-red-500" },
      "#8b5cf6": { border: "border-violet-500", dot: "bg-violet-500" },
      "#ec4899": { border: "border-pink-500", dot: "bg-pink-500" },
      "#06b6d4": { border: "border-cyan-500", dot: "bg-cyan-500" },
    };
    const cm = colorMap[this.newCustomStatus.color] || colorMap["#9ca3af"];
    this.settings.customStatuses.push({
      name,
      color: cm.border,
      dot: cm.dot,
      icon: this.newCustomStatus.icon,
      hex: this.newCustomStatus.color,
    });
    if (!this.settings.statusActionEnabled) {
      this.settings.statusActionEnabled = {};
    }
    this.settings.statusActionEnabled[name] = true;
    this.newCustomStatus = { name: "", color: "#9ca3af", icon: "fa-tag" };
    this.saveSettings();
  },

  removeCustomStatus(statusName) {
    this.settings.customStatuses = this.settings.customStatuses.filter(
      (s) => s.name !== statusName,
    );
    this.parcels.forEach((p) => {
      if (p.status === statusName) p.status = "دون إجراء";
    });
    this.saveData();
  },

  openStatusOrderModal() {
    this.statusOrderList = this.allStatuses.map((s) => ({
      name: s.name,
      color: s.color,
      dot: s.dot,
      icon: s.icon,
      isCustom: !!s.isCustom,
    }));
    this.showStatusOrderModal = true;
  },

  moveStatusInOrder(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.statusOrderList.length) return;
    const list = [...this.statusOrderList];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    this.statusOrderList = list;
  },

  saveStatusOrder() {
    this.settings.statusOrder = this.statusOrderList.map((s) => s.name);
    this.showStatusOrderModal = false;
    this.saveSettings();
  },

  resetStatusOrder() {
    this.settings.statusOrder = [];
    this.showStatusOrderModal = false;
    this.saveSettings();
  },

  removeTag(tagName) {
    this.settings.tags = this.settings.tags.filter((t) => t !== tagName);
    this.settings.tagOrder = (this.settings.tagOrder || []).filter((t) => t !== tagName);
    if (this.settings.tagMetadata) {
      delete this.settings.tagMetadata[tagName];
    }
    this.parcels.forEach((p) => {
      if (p.tag === tagName) {
        p.tag = null;
      }
    });
    this.saveData();
  },

  openTagPicker(parcelId) {
    this.pauseSmartTagSorting(1000);
    this.tagPickerParcelId = parcelId;
    this.quickTagInput = "";
    this.quickTagForm = {
      name: "",
      color: "#8b5cf6",
      scope: "global",
      municipality: this.parcels.find((p) => p.id === parcelId)?.municipality || "",
    };
    this.showQuickTagForm = false;
    this.showTagPicker = true;
  },

  addQuickTag() {
    const name = String(this.quickTagForm?.name || "").trim();
    if (!name) return;

    let tagName = name;
    if (!tagName.startsWith("@")) {
      tagName = "@" + tagName;
    }

    if (!this.settings.tags.includes(tagName)) {
      this.settings.tags.push(tagName);
    }
    if (!Array.isArray(this.settings.tagOrder)) {
      this.settings.tagOrder = [];
    }
    if (!this.settings.tagOrder.includes(tagName)) {
      this.settings.tagOrder.push(tagName);
    }

    const parcel = this.parcels.find((p) => p.id === this.tagPickerParcelId);
    const scope = this.quickTagForm?.scope === "municipality" ? "municipality" : "global";
    const municipality = scope === "municipality" ? (parcel?.municipality || this.quickTagForm?.municipality || "") : "";

    this.settings.tagMetadata = this.settings.tagMetadata || {};
    this.settings.tagMetadata[tagName] = {
      name: tagName,
      color: this.quickTagForm?.color || "#8b5cf6",
      scope,
      municipality,
    };

    this.saveSettings();
    this.selectTagForParcel(tagName);
    this.showQuickTagForm = false;
    this.quickTagForm = {
      name: "",
      color: "#8b5cf6",
      scope: "global",
      municipality: parcel?.municipality || "",
    };
  },

  selectTagForParcel(tagName) {
    const parcel = this.parcels.find((p) => p.id === this.tagPickerParcelId);
    if (parcel) {
      this.pauseSmartTagSorting(500);
      parcel.tag = tagName;
      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _tgt = (parcel.tracking || '').trim();
      if (_tgt && this._dirtyParcels) this._dirtyParcels.add(_tgt);
      this.saveData();
      this.resumeSmartTagSorting();
      this.showTagPicker = false;
      this.tagPickerParcelId = null;
      this.scrollParcelIntoViewAfterUpdate(parcel.id);
      return;
    }

    this.showTagPicker = false;
    this.tagPickerParcelId = null;
  },

  removeParcelTag(parcelId) {
    const parcel = this.parcels.find((p) => p.id === parcelId);
    if (parcel) {
      this.pauseSmartTagSorting(500);
      parcel.tag = null;
      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _rtt = (parcel.tracking || '').trim();
      if (_rtt && this._dirtyParcels) this._dirtyParcels.add(_rtt);
      this.saveData();
      this.resumeSmartTagSorting();
      this.scrollParcelIntoViewAfterUpdate(parcel.id);
    }
  },

  getUsedTags() {
    const tags = new Set();
    if (this.filters.tag) {
      tags.add(this.filters.tag);
    }

    const municipality = this.filters.municipality || "";
    (this.parcels || []).forEach((parcel) => {
      const tagName = String(parcel?.tag || "").trim();
      if (!tagName) return;

      const tagDefinition = this.getTagDefinition(tagName);
      if (!tagDefinition) return;

      if (tagDefinition.scope === "municipality") {
        if (!municipality || tagDefinition.municipality === municipality) {
          tags.add(tagName);
        }
        return;
      }

      tags.add(tagName);
    });

    const orderedTags = Array.from(tags);
    const order = this.settings.tagOrder || [];
    return orderedTags.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  },

  initTagSortable() {
    if (!this.settings.smartTagSortingEnabled) return;
    const el = document.getElementById("tag-order-list");
    if (!el) return;
    if (this.tagSortInstance) {
      this.tagSortInstance.destroy();
      this.tagSortInstance = null;
    }
    this.tagSortInstance = Sortable.create(el, {
      animation: 160,
      handle: '.tag-drag-handle',
      ghostClass: 'opacity-50',
      onEnd: () => {
        this.updateTagOrder();
      },
    });
  },

  updateTagOrder() {
    const el = document.getElementById("tag-order-list");
    if (!el) return;
    const orderedTags = Array.from(el.querySelectorAll('[data-tag]'))
      .map((item) => item.getAttribute('data-tag'))
      .filter(Boolean);
    if (orderedTags.length > 0) {
      const existing = Array.isArray(this.settings.tagOrder) ? this.settings.tagOrder : [];
      const remaining = existing.filter((tag) => !orderedTags.includes(tag));
      this.settings.tagOrder = [...orderedTags, ...remaining];
      this.saveSettings();
    }
  },

  pauseSmartTagSorting(duration = 400) {
    if (!this.settings.smartTagSortingEnabled) return;
    this.smartTagSortingPaused = true;
    if (this._smartTagSortingTimer) {
      clearTimeout(this._smartTagSortingTimer);
    }
    this._smartTagSortingTimer = setTimeout(() => {
      this.smartTagSortingPaused = false;
      this._smartTagSortingTimer = null;
    }, duration);
  },

  resumeSmartTagSorting() {
    if (this._smartTagSortingTimer) {
      clearTimeout(this._smartTagSortingTimer);
      this._smartTagSortingTimer = null;
    }
    this.smartTagSortingPaused = false;
  },

  scrollParcelIntoView(parcelId) {
    this.$nextTick(() => {
      const el = document.getElementById('parcel-card-' + parcelId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  },

  scrollParcelIntoViewAfterUpdate(parcelId) {
    this.$nextTick(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('parcel-card-' + parcelId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  },

  filterByTag(tagName) {
    this.filters.tag = tagName;
    this.showTagsDropdown = false;
  },

  // ========== Authentication Methods ==========
  loadCurrentUser() {
    this.initDeviceId();
    const userData = localStorage.getItem("swipex_user");
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed && parsed.email) {
        this.currentUser = parsed;
        this.settingsPasswordForm = {
          ...this.settingsPasswordForm,
          email: parsed.email
        };
      }
    }

    if (typeof firebase !== "undefined" && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (user && user.email) {
          const savedToken = this.currentUser?.accessToken || null;
          this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            accessToken: savedToken,
          };
          this.settingsPasswordForm = {
            ...this.settingsPasswordForm,
            email: user.email
          };
          localStorage.setItem("swipex_user", JSON.stringify(this.currentUser));
          console.log("✓ تم تسجيل الدخول:", user.email);

          // تفعيل المستمع الفوري (loadData سيتكفل بتحميل البيانات)
          if (!this._firestoreLoaded) {
            console.log("🔄 تفعيل المستمع الفوري...");
            this.initFirestoreListener();
            this._firestoreLoaded = true;

            // هجرة البيانات إلى البنية V2 + تفعيل المستمع الفردي
            this.migrateToV2Structure().then(() => {
              if (this._v2ParcelsUnsub) return;
              this._v2ParcelsUnsub = firestoreSync.listenToParcelsV2((id, data, type) => {
                this.applyIncomingParcelChange(id, data, type);
              });
              console.log("✓ تم تفعيل مستمع V2 للطرود الفردية");

              if (this._v2ArchiveUnsub) return;
              this._v2ArchiveUnsub = firestoreSync.listenToArchiveV2((id, data, type) => {
                if (!this.archive) this.archive = {};
                if (type === 'removed') {
                  if (this.archive[id]) { delete this.archive[id]; }
                  return;
                }
                if (data && data.deleted) {
                  if (this.archive[id]) { delete this.archive[id]; }
                  return;
                }
                const localEntry = this.archive[id];
                const incomingTs = data && data.updatedAt ? (typeof data.updatedAt.toMillis === 'function' ? data.updatedAt.toMillis() : new Date(data.updatedAt).getTime()) : 0;
                const localTs = localEntry && localEntry.updatedAt ? new Date(localEntry.updatedAt).getTime() : 0;
                if (incomingTs > localTs) {
                  this.archive[id] = { ...data, updatedAt: data.updatedAt && data.updatedAt.toMillis ? new Date(data.updatedAt.toMillis()).toISOString() : data.updatedAt };
                }
              });
              console.log("✓ تم تفعيل مستمع V2 للأرشيف الفردي");
            });
          }
        } else {
          this.currentUser = null;
          localStorage.removeItem("swipex_user");
          console.log("⚠ لم يتم تسجيل الدخول - إعادة التوجيه لصفحة الدخول");
          window.location.href = "login.html";
        }
      });
    }
  },

  async saveAccountPassword() {
    if (typeof firebase === "undefined" || !firebase.auth || !firebase.auth().currentUser) {
      this.showToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }

    const user = firebase.auth().currentUser;
    const email = (this.currentUser?.email || user.email || '').trim();
    const password = (this.settingsPasswordForm.password || '').trim();
    const confirmPassword = (this.settingsPasswordForm.confirmPassword || '').trim();

    if (!email || !password || !confirmPassword) {
      this.showToast('يرجى إدخال البريد الإلكتروني وكلمتي المرور', 'error');
      return;
    }

    if (password.length < 6) {
      this.showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    if (password !== confirmPassword) {
      this.showToast('تأكيد كلمة المرور لا يطابق كلمة المرور الجديدة', 'error');
      return;
    }

    try {
      const hasPasswordProvider = user.providerData.some(provider => provider.providerId === 'password');

      if (hasPasswordProvider) {
        await user.updatePassword(password);
        this.showToast('تم تحديث كلمة المرور بنجاح', 'success');
      } else {
        const credential = firebase.auth.EmailAuthProvider.credential(email, password);
        await user.linkWithCredential(credential);
        this.showToast('تم إنشاء كلمة المرور بنجاح', 'success');
      }

      this.settingsPasswordForm.password = '';
      this.settingsPasswordForm.confirmPassword = '';
    } catch (error) {
      console.error('Password update error:', error);

      switch (error.code) {
        case 'auth/requires-recent-login':
          this.showToast('يرجى تسجيل الدخول مرة أخرى ثم حاول مجدداً', 'error');
          break;
        case 'auth/email-already-in-use':
          this.showToast('هذا البريد الإلكتروني مستخدم في حساب آخر', 'error');
          break;
        case 'auth/weak-password':
          this.showToast('كلمة المرور ضعيفة جدًا', 'error');
          break;
        case 'auth/provider-already-linked':
          this.showToast('هذا الحساب مرتبط بالفعل بكلمة مرور', 'info');
          break;
        default:
          this.showToast(error.message || 'فشل تحديث كلمة المرور', 'error');
      }
    }
  },

  async refreshAccessToken() {
    if (typeof firebase === "undefined" || !firebase.auth) return;
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/spreadsheets");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const result = await user.reauthenticateWithPopup(provider);
      if (result.credential) {
        this.currentUser.accessToken = result.credential.accessToken;
        localStorage.setItem("swipex_user", JSON.stringify(this.currentUser));
        console.log("تم تجديد Access Token");
      }
    } catch (error) {
      console.error("فشل تجديد Token:", error);
    }
  },

  async syncNow() {
    if (this.syncStatus === "syncing") return;
    this.syncStatus = "syncing";
    console.log("🔄 بدء المزامنة الفورية...");

    try {
      if (firestoreSync.isAvailable()) {
        // تحميل أولاً ثم حفظ البيانات المدمجة
        console.log("📥 تحميل التحديثات من Firestore...");

        const cloud = await Promise.race([
          firestoreSync.loadAll(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SYNC_LOAD_TIMEOUT")), 8000)
          )
        ]).catch(e => {
          if (e.message === "SYNC_LOAD_TIMEOUT") {
            console.log("⏳ تجاوزت مهلة التحميل - متابعة بالبيانات المحلية");
            return null;
          }
          throw e;
        });

        if (cloud) {
          this.applyCloudData(cloud);
        }

        // حفظ البيانات المدمجة
        console.log("💾 حفظ البيانات المدمجة...");

        const saved = await Promise.race([
          firestoreSync.saveAll({
            parcels: this.parcels,
            settings: { ...this.settings, _sessionDate: this.sessionDate },
            archive: this.archive,
            tasks: this.tasks,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SYNC_SAVE_TIMEOUT")), 8000)
          )
        ]).catch(e => {
          if (e.message === "SYNC_SAVE_TIMEOUT") {
            console.log("⏳ تجاوزت مهلة الحفظ");
            return false;
          }
          throw e;
        });

        this.syncStatus = saved ? "synced" : "error";
        this.syncLocalStorage();
      } else {
        console.log("⚠ Firestore غير متاح");
        this.syncStatus = "idle";
      }
    } catch (e) {
      console.error("❌ خطأ في المزامنة:", e);
      this.syncStatus = "error";
    }
  },

  openSmsEditor(key) {
    this.smsEditorKey = key;
    this.smsEditorText = this.settings[key] || "";
    this.showSmsEditor = true;
    this.$nextTick(() => {
      if (this.$refs.smsEditorTextarea) {
        this.$refs.smsEditorTextarea.focus();
      }
    });
  },

  insertSmsTag(tag) {
    const textarea = this.$refs.smsEditorTextarea;
    if (!textarea) {
      this.smsEditorText += tag;
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.smsEditorText;
    this.smsEditorText = text.substring(0, start) + tag + text.substring(end);
    this.$nextTick(() => {
      const pos = start + tag.length;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    });
  },

  saveSmsEditor() {
    this.settings[this.smsEditorKey] = this.smsEditorText;
    this.saveSettings();
    this.showSmsEditor = false;
  },

  closeSmsEditor() {
    this.showSmsEditor = false;
  },

  async logout() {
    try {
      // إلغاء مستمع Firestore
      if (this.firestoreUnsub) {
        this.firestoreUnsub();
        this.firestoreUnsub = null;
      }
      // إلغاء مستمع V2
      if (this._v2ParcelsUnsub) {
        this._v2ParcelsUnsub();
        this._v2ParcelsUnsub = null;
      }
      if (this._v2ArchiveUnsub) {
        this._v2ArchiveUnsub();
        this._v2ArchiveUnsub = null;
      }

      // إلغاء المؤقتات المعلقة
      if (firestoreSync._saveTimeout) {
        clearTimeout(firestoreSync._saveTimeout);
        firestoreSync._saveTimeout = null;
      }

      // تسجيل الخروج من Firebase أولاً (قبل مسح IndexedDB)
      if (typeof firebase !== "undefined" && firebase.auth) {
        try {
          await firebase.auth().signOut();
        } catch (e) {
          console.warn("فشل تسجيل الخروج من Firebase:", e);
        }
      }

      // مسح localStorage و sessionStorage بالكامل
      localStorage.clear();
      sessionStorage.clear();

      // مسح IndexedDB (كاش Firestore)
      if (window.indexedDB) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            window.indexedDB.deleteDatabase(db.name);
          }
        } catch (e) {
          const knownDBs = [
            "firebaseLocalStorageDb",
            "firebase-heartbeat-database",
            "firestore/[DEFAULT]/swipex-pro/main",
            "firebase-installations-database",
          ];
          knownDBs.forEach((name) => {
            try {
              window.indexedDB.deleteDatabase(name);
            } catch (e2) {}
          });
        }
      }

      // مسح Service Worker cache
      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        } catch (e) {}
      }

      // إعادة التوجيه لصفحة تسجيل الدخول
      this.currentUser = null;
      this._firestoreLoaded = false;
      this.showUserMenu = false;
      window.location.href = "login.html?switch=1";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "login.html?switch=1";
    }
  },

  // ========== Confetti Animation ==========
  triggerConfetti() {
    this.showConfetti = true;
    setTimeout(() => {
      this.showConfetti = false;
    }, 3000);
  },

  // ========== Dashboard Stats ==========
  openDashboard() {
    this.showDashboard = true;
    this.drawerOpen = false;
  },

  openArchive() {
    this.currentView = 'archive';
    this.archiveVisibleCount = 30;
    this.archiveSearch = '';
    this.archiveStatusFilter = '';
    this.showTopMenu = false;
    this.showSessionsView = false;
    this.showDashboard = false;
    this.$nextTick(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  },

  getDashboardStats() {
    const stats = {};
    this.allStatuses.forEach((s) => {
      stats[s.name] = this.parcels.filter((p) => p.status === s.name).length;
    });
    return stats;
  },

  getTopMunicipalities() {
    const counts = {};
    this.parcels.forEach((p) => {
      if (p.municipality) {
        counts[p.municipality] = (counts[p.municipality] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  },

  getDeliveryRate() {
    if (this.parcels.length === 0) return 0;
    const delivered = this.parcels.filter(
      (p) => p.status === "تم التسليم",
    ).length;
    return Math.round((delivered / this.parcels.length) * 100);
  },

  getMaxMunicipalityCount() {
    const top = this.getTopMunicipalities();
    return top.length > 0 ? top[0][1] : 1;
  },

  // ========== Daily Summary ==========
  getDailySummary() {
    const total = this.parcels.length;
    const delivered = this.parcels.filter(
      (p) => p.status === "تم التسليم",
    ).length;
    const remaining = total - delivered;
    const cancelled = this.parcels.filter(
      (p) => p.status === "إلغاء الطلبية",
    ).length;
    const percentage = total > 0 ? Math.round((delivered / total) * 100) : 0;

    const coreColors = {
      "تم التسليم": "#10b981",
      "في الإنتظار": "#f97316",
      مغلق: "#eab308",
      "لا يرد": "#eab308",
      "رقم خاطئ": "#eab308",
      "مؤجل للغد": "#3b82f6",
      "إلغاء الطلبية": "#ef4444",
      "دون إجراء": "#9ca3af",
    };
    const segments = [];
    if (total > 0) {
      for (const [status, color] of Object.entries(coreColors)) {
        const count = this.parcels.filter((p) => p.status === status).length;
        if (count > 0) {
          segments.push({ status, color, count, pct: (count / total) * 100 });
        }
      }
      (this.settings.customStatuses || []).forEach((cs) => {
        const count = this.parcels.filter((p) => p.status === cs.name).length;
        if (count > 0) {
          segments.push({
            status: cs.name,
            color: cs.hex || "#9ca3af",
            count,
            pct: (count / total) * 100,
          });
        }
      });
    }
    return { total, delivered, remaining, cancelled, percentage, segments };
  },

  // ========== Focus Mode ==========
  enterFocusMode() {
    if (this.filteredParcels.length === 0) return;
    this.focusModeIndex = 0;
    this.focusModeActive = true;
    this.focusEditingNotes = false;
    this.focusTouchStartX = 0;
    this.focusTouchDeltaX = 0;
    this.focusSwiping = false;
  },

  exitFocusMode() {
    this.focusModeActive = false;
    this.focusEditingNotes = false;
  },

  focusGoToParcel(parcel) {
    this.focusModeActive = false;
    this.filters.search = parcel.tracking;
    this.$nextTick(() => {
      this.toggleExpand(parcel.id);
    });
  },

  getFocusParcel() {
    const list = this.filteredParcels;
    if (list.length === 0) return null;
    if (this.focusModeIndex >= list.length) this.focusModeIndex = 0;
    return list[this.focusModeIndex];
  },

  getFocusTotal() {
    return this.filteredParcels.length;
  },

  focusNext() {
    const total = this.getFocusTotal();
    if (total === 0) {
      this.exitFocusMode();
      return;
    }
    this.focusModeIndex = (this.focusModeIndex + 1) % total;
    this.focusEditingNotes = false;
  },

  focusPrev() {
    const total = this.getFocusTotal();
    if (total === 0) {
      this.exitFocusMode();
      return;
    }
    this.focusModeIndex = (this.focusModeIndex - 1 + total) % total;
    this.focusEditingNotes = false;
  },

  focusChangeStatus(parcel, newStatus) {
    parcel.status = newStatus;
    parcel.updatedAt = new Date().toISOString();
    parcel._localUpdatedAt = Date.now();
    const _fst = (parcel.tracking || '').trim();
    if (_fst && this._dirtyParcels) this._dirtyParcels.add(_fst);
    this.saveData();
    if (newStatus === "تم التسليم") {
      this.triggerConfetti();
    }
  },

  focusCall(parcel) {
    if (parcel.phone2) {
      this.phonePickerParcel = parcel;
      this.showPhonePickerModal = true;
    } else {
      this.callPhone(parcel.phone);
    }
  },

  focusWhatsApp(parcel) {
    window.open(
      "https://wa.me/213" + this.formatPhoneForWa(parcel.phone),
      "_blank",
    );
  },

  focusSms(parcel) {
    parcel.smsSent = true;
    parcel._localUpdatedAt = Date.now();
    const _fsmt = (parcel.tracking || '').trim();
    if (_fsmt && this._dirtyParcels) this._dirtyParcels.add(_fsmt);
    this.saveData();
    window.location.href = this.getSmsLink(parcel);
  },

  focusToggleNoteEdit() {
    this.focusEditingNotes = !this.focusEditingNotes;
    if (this.focusEditingNotes) {
      this.$nextTick(() => {
        if (this.$refs.focusNoteInput) {
          this.$refs.focusNoteInput.focus();
        }
      });
    }
  },

  focusSaveNote(parcel) {
    this.focusEditingNotes = false;
    if (parcel) {

      parcel.updatedAt = new Date().toISOString();
      parcel._localUpdatedAt = Date.now();
      const _fsnt = (parcel.tracking || '').trim();
      if (_fsnt && this._dirtyParcels) this._dirtyParcels.add(_fsnt);
    }
    this.saveData();
  },

  focusSpeech(parcel) {
    this.toggleSpeech(parcel);
  },

  // ========== Carousel ==========
  getFocusCarouselItems() {
    const list = this.filteredParcels;
    const total = list.length;
    if (total === 0) return [];
    const idx = this.focusModeIndex >= total ? 0 : this.focusModeIndex;
    if (total === 1) return [{ parcel: list[idx], offset: 0 }];
    const prevIdx = (idx - 1 + total) % total;
    const nextIdx = (idx + 1) % total;
    return [
      { parcel: list[prevIdx], offset: -100 },
      { parcel: list[idx], offset: 0 },
      { parcel: list[nextIdx], offset: 100 },
    ];
  },

  getCarouselCardStyle(item) {
    return {
      transform:
        "translateX(" +
        item.offset +
        "%) translateX(" +
        this.focusTouchDeltaX +
        "px)",
      transition: this.focusSwiping ? "none" : "transform 0.3s ease-out",
      pointerEvents: item.offset === 0 ? "auto" : "none",
    };
  },

  focusTouchStart(e) {
    if (this.focusAnimating) return;
    this.focusTouchStartX = e.touches[0].clientX;
    this.focusTouchDeltaX = 0;
    this.focusSwiping = true;
  },

  focusTouchMove(e) {
    if (!this.focusSwiping) return;
    this.focusTouchDeltaX = e.touches[0].clientX - this.focusTouchStartX;
  },

  focusTouchEnd() {
    if (!this.focusSwiping) return;
    this.focusSwiping = false;

    const el = this.$refs.focusCarousel;
    const cardWidth = el ? el.offsetWidth : window.innerWidth;

    if (this.focusTouchDeltaX > 80) {
      this.focusAnimating = true;
      this.focusTouchDeltaX = cardWidth;
      setTimeout(() => {
        this.focusSwiping = true;
        this.focusTouchDeltaX = 0;
        this.focusPrev();
        this.$nextTick(() => {
          this.focusSwiping = false;
          this.focusAnimating = false;
        });
      }, 300);
    } else if (this.focusTouchDeltaX < -80) {
      this.focusAnimating = true;
      this.focusTouchDeltaX = -cardWidth;
      setTimeout(() => {
        this.focusSwiping = true;
        this.focusTouchDeltaX = 0;
        this.focusNext();
        this.$nextTick(() => {
          this.focusSwiping = false;
          this.focusAnimating = false;
        });
      }, 300);
    } else {
      this.focusTouchDeltaX = 0;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 📋 نظام الجلسات التعاونية (Collaborative Sessions)
  // ═══════════════════════════════════════════════════════════════

  /**
   * فتح عرض الجلسات
   */
  openSessionsView() {
    this.showSessionsView = true;
    this.loadUserSessions();
  },

  /**
   * إغلاق عرض الجلسات
   */
  closeSessionsView() {
    this.showSessionsView = false;
    if (this.currentSession) {
      this.leaveSession();
    }
  },

  /**
   * تحميل جلسات المستخدم
   */
  async loadUserSessions() {
    try {
      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      this.sessions = await sessionsManager.getUserSessions();
      this.pendingInvites = await sessionsManager.getPendingInvites();
      console.log(`✅ تم تحميل ${this.sessions.length} جلسة و ${this.pendingInvites.length} دعوة`);
    } catch (error) {
      console.error('❌ خطأ في تحميل الجلسات:', error);
      this.showToast('فشل تحميل الجلسات: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
  },

  /**
   * قبول دعوة
   */
  async acceptSessionInvite(invite) {
    try {
      if (typeof sessionsManager === 'undefined') return;

      const sessionId = await sessionsManager.acceptInvite(invite.id);
      this.showToast(`تم قبول الدعوة بنجاح لـ: ${invite.sessionName}`, 'success');
      
      // السماح بالحفظ في السحابة فوراً (تخطي التحميل الأولي)
      if (typeof firestoreSync !== 'undefined') {
        firestoreSync.skipInitialLoadCheck();
      }

      // تحديث البيانات
      await this.loadUserSessions();
      
      // الانضمام للجلسة
      await this.joinSession(sessionId);
    } catch (error) {
      console.error('❌ خطأ في قبول الدعوة:', error);
      this.showToast('فشل قبول الدعوة', 'error');
    }
  },

  /**
   * رفض دعوة
   */
  async rejectSessionInvite(inviteId) {
    try {
      if (typeof sessionsManager === 'undefined') return;
      if (!confirm('هل أنت متأكد من رفض هذه الدعوة؟')) return;

      await sessionsManager.rejectInvite(inviteId);
      this.showToast('تم رفض الدعوة', 'info');
      await this.loadUserSessions();
    } catch (error) {
      console.error('❌ خطأ في رفض الدعوة:', error);
      this.showToast('فشل رفض الدعوة', 'error');
    }
  },

  /**
   * فتح نافذة إنشاء جلسة جديدة
   */
  openCreateSessionModal() {
    this.newSession = {
      name: '',
      description: '',
      useCurrentFilter: true,
      selectedParcels: [],
      invites: []
    };
    this.showCreateSessionModal = true;
  },

  /**
   * إغلاق نافذة إنشاء الجلسة
   */
  closeCreateSessionModal() {
    this.showCreateSessionModal = false;
  },

  /**
   * إنشاء جلسة جديدة
   */
  async createSession() {
    try {
      if (!this.newSession.name.trim()) {
        this.showToast('يرجى إدخال اسم الجلسة', 'error');
        return;
      }

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      // تحديد الطرود المراد مشاركتها
      let parcelsToShare = [];
      if (this.newSession.useCurrentFilter) {
        // استخدام الفلتر الحالي
        parcelsToShare = this.filteredParcels;
      } else {
        // استخدام الطرود المحددة يدوياً
        parcelsToShare = this.newSession.selectedParcels;
      }

      if (parcelsToShare.length === 0) {
        this.showToast('لا توجد طرود للمشاركة', 'error');
        return;
      }

      // إنشاء الجلسة
      const sessionData = {
        name: this.newSession.name,
        description: this.newSession.description,
        filters: this.filters,
        parcels: parcelsToShare,
        allowInvite: true,
        autoSync: true,
        notifyOnChanges: true
      };

      const sessionId = await sessionsManager.createSession(sessionData);

      // دعوة المستخدمين
      for (const invite of this.newSession.invites) {
        await sessionsManager.inviteUser(sessionId, invite.email, invite.role);
      }

      this.showToast(`تم إنشاء الجلسة بنجاح (${parcelsToShare.length} طرد)`, 'success');
      this.closeCreateSessionModal();
      await this.loadUserSessions();
      
      // فتح الجلسة مباشرة
      await this.joinSession(sessionId);

    } catch (error) {
      console.error('❌ خطأ في إنشاء الجلسة:', error);
      this.showToast('فشل إنشاء الجلسة', 'error');
    }
  },

  /**
   * إضافة دعوة لمستخدم
   */
  addInviteToSession() {
    if (!this.newInvite.email.trim()) {
      this.showToast('يرجى إدخال البريد الإلكتروني', 'error');
      return;
    }

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.newInvite.email)) {
      this.showToast('البريد الإلكتروني غير صحيح', 'error');
      return;
    }

    // التحقق من عدم تكرار البريد
    if (this.newSession.invites.some(inv => inv.email === this.newInvite.email)) {
      this.showToast('هذا المستخدم مدعو بالفعل', 'error');
      return;
    }

    this.newSession.invites.push({
      email: this.newInvite.email,
      role: this.newInvite.role
    });

    this.newInvite = { email: '', role: 'editor' };
    this.showToast('تمت إضافة الدعوة', 'success');
  },

  /**
   * إزالة دعوة
   */
  removeInvite(index) {
    this.newSession.invites.splice(index, 1);
  },

  /**
   * الانضمام لجلسة
   */
  async joinSession(sessionId) {
    try {
      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      // السماح بالحفظ في السحابة فوراً (تخطي التحميل الأولي)
      if (typeof firestoreSync !== 'undefined') {
        firestoreSync.skipInitialLoadCheck();
      }

      // تحميل بيانات الجلسة
      this.currentSession = await sessionsManager.getSession(sessionId);
      this.sessionParcels = await sessionsManager.getSessionParcels(sessionId);
      this.sessionParticipants = await sessionsManager.getParticipants(sessionId);

      // بدء تتبع الحضور
      sessionsManager.startPresenceTracking(sessionId);

      // بدء الاستماع للتحديثات الفورية
      this.startSessionListeners(sessionId);

      // عرض واجهة الجلسة
      this.showSessionDetailsModal = true;

      this.showToast(`انضممت للجلسة: ${this.currentSession.name}`, 'success');
      console.log('✅ تم الانضمام للجلسة:', sessionId);

    } catch (error) {
      console.error('❌ خطأ في الانضمام للجلسة:', error);
      this.showToast('فشل الانضمام للجلسة', 'error');
    }
  },

  /**
   * مغادرة الجلسة
   */
  async leaveSession() {
    try {
      if (!this.currentSession) return;

      const sessionId = this.currentSession.id;

      // إيقاف تتبع الحضور
      if (typeof sessionsManager !== 'undefined') {
        sessionsManager.stopPresenceTracking(sessionId);
        sessionsManager.stopListening(sessionId);
      }

      // إعادة تعيين البيانات
      this.currentSession = null;
      this.sessionParcels = [];
      this.sessionParticipants = [];
      this.sessionActivity = [];
      this.showSessionDetailsModal = false;

      this.showToast('غادرت الجلسة', 'info');
      console.log('✅ تم مغادرة الجلسة');

    } catch (error) {
      console.error('❌ خطأ في مغادرة الجلسة:', error);
    }
  },

  /**
   * بدء الاستماع لتحديثات الجلسة
   */
  startSessionListeners(sessionId) {
    if (typeof sessionsManager === 'undefined') return;

    // الاستماع لتحديثات الجلسة
    sessionsManager.listenToSession(sessionId, (session) => {
      this.currentSession = session;
    });

    // الاستماع لتحديثات الطرود
    sessionsManager.listenToSessionParcels(sessionId, (changeType, parcel) => {
      const index = this.sessionParcels.findIndex(p => p.id === parcel.id);

      if (changeType === 'added' && index === -1) {
        this.sessionParcels.push(parcel);
        this.showSessionNotificationToast(`تمت إضافة طرد جديد بواسطة ${parcel.addedBy}`);
      } else if (changeType === 'modified' && index !== -1) {
        this.sessionParcels[index] = parcel;
        this.showSessionNotificationToast(`تم تحديث طرد بواسطة ${parcel.lastModifiedBy}`);
      } else if (changeType === 'removed' && index !== -1) {
        this.sessionParcels.splice(index, 1);
      }
    });

    // الاستماع لتحديثات المشاركين
    sessionsManager.listenToParticipants(sessionId, (participants) => {
      this.sessionParticipants = participants;
      this.onlineParticipants = participants.filter(p => p.isOnline);
    });
  },

  /**
   * تحديث طرد في الجلسة
   */
  async updateSessionParcel(parcelId, updates) {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      // 1. تحديث الطرد في Firestore (الجلسة)
      await sessionsManager.updateSessionParcel(this.currentSession.id, parcelId, updates);
      console.log('✅ تم تحديث الطرد في الجلسة');

      // 2. تحديث الطرد في appState المحلي (الطرد الأصلي)
      // نبحث عن الطرد في القائمة المحلية باستخدام رقم التتبع
      const parcelInSession = this.sessionParcels.find(p => p.id === parcelId);
      if (parcelInSession) {
        const tracking = parcelInSession.tracking;
        const localParcelIndex = this.parcels.findIndex(p => p.tracking === tracking);
        
        if (localParcelIndex !== -1) {
          // دمج التحديثات في الطرد المحلي
          const localParcel = this.parcels[localParcelIndex];
          this.parcels[localParcelIndex] = { ...localParcel, ...updates };
          
          // حفظ التغييرات محلياً وفي سحابة المستخدم الخاصة
          this.saveData();
          console.log('✅ تم تحديث الطرد الأصلي محلياً');
        }
      }

    } catch (error) {
      console.error('❌ خطأ في تحديث الطرد:', error);
      this.showToast(error.message || 'فشل تحديث الطرد', 'error');
    }
  },

  /**
   * قفل طرد للتعديل
   */
  async lockSessionParcel(parcelId) {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') return;

      await sessionsManager.lockParcel(this.currentSession.id, parcelId);
      this.lockedParcels[parcelId] = true;

    } catch (error) {
      console.error('❌ خطأ في قفل الطرد:', error);
    }
  },

  /**
   * فك قفل طرد
   */
  async unlockSessionParcel(parcelId) {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') return;

      await sessionsManager.unlockParcel(this.currentSession.id, parcelId);
      delete this.lockedParcels[parcelId];

    } catch (error) {
      console.error('❌ خطأ في فك قفل الطرد:', error);
    }
  },

  /**
   * دعوة مستخدم للجلسة الحالية
   */
  async inviteUserToCurrentSession() {
    try {
      if (!this.currentSession) return;

      if (!this.newInvite.email.trim()) {
        this.showToast('يرجى إدخال البريد الإلكتروني', 'error');
        return;
      }

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      await sessionsManager.inviteUser(
        this.currentSession.id,
        this.newInvite.email,
        this.newInvite.role
      );

      this.showToast('تم إرسال الدعوة بنجاح', 'success');
      this.newInvite = { email: '', role: 'editor' };
      this.showInviteUserModal = false;

    } catch (error) {
      console.error('❌ خطأ في دعوة المستخدم:', error);
      this.showToast('فشل إرسال الدعوة', 'error');
    }
  },

  /**
   * إزالة مشارك من الجلسة
   */
  async removeParticipantFromSession(userId) {
    try {
      if (!this.currentSession) return;

      if (!confirm('هل أنت متأكد من إزالة هذا المشارك؟')) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      await sessionsManager.removeParticipant(this.currentSession.id, userId);
      this.showToast('تمت إزالة المشارك', 'success');

    } catch (error) {
      console.error('❌ خطأ في إزالة المشارك:', error);
      this.showToast(error.message || 'فشل إزالة المشارك', 'error');
    }
  },

  /**
   * تحديث دور مشارك
   */
  async updateParticipantRole(userId, newRole) {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      await sessionsManager.updateParticipantRole(this.currentSession.id, userId, newRole);
      this.showToast('تم تحديث الدور بنجاح', 'success');

    } catch (error) {
      console.error('❌ خطأ في تحديث الدور:', error);
      this.showToast(error.message || 'فشل تحديث الدور', 'error');
    }
  },

  /**
   * عرض سجل النشاطات
   */
  async showSessionActivity() {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      this.sessionActivity = await sessionsManager.getActivityLog(this.currentSession.id);
      this.showSessionActivityLog = true;

    } catch (error) {
      console.error('❌ خطأ في جلب سجل النشاطات:', error);
      this.showToast('فشل تحميل سجل النشاطات', 'error');
    }
  },

  /**
   * عرض إحصائيات الجلسة
   */
  async showSessionStatistics() {
    try {
      if (!this.currentSession) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      this.sessionStats = await sessionsManager.getSessionStats(this.currentSession.id);
      this.showSessionStatsModal = true;

    } catch (error) {
      console.error('❌ خطأ في جلب الإحصائيات:', error);
      this.showToast('فشل تحميل الإحصائيات', 'error');
    }
  },

  /**
   * إنهاء الجلسة
   */
  async endSession(sessionId) {
    try {
      if (!confirm('هل أنت متأكد من إنهاء هذه الجلسة؟')) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      await sessionsManager.updateSession(sessionId, { status: 'ended' });
      this.showToast('تم إنهاء الجلسة', 'success');
      
      if (this.currentSession && this.currentSession.id === sessionId) {
        await this.leaveSession();
      }
      
      await this.loadUserSessions();

    } catch (error) {
      console.error('❌ خطأ في إنهاء الجلسة:', error);
      this.showToast('فشل إنهاء الجلسة', 'error');
    }
  },

  /**
   * حذف جلسة
   */
  async deleteSession(sessionId) {
    try {
      if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

      if (typeof sessionsManager === 'undefined') {
        console.error('❌ مدير الجلسات غير متوفر');
        return;
      }

      await sessionsManager.deleteSession(sessionId);
      this.showToast('تم حذف الجلسة', 'success');
      
      if (this.currentSession && this.currentSession.id === sessionId) {
        await this.leaveSession();
      }
      
      await this.loadUserSessions();

    } catch (error) {
      console.error('❌ خطأ في حذف الجلسة:', error);
      this.showToast(error.message || 'فشل حذف الجلسة', 'error');
    }
  },

  /**
   * عرض إشعار الجلسة
   */
  showSessionNotificationToast(message) {
    // يمكن استخدام نظام الإشعارات الموجود
    if (this.settings.notifyOnChanges !== false) {
      this.showToast(message, 'info');
    }
  },

  /**
   * الحصول على اسم الدور بالعربية
   */
  getRoleNameAr(role) {
    const roles = {
      'owner': 'مالك',
      'admin': 'مدير',
      'editor': 'محرر',
      'viewer': 'مشاهد'
    };
    return roles[role] || role;
  },

  /**
   * الحصول على لون الدور
   */
  getRoleColor(role) {
    const colors = {
      'owner': 'text-purple-600',
      'admin': 'text-blue-600',
      'editor': 'text-green-600',
      'viewer': 'text-gray-600'
    };
    return colors[role] || 'text-gray-600';
  },

  /**
   * التحقق من الصلاحية
   */
  canEditSession() {
    if (!this.currentSession || !this.currentUser) return false;
    const myParticipant = this.sessionParticipants.find(p => p.uid === this.currentUser.uid);
    return myParticipant && ['owner', 'admin', 'editor'].includes(myParticipant.role);
  },

  /**
   * التحقق من صلاحية الإدارة
   */
  canManageSession() {
    if (!this.currentSession || !this.currentUser) return false;
    const myParticipant = this.sessionParticipants.find(p => p.uid === this.currentUser.uid);
    return myParticipant && ['owner', 'admin'].includes(myParticipant.role);
  },

  /**
   * تنسيق وقت النشاط
   */
  formatActivityTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
    return `منذ ${Math.floor(diff / 86400000)} يوم`;
  },
};

// Expose for older scripts that expect a global variable
if (typeof window !== 'undefined') window.appMethods = appMethods;
