const fs = require("fs");
const vm = require("vm");
const path = require("path");

const nodes = {
    ordersPremiumWorkspace:{innerHTML:""}, ordersPremiumSummary:{innerHTML:""}, ordersResultCount:{textContent:""}
};
global.window = global;
global.app = { innerHTML:"" };
global.document = { getElementById:id=>nodes[id]||null, querySelector:()=>null };
global.localStorage = { data:{}, getItem(k){return this.data[k]||null}, setItem(k,v){this.data[k]=String(v)} };
global.matchMedia = () => ({matches:false});
global.addEventListener = () => {};
global.requestAnimationFrame = fn => fn();
global.lucide = { createIcons(){} };
global.Utils = { hoje:()=>"2026-07-17", moeda:v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) };
global.formatarDataBR = d => d ? d.split("-").reverse().join("/") : "";
global.navegar = () => {};
global.abrirModalPedido = global.abrirDetalhePedido = global.abrirMenuPedido = global.solicitarStatusPedido = global.abrirPreviaProducaoPedido = () => {};

const pedidos = [
    {id:"ped-48392",clienteId:"c1",clienteNome:"Pedro Mesquita",dataPedido:"2026-07-12",dataEntregaPrevista:"2026-07-18",itens:[{produtoId:"p1",nome:"Boneco",quantidade:2,valorUnitario:140}],statusPedido:"aguardando_aceite",statusPagamento:"pendente",valorTotal:280,valorPago:0,valorPendente:280,ativo:true,criadoEm:"2026-07-12",atualizadoEm:"2026-07-12"},
    {id:"ped-48390",clienteId:"c2",clienteNome:"Mercado Livre",dataPedido:"2026-07-10",dataEntregaPrevista:"2026-07-16",itens:[{produtoId:"p2",nome:"Taça",quantidade:5,valorUnitario:10}],statusPedido:"em_producao",statusPagamento:"parcial",valorTotal:50,valorPago:20,valorPendente:30,ativo:true,criadoEm:"2026-07-10",atualizadoEm:"2026-07-16"},
    {id:"ped-48386",clienteId:"c3",clienteNome:"Papelaria Arthur",dataPedido:"2026-07-13",dataEntregaPrevista:"2026-07-19",itens:[{produtoId:"p3",nome:"Chaveiro",quantidade:10,valorUnitario:4.5}],statusPedido:"em_producao",statusPagamento:"pendente",valorTotal:45,valorPago:0,valorPendente:45,ativo:true,criadoEm:"2026-07-13",atualizadoEm:"2026-07-13"},
    {id:"ped-48385",clienteId:"c4",clienteNome:"3L Semijoias",dataPedido:"2026-07-14",dataEntregaPrevista:"2026-07-18",itens:[{produtoId:"p4",nome:"Suporte",quantidade:18,valorUnitario:20}],statusPedido:"pronto",statusPagamento:"pendente",valorTotal:360,valorPago:0,valorPendente:360,ativo:true,criadoEm:"2026-07-14",atualizadoEm:"2026-07-17"},
    {id:"ped-48384",clienteId:"c5",clienteNome:"João Adidas",dataPedido:"2026-07-08",dataEntregaPrevista:"2026-07-16",itens:[{produtoId:"p1",nome:"Boneco",quantidade:1,valorUnitario:120}],statusPedido:"entregue",statusPagamento:"pago",valorTotal:120,valorPago:120,valorPendente:0,ativo:true,criadoEm:"2026-07-08",atualizadoEm:"2026-07-16"}
];
const produtos = [
    {id:"p1",nome:"Boneco",categoria:"Bonecos",custo:20,ativo:true}, {id:"p2",nome:"Taça",categoria:"Chaveiros",custo:2,ativo:true},
    {id:"p3",nome:"Chaveiro",categoria:"Chaveiros",custo:1,ativo:true}, {id:"p4",nome:"Suporte",categoria:"Suportes",custo:5,ativo:true}
];
const clientes = pedidos.map((p,i)=>({id:`c${i+1}`,nome:p.clienteNome,ativo:true}));
const ordens = [{id:"o1",pedidoId:"ped-48390",status:"em_producao",progresso:65},{id:"o2",pedidoId:"ped-48386",status:"acabamento",progresso:80}];
const operacoes = [{id:"op1",ordemProducaoId:"o1",tipo:"impressao",status:"em_execucao"},{id:"op2",ordemProducaoId:"o2",tipo:"impressao",status:"concluida"},{id:"op3",ordemProducaoId:"o2",tipo:"acabamento",status:"aguardando"}];
const lotes = [{id:"l1",ordemProducaoId:"o1",operacaoId:"op1",impressoraId:"i1",status:"em_execucao",tempoPrevistoMinutos:400,iniciadoEm:"2026-07-17T08:00:00"},{id:"l2",ordemProducaoId:"o2",operacaoId:"op2",impressoraId:"i2",status:"concluido",tempoPrevistoMinutos:100}];
global.Storage = {
    listarPedidos:()=>pedidos, listarProdutos:()=>produtos, listarClientes:()=>clientes,
    listarOrdensProducao:()=>ordens, listarOperacoesProducao:()=>operacoes, listarLotesExecucao:()=>lotes,
    listarImpressoras:()=>[{id:"i1",nome:"A1 Mini 001",ativa:true},{id:"i2",nome:"A1 Mini 002",ativa:true}]
};
global.Producao = { migrarDados(){}, calcularProgressoLote:l=>l.status==="concluido"?100:65, calcularTempoDecorrido:()=>140 };
global.Financeiro = { sincronizar:()=>[{id:"f1",origem:"pedido",vencimento:"2026-07-17",status:"pendente",valorRestante:50}] };

vm.runInThisContext(fs.readFileSync(path.join(__dirname,"..","js","pedidos-premium.js"),"utf8"));
renderPedidos();
const html = () => app.innerHTML + nodes.ordersPremiumWorkspace.innerHTML + nodes.ordersPremiumSummary.innerHTML;
const css = fs.readFileSync(path.join(__dirname,"..","css","pedidos-premium.css"),"utf8");
const index = fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const sw = fs.readFileSync(path.join(__dirname,"..","service-worker.js"),"utf8");
let passou=0;
function teste(nome,fn){try{fn();passou++;console.log(`✓ ${nome}`)}catch(e){console.error(`✗ ${nome}: ${e.message}`);process.exitCode=1}}
function ok(v,m="condição não atendida"){if(!v)throw new Error(m)}

teste("1. renderizador premium substitui a tela anterior",()=>ok(renderPedidos===PedidosPremium.render));
teste("2. cabeçalho possui título e novo pedido",()=>ok(html().includes("OPERAÇÃO / PEDIDOS")&&html().includes("Novo pedido")));
teste("3. exatamente seis indicadores inteligentes",()=>ok((html().match(/class="ordersKpiCard/g)||[]).length===6));
teste("4. indicadores exigidos estão presentes",()=>ok(["Receita prevista","Receber hoje","Horas de impressão","Entregues este mês","Pedidos atrasados","Lucro previsto"].every(v=>html().includes(v))));
teste("5. pesquisa e seis controles de filtro",()=>ok(html().includes("Buscar cliente, produto ou pedido")&&(html().match(/<select aria-label=/g)||[]).length===6));
teste("6. alternância Kanban e Cards",()=>ok(html().includes("> Kanban</button>")&&html().includes("> Cards</button>")));
teste("7. cinco colunas operacionais",()=>ok((html().match(/class="ordersKanbanColumn/g)||[]).length===5));
teste("8. etapa de acabamento é inferida da produção",()=>ok(html().includes("column-acabamento")&&html().includes("Papelaria Arthur")&&html().includes("Iniciar acabamento")));
teste("9. card de produção mostra impressora e progresso real",()=>ok(html().includes("A1 Mini 001")&&html().includes("65%")&&html().includes("restantes")));
teste("10. cards mostram produtos, peças e pagamento",()=>ok(html().includes("produto")&&html().includes("peça")&&html().includes("Parcial")));
teste("11. ações contextuais cobrem o fluxo",()=>ok(["Aprovar","Abrir produção","Iniciar acabamento","Entregar","Ver detalhes"].every(v=>html().includes(v))));
teste("12. cards preparados para drag futuro, desabilitado",()=>ok(html().includes('draggable="false"')&&html().includes("data-drop-zone")&&PedidosPremium.dragAndDropDisponivel===false));
teste("13. resumo inferior tem seis indicadores",()=>ok((html().match(/ordersBottomSummary/g)||[]).length>=1&&(nodes.ordersPremiumSummary.innerHTML.match(/<button/g)||[]).length===6));
teste("14. filtro de atrasados atualiza sem nova leitura completa",()=>{PedidosPremium.definirFiltro("atrasados",true);ok(nodes.ordersPremiumWorkspace.innerHTML.includes("Mercado Livre")&&!nodes.ordersPremiumWorkspace.innerHTML.includes("Pedro Mesquita"))});
teste("15. busca instantânea encontra cliente",()=>{PedidosPremium.limparFiltros();PedidosPremium.pesquisar("João Adidas");ok(nodes.ordersPremiumWorkspace.innerHTML.includes("João Adidas")&&!nodes.ordersPremiumWorkspace.innerHTML.includes("Mercado Livre"))});
teste("16. visão cards funciona",()=>{PedidosPremium.pesquisar("");PedidosPremium.alterarVisualizacao("cards");ok(nodes.ordersPremiumWorkspace.innerHTML.includes("ordersCardsGrid"))});
teste("17. preferência de visualização é persistida",()=>ok(localStorage.data.primedocs_pedidos_visualizacao==="cards"));
teste("18. skeleton é parte do fluxo de carregamento",()=>ok(fs.readFileSync(path.join(__dirname,"..","js","pedidos-premium.js"),"utf8").includes("ordersKpiSkeleton")));
teste("19. mobile usa abas horizontais e cards largos",()=>ok(css.includes("ordersMobileTabs")&&css.includes("max-width:760px")&&css.includes("grid-template-columns:1fr")));
teste("20. tablet e desktop têm grades adaptativas",()=>ok(css.includes("max-width:980px")&&css.includes("max-width:1320px")&&css.includes("repeat(6")));
teste("21. tema escuro possui tratamento próprio",()=>ok(css.includes("body.dark-mode .ordersPremiumPage")));
teste("22. movimentos reduzidos são respeitados",()=>ok(css.includes("prefers-reduced-motion")));
teste("23. CSS e JS estão carregados no índice",()=>ok(index.includes("css/pedidos-premium.css")&&index.includes("js/pedidos-premium.js")));
teste("24. módulo carrega depois das páginas de pedidos e produção",()=>ok(index.indexOf("js/pedidos-premium.js")>index.indexOf("pages/producao.js")));
teste("25. service worker usa cache novo e inclui a tela",()=>ok(sw.includes('primedocs-v53')&&sw.includes("pedidos-premium.css")&&sw.includes("pedidos-premium.js")));
teste("26. resumo de pagos aplica filtro de pagamento real",()=>{PedidosPremium.abrirResumo("pagos");ok(nodes.ordersPremiumWorkspace.innerHTML.includes("João Adidas")&&!nodes.ordersPremiumWorkspace.innerHTML.includes("Pedro Mesquita"))});

console.log(`\n${passou} verificações da tela Pedidos concluídas.`);
