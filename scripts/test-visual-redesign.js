const fs = require("fs");

function read(path) { return fs.readFileSync(path, "utf8"); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const index = read("index.html");
const css = read("css/design-system.css");
const navigation = read("js/components/navigation.js");
const router = read("js/router.js");
const modal = read("js/components/modal.js");
const page = read("js/components/page.js");
const home = read("pages/home.js");
const worker = read("service-worker.js");

assert(index.includes("css/design-system.css?v=1"), "Design System não carregado depois do CSS legado.");
assert(index.includes('id="bottomNavigation"'), "Barra inferior mobile ausente do shell.");
assert(css.includes("--color-primary: #6d4aff"), "Token principal do tema claro ausente.");
assert(css.includes("--color-background: #080b18"), "Tokens do tema escuro ausentes.");
assert(css.includes("safe-area-inset-bottom"), "Safe-area mobile não tratada.");
assert(css.includes("@media (max-width: 390px)"), "Breakpoint de celular compacto ausente.");
assert(css.includes("@media (prefers-reduced-motion: reduce)"), "Preferência de movimento reduzido ausente.");
assert(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr)) !important"), "KPIs mobile não protegidos em duas colunas.");
assert(css.includes("word-break: normal"), "Proteção contra títulos quebrados letra por letra ausente.");
assert(navigation.includes("BOTTOM_NAV_PRIMEDOCS"), "Componente reutilizável da navegação inferior ausente.");
assert(navigation.includes('aria-current", "page"'), "Estado acessível da navegação inferior ausente.");
assert(router.includes("pageEntering"), "Transição discreta de página ausente.");
assert(modal.includes("modalHandle"), "Bottom sheet mobile sem alça visual.");
assert(modal.includes('classList.add("modalOpen")'), "Bloqueio de fundo do modal ausente.");
assert(page.includes("pageTitleIcon"), "Cabeçalho de página reutilizável sem ícone Lucide.");
assert(home.includes("renderProducaoAtualInicio"), "Produção real em andamento ausente da Home.");
assert(worker.includes("primedocs-v43") && worker.includes("./css/design-system.css"), "Novo visual não está protegido pelo cache offline.");

console.log("OK: Design System, temas, shell mobile, acessibilidade, Home e cache offline validados.");
