const importExcelFunctions = {
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const newParcels = jsonData.map((row, index) => {
                let cleanPhone = (row["Numéro"] || row["Phone"] || row["الهاتف"] || row["هاتف المستلم"] || "").toString().replace(/\s/g, "");
                let cleanPhone2 = (row["Numéro 2"] || row["Phone2"] || row["الهاتف 2"] || row["هاتف المستلم 2"] || "").toString().replace(/\s/g, "");
                let cleanSenderPhone = (row["هاتف المرسل"] || row["Sender Phone"] || "").toString().replace(/\s/g, "");
                let cleanSenderPhone2 = (row["هاتف المرسل 2"] || row["Sender Phone 2"] || "").toString().replace(/\s/g, "");
                
                return {
                    id: Date.now() + index,
                    // بيانات الطرد
                    tracking: row["Tracking"] || row["رقم التتبع"] || "",
                    type: row["Type"] || row["النوع"] || "",
                    pin: row["PIN"] || row["كود PIN"] || "",
                    content: row["Contenu"] || row["Content"] || row["المحتوى"] || "",
                    amount: row["Montant"] || row["Amount"] || row["المبلغ"] || 0,
                    createdDate: row["تاريخ الإنشاء"] || row["Created Date"] || "",
                    
                    // بيانات المستلم
                    receiver: row["Destinataire"] || row["Receiver"] || row["المستلم"] || row["اسم المستلم"] || "",
                    address: row["Adresse"] || row["Address"] || row["العنوان"] || row["عنوان المستلم"] || "",
                    municipality: row["Commune"] || row["Municipality"] || row["البلدية"] || "",
                    phone: cleanPhone,
                    phone2: cleanPhone2,
                    
                    // بيانات المرسل
                    sender: row["المرسل"] || row["Sender"] || row["اسم المرسل"] || "",
                    senderAddress: row["عنوان المرسل"] || row["Sender Address"] || "",
                    senderPhone: cleanSenderPhone,
                    senderPhone2: cleanSenderPhone2,
                    
                    // الحالة والملاحظات
                    status: row["Statut"] || row["Status"] || row["الحالة"] || "دون إجراء",
                    notes: row["Note"] || row["Notes"] || row["الملاحظات"] || row["ملاحظات"] || "",
                    
                    // التذكير والتمييز
                    reminderTime: row["وقت التذكير"] || row["Reminder Time"] || "",
                    tag: row["التمييز"] || row["Tag"] || "",
                    
                    // حقول إضافية
                    expanded: false
                };
            });

            this.findAndMerge(newParcels);
            this.saveData();
            this.$nextTick(() => {
                this.initSortable();
                this.showImportSummary = true;
            });
            this.clearFilters();
            this.drawerOpen = false;
        };
        reader.readAsArrayBuffer(file);
        event.target.value = "";
    },

    exportExcel() {
        const dataToExport = this.parcels.map((p, index) => ({
            // الترتيب
            "الترتيب": index + 1,
            
            // بيانات الطرد
            "رقم التتبع": p.tracking || "",
            "النوع": p.type || "",
            "كود PIN": p.pin || "",
            "المحتوى": p.content || "",
            "المبلغ": p.amount || 0,
            "تاريخ الإنشاء": p.createdDate || "",
            
            // بيانات المستلم
            "اسم المستلم": p.receiver || "",
            "عنوان المستلم": p.address || "",
            "البلدية": p.municipality || "",
            "هاتف المستلم": p.phone || "",
            "هاتف المستلم 2": p.phone2 || "",
            
            // بيانات المرسل
            "اسم المرسل": p.sender || "",
            "عنوان المرسل": p.senderAddress || "",
            "هاتف المرسل": p.senderPhone || "",
            "هاتف المرسل 2": p.senderPhone2 || "",
            
            // الحالة والملاحظات
            "الحالة": p.status || "",
            "ملاحظات": p.notes || "",
            
            // التذكير والتمييز
            "وقت التذكير": p.reminderTime || "",
            "التمييز": p.tag || ""
        }));
        
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // تعديل عرض الأعمدة
        ws['!cols'] = [
            { wch: 8 },   // الترتيب
            { wch: 20 },  // رقم التتبع
            { wch: 15 },  // النوع
            { wch: 10 },  // كود PIN
            { wch: 25 },  // المحتوى
            { wch: 10 },  // المبلغ
            { wch: 15 },  // تاريخ الإنشاء
            { wch: 25 },  // اسم المستلم
            { wch: 30 },  // عنوان المستلم
            { wch: 15 },  // البلدية
            { wch: 15 },  // هاتف المستلم
            { wch: 15 },  // هاتف المستلم 2
            { wch: 25 },  // اسم المرسل
            { wch: 30 },  // عنوان المرسل
            { wch: 15 },  // هاتف المرسل
            { wch: 15 },  // هاتف المرسل 2
            { wch: 15 },  // الحالة
            { wch: 40 },  // ملاحظات
            { wch: 12 },  // وقت التذكير
            { wch: 20 }   // التمييز
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الطرود");
        XLSX.writeFile(wb, `SwiPex_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        this.drawerOpen = false;
    },

    async shareSession() {
        const dataToExport = this.parcels.map((p, index) => ({
            "الترتيب": index + 1,
            "رقم التتبع": p.tracking || "",
            "النوع": p.type || "",
            "كود PIN": p.pin || "",
            "المحتوى": p.content || "",
            "المبلغ": p.amount || 0,
            "تاريخ الإنشاء": p.createdDate || "",
            "اسم المستلم": p.receiver || "",
            "عنوان المستلم": p.address || "",
            "البلدية": p.municipality || "",
            "هاتف المستلم": p.phone || "",
            "هاتف المستلم 2": p.phone2 || "",
            "اسم المرسل": p.sender || "",
            "عنوان المرسل": p.senderAddress || "",
            "هاتف المرسل": p.senderPhone || "",
            "هاتف المرسل 2": p.senderPhone2 || "",
            "الحالة": p.status || "",
            "ملاحظات": p.notes || "",
            "وقت التذكير": p.reminderTime || "",
            "التمييز": p.tag || ""
        }));
        
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الطرود");
        
        const fileName = `SwiPex_Session_${new Date().toISOString().slice(0, 10)}.xlsx`;
        
        // تحويل إلى Blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const file = new File([blob], fileName, { type: blob.type });
        
        // محاولة المشاركة
        if (navigator.share) {
            try {
                // محاولة المشاركة مع الملف
                const shareData = {
                    files: [file],
                    title: 'مشاركة جلسة SwiPex',
                    text: `جلسة عمل SwiPex - ${this.parcels.length} طرد`
                };
                
                // التحقق من إمكانية المشاركة
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    this.drawerOpen = false;
                    return;
                }
                
                // محاولة المشاركة بدون التحقق (بعض المتصفحات تدعم share بدون canShare)
                await navigator.share(shareData);
                this.drawerOpen = false;
                return;
            } catch (err) {
                console.log('Share failed:', err);
                // إذا كان المستخدم ألغى المشاركة
                if (err.name === 'AbortError') {
                    this.drawerOpen = false;
                    return;
                }
            }
        }
        
        // إذا لم تنجح المشاركة، حمّل الملف
        XLSX.writeFile(wb, fileName);
        this.drawerOpen = false;
    },

    triggerFileInput() {
        this.$refs.fileInput.click();
        this.drawerOpen = false;
    },

    triggerPdfInput() {
        this.$refs.pdfInput.click();
        this.drawerOpen = false;
    }
};

if (typeof window !== 'undefined') window.importExcelFunctions = importExcelFunctions;
