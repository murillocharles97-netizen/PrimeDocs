const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const inventory = read("js/inventory.js");
const router = read("js/router.js");
const navigation = read("js/components/navigation.js");
const menu = read("js/config/menu.js");
const mobile = read("js/estoque-mobile.js");
const products = read("pages/produtos.js");
const filaments = read("pages/filamentos.js");
const app = read("js/app.js");
const index = read("index.html");
const sw = read("service-worker.js");
let passed = 0;

function test(name, run) {
    try { run(); passed++; console.log(`✓ ${name}`); }
    catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; }
}

const storage = new Map([["primedocs_inventory_active_section", "produtos"]]);
const calls = [];
const location = { href: "https://example.github.io/PrimeDocs/?page=estoque&section=filaments", pathname: "/PrimeDocs/", search: "?page=estoque&section=filaments", hash: "" };
const context = {
    console,
    URL,
    location,
    requestAnimationFrame: callback => callback(),
    localStorage: { getItem:key => storage.get(key) || null, setItem:(key,value) => storage.set(key, String(value)) },
    document: { getElementById: () => null, querySelector: () => null, createDocumentFragment: () => ({ appendChild(){} }) },
    history: {
        replaceState(_state, _title, url) { calls.push(["replace", url]); },
        pushState(_state, _title, url) { calls.push(["push", url]); }
    },
    matchMedia: () => ({ matches:true, addEventListener(){} }),
    addEventListener() {},
    renderProdutos() {},
    renderFilamentos() {},
    MobileInventory: {
        renderSection(section, restore) { calls.push(["render", section, restore]); },
        captureScroll() { calls.push(["capture"]); }
    }
};
context.window = context;
vm.createContext(context);
vm.runInContext(inventory, context, { filename:"js/inventory.js" });

test("1. existe um único controlador InventoryPage", () => assert(context.InventoryPage));
test("2. aliases em português e inglês são normalizados", () => {
    assert.equal(context.InventoryPage.normalizeSection("products"), "produtos");
    assert.equal(context.InventoryPage.normalizeSection("filaments"), "filamentos");
});
test("3. query da URL tem prioridade na abertura", () => assert.equal(context.InventoryPage.initialNavigation().opcoes.section, "filamentos"));
test("4. renderização usa a seção solicitada sem trocar de página", () => {
    context.InventoryPage.render("filamentos");
    assert.equal(context.InventoryPage.activeSection(), "filamentos");
    assert(calls.some(call => call[0] === "render" && call[1] === "filamentos"));
});
test("5. troca interna captura e restaura estado", () => {
    context.InventoryPage.setSection("produtos");
    assert(calls.some(call => call[0] === "capture"));
    assert(calls.some(call => call[0] === "render" && call[1] === "produtos" && call[2] === true));
});
test("6. troca interna cria URL compartilhável", () => assert(calls.some(call => call[0] === "push" && call[1].includes("page=estoque") && call[1].includes("section=products"))));
test("7. última seção fica persistida", () => assert.equal(storage.get("primedocs_inventory_active_section"), "produtos"));
test("8. permissões ocultam seção não autorizada", () => {
    context.PrimePermissions = { podeAcessar: permissao => permissao !== "produtos" };
    context.InventoryPage.render("produtos");
    assert.equal(context.InventoryPage.activeSection(), "filamentos");
    delete context.PrimePermissions;
});
test("9. router redireciona rotas antigas para Estoque", () => assert(router.includes("aliasesEstoque") && router.includes('pagina = "estoque"')));
test("10. router possui somente case Estoque", () => assert(router.includes('case "estoque"') && !router.includes('case "produtos"') && !router.includes('case "filamentos"')));
test("11. menu lateral possui somente Estoque", () => assert(navigation.includes('["estoque", "warehouse", "Estoque"]') && !navigation.includes('["produtos", "boxes", "Produtos"]') && !navigation.includes('["filamentos", "spool", "Filamentos"]')));
test("12. configuração de menu também possui somente Estoque", () => assert(menu.includes('pagina:"estoque"') && !menu.includes('pagina:"produtos"') && !menu.includes('pagina:"filamentos"')));
test("13. navegação inferior usa uma única entrada Estoque", () => assert(navigation.includes('["estoque", "package-open", "Estoque"]')));
test("14. ação central é contextual à seção", () => assert(navigation.includes("MobileInventory.novoItem()") && navigation.includes("Novo produto") && navigation.includes("Adicionar rolo")));
test("15. mobile alterna por InventoryPage sem navegar", () => assert(mobile.includes("InventoryPage.setSection") && mobile.includes("renderSection(secao")));
test("16. Produtos injeta conteúdo no shell central", () => assert(products.includes('mountSectionContent?.("produtos"')));
test("17. Filamentos injeta conteúdo no shell central", () => assert(filaments.includes('mountSectionContent?.("filamentos"')));
test("18. desktop mantém DOM e scroll independentes", () => assert(inventory.includes("cacheDesktop") && inventory.includes("scrollDesktop") && inventory.includes("guardarDesktopAtual")));
test("19. mobile preserva scroll de Produtos", () => assert(read("js/produtos-mobile.js").includes("captureScroll()")));
test("20. carregamento inicial respeita rota e seção", () => assert(app.includes("InventoryPage?.initialNavigation") && app.includes("rotaInicial?.opcoes")));
test("21. controlador carrega antes do app", () => assert(index.indexOf("js/inventory.js") > index.indexOf("js/estoque-mobile.js") && index.indexOf("js/inventory.js") < index.indexOf("js/app.js")));
test("22. CSS central carrega depois do CSS mobile", () => assert(index.indexOf("css/inventory.css") > index.indexOf("css/estoque-mobile.css")));
test("23. PWA guarda controlador e estilo offline", () => assert(sw.includes("primedocs-v64") && sw.includes("js/inventory.js") && sw.includes("css/inventory.css")));
test("24. sem permissão existe estado vazio explícito", () => assert(inventory.includes("Área indisponível") && inventory.includes("shield-x")));
test("25. links do Dashboard apontam para subseções centrais", () => {
    const dashboard = read("js/dashboard-premium.js");
    assert(dashboard.includes("estoque:produtos") && dashboard.includes("estoque:filamentos"));
});
test("26. pesquisa global leva ao Estoque correto", () => {
    const search = read("js/global-search.js");
    assert(search.includes('"estoque","abrirDetalhesProduto","produtos"') && search.includes('"estoque","","filamentos"'));
});
test("27. nenhuma regra de negócio foi movida para o controlador", () => assert(!inventory.includes("salvarProduto") && !inventory.includes("salvarFilamento") && !inventory.includes("PrimeFirebase")));

if (!process.exitCode) console.log(`\n${passed} verificações da arquitetura central de Estoque aprovadas.`);
