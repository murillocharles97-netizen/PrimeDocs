const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const memory = new Map();
const fields = new Map();
const localStorage = { getItem:k=>memory.has(k)?memory.get(k):null, setItem:(k,v)=>memory.set(k,String(v)), removeItem:k=>memory.delete(k), clear:()=>memory.clear() };
const document = {
    getElementById:id=>fields.get(id)||null,
    querySelector:()=>null,
    querySelectorAll:()=>[],
    addEventListener(){},
};
const context = vm.createContext({ console, localStorage, document, navigator:{onLine:false}, window:null, Date, Math, JSON, Map, Set, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, app:{innerHTML:""} });
context.window=context;
context.Utils={hoje:()=>"2026-07-12",moeda:v=>`R$ ${Number(v||0).toFixed(2).replace(".",",")}`};
context.formatarDataBR=v=>v||"-";
context.Modal={abrir:(titulo,html)=>{context.__modal={titulo,html}},fechar(){}};
context.Toast={show:mensagem=>{context.__toast=mensagem}};
context.Page={titulo:()=>""};
context.Input={text:()=>"",number:()=>""};
context.Button={primary:()=>""};
context.lucide={createIcons(){}};
context.navegar=()=>{};
context.cardResumoERP=(icone,valor,rotulo)=>`<article>${icone}|${valor}|${rotulo}</article>`;
context.STATUS_PEDIDOS={aprovado:"Aprovado",em_producao:"Em produção",entregue:"Entregue"};
context.Financeiro={sincronizar:()=>[]};
context.gerarNotificacoesOperacionais=()=>[];
context.formatarMinutosProducao=v=>`${Number(v||0)} min`;

for(const file of ["js/storage.js","js/filamentos-integracao.js","js/producao.js","pages/clientes.js","pages/producao.js","pages/impressoras.js","pages/home.js","js/global-search.js"]){
    vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
vm.runInContext("globalThis.__api={Storage,GlobalSearch,avaliarRelacionamentoCliente,salvarInteracaoCliente,salvarRetornoCliente,montarAcoesCRM,cardImpressora,cardOrdemProducao,cardLoteAtivo,renderAcaoOperacional,renderVisaoProducao}; abrirDetalhesCliente=()=>{}; renderImpressoras=()=>{};",context);
const api=context.__api;

const novo={id:"cli-novo",nome:"Cliente Novo",whatsapp:"11999999999",cidade:"São Paulo",tipo:"particular",ativo:true,criadoEm:"2026-07-12T10:00:00Z"};
const recorrente={id:"cli-rec",nome:"Brenda Adidas",whatsapp:"11988887777",cidade:"Santos",tipo:"empresa",ativo:true,criadoEm:"2026-01-01T10:00:00Z"};
const pendente={id:"cli-pend",nome:"Tyson Hamburgueria",telefone:"1133334444",cidade:"Campinas",tipo:"empresa",ativo:true};
[novo,recorrente,pendente].forEach(api.Storage.salvarCliente.bind(api.Storage));
api.Storage.salvarPedido({id:"ped-00999",clienteId:recorrente.id,clienteNome:recorrente.nome,statusPedido:"entregue",valorTotal:200,valorPendente:0,itens:[{produtoId:"prod-1",nome:"Taça da Copa",quantidade:5}],ativo:true,dataPedido:"2026-07-10"});
api.Storage.salvarPedido({id:"ped-01000",clienteId:recorrente.id,clienteNome:recorrente.nome,statusPedido:"aprovado",valorTotal:150,valorPendente:50,itens:[{produtoId:"prod-1",nome:"Taça da Copa",quantidade:2}],ativo:true,dataPedido:"2026-07-11"});
api.Storage.salvarPedido({id:"ped-02000",clienteId:pendente.id,clienteNome:pendente.nome,statusPedido:"aprovado",valorTotal:300,valorPendente:300,itens:[],ativo:true,dataPedido:"2026-07-09"});
api.Storage.salvarProduto({id:"prod-1",codigo:"TAC-001",nome:"Taça da Copa",categoria:"Taças",preco:30,estoque:8,ativo:true});

assert.equal(api.avaliarRelacionamentoCliente(novo,[]),"novo","cliente sem pedidos é novo");
assert.equal(api.avaliarRelacionamentoCliente(recorrente,api.Storage.listarPedidos().filter(p=>p.clienteId===recorrente.id)),"recorrente","cliente com vários pedidos é recorrente");
assert(api.GlobalSearch.buscar("Tyson").some(i=>i.id===pendente.id&&i.subtitulo.includes("300,00")),"cliente com pagamento pendente aparece na busca");

function field(id,value){fields.set(id,{value,checked:false});}
field("crmInteracaoDescricao","Contato sobre novo pedido");field("crmInteracaoData","2026-07-12T09:30");field("crmInteracaoRetorno","2026-07-12T10:00");field("crmInteracaoTipo","whatsapp");field("crmInteracaoResultado","Interessado");field("crmInteracaoProximo","Enviar catálogo");field("crmInteracaoResponsavel","Murillo");
api.salvarInteracaoCliente(novo.id);
let salvo=api.Storage.buscarClientePorId(novo.id);
assert.equal(salvo.interacoes.length,1,"interação é registrada");
assert.equal(salvo.retornos.length,1,"retorno da interação é agendado");
assert(api.montarAcoesCRM().some(a=>a.id.includes(novo.id)),"retorno aparece na Central de Operações");

assert(api.GlobalSearch.buscar("brenda").some(i=>i.tipo==="cliente"&&i.id===recorrente.id),"busca cliente por nome");
assert(api.GlobalSearch.buscar("00999").some(i=>i.tipo==="pedido"&&i.id==="ped-00999"),"busca pedido por número");
assert(api.GlobalSearch.buscar("tac001").some(i=>i.tipo==="produto"&&i.id==="prod-1"),"busca produto por código normalizado");

const basePrinter={modelo:"A1 Mini",fabricante:"Bambu Lab",ativa:true,possuiAms:false,filaOperacoes:[],horasTotais:10,horasDesdeManutencao:20,limiteManutencaoHoras:500};
api.Storage.salvarImpressora({...basePrinter,id:"imp-livre",nome:"A1 Mini Livre",status:"livre"});
api.Storage.salvarImpressora({...basePrinter,id:"imp-run",nome:"A1 Mini 001",status:"imprimindo",operacaoAtualId:"lote-run"});
api.Storage.salvarImpressora({...basePrinter,id:"imp-man",nome:"P1S 01",status:"manutencao"});
api.Storage.salvarOrdemProducao({id:"ord-run",pedidoId:"ped-00999",produtoNome:"Taça da Copa",clienteNome:"Brenda Adidas",quantidade:5,status:"em_producao",ativo:true});
api.Storage.salvarOperacaoProducao({id:"op-run",ordemProducaoId:"ord-run",pedidoId:"ped-00999",nome:"Imprimir Taça",tipo:"impressao",quantidade:5,status:"em_execucao",tempoPrevistoMinutos:300});
api.Storage.salvarLoteExecucao({id:"lote-run",operacaoId:"op-run",ordemProducaoId:"ord-run",pedidoId:"ped-00999",impressoraId:"imp-run",quantidade:5,status:"em_execucao",tempoPrevistoMinutos:300,iniciadoEm:new Date(Date.now()-72*60000).toISOString(),filamentosSelecionados:[]});
api.Storage.salvarManutencao({id:"man-1",impressoraId:"imp-man",tipo:"Troca de bico",observacoes:"Troca de bico",status:"em_andamento",inicio:"2026-07-12T09:00:00"});
assert(api.cardImpressora(api.Storage.buscarImpressoraPorId("imp-livre")).includes("Impressora disponível"),"card de impressora livre");
assert(api.cardImpressora(api.Storage.buscarImpressoraPorId("imp-run")).includes("Taça da Copa")&&api.cardImpressora(api.Storage.buscarImpressoraPorId("imp-run")).includes("Abrir produção"),"card de impressora ocupada");
assert(api.cardImpressora(api.Storage.buscarImpressoraPorId("imp-man")).includes("Troca de bico")&&api.cardImpressora(api.Storage.buscarImpressoraPorId("imp-man")).includes("Concluir manutenção"),"card de manutenção contextual");

api.Storage.salvarOrdemProducao({id:"ord-wait",pedidoId:"ped-02000",produtoNome:"Produto aguardando",clienteNome:"Tyson",quantidade:2,status:"aguardando",ativo:true});
api.Storage.salvarOperacaoProducao({id:"op-wait",ordemProducaoId:"ord-wait",pedidoId:"ped-02000",nome:"Imprimir",tipo:"impressao",quantidade:2,status:"aguardando",tempoPrevistoMinutos:60});
assert(api.cardOrdemProducao(api.Storage.buscarOrdemProducaoPorId("ord-wait")).includes("Alocar"),"produção aguardando mostra Alocar");
assert(api.cardLoteAtivo(api.Storage.buscarLoteExecucaoPorId("lote-run")).includes("Ocupada"),"produção em execução mostra impressora ocupada");

const actionHtml=api.renderAcaoOperacional({id:"a1",icone:"wallet",titulo:"Receber",descricao:"Cliente",prioridade:"media",modulo:"financeiro",acao:"Receber"});
assert(!actionHtml.includes(">HOJE<"),"selo HOJE redundante foi removido");
const css=fs.readFileSync("css/style.css","utf8");
assert(css.includes("@media(max-width:320px)")&&css.includes("printerGrid")&&css.includes("grid-template-columns:repeat(auto-fit"),"Impressoras respondem em 320 px");
assert(css.includes("dark-mode")&&css.includes("globalSearch")&&css.includes("crmCustomerCard"),"tema escuro, busca e CRM preservados");

console.log("OK: Sprint 2 validado — 17 cenários de CRM, busca, impressoras, produção, responsividade e temas.");
