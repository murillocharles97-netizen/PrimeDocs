const CACHE_VERSION = "primedocs-v64";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./assets/brand.svg",
    "./assets/brand.svg?v=2",
    "./assets/brand-symbol-white.svg",
    "./assets/brand-symbol-black.svg",
    "./assets/brand-symbol-purple.svg",
    "./assets/adaptive-background.svg",
    "./assets/favicon.ico",
    "./assets/favicon.ico?v=2",
    "./assets/favicon-32.png",
    "./assets/favicon-32.png?v=2",
    "./assets/apple-touch-icon.png",
    "./assets/apple-touch-icon.png?v=2",
    "./assets/icon-192.png",
    "./assets/icon-512.png",
    "./assets/icon-maskable-192.png",
    "./assets/icon-maskable-512.png",
    "./assets/icon-adaptive-foreground.png",
    "./assets/icon-adaptive-background.png",
    "./assets/icon-monochrome-512.png",
    "./assets/splash-icon-512.png",
    "./css/style.css",
    "./css/design-system.css",
    "./css/operations-center.css",
    "./css/operations-mobile.css",
    "./css/dashboard-premium.css",
    "./css/dashboard-mobile.css",
    "./css/pedidos-premium.css",
    "./css/pedidos-mobile.css",
    "./css/pedidos-editor-mobile.css",
    "./css/clientes-mobile.css",
    "./css/produtos-mobile.css",
    "./css/estoque-mobile.css",
    "./css/inventory.css",
    "./css/producao-premium.css",
    "./js/app.js",
    "./js/pdf.js",
    "./js/router.js",
    "./js/storage.js",
    "./js/utils.js",
    "./js/global-search.js",
    "./js/financeiro.js",
    "./js/calculadoraCustos.js",
    "./js/filamentos-integracao.js",
    "./js/producao.js",
    "./js/central-operacoes.js",
    "./js/operations-mobile.js",
    "./js/pedidos-premium.js",
    "./js/pedidos-mobile.js",
    "./js/pedidos-editor-mobile.js",
    "./js/clientes-mobile.js",
    "./js/produtos-mobile.js",
    "./js/estoque-mobile.js",
    "./js/inventory.js",
    "./js/dashboard-premium.js",
    "./js/dashboard-mobile.js",
    "./js/producao-premium.js",
    "./js/firebase.js",
    "./js/backup.js",
    "./js/sync.js",
    "./js/auth.js",
    "./js/config/app.js",
    "./js/config/categorias.js",
    "./js/config/menu.js",
    "./js/config/status.js",
    "./js/components/button.js",
    "./js/components/card.js",
    "./js/components/input.js",
    "./js/components/material-list-editor.js",
    "./js/components/modal.js",
    "./js/components/page.js",
    "./js/components/toast.js",
    "./js/components/navigation.js",
    "./pages/home.js",
    "./pages/dashboard.js",
    "./pages/produtos.js",
    "./pages/consignado.js",
    "./pages/lojas.js",
    "./pages/conferencia.js",
    "./pages/configuracoes.js",
    "./pages/orcamento.js",
    "./pages/filamentos.js",
    "./pages/custos.js",
    "./pages/pedidos.js",
    "./pages/producao.js",
    "./pages/impressoras.js",
    "./pages/clientes.js",
    "./pages/relatorios.js",
    "./pages/financeiro.js",
    "./assets/printers/generic-printer.svg",
    "./assets/printers/a1-mini.svg",
    "./assets/printers/a1.svg",
    "./assets/printers/enclosed-printer.svg"
];

const EXTERNAL_RESOURCES = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "https://unpkg.com/lucide@latest",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"
];

async function armazenarRecursosExternos() {
    const cache = await caches.open(RUNTIME_CACHE);

    await Promise.all(EXTERNAL_RESOURCES.map(async recurso => {
        try {
            const resposta = await fetch(recurso);

            if (resposta.ok || resposta.type === "opaque") {
                await cache.put(recurso, resposta);
            }
        } catch (erro) {
            // A instalação local continua; o recurso será armazenado na próxima conexão.
        }
    }));
}

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(APP_CACHE)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => armazenarRecursosExternos())
            .then(() => self.skipWaiting())
    );
});

async function ativarNovaVersao() {
    const chaves = await caches.keys();
    const haviaVersaoAnterior = chaves.some(chave =>
        chave.startsWith("primedocs-")
        && chave !== APP_CACHE
        && chave !== RUNTIME_CACHE
    );

    await Promise.all(
        chaves
            .filter(chave => chave.startsWith("primedocs-")
                && chave !== APP_CACHE
                && chave !== RUNTIME_CACHE)
            .map(chave => caches.delete(chave))
    );

    await self.clients.claim();

    if (!haviaVersaoAnterior) return;

    const janelas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
    });

    await Promise.allSettled(
        janelas.map(janela => janela.navigate(janela.url))
    );
}

self.addEventListener("activate", event => {
    event.waitUntil(ativarNovaVersao());
});

async function buscarRecursoLocal(requisicao) {
    try {
        const resposta = await fetch(requisicao);

        if (resposta?.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(requisicao, resposta.clone());
        }

        return resposta;
    } catch (erro) {
        return caches.match(requisicao, { ignoreSearch: true });
    }
}

async function buscarRecursoExterno(requisicao) {
    const respostaEmCache = await caches.match(requisicao);
    if (respostaEmCache) return respostaEmCache;

    const resposta = await fetch(requisicao);

    if (resposta && (resposta.ok || resposta.type === "opaque")) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(requisicao, resposta.clone());
    }

    return resposta;
}

self.addEventListener("fetch", event => {
    const requisicao = event.request;

    if (requisicao.method !== "GET") return;

    if (requisicao.mode === "navigate") {
        event.respondWith(
            fetch(requisicao)
                .then(resposta => {
                    const copia = resposta.clone();
                    caches.open(RUNTIME_CACHE)
                        .then(cache => cache.put("./index.html", copia));
                    return resposta;
                })
                .catch(() => caches.match("./index.html"))
        );
        return;
    }

    const url = new URL(requisicao.url);

    event.respondWith(
        url.origin === self.location.origin
            ? buscarRecursoLocal(requisicao)
            : buscarRecursoExterno(requisicao)
    );
});
