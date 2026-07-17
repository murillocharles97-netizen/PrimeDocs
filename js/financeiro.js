const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Cartão", "Transferência", "Boleto", "Outro"];
const STATUS_FINANCEIRO = {pendente:"Pendente",parcial:"Parcial",pago:"Pago",atrasado:"Atrasado",cancelado:"Cancelado"};

const Financeiro = {
    sincronizar() {
        const atuais = Storage.listarLancamentosFinanceiros();
        const existentes = new Map(atuais.map(item => [String(item.id), item]));
        const agora = new Date().toISOString();
        const ativos = new Set();

        Storage.listarPedidos().forEach(pedido => {
            const id = `fin-pedido-${pedido.id}`;
            ativos.add(id);
            const anterior = existentes.get(id) || {};
            const valor = Math.max(0, Number(pedido.valorTotal || 0));
            const valorPago = Math.min(valor, Math.max(0, Number(pedido.valorPago || 0)));
            const vencimento = anterior.vencimento || pedido.dataEntregaPrevista || pedido.dataPedido || Utils.hoje();
            const historico = [...(anterior.historico||[])];
            if (valorPago > Number(anterior.valorPago||0)) historico.push({id:`mov-sync-${Date.now()}-${pedido.id}`,tipo:"recebimento",valor:valorPago-Number(anterior.valorPago||0),formaPagamento:anterior.formaPagamento||"Não informada",observacao:"Sincronizado pelo Pedido",data:pedido.atualizadoEm||agora});
            existentes.set(id, this.normalizar({
                ...anterior,id,origem:"pedido",origemId:pedido.id,clienteId:pedido.clienteId||null,
                clienteNome:pedido.clienteNome||"Cliente",descricao:`Pedido #${String(pedido.id).slice(-5)}`,
                valor,valorPago,valorRestante:valor-valorPago,dataCriacao:anterior.dataCriacao||pedido.criadoEm||agora,
                vencimento,dataPagamento:valorPago>=valor&&valor>0?(anterior.dataPagamento||pedido.atualizadoEm||agora):null,
                status:pedido.ativo===false||pedido.statusPedido==="cancelado"?"cancelado":undefined,
                formaPagamento:anterior.formaPagamento||"",observacao:anterior.observacao||"",historico
            }));
        });

        Storage.listarConferencias().forEach(conferencia => {
            const valor = Math.max(0, Number(conferencia.valorTotalVendido || 0));
            if (valor <= 0) return;
            const id = `fin-consignado-${conferencia.id}`;
            ativos.add(id);
            const anterior = existentes.get(id) || {};
            const loja = Storage.buscarLojaPorId(conferencia.lojaId);
            const clienteLoja = Storage.listarClientes().find(cliente => String(cliente.id) === String(loja?.clienteId) || String(cliente.lojaId) === String(conferencia.lojaId) || (!cliente.lojaId && String(cliente.nome||"").toLocaleLowerCase("pt-BR") === String(conferencia.lojaNome||"").toLocaleLowerCase("pt-BR")));
            const valorPago = conferencia.pago ? valor : Math.min(valor, Math.max(0, Number(conferencia.valorPago || anterior.valorPago || 0)));
            const dataBase = conferencia.data || String(conferencia.criadoEm || Utils.hoje()).slice(0,10);
            const historico = [...(anterior.historico||[])];
            if (valorPago > Number(anterior.valorPago||0)) historico.push({id:`mov-sync-${Date.now()}-${conferencia.id}`,tipo:"recebimento",valor:valorPago-Number(anterior.valorPago||0),formaPagamento:conferencia.formaPagamento||anterior.formaPagamento||"Não informada",observacao:"Sincronizado pela Conferência",data:conferencia.pagoEm||agora});
            existentes.set(id, this.normalizar({
                ...anterior,id,origem:"consignado",origemId:conferencia.id,clienteId:loja?.clienteId||clienteLoja?.id||null,
                clienteNome:conferencia.lojaNome||loja?.nome||"Loja parceira",descricao:"Venda em consignado",
                valor,valorPago,valorRestante:valor-valorPago,dataCriacao:anterior.dataCriacao||conferencia.criadoEm||agora,
                vencimento:anterior.vencimento||somarDiasFinanceiro(dataBase,7),
                dataPagamento:valorPago>=valor?(anterior.dataPagamento||conferencia.pagoEm||agora):null,status:undefined,
                formaPagamento:anterior.formaPagamento||conferencia.formaPagamento||"",observacao:anterior.observacao||"",historico
            }));
        });

        existentes.forEach((item,id) => {
            if (!ativos.has(id) && ["pedido","consignado"].includes(item.origem) && item.status !== "pago") item.status = "cancelado";
        });
        const lista = [...existentes.values()].map(item=>this.normalizar(item));
        if (JSON.stringify(atuais) !== JSON.stringify(lista)) Storage.salvarLancamentosFinanceiros(lista);
        return lista.sort((a,b)=>timestampFinanceiro(a.vencimento)-timestampFinanceiro(b.vencimento));
    },

    normalizar(item) {
        const valor=Math.max(0,Number(item.valor||0)),pago=Math.min(valor,Math.max(0,Number(item.valorPago||0))),restante=Math.max(0,valor-pago);
        let status=item.status;
        if(status!=="cancelado") status=restante<=0&&valor>0?"pago":pago>0?"parcial":dataFinanceiroAtrasada(item.vencimento)?"atrasado":"pendente";
        return {...item,valor,valorPago:pago,valorRestante:restante,status,formaPagamento:item.formaPagamento||"",observacao:item.observacao||"",historico:Array.isArray(item.historico)?item.historico:[]};
    },

    salvarEdicao(id,dados) {
        const item=Storage.buscarLancamentoFinanceiroPorId(id);if(!item)return false;
        const atualizado=this.normalizar({...item,vencimento:dados.vencimento||item.vencimento,formaPagamento:dados.formaPagamento||"",observacao:dados.observacao||""});
        Storage.salvarLancamentoFinanceiro(atualizado);return atualizado;
    },

    registrarRecebimento(id,valor,formaPagamento,observacao="") {
        let item=Storage.buscarLancamentoFinanceiroPorId(id);if(!item||item.status==="cancelado")return false;
        const recebido=Math.min(item.valorRestante,Math.max(0,Number(valor||0)));if(recebido<=0)return false;
        const agora=new Date().toISOString();item.valorPago=Number(item.valorPago||0)+recebido;item.valorRestante=Math.max(0,item.valor-item.valorPago);item.formaPagamento=formaPagamento||item.formaPagamento||"Outro";item.dataPagamento=item.valorRestante<=0?agora:null;item.observacao=observacao||item.observacao||"";item.historico=[...(item.historico||[]),{id:`mov-${Date.now()}`,tipo:"recebimento",valor:recebido,formaPagamento:item.formaPagamento,observacao,data:agora}];item=this.normalizar(item);Storage.salvarLancamentoFinanceiro(item);
        Storage.salvarPagamento({id:`pag-fin-${Date.now()}`,clienteId:item.clienteId,clienteNome:item.clienteNome,pedidoId:item.origem==="pedido"?item.origemId:null,conferenciaId:item.origem==="consignado"?item.origemId:null,valor:recebido,data:Utils.hoje(),tipo:item.origem,formaPagamento:item.formaPagamento,criadoEm:agora});
        this.atualizarOrigem(item);return item;
    },

    atualizarOrigem(item) {
        if(item.origem==="pedido") {const pedido=Storage.buscarPedidoPorId(item.origemId);if(pedido){pedido.valorPago=item.valorPago;pedido.valorPendente=item.valorRestante;pedido.statusPagamento=item.status==="pago"?"pago":item.valorPago>0?"parcial":"pendente";pedido.atualizadoEm=new Date().toISOString();Storage.salvarPedido(pedido);}}
        if(item.origem==="consignado") {const conferencia=Storage.listarConferencias().find(c=>String(c.id)===String(item.origemId));if(conferencia){conferencia.valorPago=item.valorPago;conferencia.pago=item.status==="pago";conferencia.pagoEm=conferencia.pago?new Date().toISOString():null;conferencia.formaPagamento=item.formaPagamento;Storage.salvarConferencia(conferencia);}}
    },

    calcularResumo(lista=this.sincronizar()) {
        const hoje=Utils.hoje(),mes=hoje.slice(0,7),fimSemana=somarDiasFinanceiro(hoje,6);
        const emAberto=lista.filter(i=>!["pago","cancelado"].includes(i.status));
        const recebidoMes=Storage.listarPagamentos().filter(p=>String(p.criadoEm||p.data||"").startsWith(mes)).reduce((t,p)=>t+Number(p.valor||0),0);
        return {hoje:emAberto.filter(i=>i.vencimento===hoje).reduce(somarRestanteFinanceiro,0),semana:emAberto.filter(i=>i.vencimento>=hoje&&i.vencimento<=fimSemana).reduce(somarRestanteFinanceiro,0),mes:emAberto.filter(i=>String(i.vencimento||"").startsWith(mes)).reduce(somarRestanteFinanceiro,0),atraso:emAberto.filter(i=>i.status==="atrasado").reduce(somarRestanteFinanceiro,0),recebidoMes};
    }
};

function gerarNotificacoesOperacionais() {
    const anteriores=new Map(Storage.listarNotificacoes().map(n=>[String(n.id),n])),geradas=[],hoje=Utils.hoje(),amanha=somarDiasFinanceiro(hoje,1);
    Financeiro.sincronizar().filter(i=>!["pago","cancelado"].includes(i.status)).forEach(i=>{if(i.status==="atrasado")geradas.push(criarNotificacaoOperacional(`fin-atrasado-${i.id}`,"Pagamento atrasado",`${i.clienteNome} · ${Utils.moeda(i.valorRestante)}`,"financeiro","alta","financeiro",anteriores));else if(i.vencimento===hoje||i.vencimento===amanha)geradas.push(criarNotificacaoOperacional(`fin-vencimento-${i.id}`,i.vencimento===hoje?"Receber hoje":"Recebimento amanhã",`${i.clienteNome} · ${Utils.moeda(i.valorRestante)}`,"financeiro","alta","financeiro",anteriores));});
    Storage.listarPedidos().filter(p=>p.ativo!==false&&!['entregue','cancelado'].includes(p.statusPedido)).forEach(p=>{if(p.dataEntregaPrevista&&p.dataEntregaPrevista<hoje)geradas.push(criarNotificacaoOperacional(`pedido-atrasado-${p.id}`,"Pedido atrasado",`${p.clienteNome} · entrega ${formatarDataBR(p.dataEntregaPrevista)}`,"producao","alta","pedidos",anteriores));else if(p.dataEntregaPrevista===amanha)geradas.push(criarNotificacaoOperacional(`pedido-amanha-${p.id}`,"Entrega amanhã",p.clienteNome,"producao","media","pedidos",anteriores));});
    const gruposFilamentos=window.FilamentIntegration?.agruparRolos
        ? FilamentIntegration.agruparRolos(Storage.listarFilamentos().filter(f=>f.ativo!==false))
        : Storage.listarFilamentos().filter(f=>f.ativo!==false).map(f=>({chave:f.id,material:f.material,cor:f.cor,pesoDisponivelTotal:Number(f.pesoAtualKg||0)*1000,baixoEstoque:Number(f.pesoAtualKg||0)<=Number(f.alertaMinimoKg||0)}));
    gruposFilamentos.filter(grupo=>grupo.baixoEstoque).forEach(grupo=>geradas.push(criarNotificacaoOperacional(`filamento-${String(grupo.chave).replace(/[^a-z0-9]+/gi,"-")}`,"Filamento crítico",`${grupo.material} ${grupo.cor} · ${Number(grupo.pesoDisponivelTotal||0).toFixed(0)} g disponíveis no grupo`,"filamentos","alta","filamentos",anteriores)));
    calcularLojasParaVisitar().forEach(i=>geradas.push(criarNotificacaoOperacional(`loja-visita-${i.loja.id}`,"Loja para visitar",`${i.loja.nome} · ${i.dias} dias sem conferência`,"consignado","media","consignado",anteriores)));
    Storage.salvarNotificacoes(geradas);atualizarBadgeNotificacoes(geradas);return geradas;
}

function calcularLojasParaVisitar(){const hoje=Date.now(),conferencias=Storage.listarConferencias(),estoques=Storage.listarEstoquesLojas();return Storage.listarLojas().filter(l=>l.ativo!==false&&estoques.some(e=>String(e.lojaId)===String(l.id)&&(e.itens||[]).some(i=>Number(i.quantidade||0)>0))).map(loja=>{const ultimas=conferencias.filter(c=>String(c.lojaId)===String(loja.id)).sort((a,b)=>timestampFinanceiro(b.criadoEm||b.data)-timestampFinanceiro(a.criadoEm||a.data));const base=ultimas[0]?.criadoEm||ultimas[0]?.data||loja.criadoEm;const dias=base?Math.floor((hoje-timestampFinanceiro(base))/86400000):999;return{loja,dias,ultima:base};}).filter(i=>i.dias>=14).sort((a,b)=>b.dias-a.dias);}
function criarNotificacaoOperacional(id,titulo,descricao,tipo,prioridade,modulo,anteriores){return{id,titulo,descricao,tipo,prioridade,modulo,link:modulo,visualizada:anteriores.get(id)?.visualizada||false,criadoEm:anteriores.get(id)?.criadoEm||new Date().toISOString()};}
function atualizarBadgeNotificacoes(lista=Storage.listarNotificacoes()){const dot=document.querySelector('.notificationDot'),qtd=lista.filter(n=>!n.visualizada).length;if(dot){dot.dataset.count=qtd;dot.classList.toggle('isEmpty',qtd===0);dot.title=qtd?`${qtd} notificações`:"Sem notificações";}}
function abrirCentralNotificacoes(){const lista=gerarNotificacoesOperacionais().sort((a,b)=>(a.prioridade==="alta"?-1:1)-(b.prioridade==="alta"?-1:1));Modal.abrir("Central de notificações",lista.length?`<div class="notificationList">${lista.map(n=>`<button onclick="abrirNotificacaoOperacional('${n.id}','${n.link}')"><span class="notificationType ${n.prioridade}"><i data-lucide="${iconeNotificacao(n.tipo)}"></i></span><span><strong>${escaparFinanceiro(n.titulo)}</strong><small>${escaparFinanceiro(n.descricao)}</small></span>${n.visualizada?"":`<i class="notificationUnread" data-lucide="circle"></i>`}</button>`).join("")}</div>`:`<div class="erpEmpty"><i data-lucide="bell-check"></i><strong>Tudo em dia</strong><p>Nenhuma ação exige sua atenção agora.</p></div>`);lucide.createIcons();}
function abrirNotificacaoOperacional(id,link){Storage.marcarNotificacaoVisualizada(id);atualizarBadgeNotificacoes();Modal.fechar();navegar(link||"home");}
function iconeNotificacao(tipo){return({financeiro:"wallet",producao:"printer",consignado:"store",filamentos:"spool",sistema:"bell"})[tipo]||"bell";}
function somarDiasFinanceiro(data,dias){const d=new Date(`${String(data).slice(0,10)}T12:00:00`);d.setDate(d.getDate()+dias);return d.toISOString().slice(0,10);}
function dataFinanceiroAtrasada(data){return Boolean(data&&data<Utils.hoje());}
function timestampFinanceiro(v){if(!v)return 0;const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?0:d.getTime();}
function somarRestanteFinanceiro(t,i){return t+Number(i.valorRestante||0);}
function escaparFinanceiro(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
