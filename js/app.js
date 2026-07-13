const TEMA_PRIMEDOCS_KEY = "primedocs_tema";

function aplicarTemaPrimeDocs(tema) {
    const temaFinal = tema === "dark" ? "dark" : "light";

    document.body.classList.toggle("dark-mode", temaFinal === "dark");
    document.body.classList.toggle("light-mode", temaFinal === "light");
    document.documentElement.dataset.theme = temaFinal;

    const metaTema = document.getElementById("themeColorMeta");
    if (metaTema) {
        metaTema.setAttribute("content", temaFinal === "dark" ? "#070B1F" : "#6D5DFD");
    }

    const botao = document.getElementById("themeToggle");
    if (botao) {
        botao.setAttribute(
            "aria-label",
            temaFinal === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
        );
    }
}

function carregarTemaPrimeDocs() {
    const temaSalvo = localStorage.getItem(TEMA_PRIMEDOCS_KEY);
    const prefereEscuro = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    aplicarTemaPrimeDocs(temaSalvo || (prefereEscuro ? "dark" : "light"));
}

function alternarTemaPrimeDocs() {
    const novoTema = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem(TEMA_PRIMEDOCS_KEY, novoTema);
    aplicarTemaPrimeDocs(novoTema);
}

function registrarServiceWorkerPrimeDocs() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
        try {
            const registro = await navigator.serviceWorker.register(
                "./service-worker.js",
                { updateViaCache: "none" }
            );

            await registro.update();
        } catch (erro) {
            console.error("Falha ao registrar o service worker.", erro);
        }
    });
}

function renderizarERPPrimeDocs() {
    document.getElementById("splash").style.display = "none";
    document.getElementById("authScreen")?.remove();
    document.getElementById("app").style.display = "block";

    Storage.migrarColecoesProdutos?.();
    renderNavegacaoPrimeDocs();
    Financeiro.sincronizar();
    gerarNotificacoesOperacionais();
    navegar("home");

    console.log("[PrimeDocs] App renderizado");
}

function renderizarErroAutenticacaoPrimeDocs() {
    document.getElementById("splash").style.display = "none";
    document.getElementById("app").style.display = "none";

    let tela = document.getElementById("authScreen");
    if (!tela) {
        tela = document.createElement("main");
        tela.id = "authScreen";
        document.body.appendChild(tela);
    }

    tela.innerHTML = `
        <section class="authLoading authErrorState">
            <div class="brandMark brandMarkLarge"><i data-lucide="triangle-alert"></i></div>
            <strong>Erro ao carregar autenticação.</strong>
            <span>Recarregue a página. Se continuar, limpe o cache do aplicativo no navegador/celular.</span>
            <button class="btn" type="button" onclick="location.reload()">Recarregar página</button>
        </section>
    `;

    if (window.lucide) lucide.createIcons();
}

carregarTemaPrimeDocs();
registrarServiceWorkerPrimeDocs();

if (window.lucide) {
    lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("app").style.display = "none";

    if (!window.PrimeAuth) {
        console.error("[PrimeDocs] Auth não carregado. O ERP não será aberto sem autenticação.");
        renderizarErroAutenticacaoPrimeDocs();
        return;
    }

    PrimeAuth.iniciar(renderizarERPPrimeDocs);
});
