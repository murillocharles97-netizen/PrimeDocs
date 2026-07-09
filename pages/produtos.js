let produtoEditando = null;

function renderProdutos() {
    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>

        ${Page.titulo("📦 Produtos", "Catálogo de produtos da PrimeLine 3D")}

        <section class="productToolbar">
            <div class="productSearch">
                <i data-lucide="search"></i>
                <input id="pesquisaProduto" placeholder="Pesquisar produto, categoria ou código..." oninput="listarProdutos()">
            </div>
            <button class="btn productNewButton" onclick="abrirModalProduto()">
                <i data-lucide="plus"></i>
                Novo produto
            </button>
        </section>

        <div id="listaProdutos" class="productsGrid"></div>

        <button class="fab" onclick="abrirModalProduto()" aria-label="Novo produto">+</button>
    `;

    listarProdutos();
    lucide.createIcons();
}

function listarProdutos() {
    const lista = document.getElementById("listaProdutos");
    const pesquisa = String(document.getElementById("pesquisaProduto")?.value || "").trim().toLowerCase();

    let produtos = Storage.listarProdutos();

    if (pesquisa) {
        produtos = produtos.filter(prod => {
            const texto = [
                prod.nome,
                prod.categoria,
                prod.codigo,
                prod.cor
            ].join(" ").toLowerCase();
            return texto.includes(pesquisa);
        });
    }

    produtos = produtos.sort((a, b) => {
        if (Boolean(b.favorito) !== Boolean(a.favorito)) return Number(b.favorito) - Number(a.favorito);
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

    if (!produtos.length) {
        lista.className = "";
        lista.innerHTML = `
            <div class="erpEmpty productEmptyState">
                <i data-lucide="package-open"></i>
                <strong>Nenhum produto encontrado</strong>
                <p>Cadastre produtos para usar em pedidos, orçamentos e consignados.</p>
                <button class="btn" onclick="abrirModalProduto()">Cadastrar produto</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    lista.className = "productsGrid";
    lista.innerHTML = produtos.map(prod => criarCardProduto(prod)).join("");
    lucide.createIcons();
}

function criarCardProduto(prod) {
    const preco = Number(prod.preco) || 0;
    const custo = Number(prod.custo) || 0;
    const lucro = preco - custo;
    const margem = preco > 0 ? (lucro / preco) * 100 : 0;
    const estoque = obterEstoqueProduto(prod);
    const ativo = prod.ativo !== false;
    const estoqueBaixo = estoque > 0 && estoque <= 2;
    const semEstoque = estoque <= 0;

    return `
        <article class="productCard ${!ativo ? "isInactive" : ""}">
            <header class="productCardHeader">
                <div class="productIcon">
                    <i data-lucide="${prod.favorito ? "star" : "package"}"></i>
                </div>
                <div>
                    <span>${escaparProduto(prod.categoria || "Sem categoria")}</span>
                    <h3>${escaparProduto(prod.nome || "Produto sem nome")}</h3>
                    <small>${escaparProduto(prod.codigo || "Sem SKU")}</small>
                </div>
            </header>

            <div class="productBadges">
                ${ativo ? `<span class="productBadge success">Ativo</span>` : `<span class="productBadge muted">Inativo</span>`}
                ${semEstoque ? `<span class="productBadge danger">Sem estoque</span>` : ""}
                ${estoqueBaixo ? `<span class="productBadge warning">Estoque baixo</span>` : ""}
                ${prod.favorito ? `<span class="productBadge primary">Favorito</span>` : ""}
            </div>

            <section class="productMetrics">
                <div><span>Venda</span><strong>${Utils.moeda(preco)}</strong></div>
                <div><span>Custo</span><strong>${Utils.moeda(custo)}</strong></div>
                <div><span>Lucro</span><strong class="${lucro < 0 ? "negative" : ""}">${Utils.moeda(lucro)}</strong></div>
                <div><span>Margem</span><strong>${margem.toFixed(0)}%</strong></div>
            </section>

            <footer class="productCardFooter">
                <div>
                    <span>Estoque</span>
                    <strong>${estoque}</strong>
                </div>
                <section>
                    <button type="button" onclick="abrirDetalhesProduto('${prod.id}')">
                        <i data-lucide="eye"></i>
                        Detalhes
                    </button>
                    <button type="button" onclick="editarProduto('${prod.id}')">
                        <i data-lucide="pencil"></i>
                        Editar
                    </button>
                    <button type="button" class="danger" onclick="pedirExclusaoProduto('${prod.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </section>
            </footer>
        </article>
    `;
}

function obterEstoqueProduto(prod) {
    const campos = [prod.estoque, prod.quantidade, prod.quantidadeEstoque, prod.estoqueAtual];
    const encontrado = campos.find(valor => Number.isFinite(Number(valor)));
    return Math.max(0, Number(encontrado) || 0);
}

function pedirExclusaoProduto(id) {
    const produto = Storage.buscarProdutoPorId(id);
    if (!produto) return;

    Modal.abrir("Excluir produto", `
        <div class="modalConfirm">
            <p>Deseja excluir <strong>${escaparProduto(produto.nome)}</strong>?</p>
            <small>Essa ação remove o produto do cadastro, mas não altera históricos já gerados.</small>
            <div class="modalActions">
                <button class="btnSecondary" type="button" onclick="Modal.fechar()">Cancelar</button>
                <button class="btn dangerButton" type="button" onclick="excluirProduto('${produto.id}')">Excluir</button>
            </div>
        </div>
    `);
    lucide.createIcons();
}

function excluirProduto(id) {
    const produto = Storage.buscarProdutoPorId(id);
    Storage.excluirProduto(produto?.id ?? id);
    Modal.fechar();
    listarProdutos();
    Toast.show("Produto excluído.");
}

function abrirDetalhesProduto(id) {
    const prod = Storage.buscarProdutoPorId(id);
    if (!prod) return;

    const preco = Number(prod.preco) || 0;
    const custo = Number(prod.custo) || 0;
    const lucro = preco - custo;
    const margem = preco > 0 ? (lucro / preco) * 100 : 0;

    Modal.abrir("Detalhes do produto", `
        <div class="productDetails">
            <div class="productDetailsHero">
                <span>${escaparProduto(prod.categoria || "Sem categoria")}</span>
                <h3>${escaparProduto(prod.nome)}</h3>
                <p>${escaparProduto(prod.codigo || "Sem SKU")}</p>
            </div>
            <div class="productMetrics">
                <div><span>Venda</span><strong>${Utils.moeda(preco)}</strong></div>
                <div><span>Custo</span><strong>${Utils.moeda(custo)}</strong></div>
                <div><span>Lucro</span><strong>${Utils.moeda(lucro)}</strong></div>
                <div><span>Margem</span><strong>${margem.toFixed(0)}%</strong></div>
                <div><span>Peso</span><strong>${Number(prod.peso || 0)} g</strong></div>
                <div><span>Tempo</span><strong>${escaparProduto(prod.tempo || "-")}</strong></div>
            </div>
            <button class="btn" type="button" onclick="Modal.fechar(); editarProduto('${prod.id}')">Editar produto</button>
        </div>
    `);
    lucide.createIcons();
}

function editarProduto(id) {
    produtoEditando = Storage.buscarProdutoPorId(id);
    Modal.abrir("Editar Produto", montarFormularioProduto(produtoEditando));
}

function montarFormularioProduto(prod = {}) {
    return `
        ${Input.text("Nome", "nomeProduto", "Ex: Taça da Copa", prod.nome || "")}
        ${Input.select("Categoria", "categoria", CATEGORIAS, prod.categoria || "")}
        ${Input.number("Preço", "preco", prod.preco || "")}
        ${Input.number("Custo", "custo", prod.custo || "")}
        ${Input.number("Peso (g)", "peso", prod.peso || "")}
        ${Input.text("Tempo", "tempo", "3h25", prod.tempo || "")}
        ${Input.text("Cor", "cor", "Branco", prod.cor || "")}

        <label class="favoriteToggle">
            <input id="favorito" type="checkbox" ${prod.favorito ? "checked" : ""}>
            <span>Favorito</span>
        </label>

        <div class="space"></div>
        ${Button.primary(prod.id ? "Salvar Alterações" : "Salvar Produto", "salvarProduto()")}
    `;
}

function abrirModalProduto() {
    produtoEditando = null;
    Modal.abrir("Novo Produto", montarFormularioProduto());
}

function salvarProduto() {
    const nome = document.getElementById("nomeProduto").value.trim();
    const categoria = document.getElementById("categoria").value;
    const preco = document.getElementById("preco").value;
    const custo = document.getElementById("custo").value;

    if (!nome) return Toast.show("Informe o nome do produto.");
    if (preco === "") return Toast.show("Informe o preço.");
    if (custo === "") return Toast.show("Informe o custo.");

    const produto = {
        ...produtoEditando,
        id: produtoEditando?.id || Utils.gerarId(),
        codigo: produtoEditando?.codigo || Utils.gerarCodigo(categoria),
        nome,
        categoria,
        preco: Number(preco),
        custo: Number(custo),
        peso: Number(document.getElementById("peso").value) || 0,
        tempo: document.getElementById("tempo").value,
        cor: document.getElementById("cor").value,
        favorito: document.getElementById("favorito").checked,
        ativo: true,
        criadoEm: produtoEditando?.criadoEm || Utils.hoje()
    };

    Storage.salvarProduto(produto);
    produtoEditando = null;
    Modal.fechar();
    listarProdutos();
    Toast.show("Produto salvo com sucesso!");
}

function escaparProduto(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
