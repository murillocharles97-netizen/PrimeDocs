(function () {
    "use strict";

    if (!window.PedidosPremium) return;

    const renderDesktop = PedidosPremium._renderDesktop || PedidosPremium.render;
    const MOBILE_QUERY = "(max-width: 767px)";
    const STATUS_CHIPS = [
        ["todos", "Todos"],
        ["aprovacao", "Aprovação"],
        ["producao", "Produção"],
        ["pronto", "Pronto"],
        ["entregue", "Entrega"],
        ["cancelado", "Cancelado"]
    ];
    const estado = {
        busca: "", status: "todos", cliente: "", pagamento: "", prioridade: "",
        ordenacao: "prazo", expandidos: new Set()
    };
    let contexto = null;
    let ultimoModoMobile = null;
    let resizeTimer = null;
    let ignorarCliqueAte = 0;
    let transacaoPendente = null;
    let snackbarTimer = null;
    let destaqueTimer = null;
    const pedidosEmTransicao = new Set();

    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const numero = valor => Number(valor) || 0;
    const chave = valor => String(valor ?? "");
    const normalizar = valor => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;
    const moeda = valor => Utils.moeda(numero(valor));
    const dataBR = valor => valor ? formatarDataBR(String(valor).slice(0, 10)) : "Sem prazo";
    const plural = (valor, singular, pluralTexto) => `${valor} ${valor === 1 ? singular : pluralTexto}`;

    function pertenceStatus(pedido, status) {
        if (status === "todos") return pedido.statusPedido !== "cancelado";
        if (status === "aprovacao") return pedido.coluna === "aguardando" && ["aguardando_orcamento", "aguardando_aceite"].includes(pedido.statusPedido);
        if (status === "producao") return pedido.statusPedido === "aprovado" || ["producao", "acabamento"].includes(pedido.coluna);
        if (status === "pronto") return pedido.coluna === "pronto";
        if (status === "entregue") return pedido.coluna === "entregue";
        if (status === "cancelado") return pedido.statusPedido === "cancelado";
        return true;
    }

    function filtrarPedidos() {
        if (!contexto) return [];
        const busca = normalizar(estado.busca);
        const lista = contexto.enriquecidos.filter(pedido => {
            const texto = normalizar([pedido.id, pedido.clienteNome, ...(pedido.itens || []).map(item => item.nome)].join(" "));
            return pertenceStatus(pedido, estado.status)
                && (!busca || texto.includes(busca))
                && (!estado.cliente || chave(pedido.clienteId) === chave(estado.cliente))
                && (!estado.pagamento || pedido.pagamento === estado.pagamento)
                && (!estado.prioridade || pedido.prioridade === estado.prioridade);
        });
        const ordenacoes = {
            prazo: (a, b) => String(a.dataEntregaPrevista || "9999").localeCompare(String(b.dataEntregaPrevista || "9999")),
            recentes: (a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0),
            maior_valor: (a, b) => numero(b.valorTotal) - numero(a.valorTotal),
            cliente: (a, b) => String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""), "pt-BR")
        };
        return lista.sort(ordenacoes[estado.ordenacao] || ordenacoes.prazo);
    }

    function iniciais(nome) {
        const partes = String(nome || "Cliente").trim().split(/\s+/).filter(Boolean);
        return ((partes[0]?.[0] || "C") + (partes.length > 1 ? partes.at(-1)[0] : "")).toLocaleUpperCase("pt-BR");
    }

    function statusVisual(pedido) {
        if (pedido.statusPedido === "cancelado") return ["Cancelado", "cancelado"];
        if (pedido.coluna === "producao") return ["Em produção", "producao"];
        if (pedido.coluna === "acabamento") return ["Acabamento", "acabamento"];
        if (pedido.coluna === "pronto") return ["Pronto para entrega", "pronto"];
        if (pedido.coluna === "entregue") return ["Entregue", "entregue"];
        if (pedido.statusPedido === "aprovado") return ["Aprovado", "aprovado"];
        return ["Aguardando aprovação", "aprovacao"];
    }

    function pagamentoVisual(pedido) {
        return {
            pago: ["Pago", "pago"], parcial: ["Parcial", "parcial"], pendente: ["Pendente", "pendente"]
        }[pedido.pagamento] || ["Pendente", "pendente"];
    }

    function prazoVisual(pedido) {
        if (pedido.coluna === "entregue") return `Entregue em ${dataBR(pedido.atualizadoEm || pedido.dataEntregaPrevista)}`;
        return {
            atrasado: `Atrasado · ${dataBR(pedido.dataEntregaPrevista)}`,
            hoje: "Entrega hoje",
            amanha: "Entrega amanhã",
            semana: `Prazo ${dataBR(pedido.dataEntregaPrevista)}`,
            normal: `Prazo ${dataBR(pedido.dataEntregaPrevista)}`
        }[pedido.prioridade] || `Prazo ${dataBR(pedido.dataEntregaPrevista)}`;
    }

    function acaoPrincipal(pedido) {
        if (["aguardando_orcamento", "aguardando_aceite"].includes(pedido.statusPedido)) return { tipo: "aprovar", rotulo: "Aprovar", icone: "circle-check" };
        if (pedido.coluna === "producao") return { tipo: "producao", rotulo: "Ver produção", icone: "factory" };
        if (pedido.statusPedido === "aprovado") return { tipo: "produzir", rotulo: "Produzir", icone: "play" };
        if (pedido.coluna === "acabamento") return { tipo: "acabamento", rotulo: pedido.acabamento?.status === "em_execucao" ? "Abrir acabamento" : "Finalizar", icone: "wand-sparkles" };
        if (pedido.coluna === "pronto") return { tipo: "entregar", rotulo: "Entregar", icone: "truck" };
        if (pedido.coluna === "entregue" && pedido.pagamento !== "pago") return { tipo: "receber", rotulo: "Receber", icone: "hand-coins" };
        if (pedido.statusPedido === "cancelado") return { tipo: "reativar", rotulo: "Reativar", icone: "rotate-ccw" };
        return { tipo: "detalhes", rotulo: "Ver detalhes", icone: "eye" };
    }

    function acaoProgressao(pedido) {
        if (["aguardando_orcamento", "aguardando_aceite"].includes(pedido.statusPedido)) {
            return { status: "aprovado", aba: "producao", rotulo: "Aprovar pedido", destino: "Produção", icone: "circle-check", tom: "aprovacao" };
        }
        if (["producao", "acabamento"].includes(pedido.coluna) || pedido.statusPedido === "em_producao") {
            return { status: "pronto", aba: "pronto", rotulo: "Marcar como pronto", destino: "Pronto", icone: "package-check", tom: "producao" };
        }
        if (pedido.coluna === "pronto" || pedido.statusPedido === "pronto") {
            return { status: "entregue", aba: "entregue", rotulo: "Marcar como entregue", destino: "Entregue", icone: "truck", tom: "pronto" };
        }
        return null;
    }

    function renderResumo() {
        const validos = contexto.enriquecidos.filter(p => p.statusPedido !== "cancelado");
        const hoje = contexto.hoje;
        const criadosHoje = validos.filter(p => String(p.dataPedido || p.criadoEm || "").slice(0, 10) === hoje).length;
        const producao = validos.filter(p => ["producao", "acabamento"].includes(p.coluna)).length;
        const atrasados = validos.filter(p => p.prioridade === "atrasado" && p.coluna !== "entregue").length;
        const receita = validos.filter(p => p.coluna !== "entregue").reduce((total, p) => total + numero(p.valorTotal), 0);
        const itens = [
            ["calendar-days", "Hoje", plural(criadosHoje, "pedido", "pedidos"), "purple"],
            ["factory", "Em produção", plural(producao, "pedido", "pedidos"), "blue"],
            ["clock-alert", "Atrasados", plural(atrasados, "pedido", "pedidos"), "red"],
            ["circle-dollar-sign", "Receita prevista", moeda(receita), "green"]
        ];
        return `<section class="mobileOrdersSummary" aria-label="Resumo operacional">${itens.map(item => `<div class="tone-${item[3]}"><span><i data-lucide="${item[0]}"></i></span><div><small>${item[1]}</small><strong>${item[2]}</strong></div></div>`).join("")}</section>`;
    }

    function contagemStatus(status) {
        return contexto.enriquecidos.filter(pedido => pertenceStatus(pedido, status)).length;
    }

    function renderChips() {
        return `<div class="mobileOrderStatusChips" role="tablist" aria-label="Etapas dos pedidos">${STATUS_CHIPS.map(([valor, rotulo]) => `<button role="tab" aria-selected="${estado.status === valor}" class="${estado.status === valor ? "active" : ""}" data-mobile-order-chip="${valor}" onclick="PedidosMobile.definirStatus('${valor}')">${rotulo}<b>${contagemStatus(valor)}</b></button>`).join("")}</div>`;
    }

    function qtdFiltrosExtras() {
        return [estado.pagamento, estado.prioridade, estado.ordenacao !== "prazo"].filter(Boolean).length;
    }

    function renderControles() {
        const clientes = [...contexto.clientes].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        return `<section class="mobileOrdersControls">
            <label class="mobileOrdersSearch"><i data-lucide="search"></i><input type="search" aria-label="Buscar pedidos" placeholder="Buscar cliente, pedido ou número..." value="${esc(estado.busca)}" oninput="PedidosMobile.pesquisar(this.value)"></label>
            <div class="mobileOrdersFilters">
                <label><span>Status</span><select aria-label="Status" onchange="PedidosMobile.definirStatus(this.value)">${STATUS_CHIPS.map(([valor, rotulo]) => `<option value="${valor}" ${estado.status === valor ? "selected" : ""}>${rotulo}</option>`).join("")}</select></label>
                <label><span>Cliente</span><select aria-label="Cliente" onchange="PedidosMobile.definirCliente(this.value)"><option value="">Todos</option>${clientes.map(cliente => `<option value="${esc(cliente.id)}" ${chave(cliente.id) === chave(estado.cliente) ? "selected" : ""}>${esc(cliente.nome)}</option>`).join("")}</select></label>
                <button class="mobileOrdersMoreFilters" type="button" onclick="PedidosMobile.abrirFiltros()"><i data-lucide="sliders-horizontal"></i><span>Filtros${qtdFiltrosExtras() ? ` (${qtdFiltrosExtras()})` : ""}</span></button>
            </div>
            ${renderChips()}
        </section>`;
    }

    function arquivosStl(pedido) {
        const todos = [...(pedido.arquivos || []), ...(pedido.itens || []).flatMap(item => item.arquivos || item.anexos || [])];
        return todos.filter(arquivo => /\.stl$/i.test(typeof arquivo === "string" ? arquivo : arquivo?.nome || arquivo?.url || ""));
    }

    function renderExpandido(pedido) {
        if (!estado.expandidos.has(chave(pedido.id))) return "";
        const itens = pedido.itens || [];
        const eventos = [...(pedido.timeline || [])].sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0)).slice(0, 3);
        const stls = arquivosStl(pedido);
        return `<section class="mobileOrderExpanded" aria-label="Detalhes do pedido">
            <div class="mobileOrderExpandedGrid">
                <div><small>Cliente</small><strong>${esc(pedido.clienteNome || "Não informado")}</strong><span>${esc(pedido.clienteWhatsapp || "WhatsApp não informado")}</span></div>
                <div><small>Tempo estimado</small><strong>${pedido.minutosRestantes ? formatarMinutosProducao(pedido.minutosRestantes) : "Não informado"}</strong><span>${pedido.impressoras?.length ? esc(pedido.impressoras.join(" · ")) : "Sem impressora ativa"}</span></div>
                <div><small>Pagamento</small><strong>${esc(pagamentoVisual(pedido)[0])}</strong><span>${moeda(pedido.valorPendente || 0)} pendentes</span></div>
                <div><small>Arquivos STL</small><strong>${plural(stls.length, "arquivo", "arquivos")}</strong><span>${stls.length ? esc(stls.slice(0, 2).map(a => typeof a === "string" ? a.split(/[\\/]/).pop() : a.nome).join(" · ")) : "Nenhum arquivo anexado"}</span></div>
            </div>
            <div class="mobileOrderItems"><small>PRODUTOS</small>${itens.map(item => `<div><span>${esc(item.nome || "Produto")}</span><strong>${numero(item.quantidade)}× ${moeda(item.valorUnitario)}</strong></div>`).join("") || `<p>Nenhum produto informado.</p>`}</div>
            ${pedido.observacoes ? `<div class="mobileOrderNotes"><small>OBSERVAÇÕES</small><p>${esc(pedido.observacoes)}</p></div>` : ""}
            <div class="mobileOrderHistory"><small>HISTÓRICO RECENTE</small>${eventos.map(evento => `<div><i></i><span><strong>${esc(evento.titulo || "Movimentação")}</strong><small>${dataBR(evento.criadoEm)}</small></span></div>`).join("") || `<p>Nenhuma movimentação registrada.</p>`}</div>
            <footer><button type="button" onclick="event.stopPropagation();abrirItensPedido('${esc(pedido.id)}')"><i data-lucide="boxes"></i> Ver itens</button><button type="button" onclick="event.stopPropagation();abrirTimelinePedido('${esc(pedido.id)}')"><i data-lucide="history"></i> Histórico</button></footer>
        </section>`;
    }

    function renderCard(pedido) {
        const [status, statusClasse] = statusVisual(pedido);
        const [pagamento, pagamentoClasse] = pagamentoVisual(pedido);
        const acao = acaoPrincipal(pedido);
        const progressao = acaoProgressao(pedido);
        const progresso = Math.min(100, Math.max(0, numero(pedido.progresso)));
        const expandido = estado.expandidos.has(chave(pedido.id));
        return `<div class="mobileOrderSwipe priority-${esc(pedido.prioridade)} status-${statusClasse} ${progressao ? `progress-to-${progressao.tom}` : "no-progress-action"}" data-mobile-order-swipe="${esc(pedido.id)}" data-has-progress-action="${Boolean(progressao)}">
            ${progressao ? `<div class="mobileOrderSwipeAction swipe-primary"><i data-lucide="${progressao.icone}"></i><span>${esc(progressao.rotulo)}</span></div>` : ""}
            <div class="mobileOrderSwipeAction swipe-secondary"><i data-lucide="ellipsis"></i><span>Mais</span></div>
            <article class="mobileOrderCard ${expandido ? "isExpanded" : ""}" data-mobile-order-card="${esc(pedido.id)}" onclick="PedidosMobile.alternarDetalhes(event,'${esc(pedido.id)}')">
                <span class="mobileOrderAvatar">${esc(iniciais(pedido.clienteNome))}</span>
                <div class="mobileOrderMain">
                    <header><div><h2>${esc(pedido.clienteNome || "Cliente não informado")}</h2><p>#${esc(String(pedido.id).slice(-5))} · ${dataBR(pedido.dataPedido)} · <b>${esc(prazoVisual(pedido))}</b></p></div><button type="button" aria-label="Mais ações" onclick="event.stopPropagation();abrirMenuPedido('${esc(pedido.id)}')"><i data-lucide="ellipsis-vertical"></i></button></header>
                    <div class="mobileOrderBadges"><span class="status-${statusClasse}">${esc(status)}</span><span class="payment-${pagamentoClasse}">${esc(pagamento)}</span></div>
                    ${["producao", "acabamento"].includes(pedido.coluna) ? `<div class="mobileOrderProgress"><span><b>${esc(status)}</b><strong>${progresso}%</strong></span><i><b style="width:${progresso}%"></b></i></div>` : ""}
                    <div class="mobileOrderMeta"><span><i data-lucide="boxes"></i>${plural(pedido.tipos, "produto", "produtos")}</span><span><i data-lucide="package"></i>${plural(pedido.pecas, "peça", "peças")}</span></div>
                    <footer><strong>${moeda(pedido.valorTotal)}</strong><button class="mobileOrderPrimary" type="button" onclick="event.stopPropagation();PedidosMobile.executarPrimaria('${esc(pedido.id)}')"><i data-lucide="${acao.icone}"></i>${esc(acao.rotulo)}</button></footer>
                    ${renderExpandido(pedido)}
                </div>
            </article>
        </div>`;
    }

    function renderLista() {
        const lista = filtrarPedidos();
        const destino = document.getElementById("mobileOrdersList");
        const contador = document.getElementById("mobileOrdersCount");
        if (!destino) return;
        destino.innerHTML = lista.length ? lista.map(renderCard).join("") : `<div class="mobileOrdersEmpty"><i data-lucide="package-search"></i><strong>Nenhum pedido encontrado</strong><p>Ajuste os filtros ou crie um novo pedido.</p><button onclick="abrirModalPedido()"><i data-lucide="plus"></i>Novo pedido</button></div>`;
        if (contador) contador.textContent = plural(lista.length, "pedido", "pedidos");
        document.querySelectorAll("[data-mobile-order-chip]").forEach(chip => {
            const ativo = chip.dataset.mobileOrderChip === estado.status;
            chip.classList.toggle("active", ativo);
            chip.setAttribute("aria-selected", String(ativo));
        });
        const selectStatus = document.querySelector('.mobileOrdersFilters select[aria-label="Status"]');
        const selectCliente = document.querySelector('.mobileOrdersFilters select[aria-label="Cliente"]');
        if (selectStatus) selectStatus.value = estado.status;
        if (selectCliente) selectCliente.value = estado.cliente;
        const filtroBotao = document.querySelector(".mobileOrdersMoreFilters span");
        if (filtroBotao) filtroBotao.textContent = `Filtros${qtdFiltrosExtras() ? ` (${qtdFiltrosExtras()})` : ""}`;
        window.lucide?.createIcons?.();
        ativarGestos();
    }

    function renderMobile() {
        const content = document.getElementById("content");
        if (!content) return;
        contexto = PedidosPremium._criarContexto();
        document.body.classList.add("ordersMobileActive");
        renderNavegacaoInferiorPrimeDocs?.("pedidos");
        content.innerHTML = `<main class="ordersMobilePage">
            <header class="mobileOrdersHeading"><span><i data-lucide="package"></i></span><div><h1>Pedidos</h1><p>Gerencie seus pedidos.</p></div></header>
            ${renderResumo()}
            ${renderControles()}
            <div class="mobileOrdersListHeading"><strong>Pedidos</strong><span id="mobileOrdersCount"></span></div>
            <section class="mobileOrdersList" id="mobileOrdersList"></section>
        </main>`;
        renderLista();
    }

    function render() {
        const mobile = isMobile();
        ultimoModoMobile = mobile;
        if (mobile) return renderMobile();
        document.body.classList.remove("ordersMobileActive");
        return renderDesktop();
    }

    function obterPedido(id) {
        return contexto?.enriquecidos.find(pedido => chave(pedido.id) === chave(id));
    }

    function executarAcao(pedido, acao) {
        if (!pedido) return;
        const id = pedido.id;
        if (acao.tipo === "aprovar") return solicitarStatusPedido(id, "aprovado");
        if (acao.tipo === "produzir") return abrirPreviaProducaoPedido(id);
        if (acao.tipo === "producao") return navegar("producao", { pedidoId: id });
        if (acao.tipo === "acabamento") return PedidosPremium.abrirAcabamento(id);
        if (acao.tipo === "entregar") return solicitarStatusPedido(id, "entregue");
        if (acao.tipo === "reativar") return solicitarStatusPedido(id, "aprovado");
        if (acao.tipo === "receber") {
            Financeiro.sincronizar();
            const lancamento = Storage.listarLancamentosFinanceiros().find(item => item.origem === "pedido" && chave(item.origemId) === chave(id));
            if (lancamento && typeof abrirRecebimentoFinanceiro === "function") return abrirRecebimentoFinanceiro(lancamento.id);
            return navegar("financeiro");
        }
        estado.expandidos.add(chave(id));
        renderLista();
    }

    function clonarPedido(pedido) {
        if (typeof structuredClone === "function") return structuredClone(pedido);
        return JSON.parse(JSON.stringify(pedido));
    }

    function removerSnackbar() {
        clearTimeout(snackbarTimer);
        snackbarTimer = null;
        document.getElementById("mobileOrderUndoSnackbar")?.remove();
    }

    function exibirSnackbar(mensagem) {
        removerSnackbar();
        if (!document.body?.insertAdjacentHTML) return;
        document.body.insertAdjacentHTML("beforeend", `<aside class="mobileOrderUndoSnackbar" id="mobileOrderUndoSnackbar" role="status" aria-live="polite"><span>${esc(mensagem)}</span><button type="button" onclick="PedidosMobile.desfazerProgressao()">DESFAZER</button></aside>`);
        (window.requestAnimationFrame || (callback => setTimeout(callback, 0)))(() => document.getElementById("mobileOrderUndoSnackbar")?.classList.add("is-visible"));
        snackbarTimer = setTimeout(() => {
            transacaoPendente = null;
            removerSnackbar();
        }, 5000);
    }

    function destacarPedido(id) {
        clearTimeout(destaqueTimer);
        (window.requestAnimationFrame || (callback => setTimeout(callback, 0)))(() => {
            const seletorId = window.CSS?.escape ? window.CSS.escape(String(id)) : String(id).replace(/["\\]/g, "\\$&");
            const card = document.querySelector(`[data-mobile-order-swipe="${seletorId}"]`);
            if (!card) return;
            card.classList.add("is-recently-moved");
            destaqueTimer = setTimeout(() => card.classList.remove("is-recently-moved"), 2000);
        });
    }

    function atualizarAposProgressao(id, aba) {
        estado.status = aba;
        estado.expandidos.delete(chave(id));
        renderMobile();
        destacarPedido(id);
    }

    function registrarMudancaRapida(pedido, statusAnterior, statusNovo) {
        pedido = ERPIntegracao.alterarStatusPedido(pedido.id, statusNovo);
        if (typeof registrarEventoPedido === "function") {
            const tipo = statusNovo === "entregue" ? "pedido_entregue" : statusNovo === "pronto" ? "pedido_pronto" : statusNovo === "aprovado" ? "orcamento_aprovado" : "status_alterado";
            const titulo = typeof rotuloStatusPedido === "function" ? rotuloStatusPedido(statusNovo) : statusNovo;
            const anterior = typeof rotuloStatusPedido === "function" ? rotuloStatusPedido(statusAnterior) : statusAnterior;
            registrarEventoPedido(pedido, tipo, titulo, `Status alterado de ${anterior} para ${titulo}.`);
        }
        Storage.salvarPedido(pedido);
        return pedido;
    }

    function avancarStatus(id) {
        const key = chave(id);
        if (pedidosEmTransicao.has(key)) return false;
        const enriquecido = obterPedido(id);
        const progressao = acaoProgressao(enriquecido || {});
        const atual = Storage.buscarPedidoPorId?.(id);
        if (!progressao || !atual || atual.statusPedido === progressao.status) return false;

        pedidosEmTransicao.add(key);
        try {
            removerSnackbar();
            const anterior = clonarPedido(atual);
            const abaAnterior = estado.status;
            const atualizado = clonarPedido(atual);
            registrarMudancaRapida(atualizado, anterior.statusPedido, progressao.status);
            transacaoPendente = { id, anterior, abaAnterior, destino: progressao.destino };
            window.navigator?.vibrate?.(18);
            atualizarAposProgressao(id, progressao.aba);
            exibirSnackbar(`Pedido movido para ${progressao.destino}.`);
            return true;
        } catch (erro) {
            console.error("Erro ao avançar pedido pelo gesto", erro);
            Toast?.show?.(erro?.message || "Não foi possível atualizar o pedido.");
            return false;
        } finally {
            setTimeout(() => pedidosEmTransicao.delete(key), 450);
        }
    }

    function desfazerProgressao() {
        if (!transacaoPendente) return false;
        const transacao = transacaoPendente;
        transacaoPendente = null;
        removerSnackbar();
        try {
            Storage.salvarPedido(clonarPedido(transacao.anterior));
            Financeiro?.sincronizar?.();
            if (typeof gerarNotificacoesOperacionais === "function") gerarNotificacoesOperacionais();
            estado.status = transacao.abaAnterior;
            renderMobile();
            destacarPedido(transacao.id);
            return true;
        } catch (erro) {
            console.error("Erro ao desfazer avanço do pedido", erro);
            Toast?.show?.(erro?.message || "Não foi possível desfazer a alteração.");
            return false;
        }
    }

    function ativarGestos() {
        document.querySelectorAll("[data-mobile-order-swipe]").forEach(wrapper => {
            if (wrapper.dataset.gestureReady) return;
            wrapper.dataset.gestureReady = "true";
            const card = wrapper.querySelector(".mobileOrderCard");
            const permiteAvanco = wrapper.dataset.hasProgressAction === "true";
            let inicioX = 0, inicioY = 0, deltaX = 0, horizontal = false;
            const resetar = () => {
                card.style.transition = "transform .2s ease";
                card.style.transform = "";
                wrapper.removeAttribute("data-swipe-direction");
                wrapper.style.removeProperty("--swipe-progress");
            };
            wrapper.addEventListener("pointerdown", evento => {
                if (evento.target.closest("button,select,input,a")) return;
                inicioX = evento.clientX; inicioY = evento.clientY; deltaX = 0; horizontal = false;
                card.style.transition = "none";
                try { wrapper.setPointerCapture(evento.pointerId); } catch (_) {}
            });
            wrapper.addEventListener("pointermove", evento => {
                if (!inicioX) return;
                const x = evento.clientX - inicioX;
                const y = evento.clientY - inicioY;
                if (!horizontal && Math.abs(x) > 9 && Math.abs(x) > Math.abs(y)) horizontal = true;
                if (!horizontal) return;
                evento.preventDefault();
                deltaX = Math.max(-96, Math.min(permiteAvanco ? 96 : 18, x));
                card.style.transform = `translateX(${deltaX}px)`;
                wrapper.dataset.swipeDirection = deltaX > 0 ? "right" : "left";
                wrapper.style.setProperty("--swipe-progress", String(Math.min(1, Math.abs(deltaX) / 68)));
            });
            const finalizar = () => {
                if (!inicioX) return;
                inicioX = 0;
                const executar = Math.abs(deltaX) >= 68;
                if (executar) ignorarCliqueAte = Date.now() + 400;
                const direita = deltaX > 0;
                resetar();
                if (executar) {
                    const id = wrapper.dataset.mobileOrderSwipe;
                    direita ? api.avancarStatus(id) : abrirMenuPedido(id);
                }
                deltaX = 0;
            };
            wrapper.addEventListener("pointerup", finalizar);
            wrapper.addEventListener("pointercancel", finalizar);
        });
    }

    const api = {
        render,
        renderMobile,
        pesquisar(valor) { estado.busca = valor; renderLista(); },
        definirStatus(valor) { estado.status = valor || "todos"; renderLista(); },
        definirCliente(valor) { estado.cliente = valor; renderLista(); },
        alternarDetalhes(evento, id) {
            if (Date.now() < ignorarCliqueAte || evento.target.closest("button,a,input,select")) return;
            const key = chave(id);
            estado.expandidos.has(key) ? estado.expandidos.delete(key) : estado.expandidos.add(key);
            renderLista();
        },
        executarPrimaria(id) { const pedido = obterPedido(id); executarAcao(pedido, acaoPrincipal(pedido || {})); },
        avancarStatus,
        desfazerProgressao,
        abrirFiltros() {
            Modal.abrir("Filtros de pedidos", `<div class="mobileOrderFilterSheet">
                <label class="inputGroup"><span>Pagamento</span><select id="mobileOrderPayment"><option value="">Todos</option><option value="pendente" ${estado.pagamento === "pendente" ? "selected" : ""}>Pendente</option><option value="parcial" ${estado.pagamento === "parcial" ? "selected" : ""}>Parcial</option><option value="pago" ${estado.pagamento === "pago" ? "selected" : ""}>Pago</option></select></label>
                <label class="inputGroup"><span>Prioridade</span><select id="mobileOrderPriority"><option value="">Todas</option><option value="atrasado" ${estado.prioridade === "atrasado" ? "selected" : ""}>Atrasados</option><option value="hoje" ${estado.prioridade === "hoje" ? "selected" : ""}>Entrega hoje</option><option value="amanha" ${estado.prioridade === "amanha" ? "selected" : ""}>Entrega amanhã</option><option value="semana" ${estado.prioridade === "semana" ? "selected" : ""}>Esta semana</option></select></label>
                <label class="inputGroup"><span>Ordenar</span><select id="mobileOrderSort"><option value="prazo" ${estado.ordenacao === "prazo" ? "selected" : ""}>Prazo</option><option value="recentes" ${estado.ordenacao === "recentes" ? "selected" : ""}>Mais recentes</option><option value="maior_valor" ${estado.ordenacao === "maior_valor" ? "selected" : ""}>Maior valor</option><option value="cliente" ${estado.ordenacao === "cliente" ? "selected" : ""}>Cliente A–Z</option></select></label>
            </div><div class="modalActions"><button class="btnSecondary" onclick="PedidosMobile.limparFiltrosExtras()">Limpar</button><button class="btn" onclick="PedidosMobile.aplicarFiltrosExtras()">Aplicar</button></div>`);
        },
        aplicarFiltrosExtras() {
            estado.pagamento = document.getElementById("mobileOrderPayment")?.value || "";
            estado.prioridade = document.getElementById("mobileOrderPriority")?.value || "";
            estado.ordenacao = document.getElementById("mobileOrderSort")?.value || "prazo";
            Modal.fechar(); renderLista();
        },
        limparFiltrosExtras() { estado.pagamento = ""; estado.prioridade = ""; estado.ordenacao = "prazo"; Modal.fechar(); renderLista(); },
        _estado: estado,
        _filtrar: filtrarPedidos,
        _acaoPrincipal: acaoPrincipal,
        _acaoProgressao: acaoProgressao
    };

    window.PedidosMobile = api;
    PedidosPremium.render = render;
    window.renderPedidos = render;

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const mobile = isMobile();
            if (mobile === ultimoModoMobile || !document.querySelector(".ordersMobilePage,.ordersPremiumPage")) return;
            render();
            renderNavegacaoInferiorPrimeDocs?.(mobile ? "pedidos" : "");
            atualizarNavegacaoAtivaPrimeDocs?.("pedidos");
        }, 140);
    }, { passive: true });
})();
