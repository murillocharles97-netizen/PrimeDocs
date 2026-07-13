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
const context = vm.createContext({
    console,
    localStorage,
    navigator: { onLine: false },
    crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` },
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Map,
    window: null
});
context.window = context;
context.Utils = { hoje: () => new Date().toISOString().slice(0, 10), moeda: valor => `R$ ${Number(valor || 0).toFixed(2)}` };

for (const arquivo of ["js/storage.js", "js/filamentos-integracao.js", "js/producao.js"]) {
    vm.runInContext(fs.readFileSync(arquivo, "utf8"), context, { filename: arquivo });
}
vm.runInContext("globalThis.__api={Storage,FilamentIntegration,Producao}", context);
const { Storage, FilamentIntegration, Producao } = context.__api;

function reset() { localStorage.clear(); }
function rolo(id, cor, peso = 1000, material = "PLA") {
    return FilamentIntegration.normalizarRolo({ id, codigo: id.toUpperCase(), material, cor, marca: "Teste", pesoInicialGramas: 1000, pesoAtualGramas: peso, precoKg: 80, alertaMinimoKg: .1, ativo: true });
}
function impressora(id, possuiAms = true, slots = 4) {
    return FilamentIntegration.normalizarImpressora({ id, nome: id, modelo: "A1 Mini", status: "livre", ativa: true, possuiAms, quantidadeSlotsAms: possuiAms ? slots : 0, materiaisPermitidos: ["PLA"], filaOperacoes: [] });
}
function producaoBase(materiais, id = "op-1") {
    Storage.salvarPedido({ id: "ped-1", clienteNome: "Cliente", statusPedido: "aprovado", itens: [], ativo: true });
    Storage.salvarOrdemProducao({ id: "ord-1", pedidoId: "ped-1", produtoNome: "Taça", clienteNome: "Cliente", quantidade: 1, status: "aguardando", ativo: true });
    Storage.salvarOperacaoProducao({ id, ordemProducaoId: "ord-1", pedidoId: "ped-1", produtoNome: "Taça", nome: "Impressão", tipo: "impressao", quantidade: 1, status: "aguardando", filamentosSelecionados: materiais.map((m, i) => ({ materialReceitaId: `mat-${i}`, material: "PLA", cor: m.cor, pesoPrevistoGramas: m.peso })), dependencias: [], tempoPrevistoMinutos: 60 });
}
function distribuicao(impId, ids) {
    return [{ impressoraId: impId, quantidade: 1, filamentosSelecionados: ids.map((id, i) => ({ materialReceitaId: `mat-${i}`, filamentoId: id })) }];
}

async function executar() {
    reset();
    Storage.salvarFilamento(rolo("ext", "Branco")); Storage.salvarImpressora(impressora("sem-ams", false));
    await FilamentIntegration.carregarRolo("sem-ams", "externo", 0, "ext");
    assert.equal(Storage.buscarImpressoraPorId("sem-ams").roloExternoId, "ext", "impressora sem AMS usa rolo externo");

    reset();
    const cores = ["Branco", "Preto", "Vermelho", "Azul"];
    cores.forEach((cor, i) => Storage.salvarFilamento(rolo(`r${i + 1}`, cor)));
    Storage.salvarImpressora(impressora("ams-4"));
    for (let i = 0; i < 4; i++) await FilamentIntegration.carregarRolo("ams-4", "ams", i + 1, `r${i + 1}`);
    assert.equal(Storage.buscarImpressoraPorId("ams-4").slotsAms.filter(s => s.filamentoId).length, 4, "AMS mantém quatro slots");
    Storage.salvarImpressora(impressora("outra-ams"));
    await assert.rejects(() => FilamentIntegration.carregarRolo("outra-ams", "ams", 1, "r1"), /outra impressora ou slot/i, "o mesmo rolo não ocupa dois locais");
    producaoBase(cores.map(cor => ({ cor, peso: 20 })));
    const analise = FilamentIntegration.analisarImpressora(Storage.buscarImpressoraPorId("ams-4"), Storage.buscarOperacaoProducaoPorId("op-1"));
    assert.equal(analise.todosCarregados, true, "operação multicolor encontra quatro cores carregadas");
    const lotesMulti = Producao.criarAlocacao("op-1", distribuicao("ams-4", ["r1", "r2", "r3", "r4"]));
    assert.equal(lotesMulti[0].status, "pronta_para_iniciar", "lote carregado fica pronto");

    reset();
    Storage.salvarFilamento(rolo("branco", "Branco")); Storage.salvarFilamento(rolo("vermelho", "Vermelho")); Storage.salvarImpressora(impressora("a1"));
    await FilamentIntegration.carregarRolo("a1", "ams", 1, "branco");
    producaoBase([{ cor: "Branco", peso: 60 }, { cor: "Vermelho", peso: 15 }]);
    const lotePreparacao = Producao.criarAlocacao("op-1", distribuicao("a1", ["branco", "vermelho"]))[0];
    assert.equal(lotePreparacao.status, "aguardando_preparacao", "cor disponível fora do AMS exige preparação");
    await FilamentIntegration.carregarRolo("a1", "ams", 2, "vermelho");
    Producao.confirmarPreparacaoLote(lotePreparacao.id);
    assert.equal(Storage.buscarLoteExecucaoPorId(lotePreparacao.id).status, "pronta_para_iniciar", "preparação validada libera início");

    reset();
    Storage.salvarFilamento(rolo("pouco", "Branco", 10)); Storage.salvarImpressora(impressora("a1")); producaoBase([{ cor: "Branco", peso: 60 }]);
    assert.equal(FilamentIntegration.analisarImpressora(Storage.buscarImpressoraPorId("a1"), Storage.buscarOperacaoProducaoPorId("op-1")).possuiEstoque, false, "saldo insuficiente não é estoque compatível");
    assert.throws(() => Producao.criarAlocacao("op-1", distribuicao("a1", ["pouco"])), /insuficiente/i, "reserva com peso insuficiente é bloqueada");

    reset();
    Storage.salvarFilamento(rolo("antigo", "Branco")); Storage.salvarFilamento(rolo("novo", "Branco")); Storage.salvarImpressora(impressora("a1"));
    await FilamentIntegration.carregarRolo("a1", "ams", 1, "antigo");
    Storage.salvarReservaFilamento({ id: "res-1", filamentoId: "antigo", loteExecucaoId: "lote-futuro", materialReceitaId: "mat-0", pesoReservadoGramas: 100, status: "ativa" });
    let conflito = false; try { await FilamentIntegration.carregarRolo("a1", "ams", 1, "novo"); } catch (erro) { conflito = erro.codigo === "RESERVAS_ATIVAS"; }
    assert.equal(conflito, true, "troca alerta reserva ativa");
    await FilamentIntegration.carregarRolo("a1", "ams", 1, "novo", { reservas: "mover" });
    assert.equal(Storage.listarReservasFilamento()[0].filamentoId, "novo", "reserva pode ser transferida");

    reset();
    Storage.salvarFilamento(rolo("consumo", "Branco", 100)); Storage.salvarImpressora(impressora("a1")); await FilamentIntegration.carregarRolo("a1", "ams", 1, "consumo"); producaoBase([{ cor: "Branco", peso: 100 }]);
    const lote = Producao.criarAlocacao("op-1", distribuicao("a1", ["consumo"]))[0]; await Producao.iniciarLoteExecucao(lote.id); Producao.concluirLoteExecucao(lote.id, { consumos: [{ materialReceitaId: "mat-0", pesoRealGramas: 100 }] });
    assert.equal(Storage.buscarFilamentoPorId("consumo").status, "vazio", "consumo real esvazia o rolo");
    assert.equal(Storage.buscarImpressoraPorId("a1").slotsAms[0].filamentoId, null, "rolo vazio sai do slot");
    assert(Storage.listarHistoricoFilamentos().some(e => e.tipo === "rolo_esvaziado"), "histórico registra esvaziamento");

    reset();
    Storage.salvarFilamento({ id: "legado", material: "PLA", cor: "Cinza", pesoTotalKg: 1, pesoAtualKg: .75, ativo: true }); Storage.salvarImpressora({ id: "legada", nome: "Legada", status: "livre", ativa: true });
    FilamentIntegration.migrarDados();
    assert.equal(Storage.buscarFilamentoPorId("legado").pesoAtualGramas, 750, "migração converte kg para gramas");
    assert.deepEqual(Storage.buscarImpressoraPorId("legada").slotsAms, [], "impressora antiga migra sem AMS");
    const css = fs.readFileSync("css/style.css", "utf8");
    assert(css.includes("@media(max-width:360px)") && css.includes("@media(max-width:430px)"), "CSS cobre celulares de 320–430 px");
    assert(css.includes("--color-surface") && css.includes("dark-mode"), "componentes usam tokens com tema escuro");
    assert(fs.readFileSync("js/filamentos-integracao.js", "utf8").includes("runTransaction"), "carga remota usa transação");
    console.log("OK: 13 cenários de integração cobertos (rolo externo, AMS, multicolor, preparação, saldo, reserva, consumo, migração, responsividade/temas por CSS e concorrência local/nuvem)." );
}

executar().catch(erro => { console.error(erro); process.exitCode = 1; });
