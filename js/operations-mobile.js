(function () {
    "use strict";

    if (!window.CentralOperacoes) return;

    const renderDesktop = CentralOperacoes.render;
    const MOBILE_QUERY = "(max-width: 767px)";
    let contextoMobile = null;
    let ultimoModoMobile = null;
    let resizeTimer = null;
    let refreshTimer = null;
    let ultimoFingerprintDados = "";

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
        const total = contexto.totalPrioridades;
        return `<header class="mobileOpsGreeting"><h1>${esc(saudacao(contexto.dados.agora))} <span aria-hidden="true">👋</span></h1><p>${total ? `${total} ${total === 1 ? "prioridade precisa" : "prioridades precisam"} da sua atenção hoje.` : "Sua operação está em ordem agora."}</p></header>`;
    }

    function acaoPrioridade(item, dados) {
        if (item.entidadeTipo === "financeiro") return "Receber";
        if (item.entidadeTipo === "pedido") {
            const pedido = dados.pedidos.find(registro => String(registro.id) === String(item.entidadeId));
            if (pedido?.statusPedido === "pronto") return "Entregar";
            if (["aprovado", "em_producao"].includes(pedido?.statusPedido)) return pedido.statusPedido === "aprovado" ? "Produzir" : "Ver produção";
        }
        if (["filamentos", "estoque:filamentos"].includes(item.rota)) return "Resolver";
        if (item.rota === "consignado") return "Conferir";
        return item.acaoPrincipal || "Abrir";
    }

    function MobilePriorityCard(item, indice, dados) {
        const meta = prioridadeMeta(item, dados);
        const rotulo = indice === 0 ? "AGORA" : indice === 1 ? "PRÓXIMA" : `PRIORIDADE ${indice + 1}`;
        return `<article class="mobilePriorityCard priority-${esc(item.prioridade)}" data-mobile-priority="${indice}" role="button" tabindex="0" onclick="CentralOperacoesMobile.abrirPrioridade(${indice})" onkeydown="CentralOperacoesMobile.ativarPrioridade(event,${indice})"><header><div><span><i></i>${rotulo}</span>${item.badge ? `<b>${esc(item.badge)}</b>` : ""}</div><button type="button" aria-label="Mais ações desta prioridade" onclick="event.stopPropagation();CentralOperacoesMobile.abrirMenuPrioridade(${indice})"><i data-lucide="ellipsis"></i></button></header><div class="mobilePriorityBody"><span class="mobilePriorityIcon"><i data-lucide="${esc(item.icone || "circle-alert")}"></i></span><div><h2>${esc(item.titulo)}</h2><p>${esc(item.descricao)}</p>${meta.linhas.length ? `<div class="mobilePriorityMeta">${meta.linhas.slice(0, 3).map((linha, posicao) => `<span><i data-lucide="${posicao === meta.linhas.length - 1 && /R\$/.test(linha) ? "hand-coins" : "box"}"></i>${esc(linha)}</span>`).join("")}</div>` : ""}</div></div><button class="mobilePriorityAction" type="button" onclick="event.stopPropagation();CentralOperacoesMobile.abrirPrioridade(${indice})">${esc(acaoPrioridade(item, dados))} <i data-lucide="arrow-right"></i></button></article>`;
    }

    function MobileNow(contexto) {
        if (!contexto.prioridades.length) return `<section class="mobileNowEmpty"><span><i data-lucide="circle-check-big"></i></span><div><strong>Tudo em ordem agora</strong><p>Nenhuma ação urgente precisa da sua atenção.</p></div></section>`;
        return `<section class="mobileNow" aria-label="Prioridades do momento"><div class="mobilePriorityCarousel" id="mobilePriorityCarousel" tabindex="0" onscroll="CentralOperacoesMobile.atualizarCarrossel()">${contexto.prioridades.map((item, indice) => MobilePriorityCard(item, indice, contexto.dados)).join("")}</div>${contexto.prioridades.length > 1 ? `<div class="mobileCarouselDots">${contexto.prioridades.map((_, indice) => `<i class="${indice === 0 ? "active" : ""}" data-mobile-dot="${indice}"></i>`).join("")}</div>` : ""}</section>`;
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
        if (item.tipo === "livre") return `<article class="mobilePrinterCard is-free" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')" role="button" tabindex="0"><span class="mobilePrinterImage"><img src="${esc(imagem)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span><div><header><strong>${esc(item.impressora.nome || "Impressora")}</strong><b>LIVRE</b></header><p>Pronta para iniciar</p><span class="mobilePrinterLink">Ver fábrica <i data-lucide="chevron-right"></i></span></div></article>`;
        const progresso = CentralOperacoes.calcularProgresso(item.lote);
        const previsao = CentralOperacoes.previsaoLote(item.lote);
        return `<article class="mobilePrinterCard" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')" role="button" tabindex="0"><span class="mobilePrinterImage"><img src="${esc(imagem)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span><div><header><strong>${esc(item.impressora.nome || item.lote.impressoraNome || "Impressora")}</strong><b>${item.lote.status === "pausada" ? "PAUSADA" : "IMPRIMINDO"}</b></header><p>${esc(item.ordem?.produtoNome || item.operacao?.produtoNome || item.operacao?.nome || "Produção em andamento")}</p>${progresso === null ? `<small>Progresso indisponível</small>` : `<div class="mobilePrinterProgress"><i><span data-progress-bar="${esc(item.lote.id)}" style="width:${Math.round(progresso)}%"></span></i><strong data-progress-value="${esc(item.lote.id)}">${Math.round(progresso)}%</strong></div>`}<footer><small data-forecast="${esc(item.lote.id)}">${esc(previsao.texto)}</small><span class="mobilePrinterLink">Ver fábrica <i data-lucide="chevron-right"></i></span></footer></div></article>`;
    }

    function MobileProduction(contexto) {
        const impressoras = obterImpressorasMobile(contexto);
        const imprimindo = impressoras.filter(item => item.tipo === "ativa" && item.lote.status === "em_execucao").length;
        const livres = impressoras.filter(item => item.tipo === "livre").length;
        return `<section class="mobileOpsPanel mobileProductionNow"><header><div><span><i data-lucide="printer"></i> PRODUÇÃO AGORA</span><p><b>${imprimindo} imprimindo</b><i>•</i><strong>${livres} livre${livres === 1 ? "" : "s"}</strong></p></div></header>${impressoras.length ? `<div class="mobilePrintersRow">${impressoras.slice(0, 1).map(MobilePrinterCard).join("")}</div>` : `<div class="mobileProductionEmpty"><i data-lucide="printer"></i><span><strong>Nenhuma impressora cadastrada</strong><small>Configure uma máquina para acompanhar a produção.</small></span><button onclick="CentralOperacoesMobile.configurarImpressoras()">Configurar</button></div>`}</section>`;
    }

    function MobileDaySummary(contexto) {
        const prontos = contexto.dados.pedidos.filter(pedido => pedido.statusPedido === "pronto").length;
        const alertas = contexto.prioridades.filter(item => item.pontuacao >= 80).length;
        const itens = [
            ["clock-3", contexto.resumo.pedidosAtrasados.length, "Atrasados", "danger", "atrasados"],
            ["circle-dollar-sign", moeda(contexto.resumo.receberHoje), "A receber hoje", "success", "receber"],
            ["hourglass", alertas, "Alertas", "warning", "alertas"],
            ["circle-check", prontos, prontos === 1 ? "Pedido pronto" : "Pedidos prontos", "purple", "prontos"]
        ];
        return `<section class="mobileOpsPanel mobileDaySummary"><header><span><i data-lucide="chart-no-axes-column-increasing"></i> RESUMO DO DIA</span></header><div>${itens.map(item => `<button class="tone-${item[3]}" onclick="CentralOperacoesMobile.abrirResumo('${item[4]}')" aria-label="${esc(item[2])}: ${esc(item[1])}"><span class="mobileSummaryIcon"><i data-lucide="${item[0]}"></i></span><span><strong>${esc(item[1])}</strong><small>${item[2]}</small></span><i data-lucide="chevron-right"></i></button>`).join("")}</div></section>`;
    }

    function getMobileOperationsData() {
        const dados = CentralOperacoes._lerDados();
        const todasPrioridades = CentralOperacoes.calcularPrioridades(dados);
        const resumo = CentralOperacoes._calcularResumo(dados, todasPrioridades);
        const contexto = { dados, resumo, totalPrioridades:todasPrioridades.length, prioridades:todasPrioridades.slice(0, 5) };
        const impressoras = obterImpressorasMobile(contexto);
        contexto.producaoResumo = {
            imprimindo: impressoras.filter(item => item.tipo === "ativa" && item.lote.status === "em_execucao").length,
            livres: impressoras.filter(item => item.tipo === "livre").length,
            destaque: impressoras[0] || null
        };
        contexto.impressorasDestaque = impressoras.slice(0, 1);
        contexto.resumoDia = { atrasados:resumo.pedidosAtrasados.length, receberHoje:resumo.receberHoje, alertas:todasPrioridades.filter(item => item.pontuacao >= 80).length, prontos:dados.pedidos.filter(item => item.statusPedido === "pronto").length };
        return contexto;
    }

    function obterFingerprintDados() {
        const metodos = [
            "listarPedidos", "listarLancamentosFinanceiros", "listarFilamentos",
            "listarImpressoras", "listarLotesExecucao", "listarOperacoesProducao",
            "listarOrdensProducao", "listarClientes", "listarLojas",
            "listarEstoquesLojas", "listarConferencias"
        ];
        return JSON.stringify(metodos.map(nome => {
            try {
                const metodo = window.Storage?.[nome];
                return typeof metodo === "function" ? metodo.call(window.Storage) : [];
            } catch (_) {
                return [];
            }
        }));
    }

    function renderMobile() {
        const content = document.getElementById("content");
        if (!content) return;
        try {
            const contexto = getMobileOperationsData();
            contextoMobile = contexto;
            content.innerHTML = `<main class="mobileOperations">${MobileGreeting(contexto)}${MobileNow(contexto)}${MobileProduction(contexto)}${MobileDaySummary(contexto)}</main>`;
            ultimoFingerprintDados = obterFingerprintDados();
            window.lucide?.createIcons?.();
        } catch (erro) {
            console.error("[PrimeDocs] Central de Operações mobile:", erro);
            content.innerHTML = `<main class="mobileOperations"><section class="mobileOperationsError"><i data-lucide="triangle-alert"></i><h1>Não foi possível carregar as operações.</h1><button type="button" onclick="CentralOperacoesMobile.renderMobile()">Atualizar</button></section></main>`;
            window.lucide?.createIcons?.();
        }
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
        abrirMenuPrioridade(indice) {
            const item = contextoMobile?.prioridades[indice];
            if (!item || !window.Modal) return;
            Modal.abrir("Ação operacional", `<div class="compactActionMenu"><button onclick="Modal.fechar();CentralOperacoesMobile.abrirPrioridade(${indice})"><i data-lucide="arrow-up-right"></i><span><strong>${esc(acaoPrioridade(item, contextoMobile.dados))}</strong><small>${esc(item.titulo)}</small></span></button></div>`);
            window.lucide?.createIcons?.();
        },
        abrirResumo(tipo) {
            if (tipo === "alertas") return window.abrirCentralNotificacoes?.();
            if (tipo === "atrasados") {
                try { filtrosPedidos = { status:"", pagamento:"", cliente:"", periodo:"", atraso:true, producao:false, prontos:false }; } catch (_) {}
                return CentralOperacoes.abrirRota("pedidos");
            }
            if (tipo === "prontos") {
                try { filtrosPedidos = { status:"", pagamento:"", cliente:"", periodo:"", atraso:false, producao:false, prontos:true }; } catch (_) {}
                return CentralOperacoes.abrirRota("pedidos");
            }
            try { filtrosFinanceiro = { termo:"", status:"", origem:"", cliente:"", periodo:"hoje", inicio:"", fim:"" }; } catch (_) {}
            return CentralOperacoes.abrirRota("financeiro");
        },
        configurarImpressoras() {
            window.destacarImpressorasConfiguracoes = true;
            CentralOperacoes.abrirRota("configuracoes");
        },
        componentes: { MobileOperationsPage:renderMobile, MobileOperationsGreeting:MobileGreeting, MobilePriorityCarousel:MobileNow, MobilePriorityCard, MobileProductionSummary:MobileProduction, MobilePrinterSummaryCard:MobilePrinterCard, MobileDailySummaryGrid:MobileDaySummary, MobileOperationsEmptyState:MobileNow },
        getMobileOperationsData,
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

    function atualizarAposDados() {
        const fingerprint = obterFingerprintDados();
        if (fingerprint === ultimoFingerprintDados) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            if (!isMobile() || !document.querySelector(".mobileOperations")) return;
            if (obterFingerprintDados() !== ultimoFingerprintDados) renderMobile();
        }, 240);
    }
    window.addEventListener("primedocs:sync-status", evento => {
        if (evento.detail?.estado === "sincronizado") atualizarAposDados();
    });
    window.addEventListener("online", atualizarAposDados);
    window.addEventListener("storage", atualizarAposDados);
})();
