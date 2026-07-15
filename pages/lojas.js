let lojaEditando = null;

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
            ${itens.length ? `
                <button class="btn" type="button" onclick="abrirCorrecaoEstoqueLoja('${escaparHtmlLoja(loja.id)}')">
                    <i data-lucide="list-restart"></i> Corrigir estoque
                </button>
            ` : ""}
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

function abrirCorrecaoEstoqueLoja(id) {
    const loja = Storage.buscarLojaPorId(id);
    const estoque = Storage.buscarEstoqueLoja(id);
    const itens = (estoque?.itens || []).filter(item => Number(item.quantidade || 0) > 0);
    if (!loja || !itens.length) {
        Toast.show("Não há estoque para corrigir nesta loja.");
        return;
    }

    Modal.abrir(`Corrigir estoque — ${escaparHtmlLoja(loja.nome)}`, `
        <div class="stockAdjustmentNotice">
            <i data-lucide="shield-alert"></i>
            <p>Informe a quantidade física real. O saldo será corrigido sem apagar o histórico anterior.</p>
        </div>
        <div class="stockAdjustmentList">
            ${itens.map(item => `
                <label class="stockAdjustmentItem">
                    <span><strong>${escaparHtmlLoja(item.nome || "Produto")}</strong><small>${escaparHtmlLoja(item.codigo || item.categoria || "Sem código")}</small></span>
                    <input type="number" min="0" step="1" value="${Math.max(0, Number(item.quantidade) || 0)}" data-ajuste-produto-id="${escaparHtmlLoja(item.produtoId)}" aria-label="Quantidade real de ${escaparHtmlLoja(item.nome || "produto")}">
                </label>`).join("")}
        </div>
        <label class="inputGroup"><span>Justificativa obrigatória</span><textarea id="motivoAjusteEstoqueLoja" placeholder="Ex.: correção após contagem física"></textarea></label>
        <div class="modalActions">
            <button class="btn" type="button" onclick="abrirEstoqueLoja('${escaparHtmlLoja(loja.id)}')">Cancelar</button>
            <button class="btn" type="button" onclick="salvarCorrecaoEstoqueLoja('${escaparHtmlLoja(loja.id)}')"><i data-lucide="save"></i>Salvar correção</button>
        </div>`);
    lucide.createIcons();
}

function salvarCorrecaoEstoqueLoja(id) {
    const loja = Storage.buscarLojaPorId(id);
    const estoque = Storage.buscarEstoqueLoja(id);
    const motivo = document.getElementById("motivoAjusteEstoqueLoja")?.value.trim() || "";
    if (!loja || !estoque) {
        Toast.show("Estoque da loja não encontrado.");
        return;
    }
    if (motivo.length < 5) {
        Toast.show("Informe uma justificativa com pelo menos 5 caracteres.");
        document.getElementById("motivoAjusteEstoqueLoja")?.focus();
        return;
    }

    const antes = (estoque.itens || []).map(item => ({ ...item, quantidade: Math.max(0, Number(item.quantidade) || 0) }));
    const quantidades = new Map([...document.querySelectorAll("[data-ajuste-produto-id]")].map(input => [
        String(input.dataset.ajusteProdutoId),
        Math.max(0, Math.floor(Number(input.value) || 0))
    ]));
    const depois = antes.map(item => ({
        ...item,
        quantidade: quantidades.has(String(item.produtoId))
            ? quantidades.get(String(item.produtoId))
            : item.quantidade
    })).filter(item => item.quantidade > 0);
    const alterou = antes.some(item => Number(item.quantidade) !== Number(quantidades.get(String(item.produtoId)) ?? item.quantidade));
    if (!alterou) {
        Toast.show("Nenhuma quantidade foi alterada.");
        return;
    }

    const idMovimentacao = Utils.gerarId();
    const criadoEm = new Date().toISOString();
    const aplicadas = Array.isArray(estoque.movimentacoesAplicadas) ? estoque.movimentacoesAplicadas.map(String) : [];
    Storage.salvarConsignado({
        id: idMovimentacao,
        tipo: "ajuste_manual_estoque_loja",
        lojaId: loja.id,
        lojaNome: loja.nome,
        responsavel: estoque.responsavel || loja.responsavel || "",
        data: Utils.hoje(),
        antes,
        depois,
        motivo,
        itens: [],
        criadoEm,
        usuarioId: obterUsuarioIdMovimentacaoLoja()
    });
    Storage.salvarEstoqueLoja({
        ...estoque,
        lojaId: loja.id,
        lojaNome: loja.nome,
        atualizadoEm: criadoEm,
        ultimaMovimentacaoId: idMovimentacao,
        movimentacoesAplicadas: [...aplicadas, String(idMovimentacao)].slice(-100),
        itens: depois
    });
    Modal.fechar();
    listarLojas();
    Toast.show("Estoque corrigido e ajuste registrado no histórico.");
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
            return `<article class="stockHistoryItem"><span><i data-lucide="${ajuste ? "list-restart" : conferencia ? "clipboard-check" : "package-plus"}"></i></span><div><small>${formatarAtualizacaoEstoque(registro.criadoEm || registro.data)}</small><strong>${titulo}</strong><p>${escaparHtmlLoja(descricao || "Movimentação registrada")}</p></div></article>`;
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
