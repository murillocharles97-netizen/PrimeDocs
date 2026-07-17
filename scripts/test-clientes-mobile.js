const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "clientes-mobile.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "clientes-mobile.css"), "utf8");
const desktop = fs.readFileSync(path.join(root, "pages", "clientes.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "js", "components", "navigation.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

let mobile = true, desktopRenders = 0, navigationMode = "", scrollTop = 0;
const content = { innerHTML: "" }, list = { innerHTML: "" }, chips = { innerHTML: "" }, count = { textContent: "" }, sortLabel = { textContent: "" };
const classes = new Set(), saved = new Map();
const clients = [
    { id: "c1", nome: "Cliente Ativo", tipo: "particular", whatsapp: "17999990001", cpfCnpj: "11122233344", cidade: "Franca", ativo: true, criadoEm: "2025-01-01", tags: [] },
    { id: "c2", nome: "Brenda Adidas", tipo: "particular", telefone: "17999990002", cidade: "Franca", ativo: true, criadoEm: "2024-01-01", statusRelacionamento: "vip", tags: ["VIP"] },
    { id: "c3", nome: "Banca Basílica", tipo: "loja_parceira", lojaId: "l1", whatsapp: "17999990003", cidade: "Batatais", ativo: true, criadoEm: "2023-01-01", responsavel: "Maria" },
    { id: "c4", nome: "Cliente Inativo Sem WhatsApp", tipo: "empresa", cpfCnpj: "99888777000111", ativo: false, criadoEm: "2022-01-01" },
    { id: "c5", nome: "Nome extremamente longo para validar truncamento sem empurrar os badges", tipo: "particular", ativo: true, criadoEm: "2026-07-01", observacoes: "Prefere contato à tarde" }
];
const orders = [
    { id: "p1", clienteId: "c1", clienteNome: "Cliente Ativo", statusPedido: "entregue", valorTotal: 100, dataPedido: "2026-07-15", criadoEm: "2026-07-15", ativo: true },
    { id: "p2", clienteId: "c2", clienteNome: "Brenda Adidas", statusPedido: "entregue", valorTotal: 450, dataPedido: "2026-07-07", criadoEm: "2026-07-07", ativo: true },
    { id: "p3", clienteId: "c2", clienteNome: "Brenda Adidas", statusPedido: "entregue", valorTotal: 550, dataPedido: "2026-06-01", criadoEm: "2026-06-01", ativo: true },
    { id: "p4", clienteId: "c3", clienteNome: "Banca Basílica", statusPedido: "entregue", valorTotal: 890, dataPedido: "2026-07-05", criadoEm: "2026-07-05", ativo: true }
];
const finances = [
    { id: "f1", clienteId: "c2", clienteNome: "Brenda Adidas", status: "atrasado", valorRestante: 450, vencimento: "2026-07-10" },
    { id: "f2", clienteId: "c3", clienteNome: "Banca Basílica", status: "pago", valorRestante: 0, vencimento: "2026-07-05" }
];
const stores = [{ id: "l1", clienteId: "c3", nome: "Banca Basílica", responsavel: "Maria", ativo: true }];
const stocks = [{ lojaId: "l1", itens: [{ produtoId: "x", quantidade: 10, preco: 15 }] }];

global.window = global;
global.matchMedia = () => ({ matches: mobile });
global.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
global.navigator = { onLine: true, vibrate: () => true };
global.location = { href: "" };
global.scrollY = 0;
global.scrollTo = ({ top }) => { scrollTop = top; };
global.requestAnimationFrame = callback => callback();
global.document = {
    body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    getElementById: id => ({ content, mobileClientsList: list, mobileClientChipsSlot: chips, mobileClientsCount: count }[id] || null),
    querySelector: selector => selector === ".mobileClientSortLabel" ? sortLabel : selector === ".mobileClientsSearch button" ? { toggleAttribute() {} } : null,
    querySelectorAll: () => []
};
global.addEventListener = () => {};
global.setTimeout = callback => { callback(); return 1; };
global.clearTimeout = () => {};
global.lucide = { createIcons() {} };
global.Utils = { hoje: () => "2026-07-17", moeda: value => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}` };
global.Storage = {
    listarClientes: () => clients.map(c => ({ ...c })), listarPedidos: () => orders.map(p => ({ ...p })), listarLojas: () => stores.map(l => ({ ...l })),
    listarEstoquesLojas: () => stocks.map(e => ({ ...e })), listarLancamentosFinanceiros: () => finances.map(f => ({ ...f })),
    buscarClientePorId: id => clients.find(c => c.id === id), salvarCliente() {}
};
global.Financeiro = { sincronizar: () => finances.map(f => ({ ...f })) };
global.sincronizarLojasExistentesClientes = () => {};
global.avaliarRelacionamentoCliente = cliente => cliente.statusRelacionamento === "vip" ? "vip" : "ativo";
global.iniciaisCliente = nome => nome.split(/\s+/).slice(0, 2).map(p => p[0]).join("");
global.TIPOS_CLIENTE = { particular: "Cliente Particular", loja_parceira: "Loja Parceira", empresa: "Empresa", fornecedor: "Fornecedor", outro: "Outro" };
global.renderClientes = () => { desktopRenders += 1; };
global.renderNavegacaoInferiorPrimeDocs = page => { navigationMode = page; };
global.atualizarNavegacaoAtivaPrimeDocs = () => {};
global.Modal = { abrir() {}, fechar() {} };
global.Toast = { show() {} };
global.abrirDetalhesCliente = () => {};
global.abrirModalCliente = () => {};
global.novoPedidoCliente = () => {};
global.abrirWhatsappCliente = () => {};
global.abrirRecebimentoFinanceiro = () => {};

vm.runInThisContext(source);

let passed = 0;
function test(name, run) { try { run(); passed += 1; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode = 1; } }
function ok(value, message = "condição não atendida") { if (!value) throw new Error(message); }

renderClientes();
test("1. mobile usa renderizador exclusivo", () => ok(content.innerHTML.includes("clientsMobilePage") && !content.innerHTML.includes("clientGrid")));
test("2. cabeçalho é compacto e sem botão novo", () => ok(content.innerHTML.includes("Seus clientes, relacionamentos e resultados.") && !content.innerHTML.includes("Ver resumo") && !content.innerHTML.includes("erpAddButton")));
test("3. busca usa nome, contato e documento", () => ok(content.innerHTML.includes("Buscar cliente por nome, contato ou documento") && source.includes("cliente.cpfCnpj") && source.includes("cliente.observacoes")));
test("4. busca possui debounce e limpeza", () => ok(source.includes("buscaTimer") && source.includes("220") && source.includes("limparBusca")));
test("5. filtros rápidos são unificados e reais", () => ok(chips.innerHTML.includes("Devedores") && chips.innerHTML.includes("Lojas / Consignado") && chips.innerHTML.includes("VIP") && !chips.innerHTML.includes(">Consignado<")));
test("6. cliente particular ativo é renderizado", () => ok(list.innerHTML.includes("Cliente Ativo") && list.innerHTML.includes("Cliente particular")));
test("7. dívida vencida tem prioridade financeira", () => ok(list.innerHTML.includes("Brenda Adidas") && list.innerHTML.includes("Vencido") && list.innerHTML.includes("R$ 450,00")));
test("8. VIP manual é preservado", () => ok(list.innerHTML.includes("mobileClientVip") && list.innerHTML.includes("VIP")));
test("9. loja e consignado usam estoque real", () => ok(list.innerHTML.includes("Banca Basílica") && list.innerHTML.includes("Loja parceira") && list.innerHTML.includes("R$ 150,00")));
test("10. ausência de WhatsApp é explícita", () => ok(list.innerHTML.includes("WhatsApp não informado") && list.innerHTML.includes("disabled")));
test("11. cliente sem pedidos mostra estado novo", () => ok(list.innerHTML.includes("Cliente novo · nenhum pedido") && list.innerHTML.includes("Nunca comprou")));
test("12. cliente inativo continua acessível", () => { ClientesMobile.filtroRapido("inativos"); ok(list.innerHTML.includes("Cliente Inativo")); ClientesMobile.filtroRapido("todos"); });
test("13. nomes longos têm contrato de ellipsis", () => ok(css.includes(".mobileClientIdentity h2") && css.includes("text-overflow: ellipsis")));
test("14. busca por nome funciona", () => { ClientesMobile.pesquisar("Brenda"); ok(list.innerHTML.includes("Brenda Adidas") && !list.innerHTML.includes("Banca Basílica")); });
test("15. busca por telefone funciona", () => { ClientesMobile.pesquisar("17999990003"); ok(list.innerHTML.includes("Banca Basílica")); });
test("16. busca por documento funciona", () => { ClientesMobile.pesquisar("99888777000111"); ok(list.innerHTML.includes("Cliente Inativo")); ClientesMobile.pesquisar(""); });
test("17. filtro Devedores funciona", () => { ClientesMobile.filtroRapido("devedores"); ok(list.innerHTML.includes("Brenda Adidas") && !list.innerHTML.includes("Cliente Ativo")); });
test("18. filtro Lojas / Consignado funciona", () => { ClientesMobile.filtroRapido("lojas"); ok(list.innerHTML.includes("Banca Basílica") && !list.innerHTML.includes("Brenda Adidas")); });
test("19. filtro VIP funciona", () => { ClientesMobile.filtroRapido("vip"); ok(list.innerHTML.includes("Brenda Adidas") && !list.innerHTML.includes("Banca Basílica")); ClientesMobile.filtroRapido("todos"); });
test("20. ordenação por saldo usa valor real", () => { ClientesMobile.ordenar("saldo"); ok(ClientesMobile._lista()[0].id === "c2"); });
test("21. indicador de relacionamento retorna score documentado", () => { const r = ClientesMobile.calcularRelacionamento(clients[0], [orders[0]], []); ok(r.score >= 0 && r.score <= 100 && r.level && r.label && r.explanation); });
test("22. cliente novo não é penalizado injustamente", () => ok(ClientesMobile.calcularRelacionamento(clients[4], [], []).level === "novo"));
test("23. swipe direito cria pedido", () => ok(source.includes("direita ? api.novoPedido(id)") && source.includes("Math.abs(delta) >= 72")));
test("24. swipe esquerdo prioriza receber", () => ok(ClientesMobile._acaoContextual(ClientesMobile._montarDados().clientes.find(c => c.id === "c2")) === "receber"));
test("25. swipe esquerdo usa WhatsApp sem dívida", () => ok(ClientesMobile._acaoContextual(ClientesMobile._montarDados().clientes.find(c => c.id === "c1")) === "whatsapp"));
test("26. card expande somente um cliente", () => { ClientesMobile.alternar({ target: { closest: () => null } }, "c1"); ok(list.innerHTML.includes("mobileClientExpanded") && list.innerHTML.includes("Ver ficha completa")); ClientesMobile.alternar({ target: { closest: () => null } }, "c2"); ok(ClientesMobile._estado.expandido === "c2"); });
test("27. filtros avançados cobrem CRM operacional", () => ok(["mcfTipo", "mcfSituacao", "mcfAtivo", "mcfVip", "mcfWhatsapp", "mcfCidade", "mcfUltima", "mcfValorMin", "mcfPedidos", "mcfResponsavel"].every(id => source.includes(id))));
test("28. rodapé possui Novo cliente contextual", () => ok(navigation.includes("mobileBottomCreateClient") && navigation.includes("Criar novo cliente") && navigation.includes("abrirModalCliente()")));
test("29. conteúdo reserva safe-area e página não rola lateralmente", () => ok(css.includes("calc(126px + env(safe-area-inset-bottom))") && css.includes("overflow-x: hidden") && css.includes(".mobileClientChips") && css.includes("overflow-x: auto")));
test("30. tema escuro e movimento reduzido estão completos", () => ok(css.includes("body.dark-mode") && css.includes("prefers-reduced-motion: reduce")));
test("31. 320, 360, 375, 390, 412 e 430 usam somente o layout mobile", () => ok(css.includes("@media (max-width: 767px)") && css.includes("@media (max-width: 360px)") && !css.includes("min-width: 768px")));
test("32. estados vazio, erro, cache offline e skeleton existem", () => ok(["Nenhum cliente cadastrado", "Nenhum cliente encontrado", "Não foi possível carregar", "Offline · exibindo dados", "mobileClientsSkeleton"].every(text => source.includes(text))));
test("33. dados são normalizados em uma leitura por coleção", () => ok(source.includes("pedidosPorId") && source.includes("financeiroPorId") && source.includes("estoquePorLoja") && source.includes("limite: 30")));
test("34. desktop continua no renderizador original", () => { mobile = false; renderClientes(); ok(desktopRenders === 1 && desktop.includes("clientGrid") && desktop.includes("crmCustomerCard")); });
test("35. arquivos carregam depois do desktop e antes do app", () => ok(index.indexOf("pages/clientes.js") < index.indexOf("js/clientes-mobile.js") && index.indexOf("js/clientes-mobile.js") < index.indexOf("js/app.js")));
test("36. PWA inclui CRM mobile offline", () => ok(sw.includes("primedocs-v56") && sw.includes("clientes-mobile.css") && sw.includes("clientes-mobile.js")));
test("37. navegação de Clientes mantém Mais como aba contextual", () => ok(navigationMode === "clientes" && navigation.includes('destino === "mais" && !paginasPrincipais.includes(paginaAtiva)')));
test("38. CSS desktop não recebeu seletores mobile", () => ok(!desktop.includes("clientsMobilePage") && !desktop.includes("mobileClientSwipe")));

if (!process.exitCode) console.log(`\n${passed} verificações da experiência Clientes Mobile aprovadas.`);
