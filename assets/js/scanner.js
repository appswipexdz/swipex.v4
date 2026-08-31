const scannerFunctions = {
    openScanner(mode) {
        this.scannerMode = mode;
        this.showScanner = true;
        this.lastScannedCode = null;
        this.scannedCodeCount = 0;
        this.isProcessingCode = false;
        
        // تأخير أكبر لضمان ظهور العنصر
        setTimeout(() => {
            this.$nextTick(() => this.initScanner());
        }, 100);
    },

    closeScanner() {
        try {
            if (window.Quagga) {
                Quagga.offDetected();
                Quagga.offProcessed();
                Quagga.stop();
            }
        } catch (e) {
            console.log("خطأ في إغلاق الماسح:", e);
        }
        this.showScanner = false;
        this.scannerMode = null;
        this.lastScannedCode = null;
        this.isProcessingCode = false;
        this.scannedCodeCount = 0;
    },

    initScanner() {
        if (!window.Quagga) {
            alert("مكتبة المسح الضوئي غير متوفرة");
            this.closeScanner();
            return;
        }

        const isValidTrackingCode = (code) => {
            return /^yal-[A-Za-z0-9]{6}$/i.test(String(code || '').trim());
        };

        // التأكد من وجود العنصر
        const targetElement = document.querySelector("#scanner-viewport");
        if (!targetElement) {
            console.error("عنصر الماسح غير موجود");
            alert("خطأ في تحميل الماسح");
            this.closeScanner();
            return;
        }

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: targetElement,
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader", 
                    "ean_8_reader", 
                    "code_39_reader",
                    "upc_reader"
                ],
                multiple: false
            },
            locate: true,
            locator: { 
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10
        }, (err) => {
            if (err) {
                console.error("خطأ في تشغيل الماسح:", err);
                alert("فشل تشغيل الكاميرا. تأكد من منح الأذونات اللازمة.");
                this.closeScanner();
                return;
            }
            console.log("✓ الماسح جاهز للعمل");
            Quagga.start();
        });

        // حدث onDetected - عند كشف باركود صحيح
        Quagga.onDetected((result) => {
            // التحقق من أن القراءة لم تكن معالجة بالفعل
            if (this.isProcessingCode) return;

            if (result && result.codeResult && result.codeResult.code) {
                const rawCode = result.codeResult.code.trim();
                const normalizedCode = rawCode.toLowerCase();

                // قبول فقط تنسيق رقم التتبع: yal- + 6 أحرف/أرقام إنجليزية
                if (!isValidTrackingCode(rawCode)) {
                    console.log("🚫 تم تجاهل كود غير مطابق للتنسيق المطلوب:", rawCode);
                    return;
                }

                // تجنب قراءة الكود نفسه مرتين متتاليتين
                if (this.lastScannedCode === normalizedCode) return;

                this.lastScannedCode = normalizedCode;
                this.isProcessingCode = true;

                console.log("✓ تم مسح الكود المطلوب:", rawCode);

                // صوت التنبيه
                try {
                    const beep = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=");
                    beep.play().catch(() => {});
                } catch (e) {}

                // إدخال البيانات مباشرة
                const self = this;
                const mode = this.scannerMode;
                const code = normalizedCode;

                if (mode === "search") {
                    this.filters.search = code;
                    this.showFilters = true;
                } else if (mode === "tracking" || mode === "add") {
                    this.newParcel.tracking = code;
                }

                // إغلاق الماسح
                setTimeout(() => {
                    self.closeScanner();
                }, 500);
            }
        });
    }
};

if (typeof window !== 'undefined') window.scannerFunctions = scannerFunctions;