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

    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .catch(erro => console.error("Falha ao registrar o service worker.", erro));
    });
}

carregarTemaPrimeDocs();
registrarServiceWorkerPrimeDocs();

if (window.lucide) {
    lucide.createIcons();
}

document.addEventListener("DOMContentLoaded",()=>{

setTimeout(()=>{

document.getElementById("splash").style.display="none";

document.getElementById("app").style.display="block";

navegar("home");

},1800);

});
