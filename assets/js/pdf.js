const pdfFunctions = {
    async handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file || file.type !== "application/pdf") {
            alert("الرجاء اختيار ملف PDF");
            return;
        }

        this.isProcessingPdf = true;
        this.pdfProgress = "جاري البدء...";

        try {
            this.parcels.forEach(p => {
                this.archive[p.tracking] = {
                    status: p.status,
                    notes: p.notes,
                    lastUpdate: new Date().toISOString()
                };
            });

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const extractedParcels = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                this.pdfProgress = `معالجة صفحة ${i} من ${pdf.numPages}`;
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const view = page.getViewport({ scale: 1 });

                const fullRaw = textContent.items.map(it => it.str).join(" ");
                if (fullRaw.length < 50) continue;

                const midX = view.width / 2;
                const midY = view.height / 2;
                const qData = { TL: [], TR: [], BL: [], BR: [] };

                textContent.items.forEach(it => {
                    const x = it.transform[4];
                    const y = it.transform[5];
                    const itm = { s: it.str.trim(), x, y };
                    if (!itm.s) return;
                    if (x < midX && y > midY) qData.TL.push(itm);
                    else if (x >= midX && y > midY) qData.TR.push(itm);
                    else if (x < midX && y <= midY) qData.BL.push(itm);
                    else if (x >= midX && y <= midY) qData.BR.push(itm);
                });

                for (const key in qData) {
                    const items = qData[key].sort((a, b) => b.y !== a.y ? b.y - a.y : a.x - b.x);
                    if (items.length < 5) continue;

                    const lines = [];
                    items.forEach(it => {
                        if (lines.length > 0 && Math.abs(it.y - lines[lines.length - 1].y) < 5) {
                            lines[lines.length - 1].text += " " + it.s;
                        } else {
                            lines.push({ y: it.y, text: it.s });
                        }
                    });

                    // كائن لتخزين جميع البيانات المستخرجة
                    let parcel = {
                        tracking: "",
                        type: "",
                        sender: "",
                        senderAddress: "",
                        senderPhone: "",
                        senderPhone2: "",
                        receiver: "",
                        receiverAddress: "",
                        municipality: "",
                        wilaya: "",
                        phone: "",
                        phone2: "",
                        pin: "",
                        content: "",
                        amount: "0",
                        createdDate: ""
                    };

                    // ============ استخراج رقم التتبع ============
                    const tLine = lines.find(l => l.text.includes("YAL-"));
                    if (tLine) {
                        const m = tLine.text.match(/YAL-[A-Z0-9]+/);
                        if (m) parcel.tracking = m[0];
                    }
                    if (!parcel.tracking) continue;

                    // ============ استخراج رقم PIN ============
                    const pinMatch = tLine.text.match(/PIN:\s*(\d+)/);
                    if (pinMatch) parcel.pin = pinMatch[1];

                    // ============ تحديد نوع الطرد ============
                    const typeLineIdx = lines.findIndex(l =>
                        l.text.includes("E-COMMERCE") ||
                        l.text.includes("PARTICULIER") ||
                        l.text.includes("ECONOMIQUE") ||
                        l.text.includes("AVEC ÉCHANGE") ||
                        l.text.includes("AVEC ECHANGE") ||
                        l.text.includes("CLASSIQUE") ||
                        l.text.includes("AVEC ACCUSÉ") ||
                        l.text.includes("AVEC ACCUSE")
                    );
                    if (typeLineIdx !== -1) {
                        const typeLine = lines[typeLineIdx].text;
                        if (typeLine.includes("E-COMMERCE")) parcel.type = "E-COMMERCE";
                        else if (typeLine.includes("PARTICULIER")) parcel.type = "PARTICULIER";
                        else if (typeLine.includes("ECONOMIQUE")) parcel.type = "ECONOMIQUE";
                        else if (typeLine.includes("AVEC ÉCHANGE") || typeLine.includes("AVEC ECHANGE")) parcel.type = "AVEC ÉCHANGE";
                        else if (typeLine.includes("CLASSIQUE")) parcel.type = "CLASSIQUE";
                        else if (typeLine.includes("AVEC ACCUSÉ") || typeLine.includes("AVEC ACCUSE")) parcel.type = "AVEC ACCUSÉ";
                    }

                    // ============ استخراج معلومات المرسل (Expéditeur) ============
                    const expIdx = lines.findIndex(l => l.text.includes("Expéditeur"));
                    if (expIdx !== -1) {
                        if (expIdx + 1 < lines.length) {
                            parcel.sender = lines[expIdx + 1].text.trim();
                        }
                        if (expIdx + 2 < lines.length) {
                            parcel.senderAddress = lines[expIdx + 2].text.trim();
                        }
                        if (expIdx + 3 < lines.length) {
                            let senderPhoneLine = lines[expIdx + 3].text;
                            senderPhoneLine = senderPhoneLine.replace(/\+213/g, "0");
                            let cleanedLine = senderPhoneLine.replace(/[^\d]/g, "");
                            const senderPhones = cleanedLine.match(/0[5-7]\d{8}/g);
                            if (senderPhones) {
                                parcel.senderPhone = senderPhones[0];
                                if (senderPhones.length > 1) parcel.senderPhone2 = senderPhones[1];
                            }
                        }
                    }

                    // ============ الاستراتيجية الجديدة لاستخراج بيانات المستلم ============
                    const destIdx = lines.findIndex(l => l.text.includes("Destinataire"));

                    if (destIdx !== -1) {
                        const maxLines = 10;
                        let destLines = [];

                        for (let j = destIdx + 1; j < Math.min(destIdx + 1 + maxLines, lines.length); j++) {
                            const lineText = lines[j].text.trim();

                            // توقف عند الكلمات الدالة على نهاية قسم المستلم
                            if (
                                lineText.includes("Description") ||
                                lineText.includes("Recouvrement") ||
                                lineText.includes("Assurance") ||
                                lineText.includes("trajet") ||
                                lineText.includes("Expéditeur")
                            ) break;

                            // تجاهل الأسطر الفارغة
                            if (lineText.length === 0) continue;

                            // تجاهل أرقام الولايات (1-58) وأكواد الجهات مثل EOE1, OES1, STI1
                            const isWilayaNumber = /^\d{1,2}$/.test(lineText) && parseInt(lineText) >= 1 && parseInt(lineText) <= 58;
                            const isZoneCode = /^[A-Z]{2,4}\d{1,2}$/.test(lineText);
                            const isBigNumber = /^\d{4,}$/.test(lineText);
                            if (isWilayaNumber || isZoneCode || isBigNumber) continue;

                            destLines.push(lineText);
                        }

                        // ── الخطوة 1: البحث عن سطر الهاتف من الأسفل ──
                        // الهاتف دائماً آخر بيانات المستلم
                        let phoneLineIdx = -1;
                        for (let j = destLines.length - 1; j >= 0; j--) {
                            const phoneCleaned = destLines[j].replace(/\+213/g, "0").replace(/[^\d]/g, "");
                            const phones = phoneCleaned.match(/0[5-7]\d{8}/g);
                            if (phones) {
                                parcel.phone = phones[0];
                                if (phones.length > 1) parcel.phone2 = phones[1];
                                phoneLineIdx = j;
                                break;
                            }
                        }

                        // ── الخطوة 2: السطر الذي قبل الهاتف مباشرة = البلدية، الولاية ──
                        // البلدية والولاية مفصولان بفاصلة: "Magrane, El Oued"
                        let munLineIdx = -1;
                        if (phoneLineIdx > 0) {
                            munLineIdx = phoneLineIdx - 1;
                            let munLine = destLines[munLineIdx];

                            // إزالة أي هاتف قد يكون اختلط بالسطر
                            munLine = munLine.replace(/\+213/g, "0").replace(/0[5-7]\d{8}/g, "").trim();
                            // إزالة أكواد الجهات مثل EOE1, OES1, STI1 وأرقام الولايات المنفردة
                            munLine = munLine.replace(/\b[A-Z]{2,4}\d{1,2}\b/g, "").trim();
                            munLine = munLine.replace(/\b\d{1,2}\b/g, "").trim();
                            munLine = munLine.replace(/[,،]+/g, ",");

                            const parts = munLine.split(",").map(p => p.trim()).filter(p => p.length > 0);
                            if (parts.length >= 1) parcel.municipality = parts[0];
                            if (parts.length >= 2) parcel.wilaya = parts[1];
                        } else if (phoneLineIdx === 0) {
                            // الهاتف في أول سطر — نبحث عن فاصلة في أسطر أخرى
                            for (let j = 0; j < destLines.length; j++) {
                                if (destLines[j].includes(",") || destLines[j].includes("،")) {
                                    let munLine = destLines[j].replace(/\+213/g, "0").replace(/0[5-7]\d{8}/g, "").trim();
                                    munLine = munLine.replace(/\b[A-Z]{2,4}\d{1,2}\b/g, "").trim();
                                    munLine = munLine.replace(/\b\d{1,2}\b/g, "").trim();
                                    munLine = munLine.replace(/[,،]+/g, ",");
                                    const parts = munLine.split(",").map(p => p.trim()).filter(p => p.length > 0);
                                    if (parts.length >= 1) parcel.municipality = parts[0];
                                    if (parts.length >= 2) parcel.wilaya = parts[1];
                                    munLineIdx = j;
                                    break;
                                }
                            }
                        }

                        // ── الخطوة 3: السطر الأول = الاسم ──
                        if (destLines.length > 0) {
                            parcel.receiver = destLines[0].replace(/^\*+\s*|^\.\s*/, "").trim();
                        }

                        // ── الخطوة 4: ما بين الاسم وسطر البلدية = العنوان (اختياري) ──
                        // نتجاهل الأسطر التي تبدو تفسيراً ثانوياً
                        const addressEndIdx = munLineIdx > 0 ? munLineIdx : (phoneLineIdx > 0 ? phoneLineIdx : destLines.length);
                        if (addressEndIdx > 1) {
                            let addressParts = [];
                            for (let j = 1; j < addressEndIdx; j++) {
                                const line = destLines[j];
                                // تجاهل أسطر التفسير الفرنسية الثانوية
                                if (/Autorisation|ouverture|colis/i.test(line)) continue;
                                // تجاهل السطر إذا كان نفس اسم المستلم بلغة أخرى
                                if (line === parcel.municipality || line === parcel.wilaya) continue;
                                addressParts.push(line);
                            }
                            parcel.receiverAddress = addressParts.join(" ").trim();
                        }
                    }

                    // ============ استخراج المحتوى والمبلغ ============
                    // نبحث عن "Recouvrement" في العناصر الخام للحصول على موقعه المكاني
                    const recRawItem = textContent.items.find(it => it.str.trim() === "Recouvrement");
                    const recIdx = lines.findIndex(l => l.text.includes("Recouvrement"));

                    if (recIdx !== -1) {
                        // --- استخراج المحتوى (الوصف) ---
                        // نجمع أسطر الوصف حتى نصل لـ Assurance أو نهاية البيانات
                        let contentParts = [];
                        for (let j = recIdx + 1; j < lines.length; j++) {
                            const lt = lines[j].text.trim();
                            if (
                                lt.includes("Assurance") ||
                                lt.includes("Utilisez") ||
                                lt.includes("Taille") ||
                                lt.includes("Moins de") ||
                                lt.includes("Poids")
                            ) break;
                            if (lt.length === 0) continue;
                            contentParts.push(lt);
                        }

                        // نزيل المبالغ المضمّنة في الوصف (مثل 5900DA أو DA 3300)
                        let rawContent = contentParts.join(" ");
                        rawContent = rawContent.replace(/\bDA\s*\d[\d\s]*/gi, "").trim();
                        rawContent = rawContent.replace(/\d[\d\s]*\s*DA\b/gi, "").trim();
                        parcel.content = rawContent;

                        // --- استخراج المبلغ من عمود Recouvrement بالموقع المكاني ---
                        if (recRawItem) {
                            const recX = recRawItem.transform[4];
                            const recY = recRawItem.transform[5];

                            // نجمع كل العناصر الواقعة أسفل "Recouvrement" وفي نفس العمود
                            const candidateItems = textContent.items.filter(it => {
                                const x = it.transform[4];
                                const y = it.transform[5];
                                const s = it.str.trim();
                                return (
                                    s.length > 0 &&
                                    y < recY &&          // أسفل رأس العمود
                                    y > recY - 200 &&    // ضمن نطاق الجدول
                                    x >= recX - 20       // في عمود Recouvrement أو بعده
                                );
                            });

                            const candidateText = candidateItems.map(it => it.str.trim()).join(" ");

                            // نبحث عن مبلغ رقمي متبوع بـ DA أو مسبوق بـ DA
                            const amountMatchAfter = candidateText.match(/(\d[\d\s]*)\s*DA/i);
                            const amountMatchBefore = candidateText.match(/DA\s*(\d[\d\s]*)/i);

                            if (amountMatchAfter) {
                                parcel.amount = amountMatchAfter[1].replace(/\s/g, "");
                            } else if (amountMatchBefore) {
                                parcel.amount = amountMatchBefore[1].replace(/\s/g, "");
                            }
                        }

                        // --- Fallback: إذا فشل البحث بالموقع ---
                        if (!parcel.amount || parcel.amount === "0") {
                            // نبحث في أسطر الوصف عن مبلغ
                            // نأخذ آخر مبلغ في النص (الأقرب لعمود Recouvrement)
                            const allContentText = contentParts.join(" ");
                            const allAmounts = [...allContentText.matchAll(/(\d+)\s*DA|DA\s*(\d+)/gi)];
                            if (allAmounts.length > 0) {
                                const last = allAmounts[allAmounts.length - 1];
                                parcel.amount = (last[1] || last[2]).replace(/\s/g, "");
                            }
                        }
                    }

                    // ============ استخراج تاريخ الإنشاء ============
                    const dateLineIdx = lines.findIndex(l => l.text.match(/le:\s*\d{2}-\d{2}-\d{4}/));
                    if (dateLineIdx !== -1) {
                        const dateMatch = lines[dateLineIdx].text.match(/(\d{2}-\d{2}-\d{4})/);
                        if (dateMatch) parcel.createdDate = dateMatch[1];
                    }

                    // ============ إضافة الطرد إلى القائمة ============
                    if (parcel.tracking) {
                        extractedParcels.push({
                            id: Date.now() + Math.random(),
                            tracking: parcel.tracking,
                            type: parcel.type || "غير محدد",
                            sender: parcel.sender || "غير محدد",
                            senderAddress: parcel.senderAddress || "",
                            senderPhone: parcel.senderPhone ? parcel.senderPhone.replace(/\s/g, "") : "",
                            senderPhone2: parcel.senderPhone2 ? parcel.senderPhone2.replace(/\s/g, "") : "",
                            receiver: parcel.receiver || "مجهول",
                            address: parcel.receiverAddress || "",
                            municipality: parcel.municipality || "",
                            wilaya: parcel.wilaya || "",
                            phone: parcel.phone ? parcel.phone.replace(/\s/g, "") : "",
                            phone2: parcel.phone2 ? parcel.phone2.replace(/\s/g, "") : "",
                            pin: parcel.pin || "",
                            content: parcel.content || "",
                            amount: parcel.amount || 0,
                            createdDate: parcel.createdDate || "",
                            notes: "",
                            status: "دون إجراء",
                            expanded: false
                        });
                    }
                }
            }

            extractedParcels.sort((a, b) => (a.municipality || "").localeCompare(b.municipality || "", "ar"));
            this.findAndMerge(extractedParcels);
            this.saveData();
            this.$nextTick(() => {
                this.initSortable();
                this.showImportSummary = true;
            });
            this.clearFilters();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء قراءة ملف PDF: " + error.message);
        } finally {
            this.isProcessingPdf = false;
            this.$refs.pdfInput.value = "";
        }
    }
};
