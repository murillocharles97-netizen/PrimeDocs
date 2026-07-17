const fs = require("fs");
const vm = require("vm");
const path = require("path");

global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.Storage = {};
global.Utils = {
    hoje: () => "2026-07-17",
    moeda: value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
};
global.Producao = {
    calcularTempoDecorrido: lote => Number(lote.decorrido || 0),
    calcularProgressoLote: lote => Number(lote.progressoCalculado || 0)
};

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", "central-operacoes.js"), "utf8"));

let aprovados = 0;
function teste(nome, executar) {
    try {
        executar();
        aprovados += 1;
        console.log(`✓ ${nome}`);
    } catch (erro) {
        console.error(`✗ ${nome}: ${erro.message}`);
        process.exitCode = 1;
    }
}
function ok(condicao, mensagem) { if (!condicao) throw new Error(mensagem || "condição não atendida"); }
function base(sobrescrever = {}) {
    return {
        hoje: "2026-07-17", agora: new Date("2026-07-17T10:00:00-03:00"), pedidos: [], financeiro: [], filamentos: [], gruposFilamentos: [],
        impressoras: [], lotes: [], operacoes: [], ordens: [], clientes: [], lojasVisitar: [], ...sobrescrever
    };
}

teste("1. nenhuma prioridade", () => ok(CentralOperacoes.calcularPrioridades(base()).length === 0));
teste("2. mais de três prioridades preservadas no motor", () => ok(CentralOperacoes.calcularPrioridades(base({ gruposFilamentos: [1,2,3,4].map(id => ({ chave:id, material:"PLA", cor:String(id), baixoEstoque:true, pesoDisponivelTotal:0 })) })).length === 4));
teste("3. cobrança de valor zero é ignorada", () => ok(!CentralOperacoes.calcularPrioridades(base({ financeiro:[{id:1,status:"atrasado",valorRestante:0,vencimento:"2026-07-16"}] })).length));
teste("4. cobrança vencida recebe pontuação 90", () => ok(CentralOperacoes.calcularPrioridades(base({ financeiro:[{id:1,status:"atrasado",valorRestante:50,vencimento:"2026-07-16"}] }))[0].pontuacao === 90));
teste("5. pedido atrasado gera ação", () => ok(CentralOperacoes.calcularPrioridades(base({ pedidos:[{id:1,statusPedido:"aprovado",clienteNome:"Ana",dataEntregaPrevista:"2026-07-16"}] })).some(i => i.tipo === "pedido_atrasado")));
teste("6. pedido pronto sugere entregar", () => ok(CentralOperacoes.calcularPrioridades(base({ pedidos:[{id:1,statusPedido:"pronto",clienteNome:"Ana",dataEntregaPrevista:"2026-07-17"}] }))[0].acaoPrincipal === "Entregar"));
teste("7. pedido entregue não gera ação", () => ok(!CentralOperacoes.calcularPrioridades(base({ pedidos:[{id:1,statusPedido:"entregue",dataEntregaPrevista:"2026-07-10"}] })).length));
teste("8. impressora livre é reconhecida sem alerta", () => ok(!CentralOperacoes.calcularPrioridades(base({ impressoras:[{id:1,status:"livre",ativa:true}] })).length));
teste("9. impressão em execução atrasada gera prioridade", () => ok(CentralOperacoes.calcularPrioridades(base({ lotes:[{id:1,status:"em_execucao",decorrido:90,tempoPrevistoMinutos:60,iniciadoEm:"2026-07-17T08:00:00"}] })).some(i => i.tipo === "producao_atrasada")));
teste("10. impressão pausada gera ação retomar", () => ok(CentralOperacoes.calcularPrioridades(base({ lotes:[{id:1,status:"pausada",pausadoEm:"2026-07-17T09:00:00"}] }))[0].acaoPrincipal === "Retomar"));
teste("11. falha ativa tem pontuação crítica", () => ok(CentralOperacoes.calcularPrioridades(base({ lotes:[{id:1,operacaoId:"op1",status:"falhou",atualizadoEm:"2026-07-17"}], operacoes:[{id:"op1",status:"falhou"}] }))[0].pontuacao === 100));
teste("12. modelo A1 Mini usa imagem local própria", () => ok(CentralOperacoes.getPrinterImage({modelo:"Bambu Lab A1 Mini"}).endsWith("a1-mini.svg")));
teste("13. modelo desconhecido usa fallback", () => ok(CentralOperacoes.getPrinterImage({modelo:"Modelo Experimental"}).endsWith("generic-printer.svg")));
teste("14. progresso sem dados retorna nulo", () => ok(CentralOperacoes.calcularProgresso({status:"em_execucao"}) === null));
teste("15. agenda agrupa itens reais no intervalo", () => ok(CentralOperacoes.listarProximosPassos(base({ pedidos:[{id:1,statusPedido:"pronto",clienteNome:"João",dataEntregaPrevista:"2026-07-17"}], financeiro:[{id:1,status:"pendente",valorRestante:20,vencimento:"2026-07-18"}], clientes:[{id:1,nome:"Maria",retornos:[{id:1,status:"pendente",dataHora:"2026-07-20T09:00:00"}]}] })).length === 3));
teste("16. agenda vazia", () => ok(CentralOperacoes.listarProximosPassos(base()).length === 0));

const css = fs.readFileSync(path.join(__dirname, "..", "css", "operations-center.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "..", "js", "central-operacoes.js"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

teste("17. tema claro usa variáveis do design system", () => ok(css.includes("var(--card") && css.includes("var(--text")));
teste("18. tema escuro possui tratamento próprio", () => ok(css.includes('html[data-theme="dark"]')));
teste("19. breakpoint de 320px não cria rolagem horizontal", () => ok(css.includes("@media (max-width: 350px)") && !css.includes("min-width: 320px")));
teste("20. mobile 390px usa grid 2x2", () => ok(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))")));
teste("21. tablet reduz impressoras para duas colunas", () => ok(/max-width: 980px[\s\S]*compactPrintersGrid[\s\S]*repeat\(2/.test(css)));
teste("22. desktop usa três cards de impressora", () => ok(css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))")));
teste("23. monitores grandes limitam conteúdo", () => ok(css.includes("1280px")));
teste("24. arquivos da Central e imagens integram cache offline", () => ok(sw.includes("central-operacoes.js") && sw.includes("generic-printer.svg") && sw.includes("operations-center.css")));
teste("25. atualização de progresso não grava dados", () => { const corpo = js.slice(js.indexOf("function atualizarRelogiosProducao"), js.indexOf("function agendarAtualizacaoProducao")); ok(!/salvar|setItem|Firestore/.test(corpo)); });
teste("26. cards possuem teclado e foco visível", () => ok(js.includes('tabindex="0"') && js.includes("ativarComTeclado") && css.includes(":focus-visible")));
teste("27. movimento reduzido é respeitado", () => ok(css.includes("prefers-reduced-motion: reduce")));
teste("integração: CSS e script carregam antes do app", () => ok(index.indexOf("operations-center.css") > 0 && index.indexOf("central-operacoes.js") < index.indexOf("js/app.js")));

if (!process.exitCode) console.log(`\n${aprovados} verificações aprovadas.`);
