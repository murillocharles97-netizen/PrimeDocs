(function () {
    "use strict";

    const COLUNAS = [
        { id: "aguardando", titulo: "Aguardando aprovação", icone: "circle-dashed" },
        { id: "producao", titulo: "Em produção", icone: "printer" },
        { id: "acabamento", titulo: "Acabamento", icone: "wand-sparkles" },
        { id: "pronto", titulo: "Pronto", icone: "package-check" },
        { id: "entregue", titulo: "Entregue", icone: "badge-check" }
    ];
    const FINAL_LOTE = new Set(["concluido", "falhou", "cancelado"]);
    const FINAL_OPERACAO = new Set(["concluida", "cancelada"]);
    const estado = {
        busca: "", cliente: "", status: "", categoria: "", impressora: "", prioridade: "", pagamento: "",
        ordenacao: "prazo", atrasados: false,
        visualizacao: localStorage.getItem("primedocs_pedidos_visualizacao") || "kanban",
        colunaMobile: "aguardando", recolhidas: new Set(), limites: {}
    };
    let contexto = null;
    let renderizacao = 0;

    function esc(valor) {
        return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }
    function numero(valor) { return Number(valor) || 0; }
    function soma(lista, seletor) { return lista.reduce((total, item) => total + numero(seletor(item)), 0); }
    function formatarMinutos(minutos) {
        const total = Math.max(0, Math.round(numero(minutos)));
        if (!total) return "0 min";
        const horas = Math.floor(total / 60);
        const resto = total % 60;
        return horas ? `${horas}h${resto ? ` ${resto}min` : ""}` : `${resto} min`;
    }
    function dataCurta(data) { return data ? formatarDataBR(String(data).slice(0, 10)) : "Sem prazo"; }
    function inicioDoDia(data) { return new Date(`${String(data).slice(0, 10)}T00:00:00`).getTime(); }
    function diferencaDias(data, hoje) { return Math.round((inicioDoDia(data) - inicioDoDia(hoje)) / 86400000); }
    function chave(valor) { return String(valor ?? ""); }
    function normalizar(valor) { return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"); }

    function prioridadePedido(pedido, hoje) {
        if (!pedido.dataEntregaPrevista || ["entregue", "cancelado"].includes(pedido.statusPedido)) return "normal";
        const dias = diferencaDias(pedido.dataEntregaPrevista, hoje);
        if (dias < 0) return "atrasado";
        if (dias === 0) return "hoje";
        if (dias === 1) return "amanha";
        if (dias <= 7) return "semana";
        return "normal";
    }

    function criarContexto() {
        Producao.migrarDados();
        const pedidos = Storage.listarPedidos().filter(p => p.ativo !== false);
        const produtos = Storage.listarProdutos().filter(p => p.ativo !== false);
        const clientes = Storage.listarClientes().filter(c => c.ativo !== false);
        const ordens = Storage.listarOrdensProducao().filter(o => o.status !== "cancelada");
        const operacoes = Storage.listarOperacoesProducao().filter(o => o.status !== "cancelada");
        const lotes = Storage.listarLotesExecucao().filter(l => l.status !== "cancelado");
        const impressoras = Storage.listarImpressoras().filter(i => i.ativa !== false);
        const lancamentos = Financeiro.sincronizar();
        const produtosPorId = new Map(produtos.map(p => [chave(p.id), p]));
        const impressorasPorId = new Map(impressoras.map(i => [chave(i.id), i]));
        const ordensPorPedido = agrupar(ordens, "pedidoId");
        const operacoesPorOrdem = agrupar(operacoes, "ordemProducaoId");
        const lotesPorOrdem = agrupar(lotes, "ordemProducaoId");
        const hoje = Utils.hoje();

        const enriquecidos = pedidos.map(pedido => enriquecerPedido(
            pedido, hoje, produtosPorId, impressorasPorId,
            ordensPorPedido.get(chave(pedido.id)) || [], operacoesPorOrdem, lotesPorOrdem
        ));
        return { pedidos, enriquecidos, produtos, clientes, ordens, operacoes, lotes, impressoras, lancamentos, hoje };
    }

    function agrupar(lista, campo) {
        return lista.reduce((mapa, item) => {
            const id = chave(item[campo]);
            if (!mapa.has(id)) mapa.set(id, []);
            mapa.get(id).push(item);
            return mapa;
        }, new Map());
    }

    function enriquecerPedido(pedido, hoje, produtosPorId, impressorasPorId, ordens, operacoesPorOrdem, lotesPorOrdem) {
        const operacoes = ordens.flatMap(o => operacoesPorOrdem.get(chave(o.id)) || []);
        const lotes = ordens.flatMap(o => lotesPorOrdem.get(chave(o.id)) || []);
        const lotesAtivos = lotes.filter(l => !FINAL_LOTE.has(l.status));
        const acabamento = operacoes.find(op => op.tipo === "acabamento" && !FINAL_OPERACAO.has(op.status));
        const impressoesPendentes = operacoes.some(op => op.tipo === "impressao" && !FINAL_OPERACAO.has(op.status));
        const acabamentoLiberado = acabamento && (!impressoesPendentes || ["em_execucao", "pronta_para_iniciar", "aguardando"].includes(acabamento.status));
        let coluna = "aguardando";
        if (pedido.statusPedido === "entregue") coluna = "entregue";
        else if (pedido.statusPedido === "pronto") coluna = "pronto";
        else if (acabamentoLiberado || ordens.some(o => o.status === "acabamento")) coluna = "acabamento";
        else if (pedido.statusPedido === "em_producao" || lotesAtivos.length || ordens.some(ordem => ordem.status !== "concluida")) coluna = "producao";

        const progressoLotes = lotes.filter(l => l.status !== "falhou");
        const pesoProgresso = soma(progressoLotes, l => Math.max(1, l.tempoPrevistoMinutos));
        const progresso = pesoProgresso ? Math.round(soma(progressoLotes, l => {
            const valor = l.status === "concluido" ? 100 : Producao.calcularProgressoLote(l);
            return valor * Math.max(1, numero(l.tempoPrevistoMinutos));
        }) / pesoProgresso) : numero(ordens[0]?.progresso);
        const idsOperacoesComLote = new Set(lotes.map(lote => chave(lote.operacaoId)));
        const minutosSemAlocacao = soma(operacoes.filter(op => op.tipo === "impressao" && !FINAL_OPERACAO.has(op.status) && !idsOperacoesComLote.has(chave(op.id))), op => op.tempoPrevistoMinutos);
        const minutosRestantes = minutosSemAlocacao + soma(lotesAtivos, lote => {
            const previsto = numero(lote.tempoPrevistoMinutos);
            return ["em_execucao", "pausada"].includes(lote.status)
                ? Math.max(0, previsto - Producao.calcularTempoDecorrido(lote)) : previsto;
        });
        const impressoras = [...new Set(lotesAtivos.map(l => impressorasPorId.get(chave(l.impressoraId))?.nome || l.impressoraNome).filter(Boolean))];
        const itens = pedido.itens || [];
        const categorias = [...new Set(itens.map(item => produtosPorId.get(chave(item.produtoId))?.categoria || item.categoria).filter(Boolean))];
        const custos = soma(itens, item => {
            const produto = produtosPorId.get(chave(item.produtoId));
            return numero(item.custoUnitario ?? produto?.custoEstimado ?? produto?.custo) * numero(item.quantidade);
        });
        return {
            ...pedido, coluna, prioridade: prioridadePedido(pedido, hoje), progresso: Math.min(100, Math.max(0, progresso)),
            minutosRestantes, impressoras, categorias, acabamento, custos, ordens,
            tipos: itens.length, pecas: soma(itens, item => item.quantidade),
            pagamento: pedido.statusPagamento === "pago" ? "pago" : numero(pedido.valorPago) > 0 ? "parcial" : "pendente"
        };
    }

    function calcularMetricas() {
        const validos = contexto.enriquecidos.filter(p => p.statusPedido !== "cancelado");
        const ativos = validos.filter(p => p.statusPedido !== "entregue");
        const mes = contexto.hoje.slice(0, 7);
        const entreguesMes = validos.filter(p => p.statusPedido === "entregue" && String(p.atualizadoEm || p.dataEntregaPrevista || "").startsWith(mes));
        const atrasados = ativos.filter(p => p.prioridade === "atrasado");
        const receberHoje = contexto.lancamentos.filter(l => l.vencimento === contexto.hoje && !["pago", "cancelado"].includes(l.status));
        const receita = soma(ativos, p => p.valorTotal);
        const custos = soma(ativos, p => p.custos);
        const lucro = receita - custos;
        return {
            receita, receberHoje: soma(receberHoje, l => l.valorRestante), receberHojeQtd: receberHoje.length,
            minutos: soma(ativos, p => p.minutosRestantes), entreguesMes: entreguesMes.length,
            percentualEntregue: validos.length ? Math.round(entreguesMes.length / validos.length * 100) : 0,
            atrasados: atrasados.length, valorAtrasado: soma(atrasados, p => p.valorPendente || p.valorTotal),
            lucro, margem: receita > 0 ? lucro / receita * 100 : 0
        };
    }

    function filtrar() {
        const busca = normalizar(estado.busca);
        const lista = contexto.enriquecidos.filter(p => {
            const texto = normalizar([p.id, p.clienteNome, ...(p.itens || []).map(i => i.nome)].join(" "));
            return (!busca || texto.includes(busca))
                && (!estado.cliente || chave(p.clienteId) === estado.cliente)
                && (!estado.status || p.coluna === estado.status || p.statusPedido === estado.status)
                && (!estado.categoria || p.categorias.includes(estado.categoria))
                && (!estado.impressora || p.impressoras.includes(estado.impressora))
                && (!estado.prioridade || p.prioridade === estado.prioridade)
                && (!estado.pagamento || p.pagamento === estado.pagamento)
                && (!estado.atrasados || p.prioridade === "atrasado")
                && (p.statusPedido !== "cancelado" || estado.status === "cancelado");
        });
        const ordenacoes = {
            prazo: (a, b) => String(a.dataEntregaPrevista || "9999").localeCompare(String(b.dataEntregaPrevista || "9999")),
            recentes: (a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0),
            maior_valor: (a, b) => numero(b.valorTotal) - numero(a.valorTotal),
            menor_valor: (a, b) => numero(a.valorTotal) - numero(b.valorTotal),
            cliente: (a, b) => String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""), "pt-BR")
        };
        return lista.sort(ordenacoes[estado.ordenacao] || ordenacoes.prazo);
    }

    function renderCabecalho() {
        return `<header class="ordersPremiumHeader">
            <div class="ordersPremiumTitle"><span><i data-lucide="package"></i></span><div><small>OPERAÇÃO / PEDIDOS</small><h1>Pedidos</h1><p>Gerencie todo o fluxo dos seus pedidos em um só lugar.</p></div></div>
            <button class="btn ordersNewButton" type="button" onclick="abrirModalPedido()"><i data-lucide="plus"></i> Novo pedido</button>
        </header>`;
    }

    function renderKpis() {
        const m = calcularMetricas();
        const cards = [
            ["receita", "circle-dollar-sign", "Receita prevista", Utils.moeda(m.receita), "Valor dos pedidos em aberto", "Abrir Financeiro", "financeiro"],
            ["hoje", "wallet-cards", "Receber hoje", Utils.moeda(m.receberHoje), `${m.receberHojeQtd} pagamento(s) pendente(s)`, "Ver recebimentos", "hoje"],
            ["tempo", "clock-3", "Horas de impressão", formatarMinutos(m.minutos), "Tempo restante estimado", "Ver produção", "producao"],
            ["entregue", "circle-check-big", "Entregues este mês", `${m.entreguesMes} pedido${m.entreguesMes === 1 ? "" : "s"}`, `${m.percentualEntregue}% do total`, "Ver entregues", "entregue"],
            ["atrasado", "triangle-alert", "Pedidos atrasados", `${m.atrasados} pedido${m.atrasados === 1 ? "" : "s"}`, `${Utils.moeda(m.valorAtrasado)} em atraso`, "Ver atrasados", "atrasado"],
            ["lucro", "chart-no-axes-combined", "Lucro previsto", Utils.moeda(m.lucro), `Margem ${m.margem.toFixed(1).replace(".", ",")}%`, "Ver análise", "dashboard"]
        ];
        return `<section class="ordersKpiGrid" aria-label="Resumo dos pedidos">${cards.map(c => `<button class="ordersKpiCard tone-${c[0]}" type="button" onclick="PedidosPremium.abrirIndicador('${c[6]}')"><span class="ordersKpiIcon"><i data-lucide="${c[1]}"></i></span><span class="ordersKpiContent"><small>${c[2]}</small><strong>${c[3]}</strong><em>${c[4]}</em><b>${c[5]} <i data-lucide="arrow-right"></i></b></span></button>`).join("")}</section>`;
    }

    function opcoes(lista, valor, rotulo) {
        return `<option value="">${rotulo}</option>${lista.map(item => `<option value="${esc(item.valor)}" ${String(item.valor) === String(valor) ? "selected" : ""}>${esc(item.rotulo)}</option>`).join("")}`;
    }

    function renderFiltros() {
        const clientes = [...contexto.clientes].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        const categorias = [...new Set(contexto.produtos.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        const impressoras = [...contexto.impressoras].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        const qtdFiltros = [estado.cliente, estado.status, estado.categoria, estado.impressora, estado.prioridade, estado.pagamento, estado.atrasados].filter(Boolean).length;
        return `<section class="ordersFilterBar">
            <label class="ordersSearch"><i data-lucide="search"></i><input aria-label="Pesquisar pedidos" placeholder="Buscar cliente, produto ou pedido..." value="${esc(estado.busca)}" oninput="PedidosPremium.pesquisar(this.value)"></label>
            <div class="ordersFilterSelects">
                <select aria-label="Filtrar por status" onchange="PedidosPremium.definirFiltro('status',this.value)">${opcoes(COLUNAS.map(c => ({ valor: c.id, rotulo: c.titulo })).concat({ valor: "cancelado", rotulo: "Cancelado" }), estado.status, "Status")}</select>
                <select aria-label="Filtrar por cliente" onchange="PedidosPremium.definirFiltro('cliente',this.value)">${opcoes(clientes.map(c => ({ valor: chave(c.id), rotulo: c.nome })), estado.cliente, "Cliente")}</select>
                <select aria-label="Filtrar por categoria" onchange="PedidosPremium.definirFiltro('categoria',this.value)">${opcoes(categorias.map(c => ({ valor: c, rotulo: c })), estado.categoria, "Categoria")}</select>
                <select aria-label="Filtrar por impressora" onchange="PedidosPremium.definirFiltro('impressora',this.value)">${opcoes(impressoras.map(i => ({ valor: i.nome, rotulo: i.nome })), estado.impressora, "Impressora")}</select>
                <select aria-label="Filtrar por prioridade" onchange="PedidosPremium.definirFiltro('prioridade',this.value)">${opcoes([{ valor: "atrasado", rotulo: "Atrasado" }, { valor: "hoje", rotulo: "Hoje" }, { valor: "amanha", rotulo: "Amanhã" }, { valor: "semana", rotulo: "Esta semana" }, { valor: "normal", rotulo: "Sem urgência" }], estado.prioridade, "Prioridade")}</select>
                <select aria-label="Ordenar pedidos" onchange="PedidosPremium.definirFiltro('ordenacao',this.value)">${opcoes([{ valor: "prazo", rotulo: "Prazo" }, { valor: "recentes", rotulo: "Mais recentes" }, { valor: "maior_valor", rotulo: "Maior valor" }, { valor: "menor_valor", rotulo: "Menor valor" }, { valor: "cliente", rotulo: "Cliente A–Z" }], estado.ordenacao, "Ordenar")}</select>
            </div>
            <label class="ordersLateToggle"><input type="checkbox" ${estado.atrasados ? "checked" : ""} onchange="PedidosPremium.definirFiltro('atrasados',this.checked)"><span></span>Apenas atrasados</label>
            <div class="ordersViewToggle" aria-label="Visualização"><button class="${estado.visualizacao === "kanban" ? "active" : ""}" onclick="PedidosPremium.alterarVisualizacao('kanban')"><i data-lucide="panels-top-left"></i> Kanban</button><button class="${estado.visualizacao === "cards" ? "active" : ""}" onclick="PedidosPremium.alterarVisualizacao('cards')"><i data-lucide="layout-grid"></i> Cards</button></div>
            ${qtdFiltros ? `<button class="ordersClearFilters" onclick="PedidosPremium.limparFiltros()"><i data-lucide="x"></i> Limpar ${qtdFiltros}</button>` : ""}
            <button class="btn ordersToolbarNew" onclick="abrirModalPedido()"><i data-lucide="plus"></i> Novo pedido</button>
        </section>`;
    }

    function renderMiniaturas(pedido) {
        const itens = (pedido.itens || []).slice(0, 3);
        if (!itens.length) return `<span class="orderProductThumb"><i data-lucide="package"></i></span>`;
        return `${itens.map((item, i) => `<span class="orderProductThumb thumb-${i % 4}" title="${esc(item.nome)}">${item.imagem || item.foto ? `<img src="${esc(item.imagem || item.foto)}" alt="">` : `<i data-lucide="${item.personalizado ? "sparkles" : "box"}"></i>`}</span>`).join("")}${pedido.itens.length > 3 ? `<span class="orderProductMore">+${pedido.itens.length - 3}</span>` : ""}`;
    }

    function renderAcao(pedido) {
        const id = esc(pedido.id);
        if (pedido.coluna === "aguardando") {
            if (pedido.statusPedido === "aprovado") return `<button onclick="event.stopPropagation();abrirPreviaProducaoPedido('${id}')"><i data-lucide="play"></i> Produzir</button>`;
            return `<button onclick="event.stopPropagation();solicitarStatusPedido('${id}','aprovado')"><i data-lucide="check"></i> Aprovar</button>`;
        }
        if (pedido.coluna === "producao") return `<button onclick="event.stopPropagation();navegar('producao',{pedidoId:'${id}'})"><i data-lucide="factory"></i> Abrir produção</button>`;
        if (pedido.coluna === "acabamento") return `<button onclick="event.stopPropagation();PedidosPremium.abrirAcabamento('${id}')"><i data-lucide="play"></i> ${pedido.acabamento?.status === "em_execucao" ? "Abrir acabamento" : "Iniciar acabamento"}</button>`;
        if (pedido.coluna === "pronto") return `<button onclick="event.stopPropagation();solicitarStatusPedido('${id}','entregue')"><i data-lucide="package-check"></i> Entregar</button>`;
        return `<button onclick="event.stopPropagation();abrirDetalhePedido('${id}')"><i data-lucide="eye"></i> Ver detalhes</button>`;
    }

    function renderCard(pedido) {
        const prioridade = { atrasado: "Atrasado", hoje: "Hoje", amanha: "Amanhã", semana: "Esta semana", normal: "Sem urgência" }[pedido.prioridade];
        const pagamento = { pago: "Pago", parcial: "Parcial", pendente: "Pendente" }[pedido.pagamento];
        return `<article class="premiumOrderCard priority-${pedido.prioridade}" role="button" tabindex="0" draggable="false" data-order-id="${esc(pedido.id)}" data-kanban-column="${pedido.coluna}" onclick="abrirDetalhePedido('${esc(pedido.id)}')" onkeydown="if(event.key==='Enter')abrirDetalhePedido('${esc(pedido.id)}')">
            <header><span>#${esc(String(pedido.id).slice(-5))}</span><strong>${Utils.moeda(pedido.valorTotal)}</strong></header>
            <div class="premiumOrderIdentity"><h3>${esc(pedido.clienteNome || "Cliente não informado")}</h3><p>${pedido.coluna === "entregue" ? "Entrega" : "Prazo"}: ${dataCurta(pedido.dataEntregaPrevista)}</p></div>
            ${pedido.prioridade !== "normal" ? `<span class="premiumPriorityBadge ${pedido.prioridade}">Prioridade: ${prioridade}</span>` : ""}
            <div class="premiumOrderThumbs">${renderMiniaturas(pedido)}</div>
            ${["producao", "acabamento"].includes(pedido.coluna) ? `<div class="premiumProductionStatus"><div><span>${esc(pedido.impressoras.join(" · ") || (pedido.coluna === "acabamento" ? "Acabamento manual" : "Aguardando impressora"))}</span><small>${formatarMinutos(pedido.minutosRestantes)} restantes</small></div><div class="premiumProgress"><i><b style="width:${pedido.progresso}%"></b></i><strong>${pedido.progresso}%</strong></div></div>` : ""}
            <div class="premiumOrderMeta"><span><i data-lucide="boxes"></i> ${pedido.tipos} produto${pedido.tipos === 1 ? "" : "s"}</span><span><i data-lucide="package"></i> ${pedido.pecas} peça${pedido.pecas === 1 ? "" : "s"}</span><span class="payment-${pedido.pagamento}">${pagamento}</span></div>
            <footer>${renderAcao(pedido)}<button class="premiumOrderMore" aria-label="Mais ações" onclick="event.stopPropagation();abrirMenuPedido('${esc(pedido.id)}')"><i data-lucide="ellipsis"></i></button></footer>
        </article>`;
    }

    function renderVazio(coluna) {
        return `<div class="ordersColumnEmpty"><i data-lucide="${coluna.icone}"></i><strong>Nenhum pedido aqui</strong><span>Os pedidos aparecerão automaticamente ao chegar nesta etapa.</span></div>`;
    }

    function renderKanban(lista) {
        const mobile = window.matchMedia?.("(max-width: 760px)").matches;
        const abas = `<div class="ordersMobileTabs" role="tablist">${COLUNAS.map(c => { const qtd = lista.filter(p => p.coluna === c.id).length; return `<button role="tab" aria-selected="${estado.colunaMobile === c.id}" class="${estado.colunaMobile === c.id ? "active" : ""}" onclick="PedidosPremium.abrirColunaMobile('${c.id}')">${c.titulo}<b>${qtd}</b></button>`; }).join("")}</div>`;
        const colunas = (mobile ? COLUNAS.filter(c => c.id === estado.colunaMobile) : COLUNAS).map(coluna => {
            const todos = lista.filter(p => p.coluna === coluna.id);
            const limite = estado.limites[coluna.id] || 24;
            const visiveis = todos.slice(0, limite);
            const recolhida = estado.recolhidas.has(coluna.id);
            return `<section class="ordersKanbanColumn column-${coluna.id} ${recolhida ? "isCollapsed" : ""}" data-drop-zone="${coluna.id}" aria-dropeffect="none">
                <header><button onclick="PedidosPremium.recolherColuna('${coluna.id}')"><i data-lucide="${coluna.icone}"></i><span>${coluna.titulo}</span><b>${todos.length}</b><i data-lucide="${recolhida ? "chevron-right" : "chevron-down"}"></i></button></header>
                ${recolhida ? "" : `<div class="ordersKanbanScroll">${visiveis.map(renderCard).join("") || renderVazio(coluna)}${todos.length > visiveis.length ? `<button class="ordersLoadMore" onclick="PedidosPremium.verTodos('${coluna.id}')"><i data-lucide="plus"></i> Ver todos (${todos.length})</button>` : ""}</div>`}
            </section>`;
        }).join("");
        return `${mobile ? abas : ""}<div class="ordersKanban">${colunas}</div>`;
    }

    function renderCards(lista) {
        return lista.length ? `<div class="ordersCardsGrid">${lista.map(renderCard).join("")}</div>` : `<div class="ordersGlobalEmpty"><i data-lucide="clipboard-list"></i><strong>Nenhum pedido encontrado</strong><p>Ajuste os filtros ou crie um novo pedido.</p><button class="btn" onclick="abrirModalPedido()"><i data-lucide="plus"></i> Novo pedido</button></div>`;
    }

    function renderResumo(lista) {
        const total = lista.length;
        const valor = soma(lista, p => p.valorTotal);
        const prazos = lista.map(p => p.dataPedido && p.dataEntregaPrevista ? Math.max(0, diferencaDias(p.dataEntregaPrevista, p.dataPedido)) : 0).filter(Boolean);
        const prazoMedio = prazos.length ? soma(prazos, p => p) / prazos.length : 0;
        const pagos = lista.filter(p => p.pagamento === "pago").length;
        const atrasados = lista.filter(p => p.prioridade === "atrasado").length;
        const itens = [
            ["clipboard-list", "Total de pedidos", total, "todos"], ["circle-dollar-sign", "Valor total", Utils.moeda(valor), "financeiro"],
            ["receipt", "Ticket médio", Utils.moeda(total ? valor / total : 0), "dashboard"], ["clock-3", "Prazo médio", `${prazoMedio.toFixed(1).replace(".", ",")} dias`, "prazo"],
            ["circle-check-big", "Pedidos pagos", pagos, "pagos"], ["triangle-alert", "Atrasados", atrasados, "atrasado"]
        ];
        return `<section class="ordersBottomSummary">${itens.map(i => `<button onclick="PedidosPremium.abrirResumo('${i[3]}')"><span><i data-lucide="${i[0]}"></i></span><small>${i[1]}</small><strong>${i[2]}</strong><b>Ver ${i[3] === "todos" ? "todos" : i[3]} <i data-lucide="arrow-right"></i></b></button>`).join("")}</section>`;
    }

    function renderWorkspace() {
        const lista = filtrar();
        const area = document.getElementById("ordersPremiumWorkspace");
        const resumo = document.getElementById("ordersPremiumSummary");
        const contador = document.getElementById("ordersResultCount");
        if (area) area.innerHTML = estado.visualizacao === "kanban" ? renderKanban(lista) : renderCards(lista);
        if (resumo) resumo.innerHTML = renderResumo(lista);
        if (contador) contador.textContent = `${lista.length} pedido${lista.length === 1 ? "" : "s"}`;
        lucide.createIcons();
    }

    function renderConteudo(token) {
        if (token !== renderizacao) return;
        contexto = criarContexto();
        app.innerHTML = `<main class="ordersPremiumPage">${renderCabecalho()}${renderKpis()}${renderFiltros()}<div class="ordersWorkspaceHeading"><div><small>CENTRO DE OPERAÇÕES</small><strong id="ordersResultCount"></strong></div></div><div id="ordersPremiumWorkspace"></div><div id="ordersPremiumSummary"></div></main>`;
        renderWorkspace();
    }

    function renderPedidosPremium() {
        const token = ++renderizacao;
        app.innerHTML = `<main class="ordersPremiumPage ordersLoading"><div class="ordersHeaderSkeleton"></div><div class="ordersKpiSkeleton">${"<i></i>".repeat(6)}</div><div class="ordersBoardSkeleton"></div></main>`;
        (window.requestAnimationFrame || (fn => setTimeout(fn, 0)))(() => renderConteudo(token));
    }

    const api = {
        render: renderPedidosPremium,
        _criarContexto: criarContexto,
        _renderDesktop: renderPedidosPremium,
        pesquisar(valor) { estado.busca = valor; renderWorkspace(); },
        definirFiltro(campo, valor) { estado[campo] = valor; if (campo === "status" && COLUNAS.some(c => c.id === valor)) estado.colunaMobile = valor; renderWorkspace(); },
        alterarVisualizacao(valor) { estado.visualizacao = valor; localStorage.setItem("primedocs_pedidos_visualizacao", valor); renderConteudo(++renderizacao); },
        limparFiltros() { Object.assign(estado, { busca: "", cliente: "", status: "", categoria: "", impressora: "", prioridade: "", pagamento: "", atrasados: false }); renderConteudo(++renderizacao); },
        recolherColuna(id) { estado.recolhidas.has(id) ? estado.recolhidas.delete(id) : estado.recolhidas.add(id); renderWorkspace(); },
        abrirColunaMobile(id) { estado.colunaMobile = id; renderWorkspace(); },
        verTodos(id) { estado.limites[id] = Number.MAX_SAFE_INTEGER; renderWorkspace(); },
        abrirIndicador(tipo) {
            if (tipo === "entregue") { estado.status = "entregue"; estado.atrasados = false; estado.colunaMobile = "entregue"; return renderConteudo(++renderizacao); }
            if (tipo === "atrasado") { estado.atrasados = true; estado.status = ""; return renderConteudo(++renderizacao); }
            if (tipo === "hoje") { try { filtrosFinanceiro = { termo: "", status: "", origem: "pedido", cliente: "", periodo: "hoje", inicio: "", fim: "" }; } catch (_) {} return navegar("financeiro"); }
            if (tipo === "financeiro") { try { filtrosFinanceiro = { termo: "", status: "", origem: "pedido", cliente: "", periodo: "", inicio: "", fim: "" }; } catch (_) {} return navegar("financeiro"); }
            if (tipo === "producao") return navegar("producao");
            return navegar("dashboard");
        },
        abrirResumo(tipo) {
            if (tipo === "financeiro") return navegar("financeiro");
            if (tipo === "dashboard") return navegar("dashboard");
            if (tipo === "atrasado") { estado.atrasados = true; return renderConteudo(++renderizacao); }
            if (tipo === "pagos") { estado.pagamento = "pago"; estado.status = ""; estado.atrasados = false; return renderConteudo(++renderizacao); }
            if (tipo === "prazo") { estado.ordenacao = "prazo"; return renderConteudo(++renderizacao); }
            api.limparFiltros();
        },
        abrirAcabamento(id) {
            const pedido = contexto?.enriquecidos.find(p => chave(p.id) === chave(id));
            const operacao = pedido?.acabamento;
            if (operacao && operacao.status !== "em_execucao" && typeof executarAcaoManual === "function") return executarAcaoManual(operacao.id, "iniciar");
            return navegar("producao", { pedidoId: id });
        },
        dragAndDropDisponivel: false
    };

    window.PedidosPremium = api;
    window.renderPedidos = renderPedidosPremium;
    let larguraMobile = window.matchMedia?.("(max-width: 760px)").matches;
    window.addEventListener("resize", () => {
        const atual = window.matchMedia?.("(max-width: 760px)").matches;
        if (atual !== larguraMobile && document.querySelector(".ordersPremiumPage")) { larguraMobile = atual; renderWorkspace(); }
    });
})();
