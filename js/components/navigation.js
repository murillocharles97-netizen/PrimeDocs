const DRAWER_PRIMEDOCS = [
    ["home", "layout-dashboard", "Operações"],
    ["dashboard", "chart-no-axes-combined", "Dashboard"],
    ["pedidos", "package", "Pedidos"],
    ["producao", "factory", "Produção"],
    ["impressoras", "printer", "Impressoras"],
    ["financeiro", "wallet-cards", "Financeiro"],
    ["consignado", "store", "Consignado"],
    ["clientes", "users", "Clientes"],
    ["produtos", "boxes", "Produtos"],
    ["filamentos", "spool", "Filamentos"],
    ["custos", "calculator", "Custos"],
    ["orcamento", "file-text", "Orçamentos"],
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
    const paginaAtiva = pagina === "conferencia" ? "consignado" : pagina === "relatorios" ? "dashboard" : pagina;
    document.querySelectorAll("[data-drawer-page]").forEach(item => {
        item.classList.toggle("isActive", item.dataset.drawerPage === paginaAtiva);
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
    atualizarSyncStatusGlobal();
}

function atualizarSyncStatusGlobal() {
    const botao = document.getElementById("globalSyncStatus");
    if (!botao) return;

    const status = window.Sync?.getStatus?.() || window.PrimeSync?.getStatus?.() || window.PrimeSync?.getSyncStatus?.() || {};
    const estado = status.estado || (status.online === false ? "offline" : status.sincronizando ? "sincronizando" : Number(status.pendencias || 0) > 0 ? "pendente" : "sincronizado");
    const pendencias = Number(status.pendencias || 0);
    const dados = {
        sincronizado: ["cloud-check", "Sincronizado", "isSynced"],
        sincronizando: ["refresh-cw", "Sincronizando...", "isSyncing"],
        offline: ["cloud-off", "Offline", "isOffline"],
        pendente: ["cloud-upload", `${pendencias} pendências`, "isPending"],
        erro: ["triangle-alert", "Erro na nuvem", "isError"]
    }[estado] || ["cloud", "Nuvem", "isSynced"];

    botao.className = `globalSyncStatus ${dados[2]}`;
    botao.innerHTML = `<i data-lucide="${dados[0]}"></i><span>${escaparNavegacao(dados[1])}</span>`;
    botao.title = status.mensagemErro || dados[1];
    if (window.lucide) lucide.createIcons();
}

function abrirStatusSincronizacaoGlobal() {
    const status = window.Sync?.getStatus?.() || window.PrimeSync?.getStatus?.() || {};
    const estado = status.estado || (status.online === false ? "offline" : Number(status.pendencias || 0) ? "pendente" : "sincronizado");

    if (["offline", "pendente", "erro"].includes(estado)) {
        window.destacarSyncConfiguracoes = true;
        navegar("configuracoes");
        return;
    }

    Modal.abrir("Status da sincronização", `
        <div class="backupMetadata">
            <div><span>Status</span><strong>${escaparNavegacao(status.status || "Sincronizado")}</strong></div>
            <div><span>Última sincronização</span><strong>${escaparNavegacao(status.ultimaSincronizacao ? new Date(status.ultimaSincronizacao).toLocaleString("pt-BR") : "Ainda não sincronizado")}</strong></div>
            <div><span>Workspace</span><strong>${escaparNavegacao(status.workspaceId || "Não carregado")}</strong></div>
            <div><span>Pendências</span><strong>${Number(status.pendencias || 0)}</strong></div>
        </div>
        <div class="backupModalActions">
            <button class="btnSecondary" type="button" onclick="Modal.fechar()">Fechar</button>
            <button class="btn" type="button" onclick="Modal.fechar(); window.Sync?.syncAll?.()">Sincronizar agora</button>
        </div>
    `);
    lucide.createIcons();
}

function escaparNavegacao(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

window.addEventListener("primedocs:sync-status", atualizarSyncStatusGlobal);
window.addEventListener("online", atualizarSyncStatusGlobal);
window.addEventListener("offline", atualizarSyncStatusGlobal);

document.addEventListener("keydown", e => {
    if (e.key === "Escape") fecharDrawerPrimeDocs();
});
