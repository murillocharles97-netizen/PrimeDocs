(function () {
    "use strict";

    const BREAKPOINT = 767;
    const STORAGE_PERIOD = "primedocs_mobile_dashboard_periodo";
    const STORAGE_CUSTOM_START = "primedocs_mobile_dashboard_inicio";
    const STORAGE_CUSTOM_END = "primedocs_mobile_dashboard_fim";
    const desktopRender = window.DashboardPremium?.render || window.renderDashboardExecutivo;
    let period = localStorage.getItem(STORAGE_PERIOD) || "mes";
    let customStart = localStorage.getItem(STORAGE_CUSTOM_START) || "";
    let customEnd = localStorage.getItem(STORAGE_CUSTOM_END) || "";
    let lastData = null;
    let resizeTimer = 0;

    const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const money = value => Utils.moeda(n(value));
    const compact = value => n(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const dayMs = 86400000;

    function isMobile() {
        return window.matchMedia?.(`(max-width: ${BREAKPOINT}px)`).matches ?? window.innerWidth <= BREAKPOINT;
    }

    function dateAtStart(date) {
        const value = new Date(date);
        value.setHours(0, 0, 0, 0);
        return value;
    }

    function dateAtEnd(date) {
        const value = new Date(date);
        value.setHours(23, 59, 59, 999);
        return value;
    }

    function buildInterval(type = period, now = new Date()) {
        let start = dateAtStart(now);
        let end = dateAtEnd(now);
        if (type === "semana") start.setDate(start.getDate() - 6);
        if (type === "mes") start = new Date(now.getFullYear(), now.getMonth(), 1);
        if (type === "mes_anterior") {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = dateAtEnd(new Date(now.getFullYear(), now.getMonth(), 0));
        }
        if (type === "ano") start = new Date(now.getFullYear(), 0, 1);
        if (type === "personalizado") {
            if (customStart) start = dateAtStart(new Date(`${customStart}T12:00:00`));
            if (customEnd) end = dateAtEnd(new Date(`${customEnd}T12:00:00`));
        }
        if (start.getTime() > end.getTime()) [start, end] = [dateAtStart(end), dateAtEnd(start)];
        return { inicio: start.getTime(), fim: end.getTime(), label: type };
    }

    function periodLabel(type = period, interval = buildInterval(type)) {
        const current = new Date();
        const labels = {
            hoje: "Hoje",
            semana: "Esta semana",
            mes: current.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
            mes_anterior: new Date(current.getFullYear(), current.getMonth() - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
            ano: `Ano ${current.getFullYear()}`,
            personalizado: `${new Date(interval.inicio).toLocaleDateString("pt-BR")} – ${new Date(interval.fim).toLocaleDateString("pt-BR")}`
        };
        const label = labels[type] || labels.mes;
        return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
    }

    function targetForPeriod(monthlyTarget, annualTarget, interval, type = period) {
        if (type === "ano") return n(annualTarget);
        const target = n(monthlyTarget);
        if (!target) return 0;
        if (["mes", "mes_anterior"].includes(type)) return target;
        const start = new Date(interval.inicio);
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        const intervalDays = Math.max(1, Math.round((interval.fim - interval.inicio + 1) / dayMs));
        return target / daysInMonth * intervalDays;
    }

    function performanceIntervalForType(interval, type = period) {
        const start = new Date(interval.inicio);
        if (type === "mes") return { inicio:new Date(start.getFullYear(),start.getMonth(),1).getTime(), fim:new Date(start.getFullYear(),start.getMonth()+1,0,23,59,59,999).getTime(), label:type };
        if (type === "ano") return { inicio:new Date(start.getFullYear(),0,1).getTime(), fim:new Date(start.getFullYear(),11,31,23,59,59,999).getTime(), label:type };
        return interval;
    }

    function classifyPerformance(difference, percentage) {
        if (percentage > 100) return { id: "superada", label: "Meta superada", message: `Você superou a meta em ${Math.max(0, percentage - 100).toFixed(0)}%.`, tone: "success" };
        if (percentage >= 100) return { id: "atingida", label: "Meta atingida", message: "Meta do período atingida.", tone: "success" };
        if (difference >= 10) return { id: "muito_acima", label: "Muito acima do ritmo", message: "Excelente ritmo. Mantendo este desempenho, a meta será superada.", tone: "success" };
        if (difference >= 3) return { id: "acima", label: "Acima do ritmo", message: "Você está acima do ritmo esperado.", tone: "success" };
        if (difference > -3) return { id: "no_ritmo", label: "No ritmo esperado", message: "Você está no ritmo necessário para alcançar a meta.", tone: "steady" };
        if (difference > -10) return { id: "pouco_abaixo", label: "Ritmo um pouco abaixo", message: "É possível recuperar. Ajuste o ritmo nos próximos dias.", tone: "warning" };
        return { id: "muito_abaixo", label: "Muito abaixo do ritmo", message: "A meta exige uma aceleração importante no faturamento.", tone: "danger" };
    }

    function calculateMonthlyPerformance(input = {}) {
        const now = input.agora ? new Date(input.agora) : new Date();
        const interval = input.intervalo || buildInterval(input.periodo || period, now);
        const start = dateAtStart(new Date(interval.inicio));
        const end = dateAtEnd(new Date(interval.fim));
        const effectiveNow = now < start ? start : now > end ? end : now;
        const totalDays = Math.max(1, Math.round((end - start + 1) / dayMs));
        const elapsedDays = Math.max(1, Math.min(totalDays, Math.floor((dateAtStart(effectiveNow) - start) / dayMs) + 1));
        const remainingDays = Math.max(0, totalDays - elapsedDays);
        const current = Math.max(0, n(input.valorAtual));
        const target = Math.max(0, n(input.valorMeta));
        if (!target) {
            return { disponivel: false, valorAtual: current, valorMeta: 0, percentualMeta: 0, percentualEsperado: 0, diferencaRitmo: 0, diasDecorridos: elapsedDays, diasRestantes: remainingDays, mediaDiariaAtual: current / elapsedDays, mediaDiariaNecessaria: 0, projecaoFechamento: current, classificacao: "sem_meta", mensagemPrincipal: "Meta mensal ainda não configurada.", mensagemSecundaria: "Defina uma meta para acompanhar ritmo, projeção e média diária necessária.", tom: "neutral" };
        }
        const percentage = current / target * 100;
        const expected = elapsedDays / totalDays * 100;
        const difference = percentage - expected;
        const dailyAverage = current / elapsedDays;
        const neededAverage = current >= target ? 0 : remainingDays > 0 ? (target - current) / remainingDays : target - current;
        const projection = dailyAverage * totalDays;
        const classification = classifyPerformance(difference, percentage);
        return {
            disponivel: true,
            valorAtual: current,
            valorMeta: target,
            percentualMeta: percentage,
            percentualEsperado: expected,
            diferencaRitmo: difference,
            diasDecorridos: elapsedDays,
            diasRestantes: remainingDays,
            mediaDiariaAtual: dailyAverage,
            mediaDiariaNecessaria: Math.max(0, neededAverage),
            projecaoFechamento: projection,
            classificacao: classification.id,
            mensagemPrincipal: classification.label,
            mensagemSecundaria: classification.message,
            tom: classification.tone
        };
    }

    function buildData() {
        const interval = buildInterval();
        const raw = aplicarFiltrosDadosDashboard(carregarDadosDashboardExecutivo());
        const previousInterval = obterIntervaloAnteriorDashboard(interval);
        const current = calcularIndicadores(raw, interval);
        const previous = calcularIndicadores(raw, previousInterval);
        const financial = calcularFinanceiro(raw, interval);
        const consignment = calcularConsignado(raw, interval);
        const rankings = calcularRankings(raw, interval);
        const goals = carregarMetasDashboardExecutivo();
        const target = targetForPeriod(goals.metaMensal, goals.metaAnual, interval);
        const goalInterval = performanceIntervalForType(interval);
        const performance = calculateMonthlyPerformance({ valorAtual: current.faturamento, valorMeta: target, intervalo: goalInterval });
        const annualInterval = { inicio: new Date(new Date().getFullYear(), 0, 1).getTime(), fim: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999).getTime() };
        const annualCurrent = calcularIndicadores(raw, annualInterval).faturamento;
        const validOrders = raw.pedidos.filter(order => order.statusPedido !== "cancelado" && noPeriodoDashboard(order.criadoEm || order.dataPedido, interval)).length;
        return {
            periodo: { tipo: period, intervalo: interval, rotulo: periodLabel(period, interval) },
            performance,
            atual: current,
            previo: previous,
            financeiro: financial,
            consignado: consignment,
            metas: goals,
            metasDetalhadas: [
                goalModel("faturamento", "circle-dollar-sign", "Faturamento", current.faturamento, target, true, performance, "Receita realizada no período."),
                goalModel("pedidos", "package", "Pedidos", validOrders, targetForPeriod(goals.metaPedidos, goals.metaPedidos * 12, interval), false, calculateMonthlyPerformance({ valorAtual:validOrders, valorMeta:targetForPeriod(goals.metaPedidos, goals.metaPedidos * 12, interval), intervalo:goalInterval }), "São considerados pedidos não cancelados dentro do período."),
                goalModel("lucro", "wallet-cards", "Lucro", current.lucroEstimado, targetForPeriod(goals.metaLucro, n(goals.metaLucro) * 12, interval), true, calculateMonthlyPerformance({ valorAtual:current.lucroEstimado, valorMeta:targetForPeriod(goals.metaLucro, n(goals.metaLucro) * 12, interval), intervalo:goalInterval }), "Lucro estimado com base nos custos cadastrados."),
                goalModel("anual", "chart-no-axes-combined", "Meta anual", annualCurrent, goals.metaAnual, true, calculateMonthlyPerformance({ valorAtual: annualCurrent, valorMeta: goals.metaAnual, intervalo: annualInterval }), "Faturamento acumulado do ano atual.")
            ],
            rankings: {
                clientes: (rankings.clientes || []).slice(0, 3),
                produtos: (rankings.produtos || []).slice(0, 3),
                lojas: (rankings.lojas || []).slice(0, 3)
            },
            resumo: [
                { id:"receber", icon:"circle-dollar-sign", value:money(current.contasReceber), label:"A receber", detail:`${raw.financeiro.filter(item => !["pago","cancelado"].includes(item.status)).length} pendências`, route:"financeiro", tone:"green" },
                { id:"pedidos", icon:"package", value:validOrders, label:"Pedidos", detail:`${current.pedidosEntregues} entregues`, route:"pedidos", tone:"purple" },
                { id:"clientes", icon:"users-round", value:raw.clientes.length, label:"Clientes ativos", detail:"Base atual", route:"clientes", tone:"blue" },
                { id:"consignado", icon:"store", value:money(consignment.valorEmLojas), label:"Consignado", detail:`${raw.lojas.length} lojas`, route:"consignado", tone:"orange" },
                { id:"ticket", icon:"receipt", value:money(current.ticketMedio), label:"Ticket médio", detail:"Pedidos entregues", route:"relatorios", tone:"cyan" }
            ],
            raw,
            interval
        };
    }

    function goalModel(id, icon, title, current, target, currency, performance, note) {
        const value = Math.max(0, n(current));
        const goal = Math.max(0, n(target));
        const status = performance || calculateMonthlyPerformance({ valorAtual:value, valorMeta:goal, intervalo:buildInterval() });
        return { id, icon, title, current:value, target:goal, currency, performance:status, note };
    }

    function renderPerformance(data) {
        const item = data.performance;
        if (!item.disponivel) {
            return `<section class="mobilePerformanceCard noGoal"><header><span>PERFORMANCE DO PERÍODO</span><i data-lucide="target"></i></header><h2>${esc(item.mensagemPrincipal)}</h2><p>${esc(item.mensagemSecundaria)}</p><button type="button" onclick="DashboardMobile.ajustarMetas()">Configurar meta <i data-lucide="arrow-right"></i></button></section>`;
        }
        const direction = item.diferencaRitmo >= 0 ? "acima" : "abaixo";
        const diff = Math.abs(item.diferencaRitmo).toFixed(0);
        const title = ["mes","mes_anterior"].includes(data.periodo.tipo) ? "Performance do mês" : "Performance do período";
        return `<section class="mobilePerformanceCard ${esc(item.tom)}"><header><span>${esc(title)}</span><button type="button" onclick="DashboardMobile.abrirMeta('faturamento')" aria-label="Ver detalhes da performance"><i data-lucide="circle-help"></i></button></header><div class="mobilePerformanceMain"><div class="mobilePerformanceGauge" style="--progress:${clamp(item.percentualMeta,0,100)}"><div><strong>${item.percentualMeta.toFixed(0)}%</strong><span>da meta</span></div></div><div class="mobilePerformanceMessage"><h2>${esc(item.mensagemPrincipal)}</h2><p>${item.mediaDiariaNecessaria > 0 ? `Para atingir sua meta, você precisa faturar <strong>${esc(money(item.mediaDiariaNecessaria))} por dia</strong> até o fim do período.` : esc(item.mensagemSecundaria)}</p><span class="paceBadge"><i data-lucide="${item.diferencaRitmo >= 0 ? "trending-up" : "trending-down"}"></i>${diff}% ${direction} do ritmo esperado</span></div></div><footer><span><i data-lucide="calendar-days"></i><strong>${item.diasRestantes}</strong><small>dias restantes</small></span><span><i data-lucide="target"></i><strong>${esc(money(item.valorMeta))}</strong><small>meta</small></span><span><i data-lucide="chart-no-axes-combined"></i><strong>${esc(money(item.valorAtual))}</strong><small>faturado</small></span></footer></section>`;
    }

    function renderGoals(data) {
        return `<section class="mobileGoalsCard" aria-labelledby="mobileGoalsTitle"><header><div><span>METAS</span><h2 id="mobileGoalsTitle">Acompanhamento</h2></div><button type="button" onclick="DashboardMobile.ajustarMetas()">Ajustar</button></header><div>${data.metasDetalhadas.map(goal => {
            if (!goal.target) return `<button class="mobileGoalRow unavailable" type="button" onclick="DashboardMobile.abrirMeta('${goal.id}')"><span class="goalIcon"><i data-lucide="${goal.icon}"></i></span><span class="goalContent"><strong>${esc(goal.title)}</strong><small>Meta não configurada</small></span><i data-lucide="chevron-right"></i></button>`;
            const pct = goal.current / goal.target * 100;
            const diff = goal.performance.diferencaRitmo;
            return `<button class="mobileGoalRow ${esc(goal.performance.tom)}" type="button" onclick="DashboardMobile.abrirMeta('${goal.id}')" aria-label="Ver detalhes da meta ${esc(goal.title)}"><span class="goalIcon"><i data-lucide="${goal.icon}"></i></span><span class="goalContent"><span><strong>${esc(goal.title)}</strong><b>${pct.toFixed(0)}%</b></span><small>${esc(goal.currency ? money(goal.current) : compact(goal.current))} de ${esc(goal.currency ? money(goal.target) : compact(goal.target))}</small><span class="goalProgress"><i style="width:${clamp(pct,0,100)}%"></i></span><em>${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% ${diff >= 0 ? "acima" : "abaixo"} do ritmo esperado</em></span><i data-lucide="chevron-right"></i></button>`;
        }).join("")}</div></section>`;
    }

    function rankingCard(type, title, icon, items, route, detail, empty) {
        return `<article class="mobileRankingCard ${type}" data-ranking-card><header><span>${esc(title)}</span><i data-lucide="${icon}"></i></header>${items.length ? `<ol>${items.map((item,index) => `<li><button type="button" onclick="DashboardMobile.abrirRota('${route}')"><b>${index+1}</b><span><strong>${esc(item.nome)}</strong><small>${esc(detail(item))}</small></span><i data-lucide="chevron-right"></i></button></li>`).join("")}</ol>` : `<div class="mobileRankingEmpty"><i data-lucide="inbox"></i><p>${esc(empty)}</p></div>`}</article>`;
    }

    function renderRankings(data) {
        return `<section class="mobileRankings"><header><h2>Rankings rápidos</h2><button type="button" onclick="DashboardMobile.abrirRota('relatorios')">Ver todos <i data-lucide="chevron-right"></i></button></header><div class="mobileRankingCarousel" id="mobileRankingCarousel" onscroll="DashboardMobile.atualizarIndicadorRanking()">${rankingCard("clients","Top clientes","users-round",data.rankings.clientes,"clientes",item=>`${money(item.valor)} · ${compact(item.quantidade)} pedidos`,"Nenhum cliente com compras neste período.")}${rankingCard("products","Top produtos","package",data.rankings.produtos,"produtos",item=>`${compact(item.quantidade)} unidades · ${money(item.valor)}`,"Nenhum produto vendido neste período.")}${rankingCard("stores","Top lojas (consignado)","store",data.rankings.lojas,"lojas",item=>`${money(item.valor)} · ${compact(item.quantidade)} peças`,"Nenhuma venda em consignado neste período.")}</div><div class="mobileRankingDots" aria-hidden="true"><i class="active"></i><i></i><i></i></div></section>`;
    }

    function renderSummary(data) {
        return `<section class="mobileQuickSummary"><h2>Resumo rápido</h2><div>${data.resumo.map(item => `<button class="${item.tone}" type="button" onclick="DashboardMobile.abrirResumo('${item.id}')" aria-label="${esc(item.label)}: ${esc(item.value)}"><span><i data-lucide="${item.icon}"></i></span><strong>${esc(item.value)}</strong><small>${esc(item.label)}</small><em>${esc(item.detail)}</em></button>`).join("")}</div></section>`;
    }

    function renderSkeleton() {
        const content = document.getElementById("content");
        if (!content) return;
        content.innerHTML = `<main class="mobileDashboard mobileDashboardSkeleton" aria-busy="true"><div class="skeleton title"></div><div class="skeleton performance"></div><div class="skeleton goals"></div><div class="skeleton rankings"></div><div class="skeleton summary"></div></main>`;
    }

    function renderMobile() {
        const content = document.getElementById("content");
        if (!content) return;
        renderSkeleton();
        try {
            const data = buildData();
            lastData = data;
            const selectedLabel = data.periodo.rotulo;
            content.innerHTML = `<main class="mobileDashboard"><section class="mobileDashboardTitle"><div><h1>Dashboard</h1><p>Acompanhe suas metas e o desempenho da empresa.</p></div><button type="button" onclick="DashboardMobile.abrirPeriodo()" aria-label="Selecionar período: ${esc(selectedLabel)}"><i data-lucide="calendar-days"></i><span>${esc(selectedLabel)}</span><i data-lucide="chevron-down"></i></button></section>${renderPerformance(data)}${renderGoals(data)}${renderRankings(data)}${renderSummary(data)}</main>`;
            window.__dashboardExecutivoAtual = { atual:data.atual, financeiro:data.financeiro, consignado:data.consignado, rankings:data.rankings, intervalo:data.interval, dados:data.raw };
            window.lucide?.createIcons?.();
            atualizarIndicadorRanking();
        } catch (error) {
            console.error("[PrimeDocs] Dashboard mobile:", error);
            content.innerHTML = `<main class="mobileDashboard"><section class="mobileDashboardError"><i data-lucide="cloud-alert"></i><h1>Não foi possível carregar o Dashboard.</h1><p>Seus outros módulos continuam disponíveis.</p><button type="button" onclick="DashboardMobile.renderMobile()"><i data-lucide="refresh-cw"></i> Atualizar</button></section></main>`;
            window.lucide?.createIcons?.();
        }
    }

    function render() {
        if (isMobile()) return renderMobile();
        return desktopRender?.();
    }

    function abrirPeriodo() {
        const options = [["hoje","Hoje"],["semana","Esta semana"],["mes","Este mês"],["mes_anterior","Mês anterior"],["ano","Ano atual"],["personalizado","Período personalizado"]];
        Modal.abrir("Período do Dashboard", `<div class="mobilePeriodSheet">${options.map(([id,label]) => `<button type="button" class="${period===id ? "active" : ""}" onclick="DashboardMobile.selecionarPeriodo('${id}')"><span><i data-lucide="${period===id ? "circle-check" : "circle"}"></i>${label}</span>${period===id ? `<small>Selecionado</small>` : ""}</button>`).join("")}<div class="mobileCustomPeriod" ${period === "personalizado" ? "" : "hidden"}><label>Data inicial<input id="mobileDashboardStart" type="date" value="${esc(customStart)}"></label><label>Data final<input id="mobileDashboardEnd" type="date" value="${esc(customEnd)}"></label><button class="btn" type="button" onclick="DashboardMobile.aplicarPersonalizado()">Aplicar período</button></div></div>`);
        window.lucide?.createIcons?.();
    }

    function selecionarPeriodo(next) {
        if (!new Set(["hoje","semana","mes","mes_anterior","ano","personalizado"]).has(next)) return;
        period = next;
        localStorage.setItem(STORAGE_PERIOD, period);
        if (next === "personalizado") return abrirPeriodo();
        Modal.fechar();
        renderMobile();
    }

    function aplicarPersonalizado() {
        const start = document.getElementById("mobileDashboardStart")?.value || "";
        const end = document.getElementById("mobileDashboardEnd")?.value || "";
        if (!start || !end) return Toast.show("Informe as datas inicial e final.");
        if (start > end) return Toast.show("A data inicial não pode ser maior que a final.");
        customStart = start;
        customEnd = end;
        localStorage.setItem(STORAGE_CUSTOM_START, start);
        localStorage.setItem(STORAGE_CUSTOM_END, end);
        Modal.fechar();
        renderMobile();
    }

    function abrirMeta(id) {
        const goal = lastData?.metasDetalhadas.find(item => item.id === id);
        if (!goal) return;
        if (!goal.target) {
            Modal.abrir(`Meta de ${goal.title}`, `<div class="mobileGoalDetails empty"><i data-lucide="target"></i><h3>Meta não configurada</h3><p>${esc(goal.note)}</p><button class="btn" onclick="DashboardMobile.ajustarMetas()">Configurar meta</button></div>`);
            return window.lucide?.createIcons?.();
        }
        const p = goal.performance;
        const format = value => goal.currency ? money(value) : compact(value);
        const comparison = calcularComparacaoDashboard(goal.current, id === "faturamento" ? lastData.previo.faturamento : 0);
        Modal.abrir(`Meta de ${goal.title}`, `<div class="mobileGoalDetails"><div><span>Atual<strong>${esc(format(goal.current))}</strong></span><span>Meta<strong>${esc(format(goal.target))}</strong></span><span>Progresso<strong>${(goal.current/goal.target*100).toFixed(0)}%</strong></span><span>Projeção<strong>${esc(format(p.projecaoFechamento))}</strong></span><span>Média necessária<strong>${esc(format(p.mediaDiariaNecessaria))}</strong></span><span>Dias restantes<strong>${p.diasRestantes}</strong></span></div><p><i data-lucide="info"></i>${esc(goal.note)}</p><p>Comparação com o período anterior: <strong>${esc(comparison.badge)}</strong></p><button class="btn" onclick="DashboardMobile.ajustarMetas()">Ajustar meta</button></div>`);
        window.lucide?.createIcons?.();
    }

    function ajustarMetas() {
        Modal.fechar();
        setTimeout(() => abrirMetasDashboardExecutivo(), 20);
    }

    function abrirRota(route) {
        if (typeof navegar === "function") navegar(route);
    }

    function abrirResumo(id) {
        const item = lastData?.resumo.find(value => value.id === id);
        if (!item) return;
        if (id === "receber") {
            try { filtrosFinanceiro = { termo:"", status:"pendente", origem:"", cliente:"", periodo:"", inicio:"", fim:"" }; } catch (_) {}
        }
        abrirRota(item.route);
    }

    function atualizarIndicadorRanking() {
        const carousel = document.getElementById("mobileRankingCarousel");
        const dots = document.querySelectorAll(".mobileRankingDots i");
        if (!carousel || !dots.length) return;
        const cards = [...carousel.querySelectorAll("[data-ranking-card]")];
        const center = carousel.scrollLeft + carousel.clientWidth / 2;
        let nearest = 0;
        let distance = Infinity;
        cards.forEach((card,index) => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            if (Math.abs(cardCenter-center) < distance) { distance = Math.abs(cardCenter-center); nearest = index; }
        });
        dots.forEach((dot,index) => dot.classList.toggle("active", index === nearest));
    }

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (document.querySelector(".mobileDashboard") && !isMobile()) desktopRender?.();
            else if (document.querySelector(".premiumDashboard") && isMobile()) renderMobile();
        }, 180);
    }, { passive:true });

    window.DashboardMobile = { render, renderMobile, calcularPerformanceMensal: calculateMonthlyPerformance, getMobileDashboardData: buildData, abrirPeriodo, selecionarPeriodo, aplicarPersonalizado, abrirMeta, ajustarMetas, abrirRota, abrirResumo, atualizarIndicadorRanking, _buildInterval: buildInterval, _performanceInterval: performanceIntervalForType, _classificar: classifyPerformance };
    window.renderDashboardExecutivo = render;
})();
