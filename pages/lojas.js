let lojaEditando = null;
let itensAjusteEstoqueLoja = [];
let estoqueAnteriorAjusteLoja = [];
let contextoAjusteEstoqueLoja = "lojas";
let ajusteEstoqueLojaSalvando = false;

function renderLojas() {
    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>

        ${Page.titulo("🏪 Lojas", "Cadastre e gerencie as lojas parceiras")}

        <div class="cardForm">
            <input
                id="pesquisaLoja"
                placeholder="🔍 Pesquisar loja..."
                oninput="listarLojas()">
        </div>

        <div id="listaLojas"></div>
        <button class="fab" type="button" onclick="abrirModalLoja()">+</button>
    `;

    listarLojas();
    lucide.createIcons();
}

function listarLojas() {
    const lista = document.getElementById("listaLojas");
    const pesquisa = (document.getElementById("pesquisaLoja")?.value || "")
        .trim()
        .toLocaleLowerCase("pt-BR");

    if (!lista) return;

    const lojas = Storage.listarLojas()
        .filter(loja => {
            const dados = [loja.nome, loja.responsavel, loja.whatsapp, loja.endereco]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("pt-BR");

            return dados.includes(pesquisa);
        })
        .sort((a, b) => String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "pt-BR",
            { sensitivity: "base" }
        ));

    if (lojas.length === 0) {
        lista.innerHTML = `
            <div class="cardForm textCenter">
                <h3>Nenhuma loja encontrada</h3>
                <p>Clique no botão + para cadastrar uma loja parceira.</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = lojas.map(loja => criarCardLoja(loja)).join("");

    lista.querySelectorAll("[data-ver-estoque]").forEach(botao => {
        botao.addEventListener("click", () => abrirEstoqueLoja(botao.dataset.verEstoque));
    });

    lista.querySelectorAll("[data-editar-loja]").forEach(botao => {
        botao.addEventListener("click", () => editarLoja(botao.dataset.editarLoja));
    });

    lista.querySelectorAll("[data-excluir-loja]").forEach(botao => {
        botao.addEventListener("click", () => excluirLoja(botao.dataset.excluirLoja));
    });

    lucide.createIcons();
}

function criarCardLoja(loja) {
    const estoque = Storage.buscarEstoqueLoja(loja.id);
    const itensEstoque = estoque?.itens || [];
    const totalPecas = itensEstoque.reduce(
        (total, item) => total + Number(item.quantidade || 0),
        0
    );
    const possuiEstoque = Boolean(estoque && itensEstoque.length > 0);

    return `
        <div class="produtoCard lojaCard">
            <div class="produtoHeader">
                <div>
                    <h3>${escaparHtmlLoja(loja.nome)}</h3>
                    <span>${escaparHtmlLoja(loja.responsavel || "Sem responsável informado")}</span>
                </div>
                <span class="badge ${loja.ativo === false ? "red" : "green"}">
                    ${loja.ativo === false ? "Inativa" : "Ativa"}
                </span>
            </div>

            ${loja.whatsapp
                ? `<p><strong>WhatsApp:</strong> ${escaparHtmlLoja(loja.whatsapp)}</p>`
                : ""}
            ${loja.endereco
                ? `<p class="mt10"><strong>Endereço:</strong> ${escaparHtmlLoja(loja.endereco)}</p>`
                : ""}
            ${loja.observacoes
                ? `<p class="mt10">${escaparHtmlLoja(loja.observacoes)}</p>`
                : ""}

            ${possuiEstoque ? `
                <div class="estoqueResumoLoja">
                    <div class="estoqueResumoItem">
                        <strong>${totalPecas}</strong>
                        <span>peças em estoque</span>
                    </div>
                    <div class="estoqueResumoItem">
                        <strong>${itensEstoque.length}</strong>
                        <span>produtos diferentes</span>
                    </div>
                </div>
                ${estoque.atualizadoEm ? `
                    <p class="estoqueAtualizacao">
                        Última atualização: ${escaparHtmlLoja(
                            formatarAtualizacaoEstoque(estoque.atualizadoEm)
                        )}
                    </p>
                ` : ""}
            ` : `
                <div class="estoqueVazioLoja">Sem estoque registrado</div>
            `}

            <div class="space"></div>
            <div class="row lojaCardAcoes">
                <button class="btn" type="button" data-ver-estoque="${escaparHtmlLoja(loja.id)}">
                    Ver estoque
                </button>
                <button class="btn" type="button" data-editar-loja="${escaparHtmlLoja(loja.id)}">
                    Editar
                </button>
                <button
                    class="removeBtn"
                    type="button"
                    aria-label="Excluir loja"
                    data-excluir-loja="${escaparHtmlLoja(loja.id)}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `;
}

function abrirEstoqueLoja(id) {
    const loja = Storage.buscarLojaPorId(id);

    if (!loja) {
        Toast.show("Loja não encontrada.");
        return;
    }

    const estoque = Storage.buscarEstoqueLoja(id);
    const itens = estoque?.itens || [];
    const totalPecas = itens.reduce(
        (total, item) => total + Number(item.quantidade || 0),
        0
    );

    let conteudo = itens.length === 0
        ? `
            <div class="estoqueVazioModal textCenter">
                <i data-lucide="package-open"></i>
                <h3>Sem estoque registrado</h3>
                <p>Esta loja ainda não possui produtos em estoque.</p>
            </div>
        `
        : `
            <div class="estoqueModalLista">
                ${itens.map(item => `
                    <div class="estoqueModalItem">
                        <div>
                            <strong>${escaparHtmlLoja(item.nome || "Produto sem nome")}</strong>
                            <span>
                                ${escaparHtmlLoja(item.codigo || "Sem código")} ·
                                ${escaparHtmlLoja(item.categoria || "Sem categoria")}
                            </span>
                        </div>
                        <span class="estoqueQuantidade">${Number(item.quantidade || 0)}</span>
                    </div>
                `).join("")}
            </div>

            <div class="estoqueModalTotais">
                <div>
                    <span>Produtos diferentes</span>
                    <strong>${itens.length}</strong>
                </div>
                <div>
                    <span>Total de peças</span>
                    <strong>${totalPecas}</strong>
                </div>
            </div>
        `;

    conteudo += `
        <div class="modalActions storeStockActions">
            <button class="btn" type="button" onclick="abrirHistoricoEstoqueLoja('${escaparHtmlLoja(loja.id)}')">
                <i data-lucide="history"></i> Ver histórico
            </button>
            <button class="btn" type="button" onclick="abrirCorrecaoEstoqueLoja('${escaparHtmlLoja(loja.id)}')">
                <i data-lucide="list-restart"></i> Corrigir estoque
            </button>
        </div>`;

    Modal.abrir(
        `Estoque atual — ${escaparHtmlLoja(loja.nome)}`,
        conteudo
    );
    lucide.createIcons();
}

function obterUsuarioIdMovimentacaoLoja() {
    return window.PrimeFirebase?.auth?.currentUser?.uid || null;
}

function normalizarItemAjusteEstoqueLoja(item, quantidadeRegistrada = null) {
    const produto = Storage.buscarProdutoPorId?.(item.produtoId);
    const valorUnitario = Number(item.valorUnitario ?? item.preco ?? produto?.preco) || 0;
    const quantidade = Math.max(0, Math.floor(Number(item.quantidade) || 0));
    return {
        produtoId: item.produtoId,
        produtoNome: item.nome || item.produtoNome || produto?.nome || "Produto sem nome",
        nome: item.nome || item.produtoNome || produto?.nome || "Produto sem nome",
        codigo: item.codigo || produto?.codigo || "",
        categoria: item.categoria || produto?.categoria || "",
        preco: valorUnitario,
        valorUnitario,
        quantidadeRegistrada: quantidadeRegistrada === null ? quantidade : Math.max(0, Number(quantidadeRegistrada) || 0),
        quantidade
    };
}

function abrirCorrecaoEstoqueLoja(id, contexto = "lojas") {
    const loja = Storage.buscarLojaPorId(id);
    if (!loja) {
        Toast.show("Loja não encontrada.");
        return;
    }
    const estoque = Storage.buscarEstoqueLoja(id) || { itens: [] };
    contextoAjusteEstoqueLoja = contexto;
    ajusteEstoqueLojaSalvando = false;
    estoqueAnteriorAjusteLoja = (estoque.itens || [])
        .filter(item => Number(item.quantidade || 0) > 0)
        .map(item => normalizarItemAjusteEstoqueLoja(item));
    itensAjusteEstoqueLoja = estoqueAnteriorAjusteLoja.map(item => ({ ...item }));
    renderModalCorrecaoEstoqueLoja(loja);
}

function renderModalCorrecaoEstoqueLoja(loja, valoresFormulario = {}) {
    const selecionados = new Set(itensAjusteEstoqueLoja.map(item => String(item.produtoId)));
    const produtosDisponiveis = Storage.listarProdutos()
        .filter(produto => produto.ativo !== false && !selecionados.has(String(produto.id)))
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
    const motivoAtual = valoresFormulario.motivo ?? document.getElementById("motivoAjusteEstoqueLoja")?.value ?? "";
    const observacaoAtual = valoresFormulario.observacao ?? document.getElementById("observacaoAjusteEstoqueLoja")?.value ?? "";
    const motivos = [
        "Contagem física", "Erro em consignação anterior", "Estoque duplicado",
        "Produto não registrado", "Produto perdido ou danificado", "Retirada de produto",
        "Correção após conferência", "Outro"
    ];

    Modal.abrir("Corrigir estoque da loja", `
        <div class="stockAdjustmentHeader">
            <div><span>LOJA</span><strong>${escaparHtmlLoja(loja.nome)}</strong></div>
            <div><span>DATA</span><strong>${formatarDataBR(Utils.hoje())}</strong></div>
        </div>
        <div class="stockAdjustmentNotice"><i data-lucide="shield-alert"></i><p>Use este ajuste apenas quando o estoque registrado estiver diferente do estoque físico encontrado na loja.</p></div>
        <div class="stockAdjustmentList" id="listaAjusteEstoqueLoja">
            ${itensAjusteEstoqueLoja.length ? itensAjusteEstoqueLoja.map(renderItemCorrecaoEstoqueLoja).join("") : '<div class="consignmentEmpty">Nenhum produto registrado. Adicione o estoque físico encontrado.</div>'}
        </div>
        <section class="stockAdjustmentAdd">
            <div><span class="eyebrow">PRODUTO AUSENTE</span><h4>Adicionar produto ao ajuste</h4></div>
            <div class="stockAdjustmentAddFields">
                <label class="inputGroup"><span>Produto cadastrado</span><select id="produtoAusenteAjusteLoja"><option value="">Selecione</option>${produtosDisponiveis.map(produto => `<option value="${escaparHtmlLoja(produto.id)}">${escaparHtmlLoja(produto.nome)} · ${Utils.moeda(Number(produto.preco) || 0)}</option>`).join("")}</select></label>
                <label class="inputGroup"><span>Quantidade real</span><input id="quantidadeProdutoAusenteAjuste" type="number" min="1" step="1" value="1"></label>
                <button class="btnSecondary" type="button" onclick="adicionarProdutoAusenteAjusteLoja('${escaparHtmlLoja(loja.id)}')"><i data-lucide="plus"></i>Adicionar</button>
            </div>
        </section>
        <div class="stockAdjustmentReasonGrid">
            <label class="inputGroup"><span>Motivo do ajuste *</span><select id="motivoAjusteEstoqueLoja" onchange="atualizarObrigatoriedadeObservacaoAjuste()"><option value="">Selecione o motivo</option>${motivos.map(motivo => `<option value="${motivo}" ${motivoAtual === motivo ? "selected" : ""}>${motivo}</option>`).join("")}</select></label>
            <label class="inputGroup"><span>Observação <b id="observacaoAjusteObrigatoria">${motivoAtual === "Outro" ? "*" : "(opcional)"}</b></span><textarea id="observacaoAjusteEstoqueLoja" placeholder="Detalhes da correção">${escaparHtmlLoja(observacaoAtual)}</textarea></label>
        </div>
        <div id="resumoAjusteEstoqueLoja"></div>
        <div class="modalActions stockAdjustmentActions">
            <button class="btnSecondary" type="button" onclick="cancelarCorrecaoEstoqueLoja('${escaparHtmlLoja(loja.id)}')">Cancelar</button>
            <button id="salvarAjusteEstoqueLojaButton" class="btn" type="button" onclick="salvarCorrecaoEstoqueLoja('${escaparHtmlLoja(loja.id)}')"><i data-lucide="save"></i>Salvar ajuste</button>
        </div>`);
    document.querySelectorAll("[data-nova-quantidade-ajuste]").forEach(input => input.addEventListener("input", atualizarPreviaCorrecaoEstoqueLoja));
    atualizarPreviaCorrecaoEstoqueLoja();
    lucide.createIcons();
}

function renderItemCorrecaoEstoqueLoja(item) {
    const diferenca = Number(item.quantidade || 0) - Number(item.quantidadeRegistrada || 0);
    return `<article class="stockAdjustmentProduct" data-ajuste-card="${escaparHtmlLoja(item.produtoId)}">
        <header><div><strong>${escaparHtmlLoja(item.nome)}</strong><span>${escaparHtmlLoja(item.codigo || "Sem código")}</span></div><span class="stockAdjustmentPrice">${Utils.moeda(item.valorUnitario)} cada</span></header>
        <div class="stockAdjustmentProductValues">
            <span><small>Registrado</small><strong>${item.quantidadeRegistrada}</strong></span>
            <label><small>Nova quantidade</small><input type="number" min="0" step="1" value="${item.quantidade}" data-nova-quantidade-ajuste="${escaparHtmlLoja(item.produtoId)}"></label>
            <span><small>Diferença</small><strong data-diferenca-ajuste="${escaparHtmlLoja(item.produtoId)}" class="${diferenca > 0 ? "isPositive" : diferenca < 0 ? "isNegative" : "isNeutral"}">${diferenca > 0 ? "+" : ""}${diferenca}</strong></span>
        </div>
        <p data-remocao-ajuste="${escaparHtmlLoja(item.produtoId)}" class="stockAdjustmentRemoval" ${Number(item.quantidade) === 0 ? "" : "hidden"}>Este produto será removido do estoque atual da loja.</p>
    </article>`;
}

function sincronizarQuantidadesAjusteEstoqueLoja() {
    document.querySelectorAll("[data-nova-quantidade-ajuste]").forEach(input => {
        const item = itensAjusteEstoqueLoja.find(registro => String(registro.produtoId) === String(input.dataset.novaQuantidadeAjuste));
        if (item) item.quantidade = Math.max(0, Math.floor(Number(input.value) || 0));
    });
}

function atualizarPreviaCorrecaoEstoqueLoja() {
    sincronizarQuantidadesAjusteEstoqueLoja();
    itensAjusteEstoqueLoja.forEach(item => {
        const diferenca = Number(item.quantidade) - Number(item.quantidadeRegistrada);
        const elemento = document.querySelector(`[data-diferenca-ajuste="${CSS.escape(String(item.produtoId))}"]`);
        if (elemento) {
            elemento.textContent = `${diferenca > 0 ? "+" : ""}${diferenca}`;
            elemento.className = diferenca > 0 ? "isPositive" : diferenca < 0 ? "isNegative" : "isNeutral";
        }
        const aviso = document.querySelector(`[data-remocao-ajuste="${CSS.escape(String(item.produtoId))}"]`);
        if (aviso) aviso.hidden = item.quantidade !== 0;
    });
    const alterados = itensAjusteEstoqueLoja.filter(item => Number(item.quantidade) !== Number(item.quantidadeRegistrada)).length;
    const pecasAntes = estoqueAnteriorAjusteLoja.reduce((total, item) => total + item.quantidade, 0);
    const pecasDepois = itensAjusteEstoqueLoja.reduce((total, item) => total + item.quantidade, 0);
    const valorAntes = estoqueAnteriorAjusteLoja.reduce((total, item) => total + item.quantidade * item.valorUnitario, 0);
    const valorDepois = itensAjusteEstoqueLoja.reduce((total, item) => total + item.quantidade * item.valorUnitario, 0);
    const resumo = document.getElementById("resumoAjusteEstoqueLoja");
    if (resumo) resumo.innerHTML = `<section class="stockAdjustmentPreview"><header><span class="eyebrow">PRÉVIA DO AJUSTE</span><strong>${alterados} produto${alterados === 1 ? "" : "s"} alterado${alterados === 1 ? "" : "s"}</strong></header><div>${renderMetricaAjuste("Peças antes", pecasAntes)}${renderMetricaAjuste("Peças depois", pecasDepois)}${renderMetricaAjuste("Diferença total", pecasDepois - pecasAntes, true)}${renderMetricaAjuste("Valor antes", Utils.moeda(valorAntes))}${renderMetricaAjuste("Valor depois", Utils.moeda(valorDepois))}${renderMetricaAjuste("Diferença financeira", `${valorDepois - valorAntes > 0 ? "+" : ""}${Utils.moeda(valorDepois - valorAntes)}`, true, valorDepois - valorAntes)}</div></section>`;
}

function renderMetricaAjuste(rotulo, valor, diferenca = false, sinal = Number(valor)) {
    const classe = diferenca ? (sinal > 0 ? "isPositive" : sinal < 0 ? "isNegative" : "isNeutral") : "";
    const exibido = diferenca && typeof valor === "number" ? `${valor > 0 ? "+" : ""}${valor}` : valor;
    return `<span><small>${rotulo}</small><strong class="${classe}">${exibido}</strong></span>`;
}

function adicionarProdutoAusenteAjusteLoja(lojaId) {
    sincronizarQuantidadesAjusteEstoqueLoja();
    const produtoId = document.getElementById("produtoAusenteAjusteLoja")?.value;
    const quantidade = Math.max(1, Math.floor(Number(document.getElementById("quantidadeProdutoAusenteAjuste")?.value) || 1));
    const produto = Storage.buscarProdutoPorId(produtoId);
    if (!produto) {
        Toast.show("Selecione um produto cadastrado.");
        return;
    }
    if (itensAjusteEstoqueLoja.some(item => String(item.produtoId) === String(produto.id))) {
        Toast.show("Este produto já está no ajuste.");
        return;
    }
    const motivo = document.getElementById("motivoAjusteEstoqueLoja")?.value || "";
    const observacao = document.getElementById("observacaoAjusteEstoqueLoja")?.value || "";
    itensAjusteEstoqueLoja.push(normalizarItemAjusteEstoqueLoja({ ...produto, produtoId: produto.id, quantidade }, 0));
    renderModalCorrecaoEstoqueLoja(Storage.buscarLojaPorId(lojaId), { motivo, observacao });
    Toast.show("Produto adicionado ao ajuste.");
}

function atualizarObrigatoriedadeObservacaoAjuste() {
    const outro = document.getElementById("motivoAjusteEstoqueLoja")?.value === "Outro";
    const marcador = document.getElementById("observacaoAjusteObrigatoria");
    if (marcador) marcador.textContent = outro ? "*" : "(opcional)";
}

function cancelarCorrecaoEstoqueLoja(lojaId) {
    if (contextoAjusteEstoqueLoja === "consignado") Modal.fechar();
    else abrirEstoqueLoja(lojaId);
}

function salvarCorrecaoEstoqueLoja(id) {
    if (ajusteEstoqueLojaSalvando) return;
    sincronizarQuantidadesAjusteEstoqueLoja();
    const loja = Storage.buscarLojaPorId(id);
    const estoque = Storage.buscarEstoqueLoja(id) || { itens: [] };
    const motivo = document.getElementById("motivoAjusteEstoqueLoja")?.value || "";
    const observacao = document.getElementById("observacaoAjusteEstoqueLoja")?.value.trim() || "";
    if (!loja) {
        Toast.show("Loja não encontrada.");
        return;
    }
    if (!motivo) {
        Toast.show("Selecione o motivo do ajuste.");
        document.getElementById("motivoAjusteEstoqueLoja")?.focus();
        return;
    }
    if (motivo === "Outro" && observacao.length < 5) {
        Toast.show("Descreva o motivo do ajuste no campo Observação.");
        document.getElementById("observacaoAjusteEstoqueLoja")?.focus();
        return;
    }

    const diferencas = itensAjusteEstoqueLoja.filter(item => Number(item.quantidade) !== Number(item.quantidadeRegistrada)).map(item => ({
        produtoId: item.produtoId,
        produtoNome: item.nome,
        codigo: item.codigo,
        quantidadeAnterior: item.quantidadeRegistrada,
        quantidadeCorrigida: item.quantidade,
        diferenca: item.quantidade - item.quantidadeRegistrada,
        valorUnitario: item.valorUnitario,
        diferencaFinanceira: (item.quantidade - item.quantidadeRegistrada) * item.valorUnitario
    }));
    if (!diferencas.length) {
        Toast.show("Nenhuma quantidade foi alterada.");
        return;
    }

    ajusteEstoqueLojaSalvando = true;
    const botao = document.getElementById("salvarAjusteEstoqueLojaButton");
    if (botao) {
        botao.disabled = true;
        botao.textContent = "Salvando...";
    }
    const idMovimentacao = Utils.gerarId();
    const criadoEm = new Date().toISOString();
    const estoqueAnterior = estoqueAnteriorAjusteLoja.map(serializarItemAjusteEstoqueLoja);
    const estoqueCorrigido = itensAjusteEstoqueLoja.filter(item => item.quantidade > 0).map(serializarItemAjusteEstoqueLoja);
    const aplicadas = Array.isArray(estoque.movimentacoesAplicadas) ? estoque.movimentacoesAplicadas.map(String) : [];
    if (aplicadas.includes(String(idMovimentacao))) {
        ajusteEstoqueLojaSalvando = false;
        Toast.show("Este ajuste já foi aplicado.");
        return;
    }
    const usuario = window.PrimeFirebase?.auth?.currentUser;
    Storage.salvarConsignado({
        id: idMovimentacao,
        tipo: "ajuste_manual_estoque_loja",
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel: usuario?.displayName || usuario?.email || estoque.responsavel || loja.responsavel || "",
        data: Utils.hoje(),
        estoqueAnterior,
        estoqueCorrigido,
        diferencas,
        motivo,
        observacao,
        antes: estoqueAnterior,
        depois: estoqueCorrigido,
        itens: [],
        criadoEm,
        usuarioId: obterUsuarioIdMovimentacaoLoja(),
        usuarioNome: usuario?.displayName || usuario?.email || ""
    });
    Storage.salvarEstoqueLoja({
        ...estoque,
        lojaId: loja.id,
        lojaNome: loja.nome,
        atualizadoEm: criadoEm,
        ultimaMovimentacaoId: idMovimentacao,
        movimentacoesAplicadas: [...aplicadas, String(idMovimentacao)].slice(-100),
        itens: estoqueCorrigido
    });

    if (contextoAjusteEstoqueLoja === "consignado" && typeof lojaConsignadoAtual !== "undefined" && String(lojaConsignadoAtual?.id) === String(loja.id)) {
        estoqueAnteriorConsignado = normalizarItensEstoqueConsignado(estoqueCorrigido);
        renderEstoqueAnteriorConsignado();
        renderEstoqueFinalConsignado();
        atualizarCabecalhoFluxoConsignado();
    }
    ajusteEstoqueLojaSalvando = false;
    Modal.fechar();
    if (document.getElementById("listaLojas")) listarLojas();
    Toast.show("Estoque da loja corrigido com sucesso.");
}

function serializarItemAjusteEstoqueLoja(item) {
    const quantidade = Math.max(0, Number(item.quantidade) || 0);
    const valorUnitario = Number(item.valorUnitario ?? item.preco) || 0;
    return {
        produtoId: item.produtoId,
        produtoNome: item.nome,
        nome: item.nome,
        codigo: item.codigo || "",
        categoria: item.categoria || "",
        preco: valorUnitario,
        valorUnitario,
        quantidade,
        valorTotal: quantidade * valorUnitario
    };
}

function abrirHistoricoEstoqueLoja(id) {
    const loja = Storage.buscarLojaPorId(id);
    if (!loja) {
        Toast.show("Loja não encontrada.");
        return;
    }
    const consignados = Storage.listarConsignados().filter(item => String(item.lojaId) === String(id));
    const conferencias = Storage.listarConferencias().filter(item => String(item.lojaId) === String(id));
    const registros = [
        ...consignados.map(item => ({ ...item, origemHistorico: "consignado" })),
        ...conferencias.map(item => ({ ...item, origemHistorico: "conferencia" }))
    ].sort((a, b) => new Date(b.criadoEm || b.data || 0) - new Date(a.criadoEm || a.data || 0));

    Modal.abrir(`Histórico — ${escaparHtmlLoja(loja.nome)}`, registros.length ? `
        <div class="stockHistoryTimeline">${registros.map(registro => {
            const ajuste = registro.tipo === "ajuste_manual_estoque_loja";
            const conferencia = registro.origemHistorico === "conferencia";
            const reposicao = registro.tipo === "reposicao_consignado";
            const itens = ajuste ? (registro.depois || []) : conferencia ? (registro.itens || []) : (registro.itensReposicao || registro.itens || []);
            const total = itens.reduce((soma, item) => soma + Number(item.quantidadeVendida ?? item.quantidade ?? item.quantidadeSobrou ?? 0), 0);
            const titulo = ajuste ? "Ajuste manual" : conferencia ? "Conferência" : reposicao ? "Reposição" : "Consignação inicial";
            const descricao = ajuste ? registro.motivo : conferencia
                ? `${Number(registro.totalPecasVendidas || 0)} peças vendidas`
                : `${total} peças adicionadas`;
            const detalhesAjuste = ajuste ? `
                <div class="stockHistoryChanges">${(registro.diferencas || []).map(item => `<span><b>${escaparHtmlLoja(item.produtoNome || "Produto")}</b><em>${Number(item.quantidadeAnterior || 0)} → ${Number(item.quantidadeCorrigida || 0)}</em></span>`).join("")}</div>
                ${registro.observacao ? `<p>${escaparHtmlLoja(registro.observacao)}</p>` : ""}
                ${registro.responsavel ? `<small>Responsável: ${escaparHtmlLoja(registro.responsavel)}</small>` : ""}` : "";
            return `<article class="stockHistoryItem"><span><i data-lucide="${ajuste ? "list-restart" : conferencia ? "clipboard-check" : "package-plus"}"></i></span><div><small>${formatarAtualizacaoEstoque(registro.criadoEm || registro.data)}</small><strong>${titulo}</strong><p>${escaparHtmlLoja(descricao || "Movimentação registrada")}</p>${detalhesAjuste}</div></article>`;
        }).join("")}</div>` : '<div class="estoqueVazioModal textCenter"><i data-lucide="history"></i><h3>Nenhuma movimentação registrada</h3></div>');
    lucide.createIcons();
}

function formatarAtualizacaoEstoque(valor) {
    const data = new Date(valor);

    if (!Number.isNaN(data.getTime()) && String(valor).includes("T")) {
        return data.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        });
    }

    return formatarDataBR(String(valor).slice(0, 10));
}

function abrirModalLoja() {
    lojaEditando = null;
    Modal.abrir("Nova Loja", montarFormularioLoja());
}

function editarLoja(id) {
    lojaEditando = Storage.buscarLojaPorId(id);

    if (!lojaEditando) {
        Toast.show("Loja não encontrada.");
        return;
    }

    Modal.abrir("Editar Loja", montarFormularioLoja(lojaEditando));
}

function montarFormularioLoja(loja = {}) {
    return `
        ${Input.text("Nome", "nomeLoja", "Nome da loja", loja.nome || "")}
        ${Input.text("Responsável", "responsavelLoja", "Nome do responsável", loja.responsavel || "")}
        ${Input.text("WhatsApp", "whatsappLoja", "(00) 00000-0000", loja.whatsapp || "")}
        ${Input.text("Endereço", "enderecoLoja", "Endereço completo", loja.endereco || "")}

        <label class="inputGroup">
            <span>Observações</span>
            <textarea id="observacoesLoja" placeholder="Observações sobre a parceria">${escaparHtmlLoja(
                loja.observacoes || ""
            )}</textarea>
        </label>

        <label>
            <input id="lojaAtiva" type="checkbox" ${loja.ativo === false ? "" : "checked"}>
            Loja ativa
        </label>

        ${Button.primary(loja.id ? "Salvar Alterações" : "Salvar Loja", "salvarLoja()")}
    `;
}

function salvarLoja() {
    const nome = document.getElementById("nomeLoja").value.trim();

    if (!nome) {
        Toast.show("Informe o nome da loja.");
        return;
    }

    const loja = {
        id: lojaEditando?.id || Utils.gerarId(),
        clienteId: lojaEditando?.clienteId || null,
        nome,
        responsavel: document.getElementById("responsavelLoja").value.trim(),
        whatsapp: document.getElementById("whatsappLoja").value.trim(),
        endereco: document.getElementById("enderecoLoja").value.trim(),
        observacoes: document.getElementById("observacoesLoja").value.trim(),
        ativo: document.getElementById("lojaAtiva").checked,
        criadoEm: lojaEditando?.criadoEm || Utils.hoje()
    };

    Storage.salvarLoja(loja);
    if (loja.clienteId) {
        const cliente = Storage.buscarClientePorId(loja.clienteId);
        if (cliente) Storage.salvarCliente({...cliente,nome:loja.nome,whatsapp:loja.whatsapp||cliente.whatsapp,endereco:loja.endereco||cliente.endereco,observacoes:loja.observacoes||cliente.observacoes,tipo:"loja_parceira",lojaId:loja.id,ativo:loja.ativo,atualizadoEm:new Date().toISOString()});
    }
    lojaEditando = null;
    Modal.fechar();
    listarLojas();
    Toast.show("Loja salva com sucesso!");
}

function excluirLoja(id) {
    Storage.excluirLoja(id);
    Storage.limparDadosOrfaosLojas();
    listarLojas();
    Toast.show("Loja excluída.");
}

function escaparHtmlLoja(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
