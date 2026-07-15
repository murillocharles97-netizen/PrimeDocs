let itensConsignado = [];
let estoqueAnteriorConsignado = [];
let lojaConsignadoAtual = null;
let movimentacaoConsignadoAtualId = "";
let consignadoRegistradoNestaTela = false;

function renderConsignado(modo = "hub") {
    if (["novo", "nova", "consignacao"].includes(modo)) {
        renderNovoConsignado();
        return;
    }
    if (modo === "conferencia") {
        renderConferencia(true);
        return;
    }
    renderHubConsignado();
}

function abrirConsignado(modo) {
    renderConsignado(modo);
    atualizarNavegacaoAtivaPrimeDocs?.("consignado");
    atualizarCabecalhoPrimeDocs?.();
}

function formatarDataConsignadoHub(valor) {
    if (!valor) return "Nenhuma";
    if (typeof formatarDataBR === "function") return formatarDataBR(valor);
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? String(valor).slice(0, 10) : data.toLocaleDateString("pt-BR");
}

function renderHubConsignado() {
    const estoques = Storage.listarEstoquesLojas().filter(estoque =>
        (estoque.itens || []).some(item => Number(item.quantidade || 0) > 0)
    );
    const valorConsignado = estoques.reduce((total, estoque) => total +
        (estoque.itens || []).reduce((soma, item) => soma +
            Number(item.quantidade || 0) * Number(item.preco || 0), 0), 0);
    const conferencias = Storage.listarConferencias().slice().sort((a, b) =>
        new Date(b.criadoEm || b.data || 0) - new Date(a.criadoEm || a.data || 0)
    );
    const lojasAguardando = typeof calcularLojasParaVisitar === "function"
        ? calcularLojasParaVisitar().length
        : 0;

    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i>Voltar</button>
        ${Page.titulo("📦 Consignado", "Controle de produtos em lojas parceiras.")}
        <section class="moduleActionGrid consignmentHub">
            <button class="moduleActionCard" type="button" onclick="abrirConsignado('novo')">
                <span><i data-lucide="package-plus"></i></span>
                <strong>Nova consignação ou reposição</strong>
                <small>Envie novos produtos sem duplicar o saldo que já está na loja.</small>
                <i data-lucide="arrow-right"></i>
            </button>
            <button class="moduleActionCard" type="button" onclick="abrirConsignado('conferencia')">
                <span><i data-lucide="clipboard-check"></i></span>
                <strong>Fazer conferência</strong>
                <small>Registre vendas e atualize o que permaneceu na loja.</small>
                <i data-lucide="arrow-right"></i>
            </button>
        </section>
        <section class="consignmentSummaryGrid">
            <article><small>Lojas com estoque</small><strong>${estoques.length}</strong></article>
            <article><small>Valor em consignado</small><strong>${Utils.moeda(valorConsignado)}</strong></article>
            <article><small>Aguardando conferência</small><strong>${lojasAguardando}</strong></article>
            <article><small>Última conferência</small><strong>${conferencias[0] ? formatarDataConsignadoHub(conferencias[0].data || conferencias[0].criadoEm) : "Nenhuma"}</strong></article>
        </section>`;
    lucide.createIcons();
}

function renderNovoConsignado() {
    itensConsignado = [];
    estoqueAnteriorConsignado = [];
    lojaConsignadoAtual = null;
    movimentacaoConsignadoAtualId = Utils.gerarId();
    consignadoRegistradoNestaTela = false;

    const lojas = Storage.listarLojas()
        .filter(loja => loja.ativo !== false)
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
    const opcoes = lojas.map(loja =>
        `<option value="${escaparHtmlConsignado(loja.id)}">${escaparHtmlConsignado(loja.nome)}</option>`
    ).join("");

    app.innerHTML = `
        <button class="back" onclick="abrirConsignado('hub')"><i data-lucide="arrow-left"></i>Voltar para Consignado</button>
        <div id="cabecalhoFluxoConsignado">
            ${Page.titulo("📦 Nova consignação", "Selecione a loja e informe somente os produtos deixados nesta visita.")}
        </div>
        <div class="cardForm consignmentMainFields">
            <label class="inputGroup">
                <span>Loja</span>
                <select id="loja" onchange="carregarEstoqueAtualDaLoja(this.value)">
                    <option value="">Selecione uma loja</option>${opcoes}
                </select>
            </label>
            ${lojas.length === 0 ? '<p class="mb20">Nenhuma loja ativa cadastrada.</p>' : ""}
            ${Input.text("Responsável", "responsavel", "Nome do responsável")}
            <label class="inputGroup"><span>Data</span><input id="dataConsignado" type="date" value="${Utils.hoje()}"></label>
            <label class="inputGroup consignmentNotes"><span>Observações</span><textarea id="observacoesConsignado" placeholder="Observações da visita..."></textarea></label>
        </div>

        <div class="consignmentFlow">
            <details class="consignmentSection consignmentPrevious" open>
                <summary><span><i data-lucide="archive"></i>Estoque atual na loja</span><i data-lucide="chevron-down"></i></summary>
                <p class="consignmentHint">Este é o estoque registrado após a última movimentação da loja.</p>
                <div id="estoqueAnteriorConsignado"></div>
            </details>

            <section class="consignmentSection">
                <header class="consignmentSectionHeader">
                    <div><span class="eyebrow">MOVIMENTAÇÃO</span><h3>Reposição de hoje</h3><p>Informe somente o que está deixando agora.</p></div>
                    <button class="btn" type="button" onclick="abrirModalSelecionarProduto()"><i data-lucide="package-plus"></i>Adicionar produto à reposição</button>
                </header>
                <div id="listaProdutosConsignado"></div>
            </section>

            <section class="consignmentSection consignmentFinal">
                <header class="consignmentSectionHeader">
                    <div><span class="eyebrow">SALDO CONSOLIDADO</span><h3>Estoque final atualizado</h3><p>Estoque anterior mais a reposição desta visita.</p></div>
                </header>
                <div id="estoqueFinalConsignado"></div>
            </section>
        </div>

        <div class="consignmentFlowAction">
            <button id="acaoConsignadoButton" class="btn" type="button" onclick="gerarPDFConsignado()"><i data-lucide="file-down"></i>Gerar consignação</button>
        </div>`;

    renderListaProdutosConsignado();
    renderEstoqueAnteriorConsignado();
    renderEstoqueFinalConsignado();
    lucide.createIcons();
}

function carregarEstoqueAtualDaLoja(lojaId) {
    const loja = Storage.buscarLojaPorId(lojaId);
    const trocouLoja = lojaConsignadoAtual
        && String(lojaConsignadoAtual.id) !== String(lojaId)
        && itensConsignado.length > 0;

    lojaConsignadoAtual = loja || null;
    estoqueAnteriorConsignado = normalizarItensEstoqueConsignado(
        loja ? Storage.buscarEstoqueLoja(loja.id)?.itens : []
    );
    itensConsignado = [];
    movimentacaoConsignadoAtualId = Utils.gerarId();
    consignadoRegistradoNestaTela = false;

    const responsavel = document.getElementById("responsavel");
    if (responsavel) responsavel.value = loja?.responsavel || "";
    if (trocouLoja) Toast.show("A reposição foi limpa porque a loja foi alterada.");

    atualizarCabecalhoFluxoConsignado();
    renderListaProdutosConsignado();
    renderEstoqueAnteriorConsignado();
    renderEstoqueFinalConsignado();
}

function preencherResponsavelLojaConsignado() {
    carregarEstoqueAtualDaLoja(document.getElementById("loja")?.value || "");
}

function normalizarItensEstoqueConsignado(itens = []) {
    return (Array.isArray(itens) ? itens : []).map(item => ({
        produtoId: item.produtoId,
        nome: item.nome || item.produtoNome || "Produto sem nome",
        codigo: item.codigo || "",
        categoria: item.categoria || "",
        preco: Number(item.preco ?? item.precoVenda) || 0,
        quantidade: Math.max(0, Number(item.quantidade) || 0)
    })).filter(item => item.quantidade > 0);
}

function atualizarCabecalhoFluxoConsignado() {
    const temEstoque = estoqueAnteriorConsignado.length > 0;
    const cabecalho = document.getElementById("cabecalhoFluxoConsignado");
    const acao = document.getElementById("acaoConsignadoButton");
    if (cabecalho) {
        cabecalho.innerHTML = Page.titulo(
            temEstoque ? "📦 Reposição de consignado" : "📦 Nova consignação",
            temEstoque ? "Adicione somente os produtos deixados nesta visita." : "Esta será a primeira entrega para a loja."
        );
    }
    if (acao) {
        acao.innerHTML = `<i data-lucide="file-down"></i>${temEstoque ? "Salvar reposição e gerar PDF" : "Gerar consignação"}`;
    }
    lucide.createIcons();
}

function renderEstoqueAnteriorConsignado() {
    const container = document.getElementById("estoqueAnteriorConsignado");
    if (!container) return;
    if (!lojaConsignadoAtual) {
        container.innerHTML = '<div class="consignmentEmpty">Selecione uma loja para carregar o estoque atual.</div>';
        return;
    }
    if (estoqueAnteriorConsignado.length === 0) {
        container.innerHTML = '<div class="consignmentEmpty">Esta loja ainda não possui produtos em consignação.</div>';
        return;
    }
    container.innerHTML = `<div class="consignmentStockList">${estoqueAnteriorConsignado.map(item => `
        <article class="consignmentReadOnlyCard">
            <div><strong>${escaparHtmlConsignado(item.nome)}</strong><span>${escaparHtmlConsignado(item.codigo || item.categoria || "Sem código")}</span></div>
            <strong>${item.quantidade}<small> un.</small></strong>
        </article>`).join("")}</div>
        <p class="consignmentCorrectionHint"><i data-lucide="info"></i>Se estiver incorreto, faça uma Conferência ou use “Corrigir estoque” no detalhe da loja.</p>`;
    lucide.createIcons();
}

function mesclarItemReposicaoConsignado(lista, item) {
    const itens = lista.map(registro => ({ ...registro }));
    const existente = itens.find(registro => String(registro.produtoId) === String(item.produtoId));
    if (existente) {
        existente.quantidade = Number(existente.quantidade || 0) + Number(item.quantidade || 1);
        existente.preco = Number(item.preco ?? existente.preco) || 0;
        return { itens, duplicado: true };
    }
    itens.push({ ...item, quantidade: Math.max(1, Number(item.quantidade) || 1) });
    return { itens, duplicado: false };
}

function calcularEstoqueFinalConsignado(estoqueAnterior = estoqueAnteriorConsignado, reposicao = itensConsignado) {
    const mapa = new Map();
    normalizarItensEstoqueConsignado(estoqueAnterior).forEach(item => mapa.set(String(item.produtoId), { ...item }));
    normalizarItensEstoqueConsignado(reposicao).forEach(item => {
        const chave = String(item.produtoId);
        const anterior = mapa.get(chave);
        mapa.set(chave, anterior
            ? { ...anterior, ...item, quantidade: Number(anterior.quantidade || 0) + Number(item.quantidade || 0) }
            : { ...item });
    });
    return [...mapa.values()].filter(item => item.quantidade > 0)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", { sensitivity: "base" }));
}

function renderEstoqueFinalConsignado() {
    const container = document.getElementById("estoqueFinalConsignado");
    if (!container) return;
    const final = calcularEstoqueFinalConsignado();
    if (!lojaConsignadoAtual || final.length === 0) {
        container.innerHTML = '<div class="consignmentEmpty">O estoque final aparecerá aqui automaticamente.</div>';
        return;
    }
    const anteriorMap = new Map(estoqueAnteriorConsignado.map(item => [String(item.produtoId), item]));
    const reposicaoMap = new Map(itensConsignado.map(item => [String(item.produtoId), item]));
    const totalPecas = final.reduce((soma, item) => soma + item.quantidade, 0);
    const totalValor = final.reduce((soma, item) => soma + item.quantidade * item.preco, 0);
    container.innerHTML = `<div class="consignmentFinalList">${final.map(item => {
        const anterior = Number(anteriorMap.get(String(item.produtoId))?.quantidade || 0);
        const adicionado = Number(reposicaoMap.get(String(item.produtoId))?.quantidade || 0);
        return `<article class="consignmentFinalCard">
            <div class="consignmentFinalName"><strong>${escaparHtmlConsignado(item.nome)}</strong><span>${escaparHtmlConsignado(item.codigo || item.categoria || "Sem código")}</span></div>
            <div class="consignmentQuantityMetrics">
                <span><small>Já estava</small><strong>${anterior}</strong></span>
                <span class="isAdded"><small>Reposição</small><strong>+${adicionado}</strong></span>
                <span class="isFinal"><small>Novo total</small><strong>${item.quantidade}</strong></span>
            </div>
        </article>`;
    }).join("")}</div>
    <div class="consignmentSummaryStrip"><span><small>Modelos</small><strong>${final.length}</strong></span><span><small>Total de peças</small><strong>${totalPecas}</strong></span><span><small>Valor final</small><strong>${Utils.moeda(totalValor)}</strong></span></div>`;
}

function renderListaProdutosConsignado() {
    const lista = document.getElementById("listaProdutosConsignado");
    if (!lista) return;
    if (itensConsignado.length === 0) {
        lista.innerHTML = '<div class="consignmentEmpty"><strong>Nenhum produto na reposição</strong><span>Adicione apenas as peças deixadas nesta visita.</span></div>';
        renderEstoqueFinalConsignado();
        return;
    }
    lista.innerHTML = `<div class="consignmentReplenishmentList">${itensConsignado.map(item => `
        <article class="produtoCard consignmentReplenishmentCard">
            <div class="produtoHeader"><div><h3>${escaparHtmlConsignado(item.nome)}</h3><span>${escaparHtmlConsignado(item.codigo || "Sem código")} · ${escaparHtmlConsignado(item.categoria || "Sem categoria")}</span></div>
            <button class="removeBtn" type="button" aria-label="Remover produto" data-acao="remover" data-produto-id="${escaparHtmlConsignado(item.produtoId)}"><i data-lucide="trash-2"></i></button></div>
            <div class="consignmentReplenishmentFooter"><span class="badge primary">+${item.quantidade} nesta visita</span>
                <div class="quantity"><button type="button" aria-label="Diminuir" data-acao="quantidade" data-delta="-1" data-produto-id="${escaparHtmlConsignado(item.produtoId)}">−</button><input type="number" value="${item.quantidade}" min="1" readonly><button type="button" aria-label="Aumentar" data-acao="quantidade" data-delta="1" data-produto-id="${escaparHtmlConsignado(item.produtoId)}">+</button></div>
            </div>
        </article>`).join("")}</div>`;
    lista.querySelectorAll("[data-acao='quantidade']").forEach(botao => botao.addEventListener("click", () => alterarQtdConsignado(botao.dataset.produtoId, Number(botao.dataset.delta))));
    lista.querySelectorAll("[data-acao='remover']").forEach(botao => botao.addEventListener("click", () => removerProdutoConsignado(botao.dataset.produtoId)));
    renderEstoqueFinalConsignado();
    lucide.createIcons();
}

function abrirModalSelecionarProduto() {
    if (!lojaConsignadoAtual) {
        Toast.show("Selecione a loja antes de adicionar produtos.");
        return;
    }
    Modal.abrir("Adicionar à reposição", `${Input.text("Pesquisar", "pesquisaProdutoConsignado", "Nome, código ou categoria")}<div id="produtosDisponiveisConsignado"></div>`);
    const pesquisa = document.getElementById("pesquisaProdutoConsignado");
    pesquisa.addEventListener("input", renderProdutosDisponiveis);
    pesquisa.focus();
    renderProdutosDisponiveis();
}

function renderProdutosDisponiveis() {
    const lista = document.getElementById("produtosDisponiveisConsignado");
    if (!lista) return;
    const pesquisa = (document.getElementById("pesquisaProdutoConsignado")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const produtos = Storage.listarProdutos().filter(produto => produto.ativo !== false)
        .filter(produto => [produto.nome, produto.codigo, produto.categoria].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(pesquisa))
        .sort((a, b) => Boolean(a.favorito) !== Boolean(b.favorito)
            ? (a.favorito ? -1 : 1)
            : String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
    if (!produtos.length) {
        lista.innerHTML = '<div class="consignmentEmpty">Nenhum produto encontrado.</div>';
        return;
    }
    lista.innerHTML = produtos.map(produto => {
        const adicionado = itensConsignado.find(item => String(item.produtoId) === String(produto.id));
        return `<button class="produtoCard produtoDisponivelConsignado" type="button" data-produto-id="${escaparHtmlConsignado(produto.id)}">
            <div class="produtoHeader"><div><h3>${escaparHtmlConsignado(produto.nome)}</h3><span>${escaparHtmlConsignado(produto.codigo || "Sem código")} · ${escaparHtmlConsignado(produto.categoria || "Sem categoria")}</span></div>${produto.favorito ? '<i data-lucide="star" class="isFavorite"></i>' : ""}</div>
            <div class="consignmentAvailableMeta"><strong>${Utils.moeda(Number(produto.preco) || 0)}</strong>${adicionado ? `<span class="badge green">+${adicionado.quantidade} na reposição</span>` : ""}</div>
        </button>`;
    }).join("");
    lista.querySelectorAll(".produtoDisponivelConsignado").forEach(botao => botao.addEventListener("click", () => adicionarProdutoConsignado(botao.dataset.produtoId)));
    lucide.createIcons();
}

function adicionarProdutoConsignado(id) {
    const produto = Storage.listarProdutos().find(item => String(item.id) === String(id));
    if (!produto) {
        Toast.show("Produto não encontrado.");
        return;
    }
    const resultado = mesclarItemReposicaoConsignado(itensConsignado, {
        produtoId: produto.id,
        nome: produto.nome,
        codigo: produto.codigo,
        categoria: produto.categoria,
        preco: Number(produto.preco) || 0,
        quantidade: 1
    });
    itensConsignado = resultado.itens;
    Modal.fechar();
    renderListaProdutosConsignado();
    if (resultado.duplicado) Toast.show("Produto já estava na reposição. A quantidade foi atualizada.");
}

function alterarQtdConsignado(id, delta) {
    const item = itensConsignado.find(produto => String(produto.produtoId) === String(id));
    if (!item) return;
    item.quantidade = Math.max(1, Number(item.quantidade || 0) + delta);
    renderListaProdutosConsignado();
}

function removerProdutoConsignado(id) {
    itensConsignado = itensConsignado.filter(item => String(item.produtoId) !== String(id));
    renderListaProdutosConsignado();
}

function aplicarMovimentacaoEstoqueLoja(movimentacao, loja, responsavel) {
    const estoqueAtual = Storage.buscarEstoqueLoja(loja.id) || {};
    const aplicadas = Array.isArray(estoqueAtual.movimentacoesAplicadas)
        ? estoqueAtual.movimentacoesAplicadas.map(String)
        : [];
    if (aplicadas.includes(String(movimentacao.id))) return false;

    Storage.salvarEstoqueLoja({
        ...estoqueAtual,
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel,
        atualizadoEm: movimentacao.criadoEm,
        ultimaMovimentacaoId: movimentacao.id,
        movimentacoesAplicadas: [...aplicadas, String(movimentacao.id)].slice(-100),
        itens: movimentacao.estoqueFinal.map(item => ({ ...item }))
    });
    return true;
}

function obterUsuarioIdConsignado() {
    return window.PrimeFirebase?.auth?.currentUser?.uid || null;
}

function assinaturaEstoqueConsignado(itens) {
    return normalizarItensEstoqueConsignado(itens)
        .map(item => `${String(item.produtoId)}:${Number(item.quantidade)}`)
        .sort()
        .join("|");
}

function gerarPDFConsignado() {
    const loja = Storage.buscarLojaPorId(document.getElementById("loja")?.value);
    const responsavel = document.getElementById("responsavel")?.value.trim() || "";
    const data = document.getElementById("dataConsignado")?.value || Utils.hoje();
    const observacoes = document.getElementById("observacoesConsignado")?.value.trim() || "";
    if (!loja) {
        Toast.show("Selecione uma loja.");
        return;
    }
    if (!itensConsignado.length) {
        Toast.show("Adicione pelo menos um produto à reposição.");
        return;
    }

    const estoqueMaisRecente = normalizarItensEstoqueConsignado(
        Storage.buscarEstoqueLoja(loja.id)?.itens
    );
    if (assinaturaEstoqueConsignado(estoqueMaisRecente) !== assinaturaEstoqueConsignado(estoqueAnteriorConsignado)) {
        estoqueAnteriorConsignado = estoqueMaisRecente;
        renderEstoqueAnteriorConsignado();
        renderEstoqueFinalConsignado();
        Toast.show("O estoque da loja foi atualizado antes de salvar. O saldo final foi recalculado.");
    }
    const anterior = normalizarItensEstoqueConsignado(estoqueAnteriorConsignado);
    const reposicao = normalizarItensEstoqueConsignado(itensConsignado);
    const final = calcularEstoqueFinalConsignado(anterior, reposicao);
    const tipo = anterior.length ? "reposicao_consignado" : "consignacao_inicial";
    const criadoEm = new Date().toISOString();
    const dadosPDF = { loja: loja.nome, responsavel, data, observacoes, estoqueAnterior: anterior, itensReposicao: reposicao, estoqueFinal: final };

    const pdfGerado = PDF.gerarReposicaoConsignado
        ? PDF.gerarReposicaoConsignado(dadosPDF, Storage.buscarEmpresaPadrao())
        : PDF.gerarConsignado({ ...dadosPDF, itens: reposicao }, Storage.buscarEmpresaPadrao());
    if (!pdfGerado) return;
    if (consignadoRegistradoNestaTela) {
        Toast.show("PDF gerado novamente sem duplicar o estoque.");
        return;
    }

    const movimentacao = {
        id: movimentacaoConsignadoAtualId || Utils.gerarId(),
        tipo,
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel,
        data,
        observacoes,
        estoqueAnterior: anterior.map(item => ({ ...item })),
        itensReposicao: reposicao.map(item => ({ ...item })),
        estoqueFinal: final.map(item => ({ ...item })),
        itens: reposicao.map(item => ({ ...item })),
        criadoEm,
        usuarioId: obterUsuarioIdConsignado()
    };

    Storage.salvarConsignado(movimentacao);
    aplicarMovimentacaoEstoqueLoja(movimentacao, loja, responsavel);
    estoqueAnteriorConsignado = final.map(item => ({ ...item }));
    itensConsignado = [];
    consignadoRegistradoNestaTela = true;
    atualizarCabecalhoFluxoConsignado();
    renderEstoqueAnteriorConsignado();
    renderListaProdutosConsignado();
    Toast.show(tipo === "reposicao_consignado"
        ? "Reposição salva e estoque da loja atualizado!"
        : "Consignado salvo e estoque da loja atualizado!");
}

function escaparHtmlConsignado(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
