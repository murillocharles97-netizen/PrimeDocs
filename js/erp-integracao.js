/* Núcleo de integração do PrimeDocs.
   Centraliza invariantes entre pedidos, produção, estoque, filamentos e métricas. */
const ERPIntegracao = (() => {
    "use strict";

    const STATUS_FINAIS_PEDIDO = new Set(["entregue", "cancelado"]);
    const STATUS_FINAIS_ORDEM = new Set(["concluida", "cancelada"]);
    const STATUS_FINAIS_OPERACAO = new Set(["concluida", "cancelada"]);
    const STATUS_FINAIS_LOTE = new Set(["concluido", "falhou", "cancelado"]);
    const STATUS_TRANSICOES = {
        aguardando_orcamento: new Set(["aguardando_aceite", "aprovado", "cancelado"]),
        aguardando_aceite: new Set(["aprovado", "cancelado"]),
        aprovado: new Set(["em_producao", "cancelado"]),
        em_producao: new Set(["pronto", "cancelado"]),
        pronto: new Set(["entregue", "em_producao", "cancelado"]),
        entregue: new Set([]),
        cancelado: new Set(["aprovado"])
    };

    const id = valor => String(valor ?? "");
    const numero = valor => Number(valor) || 0;
    const agora = () => new Date().toISOString();
    const copiar = valor => JSON.parse(JSON.stringify(valor));

    function registrar(tipo, descricao, dados = {}) {
        const evento = {
            id: `integridade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            tipo,
            descricao,
            origem: "integracao_erp",
            criadoEm: agora(),
            ...dados
        };
        Storage.registrarHistoricoProducao(evento);
        return evento;
    }

    function notificar(modulos = [], detalhe = {}) {
        try { Financeiro.sincronizar(); } catch (erro) { console.warn("[ERP] Financeiro não atualizado", erro); }
        try { gerarNotificacoesOperacionais(); } catch (erro) { console.warn("[ERP] Notificações não atualizadas", erro); }
        window.dispatchEvent(new CustomEvent("primedocs:erp-atualizado", {
            detail: { modulos: [...new Set(modulos)], em: agora(), ...detalhe }
        }));
    }

    function pedidosComerciais() {
        return Storage.listarPedidos().filter(pedido => pedido.ativo !== false && pedido.tipoPedido !== "estoque_interno");
    }

    function pedidoAtivo(pedidoId) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        return pedido && pedido.ativo !== false && !STATUS_FINAIS_PEDIDO.has(pedido.statusPedido) ? pedido : null;
    }

    function ordensDoPedido(pedidoId, incluirCanceladas = false) {
        return Storage.listarOrdensProducao().filter(ordem =>
            id(ordem.pedidoId || ordem.orderId) === id(pedidoId)
            && (incluirCanceladas || (ordem.ativo !== false && ordem.status !== "cancelada"))
        );
    }

    function operacoesDaOrdem(ordemId, incluirCanceladas = false) {
        return Storage.listarOperacoesProducao().filter(operacao =>
            id(operacao.ordemProducaoId) === id(ordemId)
            && (incluirCanceladas || operacao.status !== "cancelada")
        );
    }

    function lotesDaOrdem(ordemId, incluirCancelados = false) {
        const operacoes = new Set(operacoesDaOrdem(ordemId, true).map(operacao => id(operacao.id)));
        return Storage.listarLotesExecucao().filter(lote => operacoes.has(id(lote.operacaoId)) && (incluirCancelados || lote.status !== "cancelado"));
    }

    function ordemValida(ordem) {
        if (!ordem || ordem.ativo === false || ordem.status === "cancelada") return false;
        const pedido = Storage.buscarPedidoPorId(ordem.pedidoId || ordem.orderId);
        const interno = pedido?.tipoPedido === "estoque_interno" && ordem.origem === "estoque";
        if (!pedido || (!interno && (pedido.ativo === false || STATUS_FINAIS_PEDIDO.has(pedido.statusPedido)))) return false;
        const item = (pedido.itens || []).find(registro => id(registro.id) === id(ordem.itemPedidoId || ordem.orderItemId));
        if (!item) return false;
        if (item.produtoId) {
            const produto = Storage.buscarProdutoPorId(item.produtoId);
            if (!produto || produto.ativo === false) return false;
        }
        return true;
    }

    function migrarDemandasEstoqueLegadas() {
        let migradas = 0;
        Storage.listarOrdensProducao().filter(ordem => ordem.origem === "estoque" && !Storage.buscarPedidoPorId(ordem.pedidoId || ordem.orderId)).forEach(ordem => {
            const criadoEm = ordem.criadoEm || agora();
            const pedidoId = `ped-estoque-legado-${ordem.id}`;
            const itemPedidoId = `item-estoque-legado-${ordem.id}`;
            Storage.salvarPedido({
                id: pedidoId, tipoPedido: "estoque_interno", visivel: false, ativo: false,
                clienteId: null, clienteNome: "Estoque interno", statusPedido: ordem.status === "concluida" ? "pronto" : "em_producao", statusPagamento: "pago",
                dataPedido: String(criadoEm).slice(0, 10), dataEntregaPrevista: "", valorTotal: 0, valorPago: 0, valorPendente: 0,
                itens: [{ id: itemPedidoId, produtoId: ordem.produtoId, nome: ordem.produtoNome, quantidade: numero(ordem.quantidade), valorUnitario: 0, valorTotal: 0, interno: true }],
                criadoEm, atualizadoEm: agora()
            });
            Storage.salvarOrdemProducao({ ...ordem, pedidoId, orderId: pedidoId, itemPedidoId, orderItemId: itemPedidoId, atualizadoEm: agora() });
            operacoesDaOrdem(ordem.id, true).forEach(operacao => Storage.salvarOperacaoProducao({ ...operacao, pedidoId, itemPedidoId, atualizadoEm: agora() }));
            migradas += 1;
        });
        if (migradas) registrar("demandas_estoque_migradas", `${migradas} produção(ões) de estoque receberam uma demanda interna rastreável.`, { migradas });
        return migradas;
    }

    function ordensAtivas() {
        return Storage.listarOrdensProducao().filter(ordemValida);
    }

    function itensPendentesPedido(pedidoId) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        if (!pedido) return [];
        const ordens = ordensDoPedido(pedidoId);
        return (pedido.itens || []).filter(item => {
            const ordem = ordens.find(registro => id(registro.itemPedidoId || registro.orderItemId) === id(item.id));
            return !ordem || ordem.status !== "concluida";
        });
    }

    function producaoCompleta(pedidoId) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        return Boolean(pedido?.itens?.length) && itensPendentesPedido(pedidoId).length === 0;
    }

    function criarOrdensPendentes(pedidoId) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        if (!pedido?.itens?.length) throw new Error("Adicione ao menos um item antes de iniciar a produção.");
        const ordens = ordensDoPedido(pedidoId);
        const idsPendentes = (pedido.itens || []).filter(item => !ordens.some(ordem => id(ordem.itemPedidoId || ordem.orderItemId) === id(item.id))).map(item => item.id);
        if (idsPendentes.length) Producao.criarOrdensDoPedido(pedidoId, idsPendentes);
        const atualizadas = ordensDoPedido(pedidoId);
        atualizadas.forEach(ordem => {
            const patch = {
                ...ordem,
                orderId: ordem.pedidoId,
                orderItemId: ordem.itemPedidoId,
                produzido: ordem.status === "concluida" ? numero(ordem.quantidade) : numero(ordem.produzido),
                restante: ordem.status === "concluida" ? 0 : Math.max(0, numero(ordem.quantidade) - numero(ordem.produzido)),
                filamentoReservadoGramas: lotesDaOrdem(ordem.id).flatMap(lote => lote.filamentosSelecionados || []).reduce((total, material) => total + numero(material.pesoReservadoGramas || material.pesoPrevistoGramas), 0),
                tempoPrevistoMinutos: operacoesDaOrdem(ordem.id).reduce((total, operacao) => total + numero(operacao.tempoPrevistoMinutos), 0),
                tempoRealMinutos: operacoesDaOrdem(ordem.id).reduce((total, operacao) => total + numero(operacao.tempoRealMinutos), 0)
            };
            Storage.salvarOrdemProducao(patch);
        });
        return ordensDoPedido(pedidoId);
    }

    function validarTransicao(pedido, destino, forcar = false) {
        if (!pedido) throw new Error("Pedido não encontrado.");
        if (pedido.statusPedido === destino) return true;
        if (!forcar && !STATUS_TRANSICOES[pedido.statusPedido]?.has(destino)) throw new Error(`Não é possível alterar de ${pedido.statusPedido} para ${destino}.`);
        if (destino === "pronto" && !forcar && !producaoCompleta(pedido.id)) {
            const erro = new Error("Ainda existem itens pendentes de produção.");
            erro.codigo = "PRODUCAO_PENDENTE";
            erro.itensPendentes = itensPendentesPedido(pedido.id);
            throw erro;
        }
        if (destino === "entregue" && !forcar && pedido.statusPedido !== "pronto") throw new Error("O pedido precisa estar pronto antes da entrega.");
        return true;
    }

    function alterarStatusPedido(pedidoId, destino, opcoes = {}) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        validarTransicao(pedido, destino, Boolean(opcoes.forcar));
        const anterior = pedido.statusPedido;
        if (destino === "em_producao") criarOrdensPendentes(pedidoId);
        if (destino === "cancelado") return cancelarPedido(pedidoId, { arquivar: false, motivo: opcoes.motivo || "Pedido cancelado." });
        pedido.statusPedido = destino;
        pedido.atualizadoEm = agora();
        pedido.integridade = { ultimaTransicao: `${anterior}->${destino}`, validadaEm: pedido.atualizadoEm, forcada: Boolean(opcoes.forcar) };
        Storage.salvarPedido(pedido);
        registrar("status_pedido_integrado", `Pedido ${pedido.id}: ${anterior} → ${destino}.`, { pedidoId: pedido.id });
        notificar(["pedidos", "producao", "financeiro", "dashboard", "relatorios"], { pedidoId: pedido.id });
        return pedido;
    }

    function liberarReserva(reserva, status = "cancelada") {
        if (!reserva || reserva.status !== "ativa") return false;
        Storage.salvarReservaFilamento({ ...reserva, status, atualizadoEm: agora() });
        if (window.FilamentIntegration && reserva.filamentoId) FilamentIntegration.atualizarStatusRolo(reserva.filamentoId);
        return true;
    }

    function limparFilaImpressora(lote) {
        if (!lote?.impressoraId) return;
        const impressora = Storage.buscarImpressoraPorId(lote.impressoraId);
        if (!impressora) return;
        impressora.filaOperacoes = (impressora.filaOperacoes || []).filter(loteId => id(loteId) !== id(lote.id));
        if (id(impressora.operacaoAtualId) === id(lote.id)) {
            impressora.operacaoAtualId = null;
            if (!["manutencao", "offline"].includes(impressora.status)) impressora.status = "livre";
        }
        impressora.atualizadoEm = agora();
        Storage.salvarImpressora(impressora);
    }

    function cancelarProducaoPedido(pedidoId, motivo = "Pedido cancelado ou arquivado.") {
        const ordens = ordensDoPedido(pedidoId, true);
        const ordemIds = new Set(ordens.map(ordem => id(ordem.id)));
        const operacoes = Storage.listarOperacoesProducao().filter(operacao => ordemIds.has(id(operacao.ordemProducaoId)));
        const operacaoIds = new Set(operacoes.map(operacao => id(operacao.id)));
        const lotes = Storage.listarLotesExecucao().filter(lote => operacaoIds.has(id(lote.operacaoId)));
        const loteIds = new Set(lotes.map(lote => id(lote.id)));
        let reservasLiberadas = 0;

        Storage.listarReservasFilamento().filter(reserva => loteIds.has(id(reserva.loteExecucaoId))).forEach(reserva => {
            if (liberarReserva(reserva)) reservasLiberadas += 1;
        });
        lotes.forEach(lote => {
            if (!STATUS_FINAIS_LOTE.has(lote.status)) Storage.salvarLoteExecucao({ ...lote, status: "cancelado", canceladoEm: agora(), motivoCancelamento: motivo, atualizadoEm: agora() });
            limparFilaImpressora(lote);
        });
        operacoes.forEach(operacao => {
            if (!STATUS_FINAIS_OPERACAO.has(operacao.status)) Storage.salvarOperacaoProducao({ ...operacao, status: "cancelada", canceladoEm: agora(), motivoCancelamento: motivo, atualizadoEm: agora() });
        });
        ordens.forEach(ordem => {
            if (!STATUS_FINAIS_ORDEM.has(ordem.status)) Storage.salvarOrdemProducao({ ...ordem, ativo: false, status: "cancelada", produzido: numero(ordem.produzido), restante: 0, canceladoEm: agora(), motivoCancelamento: motivo, atualizadoEm: agora() });
        });
        registrar("producao_pedido_cancelada", `${ordens.length} ordem(ns) cancelada(s) para o pedido ${pedidoId}.`, { pedidoId, reservasLiberadas });
        return { ordens: ordens.length, operacoes: operacoes.length, lotes: lotes.length, reservasLiberadas };
    }

    function cancelarPedido(pedidoId, opcoes = {}) {
        const pedido = Storage.buscarPedidoPorId(pedidoId);
        if (!pedido) throw new Error("Pedido não encontrado.");
        const producao = cancelarProducaoPedido(pedidoId, opcoes.motivo);
        pedido.statusPedido = "cancelado";
        pedido.ativo = opcoes.arquivar ? false : pedido.ativo !== false;
        pedido.canceladoEm = agora();
        pedido.atualizadoEm = pedido.canceladoEm;
        pedido.integridade = { producaoCancelada: true, validadaEm: pedido.canceladoEm };
        Storage.salvarPedido(pedido);
        notificar(["pedidos", "producao", "filamentos", "estoque", "financeiro", "dashboard", "relatorios"], { pedidoId });
        return { pedido, producao };
    }

    function podeArquivarCliente(clienteId) {
        const pedidos = Storage.listarPedidos().filter(pedido => id(pedido.clienteId) === id(clienteId) && pedido.ativo !== false);
        return {
            podeExcluir: pedidos.length === 0,
            pedidos,
            abertos: pedidos.filter(pedido => !STATUS_FINAIS_PEDIDO.has(pedido.statusPedido))
        };
    }

    function arquivarCliente(clienteId) {
        const cliente = Storage.buscarClientePorId(clienteId);
        if (!cliente) throw new Error("Cliente não encontrado.");
        cliente.ativo = false;
        cliente.arquivadoEm = agora();
        cliente.atualizadoEm = cliente.arquivadoEm;
        Storage.salvarCliente(cliente);
        registrar("cliente_arquivado", `Cliente ${cliente.nome} arquivado com histórico preservado.`, { clienteId, pedidosVinculados: podeArquivarCliente(clienteId).pedidos.length });
        notificar(["clientes", "dashboard", "relatorios"], { clienteId });
        return cliente;
    }

    function transferirPedidosCliente(origemId, destinoId) {
        if (id(origemId) === id(destinoId)) throw new Error("Selecione outro cliente para a transferência.");
        const origem = Storage.buscarClientePorId(origemId);
        const destino = Storage.buscarClientePorId(destinoId);
        if (!origem || !destino || destino.ativo === false) throw new Error("Cliente de destino inválido.");
        const pedidos = Storage.listarPedidos().filter(pedido => id(pedido.clienteId) === id(origemId));
        pedidos.forEach(pedido => Storage.salvarPedido({ ...pedido, clienteId: destino.id, clienteNome: destino.nome, clienteWhatsapp: destino.whatsapp || "", transferidoDeClienteId: origem.id, atualizadoEm: agora() }));
        arquivarCliente(origemId);
        registrar("pedidos_cliente_transferidos", `${pedidos.length} pedido(s) transferido(s) de ${origem.nome} para ${destino.nome}.`, { clienteId: origemId, destinoClienteId: destinoId });
        notificar(["clientes", "pedidos", "financeiro", "dashboard", "relatorios"], { clienteId: destinoId });
        return pedidos.length;
    }

    function custoItem(item) {
        const produto = item.produtoId ? Storage.buscarProdutoPorId(item.produtoId) : null;
        return numero(item.custoTotal) || numero(item.custoUnitario ?? produto?.custoEstimado ?? produto?.custo) * numero(item.quantidade);
    }

    function metricasItens(itens = []) {
        return itens.reduce((resumo, item) => {
            const quantidade = numero(item.quantidade);
            const venda = numero(item.valorTotal) || quantidade * numero(item.valorUnitario ?? item.preco);
            const custo = custoItem(item);
            resumo.receita += venda;
            resumo.custo += custo;
            resumo.lucro += venda - custo;
            resumo.quantidade += quantidade;
            resumo.pesoGramas += numero(item.pesoTotalGramas) || numero(item.pesoPrevistoGramas) * quantidade;
            resumo.tempoMinutos += numero(item.tempoTotalMinutos) || numero(item.tempoPrevistoMinutos) * quantidade;
            resumo.filamentoGramas += numero(item.consumoFilamentoGramas) || numero(item.pesoPrevistoGramas) * quantidade;
            if (item.personalizado || !item.produtoId) resumo.personalizados += quantidade;
            return resumo;
        }, { receita: 0, custo: 0, lucro: 0, quantidade: 0, pesoGramas: 0, tempoMinutos: 0, filamentoGramas: 0, personalizados: 0 });
    }

    function calcularMetricas(pedidos = pedidosComerciais()) {
        const validos = pedidos.filter(pedido => pedido.ativo !== false && pedido.statusPedido !== "cancelado");
        const entregues = validos.filter(pedido => pedido.statusPedido === "entregue");
        const itens = entregues.flatMap(pedido => (pedido.itens || []).map(item => ({ ...item, pedidoId: pedido.id, clienteId: pedido.clienteId, clienteNome: pedido.clienteNome })));
        const base = metricasItens(itens);
        return {
            ...base,
            margem: base.receita > 0 ? base.lucro / base.receita * 100 : 0,
            pedidos: validos.length,
            entregues: entregues.length,
            emProducao: validos.filter(pedido => pedido.statusPedido === "em_producao").length,
            prontos: validos.filter(pedido => pedido.statusPedido === "pronto").length,
            itens
        };
    }

    function auditar(opcoes = {}) {
        const corrigir = opcoes.corrigir !== false;
        const inconsistencias = [];
        const correcoes = [];
        const pedidos = new Map(Storage.listarPedidos().map(pedido => [id(pedido.id), pedido]));
        const produtos = new Map(Storage.listarProdutos().map(produto => [id(produto.id), produto]));
        const clientes = new Map(Storage.listarClientes().map(cliente => [id(cliente.id), cliente]));
        const ordens = Storage.listarOrdensProducao();
        const operacoes = Storage.listarOperacoesProducao();
        const lotes = Storage.listarLotesExecucao();
        const operacoesMap = new Map(operacoes.map(operacao => [id(operacao.id), operacao]));
        const lotesMap = new Map(lotes.map(lote => [id(lote.id), lote]));

        function apontar(tipo, registroId, detalhe, corrigirFn) {
            inconsistencias.push({ tipo, registroId, detalhe });
            if (corrigir && corrigirFn) {
                corrigirFn();
                correcoes.push({ tipo, registroId });
            }
        }

        ordens.forEach(ordem => {
            const pedido = pedidos.get(id(ordem.pedidoId || ordem.orderId));
            const isEstoque = ordem.origem === "estoque";
            if (!pedido) {
                apontar("producao_sem_pedido", ordem.id, "Ordem sem pedido.", () => cancelarOrdemOrfa(ordem));
            } else {
                const item = (pedido.itens || []).find(registro => id(registro.id) === id(ordem.itemPedidoId || ordem.orderItemId));
                const produto = item?.produtoId ? produtos.get(id(item.produtoId)) : null;
                if (!item) apontar("producao_sem_item", ordem.id, "Item do pedido não existe.", () => cancelarOrdemOrfa(ordem));
                else if (item.produtoId && (!produto || produto.ativo === false)) apontar("producao_sem_produto", ordem.id, "Produto cadastrado foi removido ou inativado.", () => cancelarOrdemOrfa(ordem));
                else if (!isEstoque && (pedido.ativo === false || STATUS_FINAIS_PEDIDO.has(pedido.statusPedido)) && !STATUS_FINAIS_ORDEM.has(ordem.status)) apontar("pedido_final_na_producao", ordem.id, `Pedido ${pedido.statusPedido} ainda possui produção ativa.`, () => cancelarOrdemOrfa(ordem));
            }
        });

        lotes.forEach(lote => {
            if (!operacoesMap.has(id(lote.operacaoId))) apontar("lote_sem_operacao", lote.id, "Lote sem operação.", () => {
                limparFilaImpressora(lote);
                Storage.salvarLoteExecucao({ ...lote, status: "cancelado", atualizadoEm: agora() });
            });
        });

        Storage.listarReservasFilamento().filter(reserva => reserva.status === "ativa").forEach(reserva => {
            const lote = lotesMap.get(id(reserva.loteExecucaoId));
            if (!lote || STATUS_FINAIS_LOTE.has(lote.status)) apontar("reserva_sem_producao", reserva.id, "Reserva não possui lote ativo.", () => liberarReserva(reserva));
        });

        Storage.listarPedidos().filter(pedido => pedido.ativo !== false).forEach(pedido => {
            if (pedido.clienteId && !clientes.has(id(pedido.clienteId))) apontar("cliente_inexistente_pedido", pedido.id, "Cliente original não existe; snapshot foi preservado.", () => Storage.salvarPedido({ ...pedido, clienteId: null, clienteSnapshot: { nome: pedido.clienteNome, whatsapp: pedido.clienteWhatsapp }, atualizadoEm: agora() }));
        });

        Storage.listarProdutos().forEach(produto => {
            const estoque = numero(produto.estoque ?? produto.estoqueAtual ?? produto.quantidadeEstoque);
            if (estoque < 0) apontar("estoque_negativo", produto.id, `Estoque ${estoque}.`, () => Storage.salvarProduto({ ...produto, estoque: 0, estoqueAtual: 0, quantidadeEstoque: 0, atualizadoEm: agora() }));
        });

        Storage.listarFilamentos().forEach(filamento => {
            const atual = Math.max(0, numero(filamento.pesoAtualGramas ?? numero(filamento.pesoAtualKg) * 1000));
            const reservado = Storage.listarReservasFilamento().filter(reserva => reserva.status === "ativa" && id(reserva.filamentoId) === id(filamento.id)).reduce((total, reserva) => total + numero(reserva.pesoReservadoGramas), 0);
            if (reservado > atual + .01) apontar("filamento_reservado_incorreto", filamento.id, `${reservado} g reservados para ${atual} g físicos.`, null);
            if (numero(filamento.pesoAtualGramas) < 0 || numero(filamento.pesoAtualKg) < 0) apontar("filamento_negativo", filamento.id, "Peso negativo.", () => Storage.salvarFilamento({ ...filamento, pesoAtualGramas: 0, pesoAtualKg: 0, status: "esgotado", atualizadoEm: agora() }));
        });

        if (inconsistencias.length) registrar("auditoria_integridade", `${inconsistencias.length} inconsistência(s), ${correcoes.length} corrigida(s).`, { inconsistencias, correcoes });
        if (correcoes.length) notificar(["pedidos", "producao", "estoque", "filamentos", "dashboard", "relatorios"], { auditoria: true });
        return { inconsistencias, correcoes, valido: inconsistencias.length === 0 || inconsistencias.length === correcoes.length };
    }

    function cancelarOrdemOrfa(ordem) {
        const operacoes = operacoesDaOrdem(ordem.id, true);
        const operacaoIds = new Set(operacoes.map(item => id(item.id)));
        const lotes = Storage.listarLotesExecucao().filter(lote => operacaoIds.has(id(lote.operacaoId)));
        lotes.forEach(lote => {
            Storage.listarReservasFilamento().filter(reserva => id(reserva.loteExecucaoId) === id(lote.id)).forEach(reserva => liberarReserva(reserva));
            limparFilaImpressora(lote);
            if (!STATUS_FINAIS_LOTE.has(lote.status)) Storage.salvarLoteExecucao({ ...lote, status: "cancelado", atualizadoEm: agora() });
        });
        operacoes.forEach(operacao => {
            if (!STATUS_FINAIS_OPERACAO.has(operacao.status)) Storage.salvarOperacaoProducao({ ...operacao, status: "cancelada", atualizadoEm: agora() });
        });
        Storage.salvarOrdemProducao({ ...ordem, ativo: false, status: "cancelada", restante: 0, atualizadoEm: agora() });
    }

    function inicializar() {
        Producao.migrarDados();
        migrarDemandasEstoqueLegadas();
        const resultado = auditar({ corrigir: true });
        console.info(`[PrimeDocs] Integração ERP: ${resultado.inconsistencias.length} inconsistência(s), ${resultado.correcoes.length} correção(ões).`);
        return resultado;
    }

    return {
        STATUS_TRANSICOES,
        pedidosComerciais,
        pedidoAtivo,
        ordensDoPedido,
        ordensAtivas,
        ordemValida,
        itensPendentesPedido,
        producaoCompleta,
        criarOrdensPendentes,
        validarTransicao,
        alterarStatusPedido,
        cancelarProducaoPedido,
        cancelarPedido,
        podeArquivarCliente,
        arquivarCliente,
        transferirPedidosCliente,
        custoItem,
        metricasItens,
        calcularMetricas,
        migrarDemandasEstoqueLegadas,
        auditar,
        inicializar,
        _copiar: copiar
    };
})();

window.ERPIntegracao = ERPIntegracao;
