const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const dados = new Map();
const localStorage = { getItem:k=>dados.has(k)?dados.get(k):null, setItem:(k,v)=>dados.set(k,String(v)), removeItem:k=>dados.delete(k), clear:()=>dados.clear() };
const contexto = vm.createContext({ console, localStorage, navigator:{onLine:false}, window:null, Date, Math, JSON, Map, Set, document:{getElementById:()=>null,querySelectorAll:()=>[]}, app:{innerHTML:""} });
contexto.window=contexto;
contexto.Utils={hoje:()=>"2026-07-12",moeda:v=>`R$ ${Number(v||0).toFixed(2).replace('.',',')}`};
contexto.formatarDataBR=v=>v||"-";
contexto.formatarMinutosProducao=v=>`${Number(v||0)} min`;
contexto.Producao={migrarDados(){},obterReceita:()=>[],calcularTempoDecorrido:()=>0};
contexto.Financeiro={sincronizar:()=>[]};
contexto.gerarNotificacoesOperacionais=()=>[];
contexto.Modal={abrir:(titulo,html)=>{contexto.__modal={titulo,html}},fechar(){}};
contexto.Toast={show(){}};
contexto.Page={titulo:()=>""};
contexto.cardResumoERP=()=>"";
contexto.lucide={createIcons(){}};
contexto.navegar=()=>{};

for(const arquivo of ["js/storage.js","js/config/status.js","pages/pedidos.js","pages/home.js"]){vm.runInContext(fs.readFileSync(arquivo,"utf8"),contexto,{filename:arquivo});}
vm.runInContext("globalThis.__sprint={Storage,renderAcoesPrincipaisPedido,renderCardsPedidos,statusPagamentoPedido,rotuloStatusPedido,abrirItensPedido,obterTimelinePedido,registrarEventoPedido,agruparAcoesOperacionais,renderGrupoAcoesOperacionais,renderAcaoOperacional}",contexto);
const api=contexto.__sprint;

function pedido(status,pagamento="pendente",itens=[{id:"i1",produtoId:null,nome:"Taça",quantidade:1,valorUnitario:15,valorTotal:15}]){return {id:`ped-${status}`,clienteId:"c1",clienteNome:"Dona Euza",dataPedido:"2026-07-10",dataEntregaPrevista:"2026-07-13",itens,statusPedido:status,statusPagamento:pagamento,valorTotal:itens.reduce((t,i)=>t+i.valorTotal,0),valorPago:pagamento==="pago"?15:0,valorPendente:pagamento==="pago"?0:15,ativo:true,criadoEm:"2026-07-10T10:00:00.000Z"};}

const regras=[
    ["aguardando_aceite","Aprovar",["Iniciar produção","Entregar"]],
    ["aprovado","Iniciar produção",["Entregar"]],
    ["em_producao","Ver produção",["Iniciar produção","Entregar"]],
    ["pronto","Entregar",["Iniciar produção"]],
    ["entregue","Duplicar",["Iniciar produção","Entregar"]],
    ["cancelado","Reativar",["Iniciar produção","Entregar"]]
];
for(const [status,esperado,proibidos] of regras){const html=api.renderAcoesPrincipaisPedido(pedido(status),status==="em_producao");assert(html.includes(esperado),`${status} mostra ${esperado}`);proibidos.forEach(texto=>assert(!html.includes(texto),`${status} não mostra ${texto}`));}

assert.equal(api.statusPagamentoPedido(pedido("aprovado","pago")),"pago","pedido pago permanece pago");
const atrasado=pedido("aprovado","pendente");atrasado.dataEntregaPrevista="2026-07-01";assert.equal(api.statusPagamentoPedido(atrasado),"atrasado","pendência vencida recebe badge atrasado");

const muitos=pedido("aprovado","pendente",Array.from({length:8},(_,i)=>({id:`i${i}`,nome:`Produto ${i}`,quantidade:2,valorUnitario:10,valorTotal:20})));api.Storage.salvarPedido(muitos);api.Storage.salvarOrdemProducao({id:"ord1",pedidoId:muitos.id,status:"aguardando"});
const card=api.renderCardsPedidos([muitos]);assert(card.includes("8</strong> tipo(s)")&&card.includes("16</strong> peça(s)"),"card resume muitos itens sem chips");assert(!card.includes("orderItemsPreview"),"chips antigos foram removidos");
api.abrirItensPedido(muitos.id);assert(contexto.__modal.html.includes("Produto 7")&&contexto.__modal.html.includes("16 peças"),"modal lista todos os itens e resumo");

const um=pedido("aprovado");api.Storage.salvarPedido(um);assert(api.renderCardsPedidos([um]).includes("1</strong> peça(s)"),"pedido de um item permanece legível");
api.registrarEventoPedido(um,"pedido_editado","Pedido editado","Teste");api.Storage.salvarPedido(um);api.Storage.registrarHistoricoProducao({id:"hp1",pedidoId:um.id,tipo:"impressao_iniciada",descricao:"Produção iniciada",criadoEm:"2026-07-11T09:00:00.000Z"});api.Storage.salvarPagamento({id:"pg1",pedidoId:um.id,valor:10,criadoEm:"2026-07-11T08:00:00.000Z"});const timeline=api.obterTimelinePedido(api.Storage.buscarPedidoPorId(um.id));assert(timeline.some(e=>e.origem==="produção")&&timeline.some(e=>e.origem==="financeiro")&&timeline.some(e=>e.tipo==="pedido_criado"),"timeline agrega pedido, produção e financeiro");

const css=fs.readFileSync("css/style.css","utf8");assert(css.includes("@media(max-width:320px)")&&css.includes("dark-mode"),"CSS cobre 320 px e tema escuro");assert(css.includes("orderTimeline")&&css.includes("operationsActionGroup"),"timeline e grupos possuem estilos dedicados");
const acoes=[{id:"u1",titulo:"Urgente",descricao:"Teste",icone:"alert",prioridade:"alta",modulo:"pedidos",acao:"Produzir"},{id:"h1",titulo:"Hoje",descricao:"Teste",icone:"wallet",prioridade:"media",modulo:"financeiro",acao:"Receber"},{id:"s1",titulo:"Semana 1",descricao:"Teste",icone:"package",prioridade:"media",modulo:"producao",acao:"Abrir"},{id:"s2",titulo:"Semana 2",descricao:"Teste",icone:"package",prioridade:"media",modulo:"producao",acao:"Abrir"},{id:"s3",titulo:"Semana 3",descricao:"Teste",icone:"package",prioridade:"media",modulo:"producao",acao:"Abrir"},{id:"s4",titulo:"Semana 4",descricao:"Teste",icone:"package",prioridade:"media",modulo:"producao",acao:"Abrir"},{id:"c1",titulo:"Configurar",descricao:"Teste",icone:"settings",prioridade:"media",modulo:"configuracoes",auto:true,acao:"Configurar"}];const grupos=api.agruparAcoesOperacionais(acoes);assert.deepEqual(grupos.map(g=>g.titulo),["Urgentes","Hoje","Esta semana","Configuração"],"ações são agrupadas por horizonte");const semana=api.renderGrupoAcoesOperacionais(grupos.find(g=>g.id==="semana"));assert((semana.match(/class="operationsAction priority-/g)||[]).length===3&&semana.includes("Ver todas"),"grupo mostra no máximo três ações inicialmente");const acaoCompacta=api.renderAcaoOperacional(acoes[0]);assert(acaoCompacta.includes("ellipsis")&&!acaoCompacta.includes("Concluído"),"concluído saiu do card e foi para o menu secundário");
const menu=fs.readFileSync("js/components/navigation.js","utf8");assert(menu.indexOf('"producao"')<menu.indexOf('"clientes"')&&menu.indexOf('"produtos"')<menu.indexOf('"consignado"')&&menu.indexOf('"consignado"')<menu.indexOf('"financeiro"'),"menu segue a ordem operacional do sprint");

console.log("OK: Sprint 1 validado — 16 cenários de status, pagamento, itens, timeline, ações, responsividade e temas.");
