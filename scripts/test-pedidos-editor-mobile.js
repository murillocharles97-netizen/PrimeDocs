const fs = require("fs");
const vm = require("vm");

const js = fs.readFileSync("js/pedidos-editor-mobile.js", "utf8");
const css = fs.readFileSync("css/pedidos-editor-mobile.css", "utf8");
const producao = fs.readFileSync("js/producao.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8");
let passou = 0;

function teste(nome, fn) {
    try {
        fn();
        passou += 1;
        console.log(`✓ ${nome}`);
    } catch (erro) {
        console.error(`✗ ${nome}: ${erro.message}`);
        process.exitCode = 1;
    }
}

function ok(condicao, mensagem = "asserção inválida") {
    if (!condicao) throw new Error(mensagem);
}

const contexto = {
    console,
    window: {
        abrirModalPedido() { return "desktop"; },
        matchMedia() { return { matches: false }; }
    },
    Modal: { fechar() {}, abrir() {} },
    Storage: {
        listarFilamentos() { return [{ id: "fil-1", material: "PLA", cor: "Branco", marca: "Prime", precoKg: 100, ativo: true }]; },
        carregarConfigCustos() { return { precoKgFilamentoPadrao: 85, custoEnergiaHora: .2, custoDepreciacaoHora: .5, valorMaoDeObraHora: 0, custoEmbalagemPadrao: 1, taxaImpostoPercentual: 0, perdaPercentual: 5 }; },
        buscarProdutoPorId() { return null; },
        listarProdutos() { return []; },
        listarClientes() { return []; },
        listarOrdensProducao() { return []; },
        listarLotesExecucao() { return []; }
    },
    Utils: { moeda: valor => `R$ ${Number(valor).toFixed(2)}`, hoje: () => "2026-07-21" },
    Producao: { obterReceita: () => [] },
    STATUS_PEDIDOS: {},
    Toast: { show() {} },
    lucide: { createIcons() {} },
    document: { getElementById() { return null; }, body: { classList: { add() {}, remove() {} } }, querySelectorAll() { return []; }, querySelector() { return null; } },
    escaparPedido: valor => String(valor || ""),
    salvarPedido() {},
    navegar() {},
    pedidoEditandoId: null,
    itensPedidoEdicao: []
};
contexto.window.window = contexto.window;
vm.createContext(contexto);
vm.runInContext(js, contexto);

teste("1. carrega controlador mobile reutilizável", () => ok(contexto.window.PedidosEditorMobile));
teste("2. mantém delegação explícita para o editor desktop", () => ok(js.includes("isMobile() ? abrir(id, clienteIdInicial) : abrirPedidoDesktop")));
teste("3. cria modal full screen apenas até 767px", () => ok(css.includes("@media (max-width: 767px)") && css.includes("height: 100dvh")));
teste("4. oferece as quatro abas solicitadas", () => ["geral", "itens", "custos", "producao"].forEach(aba => ok(js.includes(`[\"${aba}\"`))));
teste("5. cada aba possui rolagem própria", () => ok(css.includes(".mobileOrderTabPanel") && css.includes("overflow-y: auto")));
teste("6. rodapé de cancelar e salvar fica fora da área rolável", () => ok(js.includes("mobileOrderEditorFooter") && js.includes("Salvar pedido")));
teste("7. produto personalizado guarda peso, tempo e filamento", () => ["pesoPrevistoGramas", "tempoPrevistoMinutos", "filamentoId", "filamentoNome"].forEach(campo => ok(js.includes(campo))));
teste("8. custo personalizado separa material, energia e depreciação", () => {
    const calculo = contexto.window.PedidosEditorMobile._calcularItem({ personalizado: true, quantidade: 2, valorUnitario: 50, pesoPrevistoGramas: 100, tempoPrevistoMinutos: 60, filamentoId: "fil-1", custoEmbalagemUnitario: 1, custoAdicionalUnitario: 2 });
    ok(Math.abs(calculo.material - 10.5) < .001);
    ok(Math.abs(calculo.energia - .2) < .001);
    ok(Math.abs(calculo.depreciacao - .5) < .001);
    ok(Math.abs(calculo.custoTotal - 28.4) < .001);
    ok(Math.abs(calculo.lucroTotal - 71.6) < .001);
});
teste("9. análise inteligente possui faixas positiva e de atenção", () => {
    ok(contexto.window.PedidosEditorMobile._analiseRentabilidade({ venda: 100, custo: 20 }).nivel === "excelente");
    ok(contexto.window.PedidosEditorMobile._analiseRentabilidade({ venda: 100, custo: 90 }).nivel === "baixa");
});
teste("10. custo e lucro atualizam durante a digitação", () => ok(js.includes("oninput=\"PedidosEditorMobile.editar") && js.includes("atualizarCustos()")));
teste("11. item registrado permite editar quantidade e valor unitário", () => ok(js.includes("'quantidade'") && js.includes("'valorUnitario'")));
teste("12. produção personalizada recebe operação, tempo e material", () => ok(producao.includes("tempoPersonalizado") && producao.includes("materialPersonalizado") && producao.includes("Imprimir ${item.nome")));
teste("13. tela de produção usa dados reais das ordens e lotes", () => ok(js.includes("listarOrdensProducao") && js.includes("listarLotesExecucao") && js.includes("pesoReservadoGramas")));
teste("14. editor evita quebra de layout em 320px", () => ok(css.includes("@media (max-width: 359px)") && css.includes("grid-template-columns: 1fr")));
teste("15. tema escuro herda as variáveis globais", () => ok(css.includes("var(--card") && css.includes("var(--text") && !css.includes("html[data-theme=\"dark\"]")));
teste("16. CSS e JS são carregados depois da tela base de pedidos", () => {
    ok(index.indexOf("pages/pedidos.js") < index.indexOf("pedidos-editor-mobile.js"));
    ok(index.includes("pedidos-editor-mobile.css?v=1"));
});
teste("17. editor fica disponível offline no PWA v65", () => ok(sw.includes("primedocs-v65") && sw.includes("pedidos-editor-mobile.css") && sw.includes("pedidos-editor-mobile.js")));

if (!process.exitCode) console.log(`\n${passou} testes do editor mobile aprovados.`);
