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
            pesoTotalGramas: Math.max(0, Number(operacao.pesoTotalGramas) || 0),
            materiais: Array.isArray(operacao.materiais) ? operacao.materiais.map(material => ({
                material: material.material || "PLA",
                cor: material.cor || "",
                pesoGramas: Math.max(0, Number(material.pesoGramas) || 0),
                obrigatorio: material.obrigatorio !== false
            })) : [],
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
        return {
            ...produto,
            tipoProducao: produto.tipoProducao === "composta" ? "composta" : "simples",
            operacoesModelo: operacoes
        };
    }

    function operacaoSimples(produto = {}) {
        return normalizarOperacaoModelo({
            nome: `Imprimir ${produto.nome || "produto"}`,
            tipo: "impressao",
            tempoHoras: Math.floor(minutosDoTempo(produto.tempo) / 60),
            tempoMinutos: minutosDoTempo(produto.tempo) % 60,
            pesoTotalGramas: Number(produto.peso) || 0,
            materiais: [{ material: "PLA", cor: produto.cor || "", pesoGramas: Number(produto.peso) || 0, obrigatorio: true }]
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
                    filamentosSelecionados: (op.materiais || []).map(material => ({ filamentoId: null, material: material.material, cor: material.cor, pesoPrevistoGramas: Number(material.pesoGramas || 0) * Math.max(1, Number(grupo.item.quantidade) || 1), pesoRealGramas: 0, obrigatorio: material.obrigatorio !== false })),
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

    function migrarDados() {
        let mudouProdutos = false;
        const produtos = Storage.listarProdutos().map(produto => {
            if (produto.tipoProducao && Array.isArray(produto.operacoesModelo)) return produto;
            mudouProdutos = true;
            return normalizarProduto(produto);
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
        return { produtos: mudouProdutos, pedidos: mudouPedidos };
    }

    return { TIPOS, STATUS: STATUS_ORDEM, STATUS_ORDEM, STATUS_OPERACAO, normalizarOperacaoModelo, normalizarProduto, obterReceita, gerarPreviaPedido, criarOrdensDoPedido, migrarDados };
})();

window.Producao = Producao;
