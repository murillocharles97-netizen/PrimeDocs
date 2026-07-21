const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const index = read("index.html");
const navigation = read("js/components/navigation.js");
const auth = read("js/auth.js");
const home = read("pages/home.js");
const css = read("css/style.css");
const sw = read("service-worker.js");

let passed = 0;
function test(name, run) {
    try { run(); passed++; console.log(`✓ ${name}`); }
    catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; }
}
function ok(value, message = "condição não atendida") { if (!value) throw new Error(message); }
function pngSize(file) {
    const buffer = fs.readFileSync(path.join(root, file));
    ok(buffer.subarray(1, 4).toString() === "PNG", `${file} não é PNG`);
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const required = [
    "assets/brand.svg", "assets/brand-symbol-white.svg", "assets/brand-symbol-black.svg", "assets/brand-symbol-purple.svg",
    "assets/icon-192.png", "assets/icon-512.png", "assets/icon-maskable-192.png", "assets/icon-maskable-512.png",
    "assets/icon-adaptive-foreground.png", "assets/icon-adaptive-background.png", "assets/icon-monochrome-512.png",
    "assets/apple-touch-icon.png", "assets/favicon.ico", "assets/favicon-32.png", "assets/splash-icon-512.png"
];

test("1. família completa de identidade existe", () => required.forEach(file => ok(fs.existsSync(path.join(root, file)), file)));
test("2. ícones principais possuem dimensões corretas", () => {
    ok(pngSize("assets/icon-192.png").join("x") === "192x192");
    ok(pngSize("assets/icon-512.png").join("x") === "512x512");
    ok(pngSize("assets/icon-maskable-192.png").join("x") === "192x192");
    ok(pngSize("assets/icon-maskable-512.png").join("x") === "512x512");
    ok(pngSize("assets/apple-touch-icon.png").join("x") === "180x180");
    ok(pngSize("assets/favicon-32.png").join("x") === "32x32");
});
test("3. símbolo preserva cubo e integra check", () => {
    const brand = read("assets/brand.svg");
    ok(brand.includes("M256 94 404 180") && brand.includes("m286 330 32 31 66-75"));
});
test("4. versões branca, preta e roxa compartilham geometria", () => {
    ok(read("assets/brand-symbol-white.svg").includes('#fff'));
    ok(read("assets/brand-symbol-black.svg").includes('#111827'));
    ok(read("assets/brand-symbol-purple.svg").includes('#6D5DFD'));
});
test("5. manifest possui any, maskable e monochrome", () => {
    const purposes = new Set(manifest.icons.map(icon => icon.purpose));
    ok(["any", "maskable", "monochrome"].every(purpose => purposes.has(purpose)));
    manifest.icons.forEach(icon => ok(fs.existsSync(path.join(root, icon.src)), icon.src));
});
test("6. foreground e background adaptativos estão separados", () => ok(pngSize("assets/icon-adaptive-foreground.png").join("x") === "512x512" && pngSize("assets/icon-adaptive-background.png").join("x") === "512x512"));
test("7. favicon e Apple Touch usam assets novos versionados", () => ok(index.includes("brand.svg?v=2") && index.includes("favicon.ico?v=2") && index.includes("apple-touch-icon.png?v=2")));
test("8. splash, header, login, menu e Home usam o símbolo próprio", () => {
    ok((index.match(/brand-symbol-white\.svg/g) || []).length >= 2);
    ok(navigation.includes("brand-symbol-white.svg") && auth.includes("brand-symbol-white.svg") && home.includes("brand-symbol-white.svg"));
});
test("9. componente visual preserva logos personalizadas", () => ok(navigation.includes("empresa?.logo") && navigation.includes('class="brandSymbol"')));
test("10. símbolo permanece legível nos componentes pequenos", () => ok(css.includes(".brandMark .brandSymbol") && css.includes("width:62%") && css.includes("object-fit:contain")));
test("11. PWA v63 guarda toda a identidade offline", () => required.forEach(file => ok(sw.includes(`./${file}`), file)));
test("12. gerador reutilizável fica versionado", () => ok(fs.existsSync(path.join(root, "scripts/generate-brand-assets.py"))));

if (!process.exitCode) console.log(`\n${passed} verificações da identidade PrimeDocs aprovadas.`);
