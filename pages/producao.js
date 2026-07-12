function renderProducao() {
    Producao.migrarDados();
    const todas = Storage.listarOrdensProducao().filter(o => o.ativo !== false);
    const pedidoId = window.__primeDocsNavigationOptions?.pedidoId || "";
    const filtro = document.getElementById("filtroStatusProducao")?.value || "";
    const busca = String(document.getElementById("buscaProducao")?.value || "").toLocaleLowerCase("pt-BR");
    const ordens = todas.filter(o => (!pedidoId || String(o.pedidoId) === String(pedidoId)) && (!filtro || o.status === filtro) && [o.clienteNome,o.produtoNome,o.pedidoId].join(" ").toLocaleLowerCase("pt-BR").includes(busca)).sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm));
    app.innerHTML = `<button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>${Page.titulo("🏭 Produção", "Ordens e operações geradas a partir dos pedidos.")}
        <section class="erpSummaryGrid">${cardResumoERP("list-todo",todas.filter(o=>o.status==="aguardando").length,"Aguardando")}${cardResumoERP("printer",todas.filter(o=>o.status==="em_producao").length,"Em produção")}${cardResumoERP("pause",todas.filter(o=>o.status==="pausada").length,"Pausadas")}${cardResumoERP("circle-check",todas.filter(o=>o.status==="concluida").length,"Concluídas")}</section>
        <section class="erpToolbar"><label class="erpSearch"><i data-lucide="search"></i><input id="buscaProducao" value="${escaparProducao(busca)}" placeholder="Cliente, produto ou pedido" oninput="renderProducao()"></label><select id="filtroStatusProducao" onchange="renderProducao()"><option value="">Todos os status</option>${Object.entries(Producao.STATUS).map(([v,l])=>`<option value="${v}" ${v===filtro?"selected":""}>${l}</option>`).join("")}</select>${pedidoId ? `<button class="btnSecondary" onclick="window.__primeDocsNavigationOptions={};renderProducao()"><i data-lucide="x"></i> Limpar pedido</button>` : ""}</section>
        <div class="erpCardGrid productionGrid">${ordens.length ? ordens.map(cardOrdemProducao).join("") : `<div class="erpEmpty"><i data-lucide="factory"></i><strong>Nenhuma ordem de produção</strong><p>Abra um pedido e use “Iniciar produção” para gerar as operações.</p><button class="btn" onclick="navegar('pedidos')">Ver pedidos</button></div>`}</div>`;
    lucide.createIcons();
}

function cardOrdemProducao(ordem) {
    const concluidas = (ordem.operacoes || []).filter(op => op.status === "concluida").length;
    const total = (ordem.operacoes || []).length;
    const progresso = total ? Math.round((concluidas / total) * 100) : Number(ordem.progresso || 0);
    return `<article class="erpEntityCard productionCard"><div class="erpEntityTop"><div class="orderNumber">#${String(ordem.pedidoId).slice(-5)}</div><div><h3>${escaparProducao(ordem.produtoNome)}</h3><p>${escaparProducao(ordem.clienteNome)} · ${ordem.quantidade} peça(s)</p></div><span class="erpBadge status-${ordem.status}">${Producao.STATUS[ordem.status] || ordem.status}</span></div><div class="productionProgress"><div><span>Progresso</span><strong>${progresso}%</strong></div><i><b style="width:${progresso}%"></b></i></div><div class="productionOpsPreview">${(ordem.operacoes || []).slice(0,4).map(op=>`<span><i data-lucide="${op.tipo === "impressao" ? "printer" : "circle-dot"}"></i>${escaparProducao(op.nome)} <small>${op.quantidade}×</small></span>`).join("")}${total>4?`<small>+${total-4} operações</small>`:""}</div><div class="erpCardActions"><button onclick="abrirDetalhesOrdemProducao('${ordem.id}')"><i data-lucide="eye"></i> Ver operações</button><button onclick="navegar('pedidos')"><i data-lucide="clipboard-list"></i> Ver pedido</button></div></article>`;
}

function abrirDetalhesOrdemProducao(id) {
    const ordem = Storage.buscarOrdemProducaoPorId(id); if (!ordem) return Toast.show("Ordem não encontrada.");
    const porId = new Map((ordem.operacoes || []).map(op => [String(op.id),op]));
    Modal.abrir(`Ordem — ${ordem.produtoNome}`, `<div class="productionOrderMeta"><div><span>Pedido</span><strong>#${String(ordem.pedidoId).slice(-5)}</strong></div><div><span>Cliente</span><strong>${escaparProducao(ordem.clienteNome)}</strong></div><div><span>Prazo</span><strong>${ordem.prazo ? formatarDataBR(ordem.prazo) : "-"}</strong></div><div><span>Quantidade</span><strong>${ordem.quantidade}</strong></div></div><div class="operationList">${(ordem.operacoes || []).map((op,indice)=>`<article><div class="operationIndex">${indice+1}</div><div><header><strong>${escaparProducao(op.nome)}</strong><span class="erpBadge status-${op.status}">${Producao.STATUS_OPERACAO[op.status] || op.status}</span></header><p>${Producao.TIPOS[op.tipo] || op.tipo} · ${op.quantidade} unidade(s) · ${Math.round(Number(op.tempoPrevistoMinutos)||0)} min · ${Number(op.pesoPrevistoGramas||0).toFixed(1)} g</p>${op.dependencias?.length ? `<small>Depende de: ${op.dependencias.map(dep=>escaparProducao(porId.get(String(dep))?.nome || dep)).join(", ")}</small>` : `<small>Pode iniciar sem dependências</small>`}</div></article>`).join("")}</div>`); lucide.createIcons();
}
function escaparProducao(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
