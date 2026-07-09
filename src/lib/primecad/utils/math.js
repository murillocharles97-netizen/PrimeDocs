const PrimeCADMath = {
    degToRad(value) {
        return (Number(value) || 0) * Math.PI / 180;
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    },

    distance(a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
};

if (typeof window !== "undefined") window.PrimeCADMath = PrimeCADMath;
