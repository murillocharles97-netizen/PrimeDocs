let empresaOrcamentoId = null;
let itensOrcamento = [];
let clienteOrcamentoId = null;

function renderOrcamento() {
    const empresas = Storage.listarEmpresas().filter(empresa => empresa.ativa !== false);
    const padrao = Storage.buscarEmpresaPadrao();

    if (!empresaOrcamentoId || !empresas.some(empresa => String(empresa.id) === String(empresaOrcamentoId))) {
        empresaOrcamentoId = padrao?.id || empresas[0]?.id || "fallback";
    }

    const empresa = obterEmpresaOrcamento();
    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("🧾 Orçamento", "Crie propostas com a identidade e o modelo de cada empresa.")}

        <section class="budgetCard">
            <div class="budgetCompanyHeader">
                <div class="settingsCardIcon"><i data-lucide="building-2"></i></div>
                <div><span>EMPRESA EMISSORA</span><h3>Identidade do orçamento</h3></div>
            </div>
            <label class="inputGroup">
                <span>Empresa</span>
                <select id="orcamentoEmpresa" onchange="alterarEmpresaOrcamento(this.value)">
                    ${empresas.length
                        ? empresas.map(item => `<option value="${escaparHtmlOrcamento(item.id)}" ${String(item.id) === String(empresaOrcamentoId) ? "selected" : ""}>${escaparHtmlOrcamento(item.nome)} — ${rotuloTipoOrcamento(item.tipo)}</option>`).join("")
                        : `<option value="fallback">PrimeDocs / PrimeLine 3D — Impressão 3D</option>`}
                </select>
            </label>
            ${!empresas.length ? `<div class="budgetNotice"><i data-lucide="info"></i><span>Cadastre uma empresa em Configurações para personalizar logo, cor e contatos.</span></div>` : ""}
        </section>

        <section class="budgetCard budgetFormCard">
            <div class="budgetFormTitle">
                <div><span>MODELO</span><h3>${rotuloTipoOrcamento(empresa.tipo)}</h3></div>
                <i data-lucide="${iconeTipoOrcamento(empresa.tipo)}"></i>
            </div>
            <div id="camposOrcamento" class="budgetFormGrid">${renderCamposOrcamento(empresa.tipo)}</div>
            <div class="budgetPrimaryAction">
                ${Button.primary('<i data-lucide="file-down"></i> Gerar PDF do orçamento', "gerarPDFOrcamento()")}
            </div>
        </section>
    `;

    if (empresa.tipo === "impressao3d") renderListaItensOrcamento();
    lucide.createIcons();
}

function obterEmpresaOrcamento() {
    return Storage.buscarEmpresaPorId(empresaOrcamentoId) || {
        id: "fallback",
        nome: "PrimeLine 3D",
        tipo: "impressao3d",
        corPrincipal: "#6D5DFD",
        rodapePDF: "Documento gerado pelo PrimeDocs",
        ativa: true,
        padrao: true
    };
}

function alterarEmpresaOrcamento(id) {
    empresaOrcamentoId = id;
    renderOrcamento();
}

function renderCamposOrcamento(tipo) {
    const clientes = Storage.listarClientes().filter(item => item.ativo !== false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
    const cliente = `<div class="budgetClientPicker"><label class="inputGroup"><span>Cliente *</span><select id="orcamentoClienteId" onchange="clienteOrcamentoId=this.value"><option value="">Selecione um cliente</option>${clientes.map(item=>`<option value="${escaparHtmlOrcamento(item.id)}" ${String(item.id)===String(clienteOrcamentoId)?"selected":""}>${escaparHtmlOrcamento(item.nome)}</option>`).join("")}</select></label><button class="btnSecondary" type="button" onclick="abrirModalCliente(null,'orcamento')"><i data-lucide="user-plus"></i> Cadastrar</button></div>`;
    const data = `<label class="inputGroup"><span>Data</span><input id="orcamentoData" type="date" value="${Utils.hoje()}"></label>`;
    const observacoes = `<label class="inputGroup budgetFullField"><span>Observações gerais</span><textarea id="orcamentoObservacoes" rows="4" placeholder="Condições, prazo e informações adicionais"></textarea></label>`;
    const valorFinal = `<label class="inputGroup"><span>Valor final *</span><input id="orcamentoValorFinal" type="number" min="0" step="0.01" placeholder="0,00"></label>`;

    if (tipo === "transporte") {
        return `${cliente}${data}
            ${Input.text("Origem *", "orcamentoOrigem", "Local de partida")}
            ${Input.text("Destino *", "orcamentoDestino", "Local de chegada")}
            <label class="inputGroup"><span>Tipo de viagem</span><select id="orcamentoTipoViagem"><option value="ida">Ida</option><option value="ida-e-volta">Ida e volta</option></select></label>
            ${valorFinal}${observacoes}`;
    }

    if (tipo === "geral") {
        return `${cliente}${data}
            <label class="inputGroup budgetFullField"><span>Descrição *</span><textarea id="orcamentoDescricao" rows="4" placeholder="Descreva o serviço ou produto"></textarea></label>
            ${valorFinal}${observacoes}`;
    }

    return `${cliente}${data}
        <section class="budgetItemsSection budgetFullField">
            <div class="budgetItemsHeader">
                <div><span>ITENS DO ORÇAMENTO</span><h3>Produtos e valores</h3></div>
                <small>Use o catálogo ou crie um item exclusivo para esta proposta.</small>
            </div>
            <div class="budgetItemActions">
                <button class="btn" type="button" onclick="abrirModalProdutoOrcamento()"><i data-lucide="search"></i> Buscar produto cadastrado</button>
                <button class="btnSecondary" type="button" onclick="adicionarProdutoPersonalizadoOrcamento()"><i data-lucide="plus"></i> Produto personalizado</button>
            </div>
            <div id="listaItensOrcamento" class="budgetItemsList"></div>
            <div id="resumoItensOrcamento" class="budgetItemsSummary"></div>
        </section>
        ${observacoes}`;
}

function abrirModalProdutoOrcamento() {
    Modal.abrir("Buscar produto cadastrado", `
        ${Input.text("Pesquisar", "pesquisaProdutoOrcamento", "Nome, código ou categoria")}
        <div id="produtosDisponiveisOrcamento" class="budgetProductPicker"></div>
    `);
    const pesquisa = document.getElementById("pesquisaProdutoOrcamento");
    pesquisa?.addEventListener("input", renderProdutosDisponiveisOrcamento);
    renderProdutosDisponiveisOrcamento();
    pesquisa?.focus();
}

function renderProdutosDisponiveisOrcamento() {
    const container = document.getElementById("produtosDisponiveisOrcamento");
    const pesquisa = String(document.getElementById("pesquisaProdutoOrcamento")?.value || "").trim().toLocaleLowerCase("pt-BR");
    if (!container) return;

    const produtos = Storage.listarProdutos()
        .filter(produto => produto.ativo !== false)
        .filter(produto => [produto.nome, produto.codigo, produto.categoria].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(pesquisa))
        .sort((a, b) => {
            if (Boolean(a.favorito) !== Boolean(b.favorito)) return a.favorito ? -1 : 1;
            return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" });
        });

    if (!produtos.length) {
        container.innerHTML = `<div class="budgetPickerEmpty"><i data-lucide="package-search"></i><p>Nenhum produto encontrado.</p></div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = produtos.map(produto => `
        <button class="budgetPickerProduct" type="button" data-produto-id="${escaparHtmlOrcamento(produto.id)}">
            <span class="budgetPickerIcon"><i data-lucide="${produto.favorito ? "star" : "package"}"></i></span>
            <span class="budgetPickerInfo"><strong>${escaparHtmlOrcamento(produto.nome || "Produto sem nome")}</strong><small>${escaparHtmlOrcamento(produto.codigo || "Sem código")} · ${escaparHtmlOrcamento(produto.categoria || "Sem categoria")}</small></span>
            <strong class="budgetPickerPrice">${Utils.moeda(normalizarNumeroOrcamento(produto.preco))}</strong>
        </button>
    `).join("");

    container.querySelectorAll("[data-produto-id]").forEach(botao => {
        botao.addEventListener("click", () => adicionarProdutoCadastradoOrcamento(botao.dataset.produtoId));
    });
    lucide.createIcons();
}

function adicionarProdutoCadastradoOrcamento(id) {
    const existente = itensOrcamento.find(item => item.tipo === "cadastrado" && String(item.produtoId) === String(id));

    if (existente) {
        existente.quantidade += 1;
        recalcularItemOrcamento(existente);
    } else {
        const produto = Storage.listarProdutos().find(item => String(item.id) === String(id));
        if (!produto) {
            Toast.show("Produto não encontrado.");
            return;
        }

        const valorUnitario = normalizarNumeroOrcamento(produto.preco);
        itensOrcamento.push({
            tipo: "cadastrado",
            produtoId: produto.id,
            codigo: produto.codigo || "",
            nome: produto.nome || "",
            categoria: produto.categoria || "",
            quantidade: 1,
            valorUnitario,
            valorTotal: valorUnitario,
            observacao: ""
        });
    }

    Modal.fechar();
    renderListaItensOrcamento();
    Toast.show(existente ? "Quantidade do produto aumentada." : "Produto adicionado ao orçamento.");
}

function adicionarProdutoPersonalizadoOrcamento() {
    itensOrcamento.push({
        tipo: "personalizado",
        produtoId: null,
        codigo: "",
        nome: "",
        categoria: "Personalizado",
        quantidade: 1,
        valorUnitario: 0,
        valorTotal: 0,
        observacao: ""
    });
    renderListaItensOrcamento();

    const camposNome = document.querySelectorAll("[data-campo-item='nome']");
    camposNome[camposNome.length - 1]?.focus();
}

function renderListaItensOrcamento() {
    const lista = document.getElementById("listaItensOrcamento");
    if (!lista) return;

    if (!itensOrcamento.length) {
        lista.innerHTML = `
            <div class="budgetItemsEmpty">
                <i data-lucide="shopping-basket"></i>
                <strong>Nenhum produto adicionado</strong>
                <p>Busque um produto cadastrado ou crie um produto personalizado.</p>
            </div>`;
        atualizarResumoOrcamento();
        lucide.createIcons();
        return;
    }

    lista.innerHTML = itensOrcamento.map((item, index) => `
        <article class="budgetItemCard ${item.tipo === "personalizado" ? "isCustom" : ""}">
            <div class="budgetItemTop">
                <div class="budgetItemTypeIcon"><i data-lucide="${item.tipo === "personalizado" ? "sparkles" : "package"}"></i></div>
                <div class="budgetItemIdentity">
                    ${item.tipo === "personalizado"
                        ? `<label><span>Nome do produto</span><input data-campo-item="nome" value="${escaparHtmlOrcamento(item.nome)}" placeholder="Digite o nome" oninput="atualizarItemOrcamento(${index}, 'nome', this.value)"></label>`
                        : `<strong>${escaparHtmlOrcamento(item.nome)}</strong><small>${escaparHtmlOrcamento(item.codigo || "Sem código")} · ${escaparHtmlOrcamento(item.categoria || "Sem categoria")}</small>`}
                </div>
                <button class="budgetItemRemove" type="button" onclick="removerItemOrcamento(${index})" aria-label="Remover ${escaparHtmlOrcamento(item.nome || "produto")}"><i data-lucide="trash-2"></i></button>
            </div>

            <div class="budgetItemControls">
                <div class="budgetItemQuantity">
                    <span>Quantidade</span>
                    <div>
                        <button type="button" onclick="alterarQuantidadeItemOrcamento(${index}, -1)" aria-label="Diminuir quantidade"><i data-lucide="minus"></i></button>
                        <input type="number" min="1" step="1" value="${item.quantidade}" oninput="atualizarItemOrcamento(${index}, 'quantidade', this.value)">
                        <button type="button" onclick="alterarQuantidadeItemOrcamento(${index}, 1)" aria-label="Aumentar quantidade"><i data-lucide="plus"></i></button>
                    </div>
                </div>
                <label class="budgetItemValue"><span>Valor unitário</span><input type="number" min="0" step="0.01" value="${Number(item.valorUnitario || 0).toFixed(2)}" oninput="atualizarItemOrcamento(${index}, 'valorUnitario', this.value)"></label>
                <div class="budgetItemTotal"><span>Total do item</span><strong id="totalItemOrcamento${index}">${Utils.moeda(item.valorTotal)}</strong></div>
            </div>

            ${item.tipo === "personalizado" ? `
                <label class="budgetItemObservation"><span>Observação do item</span><textarea rows="2" placeholder="Detalhes opcionais" oninput="atualizarItemOrcamento(${index}, 'observacao', this.value)">${escaparHtmlOrcamento(item.observacao)}</textarea></label>
            ` : ""}
        </article>
    `).join("");

    atualizarResumoOrcamento();
    lucide.createIcons();
}

function atualizarItemOrcamento(index, campo, valor) {
    const item = itensOrcamento[index];
    if (!item) return;

    if (campo === "quantidade") item.quantidade = Math.max(1, Math.floor(normalizarNumeroOrcamento(valor) || 1));
    else if (campo === "valorUnitario") item.valorUnitario = Math.max(0, normalizarNumeroOrcamento(valor));
    else item[campo] = valor;

    recalcularItemOrcamento(item);
    const total = document.getElementById(`totalItemOrcamento${index}`);
    if (total) total.textContent = Utils.moeda(item.valorTotal);
    atualizarResumoOrcamento();
}

function alterarQuantidadeItemOrcamento(index, delta) {
    const item = itensOrcamento[index];
    if (!item) return;
    item.quantidade = Math.max(1, Number(item.quantidade || 1) + delta);
    recalcularItemOrcamento(item);
    renderListaItensOrcamento();
}

function recalcularItemOrcamento(item) {
    item.quantidade = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    item.valorUnitario = Math.max(0, Number(item.valorUnitario) || 0);
    item.valorTotal = item.quantidade * item.valorUnitario;
}

function removerItemOrcamento(index) {
    itensOrcamento.splice(index, 1);
    renderListaItensOrcamento();
    Toast.show("Produto removido do orçamento.");
}

function calcularResumoItensOrcamento() {
    return {
        totalItens: itensOrcamento.length,
        totalPecas: itensOrcamento.reduce((total, item) => total + Number(item.quantidade || 0), 0),
        valorTotal: itensOrcamento.reduce((total, item) => total + Number(item.valorTotal || 0), 0)
    };
}

function atualizarResumoOrcamento() {
    const resumo = document.getElementById("resumoItensOrcamento");
    if (!resumo) return;
    const totais = calcularResumoItensOrcamento();

    resumo.innerHTML = `
        <div><span>Itens</span><strong>${totais.totalItens}</strong></div>
        <div><span>Total de peças</span><strong>${totais.totalPecas}</strong></div>
        <div class="budgetSummaryValue"><span>Valor total</span><strong>${Utils.moeda(totais.valorTotal)}</strong></div>
    `;
}

function gerarPDFOrcamento() {
    const empresa = obterEmpresaOrcamento();
    const clienteId = document.getElementById("orcamentoClienteId")?.value || clienteOrcamentoId;
    const cadastroCliente = Storage.buscarClientePorId(clienteId);
    const cliente = cadastroCliente?.nome || "";

    if (!cliente) {
        Toast.show("Informe o cliente.");
        return;
    }

    const dados = {
        cliente,
        data: valorCampoOrcamento("orcamentoData") || Utils.hoje(),
        observacoes: valorCampoOrcamento("orcamentoObservacoes"),
        tipo: empresa.tipo,
        origem: valorCampoOrcamento("orcamentoOrigem"),
        destino: valorCampoOrcamento("orcamentoDestino"),
        tipoViagem: valorCampoOrcamento("orcamentoTipoViagem"),
        descricao: valorCampoOrcamento("orcamentoDescricao")
    };

    if (empresa.tipo === "impressao3d") {
        if (!itensOrcamento.length) {
            Toast.show("Adicione pelo menos um produto ao orçamento.");
            return;
        }

        const itemInvalido = itensOrcamento.some(item => !String(item.nome || "").trim() || item.quantidade < 1);
        if (itemInvalido) {
            Toast.show("Preencha o nome e a quantidade de todos os produtos.");
            return;
        }

        const resumo = calcularResumoItensOrcamento();
        if (resumo.valorTotal <= 0) {
            Toast.show("Informe o valor dos produtos do orçamento.");
            return;
        }

        dados.itens = itensOrcamento.map(item => ({
            tipo: item.tipo,
            produtoId: item.produtoId,
            codigo: item.codigo,
            nome: String(item.nome).trim(),
            categoria: item.categoria,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            observacao: String(item.observacao || "").trim()
        }));
        dados.totalItens = resumo.totalItens;
        dados.totalPecas = resumo.totalPecas;
        dados.valorFinal = resumo.valorTotal;
    } else {
        dados.valorFinal = normalizarNumeroOrcamento(valorCampoOrcamento("orcamentoValorFinal"));
        const valido = empresa.tipo === "transporte"
            ? dados.origem && dados.destino
            : dados.descricao;

        if (!valido || dados.valorFinal <= 0) {
            Toast.show("Preencha os campos obrigatórios e um valor final válido.");
            return;
        }
    }

    if (PDF.gerarOrcamento(dados, empresa)) {
        const agora = new Date().toISOString();
        Storage.salvarOrcamento({...dados,id:`orc-${Date.now()}`,clienteId:cadastroCliente.id,clienteNome:cadastroCliente.nome,empresaId:empresa.id,status:"enviado",ativo:true,criadoEm:agora,atualizadoEm:agora});
        Toast.show("Orçamento gerado e registrado no histórico!");
    }
}

function normalizarNumeroOrcamento(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const texto = String(valor ?? "").trim();
    if (!texto) return 0;
    const normalizado = texto.includes(",") ? texto.replaceAll(".", "").replace(",", ".") : texto;
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}

function valorCampoOrcamento(id) {
    return document.getElementById(id)?.value?.trim?.() || "";
}

function rotuloTipoOrcamento(tipo) {
    return ({ impressao3d: "Impressão 3D", transporte: "Transporte", geral: "Geral" })[tipo] || "Geral";
}

function iconeTipoOrcamento(tipo) {
    return ({ impressao3d: "box", transporte: "car", geral: "file-text" })[tipo] || "file-text";
}

function escaparHtmlOrcamento(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
