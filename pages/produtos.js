let produtoEditando = null;
let tipoProducaoEdicao = "simples";
let operacoesModeloEdicao = [];

function renderProdutos() {
    Producao.migrarDados();
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
    tipoProducaoEdicao = produtoEditando?.tipoProducao === "composta" ? "composta" : "simples";
    operacoesModeloEdicao = (produtoEditando?.operacoesModelo || []).map((op, index) => Producao.normalizarOperacaoModelo(op, index));
    Modal.abrir("Editar Produto", montarFormularioProduto(produtoEditando));
    renderEditorReceitaProduto();
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

        <section class="productionRecipeEditor">
            <div class="recipeHeader"><div><span>RECEITA DE PRODUÇÃO</span><h3>Como este produto é fabricado?</h3><p>Produtos simples usam os campos de tempo, peso e cor acima.</p></div></div>
            <label class="inputGroup"><span>Tipo de produção</span><select id="tipoProducao" onchange="alterarTipoProducaoProduto(this.value)"><option value="simples" ${tipoProducaoEdicao === "simples" ? "selected" : ""}>Simples — uma impressão</option><option value="composta" ${tipoProducaoEdicao === "composta" ? "selected" : ""}>Composta — várias operações</option></select></label>
            <div id="editorOperacoesProduto"></div>
        </section>

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
    tipoProducaoEdicao = "simples";
    operacoesModeloEdicao = [];
    Modal.abrir("Novo Produto", montarFormularioProduto());
    renderEditorReceitaProduto();
}

function alterarTipoProducaoProduto(tipo) {
    capturarOperacoesModeloFormulario();
    tipoProducaoEdicao = tipo === "composta" ? "composta" : "simples";
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
    if (tipoProducaoEdicao !== "composta") { el.innerHTML = `<div class="recipeSimpleHint"><i data-lucide="sparkles"></i><span>A operação de impressão será criada automaticamente ao iniciar a produção.</span></div>`; lucide.createIcons(); return; }
    const impressoras = Storage.listarImpressoras().filter(i => i.ativa !== false);
    el.innerHTML = `<div class="recipeToolbar"><strong>${operacoesModeloEdicao.length} operação(ões)</strong><button class="btnSecondary" type="button" onclick="novaOperacaoModeloProduto()"><i data-lucide="plus"></i> Adicionar operação</button></div>${operacoesModeloEdicao.length ? `<div class="recipeOperations">${operacoesModeloEdicao.map((op,index)=>`<article class="recipeOperation" data-recipe-index="${index}">
        <header><span>${index + 1}</span><input data-field="nome" value="${escaparProduto(op.nome)}" placeholder="Nome da operação"><div><button type="button" onclick="moverOperacaoModeloProduto(${index},-1)" ${index===0?"disabled":""}><i data-lucide="arrow-up"></i></button><button type="button" onclick="moverOperacaoModeloProduto(${index},1)" ${index===operacoesModeloEdicao.length-1?"disabled":""}><i data-lucide="arrow-down"></i></button><button type="button" onclick="duplicarOperacaoModeloProduto(${index})"><i data-lucide="copy"></i></button><button type="button" class="danger" onclick="removerOperacaoModeloProduto(${index})"><i data-lucide="trash-2"></i></button></div></header>
        <div class="erpFormGrid recipeFields"><label class="inputGroup"><span>Tipo</span><select data-field="tipo">${Object.entries(Producao.TIPOS).map(([v,l])=>`<option value="${v}" ${op.tipo===v?"selected":""}>${l}</option>`).join("")}</select></label><label class="inputGroup"><span>Qtd. por produto</span><input data-field="quantidadePorProduto" type="number" min="1" value="${op.quantidadePorProduto}"></label><label class="inputGroup"><span>Horas</span><input data-field="tempoHoras" type="number" min="0" value="${op.tempoHoras}"></label><label class="inputGroup"><span>Minutos</span><input data-field="tempoMinutos" type="number" min="0" max="59" value="${op.tempoMinutos}"></label><label class="inputGroup"><span>Peso total (g)</span><input data-field="pesoTotalGramas" type="number" min="0" step="0.1" value="${op.pesoTotalGramas}"></label><label class="inputGroup"><span>Impressora preferencial</span><select data-field="impressoraPreferencialId"><option value="">Qualquer impressora</option>${impressoras.map(i=>`<option value="${i.id}" ${String(op.impressoraPreferencialId)===String(i.id)?"selected":""}>${escaparProduto(i.nome)}</option>`).join("")}</select></label>
        <label class="inputGroup erpFull"><span>Dependências</span><select data-field="dependencias" multiple size="${Math.min(4,Math.max(2,operacoesModeloEdicao.length-1))}">${operacoesModeloEdicao.filter((_,i)=>i!==index).map(dep=>`<option value="${dep.id}" ${(op.dependencias||[]).map(String).includes(String(dep.id))?"selected":""}>${escaparProduto(dep.nome)}</option>`).join("")}</select><small>Use Ctrl/Cmd para selecionar mais de uma.</small></label><label class="inputGroup erpFull"><span>Materiais — um por linha: material | cor | peso (g) | obrigatório</span><textarea data-field="materiais" rows="3" placeholder="PLA | Preto | 12 | sim">${(op.materiais||[]).map(m=>`${m.material} | ${m.cor} | ${m.pesoGramas} | ${m.obrigatorio!==false?"sim":"não"}`).join("\n")}</textarea></label><label class="inputGroup erpFull"><span>Observações</span><textarea data-field="observacoes" rows="2">${escaparProduto(op.observacoes)}</textarea></label></div>
        <div class="recipeChecks"><label><input data-field="podeExecutarEmParalelo" type="checkbox" ${op.podeExecutarEmParalelo?"checked":""}> Pode executar em paralelo</label><label><input data-field="exigeMontagemAnterior" type="checkbox" ${op.exigeMontagemAnterior?"checked":""}> Exige montagem anterior</label></div>
    </article>`).join("")}</div>` : `<div class="erpEmpty compact"><strong>Nenhuma operação configurada</strong><p>Adicione impressão, montagem, acabamento ou embalagem.</p><button class="btn" type="button" onclick="novaOperacaoModeloProduto()">Adicionar primeira operação</button></div>`}`;
    lucide.createIcons();
}

function capturarOperacoesModeloFormulario() {
    document.querySelectorAll("[data-recipe-index]").forEach(card => {
        const index = Number(card.dataset.recipeIndex); const anterior = operacoesModeloEdicao[index]; if (!anterior) return;
        const valor = campo => card.querySelector(`[data-field="${campo}"]`);
        const materiais = String(valor("materiais")?.value || "").split("\n").map(linha => { const [material,cor,peso,obrigatorio] = linha.split("|").map(v=>v.trim()); return material ? { material, cor: cor || "", pesoGramas: Math.max(0,Number(peso)||0), obrigatorio: !["não","nao","false","0"].includes(String(obrigatorio||"sim").toLowerCase()) } : null; }).filter(Boolean);
        operacoesModeloEdicao[index] = Producao.normalizarOperacaoModelo({ ...anterior, nome: valor("nome")?.value.trim(), tipo: valor("tipo")?.value, quantidadePorProduto: valor("quantidadePorProduto")?.value, tempoHoras: valor("tempoHoras")?.value, tempoMinutos: valor("tempoMinutos")?.value, pesoTotalGramas: valor("pesoTotalGramas")?.value, impressoraPreferencialId: valor("impressoraPreferencialId")?.value, dependencias: [...(valor("dependencias")?.selectedOptions || [])].map(op=>op.value), materiais, observacoes: valor("observacoes")?.value.trim(), podeExecutarEmParalelo: Boolean(valor("podeExecutarEmParalelo")?.checked), exigeMontagemAnterior: Boolean(valor("exigeMontagemAnterior")?.checked), ordem:index }, index);
    });
    return operacoesModeloEdicao;
}

function salvarProduto() {
    const nome = document.getElementById("nomeProduto").value.trim();
    const categoria = document.getElementById("categoria").value;
    const preco = document.getElementById("preco").value;
    const custo = document.getElementById("custo").value;

    if (!nome) return Toast.show("Informe o nome do produto.");
    if (preco === "") return Toast.show("Informe o preço.");
    if (custo === "") return Toast.show("Informe o custo.");
    capturarOperacoesModeloFormulario();
    if (tipoProducaoEdicao === "composta" && !operacoesModeloEdicao.length) return Toast.show("Adicione pelo menos uma operação à receita composta.");
    if (operacoesModeloEdicao.some(op => !op.nome)) return Toast.show("Informe o nome de todas as operações.");

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
        tipoProducao: tipoProducaoEdicao,
        operacoesModelo: tipoProducaoEdicao === "composta" ? operacoesModeloEdicao.map((op,index)=>({ ...op, ordem:index })) : [],
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
