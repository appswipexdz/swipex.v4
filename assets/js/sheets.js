// ============================================
// assets/js/sheets.js
// التعامل مع Google Sheets كقاعدة بيانات
// ============================================

async function refreshGoogleAccessToken() {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error("لا يوجد مستخدم مسجل دخول");
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/spreadsheets");
  provider.addScope("https://www.googleapis.com/auth/drive.file");

  let result;
  try {
    result = await user.reauthenticateWithPopup(provider);
  } catch (popupError) {
    if (
      popupError.code === "auth/popup-blocked" ||
      popupError.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await firebase.auth().signInWithRedirect(provider);
      return null;
    }
    throw popupError;
  }

  const newToken = result.credential.accessToken;
  const stored = JSON.parse(localStorage.getItem("swipex_user") || "{}");
  stored.accessToken = newToken;
  localStorage.setItem("swipex_user", JSON.stringify(stored));
  return newToken;
}

const sheetsManager = {
  SHEET_NAME: "SwiPex_Data",
  SPREADSHEET_KEY: "swipex_spreadsheet_id",
  COLS: "A:Y",
  COL_END: "Y",
  TOTAL_COLS: 25,

  HEADERS: [
    "id",
    "tracking",
    "receiver",
    "phone",
    "phone2",
    "address",
    "municipality",
    "wilaya",
    "amount",
    "content",
    "type",
    "pin",
    "status",
    "notes",
    "tag",
    "sender",
    "senderPhone",
    "senderPhone2",
    "senderAddress",
    "createdDate",
    "createdAt",
    "updatedAt",
    "duplicateCount",
    "insertedAt",
    "smsSent",
  ],

  // سجل التغييرات (Changes sheet)
  CHANGES_COLS: "A:E",
  CHANGES_HEADERS: [
    "id", // معرّف الطرد
    "tracking", // رقم التتبع (للمراجعة اليدوية)
    "updatedAt", // وقت التعديل
    "type", // insert | update | delete
    "parcelJson", // نسخة JSON كاملة من الطرد
  ],

  getAccessToken() {
    const userData = localStorage.getItem("swipex_user");
    if (userData) {
      const user = JSON.parse(userData);
      return user.accessToken;
    }
    return null;
  },

  getSpreadsheetId() {
    return localStorage.getItem(this.SPREADSHEET_KEY);
  },

  saveSpreadsheetId(id) {
    localStorage.setItem(this.SPREADSHEET_KEY, id);
  },

  todayKey() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  },

  nowInsertedAt() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return this.todayKey() + "T" + hh + ":" + mm + ":" + ss;
  },

  async apiCall(url, options = {}, _retried = false) {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      return null;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        if (!_retried) {
          try {
            const newToken = await refreshGoogleAccessToken();
            if (newToken) {
              return await this.apiCall(url, options, true);
            }
          } catch (refreshError) {
            console.error(
              "Sheets: فشل تجديد التوكن:",
              refreshError.code || refreshError.message,
            );
          }
        }
        console.warn(
          "Sheets: Token منتهي - تحتاج إعادة تسجيل الدخول لتفعيل Google Sheets",
        );
        return null;
      }

      if (response.status === 403) {
        const error = await response.json().catch(() => ({}));
        console.warn(
          "Sheets: صلاحيات غير كافية:",
          error.error?.message || response.status,
        );
        return null;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(
          "Sheets API Error:",
          response.status,
          error.error?.message || "",
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Sheets Network error:", error.message);
      return null;
    }
  },

  async createSpreadsheet() {
    const data = await this.apiCall(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        body: JSON.stringify({
          properties: { title: this.SHEET_NAME },
          sheets: [
            {
              properties: {
                title: "Parcels",
                gridProperties: {
                  rowCount: 5000,
                  columnCount: this.TOTAL_COLS,
                },
              },
            },
            {
              properties: {
                title: "Settings",
                gridProperties: { rowCount: 10, columnCount: 2 },
              },
            },
            {
              properties: {
                title: "Archive",
                gridProperties: { rowCount: 10, columnCount: 2 },
              },
            },
            {
              properties: {
                title: "Changes",
                gridProperties: { rowCount: 10000, columnCount: 5 },
              },
            },
          ],
        }),
      },
    );

    if (!data) return null;

    this.saveSpreadsheetId(data.spreadsheetId);
    await this.initializeHeaders(data.spreadsheetId);
    console.log("تم إنشاء الشيت:", data.spreadsheetId);
    return data.spreadsheetId;
  },

  async findExistingSpreadsheet() {
    const data = await this.apiCall(
      `https://www.googleapis.com/drive/v3/files?q=name='${this.SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    );

    if (data && data.files && data.files.length > 0) {
      const id = data.files[0].id;
      this.saveSpreadsheetId(id);
      return id;
    }
    return null;
  },

  async getOrCreateSpreadsheet() {
    let id = this.getSpreadsheetId();

    if (id) {
      const exists = await this.checkSpreadsheetExists(id);
      if (exists) return id;
    }

    id = await this.findExistingSpreadsheet();
    if (id) return id;

    return await this.createSpreadsheet();
  },

  async checkSpreadsheetExists(spreadsheetId) {
    const data = await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`,
    );
    return data !== null;
  },

  async initializeHeaders(spreadsheetId) {
    // رؤوس Parcels
    await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A1:${this.COL_END}1?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [this.HEADERS] }),
      },
    );

    // رؤوس Changes
    await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Changes!A1:${this.CHANGES_COLS.slice(-1)}1?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [this.CHANGES_HEADERS] }),
      },
    );
  },

  parcelToRow(p) {
    return [
      p.id || "",
      p.tracking || "",
      p.receiver || "",
      p.phone || "",
      p.phone2 || "",
      p.address || "",
      p.municipality || "",
      p.wilaya || "",
      String(p.amount || ""),
      p.content || "",
      p.type || "",
      p.pin || "",
      p.status || "دون إجراء",
      p.notes || "",
      p.tag || "",
      p.sender || "",
      p.senderPhone || "",
      p.senderPhone2 || "",
      p.senderAddress || "",
      p.createdDate || "",
      p.createdAt || "",
      p.updatedAt || new Date().toISOString(),
      String(p.duplicateCount || 0),
      p.insertedAt || this.nowInsertedAt(),
      p.smsSent ? "1" : "0",
    ];
  },

  rowToParcel(row) {
    return {
      id:
        row[0] ||
        Date.now().toString() + Math.random().toString(36).substr(2, 5),
      tracking: row[1] || "",
      receiver: row[2] || "",
      phone: row[3] || "",
      phone2: row[4] || "",
      address: row[5] || "",
      municipality: row[6] || "",
      wilaya: row[7] || "",
      amount: row[8] || "",
      content: row[9] || "",
      type: row[10] || "",
      pin: row[11] || "",
      status: row[12] || "دون إجراء",
      notes: row[13] || "",
      tag: row[14] || "",
      sender: row[15] || "",
      senderPhone: row[16] || "",
      senderPhone2: row[17] || "",
      senderAddress: row[18] || "",
      createdDate: row[19] || "",
      createdAt: row[20] || "",
      updatedAt: row[21] || "",
      duplicateCount: parseInt(row[22]) || 0,
      insertedAt: row[23] || "",
      smsSent: row[24] === "1",
      expanded: false,
    };
  },

  async clearAndWriteAllParcels(parcels) {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return false;

    try {
      // مسح جميع بيانات الطرود (الاحتفاظ بالرأس)
      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A2:${this.COL_END}10000:clear`,
        { method: "POST", body: JSON.stringify({}) },
      );

      if (parcels.length === 0) return true;

      // كتابة جميع الطرود الجديدة
      const rows = parcels.map((p) => {
        if (!p.insertedAt) p.insertedAt = this.nowInsertedAt();
        if (!p.updatedAt) p.updatedAt = new Date().toISOString();
        return this.parcelToRow(p);
      });

      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A2:${this.COL_END}${rows.length + 1}?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ values: rows }),
        },
      );

      console.log(`✓ تم إعادة كتابة ${rows.length} طرد في Parcels sheet`);
      return true;
    } catch (error) {
      console.error("Sheets clearAndWriteAllParcels error:", error);
      return false;
    }
  },

  async saveParcels(parcels, deletedIds = []) {
    // ملاحظة مهمة: يتم معالجة الطرود المعدلة فقط (parcels هي فقط التي لديها _sheetsDirty = true)
    // لا يتم إعادة كتابة جميع الطرود، بل فقط التي تم تعديلها

    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return false;

    try {
      const existing = await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A2:${this.COL_END}10000`,
      );
      const rows = existing?.values || [];

      const idToRow = new Map();
      const trackingToRow = new Map();
      rows.forEach((row, i) => {
        const rowNum = i + 2;
        const id = String(row[0] || "").trim();
        const tracking = String(row[1] || "").trim();
        if (id) idToRow.set(id, { rowNum, data: row });
        if (tracking) trackingToRow.set(tracking, { rowNum, data: row });
      });

      const updates = [];
      const appends = [];
      const changes = [];
      const processedIds = new Set();

      // معالجة الطرود المعدلة فقط
      for (const p of parcels) {
        processedIds.add(String(p.id || "").trim());
        if (!p.insertedAt) p.insertedAt = this.nowInsertedAt();
        if (!p.updatedAt) p.updatedAt = new Date().toISOString();
        const rowValues = this.parcelToRow(p);
        const idKey = String(p.id || "").trim();
        const trackingKey = String(p.tracking || "").trim();
        const match =
          (idKey && idToRow.get(idKey)) ||
          (trackingKey && trackingToRow.get(trackingKey));

        if (match) {
          // تحديث: فقط إذا حدثت تغييرات فعلية
          const existingData = match.data;
          const hasChanges = rowValues.some((val, idx) => {
            if (idx === 21) return false; // تجاهل updatedAt
            return String(val || "") !== String(existingData[idx] || "");
          });
          if (hasChanges) {
            updates.push({
              range: `Parcels!A${match.rowNum}:${this.COL_END}${match.rowNum}`,
              values: [rowValues],
            });
            changes.push({ parcel: p, type: "update" });
          }
        } else {
          // إضافة: طرد جديد
          appends.push(rowValues);
          changes.push({ parcel: p, type: "insert" });
        }
      }

      // تسجيل عمليات الحذف + مسح الصفوف فعلياً
      const clearRanges = [];
      for (const deletedId of deletedIds) {
        const idKey = String(deletedId || "").trim();
        const match = idToRow.get(idKey);
        if (match) {
          const deletedParcel = this.rowToParcel(match.data);
          changes.push({ parcel: deletedParcel, type: "delete" });
          clearRanges.push(
            `Parcels!A${match.rowNum}:${this.COL_END}${match.rowNum}`,
          );
        }
      }

      // لا يوجد أي تغييرات فعلية
      if (
        updates.length === 0 &&
        appends.length === 0 &&
        clearRanges.length === 0
      ) {
        console.log("Sheets: لا توجد تغييرات جديدة لحفظها");
        return true;
      }

      if (updates.length > 0) {
        await this.apiCall(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            body: JSON.stringify({ valueInputOption: "RAW", data: updates }),
          },
        );
      }

      if (appends.length > 0) {
        await this.apiCall(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A1:${this.COL_END}1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            body: JSON.stringify({ values: appends }),
          },
        );
      }

      // مسح صفوف الطرود المحذوفة فعلياً من الشيت
      for (const range of clearRanges) {
        await this.apiCall(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
          { method: "POST", body: JSON.stringify({}) },
        );
      }

      // تسجيل التغييرات في ورقة Changes
      if (changes.length > 0) {
        await this.logChanges(changes);
      }

      console.log(
        `Sheets: ${updates.length} تحديث, ${appends.length} إضافة, ${deletedIds.length} حذف (من ${parcels.length} طرد)`,
      );
      return true;
    } catch (error) {
      console.error("Sheets saveParcels error:", error);
      return false;
    }
  },

  async logChanges(changes) {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId || !changes || changes.length === 0) return;

    try {
      const now = new Date().toISOString();
      const rows = changes.map(({ parcel, type }) => {
        const updatedAt = parcel.updatedAt || now;
        return [
          parcel.id || "",
          parcel.tracking || "",
          updatedAt,
          type || "update",
          JSON.stringify(parcel),
        ];
      });

      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Changes!A1:${this.CHANGES_COLS.slice(-1)}1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          body: JSON.stringify({ values: rows }),
        },
      );
    } catch (e) {
      console.error("Sheets logChanges error:", e);
    }
  },

  async loadChanges(since) {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return [];

    try {
      const data = await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Changes!A2:E100000`,
      );
      if (!data || !data.values || data.values.length === 0) return [];

      const sinceTime = since ? Date.parse(since) || 0 : 0;
      const changes = [];

      for (const row of data.values) {
        const id = row[0] || "";
        const tracking = row[1] || "";
        const updatedAt = row[2] || "";
        const type = row[3] || "update";
        const json = row[4] || "";

        if (!id && !tracking) continue;

        let parcel = null;
        if (json) {
          try {
            parcel = JSON.parse(json);
          } catch (e) {
            // تجاهل الأخطاء في JSON لكن نبقي بيانات الأساس
            parcel = null;
          }
        }

        const time = updatedAt ? Date.parse(updatedAt) || 0 : 0;
        if (sinceTime && time && time <= sinceTime) continue;

        changes.push({ id, tracking, updatedAt, type, parcel });
      }

      return changes;
    } catch (e) {
      console.error("Sheets loadChanges error:", e);
      return [];
    }
  },

  async loadParcels(dateKey) {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) return null;

    try {
      const data = await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Parcels!A2:${this.COL_END}10000`,
      );
      if (!data || !data.values || data.values.length === 0) return [];

      const filterDate = dateKey || this.todayKey();
      const parcels = data.values
        .filter((row) => (row[23] || "").startsWith(filterDate))
        .map((row) => this.rowToParcel(row));
      return parcels;
    } catch (error) {
      console.error("Sheets loadParcels error:", error);
      return null;
    }
  },

  async saveSettings(settings) {
    const spreadsheetId = await this.getOrCreateSpreadsheet();
    if (!spreadsheetId) return false;

    const rows = Object.entries(settings).map(([key, value]) => {
      const val =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
      return [key, val];
    });

    const range = `Settings!A1:B${rows.length}`;
    const result = await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: rows }),
      },
    );

    // Clear extra rows if settings shrunk
    const existing = await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Settings!A1:B1000`,
    );
    const existingCount = existing?.values?.length || 0;
    if (existingCount > rows.length) {
      const clearRange = `Settings!A${rows.length + 1}:B${existingCount}`;
      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
        { method: "POST", body: JSON.stringify({}) },
      );
    }

    return result !== null;
  },

  async loadSettings() {
    const spreadsheetId = await this.getOrCreateSpreadsheet();
    if (!spreadsheetId) return null;

    try {
      const data = await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Settings!A1:B1000`,
      );
      if (!data || !data.values || data.values.length === 0) return null;

      const settings = {};
      for (const row of data.values) {
        const key = row[0];
        const raw = row[1] || "";
        if (!key) continue;
        if (
          (raw.startsWith("[") && raw.endsWith("]")) ||
          (raw.startsWith("{") && raw.endsWith("}"))
        ) {
          try {
            settings[key] = JSON.parse(raw);
          } catch (e) {
            settings[key] = raw;
          }
        } else if (raw === "true") {
          settings[key] = true;
        } else if (raw === "false") {
          settings[key] = false;
        } else if (
          raw !== "" &&
          !isNaN(raw) &&
          !key.includes("Template") &&
          !key.includes("template")
        ) {
          settings[key] = Number(raw);
        } else {
          settings[key] = raw;
        }
      }
      return settings;
    } catch (error) {
      return null;
    }
  },

  async saveArchive(archive) {
    const spreadsheetId = await this.getOrCreateSpreadsheet();
    if (!spreadsheetId) return false;

    const rows = Object.entries(archive).map(([tracking, data]) => {
      return [tracking, JSON.stringify(data)];
    });

    if (rows.length === 0) {
      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Archive!A1:B1000:clear`,
        { method: "POST", body: JSON.stringify({}) },
      );
      return true;
    }

    const range = `Archive!A1:B${rows.length}`;
    const result = await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: rows }),
      },
    );

    // Clear extra rows if archive shrunk
    const existing = await this.apiCall(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Archive!A1:B10000`,
    );
    const existingCount = existing?.values?.length || 0;
    if (existingCount > rows.length) {
      const clearRange = `Archive!A${rows.length + 1}:B${existingCount}`;
      await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
        { method: "POST", body: JSON.stringify({}) },
      );
    }

    return result !== null;
  },

  async loadArchive() {
    const spreadsheetId = await this.getOrCreateSpreadsheet();
    if (!spreadsheetId) return null;

    try {
      const data = await this.apiCall(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Archive!A1:B10000`,
      );
      if (!data || !data.values || data.values.length === 0) return null;

      const archive = {};
      for (const row of data.values) {
        const tracking = row[0];
        const raw = row[1] || "";
        if (!tracking) continue;
        try {
          archive[tracking] = JSON.parse(raw);
        } catch (e) {
          archive[tracking] = raw;
        }
      }
      return archive;
    } catch (error) {
      return null;
    }
  },
};
