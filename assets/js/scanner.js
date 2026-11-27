const scannerFunctions = {
    openScanner(mode) {
        this.scannerMode = mode;
        this.showScanner = true;
        this.lastScannedCode = null;
        this.scannedCodeCount = 0;
        this.isProcessingCode = false;

        setTimeout(() => {
            this.$nextTick(() => this.initScanner());
        }, 50);
    },

    closeScanner() {
        if (this._scannerInterval) {
            clearInterval(this._scannerInterval);
            this._scannerInterval = null;
        }
        if (this._scannerStream) {
            this._scannerStream.getTracks().forEach((track) => track.stop());
            this._scannerStream = null;
        }

        const video = document.querySelector("#scanner-video");
        if (video) video.srcObject = null;

        this.showScanner = false;
        this.scannerMode = null;
        this.lastScannedCode = null;
        this.isProcessingCode = false;
        this.scannedCodeCount = 0;
    },

    async initScanner() {
        if (!("BarcodeDetector" in window)) {
            alert("المتصفح لا يدعم مسح الباركود. استخدم متصفحًا حديثًا أو أدخل الرمز يدويًا.");
            this.closeScanner();
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("تعذر الوصول إلى الكاميرا في هذا المتصفح.");
            this.closeScanner();
            return;
        }

        const video = document.querySelector("#scanner-video");
        if (!video) {
            alert("تعذر تحميل شاشة الماسح.");
            this.closeScanner();
            return;
        }

        try {
            this._scannerStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            video.srcObject = this._scannerStream;
            await video.play();

            const detector = new BarcodeDetector();
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", { alpha: false });

            this._scannerInterval = setInterval(async () => {
                if (this.isProcessingCode || video.readyState < 2) return;

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                try {
                    const barcodes = await detector.detect(canvas);
                    if (!barcodes || !barcodes.length) return;

                    for (const barcode of barcodes) {
                        const rawCode = String(barcode.rawValue || "").trim();
                        if (!/^yal-[A-Z0-9]{4,16}$/i.test(rawCode)) continue;

                        const normalizedCode = rawCode.toLowerCase();
                        this.isProcessingCode = true;
                        this.lastScannedCode = normalizedCode;
                        this.scannedCodeCount = 1;

                        const mode = this.scannerMode;
                        if (mode === "search") {
                            this.filters.search = normalizedCode;
                            this.directSearch = normalizedCode;
                            this.showFilters = true;
                        } else if (mode === "tracking" || mode === "add") {
                            this.newParcel.tracking = rawCode;
                        }

                        this.$nextTick(() => this.closeScanner());
                        return;
                    }
                } catch (error) {
                    // متابعة الإطارات التالية عند تعذر كشف رمز مؤقتاً
                }
            }, 300);
        } catch (error) {
            console.error(error);
            alert("تعذر الوصول إلى الكاميرا: " + (error && error.message ? error.message : String(error)));
            this.closeScanner();
        }
    }
};

if (typeof window !== "undefined") window.scannerFunctions = scannerFunctions;