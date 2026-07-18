(function () {
    "use strict";

    let faixaGrafico = localStorage.getItem("primedocs_dashboard_faixa_grafico") || "30d";
    let cacheSerie = { chave: "", pontos: [] };

    const esc = valor => String(valor ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const num = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
    const moeda = valor => Utils.moeda(num(valor));
    const percentual = valor => `${num(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    const compacto = valor => num(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    const slug = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const total = (lista, campo) => (lista || []).reduce((soma, item) => soma + num(typeof campo === "function" ? campo(item) : item[campo]), 0);

    function montarContexto() {
        const intervalo = obterIntervaloDashboardExecutivo();
        const dados = aplicarFiltrosDadosDashboard(carregarDadosDashboardExecutivo());
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
        const acoesPendentes = (Storage.listarNotificacoes?.() || []).filter(item => !item.visualizada).length;
        const agora = new Date();
        return { intervalo, dados, anterior, atual, previo, financeiro, pedidos, consignado, filamentos, rankings, graficos, metas, acoesPendentes, agora };
    }

    function ExecutiveDashboardHeader(ctx) {
        const periodo = ctx.agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const periodoFormatado = periodo.charAt(0).toLocaleUpperCase("pt-BR") + periodo.slice(1);
        const comparacao = calcularComparacaoDashboard(ctx.atual.faturamento, ctx.previo.faturamento);
        const comparacaoDisponivel = Number.isFinite(Number(ctx.previo.faturamento)) && Number(ctx.previo.faturamento) > 0;
        const insights = [];

        if (comparacaoDisponivel && comparacao.percentual !== 0) {
            const positivo = comparacao.percentual > 0;
            insights.push(`<button class="executiveHeaderInsight ${positivo ? "positive" : "negative"}" type="button" onclick="DashboardPremium.rolarParaGrafico()"><i data-lucide="${positivo ? "trending-up" : "trending-down"}"></i><span>Faturamento ${positivo ? "cresceu" : "recuou"} <strong>${Math.abs(comparacao.percentual).toFixed(0)}%</strong></span></button>`);
        }
        if (num(ctx.financeiro.atrasados) > 0) {
            insights.push(`<button class="executiveHeaderInsight overdue" type="button" onclick="DashboardPremium.abrirFinanceiroAtrasado()"><i data-lucide="triangle-alert"></i><span><strong>${esc(moeda(ctx.financeiro.atrasados))}</strong> em atraso</span></button>`);
        }
        if (ctx.acoesPendentes > 0) {
            insights.push(`<button class="executiveHeaderInsight pending" type="button" onclick="DashboardPremium.abrirRota('home')"><i data-lucide="list-checks"></i><span><strong>${ctx.acoesPendentes}</strong> ${ctx.acoesPendentes === 1 ? "ação pendente" : "ações pendentes"}</span><i data-lucide="arrow-right"></i></button>`);
        }

        return `<section class="executiveDashboardHeader"><div class="executiveDashboardIntro"><div><h1>Dashboard</h1><p>Visão geral de ${esc(periodoFormatado)}</p></div><div class="executiveHeaderInsights">${insights.join("") || `<span class="executiveHeaderCurrent"><i data-lucide="circle-check"></i> Dados atualizados para o período selecionado.</span>`}</div></div><div class="premiumDashboardActions"><button type="button" onclick="abrirFiltrosDashboardExecutivo()"><i data-lucide="calendar-days"></i><span>${esc(rotuloPeriodoDashboardExecutivo())}</span><i data-lucide="chevron-down"></i></button><button type="button" onclick="abrirFiltrosDashboardExecutivo()"><i data-lucide="sliders-horizontal"></i><span>Filtros</span></button><button class="is-primary executiveExportButton" type="button" onclick="DashboardPremium.abrirExportacao()" aria-label="Exportar Dashboard"><i class="exportDesktopIcon" data-lucide="download"></i><i class="exportMobileIcon" data-lucide="ellipsis"></i><span>Exportar</span></button></div></section>${renderFiltrosAtivosDashboard()}`;
    }

    function kpi(icone, titulo, valor, detalhe, cta, rota, tom = "purple") {
        return `<article class="executiveKpi ${tom}" role="button" tabindex="0" onclick="DashboardPremium.abrirRota('${rota}')" onkeydown="DashboardPremium.ativarRota(event,'${rota}')"><header><span><i data-lucide="${icone}"></i></span><strong>${esc(titulo)}</strong></header><h2>${esc(valor)}</h2><p>${detalhe}</p><button type="button" tabindex="-1">${esc(cta)} <i data-lucide="arrow-right"></i></button></article>`;
    }

    function KpiGrid(ctx) {
        const fat = calcularComparacaoDashboard(ctx.atual.faturamento, ctx.previo.faturamento);
        const lucro = ctx.atual.lucroEstimado;
        const margem = ctx.atual.faturamento > 0 ? lucro / ctx.atual.faturamento * 100 : 0;
        return `<section class="executiveKpiGrid">${kpi("circle-dollar-sign", "Faturamento", moeda(ctx.atual.faturamento), `<b class="${fat.percentual >= 0 ? "up" : "down"}">${fat.percentual >= 0 ? "▲" : "▼"} ${Math.abs(fat.percentual).toFixed(0)}%</b> <span>vs. período anterior</span>`, "Ver financeiro", "financeiro")}${kpi("chart-no-axes-combined", "Lucro estimado", moeda(lucro), `<span>Margem</span> <b class="${margem >= 0 ? "up" : "down"}">${percentual(margem)}</b>`, "Ver análise", "relatorios", "green")}${kpi("package", "Pedidos", ctx.atual.pedidos, `<span>${ctx.atual.pedidosEntregues} entregues · ${ctx.atual.pedidosProducao} em produção</span>`, "Ver pedidos", "pedidos", "orange")}${kpi("badge-dollar-sign", "A receber hoje", moeda(ctx.financeiro.receberHoje), ctx.financeiro.atrasados > 0 ? `<b class="down">${moeda(ctx.financeiro.atrasados)} em atraso</b>` : `<b class="up">Tudo em dia</b>`, "Ver recebimentos", "financeiro", ctx.financeiro.atrasados > 0 ? "red" : "green")}</section>`;
    }

    function serieGrafico(ctx) {
        const chave = [faixaGrafico, ctx.intervalo.inicio, ctx.intervalo.fim, ctx.dados.pedidos.length, total(ctx.dados.pedidos, "valorTotal"), ctx.dados.conferencias.length, total(ctx.dados.conferencias, "valorTotalVendido")].join("|");
        if (cacheSerie.chave === chave) return cacheSerie.pontos;
        const hoje = new Date();
        const pontos = [];
        if (["7d", "30d"].includes(faixaGrafico)) {
            const quantidade = faixaGrafico === "7d" ? 7 : 30;
            for (let i = quantidade - 1; i >= 0; i--) {
                const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
                const inicio = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
                const fim = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999).getTime();
                const indicador = calcularIndicadores(ctx.dados, { inicio, fim });
                pontos.push({ label: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), receita: indicador.faturamento, lucro: indicador.lucroEstimado });
            }
        } else {
            const quantidade = faixaGrafico === "6m" ? 6 : 12;
            ultimosMesesDashboard(quantidade).forEach(mes => pontos.push({ label: mes.label, receita: faturamentoMesDashboard(ctx.dados, mes.key), lucro: lucroMesDashboard(ctx.dados, mes.key) }));
        }
        cacheSerie = { chave, pontos };
        return pontos;
    }

    function pontosSvg(lista, campo, maximo) {
        if (!lista.length) return "";
        return lista.map((item, indice) => {
            const y = Math.min(98, Math.max(3, 94 - (num(item[campo]) / Math.max(1, maximo)) * 82));
            return `${(indice / Math.max(1, lista.length - 1)) * 100},${y}`;
        }).join(" ");
    }

    function MainChart(ctx) {
        const serie = serieGrafico(ctx);
        const maximo = Math.max(1, ...serie.flatMap(item => [num(item.receita), num(item.lucro)]));
        const labels = serie.filter((_, i) => i === 0 || i === serie.length - 1 || i % Math.max(1, Math.floor(serie.length / 5)) === 0);
        return `<article class="premiumPanel revenueChart"><header class="premiumPanelHeader"><div><h2>Faturamento e lucro</h2><p>Evolução do resultado no período</p></div><span class="chartInfo" title="Valores calculados a partir de pedidos entregues e conferências"><i data-lucide="info"></i></span></header><div class="chartRange" role="group" aria-label="Período do gráfico">${[["7d","7 dias"],["30d","30 dias"],["6m","6 meses"],["12m","12 meses"]].map(([id, nome]) => `<button class="${faixaGrafico === id ? "active" : ""}" type="button" onclick="DashboardPremium.selecionarFaixa('${id}')">${nome}</button>`).join("")}</div><div class="premiumLineChart"><div class="chartYAxis"><span>${moeda(maximo)}</span><span>${moeda(maximo / 2)}</span><span>R$ 0</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Gráfico de faturamento e lucro"><defs><linearGradient id="premiumRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6d4aff" stop-opacity=".16"/><stop offset="1" stop-color="#6d4aff" stop-opacity="0"/></linearGradient></defs><g class="chartGridLines"><line x1="0" y1="12" x2="100" y2="12"/><line x1="0" y1="53" x2="100" y2="53"/><line x1="0" y1="94" x2="100" y2="94"/></g><polyline class="revenueLine" points="${pontosSvg(serie, "receita", maximo)}"/><polyline class="profitLine" points="${pontosSvg(serie, "lucro", maximo)}"/></svg><div class="chartXAxis">${labels.map(item => `<span>${esc(item.label)}</span>`).join("")}</div></div><footer class="chartLegend"><span><i class="revenue"></i> Faturamento</span><span><i class="profit"></i> Lucro</span></footer></article>`;
    }

    function PeriodSummary(ctx) {
        const custos = Math.max(0, ctx.atual.faturamento - ctx.atual.lucroEstimado);
        const margem = ctx.atual.faturamento > 0 ? ctx.atual.lucroEstimado / ctx.atual.faturamento * 100 : 0;
        const linhas = [["Receita", moeda(ctx.atual.faturamento)],["Custos", moeda(custos)],["Lucro", moeda(ctx.atual.lucroEstimado),"success"],["Margem", percentual(margem)],["Ticket médio", moeda(ctx.atual.ticketMedio)],["Pedidos", ctx.atual.pedidos]];
        return `<article class="premiumPanel periodSummary"><header class="premiumPanelHeader"><div><h2>Resumo do período</h2><p>${esc(formatarPeriodoDashboard(ctx.intervalo))}</p></div></header><div>${linhas.map(([nome, valor, classe]) => `<p class="${classe || ""}"><span>${nome}</span><strong>${esc(valor)}</strong></p>`).join("")}</div><button type="button" onclick="DashboardPremium.abrirRota('relatorios')">Ver relatório completo <i data-lucide="arrow-right"></i></button></article>`;
    }

    function donut(centro, itens, formatarCentro = valor => valor) {
        const cores = ["#6d4aff", "#28bd7d", "#f5b51b", "#ef5c65", "#3b82f6", "#9b72ff"];
        const soma = total(itens, "valor");
        let cursor = 0;
        const gradiente = soma > 0 ? itens.map((item, indice) => {
            const inicio = cursor;
            cursor += num(item.valor) / soma * 100;
            return `${cores[indice % cores.length]} ${inicio}% ${cursor}%`;
        }).join(",") : "var(--border, #e5e7eb) 0 100%";
        return `<div class="premiumDonut" style="background:conic-gradient(${gradiente})"><span>${esc(formatarCentro(centro))}</span></div><div class="donutLegend">${itens.map((item, indice) => { const pct = soma ? num(item.valor) / soma * 100 : 0; return `<p><i style="background:${cores[indice % cores.length]}"></i><span>${esc(item.nome)}</span><strong>${esc(item.formatado ?? `${compacto(item.valor)} (${pct.toFixed(0)}%)`)}</strong></p>`; }).join("") || `<p class="emptyDonut">Sem dados no período</p>`}</div>`;
    }

    function SecondaryCharts(ctx) {
        const pedidosDiretos = ctx.dados.pedidos.filter(p => p.statusPedido === "entregue" && noPeriodoDashboard(p.criadoEm || p.dataPedido, ctx.intervalo)).reduce((s, p) => s + num(p.valorTotal), 0);
        const consignado = ctx.dados.conferencias.filter(c => noPeriodoDashboard(c.criadoEm || c.data, ctx.intervalo)).reduce((s, c) => s + num(c.valorTotalVendido), 0);
        const origens = [{ nome:"Pedidos diretos", valor:pedidosDiretos, formatado:moeda(pedidosDiretos) },{ nome:"Consignado", valor:consignado, formatado:moeda(consignado) },{ nome:"Orçamentos convertidos", valor:0, formatado:moeda(0) }];
        const status = ctx.graficos.pedidosPorStatus.map(item => ({ nome:item.nome, valor:item.valor }));
        return `<section class="secondaryChartsGrid"><article class="premiumPanel donutCard"><header class="premiumPanelHeader"><div><h2>De onde veio o faturamento</h2><p>Composição da receita realizada</p></div><i data-lucide="info"></i></header><div class="donutContent">${donut(ctx.atual.faturamento, origens, moeda)}</div><button onclick="DashboardPremium.abrirRota('financeiro')">Ver detalhes <i data-lucide="arrow-right"></i></button></article><article class="premiumPanel donutCard"><header class="premiumPanelHeader"><div><h2>Situação dos pedidos</h2><p>Distribuição no período</p></div><i data-lucide="info"></i></header><div class="donutContent">${donut(ctx.atual.pedidos, status)}</div><button onclick="DashboardPremium.abrirRota('pedidos')">Ver pedidos <i data-lucide="arrow-right"></i></button></article></section>`;
    }

    function imagemProduto(ctx, ranking) {
        const produto = ctx.dados.produtos.find(item => String(item.nome || "").toLocaleLowerCase("pt-BR") === String(ranking?.nome || "").toLocaleLowerCase("pt-BR"));
        const src = produto?.imagem || produto?.foto || produto?.imagemUrl || "";
        return src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="trophy" hidden></i>` : `<i data-lucide="trophy"></i>`;
    }

    function smartCard(tipo, icone, titulo, item, detalhe1, detalhe2, cta, rota, visual = "") {
        return `<article class="smartWinnerCard ${tipo}"><header><span><i data-lucide="${icone}"></i></span><h2>${esc(titulo)}</h2></header>${item ? `<div class="winnerBody"><span class="winnerVisual">${visual || `<i data-lucide="${icone}"></i>`}</span><div><strong>${esc(item.nome)}</strong><p>${esc(detalhe1)}</p><b>${esc(detalhe2)}</b></div></div>` : `<div class="winnerEmpty"><strong>Sem dados no período</strong><p>O destaque aparecerá após as primeiras movimentações.</p></div>`}<button type="button" onclick="DashboardPremium.abrirRota('${rota}')">${esc(cta)} <i data-lucide="arrow-right"></i></button></article>`;
    }

    function SmartCards(ctx) {
        const produto = ctx.rankings.produtos[0];
        const cliente = ctx.rankings.clientes[0];
        const loja = ctx.rankings.lojas[0];
        return `<section class="smartCardsGrid">${smartCard("product", "trophy", "Produto campeão", produto, produto ? `${produto.quantidade} unidades` : "", produto ? moeda(produto.valor) : "", "Ver ranking", "estoque:produtos", produto ? imagemProduto(ctx, produto) : "")}${smartCard("client", "user-round", "Melhor cliente", cliente, cliente ? `${cliente.quantidade} pedidos` : "", cliente ? moeda(cliente.valor) : "", "Ver clientes", "clientes")}${smartCard("store", "store", "Melhor loja", loja, loja ? `${loja.quantidade} peças` : "", loja ? moeda(loja.valor) : "", "Ver lojas", "lojas")}</section>`;
    }

    function OperationsStrip(ctx) {
        const itens = [["printer",ctx.pedidos.producao,"Pedidos em produção","Ver produção","producao","purple"],["archive",ctx.pedidos.impressorasOcupadas,"Impressoras ocupadas","Ver impressoras","impressoras","blue"],["spool",ctx.filamentos.criticos,"Filamentos críticos","Ver filamentos","estoque:filamentos","orange"],["gem",ctx.consignado.pecasEmLojas,"Peças em lojas","Ver consignado","consignado","green"]];
        return `<section class="premiumPanel operationsBusinessStrip"><header class="premiumPanelHeader"><div><h2>Produção e estoque</h2><p>Situação operacional atual</p></div></header><div>${itens.map(item => `<article class="${item[5]}" role="button" tabindex="0" onclick="DashboardPremium.abrirRota('${item[4]}')" onkeydown="DashboardPremium.ativarRota(event,'${item[4]}')"><span><i data-lucide="${item[0]}"></i></span><div><strong>${esc(item[1])}</strong><p>${esc(item[2])}</p><button tabindex="-1">${esc(item[3])} <i data-lucide="arrow-right"></i></button></div></article>`).join("")}</div></section>`;
    }

    function diasRestantesMes(data = new Date()) {
        return Math.max(0, new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate() - data.getDate());
    }

    function goalCard(titulo, atual, meta, moedaAtiva, agora, placeholder = false) {
        if (placeholder || !num(meta)) return `<article class="goalCard is-placeholder"><header><span>${esc(titulo)}</span><b>Preparado</b></header><strong>Meta não configurada</strong><p>Defina este objetivo quando desejar acompanhar a projeção.</p><button onclick="abrirMetasDashboardExecutivo()">Configurar meta</button></article>`;
        const pct = Math.min(100, num(atual) / num(meta) * 100);
        const dia = Math.max(1, agora.getDate());
        const diasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
        const projecao = num(atual) / dia * diasMes;
        const fmt = valor => moedaAtiva ? moeda(valor) : compacto(valor);
        return `<article class="goalCard"><header><span>${esc(titulo)}</span><b>${pct.toFixed(0)}%</b></header><h3>${fmt(atual)} <small>de ${fmt(meta)}</small></h3><div class="goalBar"><i style="width:${pct}%"></i></div><footer><span><small>Projeção</small><strong>${fmt(projecao)}</strong></span><span><small>Faltam</small><strong>${fmt(Math.max(0, meta - atual))}</strong></span><span><small>Dias restantes</small><strong>${diasRestantesMes(agora)}</strong></span></footer></article>`;
    }

    function Highlights(ctx) {
        const comp = calcularComparacaoDashboard(ctx.atual.faturamento, ctx.previo.faturamento);
        const lista = [];
        if (comp.percentual) lista.push({ tom:comp.percentual >= 0 ? "success" : "warning", texto:`Faturamento ${comp.percentual >= 0 ? "aumentou" : "reduziu"} ${Math.abs(comp.percentual).toFixed(0)}% em relação ao período anterior.` });
        if (ctx.rankings.produtos[0] && ctx.atual.faturamento > 0) lista.push({ tom:"success", texto:`${ctx.rankings.produtos[0].nome} lidera o período com ${ctx.rankings.produtos[0].quantidade} unidades.` });
        if (ctx.financeiro.atrasados > 0) lista.push({ tom:"warning", texto:`Você tem ${moeda(ctx.financeiro.atrasados)} em atraso para receber.` });
        if (ctx.filamentos.criticos > 0) lista.push({ tom:"warning", texto:`${ctx.filamentos.criticos} ${ctx.filamentos.criticos === 1 ? "filamento está crítico" : "filamentos estão críticos"} e podem afetar produções.` });
        if (!lista.length) lista.push({ tom:"success", texto:"Nenhum alerta relevante foi encontrado neste período." });
        return `<article class="premiumPanel highlightsCard" id="dashboardDestaques"><header class="premiumPanelHeader"><div><h2>Destaques do período</h2><p>Leitura automática dos indicadores</p></div><i data-lucide="sparkles"></i></header><div>${lista.slice(0, 5).map(item => `<p class="${item.tom}"><i data-lucide="${item.tom === "success" ? "trending-up" : "triangle-alert"}"></i><span>${esc(item.texto)}</span></p>`).join("")}</div><button onclick="DashboardPremium.abrirRota('home')">Ver operações <i data-lucide="arrow-right"></i></button></article>`;
    }

    function GoalsAndHighlights(ctx) {
        return `<section class="goalsHighlightsGrid"><div class="premiumPanel goalsPanel"><header class="premiumPanelHeader"><div><h2>Metas</h2><p>Acompanhamento e projeção</p></div><button onclick="abrirMetasDashboardExecutivo()"><i data-lucide="settings-2"></i> Ajustar</button></header><div>${goalCard("Meta mensal de faturamento",ctx.atual.faturamento,ctx.metas.metaMensal,true,ctx.agora)}${goalCard("Meta de pedidos",ctx.atual.pedidos,ctx.metas.metaPedidos,false,ctx.agora)}${goalCard("Meta de lucro",ctx.atual.lucroEstimado,ctx.metas.metaLucro,true,ctx.agora,!ctx.metas.metaLucro)}${goalCard("Meta anual",calcularFaturamentoAnoDashboard(ctx.dados),ctx.metas.metaAnual,true,ctx.agora)}</div></div>${Highlights(ctx)}</section>`;
    }

    function rankingCard(titulo, icone, itens, detalhe, rota) {
        return `<article class="premiumPanel compactRanking"><header class="premiumPanelHeader"><div><h2>${esc(titulo)}</h2><p>Top 10 do período</p></div><i data-lucide="${icone}"></i></header><ol>${itens.length ? itens.slice(0,10).map((item, i) => `<li><b>${i+1}</b><span>${esc(item.nome)}</span><strong>${esc(detalhe(item))}</strong></li>`).join("") : `<li class="rankingEmpty">Sem dados suficientes.</li>`}</ol><button onclick="DashboardPremium.abrirRota('${rota}')">Abrir módulo <i data-lucide="arrow-right"></i></button></article>`;
    }

    function Rankings(ctx) {
        return `<section class="rankingsSection"><header><div><span>RANKINGS</span><h2>Melhores resultados</h2></div></header><div>${rankingCard("Top produtos","trophy",ctx.rankings.produtos,i=>`${i.quantidade} un. · ${moeda(i.valor)}`,"estoque:produtos")}${rankingCard("Top clientes","users",ctx.rankings.clientes,i=>`${i.quantidade} ped. · ${moeda(i.valor)}`,"clientes")}${rankingCard("Top lojas","store",ctx.rankings.lojas,i=>`${i.quantidade} peças · ${moeda(i.valor)}`,"lojas")}${rankingCard("Top categorias","shapes",ctx.rankings.categorias,i=>`${i.quantidade} un.`,"estoque:produtos")}</div></section>`;
    }

    function Indicators(ctx) {
        const itens = [["receipt", "Ticket médio", moeda(ctx.atual.ticketMedio)],["badge-percent", "Lucro médio", moeda(ctx.atual.lucroMedio)],["shopping-basket", "Venda média por loja", moeda(ctx.atual.vendaMediaLoja)],["users", "Pedidos por cliente", compacto(ctx.atual.pedidosPorCliente)],["package-open", "Produtos por pedido", compacto(ctx.atual.produtosPorPedido)],["timer", "Tempo médio de produção", `${compacto(ctx.atual.tempoMedioProducao)} dias`],["hand-coins", "Recebimento médio", moeda(ctx.atual.recebimentoMedio)]];
        return `<section class="premiumPanel indicatorsPanel"><header class="premiumPanelHeader"><div><h2>Indicadores</h2><p>Eficiência comercial e operacional</p></div></header><div>${itens.map(item => `<article><span><i data-lucide="${item[0]}"></i></span><p>${esc(item[1])}</p><strong>${esc(item[2])}</strong></article>`).join("")}</div></section>`;
    }

    function moduleCard(icone, titulo, linhas, rota, tom) {
        return `<article class="premiumModuleCard ${tom}" role="button" tabindex="0" onclick="DashboardPremium.abrirRota('${rota}')" onkeydown="DashboardPremium.ativarRota(event,'${rota}')"><header><span><i data-lucide="${icone}"></i></span><h2>${esc(titulo)}</h2><i data-lucide="arrow-up-right"></i></header><div>${linhas.map(([nome,valor])=>`<p><span>${esc(nome)}</span><strong>${esc(valor)}</strong></p>`).join("")}</div></article>`;
    }

    function ModuleCards(ctx) {
        return `<section class="moduleCardsSection"><header><span>VISÃO POR MÓDULO</span><h2>Detalhamento rápido</h2></header><div>${moduleCard("wallet-cards","Financeiro",[["Receber hoje",moeda(ctx.financeiro.receberHoje)],["Receber no mês",moeda(ctx.financeiro.receberMes)],["Recebido no mês",moeda(ctx.financeiro.recebidoMes)],["Fluxo previsto",moeda(ctx.financeiro.fluxoPrevisto)]],"financeiro","green")}${moduleCard("store","Consignado",[["Valor em lojas",moeda(ctx.consignado.valorEmLojas)],["Peças",ctx.consignado.pecasEmLojas],["Conferências",ctx.consignado.conferencias],["Melhor loja",ctx.consignado.melhorLoja]],"consignado","orange")}${moduleCard("package","Pedidos",[["Criados",ctx.pedidos.criados],["Em produção",ctx.pedidos.producao],["Prontos",ctx.pedidos.prontos],["Entregues",ctx.pedidos.entregues]],"pedidos","purple")}${moduleCard("spool","Filamentos",[["Peso em estoque",`${compacto(ctx.filamentos.pesoTotal)} kg`],["Valor em estoque",moeda(ctx.filamentos.valorEstoque)],["Materiais",ctx.filamentos.materiais],["Críticos",ctx.filamentos.criticos]],"estoque:filamentos","blue")}</div></section>`;
    }

    function render() {
        const content = document.getElementById("content");
        if (!content) return;
        const ctx = montarContexto();
        content.innerHTML = `<main class="premiumDashboard">${ExecutiveDashboardHeader(ctx)}${KpiGrid(ctx)}<section class="mainAnalyticsGrid">${MainChart(ctx)}${PeriodSummary(ctx)}</section>${SecondaryCharts(ctx)}${SmartCards(ctx)}${OperationsStrip(ctx)}${GoalsAndHighlights(ctx)}${Rankings(ctx)}${Indicators(ctx)}${ModuleCards(ctx)}</main>`;
        window.__dashboardExecutivoAtual = { atual:ctx.atual, financeiro:ctx.financeiro, pedidos:ctx.pedidos, consignado:ctx.consignado, filamentos:ctx.filamentos, rankings:ctx.rankings, graficos:ctx.graficos, intervalo:ctx.intervalo, dados:ctx.dados };
        window.lucide?.createIcons?.();
        if (window.__primeDocsNavigationOptions?.abrirFiltros) {
            window.__primeDocsNavigationOptions.abrirFiltros = false;
            setTimeout(abrirFiltrosDashboardExecutivo, 0);
        }
    }

    function selecionarFaixa(faixa) {
        if (!new Set(["7d","30d","6m","12m"]).has(faixa)) return;
        faixaGrafico = faixa;
        localStorage.setItem("primedocs_dashboard_faixa_grafico", faixa);
        render();
    }

    function abrirExportacao() {
        Modal.abrir("Exportar Dashboard", `<div class="compactActionMenu"><button onclick="Modal.fechar();exportarDashboardPDF()"><i data-lucide="file-down"></i><span><strong>Exportar PDF</strong><small>Resumo executivo do período</small></span></button><button onclick="Modal.fechar();exportarDashboardCSV()"><i data-lucide="sheet"></i><span><strong>Exportar CSV</strong><small>Indicadores e movimentações</small></span></button><button onclick="Modal.fechar();imprimirDashboardExecutivo()"><i data-lucide="printer"></i><span><strong>Imprimir</strong><small>Usar impressão do dispositivo</small></span></button></div>`);
        window.lucide?.createIcons?.();
    }

    function abrirRota(rota) {
        if (typeof navegar !== "function") return;
        const [pagina, secao] = String(rota || "").split(":");
        navegar(pagina, secao ? { section: secao } : {});
    }
    function ativarRota(evento, rota) { if (["Enter", " "].includes(evento.key)) { evento.preventDefault(); abrirRota(rota); } }
    function rolarParaDestaques() { document.getElementById("dashboardDestaques")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center" }); }
    function rolarParaGrafico() { document.querySelector(".revenueChart")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center" }); }
    function abrirFinanceiroAtrasado() {
        try { filtrosFinanceiro = { termo:"", status:"atrasado", origem:"", cliente:"", periodo:"", inicio:"", fim:"" }; } catch (_) {}
        abrirRota("financeiro");
    }

    window.DashboardPremium = { render, selecionarFaixa, abrirExportacao, abrirRota, ativarRota, rolarParaDestaques, rolarParaGrafico, abrirFinanceiroAtrasado, _montarContexto: montarContexto, _serieGrafico: serieGrafico, _cabecalho: ExecutiveDashboardHeader };
    window.renderDashboardExecutivo = render;
})();
