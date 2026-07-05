let empresaOrcamentoId = null;

function renderOrcamento() {
    const empresas = Storage.listarEmpresas().filter(empresa => empresa.ativa !== false);
    const padrao = Storage.buscarEmpresaPadrao();

    if (!empresaOrcamentoId || !empresas.some(empresa => String(empresa.id) === String(empresaOrcamentoId))) {
        empresaOrcamentoId = padrao?.id || empresas[0]?.id || "fallback";
    }

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
                        ? empresas.map(empresa => `<option value="${empresa.id}" ${String(empresa.id) === String(empresaOrcamentoId) ? "selected" : ""}>${escaparHtmlOrcamento(empresa.nome)} — ${rotuloTipoOrcamento(empresa.tipo)}</option>`).join("")
                        : `<option value="fallback">PrimeDocs / PrimeLine 3D — Impressão 3D</option>`}
                </select>
            </label>
            ${!empresas.length ? `<div class="budgetNotice"><i data-lucide="info"></i><span>Cadastre uma empresa em Configurações para personalizar logo, cor e contatos.</span></div>` : ""}
        </section>

        <section class="budgetCard budgetFormCard">
            <div class="budgetFormTitle"><div><span>MODELO</span><h3>${rotuloTipoOrcamento(obterEmpresaOrcamento().tipo)}</h3></div><i data-lucide="${iconeTipoOrcamento(obterEmpresaOrcamento().tipo)}"></i></div>
            <div id="camposOrcamento" class="budgetFormGrid">${renderCamposOrcamento(obterEmpresaOrcamento().tipo)}</div>
            <button class="btn budgetGenerateButton" type="button" onclick="gerarPDFOrcamento()"><i data-lucide="file-down"></i> Gerar PDF do orçamento</button>
        </section>
    `;
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
    const camposComunsInicio = Input.text("Cliente *", "orcamentoCliente", "Nome do cliente");
    const camposComunsFim = `
        <label class="inputGroup"><span>Valor final *</span><input id="orcamentoValorFinal" type="number" min="0" step="0.01" placeholder="0,00"></label>
        <label class="inputGroup budgetFullField"><span>Observações</span><textarea id="orcamentoObservacoes" rows="4" placeholder="Condições, prazo e informações adicionais"></textarea></label>
    `;

    if (tipo === "transporte") {
        return `${camposComunsInicio}
            ${Input.text("Origem *", "orcamentoOrigem", "Local de partida")}
            ${Input.text("Destino *", "orcamentoDestino", "Local de chegada")}
            <label class="inputGroup"><span>Tipo de viagem</span><select id="orcamentoTipoViagem"><option value="ida">Ida</option><option value="ida-e-volta">Ida e volta</option></select></label>
            <label class="inputGroup"><span>Data</span><input id="orcamentoData" type="date" value="${Utils.hoje()}"></label>
            ${camposComunsFim}`;
    }

    if (tipo === "geral") {
        return `${camposComunsInicio}
            <label class="inputGroup budgetFullField"><span>Descrição *</span><textarea id="orcamentoDescricao" rows="4" placeholder="Descreva o serviço ou produto"></textarea></label>
            ${camposComunsFim}`;
    }

    return `${camposComunsInicio}
        ${Input.text("Produto *", "orcamentoProduto", "Produto ou serviço")}
        <label class="inputGroup"><span>Quantidade *</span><input id="orcamentoQuantidade" type="number" min="1" step="1" value="1"></label>
        ${camposComunsFim}`;
}

function gerarPDFOrcamento() {
    const empresa = obterEmpresaOrcamento();
    const cliente = valorCampoOrcamento("orcamentoCliente");
    const valorFinal = Number(valorCampoOrcamento("orcamentoValorFinal"));

    if (!cliente || !Number.isFinite(valorFinal) || valorFinal <= 0) {
        Toast.show("Informe o cliente e um valor final válido.");
        return;
    }

    const dados = {
        cliente,
        data: valorCampoOrcamento("orcamentoData") || Utils.hoje(),
        valorFinal,
        observacoes: valorCampoOrcamento("orcamentoObservacoes"),
        tipo: empresa.tipo,
        produto: valorCampoOrcamento("orcamentoProduto"),
        quantidade: Number(valorCampoOrcamento("orcamentoQuantidade") || 1),
        origem: valorCampoOrcamento("orcamentoOrigem"),
        destino: valorCampoOrcamento("orcamentoDestino"),
        tipoViagem: valorCampoOrcamento("orcamentoTipoViagem"),
        descricao: valorCampoOrcamento("orcamentoDescricao")
    };

    const obrigatorioTipo = empresa.tipo === "transporte"
        ? dados.origem && dados.destino
        : empresa.tipo === "geral"
            ? dados.descricao
            : dados.produto && dados.quantidade > 0;

    if (!obrigatorioTipo) {
        Toast.show("Preencha os campos obrigatórios do orçamento.");
        return;
    }

    if (PDF.gerarOrcamento(dados, empresa)) {
        Toast.show("Orçamento gerado com sucesso!");
    }
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
