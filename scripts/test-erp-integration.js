const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const dados = {
    pedidos: [], produtos: [], clientes: [], ordens: [], operacoes: [], lotes: [],
    reservas: [], impressoras: [], filamentos: [], historico: []
};
const salvar = (lista, registro) => {
    const indice = lista.findIndex(item => String(item.id) === String(registro.id));
    if (indice >= 0) lista[indice] = JSON.parse(JSON.stringify(registro));
    else lista.push(JSON.parse(JSON.stringify(registro)));
    return registro;
};
const buscar = (lista, id) => lista.find(item => String(item.id) === String(id));

global.window = global;
global.CustomEvent = class { constructor(tipo, opcoes) { this.type = tipo; this.detail = opcoes?.detail; } };
global.dispatchEvent = () => true;
global.Financeiro = { sincronizar() {} };
global.gerarNotificacoesOperacionais = () => {};
global.Storage = {
    listarPedidos: () => dados.pedidos, buscarPedidoPorId: id => buscar(dados.pedidos, id), salvarPedido: item => salvar(dados.pedidos, item),
    listarProdutos: () => dados.produtos, buscarProdutoPorId: id => buscar(dados.produtos, id), salvarProduto: item => salvar(dados.produtos, item),
    listarClientes: () => dados.clientes, buscarClientePorId: id => buscar(dados.clientes, id), salvarCliente: item => salvar(dados.clientes, item),
    listarOrdensProducao: () => dados.ordens, salvarOrdemProducao: item => salvar(dados.ordens, item),
    listarOperacoesProducao: () => dados.operacoes, salvarOperacaoProducao: item => salvar(dados.operacoes, item),
    listarLotesExecucao: () => dados.lotes, salvarLoteExecucao: item => salvar(dados.lotes, item),
    listarReservasFilamento: () => dados.reservas, salvarReservaFilamento: item => salvar(dados.reservas, item),
    listarImpressoras: () => dados.impressoras, buscarImpressoraPorId: id => buscar(dados.impressoras, id), salvarImpressora: item => salvar(dados.impressoras, item),
    listarFilamentos: () => dados.filamentos, salvarFilamento: item => salvar(dados.filamentos, item),
    registrarHistoricoProducao: evento => dados.historico.push(evento)
};
global.Producao = {
    migrarDados() {},
    criarOrdensDoPedido(pedidoId, ids) {
        ids.forEach((itemId, indice) => dados.ordens.push({ id: `ord-${indice}`, pedidoId, itemPedidoId: itemId, produtoId: buscar(dados.pedidos, pedidoId).itens.find(i => i.id === itemId)?.produtoId || null, quantidade: 2, produzido: 0, status: "aguardando", ativo: true }));
    }
};

vm.runInThisContext(fs.readFileSync("js/erp-integracao.js", "utf8"));
let aprovados = 0;
const teste = (nome, fn) => { fn(); aprovados += 1; console.log(`✓ ${nome}`); };
const reset = () => Object.values(dados).forEach(lista => lista.splice(0));

teste("iniciar produção cria ordens ligadas a pedido e item", () => {
    reset();
    dados.produtos.push({ id: "prod-1", ativo: true, custo: 3 });
    dados.pedidos.push({ id: "ped-1", ativo: true, statusPedido: "aprovado", itens: [{ id: "item-1", produtoId: "prod-1", nome: "Peça", quantidade: 2 }] });
    ERPIntegracao.alterarStatusPedido("ped-1", "em_producao");
    assert.equal(dados.pedidos[0].statusPedido, "em_producao");
    assert.equal(dados.ordens[0].orderId, "ped-1");
    assert.equal(dados.ordens[0].orderItemId, "item-1");
    assert.equal(dados.ordens[0].restante, 2);
});

teste("pedido não fica pronto enquanto houver produção pendente", () => {
    assert.throws(() => ERPIntegracao.alterarStatusPedido("ped-1", "pronto"), erro => erro.codigo === "PRODUCAO_PENDENTE");
    dados.ordens[0].status = "concluida";
    ERPIntegracao.alterarStatusPedido("ped-1", "pronto");
    ERPIntegracao.alterarStatusPedido("ped-1", "entregue");
    assert.equal(dados.pedidos[0].statusPedido, "entregue");
});

teste("pedido aprovado entra automaticamente na fila sem perder o status de aprovação", () => {
    reset();
    dados.produtos.push({ id: "prod-aprovado", ativo: true });
    dados.pedidos.push({ id: "ped-aprovado", ativo: true, statusPedido: "aguardando_aceite", itens: [{ id: "item-aprovado", produtoId: "prod-aprovado", nome: "Produto", quantidade: 1 }] });
    ERPIntegracao.alterarStatusPedido("ped-aprovado", "aprovado");
    assert.equal(dados.pedidos[0].statusPedido, "aprovado");
    assert.equal(dados.ordens.length, 1);
    assert.equal(dados.ordens[0].pedidoId, "ped-aprovado");
    assert.equal(dados.ordens[0].itemPedidoId, "item-aprovado");
});

teste("cancelar pedido cancela produção e libera filamento e impressora", () => {
    reset();
    dados.produtos.push({ id: "prod-1", ativo: true });
    dados.pedidos.push({ id: "ped-2", ativo: true, statusPedido: "em_producao", itens: [{ id: "item-2", produtoId: "prod-1" }] });
    dados.ordens.push({ id: "ord-2", pedidoId: "ped-2", itemPedidoId: "item-2", status: "em_producao", ativo: true });
    dados.operacoes.push({ id: "op-2", ordemProducaoId: "ord-2", status: "em_execucao" });
    dados.lotes.push({ id: "lote-2", operacaoId: "op-2", impressoraId: "imp-1", status: "em_execucao" });
    dados.reservas.push({ id: "res-2", loteExecucaoId: "lote-2", status: "ativa", pesoReservadoGramas: 20 });
    dados.impressoras.push({ id: "imp-1", status: "imprimindo", operacaoAtualId: "lote-2", filaOperacoes: ["lote-2"] });
    ERPIntegracao.cancelarPedido("ped-2", { arquivar: true });
    assert.equal(dados.reservas[0].status, "cancelada");
    assert.equal(dados.ordens[0].status, "cancelada");
    assert.equal(dados.impressoras[0].status, "livre");
    assert.equal(dados.pedidos[0].ativo, false);
});

teste("auditoria corrige ordem órfã e reserva órfã", () => {
    reset();
    dados.ordens.push({ id: "orf-1", pedidoId: "ausente", status: "aguardando", ativo: true });
    dados.reservas.push({ id: "res-orf", loteExecucaoId: "ausente", status: "ativa" });
    const resultado = ERPIntegracao.auditar({ corrigir: true });
    assert(resultado.inconsistencias.some(item => item.tipo === "producao_sem_pedido"));
    assert.equal(dados.ordens[0].status, "cancelada");
    assert.equal(dados.reservas[0].status, "cancelada");
});

teste("produção antiga para estoque recebe demanda interna rastreável", () => {
    reset();
    dados.produtos.push({ id: "prod-estoque", nome: "Produto de estoque", ativo: true });
    dados.ordens.push({ id: "ord-estoque", origem: "estoque", produtoId: "prod-estoque", produtoNome: "Produto de estoque", quantidade: 4, status: "aguardando", ativo: true });
    dados.operacoes.push({ id: "op-estoque", ordemProducaoId: "ord-estoque", status: "aguardando" });
    assert.equal(ERPIntegracao.migrarDemandasEstoqueLegadas(), 1);
    const pedidoInterno = dados.pedidos[0];
    assert.equal(pedidoInterno.tipoPedido, "estoque_interno");
    assert.equal(pedidoInterno.visivel, false);
    assert.equal(dados.ordens[0].pedidoId, pedidoInterno.id);
    assert.equal(dados.ordens[0].itemPedidoId, pedidoInterno.itens[0].id);
    assert.equal(dados.operacoes[0].pedidoId, pedidoInterno.id);
    assert.equal(ERPIntegracao.ordensAtivas().length, 1);
});

teste("cliente com pedidos é arquivado ou tem pedidos transferidos sem perder histórico", () => {
    reset();
    dados.clientes.push({ id: "cli-1", nome: "Origem", ativo: true }, { id: "cli-2", nome: "Destino", ativo: true });
    dados.pedidos.push({ id: "ped-3", clienteId: "cli-1", clienteNome: "Origem", ativo: true, statusPedido: "aprovado", itens: [] });
    assert.equal(ERPIntegracao.podeArquivarCliente("cli-1").podeExcluir, false);
    assert.equal(ERPIntegracao.transferirPedidosCliente("cli-1", "cli-2"), 1);
    assert.equal(dados.pedidos[0].clienteId, "cli-2");
    assert.equal(dados.clientes[0].ativo, false);
});

teste("métricas incluem custo e tempo de produto personalizado", () => {
    reset();
    const metricas = ERPIntegracao.metricasItens([{ produtoId: null, personalizado: true, quantidade: 2, valorUnitario: 50, custoUnitario: 12, pesoPrevistoGramas: 30, tempoPrevistoMinutos: 45 }]);
    assert.deepEqual({ receita: metricas.receita, custo: metricas.custo, lucro: metricas.lucro, personalizados: metricas.personalizados, tempo: metricas.tempoMinutos }, { receita: 100, custo: 24, lucro: 76, personalizados: 2, tempo: 90 });
});

console.log(`\n${aprovados} testes de integração ERP aprovados.`);
