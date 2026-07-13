const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const produtos = [];
const toasts = [];
const campos = new Map();

function classe() {
    const valores = new Set();
    return { add: (...itens) => itens.forEach(item => valores.add(item)), remove: (...itens) => itens.forEach(item => valores.delete(item)), contains: item => valores.has(item) };
}

function campo(valor = "", extras = {}) {
    const grupo = { classList: classe(), appendChild() {} };
    return {
        value: String(valor), checked: false, classList: classe(), isConnected: true,
        closest: () => grupo, setAttribute() {}, removeAttribute() {}, scrollIntoView() {}, focus() {},
        matches: seletor => seletor.includes("input"), querySelector: () => null,
        ...extras
    };
}

function prepararCampos(produto, alteracoes = {}) {
    campos.clear();
    campos.set("nomeProduto", campo(alteracoes.nome ?? produto.nome));
    campos.set("codigoProduto", campo(alteracoes.codigo ?? produto.codigo));
    campos.set("categoria", campo(alteracoes.categoria ?? produto.categoria));
    campos.set("colecaoProdutoSelect", campo(alteracoes.colecaoId ?? produto.colecaoId ?? "colecao-geral"));
    campos.set("preco", campo(alteracoes.preco ?? produto.preco));
    campos.set("descricaoProduto", campo(alteracoes.descricao ?? produto.descricao));
    campos.set("favorito", campo("", { checked: alteracoes.favorito ?? produto.favorito }));
    campos.set("tempoSimplesHoras", campo(alteracoes.horas ?? 1));
    campos.set("tempoSimplesMinutos", campo(alteracoes.minutos ?? 0));
    const texto = { textContent: "Salvar Alterações" };
    campos.set("salvarProdutoButton", campo("", { querySelector: seletor => seletor === "span" ? texto : null, disabled: false }));
}

const document = {
    getElementById: id => campos.get(id) || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ className: "", textContent: "" })
};

const Storage = {
    listarFilamentos: () => [],
    carregarConfigCustos: () => ({ precoKgFilamentoPadrao: 85, custoEnergiaHora: .2, custoDepreciacaoHora: .5, valorMaoDeObraHora: 0, cobrarMaoDeObraPorPadrao: false, perdaPercentual: 5 }),
    salvarProduto(produto) { const index = produtos.findIndex(item => String(item.id) === String(produto.id)); if (index < 0) produtos.push(structuredClone(produto)); else produtos[index] = structuredClone(produto); },
    buscarProdutoPorId: id => produtos.find(item => String(item.id) === String(id)),
    listarProdutos: () => produtos,
    listarImpressoras: () => [],
    listarColecoesProdutos: () => [{ id: "colecao-geral", nome: "Geral", ativo: true }],
    garantirColecaoGeral: () => ({ id: "colecao-geral", nome: "Geral", ativo: true })
};

const MaterialListEditor = {
    normalizar: item => ({ id: item.id || "mat-1", material: item.material || "", cor: item.cor || "", pesoGramas: Math.max(0, Number(item.pesoGramas) || 0), filamentoPreferencialId: item.filamentoPreferencialId || "", slotAms: item.slotAms || "", obrigatorio: item.obrigatorio !== false }),
    calcularPesoTotalMateriais: lista => (lista || []).reduce((total, item) => total + Number(item.pesoGramas || 0), 0),
    calcularCustoMateriais: lista => (lista || []).reduce((total, item) => total + Number(item.pesoGramas || 0) / 1000 * 85, 0),
    validarMateriais(lista) { if (!lista?.length) return { valido: false, mensagem: "Adicione pelo menos um material à operação de impressão." }; return { valido: true, materiais: lista.map(this.normalizar), pesoTotal: this.calcularPesoTotalMateriais(lista) }; },
    obter: () => [], criar: () => ({})
};

const contexto = vm.createContext({
    console: { log: console.log, warn: console.warn, error() {} }, document, Storage, MaterialListEditor, structuredClone, Date, Math, JSON, Map, Set, setTimeout,
    window: null, app: { innerHTML: "" }, CATEGORIAS: ["Caixa", "Outro"],
    Utils: { gerarId: () => "novo", gerarCodigo: () => "CX1000", hoje: () => "2026-07-13", moeda: valor => `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}` },
    Producao: { TIPOS: { impressao: "Impressão" }, normalizarMaterial: item => item, normalizarOperacaoModelo: item => item, normalizarProduto: item => item, migrarDados() {} },
    Modal: { abrir() {}, fechar() {} }, Toast: { show: (texto, tipo) => toasts.push({ texto, tipo }) }, Page: { titulo: () => "" },
    Button: { primary: () => "" }, Input: {}, lucide: { createIcons() {} }, navegar() {}
});
contexto.window = contexto;
vm.runInContext(fs.readFileSync("pages/produtos.js", "utf8"), contexto, { filename: "pages/produtos.js" });
vm.runInContext("listarProdutos=()=>{}; globalThis.__produto={salvarProduto,calcularResumoTecnicoProduto};", contexto);

const base = { id: "p1", codigo: "CX001", nome: "Caixa", categoria: "Caixa", colecaoId: "colecao-geral", preco: 10, descricao: "Original", favorito: false, ativo: true, criadoEm: "2026-01-01", tipoProducao: "simples", materiais: [{ id: "m1", material: "PLA", cor: "Branco", pesoGramas: 15, obrigatorio: true }] };
produtos.push(structuredClone(base));

function salvar(alteracoes = {}, receita = base.materiais) {
    const atual = Storage.buscarProdutoPorId("p1");
    prepararCampos(atual, alteracoes);
    vm.runInContext(`produtoEditando=Storage.buscarProdutoPorId("p1"); tipoProducaoEdicao="simples"; materiaisSimplesEdicao=${JSON.stringify(receita)}; tempoSimplesMinutosEdicao=60; salvandoProduto=false;`, contexto);
    contexto.__produto.salvarProduto();
    const toast = toasts.at(-1);
    assert.deepEqual(toast, { texto: "Produto atualizado com sucesso.", tipo: "success" });
    return Storage.buscarProdutoPorId("p1");
}

assert.equal(salvar({ nome: "Caixa premium" }).nome, "Caixa premium", "salva alteração somente no nome");
assert.equal(salvar({ preco: 19.9 }).preco, 19.9, "salva alteração somente no preço");
assert.equal(salvar({ descricao: "Nova descrição" }).descricao, "Nova descrição", "salva alteração somente na descrição");
assert.equal(salvar({ favorito: true }).favorito, true, "salva alteração somente no favorito");
const receitaAtualizada = [{ id: "m1", material: "PETG", cor: "Roxo", pesoGramas: 25, obrigatorio: true }];
const comReceita = salvar({}, receitaAtualizada);
assert.equal(comReceita.peso, 25, "receita atualiza o peso calculado");
assert.equal(comReceita.cor, "Roxo", "receita atualiza a cor predominante derivada");
assert(comReceita.custo > 0 && comReceita.resumoProducao.custoEstimado === comReceita.custo, "receita atualiza custo e resumo técnico");
const combinado = salvar({ nome: "Produto final", preco: 30, descricao: "Completo", favorito: false }, [{ id: "m2", material: "PLA", cor: "Azul", pesoGramas: 20, obrigatorio: true }]);
assert.equal(combinado.nome, "Produto final"); assert.equal(combinado.preco, 30); assert.equal(combinado.descricao, "Completo"); assert.equal(combinado.favorito, false); assert.equal(combinado.peso, 20);

prepararCampos(combinado, { nome: "" });
vm.runInContext(`produtoEditando=Storage.buscarProdutoPorId("p1"); tipoProducaoEdicao="simples"; materiaisSimplesEdicao=${JSON.stringify(combinado.materiais)}; salvandoProduto=false;`, contexto);
contexto.__produto.salvarProduto();
assert.deepEqual(toasts.at(-1), { texto: "Informe o nome do produto.", tipo: "error" }, "campo obrigatório vazio informa o motivo exato");
const salvarOriginal = Storage.salvarProduto;
Storage.salvarProduto = () => { throw new Error("Armazenamento indisponível para teste."); };
prepararCampos(combinado);
vm.runInContext(`produtoEditando=Storage.buscarProdutoPorId("p1"); tipoProducaoEdicao="simples"; materiaisSimplesEdicao=${JSON.stringify(combinado.materiais)}; salvandoProduto=false;`, contexto);
contexto.__produto.salvarProduto();
assert.deepEqual(toasts.at(-1), { texto: "Armazenamento indisponível para teste.", tipo: "error" }, "falha real não é ocultada nem gera falso sucesso");
Storage.salvarProduto = salvarOriginal;

const fonte = fs.readFileSync("pages/produtos.js", "utf8");
assert(!/id="(?:custo|peso|cor)"/.test(fonte), "campos técnicos manuais foram removidos do formulário");
assert(fonte.includes("resumoAutomaticoProduto") && fonte.includes("descricaoProduto") && fonte.includes("codigoProduto"), "formulário contém resumo, descrição e SKU");
const css = fs.readFileSync("css/style.css", "utf8");
assert(css.includes("productEditorModal") && css.includes("@media(max-width:390px)") && css.includes(".toast.success") && css.includes(".toast.error"), "editor cobre celular, temas e feedback visual");

console.log("OK: cadastro de produtos validado — alterações isoladas/combinadas, receita calculada, campos limpos, feedback e responsividade.");
