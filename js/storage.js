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
        lojas: "primedocs_lojas",
        consignados: "primedocs_consignados",
        estoquesLojas: "primedocs_estoques_lojas",
        conferencias: "primedocs_conferencias",
        configuracoes: "primedocs_config",
        tema: "primedocs_tema",
        empresas: "primedocs_empresas",
        clientes: "primedocs_clientes",
        pedidos: "primedocs_pedidos",
        filamentos: "primedocs_filamentos",
        configCustos: "primedocs_config_custos",

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
        consignados.push(consignado);
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(consignados)
        );

    },



    buscarUltimoConsignadoPorLoja(referenciaLoja) {

        const referencia = String(referenciaLoja || "").toLocaleLowerCase("pt-BR");

        return [...this.listarConsignados()]
            .reverse()
            .find(consignado =>
                String(consignado.lojaId) === String(referenciaLoja)
                || String(consignado.lojaNome || "").toLocaleLowerCase("pt-BR") === referencia
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
        filamento.pesoAtualKg = Math.max(0, Number(filamento.pesoAtualKg || 0) - consumo);
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



    obterTodosDados() {

        const configuracoes = this.carregarConfiguracoes();

        return {
            produtos: this.listarProdutos(),
            lojas: this.listarLojas(),
            estoques: this.listarEstoquesLojas(),
            consignados: this.listarConsignados(),
            conferencias: this.listarConferencias(),
            empresas: this.listarEmpresas(),
            clientes: this.listarClientes(),
            pedidos: this.listarPedidos(),
            filamentos: this.listarFilamentos(),
            configuracoesCustos: this.carregarConfigCustos(),
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

        const novosDadosValidos = ["clientes", "pedidos", "filamentos"]
            .every(campo => dados[campo] === undefined || Array.isArray(dados[campo]));
        const custosValidos = dados.configuracoesCustos === undefined
            || (dados.configuracoesCustos && typeof dados.configuracoesCustos === "object" && !Array.isArray(dados.configuracoesCustos));

        return empresasValidas && novosDadosValidos && custosValidos && Boolean(
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
            clientes: Array.isArray(dados?.clientes) ? dados.clientes : [],
            pedidos: Array.isArray(dados?.pedidos) ? dados.pedidos : [],
            filamentos: Array.isArray(dados?.filamentos) ? dados.filamentos : [],
            configuracoesCustos: dados?.configuracoesCustos || this.carregarConfigCustos()
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
        this.salvarLojas(dadosNormalizados.lojas);
        this.salvarEstoquesLojas(dadosNormalizados.estoques);
        this.salvarEmpresas(dadosNormalizados.empresas);
        this.salvarClientes(dadosNormalizados.clientes);
        this.salvarPedidos(dadosNormalizados.pedidos);
        this.salvarFilamentos(dadosNormalizados.filamentos);
        this.salvarConfigCustos(dadosNormalizados.configuracoesCustos);
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(dadosNormalizados.consignados)
        );
        localStorage.setItem(
            this.KEYS.conferencias,
            JSON.stringify(dadosNormalizados.conferencias)
        );
        this.salvarConfiguracoes(dadosNormalizados.configuracoes);

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

