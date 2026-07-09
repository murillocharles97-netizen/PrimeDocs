const PrimeCADSvg = {
    async vectorizeImage(dataUrl, options = {}) {
        if (!window.ImageTracer) throw new Error("ImageTracerJS não carregado.");
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const scale = Math.min(1, 900 / Math.max(img.width, img.height));
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(ImageTracer.imagedataToSVG(ctx.getImageData(0, 0, canvas.width, canvas.height), options));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    },

    splitByColor(svgText) {
        const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
        return Array.from(doc.querySelectorAll("path,rect,circle,ellipse,polygon,polyline"))
            .reduce((map, el) => {
                const color = (el.getAttribute("fill") || el.getAttribute("stroke") || "#111827").toLowerCase();
                if (!map[color]) map[color] = [];
                map[color].push(el);
                return map;
            }, {});
    }
};

if (typeof window !== "undefined") window.PrimeCADSvg = PrimeCADSvg;
