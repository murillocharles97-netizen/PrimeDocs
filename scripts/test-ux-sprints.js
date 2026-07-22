const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const memory = new Map();
const localStorage = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key),
    clear: () => memory.clear()
};
const context = vm.createContext({ console, localStorage, navigator: { onLine: false }, crypto: { randomUUID: () => `uuid-${Math.random()}` }, setTimeout, clearTimeout, Date, Math, JSON, Map, Set, window: null });
context.window = context;
context.Utils = { hoje: () => "2026-07-13", moeda: valor => `R$ ${Number(valor || 0).toFixed(2)}` };
for (const arquivo of ["js/storage.js", "js/producao.js"]) vm.runInContext(fs.readFileSync(arquivo, "utf8"), context, { filename: arquivo });
vm.runInContext("globalThis.__api={Storage,Producao}", context);
const { Storage, Producao } = context.__api;

Storage.salvarProduto({ id: "p-antigo", nome: "Produto legado", categoria: "Geral", preco: 10, estoque: 2, ativo: true });
const migracao = Storage.migrarColecoesProdutos();
const geral = Storage.buscarColecaoGeral();
assert(geral && migracao.produtosMigrados === 1, "cria Geral e migra produto sem coleção");
assert.equal(Storage.buscarProdutoPorId("p-antigo").colecaoId, geral.id, "produto legado preservado em Geral");

const chaveiros = Storage.salvarColecaoProduto({ nome: "Chaveiros", icone: "key-round", cor: "#22D3EE" });
Storage.salvarProduto({ ...Storage.buscarProdutoPorId("p-antigo"), colecaoId: chaveiros.id });
assert.equal(Storage.buscarColecaoProdutoPorId(chaveiros.id).nome, "Chaveiros", "coleção pode ser cadastrada");
assert.equal(Storage.buscarProdutoPorId("p-antigo").colecaoId, chaveiros.id, "produto pode pertencer à coleção");
assert(Storage.obterTodosDados().colecoesProdutos.length >= 2, "backup inclui coleções");

Storage.salvarProduto({
    id: "p-estoque", nome: "Peça estoque", categoria: "Geral", colecaoId: geral.id, preco: 15,
    estoque: 4, ativo: true, tipoProducao: "composta",
    operacoesModelo: [{ id: "montar", nome: "Montar peça", tipo: "montagem", ordem: 0, quantidadePorProduto: 1, tempoMinutos: 5, materiais: [], dependencias: [] }]
});
const ordem = Producao.criarOrdemParaEstoque("p-estoque", 3);
assert.equal(ordem.origem, "estoque", "ordem identifica produção para estoque");
assert(ordem.pedidoId && ordem.itemPedidoId, "produção de estoque possui origem e item rastreáveis");
assert.equal(Storage.buscarPedidoPorId(ordem.pedidoId).tipoPedido, "estoque_interno", "demanda interna de estoque não vira pedido comercial");
assert.equal(Storage.buscarPedidoPorId(ordem.pedidoId).visivel, false, "demanda interna permanece invisível na operação comercial");
assert.equal(Storage.listarLancamentosFinanceiros().length, 0, "produção de estoque não cria financeiro");
const operacao = Storage.listarOperacoesProducao().find(item => item.ordemProducaoId === ordem.id);
Producao.iniciarOperacaoManual(operacao.id);
Producao.concluirOperacaoManual(operacao.id);
assert.equal(Storage.buscarProdutoPorId("p-estoque").estoque, 7, "conclusão aumenta estoque automaticamente");
Producao.atualizarHierarquia(operacao.id);
assert.equal(Storage.buscarProdutoPorId("p-estoque").estoque, 7, "estoque não é somado duas vezes");

const busca = fs.readFileSync("js/global-search.js", "utf8");
assert(busca.includes("globalSearchModal") && busca.includes("Consignado") && busca.includes("Produção para estoque"), "pesquisa global cobre modal e novas origens");
const produtosUI = fs.readFileSync("pages/produtos.js", "utf8");
assert(produtosUI.includes("productCollectionsGrid") && produtosUI.includes("colecaoProdutoSelect") && produtosUI.includes("Mais lucrativos"), "Produtos abre por coleções e oferece filtros");
const producaoUI = fs.readFileSync("pages/producao.js", "utf8");
assert(producaoUI.includes("Nova produção") && producaoUI.includes("Produzir para estoque") && producaoUI.includes("abrirModalAlocarOperacao"), "Produção oferece fluxo para estoque reutilizando alocação");
assert(fs.readFileSync("pages/impressoras.js", "utf8").includes('ordem.origem==="estoque"'), "painel de impressoras identifica produção para estoque sem pedido nulo");
const css = fs.readFileSync("css/style.css", "utf8");
assert(css.includes(".globalSearchModal") && css.includes(".productCollectionsGrid") && css.includes("@media(max-width:390px)"), "novas telas possuem tratamento responsivo");

console.log("OK: UX 1–3 validado — busca mobile, coleções/migração/backup e produção para estoque idempotente.");
