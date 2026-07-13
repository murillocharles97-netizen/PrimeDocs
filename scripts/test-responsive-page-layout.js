const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("css/style.css", "utf8");
const producao = fs.readFileSync("pages/producao.js", "utf8");
const filamentos = fs.readFileSync("pages/filamentos.js", "utf8");

assert(producao.includes('class="productionPage"'), "Produção possui contêiner raiz isolado");
assert(filamentos.includes('class="filamentsPage"'), "Filamentos possui contêiner raiz isolado");
assert(css.includes(".productionPage,.filamentsPage{width:100%;max-width:100%;min-width:0"), "contêineres ocupam toda a largura disponível");
assert(css.includes(".productionPageHeading>.productionNewButton,.filamentPageHeading>.btn{flex:0 0 auto;width:auto"), "botões do cabeçalho neutralizam a largura global de 100%");
assert(css.includes(".productionPageHeading>.welcome,.filamentPageHeading>div{flex:1 1 auto;width:auto"), "títulos crescem sem serem comprimidos");
assert(css.includes("word-break:normal;overflow-wrap:break-word"), "títulos mantêm quebra por palavras");
assert(css.includes("@media(max-width:700px)") && css.includes("@media(max-width:390px)") && css.includes("@media(max-width:320px)"), "breakpoints mobile permanecem cobertos");
assert(!css.includes("outline:1px solid red") && !css.includes("outline: 1px solid red"), "CSS não contém marcações temporárias de debug");

console.log("OK: layouts de Produção e Filamentos protegidos contra compressão e preparados para mobile/desktop.");
