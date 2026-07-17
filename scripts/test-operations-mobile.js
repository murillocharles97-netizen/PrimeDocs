const fs = require("fs");
const vm = require("vm");
const path = require("path");

const raiz = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(raiz, "js", "operations-mobile.js"), "utf8");
const css = fs.readFileSync(path.join(raiz, "css", "operations-mobile.css"), "utf8");
const desktopJs = fs.readFileSync(path.join(raiz, "js", "central-operacoes.js"), "utf8");
const desktopCss = fs.readFileSync(path.join(raiz, "css", "operations-center.css"), "utf8");
const index = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(raiz, "service-worker.js"), "utf8");

let modoMobile = true;
let renderDesktopChamado = 0;
let rotaAberta = "";
const content = { innerHTML:"" };
const classes = { toggle:()=>{} };

global.window = global;
global.localStorage = { getItem:()=>null, setItem:()=>{} };
global.matchMedia = () => ({ matches:modoMobile });
global.addEventListener = () => {};
global.document = {
    getElementById:id => id === "content" ? content : id === "mobilePriorityCarousel" ? { clientWidth:360,scrollLeft:0 } : null,
    querySelector:seletor => seletor.includes("mobileOperations") ? {} : null,
    querySelectorAll:()=>[{dataset:{mobileDot:"0"},classList:classes},{dataset:{mobileDot:"1"},classList:classes}]
};
global.lucide = { createIcons:()=>{} };
global.Utils = { moeda:valor => `R$ ${Number(valor).toFixed(2).replace(".",",")}` };
global.setTimeout = fn => { fn(); return 1; };
global.clearTimeout = () => {};

const dados = {
    agora:new Date("2026-07-17T09:00:00-03:00"), hoje:"2026-07-17",
    pedidos:[{id:"p1",clienteNome:"Nadine",statusPedido:"aprovado",dataEntregaPrevista:"2026-07-10",valorPendente:80,itens:[{nome:"Produto",quantidade:1}]}],
    financeiro:[{id:"f1",clienteNome:"Nadine",valorRestante:50,vencimento:"2026-07-17",status:"pendente"}],
    filamentos:[],gruposFilamentos:[],clientes:[],lojasVisitar:[],
    impressoras:[{id:"i1",nome:"A1 Mini 001",modelo:"A1 Mini",status:"ocupada",ativa:true},{id:"i2",nome:"A1 Mini 002",modelo:"A1 Mini",status:"livre",ativa:true}],
    lotes:[{id:"l1",impressoraId:"i1",impressoraNome:"A1 Mini 001",ordemProducaoId:"o1",operacaoId:"op1",status:"em_execucao",quantidade:1,iniciadoEm:"2026-07-17T08:00:00-03:00",tempoPrevistoMinutos:180}],
    ordens:[{id:"o1",pedidoId:"p1",produtoNome:"Taça da Copa"}], operacoes:[{id:"op1",ordemProducaoId:"o1",nome:"Imprimir",status:"em_execucao"}]
};
const prioridades = [{id:"pri-1",entidadeTipo:"pedido",entidadeId:"p1",titulo:"Pedido de Nadine está atrasado",descricao:"Entrega atrasada há 7 dias",prioridade:"critica",pontuacao:100,acaoPrincipal:"Ver pedido",rota:"pedidos",icone:"package-x",badge:"Atrasado"},{id:"pri-2",entidadeTipo:"financeiro",entidadeId:"f1",titulo:"Receber pagamento",descricao:"Vencimento hoje",prioridade:"media",pontuacao:70,acaoPrincipal:"Receber",rota:"financeiro",icone:"hand-coins",badge:"Hoje"}];

global.CentralOperacoes = {
    render:()=>{renderDesktopChamado++;content.innerHTML='<main class="operationsCenter">desktop aprovado</main>';},
    _lerDados:()=>dados, calcularPrioridades:()=>prioridades,
    _calcularResumo:()=>({pedidosAtrasados:[dados.pedidos[0]],lotesAtivos:dados.lotes,receberHoje:50,estoqueCritico:0,totalAtencao:2}),
    getPrinterImage:impressora=>/mini/i.test(impressora.modelo||"")?"assets/printers/a1-mini.svg":"assets/printers/generic-printer.svg",
    calcularProgresso:()=>33, previsaoLote:()=>({texto:"2h restantes",restante:120}),
    abrirRota:rota=>{rotaAberta=rota;}, ativarRotaComTeclado:()=>{}
};

vm.runInThisContext(js);

let aprovados = 0;
function teste(nome, executar){try{executar();aprovados++;console.log(`✓ ${nome}`);}catch(erro){console.error(`✗ ${nome}: ${erro.message}`);process.exitCode=1;}}
function ok(condicao,mensagem="condição não atendida"){if(!condicao)throw new Error(mensagem);}

teste("1. breakpoint exclusivo é 768px",()=>ok(js.includes('(max-width: 768px)')&&css.includes("@media(max-width:768px)")));
teste("2. mobile possui renderizador próprio",()=>ok(typeof CentralOperacoesMobile.renderMobile==="function"));
teste("3. desktop continua chamando o render original",()=>{modoMobile=false;CentralOperacoesMobile.render();ok(renderDesktopChamado===1&&content.innerHTML.includes("desktop aprovado"));});
teste("4. mobile não renderiza o layout desktop",()=>{modoMobile=true;CentralOperacoesMobile.render();ok(content.innerHTML.includes("mobileOperations")&&!content.innerHTML.includes("operationsCenter"));});
teste("5. saudação é texto compacto, sem hero",()=>ok(content.innerHTML.includes("Bom dia")&&content.innerHTML.includes("prioridades hoje")&&!content.innerHTML.includes("dashboardHero")));
teste("6. carrossel mostra somente cards horizontais de prioridade",()=>ok(content.innerHTML.includes("mobilePriorityCarousel")&&(content.innerHTML.match(/mobilePriorityCard /g)||[]).length===2));
teste("7. primeira prioridade recebe rótulo Agora",()=>ok(content.innerHTML.includes("AGORA")&&content.innerHTML.includes("Pedido de Nadine está atrasado")));
teste("8. prioridade usa dados reais do pedido",()=>ok(content.innerHTML.includes("1 produto")&&content.innerHTML.includes("1 peça")&&content.innerHTML.includes("R$ 80,00 pendentes")));
teste("9. prioridade abre sua rota real",()=>{CentralOperacoesMobile.abrirPrioridade(0);ok(rotaAberta==="pedidos");});
teste("10. produção mostra no máximo duas impressoras",()=>ok((content.innerHTML.match(/mobilePrinterCard/g)||[]).length===2));
teste("11. produção diferencia imprimindo e livre",()=>ok(content.innerHTML.includes("1 imprimindo")&&content.innerHTML.includes("1 livre")&&content.innerHTML.includes("IMPRIMINDO")&&content.innerHTML.includes("LIVRE")));
teste("12. progresso e previsão vêm da API existente",()=>ok(content.innerHTML.includes("33%")&&content.innerHTML.includes("2h restantes")));
teste("13. imagens locais continuam reutilizadas",()=>ok(content.innerHTML.includes("assets/printers/a1-mini.svg")));
teste("14. resumo do dia tem exatamente quatro indicadores",()=>{const trecho=content.innerHTML.split('class="mobileOpsPanel mobileDaySummary"')[1].split("</section>")[0];ok((trecho.match(/<button/g)||[]).length===4);});
teste("15. resumo usa atraso, recebimento, alertas e prontos reais",()=>ok(content.innerHTML.includes("Atrasados")&&content.innerHTML.includes("R$ 50,00")&&content.innerHTML.includes("Alertas")&&content.innerHTML.includes("Prontos")));
teste("16. quatro ações rápidas estão presentes",()=>ok(["Novo pedido","Produzir estoque","Receber pagamento","Consignado"].every(texto=>content.innerHTML.includes(texto))));
teste("17. ação rápida de recebimento abre Financeiro",()=>{CentralOperacoesMobile.acaoRapida("receber");ok(rotaAberta==="financeiro");});
teste("18. ação rápida de consignado abre Consignado",()=>{CentralOperacoesMobile.acaoRapida("consignado");ok(rotaAberta==="consignado");});
teste("19. cards usam scroll snap e não tabela",()=>ok(css.includes("scroll-snap-type:x mandatory")&&!content.innerHTML.includes("<table")));
teste("20. conteúdo reserva safe-area para barra inferior",()=>ok(css.includes("env(safe-area-inset-bottom)")));
teste("21. 390px e 340px possuem refinamentos próprios",()=>ok(css.includes("@media(max-width:390px)")&&css.includes("@media(max-width:340px)")));
teste("22. tema escuro mantém a mesma composição",()=>ok(css.includes('html[data-theme="dark"]')&&css.includes("body.dark-mode")));
teste("23. movimento reduzido e foco visível são respeitados",()=>ok(css.includes("prefers-reduced-motion:reduce")&&css.includes(":focus-visible")));
teste("24. camada mobile não escreve em Storage nem Firebase",()=>ok(!/Storage\.(salvar|excluir)|Firestore|setDoc|addDoc/.test(js)));
teste("25. arquivos carregam depois da Central e antes do app",()=>ok(index.indexOf("central-operacoes.js")<index.indexOf("operations-mobile.js")&&index.indexOf("operations-mobile.js")<index.indexOf("js/app.js")));
teste("26. desktop original não foi alterado pela camada mobile",()=>ok(desktopJs.includes("operationsCenter")&&desktopCss.includes("operationsCompactStrip")));
teste("27. PWA offline contém a nova experiência",()=>ok(sw.includes("primedocs-v52")&&sw.includes("operations-mobile.css")&&sw.includes("operations-mobile.js")));
teste("28. CSS mobile não possui seletor desktop fora do breakpoint principal",()=>ok(!css.includes(".operationsCenter")&&!css.includes(".operationsCompactStrip")));

if(!process.exitCode)console.log(`\n${aprovados} verificações da Central de Operações Mobile aprovadas.`);
