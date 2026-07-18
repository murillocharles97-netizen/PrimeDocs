(function () {
    "use strict";

    const STORAGE_KEY = "primedocs_inventory_active_section";
    const LEGACY_STORAGE_KEY = "primedocs_mobile_inventory_section";
    const mediaMobile = window.matchMedia("(max-width: 767px)");
    const renderProdutosExistente = window.renderProdutos;
    const renderFilamentosExistente = window.renderFilamentos;
    const cacheDesktop = { produtos: null, filamentos: null };
    const scrollDesktop = { produtos: 0, filamentos: 0 };
    let secaoAtiva = "produtos";
    let renderizando = false;

    function normalizarSecao(valor) {
        const chave = String(valor || "").toLowerCase();
        if (["products", "product", "produto", "produtos"].includes(chave)) return "produtos";
        if (["filaments", "filament", "filamento", "filamentos"].includes(chave)) return "filamentos";
        return "";
    }

    function secaoQuery(secao) {
        return secao === "filamentos" ? "filaments" : "products";
    }

    function podeAcessar(secao) {
        const permissao = secao === "produtos" ? "produtos" : "filamentos";
        const servico = window.PrimePermissions || window.Permissions || window.Permissoes;
        const verificador = servico?.podeAcessar || servico?.canAccess || servico?.temPermissao;
        if (typeof verificador !== "function") return true;
        try { return verificador.call(servico, permissao) !== false; } catch (_) { return false; }
    }

    function secoesDisponiveis() {
        return ["produtos", "filamentos"].filter(podeAcessar);
    }

    function secaoSalva() {
        return normalizarSecao(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    }

    function resolverSecao(solicitada = "") {
        const disponiveis = secoesDisponiveis();
        if (!disponiveis.length) return "";
        const candidata = normalizarSecao(solicitada);
        if (candidata && disponiveis.includes(candidata)) return candidata;
        const salva = secaoSalva();
        if (salva && disponiveis.includes(salva)) return salva;
        return disponiveis.includes("produtos") ? "produtos" : disponiveis[0];
    }

    function salvarSecao(secao) {
        if (!secao) return;
        localStorage.setItem(STORAGE_KEY, secao);
        localStorage.setItem(LEGACY_STORAGE_KEY, secao);
    }

    function parametrosAtuais() {
        try { return new URL(window.location.href); } catch (_) { return null; }
    }

    function atualizarUrl(secao, modo = "replace") {
        const url = parametrosAtuais();
        if (!url || !window.history?.replaceState) return;
        url.searchParams.set("page", "estoque");
        url.searchParams.set("section", secaoQuery(secao));
        const metodo = modo === "push" && window.history.pushState ? "pushState" : "replaceState";
        window.history[metodo]({ pagina: "estoque", section: secaoQuery(secao) }, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function limparUrl() {
        const url = parametrosAtuais();
        if (!url || url.searchParams.get("page") !== "estoque" || !window.history?.replaceState) return;
        url.searchParams.delete("page");
        url.searchParams.delete("section");
        const busca = url.searchParams.toString();
        window.history.replaceState({}, "", `${url.pathname}${busca ? `?${busca}` : ""}${url.hash}`);
    }

    function navegacaoInicial() {
        const url = parametrosAtuais();
        if (!url) return null;
        const pagina = String(url.searchParams.get("page") || "").toLowerCase();
        const segmento = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
        const aliases = { estoque: "", inventory: "", produtos: "produtos", products: "produtos", filamentos: "filamentos", filaments: "filamentos" };
        if (!(pagina in aliases) && !(segmento in aliases)) return null;
        const alias = pagina in aliases ? aliases[pagina] : aliases[segmento];
        return { pagina: "estoque", opcoes: { section: normalizarSecao(url.searchParams.get("section")) || alias || secaoSalva() } };
    }

    function cabecalhoDesktop() {
        const tabs = secoesDisponiveis().map(secao => `<button type="button" role="tab" aria-selected="${secaoAtiva === secao}" class="${secaoAtiva === secao ? "isActive" : ""}" onclick="InventoryPage.setSection('${secao}')"><i data-lucide="${secao === "produtos" ? "boxes" : "spool"}"></i>${secao === "produtos" ? "Produtos" : "Filamentos"}</button>`).join("");
        return `<main class="inventoryDesktopPage"><header class="inventoryDesktopHeader"><div><span>GESTÃO DE ESTOQUE</span><h1>Estoque</h1><p>Gerencie produtos e filamentos da sua produção.</p></div></header><div class="inventoryDesktopTabs" role="tablist" aria-label="Seção do estoque">${tabs}</div><section class="inventorySectionContent inventorySection-${secaoAtiva}" data-inventory-section="${secaoAtiva}"></section></main>`;
    }

    function prepararConteudoDesktop(secao, alvo) {
        alvo.classList.toggle("inventoryProductsContent", secao === "produtos");
        alvo.classList.toggle("inventoryFilamentsContent", secao === "filamentos");
        alvo.querySelector(":scope > .back")?.remove();
        alvo.querySelector(":scope > .filamentsPage > .back")?.remove();
        alvo.querySelector(".productPageHeading > div:first-child")?.classList.add("inventoryEmbeddedTitle");
        alvo.querySelector(".filamentPageHeading > div:first-child")?.classList.add("inventoryEmbeddedTitle");
    }

    function guardarDesktopAtual() {
        if (mediaMobile.matches) return;
        const alvo = document.querySelector("#content .inventorySectionContent");
        if (!alvo || !secaoAtiva) return;
        const fragmento = document.createDocumentFragment();
        while (alvo.firstChild) fragmento.appendChild(alvo.firstChild);
        cacheDesktop[secaoAtiva] = fragmento;
        scrollDesktop[secaoAtiva] = window.scrollY;
    }

    function montarConteudo(secao, html) {
        if (mediaMobile.matches || secaoAtiva !== secao) return false;
        const alvo = document.querySelector("#content .inventorySectionContent");
        if (!alvo) return false;
        alvo.innerHTML = html;
        cacheDesktop[secao] = null;
        prepararConteudoDesktop(secao, alvo);
        return true;
    }

    function renderDesktop(secao, restaurarScroll = true) {
        const content = document.getElementById("content");
        if (!content) return;
        content.innerHTML = cabecalhoDesktop();
        const alvo = content.querySelector(".inventorySectionContent");
        const guardado = cacheDesktop[secao];
        if (guardado?.childNodes?.length) {
            alvo.appendChild(guardado);
            cacheDesktop[secao] = null;
            prepararConteudoDesktop(secao, alvo);
        } else {
            renderizando = true;
            try { (secao === "produtos" ? renderProdutosExistente : renderFilamentosExistente)?.(); }
            finally { renderizando = false; }
            prepararConteudoDesktop(secao, content.querySelector(".inventorySectionContent") || alvo);
        }
        if (restaurarScroll) requestAnimationFrame(() => window.scrollTo({ top: scrollDesktop[secao] || 0, behavior: "auto" }));
        window.lucide?.createIcons?.();
    }

    function semPermissao() {
        const content = document.getElementById("content");
        if (!content) return;
        content.innerHTML = `<main class="inventoryPermissionEmpty"><i data-lucide="shield-x"></i><h1>Estoque</h1><strong>Área indisponível</strong><p>Seu usuário não possui acesso a Produtos ou Filamentos.</p></main>`;
        window.lucide?.createIcons?.();
    }

    function render(secaoSolicitada = "", opcoes = {}) {
        const proxima = resolverSecao(secaoSolicitada);
        if (!proxima) return semPermissao();
        secaoAtiva = proxima;
        salvarSecao(secaoAtiva);
        atualizarUrl(secaoAtiva, opcoes.history || "replace");
        if (mediaMobile.matches) window.MobileInventory?.renderSection?.(secaoAtiva, opcoes.restaurarScroll !== false);
        else renderDesktop(secaoAtiva, opcoes.restaurarScroll !== false);
    }

    function setSection(secao) {
        const proxima = resolverSecao(secao);
        if (!proxima || proxima === secaoAtiva) return;
        if (mediaMobile.matches) window.MobileInventory?.captureScroll?.();
        else guardarDesktopAtual();
        secaoAtiva = proxima;
        salvarSecao(secaoAtiva);
        atualizarUrl(secaoAtiva, "push");
        if (mediaMobile.matches) window.MobileInventory?.renderSection?.(secaoAtiva, true);
        else renderDesktop(secaoAtiva, true);
        if (typeof atualizarNavegacaoAtivaPrimeDocs === "function") atualizarNavegacaoAtivaPrimeDocs("estoque");
    }

    function refresh(secao = secaoAtiva) {
        const alvo = resolverSecao(secao);
        cacheDesktop[alvo] = null;
        if (alvo === secaoAtiva) render(alvo, { restaurarScroll: true, history: "replace" });
    }

    function abrir(secao, opcoes = {}) {
        if (typeof window.navegar === "function") navegar("estoque", { ...opcoes, section: normalizarSecao(secao) || resolverSecao() });
    }

    function deixar(pagina) {
        if (!["estoque", "produtos", "filamentos", "inventory", "products", "filaments"].includes(String(pagina || "").toLowerCase())) limparUrl();
    }

    const api = { render, setSection, open: abrir, refresh, leave: deixar, activeSection: () => secaoAtiva, availableSections: secoesDisponiveis, normalizeSection: normalizarSecao, initialNavigation: navegacaoInicial, mountSectionContent: montarConteudo, isRendering: () => renderizando };
    window.InventoryPage = api;
    window.renderInventorySectionContent = montarConteudo;

    mediaMobile.addEventListener?.("change", () => {
        if (window.rotaAtual === "estoque") render(secaoAtiva, { restaurarScroll: false, history: "replace" });
    });

    window.addEventListener("popstate", () => {
        const inicial = navegacaoInicial();
        if (inicial && window.rotaAtual === "estoque") render(inicial.opcoes.section, { restaurarScroll: true, history: "replace" });
    });
})();
