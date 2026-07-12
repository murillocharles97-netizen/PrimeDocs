/* ==========================================
   PrimeDocs
   Card Component
========================================== */

function criarCard(icone, titulo, descricao, pagina) {

    return `

    <button class="menuCard" type="button" onclick="navegar('${pagina}')">

        <div class="icon">

            <i data-lucide="${icone}"></i>

        </div>

        <div class="menuInfo">

            <h3>${titulo}</h3>

            <span>${descricao}</span>

        </div>

        <i class="arrow" data-lucide="chevron-right"></i>

    </button>

    `;

}

const Badge = {
    render(texto, estado = "neutral") {
        return `<span class="badge badge-${estado}">${texto}</span>`;
    }
};

const UIState = {
    empty(titulo, descricao = "", icone = "inbox") {
        return `<div class="uiState uiState-empty"><i data-lucide="${icone}"></i><strong>${titulo}</strong>${descricao ? `<p>${descricao}</p>` : ""}</div>`;
    },
    loading(texto = "Carregando...") {
        return `<div class="uiState uiState-loading"><span class="spinner"></span><strong>${texto}</strong></div>`;
    },
    error(texto = "Não foi possível carregar esta informação.") {
        return `<div class="uiState uiState-error"><i data-lucide="triangle-alert"></i><strong>${texto}</strong></div>`;
    }
};
