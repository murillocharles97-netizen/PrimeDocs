let periodoDashboardExecutivo = localStorage.getItem("primedocs_dashboard_periodo") || "mes";
let dashboardInicioPersonalizado = localStorage.getItem("primedocs_dashboard_inicio") || "";
let dashboardFimPersonalizado = localStorage.getItem("primedocs_dashboard_fim") || "";

function renderDashboardExecutivo() {
    const intervalo = obterIntervaloDashboardExecutivo();
    const dados = carregarDadosDashboardExecutivo();
    const anterior = obterIntervaloAnteriorDashboard(intervalo);
    const atual = calcularIndicadores(dados, intervalo);
    const previo = calcularIndicadores(dados, anterior);
    const financeiro = calcularFinanceiro(dados, intervalo);
    const pedidos = calcularPedidos(dados, intervalo);
    const consignado = calcularConsignado(dados, intervalo);
    const filamentos = calcularFilamentos(dados);
    const rankings = calcularRankings(dados, intervalo);
    const graficos = calcularGraficos(dados, intervalo);
    const metas = carregarMetasDashboardExecutivo();

    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        <section class="managementHero">
            <div>
                <span>DASHBOARD EXECUTIVO</span>
                <h2>Visão gerencial da empresa</h2>
                <p>${formatarPeriodoDashboard(intervalo)} · Dados calculados automaticamente pelo PrimeDocs.</p>
            </div>
            <div class="managementHeroActions">
                <button onclick="exportarDashboardPDF()"><i data-lucide="file-down"></i> PDF</button>
                <button onclick="exportarDashboardCSV()"><i data-lucide="sheet"></i> CSV</button>
                <button onclick="imprimirDashboardExecutivo()"><i data-lucide="printer"></i> Imprimir</button>
            </div>
        </section>

        <section class="managementPeriodCard">
            <div class="managementPeriodTabs">
                ${[
                    ["hoje", "Hoje"],
                    ["semana", "Semana"],
                    ["mes", "Mês"],
                    ["ano", "Ano"],
                    ["personalizado", "Período"]
                ].map(([valor, label]) => `<button class="${periodoDashboardExecutivo === valor ? "active" : ""}" onclick="selecionarPeriodoDashboardExecutivo('${valor}')">${label}</button>`).join("")}
            </div>
            <div class="managementCustomPeriod" ${periodoDashboardExecutivo === "personalizado" ? "" : "hidden"}>
                <label>De<input id="dashboardDataInicio" type="date" value="${escaparDashboardExecutivo(dashboardInicioPersonalizado)}" onchange="atualizarPeriodoPersonalizadoDashboard()"></label>
                <label>Até<input id="dashboardDataFim" type="date" value="${escaparDashboardExecutivo(dashboardFimPersonalizado)}" onchange="atualizarPeriodoPersonalizadoDashboard()"></label>
            </div>
        </section>

        <section class="managementKpiGrid">
            ${renderKpiDashboard("circle-dollar-sign", Utils.moeda(atual.faturamento), "Faturamento", atual.faturamento, previo.faturamento)}
            ${renderKpiDashboard("trending-up", Utils.moeda(atual.lucroEstimado), "Lucro estimado", atual.lucroEstimado, previo.lucroEstimado)}
            ${renderKpiDashboard("clipboard-list", atual.pedidos, "Pedidos", atual.pedidos, previo.pedidos)}
            ${renderKpiDashboard("badge-check", atual.pedidosEntregues, "Pedidos entregues", atual.pedidosEntregues, previo.pedidosEntregues)}
            ${renderKpiDashboard("printer", atual.pedidosProducao, "Pedidos produção", atual.pedidosProducao, previo.pedidosProducao)}
            ${renderKpiDashboard("clock-3", atual.pedidosPendentes, "Pedidos pendentes", atual.pedidosPendentes, previo.pedidosPendentes, true)}
            ${renderKpiDashboard("wallet-cards", Utils.moeda(atual.contasReceber), "Contas a receber", atual.contasReceber, previo.contasReceber, true)}
            ${renderKpiDashboard("badge-dollar-sign", Utils.moeda(atual.contasRecebidas), "Contas recebidas", atual.contasRecebidas, previo.contasRecebidas)}
            ${renderKpiDashboard("store", Utils.moeda(atual.valorConsignado), "Valor em consignado", atual.valorConsignado, previo.valorConsignado)}
            ${renderKpiDashboard("boxes", atual.estoqueConsignado, "Estoque em consignado", atual.estoqueConsignado, previo.estoqueConsignado)}
            ${renderKpiDashboard("spool", `${filamentos.pesoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`, "Filamentos em estoque", filamentos.pesoTotal, filamentos.pesoTotal)}
            ${renderKpiDashboard("users", atual.clientesAtivos, "Clientes ativos", atual.clientesAtivos, previo.clientesAtivos)}
        </section>

        <section class="managementChartsGrid">
            ${renderLineChartDashboard("Faturamento dos últimos 12 meses", "Receita mensal", graficos.faturamento12Meses, true)}
            ${renderPieChartDashboard("Pedidos por Status", "Distribuição do período", graficos.pedidosPorStatus)}
            ${renderBarChartDashboard("Recebimentos", "Clientes x Consignado", graficos.recebimentos, true)}
            ${renderHorizontalChartDashboard("Categorias Vendidas", "Quantidade por categoria", graficos.categoriasVendidas)}
            ${renderHorizontalChartDashboard("Produtos Mais Vendidos", "Top 10 produtos", graficos.produtosMaisVendidos)}
            ${renderLineChartDashboard("Lucro Mensal", "Resultado estimado", graficos.lucroMensal, true)}
        </section>

        <section class="managementRankingsGrid">
            ${renderRankingDashboard("Top Clientes", rankings.clientes, item => `${Utils.moeda(item.valor)} · ${item.quantidade} pedidos`)}
            ${renderRankingDashboard("Top Produtos", rankings.produtos, item => `${item.quantidade} un. · ${Utils.moeda(item.valor)}`)}
            ${renderRankingDashboard("Top Lojas", rankings.lojas, item => `${Utils.moeda(item.valor)} · ${item.quantidade} peças`)}
            ${renderRankingDashboard("Top Categorias", rankings.categorias, item => `${item.quantidade} un.`)}
        </section>

        <section class="managementGoalsPanel">
            <div class="managementSectionHeader">
                <div><span>METAS</span><h3>Performance planejada</h3></div>
                <button onclick="abrirMetasDashboardExecutivo()"><i data-lucide="settings-2"></i> Alterar metas</button>
            </div>
            <div class="managementGoalsGrid">
                ${renderMetaDashboard("Meta mensal", atual.faturamento, metas.metaMensal, true)}
                ${renderMetaDashboard("Meta anual", calcularFaturamentoAnoDashboard(dados), metas.metaAnual, true)}
                ${renderMetaDashboard("Meta pedidos", atual.pedidos, metas.metaPedidos)}
                ${renderMetaDashboard("Meta faturamento", atual.faturamento, metas.metaFaturamento, true)}
            </div>
        </section>

        <section class="managementInfoGrid">
            ${renderIndicadoresDashboard(atual)}
            ${renderResumoConsignadoDashboard(consignado)}
            ${renderResumoPedidosDashboard(pedidos)}
            ${renderResumoFilamentosDashboard(filamentos)}
            ${renderResumoFinanceiroDashboard(financeiro)}
        </section>
    `;

    window.__dashboardExecutivoAtual = { atual, financeiro, pedidos, consignado, filamentos, rankings, graficos, intervalo };
    lucide.createIcons();
}

function carregarDadosDashboardExecutivo() {
    const lojasAtivas = Storage.listarLojas().filter(l => l.ativo !== false);
    const lojasMap = new Map(lojasAtivas.map(l => [String(l.id), l]));
    const estoques = Storage.listarEstoquesLojas().filter(e => lojasMap.has(String(e.lojaId)));
    return {
        produtos: Storage.listarProdutos().filter(p => p.ativo !== false),
        clientes: Storage.listarClientes ? Storage.listarClientes().filter(c => c.ativo !== false) : [],
        pedidos: Storage.listarPedidos().filter(p => p.ativo !== false),
        lojas: lojasAtivas,
        estoques,
        consignados: Storage.listarConsignados().filter(c => lojasMap.has(String(c.lojaId)) || lojasAtivas.some(l => normalizarTextoDashboard(l.nome) === normalizarTextoDashboard(c.lojaNome))),
        conferencias: Storage.listarConferencias().filter(c => lojasMap.has(String(c.lojaId)) || lojasAtivas.some(l => normalizarTextoDashboard(l.nome) === normalizarTextoDashboard(c.lojaNome))),
        filamentos: Storage.listarFilamentos ? Storage.listarFilamentos().filter(f => f.ativo !== false) : [],
        pagamentos: Storage.listarPagamentos ? Storage.listarPagamentos() : [],
        financeiro: Financeiro.sincronizar()
    };
}

function calcularIndicadores(dados, intervalo) {
    const pedidosPeriodo = dados.pedidos.filter(p => noPeriodoDashboard(p.criadoEm || p.dataPedido, intervalo));
    const pedidosEntregues = pedidosPeriodo.filter(p => p.statusPedido === "entregue");
    const conferenciasPeriodo = dados.conferencias.filter(c => noPeriodoDashboard(c.criadoEm || c.data, intervalo));
    const itensVendidos = obterItensVendidosDashboard(dados, intervalo);
    const faturamentoPedidos = pedidosEntregues.reduce((t, p) => t + Number(p.valorTotal || 0), 0);
    const faturamentoConsignado = conferenciasPeriodo.reduce((t, c) => t + Number(c.valorTotalVendido || 0), 0);
    const custo = itensVendidos.reduce((t, item) => t + Number(item.quantidade || 0) * Number(item.custo || 0), 0);
    const contasReceber = dados.financeiro.filter(f => !["pago", "cancelado"].includes(f.status) && noPeriodoDashboard(f.vencimento, intervalo)).reduce((t, f) => t + Number(f.valorRestante || 0), 0);
    const contasRecebidas = dados.pagamentos.filter(p => noPeriodoDashboard(p.criadoEm || p.data, intervalo)).reduce((t, p) => t + Number(p.valor || 0), 0);
    const valorConsignado = dados.estoques.reduce((t, e) => t + (e.itens || []).reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.preco || 0), 0), 0);
    const estoqueConsignado = dados.estoques.reduce((t, e) => t + (e.itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0), 0);
    const clientesCompraram = new Set(pedidosPeriodo.map(p => p.clienteId || p.clienteNome).filter(Boolean));

    return {
        faturamento: faturamentoPedidos + faturamentoConsignado,
        lucroEstimado: faturamentoPedidos + faturamentoConsignado - custo,
        pedidos: pedidosPeriodo.length,
        pedidosEntregues: pedidosEntregues.length,
        pedidosProducao: pedidosPeriodo.filter(p => p.statusPedido === "em_producao").length,
        pedidosPendentes: pedidosPeriodo.filter(p => !["entregue", "cancelado"].includes(p.statusPedido)).length,
        contasReceber,
        contasRecebidas,
        valorConsignado,
        estoqueConsignado,
        clientesAtivos: dados.clientes.length,
        ticketMedio: pedidosEntregues.length ? faturamentoPedidos / pedidosEntregues.length : 0,
        lucroMedio: itensVendidos.length ? (faturamentoPedidos + faturamentoConsignado - custo) / Math.max(1, pedidosEntregues.length + conferenciasPeriodo.length) : 0,
        pedidosPorCliente: clientesCompraram.size ? pedidosPeriodo.length / clientesCompraram.size : 0,
        vendaMediaLoja: conferenciasPeriodo.length ? faturamentoConsignado / new Set(conferenciasPeriodo.map(c => c.lojaId || c.lojaNome)).size : 0,
        recebimentoMedio: dados.pagamentos.filter(p => noPeriodoDashboard(p.criadoEm || p.data, intervalo)).length ? contasRecebidas / dados.pagamentos.filter(p => noPeriodoDashboard(p.criadoEm || p.data, intervalo)).length : 0,
        produtosPorPedido: pedidosPeriodo.length ? pedidosPeriodo.reduce((t, p) => t + (p.itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0), 0) / pedidosPeriodo.length : 0,
        tempoMedioProducao: calcularTempoMedioProducaoDashboard(pedidosEntregues)
    };
}

function calcularFinanceiro(dados, intervalo) {
    const hoje = Utils.hoje();
    const fimSemana = somarDiasDashboard(hoje, 6);
    const mes = hoje.slice(0, 7);
    const abertos = dados.financeiro.filter(f => !["pago", "cancelado"].includes(f.status));
    return {
        receberHoje: abertos.filter(f => f.vencimento === hoje).reduce((t, f) => t + Number(f.valorRestante || 0), 0),
        receberSemana: abertos.filter(f => f.vencimento >= hoje && f.vencimento <= fimSemana).reduce((t, f) => t + Number(f.valorRestante || 0), 0),
        receberMes: abertos.filter(f => String(f.vencimento || "").startsWith(mes)).reduce((t, f) => t + Number(f.valorRestante || 0), 0),
        recebidoMes: dados.pagamentos.filter(p => String(p.criadoEm || p.data || "").startsWith(mes)).reduce((t, p) => t + Number(p.valor || 0), 0),
        atrasados: abertos.filter(f => f.status === "atrasado").reduce((t, f) => t + Number(f.valorRestante || 0), 0),
        fluxoPrevisto: abertos.filter(f => noPeriodoDashboard(f.vencimento, intervalo)).reduce((t, f) => t + Number(f.valorRestante || 0), 0)
    };
}

function calcularPedidos(dados, intervalo) {
    const lista = dados.pedidos.filter(p => noPeriodoDashboard(p.criadoEm || p.dataPedido, intervalo));
    return {
        criados: lista.length,
        producao: lista.filter(p => p.statusPedido === "em_producao").length,
        prontos: lista.filter(p => p.statusPedido === "pronto").length,
        entregues: lista.filter(p => p.statusPedido === "entregue").length,
        cancelados: lista.filter(p => p.statusPedido === "cancelado").length,
        tempoMedio: calcularTempoMedioProducaoDashboard(lista.filter(p => p.statusPedido === "entregue"))
    };
}

function calcularConsignado(dados, intervalo) {
    const conferencias = dados.conferencias.filter(c => noPeriodoDashboard(c.criadoEm || c.data, intervalo));
    const porLoja = agruparDashboard(conferencias, c => c.lojaId || c.lojaNome, c => c.lojaNome || "Loja", c => Number(c.valorTotalVendido || 0), c => Number(c.totalPecasVendidas || 0));
    const valorEmLojas = dados.estoques.reduce((t, e) => t + (e.itens || []).reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.preco || 0), 0), 0);
    const pecasEmLojas = dados.estoques.reduce((t, e) => t + (e.itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0), 0);
    const valorVendido = conferencias.reduce((t, c) => t + Number(c.valorTotalVendido || 0), 0);
    const pagos = conferencias.reduce((t, c) => t + Number(c.valorPago || (c.pago ? c.valorTotalVendido : 0) || 0), 0);
    return {
        valorEmLojas,
        pecasEmLojas,
        valorVendido,
        valorPendente: Math.max(0, valorVendido - pagos),
        conferencias: conferencias.length,
        melhorLoja: porLoja[0]?.nome || "Sem dados",
        menorGiro: porLoja.length ? porLoja[porLoja.length - 1].nome : "Sem dados"
    };
}

function calcularFilamentos(dados) {
    const pesoTotal = dados.filamentos.reduce((t, f) => t + Number(f.pesoAtualKg || 0), 0);
    const valorEstoque = dados.filamentos.reduce((t, f) => t + Number(f.pesoAtualKg || 0) * Number(f.precoKg || 0), 0);
    return {
        pesoTotal,
        valorEstoque,
        materiais: new Set(dados.filamentos.map(f => f.material).filter(Boolean)).size,
        criticos: dados.filamentos.filter(f => Number(f.pesoAtualKg || 0) <= Number(f.alertaMinimoKg || 0)).length,
        consumoEstimado: "Em preparação"
    };
}

function calcularRankings(dados, intervalo) {
    const pedidosEntregues = dados.pedidos.filter(p => p.statusPedido === "entregue" && noPeriodoDashboard(p.criadoEm || p.dataPedido, intervalo));
    const itens = obterItensVendidosDashboard(dados, intervalo);
    const conferencias = dados.conferencias.filter(c => noPeriodoDashboard(c.criadoEm || c.data, intervalo));
    return {
        clientes: agruparDashboard(pedidosEntregues, p => p.clienteId || p.clienteNome, p => p.clienteNome || "Cliente", p => Number(p.valorTotal || 0), () => 1),
        produtos: agruparDashboard(itens, i => i.produtoId || i.nome, i => i.nome || "Produto", i => Number(i.valorTotal || 0), i => Number(i.quantidade || 0)),
        lojas: agruparDashboard(conferencias, c => c.lojaId || c.lojaNome, c => c.lojaNome || "Loja", c => Number(c.valorTotalVendido || 0), c => Number(c.totalPecasVendidas || 0)),
        categorias: agruparDashboard(itens, i => i.categoria || "Sem categoria", i => i.categoria || "Sem categoria", () => 0, i => Number(i.quantidade || 0))
    };
}

function calcularGraficos(dados, intervalo) {
    const meses = ultimosMesesDashboard(12);
    const itens = obterItensVendidosDashboard(dados, intervalo);
    const pedidosPeriodo = dados.pedidos.filter(p => noPeriodoDashboard(p.criadoEm || p.dataPedido, intervalo));
    return {
        faturamento12Meses: meses.map(m => ({ nome: m.label, valor: faturamentoMesDashboard(dados, m.key) })),
        lucroMensal: meses.map(m => ({ nome: m.label, valor: lucroMesDashboard(dados, m.key) })),
        pedidosPorStatus: Object.entries(STATUS_PEDIDOS).map(([status, nome]) => ({ nome, valor: pedidosPeriodo.filter(p => p.statusPedido === status).length })).filter(i => i.valor),
        recebimentos: [
            { nome: "Clientes", valor: pedidosPeriodo.filter(p => p.statusPedido === "entregue").reduce((t, p) => t + Number(p.valorTotal || 0), 0) },
            { nome: "Consignado", valor: dados.conferencias.filter(c => noPeriodoDashboard(c.criadoEm || c.data, intervalo)).reduce((t, c) => t + Number(c.valorTotalVendido || 0), 0) }
        ],
        categoriasVendidas: agruparDashboard(itens, i => i.categoria || "Sem categoria", i => i.categoria || "Sem categoria", () => 0, i => Number(i.quantidade || 0)).slice(0, 10).map(i => ({ nome: i.nome, valor: i.quantidade })),
        produtosMaisVendidos: agruparDashboard(itens, i => i.produtoId || i.nome, i => i.nome || "Produto", () => 0, i => Number(i.quantidade || 0)).slice(0, 10).map(i => ({ nome: i.nome, valor: i.quantidade }))
    };
}

function selecionarPeriodoDashboardExecutivo(periodo) {
    periodoDashboardExecutivo = periodo;
    localStorage.setItem("primedocs_dashboard_periodo", periodo);
    renderDashboardExecutivo();
}

function atualizarPeriodoPersonalizadoDashboard() {
    dashboardInicioPersonalizado = document.getElementById("dashboardDataInicio")?.value || dashboardInicioPersonalizado;
    dashboardFimPersonalizado = document.getElementById("dashboardDataFim")?.value || dashboardFimPersonalizado;
    localStorage.setItem("primedocs_dashboard_inicio", dashboardInicioPersonalizado);
    localStorage.setItem("primedocs_dashboard_fim", dashboardFimPersonalizado);
    renderDashboardExecutivo();
}

function renderKpiDashboard(icone, valor, titulo, atual, anterior, invertido = false) {
    const comp = calcularComparacaoDashboard(atual, anterior);
    const positivo = invertido ? comp.percentual <= 0 : comp.percentual >= 0;
    return `<article class="managementKpi ${positivo ? "positive" : "negative"}"><div><i data-lucide="${icone}"></i></div><strong>${escaparDashboardExecutivo(valor)}</strong><span>${escaparDashboardExecutivo(titulo)}</span><small>${comp.label}</small></article>`;
}

function renderLineChartDashboard(titulo, subtitulo, itens, moeda = false) {
    const max = Math.max(1, ...itens.map(i => Number(i.valor || 0)));
    const pontos = itens.map((item, i) => `${(i / Math.max(1, itens.length - 1)) * 100},${100 - (Number(item.valor || 0) / max) * 86}`).join(" ");
    return `<article class="managementChart line"><div class="managementSectionHeader"><div><span>${escaparDashboardExecutivo(subtitulo)}</span><h3>${escaparDashboardExecutivo(titulo)}</h3></div><i data-lucide="activity"></i></div><svg viewBox="0 0 100 105" preserveAspectRatio="none"><defs><linearGradient id="dashLineGradient" x1="0" x2="1"><stop offset="0%" stop-color="#6D5DFD"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient></defs><polyline points="${pontos}" fill="none" stroke="url(#dashLineGradient)" stroke-width="3" vector-effect="non-scaling-stroke"></polyline></svg><div class="managementChartLabels">${itens.map(i => `<span>${escaparDashboardExecutivo(i.nome)}</span>`).join("")}</div><small>${moeda ? Utils.moeda(Math.max(...itens.map(i => i.valor), 0)) : ""}</small></article>`;
}

function renderPieChartDashboard(titulo, subtitulo, itens) {
    const total = itens.reduce((t, i) => t + Number(i.valor || 0), 0);
    let cursor = 0;
    const cores = ["#6D5DFD", "#8B5CF6", "#22D3EE", "#10B981", "#F59E0B", "#EF4444", "#64748B"];
    const gradiente = itens.length ? itens.map((i, n) => {
        const inicio = cursor;
        cursor += (Number(i.valor || 0) / Math.max(total, 1)) * 100;
        return `${cores[n % cores.length]} ${inicio}% ${cursor}%`;
    }).join(",") : "#E5E7EB 0 100%";
    return `<article class="managementChart pie"><div class="managementSectionHeader"><div><span>${escaparDashboardExecutivo(subtitulo)}</span><h3>${escaparDashboardExecutivo(titulo)}</h3></div><i data-lucide="chart-pie"></i></div><div class="managementPie" style="background:conic-gradient(${gradiente})"><span>${total}</span></div><div class="managementLegend">${itens.map((i, n) => `<p><i style="background:${cores[n % cores.length]}"></i><span>${escaparDashboardExecutivo(i.nome)}</span><strong>${i.valor}</strong></p>`).join("") || "<p>Sem dados</p>"}</div></article>`;
}

function renderBarChartDashboard(titulo, subtitulo, itens, moeda = false) {
    const max = Math.max(1, ...itens.map(i => Number(i.valor || 0)));
    return `<article class="managementChart"><div class="managementSectionHeader"><div><span>${escaparDashboardExecutivo(subtitulo)}</span><h3>${escaparDashboardExecutivo(titulo)}</h3></div><i data-lucide="bar-chart-3"></i></div><div class="managementBars vertical">${itens.map(i => `<div><span style="height:${Math.max(4, Number(i.valor || 0) / max * 100)}%"></span><strong>${moeda ? Utils.moeda(i.valor) : i.valor}</strong><small>${escaparDashboardExecutivo(i.nome)}</small></div>`).join("")}</div></article>`;
}

function renderHorizontalChartDashboard(titulo, subtitulo, itens) {
    const max = Math.max(1, ...itens.map(i => Number(i.valor || 0)));
    return `<article class="managementChart"><div class="managementSectionHeader"><div><span>${escaparDashboardExecutivo(subtitulo)}</span><h3>${escaparDashboardExecutivo(titulo)}</h3></div><i data-lucide="list-ordered"></i></div><div class="managementBars horizontal">${itens.length ? itens.map(i => `<div><span>${escaparDashboardExecutivo(i.nome)}</span><div><i style="width:${Math.max(4, Number(i.valor || 0) / max * 100)}%"></i></div><strong>${Number(i.valor || 0).toLocaleString("pt-BR")}</strong></div>`).join("") : `<p class="managementEmpty">Sem dados no período.</p>`}</div></article>`;
}

function renderRankingDashboard(titulo, itens, detalhe) {
    return `<article class="managementRanking"><h3>${escaparDashboardExecutivo(titulo)}</h3>${itens.length ? itens.slice(0, 10).map((i, n) => `<div><b>${n + 1}</b><span>${escaparDashboardExecutivo(i.nome)}</span><strong>${escaparDashboardExecutivo(detalhe(i))}</strong></div>`).join("") : `<p>Sem dados no período.</p>`}</article>`;
}

function renderMetaDashboard(titulo, atual, meta, moeda = false) {
    const progresso = meta > 0 ? Math.min(100, (Number(atual || 0) / meta) * 100) : 0;
    return `<article><div><span>${escaparDashboardExecutivo(titulo)}</span><strong>${moeda ? Utils.moeda(atual) : Number(atual || 0).toLocaleString("pt-BR")}</strong><small>Meta: ${moeda ? Utils.moeda(meta) : Number(meta || 0).toLocaleString("pt-BR")}</small></div><div class="goalProgress"><i style="width:${progresso}%"></i></div><b>${progresso.toFixed(0)}%</b></article>`;
}

function renderIndicadoresDashboard(i) {
    return renderInfoCardDashboard("Indicadores", "gauge", [
        ["Ticket Médio", Utils.moeda(i.ticketMedio)],
        ["Lucro Médio", Utils.moeda(i.lucroMedio)],
        ["Pedidos por Cliente", i.pedidosPorCliente.toLocaleString("pt-BR", { maximumFractionDigits: 2 })],
        ["Venda Média por Loja", Utils.moeda(i.vendaMediaLoja)],
        ["Recebimento Médio", Utils.moeda(i.recebimentoMedio)],
        ["Produtos por Pedido", i.produtosPorPedido.toLocaleString("pt-BR", { maximumFractionDigits: 2 })],
        ["Tempo Médio Produção", `${i.tempoMedioProducao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`]
    ]);
}

function renderResumoConsignadoDashboard(c) {
    return renderInfoCardDashboard("Consignado", "store", [
        ["Valor em lojas", Utils.moeda(c.valorEmLojas)],
        ["Peças em lojas", c.pecasEmLojas],
        ["Valor vendido", Utils.moeda(c.valorVendido)],
        ["Valor pendente", Utils.moeda(c.valorPendente)],
        ["Conferências", c.conferencias],
        ["Melhor loja", c.melhorLoja],
        ["Menor giro", c.menorGiro]
    ]);
}

function renderResumoPedidosDashboard(p) {
    return renderInfoCardDashboard("Pedidos", "factory", [
        ["Criados", p.criados],
        ["Produção", p.producao],
        ["Prontos", p.prontos],
        ["Entregues", p.entregues],
        ["Cancelados", p.cancelados],
        ["Tempo médio", `${p.tempoMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`]
    ]);
}

function renderResumoFilamentosDashboard(f) {
    return renderInfoCardDashboard("Filamentos", "spool", [
        ["Peso total estoque", `${f.pesoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`],
        ["Valor estoque", Utils.moeda(f.valorEstoque)],
        ["Materiais", f.materiais],
        ["Filamentos críticos", f.criticos],
        ["Consumo estimado", f.consumoEstimado]
    ]);
}

function renderResumoFinanceiroDashboard(f) {
    return renderInfoCardDashboard("Financeiro", "wallet-cards", [
        ["Receber Hoje", Utils.moeda(f.receberHoje)],
        ["Receber Semana", Utils.moeda(f.receberSemana)],
        ["Receber Mês", Utils.moeda(f.receberMes)],
        ["Recebido Mês", Utils.moeda(f.recebidoMes)],
        ["Atrasados", Utils.moeda(f.atrasados)],
        ["Fluxo previsto", Utils.moeda(f.fluxoPrevisto)]
    ]);
}

function renderInfoCardDashboard(titulo, icone, linhas) {
    return `<article class="managementInfoCard"><h3><i data-lucide="${icone}"></i>${escaparDashboardExecutivo(titulo)}</h3>${linhas.map(([l, v]) => `<p><span>${escaparDashboardExecutivo(l)}</span><strong>${escaparDashboardExecutivo(v)}</strong></p>`).join("")}</article>`;
}

function abrirMetasDashboardExecutivo() {
    const m = carregarMetasDashboardExecutivo();
    Modal.abrir("Metas do Dashboard", `
        <div class="managementGoalsForm">
            ${campoMetaDashboard("Meta mensal", "metaMensal", m.metaMensal)}
            ${campoMetaDashboard("Meta anual", "metaAnual", m.metaAnual)}
            ${campoMetaDashboard("Meta pedidos", "metaPedidos", m.metaPedidos)}
            ${campoMetaDashboard("Meta faturamento", "metaFaturamento", m.metaFaturamento)}
            <button class="btn" onclick="salvarMetasDashboardExecutivo()">Salvar metas</button>
        </div>
    `);
}

function campoMetaDashboard(label, id, valor) {
    return `<label class="inputGroup"><span>${label}</span><input id="${id}" type="number" min="0" step="0.01" value="${Number(valor || 0)}"></label>`;
}

function carregarMetasDashboardExecutivo() {
    try {
        return { metaMensal: 5000, metaAnual: 60000, metaPedidos: 40, metaFaturamento: 5000, ...(JSON.parse(localStorage.getItem("primedocs_dashboard_metas")) || {}) };
    } catch (e) {
        return { metaMensal: 5000, metaAnual: 60000, metaPedidos: 40, metaFaturamento: 5000 };
    }
}

function salvarMetasDashboardExecutivo() {
    const metas = {
        metaMensal: Number(document.getElementById("metaMensal")?.value) || 0,
        metaAnual: Number(document.getElementById("metaAnual")?.value) || 0,
        metaPedidos: Number(document.getElementById("metaPedidos")?.value) || 0,
        metaFaturamento: Number(document.getElementById("metaFaturamento")?.value) || 0
    };
    localStorage.setItem("primedocs_dashboard_metas", JSON.stringify(metas));
    Modal.fechar();
    renderDashboardExecutivo();
    Toast.show("Metas atualizadas.");
}

function exportarDashboardPDF() {
    const dados = window.__dashboardExecutivoAtual;
    const { jsPDF } = window.jspdf || {};
    if (!dados || !jsPDF) return Toast.show("PDF indisponível.");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFillColor(109, 93, 253);
    doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(255);
    doc.setFontSize(20);
    doc.text("Dashboard Executivo", 14, 15);
    doc.setFontSize(10);
    doc.text(formatarPeriodoDashboard(dados.intervalo), 14, 24);
    doc.setTextColor(17, 24, 39);
    let y = 48;
    [
        ["Faturamento", Utils.moeda(dados.atual.faturamento)],
        ["Lucro estimado", Utils.moeda(dados.atual.lucroEstimado)],
        ["Pedidos", dados.atual.pedidos],
        ["Contas a receber", Utils.moeda(dados.atual.contasReceber)],
        ["Valor em consignado", Utils.moeda(dados.atual.valorConsignado)]
    ].forEach(([l, v]) => {
        doc.text(`${l}: ${v}`, 14, y);
        y += 8;
    });
    doc.save(`dashboard_executivo_${Utils.hoje()}.pdf`);
    Toast.show("Dashboard PDF exportado!");
}

function exportarDashboardCSV() {
    const dados = window.__dashboardExecutivoAtual;
    if (!dados) return Toast.show("Dashboard indisponível.");
    const linhas = [["Seção", "Indicador", "Valor"]];
    Object.entries({
        Faturamento: dados.atual.faturamento,
        LucroEstimado: dados.atual.lucroEstimado,
        Pedidos: dados.atual.pedidos,
        ContasReceber: dados.atual.contasReceber,
        ValorConsignado: dados.atual.valorConsignado
    }).forEach(([k, v]) => linhas.push(["KPIs", k, v]));
    dados.rankings.clientes.forEach(i => linhas.push(["Top Clientes", i.nome, i.valor]));
    dados.rankings.produtos.forEach(i => linhas.push(["Top Produtos", i.nome, i.quantidade]));
    baixarArquivoDashboard("\uFEFF" + linhas.map(l => l.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\n"), `dashboard_executivo_${Utils.hoje()}.csv`, "text/csv;charset=utf-8");
    Toast.show("Dashboard CSV exportado!");
}

function imprimirDashboardExecutivo() {
    window.print();
}

function obterIntervaloDashboardExecutivo() {
    const agora = new Date();
    const inicio = new Date(agora);
    const fim = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);
    if (periodoDashboardExecutivo === "semana") inicio.setDate(inicio.getDate() - 6);
    if (periodoDashboardExecutivo === "mes") inicio.setTime(new Date(agora.getFullYear(), agora.getMonth(), 1).getTime());
    if (periodoDashboardExecutivo === "ano") inicio.setTime(new Date(agora.getFullYear(), 0, 1).getTime());
    if (periodoDashboardExecutivo === "personalizado") {
        if (dashboardInicioPersonalizado) inicio.setTime(new Date(`${dashboardInicioPersonalizado}T00:00:00`).getTime());
        if (dashboardFimPersonalizado) fim.setTime(new Date(`${dashboardFimPersonalizado}T23:59:59`).getTime());
    }
    return { inicio: inicio.getTime(), fim: fim.getTime(), label: periodoDashboardExecutivo };
}

function obterIntervaloAnteriorDashboard(intervalo) {
    const duracao = Math.max(86400000, intervalo.fim - intervalo.inicio + 1);
    return { inicio: intervalo.inicio - duracao, fim: intervalo.inicio - 1, label: "anterior" };
}

function noPeriodoDashboard(valor, intervalo) {
    const t = timestampDashboardExecutivo(valor);
    return t >= intervalo.inicio && t <= intervalo.fim;
}

function obterItensVendidosDashboard(dados, intervalo) {
    const produtos = new Map(dados.produtos.map(p => [String(p.id), p]));
    const itensPedidos = dados.pedidos
        .filter(p => p.statusPedido === "entregue" && noPeriodoDashboard(p.criadoEm || p.dataPedido, intervalo))
        .flatMap(p => (p.itens || []).map(i => {
            const produto = produtos.get(String(i.produtoId));
            const quantidade = Number(i.quantidade || 0);
            const valorTotal = Number(i.valorTotal || quantidade * Number(i.valorUnitario || produto?.preco || 0));
            return { ...i, quantidade, valorTotal, custo: Number(produto?.custo || 0), categoria: i.categoria || produto?.categoria || "Sem categoria", nome: i.nome || produto?.nome || "Produto" };
        }));
    const itensConferencia = dados.conferencias
        .filter(c => noPeriodoDashboard(c.criadoEm || c.data, intervalo))
        .flatMap(c => (c.itens || []).map(i => {
            const produto = produtos.get(String(i.produtoId));
            const quantidade = Number(i.quantidadeVendida || 0);
            const valorTotal = Number(i.valorVendido || quantidade * Number(i.preco || produto?.preco || 0));
            return { ...i, quantidade, valorTotal, custo: Number(produto?.custo || 0), categoria: i.categoria || produto?.categoria || "Sem categoria", nome: i.nome || produto?.nome || "Produto" };
        }));
    return itensPedidos.concat(itensConferencia).filter(i => Number(i.quantidade || 0) > 0);
}

function agruparDashboard(lista, chaveFn, nomeFn, valorFn, qtdFn) {
    const mapa = new Map();
    lista.forEach(item => {
        const chave = String(chaveFn(item) || "-");
        const atual = mapa.get(chave) || { nome: nomeFn(item) || "Sem identificação", valor: 0, quantidade: 0 };
        atual.valor += Number(valorFn(item) || 0);
        atual.quantidade += Number(qtdFn(item) || 0);
        mapa.set(chave, atual);
    });
    return [...mapa.values()].sort((a, b) => (b.valor || b.quantidade) - (a.valor || a.quantidade)).slice(0, 10);
}

function calcularComparacaoDashboard(atual, anterior) {
    const a = Number(atual || 0);
    const b = Number(anterior || 0);
    if (!b && !a) return { percentual: 0, label: "0% vs período anterior" };
    if (!b && a) return { percentual: 100, label: "▲ +100% vs período anterior" };
    const p = ((a - b) / Math.abs(b)) * 100;
    return { percentual: p, label: `${p >= 0 ? "▲ +" : "▼ "}${p.toFixed(0)}% vs período anterior` };
}

function calcularTempoMedioProducaoDashboard(pedidos) {
    const duracoes = pedidos.map(p => {
        const ini = timestampDashboardExecutivo(p.dataPedido || p.criadoEm);
        const fim = timestampDashboardExecutivo(p.atualizadoEm || p.dataEntregaPrevista || p.criadoEm);
        return ini && fim && fim >= ini ? (fim - ini) / 86400000 : 0;
    }).filter(Boolean);
    return duracoes.length ? duracoes.reduce((t, v) => t + v, 0) / duracoes.length : 0;
}

function ultimosMesesDashboard(qtd) {
    const base = new Date();
    return Array.from({ length: qtd }, (_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth() - (qtd - 1 - i), 1);
        return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "short" }) };
    });
}

function faturamentoMesDashboard(dados, mes) {
    const intervalo = { inicio: new Date(`${mes}-01T00:00:00`).getTime(), fim: new Date(new Date(`${mes}-01T00:00:00`).getFullYear(), Number(mes.slice(5, 7)), 0, 23, 59, 59, 999).getTime() };
    return calcularIndicadores(dados, intervalo).faturamento;
}

function lucroMesDashboard(dados, mes) {
    const intervalo = { inicio: new Date(`${mes}-01T00:00:00`).getTime(), fim: new Date(new Date(`${mes}-01T00:00:00`).getFullYear(), Number(mes.slice(5, 7)), 0, 23, 59, 59, 999).getTime() };
    return calcularIndicadores(dados, intervalo).lucroEstimado;
}

function calcularFaturamentoAnoDashboard(dados) {
    const ano = new Date().getFullYear();
    return calcularIndicadores(dados, { inicio: new Date(ano, 0, 1).getTime(), fim: new Date(ano, 11, 31, 23, 59, 59, 999).getTime() }).faturamento;
}

function formatarPeriodoDashboard(intervalo) {
    return `${new Date(intervalo.inicio).toLocaleDateString("pt-BR")} até ${new Date(intervalo.fim).toLocaleDateString("pt-BR")}`;
}

function somarDiasDashboard(data, dias) {
    const d = new Date(`${String(data).slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

function timestampDashboardExecutivo(valor) {
    if (!valor) return 0;
    const d = new Date(String(valor).length === 10 ? `${valor}T12:00:00` : valor);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function baixarArquivoDashboard(conteudo, nome, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizarTextoDashboard(valor) {
    return String(valor || "").trim().toLocaleLowerCase("pt-BR");
}

function escaparDashboardExecutivo(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
