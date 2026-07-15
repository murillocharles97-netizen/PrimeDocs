/* ==========================================
   PrimeDocs
   storage.js
   Central de armazenamento do aplicativo
========================================== */

const Storage = {

    // ===========================
    // Chaves do LocalStorage
    // ===========================

    KEYS: {

        produtos: "primedocs_produtos",
        colecoesProdutos: "primedocs_colecoes_produtos",
        lojas: "primedocs_lojas",
        consignados: "primedocs_consignados",
        estoquesLojas: "primedocs_estoques_lojas",
        conferencias: "primedocs_conferencias",
        configuracoes: "primedocs_config",
        tema: "primedocs_tema",
        empresas: "primedocs_empresas",
        clientes: "primedocs_clientes",
        pedidos: "primedocs_pedidos",
        orcamentos: "primedocs_orcamentos",
        pagamentos: "primedocs_pagamentos",
        financeiro: "primedocs_financeiro",
        notificacoes: "primedocs_notificacoes",
        filamentos: "primedocs_filamentos",
        configCustos: "primedocs_config_custos",
        gerador3d: "primedocs_gerador_3d",
        impressoras: "primedocs_impressoras",
        ordensProducao: "primedocs_ordens_producao",
        operacoesProducao: "primedocs_operacoes_producao",
        historicoProducao: "primedocs_historico_producao",
        manutencoes: "primedocs_manutencoes",
        reservasFilamento: "primedocs_reservas_filamento",
        lotesExecucao: "primedocs_lotes_execucao",
        historicoFilamentos: "primedocs_historico_filamentos",

    },



    // ===========================
    // PRODUTOS
    // ===========================

    listarProdutos() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.produtos)
        ) || [];

    },



    salvarProdutos(lista) {

        localStorage.setItem(
            this.KEYS.produtos,
            JSON.stringify(lista)
        );

    },



    adicionarProduto(produto) {

        const produtos = this.listarProdutos();

        produtos.push(produto);

        this.salvarProdutos(produtos);

    },



    atualizarProduto(id, novoProduto) {

        const produtos = this.listarProdutos();

        const index = produtos.findIndex(p => p.id === id);

        if (index >= 0) {

            produtos[index] = novoProduto;

            this.salvarProdutos(produtos);

        }

    },



    excluirProduto(id) {

        const produtos = this
            .listarProdutos()
            .filter(p => p.id !== id);

        this.salvarProdutos(produtos);

    },



    buscarProduto(id) {

        return this
            .listarProdutos()
            .find(p => p.id === id);

    },



    pesquisarProdutos(texto) {

        texto = texto.toLowerCase();

        return this
            .listarProdutos()
            .filter(prod =>

                prod.nome
                    .toLowerCase()
                    .includes(texto)

            );

    },

    // ===========================
    // COLEÇÕES DE PRODUTOS
    // ===========================

    listarColecoesProdutos() {
        try {
            const lista = JSON.parse(localStorage.getItem(this.KEYS.colecoesProdutos));
            return Array.isArray(lista) ? lista : [];
        } catch (erro) {
            return [];
        }
    },

    salvarColecoesProdutos(lista) {
        localStorage.setItem(this.KEYS.colecoesProdutos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarColecaoProduto(colecao) {
        const lista = this.listarColecoesProdutos();
        const index = lista.findIndex(item => String(item.id) === String(colecao.id));
        const agora = new Date().toISOString();
        const registro = {
            id: colecao.id || `colecao-${Date.now()}`,
            nome: String(colecao.nome || "").trim(),
            icone: colecao.icone || "boxes",
            cor: colecao.cor || "#6D4AFF",
            descricao: colecao.descricao || "",
            ordem: Math.max(0, Number(colecao.ordem ?? lista.length) || 0),
            ativo: colecao.ativo !== false,
            criadoEm: colecao.criadoEm || agora,
            atualizadoEm: agora
        };
        if (!registro.nome) throw new Error("Informe o nome da coleção.");
        const nomeNormalizado = registro.nome.toLocaleLowerCase("pt-BR");
        if (lista.some(item => String(item.id) !== String(registro.id) && item.ativo !== false && String(item.nome || "").trim().toLocaleLowerCase("pt-BR") === nomeNormalizado)) {
            throw new Error("Já existe uma coleção ativa com este nome.");
        }
        if (index < 0) lista.push(registro); else lista[index] = registro;
        this.salvarColecoesProdutos(lista);
        return registro;
    },

    buscarColecaoProdutoPorId(id) {
        return this.listarColecoesProdutos().find(item => String(item.id) === String(id));
    },

    buscarColecaoGeral() {
        return this.listarColecoesProdutos().find(item => item.ativo !== false && String(item.nome || "").trim().toLocaleLowerCase("pt-BR") === "geral");
    },

    inativarColecaoProduto(id) {
        const colecao = this.buscarColecaoProdutoPorId(id);
        if (!colecao) return false;
        if (String(colecao.nome || "").trim().toLocaleLowerCase("pt-BR") === "geral") throw new Error("A coleção Geral não pode ser inativada.");
        const geral = this.garantirColecaoGeral(id);
        const produtos = this.listarProdutos().map(produto => String(produto.colecaoId) === String(id) ? { ...produto, colecaoId: geral.id, atualizadoEm: new Date().toISOString() } : produto);
        this.salvarProdutos(produtos);
        this.salvarColecaoProduto({ ...colecao, ativo: false });
        return true;
    },

    garantirColecaoGeral(ignorarId = "") {
        const existente = this.listarColecoesProdutos().find(item => String(item.id) !== String(ignorarId) && item.ativo !== false && String(item.nome || "").trim().toLocaleLowerCase("pt-BR") === "geral");
        if (existente) return existente;
        return this.salvarColecaoProduto({ id: "colecao-geral", nome: "Geral", icone: "boxes", cor: "#6D4AFF", descricao: "Produtos ainda não organizados em outra coleção.", ordem: 0, ativo: true });
    },

    migrarColecoesProdutos() {
        const geral = this.garantirColecaoGeral();
        const idsValidos = new Set(this.listarColecoesProdutos().filter(item => item.ativo !== false).map(item => String(item.id)));
        let alterados = 0;
        const produtos = this.listarProdutos().map(produto => {
            if (produto.colecaoId && idsValidos.has(String(produto.colecaoId))) return produto;
            alterados += 1;
            return { ...produto, colecaoId: geral.id, atualizadoEm: produto.atualizadoEm || new Date().toISOString() };
        });
        if (alterados) this.salvarProdutos(produtos);
        return { colecaoGeralId: geral.id, produtosMigrados: alterados };
    },



    // ===========================
    // CONFIGURAÇÕES
    // ===========================

    listarLojas() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.lojas)
        ) || [];

    },



    salvarLojas(lista) {

        localStorage.setItem(
            this.KEYS.lojas,
            JSON.stringify(lista)
        );

    },



    salvarLoja(loja) {

        const lojas = this.listarLojas();
        const index = lojas.findIndex(item => item.id == loja.id);

        if (index === -1) {
            lojas.push(loja);
        } else {
            lojas[index] = loja;
        }

        this.salvarLojas(lojas);

    },



    excluirLoja(id) {

        const lojas = this
            .listarLojas()
            .filter(loja => loja.id != id);

        this.salvarLojas(lojas);

    },



    buscarLojaPorId(id) {

        return this
            .listarLojas()
            .find(loja => loja.id == id);

    },



    listarConsignados() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.consignados)
        ) || [];

    },



    salvarConsignado(consignado) {

        const consignados = this.listarConsignados();
        const index = consignados.findIndex(
            item => String(item.id) === String(consignado.id)
        );

        if (index === -1) {
            consignados.push(consignado);
        } else {
            consignados[index] = { ...consignados[index], ...consignado };
        }
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(consignados)
        );

    },



    buscarMovimentacaoConsignadoPorId(id) {

        return this.listarConsignados().find(
            item => String(item.id) === String(id)
        ) || null;

    },



    buscarUltimoConsignadoPorLoja(referenciaLoja) {

        const referencia = String(referenciaLoja || "").toLocaleLowerCase("pt-BR");

        return [...this.listarConsignados()]
            .reverse()
            .find(consignado =>
                consignado.tipo !== "ajuste_manual_estoque_loja"
                && (
                    String(consignado.lojaId) === String(referenciaLoja)
                    || String(consignado.lojaNome || "").toLocaleLowerCase("pt-BR") === referencia
                )
            );

    },



    listarEstoquesLojas() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.estoquesLojas)
        ) || [];

    },



    salvarEstoquesLojas(lista) {

        localStorage.setItem(
            this.KEYS.estoquesLojas,
            JSON.stringify(lista)
        );

    },



    buscarEstoqueLoja(lojaId) {

        return this
            .listarEstoquesLojas()
            .find(estoque => String(estoque.lojaId) === String(lojaId));

    },



    salvarEstoqueLoja(estoque) {

        const estoques = this.listarEstoquesLojas();
        const index = estoques.findIndex(
            item => String(item.lojaId) === String(estoque.lojaId)
        );

        if (index === -1) {
            estoques.push(estoque);
        } else {
            estoques[index] = estoque;
        }

        this.salvarEstoquesLojas(estoques);

    },



    listarConferencias() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.conferencias)
        ) || [];

    },



    salvarConferencia(conferencia) {

        const conferencias = this.listarConferencias();
        conferencias.push(conferencia);
        localStorage.setItem(
            this.KEYS.conferencias,
            JSON.stringify(conferencias)
        );

    },



    limparDadosOrfaosLojas() {

        const lojasAtivas = this
            .listarLojas()
            .filter(loja => loja.ativo !== false);
        const lojasPorId = new Map(
            lojasAtivas.map(loja => [String(loja.id), loja])
        );
        const lojasPorNome = new Map(
            lojasAtivas.map(loja => [
                String(loja.nome || "").trim().toLocaleLowerCase("pt-BR"),
                loja
            ])
        );

        const reconciliarRegistro = registro => {
            let loja = lojasPorId.get(String(registro.lojaId));
            const semLojaId = registro.lojaId === undefined
                || registro.lojaId === null
                || registro.lojaId === "";

            if (!loja && semLojaId) {
                const nome = String(registro.lojaNome || "")
                    .trim()
                    .toLocaleLowerCase("pt-BR");
                loja = lojasPorNome.get(nome);
            }

            if (!loja) return null;

            return {
                ...registro,
                lojaId: loja.id,
                lojaNome: loja.nome
            };
        };

        const limparLista = lista => lista
            .map(reconciliarRegistro)
            .filter(Boolean);

        const estoques = limparLista(this.listarEstoquesLojas());
        const consignados = limparLista(this.listarConsignados());
        const conferencias = limparLista(this.listarConferencias());

        this.salvarEstoquesLojas(estoques);
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(consignados)
        );
        localStorage.setItem(
            this.KEYS.conferencias,
            JSON.stringify(conferencias)
        );

        return {
            estoques: estoques.length,
            consignados: consignados.length,
            conferencias: conferencias.length
        };

    },



    salvarConfiguracoes(config) {

        localStorage.setItem(

            this.KEYS.configuracoes,

            JSON.stringify(config)

        );

    },



    carregarConfiguracoes() {

        return JSON.parse(

            localStorage.getItem(
                this.KEYS.configuracoes
            )

        ) || {};

    },



    listarEmpresas() {

        return JSON.parse(
            localStorage.getItem(this.KEYS.empresas)
        ) || [];

    },



    salvarEmpresas(lista) {

        localStorage.setItem(
            this.KEYS.empresas,
            JSON.stringify(Array.isArray(lista) ? lista : [])
        );

    },



    salvarEmpresa(empresa) {

        const empresas = this.listarEmpresas();
        const index = empresas.findIndex(item => String(item.id) === String(empresa.id));
        const registro = {
            ...empresa,
            corPrincipal: empresa.corPrincipal || "#6D5DFD",
            ativa: empresa.ativa !== false,
            padrao: empresa.ativa !== false && Boolean(empresa.padrao)
        };

        if (registro.padrao) {
            empresas.forEach(item => {
                item.padrao = false;
            });
        }

        if (index === -1) {
            empresas.push(registro);
        } else {
            empresas[index] = registro;
        }

        if (!empresas.some(item => item.ativa !== false && item.padrao)) {
            const primeiraAtiva = empresas.find(item => item.ativa !== false);
            if (primeiraAtiva) primeiraAtiva.padrao = true;
        }

        this.salvarEmpresas(empresas);
        return registro;

    },



    buscarEmpresaPorId(id) {

        return this.listarEmpresas()
            .find(empresa => String(empresa.id) === String(id));

    },



    buscarEmpresaPadrao() {

        const empresasAtivas = this.listarEmpresas()
            .filter(empresa => empresa.ativa !== false);

        return empresasAtivas.find(empresa => empresa.padrao)
            || empresasAtivas[0]
            || null;

    },



    definirEmpresaPadrao(id) {

        const empresas = this.listarEmpresas();
        const selecionada = empresas.find(
            empresa => String(empresa.id) === String(id) && empresa.ativa !== false
        );

        if (!selecionada) return false;

        empresas.forEach(empresa => {
            empresa.padrao = String(empresa.id) === String(id);
        });
        this.salvarEmpresas(empresas);
        return true;

    },



    excluirEmpresa(id) {

        const empresas = this.listarEmpresas();
        const empresa = empresas.find(item => String(item.id) === String(id));

        if (!empresa) return false;

        empresa.ativa = false;
        empresa.padrao = false;

        const novaPadrao = empresas.find(item => item.ativa !== false);
        if (novaPadrao && !empresas.some(item => item.ativa !== false && item.padrao)) {
            novaPadrao.padrao = true;
        }

        this.salvarEmpresas(empresas);
        return true;

    },



    listarClientes() {
        return JSON.parse(localStorage.getItem(this.KEYS.clientes)) || [];
    },

    salvarClientes(lista) {
        localStorage.setItem(this.KEYS.clientes, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarCliente(cliente) {
        const lista = this.listarClientes();
        const index = lista.findIndex(item => String(item.id) === String(cliente.id));
        if (index === -1) lista.push(cliente);
        else lista[index] = cliente;
        this.salvarClientes(lista);
        return cliente;
    },

    buscarClientePorId(id) {
        return this.listarClientes().find(item => String(item.id) === String(id));
    },

    excluirCliente(id) {
        const cliente = this.buscarClientePorId(id);
        if (!cliente) return false;
        cliente.ativo = false;
        cliente.atualizadoEm = new Date().toISOString();
        this.salvarCliente(cliente);
        return true;
    },

    listarOrcamentos() {
        return JSON.parse(localStorage.getItem(this.KEYS.orcamentos)) || [];
    },

    salvarOrcamentos(lista) {
        localStorage.setItem(this.KEYS.orcamentos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarOrcamento(orcamento) {
        const lista = this.listarOrcamentos();
        const index = lista.findIndex(item => String(item.id) === String(orcamento.id));
        if (index === -1) lista.push(orcamento);
        else lista[index] = orcamento;
        this.salvarOrcamentos(lista);
        return orcamento;
    },

    buscarOrcamentoPorId(id) {
        return this.listarOrcamentos().find(item => String(item.id) === String(id));
    },

    listarPagamentos() {
        return JSON.parse(localStorage.getItem(this.KEYS.pagamentos)) || [];
    },

    salvarPagamentos(lista) {
        localStorage.setItem(this.KEYS.pagamentos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarPagamento(pagamento) {
        const lista = this.listarPagamentos();
        const index = lista.findIndex(item => String(item.id) === String(pagamento.id));
        if (index === -1) lista.push(pagamento);
        else lista[index] = pagamento;
        this.salvarPagamentos(lista);
        return pagamento;
    },

    listarLancamentosFinanceiros() {
        return JSON.parse(localStorage.getItem(this.KEYS.financeiro)) || [];
    },

    salvarLancamentosFinanceiros(lista) {
        localStorage.setItem(this.KEYS.financeiro, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarLancamentoFinanceiro(lancamento) {
        const lista = this.listarLancamentosFinanceiros();
        const index = lista.findIndex(item => String(item.id) === String(lancamento.id));
        if (index === -1) lista.push(lancamento);
        else lista[index] = lancamento;
        this.salvarLancamentosFinanceiros(lista);
        return lancamento;
    },

    buscarLancamentoFinanceiroPorId(id) {
        return this.listarLancamentosFinanceiros().find(item => String(item.id) === String(id));
    },

    listarNotificacoes() {
        return JSON.parse(localStorage.getItem(this.KEYS.notificacoes)) || [];
    },

    salvarNotificacoes(lista) {
        localStorage.setItem(this.KEYS.notificacoes, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarNotificacao(notificacao) {
        const lista = this.listarNotificacoes();
        const index = lista.findIndex(item => String(item.id) === String(notificacao.id));
        if (index === -1) lista.push(notificacao);
        else lista[index] = notificacao;
        this.salvarNotificacoes(lista);
        return notificacao;
    },

    marcarNotificacaoVisualizada(id) {
        const item = this.listarNotificacoes().find(notificacao => String(notificacao.id) === String(id));
        if (!item) return false;
        item.visualizada = true;
        this.salvarNotificacao(item);
        return true;
    },



    listarPedidos() {
        return JSON.parse(localStorage.getItem(this.KEYS.pedidos)) || [];
    },

    salvarPedidos(lista) {
        localStorage.setItem(this.KEYS.pedidos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarPedido(pedido) {
        const lista = this.listarPedidos();
        const index = lista.findIndex(item => String(item.id) === String(pedido.id));
        if (index === -1) lista.push(pedido);
        else lista[index] = pedido;
        this.salvarPedidos(lista);
        return pedido;
    },

    buscarPedidoPorId(id) {
        return this.listarPedidos().find(item => String(item.id) === String(id));
    },

    excluirPedido(id) {
        const pedido = this.buscarPedidoPorId(id);
        if (!pedido) return false;
        pedido.ativo = false;
        pedido.atualizadoEm = new Date().toISOString();
        this.salvarPedido(pedido);
        return true;
    },



    listarFilamentos() {
        return JSON.parse(localStorage.getItem(this.KEYS.filamentos)) || [];
    },

    listarImpressoras() {
        return JSON.parse(localStorage.getItem(this.KEYS.impressoras)) || [];
    },

    salvarImpressoras(lista) {
        localStorage.setItem(this.KEYS.impressoras, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarImpressora(impressora) {
        const lista = this.listarImpressoras();
        const index = lista.findIndex(item => String(item.id) === String(impressora.id));
        if (index === -1) lista.push(impressora); else lista[index] = impressora;
        this.salvarImpressoras(lista);
        return impressora;
    },

    buscarImpressoraPorId(id) {
        return this.listarImpressoras().find(item => String(item.id) === String(id));
    },

    excluirImpressora(id) {
        const item = this.buscarImpressoraPorId(id);
        if (!item) return false;
        item.ativa = false;
        item.status = "offline";
        item.atualizadoEm = new Date().toISOString();
        return this.salvarImpressora(item);
    },

    listarOrdensProducao() {
        return JSON.parse(localStorage.getItem(this.KEYS.ordensProducao)) || [];
    },

    salvarOrdensProducao(lista) {
        localStorage.setItem(this.KEYS.ordensProducao, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarOrdemProducao(ordem) {
        const lista = this.listarOrdensProducao();
        const index = lista.findIndex(item => String(item.id) === String(ordem.id));
        if (index === -1) lista.push(ordem); else lista[index] = ordem;
        this.salvarOrdensProducao(lista);
        return ordem;
    },

    buscarOrdemProducaoPorId(id) {
        return this.listarOrdensProducao().find(item => String(item.id) === String(id));
    },

    listarOperacoesProducao() {
        return JSON.parse(localStorage.getItem(this.KEYS.operacoesProducao)) || [];
    },

    salvarOperacoesProducao(lista) {
        localStorage.setItem(this.KEYS.operacoesProducao, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarOperacaoProducao(operacao) {
        const lista = this.listarOperacoesProducao();
        const index = lista.findIndex(item => String(item.id) === String(operacao.id));
        if (index === -1) lista.push(operacao); else lista[index] = operacao;
        this.salvarOperacoesProducao(lista);
        return operacao;
    },

    buscarOperacaoProducaoPorId(id) {
        return this.listarOperacoesProducao().find(item => String(item.id) === String(id));
    },

    listarHistoricoProducao() {
        return JSON.parse(localStorage.getItem(this.KEYS.historicoProducao)) || [];
    },

    salvarHistoricoProducao(lista) {
        localStorage.setItem(this.KEYS.historicoProducao, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    registrarHistoricoProducao(evento) {
        const lista = this.listarHistoricoProducao();
        lista.push({ id: evento.id || `hist-prod-${Date.now()}`, criadoEm: evento.criadoEm || new Date().toISOString(), ...evento });
        this.salvarHistoricoProducao(lista);
        return evento;
    },

    listarManutencoes() {
        return JSON.parse(localStorage.getItem(this.KEYS.manutencoes)) || [];
    },

    salvarManutencoes(lista) {
        localStorage.setItem(this.KEYS.manutencoes, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarManutencao(manutencao) {
        const lista = this.listarManutencoes();
        const index = lista.findIndex(item => String(item.id) === String(manutencao.id));
        if (index === -1) lista.push(manutencao); else lista[index] = manutencao;
        this.salvarManutencoes(lista);
        return manutencao;
    },

    listarReservasFilamento() {
        return JSON.parse(localStorage.getItem(this.KEYS.reservasFilamento)) || [];
    },

    salvarReservasFilamento(lista) {
        localStorage.setItem(this.KEYS.reservasFilamento, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarReservaFilamento(reserva) {
        const lista = this.listarReservasFilamento();
        const index = lista.findIndex(item => String(item.id) === String(reserva.id));
        if (index === -1) lista.push(reserva); else lista[index] = reserva;
        this.salvarReservasFilamento(lista);
        return reserva;
    },

    listarLotesExecucao() {
        return JSON.parse(localStorage.getItem(this.KEYS.lotesExecucao)) || [];
    },

    salvarLotesExecucao(lista) {
        localStorage.setItem(this.KEYS.lotesExecucao, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarLoteExecucao(lote) {
        const lista = this.listarLotesExecucao();
        const index = lista.findIndex(item => String(item.id) === String(lote.id));
        if (index === -1) lista.push(lote); else lista[index] = lote;
        this.salvarLotesExecucao(lista);
        return lote;
    },

    buscarLoteExecucaoPorId(id) {
        return this.listarLotesExecucao().find(item => String(item.id) === String(id));
    },

    listarHistoricoFilamentos() {
        return JSON.parse(localStorage.getItem(this.KEYS.historicoFilamentos)) || [];
    },

    salvarHistoricoFilamentos(lista) {
        localStorage.setItem(this.KEYS.historicoFilamentos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarHistoricoFilamento(evento) {
        const lista = this.listarHistoricoFilamentos();
        const index = lista.findIndex(item => String(item.id) === String(evento.id));
        if (index === -1) lista.push(evento); else lista[index] = evento;
        this.salvarHistoricoFilamentos(lista);
        return evento;
    },

    salvarFilamentos(lista) {
        localStorage.setItem(this.KEYS.filamentos, JSON.stringify(Array.isArray(lista) ? lista : []));
    },

    salvarFilamento(filamento) {
        const lista = this.listarFilamentos();
        const index = lista.findIndex(item => String(item.id) === String(filamento.id));
        if (index === -1) lista.push(filamento);
        else lista[index] = filamento;
        this.salvarFilamentos(lista);
        return filamento;
    },

    buscarFilamentoPorId(id) {
        return this.listarFilamentos().find(item => String(item.id) === String(id));
    },

    excluirFilamento(id) {
        const filamento = this.buscarFilamentoPorId(id);
        if (!filamento) return false;
        filamento.ativo = false;
        filamento.atualizadoEm = new Date().toISOString();
        this.salvarFilamento(filamento);
        return true;
    },

    baixarFilamento(id, quantidadeKg) {
        const filamento = this.buscarFilamentoPorId(id);
        const consumo = Math.max(0, Number(quantidadeKg) || 0);
        if (!filamento || consumo <= 0) return false;
        const atualGramas = Math.max(0, Number(filamento.pesoAtualGramas ?? (Number(filamento.pesoAtualKg || 0) * 1000)) || 0);
        filamento.pesoAtualGramas = Math.max(0, atualGramas - consumo * 1000);
        filamento.pesoAtualKg = filamento.pesoAtualGramas / 1000;
        if (filamento.pesoAtualGramas <= 0) {
            filamento.status = "esgotado";
            filamento.esgotado = true;
        }
        filamento.atualizadoEm = new Date().toISOString();
        this.salvarFilamento(filamento);
        return filamento;
    },



    salvarConfigCustos(config) {
        localStorage.setItem(this.KEYS.configCustos, JSON.stringify({
            ...this.carregarConfigCustos(),
            ...config
        }));
    },

    carregarConfigCustos() {
        const padrao = {
            precoKgFilamentoPadrao: 85,
            custoEnergiaHora: 0.20,
            custoDepreciacaoHora: 0.50,
            valorMaoDeObraHora: 0,
            margemLucroPadrao: 100,
            custoEmbalagemPadrao: 0,
            taxaImpostoPercentual: 0,
            perdaPercentual: 5,
            cobrarMaoDeObraPorPadrao: false
        };
        const salvo = JSON.parse(localStorage.getItem(this.KEYS.configCustos)) || {};
        return { ...padrao, ...salvo };
    },



    salvarConfigGerador3D(config) {
        localStorage.setItem(this.KEYS.gerador3d, JSON.stringify({
            ...this.carregarConfigGerador3D(),
            ...config
        }));
    },

    carregarConfigGerador3D() {
        const padrao = {
            largura: 120,
            altura: 120,
            linhas: 2,
            colunas: 2,
            espessura: 3,
            folga: 0.30,
            raioCantos: 3,
            diametroEncaixe: 18,
            diametroIma: 8.2,
            profundidadeIma: 2.1,
            alturaMascara: 15,
            folgaMascara: 0.05,
            alturaCortador: 12,
            larguraLinha: 1.2,
            posX: 0,
            posY: 0,
            centralizarOrigem: true,
            corteImaAtivo: true,
            imaOffsetX: 0,
            imaOffsetY: 0,
            modoPosicaoIma: "centro",
            ima1X: -30,
            ima1Y: 30,
            ima2X: 30,
            ima2Y: 30,
            ima3X: -30,
            ima3Y: -30,
            ima4X: 30,
            ima4Y: -30,
            alturaLogo: 0.8,
            logoX: 0,
            logoY: 0,
            logoEscala: 1,
            logoRotacao: 0,
            separarPecas: true,
            espacoVisual: 5,
            logoSvg: "",
            imagemOriginal: "",
            svgVetorizado: "",
            vetorAceito: false,
            vectorCores: 4,
            vectorSuavizacao: 1,
            vectorEspessuraMinima: 1,
            vectorRemoverRuido: 8,
            debugModo: "stl"
        };
        const salvo = JSON.parse(localStorage.getItem(this.KEYS.gerador3d)) || {};
        return { ...padrao, ...salvo };
    },



    obterTodosDados() {

        const configuracoes = this.carregarConfiguracoes();

        return {
            produtos: this.listarProdutos(),
            colecoesProdutos: this.listarColecoesProdutos(),
            lojas: this.listarLojas(),
            estoques: this.listarEstoquesLojas(),
            consignados: this.listarConsignados(),
            conferencias: this.listarConferencias(),
            empresas: this.listarEmpresas(),
            clientes: this.listarClientes(),
            pedidos: this.listarPedidos(),
            orcamentos: this.listarOrcamentos(),
            pagamentos: this.listarPagamentos(),
            financeiro: this.listarLancamentosFinanceiros(),
            notificacoes: this.listarNotificacoes(),
            filamentos: this.listarFilamentos(),
            impressoras: this.listarImpressoras(),
            ordensProducao: this.listarOrdensProducao(),
            operacoesProducao: this.listarOperacoesProducao(),
            historicoProducao: this.listarHistoricoProducao(),
            manutencoes: this.listarManutencoes(),
            reservasFilamento: this.listarReservasFilamento(),
            lotesExecucao: this.listarLotesExecucao(),
            historicoFilamentos: this.listarHistoricoFilamentos(),
            configuracoesCustos: this.carregarConfigCustos(),
            gerador3d: this.carregarConfigGerador3D(),
            configuracoes: {
                ...configuracoes,
                tema: localStorage.getItem(this.KEYS.tema)
                    || configuracoes.tema
                    || "light"
            }
        };

    },



    exportarBackup() {

        return {
            versao: typeof APP !== "undefined" ? APP.versao : "1.0.0",
            empresa: "PrimeDocs",
            dataBackup: new Date().toISOString(),
            dados: this.obterTodosDados()
        };

    },



    validarBackup(backup) {

        if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
            return false;
        }

        if (typeof backup.empresa !== "string" || !backup.empresa.trim()) {
            return false;
        }

        if (typeof backup.versao !== "string" || !backup.versao.trim()) {
            return false;
        }

        const dados = backup.dados;

        if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
            return false;
        }

        const listasObrigatorias = [
            "produtos",
            "lojas",
            "estoques",
            "consignados",
            "conferencias"
        ];

        if (!listasObrigatorias.every(campo => Array.isArray(dados[campo]))) {
            return false;
        }

        const empresasValidas = dados.empresas === undefined
            || Array.isArray(dados.empresas);

        const novosDadosValidos = ["colecoesProdutos", "clientes", "pedidos", "orcamentos", "pagamentos", "financeiro", "notificacoes", "filamentos", "impressoras", "ordensProducao", "operacoesProducao", "historicoProducao", "manutencoes", "reservasFilamento", "lotesExecucao", "historicoFilamentos"]
            .every(campo => dados[campo] === undefined || Array.isArray(dados[campo]));
        const custosValidos = dados.configuracoesCustos === undefined
            || (dados.configuracoesCustos && typeof dados.configuracoesCustos === "object" && !Array.isArray(dados.configuracoesCustos));
        const gerador3dValido = dados.gerador3d === undefined
            || (dados.gerador3d && typeof dados.gerador3d === "object" && !Array.isArray(dados.gerador3d));

        return empresasValidas && novosDadosValidos && custosValidos && gerador3dValido && Boolean(
            dados.configuracoes
            && typeof dados.configuracoes === "object"
            && !Array.isArray(dados.configuracoes)
        );

    },



    limparTudo() {

        Object.values(this.KEYS).forEach(chave => {
            localStorage.removeItem(chave);
        });

    },



    restaurarDados(dados) {

        const dadosNormalizados = {
            ...dados,
            empresas: Array.isArray(dados?.empresas) ? dados.empresas : [],
            colecoesProdutos: Array.isArray(dados?.colecoesProdutos) ? dados.colecoesProdutos : [],
            clientes: Array.isArray(dados?.clientes) ? dados.clientes : [],
            pedidos: Array.isArray(dados?.pedidos) ? dados.pedidos : [],
            orcamentos: Array.isArray(dados?.orcamentos) ? dados.orcamentos : [],
            pagamentos: Array.isArray(dados?.pagamentos) ? dados.pagamentos : [],
            financeiro: Array.isArray(dados?.financeiro) ? dados.financeiro : [],
            notificacoes: Array.isArray(dados?.notificacoes) ? dados.notificacoes : [],
            filamentos: Array.isArray(dados?.filamentos) ? dados.filamentos : [],
            impressoras: Array.isArray(dados?.impressoras) ? dados.impressoras : [],
            ordensProducao: Array.isArray(dados?.ordensProducao) ? dados.ordensProducao : [],
            operacoesProducao: Array.isArray(dados?.operacoesProducao) ? dados.operacoesProducao : [],
            historicoProducao: Array.isArray(dados?.historicoProducao) ? dados.historicoProducao : [],
            manutencoes: Array.isArray(dados?.manutencoes) ? dados.manutencoes : [],
            reservasFilamento: Array.isArray(dados?.reservasFilamento) ? dados.reservasFilamento : [],
            lotesExecucao: Array.isArray(dados?.lotesExecucao) ? dados.lotesExecucao : [],
            historicoFilamentos: Array.isArray(dados?.historicoFilamentos) ? dados.historicoFilamentos : [],
            configuracoesCustos: dados?.configuracoesCustos || this.carregarConfigCustos(),
            gerador3d: dados?.gerador3d || this.carregarConfigGerador3D()
        };

        const backupTemporario = {
            empresa: "PrimeDocs",
            versao: "1.0.0",
            dados: dadosNormalizados
        };

        if (!this.validarBackup(backupTemporario)) {
            throw new Error("Dados de backup inválidos.");
        }

        this.salvarProdutos(dadosNormalizados.produtos);
        this.salvarColecoesProdutos(dadosNormalizados.colecoesProdutos);
        this.salvarLojas(dadosNormalizados.lojas);
        this.salvarEstoquesLojas(dadosNormalizados.estoques);
        this.salvarEmpresas(dadosNormalizados.empresas);
        this.salvarClientes(dadosNormalizados.clientes);
        this.salvarPedidos(dadosNormalizados.pedidos);
        this.salvarOrcamentos(dadosNormalizados.orcamentos);
        this.salvarPagamentos(dadosNormalizados.pagamentos);
        this.salvarLancamentosFinanceiros(dadosNormalizados.financeiro);
        this.salvarNotificacoes(dadosNormalizados.notificacoes);
        this.salvarFilamentos(dadosNormalizados.filamentos);
        this.salvarImpressoras(dadosNormalizados.impressoras);
        this.salvarOrdensProducao(dadosNormalizados.ordensProducao);
        this.salvarOperacoesProducao(dadosNormalizados.operacoesProducao);
        this.salvarHistoricoProducao(dadosNormalizados.historicoProducao);
        this.salvarManutencoes(dadosNormalizados.manutencoes);
        this.salvarReservasFilamento(dadosNormalizados.reservasFilamento);
        this.salvarLotesExecucao(dadosNormalizados.lotesExecucao);
        this.salvarHistoricoFilamentos(dadosNormalizados.historicoFilamentos);
        this.salvarConfigCustos(dadosNormalizados.configuracoesCustos);
        this.salvarConfigGerador3D(dadosNormalizados.gerador3d);
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(dadosNormalizados.consignados)
        );
        localStorage.setItem(
            this.KEYS.conferencias,
            JSON.stringify(dadosNormalizados.conferencias)
        );
        this.salvarConfiguracoes(dadosNormalizados.configuracoes);
        this.migrarColecoesProdutos();

        const tema = dadosNormalizados.configuracoes.tema === "dark" ? "dark" : "light";
        localStorage.setItem(this.KEYS.tema, tema);

        return true;

    },



    importarBackup(json) {

        let backup;

        try {
            backup = typeof json === "string" ? JSON.parse(json) : json;
        } catch (erro) {
            return false;
        }

        if (!this.validarBackup(backup)) {
            return false;
        }

        const dadosAnteriores = this.obterTodosDados();

        try {
            this.limparTudo();
            this.restaurarDados(backup.dados);
            return true;
        } catch (erro) {
            try {
                this.limparTudo();
                this.restaurarDados(dadosAnteriores);
            } catch (erroRestauracao) {
                console.error("Não foi possível restaurar os dados anteriores.", erroRestauracao);
            }

            throw erro;
        }

    },





buscarProdutoPorId(id){

    return this
        .listarProdutos()
        .find(prod=>prod.id==id);

},

salvarProduto(produto){

    const produtos=this.listarProdutos();

    const index=produtos.findIndex(p=>p.id==produto.id);

    if(index==-1){

        produtos.push(produto);

    }else{

        produtos[index]=produto;

    }

    this.salvarProdutos(produtos);

}

};

