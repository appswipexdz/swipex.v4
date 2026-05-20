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
            // أرشفة الطرود الحالية قبل الاستيراد
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

            // ================================================================
            // دالة مساعدة: استخراج أرقام الهاتف من نص
            // تتعامل مع: +213، فاصلة، شرطة مائلة، مسافة بين رقمين
            // ================================================================
            const extractPhones = (text) => {
                const normalized = text.replace(/\+213/g, "0");
                const segments = normalized.split(/[\s/،,|]+/);
                const phones = [];
                for (const seg of segments) {
                    const cleaned = seg.replace(/[^\d]/g, "");
                    const found = cleaned.match(/0[5-7]\d{8}/g);
                    if (found) phones.push(...found);
                }
                return phones;
            };

            // ================================================================
            // دالة مساعدة: تنظيف سطر البلدية/الولاية
            // تزيل: أرقام الهاتف، أكواد الجهة (EOE1...)، أرقام الولايات (1-58)
            // ================================================================
            const cleanMunLine = (text) => {
                let t = text.replace(/\+213/g, "0");
                // إزالة أرقام الهاتف أولاً
                const segs = t.split(/[\s/،,|]+/);
                for (const seg of segs) {
                    const c = seg.replace(/[^\d]/g, "");
                    if (/^0[5-7]\d{8}$/.test(c)) t = t.replace(seg, "");
                }
                // إزالة أكواد الجهة مثل EOE1, OES1, BEM1
                t = t.replace(/\b[A-Z]{2,4}\d{1,2}\b/g, "");
                // إزالة أرقام الولايات المنفردة (1-58)
                t = t.replace(/\b([1-9]|[1-4]\d|5[0-8])\b/g, "");
                // توحيد الفواصل
                t = t.replace(/[,،]+/g, ",");
                return t.trim();
            };

            // ================================================================
            // دالة مساعدة: استخراج المبلغ بالإحداثيات
            // تستهدف الرقم الذي يقع أسفل خلية Recouvrement مباشرةً في الجدول
            // الهامش الضيق (20px) يضمن البحث في عمود Recouvrement فقط
            // ويستبعد تلقائياً أرقام عمود المحتوى الأيسر (مقاسات، كميات...)
            // ================================================================
            const extractAmountByCoords = (items, recItem) => {
                const recX = recItem.x;
                const recY = recItem.y;

                // هامش ضيق: فقط العناصر في عمود Recouvrement أو أيمن منه
                // العناصر الأيسر (محتوى الطرد) تُستبعد تلقائياً
                const colTolerance = 20;

                // البحث عن item يحتوي رقماً فقط (بدون DA) في نفس العمود وأسفل Recouvrement
                const numericCandidate = items
                    .filter(it =>
                        it.y < recY &&                        // أسفل Recouvrement
                        it.y > recY - 80 &&                   // لكن ليس بعيداً جداً (80px كحد أقصى)
                        it.x >= recX - colTolerance &&        // في عمود Recouvrement أو أيمن منه
                        /^\d[\d\s]*$/.test(it.s.trim())       // رقم فقط (لا يحتوي حروف)
                    )
                    .sort((a, b) => b.y - a.y)               // الأقرب لـ Recouvrement أولاً
                [0];

                if (numericCandidate) {
                    return numericCandidate.s.replace(/\s/g, "");
                }

                // Fallback: البحث عن "XXXX DA" أو "DA XXXX" في نفس العمود
                const daCandidate = items
                    .filter(it =>
                        it.y < recY &&
                        it.y > recY - 80 &&
                        it.x >= recX - colTolerance &&
                        /\b\d+\s*DA\b|\bDA\s*\d+\b/i.test(it.s)
                    )
                    .sort((a, b) => b.y - a.y)[0];

                if (daCandidate) {
                    const m = daCandidate.s.match(/\d[\d\s]*/);
                    if (m) return m[0].replace(/\s/g, "");
                }

                return null;
            };

            // ================================================================
            // معالجة كل صفحة
            // ================================================================
            for (let i = 1; i <= pdf.numPages; i++) {
                this.pdfProgress = `معالجة صفحة ${i} من ${pdf.numPages}`;
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const view = page.getViewport({ scale: 1 });

                const fullRaw = textContent.items.map(it => it.str).join(" ");
                if (fullRaw.length < 50) continue;

                // تقسيم الصفحة إلى 4 أرباع — كل ربع = قسيمة واحدة
                const midX = view.width / 2;
                const midY = view.height / 2;
                const qData = { TL: [], TR: [], BL: [], BR: [] };

                textContent.items.forEach(it => {
                    const x = it.transform[4];
                    const y = it.transform[5];
                    const s = it.str.trim();
                    if (!s) return;
                    const itm = { s, x, y };
                    if      (x <  midX && y >  midY) qData.TL.push(itm);
                    else if (x >= midX && y >  midY) qData.TR.push(itm);
                    else if (x <  midX && y <= midY) qData.BL.push(itm);
                    else if (x >= midX && y <= midY) qData.BR.push(itm);
                });

                // ============================================================
                // معالجة كل ربع (قسيمة) على حدة
                // ============================================================
                for (const key in qData) {
                    // ترتيب العناصر: من الأعلى للأسفل، ومن اليسار لليمين
                    const items = qData[key].sort((a, b) =>
                        b.y !== a.y ? b.y - a.y : a.x - b.x
                    );
                    if (items.length < 5) continue;

                    // دمج العناصر التي على نفس السطر (فارق y أقل من 5)
                    const lines = [];
                    items.forEach(it => {
                        const last = lines[lines.length - 1];
                        if (last && Math.abs(it.y - last.y) < 5) {
                            last.text += " " + it.s;
                        } else {
                            lines.push({ y: it.y, text: it.s });
                        }
                    });

                    // ----------------------------------------------------------
                    // كائن الطرد
                    // ----------------------------------------------------------
                    const parcel = {
                        tracking:        "",
                        type:            "",
                        sender:          "",
                        senderAddress:   "",
                        senderPhone:     "",
                        senderPhone2:    "",
                        receiver:        "",
                        receiverAddress: "",
                        municipality:    "",
                        wilaya:          "",
                        phone:           "",
                        phone2:          "",
                        pin:             "",
                        content:         "",
                        amount:          "0",
                        createdDate:     ""
                    };

                    // ── رقم التتبع (شرط أساسي للمتابعة) ──
                    const tLine = lines.find(l => l.text.includes("YAL-"));
                    if (!tLine) continue;
                    const trackMatch = tLine.text.match(/YAL-[A-Z0-9]+/);
                    if (!trackMatch) continue;
                    parcel.tracking = trackMatch[0];

                    // ── رقم PIN ──
                    const pinMatch = tLine.text.match(/PIN:\s*(\d+)/);
                    if (pinMatch) parcel.pin = pinMatch[1];

                    // ── نوع الطرد ──
                    const typeKeywords = [
                        "E-COMMERCE", "PARTICULIER", "ECONOMIQUE",
                        "AVEC ÉCHANGE", "AVEC ECHANGE",
                        "CLASSIQUE", "AVEC ACCUSÉ", "AVEC ACCUSE"
                    ];
                    const typeLine = lines.find(l => typeKeywords.some(k => l.text.includes(k)));
                    if (typeLine) {
                        const t = typeLine.text;
                        if      (t.includes("E-COMMERCE"))                                  parcel.type = "E-COMMERCE";
                        else if (t.includes("PARTICULIER"))                                 parcel.type = "PARTICULIER";
                        else if (t.includes("ECONOMIQUE"))                                  parcel.type = "ECONOMIQUE";
                        else if (t.includes("AVEC ÉCHANGE") || t.includes("AVEC ECHANGE")) parcel.type = "AVEC ÉCHANGE";
                        else if (t.includes("CLASSIQUE"))                                   parcel.type = "CLASSIQUE";
                        else if (t.includes("AVEC ACCUSÉ") || t.includes("AVEC ACCUSE"))   parcel.type = "AVEC ACCUSÉ";
                    }

                    // ── بيانات المرسل (Expéditeur) ──
                    const expIdx = lines.findIndex(l => l.text.includes("Expéditeur"));
                    if (expIdx !== -1) {
                        if (expIdx + 1 < lines.length)
                            parcel.sender = lines[expIdx + 1].text.trim();
                        if (expIdx + 2 < lines.length)
                            parcel.senderAddress = lines[expIdx + 2].text.trim();
                        if (expIdx + 3 < lines.length) {
                            const sPhones = extractPhones(lines[expIdx + 3].text);
                            if (sPhones.length > 0) parcel.senderPhone  = sPhones[0];
                            if (sPhones.length > 1) parcel.senderPhone2 = sPhones[1];
                        }
                    }

                    // ── بيانات المستلم (Destinataire) ──
                    const destIdx = lines.findIndex(l => l.text.includes("Destinataire"));
                    if (destIdx !== -1) {
                        const destLines = [];
                        for (let j = destIdx + 1; j < Math.min(destIdx + 11, lines.length); j++) {
                            const lt = lines[j].text.trim();

                            if (
                                lt.includes("Description") ||
                                lt.includes("Recouvrement") ||
                                lt.includes("Assurance") ||
                                lt.includes("trajet") ||
                                lt.includes("Expéditeur")
                            ) break;

                            if (!lt) continue;

                            const isWilayaNum = /^\d{1,2}$/.test(lt) && +lt >= 1 && +lt <= 58;
                            const isZoneCode  = /^([A-Z]{2,4}\d{1,2}\s*)+$/.test(lt);
                            const isPhone     = /^0[5-7]\d{8}$/.test(lt);
                            const isBigNum    = /^\d{4,}$/.test(lt) && !isPhone;

                            if (isWilayaNum || isZoneCode || isBigNum) continue;

                            const cleaned = lt
                                .replace(/\b[A-Z]{2,4}\d{1,2}\b/g, "")
                                .replace(/\s{2,}/g, " ")
                                .trim();

                            if (!cleaned) continue;
                            destLines.push(cleaned);
                        }

                        // الخطوة 1: الهاتف — دائماً آخر سطر من الأسفل
                        let phoneLineIdx = -1;
                        for (let j = destLines.length - 1; j >= 0; j--) {
                            const phones = extractPhones(destLines[j]);
                            if (phones.length > 0) {
                                parcel.phone  = phones[0];
                                if (phones.length > 1) parcel.phone2 = phones[1];
                                phoneLineIdx = j;
                                break;
                            }
                        }

                        // الخطوة 2: البلدية والولاية — السطر الذي فوق الهاتف مباشرة
                        let munLineIdx = -1;
                        if (phoneLineIdx > 0) {
                            munLineIdx = phoneLineIdx - 1;
                            const cleaned = cleanMunLine(destLines[munLineIdx]);
                            const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
                            if (parts.length >= 1) parcel.municipality = parts[0];
                            if (parts.length >= 2) parcel.wilaya       = parts[1];
                        } else if (phoneLineIdx === 0) {
                            for (let j = 0; j < destLines.length; j++) {
                                if (destLines[j].includes(",") || destLines[j].includes("،")) {
                                    const cleaned = cleanMunLine(destLines[j]);
                                    const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
                                    if (parts.length >= 1) parcel.municipality = parts[0];
                                    if (parts.length >= 2) parcel.wilaya       = parts[1];
                                    munLineIdx = j;
                                    break;
                                }
                            }
                        }

                        // الخطوة 3: الاسم — دائماً السطر الأول
                        if (destLines.length > 0) {
                            parcel.receiver = destLines[0]
                                .replace(/^\*+\s*|^\.\s*/, "")
                                .trim();
                        }

                        // الخطوة 4: العنوان — ما بين الاسم وسطر البلدية
                        const addrEnd = munLineIdx > 0
                            ? munLineIdx
                            : (phoneLineIdx > 0 ? phoneLineIdx : destLines.length);
                        if (addrEnd > 1) {
                            const addrParts = [];
                            for (let j = 1; j < addrEnd; j++) {
                                const ln = destLines[j];
                                if (/Autorisation|ouverture|colis/i.test(ln)) continue;
                                if (ln === parcel.municipality || ln === parcel.wilaya) continue;
                                addrParts.push(ln);
                            }
                            parcel.receiverAddress = addrParts.join(" ").trim();
                        }
                    }

                    // ── المحتوى والمبلغ ──
                    const recIdx  = lines.findIndex(l => l.text.includes("Recouvrement"));
                    // إيجاد item "Recouvrement" في المصفوفة الأصلية للإحداثيات
                    const recItem = items.find(it => it.s.includes("Recouvrement"));

                    if (recIdx !== -1) {
                        // جمع أسطر الوصف (ما بعد Recouvrement حتى Assurance/Taille/Poids...)
                        const contentParts = [];
                        for (let j = recIdx + 1; j < lines.length; j++) {
                            const lt = lines[j].text.trim();
                            if (
                                lt.includes("Assurance") ||
                                lt.includes("Utilisez") ||
                                lt.includes("Taille") ||
                                lt.includes("Moins de") ||
                                lt.includes("Poids")
                            ) break;
                            if (!lt) continue;
                            contentParts.push(lt);
                        }

                        // تنظيف الوصف: إزالة المبالغ المضمّنة (5900DA أو DA 3300)
                        let rawContent = contentParts.join(" ");
                        rawContent = rawContent.replace(/\bDA\s*\d[\d\s]*/gi, "").trim();
                        rawContent = rawContent.replace(/\d[\d\s]*\s*DA\b/gi, "").trim();
                        parcel.content = rawContent;

                        // ── استخراج المبلغ بالإحداثيات ──
                        // المنهج: نستهدف الرقم الذي يقع في عمود Recouvrement مباشرةً
                        // هذا يتجنب التقاط أرقام من عمود محتوى الطرد (عمود أيسر مختلف)
                        if (recItem) {
                            const coordAmount = extractAmountByCoords(items, recItem);
                            if (coordAmount) {
                                parcel.amount = coordAmount;
                            }
                        }

                        // Fallback نهائي: إذا فشل كل شيء، ابحث في أسطر lines المدمجة
                        // لكن مع تقييد صارم: السطر يجب أن يكون رقماً + DA فقط (بدون نص آخر)
                        if (!parcel.amount || parcel.amount === "0") {
                            for (let j = recIdx + 1; j < Math.min(recIdx + 4, lines.length); j++) {
                                const lt = lines[j].text.trim();
                                // يجب أن يكون السطر رقماً + DA فقط — لا نص آخر
                                const strictMatch = lt.match(/^(DA\s*)?([\d\s]{3,})(\s*DA)?$/i);
                                if (strictMatch) {
                                    const val = (strictMatch[2] || "").replace(/\s/g, "");
                                    if (val.length >= 3) {
                                        parcel.amount = val;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // ── تاريخ الإنشاء ──
                    const dateLine = lines.find(l => /le:\s*\d{2}-\d{2}-\d{4}/.test(l.text));
                    if (dateLine) {
                        const dm = dateLine.text.match(/(\d{2}-\d{2}-\d{4})/);
                        if (dm) parcel.createdDate = dm[1];
                    }

                    // ── إضافة الطرد للقائمة ──
                    extractedParcels.push({
                        id:            Date.now() + Math.random(),
                        tracking:      parcel.tracking,
                        type:          parcel.type           || "غير محدد",
                        sender:        parcel.sender         || "غير محدد",
                        senderAddress: parcel.senderAddress  || "",
                        senderPhone:   parcel.senderPhone    ? parcel.senderPhone.replace(/\s/g, "")  : "",
                        senderPhone2:  parcel.senderPhone2   ? parcel.senderPhone2.replace(/\s/g, "") : "",
                        receiver:      parcel.receiver       || "مجهول",
                        address:       parcel.receiverAddress || "",
                        municipality:  parcel.municipality   || "",
                        wilaya:        parcel.wilaya         || "",
                        phone:         parcel.phone          ? parcel.phone.replace(/\s/g, "")  : "",
                        phone2:        parcel.phone2         ? parcel.phone2.replace(/\s/g, "") : "",
                        pin:           parcel.pin            || "",
                        content:       parcel.content        || "",
                        amount:        parcel.amount         || 0,
                        createdDate:   parcel.createdDate    || "",
                        notes:         "",
                        status:        "دون إجراء",
                        expanded:      false
                    });
                }
            }

            extractedParcels.sort((a, b) =>
                (a.municipality || "").localeCompare(b.municipality || "", "ar")
            );
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