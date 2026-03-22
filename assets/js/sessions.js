/**
 * ═══════════════════════════════════════════════════════════════
 * 📋 SwiPex Pro - نظام الجلسات التعاونية (Collaborative Sessions)
 * ═══════════════════════════════════════════════════════════════
 * 
 * نظام متقدم لمشاركة الطرود والعمل التعاوني في الوقت الفعلي
 * 
 * الميزات:
 * - إنشاء جلسات عمل مشتركة
 * - دعوة مستخدمين عبر البريد الإلكتروني
 * - مزامنة فورية للتحديثات
 * - نظام صلاحيات متقدم
 * - تتبع المستخدمين النشطين
 * - سجل التغييرات والنشاطات
 * 
 * @version 1.0.1
 * @date 2026-03-22
 */

// توفير db و auth من النطاق العام
const db = firebase.firestore();
const auth = firebase.auth();

// استخدام دوال Firestore من النطاق العام
const collection = (dbRef, path, ...pathSegments) => dbRef.collection(path, ...pathSegments);
const doc = (dbRef, path, ...pathSegments) => dbRef.doc(path, ...pathSegments);
const getDoc = (ref) => ref.get();
const getDocs = (ref) => ref.get();
const setDoc = (ref, data) => ref.set(data);
const updateDoc = (ref, data) => ref.update(data);
const deleteDoc = (ref) => ref.delete();
const query = (ref, ...queryConstraints) => ref.where(...queryConstraints);
const where = (field, op, value) => db.where(field, op, value);
const orderBy = (field, direction) => db.orderBy(field, direction);
const onSnapshot = (ref, onNext, onError) => ref.onSnapshot(onNext, onError);
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const arrayUnion = (...elements) => firebase.firestore.FieldValue.arrayUnion(...elements);
const arrayRemove = (...elements) => firebase.firestore.FieldValue.arrayRemove(...elements);
const Timestamp = firebase.firestore.Timestamp;

// ═══════════════════════════════════════════════════════════════
// 🔧 متغيرات عامة
// ═══════════════════════════════════════════════════════════════

let activeSessionListeners = {}; // مستمعي الجلسات النشطة
let presenceInterval = null; // فاصل تحديث الحضور

// ═══════════════════════════════════════════════════════════════
// 📝 إنشاء وإدارة الجلسات
// ═══════════════════════════════════════════════════════════════

/**
 * إنشاء جلسة عمل جديدة
 * @param {Object} sessionData - بيانات الجلسة
 * @returns {Promise<string>} - معرف الجلسة
 */
async function createSession(sessionData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // إنشاء معرف فريد للجلسة
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // بيانات الجلسة الأساسية
    const session = {
      id: sessionId,
      name: sessionData.name || 'جلسة عمل جديدة',
      description: sessionData.description || '',
      createdBy: user.email,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active', // active, paused, ended, archived
      
      // الفلاتر المطبقة
      filters: sessionData.filters || {},
      
      // إحصائيات
      stats: {
        totalParcels: 0,
        deliveredParcels: 0,
        pendingParcels: 0,
        participantsCount: 1
      },
      
      // الإعدادات
      settings: {
        allowInvite: sessionData.allowInvite !== false,
        autoSync: sessionData.autoSync !== false,
        notifyOnChanges: sessionData.notifyOnChanges !== false,
        lockTimeout: sessionData.lockTimeout || 120000 // 2 دقيقة
      }
    };

    // حفظ الجلسة في Firestore
    const sessionRef = doc(db, 'sessions', sessionId);
    await setDoc(sessionRef, session);

    // إضافة المنشئ كمشارك بصلاحيات كاملة
    await addParticipant(sessionId, {
      email: user.email,
      uid: user.uid,
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || null,
      role: 'owner', // owner, admin, editor, viewer
      joinedAt: serverTimestamp(),
      isOnline: true,
      lastSeen: serverTimestamp(),
      stats: {
        delivered: 0,
        updated: 0,
        added: 0
      }
    });

    // إضافة الطرود المحددة
    if (sessionData.parcels && sessionData.parcels.length > 0) {
      await addParcelsToSession(sessionId, sessionData.parcels);
    }

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'session_created',
      userId: user.uid,
      userEmail: user.email,
      details: { sessionName: session.name }
    });

    console.log('✅ تم إنشاء الجلسة بنجاح:', sessionId);
    return sessionId;

  } catch (error) {
    console.error('❌ خطأ في إنشاء الجلسة:', error);
    throw error;
  }
}

/**
 * الحصول على بيانات جلسة
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<Object>} - بيانات الجلسة
 */
async function getSession(sessionId) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      throw new Error('الجلسة غير موجودة');
    }

    return { id: sessionSnap.id, ...sessionSnap.data() };
  } catch (error) {
    console.error('❌ خطأ في جلب بيانات الجلسة:', error);
    throw error;
  }
}

/**
 * تحديث بيانات جلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {Object} updates - التحديثات
 */
async function updateSession(sessionId, updates) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('✅ تم تحديث الجلسة بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تحديث الجلسة:', error);
    throw error;
  }
}

/**
 * حذف جلسة
 * @param {string} sessionId - معرف الجلسة
 */
async function deleteSession(sessionId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // التحقق من الصلاحيات
    const participant = await getParticipant(sessionId, user.uid);
    if (participant.role !== 'owner') {
      throw new Error('ليس لديك صلاحية حذف هذه الجلسة');
    }

    // حذف جميع البيانات الفرعية
    const parcelsRef = collection(db, 'sessions', sessionId, 'parcels');
    const parcelsSnap = await getDocs(parcelsRef);
    for (const parcelDoc of parcelsSnap.docs) {
      await deleteDoc(parcelDoc.ref);
    }

    const participantsRef = collection(db, 'sessions', sessionId, 'participants');
    const participantsSnap = await getDocs(participantsRef);
    for (const participantDoc of participantsSnap.docs) {
      await deleteDoc(participantDoc.ref);
    }

    const activityRef = collection(db, 'sessions', sessionId, 'activity');
    const activitySnap = await getDocs(activityRef);
    for (const activityDoc of activitySnap.docs) {
      await deleteDoc(activityDoc.ref);
    }

    // حذف الجلسة نفسها
    const sessionRef = doc(db, 'sessions', sessionId);
    await deleteDoc(sessionRef);

    console.log('✅ تم حذف الجلسة بنجاح');
  } catch (error) {
    console.error('❌ خطأ في حذف الجلسة:', error);
    throw error;
  }
}

/**
 * الحصول على جميع جلسات المستخدم
 * @returns {Promise<Array>} - قائمة الجلسات
 */
async function getUserSessions() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const sessions = [];
    
    // البحث في جميع الجلسات التي المستخدم مشارك فيها
    const sessionsRef = collection(db, 'sessions');
    const sessionsSnap = await getDocs(sessionsRef);

    for (const sessionDoc of sessionsSnap.docs) {
      const participantRef = doc(db, 'sessions', sessionDoc.id, 'participants', user.uid);
      const participantSnap = await getDoc(participantRef);
      
      if (participantSnap.exists()) {
        sessions.push({
          id: sessionDoc.id,
          ...sessionDoc.data(),
          myRole: participantSnap.data().role
        });
      }
    }

    // ترتيب حسب آخر تحديث
    sessions.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis() || 0;
      const bTime = b.updatedAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return sessions;
  } catch (error) {
    console.error('❌ خطأ في جلب الجلسات:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 👥 إدارة المشاركين
// ═══════════════════════════════════════════════════════════════

/**
 * إضافة مشارك للجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {Object} participantData - بيانات المشارك
 */
async function addParticipant(sessionId, participantData) {
  try {
    const participantRef = doc(db, 'sessions', sessionId, 'participants', participantData.uid);
    await setDoc(participantRef, {
      ...participantData,
      joinedAt: participantData.joinedAt || serverTimestamp(),
      isOnline: true,
      lastSeen: serverTimestamp()
    });

    // تحديث عداد المشاركين
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      'stats.participantsCount': arrayUnion(participantData.uid).length
    });

    console.log('✅ تم إضافة المشارك بنجاح');
  } catch (error) {
    console.error('❌ خطأ في إضافة المشارك:', error);
    throw error;
  }
}

/**
 * دعوة مستخدم للجلسة عبر البريد الإلكتروني
 * @param {string} sessionId - معرف الجلسة
 * @param {string} email - البريد الإلكتروني
 * @param {string} role - الدور (editor, viewer)
 */
async function inviteUser(sessionId, email, role = 'editor') {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // التحقق من الصلاحيات
    const participant = await getParticipant(sessionId, user.uid);
    if (!['owner', 'admin'].includes(participant.role)) {
      throw new Error('ليس لديك صلاحية دعوة مستخدمين');
    }

    // إنشاء دعوة
    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const inviteRef = doc(db, 'sessions', sessionId, 'invites', inviteId);
    
    await setDoc(inviteRef, {
      id: inviteId,
      email: email.toLowerCase(),
      role: role,
      invitedBy: user.email,
      invitedByUid: user.uid,
      invitedAt: serverTimestamp(),
      status: 'pending', // pending, accepted, rejected, expired
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 أيام
    });

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'user_invited',
      userId: user.uid,
      userEmail: user.email,
      details: { invitedEmail: email, role }
    });

    // TODO: إرسال بريد إلكتروني للمدعو
    // يمكن استخدام Firebase Cloud Functions أو خدمة خارجية

    console.log('✅ تم إرسال الدعوة بنجاح');
    return inviteId;
  } catch (error) {
    console.error('❌ خطأ في دعوة المستخدم:', error);
    throw error;
  }
}

/**
 * قبول دعوة للانضمام لجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {string} inviteId - معرف الدعوة
 */
async function acceptInvite(sessionId, inviteId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // جلب بيانات الدعوة
    const inviteRef = doc(db, 'sessions', sessionId, 'invites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (!inviteSnap.exists()) {
      throw new Error('الدعوة غير موجودة');
    }

    const invite = inviteSnap.data();
    
    // التحقق من البريد الإلكتروني
    if (invite.email !== user.email.toLowerCase()) {
      throw new Error('هذه الدعوة ليست لك');
    }

    // التحقق من انتهاء الصلاحية
    if (invite.expiresAt.toMillis() < Date.now()) {
      throw new Error('انتهت صلاحية الدعوة');
    }

    // إضافة المستخدم كمشارك
    await addParticipant(sessionId, {
      email: user.email,
      uid: user.uid,
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || null,
      role: invite.role,
      stats: {
        delivered: 0,
        updated: 0,
        added: 0
      }
    });

    // تحديث حالة الدعوة
    await updateDoc(inviteRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'user_joined',
      userId: user.uid,
      userEmail: user.email,
      details: { inviteId }
    });

    console.log('✅ تم قبول الدعوة والانضمام للجلسة');
  } catch (error) {
    console.error('❌ خطأ في قبول الدعوة:', error);
    throw error;
  }
}

/**
 * الحصول على بيانات مشارك
 * @param {string} sessionId - معرف الجلسة
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - بيانات المشارك
 */
async function getParticipant(sessionId, userId) {
  try {
    const participantRef = doc(db, 'sessions', sessionId, 'participants', userId);
    const participantSnap = await getDoc(participantRef);
    
    if (!participantSnap.exists()) {
      throw new Error('المشارك غير موجود');
    }

    return { id: participantSnap.id, ...participantSnap.data() };
  } catch (error) {
    console.error('❌ خطأ في جلب بيانات المشارك:', error);
    throw error;
  }
}

/**
 * الحصول على جميع المشاركين في الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<Array>} - قائمة المشاركين
 */
async function getParticipants(sessionId) {
  try {
    const participantsRef = collection(db, 'sessions', sessionId, 'participants');
    const participantsSnap = await getDocs(participantsRef);
    
    const participants = [];
    participantsSnap.forEach(doc => {
      participants.push({ id: doc.id, ...doc.data() });
    });

    return participants;
  } catch (error) {
    console.error('❌ خطأ في جلب المشاركين:', error);
    throw error;
  }
}

/**
 * تحديث دور مشارك
 * @param {string} sessionId - معرف الجلسة
 * @param {string} userId - معرف المستخدم
 * @param {string} newRole - الدور الجديد
 */
async function updateParticipantRole(sessionId, userId, newRole) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // التحقق من الصلاحيات
    const participant = await getParticipant(sessionId, user.uid);
    if (!['owner', 'admin'].includes(participant.role)) {
      throw new Error('ليس لديك صلاحية تعديل الأدوار');
    }

    const participantRef = doc(db, 'sessions', sessionId, 'participants', userId);
    await updateDoc(participantRef, { role: newRole });

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'role_changed',
      userId: user.uid,
      userEmail: user.email,
      details: { targetUserId: userId, newRole }
    });

    console.log('✅ تم تحديث دور المشارك بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تحديث دور المشارك:', error);
    throw error;
  }
}

/**
 * إزالة مشارك من الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {string} userId - معرف المستخدم
 */
async function removeParticipant(sessionId, userId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // التحقق من الصلاحيات
    const participant = await getParticipant(sessionId, user.uid);
    if (!['owner', 'admin'].includes(participant.role) && user.uid !== userId) {
      throw new Error('ليس لديك صلاحية إزالة المشاركين');
    }

    const participantRef = doc(db, 'sessions', sessionId, 'participants', userId);
    await deleteDoc(participantRef);

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: user.uid === userId ? 'user_left' : 'user_removed',
      userId: user.uid,
      userEmail: user.email,
      details: { removedUserId: userId }
    });

    console.log('✅ تم إزالة المشارك بنجاح');
  } catch (error) {
    console.error('❌ خطأ في إزالة المشارك:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📦 إدارة الطرود في الجلسة
// ═══════════════════════════════════════════════════════════════

/**
 * إضافة طرود للجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {Array} parcels - قائمة الطرود
 */
async function addParcelsToSession(sessionId, parcels) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    let addedCount = 0;

    for (const parcel of parcels) {
      const parcelRef = doc(db, 'sessions', sessionId, 'parcels', parcel.id || parcel.tracking);
      await setDoc(parcelRef, {
        ...parcel,
        addedBy: user.email,
        addedByUid: user.uid,
        addedAt: serverTimestamp(),
        lastModifiedBy: user.email,
        lastModifiedByUid: user.uid,
        lastModifiedAt: serverTimestamp(),
        lockedBy: null,
        lockedAt: null
      });
      addedCount++;
    }

    // تحديث الإحصائيات
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const currentStats = sessionSnap.data().stats || {};
    
    await updateDoc(sessionRef, {
      'stats.totalParcels': (currentStats.totalParcels || 0) + addedCount,
      'stats.pendingParcels': (currentStats.pendingParcels || 0) + addedCount
    });

    // تحديث إحصائيات المشارك
    const participantRef = doc(db, 'sessions', sessionId, 'participants', user.uid);
    const participantSnap = await getDoc(participantRef);
    const participantStats = participantSnap.data().stats || {};
    
    await updateDoc(participantRef, {
      'stats.added': (participantStats.added || 0) + addedCount
    });

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'parcels_added',
      userId: user.uid,
      userEmail: user.email,
      details: { count: addedCount }
    });

    console.log(`✅ تم إضافة ${addedCount} طرد للجلسة`);
  } catch (error) {
    console.error('❌ خطأ في إضافة الطرود:', error);
    throw error;
  }
}

/**
 * تحديث طرد في الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {string} parcelId - معرف الطرد
 * @param {Object} updates - التحديثات
 */
async function updateSessionParcel(sessionId, parcelId, updates) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // التحقق من الصلاحيات
    const participant = await getParticipant(sessionId, user.uid);
    if (participant.role === 'viewer') {
      throw new Error('ليس لديك صلاحية تعديل الطرود');
    }

    // التحقق من القفل
    const parcelRef = doc(db, 'sessions', sessionId, 'parcels', parcelId);
    const parcelSnap = await getDoc(parcelRef);
    const parcel = parcelSnap.data();

    if (parcel.lockedBy && parcel.lockedBy !== user.uid) {
      const lockTime = parcel.lockedAt?.toMillis() || 0;
      const now = Date.now();
      const lockTimeout = 120000; // 2 دقيقة

      if (now - lockTime < lockTimeout) {
        throw new Error('هذا الطرد قيد التعديل من مستخدم آخر');
      }
    }

    // تحديث الطرد
    await updateDoc(parcelRef, {
      ...updates,
      lastModifiedBy: user.email,
      lastModifiedByUid: user.uid,
      lastModifiedAt: serverTimestamp(),
      lockedBy: null,
      lockedAt: null
    });

    // تحديث الإحصائيات إذا تغيرت الحالة
    if (updates.status) {
      await updateSessionStats(sessionId, parcel.status, updates.status);
    }

    // تحديث إحصائيات المشارك
    const participantRef = doc(db, 'sessions', sessionId, 'participants', user.uid);
    const participantSnap = await getDoc(participantRef);
    const participantStats = participantSnap.data().stats || {};
    
    await updateDoc(participantRef, {
      'stats.updated': (participantStats.updated || 0) + 1,
      ...(updates.status === 'تم التسليم ✓' && {
        'stats.delivered': (participantStats.delivered || 0) + 1
      })
    });

    // تسجيل النشاط
    await logActivity(sessionId, {
      type: 'parcel_updated',
      userId: user.uid,
      userEmail: user.email,
      parcelId: parcelId,
      details: { updates }
    });

    console.log('✅ تم تحديث الطرد بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تحديث الطرد:', error);
    throw error;
  }
}

/**
 * قفل طرد للتعديل
 * @param {string} sessionId - معرف الجلسة
 * @param {string} parcelId - معرف الطرد
 */
async function lockParcel(sessionId, parcelId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const parcelRef = doc(db, 'sessions', sessionId, 'parcels', parcelId);
    await updateDoc(parcelRef, {
      lockedBy: user.uid,
      lockedByEmail: user.email,
      lockedAt: serverTimestamp()
    });

    console.log('🔒 تم قفل الطرد');
  } catch (error) {
    console.error('❌ خطأ في قفل الطرد:', error);
    throw error;
  }
}

/**
 * فك قفل طرد
 * @param {string} sessionId - معرف الجلسة
 * @param {string} parcelId - معرف الطرد
 */
async function unlockParcel(sessionId, parcelId) {
  try {
    const parcelRef = doc(db, 'sessions', sessionId, 'parcels', parcelId);
    await updateDoc(parcelRef, {
      lockedBy: null,
      lockedByEmail: null,
      lockedAt: null
    });

    console.log('🔓 تم فك قفل الطرد');
  } catch (error) {
    console.error('❌ خطأ في فك قفل الطرد:', error);
    throw error;
  }
}

/**
 * الحصول على طرود الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<Array>} - قائمة الطرود
 */
async function getSessionParcels(sessionId) {
  try {
    const parcelsRef = collection(db, 'sessions', sessionId, 'parcels');
    const parcelsSnap = await getDocs(parcelsRef);
    
    const parcels = [];
    parcelsSnap.forEach(doc => {
      parcels.push({ id: doc.id, ...doc.data() });
    });

    return parcels;
  } catch (error) {
    console.error('❌ خطأ في جلب طرود الجلسة:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 المزامنة الفورية (Realtime Sync)
// ═══════════════════════════════════════════════════════════════

/**
 * الاستماع لتحديثات الجلسة في الوقت الفعلي
 * @param {string} sessionId - معرف الجلسة
 * @param {Function} onUpdate - دالة التحديث
 * @returns {Function} - دالة إلغاء الاستماع
 */
function listenToSession(sessionId, onUpdate) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() });
      }
    }, (error) => {
      console.error('❌ خطأ في الاستماع للجلسة:', error);
    });

    activeSessionListeners[`session_${sessionId}`] = unsubscribe;
    return unsubscribe;
  } catch (error) {
    console.error('❌ خطأ في إعداد الاستماع للجلسة:', error);
    throw error;
  }
}

/**
 * الاستماع لتحديثات طرود الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {Function} onUpdate - دالة التحديث
 * @returns {Function} - دالة إلغاء الاستماع
 */
function listenToSessionParcels(sessionId, onUpdate) {
  try {
    const parcelsRef = collection(db, 'sessions', sessionId, 'parcels');
    
    const unsubscribe = onSnapshot(parcelsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const parcel = { id: change.doc.id, ...change.doc.data() };
        onUpdate(change.type, parcel);
      });
    }, (error) => {
      console.error('❌ خطأ في الاستماع لطرود الجلسة:', error);
    });

    activeSessionListeners[`parcels_${sessionId}`] = unsubscribe;
    return unsubscribe;
  } catch (error) {
    console.error('❌ خطأ في إعداد الاستماع لطرود الجلسة:', error);
    throw error;
  }
}

/**
 * الاستماع لتحديثات المشاركين
 * @param {string} sessionId - معرف الجلسة
 * @param {Function} onUpdate - دالة التحديث
 * @returns {Function} - دالة إلغاء الاستماع
 */
function listenToParticipants(sessionId, onUpdate) {
  try {
    const participantsRef = collection(db, 'sessions', sessionId, 'participants');
    
    const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
      const participants = [];
      snapshot.forEach(doc => {
        participants.push({ id: doc.id, ...doc.data() });
      });
      onUpdate(participants);
    }, (error) => {
      console.error('❌ خطأ في الاستماع للمشاركين:', error);
    });

    activeSessionListeners[`participants_${sessionId}`] = unsubscribe;
    return unsubscribe;
  } catch (error) {
    console.error('❌ خطأ في إعداد الاستماع للمشاركين:', error);
    throw error;
  }
}

/**
 * إيقاف جميع مستمعي الجلسة
 * @param {string} sessionId - معرف الجلسة (اختياري)
 */
function stopListening(sessionId = null) {
  try {
    if (sessionId) {
      // إيقاف مستمعي جلسة محددة
      const keys = [`session_${sessionId}`, `parcels_${sessionId}`, `participants_${sessionId}`];
      keys.forEach(key => {
        if (activeSessionListeners[key]) {
          activeSessionListeners[key]();
          delete activeSessionListeners[key];
        }
      });
    } else {
      // إيقاف جميع المستمعين
      Object.values(activeSessionListeners).forEach(unsubscribe => unsubscribe());
      activeSessionListeners = {};
    }

    console.log('✅ تم إيقاف الاستماع');
  } catch (error) {
    console.error('❌ خطأ في إيقاف الاستماع:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// 👁️ نظام الحضور (Presence System)
// ═══════════════════════════════════════════════════════════════

/**
 * تحديث حالة حضور المستخدم
 * @param {string} sessionId - معرف الجلسة
 * @param {boolean} isOnline - حالة الاتصال
 */
async function updatePresence(sessionId, isOnline = true) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const participantRef = doc(db, 'sessions', sessionId, 'participants', user.uid);
    await updateDoc(participantRef, {
      isOnline: isOnline,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ خطأ في تحديث الحضور:', error);
  }
}

/**
 * بدء تتبع الحضور التلقائي
 * @param {string} sessionId - معرف الجلسة
 */
function startPresenceTracking(sessionId) {
  try {
    // تحديث الحضور كل 30 ثانية
    presenceInterval = setInterval(() => {
      updatePresence(sessionId, true);
    }, 30000);

    // تحديث عند الدخول
    updatePresence(sessionId, true);

    // تحديث عند الخروج
    window.addEventListener('beforeunload', () => {
      updatePresence(sessionId, false);
    });

    // تحديث عند فقدان التركيز
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        updatePresence(sessionId, false);
      } else {
        updatePresence(sessionId, true);
      }
    });

    console.log('✅ بدأ تتبع الحضور');
  } catch (error) {
    console.error('❌ خطأ في بدء تتبع الحضور:', error);
  }
}

/**
 * إيقاف تتبع الحضور
 * @param {string} sessionId - معرف الجلسة
 */
function stopPresenceTracking(sessionId) {
  try {
    if (presenceInterval) {
      clearInterval(presenceInterval);
      presenceInterval = null;
    }

    updatePresence(sessionId, false);
    console.log('✅ تم إيقاف تتبع الحضور');
  } catch (error) {
    console.error('❌ خطأ في إيقاف تتبع الحضور:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 سجل النشاطات
// ═══════════════════════════════════════════════════════════════

/**
 * تسجيل نشاط في الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {Object} activity - بيانات النشاط
 */
async function logActivity(sessionId, activity) {
  try {
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const activityRef = doc(db, 'sessions', sessionId, 'activity', activityId);
    
    await setDoc(activityRef, {
      id: activityId,
      ...activity,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ خطأ في تسجيل النشاط:', error);
  }
}

/**
 * الحصول على سجل النشاطات
 * @param {string} sessionId - معرف الجلسة
 * @param {number} limit - عدد النشاطات (افتراضي 50)
 * @returns {Promise<Array>} - قائمة النشاطات
 */
async function getActivityLog(sessionId, limit = 50) {
  try {
    const activityRef = collection(db, 'sessions', sessionId, 'activity');
    const q = query(activityRef, orderBy('timestamp', 'desc'));
    const activitySnap = await getDocs(q);
    
    const activities = [];
    let count = 0;
    activitySnap.forEach(doc => {
      if (count < limit) {
        activities.push({ id: doc.id, ...doc.data() });
        count++;
      }
    });

    return activities;
  } catch (error) {
    console.error('❌ خطأ في جلب سجل النشاطات:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📈 الإحصائيات والتقارير
// ═══════════════════════════════════════════════════════════════

/**
 * تحديث إحصائيات الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @param {string} oldStatus - الحالة القديمة
 * @param {string} newStatus - الحالة الجديدة
 */
async function updateSessionStats(sessionId, oldStatus, newStatus) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const stats = sessionSnap.data().stats || {};

    const updates = {};

    // تحديث عداد الطرود المسلمة
    if (newStatus === 'تم التسليم ✓' && oldStatus !== 'تم التسليم ✓') {
      updates['stats.deliveredParcels'] = (stats.deliveredParcels || 0) + 1;
      updates['stats.pendingParcels'] = Math.max((stats.pendingParcels || 0) - 1, 0);
    } else if (oldStatus === 'تم التسليم ✓' && newStatus !== 'تم التسليم ✓') {
      updates['stats.deliveredParcels'] = Math.max((stats.deliveredParcels || 0) - 1, 0);
      updates['stats.pendingParcels'] = (stats.pendingParcels || 0) + 1;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(sessionRef, updates);
    }
  } catch (error) {
    console.error('❌ خطأ في تحديث الإحصائيات:', error);
  }
}

/**
 * الحصول على إحصائيات الجلسة
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<Object>} - الإحصائيات
 */
async function getSessionStats(sessionId) {
  try {
    const session = await getSession(sessionId);
    const participants = await getParticipants(sessionId);
    const parcels = await getSessionParcels(sessionId);

    // حساب الإحصائيات
    const stats = {
      totalParcels: parcels.length,
      deliveredParcels: parcels.filter(p => p.status === 'تم التسليم ✓').length,
      pendingParcels: parcels.filter(p => p.status !== 'تم التسليم ✓').length,
      participantsCount: participants.length,
      onlineParticipants: participants.filter(p => p.isOnline).length,
      
      // إحصائيات المشاركين
      participantsStats: participants.map(p => ({
        email: p.email,
        displayName: p.displayName,
        role: p.role,
        isOnline: p.isOnline,
        stats: p.stats || {}
      })),

      // إحصائيات الحالات
      statusBreakdown: parcels.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}),

      // معلومات الجلسة
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      duration: Date.now() - (session.createdAt?.toMillis() || Date.now())
    };

    return stats;
  } catch (error) {
    console.error('❌ خطأ في حساب الإحصائيات:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔧 دوال مساعدة
// ═══════════════════════════════════════════════════════════════

/**
 * التحقق من صلاحية المستخدم
 * @param {string} sessionId - معرف الجلسة
 * @param {string} requiredRole - الدور المطلوب
 * @returns {Promise<boolean>} - هل لديه الصلاحية
 */
async function checkPermission(sessionId, requiredRole) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const participant = await getParticipant(sessionId, user.uid);
    
    const roleHierarchy = {
      'owner': 4,
      'admin': 3,
      'editor': 2,
      'viewer': 1
    };

    return roleHierarchy[participant.role] >= roleHierarchy[requiredRole];
  } catch (error) {
    return false;
  }
}

/**
 * تنظيف الجلسات القديمة
 * @param {number} daysOld - عدد الأيام
 */
async function cleanupOldSessions(daysOld = 30) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const sessions = await getUserSessions();

    let deletedCount = 0;

    for (const session of sessions) {
      if (session.status === 'ended' || session.status === 'archived') {
        const updatedAt = session.updatedAt?.toMillis() || 0;
        if (updatedAt < cutoffDate && session.myRole === 'owner') {
          await deleteSession(session.id);
          deletedCount++;
        }
      }
    }

    console.log(`✅ تم حذف ${deletedCount} جلسة قديمة`);
    return deletedCount;
  } catch (error) {
    console.error('❌ خطأ في تنظيف الجلسات:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📤 التصدير - إضافة للدالة على window
// ═══════════════════════════════════════════════════════════════

// إضافة جميع الدوال على window.sessionsManager
window.sessionsManager = {
  // إدارة الجلسات
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getUserSessions,
  
  // إدارة المشاركين
  addParticipant,
  inviteUser,
  acceptInvite,
  getParticipant,
  getParticipants,
  updateParticipantRole,
  removeParticipant,
  
  // إدارة الطرود
  addParcelsToSession,
  updateSessionParcel,
  lockParcel,
  unlockParcel,
  getSessionParcels,
  
  // المزامنة الفورية
  listenToSession,
  listenToSessionParcels,
  listenToParticipants,
  stopListening,
  
  // نظام الحضور
  updatePresence,
  startPresenceTracking,
  stopPresenceTracking,
  
  // سجل النشاطات
  logActivity,
  getActivityLog,
  
  // الإحصائيات
  getSessionStats,
  
  // دوال مساعدة
  checkPermission,
  cleanupOldSessions
};

console.log('✅ تم تحميل مدير الجلسات التعاونية');
