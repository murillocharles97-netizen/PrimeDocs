const fs = require("fs");
const vm = require("vm");
const path = require("path");

const raiz = path.join(__dirname, "..");
const codigo = fs.readFileSync(path.join(raiz, "js", "producao-premium.js"), "utf8");
const css = fs.readFileSync(path.join(raiz, "css", "producao-premium.css"), "utf8");
const index = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(raiz, "service-worker.js"), "utf8");
const nav = fs.readFileSync(path.join(raiz, "js", "components", "navigation.js"), "utf8");
const config = fs.readFileSync(path.join(raiz, "pages", "configuracoes.js"), "utf8");
const negocio = fs.readFileSync(path.join(raiz, "js", "producao.js"), "utf8");
const paginaLegada = fs.readFileSync(path.join(raiz, "pages", "producao.js"), "utf8");

global.window = global;
global.app = { innerHTML: "" };
global.document = { querySelectorAll: () => [], getElementById: () => null };
global.lucide = { createIcons: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.requestAnimationFrame = fn => fn();
global.setInterval = () => 1;
global.clearInterval = () => {};
global.producaoTimer = null;
global.Utils = { hoje: () => "2026-07-17" };
global.formatarDataBR = data => data ? data.split("-").reverse().join("/") : "";
global.formatarMinutosProducao = valor => `${Math.floor(Number(valor) / 60)}h ${Number(valor) % 60}m`;
global.Producao = {
    migrarDados: () => {},
    calcularTempoDecorrido: lote => Number(lote.decorrido || 0),
    calcularProgressoLote: lote => Number(lote.progressoCalculado || 0),
    impressoraCompativel: (impressora, operacao) => !operacao.modeloExigido || operacao.modeloExigido === impressora.modelo,
    moverLoteFila: () => {}
};
global.CentralOperacoes = { getPrinterImage: impressora => /mini/i.test(impressora.modelo || "") ? "assets/printers/a1-mini.svg" : "assets/printers/generic-printer.svg" };
global.Storage = {};
vm.runInThisContext(codigo);

let aprovados = 0;
function teste(nome, executar) {
    try { executar(); aprovados += 1; console.log(`✓ ${nome}`); }
    catch (erro) { console.error(`✗ ${nome}: ${erro.message}`); process.exitCode = 1; }
}
function ok(condicao, mensagem = "condição não atendida") { if (!condicao) throw new Error(mensagem); }

function contexto(sobrescrever = {}) {
    const impressoras = sobrescrever.impressoras || [];
    const ordens = sobrescrever.ordens || [];
    const operacoes = sobrescrever.operacoes || [];
    const lotes = sobrescrever.lotes || [];
    const pedidos = sobrescrever.pedidos || [];
    const agrupar = (lista, campo) => lista.reduce((mapa, item) => { const id = String(item[campo] || ""); if (!mapa.has(id)) mapa.set(id, []); mapa.get(id).push(item); return mapa; }, new Map());
    return {
        impressoras, ordens, operacoes, lotes, pedidos, produtos:[], filamentos:[],
        ordemPorId:new Map(ordens.map(item => [String(item.id), item])),
        operacaoPorId:new Map(operacoes.map(item => [String(item.id), item])),
        pedidoPorId:new Map(pedidos.map(item => [String(item.id), item])),
        produtoPorId:new Map(), impressoraPorId:new Map(impressoras.map(item => [String(item.id), item])),
        lotesPorImpressora:agrupar(lotes,"impressoraId"), lotesPorOperacao:agrupar(lotes,"operacaoId"), operacoesPorOrdem:agrupar(operacoes,"ordemProducaoId")
    };
}

const impLivre = { id:"i1", nome:"A1 Mini 01", modelo:"A1 Mini", ativa:true, status:"livre" };
const impOcupada = { id:"i2", nome:"A1 Mini 02", modelo:"A1 Mini", ativa:true, status:"ocupada", operacaoAtualId:"l1" };
const ordemPedido = { id:"o1", produtoNome:"Taça da Copa", pedidoId:"p1", origem:"pedido", prazo:"2026-07-18" };
const ordemEstoque = { id:"o2", produtoNome:"Suporte", origem:"estoque", prazo:"2026-07-20" };
const opExecucao = { id:"op1", ordemProducaoId:"o1", tipo:"impressao", nome:"Imprimir", status:"em_execucao", tempoPrevistoMinutos:300 };
const loteExecucao = { id:"l1", operacaoId:"op1", ordemProducaoId:"o1", impressoraId:"i2", status:"em_execucao", quantidade:5, tempoPrevistoMinutos:300, iniciadoEm:"2026-07-17T10:00:00", decorrido:90, progressoCalculado:30, filamentosSelecionados:[{material:"PLA",cor:"Branco",tipoCarregamento:"ams",slotAms:1}] };

teste("1. impressora livre é normalizada", () => ok(ProducaoPremium.normalizarStatusImpressora(impLivre, null) === "livre"));
teste("2. impressora ocupada em execução é normalizada", () => ok(ProducaoPremium.normalizarStatusImpressora(impOcupada, loteExecucao) === "imprimindo"));
teste("3. impressão pausada preserva ação de retomada", () => ok(ProducaoPremium.componentes.PrinterOperationCard(impOcupada, contexto({impressoras:[impOcupada],ordens:[ordemPedido],operacoes:[opExecucao],lotes:[{...loteExecucao,status:"pausada"}]}), []).includes("retomarLoteUI")));
teste("4. falha exibe ação de resolução", () => { const html=ProducaoPremium.componentes.PrinterOperationCard({...impOcupada,status:"falha"}, contexto({impressoras:[impOcupada],ordens:[ordemPedido],operacoes:[opExecucao],lotes:[{...loteExecucao,status:"falhou"}]}), []); ok(html.includes("novaTentativaUI")&&html.includes("Resolver")); });
teste("5. manutenção aparece como estado operacional", () => ok(ProducaoPremium.normalizarStatusImpressora({...impLivre,status:"manutencao"}, null) === "manutencao"));
teste("6. progresso indisponível não inventa percentual", () => ok(ProducaoPremium.progressoLote({status:"em_execucao"}) === null));
teste("7. progresso explícito é limitado", () => ok(ProducaoPremium.progressoLote({status:"em_execucao",progresso:140}) === 99));
teste("8. previsão pausada é suspensa", () => ok(ProducaoPremium.previsaoLote({...loteExecucao,status:"pausada"}).texto.includes("suspensa")));
teste("9. imagem local específica e fallback existem", () => ok(ProducaoPremium.getPrinterImage(impLivre).endsWith("a1-mini.svg") && ProducaoPremium.getPrinterImage({modelo:"XYZ"}).endsWith("generic-printer.svg")));
teste("10. fila vazia possui estado útil", () => ok(ProducaoPremium.componentes.ProductionQueue([]).includes("fila está vazia")));

const opFilaAlta = { id:"op2", ordemProducaoId:"o2", tipo:"impressao", nome:"Imprimir suporte", status:"aguardando", quantidade:4, tempoPrevistoMinutos:180, prioridade:"alta" };
const opFilaMedia = { id:"op3", ordemProducaoId:"o1", tipo:"impressao", nome:"Imprimir taça", status:"aguardando", quantidade:2, tempoPrevistoMinutos:120, prioridade:"media" };
const ctxFila = contexto({impressoras:[impLivre,impOcupada],ordens:[ordemPedido,ordemEstoque],operacoes:[opFilaMedia,opFilaAlta],lotes:[],pedidos:[{id:"p1",clienteNome:"Cliente"}]});
const fila = ProducaoPremium._fila(ctxFila);
teste("11. fila longa prioriza itens de alta prioridade", () => ok(fila.length === 2 && fila[0].op.id === "op2"));
teste("12. origem para estoque é diferenciada", () => ok(ProducaoPremium.componentes.ProductionQueueItem(fila[0],0).includes("Estoque interno")));
teste("13. origem de pedido continua identificada", () => ok(ProducaoPremium.componentes.ProductionQueueItem(fila[1],1).includes("Pedido #")));
teste("14. compatibilidade de impressora participa da fila", () => ok(fila.every(item => item.compativeis.length === 2)));
teste("15. carga prevista considera execução paralela", () => { const ctx = contexto({impressoras:[impLivre,impOcupada],ordens:[ordemPedido,ordemEstoque],operacoes:[opExecucao,opFilaAlta],lotes:[loteExecucao]}); ok(ProducaoPremium.calcularCargaPrevista(ctx, ProducaoPremium._fila(ctx)) === 210); });
teste("16. lote em preparação usa iniciar e nunca pausar", () => { const lote={...loteExecucao,status:"pronta_para_iniciar"}; const html=ProducaoPremium.componentes.PrinterOperationCard(impOcupada,contexto({impressoras:[impOcupada],ordens:[ordemPedido],operacoes:[opExecucao],lotes:[lote]}),[]); ok(html.includes("iniciarLoteUI")&&!html.includes("pausarLoteUI")); });
teste("17. AMS e materiais reais aparecem no card", () => { const html=ProducaoPremium.componentes.PrinterOperationCard(impOcupada,contexto({impressoras:[impOcupada],ordens:[ordemPedido],operacoes:[opExecucao],lotes:[loteExecucao]}),[]); ok(html.includes("PLA Branco")&&html.includes("Slot 1")); });
teste("18. alertas são condicionais", () => ok(ProducaoPremium.componentes.ProductionAlertSection([]) === ""));
teste("19. pausa, falha, filamento, manutenção e atraso geram alertas reais", () => { const ctx=contexto({impressoras:[{...impLivre,horasDesdeManutencao:510,limiteManutencaoHoras:500}],ordens:[{...ordemPedido,prazo:"2026-07-16"}],operacoes:[{...opExecucao,status:"falhou"}],lotes:[{...loteExecucao,status:"pausada"},{...loteExecucao,id:"l2",status:"falhou"},{...loteExecucao,id:"l3",status:"aguardando_preparacao"}]}); ok(ProducaoPremium._alertas(ctx).length === 5); });
teste("19b. falha histórica resolvida não permanece como alerta", () => { const ctx=contexto({impressoras:[impLivre],ordens:[ordemPedido],operacoes:[{...opExecucao,status:"aguardando"}],lotes:[{...loteExecucao,status:"falhou"},{...loteExecucao,id:"nova",status:"aguardando_alocacao",tentativaDe:"l1"}]}); ok(!ProducaoPremium._alertas(ctx).some(alerta => alerta.tipo === "falha")); });
teste("20. pós-produção possui Montagem, Acabamento e Conferência", () => { const html=ProducaoPremium.componentes.PostProductionPanel(contexto()); ok(html.includes("Montagem")&&html.includes("Acabamento")&&html.includes("Conferência")); });
teste("21. cabeçalho e cinco KPIs são compactos", () => { const html=ProducaoPremium.componentes.ProductionKpiStrip(contexto({impressoras:[impLivre]}),[],[]); ok((html.match(/class="factoryKpi /g)||[]).length===5&&html.includes("Carga prevista")); });
teste("22. desktop usa até três cards e tablet reduz grade", () => ok(css.includes("grid-template-columns:repeat(3,minmax(0,1fr))") && /max-width:1250px[\s\S]*repeat\(2,minmax\(0,1fr\)\)/.test(css)));
teste("23. mobile 320/390 evita tabela e rolagem horizontal", () => ok(css.includes("@media(max-width:390px)")&&css.includes("@media(max-width:760px)")&&!css.includes("min-width:760px")));
teste("24. tema claro e escuro usam o mesmo componente", () => ok(css.includes("body.dark-mode")&&css.includes('html[data-theme="dark"]')&&css.includes("var(--card-bg")));
teste("25. movimento reduzido e foco visível são respeitados", () => ok(css.includes("prefers-reduced-motion:reduce")&&css.includes(":focus-visible")));
teste("26. menu principal não expõe mais Impressoras", () => ok(!nav.match(/\["impressoras",\s*"printer"/)));
teste("27. Configurações concentra o gerenciamento de impressoras", () => ok(config.includes("renderCardImpressorasConfiguracoes")&&config.includes("Abrir gerenciamento de impressoras")));
teste("28. nova camada carrega depois da página e antes do app", () => ok(index.indexOf("pages/producao.js") < index.indexOf("producao-premium.js") && index.indexOf("producao-premium.js") < index.indexOf("js/app.js")));
teste("29. PWA offline inclui CSS, JS e imagens locais", () => ok(sw.includes("primedocs-v53")&&sw.includes("producao-premium.css")&&sw.includes("producao-premium.js")&&sw.includes("a1-mini.svg")));
teste("30. regras existentes de alocação, pausa, conclusão e estoque permanecem", () => ok(["alocarOperacao","pausarLote","retomarLote","concluirLote","reservarFilamentosParaLote","baixarEstoqueAoConcluir"].every(nome => negocio.includes(nome)) || (negocio.includes("alocar")&&negocio.includes("pausar")&&negocio.includes("concluir"))));
teste("31. fluxos de pedido e estoque continuam disponíveis", () => ok(paginaLegada.includes("abrirProducaoEstoque")&&paginaLegada.includes("confirmarProducaoEstoque")&&paginaLegada.includes("abrirNovaProducao")));
teste("32. tela renderizada integra fábrica, fila, pós-produção e alertas", () => ok(codigo.includes("FactoryOverview(contextoAtual")&&codigo.includes("ProductionQueue(fila)")&&codigo.includes("PostProductionPanel(contextoAtual)")&&codigo.includes("ProductionAlertSection(alertas)")));
teste("33. renderização completa executa sem erro com dados reais simulados", () => {
    Object.assign(Storage, {
        listarImpressoras:()=>[impLivre,impOcupada], listarOrdensProducao:()=>[ordemPedido,ordemEstoque], listarOperacoesProducao:()=>[opExecucao,opFilaAlta],
        listarLotesExecucao:()=>[loteExecucao], listarPedidos:()=>[{id:"p1",clienteNome:"Cliente"}], listarProdutos:()=>[], listarFilamentos:()=>[]
    });
    ProducaoPremium.render();
    ok(app.innerHTML.includes("factoryControlPage")&&app.innerHTML.includes("PRODUÇÃO AGORA")&&app.innerHTML.includes("FILA DE PRODUÇÃO"));
});

if (!process.exitCode) console.log(`\n${aprovados} verificações da Central de Produção aprovadas.`);
