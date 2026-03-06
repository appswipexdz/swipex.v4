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

                    // استخراج رقم التتبع
                    const tLine = lines.find(l => l.text.includes("YAL-"));
                    if (tLine) {
                        const m = tLine.text.match(/YAL-[A-Z0-9]+/);
                        if (m) parcel.tracking = m[0];
                    }
                    if (!parcel.tracking) continue;

                    // استخراج رقم PIN
                    const pinMatch = tLine.text.match(/PIN:\s*(\d+)/);
                    if (pinMatch) parcel.pin = pinMatch[1];

                    // تحديد نوع الطرد
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

                    // استخراج معلومات المرسل (Expéditeur)
                    const expIdx = lines.findIndex(l => l.text.includes("Expéditeur"));
                    if (expIdx !== -1) {
                        // السطر التالي يحتوي على اسم المرسل
                        if (expIdx + 1 < lines.length) {
                            parcel.sender = lines[expIdx + 1].text.trim();
                        }
                        
                        // السطر الذي بعده يحتوي على عنوان المرسل
                        if (expIdx + 2 < lines.length) {
                            parcel.senderAddress = lines[expIdx + 2].text.trim();
                        }
                        
                        // السطر الذي بعده يحتوي على هاتف المرسل
                        if (expIdx + 3 < lines.length) {
                            let senderPhoneLine = lines[expIdx + 3].text;
                            // تحويل +213 إلى 0
                            senderPhoneLine = senderPhoneLine.replace(/\+213/g, "0");
                            // إزالة كل الرموز غير الأرقام
                            let cleanedLine = senderPhoneLine.replace(/[^\d]/g, "");
                            // البحث عن أرقام الهاتف (10 أرقام تبدأ بـ 05 أو 06 أو 07)
                            const senderPhones = cleanedLine.match(/0[567]\d{8}/g);
                            if (senderPhones) {
                                parcel.senderPhone = senderPhones[0];
                                if (senderPhones.length > 1) parcel.senderPhone2 = senderPhones[1];
                            }
                        }
                    }

                    // ============ الاستراتيجية المحسّنة لاستخراج بيانات المستلم ============
                    const destIdx = lines.findIndex(l => l.text.includes("Destinataire"));
                    
                    if (destIdx !== -1) {
                        // جمع الأسطر التالية لكلمة Destinataire (حتى 7 أسطر كحد أقصى)
                        const maxLines = 7;
                        let destLines = [];
                        
                        for (let j = destIdx + 1; j < Math.min(destIdx + 1 + maxLines, lines.length); j++) {
                            const lineText = lines[j].text.trim();
                            
                            // تجاهل الأسطر التي تحتوي على كلمات مفتاحية غير مرغوبة
                            if (lineText.includes("Description") || 
                                lineText.includes("Recouvrement") ||
                                lineText.includes("Assurance") ||
                                lineText.includes("trajet")) {
                                break;
                            }
                            
                            // تجاهل الأسطر التي تحتوي فقط على رموز محددة
                            const isCode = /^[A-Z]{2,4}\d{1,2}$/.test(lineText);
                            const isBigNumber = /^(39|3911|3912|3917|3913|3914|3915|3916|3918|3919)$/.test(lineText);
                            const isCommonWord = /^(commune|retour|EOE|OES|ESE|CHU|STI|TIP|EKR|TZO)/.test(lineText);
                            
                            if (isCode || isBigNumber || isCommonWord) {
                                continue;
                            }
                            
                            // إضافة السطر إلى قائمة أسطر المستلم
                            if (lineText.length > 0) {
                                destLines.push(lineText);
                            }
                        }
                        
                        // الآن نحلل الأسطر المجمّعة
                        // نبحث عن سطر يحتوي على فاصلة (البلدية والولاية)
                        let municipalityLineIdx = -1;
                        for (let j = 0; j < destLines.length; j++) {
                            if (destLines[j].includes(",") || destLines[j].includes("،")) {
                                municipalityLineIdx = j;
                                break;
                            }
                        }
                        
                        if (municipalityLineIdx !== -1) {
                            // ===== حالة وجود 4 أسطر =====
                            if (municipalityLineIdx === 2 && destLines.length >= 3) {
                                // استخراج الاسم (السطر الأول)
                                parcel.receiver = destLines[0].replace(/^\*+\s*|^\.\s*|^\s+/, "").trim();
                                
                                // استخراج العنوان (السطر الثاني)
                                parcel.receiverAddress = destLines[1].trim();
                                
                                // استخراج البلدية والولاية (السطر الثالث)
                                let municipalityLine = destLines[2];
                                
                                // البحث عن أرقام الهاتف في هذا السطر أولاً
                                const phonesInMunLine = municipalityLine.match(/0[567]\d{8}/g) || [];
                                
                                // إزالة أرقام الهواتف من سطر البلدية
                                phonesInMunLine.forEach(phone => {
                                    municipalityLine = municipalityLine.replace(phone, "");
                                });
                                
                                // تنظيف وتقسيم البلدية والولاية
                                municipalityLine = municipalityLine.replace(/[,،]+/g, ",").trim();
                                const parts = municipalityLine.split(",").map(p => p.trim()).filter(p => p.length > 0);
                                if (parts.length >= 1) parcel.municipality = parts[0];
                                if (parts.length >= 2) parcel.wilaya = parts[1];
                                
                                // استخراج أرقام الهاتف
                                // أولاً: من السطر الرابع إن وُجد
                                if (destLines.length > 3) {
                                    const phoneLine = destLines[3];
                                    const phones = phoneLine.match(/0[567]\d{8}/g);
                                    if (phones && phones.length > 0) {
                                        parcel.phone = phones[0];
                                        if (phones.length > 1) parcel.phone2 = phones[1];
                                    }
                                }
                                
                                // ثانياً: إذا لم نجد في السطر الرابع، نأخذ من سطر البلدية
                                if (!parcel.phone && phonesInMunLine.length > 0) {
                                    parcel.phone = phonesInMunLine[0];
                                    if (phonesInMunLine.length > 1) parcel.phone2 = phonesInMunLine[1];
                                }
                                
                                // ثالثاً: البحث في جميع الأسطر المتبقية
                                if (!parcel.phone) {
                                    for (let k = 3; k < destLines.length; k++) {
                                        const phones = destLines[k].match(/0[567]\d{8}/g);
                                        if (phones && phones.length > 0) {
                                            parcel.phone = phones[0];
                                            if (phones.length > 1) parcel.phone2 = phones[1];
                                            break;
                                        }
                                    }
                                }
                            }
                            // ===== حالة وجود 5 أسطر =====
                            else if (municipalityLineIdx === 3 && destLines.length >= 4) {
                                // استخراج الاسم (السطر الأول)
                                parcel.receiver = destLines[0].replace(/^\*+\s*|^\.\s*|^\s+/, "").trim();
                                
                                // استخراج العنوان (السطرين الثاني والثالث)
                                parcel.receiverAddress = (destLines[1] + " " + destLines[2]).trim();
                                
                                // استخراج البلدية والولاية (السطر الرابع)
                                let municipalityLine = destLines[3];
                                
                                // البحث عن أرقام الهاتف في هذا السطر أولاً
                                const phonesInMunLine = municipalityLine.match(/0[567]\d{8}/g) || [];
                                
                                // إزالة أرقام الهواتف من سطر البلدية
                                phonesInMunLine.forEach(phone => {
                                    municipalityLine = municipalityLine.replace(phone, "");
                                });
                                
                                // تنظيف وتقسيم
                                municipalityLine = municipalityLine.replace(/[,،]+/g, ",").trim();
                                const parts = municipalityLine.split(",").map(p => p.trim()).filter(p => p.length > 0);
                                if (parts.length >= 1) parcel.municipality = parts[0];
                                if (parts.length >= 2) parcel.wilaya = parts[1];
                                
                                // استخراج أرقام الهاتف
                                // أولاً: من السطر الخامس إن وُجد
                                if (destLines.length > 4) {
                                    const phoneLine = destLines[4];
                                    const phones = phoneLine.match(/0[567]\d{8}/g);
                                    if (phones && phones.length > 0) {
                                        parcel.phone = phones[0];
                                        if (phones.length > 1) parcel.phone2 = phones[1];
                                    }
                                }
                                
                                // ثانياً: إذا لم نجد في السطر الخامس، نأخذ من سطر البلدية
                                if (!parcel.phone && phonesInMunLine.length > 0) {
                                    parcel.phone = phonesInMunLine[0];
                                    if (phonesInMunLine.length > 1) parcel.phone2 = phonesInMunLine[1];
                                }
                                
                                // ثالثاً: البحث في جميع الأسطر المتبقية
                                if (!parcel.phone) {
                                    for (let k = 4; k < destLines.length; k++) {
                                        const phones = destLines[k].match(/0[567]\d{8}/g);
                                        if (phones && phones.length > 0) {
                                            parcel.phone = phones[0];
                                            if (phones.length > 1) parcel.phone2 = phones[1];
                                            break;
                                        }
                                    }
                                }
                            }
                            // ===== حالات أخرى (احتياطي) =====
                            else {
                                // نحاول استخراج البيانات بطريقة مرنة
                                // الاسم دائماً في السطر الأول
                                if (destLines.length > 0) {
                                    parcel.receiver = destLines[0].replace(/^\*+\s*|^\.\s*|^\s+/, "").trim();
                                }
                                
                                // البلدية والولاية في السطر الذي يحتوي على فاصلة
                                let municipalityLine = destLines[municipalityLineIdx];
                                const phonesInMunLine = municipalityLine.match(/0[567]\d{8}/g) || [];
                                phonesInMunLine.forEach(phone => {
                                    municipalityLine = municipalityLine.replace(phone, "");
                                });
                                municipalityLine = municipalityLine.replace(/[,،]+/g, ",").trim();
                                const parts = municipalityLine.split(",").map(p => p.trim()).filter(p => p.length > 0);
                                if (parts.length >= 1) parcel.municipality = parts[0];
                                if (parts.length >= 2) parcel.wilaya = parts[1];
                                
                                // العنوان: كل الأسطر بين الاسم وسطر البلدية
                                let addressParts = [];
                                for (let j = 1; j < municipalityLineIdx; j++) {
                                    addressParts.push(destLines[j]);
                                }
                                parcel.receiverAddress = addressParts.join(" ").trim();
                                
                                // أرقام الهاتف: البحث في جميع الأسطر بعد سطر البلدية
                                for (let j = municipalityLineIdx; j < destLines.length; j++) {
                                    const phones = destLines[j].match(/0[567]\d{8}/g);
                                    if (phones && phones.length > 0) {
                                        parcel.phone = phones[0];
                                        if (phones.length > 1) parcel.phone2 = phones[1];
                                        break;
                                    }
                                }
                                
                                // إذا لم نجد، نأخذ من سطر البلدية نفسه
                                if (!parcel.phone && phonesInMunLine.length > 0) {
                                    parcel.phone = phonesInMunLine[0];
                                    if (phonesInMunLine.length > 1) parcel.phone2 = phonesInMunLine[1];
                                }
                            }
                        } else {
                            // ===== حالة عدم وجود فاصلة =====
                            // الاسم في السطر الأول
                            if (destLines.length > 0) {
                                parcel.receiver = destLines[0].replace(/^\*+\s*|^\.\s*|^\s+/, "").trim();
                            }
                            
                            // نبحث في جميع الأسطر عن رقم الهاتف
                            for (let j = 0; j < destLines.length; j++) {
                                const phones = destLines[j].match(/0[567]\d{8}/g);
                                if (phones && phones.length > 0) {
                                    parcel.phone = phones[0];
                                    if (phones.length > 1) parcel.phone2 = phones[1];
                                    
                                    // العنوان هو كل ما قبل سطر الهاتف (بعد الاسم)
                                    if (j > 1) {
                                        let addressParts = [];
                                        for (let k = 1; k < j; k++) {
                                            addressParts.push(destLines[k]);
                                        }
                                        parcel.receiverAddress = addressParts.join(" ").trim();
                                    }
                                    
                                    // محاولة استخراج البلدية من آخر سطر قبل الهاتف
                                    if (j > 1) {
                                        const lastLine = destLines[j - 1];
                                        const words = lastLine.split(/\s+/).filter(w => w.length > 0);
                                        if (words.length >= 2) {
                                            parcel.municipality = words[0];
                                            parcel.wilaya = words.slice(1).join(" ");
                                        } else {
                                            parcel.municipality = lastLine;
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    // استخراج المحتوى والمبلغ من قسم Recouvrement
                    const recIdx = lines.findIndex(l => l.text.includes("Recouvrement"));
                    if (recIdx !== -1 && recIdx + 1 < lines.length) {
                        const contentLine = lines[recIdx + 1].text;
                        
                        // استخراج المبلغ
                        const amountMatch = contentLine.match(/(\d+)\s*(?:DA|da|دج)/i) || 
                                          contentLine.match(/(?:DA|da|دج)\s*(\d+)/i);
                        if (amountMatch) {
                            parcel.amount = amountMatch[1];
                            // المحتوى هو الباقي بعد إزالة المبلغ
                            parcel.content = contentLine.replace(amountMatch[0], "").trim();
                        } else {
                            // إذا لم نجد المبلغ في نفس السطر، المحتوى هو السطر كاملاً
                            parcel.content = contentLine.trim();
                        }
                    }

                    // استخراج تاريخ الإنشاء
                    const dateLineIdx = lines.findIndex(l => l.text.match(/le:\s*\d{2}-\d{2}-\d{4}/));
                    if (dateLineIdx !== -1) {
                        const dateMatch = lines[dateLineIdx].text.match(/(\d{2}-\d{2}-\d{4})/);
                        if (dateMatch) parcel.createdDate = dateMatch[1];
                    }

                    // إضافة الطرد إلى القائمة إذا كان يحتوي على رقم تتبع
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