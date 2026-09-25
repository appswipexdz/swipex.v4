// ============================================
// assets/js/tasks.js
// منطق صفحة المهام الجديدة (tasks.html)
// - بطاقات مهام بتصميم SwiPex
// - Swipe Right  => إكمال المهمة
// - Swipe Left   => إظهار شريط تأكيد الحذف (حماية من الحذف العرضي + استرجاع)
// - نموذج كامل: العنوان/الوصف/الأولوية/الحالة/التاريخ/الوقت/الملاحظات/الطرد
// - الحفظ عبر saveNotificationsData() (نفس مسار التخزين والمزامنة القائم)
// ============================================

(function (global) {
    "use strict";

    const TS = global.taskStore;
    const SWIPE_THRESHOLD = 72;

    function todayStr() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + m + "-" + day;
    }

    const BLANK = () => ({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        dueTime: "",
        notes: "",
        parcelId: null,
        tracking: "",
    });

    global.tasksFeature = {
        // ---------- حالة الصفحة ----------
        data() {
            return {
                taskFilter: "all", // all | pending | completed
                taskSearch: "",
                // تركيز: عند فتح تذكير مهمة من الإشعارات نعرض تلك المهمة وحدها
                taskFocusId: null,
                showTaskComposer: false,
                editingTaskId: null,
                draft: BLANK(),
                // Swipe
                swipeId: null,
                swipeX: 0,
                swipeDragging: false,
                swipeExiting: null, // { id, dir: 'complete' | 'delete' }
                flashId: null,
                // شريط تأكيد الحذف
                deleteArmedId: null,
                undoSnapshot: null,
                showUndo: false,
                // ربط بطرد
                linkParcelQuery: "",
                showParcelPicker: false,
                // سلة المحذوفات
                showTrash: false,
            };
        },

        computed: {
            taskStore() {
                return TS;
            },
            // --- القائمة المعروضة ---
            taskList() {
                let list = TS.visibleList(this.tasks, this.taskFilter);
                const q = String(this.taskSearch || "").trim().toLowerCase();
                if (q) {
                    list = list.filter((t) =>
                        [t.title, t.description, t.notes, t.tracking]
                            .join(" ")
                            .toLowerCase()
                            .indexOf(q) !== -1
                    );
                }
                // تركيز على مهمة واحدة (من إشعار التذكير)
                if (this.taskFocusId != null && this.taskFocusId !== "") {
                    const id = String(this.taskFocusId);
                    const only = list.filter((t) => String(t.id) === id);
                    if (only.length) return TS.sortForDisplay(only);
                }
                return TS.sortForDisplay(list);
            },
            focusedTask() {
                if (this.taskFocusId == null || this.taskFocusId === "") return null;
                return TS.findById(this.tasks || [], this.taskFocusId) || null;
            },
            taskCounts() {
                const all = TS.activeList(this.tasks);
                return {
                    all: all.length,
                    pending: all.filter((t) => t.status === TS.STATUS.PENDING).length,
                    completed: all.filter((t) => t.status === TS.STATUS.COMPLETED).length,
                };
            },
            // --- سلة المحذوفات ---
            deletedTasks() {
                return (this.tasks || [])
                    .filter((t) => TS.isDeleted(t))
                    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
            },
            deletedTasksCount() {
                return this.deletedTasks.length;
            },
            // --- النموذج ---
            composerTitle() {
                return this.editingTaskId ? "تعديل المهمة" : "مهمة جديدة";
            },
            isEditing() {
                return !!this.editingTaskId;
            },
            canSaveTask() {
                return String(this.draft.title || "").trim() !== "";
            },
            // --- ربط الطرد ---
            parcelOptions() {
                const q = String(this.linkParcelQuery || "").trim().toLowerCase();
                let list = this.parcels || [];
                if (q) {
                    list = list.filter((p) =>
                        [p.tracking, p.receiver, p.phone]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase()
                            .indexOf(q) !== -1
                    );
                }
                return list.slice(0, 40);
            },
            linkedParcel() {
                if (!this.draft.parcelId && !this.draft.tracking) return null;
                const id = this.draft.parcelId;
                if (id != null) {
                    const p = (this.parcels || []).find((x) => x.id === id);
                    if (p) return p;
                }
                const tr = String(this.draft.tracking || "").trim().toLowerCase();
                if (!tr) return null;
                return (this.parcels || []).find(
                    (x) => String(x.tracking || "").trim().toLowerCase() === tr
                ) || null;
            },
        },

        methods: {
            // ---------- التركيز على مهمة ----------
            // تُستدعى عند الضغط على إشعار "تذكير بمهمة"
            focusTaskById(id) {
                if (id == null) return false;
                this.taskFocusId = id;
                this.taskFilter = "all";
                this.taskSearch = "";
                return true;
            },
            clearTaskFocus() {
                this.taskFocusId = null;
            },

            // ---------- إنشاء مهمة من زر التذكير (الساعة) في بطاقة الطرد ----------
            openParcelTask(parcelId) {
                const parcel = (this.parcels || []).find((p) => p.id === parcelId);
                if (!parcel) return false;

                this.reminderPickerParcelId = parcelId;
                this.editingTaskId = null;
                this.draft = BLANK();

                // ربط تلقائي بالطرد
                this.draft.parcelId = parcel.id;
                this.draft.tracking = parcel.tracking || "";

                // عنوان مقترح من بيانات الطرد
                const who = parcel.receiver || "";
                this.draft.title = who
                    ? "متابعة الطرد " + parcel.tracking + " — " + who
                    : "متابعة الطرد " + (parcel.tracking || "");

                // وصف مبدئي من ملاحظات الطرد
                if (parcel.notes) this.draft.description = String(parcel.notes);

                // الموعد: تذكير الطرد الحالي أو الآن، مع تاريخ اليوم
                let hh = null, mm = "00";
                if (parcel.reminderTime) {
                    const parts = String(parcel.reminderTime).split(":");
                    hh = parts[0];
                    mm = parts[1] || "00";
                } else {
                    const now = new Date();
                    hh = now.getHours().toString().padStart(2, "0");
                    mm = now.getMinutes().toString().padStart(2, "0");
                }
                this.reminderTime = { hour: hh, minute: mm };
                this.draft.dueTime = hh + ":" + mm;
                this.draft.dueDate = todayStr();

                this.linkParcelQuery = parcel.tracking || "";
                this.showParcelPicker = false;
                this.showTaskComposer = true;
                return true;
            },

            // ---------- حفظ طعام التذكير على الطرد (عرض فقط) ----------
            // التذكير نفسه هو المهمة، والمهمة هي التي تُطلق الإشعار
            // حتى لا يتكرر الإشعار مرتين (طرد + مهمة).
            syncParcelReminderDisplay(parcelId, time) {
                const parcel = (this.parcels || []).find((p) => p.id === parcelId);
                if (!parcel) return;
                parcel.reminderTime = time || null;
                parcel.reminderTriggered = true; // التفعيل الآن من جهة المهمة
                if (typeof this.markParcelDirty === "function") this.markParcelDirty(parcel);
                if (typeof this.saveData === "function") this.saveData();
            },

            // ---------- الحفظ ----------
            persistTasks() {
                this.tasks = TS.normalizeList(this.tasks);
                if (typeof this.saveNotificationsData === "function") {
                    this.saveNotificationsData();
                }
            },

            // ---------- إنشاء / تعديل ----------
            openNewTask() {
                this.editingTaskId = null;
                this.draft = BLANK();
                this.linkParcelQuery = "";
                this.showParcelPicker = false;
                this.showTaskComposer = true;
            },
            openEditTask(task) {
                this.editingTaskId = task.id;
                this.draft = {
                    title: task.title || "",
                    description: task.description || "",
                    priority: task.priority || "medium",
                    dueDate: task.dueDate || "",
                    dueTime: task.dueTime || "",
                    notes: task.notes || "",
                    parcelId: task.parcelId != null ? task.parcelId : null,
                    tracking: task.tracking || "",
                };
                this.linkParcelQuery = task.tracking || "";
                this.showParcelPicker = false;
                this.showTaskComposer = true;
            },
            closeComposer() {
                this.showTaskComposer = false;
                this.editingTaskId = null;
                this.draft = BLANK();
                this.reminderPickerParcelId = null;
            },
            saveTask() {
                if (!this.canSaveTask) {
                    this.showToast("اكتب عنوان المهمة أولاً", "warning");
                    return;
                }
                const payload = Object.assign({}, this.draft, {
                    tracking: this.linkedParcel ? this.linkedParcel.tracking : this.draft.tracking,
                    parcelId: this.linkedParcel ? this.linkedParcel.id : this.draft.parcelId,
                });

                if (this.isEditing) {
                    const existing = TS.findById(this.tasks, this.editingTaskId);
                    if (existing) {
                        existing.title = String(payload.title).trim();
                        existing.description = String(payload.description || "").trim();
                        existing.priority = payload.priority;
                        existing.dueDate = payload.dueDate;
                        existing.dueTime = payload.dueTime;
                        existing.notes = String(payload.notes || "").trim();
                        existing.parcelId = payload.parcelId;
                        existing.tracking = payload.tracking || "";
                        existing.updatedAt = new Date().toISOString();
                        // إعادة ضبط علم التذكير عند تغيّر الموعد
                        existing.triggered = false;
                        this.persistTasks();
                        this.showToast("تم تحديث المهمة", "success");
                    }
                } else {
                    this.tasks.unshift(TS.createTask(payload));
                    this.persistTasks();
                    this.showToast("تمت إضافة المهمة", "success");
                }

                // إن كانت المهمة أُنشئت من زر التذكير في بطاقة طرد:
                // نحدّث وقت التذكير على الطرد (للعرض فقط) لأن التفعيل يتم عبر المهمة
                if (this.reminderPickerParcelId != null && payload.parcelId != null) {
                    this.syncParcelReminderDisplay(payload.parcelId, payload.dueTime);
                }

                this.closeComposer();
            },
            deleteTaskPermanently(task) {
                this.tasks = this.tasks.filter((t) => String(t.id) !== String(task.id));
                this.persistTasks();
            },
            emptyTrashTasks() {
                this.tasks = this.tasks.filter((t) => !TS.isDeleted(t));
                this.persistTasks();
                this.showToast("تم إفراغ سلة المحذوفات", "success");
            },
            restoreTask(task) {
                TS.restore(task);
                this.persistTasks();
                this.showToast("تم استرجاع المهمة", "success");
            },

            // ---------- إكمال / إرجاع ----------
            setTaskCompleted(task, completed) {
                if (completed) {
                    TS.markCompleted(task);
                } else {
                    TS.markPending(task);
                }
                this.persistTasks();
            },
            toggleTask(task) {
                this.setTaskCompleted(task, !TS.isCompleted(task));
            },
            undoTaskAction() {
                if (!this.undoSnapshot) return;
                this.tasks = this.undoSnapshot;
                this.undoSnapshot = null;
                this.showUndo = false;
                this.persistTasks();
                this.showToast("تم التراجع", "info");
            },
            snapshotForUndo() {
                this.undoSnapshot = JSON.parse(JSON.stringify(this.tasks || []));
                this.showUndo = true;
                clearTimeout(this._undoTimer);
                this._undoTimer = setTimeout(() => {
                    this.showUndo = false;
                    this.undoSnapshot = null;
                }, 6000);
            },

            // ---------- Swipe ----------
            onTaskTouchStart(e, task) {
                if (this.swipeExiting) return;
                const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
                if (!t) return;
                this._swipeStartX = t.clientX;
                this._swipeStartY = t.clientY;
                this.swipeId = task.id;
                this.swipeX = 0;
                this.swipeDragging = true;
                // إلغاء أي تأكيد حذف معلق عند بدء سحب جديد
                if (this.deleteArmedId && String(this.deleteArmedId) !== String(task.id)) {
                    this.deleteArmedId = null;
                }
            },
            onTaskTouchMove(e) {
                if (!this.swipeDragging || this.swipeId == null) return;
                const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
                if (!t) return;
                const dx = t.clientX - this._swipeStartX;
                const dy = t.clientY - this._swipeStartY;
                // السحب العمودي يبقى للتمرير الطبيعي
                if (Math.abs(dy) > Math.abs(dx)) {
                    this.swipeDragging = false;
                    this.swipeId = null;
                    this.swipeX = 0;
                    return;
                }
                if (e.cancelable) e.preventDefault();
                this.swipeX = dx;
            },
            onTaskTouchEnd(e, task) {
                if (!this.swipeDragging || String(this.swipeId) !== String(task.id)) return;
                this.swipeDragging = false;
                this.swipeId = null;
                const dx = this.swipeX;
                this.swipeX = 0;

                if (dx > SWIPE_THRESHOLD) {
                    this.completeBySwipe(task);
                } else if (dx < -SWIPE_THRESHOLD) {
                    this.armDelete(task);
                }
            },
            onTaskTouchCancel() {
                this.swipeDragging = false;
                this.swipeId = null;
                this.swipeX = 0;
            },

            // ---------- تنفيذ إجراءات السحب ----------
            completeBySwipe(task) {
                this.snapshotForUndo();
                this.swipeExiting = { id: task.id, dir: "complete" };
                this.flashId = task.id;
                setTimeout(() => {
                    this.setTaskCompleted(task, true);
                    this.swipeExiting = null;
                    this.flashId = null;
                    this.showToast("تم إكمال المهمة", "success");
                    this._undoTimer2 = setTimeout(() => {
                        this.showUndo = false;
                        this.undoSnapshot = null;
                    }, 5000);
                }, 240);
            },
            // Swipe Left لا يحذف فوراً: يطلب تأكيداً صريحاً
            armDelete(task) {
                this.deleteArmedId = task.id;
                clearTimeout(this._armTimer);
                this._armTimer = setTimeout(() => {
                    this.deleteArmedId = null;
                }, 6000);
            },
            confirmDeleteTask(task) {
                this.snapshotForUndo();
                this.deleteArmedId = null;
                this.swipeExiting = { id: task.id, dir: "delete" };
                setTimeout(() => {
                    TS.markDeleted(task);
                    this.swipeExiting = null;
                    this.persistTasks();
                    this.showToast("تم حذف المهمة", "info");
                }, 240);
            },
            cancelDelete() {
                this.deleteArmedId = null;
            },

            // ---------- عرض ----------
            taskSwipeStyle(task) {
                if (this.swipeExiting && String(this.swipeExiting.id) === String(task.id)) return {};
                if (this.swipeDragging && String(this.swipeId) === String(task.id)) {
                    return { transform: "translateX(" + this.swipeX + "px)" };
                }
                return { transform: "translateX(0)" };
            },
            taskSwipeState(task) {
                if (this.swipeDragging && String(this.swipeId) === String(task.id)) {
                    if (this.swipeX > 10) return "right";
                    if (this.swipeX < -10) return "left";
                }
                return null;
            },
            taskCompleteProgress(task) {
                if (!this.swipeDragging || String(this.swipeId) !== String(task.id)) return 0;
                return Math.min(1, Math.max(0, this.swipeX / SWIPE_THRESHOLD));
            },
            taskDeleteProgress(task) {
                if (!this.swipeDragging || String(this.swipeId) !== String(task.id)) return 0;
                return Math.min(1, Math.max(0, -this.swipeX / SWIPE_THRESHOLD));
            },
            isExiting(task, dir) {
                return !!this.swipeExiting && String(this.swipeExiting.id) === String(task.id) && this.swipeExiting.dir === dir;
            },
            priorityMeta(v) {
                return TS.priorityMeta(v);
            },
            isOverdue(task) {
                return TS.isOverdue(task);
            },
            isDueToday(task) {
                return TS.isDueToday(task);
            },
            formatTaskDate(value) {
                if (!value) return "";
                if (typeof this.formatDate === "function") {
                    try {
                        return this.formatDate(value);
                    } catch (e) {
                        /* fallback */
                    }
                }
                return String(value);
            },
            goToLinkedParcel(task) {
                if (!task.tracking) return;
                this.filters.search = task.tracking;
                this.filters.municipality = "";
                this.filters.status = "";
                this.filters.tag = "";
                if (typeof this.saveFilters === "function") this.saveFilters();
                window.location.href = "index.html";
            },

            // ---------- ربط طرد ----------
            toggleParcelPicker() {
                this.showParcelPicker = !this.showParcelPicker;
                if (this.showParcelPicker) this.$nextTick(() => this.$refs.parcelSearch && this.$refs.parcelSearch.focus());
            },
            pickParcel(p) {
                this.draft.parcelId = p.id;
                this.draft.tracking = p.tracking;
                this.linkParcelQuery = p.tracking;
                this.showParcelPicker = false;
            },
            clearParcelLink() {
                this.draft.parcelId = null;
                this.draft.tracking = "";
                this.linkParcelQuery = "";
            },
        },

        mounted() {
            // زر + العائم في صفحة المهام ⇒ إنشاء مهمة مباشرة
            this._newTaskHandler = () => this.openNewTask();
            global.addEventListener("swipex:new-task", this._newTaskHandler);
        },

        beforeUnmount() {
            if (this._newTaskHandler) {
                global.removeEventListener("swipex:new-task", this._newTaskHandler);
            }
        },
    };
})(typeof window !== "undefined" ? window : globalThis);
