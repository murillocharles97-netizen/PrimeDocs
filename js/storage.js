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



    obterTodosDados() {

        const configuracoes = this.carregarConfiguracoes();

        return {
            produtos: this.listarProdutos(),
            lojas: this.listarLojas(),
            estoques: this.listarEstoquesLojas(),
            consignados: this.listarConsignados(),
            conferencias: this.listarConferencias(),
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

        return Boolean(
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

        const backupTemporario = {
            empresa: "PrimeDocs",
            versao: "1.0.0",
            dados
        };

        if (!this.validarBackup(backupTemporario)) {
            throw new Error("Dados de backup inválidos.");
        }

        this.salvarProdutos(dados.produtos);
        this.salvarLojas(dados.lojas);
        this.salvarEstoquesLojas(dados.estoques);
        localStorage.setItem(
            this.KEYS.consignados,
            JSON.stringify(dados.consignados)
        );
        localStorage.setItem(
            this.KEYS.conferencias,
            JSON.stringify(dados.conferencias)
        );
        this.salvarConfiguracoes(dados.configuracoes);

        const tema = dados.configuracoes.tema === "dark" ? "dark" : "light";
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

