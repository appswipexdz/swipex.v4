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

    async initScanner() {
        await window.loadHeavyLib('quagga');
        if (!window.Quagga) {
            alert("مكتبة المسح الضوئي غير متوفرة");
            this.closeScanner();
            return;
        }

        const normalizeScannedCode = (code) => {
            return String(code || '')
                .replace(/[\u0000-\u001F\u007F]/g, '')
                .replace(/\s+/g, '')
                .trim();
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    aspectRatio: { ideal: 16 / 9 },
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "code_39_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "i2of5_reader"
                ],
                multiple: false
            },
            locate: true,
            locator: { 
                patchSize: "x-small",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 20
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
                const rawCode = normalizeScannedCode(result.codeResult.code);
                if (!/^[A-Za-z0-9-]+$/.test(rawCode) || rawCode.length < 3) return;

                const normalizedCode = rawCode.toLowerCase();

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
                const code = rawCode;

                if (mode === "search") {
                    this.filters.search = normalizedCode;
                    this.directSearch = normalizedCode;
                    this.showFilters = true;
                } else if (mode === "tracking" || mode === "add") {
                    this.newParcel.tracking = code;
                }

                // إغلاق الماسح
                self.$nextTick(() => self.closeScanner());
            }
        });
    }
};

if (typeof window !== 'undefined') window.scannerFunctions = scannerFunctions;