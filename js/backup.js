const Backup = (() => {
    const LISTAS = [
        "produtos",
        "clientes",
        "lojas",
        "pedidos",
        "financeiro",
        "consignados",
        "conferencias",
        "filamentos",
        "empresas",
        "estoques",
        "orcamentos",
        "pagamentos",
        "notificacoes",
        "impressoras",
        "ordensProducao",
        "operacoesProducao",
        "historicoProducao",
        "manutencoes",
        "reservasFilamento"
    ];

    function normalizarBackup(json) {
        const bruto = typeof json === "string" ? JSON.parse(json) : json;
        if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
            throw new Error("Arquivo de backup inválido.");
        }

        const origem = bruto.data || bruto.dados || bruto;
        const dados = criarBaseNormalizada();

        LISTAS.forEach(campo => {
            dados[campo] = normalizarLista(origem[campo]);
        });

        dados.pedidos = normalizarLista(origem.pedidos || origem.vendas || dados.pedidos);
        dados.financeiro = normalizarLista(origem.financeiro || origem.movimentacoes || origem.cobrancas || dados.financeiro);
        dados.pagamentos = normalizarLista(origem.pagamentos || dados.pagamentos);
        dados.produtos = normalizarLista(origem.produtos || dados.produtos);
        dados.clientes = normalizarLista(origem.clientes || dados.clientes);

        dados.configuracoes = normalizarObjeto(
            origem.configuracoes || origem.config || bruto.configuracoes || bruto.config || {}
        );
        dados.configuracoesCustos = normalizarObjeto(
            origem.configuracoesCustos || origem.custos || origem.configCustos || {}
        );
        dados.gerador3d = normalizarObjeto(origem.gerador3d || {});

        if (dados.configuracoes?.nome && !dados.empresas.length) {
            dados.empresas = [{
                id: "empresa-importada",
                nome: dados.configuracoes.nome,
                tipo: "geral",
                corPrincipal: "#6D5DFD",
                ativa: true,
                padrao: true,
                criadoEm: new Date().toISOString()
            }];
        }

        return dados;
    }

    function criarBaseNormalizada() {
        return {
            produtos: [],
            clientes: [],
            lojas: [],
            pedidos: [],
            financeiro: [],
            consignados: [],
            conferencias: [],
            filamentos: [],
            empresas: [],
            estoques: [],
            orcamentos: [],
            pagamentos: [],
            notificacoes: [],
            impressoras: [],
            ordensProducao: [],
            operacoesProducao: [],
            historicoProducao: [],
            manutencoes: [],
            reservasFilamento: [],
            configuracoes: {},
            configuracoesCustos: {},
            gerador3d: {}
        };
    }

    function normalizarLista(valor) {
        return Array.isArray(valor)
            ? valor.filter(item => item && typeof item === "object").map((item, index) => garantirId(item, index))
            : [];
    }

    function normalizarObjeto(valor) {
        return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
    }

    function garantirId(item, index) {
        return {
            id: item.id || item.codigo || item.nome || `item-${Date.now()}-${index}`,
            ...item
        };
    }

    function contarDados(dados) {
        const normalizado = dados?.produtos !== undefined ? dados : normalizarBackup(dados);
        return LISTAS.reduce((resumo, campo) => {
            resumo[campo] = Array.isArray(normalizado[campo]) ? normalizado[campo].length : 0;
            return resumo;
        }, {});
    }

    return {
        normalizarBackup,
        contarDados
    };
})();

window.Backup = Backup;
