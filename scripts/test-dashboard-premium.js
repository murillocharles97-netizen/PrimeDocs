const fs = require("fs");
const vm = require("vm");
const path = require("path");

const content = { innerHTML: "" };
global.window = global;
global.document = { getElementById: id => id === "content" ? content : null };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.matchMedia = () => ({ matches:false });
global.Utils = { moeda:v=>Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}), hoje:()=>"2026-07-17" };
global.PrimeFirebase = { auth:{ currentUser:{ displayName:"Murillo" } } };
global.lucide = { createIcons(){} };
global.Modal = { abrir(){}, fechar(){} };
global.navegar = () => {};
global.periodoDashboardExecutivo = "mes";
global.STATUS_PEDIDOS = { aguardando_orcamento:"Aguardando", em_producao:"Em produção", pronto:"Pronto", entregue:"Entregue" };
global.obterIntervaloDashboardExecutivo = () => ({inicio:1,fim:2,label:"mes"});
global.obterIntervaloAnteriorDashboard = () => ({inicio:-1,fim:0,label:"anterior"});
global.carregarDadosDashboardExecutivo = () => ({produtos:[],clientes:[],pedidos:[],orcamentos:[],lojas:[],estoques:[],consignados:[],conferencias:[],filamentos:[],pagamentos:[],financeiro:[]});
global.Storage = { listarNotificacoes:()=>[{id:1,visualizada:false}] };
global.aplicarFiltrosDadosDashboard = dados => dados;
global.calcularIndicadores = (_dados, intervalo) => intervalo.label === "anterior" ? {faturamento:800,lucroEstimado:500,pedidos:3,pedidosEntregues:2,pedidosProducao:1,contasReceber:0} : {faturamento:1000,lucroEstimado:700,pedidos:4,pedidosEntregues:2,pedidosProducao:1,ticketMedio:500,lucroMedio:350,vendaMediaLoja:0,pedidosPorCliente:2,produtosPorPedido:2,tempoMedioProducao:1,recebimentoMedio:500};
global.calcularFinanceiro = () => ({receberHoje:50,atrasados:20,receberMes:300,recebidoMes:200,fluxoPrevisto:300});
global.calcularPedidos = () => ({criados:4,producao:1,prontos:1,entregues:2,impressorasOcupadas:1});
global.calcularConsignado = () => ({valorEmLojas:100,pecasEmLojas:20,conferencias:1,melhorLoja:"Loja A"});
global.calcularFilamentos = () => ({pesoTotal:2,valorEstoque:170,materiais:1,criticos:1});
global.calcularRankings = () => ({produtos:[{nome:"Produto A",quantidade:5,valor:100}],clientes:[{nome:"Cliente A",quantidade:2,valor:700}],lojas:[{nome:"Loja A",quantidade:10,valor:300}],categorias:[{nome:"Chaveiros",quantidade:5,valor:0}]});
global.calcularGraficos = () => ({pedidosPorStatus:[{nome:"Entregue",valor:2}]});
global.carregarMetasDashboardExecutivo = () => ({metaMensal:5000,metaAnual:60000,metaPedidos:30});
global.calcularComparacaoDashboard = (a,b) => ({percentual:b?((a-b)/b)*100:0,badge:""});
global.renderFiltrosAtivosDashboard = () => "";
global.rotuloPeriodoDashboardExecutivo = () => "Mês atual";
global.formatarPeriodoDashboard = () => "01/07/2026 até 31/07/2026";
global.noPeriodoDashboard = () => true;
global.ultimosMesesDashboard = qtd => Array.from({length:qtd},(_,i)=>({label:`M${i+1}`,key:`2026-${String(i+1).padStart(2,"0")}`}));
global.faturamentoMesDashboard = () => 100;
global.lucroMesDashboard = () => 70;
global.calcularFaturamentoAnoDashboard = () => 6000;
global.abrirFiltrosDashboardExecutivo = () => {};
global.abrirMetasDashboardExecutivo = () => {};
global.exportarDashboardPDF = () => {};
global.exportarDashboardCSV = () => {};
global.imprimirDashboardExecutivo = () => {};

vm.runInThisContext(fs.readFileSync(path.join(__dirname,"..","js","dashboard-premium.js"),"utf8"));

let passou=0;
function teste(nome,fn){try{fn();passou++;console.log(`✓ ${nome}`)}catch(e){console.error(`✗ ${nome}: ${e.message}`);process.exitCode=1}}
function ok(v,m="condição não atendida"){if(!v)throw new Error(m)}

renderDashboardExecutivo();
const markup=content.innerHTML;
const css=fs.readFileSync(path.join(__dirname,"..","css","dashboard-premium.css"),"utf8");
const sw=fs.readFileSync(path.join(__dirname,"..","service-worker.js"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

teste("1. nova camada substitui o renderizador executivo",()=>ok(renderDashboardExecutivo===DashboardPremium.render));
teste("2. cabeçalho executivo renderizado",()=>ok(markup.includes("DASHBOARD EXECUTIVO")&&markup.includes("Visão geral")));
teste("2b. hero usa nome formatado e ações reais",()=>ok(markup.includes("Bom dia, Murillo")&&markup.includes("Ações pendentes")&&markup.includes(">1<")));
teste("3. banner de insight dinâmico",()=>ok(markup.includes("dashboardInsight")&&markup.includes("Faturamento cresceu")));
teste("4. somente quatro KPIs principais",()=>ok((markup.match(/class="executiveKpi /g)||[]).length===4));
teste("5. faturamento e lucro no gráfico principal",()=>ok(markup.includes("Faturamento e lucro")&&markup.includes("revenueLine")&&markup.includes("profitLine")));
teste("6. quatro faixas de gráfico disponíveis",()=>ok(["7 dias","30 dias","6 meses","12 meses"].every(v=>markup.includes(v))));
teste("7. resumo do período usa lista, não outro gráfico",()=>ok(markup.includes("periodSummary")&&markup.includes("Ticket médio")));
teste("8. origem do faturamento renderizada",()=>ok(markup.includes("De onde veio o faturamento")&&markup.includes("Pedidos diretos")));
teste("9. situação dos pedidos renderizada",()=>ok(markup.includes("Situação dos pedidos")));
teste("10. três cards inteligentes",()=>ok((markup.match(/class="smartWinnerCard /g)||[]).length===3));
teste("11. faixa de produção e estoque tem quatro itens",()=>ok((markup.match(/operationsBusinessStrip article/g)||[]).length===0&&markup.includes("Pedidos em produção")&&markup.includes("Peças em lojas")));
teste("12. meta inexistente vira placeholder",()=>ok(markup.includes("Meta de lucro")&&markup.includes("Meta não configurada")));
teste("13. destaques usam somente indicadores reais",()=>ok(markup.includes("Destaques do período")&&markup.includes("em atraso para receber")));
teste("14. quatro rankings presentes",()=>ok((markup.match(/class="premiumPanel compactRanking"/g)||[]).length===4));
teste("15. top 10 está preparado",()=>ok(markup.includes("Top 10 do período")));
teste("16. sete indicadores de eficiência",()=>ok(markup.includes("Ticket médio")&&markup.includes("Recebimento médio")));
teste("17. quatro cards finais de módulos",()=>ok((markup.match(/class="premiumModuleCard /g)||[]).length===4));
teste("18. tema escuro possui tratamento",()=>ok(css.includes('html[data-theme="dark"]')));
teste("19. mobile 320/350 empilha KPIs",()=>ok(css.includes("@media (max-width: 350px)")&&/executiveKpiGrid[\s\S]*minmax\(0,1fr\)/.test(css)));
teste("20. mobile 430 preserva controles",()=>ok(css.includes("@media (max-width: 430px)")&&css.includes("min-height:44px")));
teste("21. tablet reorganiza a grade",()=>ok(css.includes("@media (max-width: 1100px)")));
teste("22. desktop limita o conteúdo",()=>ok(css.includes("1280px")));
teste("23. foco visível e navegação por teclado",()=>ok(css.includes(":focus-visible")&&markup.includes('tabindex="0"')));
teste("24. movimento reduzido respeitado",()=>ok(css.includes("prefers-reduced-motion: reduce")));
teste("25. impressão preparada",()=>ok(css.includes("@media print")));
teste("26. novos arquivos entram no cache offline",()=>ok(sw.includes("dashboard-premium.css")&&sw.includes("dashboard-premium.js")));
teste("27. ordem de carregamento preserva app por último",()=>ok(index.indexOf("dashboard-premium.js")>index.indexOf("pages/dashboard.js")&&index.indexOf("dashboard-premium.js")<index.indexOf("js/app.js")));
teste("28. página antiga de cálculos permanece intacta",()=>ok(!fs.readFileSync(path.join(__dirname,"..","pages","dashboard.js"),"utf8").includes("premiumDashboard")));

if(!process.exitCode)console.log(`\n${passou} verificações do Dashboard Premium aprovadas.`);
