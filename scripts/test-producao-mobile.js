const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(raiz, "js", "producao-mobile.js"), "utf8");
const css = fs.readFileSync(path.join(raiz, "css", "producao-mobile.css"), "utf8");
const index = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(raiz, "service-worker.js"), "utf8");
const premium = fs.readFileSync(path.join(raiz, "js", "producao-premium.js"), "utf8");

let aprovados = 0;
const teste = (nome, fn) => { fn(); aprovados += 1; console.log(`✓ ${nome}`); };
const contem = (fonte, trecho) => assert(fonte.includes(trecho), `Não encontrou: ${trecho}`);

teste("1. renderizador mobile é exclusivo até 767px", () => contem(js, 'matchMedia?.("(max-width: 767px)")'));
teste("2. desktop aprovado permanece delegado", () => contem(js, "const renderDesktop = window.renderProducao"));
teste("3. cabeçalho mobile é compacto", () => contem(js, "Centro de controle da fábrica"));
teste("4. próxima ação usa impressora livre e fila real", () => contem(js, "function melhorProximaAcao(ctx)"));
teste("5. estado sem impressoras é acionável", () => contem(js, "Cadastre sua primeira impressora"));
teste("6. estado com todas ocupadas é explícito", () => contem(js, "Todas as impressoras estão ocupadas"));
teste("7. indicadores são horizontais", () => contem(css, ".productionMobileMetrics{display:flex"));
teste("8. indicadores cobrem livres, produção, fila, atraso e conclusão", () => ["Livres", "Produzindo", "Na fila", "Atrasadas", "Finalizadas hoje"].forEach(item => contem(js, item)));
teste("9. atenção necessária vem antes da próxima ação", () => assert(js.indexOf("renderAtencao(ctx)") < js.indexOf("renderProximaAcao(ctx)")));
teste("10. impressoras usam carrossel com snap", () => contem(css, ".productionMobilePrinterTrack{display:flex"));
teste("11. card de impressora mostra filamento e progresso", () => { contem(js, "materialImpressora(impressora)"); contem(js, "mobilePrinterProgress"); });
teste("12. último card adiciona impressora", () => contem(js, "productionMobileAddPrinter"));
teste("13. cadastro de impressoras é página própria", () => { contem(js, "mobilePrinterManager"); contem(js, "mobilePrinterEditor"); });
teste("14. cadastro possui todos os campos solicitados", () => ["mobilePrinterName", "mobilePrinterModel", "mobilePrinterArea", "mobilePrinterSpeed", "mobilePrinterMaterial", "mobilePrinterNotes", "mobilePrinterStatus"].forEach(item => contem(js, item)));
teste("15. exclusão bloqueia impressora com produção", () => contem(js, "Esta impressora possui produção ou fila ativa"));
teste("16. fila possui quatro filtros locais", () => ["hoje", "atrasados", "semana", "todos"].forEach(item => contem(js, `[\"${item}\"`)));
teste("17. cards compactos mostram dados operacionais", () => ["queuePosition", "queueThumb", "queueMeta", "priority-"].forEach(item => contem(js, item)));
teste("18. ação da fila respeita alocação, preparação, início e conclusão", () => ["Alocar", "Preparar", "Iniciar", "Finalizar"].forEach(item => contem(js, item)));
teste("19. swipe horizontal possui limiar e ação contextual", () => { contem(js, "pointermove"); contem(js, "atual >= 76"); contem(js, "executarSwipe"); });
teste("20. snackbar oferece desfazer por cinco segundos", () => { contem(js, "Produção iniciada"); contem(js, "Desfazer"); contem(js, "5000"); });
teste("21. pós-produção usa chips compactos", () => ["Montagem", "Acabamento", "Conferência"].forEach(item => contem(js, item)));
teste("22. FAB muda conforme impressoras e fila", () => { contem(js, "function fab(ctx)"); contem(js, "Adicionar impressora"); contem(js, "Iniciar produção"); contem(js, "Nova produção"); });
teste("23. conteúdo reserva a barra inferior e safe-area", () => contem(css, "env(safe-area-inset-bottom)"));
teste("24. layout estreito reorganiza cards", () => contem(css, "@media (max-width: 360px)"));
teste("25. tema escuro possui tratamento isolado", () => contem(css, "body.dark-mode .productionMobile"));
teste("26. movimento reduzido é respeitado", () => contem(css, "prefers-reduced-motion: reduce"));
teste("27. arquivos carregam após o desktop e antes do app", () => assert(index.indexOf("producao-premium.js") < index.indexOf("producao-mobile.js") && index.indexOf("producao-mobile.js") < index.indexOf("js/app.js")));
teste("28. CSS mobile carrega depois do premium", () => assert(index.indexOf("producao-premium.css") < index.indexOf("producao-mobile.css")));
teste("29. PWA v66 guarda a experiência offline", () => ["primedocs-v66", "css/producao-mobile.css", "js/producao-mobile.js"].forEach(item => contem(sw, item)));
teste("30. produção continua usando ordens filtradas pelo ERP", () => contem(premium, "ERPIntegracao.ordensAtivas()"));
teste("31. cancelados e entregues não viram fila própria no mobile", () => assert(!js.includes("listarPedidos().filter")));
teste("32. nenhum seletor mobile altera o desktop", () => assert(css.trim().startsWith("@media (max-width: 767px)")));

let larguraMobile = true;
let chamadasDesktop = 0;
let rotaAberta = "";
global.window = global;
global.app = { innerHTML: "" };
global.document = { querySelectorAll: () => [], getElementById: () => null };
global.matchMedia = () => ({ matches: larguraMobile });
global.renderProducao = () => { chamadasDesktop += 1; };
global.renderImpressoras = () => { chamadasDesktop += 1; };
global.renderNavegacaoInferiorPrimeDocs = () => {};
global.atualizarNavegacaoAtivaPrimeDocs = () => {};
global.requestAnimationFrame = fn => fn();
global.lucide = { createIcons() {} };
global.Utils = { hoje: () => "2026-07-22" };
global.formatarDataBR = valor => valor;
global.formatarMinutosProducao = valor => `${valor} min`;
global.Producao = { impressoraCompativel: () => true };
global.ProducaoPremium = {
    _lerDados: () => ({ impressoras:[], lotes:[], operacoes:[], ordens:[], fila:[], alertas:[], operacaoPorId:new Map(), ordemPorId:new Map(), lotesPorOperacao:new Map() }),
    _fila: () => [], _alertas: () => [], normalizarStatusImpressora: () => "livre", progressoLote: () => null,
    previsaoLote: () => ({ texto:"" }), getPrinterImage: () => "printer.svg", iniciarSugestao() {}
};
global.Storage = { listarImpressoras: () => [], listarLotesExecucao: () => [], buscarFilamentoPorId: () => null, buscarImpressoraPorId: () => null };
global.navegar = rota => { rotaAberta = rota; };
global.abrirNovaProducao = () => {};
global.Toast = { show() {} };
global.Modal = { abrir() {}, fechar() {} };
vm.runInThisContext(js, { filename:"producao-mobile.js" });

teste("33. renderização funcional mobile monta o estado inicial", () => { renderProducao(); contem(app.innerHTML, "productionMobilePage"); contem(app.innerHTML, "Cadastre sua primeira impressora"); });
teste("34. renderização desktop continua delegada", () => { larguraMobile = false; renderProducao(); assert.equal(chamadasDesktop, 1); larguraMobile = true; });
teste("35. rota exclusiva de impressoras renderiza no mobile", () => { renderImpressoras(); contem(app.innerHTML, "mobilePrinterManager"); contem(app.innerHTML, "Nenhuma impressora cadastrada"); });
teste("36. ação adicionar abre o editor na rota de impressoras", () => { ProducaoMobile.novaImpressora(); assert.equal(rotaAberta, "impressoras"); renderImpressoras(); contem(app.innerHTML, "mobilePrinterEditor"); contem(app.innerHTML, "Nova impressora"); });

console.log(`\n${aprovados} verificações da Central de Produção Mobile aprovadas.`);
