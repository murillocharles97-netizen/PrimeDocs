(function () {
    "use strict";

    const renderDesktop = window.renderProducao;
    const renderImpressorasDesktop = window.renderImpressoras;
    const state = { filtro: "hoje", pos: "montagem", mostrarPos: false, mostrarFilaToda: false, editorImpressora: null, swipe: null, undo: null };
    const finaisLote = new Set(["concluido", "falhou", "cancelado"]);
    const finaisOperacao = new Set(["concluida", "cancelada"]);
    let contextoAtual = null;

    const mobile = () => window.matchMedia?.("(max-width: 767px)").matches;
    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const id = valor => String(valor ?? "");
    const num = valor => Number(valor) || 0;
    const hoje = () => Utils.hoje();
    const dataBR = valor => valor ? formatarDataBR(String(valor).slice(0, 10)) : "Sem prazo";
    const tempo = valor => formatarMinutosProducao(Math.max(0, num(valor)));
    const inicioSemana = () => { const d = new Date(`${hoje()}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    const fimSemana = () => { const d = new Date(`${inicioSemana()}T12:00:00`); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); };

    function ler() {
        const ctx = ProducaoPremium._lerDados();
        const fila = ProducaoPremium._fila(ctx);
        const alertas = ProducaoPremium._alertas(ctx);
        contextoAtual = { ...ctx, fila, alertas };
        return contextoAtual;
    }

    function loteDaImpressora(impressora, ctx) {
        return (impressora.operacaoAtualId ? ctx.lotes.find(lote => id(lote.id) === id(impressora.operacaoAtualId)) : null)
            || ctx.lotes.find(lote => id(lote.impressoraId) === id(impressora.id) && ["em_execucao", "pausada", "aguardando_preparacao", "pronta_para_iniciar", "em_fila"].includes(lote.status));
    }

    function statusImpressora(impressora, ctx) {
        if (impressora.status === "offline") return "offline";
        return ProducaoPremium.normalizarStatusImpressora(impressora, loteDaImpressora(impressora, ctx));
    }

    function materialLote(lote) {
        const materiais = (lote?.filamentosSelecionados || []).map(item => `${item.material || ""} ${item.cor || ""}`.trim()).filter(Boolean);
        return materiais.join(" · ") || "Filamento a definir";
    }

    function materialImpressora(impressora) {
        const normalizada = window.FilamentIntegration?.normalizarImpressora?.(impressora) || impressora;
        const ids = [...(normalizada.slotsAms || []).map(slot => slot.filamentoId), normalizada.roloExternoId].filter(Boolean);
        const nomes = ids.map(valor => Storage.buscarFilamentoPorId(valor)).filter(Boolean).map(item => `${item.material || ""} ${item.cor || ""}`.trim());
        return nomes.join(" · ") || normalizada.materialPadrao || "Sem filamento carregado";
    }

    function melhorProximaAcao(ctx) {
        const livres = ctx.impressoras.filter(impressora => statusImpressora(impressora, ctx) === "livre");
        for (const impressora of livres) {
            const item = ctx.fila.find(registro => Producao.impressoraCompativel(impressora, registro.op) && (!registro.lote?.impressoraId || id(registro.lote.impressoraId) === id(impressora.id)));
            if (item) return { impressora, item };
        }
        return { impressora: livres[0] || null, item: null };
    }

    function contarFinalizadasHoje(ctx) {
        return ctx.lotes.filter(lote => lote.status === "concluido" && String(lote.concluidoEm || lote.atualizadoEm || lote.fim || "").startsWith(hoje())).length;
    }

    function atrasado(item) { return Boolean(item.prazo && item.prazo < hoje()); }

    function indicadores(ctx) {
        const livres = ctx.impressoras.filter(item => statusImpressora(item, ctx) === "livre").length;
        const produzindo = ctx.impressoras.filter(item => ["imprimindo", "pausada", "preparando", "aguardando_acao"].includes(statusImpressora(item, ctx))).length;
        return [
            ["free", "circle-check", livres, "Livres"],
            ["running", "play", produzindo, "Produzindo"],
            ["queue", "list-ordered", ctx.fila.length, "Na fila"],
            ["late", "clock-alert", ctx.fila.filter(atrasado).length, "Atrasadas"],
            ["done", "badge-check", contarFinalizadasHoje(ctx), "Finalizadas hoje"]
        ];
    }

    function renderCabecalho() {
        return `<header class="productionMobileTitle"><div><h1>Produção</h1><p>Centro de controle da fábrica</p></div></header>`;
    }

    function renderIndicadores(ctx) {
        return `<section class="productionMobileMetrics" aria-label="Indicadores da fábrica">${indicadores(ctx).map(([tom, icone, valor, texto]) => `<button class="tone-${tom}" type="button" onclick="ProducaoMobile.filtrarIndicador('${tom}')"><span><i data-lucide="${icone}"></i></span><strong>${valor}</strong><small>${texto}</small></button>`).join("")}</section>`;
    }

    function renderAtencao(ctx) {
        const atrasadas = ctx.fila.filter(atrasado).length;
        const total = Math.max(atrasadas, ctx.alertas.length);
        if (!total) return "";
        const texto = atrasadas ? `${atrasadas} produção${atrasadas === 1 ? "" : "ões"} atrasada${atrasadas === 1 ? "" : "s"}` : `${ctx.alertas.length} ocorrência${ctx.alertas.length === 1 ? "" : "s"} requer atenção`;
        return `<button class="productionMobileAttention" type="button" onclick="ProducaoMobile.verAtencao()"><span><i data-lucide="triangle-alert"></i><strong>${esc(texto)}</strong></span><b>Ver agora <i data-lucide="arrow-right"></i></b></button>`;
    }

    function renderProximaAcao(ctx) {
        const proxima = melhorProximaAcao(ctx);
        if (!ctx.impressoras.length) return `<section class="productionMobileNext is-empty"><span class="nextEyebrow"><i data-lucide="printer"></i> PRÓXIMA AÇÃO</span><h2>Cadastre sua primeira impressora</h2><p>A fábrica precisa de uma impressora ativa para receber as operações.</p><button onclick="navegar('impressoras')"><i data-lucide="plus"></i> Adicionar impressora</button></section>`;
        if (!proxima.impressora) return `<section class="productionMobileNext is-empty"><span class="nextEyebrow"><i data-lucide="activity"></i> PRÓXIMA AÇÃO</span><h2>Todas as impressoras estão ocupadas</h2><p>Acompanhe o carrossel abaixo para ver o andamento da fábrica.</p><button onclick="ProducaoMobile.irPara('productionMobilePrinters')">Ver impressoras <i data-lucide="arrow-down"></i></button></section>`;
        if (!proxima.item) return `<section class="productionMobileNext is-empty"><span class="nextEyebrow"><i data-lucide="circle-check"></i> PRÓXIMA AÇÃO</span><h2>${esc(proxima.impressora.nome)} está livre</h2><p>A fila compatível está vazia. Crie uma nova produção para continuar.</p><button onclick="abrirNovaProducao()"><i data-lucide="plus"></i> Nova produção</button></section>`;
        const { item, impressora } = proxima;
        const qtd = num(item.lote?.quantidade || item.op.quantidade || item.ordem?.quantidade);
        return `<section class="productionMobileNext"><span class="nextEyebrow"><i data-lucide="box"></i> PRÓXIMA AÇÃO</span><h2>${esc(impressora.nome)} está livre <i></i></h2><p>Próximo trabalho</p><h3>${esc(item.ordem?.produtoNome || item.op.produtoNome || item.op.nome)}</h3><div class="nextMeta"><span><i data-lucide="package"></i>${qtd} un.</span><span><i data-lucide="clock-3"></i>${tempo(item.lote?.tempoPrevistoMinutos || item.op.tempoPrevistoMinutos)}</span><span><i data-lucide="spool"></i>${esc(materialLote(item.lote))}</span></div><small><i data-lucide="calendar"></i> Prazo: ${esc(item.prazo ? (item.prazo === hoje() ? "Hoje" : dataBR(item.prazo)) : "Sem prazo")}</small><button onclick="ProducaoMobile.iniciarSugestao('${esc(impressora.id)}','${esc(item.op.id)}','${esc(item.lote?.id || "")}')"><i data-lucide="play"></i> Iniciar agora</button></section>`;
    }

    function progresso(lote) { return lote ? ProducaoPremium.progressoLote(lote) : null; }

    function renderImpressora(impressora, ctx) {
        const lote = loteDaImpressora(impressora, ctx);
        const status = statusImpressora(impressora, ctx);
        const op = lote ? ctx.operacaoPorId.get(id(lote.operacaoId)) : null;
        const ordem = lote ? ctx.ordemPorId.get(id(lote.ordemProducaoId)) : null;
        const pct = progresso(lote);
        const rotulos = { livre:"Livre", imprimindo:"Produzindo", pausada:"Pausada", preparando:"Preparando", aguardando_acao:"Ação necessária", falha:"Falha", manutencao:"Manutenção", inativa:"Inativa", offline:"Offline" };
        const acao = status === "livre" ? "Iniciar" : status === "pausada" ? "Retomar" : status === "preparando" ? "Preparar" : "Detalhes";
        const onclick = status === "livre" ? `ProducaoMobile.iniciarNaImpressora('${esc(impressora.id)}')` : status === "pausada" ? `retomarLoteUI('${esc(lote?.id)}')` : status === "preparando" ? `abrirPreparacaoLote('${esc(lote?.id)}')` : `abrirPainelImpressora('${esc(impressora.id)}')`;
        return `<article class="productionMobilePrinter status-${esc(status)}"><header><strong>${esc(impressora.nome || "Impressora")}</strong><span>${esc(rotulos[status] || status)}</span></header><div class="mobilePrinterVisual"><img src="${esc(ProducaoPremium.getPrinterImage(impressora))}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></div><h3>${esc(ordem?.produtoNome || op?.nome || impressora.modelo || "Pronta para usar")}</h3><p>${esc(materialImpressora(impressora))}</p>${pct === null ? `<div class="mobilePrinterProgress is-empty"><i><b></b></i><span>${status === "livre" ? "0%" : "—"}</span></div>` : `<div class="mobilePrinterProgress"><i><b style="width:${pct}%"></b></i><span>${pct}%</span></div>`}${lote && ["em_execucao", "pausada"].includes(lote.status) ? `<small>${esc(ProducaoPremium.previsaoLote(lote).texto)}</small>` : ""}<button onclick="${onclick}">${esc(acao)}</button></article>`;
    }

    function renderImpressoras(ctx) {
        return `<section id="productionMobilePrinters" class="productionMobileSection"><header><h2>Impressoras</h2><button onclick="navegar('impressoras')">Gerenciar <i data-lucide="settings-2"></i></button></header><div class="productionMobilePrinterTrack">${ctx.impressoras.map(item => renderImpressora(item, ctx)).join("")}<button class="productionMobileAddPrinter" type="button" onclick="ProducaoMobile.novaImpressora()"><i data-lucide="plus"></i><strong>Adicionar impressora</strong></button></div></section>`;
    }

    function filtrarFila(fila) {
        if (state.filtro === "atrasados") return fila.filter(atrasado);
        if (state.filtro === "hoje") return fila.filter(item => !item.prazo || item.prazo <= hoje());
        if (state.filtro === "semana") return fila.filter(item => !item.prazo || (item.prazo >= inicioSemana() && item.prazo <= fimSemana()));
        return fila;
    }

    function acaoFila(item) {
        if (!item.lote || item.lote.status === "aguardando_alocacao") return { rotulo:"Alocar", icone:"printer-check", executar:`abrirModalAlocarOperacao('${esc(item.op.id)}'${item.lote ? `,'${esc(item.lote.id)}'` : ""})` };
        if (item.lote.status === "aguardando_preparacao") return { rotulo:"Preparar", icone:"spool", executar:`abrirPreparacaoLote('${esc(item.lote.id)}')` };
        if (["em_execucao", "pausada"].includes(item.lote.status)) return { rotulo:"Finalizar", icone:"check", executar:`abrirModalConcluirLote('${esc(item.lote.id)}')` };
        return { rotulo:"Iniciar", icone:"play", executar:`ProducaoMobile.iniciarLote('${esc(item.lote.id)}')` };
    }

    function renderItemFila(item, indice) {
        const acao = acaoFila(item);
        const qtd = num(item.lote?.quantidade || item.op.quantidade || item.ordem?.quantidade);
        const pedido = item.ordem?.origem === "estoque" ? "Estoque interno" : `Pedido #${String(item.ordem?.pedidoId || item.pedido?.id || "").slice(-5)}`;
        return `<div class="productionMobileSwipe" data-production-swipe="${esc(item.id)}"><div class="productionSwipeAction"><i data-lucide="${acao.icone}"></i><span>${acao.rotulo}</span></div><article class="productionMobileQueueCard"><span class="queuePosition">${indice + 1}</span><span class="queueThumb"><i data-lucide="box"></i></span><div class="queueIdentity"><div><h3>${esc(item.ordem?.produtoNome || item.op.produtoNome || item.op.nome)}</h3><span class="priority-${esc(item.prioridade)}">${esc(item.prioridade)}</span></div><p>${esc(pedido)} · ${esc(item.prazo ? dataBR(item.prazo) : "Sem prazo")}</p><div class="queueMeta"><span><i data-lucide="package"></i>${qtd} un.</span><span><i data-lucide="clock-3"></i>${tempo(item.lote?.tempoPrevistoMinutos || item.op.tempoPrevistoMinutos)}</span><span><i data-lucide="spool"></i>${esc(materialLote(item.lote))}</span></div><footer><button onclick="${acao.executar}"><i data-lucide="${acao.icone}"></i>${acao.rotulo}</button><button onclick="ProducaoPremium.abrirMenuFila('${esc(item.id)}')" aria-label="Mais ações"><i data-lucide="ellipsis"></i></button></footer></div></article></div>`;
    }

    function renderFila(ctx) {
        const lista = filtrarFila(ctx.fila);
        const visiveis = state.mostrarFilaToda ? lista : lista.slice(0, 5);
        const filtros = [["hoje","Hoje"],["atrasados",`Atrasados${ctx.fila.filter(atrasado).length ? ` (${ctx.fila.filter(atrasado).length})` : ""}`],["semana","Esta semana"],["todos","Todos"]];
        return `<section id="productionMobileQueue" class="productionMobileSection productionMobileQueue"><header><h2>Fila de produção</h2>${lista.length > 5 ? `<button onclick="ProducaoMobile.alternarFila()">${state.mostrarFilaToda ? "Ver menos" : "Ver todas"}</button>` : ""}</header><nav>${filtros.map(([valor, rotulo]) => `<button class="${state.filtro === valor ? "active" : ""}" onclick="ProducaoMobile.filtrar('${valor}')">${rotulo}</button>`).join("")}</nav><div class="productionMobileQueueList">${visiveis.length ? visiveis.map(renderItemFila).join("") : `<div class="productionMobileEmpty"><i data-lucide="list-checks"></i><strong>Nenhuma produção neste filtro</strong><p>As operações válidas aparecerão automaticamente aqui.</p></div>`}</div></section>`;
    }

    function operacoesPos(ctx, tipo) {
        return ctx.operacoes.filter(op => op.tipo === tipo && !finaisOperacao.has(op.status) && (!op.dependencias?.length || op.dependencias.every(dep => ctx.operacaoPorId.get(id(dep))?.status === "concluida")));
    }

    function renderPosProducao(ctx) {
        const tipos = [["montagem","Montagem","blocks"],["acabamento","Acabamento","wand-sparkles"],["conferencia","Conferência","scan-line"]];
        const lista = operacoesPos(ctx, state.pos);
        return `<section class="productionMobileSection productionMobilePost"><header><h2>Pós-produção</h2><button onclick="ProducaoMobile.alternarPos()">${state.mostrarPos ? "Fechar" : "Ver etapas"}</button></header><nav>${tipos.map(([tipo, nome, icone]) => `<button class="post-${tipo} ${state.pos === tipo && state.mostrarPos ? "active" : ""}" onclick="ProducaoMobile.abrirPos('${tipo}')"><i data-lucide="${icone}"></i><span>${nome}</span><strong>${operacoesPos(ctx, tipo).length}</strong></button>`).join("")}</nav>${state.mostrarPos ? `<div class="productionMobilePostList">${lista.length ? lista.map(op => { const ordem = ctx.ordemPorId.get(id(op.ordemProducaoId)); const iniciado = op.status === "em_execucao"; return `<article><span><i data-lucide="${state.pos === "montagem" ? "blocks" : state.pos === "acabamento" ? "wand-sparkles" : "scan-line"}"></i></span><div><strong>${esc(ordem?.produtoNome || op.nome)}</strong><small>${num(op.quantidade || ordem?.quantidade)} un. · ${esc(op.nome)}</small></div><button onclick="executarAcaoManual('${esc(op.id)}','${iniciado ? "concluir" : "iniciar"}')">${iniciado ? "Concluir" : "Iniciar"}</button></article>`; }).join("") : `<div class="productionMobileEmpty compact">Nenhuma operação nesta etapa.</div>`}</div>` : ""}</section>`;
    }

    function fab(ctx) {
        if (!ctx.impressoras.length) return { icone:"printer", rotulo:"Adicionar impressora", acao:"ProducaoMobile.novaImpressora()" };
        const proxima = melhorProximaAcao(ctx);
        if (proxima.impressora && proxima.item) return { icone:"play", rotulo:"Iniciar produção", acao:`ProducaoMobile.iniciarSugestao('${esc(proxima.impressora.id)}','${esc(proxima.item.op.id)}','${esc(proxima.item.lote?.id || "")}')` };
        return { icone:"plus", rotulo:"Nova produção", acao:"abrirNovaProducao()" };
    }

    function renderMobile() {
        clearInterval(window.producaoTimer);
        const ctx = ler();
        const acaoFab = fab(ctx);
        app.innerHTML = `<main class="productionMobilePage">${renderCabecalho()}${renderIndicadores(ctx)}${renderAtencao(ctx)}${renderProximaAcao(ctx)}${renderImpressoras(ctx)}${renderPosProducao(ctx)}${renderFila(ctx)}<button class="productionMobileFab" onclick="${acaoFab.acao}" aria-label="${esc(acaoFab.rotulo)}"><i data-lucide="${acaoFab.icone}"></i><span>${esc(acaoFab.rotulo)}</span></button><div id="productionMobileSnackbar" class="productionMobileSnackbar" aria-live="polite"></div></main>`;
        renderNavegacaoInferiorPrimeDocs("producao");
        atualizarNavegacaoAtivaPrimeDocs("producao");
        lucide.createIcons();
        requestAnimationFrame(vincularSwipes);
    }

    function render() { return mobile() ? renderMobile() : renderDesktop(); }

    function mostrarSnackbar(texto, desfazer) {
        const elemento = document.getElementById("productionMobileSnackbar");
        if (!elemento) return;
        clearTimeout(state.undo?.timer);
        state.undo = { desfazer };
        elemento.innerHTML = `<span>${esc(texto)}</span>${desfazer ? `<button onclick="ProducaoMobile.desfazer()">Desfazer</button>` : ""}`;
        elemento.classList.add("show");
        state.undo.timer = setTimeout(() => { elemento.classList.remove("show"); state.undo = null; }, 5000);
    }

    function executarSwipe(elemento) {
        const item = contextoAtual?.fila.find(registro => id(registro.id) === id(elemento.dataset.productionSwipe));
        if (!item) return;
        const acao = acaoFila(item);
        elemento.classList.remove("is-swiping");
        if (!item.lote || ["aguardando_alocacao", "aguardando_preparacao"].includes(item.lote.status)) {
            Function(acao.executar)();
            mostrarSnackbar(item.lote?.status === "aguardando_preparacao" ? "Preparação aberta" : "Alocação aberta");
            return;
        }
        if (["em_execucao", "pausada"].includes(item.lote.status)) {
            abrirModalConcluirLote(item.lote.id);
            mostrarSnackbar("Finalização aberta");
            return;
        }
        api.iniciarLote(item.lote.id);
    }

    function vincularSwipes() {
        document.querySelectorAll("[data-production-swipe]").forEach(elemento => {
            let origem = 0, atual = 0, arrastando = false;
            elemento.addEventListener("pointerdown", evento => { origem = evento.clientX; atual = 0; arrastando = true; elemento.setPointerCapture?.(evento.pointerId); });
            elemento.addEventListener("pointermove", evento => { if (!arrastando) return; atual = Math.max(0, Math.min(105, evento.clientX - origem)); elemento.style.setProperty("--swipe-x", `${atual}px`); elemento.classList.toggle("is-swiping", atual > 8); });
            const finalizar = () => { if (!arrastando) return; arrastando = false; elemento.style.setProperty("--swipe-x", "0px"); if (atual >= 76) executarSwipe(elemento); else elemento.classList.remove("is-swiping"); atual = 0; };
            elemento.addEventListener("pointerup", finalizar); elemento.addEventListener("pointercancel", finalizar);
        });
    }

    function renderCadastroImpressoras() {
        const impressoras = Storage.listarImpressoras().filter(item => item.ativa !== false);
        app.innerHTML = `<main class="mobilePrinterManager"><header><button onclick="navegar('producao')" aria-label="Voltar"><i data-lucide="arrow-left"></i></button><div><h1>Impressoras</h1><p>Cadastre e mantenha as máquinas da fábrica.</p></div><button onclick="ProducaoMobile.novaImpressora()"><i data-lucide="plus"></i></button></header><section class="mobilePrinterManagerList">${impressoras.length ? impressoras.map(item => `<article><span><img src="${esc(ProducaoPremium.getPrinterImage(item))}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span><div><strong>${esc(item.nome)}</strong><small>${esc(item.modelo || "Modelo não informado")}</small><em>${esc(item.status || "livre")}</em></div><button onclick="ProducaoMobile.editarImpressora('${esc(item.id)}')"><i data-lucide="pencil"></i> Editar</button></article>`).join("") : `<div class="productionMobileEmpty"><i data-lucide="printer"></i><strong>Nenhuma impressora cadastrada</strong><p>Adicione a primeira máquina para começar a produzir.</p></div>`}</section><button class="mobilePrinterManagerNew" onclick="ProducaoMobile.novaImpressora()"><i data-lucide="plus"></i> Nova impressora</button></main>`;
        atualizarNavegacaoAtivaPrimeDocs("impressoras"); lucide.createIcons();
    }

    function renderEditorImpressora(item) {
        const status = item?.status || "livre";
        app.innerHTML = `<main class="mobilePrinterEditor"><header><button onclick="ProducaoMobile.cancelarImpressora()"><i data-lucide="arrow-left"></i></button><div><h1>${item ? "Editar" : "Nova"} impressora</h1><p>Dados operacionais da máquina.</p></div></header><form onsubmit="event.preventDefault();ProducaoMobile.salvarImpressora('${esc(item?.id || "")}')"><label><span>Nome *</span><input id="mobilePrinterName" value="${esc(item?.nome || "")}" placeholder="Ex.: A1 Mini 001" required></label><label><span>Modelo</span><input id="mobilePrinterModel" value="${esc(item?.modelo || "")}" placeholder="Ex.: Bambu Lab A1 Mini"></label><label><span>Área útil</span><input id="mobilePrinterArea" value="${esc(item?.tamanhoMesa || "")}" placeholder="180 × 180 × 180 mm"></label><label><span>Velocidade padrão (mm/s)</span><input id="mobilePrinterSpeed" type="number" min="0" step="1" value="${esc(item?.velocidadePadrao || "")}" placeholder="250"></label><label><span>Material padrão</span><input id="mobilePrinterMaterial" value="${esc(item?.materialPadrao || "")}" placeholder="PLA, PETG..."></label><label><span>Status</span><select id="mobilePrinterStatus"><option value="livre" ${status === "livre" ? "selected" : ""}>Livre</option><option value="offline" ${status === "offline" ? "selected" : ""}>Offline</option><option value="manutencao" ${status === "manutencao" ? "selected" : ""}>Em manutenção</option></select></label><label class="wide"><span>Observações</span><textarea id="mobilePrinterNotes" rows="4" placeholder="Informações úteis para a operação">${esc(item?.observacoes || "")}</textarea></label><footer><button type="button" onclick="ProducaoMobile.cancelarImpressora()">Cancelar</button><button type="submit"><i data-lucide="save"></i> Salvar</button></footer>${item ? `<button class="mobilePrinterDelete" type="button" onclick="ProducaoMobile.solicitarExcluirImpressora('${esc(item.id)}')"><i data-lucide="trash-2"></i> Excluir impressora</button>` : ""}</form></main>`;
        lucide.createIcons();
    }

    function renderImpressoras() {
        if (!mobile()) return renderImpressorasDesktop();
        if (state.editorImpressora !== null) return renderEditorImpressora(state.editorImpressora === "nova" ? null : Storage.buscarImpressoraPorId(state.editorImpressora));
        return renderCadastroImpressoras();
    }

    const api = {
        render,
        renderImpressoras,
        filtrar(valor) { state.filtro = valor; renderMobile(); requestAnimationFrame(() => document.getElementById("productionMobileQueue")?.scrollIntoView({ behavior:"smooth", block:"start" })); },
        filtrarIndicador(tom) { if (tom === "late") return this.filtrar("atrasados"); if (tom === "queue") return this.filtrar("todos"); if (tom === "free" || tom === "running") return this.irPara("productionMobilePrinters"); },
        verAtencao() { state.filtro = contextoAtual?.fila.some(atrasado) ? "atrasados" : "todos"; renderMobile(); requestAnimationFrame(() => document.getElementById("productionMobileQueue")?.scrollIntoView({ behavior:"smooth", block:"start" })); },
        irPara(alvo) { document.getElementById(alvo)?.scrollIntoView({ behavior:"smooth", block:"start" }); },
        alternarFila() { state.mostrarFilaToda = !state.mostrarFilaToda; renderMobile(); },
        alternarPos() { state.mostrarPos = !state.mostrarPos; renderMobile(); },
        abrirPos(tipo) { state.pos = tipo; state.mostrarPos = true; renderMobile(); },
        iniciarSugestao(impressoraId, operacaoId, loteId) { ProducaoPremium.iniciarSugestao(impressoraId, operacaoId, loteId); },
        iniciarNaImpressora(impressoraId) { const item = contextoAtual?.fila.find(registro => Producao.impressoraCompativel(Storage.buscarImpressoraPorId(impressoraId), registro.op)); if (item) return this.iniciarSugestao(impressoraId, item.op.id, item.lote?.id || ""); abrirNovaProducao(); },
        async iniciarLote(loteId) {
            try {
                Toast.show("Validando impressora e reservas...");
                await Producao.iniciarLoteExecucao(loteId);
                Modal.fechar();
                renderMobile();
                mostrarSnackbar("Produção iniciada", () => pausarLoteUI(loteId));
                return true;
            } catch (erro) {
                console.error(erro);
                Toast.show(erro.message || "Não foi possível iniciar.", "error");
                return false;
            }
        },
        desfazer() { const acao = state.undo?.desfazer; clearTimeout(state.undo?.timer); state.undo = null; document.getElementById("productionMobileSnackbar")?.classList.remove("show"); if (acao) { acao(); Toast.show("Ação desfeita."); } },
        novaImpressora() { state.editorImpressora = "nova"; navegar("impressoras"); },
        editarImpressora(impressoraId) { state.editorImpressora = impressoraId; renderImpressoras(); },
        cancelarImpressora() { state.editorImpressora = null; renderCadastroImpressoras(); },
        salvarImpressora(impressoraId) {
            const nome = document.getElementById("mobilePrinterName")?.value.trim();
            if (!nome) return Toast.show("Informe o nome da impressora.", "error");
            const anterior = impressoraId ? Storage.buscarImpressoraPorId(impressoraId) : null;
            const agora = new Date().toISOString();
            const registro = window.FilamentIntegration?.normalizarImpressora?.({ ...anterior, id:anterior?.id || `imp-${Date.now()}`, nome, modelo:document.getElementById("mobilePrinterModel").value.trim(), tamanhoMesa:document.getElementById("mobilePrinterArea").value.trim(), velocidadePadrao:num(document.getElementById("mobilePrinterSpeed").value), materialPadrao:document.getElementById("mobilePrinterMaterial").value.trim(), observacoes:document.getElementById("mobilePrinterNotes").value.trim(), status:document.getElementById("mobilePrinterStatus").value, ativa:true, criadoEm:anterior?.criadoEm || agora, atualizadoEm:agora }) || { ...anterior, id:anterior?.id || `imp-${Date.now()}`, nome, ativo:true, criadoEm:anterior?.criadoEm || agora, atualizadoEm:agora };
            Storage.salvarImpressora(registro); state.editorImpressora = null; renderCadastroImpressoras(); Toast.show("Impressora salva com sucesso!", "success");
        },
        solicitarExcluirImpressora(impressoraId) {
            const item = Storage.buscarImpressoraPorId(impressoraId);
            const loteAtivo = Storage.listarLotesExecucao().some(lote => id(lote.impressoraId) === id(impressoraId) && !finaisLote.has(lote.status));
            if (item?.operacaoAtualId || item?.filaOperacoes?.length || loteAtivo) return Toast.show("Esta impressora possui produção ou fila ativa. Libere as operações antes de excluir.", "error");
            Modal.abrir("Excluir impressora?", `<p class="confirmationText">${esc(item?.nome || "Esta impressora")} será inativada e permanecerá no histórico.</p><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn dangerButton" onclick="ProducaoMobile.confirmarExcluirImpressora('${esc(impressoraId)}')">Excluir</button></div>`); lucide.createIcons();
        },
        confirmarExcluirImpressora(impressoraId) { Storage.excluirImpressora(impressoraId); Modal.fechar(); state.editorImpressora = null; renderCadastroImpressoras(); Toast.show("Impressora inativada."); },
        _ler: ler, _filtrarFila: filtrarFila, _melhorAcao: melhorProximaAcao, _statusImpressora: statusImpressora
    };

    window.ProducaoMobile = api;
    window.renderProducao = render;
    window.renderImpressoras = renderImpressoras;
})();
