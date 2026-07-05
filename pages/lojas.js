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

    const conteudo = itens.length === 0
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

    Modal.abrir(
        `Estoque atual — ${escaparHtmlLoja(loja.nome)}`,
        conteudo
    );
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
        nome,
        responsavel: document.getElementById("responsavelLoja").value.trim(),
        whatsapp: document.getElementById("whatsappLoja").value.trim(),
        endereco: document.getElementById("enderecoLoja").value.trim(),
        observacoes: document.getElementById("observacoesLoja").value.trim(),
        ativo: document.getElementById("lojaAtiva").checked,
        criadoEm: lojaEditando?.criadoEm || Utils.hoje()
    };

    Storage.salvarLoja(loja);
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
