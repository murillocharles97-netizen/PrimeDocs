let produtoEditando = null;
let tipoProducaoEdicao = "simples";
let operacoesModeloEdicao = [];
let materiaisSimplesEdicao = [];
let tempoSimplesMinutosEdicao = 0;
let salvandoProduto = false;
let colecaoProdutosAtiva = null;
let filtroFavoritosProdutos = false;
let filtroSemEstoqueProdutos = false;

function renderProdutos() {
    Producao.migrarDados();
    Storage.migrarColecoesProdutos();
    colecaoProdutosAtiva = null;
    filtroFavoritosProdutos = false;
    filtroSemEstoqueProdutos = false;
    renderTelaProdutos();
}

function renderTelaProdutos() {
    if (colecaoProdutosAtiva) return renderProdutosDaColecao();
    const colecoes = Storage.listarColecoesProdutos().filter(item => item.ativo !== false).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const conteudo = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>
        <div class="productPageHeading"><div>${Page.titulo("📦 Produtos", "Organize o catálogo por coleções.")}</div><div><button class="btnSecondary" type="button" onclick="abrirModalColecaoProduto()"><i data-lucide="folder-plus"></i> Nova coleção</button><button class="btn" type="button" onclick="abrirModalProduto()"><i data-lucide="plus"></i> Novo produto</button></div></div>
        <section class="collectionIntro"><div><span>COLEÇÕES</span><h3>Seu catálogo organizado</h3><p>Abra uma coleção para pesquisar, ordenar e gerenciar somente os produtos relacionados.</p></div><strong>${colecoes.length} ${colecoes.length === 1 ? "coleção" : "coleções"}</strong></section>
        <div class="productCollectionsGrid">${colecoes.map(criarCardColecaoProduto).join("")}</div>
    `;
    if (!window.InventoryPage?.mountSectionContent?.("produtos", conteudo)) app.innerHTML = conteudo;
    lucide.createIcons();
}

function criarCardColecaoProduto(colecao) {
    const produtos = Storage.listarProdutos().filter(produto => produto.ativo !== false && String(produto.colecaoId) === String(colecao.id));
    const estoque = produtos.reduce((total, produto) => total + obterEstoqueProduto(produto), 0);
    const valorEstoque = produtos.reduce((total, produto) => total + obterEstoqueProduto(produto) * Number(produto.preco || 0), 0);
    const vendas = produtos.flatMap(produto => obterVendasProduto(produto.id));
    const ultimaVenda = vendas.sort((a, b) => new Date(b.data) - new Date(a.data))[0]?.data;
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const vendidasMes = vendas.filter(venda => new Date(venda.data) >= inicioMes).reduce((total, venda) => total + venda.quantidade, 0);
    return `<article class="productCollectionCard" style="--collection-color:${escaparProduto(colecao.cor || "#6D4AFF")}">
        <header><span class="collectionIcon"><i data-lucide="${escaparProduto(colecao.icone || "boxes")}"></i></span><button class="btn-icon" type="button" onclick="abrirModalColecaoProduto('${colecao.id}')" aria-label="Editar coleção ${escaparProduto(colecao.nome)}"><i data-lucide="ellipsis"></i></button></header>
        <div><span>COLEÇÃO</span><h3>${escaparProduto(colecao.nome)}</h3><p>${escaparProduto(colecao.descricao || "Produtos organizados nesta coleção.")}</p></div>
        <section class="collectionMetrics"><div><span>Modelos</span><strong>${produtos.length}</strong></div><div><span>Em estoque</span><strong>${estoque}</strong></div><div><span>Valor estimado</span><strong>${Utils.moeda(valorEstoque)}</strong></div><div><span>Vendidos no mês</span><strong>${vendidasMes}</strong></div></section>
        <footer><span><i data-lucide="clock-3"></i> ${ultimaVenda ? `Última venda ${rotuloDataColecao(ultimaVenda)}` : "Sem vendas registradas"}</span><button type="button" onclick="abrirColecaoProdutos('${colecao.id}')">Abrir <i data-lucide="arrow-right"></i></button></footer>
    </article>`;
}

function abrirColecaoProdutos(id) { colecaoProdutosAtiva = id; filtroFavoritosProdutos = false; filtroSemEstoqueProdutos = false; renderProdutosDaColecao(); }
function voltarColecoesProdutos() { colecaoProdutosAtiva = null; renderTelaProdutos(); }

function renderProdutosDaColecao() {
    const colecao = Storage.buscarColecaoProdutoPorId(colecaoProdutosAtiva);
    if (!colecao || colecao.ativo === false) { colecaoProdutosAtiva = null; return renderTelaProdutos(); }
    const conteudo = `<button class="back" onclick="voltarColecoesProdutos()"><i data-lucide="arrow-left"></i> Coleções</button>
        <div class="collectionDetailHeading"><div class="collectionIcon" style="--collection-color:${escaparProduto(colecao.cor)}"><i data-lucide="${escaparProduto(colecao.icone || "boxes")}"></i></div><div><span>COLEÇÃO</span><h2>${escaparProduto(colecao.nome)}</h2><p>${escaparProduto(colecao.descricao || "Gerencie os produtos desta coleção.")}</p></div><button class="btn" type="button" onclick="abrirModalProduto()"><i data-lucide="plus"></i> Novo produto</button></div>
        <section class="productToolbar collectionProductToolbar"><div class="productSearch"><i data-lucide="search"></i><input id="pesquisaProduto" placeholder="Pesquisar nesta coleção..." oninput="listarProdutos()"></div><select id="ordemProdutos" onchange="listarProdutos()" aria-label="Ordenar produtos"><option value="nome">Nome A–Z</option><option value="recentes">Mais recentes</option><option value="vendidos">Mais vendidos</option><option value="lucrativos">Mais lucrativos</option></select><button class="productFilterChip ${filtroFavoritosProdutos ? "isActive" : ""}" type="button" onclick="alternarFiltroProdutos('favoritos')"><i data-lucide="star"></i> Favoritos</button><button class="productFilterChip ${filtroSemEstoqueProdutos ? "isActive" : ""}" type="button" onclick="alternarFiltroProdutos('semEstoque')"><i data-lucide="package-x"></i> Sem estoque</button></section>
        <div id="resumoColecaoProdutos" class="collectionProductsSummary"></div><div id="listaProdutos" class="productsGrid"></div>`;
    if (!window.InventoryPage?.mountSectionContent?.("produtos", conteudo)) app.innerHTML = conteudo;
    listarProdutos(); lucide.createIcons();
}

function alternarFiltroProdutos(tipo) { if (tipo === "favoritos") filtroFavoritosProdutos = !filtroFavoritosProdutos; if (tipo === "semEstoque") filtroSemEstoqueProdutos = !filtroSemEstoqueProdutos; renderProdutosDaColecao(); }

function listarProdutos() {
    const lista = document.getElementById("listaProdutos");
    if (!lista) return;
    const pesquisa = String(document.getElementById("pesquisaProduto")?.value || "").trim().toLowerCase();
    const ordenacao = document.getElementById("ordemProdutos")?.value || "nome";
    let produtos = Storage.listarProdutos().filter(produto => produto.ativo !== false && (!colecaoProdutosAtiva || String(produto.colecaoId) === String(colecaoProdutosAtiva)));

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
    if (filtroFavoritosProdutos) produtos = produtos.filter(produto => Boolean(produto.favorito));
    if (filtroSemEstoqueProdutos) produtos = produtos.filter(produto => obterEstoqueProduto(produto) <= 0);
    produtos = produtos.sort((a, b) => {
        if (ordenacao === "recentes") return new Date(b.atualizadoEm || b.criadoEm || 0) - new Date(a.atualizadoEm || a.criadoEm || 0);
        if (ordenacao === "vendidos") return totalVendidoProduto(b.id) - totalVendidoProduto(a.id);
        if (ordenacao === "lucrativos") return (Number(b.preco || 0) - Number(b.custo || 0)) - (Number(a.preco || 0) - Number(a.custo || 0));
        if (Boolean(b.favorito) !== Boolean(a.favorito)) return Number(b.favorito) - Number(a.favorito);
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    const resumo = document.getElementById("resumoColecaoProdutos");
    if (resumo) resumo.innerHTML = `<span><strong>${produtos.length}</strong> modelos exibidos</span><span><strong>${produtos.reduce((total, produto) => total + obterEstoqueProduto(produto), 0)}</strong> peças em estoque</span>`;

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
                <button class="productFavoriteButton ${prod.favorito ? "isFavorite" : ""}" type="button" aria-pressed="${Boolean(prod.favorito)}" aria-label="${prod.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${prod.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}" onclick="alternarFavoritoProduto('${prod.id}', this)"><i data-lucide="star"></i></button>
                <div>
                    <span>${escaparProduto(prod.categoria || "Sem categoria")}</span>
                    <h3>${escaparProduto(prod.nome || "Produto sem nome")}</h3>
                    <small>${escaparProduto(prod.codigo || "Sem SKU")}</small>
                </div>
            </header>

            <div class="productBadges">
                ${!ativo ? `<span class="productBadge muted">Inativo</span>` : ""}
                ${semEstoque ? `<span class="productBadge danger">Sem estoque</span>` : ""}
                ${estoqueBaixo ? `<span class="productBadge warning">Estoque baixo</span>` : ""}
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
                    <button type="button" class="btn-icon productMoreButton" onclick="abrirAcoesProduto('${prod.id}')" aria-label="Mais ações de ${escaparProduto(prod.nome || "produto")}" title="Mais ações"><i data-lucide="ellipsis"></i></button>
                </section>
            </footer>
        </article>
    `;
}

function abrirAcoesProduto(id) {
    const produto = Storage.buscarProdutoPorId(id);
    if (!produto) return Toast.show("Produto não encontrado.");
    Modal.abrir("Ações do produto", `
        <div class="compactActionMenu">
            <button type="button" onclick="Modal.fechar(); editarProduto('${produto.id}')"><i data-lucide="pencil"></i><span><strong>Editar produto</strong><small>Alterar informações do cadastro</small></span></button>
            <button type="button" class="danger" onclick="Modal.fechar(); pedirExclusaoProduto('${produto.id}')"><i data-lucide="trash-2"></i><span><strong>Excluir produto</strong><small>Remover produto do catálogo</small></span></button>
        </div>
    `);
    lucide.createIcons();
}

function alternarFavoritoProduto(id, botao) {
    const produto = Storage.buscarProdutoPorId(id);
    if (!produto) return Toast.show("Produto não encontrado.");
    produto.favorito = !Boolean(produto.favorito);
    Storage.salvarProduto(produto);
    botao?.classList.toggle("isFavorite", produto.favorito);
    botao?.classList.add("favoritePulse");
    botao?.setAttribute("aria-pressed", String(produto.favorito));
    botao?.setAttribute("aria-label", produto.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos");
    setTimeout(() => listarProdutos(), 180);
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
    const pedidosVinculados = Storage.listarPedidos().filter(pedido => pedido.ativo !== false && !["entregue", "cancelado"].includes(pedido.statusPedido) && (pedido.itens || []).some(item => String(item.produtoId) === String(produto?.id ?? id)));
    const producoesVinculadas = ERPIntegracao.ordensAtivas().filter(ordem => String(ordem.produtoId) === String(produto?.id ?? id));
    if (pedidosVinculados.length || producoesVinculadas.length) return Toast.show("Este produto possui pedido ou produção ativa. Conclua ou cancele o fluxo antes de arquivá-lo.");
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
                <div><span>Produção</span><strong>${prod.tipoProducao === "composta" ? `${(prod.operacoesModelo || []).length} operações` : "Simples"}</strong></div>
            </div>
            <button class="btn" type="button" onclick="Modal.fechar(); editarProduto('${prod.id}')">Editar produto</button>
        </div>
    `);
    lucide.createIcons();
}

function editarProduto(id) {
    produtoEditando = Storage.buscarProdutoPorId(id);
    if (!produtoEditando) return Toast.show("Produto não encontrado.", "error");
    produtoEditando = Producao.normalizarProduto(produtoEditando);
    tipoProducaoEdicao = produtoEditando?.tipoProducao === "composta" ? "composta" : "simples";
    operacoesModeloEdicao = (produtoEditando?.operacoesModelo || []).map((op, index) => Producao.normalizarOperacaoModelo(op, index));
    materiaisSimplesEdicao = (produtoEditando?.materiais || []).map(MaterialListEditor.normalizar);
    tempoSimplesMinutosEdicao = minutosDoTempoProduto(produtoEditando?.tempo);
    Modal.abrir("Editar Produto", montarFormularioProduto(produtoEditando));
    configurarModalProduto();
    renderEditorReceitaProduto();
    vincularResumoProduto();
}

function montarFormularioProduto(prod = {}) {
    const categorias = CATEGORIAS.map(categoria => `<option value="${escaparProduto(categoria)}" ${categoria === prod.categoria ? "selected" : ""}>${escaparProduto(categoria)}</option>`).join("");
    const colecoes = Storage.listarColecoesProdutos().filter(colecao => colecao.ativo !== false);
    const colecaoSelecionada = prod.colecaoId || colecaoProdutosAtiva || Storage.garantirColecaoGeral().id;
    const opcoesColecao = colecoes.map(colecao => `<option value="${colecao.id}" ${String(colecao.id) === String(colecaoSelecionada) ? "selected" : ""}>${escaparProduto(colecao.nome)}</option>`).join("");
    return `
        <div class="productEditorForm">
            <section class="productFormSection productCommercialSection">
                <div class="productSectionHeader">
                    <span>INFORMAÇÕES COMERCIAIS</span>
                    <h3>Dados do produto</h3>
                    <p>Informe somente os dados usados na venda. Peso, custo e cores são calculados pela receita.</p>
                </div>
                <div class="erpFormGrid productCommercialGrid">
                    <label class="inputGroup"><span>Nome <b aria-hidden="true">*</b></span><input id="nomeProduto" value="${escaparProduto(prod.nome || "")}" placeholder="Ex: Taça da Copa" autocomplete="off"></label>
                    <label class="inputGroup"><span>Código / SKU</span><input id="codigoProduto" value="${escaparProduto(prod.codigo || "")}" placeholder="Gerado automaticamente se vazio" autocomplete="off"></label>
                    <label class="inputGroup"><span>Categoria <b aria-hidden="true">*</b></span><select id="categoria">${categorias}</select></label>
                    <div class="inputGroup productCollectionField"><span>Coleção <b aria-hidden="true">*</b></span><div class="productCollectionSelectRow"><select id="colecaoProdutoSelect">${opcoesColecao}</select><button class="btnSecondary" type="button" onclick="alternarNovaColecaoInline()"><i data-lucide="plus"></i> Nova coleção</button></div></div>
                    <div id="novaColecaoInline" class="newCollectionInline erpFull"><label class="inputGroup"><span>Nome da coleção</span><input id="novaColecaoNome" placeholder="Ex: Chaveiros"></label><label class="inputGroup"><span>Ícone</span><input id="novaColecaoIcone" value="boxes" placeholder="boxes"></label><label class="inputGroup"><span>Cor</span><input id="novaColecaoCor" type="color" value="#6D4AFF"></label><button class="btn" type="button" onclick="salvarNovaColecaoInline()">Criar e selecionar</button></div>
                    <label class="inputGroup"><span>Preço de venda <b aria-hidden="true">*</b></span><input id="preco" type="number" min="0" step="0.01" inputmode="decimal" value="${prod.preco ?? ""}" placeholder="0,00"></label>
                    <label class="inputGroup erpFull"><span>Descrição</span><textarea id="descricaoProduto" rows="3" placeholder="Detalhes comerciais, acabamento ou observações para venda">${escaparProduto(prod.descricao || "")}</textarea></label>
                    <label class="favoriteToggle erpFull"><input id="favorito" type="checkbox" ${prod.favorito ? "checked" : ""}><span><i data-lucide="star"></i> Marcar como favorito</span></label>
                </div>
            </section>

            <section class="productionRecipeEditor productFormSection" id="receitaProdutoSection">
                <div class="recipeHeader"><div><span>RECEITA DE PRODUÇÃO</span><h3>Como este produto é fabricado?</h3><p>A receita é a fonte oficial de peso, materiais, cores, tempo, AMS e custo estimado.</p></div></div>
                <label class="inputGroup"><span>Tipo de produção</span><select id="tipoProducao" onchange="alterarTipoProducaoProduto(this.value)"><option value="simples" ${tipoProducaoEdicao === "simples" ? "selected" : ""}>Simples — uma impressão</option><option value="composta" ${tipoProducaoEdicao === "composta" ? "selected" : ""}>Composta — várias operações</option></select></label>
                <div id="editorOperacoesProduto"></div>
            </section>

            <section class="productFormSection productAutomaticSummarySection">
                <div class="productSectionHeader"><span>RESUMO AUTOMÁTICO</span><h3>Produto e produção</h3><p>Os indicadores abaixo são atualizados enquanto você preenche.</p></div>
                <div id="resumoAutomaticoProduto" class="productAutomaticSummary" aria-live="polite"></div>
            </section>

            <div class="productSaveBar">
                <p><i data-lucide="shield-check"></i> Os dados técnicos serão calculados e salvos automaticamente.</p>
                <button id="salvarProdutoButton" class="btn btn-primary" type="button" onclick="salvarProduto()">
                    <i data-lucide="save"></i><span>${prod.id ? "Salvar Alterações" : "Salvar Produto"}</span>
                </button>
            </div>
        </div>
    `;
}

function abrirModalProduto() {
    produtoEditando = null;
    tipoProducaoEdicao = "simples";
    operacoesModeloEdicao = [];
    materiaisSimplesEdicao = [MaterialListEditor.criar()];
    tempoSimplesMinutosEdicao = 0;
    Modal.abrir("Novo Produto", montarFormularioProduto());
    configurarModalProduto();
    renderEditorReceitaProduto();
    vincularResumoProduto();
}

function configurarModalProduto() {
    document.querySelector("#modalRoot .modalContainer")?.classList.add("productEditorModal");
    lucide.createIcons();
}

function obterVendasProduto(produtoId) {
    return Storage.listarPedidos().filter(pedido => pedido.ativo !== false && !["cancelado", "aguardando_orcamento", "aguardando_aceite"].includes(pedido.statusPedido)).flatMap(pedido => (pedido.itens || []).filter(item => String(item.produtoId) === String(produtoId)).map(item => ({ quantidade: Math.max(0, Number(item.quantidade) || 0), data: pedido.dataEntrega || pedido.dataPedido || pedido.criadoEm || "" }))).filter(item => item.data);
}
function totalVendidoProduto(produtoId) { return obterVendasProduto(produtoId).reduce((total, venda) => total + venda.quantidade, 0); }
function rotuloDataColecao(data) { const hoje = Utils.hoje(); if (String(data).slice(0, 10) === hoje) return "hoje"; return new Date(data).toLocaleDateString("pt-BR"); }

function abrirModalColecaoProduto(id = "") {
    const colecao = id ? Storage.buscarColecaoProdutoPorId(id) : null;
    Modal.abrir(colecao ? "Editar coleção" : "Nova coleção", `<div class="collectionForm"><div class="erpFormGrid"><label class="inputGroup"><span>Nome *</span><input id="nomeColecaoProduto" value="${escaparProduto(colecao?.nome || "")}" placeholder="Ex: Chaveiros"></label><label class="inputGroup"><span>Ícone Lucide</span><input id="iconeColecaoProduto" value="${escaparProduto(colecao?.icone || "boxes")}" placeholder="boxes"></label><label class="inputGroup"><span>Cor principal</span><input id="corColecaoProduto" type="color" value="${escaparProduto(colecao?.cor || "#6D4AFF")}"></label><label class="inputGroup"><span>Ordem</span><input id="ordemColecaoProduto" type="number" min="0" value="${Number(colecao?.ordem ?? Storage.listarColecoesProdutos().length)}"></label><label class="inputGroup erpFull"><span>Descrição</span><textarea id="descricaoColecaoProduto" rows="3">${escaparProduto(colecao?.descricao || "")}</textarea></label></div><div class="modalActions">${colecao && String(colecao.nome).toLocaleLowerCase("pt-BR") !== "geral" ? `<button class="btnSecondary dangerButton" type="button" onclick="inativarColecaoProdutoUI('${colecao.id}')">Inativar</button>` : ""}<button class="btnSecondary" type="button" onclick="Modal.fechar()">Cancelar</button><button class="btn" type="button" onclick="salvarColecaoProdutoUI('${colecao?.id || ""}')">Salvar coleção</button></div></div>`);
    lucide.createIcons();
}

function salvarColecaoProdutoUI(id = "") {
    try {
        const existente = id ? Storage.buscarColecaoProdutoPorId(id) : null;
        const colecao = Storage.salvarColecaoProduto({ ...existente, id: id || undefined, nome: document.getElementById("nomeColecaoProduto")?.value, icone: document.getElementById("iconeColecaoProduto")?.value || "boxes", cor: document.getElementById("corColecaoProduto")?.value || "#6D4AFF", ordem: document.getElementById("ordemColecaoProduto")?.value, descricao: document.getElementById("descricaoColecaoProduto")?.value || "", ativo: true });
        Modal.fechar(); renderTelaProdutos(); Toast.show(`Coleção ${colecao.nome} salva.`, "success");
    } catch (erro) { Toast.show(erro.message || "Não foi possível salvar a coleção.", "error"); }
}

function inativarColecaoProdutoUI(id) {
    try { Storage.inativarColecaoProduto(id); Modal.fechar(); colecaoProdutosAtiva = null; renderTelaProdutos(); Toast.show("Coleção inativada. Os produtos foram movidos para Geral.", "success"); }
    catch (erro) { Toast.show(erro.message || "Não foi possível inativar a coleção.", "error"); }
}

function alternarNovaColecaoInline() { document.getElementById("novaColecaoInline")?.classList.toggle("isOpen"); }
function salvarNovaColecaoInline() {
    try {
        const nome = document.getElementById("novaColecaoNome")?.value.trim();
        const colecao = Storage.salvarColecaoProduto({ nome, icone: document.getElementById("novaColecaoIcone")?.value || "boxes", cor: document.getElementById("novaColecaoCor")?.value || "#6D4AFF", ativo: true });
        const select = document.getElementById("colecaoProdutoSelect");
        if (select) { const option = document.createElement("option"); option.value = colecao.id; option.textContent = colecao.nome; option.selected = true; select.appendChild(option); }
        document.getElementById("novaColecaoInline")?.classList.remove("isOpen");
        Toast.show("Coleção criada e selecionada.", "success");
    } catch (erro) { Toast.show(erro.message || "Não foi possível criar a coleção.", "error"); }
}

function vincularResumoProduto() {
    ["nomeProduto", "preco", "favorito", "categoria"].forEach(id => {
        const campo = document.getElementById(id);
        campo?.addEventListener("input", atualizarResumoAutomaticoProduto);
        campo?.addEventListener("change", atualizarResumoAutomaticoProduto);
    });
    atualizarResumoAutomaticoProduto();
}

function alterarTipoProducaoProduto(tipo) {
    capturarOperacoesModeloFormulario();
    if (tipoProducaoEdicao === "simples") {
        capturarTempoSimplesProduto();
        if (document.getElementById("material-editor-produto-simples")) materiaisSimplesEdicao = MaterialListEditor.obter("produto-simples");
    }
    tipoProducaoEdicao = tipo === "composta" ? "composta" : "simples";
    renderEditorReceitaProduto();
}

function alternarTipoOperacaoModeloProduto(index, tipo) {
    capturarOperacoesModeloFormulario();
    if (!operacoesModeloEdicao[index]) return;
    operacoesModeloEdicao[index].tipo = tipo;
    renderEditorReceitaProduto();
}

function novaOperacaoModeloProduto() {
    capturarOperacoesModeloFormulario();
    operacoesModeloEdicao.push(Producao.normalizarOperacaoModelo({ id: `modelo-${Date.now()}`, nome: `Operação ${operacoesModeloEdicao.length + 1}`, ordem: operacoesModeloEdicao.length }));
    renderEditorReceitaProduto();
}

function duplicarOperacaoModeloProduto(index) {
    capturarOperacoesModeloFormulario();
    const origem = operacoesModeloEdicao[index]; if (!origem) return;
    operacoesModeloEdicao.splice(index + 1, 0, Producao.normalizarOperacaoModelo({ ...origem, id: `modelo-${Date.now()}`, nome: `${origem.nome} (cópia)`, dependencias: [] }, index + 1));
    renderEditorReceitaProduto();
}

function removerOperacaoModeloProduto(index) {
    capturarOperacoesModeloFormulario();
    const removida = operacoesModeloEdicao[index];
    operacoesModeloEdicao.splice(index, 1);
    operacoesModeloEdicao.forEach(op => { op.dependencias = (op.dependencias || []).filter(dep => String(dep) !== String(removida?.id)); });
    renderEditorReceitaProduto();
}

function moverOperacaoModeloProduto(index, delta) {
    capturarOperacoesModeloFormulario();
    const destino = index + delta; if (destino < 0 || destino >= operacoesModeloEdicao.length) return;
    [operacoesModeloEdicao[index], operacoesModeloEdicao[destino]] = [operacoesModeloEdicao[destino], operacoesModeloEdicao[index]];
    renderEditorReceitaProduto();
}

function renderEditorReceitaProduto() {
    const el = document.getElementById("editorOperacoesProduto"); if (!el) return;
    if (tipoProducaoEdicao !== "composta") {
        const horas = Math.floor(tempoSimplesMinutosEdicao / 60);
        const minutos = tempoSimplesMinutosEdicao % 60;
        el.innerHTML = `<div class="simpleRecipeTime"><div><strong>Tempo da impressão</strong><small>Use o tempo total previsto para uma unidade.</small></div><div class="simpleRecipeTimeFields"><label class="inputGroup"><span>Horas</span><input id="tempoSimplesHoras" type="number" min="0" step="1" inputmode="numeric" value="${horas}"></label><label class="inputGroup"><span>Minutos</span><input id="tempoSimplesMinutos" type="number" min="0" max="59" step="1" inputmode="numeric" value="${minutos}"></label></div></div><div id="material-editor-produto-simples"></div><div id="resumoReceitaSimples" class="simpleRecipeSummary"></div>`;
        MaterialListEditor.render("produto-simples", materiaisSimplesEdicao, {
            titulo: "Materiais e cores da impressão",
            descricao: "Uma única impressão pode combinar uma ou várias cores, com ou sem AMS.",
            pesoInformado: Number(produtoEditando?.peso) || 0,
            onChange: (materiais, peso) => { materiaisSimplesEdicao = materiais; atualizarResumoReceitaSimples(peso); atualizarResumoAutomaticoProduto(); }
        });
        ["tempoSimplesHoras", "tempoSimplesMinutos"].forEach(id => document.getElementById(id)?.addEventListener("input", () => { capturarTempoSimplesProduto(); atualizarResumoReceitaSimples(MaterialListEditor.calcularPesoTotalMateriais("produto-simples")); atualizarResumoAutomaticoProduto(); }));
        atualizarResumoReceitaSimples(MaterialListEditor.calcularPesoTotalMateriais(materiaisSimplesEdicao));
        atualizarResumoAutomaticoProduto();
        lucide.createIcons(); return;
    }
    const impressoras = Storage.listarImpressoras().filter(i => i.ativa !== false);
    el.innerHTML = `<div class="recipeToolbar"><strong>${operacoesModeloEdicao.length} operação(ões)</strong><button class="btnSecondary" type="button" onclick="novaOperacaoModeloProduto()"><i data-lucide="plus"></i> Adicionar operação</button></div>${operacoesModeloEdicao.length ? `<div class="recipeOperations">${operacoesModeloEdicao.map((op,index)=>`<article class="recipeOperation" data-recipe-index="${index}">
        <header><span>${index + 1}</span><input data-field="nome" value="${escaparProduto(op.nome)}" placeholder="Nome da operação"><div><button type="button" onclick="moverOperacaoModeloProduto(${index},-1)" ${index===0?"disabled":""}><i data-lucide="arrow-up"></i></button><button type="button" onclick="moverOperacaoModeloProduto(${index},1)" ${index===operacoesModeloEdicao.length-1?"disabled":""}><i data-lucide="arrow-down"></i></button><button type="button" onclick="duplicarOperacaoModeloProduto(${index})"><i data-lucide="copy"></i></button><button type="button" class="danger" onclick="removerOperacaoModeloProduto(${index})"><i data-lucide="trash-2"></i></button></div></header>
        <div class="erpFormGrid recipeFields"><label class="inputGroup"><span>Tipo</span><select data-field="tipo" onchange="alternarTipoOperacaoModeloProduto(${index},this.value)">${Object.entries(Producao.TIPOS).map(([v,l])=>`<option value="${v}" ${op.tipo===v?"selected":""}>${l}</option>`).join("")}</select></label><label class="inputGroup"><span>Qtd. por produto</span><input data-field="quantidadePorProduto" type="number" min="1" value="${op.quantidadePorProduto}"></label><label class="inputGroup"><span>Horas</span><input data-field="tempoHoras" type="number" min="0" value="${op.tempoHoras}"></label><label class="inputGroup"><span>Minutos</span><input data-field="tempoMinutos" type="number" min="0" max="59" value="${op.tempoMinutos}"></label><label class="inputGroup"><span>Peso calculado (g)</span><input data-field="pesoTotalGramas" type="number" readonly value="${op.pesoTotalGramas}"></label><label class="inputGroup"><span>Impressora preferencial</span><select data-field="impressoraPreferencialId"><option value="">Qualquer impressora</option>${impressoras.map(i=>`<option value="${i.id}" ${String(op.impressoraPreferencialId)===String(i.id)?"selected":""}>${escaparProduto(i.nome)}</option>`).join("")}</select></label>
        <label class="inputGroup erpFull"><span>Dependências</span><select data-field="dependencias" multiple size="${Math.min(4,Math.max(2,operacoesModeloEdicao.length-1))}">${operacoesModeloEdicao.filter((_,i)=>i!==index).map(dep=>`<option value="${dep.id}" ${(op.dependencias||[]).map(String).includes(String(dep.id))?"selected":""}>${escaparProduto(dep.nome)}</option>`).join("")}</select><small>Use Ctrl/Cmd para selecionar mais de uma.</small></label><div class="erpFull">${op.tipo === "impressao" ? `<div id="material-editor-operacao-${index}"></div>` : `<div class="recipeSimpleHint"><i data-lucide="package-open"></i><span>Operações de ${escaparProduto(Producao.TIPOS[op.tipo] || op.tipo)} não exigem filamento.</span></div>`}</div><label class="inputGroup erpFull"><span>Observações</span><textarea data-field="observacoes" rows="2">${escaparProduto(op.observacoes)}</textarea></label></div>
        <div class="recipeChecks"><label><input data-field="podeExecutarEmParalelo" type="checkbox" ${op.podeExecutarEmParalelo?"checked":""}> Pode executar em paralelo</label><label><input data-field="exigeMontagemAnterior" type="checkbox" ${op.exigeMontagemAnterior?"checked":""}> Exige montagem anterior</label></div>
    </article>`).join("")}</div>` : `<div class="erpEmpty compact"><strong>Nenhuma operação configurada</strong><p>Adicione impressão, montagem, acabamento ou embalagem.</p><button class="btn" type="button" onclick="novaOperacaoModeloProduto()">Adicionar primeira operação</button></div>`}`;
    operacoesModeloEdicao.forEach((op,index) => {
        if (op.tipo !== "impressao") return;
        MaterialListEditor.render(`operacao-${index}`, op.materiais || [], {
            titulo: `Materiais — ${op.nome}`,
            descricao: "Cada operação de impressão possui sua própria combinação de filamentos.",
            pesoInformado: Number(op.pesoInformadoAnterior ?? op.pesoTotalGramas) || 0,
            onChange: (materiais, peso) => { if (operacoesModeloEdicao[index]) { operacoesModeloEdicao[index].materiais = materiais; operacoesModeloEdicao[index].pesoTotalGramas = peso; const campo = document.querySelector(`[data-recipe-index="${index}"] [data-field="pesoTotalGramas"]`); if (campo) campo.value = peso; atualizarResumoAutomaticoProduto(); } }
        });
    });
    el.querySelectorAll("[data-recipe-index] input, [data-recipe-index] select, [data-recipe-index] textarea").forEach(campo => {
        if (campo.dataset.field === "tipo") return;
        const atualizar = () => { capturarOperacoesModeloFormulario(); atualizarResumoAutomaticoProduto(); };
        campo.addEventListener("input", atualizar);
        campo.addEventListener("change", atualizar);
    });
    atualizarResumoAutomaticoProduto();
    lucide.createIcons();
}

function atualizarResumoReceitaSimples(peso) {
    const el = document.getElementById("resumoReceitaSimples"); if (!el) return;
    const materiais = document.getElementById("material-editor-produto-simples") ? MaterialListEditor.obter("produto-simples") : materiaisSimplesEdicao;
    const cores = valoresUnicosProduto(materiais, "cor").length;
    const materiaisDistintos = valoresUnicosProduto(materiais, "material").length;
    el.innerHTML = `<div><span>Tempo total</span><strong>${escaparProduto(formatarTempoProduto(tempoSimplesMinutosEdicao))}</strong></div><div><span>Peso total</span><strong>${formatarNumeroProduto(peso)} g</strong></div><div><span>Materiais</span><strong>${materiaisDistintos}</strong></div><div><span>Estrutura</span><strong>1 operação · ${cores} ${cores === 1 ? "cor" : "cores"}</strong></div>`;
}

function capturarTempoSimplesProduto() {
    const horas = Math.max(0, Number(document.getElementById("tempoSimplesHoras")?.value) || 0);
    const minutos = Math.min(59, Math.max(0, Number(document.getElementById("tempoSimplesMinutos")?.value) || 0));
    tempoSimplesMinutosEdicao = Math.round((horas * 60) + minutos);
    return tempoSimplesMinutosEdicao;
}

function capturarOperacoesModeloFormulario() {
    document.querySelectorAll("[data-recipe-index]").forEach(card => {
        const index = Number(card.dataset.recipeIndex); const anterior = operacoesModeloEdicao[index]; if (!anterior) return;
        const valor = campo => card.querySelector(`[data-field="${campo}"]`);
        const tipo = valor("tipo")?.value || anterior.tipo;
        const materiais = tipo === "impressao" ? MaterialListEditor.obter(`operacao-${index}`) : [];
        const pesoTotal = tipo === "impressao" ? MaterialListEditor.calcularPesoTotalMateriais(materiais) : Math.max(0, Number(valor("pesoTotalGramas")?.value) || 0);
        operacoesModeloEdicao[index] = Producao.normalizarOperacaoModelo({ ...anterior, nome: valor("nome")?.value.trim(), tipo, quantidadePorProduto: valor("quantidadePorProduto")?.value, tempoHoras: valor("tempoHoras")?.value, tempoMinutos: valor("tempoMinutos")?.value, pesoTotalGramas: pesoTotal, impressoraPreferencialId: valor("impressoraPreferencialId")?.value, dependencias: [...(valor("dependencias")?.selectedOptions || [])].map(op=>op.value), materiais, observacoes: valor("observacoes")?.value.trim(), podeExecutarEmParalelo: Boolean(valor("podeExecutarEmParalelo")?.checked), exigeMontagemAnterior: Boolean(valor("exigeMontagemAnterior")?.checked), ordem:index }, index);
    });
    return operacoesModeloEdicao;
}

function calcularResumoTecnicoProduto() {
    if (tipoProducaoEdicao === "simples") {
        capturarTempoSimplesProduto();
        if (document.getElementById("material-editor-produto-simples")) materiaisSimplesEdicao = MaterialListEditor.obter("produto-simples");
    } else {
        capturarOperacoesModeloFormulario();
    }
    const operacoes = tipoProducaoEdicao === "simples"
        ? [{ tipo: "impressao", quantidadePorProduto: 1, tempoHoras: Math.floor(tempoSimplesMinutosEdicao / 60), tempoMinutos: tempoSimplesMinutosEdicao % 60, materiais: materiaisSimplesEdicao }]
        : operacoesModeloEdicao;
    const materiaisExpandidos = [];
    let pesoTotal = 0;
    let custoMateriais = 0;
    let tempoTotalMinutos = 0;
    operacoes.forEach(operacao => {
        const quantidade = Math.max(1, Number(operacao.quantidadePorProduto) || 1);
        tempoTotalMinutos += ((Math.max(0, Number(operacao.tempoHoras) || 0) * 60) + Math.min(59, Math.max(0, Number(operacao.tempoMinutos) || 0))) * quantidade;
        if (operacao.tipo !== "impressao") return;
        const materiais = (operacao.materiais || []).map(MaterialListEditor.normalizar);
        pesoTotal += MaterialListEditor.calcularPesoTotalMateriais(materiais) * quantidade;
        custoMateriais += MaterialListEditor.calcularCustoMateriais(materiais, Storage.listarFilamentos().filter(item => item.ativo !== false)) * quantidade;
        for (let repeticao = 0; repeticao < quantidade; repeticao += 1) materiaisExpandidos.push(...materiais);
    });
    const config = Storage.carregarConfigCustos();
    const custoHora = Number(config.custoEnergiaHora || 0) + Number(config.custoDepreciacaoHora || 0) + (config.cobrarMaoDeObraPorPadrao ? Number(config.valorMaoDeObraHora || 0) : 0);
    const perda = Math.max(0, Number(config.perdaPercentual || 0)) / 100;
    const custoEstimado = (custoMateriais * (1 + perda)) + ((tempoTotalMinutos / 60) * custoHora);
    const preco = Math.max(0, Number(document.getElementById("preco")?.value) || 0);
    const lucro = preco - custoEstimado;
    const margem = preco > 0 ? (lucro / preco) * 100 : 0;
    const cores = valoresUnicosProduto(materiaisExpandidos, "cor");
    const materiais = valoresUnicosProduto(materiaisExpandidos, "material");
    return { operacoes, pesoTotal, tempoTotalMinutos, custoEstimado, lucro, margem, quantidadeCores: cores.length, quantidadeMateriais: materiais.length, ams: cores.length > 4 ? "Multicolor avançado" : cores.length > 1 ? "Compatível com AMS" : "Uma cor", corPredominante: cores[0] || "" };
}

function atualizarResumoAutomaticoProduto() {
    const el = document.getElementById("resumoAutomaticoProduto");
    if (!el) return;
    const resumo = calcularResumoTecnicoProduto();
    const nome = document.getElementById("nomeProduto")?.value.trim() || "Produto sem nome";
    const preco = Math.max(0, Number(document.getElementById("preco")?.value) || 0);
    const favorito = Boolean(document.getElementById("favorito")?.checked);
    el.innerHTML = `<div class="productSummaryHero"><span>Produto</span><strong>${escaparProduto(nome)}</strong><small>${favorito ? "★★★★★ Favorito" : "Produto regular"}</small></div><div><span>Preço de venda</span><strong>${Utils.moeda(preco)}</strong></div><div><span>Custo estimado</span><strong>${Utils.moeda(resumo.custoEstimado)}</strong></div><div><span>Lucro estimado</span><strong class="${resumo.lucro < 0 ? "negative" : "positive"}">${Utils.moeda(resumo.lucro)}</strong></div><div><span>Margem</span><strong>${formatarNumeroProduto(resumo.margem)}%</strong></div><div><span>Peso total</span><strong>${formatarNumeroProduto(resumo.pesoTotal)} g</strong></div><div><span>Tempo total</span><strong>${escaparProduto(formatarTempoProduto(resumo.tempoTotalMinutos))}</strong></div><div><span>Operações</span><strong>${resumo.operacoes.length}</strong></div><div><span>Cores / materiais</span><strong>${resumo.quantidadeCores} / ${resumo.quantidadeMateriais}</strong></div><div><span>AMS</span><strong>${escaparProduto(resumo.ams)}</strong></div>`;
}

function salvarProduto() {
    if (salvandoProduto) return;
    limparErrosProduto();
    const botao = document.getElementById("salvarProdutoButton");
    const textoOriginal = botao?.querySelector("span")?.textContent || "Salvar";
    try {
        salvandoProduto = true;
        if (botao) { botao.disabled = true; botao.setAttribute("aria-busy", "true"); if (botao.querySelector("span")) botao.querySelector("span").textContent = "Salvando..."; }
        const nome = document.getElementById("nomeProduto")?.value.trim() || "";
        const codigoInformado = document.getElementById("codigoProduto")?.value.trim() || "";
        const categoria = document.getElementById("categoria")?.value || "";
        const colecaoId = document.getElementById("colecaoProdutoSelect")?.value || "";
        const precoTexto = document.getElementById("preco")?.value ?? "";
        if (!nome) throw criarErroProduto("Informe o nome do produto.", "nomeProduto");
        if (!categoria) throw criarErroProduto("Selecione a categoria do produto.", "categoria");
        if (!colecaoId) throw criarErroProduto("Selecione a coleção do produto.", "colecaoProdutoSelect");
        if (precoTexto === "") throw criarErroProduto("Informe o preço de venda do produto.", "preco");
        const preco = Number(precoTexto);
        if (!Number.isFinite(preco) || preco < 0) throw criarErroProduto("O preço de venda deve ser um valor válido e não negativo.", "preco");
        if (tipoProducaoEdicao === "simples") {
            capturarTempoSimplesProduto();
            if (document.getElementById("material-editor-produto-simples")) materiaisSimplesEdicao = MaterialListEditor.obter("produto-simples");
        } else {
            capturarOperacoesModeloFormulario();
            if (!operacoesModeloEdicao.length) throw criarErroProduto("Adicione pelo menos uma operação à receita composta.", "receitaProdutoSection");
            if (operacoesModeloEdicao.some(op => !String(op.nome || "").trim())) throw criarErroProduto("Informe o nome de todas as operações da receita.", "receitaProdutoSection");
        }
        const operacoesImpressao = tipoProducaoEdicao === "simples" ? [{ materiais: materiaisSimplesEdicao }] : operacoesModeloEdicao.filter(op => op.tipo === "impressao");
        for (const operacao of operacoesImpressao) {
            const validacao = MaterialListEditor.validarMateriais(operacao.materiais);
            if (!validacao.valido) throw criarErroProduto(validacao.mensagem, "receitaProdutoSection");
            operacao.materiais = validacao.materiais;
            operacao.pesoTotalGramas = validacao.pesoTotal;
        }
        const resumo = calcularResumoTecnicoProduto();
        const agora = new Date().toISOString();
        const produto = {
            ...produtoEditando,
            id: produtoEditando?.id || Utils.gerarId(),
            codigo: codigoInformado || produtoEditando?.codigo || Utils.gerarCodigo(categoria),
            nome,
            categoria,
            colecaoId,
            preco,
            descricao: document.getElementById("descricaoProduto")?.value.trim() || "",
            custo: Number(resumo.custoEstimado.toFixed(4)),
            peso: Number(resumo.pesoTotal.toFixed(2)),
            tempo: formatarTempoProduto(resumo.tempoTotalMinutos),
            cor: resumo.corPredominante,
            favorito: Boolean(document.getElementById("favorito")?.checked),
            tipoProducao: tipoProducaoEdicao,
            materiais: tipoProducaoEdicao === "simples" ? materiaisSimplesEdicao.map(MaterialListEditor.normalizar) : [],
            operacoesModelo: tipoProducaoEdicao === "composta" ? operacoesModeloEdicao.map((op, index) => ({ ...op, ordem: index, pesoInformadoAnterior: op.pesoTotalGramas })) : [],
            resumoProducao: { pesoTotal: resumo.pesoTotal, tempoTotalMinutos: resumo.tempoTotalMinutos, quantidadeCores: resumo.quantidadeCores, quantidadeMateriais: resumo.quantidadeMateriais, compatibilidadeAms: resumo.ams, custoEstimado: Number(resumo.custoEstimado.toFixed(4)) },
            ativo: produtoEditando?.ativo !== false,
            criadoEm: produtoEditando?.criadoEm || Utils.hoje(),
            atualizadoEm: agora
        };
        const eraEdicao = Boolean(produtoEditando?.id);
        Storage.salvarProduto(produto);
        const salvo = Storage.buscarProdutoPorId(produto.id);
        if (!salvo) throw new Error("O produto não foi confirmado no armazenamento local.");
        produtoEditando = null;
        Modal.fechar();
        if (document.getElementById("listaProdutos")) listarProdutos();
        else if (document.querySelector(".productCollectionsGrid")) renderTelaProdutos();
        Toast.show(eraEdicao ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.", "success");
    } catch (erro) {
        console.error("[PrimeDocs] Falha ao salvar produto:", erro);
        if (erro?.campoId) marcarErroProduto(erro.campoId, erro.message);
        Toast.show(erro?.message || "Não foi possível salvar o produto.", "error");
    } finally {
        salvandoProduto = false;
        if (botao?.isConnected) { botao.disabled = false; botao.removeAttribute("aria-busy"); if (botao.querySelector("span")) botao.querySelector("span").textContent = textoOriginal; }
    }
}

function criarErroProduto(mensagem, campoId) { const erro = new Error(mensagem); erro.campoId = campoId; return erro; }
function limparErrosProduto() { document.querySelectorAll("#modalRoot .isInvalid").forEach(el => el.classList.remove("isInvalid")); document.querySelectorAll("#modalRoot [aria-invalid='true']").forEach(el => el.removeAttribute("aria-invalid")); document.querySelectorAll("#modalRoot .fieldErrorMessage").forEach(el => el.remove()); }
function marcarErroProduto(campoId, mensagem) { const campo = document.getElementById(campoId); if (!campo) return; const grupo = campo.classList?.contains("productFormSection") ? campo : campo.closest?.(".inputGroup") || campo; grupo.classList.add("isInvalid"); campo.setAttribute?.("aria-invalid", "true"); const aviso = document.createElement("small"); aviso.className = "fieldErrorMessage"; aviso.textContent = mensagem; grupo.appendChild(aviso); campo.scrollIntoView?.({ behavior: "smooth", block: "center" }); if (campo.matches?.("input, select, textarea")) campo.focus?.(); }
function minutosDoTempoProduto(valor) { if (Number.isFinite(Number(valor)) && String(valor).trim() !== "") return Math.max(0, Math.round(Number(valor) * 60)); const texto = String(valor || "").toLowerCase(); return Math.max(0, Math.round((Number(texto.match(/([\d.,]+)\s*h/)?.[1]?.replace(",", ".") || 0) * 60) + Number(texto.match(/([\d.,]+)\s*m/)?.[1]?.replace(",", ".") || 0))); }
function formatarTempoProduto(totalMinutos) { const total = Math.max(0, Math.round(Number(totalMinutos) || 0)); const horas = Math.floor(total / 60); const minutos = total % 60; if (!horas) return `${minutos} min`; if (!minutos) return `${horas}h`; return `${horas}h${String(minutos).padStart(2, "0")}`; }
function valoresUnicosProduto(lista, campo) { const mapa = new Map(); (lista || []).forEach(item => { const valor = String(item?.[campo] || "").trim(); const chave = valor.toLocaleLowerCase("pt-BR"); if (valor && !mapa.has(chave)) mapa.set(chave, valor); }); return [...mapa.values()]; }
function formatarNumeroProduto(valor) { return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }

function escaparProduto(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
