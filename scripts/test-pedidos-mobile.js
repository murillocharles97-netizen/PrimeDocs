const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "pedidos-mobile.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "pedidos-mobile.css"), "utf8");
const desktopSource = fs.readFileSync(path.join(root, "js", "pedidos-premium.js"), "utf8");
const desktopCss = fs.readFileSync(path.join(root, "css", "pedidos-premium.css"), "utf8");
const navigation = fs.readFileSync(path.join(root, "js", "components", "navigation.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

let mobile = true;
let desktopRenders = 0;
let navigationMode = "";
const content = { innerHTML: "" };
const list = { innerHTML: "" };
const count = { textContent: "" };
const bodyClasses = new Set();

const orders = [
    { id: "p1", clienteId: "c1", clienteNome: "Nadine", dataPedido: "2026-07-17", dataEntregaPrevista: "2026-07-16", statusPedido: "aguardando_aceite", coluna: "aguardando", prioridade: "atrasado", pagamento: "pendente", valorTotal: 120, valorPendente: 120, tipos: 1, pecas: 1, progresso: 0, minutosRestantes: 0, itens: [{ nome: "Taça", quantidade: 1, valorUnitario: 120 }], timeline: [], observacoes: "Entrega no balcão" },
    { id: "p2", clienteId: "c2", clienteNome: "Mercado Livre", dataPedido: "2026-07-17", dataEntregaPrevista: "2026-07-18", statusPedido: "em_producao", coluna: "producao", prioridade: "amanha", pagamento: "pago", valorTotal: 90, valorPendente: 0, tipos: 2, pecas: 6, progresso: 65, minutosRestantes: 120, impressoras: ["A1 Mini"], itens: [] },
    { id: "p3", clienteId: "c1", clienteNome: "Pedro", dataPedido: "2026-07-16", dataEntregaPrevista: "2026-07-17", statusPedido: "pronto", coluna: "pronto", prioridade: "hoje", pagamento: "pago", valorTotal: 60, valorPendente: 0, tipos: 1, pecas: 2, progresso: 100, minutosRestantes: 0, itens: [] },
    { id: "p4", clienteId: "c2", clienteNome: "Casa Show", dataPedido: "2026-07-15", dataEntregaPrevista: "2026-07-16", statusPedido: "entregue", coluna: "entregue", prioridade: "normal", pagamento: "pendente", valorTotal: 75, valorPendente: 75, tipos: 2, pecas: 2, progresso: 100, minutosRestantes: 0, itens: [] },
    { id: "p5", clienteId: "c1", clienteNome: "Cancelado", dataPedido: "2026-07-14", statusPedido: "cancelado", coluna: "aguardando", prioridade: "normal", pagamento: "pendente", valorTotal: 10, valorPendente: 10, tipos: 1, pecas: 1, itens: [] }
];

global.window = global;
global.matchMedia = () => ({ matches: mobile });
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = {
    body: { classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name) } },
    getElementById: id => ({ content, mobileOrdersList: list, mobileOrdersCount: count }[id] || null),
    querySelector: () => null,
    querySelectorAll: () => []
};
global.addEventListener = () => {};
global.setTimeout = callback => { callback(); return 1; };
global.clearTimeout = () => {};
global.lucide = { createIcons: () => {} };
global.Utils = { moeda: value => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}` };
global.formatarDataBR = value => String(value || "");
global.formatarMinutosProducao = value => `${value} min`;
global.renderNavegacaoInferiorPrimeDocs = page => { navigationMode = page; };
global.atualizarNavegacaoAtivaPrimeDocs = () => {};
global.Modal = { abrir: () => {}, fechar: () => {} };
global.Storage = { listarLancamentosFinanceiros: () => [] };
global.Financeiro = { sincronizar: () => [] };
global.PedidosPremium = {
    render: () => { desktopRenders += 1; },
    _renderDesktop: () => { desktopRenders += 1; },
    _criarContexto: () => ({ hoje: "2026-07-17", enriquecidos: orders, clientes: [{ id: "c1", nome: "Nadine" }, { id: "c2", nome: "Mercado Livre" }] }),
    abrirAcabamento: () => {}
};

vm.runInThisContext(source);

let passed = 0;
function test(name, run) {
    try { run(); passed += 1; console.log(`✓ ${name}`); }
    catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; }
}
function ok(condition, message = "condição não atendida") { if (!condition) throw new Error(message); }

renderPedidos();
test("1. mobile usa renderizador exclusivo", () => ok(content.innerHTML.includes("ordersMobilePage") && !content.innerHTML.includes("ordersPremiumPage")));
test("2. cabeçalho é curto", () => ok(content.innerHTML.includes("Gerencie seus pedidos.") && !content.innerHTML.includes("Gerencie todo o fluxo")));
test("3. resumo operacional possui quatro indicadores", () => ok((content.innerHTML.split("mobileOrdersSummary")[1].match(/tone-/g) || []).length === 4));
test("4. busca usa o placeholder solicitado", () => ok(content.innerHTML.includes("Buscar cliente, pedido ou número...")));
test("5. filtros principais são Status, Cliente e Filtros", () => ok(content.innerHTML.includes('aria-label="Status"') && content.innerHTML.includes('aria-label="Cliente"') && content.innerHTML.includes("mobileOrdersMoreFilters")));
test("6. status usam chips horizontais", () => ok(content.innerHTML.includes("mobileOrderStatusChips") && ["Todos", "Aprovação", "Produção", "Pronto", "Entrega", "Cancelado"].every(text => content.innerHTML.includes(text))));
test("7. lista padrão não mostra cancelados", () => ok(list.innerHTML.includes("Nadine") && !list.innerHTML.includes("Cancelado")));
test("8. cards mostram cliente, número, prazo e valor", () => ok(list.innerHTML.includes("#p1") && list.innerHTML.includes("Atrasado") && list.innerHTML.includes("R$ 120,00")));
test("9. cards mostram produtos, peças, status e pagamento", () => ok(list.innerHTML.includes("1 produto") && list.innerHTML.includes("1 peça") && list.innerHTML.includes("Aguardando aprovação") && list.innerHTML.includes("Pendente")));
test("10. produção mostra barra de progresso real", () => ok(list.innerHTML.includes("65%") && list.innerHTML.includes("mobileOrderProgress")));
test("11. ação principal muda por etapa", () => ok(PedidosMobile._acaoPrincipal(orders[0]).tipo === "aprovar" && PedidosMobile._acaoPrincipal(orders[1]).tipo === "producao" && PedidosMobile._acaoPrincipal(orders[2]).tipo === "entregar" && PedidosMobile._acaoPrincipal(orders[3]).tipo === "receber"));
test("12. card expande sem abrir outra página", () => { PedidosMobile.alternarDetalhes({ target: { closest: () => null } }, "p1"); ok(list.innerHTML.includes("mobileOrderExpanded") && list.innerHTML.includes("PRODUTOS") && list.innerHTML.includes("HISTÓRICO RECENTE")); });
test("13. expansão inclui cliente, tempo, arquivos, pagamento e observações", () => ok(["Cliente", "Tempo estimado", "Arquivos STL", "Pagamento", "Entrega no balcão"].every(text => list.innerHTML.includes(text))));
test("14. swipe possui ação principal e menu secundário", () => ok(source.includes('pointerdown') && source.includes('pointermove') && source.includes('swipe-primary') && source.includes('swipe-secondary')));
test("15. filtro de Produção funciona", () => { PedidosMobile.definirStatus("producao"); ok(list.innerHTML.includes("Mercado Livre") && !list.innerHTML.includes("Nadine")); });
test("16. busca encontra cliente em tempo real", () => { PedidosMobile.definirStatus("todos"); PedidosMobile.pesquisar("Pedro"); ok(list.innerHTML.includes("Pedro") && !list.innerHTML.includes("Mercado Livre")); });
test("17. estado vazio é útil", () => { PedidosMobile.pesquisar("inexistente"); ok(list.innerHTML.includes("Nenhum pedido encontrado") && list.innerHTML.includes("Novo pedido")); PedidosMobile.pesquisar(""); });
test("18. botão central pertence à navegação inferior", () => ok(navigation.includes("mobileBottomCreateOrder") && navigation.includes("Criar novo pedido")));
test("19. modo Pedidos da barra tem Início, Pedidos, Novo, Produção e Mais", () => ok(navigation.includes('["home", "pedidos", "producao"]') && css.includes(".bottomNavigation.isOrdersMode")));
test("20. conteúdo reserva espaço da barra e safe-area", () => ok(css.includes("calc(126px + env(safe-area-inset-bottom))")));
test("21. CSS é restrito ao breakpoint mobile", () => ok(css.trim().startsWith("@media (max-width: 767px)") && !css.includes(".ordersKanban")));
test("22. tema escuro e movimento reduzido estão cobertos", () => ok(css.includes("body.dark-mode") && css.includes("prefers-reduced-motion: reduce")));
test("23. desktop continua no renderizador aprovado", () => { mobile = false; renderPedidos(); ok(desktopRenders === 1 && desktopSource.includes("ordersKanban") && desktopCss.includes("ordersKpiGrid")); });
test("24. arquivos carregam depois do desktop e antes do app", () => ok(index.indexOf("js/pedidos-premium.js") < index.indexOf("js/pedidos-mobile.js") && index.indexOf("js/pedidos-mobile.js") < index.indexOf("js/app.js")));
test("25. PWA inclui a interface mobile offline", () => ok(sw.includes("primedocs-v60") && sw.includes("pedidos-mobile.css") && sw.includes("pedidos-mobile.js")));
test("26. navegação mobile é ativada pela página", () => ok(navigationMode === "pedidos"));
test("27. desktop não recebe seletores da camada mobile", () => ok(!desktopCss.includes("ordersMobilePage") && !desktopSource.includes("mobileOrderSwipe")));

if (!process.exitCode) console.log(`\n${passed} verificações da tela Pedidos Mobile aprovadas.`);
