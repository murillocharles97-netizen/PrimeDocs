const PrimeCADMesh = {
    extrudePolygon(polygon, z0, z1) {
        return { type: "extrusion", polygon, z0, z1 };
    },

    meshUnion(meshes) {
        return meshes.flat();
    }
};

if (typeof window !== "undefined") window.PrimeCADMesh = PrimeCADMesh;
