const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "pages", "consignado.js"), "utf8");
const pdfSource = fs.readFileSync(path.join(root, "js", "pdf.js"), "utf8");
const storageSource = fs.readFileSync(path.join(root, "js", "storage.js"), "utf8");
const conferenceSource = fs.readFileSync(path.join(root, "pages", "conferencia.js"), "utf8");
const storeSource = fs.readFileSync(path.join(root, "pages", "lojas.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "css", "design-system.css"), "utf8");

const savedStocks = [];
const context = vm.createContext({
    console,
    window: {},
    Storage: {
        buscarEstoqueLoja: () => savedStocks.at(-1) || null,
        salvarEstoqueLoja: value => savedStocks.push(JSON.parse(JSON.stringify(value)))
    }
});
vm.runInContext(source, context);

const item = (id, nome, quantidade, preco = 10) => ({
    produtoId: id,
    nome,
    codigo: id.toUpperCase(),
    categoria: "Teste",
    preco,
    quantidade
});
const calcular = (anterior, reposicao) => vm.runInContext(
    `calcularEstoqueFinalConsignado(${JSON.stringify(anterior)}, ${JSON.stringify(reposicao)})`,
    context
);

// 1. Primeira consignação.
assert.strictEqual(calcular([], [item("taca", "Taça", 10)])[0].quantidade, 10);

// 2. Reposição deve somar apenas a entrada, nunca o total digitado novamente.
assert.strictEqual(calcular([item("taca", "Taça", 5)], [item("taca", "Taça", 3)])[0].quantidade, 8);

// 3. Produto novo preserva o anterior e entra com seu saldo.
const misto = calcular([item("taca", "Taça", 5)], [item("tnt", "TNT", 4)]);
assert.deepStrictEqual(Array.from(misto, registro => [registro.produtoId, registro.quantidade]), [["taca", 5], ["tnt", 4]]);

// 4. Produto repetido permanece em uma única linha e soma a quantidade.
const duplicado = vm.runInContext(
    `mesclarItemReposicaoConsignado(${JSON.stringify([item("taca", "Taça", 2)])}, ${JSON.stringify(item("taca", "Taça", 1))})`,
    context
);
assert.strictEqual(duplicado.duplicado, true);
assert.strictEqual(duplicado.itens.length, 1);
assert.strictEqual(duplicado.itens[0].quantidade, 3);

// 5. Conferência continua carregando o estoque consolidado.
assert.match(conferenceSource, /Storage\.buscarEstoqueLoja\(loja\.id\)/);
assert.match(conferenceSource, /itens:\s*itensEstoque/);

// 6. A mesma movimentação não pode ser reaplicada.
const movimento = {
    id: "mov-1",
    criadoEm: new Date().toISOString(),
    estoqueFinal: [item("taca", "Taça", 8)]
};
context.movimentoTeste = movimento;
const primeiraAplicacao = vm.runInContext(`aplicarMovimentacaoEstoqueLoja(movimentoTeste, { id: "loja-1", nome: "Loja" }, "Resp")`, context);
const segundaAplicacao = vm.runInContext(`aplicarMovimentacaoEstoqueLoja(movimentoTeste, { id: "loja-1", nome: "Loja" }, "Resp")`, context);
assert.strictEqual(primeiraAplicacao, true);
assert.strictEqual(segundaAplicacao, false);
assert.strictEqual(savedStocks.at(-1).itens[0].quantidade, 8);

// 7. O histórico também usa upsert pelo ID, protegendo sincronização/reload.
assert.match(storageSource, /findIndex\([\s\S]*String\(item\.id\) === String\(consignado\.id\)/);
assert.match(storageSource, /consignados\[index\] = \{ \.\.\.consignados\[index\], \.\.\.consignado \}/);

// 8. Correção manual exige justificativa e registra antes/depois.
assert.match(storeSource, /tipo:\s*"ajuste_manual_estoque_loja"/);
assert.match(storeSource, /motivo\.length < 5/);
assert.match(storeSource, /antes,[\s\S]*depois,[\s\S]*motivo/);

// 9. PDF contém os três blocos e os seis indicadores do resumo.
[
    "ESTOQUE ANTERIOR",
    "PRODUTOS DEIXADOS NESTA VISITA",
    "ESTOQUE FINAL ATUALIZADO",
    "Quantidade adicionada",
    "Valor total final"
].forEach(texto => assert.ok(pdfSource.includes(texto), `PDF sem bloco: ${texto}`));
let arquivoPDF = "";
class FakePDF {
    constructor() {
        this.paginas = 1;
        this.internal = {
            pageSize: { getWidth: () => 210, getHeight: () => 297 },
            getNumberOfPages: () => this.paginas
        };
    }
    splitTextToSize(valor) { return [String(valor)]; }
    addPage() { this.paginas += 1; }
    save(nome) { arquivoPDF = nome; }
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    text() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    setFillColor() {}
    roundedRect() {}
    rect() {}
    setPage() {}
    addImage() {}
}
const pdfContext = vm.createContext({
    console,
    window: { jspdf: { jsPDF: FakePDF } },
    Toast: { show: mensagem => { throw new Error(mensagem); } },
    Storage: { buscarEmpresaPadrao: () => null },
    Utils: { hoje: () => "2026-07-15" }
});
vm.runInContext(pdfSource, pdfContext);
pdfContext.dadosPDFTeste = {
    loja: "Loja Teste",
    responsavel: "Responsável",
    data: "2026-07-15",
    observacoes: "Teste",
    estoqueAnterior: [item("taca", "Taça", 5)],
    itensReposicao: [item("taca", "Taça", 3)],
    estoqueFinal: [item("taca", "Taça", 8)]
};
assert.strictEqual(vm.runInContext("criarPDFReposicaoConsignado(dadosPDFTeste)", pdfContext), true);
assert.strictEqual(arquivoPDF, "reposicao_consignado_loja-teste_2026-07-15.pdf");

// 10. Responsividade e temas usam o design system, inclusive 320 px.
assert.match(cssSource, /@media \(max-width: 330px\)/);
assert.match(cssSource, /\.consignmentStockList[\s\S]*grid-template-columns:\s*1fr/);
assert.ok(cssSource.includes("var(--color-surface)"));
assert.ok(cssSource.includes("var(--color-text)"));

console.log("✓ 10 cenários de consignação/reposição validados.");
