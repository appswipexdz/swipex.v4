// ============================================
// assets/js/taskStore.js
// طبقة بيانات نظام المهام الجديد
// - نموذج المهمة (title / description / priority / status / dueDate / ...)
// - ترحيل تلقائي من شكل المهام القديم إلى الشكل الجديد
// - عمليات ناعمة (soft) حتى لا تفقد أي مهمة بالخطأ
// ملاحظة: لا يتعامل هذا الملف مع الشبكة إطلاقاً.
// الحفظ يتم عبر saveNotificationsData() في methods.js
// ============================================

(function (global) {
    "use strict";

    const STATUS = {
        PENDING: "pending",
        COMPLETED: "completed",
        DELETED: "deleted",
    };

    const PRIORITIES = [
        { value: "low", label: "منخفضة", icon: "fa-arrow-down", order: 0 },
        { value: "medium", label: "متوسطة", icon: "fa-minus", order: 1 },
        { value: "high", label: "عالية", icon: "fa-arrow-up", order: 2 },
        { value: "urgent", label: "عاجلة", icon: "fa-bolt", order: 3 },
    ];

    const PRIORITY_VALUES = PRIORITIES.map((p) => p.value);

    function nowIso() {
        return new Date().toISOString();
    }

    function str(value) {
        return typeof value === "string" ? value : value == null ? "" : String(value);
    }

    function normalizePriority(value) {
        const v = str(value).toLowerCase().trim();
        return PRIORITY_VALUES.indexOf(v) !== -1 ? v : "medium";
    }

    function normalizeStatus(value, completedFlag) {
        const v = str(value).toLowerCase().trim();
        if (v === STATUS.PENDING || v === STATUS.COMPLETED || v === STATUS.DELETED) {
            return v;
        }
        // ترحيل من الشكل القديم: completed بدون status
        return completedFlag === true ? STATUS.COMPLETED : STATUS.PENDING;
    }

    /**
     * يحوّل أي سجل مهمة (جديد أو قديم) إلى الشكل الموحّد.
     * لا يفقد أي بيانات: الحقول القديمة تُحفظ في نظائرها الجديدة.
     */
    function normalizeTask(raw) {
        const src = raw && typeof raw === "object" ? raw : {};

        const hasTitle = typeof src.title === "string" && src.title.trim() !== "";
        const legacyText = str(src.description).trim();

        // المهمة القديمة كانت تملك "description" فقط ⇒ نرفعها إلى "title"
        // ونُفرغ "description" حتى لا يتكرر النص في البطاقة.
        const title = hasTitle ? src.title.trim() : legacyText;
        const description = hasTitle ? str(src.description).trim() : "";

        const status = normalizeStatus(src.status, src.completed === true);
        const createdAt = str(src.createdAt) || nowIso();

        return {
            id: src.id != null ? src.id : Date.now() + Math.floor(Math.random() * 1000),
            title: title,
            description: description,
            priority: normalizePriority(src.priority),
            status: status,
            dueDate: str(src.dueDate),
            dueTime: str(src.dueTime) || str(src.reminderTime),
            notes: str(src.notes),
            parcelId: src.parcelId != null ? src.parcelId : null,
            tracking: str(src.tracking),
            createdAt: createdAt,
            updatedAt: str(src.updatedAt) || createdAt,
            completedAt:
                status === STATUS.COMPLETED ? str(src.completedAt) || str(src.updatedAt) || createdAt : "",
            // حقل داخلي: يمنع تكرار تذكير المهمة في نفس الدقيقة (سلوك قديم محفوظ)
            triggered: src.triggered === true,
        };
    }

    function normalizeList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(normalizeTask);
    }

    function isDeleted(task) {
        return !!task && task.status === STATUS.DELETED;
    }

    function isCompleted(task) {
        return !!task && task.status === STATUS.COMPLETED;
    }

    function isActive(task) {
        return !!task && task.status !== STATUS.DELETED;
    }

    function pendingCount(list) {
        if (!Array.isArray(list)) return 0;
        return list.filter((t) => t && t.status === STATUS.PENDING).length;
    }

    function activeList(list) {
        if (!Array.isArray(list)) return [];
        return list.filter(isActive);
    }

    function visibleList(list, filter) {
        const base = activeList(list);
        if (filter === "completed") return base.filter(isCompleted);
        if (filter === "pending") return base.filter((t) => t.status === STATUS.PENDING);
        return base;
    }

    function todayString() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + m + "-" + day;
    }

    /**
     * ترتيب العرض: غير المكتملة أولاً، ثم الأحدث موعداً، ثم الأحدث إنشاءً.
     * completedAt / dueDate غير مضبوطة تُدفع لآخر القائمة.
     */
    function sortForDisplay(list) {
        const weight = { urgent: 3, high: 2, medium: 1, low: 0 };
        return list.slice().sort((a, b) => {
            const ac = a.status === STATUS.COMPLETED ? 1 : 0;
            const bc = b.status === STATUS.COMPLETED ? 1 : 0;
            if (ac !== bc) return ac - bc;

            const ad = a.dueDate || "9999-99-99";
            const bd = b.dueDate || "9999-99-99";
            if (ad !== bd) return ad < bd ? -1 : 1;

            const at = a.dueTime || "99:99";
            const bt = b.dueTime || "99:99";
            if (at !== bt) return at < bt ? -1 : 1;

            const ap = (weight[a.priority] || 0) - (weight[b.priority] || 0);
            if (ap !== 0) return -ap;

            return str(b.createdAt) < str(a.createdAt) ? -1 : 1;
        });
    }

    function createTask(input) {
        const src = input && typeof input === "object" ? input : {};
        const task = normalizeTask({
            id: Date.now() + Math.floor(Math.random() * 1000),
            title: src.title,
            description: src.description,
            priority: src.priority,
            status: STATUS.PENDING,
            dueDate: src.dueDate,
            dueTime: src.dueTime,
            notes: src.notes,
            parcelId: src.parcelId,
            tracking: src.tracking,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            triggered: false,
        });
        return task;
    }

    function markCompleted(task) {
        if (!task) return task;
        task.status = STATUS.COMPLETED;
        task.completedAt = nowIso();
        task.updatedAt = task.completedAt;
        task.triggered = false;
        return task;
    }

    function markPending(task) {
        if (!task) return task;
        task.status = STATUS.PENDING;
        task.completedAt = "";
        task.updatedAt = nowIso();
        return task;
    }

    function toggleCompleted(task) {
        return isCompleted(task) ? markPending(task) : markCompleted(task);
    }

    function markDeleted(task) {
        if (!task) return task;
        task.status = STATUS.DELETED;
        task.updatedAt = nowIso();
        return task;
    }

    function restore(task) {
        if (!task) return task;
        task.status = isCompleted(task) ? STATUS.COMPLETED : STATUS.PENDING;
        task.updatedAt = nowIso();
        return task;
    }

    function findById(list, id) {
        if (!Array.isArray(list)) return null;
        return list.find((t) => t && String(t.id) === String(id)) || null;
    }

    function findByTracking(list, tracking) {
        const q = str(tracking).trim().toLowerCase();
        if (!q) return [];
        if (!Array.isArray(list)) return [];
        return list.filter(
            (t) => t && isActive(t) && str(t.tracking).trim().toLowerCase().indexOf(q) !== -1
        );
    }

    function isOverdue(task) {
        if (!task || task.status !== STATUS.PENDING) return false;
        if (!task.dueDate) return false;
        return task.dueDate < todayString();
    }

    function isDueToday(task) {
        return !!task && task.status === STATUS.PENDING && task.dueDate === todayString();
    }

    function priorityMeta(value) {
        return (
            PRIORITIES.find((p) => p.value === normalizePriority(value)) || PRIORITIES[1]
        );
    }

    global.taskStore = {
        STATUS: STATUS,
        PRIORITIES: PRIORITIES,
        normalizeTask: normalizeTask,
        normalizeList: normalizeList,
        isDeleted: isDeleted,
        isCompleted: isCompleted,
        isActive: isActive,
        isOverdue: isOverdue,
        isDueToday: isDueToday,
        pendingCount: pendingCount,
        activeList: activeList,
        visibleList: visibleList,
        sortForDisplay: sortForDisplay,
        priorityMeta: priorityMeta,
        findById: findById,
        findByTracking: findByTracking,
        createTask: createTask,
        markCompleted: markCompleted,
        markPending: markPending,
        toggleCompleted: toggleCompleted,
        markDeleted: markDeleted,
        restore: restore,
        todayString: todayString,
    };
})(typeof window !== "undefined" ? window : globalThis);
