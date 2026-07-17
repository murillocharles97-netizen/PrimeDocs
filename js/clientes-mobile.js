(function () {
    "use strict";

    if (typeof window.renderClientes !== "function") return;

    const renderDesktop = window.renderClientes;
    const MOBILE_QUERY = "(max-width: 767px)";
    const SORT_KEY = "primedocs_clientes_mobile_ordenacao";
    const QUICK_FILTERS = [
        ["todos", "Todos"], ["devedores", "Devedores"], ["lojas", "Lojas / Consignado"],
        ["vip", "VIP"], ["inativos", "Inativos"]
    ];
    const estado = {
        busca: "", rapido: "todos", ordenacao: localStorage.getItem(SORT_KEY) || "nome_az",
        filtros: {}, expandido: null, limite: 30, scrollY: 0
    };
    let dados = null;
    let buscaTimer = null;
    let resizeTimer = null;
    let ultimoModoMobile = null;
    let ignorarCliqueAte = 0;

    const numero = valor => Number(valor) || 0;
    const chave = valor => String(valor ?? "");
    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const normalizar = valor => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
    const moeda = valor => Utils.moeda(numero(valor));
    const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;
    const dataValida = valor => { const d = valor ? new Date(String(valor).length === 10 ? `${valor}T12:00:00` : valor) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
    const dataCurta = valor => dataValida(valor)?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) || "Nunca";
    const diasDesde = valor => { const d = dataValida(valor); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 864e5)) : Infinity; };
    const plural = (valor, singular, pluralTexto) => `${valor} ${valor === 1 ? singular : pluralTexto}`;

    function calcularRelacionamento(cliente, pedidos, financeiro) {
        const validos = pedidos.filter(p => p.statusPedido !== "cancelado");
        const total = validos.reduce((soma, pedido) => soma + numero(pedido.valorTotal), 0);
        const ultima = validos.map(p => p.atualizadoEm || p.dataPedido || p.criadoEm).filter(Boolean).sort().at(-1);
        const idadeDias = diasDesde(cliente.criadoEm);
        const recencia = diasDesde(ultima);
        const cancelados = pedidos.filter(p => p.statusPedido === "cancelado").length;
        const pendente = financeiro.reduce((soma, item) => soma + numero(item.valorRestante), 0);
        const vencido = financeiro.some(item => item.status === "atrasado" || (item.vencimento && item.vencimento < Utils.hoje() && numero(item.valorRestante) > 0));

        if (!validos.length) return { score: 35, level: "novo", label: idadeDias < 180 ? "Cliente novo" : "Dados insuficientes", explanation: "Ainda não há compras suficientes para avaliar o relacionamento." };

        const pontosRecencia = recencia <= 30 ? 30 : recencia <= 60 ? 24 : recencia <= 90 ? 18 : recencia <= 180 ? 10 : 4;
        const pontosFrequencia = Math.min(25, validos.length * 4);
        const pontosVolume = Math.min(20, Math.log10(total + 1) * 6);
        const pontosTempo = idadeDias === Infinity ? 5 : Math.min(15, 4 + idadeDias / 45);
        const pontosFinanceiro = vencido ? 0 : pendente > 0 ? 5 : 10;
        const penalidade = Math.min(10, cancelados * 2);
        const score = Math.max(0, Math.min(100, Math.round(pontosRecencia + pontosFrequencia + pontosVolume + pontosTempo + pontosFinanceiro - penalidade)));
        const nivel = score >= 85 ? ["excelente", "Excelente"] : score >= 70 ? ["muito_bom", "Muito bom"] : score >= 55 ? ["bom", "Bom"] : score >= 35 ? ["regular", "Regular"] : ["novo", "Cliente novo"];
        return { score, level: nivel[0], label: nivel[1], explanation: `${plural(validos.length, "pedido", "pedidos")}, última compra há ${Number.isFinite(recencia) ? recencia : 0} dias e ${pendente ? "saldo pendente" : "sem pendências"}.` };
    }

    function montarDados() {
        sincronizarLojasExistentesClientes?.();
        const clientes = Storage.listarClientes();
        const pedidos = Storage.listarPedidos().filter(p => p.ativo !== false);
        const lojas = Storage.listarLojas();
        const estoques = Storage.listarEstoquesLojas();
        let financeiro;
        try { financeiro = window.Financeiro?.sincronizar?.() || Storage.listarLancamentosFinanceiros(); }
        catch (erro) { console.warn("[Clientes Mobile] Cache financeiro usado:", erro); financeiro = Storage.listarLancamentosFinanceiros(); }

        const pedidosPorId = new Map(), pedidosPorNome = new Map(), financeiroPorId = new Map(), financeiroPorNome = new Map();
        pedidos.forEach(pedido => {
            const mapa = pedido.clienteId ? pedidosPorId : pedidosPorNome;
            const key = pedido.clienteId ? chave(pedido.clienteId) : normalizar(pedido.clienteNome);
            if (!mapa.has(key)) mapa.set(key, []);
            mapa.get(key).push(pedido);
        });
        financeiro.forEach(item => {
            const mapa = item.clienteId ? financeiroPorId : financeiroPorNome;
            const key = item.clienteId ? chave(item.clienteId) : normalizar(item.clienteNome);
            if (!mapa.has(key)) mapa.set(key, []);
            mapa.get(key).push(item);
        });
        const estoquePorLoja = new Map(estoques.map(item => [chave(item.lojaId), item]));

        const normalizados = clientes.map(cliente => {
            const pedidosCliente = [...(pedidosPorId.get(chave(cliente.id)) || []), ...(pedidosPorNome.get(normalizar(cliente.nome)) || [])]
                .filter((item, indice, lista) => lista.findIndex(p => chave(p.id) === chave(item.id)) === indice)
                .sort((a, b) => new Date(b.atualizadoEm || b.criadoEm || b.dataPedido || 0) - new Date(a.atualizadoEm || a.criadoEm || a.dataPedido || 0));
            const lancamentos = [...(financeiroPorId.get(chave(cliente.id)) || []), ...(financeiroPorNome.get(normalizar(cliente.nome)) || [])]
                .filter((item, indice, lista) => lista.findIndex(p => chave(p.id) === chave(item.id)) === indice);
            const abertos = lancamentos.filter(item => !["pago", "cancelado"].includes(item.status) && numero(item.valorRestante) > 0);
            const hoje = Utils.hoje();
            const vencidos = abertos.filter(item => item.status === "atrasado" || (item.vencimento && item.vencimento < hoje));
            const loja = lojas.find(item => chave(item.clienteId) === chave(cliente.id) || chave(item.id) === chave(cliente.lojaId) || normalizar(item.nome) === normalizar(cliente.nome));
            const estoque = loja ? estoquePorLoja.get(chave(loja.id)) : null;
            const valorConsignado = (estoque?.itens || []).reduce((soma, item) => soma + numero(item.quantidade) * numero(item.preco), 0);
            const totalComprado = pedidosCliente.filter(p => p.statusPedido !== "cancelado").reduce((soma, p) => soma + numero(p.valorTotal), 0);
            const ultimaCompra = pedidosCliente.find(p => p.statusPedido !== "cancelado")?.dataPedido || pedidosCliente[0]?.criadoEm || "";
            const relacionamento = calcularRelacionamento(cliente, pedidosCliente, lancamentos);
            const vipManual = cliente.statusRelacionamento === "vip" || (cliente.tags || []).some(tag => normalizar(tag) === "vip");
            const vip = vipManual || avaliarRelacionamentoCliente?.(cliente, pedidosCliente) === "vip";
            return {
                ...cliente, pedidos: pedidosCliente, lancamentos, loja, estoque, valorConsignado, totalComprado,
                ultimaCompra, relacionamento, vip, vipManual, saldoPendente: abertos.reduce((s, i) => s + numero(i.valorRestante), 0),
                saldoVencido: vencidos.reduce((s, i) => s + numero(i.valorRestante), 0), lancamentoReceber: vencidos[0] || abertos[0] || null,
                busca: normalizar([cliente.nome, cliente.apelido, cliente.telefone, cliente.whatsapp, cliente.cpfCnpj, cliente.cidade, cliente.empresa, cliente.responsavel, cliente.observacoes].filter(Boolean).join(" "))
            };
        });
        return { clientes: normalizados, offline: navigator.onLine === false };
    }

    function contarFiltros() { return Object.values(estado.filtros).filter(valor => valor !== "" && valor !== false && valor != null).length; }
    function contagens() {
        const lista = dados?.clientes || [];
        return {
            todos: lista.length,
            devedores: lista.filter(c => c.saldoPendente > 0).length,
            lojas: lista.filter(c => c.tipo === "loja_parceira" || c.loja || c.valorConsignado > 0).length,
            vip: lista.filter(c => c.vip).length,
            inativos: lista.filter(c => c.ativo === false).length
        };
    }

    function passaFiltros(cliente) {
        const f = estado.filtros;
        const rapido = estado.rapido === "todos"
            || estado.rapido === "devedores" && cliente.saldoPendente > 0
            || estado.rapido === "lojas" && (cliente.tipo === "loja_parceira" || cliente.loja || cliente.valorConsignado > 0)
            || estado.rapido === "vip" && cliente.vip
            || estado.rapido === "inativos" && cliente.ativo === false;
        if (!rapido || (estado.busca && !cliente.busca.includes(normalizar(estado.busca)))) return false;
        if (f.tipo && cliente.tipo !== f.tipo) return false;
        if (f.situacao === "com" && cliente.saldoPendente <= 0 || f.situacao === "sem" && cliente.saldoPendente > 0) return false;
        if (f.ativo === "ativo" && cliente.ativo === false || f.ativo === "inativo" && cliente.ativo !== false) return false;
        if (f.vip === "sim" && !cliente.vip || f.vip === "nao" && cliente.vip) return false;
        const contato = String(cliente.whatsapp || cliente.telefone || "").replace(/\D/g, "");
        if (f.whatsapp === "com" && contato.length < 10 || f.whatsapp === "sem" && contato.length >= 10) return false;
        if (f.cidade && normalizar(cliente.cidade) !== normalizar(f.cidade)) return false;
        if (f.ultimaCompra === "30" && diasDesde(cliente.ultimaCompra) > 30 || f.ultimaCompra === "90" && diasDesde(cliente.ultimaCompra) > 90 || f.ultimaCompra === "inativo" && diasDesde(cliente.ultimaCompra) <= 120) return false;
        if (numero(f.valorMin) && cliente.totalComprado < numero(f.valorMin) || numero(f.valorMax) && cliente.totalComprado > numero(f.valorMax)) return false;
        if (numero(f.pedidosMin) && cliente.pedidos.length < numero(f.pedidosMin)) return false;
        if (f.responsavel && !normalizar(cliente.responsavel || cliente.loja?.responsavel).includes(normalizar(f.responsavel))) return false;
        return true;
    }

    function listaFiltrada() {
        const lista = (dados?.clientes || []).filter(passaFiltros);
        const ordenacoes = {
            nome_az: (a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"), nome_za: (a, b) => String(b.nome).localeCompare(String(a.nome), "pt-BR"),
            saldo: (a, b) => b.saldoPendente - a.saldoPendente, valor: (a, b) => b.totalComprado - a.totalComprado,
            pedidos: (a, b) => b.pedidos.length - a.pedidos.length,
            recente: (a, b) => (dataValida(b.ultimaCompra)?.getTime() || 0) - (dataValida(a.ultimaCompra)?.getTime() || 0),
            distante: (a, b) => (dataValida(a.ultimaCompra)?.getTime() || 0) - (dataValida(b.ultimaCompra)?.getTime() || 0),
            relacionamento: (a, b) => b.relacionamento.score - a.relacionamento.score,
            novos: (a, b) => (dataValida(b.criadoEm)?.getTime() || 0) - (dataValida(a.criadoEm)?.getTime() || 0)
        };
        return lista.sort(ordenacoes[estado.ordenacao] || ordenacoes.nome_az);
    }

    function tipoCliente(cliente) {
        return cliente.tipo === "loja_parceira" || cliente.loja ? "Loja parceira" : ({ particular: "Cliente particular", empresa: "Empresa", fornecedor: "Fornecedor", outro: "Cliente" })[cliente.tipo] || "Cliente particular";
    }

    function contatoValido(cliente) { const telefone = String(cliente.whatsapp || cliente.telefone || "").replace(/\D/g, ""); return telefone.length >= 10 ? telefone : ""; }
    function tomCliente(cliente) { return cliente.ativo === false ? "gray" : cliente.saldoVencido > 0 ? "red" : cliente.saldoPendente > 0 ? "orange" : cliente.valorConsignado > 0 ? "blue" : cliente.relacionamento.score >= 70 ? "green" : "purple"; }
    function financeiroPrincipal(cliente) {
        if (cliente.saldoVencido > 0) return ["wallet-cards", "Vencido", moeda(cliente.saldoVencido), "danger"];
        if (cliente.saldoPendente > 0) return ["wallet-cards", "Deve", moeda(cliente.saldoPendente), "warning"];
        if (cliente.valorConsignado > 0) return ["store", "Consignado", moeda(cliente.valorConsignado), "consigned"];
        if (cliente.pedidos.length) return ["circle-check", "Sem pendências", "", "success"];
        return ["minus", "Sem movimentação", "", "neutral"];
    }

    function renderAvatar(cliente) {
        const imagem = cliente.foto || cliente.avatar || "";
        const fallback = cliente.tipo === "loja_parceira" || cliente.loja ? `<i data-lucide="store"></i>` : cliente.tipo === "empresa" ? `<i data-lucide="building-2"></i>` : `<b>${esc(iniciaisCliente(cliente.nome))}</b>`;
        return `<span class="mobileClientAvatar">${imagem ? `<img src="${esc(imagem)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${fallback}</span>` : fallback}</span>`;
    }

    function renderRelacionamento(cliente) {
        return `<div class="mobileClientRelationship level-${cliente.relacionamento.level}" title="${esc(cliente.relacionamento.explanation)}"><span><small>Relacionamento</small><strong>${esc(cliente.relacionamento.label)}</strong></span><i aria-label="Pontuação ${cliente.relacionamento.score} de 100"><b style="width:${cliente.relacionamento.score}%"></b></i></div>`;
    }

    function renderExpandido(cliente) {
        if (chave(estado.expandido) !== chave(cliente.id)) return "";
        const retorno = (cliente.retornos || []).filter(item => item.status === "pendente").sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))[0];
        const interacao = [...(cliente.interacoes || [])].sort((a, b) => new Date(b.data || b.criadoEm || 0) - new Date(a.data || a.criadoEm || 0))[0];
        return `<section class="mobileClientExpanded">
            <dl><div><dt>Endereço</dt><dd>${esc(cliente.endereco || "Não informado")}</dd></div><div><dt>Cidade</dt><dd>${esc(cliente.cidade || "Não informada")}</dd></div><div><dt>Responsável</dt><dd>${esc(cliente.responsavel || cliente.loja?.responsavel || "Não informado")}</dd></div><div><dt>Próximo contato</dt><dd>${retorno ? dataCurta(retorno.dataHora) : dataCurta(cliente.proximoContato)}</dd></div></dl>
            ${cliente.observacoes ? `<div class="mobileClientNote"><small>OBSERVAÇÕES</small><p>${esc(cliente.observacoes)}</p></div>` : ""}
            <div class="mobileClientRecent"><small>ÚLTIMOS PEDIDOS</small>${cliente.pedidos.slice(0, 3).map(p => `<span><b>#${esc(chave(p.id).slice(-5))}</b>${dataCurta(p.dataPedido || p.criadoEm)}<strong>${moeda(p.valorTotal)}</strong></span>`).join("") || `<p>Nenhum pedido registrado.</p>`}</div>
            ${interacao ? `<p class="mobileClientLastInteraction"><b>Última interação:</b> ${esc(interacao.descricao || interacao.tipo)} · ${dataCurta(interacao.data || interacao.criadoEm)}</p>` : ""}
            ${(cliente.tags || []).length ? `<div class="mobileClientTags">${cliente.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
            <button class="mobileClientFullProfile" onclick="event.stopPropagation();ClientesMobile.abrir('${esc(cliente.id)}')"><i data-lucide="user-round"></i> Ver ficha completa</button>
        </section>`;
    }

    function renderCard(cliente) {
        const contato = contatoValido(cliente), financeiro = financeiroPrincipal(cliente), aberto = chave(estado.expandido) === chave(cliente.id);
        const esquerda = cliente.saldoPendente > 0 ? ["hand-coins", "Receber"] : contato ? ["message-circle", "WhatsApp"] : ["user-round", "Abrir"];
        return `<div class="mobileClientSwipe tone-${tomCliente(cliente)}" data-mobile-client-swipe="${esc(cliente.id)}">
            <div class="mobileClientSwipeAction positive"><i data-lucide="package-plus"></i><span>Novo pedido</span></div>
            <div class="mobileClientSwipeAction contextual"><i data-lucide="${esquerda[0]}"></i><span>${esquerda[1]}</span></div>
            <article class="mobileClientCard ${aberto ? "isExpanded" : ""}" data-mobile-client-card="${esc(cliente.id)}" aria-expanded="${aberto}" onclick="ClientesMobile.alternar(event,'${esc(cliente.id)}')">
                <header>${renderAvatar(cliente)}<div class="mobileClientIdentity"><div><h2 title="${esc(cliente.nome)}">${esc(cliente.nome)}</h2>${cliente.vip ? `<span class="mobileClientVip"><i data-lucide="star"></i>VIP</span>` : ""}</div><p>${cliente.pedidos.length ? `${cliente.tipo === "loja_parceira" ? "Parceiro" : "Cliente"}${cliente.criadoEm ? ` desde ${dataValida(cliente.criadoEm)?.getFullYear()}` : ""} · ${plural(cliente.pedidos.length, "pedido", "pedidos")}` : "Cliente novo · nenhum pedido"}</p><span class="mobileClientContact ${contato ? "available" : ""}"><i data-lucide="${contato ? "message-circle" : "message-circle-off"}"></i>${contato ? esc(formatarTelefoneMobile(contato)) : "WhatsApp não informado"}</span></div><div class="mobileClientHeaderActions"><span class="mobileClientType">${esc(tipoCliente(cliente))}</span><button type="button" aria-label="Mais ações" onclick="event.stopPropagation();ClientesMobile.menu('${esc(cliente.id)}')"><i data-lucide="ellipsis-vertical"></i></button><button class="mobileClientExpandButton" type="button" aria-label="${aberto ? "Recolher" : "Expandir"} cliente" onclick="event.stopPropagation();ClientesMobile.alternar(event,'${esc(cliente.id)}')"><i data-lucide="chevron-down"></i></button></div></header>
                <div class="mobileClientCompactData"><div class="financial-${financeiro[3]}"><i data-lucide="${financeiro[0]}"></i><span><small>${financeiro[1]}</small><strong>${financeiro[2]}</strong></span></div><div><i data-lucide="package"></i><span><strong>${plural(cliente.pedidos.length, "pedido", "pedidos")}</strong><small>${cliente.ultimaCompra ? `Última: ${dataCurta(cliente.ultimaCompra)}` : "Nunca comprou"}</small></span></div>${renderRelacionamento(cliente)}</div>
                <footer><button class="mobileClientContactButton" ${contato ? `onclick="event.stopPropagation();ClientesMobile.whatsapp('${esc(cliente.id)}')"` : "disabled"} aria-label="WhatsApp"><i data-lucide="message-circle"></i></button><button class="mobileClientContactButton mobileClientPhone" ${contato ? `onclick="event.stopPropagation();ClientesMobile.ligar('${esc(cliente.id)}')"` : "disabled"} aria-label="Ligar"><i data-lucide="phone"></i></button><button class="mobileClientContactButton mobileClientNewOrder" ${cliente.ativo === false ? "disabled" : `onclick="event.stopPropagation();ClientesMobile.novoPedido('${esc(cliente.id)}')"`} aria-label="Novo pedido"><i data-lucide="package-plus"></i></button><button class="mobileClientOpen" onclick="event.stopPropagation();ClientesMobile.abrir('${esc(cliente.id)}')">Abrir<i data-lucide="chevron-right"></i></button></footer>
                ${renderExpandido(cliente)}
            </article>
        </div>`;
    }

    function formatarTelefoneMobile(valor) {
        const n = String(valor).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : n;
    }

    function renderChips() {
        const counts = contagens();
        return `<div class="mobileClientChips" role="tablist" aria-label="Filtros rápidos">${QUICK_FILTERS.filter(([id]) => id !== "inativos" || counts.inativos).map(([id, rotulo]) => `<button role="tab" aria-selected="${estado.rapido === id}" class="${estado.rapido === id ? "active" : ""}" onclick="ClientesMobile.filtroRapido('${id}')">${rotulo}<b>${counts[id]}</b></button>`).join("")}<button class="advanced ${contarFiltros() ? "hasFilters" : ""}" onclick="ClientesMobile.abrirFiltros()"><i data-lucide="list-filter"></i>Filtros${contarFiltros() ? `<b>${contarFiltros()}</b>` : ""}</button></div>`;
    }

    function renderLista() {
        const container = document.getElementById("mobileClientsList");
        if (!container) return;
        const lista = listaFiltrada(), visiveis = lista.slice(0, estado.limite);
        if (!lista.length) {
            const mensagens = estado.rapido === "devedores" ? ["badge-check", "Nenhum cliente possui saldo pendente."] : estado.rapido === "lojas" ? ["store", "Nenhuma loja parceira cadastrada."] : estado.rapido === "vip" ? ["star", "Nenhum cliente marcado como VIP."] : dados.clientes.length ? ["search-x", "Nenhum cliente encontrado."] : ["users", "Nenhum cliente cadastrado."];
            container.innerHTML = `<div class="mobileClientsEmpty"><i data-lucide="${mensagens[0]}"></i><strong>${mensagens[1]}</strong><p>${dados.clientes.length ? "Revise a busca ou os filtros aplicados." : "Cadastre seu primeiro cliente para criar pedidos e acompanhar relacionamentos."}</p><button onclick="${dados.clientes.length ? "ClientesMobile.limparTudo()" : "abrirModalCliente()"}">${dados.clientes.length ? "Limpar filtros" : "Novo cliente"}</button></div>`;
        } else {
            container.innerHTML = visiveis.map(renderCard).join("") + (lista.length > visiveis.length ? `<button class="mobileClientsLoadMore" onclick="ClientesMobile.carregarMais()">Mostrar mais ${Math.min(30, lista.length - visiveis.length)} clientes</button>` : "");
        }
        const contador = document.getElementById("mobileClientsCount");
        if (contador) contador.textContent = plural(lista.length, "cliente", "clientes");
        document.getElementById("mobileClientChipsSlot").innerHTML = renderChips();
        document.querySelector(".mobileClientSortLabel").textContent = rotuloOrdenacao();
        window.lucide?.createIcons?.();
        ativarGestos();
    }

    function rotuloOrdenacao() { return ({ nome_az: "Nome A–Z", nome_za: "Nome Z–A", saldo: "Maior saldo pendente", valor: "Maior valor comprado", pedidos: "Mais pedidos", recente: "Compra mais recente", distante: "Sem comprar há mais tempo", relacionamento: "Melhor relacionamento", novos: "Mais novos" })[estado.ordenacao] || "Nome A–Z"; }

    function renderMobile() {
        const content = document.getElementById("content");
        if (!content) return;
        document.body.classList.add("clientsMobileActive");
        renderNavegacaoInferiorPrimeDocs?.("clientes");
        content.innerHTML = `<main class="clientsMobilePage"><header class="mobileClientsHeading"><span><i data-lucide="users-round"></i></span><div><h1>Clientes</h1><p>Seus clientes, relacionamentos e resultados.</p></div></header><label class="mobileClientsSearch"><i data-lucide="search"></i><input type="search" aria-label="Buscar clientes" placeholder="Buscar cliente por nome, contato ou documento" value="${esc(estado.busca)}" oninput="ClientesMobile.pesquisar(this.value)"><button type="button" aria-label="Limpar busca" ${estado.busca ? "" : "hidden"} onclick="ClientesMobile.limparBusca()"><i data-lucide="x"></i></button></label><div id="mobileClientChipsSlot"></div><button class="mobileClientSorting" onclick="ClientesMobile.abrirOrdenacao()"><span>Ordenar: <b class="mobileClientSortLabel">${rotuloOrdenacao()}</b></span><i data-lucide="chevron-down"></i></button>${navigator.onLine === false ? `<div class="mobileClientsOffline"><i data-lucide="cloud-off"></i>Offline · exibindo dados salvos neste dispositivo</div>` : ""}<div class="mobileClientsListHeading"><strong>Agenda comercial</strong><span id="mobileClientsCount"></span></div><section class="mobileClientsList" id="mobileClientsList"><div class="mobileClientsSkeleton">${"<i></i>".repeat(3)}</div></section></main>`;
        try { dados = montarDados(); renderLista(); if (estado.scrollY) requestAnimationFrame(() => { window.scrollTo({ top: estado.scrollY, behavior: "auto" }); estado.scrollY = 0; }); }
        catch (erro) { console.error("[Clientes Mobile] Falha ao carregar:", erro); document.getElementById("mobileClientsList").innerHTML = `<div class="mobileClientsEmpty error"><i data-lucide="triangle-alert"></i><strong>Não foi possível carregar os clientes.</strong><button onclick="ClientesMobile.renderMobile()">Tentar novamente</button></div>`; }
        window.lucide?.createIcons?.();
    }

    function render() {
        const mobile = isMobile(); ultimoModoMobile = mobile;
        if (mobile) return renderMobile();
        document.body.classList.remove("clientsMobileActive");
        return renderDesktop();
    }

    function obter(id) { return dados?.clientes.find(cliente => chave(cliente.id) === chave(id)); }
    function acaoContextual(cliente) { return cliente?.saldoPendente > 0 ? "receber" : contatoValido(cliente) ? "whatsapp" : "abrir"; }

    function ativarGestos() {
        document.querySelectorAll("[data-mobile-client-swipe]").forEach(wrapper => {
            if (wrapper.dataset.gestureReady) return;
            wrapper.dataset.gestureReady = "true";
            const card = wrapper.querySelector(".mobileClientCard");
            let inicioX = 0, inicioY = 0, delta = 0, horizontal = false, vibrou = false;
            const resetar = () => { card.style.transition = "transform .2s ease"; card.style.transform = ""; wrapper.removeAttribute("data-swipe-direction"); };
            wrapper.addEventListener("pointerdown", evento => { if (evento.target.closest("button,input,select,a")) return; inicioX = evento.clientX; inicioY = evento.clientY; delta = 0; horizontal = false; vibrou = false; card.style.transition = "none"; try { wrapper.setPointerCapture(evento.pointerId); } catch (_) {} });
            wrapper.addEventListener("pointermove", evento => { if (!inicioX) return; const x = evento.clientX - inicioX, y = evento.clientY - inicioY; if (!horizontal && Math.abs(x) > 9 && Math.abs(x) > Math.abs(y)) horizontal = true; if (!horizontal) return; evento.preventDefault(); delta = Math.max(-100, Math.min(100, x)); card.style.transform = `translateX(${delta}px)`; wrapper.dataset.swipeDirection = delta > 0 ? "right" : "left"; if (!vibrou && Math.abs(delta) >= 72) { navigator.vibrate?.(12); vibrou = true; } });
            const finalizar = () => { if (!inicioX) return; inicioX = 0; const executar = Math.abs(delta) >= 72, direita = delta > 0; if (executar) ignorarCliqueAte = Date.now() + 450; resetar(); if (executar) { const id = wrapper.dataset.mobileClientSwipe; direita ? api.novoPedido(id) : api.executarContextual(id); } delta = 0; };
            wrapper.addEventListener("pointerup", finalizar); wrapper.addEventListener("pointercancel", finalizar);
        });
    }

    function opcoesSelect(lista, atual) { return lista.map(([valor, rotulo]) => `<option value="${valor}" ${chave(atual) === chave(valor) ? "selected" : ""}>${rotulo}</option>`).join(""); }

    const api = {
        render, renderMobile, calcularRelacionamento,
        pesquisar(valor) { estado.busca = valor; clearTimeout(buscaTimer); buscaTimer = setTimeout(() => { estado.limite = 30; renderLista(); document.querySelector(".mobileClientsSearch button")?.toggleAttribute("hidden", !estado.busca); }, 220); },
        limparBusca() { estado.busca = ""; const campo = document.querySelector(".mobileClientsSearch input"); if (campo) campo.value = ""; renderLista(); },
        filtroRapido(valor) { estado.rapido = valor; estado.limite = 30; renderLista(); },
        carregarMais() { estado.limite += 30; renderLista(); },
        limparTudo() { estado.busca = ""; estado.rapido = "todos"; estado.filtros = {}; estado.limite = 30; renderMobile(); },
        alternar(evento, id) { if (Date.now() < ignorarCliqueAte || evento.target.closest("button,a,input,select")) return; estado.expandido = chave(estado.expandido) === chave(id) ? null : id; renderLista(); },
        abrir(id) { estado.scrollY = window.scrollY; abrirDetalhesCliente(id); },
        novoPedido(id) { const cliente = obter(id); if (cliente?.ativo === false) return Toast.show("Ative o cliente antes de criar um pedido."); novoPedidoCliente(id); },
        whatsapp(id) { if (!contatoValido(obter(id))) return Toast.show("WhatsApp não informado."); abrirWhatsappCliente(id); },
        ligar(id) { const telefone = contatoValido(obter(id)); if (!telefone) return Toast.show("Telefone não informado."); window.location.href = `tel:+55${telefone.replace(/^55/, "")}`; },
        receber(id) { const cliente = obter(id), lancamento = cliente?.lancamentoReceber; if (!lancamento) return Toast.show("Este cliente não possui saldo pendente."); abrirRecebimentoFinanceiro(lancamento.id); },
        executarContextual(id) { const cliente = obter(id), acao = acaoContextual(cliente); if (acao === "receber") return api.receber(id); if (acao === "whatsapp") return api.whatsapp(id); api.abrir(id); },
        abrirOrdenacao() { Modal.abrir("Ordenar clientes", `<div class="mobileClientSortSheet">${Object.entries({ nome_az: "Nome A–Z", nome_za: "Nome Z–A", saldo: "Maior saldo pendente", valor: "Maior valor comprado", pedidos: "Mais pedidos", recente: "Compra mais recente", distante: "Sem comprar há mais tempo", relacionamento: "Melhor relacionamento", novos: "Mais novos" }).map(([valor, rotulo]) => `<button class="${estado.ordenacao === valor ? "active" : ""}" onclick="ClientesMobile.ordenar('${valor}')"><i data-lucide="${estado.ordenacao === valor ? "check" : "arrow-up-down"}"></i>${rotulo}</button>`).join("")}</div>`); lucide.createIcons(); },
        ordenar(valor) { estado.ordenacao = valor; localStorage.setItem(SORT_KEY, valor); Modal.fechar(); renderLista(); },
        abrirFiltros() { const f = estado.filtros, cidades = [...new Set((dados?.clientes || []).map(c => c.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")); Modal.abrir("Filtrar clientes", `<div class="mobileClientFilterSheet"><label class="inputGroup"><span>Tipo</span><select id="mcfTipo">${opcoesSelect([["", "Todos"], ...Object.entries(TIPOS_CLIENTE)], f.tipo)}</select></label><label class="inputGroup"><span>Pendência</span><select id="mcfSituacao">${opcoesSelect([["", "Todas"], ["com", "Com pendência"], ["sem", "Sem pendência"]], f.situacao)}</select></label><label class="inputGroup"><span>Status</span><select id="mcfAtivo">${opcoesSelect([["", "Todos"], ["ativo", "Ativo"], ["inativo", "Inativo"]], f.ativo)}</select></label><label class="inputGroup"><span>VIP</span><select id="mcfVip">${opcoesSelect([["", "Todos"], ["sim", "Somente VIP"], ["nao", "Não VIP"]], f.vip)}</select></label><label class="inputGroup"><span>WhatsApp</span><select id="mcfWhatsapp">${opcoesSelect([["", "Todos"], ["com", "Com WhatsApp"], ["sem", "Sem WhatsApp"]], f.whatsapp)}</select></label><label class="inputGroup"><span>Cidade</span><select id="mcfCidade">${opcoesSelect([["", "Todas"], ...cidades.map(c => [c, c])], f.cidade)}</select></label><label class="inputGroup"><span>Última compra</span><select id="mcfUltima">${opcoesSelect([["", "Qualquer data"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["inativo", "Há mais de 120 dias"]], f.ultimaCompra)}</select></label><label class="inputGroup"><span>Valor comprado mínimo</span><input id="mcfValorMin" type="number" min="0" step="0.01" value="${esc(f.valorMin || "")}"></label><label class="inputGroup"><span>Valor comprado máximo</span><input id="mcfValorMax" type="number" min="0" step="0.01" value="${esc(f.valorMax || "")}"></label><label class="inputGroup"><span>Mínimo de pedidos</span><input id="mcfPedidos" type="number" min="0" step="1" value="${esc(f.pedidosMin || "")}"></label><label class="inputGroup erpFull"><span>Responsável</span><input id="mcfResponsavel" value="${esc(f.responsavel || "")}" placeholder="Nome do responsável"></label></div><div class="modalActions"><button class="btnSecondary" onclick="ClientesMobile.limparFiltros()">Limpar filtros</button><button class="btn" onclick="ClientesMobile.aplicarFiltros()">Aplicar filtros</button></div>`); lucide.createIcons(); },
        aplicarFiltros() { estado.filtros = { tipo: document.getElementById("mcfTipo")?.value || "", situacao: document.getElementById("mcfSituacao")?.value || "", ativo: document.getElementById("mcfAtivo")?.value || "", vip: document.getElementById("mcfVip")?.value || "", whatsapp: document.getElementById("mcfWhatsapp")?.value || "", cidade: document.getElementById("mcfCidade")?.value || "", ultimaCompra: document.getElementById("mcfUltima")?.value || "", valorMin: document.getElementById("mcfValorMin")?.value || "", valorMax: document.getElementById("mcfValorMax")?.value || "", pedidosMin: document.getElementById("mcfPedidos")?.value || "", responsavel: document.getElementById("mcfResponsavel")?.value.trim() || "" }; estado.limite = 30; Modal.fechar(); renderLista(); },
        limparFiltros() { estado.filtros = {}; Modal.fechar(); renderLista(); },
        alternarVip(id) { const cliente = Storage.buscarClientePorId(id); if (!cliente) return; const vip = cliente.statusRelacionamento === "vip" || (cliente.tags || []).some(tag => normalizar(tag) === "vip"); cliente.statusRelacionamento = vip ? "ativo" : "vip"; cliente.tags = (cliente.tags || []).filter(tag => normalizar(tag) !== "vip"); cliente.atualizadoEm = new Date().toISOString(); Storage.salvarCliente(cliente); Modal.fechar(); renderMobile(); Toast.show(vip ? "Cliente removido dos VIPs." : "Cliente marcado como VIP!"); },
        reativar(id) { const cliente = Storage.buscarClientePorId(id); if (!cliente) return; Storage.salvarCliente({ ...cliente, ativo: true, atualizadoEm: new Date().toISOString() }); Modal.fechar(); renderMobile(); Toast.show("Cliente reativado."); },
        menu(id) { const cliente = obter(id); if (!cliente) return; const contato = contatoValido(cliente), loja = cliente.tipo === "loja_parceira" || cliente.loja; Modal.abrir(`Ações — ${esc(cliente.nome)}`, `<div class="compactActionMenu"><button onclick="Modal.fechar();ClientesMobile.abrir('${esc(id)}')"><i data-lucide="user-round"></i><span><strong>Abrir ficha</strong><small>Visão completa do relacionamento</small></span></button><button onclick="Modal.fechar();abrirModalCliente('${esc(id)}')"><i data-lucide="pencil"></i><span><strong>Editar cliente</strong><small>Cadastro, contatos e classificação</small></span></button><button ${cliente.ativo === false ? "disabled" : ""} onclick="Modal.fechar();ClientesMobile.novoPedido('${esc(id)}')"><i data-lucide="package-plus"></i><span><strong>Novo pedido</strong><small>Criar pedido para este cliente</small></span></button>${contato ? `<button onclick="Modal.fechar();ClientesMobile.whatsapp('${esc(id)}')"><i data-lucide="message-circle"></i><span><strong>WhatsApp</strong><small>Abrir conversa</small></span></button><button onclick="Modal.fechar();ClientesMobile.ligar('${esc(id)}')"><i data-lucide="phone"></i><span><strong>Ligar</strong><small>Usar o telefone cadastrado</small></span></button>` : ""}${cliente.saldoPendente > 0 ? `<button onclick="Modal.fechar();ClientesMobile.receber('${esc(id)}')"><i data-lucide="hand-coins"></i><span><strong>Receber pagamento</strong><small>${moeda(cliente.saldoPendente)} pendentes</small></span></button>` : ""}${loja ? `<button onclick="Modal.fechar();novaConsignacaoCliente('${esc(id)}')"><i data-lucide="store"></i><span><strong>Novo consignado</strong><small>Repor produtos na loja</small></span></button>` : ""}<button onclick="ClientesMobile.alternarVip('${esc(id)}')"><i data-lucide="star"></i><span><strong>${cliente.vipManual ? "Remover VIP" : "Marcar como VIP"}</strong><small>Classificação manual do CRM</small></span></button><button onclick="Modal.fechar();registrarInteracaoCliente('${esc(id)}')"><i data-lucide="history"></i><span><strong>Registrar interação</strong><small>Contato e histórico comercial</small></span></button>${cliente.ativo === false ? `<button onclick="ClientesMobile.reativar('${esc(id)}')"><i data-lucide="rotate-ccw"></i><span><strong>Reativar</strong><small>Voltar para clientes ativos</small></span></button>` : `<button class="danger" onclick="Modal.fechar();confirmarInativarCliente('${esc(id)}')"><i data-lucide="archive"></i><span><strong>Inativar</strong><small>Preservar todo o histórico</small></span></button>`}</div>`); lucide.createIcons(); },
        _estado: estado, _montarDados: montarDados, _lista: listaFiltrada, _acaoContextual: acaoContextual
    };

    window.ClientesMobile = api;
    window.renderClientes = render;

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const mobile = isMobile();
            if (mobile === ultimoModoMobile || !document.querySelector(".clientsMobilePage,.clientGrid,.crmDetailHero")) return;
            render(); atualizarNavegacaoAtivaPrimeDocs?.("clientes");
        }, 140);
    }, { passive: true });
})();
