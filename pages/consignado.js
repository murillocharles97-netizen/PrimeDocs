let itensConsignado = [];
let consignadoRegistradoNestaTela = false;

function renderConsignado() {
    itensConsignado = [];
    consignadoRegistradoNestaTela = false;
    const lojas = Storage.listarLojas()
        .filter(loja => loja.ativo !== false)
        .sort((a, b) => String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "pt-BR",
            { sensitivity: "base" }
        ));

    const opcoesLojas = lojas.map(loja => `
        <option value="${escaparHtmlConsignado(loja.id)}">
            ${escaparHtmlConsignado(loja.nome)}
        </option>
    `).join("");

    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>

        ${Page.titulo(
            "📦 Consignado",
            "Preencha as informações dos produtos deixados na loja parceira."
        )}

        <div class="cardForm">
            <label class="inputGroup">
                <span>Loja</span>
                <select id="loja" onchange="preencherResponsavelLojaConsignado()">
                    <option value="">Selecione uma loja</option>
                    ${opcoesLojas}
                </select>
            </label>

            ${lojas.length === 0
                ? '<p class="mb20">Nenhuma loja ativa cadastrada. Cadastre uma loja no menu Lojas.</p>'
                : ""}

            ${Input.text("Responsável", "responsavel", "Nome do responsável")}

            <label class="inputGroup">
                <span>Data</span>
                <input id="dataConsignado" type="date" value="${Utils.hoje()}">
            </label>

            <label class="inputGroup">
                <span>Observações</span>
                <textarea id="observacoesConsignado" placeholder="Observações..."></textarea>
            </label>
        </div>

        <h3 class="sectionTitle">Produtos</h3>
        <div id="listaProdutosConsignado"></div>

        <button class="addProduto" type="button" onclick="abrirModalSelecionarProduto()">
            + Adicionar Produto
        </button>

        <div class="space"></div>
        ${Button.primary("Gerar PDF", "gerarPDFConsignado()")}
    `;

    renderListaProdutosConsignado();
    lucide.createIcons();
}

function preencherResponsavelLojaConsignado() {
    const lojaId = document.getElementById("loja").value;
    const responsavel = document.getElementById("responsavel");
    const loja = Storage.buscarLojaPorId(lojaId);

    responsavel.value = loja?.responsavel || "";
}

function renderListaProdutosConsignado() {
    const lista = document.getElementById("listaProdutosConsignado");

    if (!lista) return;

    if (itensConsignado.length === 0) {
        lista.innerHTML = `
            <div class="cardForm textCenter">
                <h3>Nenhum produto adicionado</h3>
                <p>Use o botão abaixo para selecionar um produto.</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = itensConsignado.map(item => `
        <div class="produtoCard">
            <div class="produtoHeader">
                <div>
                    <h3>${escaparHtmlConsignado(item.nome)}</h3>
                    <span>${escaparHtmlConsignado(item.codigo || "Sem código")}</span>
                </div>

                <button
                    class="removeBtn"
                    type="button"
                    aria-label="Remover produto"
                    data-acao="remover"
                    data-produto-id="${escaparHtmlConsignado(item.produtoId)}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>

            <div class="chips">
                <span class="badge primary">
                    ${escaparHtmlConsignado(item.categoria || "Sem categoria")}
                </span>
            </div>

            <label>
                Quantidade
                <div class="quantity">
                    <button
                        type="button"
                        aria-label="Diminuir quantidade"
                        data-acao="quantidade"
                        data-delta="-1"
                        data-produto-id="${escaparHtmlConsignado(item.produtoId)}">−</button>

                    <input
                        type="number"
                        value="${item.quantidade}"
                        min="1"
                        readonly
                        aria-label="Quantidade de ${escaparHtmlConsignado(item.nome)}">

                    <button
                        type="button"
                        aria-label="Aumentar quantidade"
                        data-acao="quantidade"
                        data-delta="1"
                        data-produto-id="${escaparHtmlConsignado(item.produtoId)}">+</button>
                </div>
            </label>
        </div>
    `).join("");

    lista.querySelectorAll("[data-acao='quantidade']").forEach(botao => {
        botao.addEventListener("click", () => {
            alterarQtdConsignado(botao.dataset.produtoId, Number(botao.dataset.delta));
        });
    });

    lista.querySelectorAll("[data-acao='remover']").forEach(botao => {
        botao.addEventListener("click", () => {
            removerProdutoConsignado(botao.dataset.produtoId);
        });
    });

    lucide.createIcons();
}

function abrirModalSelecionarProduto() {
    Modal.abrir(
        "Adicionar Produto",
        `
            ${Input.text(
                "Pesquisar",
                "pesquisaProdutoConsignado",
                "Digite o nome, código ou categoria"
            )}
            <div id="produtosDisponiveisConsignado"></div>
        `
    );

    const pesquisa = document.getElementById("pesquisaProdutoConsignado");
    pesquisa.addEventListener("input", renderProdutosDisponiveis);
    pesquisa.focus();
    renderProdutosDisponiveis();
}

function renderProdutosDisponiveis() {
    const lista = document.getElementById("produtosDisponiveisConsignado");
    const campoPesquisa = document.getElementById("pesquisaProdutoConsignado");

    if (!lista) return;

    const pesquisa = (campoPesquisa?.value || "").trim().toLocaleLowerCase("pt-BR");

    const produtos = Storage.listarProdutos()
        .filter(produto => produto.ativo !== false)
        .filter(produto => {
            const dados = [produto.nome, produto.codigo, produto.categoria]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("pt-BR");

            return dados.includes(pesquisa);
        })
        .sort((a, b) => {
            if (Boolean(a.favorito) !== Boolean(b.favorito)) {
                return a.favorito ? -1 : 1;
            }

            return String(a.nome || "").localeCompare(
                String(b.nome || ""),
                "pt-BR",
                { sensitivity: "base" }
            );
        });

    if (produtos.length === 0) {
        lista.innerHTML = `
            <div class="textCenter">
                <p>Nenhum produto encontrado.</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = produtos.map(produto => {
        const jaAdicionado = itensConsignado.some(
            item => String(item.produtoId) === String(produto.id)
        );

        return `
            <button
                class="produtoCard produtoDisponivelConsignado"
                type="button"
                data-produto-id="${escaparHtmlConsignado(produto.id)}"
                style="width:100%; border:none; text-align:left; cursor:pointer; margin-bottom:12px;">
                <div class="produtoHeader" style="margin-bottom:8px;">
                    <div>
                        <h3>${escaparHtmlConsignado(produto.nome)}</h3>
                        <span>${escaparHtmlConsignado(produto.codigo || "Sem código")}</span>
                    </div>
                    ${produto.favorito ? '<span class="badge primary">⭐ Favorito</span>' : ""}
                </div>

                <span>${escaparHtmlConsignado(produto.categoria || "Sem categoria")}</span>
                ${jaAdicionado
                    ? '<div class="mt10"><span class="badge green">Já adicionado · clique para aumentar</span></div>'
                    : ""}
            </button>
        `;
    }).join("");

    lista.querySelectorAll(".produtoDisponivelConsignado").forEach(botao => {
        botao.addEventListener("click", () => {
            adicionarProdutoConsignado(botao.dataset.produtoId);
        });
    });
}

function adicionarProdutoConsignado(id) {
    const itemExistente = itensConsignado.find(
        item => String(item.produtoId) === String(id)
    );

    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        const produto = Storage.listarProdutos().find(
            produtoSalvo => String(produtoSalvo.id) === String(id)
        );

        if (!produto) {
            Toast.show("Produto não encontrado.");
            return;
        }

        itensConsignado.push({
            produtoId: produto.id,
            nome: produto.nome,
            codigo: produto.codigo,
            categoria: produto.categoria,
            preco: Number(produto.preco) || 0,
            quantidade: 1
        });
    }

    Modal.fechar();
    renderListaProdutosConsignado();
}

function alterarQtdConsignado(id, delta) {
    const item = itensConsignado.find(
        produto => String(produto.produtoId) === String(id)
    );

    if (!item) return;

    item.quantidade = Math.max(1, item.quantidade + delta);
    renderListaProdutosConsignado();
}

function removerProdutoConsignado(id) {
    itensConsignado = itensConsignado.filter(
        item => String(item.produtoId) !== String(id)
    );

    renderListaProdutosConsignado();
}

function gerarPDFConsignado() {
    const lojaId = document.getElementById("loja").value;
    const loja = Storage.buscarLojaPorId(lojaId);
    const responsavel = document.getElementById("responsavel").value.trim();
    const data = document.getElementById("dataConsignado").value;
    const observacoes = document.getElementById("observacoesConsignado").value.trim();

    if (!loja) {
        Toast.show("Selecione uma loja.");
        return;
    }

    if (itensConsignado.length === 0) {
        Toast.show("Adicione pelo menos um produto.");
        return;
    }

    const dados = {
        loja: loja.nome,
        responsavel,
        data,
        observacoes,
        itens: itensConsignado.map(item => ({ ...item }))
    };

    const pdfGerado = PDF.gerarConsignado(dados);

    if (!pdfGerado) return;

    if (consignadoRegistradoNestaTela) {
        Toast.show("PDF gerado novamente sem duplicar o estoque.");
        return;
    }

    Storage.salvarConsignado({
        id: Utils.gerarId(),
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel,
        data,
        observacoes,
        itens: itensConsignado.map(item => ({ ...item })),
        criadoEm: new Date().toISOString()
    });

    adicionarConsignadoAoEstoqueLoja(loja, responsavel);
    consignadoRegistradoNestaTela = true;
    Toast.show("Consignado salvo e estoque da loja atualizado!");
}

function adicionarConsignadoAoEstoqueLoja(loja, responsavel) {
    const estoqueExistente = Storage.buscarEstoqueLoja(loja.id);
    const itensEstoque = (estoqueExistente?.itens || []).map(item => ({ ...item }));

    itensConsignado.forEach(itemConsignado => {
        const itemExistente = itensEstoque.find(
            item => String(item.produtoId) === String(itemConsignado.produtoId)
        );

        if (itemExistente) {
            itemExistente.quantidade = Number(itemExistente.quantidade || 0)
                + Number(itemConsignado.quantidade || 0);
            itemExistente.preco = Number(itemConsignado.preco) || 0;
            itemExistente.nome = itemConsignado.nome;
            itemExistente.codigo = itemConsignado.codigo;
            itemExistente.categoria = itemConsignado.categoria;
        } else {
            itensEstoque.push({
                produtoId: itemConsignado.produtoId,
                codigo: itemConsignado.codigo,
                nome: itemConsignado.nome,
                categoria: itemConsignado.categoria,
                preco: Number(itemConsignado.preco) || 0,
                quantidade: Number(itemConsignado.quantidade) || 0
            });
        }
    });

    Storage.salvarEstoqueLoja({
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel,
        atualizadoEm: new Date().toISOString(),
        itens: itensEstoque
    });
}

function escaparHtmlConsignado(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
