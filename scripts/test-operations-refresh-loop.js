const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const operationsSource = fs.readFileSync(path.join(root, "js", "operations-mobile.js"), "utf8");
const financeSource = fs.readFileSync(path.join(root, "js", "financeiro.js"), "utf8");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function testMobileRefreshGuard() {
    const listeners = {};
    const localData = { pedidos: [] };
    let html = "";
    let renders = 0;
    const content = {
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; renders += 1; }
    };
    const empty = () => [];
    const storage = {
        listarPedidos: () => localData.pedidos,
        listarLancamentosFinanceiros: empty,
        listarFilamentos: empty,
        listarImpressoras: empty,
        listarLotesExecucao: empty,
        listarOperacoesProducao: empty,
        listarOrdensProducao: empty,
        listarClientes: empty,
        listarLojas: empty,
        listarEstoquesLojas: empty,
        listarConferencias: empty
    };
    const context = {
        console,
        Storage: storage,
        localStorage: { getItem: () => null },
        navigator: { onLine: true },
        matchMedia: () => ({ matches: true }),
        setTimeout: callback => { callback(); return 1; },
        clearTimeout: () => {},
        addEventListener: (type, callback) => { (listeners[type] ||= []).push(callback); },
        document: {
            getElementById: id => id === "content" ? content : null,
            querySelector: selector => selector.includes("mobileOperations") && html.includes("mobileOperations") ? {} : null,
            querySelectorAll: () => []
        },
        lucide: { createIcons: () => {} },
        Utils: { moeda: value => `R$ ${Number(value || 0).toFixed(2)}` },
        CentralOperacoes: {
            render: () => {},
            _lerDados: () => ({ agora: new Date(), pedidos: [], financeiro: [], filamentos: [], gruposFilamentos: [], impressoras: [], lotes: [], operacoes: [], ordens: [], clientes: [], lojasVisitar: [] }),
            calcularPrioridades: () => [],
            _calcularResumo: () => ({ pedidosAtrasados: [], receberHoje: 0 }),
            abrirRota: () => {}
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(operationsSource, context);

    context.CentralOperacoesMobile.renderMobile();
    const initialRenders = renders;
    listeners["primedocs:sync-status"][0]({ detail: { estado: "sincronizado" } });
    assert(renders === initialRenders, "status repetido reconstruiu a tela sem mudança de dados");

    localData.pedidos.push({ id: "pedido-1", atualizadoEm: "2026-07-17T12:00:00.000Z" });
    listeners["primedocs:sync-status"][0]({ detail: { estado: "sincronizado" } });
    assert(renders === initialRenders + 1, "mudança real de dados não atualizou a tela");

    listeners["primedocs:sync-status"][0]({ detail: { estado: "erro" } });
    assert(renders === initialRenders + 1, "mudança apenas de status causou nova reconstrução");
}

function testFinanceSyncIsIdempotent() {
    let saved = [];
    let writes = 0;
    const clone = value => JSON.parse(JSON.stringify(value));
    const storage = {
        listarLancamentosFinanceiros: () => clone(saved),
        listarPedidos: () => [{
            id: "pedido-1", clienteNome: "Cliente", valorTotal: 100, valorPago: 0,
            dataPedido: "2026-07-17", dataEntregaPrevista: "2026-07-20",
            criadoEm: "2026-07-17T10:00:00.000Z", atualizadoEm: "2026-07-17T10:00:00.000Z",
            statusPedido: "aprovado", ativo: true
        }],
        listarConferencias: () => [],
        salvarLancamentosFinanceiros: list => { writes += 1; saved = clone(list); }
    };
    const context = {
        console,
        Storage: storage,
        Utils: { hoje: () => "2026-07-17", moeda: value => String(value) },
        Date,
        JSON,
        Map,
        Set,
        Math,
        Number,
        String,
        Array,
        window: {},
        document: { querySelector: () => null }
    };
    vm.createContext(context);
    vm.runInContext(financeSource, context);
    vm.runInContext("Financeiro.sincronizar()", context);
    vm.runInContext("Financeiro.sincronizar()", context);
    assert(writes === 1, `sincronização financeira idêntica gravou ${writes} vezes`);
}

testMobileRefreshGuard();
testFinanceSyncIsIdempotent();
console.log("OK: ciclo de atualização da Home mobile eliminado e sincronização financeira idempotente.");
