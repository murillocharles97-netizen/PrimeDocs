(function () {
    "use strict";

    const STATUS_FINAIS_LOTE = new Set(["concluido", "falhou", "cancelado"]);
    const STATUS_FINAIS_OPERACAO = new Set(["concluida", "cancelada"]);
    const STATUS_FILA = new Set(["aguardando_alocacao", "aguardando_preparacao", "pronta_para_iniciar", "em_fila"]);
    const state = { posProducao: "montagem", renderToken: 0 };
    let contextoAtual = null;

    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const num = valor => Number(valor) || 0;
    const chave = valor => String(valor ?? "");
    const soma = (lista, obter) => lista.reduce((total, item) => total + num(obter(item)), 0);
    const hoje = () => Utils.hoje();
    const dataBR = valor => valor ? formatarDataBR(String(valor).slice(0, 10)) : "Sem prazo";
    const minutos = valor => formatarMinutosProducao(Math.max(0, num(valor)));

    function agrupar(lista, campo) {
        return lista.reduce((mapa, item) => {
            const id = chave(item[campo]);
            if (!mapa.has(id)) mapa.set(id, []);
            mapa.get(id).push(item);
            return mapa;
        }, new Map());
    }

    function lerDados() {
        Producao.migrarDados();
        const impressoras = Storage.listarImpressoras().filter(item => item.ativa !== false);
        const ordens = Storage.listarOrdensProducao().filter(item => item.ativo !== false && item.status !== "cancelada");
        const operacoes = Storage.listarOperacoesProducao().filter(item => item.status !== "cancelada");
        const lotes = Storage.listarLotesExecucao().filter(item => item.status !== "cancelado");
        const pedidos = Storage.listarPedidos().filter(item => item.ativo !== false);
        const produtos = Storage.listarProdutos().filter(item => item.ativo !== false);
        const filamentos = Storage.listarFilamentos().filter(item => item.ativo !== false);
        return {
            impressoras, ordens, operacoes, lotes, pedidos, produtos, filamentos,
            ordemPorId: new Map(ordens.map(item => [chave(item.id), item])),
            operacaoPorId: new Map(operacoes.map(item => [chave(item.id), item])),
            pedidoPorId: new Map(pedidos.map(item => [chave(item.id), item])),
            produtoPorId: new Map(produtos.map(item => [chave(item.id), item])),
            impressoraPorId: new Map(impressoras.map(item => [chave(item.id), item])),
            lotesPorImpressora: agrupar(lotes, "impressoraId"),
            lotesPorOperacao: agrupar(lotes, "operacaoId"),
            operacoesPorOrdem: agrupar(operacoes, "ordemProducaoId")
        };
    }

    function loteAtualImpressora(impressora, ctx) {
        const vinculado = impressora.operacaoAtualId ? ctx.lotes.find(lote => chave(lote.id) === chave(impressora.operacaoAtualId)) : null;
        return vinculado || (ctx.lotesPorImpressora.get(chave(impressora.id)) || []).find(lote => ["em_execucao", "pausada", "aguardando_preparacao", "pronta_para_iniciar"].includes(lote.status));
    }

    function normalizarStatusImpressora(impressora, lote) {
        if (impressora.ativa === false) return "inativa";
        if (["manutencao", "manutenção"].includes(impressora.status)) return "manutencao";
        if (["falha", "erro"].includes(impressora.status) || lote?.status === "falhou") return "falha";
        if (lote?.status === "pausada") return "pausada";
        if (lote?.status === "aguardando_preparacao") return "aguardando_acao";
        if (["pronta_para_iniciar", "em_fila"].includes(lote?.status)) return "preparando";
        if (lote?.status === "em_execucao") return "imprimindo";
        return "livre";
    }

    function normalizarStatusOperacao(operacao, lote) {
        if (operacao.status === "concluida") return "concluida";
        if (operacao.status === "cancelada") return "cancelada";
        if (operacao.status === "falhou" || lote?.status === "falhou") return "falhou";
        if (operacao.tipo === "montagem" && !STATUS_FINAIS_OPERACAO.has(operacao.status)) return "montagem";
        if (operacao.tipo === "acabamento" && !STATUS_FINAIS_OPERACAO.has(operacao.status)) return "acabamento";
        if (lote?.status === "aguardando_preparacao") return "preparando";
        if (lote?.status === "pronta_para_iniciar") return "alocada";
        if (lote?.status === "em_fila") return "em_fila";
        if (lote?.status === "em_execucao") return "executando";
        if (lote?.status === "pausada") return "pausada";
        return "aguardando";
    }

    function progressoLote(lote) {
        if (!lote) return null;
        if (lote.status === "concluido") return 100;
        if (Number.isFinite(Number(lote.progresso)) && num(lote.progresso) > 0) return Math.min(99, Math.max(0, Math.round(num(lote.progresso))));
        if (lote.iniciadoEm && num(lote.tempoPrevistoMinutos) > 0) return Math.min(99, Math.max(0, Producao.calcularProgressoLote(lote)));
        return null;
    }

    function previsaoLote(lote) {
        if (!lote || !lote.iniciadoEm || !num(lote.tempoPrevistoMinutos)) return { texto: "Previsão indisponível", horario: "" };
        if (lote.status === "pausada") return { texto: "Previsão suspensa", horario: "" };
        const decorrido = Producao.calcularTempoDecorrido(lote);
        const restante = num(lote.tempoPrevistoMinutos) - decorrido;
        if (restante < 0) return { texto: `Atrasada em ${minutos(Math.abs(restante))}`, horario: "" };
        const fim = new Date(Date.now() + restante * 60000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return { texto: `${minutos(restante)} restantes`, horario: `Previsão: ${fim}` };
    }

    function getPrinterImage(printer) {
        return window.CentralOperacoes?.getPrinterImage?.(printer) || "assets/printers/generic-printer.svg";
    }

    function PrinterIllustration(printer) {
        return `<span class="factoryPrinterIllustration"><img src="${esc(getPrinterImage(printer))}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span>`;
    }

    function PrinterStatusBadge(status) {
        const dados = {
            livre: ["Livre", "circle-check"], preparando: ["Preparando", "loader-circle"], imprimindo: ["Imprimindo", "activity"],
            pausada: ["Pausada", "pause"], aguardando_acao: ["Aguardando ação", "triangle-alert"], falha: ["Falha", "circle-alert"],
            manutencao: ["Manutenção", "wrench"], inativa: ["Inativa", "power-off"]
        }[status] || [status, "circle"];
        return `<span class="factoryStatusBadge status-${status}"><i data-lucide="${dados[1]}"></i>${dados[0]}</span>`;
    }

    function filaProducao(ctx) {
        const itens = [];
        ctx.operacoes.filter(op => op.tipo === "impressao" && !STATUS_FINAIS_OPERACAO.has(op.status)).forEach(op => {
            const lotes = (ctx.lotesPorOperacao.get(chave(op.id)) || []).filter(lote => !STATUS_FINAIS_LOTE.has(lote.status));
            if (!lotes.length && ["aguardando", "aguardando_dependencia", "aguardando_alocacao"].includes(op.status)) itens.push(criarItemFila(op, null, ctx));
            lotes.filter(lote => STATUS_FILA.has(lote.status)).forEach(lote => itens.push(criarItemFila(op, lote, ctx)));
        });
        return itens.sort((a, b) => a.prioridadeOrdem - b.prioridadeOrdem || a.posicao - b.posicao || String(a.prazo || "9999").localeCompare(String(b.prazo || "9999")));
    }

    function prioridadeItem(op, lote, ordem) {
        const explicita = lote?.prioridade || op.prioridade;
        if (explicita) return explicita;
        const prazo = ordem?.prazo;
        if (prazo && prazo < hoje()) return "alta";
        if (prazo && prazo <= new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return "alta";
        return "media";
    }

    function criarItemFila(op, lote, ctx) {
        const ordem = ctx.ordemPorId.get(chave(op.ordemProducaoId));
        const pedido = ordem?.pedidoId ? ctx.pedidoPorId.get(chave(ordem.pedidoId)) : null;
        const prioridade = prioridadeItem(op, lote, ordem);
        const compativeis = ctx.impressoras.filter(imp => Producao.impressoraCompativel(imp, op));
        return {
            id: lote?.id || op.id, op, lote, ordem, pedido, prioridade,
            prioridadeOrdem: { alta: 0, media: 1, baixa: 2 }[prioridade] ?? 1,
            posicao: num(lote?.posicaoFila) || 999,
            prazo: ordem?.prazo || pedido?.dataEntregaPrevista || "",
            compativeis
        };
    }

    function sugerirOperacao(impressora, fila) {
        return fila.find(item => Producao.impressoraCompativel(impressora, item.op) && (!item.lote?.impressoraId || chave(item.lote.impressoraId) === chave(impressora.id)));
    }

    function calcularCargaPrevista(ctx, fila) {
        if (!ctx.impressoras.length) return 0;
        const cargas = new Map(ctx.impressoras.map(imp => [chave(imp.id), 0]));
        ctx.impressoras.forEach(imp => {
            const lotes = ctx.lotesPorImpressora.get(chave(imp.id)) || [];
            cargas.set(chave(imp.id), soma(lotes.filter(lote => ["em_execucao", "pausada", "em_fila", "pronta_para_iniciar", "aguardando_preparacao"].includes(lote.status)), lote => {
                if (["em_execucao", "pausada"].includes(lote.status)) return Math.max(0, num(lote.tempoPrevistoMinutos) - Producao.calcularTempoDecorrido(lote));
                return lote.tempoPrevistoMinutos;
            }));
        });
        fila.filter(item => !item.lote?.impressoraId).forEach(item => {
            const possiveis = item.compativeis.length ? item.compativeis : ctx.impressoras;
            const alvo = [...possiveis].sort((a, b) => num(cargas.get(chave(a.id))) - num(cargas.get(chave(b.id))))[0];
            if (alvo) cargas.set(chave(alvo.id), num(cargas.get(chave(alvo.id))) + num(item.op.tempoPrevistoMinutos));
        });
        return Math.max(0, ...cargas.values());
    }

    function alertasProducao(ctx) {
        const alertas = [];
        ctx.lotes.filter(lote => lote.status === "pausada").forEach(lote => alertas.push(criarAlerta("pausa", lote, ctx, "Impressão pausada", "Retomar", `ProducaoPremium.resolverAlerta('pausa','${esc(lote.id)}')`)));
        ctx.lotes.filter(lote => {
            if (lote.status !== "falhou") return false;
            const operacao = ctx.operacaoPorId.get(chave(lote.operacaoId));
            const tentativas = ctx.lotesPorOperacao.get(chave(lote.operacaoId)) || [];
            return operacao?.status === "falhou" && !tentativas.some(tentativa => chave(tentativa.tentativaDe) === chave(lote.id) && !STATUS_FINAIS_LOTE.has(tentativa.status));
        }).forEach(lote => alertas.push(criarAlerta("falha", lote, ctx, lote.motivoFalha || "Falha de impressão", "Nova tentativa", `ProducaoPremium.resolverAlerta('falha','${esc(lote.id)}')`)));
        ctx.lotes.filter(lote => lote.status === "aguardando_preparacao").forEach(lote => alertas.push(criarAlerta("filamento", lote, ctx, "Troca de filamento necessária", "Preparar", `abrirPreparacaoLote('${esc(lote.id)}')`)));
        ctx.impressoras.filter(imp => num(imp.limiteManutencaoHoras) > 0 && num(imp.horasDesdeManutencao) >= num(imp.limiteManutencaoHoras)).forEach(imp => alertas.push({ id:`man-${imp.id}`, tipo:"manutencao", titulo:imp.nome, descricao:"Manutenção vencida", detalhe:`${num(imp.horasDesdeManutencao).toFixed(0)} h de uso`, acao:"Ver cadastro", onclick:`navegar('impressoras')` }));
        ctx.ordens.filter(ordem => ordem.prazo && ordem.prazo < hoje() && ordem.status !== "concluida").forEach(ordem => alertas.push({ id:`atraso-${ordem.id}`, tipo:"atraso", titulo:ordem.produtoNome, descricao:"Pedido ou produção atrasada", detalhe:`Prazo ${dataBR(ordem.prazo)}`, acao:"Ver ordem", onclick:`abrirDetalhesOrdemProducao('${esc(ordem.id)}')` }));
        return alertas;
    }

    function criarAlerta(tipo, lote, ctx, descricao, acao, onclick) {
        const ordem = ctx.ordemPorId.get(chave(lote.ordemProducaoId));
        const imp = ctx.impressoraPorId.get(chave(lote.impressoraId));
        return { id:`${tipo}-${lote.id}`, tipo, titulo:imp?.nome || ordem?.produtoNome || "Produção", descricao, detalhe:ordem?.produtoNome || "Operação afetada", acao, onclick };
    }

    function ProductionHeader(ctx) {
        const ocupadas = ctx.impressoras.filter(imp => ["imprimindo", "pausada", "aguardando_acao", "preparando"].includes(normalizarStatusImpressora(imp, loteAtualImpressora(imp, ctx)))).length;
        const livres = ctx.impressoras.length - ocupadas;
        return `<header class="factoryHeader"><div class="factoryHeaderTitle"><span><i data-lucide="factory"></i></span><div><h1>Produção</h1><p>Centro de controle da fábrica · ${ctx.impressoras.length} impressora${ctx.impressoras.length === 1 ? "" : "s"} · ${ocupadas} trabalhando · ${livres} livre${livres === 1 ? "" : "s"}</p></div></div><button class="btn factoryNewButton" onclick="abrirNovaProducao()"><i data-lucide="plus"></i> Nova produção</button></header>`;
    }

    function ProductionKpiStrip(ctx, fila, alertas) {
        const execucao = ctx.lotes.filter(lote => lote.status === "em_execucao").length;
        const livres = ctx.impressoras.filter(imp => normalizarStatusImpressora(imp, loteAtualImpressora(imp, ctx)) === "livre").length;
        const capacidade = ctx.impressoras.length ? Math.round(execucao / ctx.impressoras.length * 100) : 0;
        const carga = calcularCargaPrevista(ctx, fila);
        const dados = [
            ["execution", "activity", execucao, "Em execução", `${capacidade}% da capacidade`, "factoryOverview"],
            ["queue", "list-ordered", fila.length, "Na fila", `${fila.length} operação${fila.length === 1 ? "" : "ões"} aguardando`, "productionQueue"],
            ["free", "monitor-check", livres, livres === 1 ? "Impressora livre" : "Impressoras livres", livres ? "Disponível agora" : "Todas ocupadas", "factoryOverview"],
            ["load", "calendar-clock", minutos(carga), "Carga prevista", "Maior previsão da fábrica", "productionQueue"],
            ["alerts", "triangle-alert", alertas.length, "Bloqueio / Falha", alertas.length ? "Requer atenção" : "Operação saudável", "productionAlerts"]
        ];
        return `<section class="factoryKpiStrip">${dados.map(item => `<button class="factoryKpi tone-${item[0]}" type="button" onclick="ProducaoPremium.irPara('${item[5]}')" ${item[0] === "load" ? `title="Carga paralela: maior tempo entre as impressoras, incluindo execução, filas e compatibilidade."` : ""}><span><i data-lucide="${item[1]}"></i></span><div><strong>${esc(item[2])}</strong><b>${item[3]}</b><small>${item[4]}</small></div></button>`).join("")}</section>`;
    }

    function PrinterOperationCard(impressora, ctx, fila) {
        const lote = loteAtualImpressora(impressora, ctx);
        const status = normalizarStatusImpressora(impressora, lote);
        const op = lote ? ctx.operacaoPorId.get(chave(lote.operacaoId)) : null;
        const ordem = lote ? ctx.ordemPorId.get(chave(lote.ordemProducaoId)) : null;
        const sugestao = status === "livre" ? sugerirOperacao(impressora, fila) : null;
        if (["aguardando_acao", "falha", "manutencao"].includes(status)) return PrinterAttentionCard(impressora, lote, op, ordem, status);
        if (status === "livre") return PrinterFreeCard(impressora, sugestao);
        return PrinterRunningCard(impressora, lote, op, ordem, status);
    }

    function cabecalhoImpressora(impressora, status) {
        return `<header><div><h3>${esc(impressora.nome || "Impressora")}</h3><span><i></i> ${esc(impressora.status === "offline" ? "Offline" : "Online")}</span></div>${PrinterStatusBadge(status)}</header>`;
    }

    function PrinterRunningCard(impressora, lote, op, ordem, status) {
        const prog = progressoLote(lote);
        const previsao = previsaoLote(lote);
        const origem = ordem?.origem === "estoque" ? "Produção para estoque" : `Pedido #${String(ordem?.pedidoId || lote?.pedidoId || "").slice(-5)}`;
        const acaoContextual = status === "pausada"
            ? `<button onclick="retomarLoteUI('${esc(lote.id)}')"><i data-lucide="play"></i> Retomar</button>`
            : status === "preparando"
                ? `<button onclick="iniciarLoteUI('${esc(lote.id)}')"><i data-lucide="play"></i> Iniciar</button>`
                : `<button onclick="pausarLoteUI('${esc(lote.id)}')"><i data-lucide="pause"></i> Pausar</button>`;
        return `<article class="factoryPrinterCard is-running status-${status}" data-factory-lot="${esc(lote.id)}">${cabecalhoImpressora(impressora, status)}<div class="factoryPrinterBody">${PrinterIllustration(impressora)}<div class="factoryOperationInfo"><h4>${esc(ordem?.produtoNome || op?.produtoNome || op?.nome || "Produção em andamento")}</h4><p>${esc(origem)} · ${num(lote.quantidade)} unidade${num(lote.quantidade) === 1 ? "" : "s"}</p>${prog === null ? `<div class="factoryProgressUnavailable">Progresso indisponível</div>` : `<div class="factoryLiveProgress"><i><b style="width:${prog}%"></b></i><strong data-factory-progress>${prog}%</strong></div>`}<div class="factoryTime"><strong data-factory-time>${esc(previsao.texto)}</strong><span data-factory-end>${esc(previsao.horario)}</span></div><div class="factoryMaterials">${(lote.filamentosSelecionados || []).map(material => `<span><i class="materialDot"></i>${esc(material.material)} ${esc(material.cor)}${material.tipoCarregamento === "ams" ? ` · Slot ${esc(material.slotAms)}` : ""}</span>`).join("") || `<span>Materiais não informados</span>`}</div></div></div><footer><button onclick="abrirDetalhesOrdemProducao('${esc(ordem?.id)}')"><i data-lucide="activity"></i> Ver produção</button>${acaoContextual}<button class="factoryMore" onclick="abrirMenuLote('${esc(lote.id)}')" aria-label="Mais ações"><i data-lucide="ellipsis"></i></button></footer></article>`;
    }

    function PrinterFreeCard(impressora, sugestao) {
        return `<article class="factoryPrinterCard is-free">${cabecalhoImpressora(impressora, "livre")}<div class="factoryPrinterBody">${PrinterIllustration(impressora)}<div class="factoryOperationInfo"><h4>Nenhuma operação</h4><p>Pronta para iniciar</p>${sugestao ? `<section class="factoryNextSuggestion"><span>Próxima sugestão</span><strong>${esc(sugestao.ordem?.produtoNome || sugestao.op.nome)}</strong><small>${num(sugestao.lote?.quantidade || sugestao.op.quantidade)} un. · ${minutos(sugestao.lote?.tempoPrevistoMinutos || sugestao.op.tempoPrevistoMinutos)}</small></section><small class="factoryCompatibility">Compatível com esta impressora</small>` : `<section class="factoryNextSuggestion is-empty"><strong>A fila compatível está vazia</strong><small>Crie uma nova produção para começar.</small></section>`}</div></div><footer><button class="primary" onclick="${sugestao ? `ProducaoPremium.iniciarSugestao('${esc(impressora.id)}','${esc(sugestao.op.id)}','${esc(sugestao.lote?.id || "")}')` : "abrirNovaProducao()"}"><i data-lucide="play"></i> Iniciar produção</button></footer></article>`;
    }

    function PrinterAttentionCard(impressora, lote, op, ordem, status) {
        const problema = status === "manutencao" ? "Manutenção necessária" : status === "falha" ? (lote?.motivoFalha || "Falha registrada") : lote?.status === "aguardando_preparacao" ? "Troca de filamento necessária" : "Ação necessária";
        const acao = status === "manutencao" ? `navegar('impressoras')` : status === "falha" ? `novaTentativaUI('${esc(lote?.id)}')` : `abrirPreparacaoLote('${esc(lote?.id)}')`;
        return `<article class="factoryPrinterCard is-attention status-${status}">${cabecalhoImpressora(impressora, status)}<div class="factoryPrinterBody">${PrinterIllustration(impressora)}<div class="factoryOperationInfo"><h4>${esc(problema)}</h4><p>${esc(op?.nome || ordem?.produtoNome || "Impressora requer verificação")}</p><dl><div><dt>Origem</dt><dd>${ordem?.origem === "estoque" ? "Estoque" : `Pedido #${String(ordem?.pedidoId || "").slice(-5)}`}</dd></div><div><dt>Material</dt><dd>${esc((lote?.filamentosSelecionados || []).map(m => `${m.material} ${m.cor}`).join(" · ") || "Não informado")}</dd></div></dl><small>Última atualização ${tempoDesde(lote?.atualizadoEm || lote?.criadoEm)}</small></div></div><footer><button class="danger" onclick="${acao}"><i data-lucide="badge-alert"></i> Resolver</button><button class="factoryMore" onclick="${lote ? `abrirMenuLote('${esc(lote.id)}')` : `navegar('impressoras')`}" aria-label="Mais ações"><i data-lucide="ellipsis"></i></button></footer></article>`;
    }

    function tempoDesde(data) {
        if (!data) return "não informada";
        const min = Math.max(0, Math.round((Date.now() - new Date(data).getTime()) / 60000));
        if (min < 60) return `há ${min} min`;
        if (min < 1440) return `há ${Math.floor(min / 60)} h`;
        return `há ${Math.floor(min / 1440)} d`;
    }

    function FactoryOverview(ctx, fila) {
        return `<section id="factoryOverview" class="factoryPanel factoryOverview"><header class="factorySectionHeader"><div><span>PRODUÇÃO AGORA</span><strong>${ctx.impressoras.length ? `${ctx.impressoras.length} impressora${ctx.impressoras.length === 1 ? "" : "s"} ativa${ctx.impressoras.length === 1 ? "" : "s"}` : "Nenhuma impressora ativa"}</strong></div><button onclick="navegar('configuracoes')">Gerenciar impressoras <i data-lucide="arrow-right"></i></button></header>${ctx.impressoras.length ? `<div class="factoryPrinterGrid">${ctx.impressoras.map(imp => PrinterOperationCard(imp, ctx, fila)).join("")}</div>` : ProductionEmptyState("printer", "Nenhuma impressora ativa.", "Cadastre ou ative uma impressora em Configurações.", "Abrir configurações", "navegar('configuracoes')")}</section>`;
    }

    function ProductionQueueItem(item, indice) {
        const { op, lote, ordem, pedido } = item;
        const origem = ordem?.origem === "estoque" ? "Estoque interno" : `Pedido #${String(ordem?.pedidoId || pedido?.id || "").slice(-5)}`;
        const materiais = (lote?.filamentosSelecionados || op.filamentosSelecionados || op.materiais || []).map(m => `${m.material || "Material"} ${m.cor || ""}`).join(" · ") || "Materiais pela receita";
        const compatibilidade = item.compativeis.map(imp => imp.nome).join(" · ") || "Nenhuma impressora compatível";
        const perfil = op.perfilNome || op.perfilImpressaoNome || op.nomePerfil || "Perfil da receita";
        const acao = !lote || lote.status === "aguardando_alocacao" ? `abrirModalAlocarOperacao('${esc(op.id)}'${lote ? `,'${esc(lote.id)}'` : ""})` : lote.status === "aguardando_preparacao" ? `abrirPreparacaoLote('${esc(lote.id)}')` : `iniciarLoteUI('${esc(lote.id)}')`;
        const rotulo = !lote || lote.status === "aguardando_alocacao" ? "Alocar" : lote.status === "aguardando_preparacao" ? "Preparar" : "Iniciar";
        return `<article class="factoryQueueItem" draggable="false" data-queue-id="${esc(item.id)}"><span class="factoryQueuePosition">${indice + 1}</span><span class="factoryProductThumb"><i data-lucide="box"></i></span><div class="factoryQueueIdentity"><strong>${esc(ordem?.produtoNome || op.produtoNome || op.nome)}</strong><small>${num(lote?.quantidade || op.quantidade)} unidade${num(lote?.quantidade || op.quantidade) === 1 ? "" : "s"} · ${esc(origem)}</small><em>${esc(perfil)}</em></div><div class="factoryQueueCompatibility"><span>Imprimir em</span><strong>${esc(compatibilidade)}</strong></div><div class="factoryQueueDuration"><span>Duração</span><strong>${minutos(lote?.tempoPrevistoMinutos || op.tempoPrevistoMinutos)}</strong><small>${esc(materiais)}</small></div><span class="factoryPriority priority-${item.prioridade}">${esc(item.prioridade)}</span><div class="factoryQueueDeadline"><strong>${dataBR(item.prazo)}</strong><span>${rotuloPrazo(item.prazo)}</span></div><div class="factoryQueueActions"><button class="primary" onclick="${acao}">${rotulo}</button><button onclick="ProducaoPremium.abrirMenuFila('${esc(item.id)}')" aria-label="Mais ações"><i data-lucide="ellipsis"></i></button></div></article>`;
    }

    function rotuloPrazo(data) {
        if (!data) return "Sem prazo";
        const dias = Math.round((new Date(`${data}T00:00:00`) - new Date(`${hoje()}T00:00:00`)) / 86400000);
        return dias < 0 ? "Atrasado" : dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : dias <= 7 ? "Esta semana" : "Planejado";
    }

    function ProductionQueue(fila) {
        return `<section id="productionQueue" class="factoryPanel productionQueue"><header class="factorySectionHeader"><div><span>FILA DE PRODUÇÃO</span><strong>${fila.length} operação${fila.length === 1 ? "" : "ões"}</strong></div></header>${fila.length ? `<div class="factoryQueueList">${fila.map(ProductionQueueItem).join("")}</div>` : ProductionEmptyState("list-ordered", "A fila está vazia.", "Nenhuma operação aguarda alocação ou início.", "Planejar produção", "abrirNovaProducao()")}</section>`;
    }

    function operacoesPosProducao(ctx, tipo) {
        return ctx.operacoes.filter(op => op.tipo === tipo && !STATUS_FINAIS_OPERACAO.has(op.status)).map(op => ({ op, ordem:ctx.ordemPorId.get(chave(op.ordemProducaoId)) })).sort((a, b) => String(a.ordem?.prazo || "9999").localeCompare(String(b.ordem?.prazo || "9999")));
    }

    function PostProductionItem(item) {
        const { op, ordem } = item;
        const pedido = ordem?.pedidoId ? contextoAtual.pedidoPorId.get(chave(ordem.pedidoId)) : null;
        const iniciado = op.status === "em_execucao";
        return `<article class="postProductionItem"><span><i data-lucide="${op.tipo === "montagem" ? "blocks" : op.tipo === "acabamento" ? "wand-sparkles" : "scan-line"}"></i></span><div><strong>${esc(ordem?.produtoNome || op.produtoNome || op.nome)}</strong><small>${esc(op.nome)} · ${num(op.quantidade || ordem?.quantidade)} unidade${num(op.quantidade || ordem?.quantidade) === 1 ? "" : "s"}</small><em>${ordem?.origem === "estoque" ? "Estoque" : `Pedido #${String(ordem?.pedidoId || "").slice(-5)} · ${esc(pedido?.clienteNome || ordem?.clienteNome || "")}`}</em></div><span class="factoryPriority priority-${prioridadeItem(op, null, ordem)}">${prioridadeItem(op, null, ordem)}</span><div class="postDeadline"><strong>${dataBR(ordem?.prazo || pedido?.dataEntregaPrevista)}</strong><small>${rotuloPrazo(ordem?.prazo || pedido?.dataEntregaPrevista)}</small></div><button onclick="executarAcaoManual('${esc(op.id)}','${iniciado ? "concluir" : "iniciar"}')">${iniciado ? "Concluir" : `Iniciar ${op.tipo}`}</button><button class="factoryMore" onclick="abrirDetalhesOrdemProducao('${esc(ordem?.id)}')"><i data-lucide="ellipsis"></i></button></article>`;
    }

    function PostProductionPanel(ctx) {
        const tipos = [["montagem", "Montagem"], ["acabamento", "Acabamento"], ["conferencia", "Conferência"]];
        const lista = operacoesPosProducao(ctx, state.posProducao);
        return `<section class="factoryPanel postProductionPanel"><header class="factorySectionHeader"><div><span>PÓS-PRODUÇÃO</span></div></header><nav class="postProductionTabs">${tipos.map(([id, nome]) => `<button class="${state.posProducao === id ? "active" : ""}" onclick="ProducaoPremium.alterarPosProducao('${id}')">${nome}<b>${operacoesPosProducao(ctx, id).length}</b></button>`).join("")}</nav>${lista.length ? `<div class="postProductionList">${lista.map(PostProductionItem).join("")}</div>` : ProductionEmptyState("circle-check", "Nenhuma operação nesta etapa.", "Montagem e acabamento aparecerão aqui após a impressão.")}</section>`;
    }

    function ProductionAlertCard(alerta) {
        return `<article class="factoryAlertCard type-${alerta.tipo}"><span><i data-lucide="${alerta.tipo === "falha" ? "circle-alert" : alerta.tipo === "filamento" ? "spool" : alerta.tipo === "manutencao" ? "wrench" : alerta.tipo === "atraso" ? "clock-alert" : "pause-circle"}"></i></span><div><strong>${esc(alerta.titulo)}</strong><b>${esc(alerta.descricao)}</b><small>${esc(alerta.detalhe)}</small></div><button onclick="${alerta.onclick}">${esc(alerta.acao)}</button></article>`;
    }

    function ProductionAlertSection(alertas) {
        if (!alertas.length) return "";
        return `<section id="productionAlerts" class="factoryPanel productionAlerts"><header class="factorySectionHeader"><div><span>ATENÇÃO NECESSÁRIA</span><strong>${alertas.length} ocorrência${alertas.length === 1 ? "" : "s"}</strong></div></header><div class="factoryAlertGrid">${alertas.map(ProductionAlertCard).join("")}</div></section>`;
    }

    function ProductionEmptyState(icone, titulo, descricao, acao = "", onclick = "") {
        return `<div class="factoryEmptyState"><span><i data-lucide="${icone}"></i></span><h3>${esc(titulo)}</h3><p>${esc(descricao)}</p>${acao ? `<button onclick="${onclick}">${esc(acao)}</button>` : ""}</div>`;
    }

    function renderConteudo(token) {
        if (token !== state.renderToken) return;
        contextoAtual = lerDados();
        const fila = filaProducao(contextoAtual);
        const alertas = alertasProducao(contextoAtual);
        app.innerHTML = `<main class="factoryControlPage">${ProductionHeader(contextoAtual)}${ProductionKpiStrip(contextoAtual, fila, alertas)}${FactoryOverview(contextoAtual, fila)}<div class="factoryWorkspaceGrid">${ProductionQueue(fila)}${PostProductionPanel(contextoAtual)}${ProductionAlertSection(alertas)}</div></main>`;
        lucide.createIcons();
        clearInterval(producaoTimer);
        producaoTimer = setInterval(atualizarTempoVisual, 30000);
    }

    function render() {
        clearInterval(producaoTimer);
        const token = ++state.renderToken;
        app.innerHTML = `<main class="factoryControlPage factoryLoading"><div class="factorySkeleton"><span class="factorySkeletonHeader"></span><div class="factorySkeletonKpis">${"<span></span>".repeat(5)}</div><span class="factorySkeletonMain"></span><div class="factorySkeletonGrid"><span></span><span></span></div></div></main>`;
        (window.requestAnimationFrame || (fn => setTimeout(fn, 0)))(() => renderConteudo(token));
    }

    function atualizarTempoVisual() {
        document.querySelectorAll("[data-factory-lot]").forEach(card => {
            const lote = Storage.buscarLoteExecucaoPorId(card.dataset.factoryLot);
            if (!lote) return;
            const prog = progressoLote(lote);
            const prev = previsaoLote(lote);
            const barra = card.querySelector(".factoryLiveProgress b");
            const valor = card.querySelector("[data-factory-progress]");
            const tempo = card.querySelector("[data-factory-time]");
            const fim = card.querySelector("[data-factory-end]");
            if (barra && prog !== null) barra.style.width = `${prog}%`;
            if (valor && prog !== null) valor.textContent = `${prog}%`;
            if (tempo) tempo.textContent = prev.texto;
            if (fim) fim.textContent = prev.horario;
        });
    }

    function encontrarItemFila(id) { return contextoAtual ? filaProducao(contextoAtual).find(item => chave(item.id) === chave(id)) : null; }

    const api = {
        render,
        irPara(id) { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start" }); },
        iniciarSugestao(impressoraId, operacaoId, loteId) {
            const lote = loteId ? Storage.buscarLoteExecucaoPorId(loteId) : null;
            if (lote && ["pronta_para_iniciar", "em_fila"].includes(lote.status) && chave(lote.impressoraId) === chave(impressoraId)) return iniciarLoteUI(lote.id);
            abrirModalAlocarOperacao(operacaoId, loteId || "");
            const op = contextoAtual?.operacaoPorId.get(chave(operacaoId));
            alocacaoQuantidades[impressoraId] = num(lote?.quantidade || op?.quantidade || 1);
            renderAlocacaoBody();
        },
        alterarPosProducao(tipo) { if (["montagem", "acabamento", "conferencia"].includes(tipo)) { state.posProducao = tipo; renderConteudo(++state.renderToken); } },
        abrirMenuFila(id) {
            const item = encontrarItemFila(id);
            if (!item) return Toast.show("Item da fila não encontrado.");
            const lote = item.lote;
            const mover = lote?.status === "em_fila" ? `<button onclick="Modal.fechar();ProducaoPremium.moverFila('${esc(lote.id)}','inicio')"><i data-lucide="chevrons-up"></i><span><strong>Mover para o início</strong></span></button><button onclick="Modal.fechar();ProducaoPremium.moverFila('${esc(lote.id)}','acima')"><i data-lucide="arrow-up"></i><span><strong>Subir uma posição</strong></span></button><button onclick="Modal.fechar();ProducaoPremium.moverFila('${esc(lote.id)}','abaixo')"><i data-lucide="arrow-down"></i><span><strong>Descer uma posição</strong></span></button><button onclick="Modal.fechar();ProducaoPremium.moverFila('${esc(lote.id)}','fim')"><i data-lucide="chevrons-down"></i><span><strong>Enviar para o final</strong></span></button>` : "";
            Modal.abrir("Ações da fila", `<div class="compactActionMenu">${mover}<button onclick="Modal.fechar();ProducaoPremium.alterarPrioridade('${esc(id)}')"><i data-lucide="flag"></i><span><strong>Alterar prioridade</strong></span></button><button onclick="Modal.fechar();abrirDetalhesOrdemProducao('${esc(item.ordem?.id)}')"><i data-lucide="workflow"></i><span><strong>Abrir ordem</strong></span></button>${item.ordem?.pedidoId ? `<button onclick="Modal.fechar();abrirDetalhePedido('${esc(item.ordem.pedidoId)}')"><i data-lucide="package"></i><span><strong>Abrir pedido</strong></span></button>` : ""}${item.ordem?.produtoId ? `<button onclick="Modal.fechar();abrirDetalhesProduto('${esc(item.ordem.produtoId)}')"><i data-lucide="box"></i><span><strong>Abrir produto</strong></span></button>` : ""}${lote ? `<button class="danger" onclick="Modal.fechar();removerFilaUI('${esc(lote.id)}')"><i data-lucide="trash-2"></i><span><strong>Remover da fila</strong></span></button>` : ""}</div>`);
            lucide.createIcons();
        },
        moverFila(id, destino) {
            try {
                const lote = Storage.buscarLoteExecucaoPorId(id);
                const imp = Storage.buscarImpressoraPorId(lote?.impressoraId);
                const fila = imp?.filaOperacoes || [];
                const atual = fila.findIndex(item => chave(item) === chave(id));
                const passos = destino === "inicio" ? atual : destino === "fim" ? Math.max(0, fila.length - atual - 1) : 1;
                const direcao = ["inicio", "acima"].includes(destino) ? -1 : 1;
                for (let i = 0; i < passos; i++) Producao.moverLoteFila(id, direcao);
                render(); Toast.show("Fila reordenada.");
            } catch (erro) { Toast.show(erro.message || "Não foi possível reordenar."); }
        },
        alterarPrioridade(id) {
            const item = encontrarItemFila(id);
            if (!item) return;
            Modal.abrir("Prioridade da operação", `<label class="inputGroup"><span>Prioridade</span><select id="factoryQueuePriority"><option value="alta" ${item.prioridade === "alta" ? "selected" : ""}>Alta</option><option value="media" ${item.prioridade === "media" ? "selected" : ""}>Média</option><option value="baixa" ${item.prioridade === "baixa" ? "selected" : ""}>Baixa</option></select></label><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="ProducaoPremium.salvarPrioridade('${esc(id)}')">Salvar</button></div>`);
        },
        salvarPrioridade(id) {
            const item = encontrarItemFila(id); const prioridade = document.getElementById("factoryQueuePriority")?.value;
            if (!item || !prioridade) return;
            if (item.lote) Storage.salvarLoteExecucao({ ...item.lote, prioridade, atualizadoEm:new Date().toISOString() });
            else Storage.salvarOperacaoProducao({ ...item.op, prioridade, atualizadoEm:new Date().toISOString() });
            Modal.fechar(); render(); Toast.show("Prioridade atualizada.");
        },
        resolverAlerta(tipo, id) { if (tipo === "pausa") return retomarLoteUI(id); if (tipo === "falha") return novaTentativaUI(id); },
        normalizarStatusImpressora, normalizarStatusOperacao, progressoLote, previsaoLote, calcularCargaPrevista, getPrinterImage,
        _lerDados: lerDados, _fila: filaProducao, _alertas: alertasProducao,
        componentes: { ProductionHeader, ProductionKpiStrip, FactoryOverview, PrinterOperationCard, PrinterStatusBadge, ProductionQueue, ProductionQueueItem, PostProductionPanel, PostProductionItem, ProductionAlertSection, ProductionAlertCard, PrinterIllustration, ProductionEmptyState }
    };

    window.ProducaoPremium = api;
    window.renderProducao = render;
})();
