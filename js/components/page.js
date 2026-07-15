const Page={

titulo(titulo,subtitulo=""){

const texto = String(titulo || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
const normalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const icones = [
    ["produc", "factory"], ["produto", "boxes"], ["filamento", "spool"],
    ["impressora", "printer"], ["cliente", "users"], ["finance", "wallet-cards"],
    ["consign", "store"], ["conferencia", "badge-check"], ["pedido", "package"],
    ["orcamento", "file-text"], ["custo", "calculator"], ["configura", "settings"],
    ["loja", "store"], ["relatorio", "chart-no-axes-combined"]
];
const icone = icones.find(([chave]) => normalizado.includes(chave))?.[1] || "blocks";

return`

<div class="welcome pageTitleHeader">

<span class="pageTitleIcon" aria-hidden="true"><i data-lucide="${icone}"></i></span>

<div class="pageTitleCopy">

<h2>${texto}</h2>

<p>${subtitulo}</p>

</div>

</div>

`;

}

}
