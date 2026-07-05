const CACHE_VERSION = "primedocs-v7";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./assets/brand.svg",
    "./assets/icon-192.png",
    "./assets/icon-512.png",
    "./assets/icon-maskable-512.png",
    "./css/style.css",
    "./js/app.js",
    "./js/pdf.js",
    "./js/router.js",
    "./js/storage.js",
    "./js/utils.js",
    "./js/calculadoraCustos.js",
    "./js/config/app.js",
    "./js/config/categorias.js",
    "./js/config/menu.js",
    "./js/config/status.js",
    "./js/components/button.js",
    "./js/components/card.js",
    "./js/components/input.js",
    "./js/components/modal.js",
    "./js/components/page.js",
    "./js/components/toast.js",
    "./pages/home.js",
    "./pages/produtos.js",
    "./pages/consignado.js",
    "./pages/lojas.js",
    "./pages/conferencia.js",
    "./pages/configuracoes.js",
    "./pages/orcamento.js",
    "./pages/filamentos.js",
    "./pages/custos.js",
    "./pages/pedidos.js"
];

const EXTERNAL_RESOURCES = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "https://unpkg.com/lucide@latest"
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
