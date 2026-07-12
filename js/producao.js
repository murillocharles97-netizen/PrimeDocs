const Producao = (() => {
    const TIPOS = {
        impressao: "Impressão",
        montagem: "Montagem",
        acabamento: "Acabamento",
        pintura: "Pintura",
        embalagem: "Embalagem",
        outro: "Outro"
    };

    const STATUS_ORDEM = {
        aguardando: "Aguardando",
        em_fila: "Em fila",
        em_producao: "Em produção",
        aguardando_montagem: "Aguardando montagem",
        acabamento: "Acabamento",
        concluida: "Concluída",
        cancelada: "Cancelada"
    };

    const STATUS_OPERACAO = {
        aguardando: "Aguardando",
        pronta_para_iniciar: "Pronta para iniciar",
        em_fila: "Em fila",
        em_execucao: "Em execução",
        pausada: "Pausada",
        aguardando_dependencia: "Aguardando dependência",
        concluida: "Concluída",
        falhou: "Falhou",
        cancelada: "Cancelada"
    };

    function id(prefixo) {
        return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function minutosDoTempo(valor) {
        if (Number.isFinite(Number(valor))) return Math.max(0, Number(valor) * 60);
        const texto = String(valor || "").toLowerCase();
        const horas = Number(texto.match(/([\d.,]+)\s*h/)?.[1]?.replace(",", ".") || 0);
        const minutos = Number(texto.match(/([\d.,]+)\s*m/)?.[1]?.replace(",", ".") || 0);
        return Math.round((horas * 60) + minutos);
    }

    function normalizarMaterial(material = {}) {
        return {
            id: material.id || id("mat"),
            material: material.material || "",
            cor: material.cor || "",
            pesoGramas: Math.max(0, Number(material.pesoGramas ?? material.peso ?? 0) || 0),
            filamentoPreferencialId: material.filamentoPreferencialId || material.filamentoId || "",
            slotAms: material.slotAms ?? material.amsSlot ?? "",
            obrigatorio: material.obrigatorio !== false
        };
    }

    function calcularPesoMateriais(materiais = []) {
        return (materiais || []).reduce((total, material) => total + Math.max(0, Number(material.pesoGramas) || 0), 0);
    }

    function calcularCustoMateriais(materiais = []) {
        const filamentos = Storage.listarFilamentos().filter(item => item.ativo !== false);
        const config = Storage.carregarConfigCustos();
        return (materiais || []).reduce((total, material) => {
            const preferido = filamentos.find(item => String(item.id) === String(material.filamentoPreferencialId));
            const compativel = preferido || filamentos.find(item => (!material.material || String(item.material).toLowerCase() === String(material.material).toLowerCase()) && (!material.cor || String(item.cor).toLowerCase() === String(material.cor).toLowerCase()));
            const precoKg = Number(compativel?.precoKg ?? config.precoKgFilamentoPadrao ?? 0) || 0;
            return total + (Math.max(0, Number(material.pesoGramas) || 0) / 1000) * precoKg;
        }, 0);
    }

    function normalizarOperacaoModelo(operacao = {}, indice = 0) {
        return {
            id: operacao.id || id("modelo"),
            nome: operacao.nome || `Operação ${indice + 1}`,
            tipo: TIPOS[operacao.tipo] ? operacao.tipo : "impressao",
            ordem: Number(operacao.ordem ?? indice),
            dependencias: Array.isArray(operacao.dependencias) ? operacao.dependencias.map(String) : [],
            quantidadePorProduto: Math.max(1, Number(operacao.quantidadePorProduto) || 1),
            tempoHoras: Math.max(0, Number(operacao.tempoHoras) || 0),
            tempoMinutos: Math.max(0, Number(operacao.tempoMinutos) || 0),
            pesoTotalGramas: Array.isArray(operacao.materiais) && operacao.materiais.length
                ? calcularPesoMateriais(operacao.materiais)
                : Math.max(0, Number(operacao.pesoTotalGramas) || 0),
            pesoInformadoAnterior: Math.max(0, Number(operacao.pesoInformadoAnterior ?? operacao.pesoTotalGramas) || 0),
            materiais: Array.isArray(operacao.materiais) ? operacao.materiais.map(normalizarMaterial) : [],
            impressoraPreferencialId: operacao.impressoraPreferencialId || "",
            podeExecutarEmParalelo: Boolean(operacao.podeExecutarEmParalelo),
            exigeMontagemAnterior: Boolean(operacao.exigeMontagemAnterior),
            observacoes: operacao.observacoes || ""
        };
    }

    function normalizarProduto(produto = {}) {
        const operacoes = Array.isArray(produto.operacoesModelo)
            ? produto.operacoesModelo.map(normalizarOperacaoModelo).sort((a, b) => a.ordem - b.ordem)
            : [];
        const materiaisLegados = produto.tipoProducao !== "composta" && (!Array.isArray(produto.materiais) || !produto.materiais.length) && (produto.cor || Number(produto.peso) > 0)
            ? [normalizarMaterial({ material: "PLA", cor: produto.cor || "", pesoGramas: Number(produto.peso) || 0 })]
            : [];
        const materiais = Array.isArray(produto.materiais) && produto.materiais.length
            ? produto.materiais.map(normalizarMaterial)
            : materiaisLegados;
        return {
            ...produto,
            tipoProducao: produto.tipoProducao === "composta" ? "composta" : "simples",
            materiais,
            operacoesModelo: operacoes
        };
    }

    function operacaoSimples(produto = {}) {
        const materiais = Array.isArray(produto.materiais) && produto.materiais.length
            ? produto.materiais.map(normalizarMaterial)
            : [normalizarMaterial({ material: "PLA", cor: produto.cor || "", pesoGramas: Number(produto.peso) || 0 })];
        return normalizarOperacaoModelo({
            nome: `Imprimir ${produto.nome || "produto"}`,
            tipo: "impressao",
            tempoHoras: Math.floor(minutosDoTempo(produto.tempo) / 60),
            tempoMinutos: minutosDoTempo(produto.tempo) % 60,
            pesoTotalGramas: calcularPesoMateriais(materiais),
            materiais
        });
    }

    function obterReceita(produto) {
        const normalizado = normalizarProduto(produto || {});
        if (normalizado.tipoProducao === "composta" && normalizado.operacoesModelo.length) return normalizado.operacoesModelo;
        return [operacaoSimples(normalizado)];
    }

    function gerarPreviaPedido(pedido, itensSelecionados = []) {
        if (!pedido) return [];
        const selecionados = new Set((itensSelecionados || []).map(String));
        return (pedido.itens || []).map((item, indice) => ({ ...item, id: item.id || `${pedido.id}-item-${indice}` }))
            .filter(item => !selecionados.size || selecionados.has(String(item.id)))
            .map(item => {
                const produto = item.produtoId ? Storage.buscarProdutoPorId(item.produtoId) : null;
                const receita = produto ? obterReceita(produto) : [normalizarOperacaoModelo({ nome: `Produzir ${item.nome}`, tipo: "outro" })];
                return {
                    item,
                    produto,
                    operacoes: receita.map(op => ({
                        ...op,
                        quantidadeTotal: Math.max(1, Number(item.quantidade) || 1) * Math.max(1, Number(op.quantidadePorProduto) || 1),
                        tempoPrevistoMinutos: ((Number(op.tempoHoras) || 0) * 60 + (Number(op.tempoMinutos) || 0)) * Math.max(1, Number(item.quantidade) || 1),
                        pesoPrevistoGramas: (Number(op.pesoTotalGramas) || 0) * Math.max(1, Number(item.quantidade) || 1)
                    }))
                };
            });
    }

    function criarOrdensDoPedido(pedidoId, itensSelecionados = []) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        if (!pedido) throw new Error("Pedido não encontrado.");
        const existentes = Storage.listarOrdensProducao();
        const previa = gerarPreviaPedido(pedido, itensSelecionados).filter(grupo => !existentes.some(ordem =>
            String(ordem.pedidoId) === String(pedido.id)
            && String(ordem.itemPedidoId) === String(grupo.item.id)
            && ordem.status !== "cancelada"
        ));
        if (!previa.length) throw new Error("Os itens selecionados já possuem ordem de produção.");

        const agora = new Date().toISOString();
        const novasOrdens = previa.map(grupo => {
            const ordemId = id("ord-prod");
            const mapaIds = new Map(grupo.operacoes.map(op => [String(op.id), id("oper-prod")]));
            grupo.operacoes.forEach(op => mapaIds.set(String(op.nome).toLocaleLowerCase("pt-BR"), mapaIds.get(String(op.id))));
            const operacoes = grupo.operacoes.map((op, indice) => {
                const dependencias = (op.dependencias || []).map(dep => mapaIds.get(String(dep)) || mapaIds.get(String(dep).toLocaleLowerCase("pt-BR"))).filter(Boolean);
                return {
                    id: mapaIds.get(String(op.id)),
                    ordemProducaoId: ordemId,
                    pedidoId: pedido.id,
                    itemPedidoId: grupo.item.id,
                    produtoId: grupo.produto?.id || grupo.item.produtoId || null,
                    produtoNome: grupo.item.nome,
                    nome: op.nome,
                    tipo: op.tipo,
                    ordem: indice,
                    quantidade: op.quantidadeTotal,
                    status: dependencias.length ? "aguardando_dependencia" : "aguardando",
                    impressoraId: null,
                    impressoraNome: "",
                    impressoraPreferencialId: op.impressoraPreferencialId || "",
                    filamentosSelecionados: (op.materiais || []).map(material => ({ materialReceitaId: material.id, filamentoId: null, filamentoPreferencialId: material.filamentoPreferencialId || "", material: material.material, cor: material.cor, slotAms: material.slotAms ?? "", pesoPrevistoGramas: Number(material.pesoGramas || 0) * Math.max(1, Number(grupo.item.quantidade) || 1), pesoRealGramas: 0, obrigatorio: material.obrigatorio !== false })),
                    custoFilamentoPrevisto: calcularCustoMateriais(op.materiais || []) * Math.max(1, Number(grupo.item.quantidade) || 1),
                    tempoPrevistoMinutos: op.tempoPrevistoMinutos,
                    tempoRealMinutos: 0,
                    pesoPrevistoGramas: op.pesoPrevistoGramas,
                    inicio: null,
                    fim: null,
                    dependencias,
                    podeExecutarEmParalelo: Boolean(op.podeExecutarEmParalelo),
                    exigeMontagemAnterior: Boolean(op.exigeMontagemAnterior),
                    observacoes: op.observacoes || "",
                    criadoEm: agora,
                    atualizadoEm: agora
                };
            });
            operacoes.forEach(Storage.salvarOperacaoProducao.bind(Storage));
            return {
                id: ordemId,
                pedidoId: pedido.id,
                itemPedidoId: grupo.item.id,
                clienteId: pedido.clienteId || null,
                clienteNome: pedido.clienteNome || "",
                produtoId: grupo.produto?.id || grupo.item.produtoId || null,
                produtoNome: grupo.item.nome,
                quantidade: Math.max(1, Number(grupo.item.quantidade) || 1),
                status: "aguardando",
                progresso: 0,
                prioridade: "normal",
                prazo: pedido.dataEntregaPrevista || "",
                operacoes,
                ativo: true,
                criadoEm: agora,
                atualizadoEm: agora
                ,iniciadoEm: null
                ,concluidoEm: null
            };
        });
        novasOrdens.forEach(Storage.salvarOrdemProducao.bind(Storage));
        const idsCriados = new Map(novasOrdens.map(ordem => [String(ordem.itemPedidoId), ordem.id]));
        pedido.itens = (pedido.itens || []).map((item, indice) => {
            const itemId = item.id || `${pedido.id}-item-${indice}`;
            return { ...item, id: itemId, ordemProducaoId: idsCriados.get(String(itemId)) || item.ordemProducaoId || null, statusProducao: idsCriados.has(String(itemId)) ? "em_producao" : item.statusProducao };
        });
        pedido.statusPedido = "em_producao";
        pedido.atualizadoEm = agora;
        Storage.salvarPedido(pedido);
        Storage.registrarHistoricoProducao({ tipo: "ordens_criadas", pedidoId: pedido.id, descricao: `${novasOrdens.length} ordem(ns) criada(s) para ${pedido.clienteNome}.` });
        return novasOrdens;
    }

    function contextoOperacao(operacaoId) {
        const operacao = Storage.buscarOperacaoProducaoPorId(operacaoId);
        if (!operacao) throw new Error("Operação não encontrada.");
        const ordem = Storage.buscarOrdemProducaoPorId(operacao.ordemProducaoId);
        if (!ordem) throw new Error("Ordem de produção não encontrada.");
        const pedido = Storage.buscarPedidoPorId(ordem.pedidoId);
        return { operacao, ordem, pedido };
    }

    function salvarOperacaoCompleta(operacao) {
        operacao.atualizadoEm = new Date().toISOString();
        Storage.salvarOperacaoProducao(operacao);
        const ordem = Storage.buscarOrdemProducaoPorId(operacao.ordemProducaoId);
        if (ordem) {
            ordem.operacoes = (ordem.operacoes || []).map(item => String(item.id) === String(operacao.id) ? operacao : item);
            ordem.atualizadoEm = operacao.atualizadoEm;
            Storage.salvarOrdemProducao(ordem);
        }
        return operacao;
    }

    function registrar(tipo, contexto = {}, descricao = "", dados = {}) {
        return Storage.registrarHistoricoProducao({
            tipo,
            pedidoId: contexto.pedidoId || contexto.pedido?.id || null,
            ordemId: contexto.ordemId || contexto.ordem?.id || null,
            operacaoId: contexto.operacaoId || contexto.operacao?.id || null,
            loteId: contexto.loteId || contexto.lote?.id || null,
            impressoraId: contexto.impressoraId || contexto.impressora?.id || null,
            descricao,
            dados,
            usuarioId: window.PrimeFirebase?.auth?.currentUser?.uid || null
        });
    }

    function pesoReservadoFilamento(filamentoId, ignorarLoteId = "") {
        return Storage.listarReservasFilamento().filter(reserva => reserva.status === "ativa" && String(reserva.filamentoId) === String(filamentoId) && String(reserva.loteExecucaoId) !== String(ignorarLoteId)).reduce((total, reserva) => total + Number(reserva.pesoReservadoGramas || 0), 0);
    }

    function pesoDisponivelFilamento(filamentoId, ignorarLoteId = "") {
        const filamento = Storage.buscarFilamentoPorId(filamentoId);
        if (!filamento || filamento.ativo === false) return 0;
        return Math.max(0, Number(filamento.pesoAtualKg || 0) * 1000 - pesoReservadoFilamento(filamentoId, ignorarLoteId));
    }

    function impressoraCompativel(impressora, operacao) {
        if (!impressora || impressora.ativa === false || ["manutencao", "offline"].includes(impressora.status)) return false;
        const permitidos = (impressora.materiaisPermitidos || []).map(valor => String(valor).toLocaleLowerCase("pt-BR"));
        if (!permitidos.length) return true;
        return (operacao.filamentosSelecionados || []).every(material => !material.material || permitidos.includes(String(material.material).toLocaleLowerCase("pt-BR")));
    }

    function liberarReservasLote(loteId, status = "liberada") {
        Storage.listarReservasFilamento().filter(reserva => String(reserva.loteExecucaoId) === String(loteId) && reserva.status === "ativa").forEach(reserva => Storage.salvarReservaFilamento({ ...reserva, status, atualizadoEm: new Date().toISOString() }));
    }

    function removerLoteDaFila(lote) {
        if (!lote?.impressoraId) return;
        const impressora = Storage.buscarImpressoraPorId(lote.impressoraId);
        if (!impressora) return;
        impressora.filaOperacoes = (impressora.filaOperacoes || []).filter(idLote => String(idLote) !== String(lote.id));
        if (String(impressora.operacaoAtualId) === String(lote.id)) impressora.operacaoAtualId = null;
        impressora.atualizadoEm = new Date().toISOString();
        Storage.salvarImpressora(impressora);
    }

    function criarAlocacao(operacaoId, distribuicoes = [], loteBaseId = "") {
        const { operacao, ordem, pedido } = contextoOperacao(operacaoId);
        if (operacao.tipo !== "impressao") throw new Error("Somente operações de impressão precisam de impressora e filamentos.");
        if (["concluida", "cancelada"].includes(operacao.status)) throw new Error("Esta operação não pode mais ser alocada.");
        const loteBase = loteBaseId ? Storage.buscarLoteExecucaoPorId(loteBaseId) : null;
        if (loteBaseId && (!loteBase || loteBase.status !== "aguardando_alocacao" || String(loteBase.operacaoId) !== String(operacaoId))) throw new Error("Tentativa aguardando alocação não encontrada.");
        const quantidadeOperacao = Math.max(1, Number(operacao.quantidade) || 1);
        const quantidadeTotal = loteBase ? Math.max(1, Number(loteBase.quantidade) || 1) : quantidadeOperacao;
        const quantidadeDistribuida = distribuicoes.reduce((total, item) => total + Math.max(0, Number(item.quantidade) || 0), 0);
        if (quantidadeDistribuida !== quantidadeTotal) throw new Error(`Distribua exatamente ${quantidadeTotal} unidade(s) entre as impressoras.`);
        if (!distribuicoes.length) throw new Error("Selecione ao menos uma impressora.");

        const necessidadePorFilamento = new Map();
        distribuicoes.forEach(distribuicao => {
            const impressora = Storage.buscarImpressoraPorId(distribuicao.impressoraId);
            if (!impressora) throw new Error("Impressora não encontrada.");
            if (!impressoraCompativel(impressora, operacao)) throw new Error(`${impressora.nome} não é compatível ou está indisponível.`);
            const proporcao = Math.max(1, Number(distribuicao.quantidade) || 1) / quantidadeOperacao;
            if ((distribuicao.filamentosSelecionados || []).length !== (operacao.filamentosSelecionados || []).length) throw new Error("Selecione um rolo para cada material da receita.");
            (distribuicao.filamentosSelecionados || []).forEach(selecao => {
                const receita = (operacao.filamentosSelecionados || []).find(item => String(item.materialReceitaId) === String(selecao.materialReceitaId));
                const filamento = Storage.buscarFilamentoPorId(selecao.filamentoId);
                if (!receita || !filamento || filamento.ativo === false) throw new Error("Selecione filamentos ativos para todos os materiais.");
                if (receita.material && String(filamento.material).toLocaleLowerCase("pt-BR") !== String(receita.material).toLocaleLowerCase("pt-BR")) throw new Error(`O filamento ${filamento.material} ${filamento.cor} não corresponde ao material ${receita.material}.`);
                if (receita.cor && String(filamento.cor).toLocaleLowerCase("pt-BR") !== String(receita.cor).toLocaleLowerCase("pt-BR")) throw new Error(`Selecione um filamento da cor ${receita.cor}.`);
                const peso = Number(receita.pesoPrevistoGramas || 0) * proporcao;
                necessidadePorFilamento.set(String(filamento.id), (necessidadePorFilamento.get(String(filamento.id)) || 0) + peso);
            });
        });
        necessidadePorFilamento.forEach((peso, filamentoId) => { if (pesoDisponivelFilamento(filamentoId) < peso) throw new Error(`Estoque insuficiente para reservar ${peso.toFixed(1)} g de filamento.`); });

        const lotesAntigos = Storage.listarLotesExecucao().filter(lote => (loteBase ? String(lote.id) === String(loteBase.id) : String(lote.operacaoId) === String(operacaoId)) && !["concluido", "falhou", "cancelado"].includes(lote.status));
        if (lotesAntigos.some(lote => ["em_execucao", "pausada"].includes(lote.status))) throw new Error("Não é possível realocar uma operação em execução ou pausada.");
        lotesAntigos.forEach(lote => { liberarReservasLote(lote.id); removerLoteDaFila(lote); Storage.salvarLoteExecucao({ ...lote, status: "cancelado", atualizadoEm: new Date().toISOString() }); });

        const agora = new Date().toISOString();
        const novos = distribuicoes.map((distribuicao, indice) => {
            const impressora = Storage.buscarImpressoraPorId(distribuicao.impressoraId);
            if (!impressora) throw new Error("Impressora não encontrada.");
            if (!impressoraCompativel(impressora, operacao)) throw new Error(`${impressora.nome} não é compatível ou está indisponível.`);
            const proporcao = Math.max(1, Number(distribuicao.quantidade) || 1) / quantidadeOperacao;
            const loteId = id("lote");
            const selecoes = (distribuicao.filamentosSelecionados || []).map(selecao => {
                const receita = (operacao.filamentosSelecionados || []).find(item => String(item.materialReceitaId) === String(selecao.materialReceitaId));
                if (!receita) throw new Error("Material da receita não encontrado.");
                const filamento = Storage.buscarFilamentoPorId(selecao.filamentoId);
                if (!filamento || filamento.ativo === false) throw new Error(`Selecione um filamento ativo para ${receita.cor || receita.material}.`);
                if (receita.material && String(filamento.material).toLocaleLowerCase("pt-BR") !== String(receita.material).toLocaleLowerCase("pt-BR")) throw new Error(`O filamento ${filamento.material} ${filamento.cor} não corresponde ao material ${receita.material}.`);
                if (receita.cor && String(filamento.cor).toLocaleLowerCase("pt-BR") !== String(receita.cor).toLocaleLowerCase("pt-BR")) throw new Error(`Selecione um filamento da cor ${receita.cor}.`);
                const pesoPrevistoGramas = Number(receita.pesoPrevistoGramas || 0) * proporcao;
                if (pesoDisponivelFilamento(filamento.id) < pesoPrevistoGramas) throw new Error(`Estoque insuficiente de ${filamento.material} ${filamento.cor}.`);
                return { ...receita, filamentoId: filamento.id, filamentoNome: [filamento.material, filamento.cor, filamento.marca].filter(Boolean).join(" · "), slotAms: selecao.slotAms ?? receita.slotAms ?? "", pesoPrevistoGramas, pesoRealGramas: 0 };
            });
            if (selecoes.length !== (operacao.filamentosSelecionados || []).length) throw new Error("Selecione um rolo para cada material da receita.");
            const ocupada = ["imprimindo", "pausada"].includes(impressora.status) || Boolean(impressora.operacaoAtualId);
            const fila = [...(impressora.filaOperacoes || []), loteId];
            impressora.filaOperacoes = fila;
            impressora.atualizadoEm = agora;
            Storage.salvarImpressora(impressora);
            const lote = { id: loteId, operacaoId: operacao.id, ordemProducaoId: ordem.id, pedidoId: pedido?.id || ordem.pedidoId, impressoraId: impressora.id, impressoraNome: impressora.nome, quantidade: Number(distribuicao.quantidade), status: ocupada ? "em_fila" : "pronta_para_iniciar", posicaoFila: fila.length, filamentosSelecionados: selecoes, tempoPrevistoMinutos: Number(operacao.tempoPrevistoMinutos || 0) * proporcao, pesoPrevistoGramas: Number(operacao.pesoPrevistoGramas || 0) * proporcao, tempoPausadoAcumulado: 0, iniciadoEm: null, pausadoEm: null, concluidoEm: null, criadoEm: agora, atualizadoEm: agora };
            Storage.salvarLoteExecucao(lote);
            selecoes.forEach(material => Storage.salvarReservaFilamento({ id: id("reserva"), filamentoId: material.filamentoId, materialReceitaId: material.materialReceitaId, loteExecucaoId: lote.id, operacaoId: operacao.id, pesoReservadoGramas: material.pesoPrevistoGramas, criadoEm: agora, atualizadoEm: agora, status: "ativa" }));
            registrar("lote_criado", { pedido, ordem, operacao, lote, impressora }, `Lote ${indice + 1} alocado em ${impressora.nome}.`, { quantidade: lote.quantidade });
            return lote;
        });
        operacao.lotesExecucaoIds = loteBase
            ? [...(operacao.lotesExecucaoIds || []).filter(idLote => String(idLote) !== String(loteBase.id)), ...novos.map(lote => lote.id)]
            : novos.map(lote => lote.id);
        operacao.status = novos.some(lote => lote.status === "em_fila") ? "em_fila" : "pronta_para_iniciar";
        salvarOperacaoCompleta(operacao);
        registrar("operacao_alocada", { pedido, ordem, operacao }, `${operacao.nome} alocada em ${novos.length} lote(s).`);
        return novos;
    }

    function calcularTempoDecorrido(lote, agora = Date.now()) {
        if (!lote?.iniciadoEm) return 0;
        const inicio = new Date(lote.iniciadoEm).getTime();
        const fim = lote.concluidoEm ? new Date(lote.concluidoEm).getTime() : lote.status === "pausada" && lote.pausadoEm ? new Date(lote.pausadoEm).getTime() : agora;
        return Math.max(0, Math.round((fim - inicio - Number(lote.tempoPausadoAcumulado || 0)) / 60000));
    }

    function calcularProgressoLote(lote) {
        if (lote?.status === "concluido") return 100;
        const previsto = Math.max(1, Number(lote?.tempoPrevistoMinutos) || 1);
        return Math.min(99, Math.max(0, Math.round(calcularTempoDecorrido(lote) / previsto * 100)));
    }

    function dependenciasConcluidas(operacao) {
        return (operacao.dependencias || []).every(idDependencia => Storage.buscarOperacaoProducaoPorId(idDependencia)?.status === "concluida");
    }

    async function transacaoInicioNuvem(lote, impressora) {
        if (!navigator.onLine || !window.PrimeFirebase?.disponivel?.() || !window.PrimeFirebase.auth?.currentUser) return true;
        const workspaceId = localStorage.getItem("primedocs_workspace_atual");
        if (!workspaceId) throw new Error("Workspace não carregado.");
        const db = PrimeFirebase.db;
        const loteRef = db.collection("workspaces").doc(workspaceId).collection("lotesExecucao").doc(String(lote.id));
        const impressoraRef = db.collection("workspaces").doc(workspaceId).collection("impressoras").doc(String(impressora.id));
        await db.runTransaction(async tx => {
            const [loteSnap, impressoraSnap] = await Promise.all([tx.get(loteRef), tx.get(impressoraRef)]);
            const remotoLote = loteSnap.exists ? loteSnap.data() : null;
            const remotaImpressora = impressoraSnap.exists ? impressoraSnap.data() : null;
            if (remotoLote && !["pronta_para_iniciar", "em_fila"].includes(remotoLote.status)) throw new Error("Esta operação foi atualizada em outro dispositivo.");
            if (remotaImpressora && (["imprimindo", "pausada", "manutencao", "offline"].includes(remotaImpressora.status) || (remotaImpressora.operacaoAtualId && String(remotaImpressora.operacaoAtualId) !== String(lote.id)))) throw new Error("Esta operação ou impressora foi atualizada em outro dispositivo.");
            tx.set(loteRef, { ...lote, status: "em_execucao", iniciadoEm: new Date().toISOString(), atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            tx.set(impressoraRef, { status: "imprimindo", operacaoAtualId: lote.id, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        return true;
    }

    async function iniciarLoteExecucao(loteId) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId);
        if (!lote || !["pronta_para_iniciar", "em_fila"].includes(lote.status)) throw new Error("Este lote não está pronto para iniciar.");
        const { operacao, ordem, pedido } = contextoOperacao(lote.operacaoId);
        const impressora = Storage.buscarImpressoraPorId(lote.impressoraId);
        if (!impressora || impressora.ativa === false || ["manutencao", "offline"].includes(impressora.status)) throw new Error("Impressora indisponível.");
        if (["imprimindo", "pausada"].includes(impressora.status) && String(impressora.operacaoAtualId) !== String(lote.id)) throw new Error("A impressora está ocupada.");
        if (!dependenciasConcluidas(operacao)) throw new Error("Conclua as dependências antes de iniciar.");
        const reservas = Storage.listarReservasFilamento().filter(item => String(item.loteExecucaoId) === String(lote.id) && item.status === "ativa");
        if (reservas.length !== (lote.filamentosSelecionados || []).length) throw new Error("As reservas de filamento não estão completas.");
        const reservasPorFilamento = new Map();
        reservas.forEach(reserva => reservasPorFilamento.set(String(reserva.filamentoId), (reservasPorFilamento.get(String(reserva.filamentoId)) || 0) + Number(reserva.pesoReservadoGramas || 0)));
        reservasPorFilamento.forEach((peso, filamentoId) => { if (pesoDisponivelFilamento(filamentoId, lote.id) < peso) throw new Error("Filamento insuficiente para iniciar."); });
        await transacaoInicioNuvem(lote, impressora);
        const agora = new Date().toISOString();
        lote.status = "em_execucao"; lote.iniciadoEm = lote.iniciadoEm || agora; lote.pausadoEm = null; lote.atualizadoEm = agora;
        Storage.salvarLoteExecucao(lote);
        operacao.status = "em_execucao"; salvarOperacaoCompleta(operacao);
        ordem.status = "em_producao"; ordem.iniciadoEm = ordem.iniciadoEm || agora; ordem.atualizadoEm = agora; Storage.salvarOrdemProducao(ordem);
        if (pedido) { pedido.statusPedido = "em_producao"; pedido.atualizadoEm = agora; Storage.salvarPedido(pedido); }
        impressora.status = "imprimindo"; impressora.operacaoAtualId = lote.id; impressora.filaOperacoes = (impressora.filaOperacoes || []).filter(idFila => String(idFila) !== String(lote.id)); impressora.atualizadoEm = agora; Storage.salvarImpressora(impressora);
        registrar("impressao_iniciada", { pedido, ordem, operacao, lote, impressora }, `${operacao.nome} iniciada em ${impressora.nome}.`);
        return lote;
    }

    function pausarLoteExecucao(loteId) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote || lote.status !== "em_execucao") throw new Error("Este lote não está em execução.");
        const { operacao, ordem, pedido } = contextoOperacao(lote.operacaoId); const impressora = Storage.buscarImpressoraPorId(lote.impressoraId); const agora = new Date().toISOString();
        lote.status = "pausada"; lote.pausadoEm = agora; lote.atualizadoEm = agora; Storage.salvarLoteExecucao(lote);
        if (impressora) { impressora.status = "pausada"; impressora.atualizadoEm = agora; Storage.salvarImpressora(impressora); }
        atualizarHierarquia(operacao.id); registrar("impressao_pausada", { pedido, ordem, operacao, lote, impressora }, `${operacao.nome} pausada.`); return lote;
    }

    function retomarLoteExecucao(loteId) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote || lote.status !== "pausada") throw new Error("Este lote não está pausado.");
        const { operacao, ordem, pedido } = contextoOperacao(lote.operacaoId); const impressora = Storage.buscarImpressoraPorId(lote.impressoraId); const agoraMs = Date.now(); const agora = new Date(agoraMs).toISOString();
        lote.tempoPausadoAcumulado = Number(lote.tempoPausadoAcumulado || 0) + Math.max(0, agoraMs - new Date(lote.pausadoEm).getTime()); lote.pausadoEm = null; lote.status = "em_execucao"; lote.atualizadoEm = agora; Storage.salvarLoteExecucao(lote);
        if (impressora) { impressora.status = "imprimindo"; impressora.atualizadoEm = agora; Storage.salvarImpressora(impressora); }
        atualizarHierarquia(operacao.id); registrar("impressao_retomada", { pedido, ordem, operacao, lote, impressora }, `${operacao.nome} retomada.`); return lote;
    }

    function calcularCustoRealLote(lote, consumos = []) {
        const horas = calcularTempoDecorrido(lote) / 60;
        const config = Storage.carregarConfigCustos();
        const filamento = consumos.reduce((total, consumo) => { const rolo = Storage.buscarFilamentoPorId(consumo.filamentoId); return total + Number(consumo.pesoRealGramas || 0) / 1000 * Number(rolo?.precoKg || config.precoKgFilamentoPadrao || 0); }, 0);
        const energia = horas * Number(config.custoEnergiaHora || 0); const depreciacao = horas * Number(config.custoDepreciacaoHora || 0); const maoDeObra = config.cobrarMaoDeObraPorPadrao ? horas * Number(config.valorMaoDeObraHora || 0) : 0;
        return { filamento, energia, depreciacao, maoDeObra, total: filamento + energia + depreciacao + maoDeObra };
    }

    function atualizarHierarquia(operacaoId) {
        const { operacao, ordem, pedido } = contextoOperacao(operacaoId);
        const lotes = Storage.listarLotesExecucao().filter(lote => String(lote.operacaoId) === String(operacao.id) && lote.status !== "cancelado");
        if (operacao.tipo === "impressao") {
            if (lotes.length && lotes.every(lote => lote.status === "concluido")) operacao.status = "concluida";
            else if (lotes.some(lote => lote.status === "em_execucao")) operacao.status = "em_execucao";
            else if (lotes.some(lote => lote.status === "pausada")) operacao.status = "pausada";
            else if (lotes.some(lote => lote.status === "falhou")) operacao.status = "falhou";
            else if (lotes.some(lote => lote.status === "em_fila")) operacao.status = "em_fila";
            else if (lotes.some(lote => lote.status === "pronta_para_iniciar")) operacao.status = "pronta_para_iniciar";
            else if (lotes.some(lote => lote.status === "aguardando_alocacao")) operacao.status = "aguardando";
            else if (!lotes.length || lotes.every(lote => lote.status === "cancelado")) operacao.status = dependenciasConcluidas(operacao) ? "aguardando" : "aguardando_dependencia";
            operacao.progresso = lotes.length ? Math.round(lotes.reduce((total, lote) => total + (lote.status === "concluido" ? 100 : calcularProgressoLote(lote)) * Number(lote.quantidade || 1), 0) / lotes.reduce((total, lote) => total + Number(lote.quantidade || 1), 0)) : 0;
        } else {
            operacao.progresso = operacao.status === "concluida" ? 100 : operacao.status === "em_execucao" ? 50 : 0;
        }
        salvarOperacaoCompleta(operacao);

        const operacoes = Storage.listarOperacoesProducao().filter(item => String(item.ordemProducaoId) === String(ordem.id));
        operacoes.filter(item => item.status === "aguardando_dependencia" && dependenciasConcluidas(item)).forEach(item => { item.status = "aguardando"; salvarOperacaoCompleta(item); });
        const concluidas = operacoes.filter(item => item.status === "concluida").length;
        ordem.progresso = operacoes.length ? Math.round(concluidas / operacoes.length * 100) : 0;
        if (operacoes.length && concluidas === operacoes.length) { ordem.status = "concluida"; ordem.concluidoEm = new Date().toISOString(); } else if (operacoes.some(item => item.status === "em_execucao")) ordem.status = "em_producao"; else if (operacoes.some(item => item.status === "aguardando_dependencia")) ordem.status = "aguardando_montagem";
        ordem.operacoes = operacoes; ordem.atualizadoEm = new Date().toISOString(); Storage.salvarOrdemProducao(ordem);
        if (pedido) {
            const ordensPedido = Storage.listarOrdensProducao().filter(item => String(item.pedidoId) === String(pedido.id) && item.ativo !== false);
            if (ordensPedido.length && ordensPedido.every(item => item.status === "concluida")) { pedido.statusPedido = "pronto"; registrar("pedido_pronto", { pedido }, `Pedido #${String(pedido.id).slice(-5)} pronto.`); }
            else pedido.statusPedido = "em_producao";
            pedido.itens = (pedido.itens || []).map(item => { const ordemItem = ordensPedido.find(op => String(op.itemPedidoId) === String(item.id)); return ordemItem ? { ...item, statusProducao: ordemItem.status === "concluida" ? "produzido" : "em_producao" } : item; });
            pedido.atualizadoEm = new Date().toISOString(); Storage.salvarPedido(pedido);
        }
        return { operacao, ordem, pedido };
    }

    function finalizarLote(loteId, dados = {}, falha = false) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote || !["em_execucao", "pausada"].includes(lote.status)) throw new Error("Lote não está em execução ou pausado.");
        const { operacao, ordem, pedido } = contextoOperacao(lote.operacaoId); const impressora = Storage.buscarImpressoraPorId(lote.impressoraId); const agora = new Date().toISOString();
        if (lote.status === "pausada" && lote.pausadoEm) lote.tempoPausadoAcumulado = Number(lote.tempoPausadoAcumulado || 0) + Math.max(0, Date.now() - new Date(lote.pausadoEm).getTime());
        lote.concluidoEm = agora; lote.status = falha ? "falhou" : "concluido"; lote.resultado = falha ? "falha" : (dados.resultado || "sucesso"); lote.quantidadeConcluida = Math.max(0, Number(dados.quantidadeConcluida ?? lote.quantidade) || 0); lote.pecasDefeito = Math.max(0, Number(dados.pecasDefeito) || 0); lote.motivoFalha = dados.motivoFalha || ""; lote.observacoesResultado = dados.observacoes || "";
        lote.filamentosSelecionados = (lote.filamentosSelecionados || []).map(material => ({ ...material, pesoRealGramas: Math.max(0, Number(dados.consumos?.find(item => String(item.materialReceitaId) === String(material.materialReceitaId))?.pesoRealGramas ?? material.pesoPrevistoGramas) || 0) }));
        lote.custosReais = calcularCustoRealLote(lote, lote.filamentosSelecionados); lote.custoReal = lote.custosReais.total; lote.tempoRealMinutos = calcularTempoDecorrido(lote); lote.atualizadoEm = agora; Storage.salvarLoteExecucao(lote);
        lote.filamentosSelecionados.forEach(material => { if (material.filamentoId && material.pesoRealGramas > 0) Storage.baixarFilamento(material.filamentoId, material.pesoRealGramas / 1000); });
        Storage.listarReservasFilamento().filter(reserva => String(reserva.loteExecucaoId) === String(lote.id) && reserva.status === "ativa").forEach(reserva => Storage.salvarReservaFilamento({ ...reserva, status: "consumida", pesoConsumidoGramas: lote.filamentosSelecionados.find(item => String(item.materialReceitaId) === String(reserva.materialReceitaId))?.pesoRealGramas || 0, atualizadoEm: agora }));
        if (impressora) { const horas = lote.tempoRealMinutos / 60; impressora.status = "livre"; impressora.operacaoAtualId = null; impressora.horasTotais = Number(impressora.horasTotais || 0) + horas; impressora.horasDesdeManutencao = Number(impressora.horasDesdeManutencao || 0) + horas; impressora.filaOperacoes = (impressora.filaOperacoes || []).filter(idFila => String(idFila) !== String(lote.id)); impressora.atualizadoEm = agora; Storage.salvarImpressora(impressora); }
        registrar(falha ? "falha" : "impressao_concluida", { pedido, ordem, operacao, lote, impressora }, falha ? `Falha registrada em ${operacao.nome}.` : `${operacao.nome} concluída.`, { custos: lote.custosReais, motivo: lote.motivoFalha });
        const resultado = atualizarHierarquia(operacao.id);
        if (falha && dados.repetir) criarNovaTentativa(lote.id);
        return { lote, ...resultado };
    }

    function concluirLoteExecucao(loteId, dados = {}) { return finalizarLote(loteId, dados, false); }
    function registrarFalhaLote(loteId, dados = {}) { return finalizarLote(loteId, dados, true); }

    function criarNovaTentativa(loteFalhoId) {
        const anterior = Storage.buscarLoteExecucaoPorId(loteFalhoId); if (!anterior || anterior.status !== "falhou") throw new Error("Lote falho não encontrado.");
        const agora = new Date().toISOString(); const novo = { ...anterior, id: id("lote"), tentativaDe: anterior.id, impressoraId: null, impressoraNome: "", status: "aguardando_alocacao", filamentosSelecionados: (anterior.filamentosSelecionados || []).map(item => ({ ...item, filamentoId: null, pesoRealGramas: 0 })), iniciadoEm: null, pausadoEm: null, concluidoEm: null, tempoPausadoAcumulado: 0, custoReal: 0, custosReais: null, motivoFalha: "", resultado: "", criadoEm: agora, atualizadoEm: agora };
        Storage.salvarLoteExecucao(novo); const operacao = Storage.buscarOperacaoProducaoPorId(novo.operacaoId); if (operacao) { operacao.lotesExecucaoIds = [...(operacao.lotesExecucaoIds || []), novo.id]; operacao.status = "aguardando"; salvarOperacaoCompleta(operacao); } registrar("nova_tentativa", { lote: novo, operacao }, `Nova tentativa criada para o lote ${anterior.id}.`); return novo;
    }

    function moverLoteFila(loteId, direcao) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote?.impressoraId || lote.status !== "em_fila") throw new Error("Lote não está em fila."); const impressora = Storage.buscarImpressoraPorId(lote.impressoraId); const fila = [...(impressora.filaOperacoes || [])]; const index = fila.findIndex(idFila => String(idFila) === String(lote.id)); const destino = index + Number(direcao); if (index < 0 || destino < 0 || destino >= fila.length) return lote; [fila[index], fila[destino]] = [fila[destino], fila[index]]; impressora.filaOperacoes = fila; Storage.salvarImpressora(impressora); fila.forEach((idFila, posicao) => { const item = Storage.buscarLoteExecucaoPorId(idFila); if (item) Storage.salvarLoteExecucao({ ...item, posicaoFila: posicao + 1 }); }); return lote;
    }

    function prepararRealocacaoLote(loteId) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote || !["em_fila", "pronta_para_iniciar", "aguardando_alocacao"].includes(lote.status)) throw new Error("Este lote não pode ser realocado agora."); liberarReservasLote(lote.id); removerLoteDaFila(lote); lote.status = "aguardando_alocacao"; lote.impressoraId = null; lote.impressoraNome = ""; lote.filamentosSelecionados = (lote.filamentosSelecionados || []).map(item => ({ ...item, filamentoId: null, pesoRealGramas: 0 })); lote.atualizadoEm = new Date().toISOString(); Storage.salvarLoteExecucao(lote); registrar("reserva_liberada", { lote, operacaoId: lote.operacaoId }, "Reservas liberadas para realocação do lote."); atualizarHierarquia(lote.operacaoId); return lote;
    }

    function removerLoteFilaExecucao(loteId) {
        const lote = Storage.buscarLoteExecucaoPorId(loteId); if (!lote || !["em_fila", "pronta_para_iniciar", "aguardando_alocacao"].includes(lote.status)) throw new Error("Este lote não pode ser removido da fila."); liberarReservasLote(lote.id, "cancelada"); removerLoteDaFila(lote); lote.status = "cancelado"; lote.atualizadoEm = new Date().toISOString(); Storage.salvarLoteExecucao(lote); registrar("lote_cancelado", { lote, operacaoId: lote.operacaoId }, "Lote removido da fila."); atualizarHierarquia(lote.operacaoId); return lote;
    }

    function iniciarOperacaoManual(operacaoId) {
        const { operacao, ordem, pedido } = contextoOperacao(operacaoId); if (operacao.tipo === "impressao") throw new Error("Aloque a impressão em uma impressora."); if (!dependenciasConcluidas(operacao)) throw new Error("Conclua as dependências antes de iniciar."); const agora = new Date().toISOString(); operacao.status = "em_execucao"; operacao.inicio = agora; salvarOperacaoCompleta(operacao); ordem.status = operacao.tipo === "acabamento" ? "acabamento" : "em_producao"; Storage.salvarOrdemProducao(ordem); if (pedido) { pedido.statusPedido = "em_producao"; Storage.salvarPedido(pedido); } registrar("operacao_manual_iniciada", { pedido, ordem, operacao }, `${operacao.nome} iniciada.`); return operacao;
    }

    function concluirOperacaoManual(operacaoId, observacoes = "") {
        const { operacao, ordem, pedido } = contextoOperacao(operacaoId); if (operacao.tipo === "impressao") throw new Error("Conclua o lote de impressão."); const agora = new Date().toISOString(); operacao.status = "concluida"; operacao.fim = agora; operacao.observacoesResultado = observacoes; operacao.tempoRealMinutos = operacao.inicio ? Math.max(0, Math.round((Date.now() - new Date(operacao.inicio).getTime()) / 60000)) : 0; salvarOperacaoCompleta(operacao); registrar("operacao_manual_concluida", { pedido, ordem, operacao }, `${operacao.nome} concluída.`); return atualizarHierarquia(operacao.id);
    }

    function migrarDados() {
        let mudouProdutos = false;
        const produtos = Storage.listarProdutos().map(produto => {
            const normalizado = normalizarProduto(produto);
            if (JSON.stringify(normalizado) !== JSON.stringify(produto)) mudouProdutos = true;
            return normalizado;
        });
        if (mudouProdutos) Storage.salvarProdutos(produtos);

        let mudouPedidos = false;
        const pedidos = Storage.listarPedidos().map(pedido => ({
            ...pedido,
            itens: (pedido.itens || []).map((item, indice) => {
                if (item.id) return item;
                mudouPedidos = true;
                return { ...item, id: `${pedido.id}-item-${indice}` };
            })
        }));
        if (mudouPedidos) Storage.salvarPedidos(pedidos);
        let mudouImpressoras = false;
        const impressoras = Storage.listarImpressoras().map(impressora => {
            if (Array.isArray(impressora.filaOperacoes)) return impressora;
            mudouImpressoras = true;
            return { ...impressora, filaOperacoes: [] };
        });
        if (mudouImpressoras) Storage.salvarImpressoras(impressoras);
        return { produtos: mudouProdutos, pedidos: mudouPedidos, impressoras: mudouImpressoras };
    }

    return { TIPOS, STATUS: STATUS_ORDEM, STATUS_ORDEM, STATUS_OPERACAO, normalizarMaterial, calcularPesoMateriais, calcularCustoMateriais, normalizarOperacaoModelo, normalizarProduto, obterReceita, gerarPreviaPedido, criarOrdensDoPedido, contextoOperacao, pesoReservadoFilamento, pesoDisponivelFilamento, impressoraCompativel, criarAlocacao, calcularTempoDecorrido, calcularProgressoLote, iniciarLoteExecucao, pausarLoteExecucao, retomarLoteExecucao, concluirLoteExecucao, registrarFalhaLote, criarNovaTentativa, moverLoteFila, prepararRealocacaoLote, removerLoteFilaExecucao, iniciarOperacaoManual, concluirOperacaoManual, atualizarHierarquia, migrarDados };
})();

window.Producao = Producao;
