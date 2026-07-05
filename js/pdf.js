function formatarDataBR(data) {
    if (!data) return "-";

    const partes = String(data).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    const dataConvertida = new Date(data);
    return Number.isNaN(dataConvertida.getTime())
        ? String(data)
        : dataConvertida.toLocaleDateString("pt-BR");
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function nomeSeguroPDF(valor) {
    return String(valor || "loja")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "loja";
}

function obterEmpresaPDF(empresa) {
    const padrao = typeof Storage !== "undefined" && Storage.buscarEmpresaPadrao
        ? Storage.buscarEmpresaPadrao()
        : null;

    return empresa || padrao || {
        nome: "PrimeLine 3D",
        tipo: "impressao3d",
        logo: "",
        corPrincipal: "#6D5DFD",
        whatsapp: "",
        rodapePDF: "Documento gerado pelo PrimeDocs"
    };
}

function corHexParaRGB(hexadecimal) {
    const valor = String(hexadecimal || "#6D5DFD").replace("#", "");
    const valido = /^[0-9a-f]{6}$/i.test(valor) ? valor : "6D5DFD";
    return [
        parseInt(valido.slice(0, 2), 16),
        parseInt(valido.slice(2, 4), 16),
        parseInt(valido.slice(4, 6), 16)
    ];
}

function adicionarLogoEmpresaPDF(doc, empresa, x, y, largura, altura) {
    if (!empresa.logo || !String(empresa.logo).startsWith("data:image/")) return false;

    try {
        const formato = String(empresa.logo).startsWith("data:image/png")
            ? "PNG"
            : String(empresa.logo).startsWith("data:image/webp")
                ? "WEBP"
                : "JPEG";
        doc.addImage(empresa.logo, formato, x, y, largura, altura, undefined, "FAST");
        return true;
    } catch (erro) {
        console.warn("Logo ignorado no PDF por formato incompatível.", erro);
        return false;
    }
}

function criarPDFTabela(config, empresaInformada) {
    if (!window.jspdf?.jsPDF) {
        Toast.show("Não foi possível carregar o gerador de PDF.");
        return false;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const empresa = obterEmpresaPDF(empresaInformada);
    const azul = corHexParaRGB(empresa.corPrincipal);
    const texto = [51, 65, 85];
    const textoSuave = [100, 116, 139];
    const linha = [226, 232, 240];
    const fundo = [248, 250, 252];
    const margem = 16;
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const larguraUtil = larguraPagina - (margem * 2);
    const limiteInferior = alturaPagina - 25;

    let posicaoX = margem;
    const colunas = config.colunas.map(coluna => {
        const colunaCompleta = { ...coluna, x: posicaoX };
        posicaoX += coluna.largura;
        return colunaCompleta;
    });

    function desenharCabecalho() {
        const temLogo = adicionarLogoEmpresaPDF(doc, empresa, margem, 10, 16, 16);
        const inicioTexto = temLogo ? margem + 20 : margem;
        doc.setTextColor(...azul);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(String(empresa.nome || "PrimeDocs"), inicioTexto, 18);

        doc.setTextColor(...texto);
        doc.setFontSize(12);
        doc.text(config.titulo, inicioTexto, 27);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
            `Emissão: ${new Date().toLocaleDateString("pt-BR")}`,
            larguraPagina - margem,
            18,
            { align: "right" }
        );

        doc.setDrawColor(...azul);
        doc.setLineWidth(0.8);
        doc.line(margem, 32, larguraPagina - margem, 32);
        return 39;
    }

    function desenharInformacoes(y) {
        const quantidade = config.informacoes.length;
        const larguraInfo = larguraUtil / quantidade;
        const valoresQuebrados = config.informacoes.map(info =>
            doc.splitTextToSize(String(info.valor || "-"), larguraInfo - 8)
        );
        const maiorNumeroLinhas = Math.max(...valoresQuebrados.map(valor => valor.length));
        const altura = Math.max(27, 17 + (maiorNumeroLinhas * 4));

        doc.setFillColor(...fundo);
        doc.setDrawColor(...linha);
        doc.roundedRect(margem, y, larguraUtil, altura, 2, 2, "FD");

        config.informacoes.forEach((info, indice) => {
            const x = margem + (indice * larguraInfo) + 4;
            doc.setTextColor(...textoSuave);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.3);
            doc.text(info.rotulo.toUpperCase(), x, y + 8);
            doc.setTextColor(...texto);
            doc.setFontSize(9.2);
            doc.text(valoresQuebrados[indice], x, y + 15);
        });

        return y + altura;
    }

    function desenharCabecalhoTabela(y) {
        doc.setFillColor(...azul);
        doc.roundedRect(margem, y, larguraUtil, 9, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);

        colunas.forEach(coluna => {
            const x = coluna.alinhar === "right"
                ? coluna.x + coluna.largura - 2
                : coluna.alinhar === "center"
                    ? coluna.x + (coluna.largura / 2)
                    : coluna.x + 2;
            doc.text(coluna.titulo, x, y + 5.8, { align: coluna.alinhar || "left" });
        });

        return y + 9;
    }

    function novaPaginaComTabela() {
        doc.addPage();
        let y = desenharCabecalho();
        doc.setTextColor(...texto);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(`${config.tituloSecao} - CONTINUAÇÃO`, margem, y);
        return desenharCabecalhoTabela(y + 5);
    }

    function garantirEspaco(y, altura) {
        if (y + altura <= limiteInferior) return y;
        doc.addPage();
        return desenharCabecalho();
    }

    let y = desenharCabecalho();
    y = desenharInformacoes(y);
    y += 8;
    doc.setTextColor(...texto);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(config.tituloSecao, margem, y);
    y = desenharCabecalhoTabela(y + 5);

    config.linhas.forEach((linhaTabela, indice) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);

        const celulas = linhaTabela.map((valor, colunaIndice) =>
            doc.splitTextToSize(
                String(valor ?? "-"),
                colunas[colunaIndice].largura - 4
            )
        );
        const maiorNumeroLinhas = Math.max(...celulas.map(valor => valor.length));
        const alturaLinha = Math.max(9, (maiorNumeroLinhas * 3.8) + 4);

        if (y + alturaLinha > limiteInferior) {
            y = novaPaginaComTabela();
        }

        if (indice % 2 === 0) {
            doc.setFillColor(...fundo);
            doc.rect(margem, y, larguraUtil, alturaLinha, "F");
        }

        doc.setDrawColor(...linha);
        doc.line(margem, y + alturaLinha, larguraPagina - margem, y + alturaLinha);
        doc.setTextColor(...texto);

        celulas.forEach((celula, colunaIndice) => {
            const coluna = colunas[colunaIndice];
            const x = coluna.alinhar === "right"
                ? coluna.x + coluna.largura - 2
                : coluna.alinhar === "center"
                    ? coluna.x + (coluna.largura / 2)
                    : coluna.x + 2;

            doc.setFont("helvetica", coluna.destaque ? "bold" : "normal");
            doc.text(celula, x, y + 5.5, { align: coluna.alinhar || "left" });
        });

        y += alturaLinha;
    });

    y = garantirEspaco(y + 7, 24);
    const larguraResumo = larguraUtil / config.resumo.length;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margem, y, larguraUtil, 22, 2, 2, "FD");

    config.resumo.forEach((item, indice) => {
        const x = margem + (indice * larguraResumo) + 4;
        doc.setTextColor(...azul);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(item.rotulo.toUpperCase(), x, y + 7);
        doc.setTextColor(...texto);
        doc.setFontSize(10);
        doc.text(String(item.valor), x, y + 15);
    });
    y += 29;

    if (String(config.observacoes || "").trim()) {
        const linhasObservacoes = doc.splitTextToSize(
            String(config.observacoes).trim(),
            larguraUtil - 8
        );
        const alturaObservacoes = Math.min(55, (linhasObservacoes.length * 4.2) + 15);
        y = garantirEspaco(y, alturaObservacoes);

        doc.setTextColor(...texto);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("OBSERVAÇÕES", margem, y);
        doc.setFillColor(...fundo);
        doc.setDrawColor(...linha);
        doc.roundedRect(margem, y + 4, larguraUtil, alturaObservacoes - 6, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(linhasObservacoes.slice(0, 10), margem + 4, y + 11);
    }

    const totalPaginas = doc.internal.getNumberOfPages();

    for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
        doc.setPage(pagina);
        doc.setDrawColor(...linha);
        doc.setLineWidth(0.3);
        doc.line(margem, alturaPagina - 16, larguraPagina - margem, alturaPagina - 16);
        doc.setTextColor(...textoSuave);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(String(empresa.rodapePDF || "Documento gerado pelo PrimeDocs"), margem, alturaPagina - 10);
        const contatoRodape = empresa.whatsapp
            ? `${empresa.nome || "PrimeDocs"} - ${empresa.whatsapp}`
            : String(empresa.nome || "PrimeDocs");
        doc.text(contatoRodape, larguraPagina / 2, alturaPagina - 10, { align: "center" });
        doc.text(`Página ${pagina} de ${totalPaginas}`, larguraPagina - margem, alturaPagina - 10, {
            align: "right"
        });
    }

    doc.save(config.nomeArquivo);
    return true;
}

const PDF = {
    gerarConsignado(dados, empresa) {
        const totalPecas = dados.itens.reduce(
            (total, item) => total + Number(item.quantidade || 0),
            0
        );
        const totalRepasse = dados.itens.reduce(
            (total, item) => total + (Number(item.quantidade || 0) * Number(item.preco || 0)),
            0
        );

        return criarPDFTabela({
            titulo: "RELATÓRIO DE CONSIGNAÇÃO",
            tituloSecao: "PRODUTOS CONSIGNADOS",
            informacoes: [
                { rotulo: "Loja", valor: dados.loja },
                { rotulo: "Responsável", valor: dados.responsavel },
                { rotulo: "Data da entrega", valor: formatarDataBR(dados.data) }
            ],
            colunas: [
                { titulo: "CÓDIGO", largura: 28 },
                { titulo: "PRODUTO", largura: 68 },
                { titulo: "CATEGORIA", largura: 50 },
                { titulo: "QTD.", largura: 32, alinhar: "center", destaque: true }
            ],
            linhas: dados.itens.map(item => [
                item.codigo || "-",
                item.nome || "-",
                item.categoria || "-",
                Number(item.quantidade || 0)
            ]),
            resumo: [
                { rotulo: "Itens diferentes", valor: dados.itens.length },
                { rotulo: "Total de peças", valor: totalPecas },
                { rotulo: "Valor de repasse", valor: formatarMoeda(totalRepasse) }
            ],
            observacoes: dados.observacoes,
            nomeArquivo: `consignado_${nomeSeguroPDF(dados.loja)}_${dados.data || Utils.hoje()}.pdf`
        }, empresa);
    },

    gerarVendasConferencia(dados, empresa) {
        return criarPDFTabela({
            titulo: "RELATÓRIO DE VENDAS",
            tituloSecao: "PRODUTOS VENDIDOS",
            informacoes: [
                { rotulo: "Loja", valor: dados.loja },
                { rotulo: "Responsável", valor: dados.responsavel },
                { rotulo: "Data da conferência", valor: formatarDataBR(dados.dataConferencia) },
                { rotulo: "Consignado anterior", valor: formatarDataBR(dados.dataConsignadoAnterior) }
            ],
            colunas: [
                { titulo: "CÓD.", largura: 22 },
                { titulo: "PRODUTO", largura: 50 },
                { titulo: "CATEGORIA", largura: 36 },
                { titulo: "QTD.", largura: 18, alinhar: "center" },
                { titulo: "UNIT.", largura: 25, alinhar: "right" },
                { titulo: "TOTAL", largura: 27, alinhar: "right", destaque: true }
            ],
            linhas: dados.itensVendidos.map(item => [
                item.codigo || "-",
                item.nome || "-",
                item.categoria || "-",
                Number(item.quantidadeVendida || 0),
                formatarMoeda(item.preco),
                formatarMoeda(item.total)
            ]),
            resumo: [
                { rotulo: "Peças vendidas", valor: dados.totalPecasVendidas },
                { rotulo: "Valor total de repasse", valor: formatarMoeda(dados.valorTotalVendido) }
            ],
            nomeArquivo: `vendas_${nomeSeguroPDF(dados.loja)}_${dados.dataConferencia || Utils.hoje()}.pdf`
        }, empresa);
    },

    gerarEstoqueAtualizado(dados, empresa) {
        return criarPDFTabela({
            titulo: "ESTOQUE ATUALIZADO",
            tituloSecao: "PRODUTOS EM ESTOQUE",
            informacoes: [
                { rotulo: "Loja", valor: dados.loja },
                { rotulo: "Responsável", valor: dados.responsavel },
                { rotulo: "Data", valor: formatarDataBR(dados.dataConferencia) }
            ],
            colunas: [
                { titulo: "CÓDIGO", largura: 28 },
                { titulo: "PRODUTO", largura: 68 },
                { titulo: "CATEGORIA", largura: 50 },
                { titulo: "QTD.", largura: 32, alinhar: "center", destaque: true }
            ],
            linhas: dados.itensEstoque.map(item => [
                item.codigo || "-",
                item.nome || "-",
                item.categoria || "-",
                Number(item.quantidade || 0)
            ]),
            resumo: [
                { rotulo: "Itens diferentes", valor: dados.totalItensDiferentes },
                { rotulo: "Total de peças", valor: dados.totalPecas },
                { rotulo: "Valor de repasse", valor: formatarMoeda(dados.valorRepasse) }
            ],
            nomeArquivo: `estoque_atualizado_${nomeSeguroPDF(dados.loja)}_${dados.dataConferencia || Utils.hoje()}.pdf`
        }, empresa);
    },

    gerarOrcamento(dados, empresaInformada) {
        const empresa = obterEmpresaPDF(empresaInformada);
        const tipo = dados.tipo || empresa.tipo || "geral";
        let colunas;
        let linhas;
        let informacoes = [
            { rotulo: "Cliente", valor: dados.cliente },
            { rotulo: "Data", valor: formatarDataBR(dados.data) },
            { rotulo: "Empresa", valor: empresa.nome }
        ];

        if (tipo === "transporte") {
            colunas = [
                { titulo: "ORIGEM", largura: 60 },
                { titulo: "DESTINO", largura: 60 },
                { titulo: "VIAGEM", largura: 30 },
                { titulo: "VALOR", largura: 28, alinhar: "right", destaque: true }
            ];
            linhas = [[
                dados.origem || "-",
                dados.destino || "-",
                dados.tipoViagem === "ida-e-volta" ? "Ida e volta" : "Ida",
                formatarMoeda(dados.valorFinal)
            ]];
        } else if (tipo === "impressao3d") {
            colunas = [
                { titulo: "PRODUTO / SERVIÇO", largura: 110 },
                { titulo: "QTD.", largura: 25, alinhar: "center" },
                { titulo: "VALOR FINAL", largura: 43, alinhar: "right", destaque: true }
            ];
            linhas = [[
                dados.produto || "-",
                Number(dados.quantidade || 1),
                formatarMoeda(dados.valorFinal)
            ]];
        } else {
            colunas = [
                { titulo: "DESCRIÇÃO", largura: 135 },
                { titulo: "VALOR FINAL", largura: 43, alinhar: "right", destaque: true }
            ];
            linhas = [[dados.descricao || "-", formatarMoeda(dados.valorFinal)]];
        }

        return criarPDFTabela({
            titulo: "ORÇAMENTO",
            tituloSecao: "DETALHES DO ORÇAMENTO",
            informacoes,
            colunas,
            linhas,
            resumo: [{ rotulo: "Valor final", valor: formatarMoeda(dados.valorFinal) }],
            observacoes: dados.observacoes,
            nomeArquivo: `orcamento_${nomeSeguroPDF(empresa.nome)}_${nomeSeguroPDF(dados.cliente)}_${dados.data || Utils.hoje()}.pdf`
        }, empresa);
    }
};
