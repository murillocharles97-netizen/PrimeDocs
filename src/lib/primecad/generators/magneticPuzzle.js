const PrimeCADMagneticPuzzle = {
    generate(config) {
        return window.PrimeCADPuzzleGenerator.gerarMoldeBambu(config);
    }
};

if (typeof window !== "undefined") window.PrimeCADMagneticPuzzle = PrimeCADMagneticPuzzle;
