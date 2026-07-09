const PrimeCADGeometry = {
    createRoundedRectangle(width, height, radius) {
        return { type: "rounded-rectangle", width, height, radius };
    },

    createPuzzlePiece(index, config) {
        return window.PrimeCADPuzzleGenerator?.gerarPoligonoPeca(index, config) || [];
    },

    createPuzzle(config) {
        return [1, 2, 3, 4].map(index => this.createPuzzlePiece(index, config));
    },

    createMagnetHole(diameter, depth) {
        return { type: "magnet-hole", diameter, depth };
    }
};

if (typeof window !== "undefined") window.PrimeCADGeometry = PrimeCADGeometry;
