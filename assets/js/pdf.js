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
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const extractedParcels = [];

            // ================================================================
            // دالة مساعدة: استخراج أرقام الهاتف من نص
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
            // ================================================================
            const cleanMunLine = (text) => {
                let t = text.replace(/\+213/g, "0");
                const segs = t.split(/[\s/،,|]+/);
                for (const seg of segs) {
                    const c = seg.replace(/[^\d]/g, "");
                    if (/^0[5-7]\d{8}$/.test(c)) t = t.replace(seg, "");
                }
                t = t.replace(/\b[A-Z]{2,4}\d{1,2}\b/g, "");
                t = t.replace(/\b([1-9]|[1-4]\d|5[0-8])\b/g, "");
                t = t.replace(/[,،]+/g, ",");
                return t.trim();
            };

            // ================================================================
            // دالة مساعدة: استخراج المبلغ بالإحداثيات الثابتة
            //
            // من تحليل ملفات Yalidine/Guepex الحقيقية تبيّن:
            //   - عمود Recouvrement في الأرباع اليسرى دائماً عند x ≈ 221
            //   - عمود Recouvrement في الأرباع اليمنى دائماً عند x ≈ 516
            //
            // المشكلة: أحياناً يكون رقم من المحتوى (مثل "26") في نفس السطر
            // عند x قريب من x المبلغ (مثل "6950 DA" عند x=221 و"26" عند x=207)
            //
            // الحل: عند وجود أكثر من item في نفس السطر داخل نطاق العمود،
            // نأخذ الـ item الأكبر x (الأيمن) لأن المبلغ دائماً أيمن من رقم المحتوى
            // ================================================================
            const extractAmountByCoords = (items, recY, isRightQuad) => {
                // x الثابت لعمود Recouvrement حسب الربع
                const recX = isRightQuad ? 516 : 221;
                const colTolerance = 15;

                // جمع كل items في نطاق العمود وأسفل Recouvrement مباشرة
                const candidates = items.filter(it =>
                    it.y < recY &&
                    it.y > recY - 80 &&
                    it.x >= recX - colTolerance
                );

                if (candidates.length === 0) return null;

                // السطر الأقرب لـ Recouvrement من حيث y
                const closestY = candidates.reduce((a, b) =>
                    Math.abs(a.y - recY) < Math.abs(b.y - recY) ? a : b
                ).y;

                // كل items في نفس السطر (y قريب من closestY)
                const sameLine = candidates.filter(it => Math.abs(it.y - closestY) < 3);

                // نأخذ الأيمن (أكبر x) — هو المبلغ دائماً
                const target = sameLine.sort((a, b) => b.x - a.x)[0];
                if (!target) return null;

                // استخراج الرقم من النص (يتعامل مع "6950 DA" و "DA 4000" و "6950")
                const m = target.s.match(/\d[\d\s]*/);
                return m ? m[0].replace(/\s/g, "") : null;
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
                    const isRightQuad = key === "TR" || key === "BR";

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

                    // ── المحتوى ──
                    const recIdx = lines.findIndex(l => l.text.includes("Recouvrement"));

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

                        // تنظيف الوصف: إزالة المبالغ المضمّنة
                        let rawContent = contentParts.join(" ");
                        rawContent = rawContent.replace(/\bDA\s*\d[\d\s]*/gi, "").trim();
                        rawContent = rawContent.replace(/\d[\d\s]*\s*DA\b/gi, "").trim();
                        parcel.content = rawContent;

                        // ── استخراج المبلغ بالإحداثيات الثابتة ──
                        // recY = y الخاص بسطر Recouvrement في lines المدمجة
                        const recLineY = lines[recIdx].y;
                        const coordAmount = extractAmountByCoords(items, recLineY, isRightQuad);
                        if (coordAmount !== null) {
                            parcel.amount = coordAmount;
                        }

                        // Fallback نهائي: سطر يحتوي رقماً + DA فقط بدون نص آخر
                        if (!parcel.amount || parcel.amount === "0") {
                            for (let j = recIdx + 1; j < Math.min(recIdx + 4, lines.length); j++) {
                                const lt = lines[j].text.trim();
                                const strictMatch = lt.match(/^(DA\s*)?([\d\s]{1,})(\s*DA)?$/i);
                                if (strictMatch) {
                                    const val = (strictMatch[2] || "").replace(/\s/g, "");
                                    if (val.length >= 1) {
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

if (typeof window !== 'undefined') window.pdfFunctions = pdfFunctions;
