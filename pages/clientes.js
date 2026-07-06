let clienteEditandoId = null;
let clienteDetalheId = null;

const TIPOS_CLIENTE = {
    particular: "Cliente Particular",
    loja_parceira: "Loja Parceira",
    empresa: "Empresa"
};

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
        return `<article class="erpEntityCard clientCard" onclick="abrirDetalhesCliente('${escaparCliente(cliente.id)}')" tabindex="0" role="button">
            <div class="clientCardTop"><span class="clientAvatar">${iniciaisCliente(cliente.nome)}</span><div><h3>${escaparCliente(cliente.nome)}</h3><span class="erpBadge">${TIPOS_CLIENTE[cliente.tipo]||"Cliente Particular"}</span></div><i data-lucide="chevron-right"></i></div>
            <div class="clientContactList">${cliente.whatsapp?`<span><i data-lucide="message-circle"></i>${escaparCliente(cliente.whatsapp)}</span>`:""}${cliente.email?`<span><i data-lucide="mail"></i>${escaparCliente(cliente.email)}</span>`:""}${cliente.cidade?`<span><i data-lucide="map-pin"></i>${escaparCliente(cliente.cidade)}</span>`:""}</div>
            <div class="clientCardMetrics"><div><strong>${pedidos.length}</strong><span>pedidos</span></div><div><strong>${Utils.moeda(aberto)}</strong><span>em aberto</span></div></div>
            <div class="erpCardActions" onclick="event.stopPropagation()"><button onclick="abrirModalCliente('${escaparCliente(cliente.id)}')"><i data-lucide="pencil"></i> Editar</button><button class="danger" onclick="confirmarInativarCliente('${escaparCliente(cliente.id)}')"><i data-lucide="archive"></i> Inativar</button></div>
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
        tipo: document.getElementById("clienteTipo")?.value || "particular", ativo: true,
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
    const timeline = criarTimelineCliente({pedidos,orcamentos,pagamentos,consignados,conferencias});
    app.innerHTML = `<button class="back" onclick="renderClientes()"><i data-lucide="arrow-left"></i> Clientes</button>
        <section class="clientDetailHero"><div class="clientAvatar large">${iniciaisCliente(cliente.nome)}</div><div><span>${TIPOS_CLIENTE[cliente.tipo]||"Cliente"}</span><h1>${escaparCliente(cliente.nome)}</h1><p>${[cliente.whatsapp,cliente.email,cliente.cidade].filter(Boolean).map(escaparCliente).join(" · ")||"Sem contatos adicionais"}</p></div><button class="btnSecondary" onclick="abrirModalCliente('${escaparCliente(cliente.id)}')"><i data-lucide="pencil"></i> Editar</button></section>
        <section class="clientQuickActions"><button onclick="novoPedidoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="package-plus"></i><span>Novo Pedido</span></button><button onclick="novoOrcamentoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="file-plus-2"></i><span>Novo Orçamento</span></button>${cliente.tipo==="loja_parceira"?`<button onclick="novaConsignacaoCliente('${escaparCliente(cliente.id)}')"><i data-lucide="store"></i><span>Nova Consignação</span></button>`:""}</section>
        <section class="clientMetricsGrid">${metricaCliente("circle-dollar-sign",Utils.moeda(totalComprado),"Total comprado")}${metricaCliente("badge-check",Utils.moeda(totalPago),"Total pago")}${metricaCliente("wallet-cards",Utils.moeda(emAberto),"Total pendente")}${metricaCliente("shopping-bag",pedidos.length,"Pedidos")}${metricaCliente("file-check-2",orcamentos.length,"Orçamentos")}${metricaCliente("calendar-check",ultimoPagamento?formatarDataCliente(ultimoPagamento):"Nenhum","Último pagamento")}</section>
        <div class="clientDetailGrid"><section class="executiveModule"><div class="sectionTitle"><div><span>INTELIGÊNCIA</span><h2>Produtos mais comprados</h2></div></div>${topProdutos.length?topProdutos.map((item,i)=>`<div class="clientRankRow"><b>${i+1}</b><span>${escaparCliente(item.nome)}</span><strong>${item.quantidade} un.</strong></div>`).join(""):`<div class="erpEmpty compact">Ainda não há produtos comprados.</div>`}</section>
        <section class="executiveModule"><div class="sectionTitle"><div><span>ATIVIDADE</span><h2>Timeline do cliente</h2></div></div><div class="clientTimeline">${timeline.length?timeline.slice(0,12).map(renderEventoCliente).join(""):`<div class="erpEmpty compact">Nenhuma movimentação registrada.</div>`}</div></section></div>
        <section class="clientHistoryGrid">${historicoCliente("Últimos pedidos","package",pedidos,p=>`${STATUS_PEDIDOS[p.statusPedido]||p.statusPedido} · ${Utils.moeda(p.valorTotal)}`)}${historicoOrcamentosCliente(orcamentos)}${historicoCliente("Últimos pagamentos","badge-dollar-sign",pagamentos,p=>Utils.moeda(p.valor))}${cliente.tipo==="loja_parceira"?historicoCliente("Últimos consignados","store",consignados,c=>`${(c.itens||[]).length} produtos`)+historicoConferenciasCliente(conferencias,cliente):""}</section>`;
    lucide.createIcons();
}

function obterPedidosCliente(c){return Storage.listarPedidos().filter(p=>p.ativo!==false&&(String(p.clienteId)===String(c.id)||(!p.clienteId&&normalizarCliente(p.clienteNome)===normalizarCliente(c.nome))));}
function obterOrcamentosCliente(c){return Storage.listarOrcamentos().filter(o=>o.ativo!==false&&(String(o.clienteId)===String(c.id)||(!o.clienteId&&normalizarCliente(o.clienteNome||o.cliente)===normalizarCliente(c.nome))));}
function obterPagamentosCliente(c){return Storage.listarPagamentos().filter(p=>String(p.clienteId)===String(c.id));}
function calcularTopProdutosCliente(pedidos){const mapa=new Map();pedidos.filter(p=>p.statusPedido!=="cancelado").forEach(p=>(p.itens||[]).forEach(i=>{const chave=String(i.produtoId||i.nome);const atual=mapa.get(chave)||{nome:i.nome,quantidade:0};atual.quantidade+=Number(i.quantidade||0);mapa.set(chave,atual);}));return [...mapa.values()].sort((a,b)=>b.quantidade-a.quantidade).slice(0,5);}
function criarTimelineCliente(d){return [...d.pedidos.map(p=>({icone:"package",titulo:`Pedido ${STATUS_PEDIDOS[p.statusPedido]||"criado"}`,data:p.atualizadoEm||p.criadoEm||p.dataPedido})),...d.orcamentos.map(o=>({icone:"file-text",titulo:`Orçamento ${o.status||"enviado"}`,data:o.criadoEm||o.data})),...d.pagamentos.map(p=>({icone:"badge-dollar-sign",titulo:`Pagamento recebido · ${Utils.moeda(p.valor)}`,data:p.criadoEm||p.data})),...d.consignados.map(c=>({icone:"store",titulo:"Consignação registrada",data:c.criadoEm||c.data})),...d.conferencias.map(c=>({icone:"chart-no-axes-combined",titulo:"Loja conferida",data:c.criadoEm||c.data}))].sort((a,b)=>new Date(b.data)-new Date(a.data));}
function renderEventoCliente(e){return `<div class="clientTimelineItem"><span><i data-lucide="${e.icone}"></i></span><div><strong>${escaparCliente(e.titulo)}</strong><small>${formatarDataCliente(e.data)}</small></div></div>`;}
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
function ordenarRecentesCliente(a,b){return new Date(b.atualizadoEm||b.criadoEm||b.data||b.dataPedido)-new Date(a.atualizadoEm||a.criadoEm||a.data||a.dataPedido);}
function formatarDataCliente(v){if(!v)return "Sem data";const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("pt-BR");}
function iniciaisCliente(nome){return String(nome||"C").trim().split(/\s+/).slice(0,2).map(p=>p[0]).join("").toUpperCase();}
function normalizarCliente(v){return String(v||"").trim().toLocaleLowerCase("pt-BR");}
function valorCliente(id){return document.getElementById(id)?.value?.trim()||"";}
function escaparCliente(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
