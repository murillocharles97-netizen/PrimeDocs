let clienteEditandoId = null;
let clienteDetalheId = null;

const TIPOS_CLIENTE = {
    particular: "Cliente Particular",
    loja_parceira: "Loja Parceira",
    empresa: "Empresa",
    fornecedor: "Fornecedor",
    outro: "Outro"
};
const STATUS_RELACIONAMENTO = { novo:"Novo", ativo:"Ativo", recorrente:"Recorrente", vip:"VIP", inativo:"Inativo", em_risco:"Em risco" };
const CLASSIFICACOES_CLIENTE = { quente:"Quente", morno:"Morno", frio:"Frio" };

function renderClientes() {
    sincronizarLojasExistentesClientes();
    clienteDetalheId = null;
    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("👥 Clientes", "Relacionamentos, histórico e resultados em um só lugar.")}
        <section class="erpToolbar clientToolbar">
            <label class="erpSearch"><i data-lucide="search"></i><input id="pesquisaCliente" placeholder="Nome, contato, cidade ou documento" oninput="atualizarListaClientes()"></label>
            <select id="filtroTipoCliente" onchange="atualizarListaClientes()"><option value="">Todos os tipos</option>${Object.entries(TIPOS_CLIENTE).map(([valor,rotulo])=>`<option value="${valor}">${rotulo}</option>`).join("")}</select>
            <button class="btn erpAddButton" onclick="abrirModalCliente()"><i data-lucide="user-plus"></i> Novo cliente</button>
        </section>
        <div id="listaClientes" class="erpCardGrid clientGrid"></div>
        <button class="fab" type="button" onclick="abrirModalCliente()" aria-label="Novo cliente"><i data-lucide="plus"></i></button>`;
    atualizarListaClientes();
}

function atualizarListaClientes() {
    const container = document.getElementById("listaClientes");
    if (!container) return;
    const termo = String(document.getElementById("pesquisaCliente")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const tipo = document.getElementById("filtroTipoCliente")?.value || "";
    const clientes = Storage.listarClientes()
        .filter(cliente => cliente.ativo !== false)
        .filter(cliente => !tipo || cliente.tipo === tipo)
        .filter(cliente => [cliente.nome,cliente.telefone,cliente.whatsapp,cliente.email,cliente.cpfCnpj,cliente.cidade].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(termo))
        .sort((a,b)=>String(a.nome||"").localeCompare(String(b.nome||""),"pt-BR",{sensitivity:"base"}));

    container.innerHTML = clientes.length ? clientes.map(cliente => {
        const pedidos = obterPedidosCliente(cliente);
        const aberto = pedidos.reduce((total,pedido)=>total+Number(pedido.valorPendente||0),0);
        const total=pedidos.filter(p=>p.statusPedido!=="cancelado").reduce((t,p)=>t+Number(p.valorTotal||0),0),ultimo=pedidos.sort(ordenarRecentesCliente)[0],status=avaliarRelacionamentoCliente(cliente,pedidos),retorno=(cliente.retornos||[]).filter(r=>r.status==="pendente").sort((a,b)=>new Date(a.dataHora)-new Date(b.dataHora))[0];
        return `<article class="erpEntityCard clientCard crmCustomerCard" onclick="abrirDetalhesCliente('${escaparCliente(cliente.id)}')" tabindex="0" role="button">
            <div class="clientCardTop"><span class="clientAvatar">${iniciaisCliente(cliente.nome)}</span><div><h3>${escaparCliente(cliente.nome)}</h3><p>${TIPOS_CLIENTE[cliente.tipo]||"Cliente Particular"}${cliente.cidade?` · ${escaparCliente(cliente.cidade)}`:""}</p></div><span class="erpBadge crm-${status}">${STATUS_RELACIONAMENTO[status]||status}</span></div>
            <div class="clientContactList">${cliente.whatsapp?`<span><i data-lucide="message-circle"></i>${escaparCliente(cliente.whatsapp)}</span>`:`<span><i data-lucide="message-circle-off"></i>WhatsApp não informado</span>`}</div>
            <div class="clientCardMetrics crmMetrics"><div><strong>${Utils.moeda(total)}</strong><span>Total comprado</span></div><div><strong>${ultimo?formatarDataCliente(ultimo.dataPedido||ultimo.criadoEm):"Nenhum"}</strong><span>Último pedido</span></div><div><strong>${Utils.moeda(aberto)}</strong><span>Pendente</span></div><div><strong>${retorno?formatarDataCliente(retorno.dataHora):cliente.proximoContato?formatarDataCliente(cliente.proximoContato):"Nenhuma"}</strong><span>Próxima ação</span></div></div>
            <div class="erpCardActions clientSmartActions" onclick="event.stopPropagation()"><button class="primaryAction" onclick="abrirDetalhesCliente('${escaparCliente(cliente.id)}')"><i data-lucide="user-round"></i> Abrir</button>${cliente.whatsapp?`<button onclick="abrirWhatsappCliente('${escaparCliente(cliente.id)}')"><i data-lucide="message-circle"></i> WhatsApp</button>`:""}<button onclick="novoPedidoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="package-plus"></i> Novo pedido</button><button class="clientMoreButton" aria-label="Mais ações" onclick="abrirMenuCliente('${escaparCliente(cliente.id)}')"><i data-lucide="ellipsis"></i></button></div>
        </article>`;
    }).join("") : `<div class="erpEmpty"><i data-lucide="users"></i><strong>Nenhum cliente encontrado</strong><p>Cadastre o primeiro cliente para integrar pedidos, orçamentos e lojas.</p><button class="btn" onclick="abrirModalCliente()">Cadastrar cliente</button></div>`;
    lucide.createIcons();
}

function abrirModalCliente(id = null, contexto = "clientes") {
    const cliente = id ? Storage.buscarClientePorId(id) : null;
    clienteEditandoId = cliente?.id || null;
    Modal.abrir(cliente ? "Editar cliente" : "Novo cliente", `<div class="clientForm erpFormGrid">
        ${Input.text("Nome *","clienteNome","Nome completo ou razão social",escaparCliente(cliente?.nome||""))}
        <label class="inputGroup"><span>Tipo</span><select id="clienteTipo">${Object.entries(TIPOS_CLIENTE).map(([valor,rotulo])=>`<option value="${valor}" ${cliente?.tipo===valor?"selected":""}>${rotulo}</option>`).join("")}</select></label>
        ${Input.text("Telefone","clienteTelefone","(00) 0000-0000",escaparCliente(cliente?.telefone||""))}
        ${Input.text("WhatsApp","clienteWhatsapp","(00) 00000-0000",escaparCliente(cliente?.whatsapp||""))}
        ${Input.text("E-mail","clienteEmail","cliente@email.com",escaparCliente(cliente?.email||""))}
        ${Input.text("CPF / CNPJ","clienteCpfCnpj","Documento",escaparCliente(cliente?.cpfCnpj||""))}
        ${Input.text("Cidade","clienteCidade","Cidade",escaparCliente(cliente?.cidade||""))}
        ${Input.text("Instagram","clienteInstagram","@usuario",escaparCliente(cliente?.instagram||""))}
        <label class="inputGroup"><span>Status do relacionamento</span><select id="clienteStatusRelacionamento">${Object.entries(STATUS_RELACIONAMENTO).map(([v,l])=>`<option value="${v}" ${(cliente?.statusRelacionamento||"novo")===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <label class="inputGroup"><span>Classificação</span><select id="clienteClassificacao">${Object.entries(CLASSIFICACOES_CLIENTE).map(([v,l])=>`<option value="${v}" ${(cliente?.classificacao||"morno")===v?"selected":""}>${l}</option>`).join("")}</select></label>
        ${Input.text("Tags","clienteTags","Ex.: recorrente, chaveiros, atacado",(cliente?.tags||[]).join(", "))}
        <label class="inputGroup"><span>Próximo contato</span><input id="clienteProximoContato" type="date" value="${escaparCliente(cliente?.proximoContato||"")}"></label>
        <label class="inputGroup erpFull"><span>Endereço</span><input id="clienteEndereco" value="${escaparCliente(cliente?.endereco||"")}" placeholder="Endereço completo"></label>
        <label class="inputGroup erpFull"><span>Observações</span><textarea id="clienteObservacoes" rows="3" placeholder="Preferências e informações importantes">${escaparCliente(cliente?.observacoes||"")}</textarea></label>
        <div class="modalActions erpFull"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="salvarCliente('${contexto}')">Salvar cliente</button></div>
    </div>`);
    lucide.createIcons();
}

function salvarCliente(contexto = "clientes") {
    const nome = document.getElementById("clienteNome")?.value.trim();
    if (!nome) return Toast.show("Informe o nome do cliente.");
    const anterior = clienteEditandoId ? Storage.buscarClientePorId(clienteEditandoId) : null;
    const agora = new Date().toISOString();
    const cliente = {
        id: anterior?.id || `cli-${Date.now()}`,
        nome,
        telefone: valorCliente("clienteTelefone"), whatsapp: valorCliente("clienteWhatsapp"), email: valorCliente("clienteEmail"),
        cpfCnpj: valorCliente("clienteCpfCnpj"), cidade: valorCliente("clienteCidade"), endereco: valorCliente("clienteEndereco"),
        instagram: valorCliente("clienteInstagram"), observacoes: valorCliente("clienteObservacoes"),
        tipo: document.getElementById("clienteTipo")?.value || "particular",
        statusRelacionamento:document.getElementById("clienteStatusRelacionamento")?.value||"novo",classificacao:document.getElementById("clienteClassificacao")?.value||"morno",tags:valorCliente("clienteTags").split(",").map(v=>v.trim()).filter(Boolean),proximoContato:document.getElementById("clienteProximoContato")?.value||"",ultimaInteracao:anterior?.ultimaInteracao||null,interacoes:Array.isArray(anterior?.interacoes)?anterior.interacoes:[],retornos:Array.isArray(anterior?.retornos)?anterior.retornos:[],ativo: true,
        lojaId: anterior?.lojaId || null, criadoEm: anterior?.criadoEm || agora, atualizadoEm: agora
    };
    Storage.salvarCliente(cliente);
    if (cliente.tipo === "loja_parceira") sincronizarClienteComoLoja(cliente);
    Modal.fechar();
    Toast.show("Cliente salvo com sucesso!");
    if (contexto === "pedido") { abrirModalPedido(null, cliente.id); return; }
    if (contexto === "orcamento") { clienteOrcamentoId = cliente.id; renderOrcamento(); return; }
    if (clienteDetalheId) abrirDetalhesCliente(cliente.id); else atualizarListaClientes();
}

function sincronizarClienteComoLoja(cliente) {
    const existente = Storage.listarLojas().find(loja => String(loja.clienteId) === String(cliente.id) || String(loja.id) === String(cliente.lojaId));
    const loja = {id:existente?.id||`loja-${cliente.id}`,clienteId:cliente.id,nome:cliente.nome,responsavel:cliente.nome,whatsapp:cliente.whatsapp||cliente.telefone||"",endereco:cliente.endereco||"",observacoes:cliente.observacoes||"",ativo:cliente.ativo!==false,criadoEm:existente?.criadoEm||cliente.criadoEm};
    Storage.salvarLoja(loja);
    if (cliente.lojaId !== loja.id) { cliente.lojaId = loja.id; Storage.salvarCliente(cliente); }
}

function sincronizarLojasExistentesClientes(){
    const clientes=Storage.listarClientes();
    Storage.listarLojas().filter(loja=>loja.ativo!==false).forEach(loja=>{
        let cliente=clientes.find(item=>String(item.lojaId)===String(loja.id)||String(loja.clienteId)===String(item.id));
        if(!cliente){const agora=new Date().toISOString();cliente={id:`cli-loja-${loja.id}`,nome:loja.nome,telefone:"",whatsapp:loja.whatsapp||"",email:"",cpfCnpj:"",cidade:"",endereco:loja.endereco||"",instagram:"",observacoes:loja.observacoes||"",tipo:"loja_parceira",lojaId:loja.id,ativo:true,criadoEm:loja.criadoEm||agora,atualizadoEm:agora};Storage.salvarCliente(cliente);clientes.push(cliente);}
        if(String(loja.clienteId)!==String(cliente.id)){loja.clienteId=cliente.id;Storage.salvarLoja(loja);}
    });
}

function abrirDetalhesCliente(id) {
    const cliente = Storage.buscarClientePorId(id);
    if (!cliente) return Toast.show("Cliente não encontrado.");
    clienteDetalheId = cliente.id;
    const pedidos = obterPedidosCliente(cliente).sort(ordenarRecentesCliente);
    const orcamentos = obterOrcamentosCliente(cliente).sort(ordenarRecentesCliente);
    const pagamentos = obterPagamentosCliente(cliente).sort(ordenarRecentesCliente);
    const loja = Storage.listarLojas().find(item=>String(item.clienteId)===String(cliente.id)||String(item.id)===String(cliente.lojaId)||normalizarCliente(item.nome)===normalizarCliente(cliente.nome));
    const consignados = loja ? Storage.listarConsignados().filter(item=>String(item.lojaId)===String(loja.id)||normalizarCliente(item.lojaNome)===normalizarCliente(loja.nome)).sort(ordenarRecentesCliente) : [];
    const conferencias = loja ? Storage.listarConferencias().filter(item=>String(item.lojaId)===String(loja.id)||normalizarCliente(item.lojaNome)===normalizarCliente(loja.nome)).sort(ordenarRecentesCliente) : [];
    const totalComprado = pedidos.filter(p=>p.statusPedido!=="cancelado").reduce((t,p)=>t+Number(p.valorTotal||0),0);
    const pendentes = pedidos.filter(p=>!["entregue","cancelado"].includes(p.statusPedido));
    const emAberto = pedidos.reduce((t,p)=>t+Number(p.valorPendente||0),0);
    const contasCliente = Financeiro.sincronizar().filter(item=>String(item.clienteId)===String(cliente.id));
    const totalPago = contasCliente.reduce((t,item)=>t+Number(item.valorPago||0),0);
    const ultimoPagamento = pagamentos[0]?.criadoEm||pagamentos[0]?.data;
    const topProdutos = calcularTopProdutosCliente(pedidos);
    const timeline = criarTimelineCliente({pedidos,orcamentos,pagamentos,consignados,conferencias,cliente});
    const ticketMedio=pedidos.length?totalComprado/pedidos.length:0,aprovados=orcamentos.filter(o=>o.status==="aprovado").length,taxaAprovacao=orcamentos.length?Math.round(aprovados/orcamentos.length*100):0,statusRelacionamento=avaliarRelacionamentoCliente(cliente,pedidos);
    app.innerHTML = `<button class="back" onclick="renderClientes()"><i data-lucide="arrow-left"></i> Clientes</button>
        <section class="clientDetailHero crmDetailHero"><div class="clientAvatar large">${iniciaisCliente(cliente.nome)}</div><div><span>${TIPOS_CLIENTE[cliente.tipo]||"Cliente"}</span><h1>${escaparCliente(cliente.nome)}</h1><p>${[cliente.whatsapp,cliente.email,cliente.cidade].filter(Boolean).map(escaparCliente).join(" · ")||"Sem contatos adicionais"}</p><div class="crmTagRow"><b class="erpBadge crm-${statusRelacionamento}">${STATUS_RELACIONAMENTO[statusRelacionamento]}</b><b class="erpBadge classification-${cliente.classificacao||'morno'}">${CLASSIFICACOES_CLIENTE[cliente.classificacao||'morno']}</b>${(cliente.tags||[]).map(t=>`<span>${escaparCliente(t)}</span>`).join('')}</div></div><button class="btnSecondary" onclick="abrirModalCliente('${escaparCliente(cliente.id)}')"><i data-lucide="pencil"></i> Editar</button></section>
        <section class="clientQuickActions crmQuickActions"><button onclick="novoPedidoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="package-plus"></i><span>Novo Pedido</span></button><button onclick="novoOrcamentoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="file-plus-2"></i><span>Novo Orçamento</span></button>${cliente.whatsapp?`<button onclick="abrirWhatsappCliente('${cliente.id}')"><i data-lucide="message-circle"></i><span>WhatsApp</span></button>`:""}<button onclick="registrarInteracaoCliente('${cliente.id}')"><i data-lucide="messages-square"></i><span>Interação</span></button><button onclick="agendarRetornoCliente('${cliente.id}')"><i data-lucide="calendar-plus"></i><span>Agendar retorno</span></button>${emAberto>0?`<button onclick="navegar('financeiro')"><i data-lucide="hand-coins"></i><span>Cobrar</span></button>`:""}</section>
        <section class="clientMetricsGrid">${metricaCliente("circle-dollar-sign",Utils.moeda(totalComprado),"Total comprado")}${metricaCliente("badge-check",Utils.moeda(totalPago),"Total pago")}${metricaCliente("wallet-cards",Utils.moeda(emAberto),"Total pendente")}${metricaCliente("receipt",Utils.moeda(ticketMedio),"Ticket médio")}${metricaCliente("shopping-bag",pedidos.length,"Pedidos")}${metricaCliente("file-check-2",orcamentos.length,"Orçamentos")}${metricaCliente("percent",`${taxaAprovacao}%`,"Taxa de aprovação")}${metricaCliente("calendar-check",pedidos[0]?formatarDataCliente(pedidos[0].dataPedido||pedidos[0].criadoEm):"Nenhuma","Última compra")}</section>
        <div class="clientDetailGrid"><section class="executiveModule"><div class="sectionTitle"><div><span>INTELIGÊNCIA</span><h2>Produtos mais comprados</h2></div></div>${topProdutos.length?topProdutos.map((item,i)=>`<div class="clientRankRow"><b>${i+1}</b><span>${escaparCliente(item.nome)}</span><strong>${item.quantidade} un.</strong></div>`).join(""):`<div class="erpEmpty compact">Ainda não há produtos comprados.</div>`}</section>
        <section class="executiveModule"><div class="sectionTitle"><div><span>ATIVIDADE</span><h2>Timeline do cliente</h2></div></div><div class="clientTimeline">${timeline.length?timeline.slice(0,12).map(renderEventoCliente).join(""):`<div class="erpEmpty compact">Nenhuma movimentação registrada.</div>`}</div></section></div>
        <section class="clientHistoryGrid">${historicoCliente("Últimos pedidos","package",pedidos,p=>`${STATUS_PEDIDOS[p.statusPedido]||p.statusPedido} · ${Utils.moeda(p.valorTotal)}`)}${historicoOrcamentosCliente(orcamentos)}${historicoCliente("Últimos pagamentos","badge-dollar-sign",pagamentos,p=>Utils.moeda(p.valor))}${cliente.tipo==="loja_parceira"?historicoCliente("Últimos consignados","store",consignados,c=>`${(c.itens||[]).length} produtos`)+historicoConferenciasCliente(conferencias,cliente):""}</section>`;
    lucide.createIcons();
}

function obterPedidosCliente(c){return Storage.listarPedidos().filter(p=>p.ativo!==false&&(String(p.clienteId)===String(c.id)||(!p.clienteId&&normalizarCliente(p.clienteNome)===normalizarCliente(c.nome))));}
function obterOrcamentosCliente(c){return Storage.listarOrcamentos().filter(o=>o.ativo!==false&&(String(o.clienteId)===String(c.id)||(!o.clienteId&&normalizarCliente(o.clienteNome||o.cliente)===normalizarCliente(c.nome))));}
function obterPagamentosCliente(c){return Storage.listarPagamentos().filter(p=>String(p.clienteId)===String(c.id));}
function calcularTopProdutosCliente(pedidos){const mapa=new Map();pedidos.filter(p=>p.statusPedido!=="cancelado").forEach(p=>(p.itens||[]).forEach(i=>{const chave=String(i.produtoId||i.nome);const atual=mapa.get(chave)||{nome:i.nome,quantidade:0};atual.quantidade+=Number(i.quantidade||0);mapa.set(chave,atual);}));return [...mapa.values()].sort((a,b)=>b.quantidade-a.quantidade).slice(0,5);}
function criarTimelineCliente(d){const itens=[...d.pedidos.map(p=>({id:p.id,icone:"package",titulo:`Pedido ${STATUS_PEDIDOS[p.statusPedido]||"criado"}`,descricao:Utils.moeda(p.valorTotal),origem:"pedido",data:p.atualizadoEm||p.criadoEm||p.dataPedido})),...d.orcamentos.map(o=>({id:o.id,icone:"file-text",titulo:`Orçamento ${o.status||"enviado"}`,origem:"orçamento",data:o.criadoEm||o.data})),...d.pagamentos.map(p=>({id:p.id,icone:"badge-dollar-sign",titulo:`Pagamento recebido · ${Utils.moeda(p.valor)}`,origem:"financeiro",data:p.criadoEm||p.data})),...d.consignados.map(c=>({id:c.id,icone:"store",titulo:"Consignação registrada",origem:"consignado",data:c.criadoEm||c.data})),...d.conferencias.map(c=>({id:c.id,icone:"chart-no-axes-combined",titulo:"Loja conferida",origem:"conferência",data:c.criadoEm||c.data})),...(d.cliente?.interacoes||[]).map(i=>({id:i.id,icone:i.tipo==="ligacao"?"phone":"messages-square",titulo:i.descricao||`Interação: ${i.tipo}`,descricao:i.resultado,origem:"crm",data:i.data||i.criadoEm})),...(d.cliente?.retornos||[]).map(r=>({id:r.id,icone:"calendar-clock",titulo:`Retorno ${r.status}: ${r.motivo}`,descricao:r.observacao,origem:"crm",data:r.dataHora||r.criadoEm}))];const vistos=new Set();return itens.filter(i=>{const k=`${i.origem}-${i.id}-${i.titulo}`;if(vistos.has(k))return false;vistos.add(k);return true;}).sort((a,b)=>new Date(b.data)-new Date(a.data));}
function renderEventoCliente(e){return `<div class="clientTimelineItem"><span><i data-lucide="${e.icone}"></i></span><div><strong>${escaparCliente(e.titulo)}</strong>${e.descricao?`<p>${escaparCliente(e.descricao)}</p>`:""}<small>${formatarDataCliente(e.data)} · ${escaparCliente(e.origem||"sistema")}</small></div></div>`;}
function historicoCliente(titulo,icone,lista,descricao){return `<article class="clientHistoryCard"><h3><i data-lucide="${icone}"></i>${titulo}</h3>${lista.length?lista.slice(0,5).map(item=>`<div><span>${formatarDataCliente(item.criadoEm||item.data||item.dataPedido)}</span><strong>${escaparCliente(descricao(item))}</strong></div>`).join(""):`<p>Nenhum registro.</p>`}</article>`;}
function historicoOrcamentosCliente(lista){return `<article class="clientHistoryCard"><h3><i data-lucide="file-text"></i>Últimos orçamentos</h3>${lista.length?lista.slice(0,5).map(item=>`<div class="budgetHistoryRow"><span>${formatarDataCliente(item.criadoEm||item.data)}</span><strong>${escaparCliente(item.status||"Enviado")} · ${Utils.moeda(item.valorFinal)}</strong>${item.status!=="aprovado"?`<button onclick="aprovarOrcamentoCliente('${escaparCliente(item.id)}')">Aprovar</button>`:""}</div>`).join(""):`<p>Nenhum registro.</p>`}</article>`;}
function historicoConferenciasCliente(lista,cliente){return `<article class="clientHistoryCard"><h3><i data-lucide="chart-no-axes-combined"></i>Últimas conferências</h3>${lista.length?lista.slice(0,5).map(item=>`<div class="budgetHistoryRow"><span>${formatarDataCliente(item.criadoEm||item.data)}</span><strong>${Number(item.totalPecasVendidas||0)} peças · ${Utils.moeda(item.valorTotalVendido||0)}</strong>${item.pago?`<small>Pago</small>`:`<button onclick="marcarConferenciaPaga('${escaparCliente(item.id)}','${escaparCliente(cliente.id)}')">Marcar paga</button>`}</div>`).join(""):`<p>Nenhum registro.</p>`}</article>`;}
function metricaCliente(icone,valor,rotulo){return `<article><i data-lucide="${icone}"></i><strong>${valor}</strong><span>${rotulo}</span></article>`;}
function confirmarInativarCliente(id){const c=Storage.buscarClientePorId(id);if(!c)return;Modal.abrir("Inativar cliente",`<div class="confirmContent"><p>Deseja inativar <strong>${escaparCliente(c.nome)}</strong>? O histórico será preservado.</p><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn dangerButton" onclick="inativarCliente('${escaparCliente(id)}')">Inativar</button></div></div>`);}
function inativarCliente(id){Storage.excluirCliente(id);Modal.fechar();atualizarListaClientes();Toast.show("Cliente inativado.");}
function novoPedidoCliente(id){navegar("pedidos");setTimeout(()=>abrirModalPedido(null,id),0);}
function novoOrcamentoCliente(id){clienteOrcamentoId=id;navegar("orcamento");}
function aprovarOrcamentoCliente(id){const o=Storage.buscarOrcamentoPorId(id);if(!o)return;o.status="aprovado";o.atualizadoEm=new Date().toISOString();Storage.salvarOrcamento(o);const pedido={id:`ped-${Date.now()}`,clienteId:o.clienteId,clienteNome:o.clienteNome||o.cliente,clienteWhatsapp:Storage.buscarClientePorId(o.clienteId)?.whatsapp||"",dataPedido:Utils.hoje(),dataEntregaPrevista:Utils.hoje(),itens:(o.itens||[]).map(i=>({produtoId:i.produtoId,nome:i.nome,quantidade:Number(i.quantidade||1),valorUnitario:Number(i.valorUnitario||0),valorTotal:Number(i.valorTotal||0),personalizado:i.tipo==="personalizado",observacao:i.observacao||""})),statusPedido:"aprovado",statusPagamento:"pendente",valorTotal:Number(o.valorFinal||0),valorPago:0,valorPendente:Number(o.valorFinal||0),observacoes:`Pedido criado a partir do orçamento ${o.id}.`,ativo:true,criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()};Storage.salvarPedido(pedido);abrirDetalhesCliente(o.clienteId);Toast.show("Orçamento aprovado e transformado em pedido!");}
function marcarConferenciaPaga(id,clienteId){const conferencia=Storage.listarConferencias().find(item=>String(item.id)===String(id));if(!conferencia)return Toast.show("Conferência não encontrada.");Financeiro.sincronizar();const lancamento=Storage.buscarLancamentoFinanceiroPorId(`fin-consignado-${id}`);if(lancamento&&lancamento.valorRestante>0)Financeiro.registrarRecebimento(lancamento.id,lancamento.valorRestante,lancamento.formaPagamento||"Outro","Pagamento registrado pelo cliente.");abrirDetalhesCliente(clienteId);Toast.show("Conferência marcada como paga!");}
function novaConsignacaoCliente(id){const c=Storage.buscarClientePorId(id);navegar("consignado");setTimeout(()=>{const select=document.getElementById("loja");if(select&&c?.lojaId){select.value=c.lojaId;preencherResponsavelLojaConsignado();}},0);}
function avaliarRelacionamentoCliente(cliente,pedidos=obterPedidosCliente(cliente)){if(cliente.statusRelacionamento&&!["novo","ativo"].includes(cliente.statusRelacionamento))return cliente.statusRelacionamento;const cfg=Storage.carregarConfiguracoes().crm||{},diasInativo=Number(cfg.diasClienteInativo||120),diasRisco=Number(cfg.diasClienteRisco||60),valorVip=Number(cfg.valorMinimoVip||2000),pedidosVip=Number(cfg.pedidosMinimoVip||8),total=pedidos.reduce((t,p)=>t+Number(p.valorTotal||0),0);if(total>=valorVip||pedidos.length>=pedidosVip)return "vip";if(!pedidos.length)return "novo";const ultima=[cliente.ultimaInteracao,...pedidos.map(p=>p.atualizadoEm||p.dataPedido)].filter(Boolean).sort().at(-1),dias=ultima?Math.floor((Date.now()-new Date(ultima).getTime())/864e5):999;if(dias>=diasInativo)return "inativo";if(pedidos.length>=2&&dias>=diasRisco)return "em_risco";return pedidos.length>=2?"recorrente":"ativo";}
function abrirWhatsappCliente(id){const c=Storage.buscarClientePorId(id),numero=String(c?.whatsapp||c?.telefone||"").replace(/\D/g,"");if(!numero)return Toast.show("WhatsApp não informado.");window.open(`https://wa.me/55${numero.replace(/^55/,"")}`,"_blank","noopener");}
function abrirMenuCliente(id){const c=Storage.buscarClientePorId(id);if(!c)return;Modal.abrir(`Ações — ${c.nome}`,`<div class="compactActionMenu"><button onclick="Modal.fechar();novoOrcamentoCliente('${id}')"><i data-lucide="file-plus-2"></i><span><strong>Novo orçamento</strong><small>Criar proposta para este cliente</small></span></button><button onclick="Modal.fechar();registrarInteracaoCliente('${id}')"><i data-lucide="messages-square"></i><span><strong>Registrar interação</strong><small>Mensagem, ligação, reunião ou visita</small></span></button><button onclick="Modal.fechar();agendarRetornoCliente('${id}')"><i data-lucide="calendar-plus"></i><span><strong>Agendar retorno</strong><small>Criar uma próxima ação</small></span></button><button onclick="Modal.fechar();abrirModalCliente('${id}')"><i data-lucide="pencil"></i><span><strong>Editar</strong><small>Cadastro e classificação</small></span></button><button class="danger" onclick="Modal.fechar();confirmarInativarCliente('${id}')"><i data-lucide="archive"></i><span><strong>Inativar</strong><small>Preservar todo o histórico</small></span></button></div>`);lucide.createIcons();}
function registrarInteracaoCliente(clienteId){const c=Storage.buscarClientePorId(clienteId);if(!c)return;Modal.abrir(`Registrar interação — ${c.nome}`,`<div class="erpFormGrid crmInteractionForm"><label class="inputGroup"><span>Tipo</span><select id="crmInteracaoTipo">${[["whatsapp","WhatsApp"],["ligacao","Ligação"],["reuniao","Reunião"],["visita","Visita"],["observacao","Observação"],["cobranca","Cobrança"],["outro","Outro"]].map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label><label class="inputGroup"><span>Data</span><input id="crmInteracaoData" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}"></label><label class="inputGroup erpFull"><span>Descrição *</span><textarea id="crmInteracaoDescricao" rows="3"></textarea></label><label class="inputGroup"><span>Resultado</span><input id="crmInteracaoResultado" placeholder="Ex.: orçamento solicitado"></label><label class="inputGroup"><span>Próximo passo</span><input id="crmInteracaoProximo" placeholder="Ex.: enviar modelos"></label><label class="inputGroup"><span>Retorno em</span><input id="crmInteracaoRetorno" type="datetime-local"></label><label class="inputGroup"><span>Responsável</span><input id="crmInteracaoResponsavel" placeholder="Quem realizou o contato"></label></div><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="salvarInteracaoCliente('${clienteId}')">Registrar</button></div>`);}
function salvarInteracaoCliente(id){const c=Storage.buscarClientePorId(id),descricao=document.getElementById("crmInteracaoDescricao")?.value.trim();if(!c||!descricao)return Toast.show("Informe a descrição da interação.");const agora=new Date().toISOString(),data=document.getElementById("crmInteracaoData").value||agora,retornoEm=document.getElementById("crmInteracaoRetorno").value;c.interacoes=[...(c.interacoes||[]),{id:`int-${Date.now()}`,clienteId:id,tipo:document.getElementById("crmInteracaoTipo").value,data,descricao,resultado:document.getElementById("crmInteracaoResultado").value.trim(),proximoPasso:document.getElementById("crmInteracaoProximo").value.trim(),retornoEm,responsavel:document.getElementById("crmInteracaoResponsavel").value.trim(),criadoEm:agora,usuarioId:window.PrimeFirebase?.auth?.currentUser?.uid||null}];c.ultimaInteracao=data;c.atualizadoEm=agora;if(retornoEm)c.retornos=[...(c.retornos||[]),{id:`ret-${Date.now()}`,clienteId:id,dataHora:retornoEm,motivo:document.getElementById("crmInteracaoProximo").value.trim()||"Retornar contato",observacao:descricao,status:"pendente",criadoEm:agora}];Storage.salvarCliente(c);Modal.fechar();abrirDetalhesCliente(id);Toast.show("Interação registrada!");}
function agendarRetornoCliente(clienteId){const c=Storage.buscarClientePorId(clienteId);if(!c)return;const padrao=Number(Storage.carregarConfiguracoes().crm?.lembreteRetornoDias||3),data=new Date(Date.now()+padrao*864e5-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);Modal.abrir(`Agendar retorno — ${c.nome}`,`<div class="erpFormGrid"><label class="inputGroup"><span>Data e hora</span><input id="crmRetornoData" type="datetime-local" value="${data}"></label><label class="inputGroup"><span>Motivo *</span><input id="crmRetornoMotivo" placeholder="Ex.: confirmar orçamento"></label><label class="inputGroup erpFull"><span>Observação</span><textarea id="crmRetornoObs" rows="3"></textarea></label></div><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="salvarRetornoCliente('${clienteId}')">Agendar</button></div>`);}
function salvarRetornoCliente(id){const c=Storage.buscarClientePorId(id),dataHora=document.getElementById("crmRetornoData")?.value,motivo=document.getElementById("crmRetornoMotivo")?.value.trim();if(!c||!dataHora||!motivo)return Toast.show("Informe data e motivo.");const agora=new Date().toISOString();c.retornos=[...(c.retornos||[]),{id:`ret-${Date.now()}`,clienteId:id,dataHora,motivo,observacao:document.getElementById("crmRetornoObs").value.trim(),status:"pendente",criadoEm:agora}];c.proximoContato=dataHora.slice(0,10);c.atualizadoEm=agora;Storage.salvarCliente(c);Modal.fechar();abrirDetalhesCliente(id);Toast.show("Retorno agendado!");}
function concluirRetornoCliente(clienteId,retornoId){const c=Storage.buscarClientePorId(clienteId);if(!c)return;c.retornos=(c.retornos||[]).map(r=>String(r.id)===String(retornoId)?{...r,status:"concluído",concluidoEm:new Date().toISOString()}:r);c.ultimaInteracao=new Date().toISOString();c.atualizadoEm=c.ultimaInteracao;Storage.salvarCliente(c);abrirDetalhesCliente(clienteId);Toast.show("Retorno concluído.");}
const CustomerSummaryCard={render:cliente=>{const pedidos=obterPedidosCliente(cliente);return `<strong>${escaparCliente(cliente.nome)}</strong><span>${pedidos.length} pedido(s)</span>`;}};
const CustomerTimeline={render:(cliente,dados)=>criarTimelineCliente({...dados,cliente}).map(renderEventoCliente).join("")};
const CustomerInteractionModal={abrir:registrarInteracaoCliente};const FollowUpModal={abrir:agendarRetornoCliente};
window.CustomerSummaryCard=CustomerSummaryCard;window.CustomerTimeline=CustomerTimeline;window.CustomerInteractionModal=CustomerInteractionModal;window.FollowUpModal=FollowUpModal;
function ordenarRecentesCliente(a,b){return new Date(b.atualizadoEm||b.criadoEm||b.data||b.dataPedido)-new Date(a.atualizadoEm||a.criadoEm||a.data||a.dataPedido);}
function formatarDataCliente(v){if(!v)return "Sem data";const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("pt-BR");}
function iniciaisCliente(nome){return String(nome||"C").trim().split(/\s+/).slice(0,2).map(p=>p[0]).join("").toUpperCase();}
function normalizarCliente(v){return String(v||"").trim().toLocaleLowerCase("pt-BR");}
function valorCliente(id){return document.getElementById(id)?.value?.trim()||"";}
function escaparCliente(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
