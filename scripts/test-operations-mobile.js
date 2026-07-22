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
const navigation = fs.readFileSync(path.join(raiz, "js", "components", "navigation.js"), "utf8");
const designCss = fs.readFileSync(path.join(raiz, "css", "design-system.css"), "utf8");
const bottomNavigationSource = navigation.split("const BOTTOM_NAV_PRIMEDOCS = [")[1].split("];")[0];

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
global.Modal = { abrir:()=>{}, fechar:()=>{} };
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

teste("1. breakpoint exclusivo termina em 767px",()=>ok(js.includes('(max-width: 767px)')&&css.includes("@media (max-width: 767px)")));
teste("2. mobile possui renderizador próprio",()=>ok(typeof CentralOperacoesMobile.renderMobile==="function"));
teste("3. desktop continua chamando o render original",()=>{modoMobile=false;CentralOperacoesMobile.render();ok(renderDesktopChamado===1&&content.innerHTML.includes("desktop aprovado"));});
teste("4. mobile não renderiza o layout desktop",()=>{modoMobile=true;CentralOperacoesMobile.render();ok(content.innerHTML.includes("mobileOperations")&&!content.innerHTML.includes("operationsCenter"));});
teste("5. saudação é texto compacto, sem hero",()=>ok(content.innerHTML.includes("Bom dia")&&content.innerHTML.includes("prioridades precisam da sua atenção hoje")&&!content.innerHTML.includes("dashboardHero")));
teste("6. carrossel mostra somente cards horizontais de prioridade",()=>ok(content.innerHTML.includes("mobilePriorityCarousel")&&(content.innerHTML.match(/mobilePriorityCard /g)||[]).length===2));
teste("7. primeira prioridade recebe rótulo Agora",()=>ok(content.innerHTML.includes("AGORA")&&content.innerHTML.includes("Pedido de Nadine está atrasado")));
teste("8. prioridade usa dados reais do pedido",()=>ok(content.innerHTML.includes("1 produto")&&content.innerHTML.includes("1 peça")&&content.innerHTML.includes("R$ 80,00 pendentes")));
teste("9. prioridade abre sua rota real",()=>{CentralOperacoesMobile.abrirPrioridade(0);ok(rotaAberta==="pedidos");});
teste("10. produção mostra somente uma impressora de destaque",()=>ok((content.innerHTML.match(/mobilePrinterCard/g)||[]).length===1));
teste("11. produção resume imprimindo e livre, priorizando execução",()=>ok(content.innerHTML.includes("1 imprimindo")&&content.innerHTML.includes("1 livre")&&content.innerHTML.includes("IMPRIMINDO")));
teste("12. progresso e previsão vêm da API existente",()=>ok(content.innerHTML.includes("33%")&&content.innerHTML.includes("2h restantes")));
teste("13. imagens locais continuam reutilizadas",()=>ok(content.innerHTML.includes("assets/printers/a1-mini.svg")));
teste("14. resumo do dia tem exatamente quatro indicadores",()=>{const trecho=content.innerHTML.split('class="mobileOpsPanel mobileDaySummary"')[1].split("</section>")[0];ok((trecho.match(/<button/g)||[]).length===4);});
teste("15. resumo usa atraso, recebimento, alertas e pedido pronto reais",()=>ok(content.innerHTML.includes("Atrasados")&&content.innerHTML.includes("R$ 50,00")&&content.innerHTML.includes("Alertas")&&content.innerHTML.includes("Pedidos prontos")));
teste("16. ações rápidas foram totalmente removidas",()=>ok(!content.innerHTML.includes("AÇÕES RÁPIDAS")&&!content.innerHTML.includes("Novo pedido")&&!content.innerHTML.includes("mobileQuickActions")));
teste("17. resumo de recebimento abre Financeiro",()=>{CentralOperacoesMobile.abrirResumo("receber");ok(rotaAberta==="financeiro");});
teste("18. resumo de prontos abre Pedidos",()=>{CentralOperacoesMobile.abrirResumo("prontos");ok(rotaAberta==="pedidos");});
teste("19. cards usam scroll snap e não tabela",()=>ok(css.includes("scroll-snap-type:x mandatory")&&!content.innerHTML.includes("<table")));
teste("20. conteúdo reserva safe-area para barra inferior",()=>ok(css.includes("env(safe-area-inset-bottom)")));
teste("21. 390px e 340px possuem refinamentos próprios",()=>ok(css.includes("@media (max-width: 390px)")&&css.includes("@media (max-width: 340px)")));
teste("22. tema escuro mantém a mesma composição",()=>ok(css.includes('html[data-theme="dark"]')&&css.includes("body.dark-mode")));
teste("23. movimento reduzido e foco visível são respeitados",()=>ok(css.includes("prefers-reduced-motion: reduce")&&css.includes(":focus-visible")));
teste("24. camada mobile não escreve em Storage nem Firebase",()=>ok(!/Storage\.(salvar|excluir)|Firestore|setDoc|addDoc/.test(js)));
teste("25. arquivos carregam depois da Central e antes do app",()=>ok(index.indexOf("central-operacoes.js")<index.indexOf("operations-mobile.js")&&index.indexOf("operations-mobile.js")<index.indexOf("js/app.js")));
teste("26. desktop original não foi alterado pela camada mobile",()=>ok(desktopJs.includes("operationsCenter")&&desktopCss.includes("operationsCompactStrip")));
teste("27. PWA offline contém a nova experiência",()=>ok(sw.includes("primedocs-v66")&&sw.includes("operations-mobile.css")&&sw.includes("operations-mobile.js")));
teste("28. CSS mobile não possui seletor desktop fora do breakpoint principal",()=>ok(!css.includes(".operationsCenter")&&!css.includes(".operationsCompactStrip")));
teste("29. contexto mobile limita o carrossel a cinco prioridades",()=>ok(js.includes("prioridades:todasPrioridades.slice(0, 5)")));
teste("30. estado vazio de prioridades é útil",()=>{const original=CentralOperacoes.calcularPrioridades;CentralOperacoes.calcularPrioridades=()=>[];CentralOperacoesMobile.renderMobile();ok(content.innerHTML.includes("Tudo em ordem agora")&&content.innerHTML.includes("Nenhuma ação urgente"));CentralOperacoes.calcularPrioridades=original;CentralOperacoesMobile.renderMobile();});
teste("31. ausência de impressora oferece configuração",()=>{const original=CentralOperacoes._lerDados;CentralOperacoes._lerDados=()=>({...dados,impressoras:[],lotes:[]});CentralOperacoesMobile.renderMobile();ok(content.innerHTML.includes("Nenhuma impressora cadastrada")&&content.innerHTML.includes("Configurar"));CentralOperacoes._lerDados=original;CentralOperacoesMobile.renderMobile();});
teste("32. título longo quebra por palavras",()=>ok(css.includes("overflow-wrap:break-word")&&!css.includes("word-break:break-all")));
teste("33. resumo do dia é grid 2x2 sem carrossel",()=>ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))")&&!css.includes(".mobileDaySummary>div::-webkit-scrollbar")));
teste("34. barra inferior usa Início, Pedidos, Produção, Estoque e Mais",()=>ok(bottomNavigationSource.includes('["pedidos", "package", "Pedidos"]')&&navigation.includes("Abrir mais opções")&&!bottomNavigationSource.includes('["produtos", "boxes", "Produtos"]')));
teste("35. barra inferior e conteúdo respeitam safe-area",()=>ok(css.includes("calc(110px + env(safe-area-inset-bottom))")&&designCss.includes("env(safe-area-inset-bottom)")));
teste("36. status de sincronização fica somente com ícone no mobile",()=>ok(designCss.includes(".globalSyncStatus span { display: none !important; }")));
teste("37. atualização após sincronização é debounced e só ocorre com dados alterados",()=>ok(js.includes('primedocs:sync-status')&&js.includes("atualizarAposDados")&&js.includes("ultimoFingerprintDados")&&js.includes('evento.detail?.estado === "sincronizado"')&&!js.includes('["sincronizado", "erro"]')));
teste("38. componentes mobile estão separados e reutilizáveis",()=>ok(["MobileOperationsPage","MobileOperationsGreeting","MobilePriorityCarousel","MobileProductionSummary","MobileDailySummaryGrid"].every(nome=>js.includes(nome))));

if(!process.exitCode)console.log(`\n${aprovados} verificações da Central de Operações Mobile aprovadas.`);
