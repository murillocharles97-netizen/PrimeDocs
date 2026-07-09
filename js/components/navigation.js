const DRAWER_PRIMEDOCS = [
    ["home", "layout-dashboard", "Operações"],
    ["dashboard", "chart-no-axes-combined", "Dashboard"],
    ["pedidos", "package", "Pedidos"],
    ["financeiro", "wallet-cards", "Financeiro"],
    ["consignado", "store", "Consignado"],
    ["conferencia", "badge-check", "Conferência"],
    ["clientes", "users", "Clientes"],
    ["produtos", "boxes", "Produtos"],
    ["filamentos", "spool", "Filamentos"],
    ["custos", "calculator", "Custos"],
    ["orcamento", "file-text", "Orçamentos"],
    ["relatorios", "chart-no-axes-combined", "Relatórios"],
    ["configuracoes", "settings", "Configurações"]
];

function renderNavegacaoPrimeDocs() {
    const empresa = Storage.buscarEmpresaPadrao();
    const container = document.getElementById("drawerNavigation");
    if (!container) return;
    container.innerHTML = `
        <div class="drawerBrand">
            <div class="brandMark"><i data-lucide="box"></i></div>
            <div><strong>PrimeDocs</strong><span>ERP para impressão 3D</span></div>
            <button onclick="fecharDrawerPrimeDocs()" aria-label="Fechar menu"><i data-lucide="x"></i></button>
        </div>
        <nav class="drawerMenu" aria-label="Menu principal">
            ${DRAWER_PRIMEDOCS.map(([pagina, icone, titulo, futuro]) => `
                <button data-drawer-page="${pagina}" onclick="selecionarDrawerPrimeDocs('${pagina}', ${Boolean(futuro)})">
                    <i data-lucide="${icone}"></i>
                    <span>${titulo}</span>
                    ${futuro ? `<small>Em breve</small>` : ""}
                </button>
            `).join("")}
        </nav>
        <div class="drawerCompany">
            <span>Empresa ativa</span>
            <strong>${escaparNavegacao(empresa?.nome || "PrimeLine 3D")}</strong>
            <small>${escaparNavegacao(empresa?.whatsapp || "PrimeDocs")}</small>
            <small id="syncStatusLabel" class="syncStatusLabel">${navigator.onLine ? "Online" : "Offline"}</small>
            <button class="drawerLogoutButton" type="button" onclick="sairPrimeDocs()"><i data-lucide="log-out"></i> Sair</button>
        </div>
    `;
    atualizarCabecalhoPrimeDocs();
    lucide.createIcons();
}

function selecionarDrawerPrimeDocs(pagina, futuro) {
    fecharDrawerPrimeDocs();
    if (futuro) return Toast.show("Módulo preparado para uma próxima atualização.");
    navegar(pagina);
}

function abrirDrawerPrimeDocs() {
    document.body.classList.add("drawerOpen");
    document.getElementById("appDrawer")?.setAttribute("aria-hidden", "false");
}

function fecharDrawerPrimeDocs() {
    document.body.classList.remove("drawerOpen");
    document.getElementById("appDrawer")?.setAttribute("aria-hidden", "true");
}

function alternarDrawerPrimeDocs() {
    document.body.classList.contains("drawerOpen") ? fecharDrawerPrimeDocs() : abrirDrawerPrimeDocs();
}

function atualizarNavegacaoAtivaPrimeDocs(pagina) {
    document.querySelectorAll("[data-drawer-page]").forEach(item => {
        item.classList.toggle("isActive", item.dataset.drawerPage === pagina);
    });
}

function atualizarCabecalhoPrimeDocs() {
    const empresa = Storage.buscarEmpresaPadrao();
    const agora = new Date();
    const hora = agora.getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const nome = document.getElementById("headerCompanyName");
    const contexto = document.getElementById("headerGreeting");
    const logo = document.getElementById("headerCompanyLogo");
    if (nome) nome.textContent = empresa?.nome || "PrimeLine 3D";
    if (contexto) contexto.textContent = `${saudacao} · ${agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    if (logo) logo.innerHTML = empresa?.logo ? `<img src="${empresa.logo}" alt="">` : `<i data-lucide="box"></i>`;
}

function escaparNavegacao(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") fecharDrawerPrimeDocs();
});
