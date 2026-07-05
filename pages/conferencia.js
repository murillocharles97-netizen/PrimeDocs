let conferenciaAtual = null;
let itensConferencia = [];
let conferenciaPersistida = false;

function renderConferencia() {
    conferenciaAtual = null;
    itensConferencia = [];
    conferenciaPersistida = false;

    const lojas = Storage.listarLojas()
        .filter(loja => loja.ativo !== false)
        .sort((a, b) => String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "pt-BR",
            { sensitivity: "base" }
        ));

    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>

        ${Page.titulo(
            "📈 Conferência",
            "Confira as vendas e atualize o estoque da loja parceira."
        )}

        <div class="cardForm">
            <label class="inputGroup">
                <span>Loja</span>
                <select id="lojaConferencia">
                    <option value="">Selecione uma loja</option>
                    ${lojas.map(loja => `
                        <option value="${escaparHtmlConferencia(loja.id)}">
                            ${escaparHtmlConferencia(loja.nome)}
                        </option>
                    `).join("")}
                </select>
            </label>

            ${Button.primary("Carregar estoque atual", "carregarUltimoConsignado()")}
        </div>

        <div id="conteudoConferencia"></div>
    `;

    lucide.createIcons();
}

function carregarUltimoConsignado() {
    const lojaId = document.getElementById("lojaConferencia").value;
    const loja = Storage.buscarLojaPorId(lojaId);

    if (!loja) {
        Toast.show("Selecione uma loja.");
        return;
    }

    let fonte = Storage.buscarEstoqueLoja(loja.id);

    if (!fonte) {
        const consignado = Storage.buscarUltimoConsignadoPorLoja(loja.id)
            || Storage.buscarUltimoConsignadoPorLoja(loja.nome);

        if (!consignado) {
            limparConferencia();
            Toast.show("Nenhum estoque ou consignado encontrado para esta loja.");
            return;
        }

        fonte = criarEstoqueInicialDoConsignado(loja, consignado);
        Storage.salvarEstoqueLoja(fonte);
    }

    if (!fonte.itens?.length) {
        limparConferencia();
        Toast.show("O estoque atual desta loja está vazio.");
        return;
    }

    conferenciaAtual = {
        lojaId: loja.id,
        lojaNome: fonte.lojaNome || loja.nome,
        responsavel: fonte.responsavel || loja.responsavel || "",
        data: normalizarDataConferencia(fonte.atualizadoEm || fonte.data || Utils.hoje())
    };

    itensConferencia = fonte.itens.map(item => {
        const produtoAtual = Storage.buscarProdutoPorId(item.produtoId);
        const quantidade = Math.max(0, Number(item.quantidade) || 0);

        return {
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            preco: Number(item.preco ?? produtoAtual?.preco) || 0,
            quantidade,
            quantidadeSobra: quantidade
        };
    });

    conferenciaPersistida = false;

    renderConteudoConferencia();
}

function criarEstoqueInicialDoConsignado(loja, consignado) {
    return {
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel: consignado.responsavel || loja.responsavel || "",
        atualizadoEm: consignado.criadoEm || consignado.data || new Date().toISOString(),
        itens: consignado.itens.map(item => ({
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            preco: Number(item.preco) || 0,
            quantidade: Math.max(0, Number(item.quantidade) || 0)
        }))
    };
}

function limparConferencia() {
    conferenciaAtual = null;
    itensConferencia = [];
    conferenciaPersistida = false;

    const conteudo = document.getElementById("conteudoConferencia");
    if (conteudo) conteudo.innerHTML = "";
}

function renderConteudoConferencia() {
    const conteudo = document.getElementById("conteudoConferencia");

    if (!conteudo || !conferenciaAtual) return;

    conteudo.innerHTML = `
        <div class="cardForm">
            <div class="produtoHeader">
                <div>
                    <h3>${escaparHtmlConferencia(conferenciaAtual.lojaNome)}</h3>
                    <span>Estoque atualizado em ${formatarDataBR(conferenciaAtual.data)}</span>
                </div>
                <span class="badge primary">Estoque atual</span>
            </div>

            <p><strong>Responsável:</strong> ${escaparHtmlConferencia(
                conferenciaAtual.responsavel || "Não informado"
            )}</p>
        </div>

        <h3 class="sectionTitle">Produtos em estoque</h3>

        <div id="listaItensConferencia">
            ${itensConferencia.map(item => criarCardItemConferencia(item)).join("")}
        </div>

        <div class="actionsGrid">
            <button class="btn" type="button" onclick="gerarPDFVendasConferencia()">
                Gerar PDF de Vendas
            </button>
            <button class="btn" type="button" onclick="gerarPDFEstoqueConferencia()">
                Gerar PDF de Estoque Atualizado
            </button>
            <button class="btn" type="button" onclick="gerarDoisPDFsConferencia()">
                Gerar os dois PDFs
            </button>
        </div>
    `;

    conteudo.querySelectorAll("[data-sobra-produto-id]").forEach(input => {
        input.addEventListener("input", () => atualizarSobraConferencia(input, false));
        input.addEventListener("change", () => atualizarSobraConferencia(input, true));
    });

    lucide.createIcons();
}

function criarCardItemConferencia(item) {
    return `
        <div class="produtoCard">
            <div class="produtoHeader">
                <div>
                    <h3>${escaparHtmlConferencia(item.nome)}</h3>
                    <span>${escaparHtmlConferencia(item.codigo || "Sem código")}</span>
                </div>
                <span class="badge primary">
                    ${escaparHtmlConferencia(item.categoria || "Sem categoria")}
                </span>
            </div>

            <div class="row">
                <div class="col">
                    <strong>Quantidade atual</strong>
                    <p>${item.quantidade}</p>
                </div>

                <div class="col">
                    <label class="inputGroup">
                        <span>Quantidade que sobrou</span>
                        <input
                            type="number"
                            min="0"
                            max="${item.quantidade}"
                            value="${item.quantidadeSobra}"
                            data-sobra-produto-id="${escaparHtmlConferencia(item.produtoId)}">
                    </label>
                </div>

                <div class="col">
                    <strong>Quantidade vendida</strong>
                    <p data-vendido-produto-id="${escaparHtmlConferencia(item.produtoId)}">
                        ${item.quantidade - item.quantidadeSobra}
                    </p>
                </div>
            </div>
        </div>
    `;
}

function atualizarSobraConferencia(input, mostrarAviso) {
    const item = itensConferencia.find(
        produto => String(produto.produtoId) === String(input.dataset.sobraProdutoId)
    );

    if (!item) return;

    let quantidadeSobra = input.value === "" ? 0 : Number(input.value);

    if (!Number.isFinite(quantidadeSobra)) quantidadeSobra = 0;
    quantidadeSobra = Math.trunc(quantidadeSobra);

    if (quantidadeSobra < 0) {
        quantidadeSobra = 0;
        if (mostrarAviso) Toast.show("A quantidade restante não pode ser negativa.");
    }

    if (quantidadeSobra > item.quantidade) {
        quantidadeSobra = item.quantidade;
        Toast.show("A quantidade restante foi ajustada ao estoque atual.");
    }

    item.quantidadeSobra = quantidadeSobra;
    conferenciaPersistida = false;
    input.value = quantidadeSobra;

    const campoVendido = [...document.querySelectorAll("[data-vendido-produto-id]")]
        .find(elemento => String(elemento.dataset.vendidoProdutoId) === String(item.produtoId));

    if (campoVendido) {
        campoVendido.textContent = item.quantidade - item.quantidadeSobra;
    }
}

function montarDadosVendasConferencia() {
    const itensVendidos = itensConferencia
        .map(item => {
            const quantidadeVendida = item.quantidade - item.quantidadeSobra;

            return {
                codigo: item.codigo,
                nome: item.nome,
                categoria: item.categoria,
                preco: item.preco,
                quantidadeVendida,
                total: quantidadeVendida * item.preco
            };
        })
        .filter(item => item.quantidadeVendida > 0);

    return {
        loja: conferenciaAtual.lojaNome,
        responsavel: conferenciaAtual.responsavel,
        dataConferencia: Utils.hoje(),
        dataConsignadoAnterior: conferenciaAtual.data,
        itensVendidos,
        totalPecasVendidas: itensVendidos.reduce(
            (total, item) => total + item.quantidadeVendida,
            0
        ),
        valorTotalVendido: itensVendidos.reduce(
            (total, item) => total + item.total,
            0
        )
    };
}

function montarDadosEstoqueConferencia() {
    const itensEstoque = itensConferencia
        .filter(item => item.quantidadeSobra > 0)
        .map(item => ({
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            preco: item.preco,
            quantidade: item.quantidadeSobra
        }));

    return {
        loja: conferenciaAtual.lojaNome,
        responsavel: conferenciaAtual.responsavel,
        dataConferencia: Utils.hoje(),
        itensEstoque,
        totalItensDiferentes: itensEstoque.length,
        totalPecas: itensEstoque.reduce((total, item) => total + item.quantidade, 0),
        valorRepasse: itensEstoque.reduce(
            (total, item) => total + (item.quantidade * item.preco),
            0
        )
    };
}

function validarConferenciaCarregada() {
    if (conferenciaAtual && itensConferencia.length > 0) return true;
    Toast.show("Carregue o estoque antes de gerar o PDF.");
    return false;
}

function salvarResultadoConferencia() {
    if (conferenciaPersistida) {
        Toast.show("O estoque atual já está salvo.");
        return;
    }

    const agora = new Date().toISOString();
    const data = Utils.hoje();
    const itensHistorico = itensConferencia.map(item => {
        const quantidadeVendida = item.quantidade - item.quantidadeSobra;

        return {
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            preco: item.preco,
            quantidadeAnterior: item.quantidade,
            quantidadeSobrou: item.quantidadeSobra,
            quantidadeVendida,
            valorVendido: quantidadeVendida * item.preco
        };
    });

    const totalPecasVendidas = itensHistorico.reduce(
        (total, item) => total + item.quantidadeVendida,
        0
    );
    const valorTotalVendido = itensHistorico.reduce(
        (total, item) => total + item.valorVendido,
        0
    );
    const itensEstoque = itensConferencia
        .filter(item => item.quantidadeSobra > 0)
        .map(item => ({
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            preco: item.preco,
            quantidade: item.quantidadeSobra
        }));

    Storage.salvarConferencia({
        id: Utils.gerarId(),
        lojaId: conferenciaAtual.lojaId,
        lojaNome: conferenciaAtual.lojaNome,
        data,
        responsavel: conferenciaAtual.responsavel,
        itens: itensHistorico,
        totalPecasVendidas,
        valorTotalVendido,
        criadoEm: agora
    });

    Storage.salvarEstoqueLoja({
        lojaId: conferenciaAtual.lojaId,
        lojaNome: conferenciaAtual.lojaNome,
        responsavel: conferenciaAtual.responsavel,
        atualizadoEm: agora,
        itens: itensEstoque
    });

    conferenciaAtual.data = data;
    itensConferencia = itensEstoque.map(item => ({
        ...item,
        quantidadeSobra: item.quantidade
    }));

    conferenciaPersistida = true;

    Toast.show("Conferência salva e estoque atualizado!");
    renderConteudoConferencia();
}

function gerarPDFVendasConferencia() {
    if (!validarConferenciaCarregada()) return;

    const dados = montarDadosVendasConferencia();

    if (dados.itensVendidos.length === 0) {
        Toast.show("Nenhuma venda foi informada.");
        return;
    }

    if (PDF.gerarVendasConferencia(dados)) {
        salvarResultadoConferencia();
    }
}

function gerarPDFEstoqueConferencia() {
    if (!validarConferenciaCarregada()) return;

    if (PDF.gerarEstoqueAtualizado(montarDadosEstoqueConferencia())) {
        salvarResultadoConferencia();
    }
}

function gerarDoisPDFsConferencia() {
    if (!validarConferenciaCarregada()) return;

    const dadosVendas = montarDadosVendasConferencia();
    const dadosEstoque = montarDadosEstoqueConferencia();

    if (dadosVendas.itensVendidos.length === 0) {
        Toast.show("Nenhuma venda foi informada.");
        return;
    }

    const vendasGerado = PDF.gerarVendasConferencia(dadosVendas);
    const estoqueGerado = PDF.gerarEstoqueAtualizado(dadosEstoque);

    if (vendasGerado && estoqueGerado) {
        salvarResultadoConferencia();
    }
}

function normalizarDataConferencia(valor) {
    return String(valor || Utils.hoje()).slice(0, 10);
}

function escaparHtmlConferencia(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
