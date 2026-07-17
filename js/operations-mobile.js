(function () {
    "use strict";

    if (!window.CentralOperacoes) return;

    const renderDesktop = CentralOperacoes.render;
    const MOBILE_QUERY = "(max-width: 768px)";
    let contextoMobile = null;
    let ultimoModoMobile = null;
    let resizeTimer = null;

    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const num = valor => Number(valor) || 0;
    const moeda = valor => window.Utils?.moeda ? Utils.moeda(num(valor)) : num(valor).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
    const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches === true;

    function obterNomeUsuario() {
        const usuario = window.PrimeFirebase?.auth?.currentUser;
        let perfil = null;
        try { perfil = JSON.parse(localStorage.getItem("primedocs_usuario") || "null"); } catch (_) { perfil = null; }
        const nome = usuario?.displayName || perfil?.apelido || perfil?.nome || usuario?.email?.split("@")[0] || "";
        const primeiro = String(nome).trim().split(/[\s._-]+/)[0].replace(/\d+$/g, "");
        return primeiro ? primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR") : "";
    }

    function saudacao(data) {
        const periodo = data.getHours() < 12 ? "Bom dia" : data.getHours() < 18 ? "Boa tarde" : "Boa noite";
        const nome = obterNomeUsuario();
        return `${periodo}${nome ? `, ${nome}` : ""}!`;
    }

    function prioridadeMeta(item, dados) {
        if (item.entidadeTipo === "pedido") {
            const pedido = dados.pedidos.find(registro => String(registro.id) === String(item.entidadeId));
            const itens = pedido?.itens || [];
            return {
                linhas: [
                    itens.length ? `${itens.length} produto${itens.length === 1 ? "" : "s"}` : "",
                    itens.length ? `${itens.reduce((total, produto) => total + num(produto.quantidade), 0)} peça${itens.reduce((total, produto) => total + num(produto.quantidade), 0) === 1 ? "" : "s"}` : "",
                    num(pedido?.valorPendente) > 0 ? `${moeda(pedido.valorPendente)} pendentes` : ""
                ].filter(Boolean)
            };
        }
        if (item.entidadeTipo === "financeiro") {
            const lancamento = dados.financeiro.find(registro => String(registro.id) === String(item.entidadeId));
            return { linhas: [num(lancamento?.valorRestante) > 0 ? `${moeda(lancamento.valorRestante)} pendentes` : ""].filter(Boolean) };
        }
        return { linhas: [item.badge || ""].filter(Boolean) };
    }

    function MobileGreeting(contexto) {
        const total = contexto.resumo.totalAtencao;
        return `<header class="mobileOpsGreeting"><h1>${esc(saudacao(contexto.dados.agora))} <span aria-hidden="true">👋</span></h1><p>${total ? `Você possui ${total} ${total === 1 ? "prioridade" : "prioridades"} hoje.` : "Sua operação está em ordem agora."}</p></header>`;
    }

    function MobilePriorityCard(item, indice, dados) {
        const meta = prioridadeMeta(item, dados);
        const rotulo = indice === 0 ? "AGORA" : indice === 1 ? "PRÓXIMA" : `PRIORIDADE ${indice + 1}`;
        return `<article class="mobilePriorityCard priority-${esc(item.prioridade)}" data-mobile-priority="${indice}" role="button" tabindex="0" onclick="CentralOperacoesMobile.abrirPrioridade(${indice})" onkeydown="CentralOperacoesMobile.ativarPrioridade(event,${indice})"><header><span><i></i>${rotulo}</span>${item.badge ? `<b>${esc(item.badge)}</b>` : ""}</header><div class="mobilePriorityBody"><span class="mobilePriorityIcon"><i data-lucide="${esc(item.icone || "circle-alert")}"></i></span><div><h2>${esc(item.titulo)}</h2><p>${esc(item.descricao)}</p>${meta.linhas.length ? `<div class="mobilePriorityMeta">${meta.linhas.map((linha, posicao) => `<span><i data-lucide="${posicao === meta.linhas.length - 1 && /R\$/.test(linha) ? "hand-coins" : "box"}"></i>${esc(linha)}</span>`).join("")}</div>` : ""}</div></div><button type="button" onclick="event.stopPropagation();CentralOperacoesMobile.abrirPrioridade(${indice})">${esc(item.acaoPrincipal || "Abrir")} <i data-lucide="arrow-right"></i></button></article>`;
    }

    function MobileNow(contexto) {
        if (!contexto.prioridades.length) return `<section class="mobileNowEmpty"><span><i data-lucide="circle-check-big"></i></span><div><strong>Tudo em ordem agora</strong><p>Nenhuma ação urgente precisa da sua atenção.</p></div></section>`;
        return `<section class="mobileNow" aria-label="Prioridades do momento"><div class="mobilePriorityCarousel" id="mobilePriorityCarousel" onscroll="CentralOperacoesMobile.atualizarCarrossel()">${contexto.prioridades.map((item, indice) => MobilePriorityCard(item, indice, contexto.dados)).join("")}</div>${contexto.prioridades.length > 1 ? `<div class="mobileCarouselDots">${contexto.prioridades.slice(0, 5).map((_, indice) => `<i class="${indice === 0 ? "active" : ""}" data-mobile-dot="${indice}"></i>`).join("")}</div>` : ""}</section>`;
    }

    function obterImpressorasMobile(contexto) {
        const dados = contexto.dados;
        const impressoras = new Map(dados.impressoras.map(item => [String(item.id), item]));
        const ordens = new Map(dados.ordens.map(item => [String(item.id), item]));
        const operacoes = new Map(dados.operacoes.map(item => [String(item.id), item]));
        const ativos = dados.lotes.filter(lote => ["em_execucao", "pausada"].includes(lote.status)).map(lote => ({
            tipo:"ativa", lote, impressora:impressoras.get(String(lote.impressoraId)) || { id:lote.impressoraId, nome:lote.impressoraNome },
            ordem:ordens.get(String(lote.ordemProducaoId)), operacao:operacoes.get(String(lote.operacaoId))
        }));
        const ocupadas = new Set(ativos.map(item => String(item.impressora.id)));
        const livres = dados.impressoras.filter(item => item.status === "livre" && !ocupadas.has(String(item.id))).map(impressora => ({ tipo:"livre", impressora }));
        return [...ativos, ...livres];
    }

    function MobilePrinterCard(item) {
        const imagem = CentralOperacoes.getPrinterImage(item.impressora);
        if (item.tipo === "livre") return `<article class="mobilePrinterCard is-free" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')" role="button" tabindex="0"><span class="mobilePrinterImage"><img src="${esc(imagem)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span><div><header><strong>${esc(item.impressora.nome || "Impressora")}</strong><b>LIVRE</b></header><p>Pronta para usar</p><button type="button">Iniciar produção</button></div></article>`;
        const progresso = CentralOperacoes.calcularProgresso(item.lote);
        const previsao = CentralOperacoes.previsaoLote(item.lote);
        return `<article class="mobilePrinterCard" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')" role="button" tabindex="0"><span class="mobilePrinterImage"><img src="${esc(imagem)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span><div><header><strong>${esc(item.impressora.nome || item.lote.impressoraNome || "Impressora")}</strong><b>${item.lote.status === "pausada" ? "PAUSADA" : "IMPRIMINDO"}</b></header><p>${esc(item.ordem?.produtoNome || item.operacao?.produtoNome || item.operacao?.nome || "Produção em andamento")}</p>${progresso === null ? `<small>Progresso indisponível</small>` : `<div class="mobilePrinterProgress"><i><span data-progress-bar="${esc(item.lote.id)}" style="width:${Math.round(progresso)}%"></span></i><strong data-progress-value="${esc(item.lote.id)}">${Math.round(progresso)}%</strong></div>`}<small data-forecast="${esc(item.lote.id)}">${esc(previsao.texto)}</small></div></article>`;
    }

    function MobileProduction(contexto) {
        const impressoras = obterImpressorasMobile(contexto);
        const imprimindo = impressoras.filter(item => item.tipo === "ativa" && item.lote.status === "em_execucao").length;
        const livres = impressoras.filter(item => item.tipo === "livre").length;
        return `<section class="mobileOpsPanel mobileProductionNow"><header><div><span><i data-lucide="printer"></i> PRODUÇÃO AGORA</span><p><b>${imprimindo} imprimindo</b><i>•</i><strong>${livres} livre${livres === 1 ? "" : "s"}</strong></p></div><button type="button" onclick="CentralOperacoes.abrirRota('producao')">Ver fábrica <i data-lucide="arrow-right"></i></button></header>${impressoras.length ? `<div class="mobilePrintersRow">${impressoras.slice(0, 2).map(MobilePrinterCard).join("")}</div>` : `<div class="mobileProductionEmpty"><i data-lucide="printer"></i><span><strong>Nenhuma impressora ativa</strong><small>Cadastre uma máquina para começar.</small></span><button onclick="CentralOperacoes.abrirRota('impressoras')">Configurar</button></div>`}</section>`;
    }

    function MobileDaySummary(contexto) {
        const prontos = contexto.dados.pedidos.filter(pedido => pedido.statusPedido === "pronto").length;
        const alertas = contexto.prioridades.filter(item => item.pontuacao >= 80).length;
        const itens = [
            ["clock-3", contexto.resumo.pedidosAtrasados.length, "Atrasados", "danger", "pedidos"],
            ["circle-dollar-sign", moeda(contexto.resumo.receberHoje), "A receber hoje", "success", "financeiro"],
            ["hourglass", alertas, "Alertas", "warning", "home"],
            ["circle-check", prontos, "Prontos", "purple", "pedidos"]
        ];
        return `<section class="mobileOpsPanel mobileDaySummary"><header><span><i data-lucide="chart-no-axes-column-increasing"></i> RESUMO DO DIA</span></header><div>${itens.map(item => `<button class="tone-${item[3]}" onclick="CentralOperacoes.abrirRota('${item[4]}')"><i data-lucide="${item[0]}"></i><span><strong>${esc(item[1])}</strong><small>${item[2]}</small></span></button>`).join("")}</div></section>`;
    }

    function MobileQuickActions() {
        const itens = [
            ["circle-plus", "Novo pedido", "pedido", "purple"],
            ["package-plus", "Produzir estoque", "estoque", "green"],
            ["badge-dollar-sign", "Receber pagamento", "receber", "blue"],
            ["store", "Consignado", "consignado", "orange"]
        ];
        return `<section class="mobileOpsPanel mobileQuickActions"><header><span><i data-lucide="zap"></i> AÇÕES RÁPIDAS</span></header><div>${itens.map(item => `<button class="tone-${item[3]}" onclick="CentralOperacoesMobile.acaoRapida('${item[2]}')"><i data-lucide="${item[0]}"></i><strong>${item[1]}</strong></button>`).join("")}</div></section>`;
    }

    function renderMobile() {
        const content = document.getElementById("content");
        if (!content) return;
        const dados = CentralOperacoes._lerDados();
        const prioridades = CentralOperacoes.calcularPrioridades(dados);
        const contexto = { dados, prioridades };
        contexto.resumo = CentralOperacoes._calcularResumo(dados, prioridades);
        contextoMobile = contexto;
        content.innerHTML = `<main class="mobileOperations">${MobileGreeting(contexto)}${MobileNow(contexto)}${MobileProduction(contexto)}${MobileDaySummary(contexto)}${MobileQuickActions()}</main>`;
        window.lucide?.createIcons?.();
    }

    function render() {
        const mobile = isMobile();
        ultimoModoMobile = mobile;
        if (mobile) renderMobile(); else renderDesktop();
    }

    const api = {
        render,
        renderMobile,
        abrirPrioridade(indice) {
            const item = contextoMobile?.prioridades[indice];
            if (item) CentralOperacoes.abrirRota(item.rota);
        },
        ativarPrioridade(evento, indice) {
            if (["Enter", " "].includes(evento.key)) { evento.preventDefault(); this.abrirPrioridade(indice); }
        },
        atualizarCarrossel() {
            const carrossel = document.getElementById("mobilePriorityCarousel");
            if (!carrossel?.clientWidth) return;
            const indice = Math.round(carrossel.scrollLeft / (carrossel.clientWidth * .9));
            document.querySelectorAll("[data-mobile-dot]").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.mobileDot) === indice));
        },
        acaoRapida(tipo) {
            if (tipo === "pedido") {
                CentralOperacoes.abrirRota("pedidos");
                return setTimeout(() => window.abrirModalPedido?.(), 0);
            }
            if (tipo === "estoque") {
                CentralOperacoes.abrirRota("producao");
                return setTimeout(() => window.abrirProducaoEstoque?.(), 0);
            }
            CentralOperacoes.abrirRota(tipo === "receber" ? "financeiro" : "consignado");
        },
        componentes: { MobileGreeting, MobileNow, MobilePriorityCard, MobileProduction, MobilePrinterCard, MobileDaySummary, MobileQuickActions },
        _obterImpressoras: obterImpressorasMobile,
        _isMobile: isMobile
    };

    window.CentralOperacoesMobile = api;
    CentralOperacoes.render = render;
    window.renderDashboard = render;

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const mobile = isMobile();
            if (mobile !== ultimoModoMobile && document.querySelector(".operationsCenter,.mobileOperations")) render();
        }, 120);
    }, { passive:true });
})();
