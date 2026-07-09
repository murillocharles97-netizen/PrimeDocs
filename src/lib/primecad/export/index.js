const PrimeCADExport = {
    exportSTL(name, faces) {
        return window.PrimeCADPuzzleGenerator?.exportarSTL(name, faces) || "";
    },

    exportZIP(files) {
        if (typeof criarZipSemBibliotecaGerador3D === "function") {
            return criarZipSemBibliotecaGerador3D(files);
        }
        throw new Error("Exportador ZIP não carregado.");
    }
};

if (typeof window !== "undefined") window.PrimeCADExport = PrimeCADExport;
