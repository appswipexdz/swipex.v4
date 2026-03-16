// ============================================
// assets/js/methods.js
// جميع دوال التطبيق الرئيسية
// ============================================

const appMethods = {
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
      firestoreSync
        .saveAll({
          parcels: this.parcels,
          settings: { ...this.settings, _sessionDate: this.sessionDate },
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
        this.parcels = data.parcels || [];
        this.archive = data.archive || {};
        this.sessionDate = data.sessionDate || null;
        const savedSettings = data.settings || {};
        if (
          typeof savedSettings.darkMode !== "undefined" &&
          !savedSettings.themeMode
        ) {
          savedSettings.themeMode = savedSettings.darkMode ? "dark" : "light";
        }
        this.settings = { ...this.settings, ...savedSettings };
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

  applyCloudData(cloud) {
    let loaded = false;
    if (cloud) {
      if (cloud.parcels && cloud.parcels.length > 0) {
        this.parcels = cloud.parcels;
        loaded = true;
        console.log("✓ تم تحميل الطرود من السحابة:", cloud.parcels.length);
      }
      if (cloud.settings && typeof cloud.settings === "object") {
        const { _sessionDate, ...restSettings } = cloud.settings;
        if (_sessionDate) this.sessionDate = _sessionDate;
        this.settings = { ...this.settings, ...restSettings };
        console.log("✓ تم تحميل الإعدادات من السحابة");
      }
      if (cloud.archive && typeof cloud.archive === "object") {
        this.archive = cloud.archive;
        console.log("✓ تم تحميل الأرشيف من السحابة");
      }
      if (cloud.tasks && cloud.tasks.length > 0) {
        this.tasks = cloud.tasks;
        console.log("✓ تم تحميل المهام من السحابة:", cloud.tasks.length);
      }
    }
    if (loaded) {
      this.syncLocalStorage();
      this.applyTheme();
      this.detectDuplicates();
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

        const cloud = await Promise.race([
          firestoreSync.loadAll(),
          timeoutPromise,
        ]);

        loaded = this.applyCloudData(cloud);
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

  saveSettings() {
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
    if (!fav || typeof fav === 'string') return;
    if (fav.name) parcel.receiver = fav.name;
    if (fav.municipality) parcel.municipality = fav.municipality;
    parcel.updatedAt = new Date().toISOString();
    this.saveData();
    this.showToast('تم تطبيق بيانات المفضلة', 'success');
  },

  openNoteModal(parcel) {
    this.noteModalParcel = parcel;
    this.showNoteModal = true;
  },

  closeNoteModal() {
    this.saveData();
    this.showNoteModal = false;
    this.noteModalParcel = null;
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
      if (p.phone) phoneCount[p.phone] = (phoneCount[p.phone] || 0) + 1;
    });
    this.parcels.forEach((p) => {
      p.duplicateCount = phoneCount[p.phone] || 0;
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
      this.archive[tracking] = {
        status: p.status,
        notes: p.notes || "",
        tag: p.tag || null,
        lastUpdate: new Date().toISOString(),
        municipality: p.municipality || "",
        receiver: p.receiver || "",
        smsSent: p.smsSent || false,
        senderSmsSent: p.senderSmsSent || false,
      };
    });
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
      this.archiveCurrentParcels();
      stats.archived = this.parcels.length;
      this.parcels = [];
      this.sessionDate = today;
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
      const hasImportedStatus =
        newParcel.status && newParcel.status !== "دون إجراء";
      const hasImportedNotes = newParcel.notes && newParcel.notes.trim() !== "";

      if (archivedData) {
        const merged = {
          ...newParcel,
          expanded: false,
          isUpdated: true,
          history: archivedData,
          smsSent: archivedData.smsSent || false,
          senderSmsSent: archivedData.senderSmsSent || false,
          insertedAt: this._nowTimestamp(),
          status: hasImportedStatus ? newParcel.status : "دون إجراء",
          notes: hasImportedNotes ? newParcel.notes : "",
        };
        merged.updatedAt = new Date().toISOString();
        processedParcels.push(merged);
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
        };
        created.updatedAt = new Date().toISOString();
        processedParcels.push(created);
        stats.new++;
      }

      existingMap.set(tracking, newParcel);
    });

    this.parcels = processedParcels;
    this.detectDuplicates();

    const phoneCount = {};
    this.parcels.forEach(
      (p) => (phoneCount[p.phone] = (phoneCount[p.phone] || 0) + 1),
    );
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

  // ========== History ==========
  showHistory(parcel) {
    this.currentHistory = parcel.history;
    this.showHistoryModal = true;
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
    this.showFilters = !this.showFilters;
    if (this.showFilters) {
      this.$nextTick(() => {
        if (this.$refs.searchInput) {
          this.$refs.searchInput.focus();
        }
      });
    } else {
      this.filters.search = "";
    }
  },

  clearFilters() {
    this.filters.search = "";
    this.filters.municipality = "";
    this.filters.status = "";
    this.filters.tag = "";
    this.filters.favorite = false;
    this.saveFilters();
  },

  filterByPhone(phone) {
    this.filters.search = phone;
    this.filters.municipality = "";
    this.filters.status = "";
    this.saveFilters();
  },

  quickFilterStatus(statusName) {
    this.filters.status = this.filters.status === statusName ? "" : statusName;
    this.saveFilters();
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
    // هل هذه الحالة مفعّلة لإرسال SMS؟
    const statusSmsEnabled =
      (newStatus === "مغلق" && this.settings.smsOnStatusClosed) ||
      (newStatus === "لا يرد" && this.settings.smsOnStatusNoAnswer) ||
      (newStatus === "رقم خاطئ" && this.settings.smsOnStatusWrongNumber);

    if (statusSmsEnabled) {
      // توفير الرسائل: تخطي التأكيد إذا الطرد من يوم سابق وتم مراسلته
      const alreadySent = newStatus === "رقم خاطئ" ? parcel.senderSmsSent : parcel.smsSent;
      if (this.settings.smsSaving && parcel.isUpdated && alreadySent) {
        parcel.status = newStatus;
        parcel.updatedAt = new Date().toISOString();
        this.statusModalParcel = null;
        this.saveData();
        if (newStatus === "تم التسليم") this.triggerConfetti();
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
    this.statusModalParcel = null;
    this.saveData();

    if (newStatus === "تم التسليم") {
      this.triggerConfetti();
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

    // تغيير الحالة
    parcel.status = newStatus;
    parcel.updatedAt = new Date().toISOString();
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
    this.saveData();
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;

    this.closeStatusSmsConfirm();
  },

  // تأكيد تغيير الحالة بدون SMS
  confirmStatusChangeOnly() {
    if (!this.statusSmsConfirmParcel) return;

    this.statusSmsConfirmParcel.status = this.statusSmsConfirmStatus;
    this.statusSmsConfirmParcel.updatedAt = new Date().toISOString();
    this.saveData();

    if (this.statusSmsConfirmStatus === "تم التسليم") {
      this.triggerConfetti();
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
      this.parcels = this.parcels.filter((p) => p.id !== this.deleteConfirmId);
      this.saveData([this.deleteConfirmId]);
      this.detectDuplicates();
    }
    this.showDeleteConfirm = false;
    this.deleteConfirmId = null;
  },

  // ========== Edit Parcel Methods ==========
  openEditModal(parcel) {
    this.editParcelId = parcel.id;
    this.editParcel = {
      receiver: parcel.receiver || "",
      address: parcel.address || "",
      municipality: parcel.municipality || "",
      wilaya: parcel.wilaya || "",
      phone: parcel.phone || "",
      phone2: parcel.phone2 || "",
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
      this.saveData();
      this.detectDuplicates();
    }
    this.showEditModal = false;
    this.editParcel = null;
    this.editParcelId = null;
  },



  editMunicipalitySuggestions() {
    const munis = this.uniqueMunicipalities();
    const search = (this.editParcel?.municipality || "").toLowerCase();
    if (!search) return munis;
    return munis.filter((m) => m.toLowerCase().includes(search));
  },

  addManualParcel() {
    this.parcels.forEach((p) => (p.expanded = false));
    this.parcels.unshift({
      id: Date.now(),
      ...this.newParcel,
      status: "دون إجراء",
      expanded: true,
      isUpdated: false,
      history: null,
      insertedAt: this._nowTimestamp(),
      updatedAt: new Date().toISOString(),
    });
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
    };
  },

  clearAllData() {
    this.showClearDataConfirm = true;
  },

  confirmClearAllData() {
    this.parcels = [];
    this.archive = {};
    this.sessionDate = null;
    this.importStats = {
      total: 0,
      new: 0,
      updated: 0,
      duplicates: 0,
      archived: 0,
      favorites: 0,
    };
    this.saveData();
    this.showClearDataConfirm = false;
    this.currentView = "main";
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
        (p.notes && p.notes.toLowerCase().includes(query));
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
    if (query) {
      return this.parcels.filter((p) =>
        (p.receiver && p.receiver.toLowerCase().includes(query)) ||
        (p.phone && p.phone.includes(query)) ||
        (p.phone2 && p.phone2.includes(query)) ||
        (p.tracking && p.tracking.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query))
      );
    }
    return this.parcels.filter((p) => {
      const matchesMuni =
        !this.filters.municipality ||
        p.municipality === this.filters.municipality;
      const matchesStatus =
        !this.filters.status || p.status === this.filters.status;
      const matchesTag = !this.filters.tag || p.tag === this.filters.tag;
      const matchesFav = !this.filters.favorite || this.isFavoriteParcel(p);
      return matchesMuni && matchesStatus && matchesTag && matchesFav;
    });
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
    let tagName = this.newTagInput.trim();
    if (!tagName) return;

    // إضافة @ في البداية إذا لم تكن موجودة
    if (!tagName.startsWith("@")) {
      tagName = "@" + tagName;
    }

    // التحقق من عدم التكرار
    if (!this.settings.tags.includes(tagName)) {
      this.settings.tags.push(tagName);
      this.saveSettings();
    }
    this.newTagInput = "";
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
    // إزالة التمييز من الطرود التي تستخدمه
    this.parcels.forEach((p) => {
      if (p.tag === tagName) {
        p.tag = null;
      }
    });
    this.saveData();
  },

  openTagPicker(parcelId) {
    this.tagPickerParcelId = parcelId;
    this.quickTagInput = "";
    this.showTagPicker = true;
  },

  addQuickTag() {
    let tagName = this.quickTagInput.trim();
    if (!tagName) return;

    // إضافة @ في البداية إذا لم تكن موجودة
    if (!tagName.startsWith("@")) {
      tagName = "@" + tagName;
    }

    // إضافة التمييز للإعدادات إذا لم يكن موجوداً
    if (!this.settings.tags.includes(tagName)) {
      this.settings.tags.push(tagName);
      this.saveSettings();
    }

    // تعيين التمييز للطرد مباشرة
    this.selectTagForParcel(tagName);
    this.quickTagInput = "";
  },

  selectTagForParcel(tagName) {
    const parcel = this.parcels.find((p) => p.id === this.tagPickerParcelId);
    if (parcel) {
      parcel.tag = tagName;

      parcel.updatedAt = new Date().toISOString();
      this.saveData();
    }
    this.showTagPicker = false;
    this.tagPickerParcelId = null;
  },

  removeParcelTag(parcelId) {
    const parcel = this.parcels.find((p) => p.id === parcelId);
    if (parcel) {
      parcel.tag = null;

      parcel.updatedAt = new Date().toISOString();
      this.saveData();
    }
  },

  getUsedTags() {
    const usedTags = new Set();
    this.parcels
      .filter((p) => !this.filters.municipality || p.municipality === this.filters.municipality)
      .forEach((p) => {
        if (p.tag) usedTags.add(p.tag);
      });
    return Array.from(usedTags);
  },

  filterByTag(tagName) {
    this.filters.tag = tagName;
    this.showTagsDropdown = false;
  },

  // ========== Authentication Methods ==========
  loadCurrentUser() {
    const userData = localStorage.getItem("swipex_user");
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed && parsed.email) {
        this.currentUser = parsed;
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
          localStorage.setItem("swipex_user", JSON.stringify(this.currentUser));
          console.log("✓ تم تسجيل الدخول:", user.email);

          // تفعيل المستمع الفوري (loadData سيتكفل بتحميل البيانات)
          if (!this._firestoreLoaded) {
            console.log("🔄 تفعيل المستمع الفوري...");
            this.initFirestoreListener();
            this._firestoreLoaded = true;
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
        const cloud = await firestoreSync.loadAll();
        if (cloud) {
          this.applyCloudData(cloud);
        }

        // حفظ البيانات المدمجة
        console.log("💾 حفظ البيانات المدمجة...");
        const saved = await firestoreSync.saveAll({
          parcels: this.parcels,
          settings: { ...this.settings, _sessionDate: this.sessionDate },
          archive: this.archive,
          tasks: this.tasks,
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
};
