function getLojasAtivasMap() {
    const lojas = Storage.listarLojas().filter(loja => loja.ativo !== false);
    return new Map(lojas.map(loja => [String(loja.id), loja]));
}

function filtrarRegistrosLojasAtivas(registros, lojasAtivasMap) {
    const lojasPorNome = new Map(
        [...lojasAtivasMap.values()].map(loja => [
            String(loja.nome || "").trim().toLocaleLowerCase("pt-BR"),
            loja
        ])
    );

    return registros
        .map(registro => {
            let loja = lojasAtivasMap.get(String(registro.lojaId));
            const semLojaId = registro.lojaId === undefined
                || registro.lojaId === null
                || registro.lojaId === "";

            if (!loja && semLojaId) {
                loja = lojasPorNome.get(
                    String(registro.lojaNome || "").trim().toLocaleLowerCase("pt-BR")
                );
            }

            if (!loja) return null;

            return {
                ...registro,
                lojaId: loja.id,
                lojaNome: loja.nome
            };
        })
        .filter(Boolean);
}

function getEstoquesValidosDashboard() {
    const lojasAtivasMap = getLojasAtivasMap();
    return filtrarRegistrosLojasAtivas(
        Storage.listarEstoquesLojas(),
        lojasAtivasMap
    );
}

function calcularValorConsignado(estoques = getEstoquesValidosDashboard()) {
    return estoques.reduce((total, estoque) =>
        total + (estoque.itens || []).reduce(
            (subtotal, item) => subtotal
                + (Number(item.quantidade || 0) * Number(item.preco || 0)),
            0
        ),
    0);
}

function calcularTopProdutos(estoques = getEstoquesValidosDashboard()) {
    const produtos = new Map();

    estoques.forEach(estoque => {
        (estoque.itens || []).forEach(item => {
            const chave = String(item.produtoId || item.nome);
            const atual = produtos.get(chave) || {
                nome: item.nome || "Produto sem nome",
                quantidade: 0
            };

            atual.quantidade += Number(item.quantidade || 0);
            produtos.set(chave, atual);
        });
    });

    return [...produtos.values()]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
}

function calcularCategorias(estoques = getEstoquesValidosDashboard()) {
    const categorias = new Map();

    estoques.forEach(estoque => {
        (estoque.itens || []).forEach(item => {
            const categoria = item.categoria || "Sem categoria";
            categorias.set(
                categoria,
                (categorias.get(categoria) || 0) + Number(item.quantidade || 0)
            );
        });
    });

    return [...categorias.entries()]
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);
}

function calcularResumoDashboard() {
    const produtos = Storage.listarProdutos();
    const lojasAtivasMap = getLojasAtivasMap();
    const lojas = [...lojasAtivasMap.values()];
    const consignados = filtrarRegistrosLojasAtivas(
        Storage.listarConsignados(),
        lojasAtivasMap
    );
    const conferencias = filtrarRegistrosLojasAtivas(
        Storage.listarConferencias(),
        lojasAtivasMap
    );
    const estoques = filtrarRegistrosLojasAtivas(
        Storage.listarEstoquesLojas(),
        lojasAtivasMap
    );
    const estoquesAtivos = estoques.filter(estoque =>
        (estoque.itens || []).some(item => Number(item.quantidade || 0) > 0)
    );
    const totalPecas = estoques.reduce((total, estoque) =>
        total + (estoque.itens || []).reduce(
            (subtotal, item) => subtotal + Number(item.quantidade || 0),
            0
        ),
    0);
    const valorConsignado = calcularValorConsignado(estoques);
    const valorVendido = conferencias.reduce(
        (total, conferencia) => total + Number(conferencia.valorTotalVendido || 0),
        0
    );
    const totalPecasConsignadas = consignados.reduce((total, consignado) =>
        total + (consignado.itens || []).reduce(
            (subtotal, item) => subtotal + Number(item.quantidade || 0),
            0
        ),
    0);
    const pedidos = Storage.listarPedidos().filter(pedido => pedido.ativo !== false);
    const clientes = Storage.listarClientes().filter(cliente => cliente.ativo !== false);
    const orcamentos = Storage.listarOrcamentos().filter(orcamento => orcamento.ativo !== false);
    const pagamentos = Storage.listarPagamentos();
    const filamentos = Storage.listarFilamentos().filter(filamento => filamento.ativo !== false);
    const pedidosProducao = pedidos.filter(p => p.statusPedido === "em_producao").length;
    const pedidosProntos = pedidos.filter(p => p.statusPedido === "pronto").length;
    const pedidosPendentes = pedidos.filter(p => !["entregue", "cancelado"].includes(p.statusPedido)).length;
    const valorPedidosPendente = pedidos.reduce((total, p) => total + Number(p.valorPendente || 0), 0);
    const filamentosBaixos = filamentos.filter(f => Number(f.pesoAtualKg || 0) <= Number(f.alertaMinimoKg || 0)).length;
    const estoqueFilamentoKg = filamentos.reduce((total, f) => total + Number(f.pesoAtualKg || 0), 0);

    return {
        produtos,
        lojas,
        consignados,
        conferencias,
        estoques,
        lojasAtivasMap,
        resumoCards: [
            { icone: "box", valor: produtos.length, descricao: "Produtos cadastrados" },
            { icone: "store", valor: lojas.length, descricao: "Lojas cadastradas" },
            { icone: "layers-3", valor: estoquesAtivos.length, descricao: "Consignados ativos" },
            { icone: "scan-line", valor: conferencias.length, descricao: "Conferências realizadas" },
            { icone: "badge-dollar-sign", valor: Utils.moeda(valorConsignado), descricao: "Valor em consignado" },
            { icone: "boxes", valor: totalPecas, descricao: "Peças em consignado" },
            { icone: "printer", valor: pedidosProducao, descricao: "Pedidos em produção" },
            { icone: "package-check", valor: pedidosProntos, descricao: "Pedidos prontos" },
            { icone: "clock-3", valor: pedidosPendentes, descricao: "Pedidos pendentes" },
            { icone: "wallet", valor: Utils.moeda(valorPedidosPendente), descricao: "A receber de pedidos" },
            { icone: "triangle-alert", valor: filamentosBaixos, descricao: "Filamentos em baixo estoque" },
            { icone: "spool", valor: `${estoqueFilamentoKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`, descricao: "Estoque de filamento" }
        ],
        financeiro: [
            { descricao: "Valor total em consignado", valor: Utils.moeda(valorConsignado) },
            { descricao: "Valor vendido", valor: Utils.moeda(valorVendido) },
            { descricao: "Produtos em lojas", valor: totalPecas },
            {
                descricao: "Ticket médio por loja",
                valor: Utils.moeda(estoquesAtivos.length ? valorConsignado / estoquesAtivos.length : 0)
            },
            {
                descricao: "Média de produtos por consignado",
                valor: consignados.length
                    ? (totalPecasConsignadas / consignados.length).toLocaleString("pt-BR", {
                        maximumFractionDigits: 1
                    })
                    : "0"
            }
        ],
        valorConsignado,
        totalPecas,
        pedidos,
        clientes,
        orcamentos,
        pagamentos,
        filamentos
    };
}

function calcularValorPorLoja(estoques, lojas) {
    const lojasMap = new Map(lojas.map(loja => [String(loja.id), loja]));

    return estoques
        .map(estoque => {
            const loja = lojasMap.get(String(estoque.lojaId));

            if (!loja) return null;

            const valor = (estoque.itens || []).reduce(
                (total, item) => total
                    + (Number(item.quantidade || 0) * Number(item.preco || 0)),
                0
            );

            return {
                nome: loja.nome,
                valor
            };
        })
        .filter(item => item && item.valor > 0)
        .sort((a, b) => b.valor - a.valor);
}

function carregarUltimasMovimentacoes(consignados, conferencias) {
    const movimentacoes = [
        ...consignados.map(item => ({
            tipo: "Consignado",
            icone: "package-plus",
            loja: item.lojaNome || "Loja não identificada",
            data: item.data || item.criadoEm,
            timestamp: obterTimestampDashboard(item.criadoEm || item.data)
        })),
        ...conferencias.map(item => ({
            tipo: "Conferência",
            icone: "chart-no-axes-combined",
            loja: item.lojaNome || "Loja não identificada",
            data: item.data || item.criadoEm,
            timestamp: obterTimestampDashboard(item.criadoEm || item.data)
        }))
    ];

    return movimentacoes
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
}

function carregarAlertas(dados) {
    const alertas = [];

    if (dados.lojas.length === 0) {
        alertas.push({ icone: "store", texto: "Nenhuma loja cadastrada." });
    }

    if (dados.produtos.length === 0) {
        alertas.push({ icone: "package", texto: "Nenhum produto cadastrado." });
    }

    const semPreco = dados.produtos.filter(produto => Number(produto.preco || 0) <= 0).length;
    if (semPreco > 0) {
        alertas.push({
            icone: "badge-dollar-sign",
            texto: `${semPreco} ${semPreco === 1 ? "produto está" : "produtos estão"} sem preço.`
        });
    }

    const inativos = dados.produtos.filter(produto => produto.ativo === false).length;
    if (inativos > 0) {
        alertas.push({
            icone: "package-x",
            texto: `${inativos} ${inativos === 1 ? "produto inativo" : "produtos inativos"}.`
        });
    }

    const agora = Date.now();
    const limiteTrintaDias = 30 * 24 * 60 * 60 * 1000;

    dados.lojas.forEach(loja => {
        const consignadosLoja = dados.consignados
            .filter(item => String(item.lojaId) === String(loja.id))
            .sort((a, b) => obterTimestampDashboard(b.criadoEm || b.data)
                - obterTimestampDashboard(a.criadoEm || a.data));
        const ultimoConsignado = consignadosLoja[0];

        if (!ultimoConsignado) return;

        const dataConsignado = obterTimestampDashboard(
            ultimoConsignado.criadoEm || ultimoConsignado.data
        );
        const houveConferenciaDepois = dados.conferencias.some(conferencia =>
            String(conferencia.lojaId) === String(loja.id)
            && obterTimestampDashboard(conferencia.criadoEm || conferencia.data) >= dataConsignado
        );
        const estoque = dados.estoques.find(
            item => String(item.lojaId) === String(loja.id)
        );
        const possuiEstoque = (estoque?.itens || []).some(
            item => Number(item.quantidade || 0) > 0
        );

        if (possuiEstoque && !houveConferenciaDepois && agora - dataConsignado > limiteTrintaDias) {
            alertas.push({
                icone: "calendar-clock",
                texto: `${loja.nome} está sem conferência há mais de 30 dias.`
            });
        }
    });

    const hoje = Utils.hoje();
    dados.pedidos.forEach(pedido => {
        if (pedido.dataEntregaPrevista && pedido.dataEntregaPrevista < hoje && !["entregue", "cancelado"].includes(pedido.statusPedido)) {
            alertas.push({ icone: "calendar-x", texto: `Pedido de ${pedido.clienteNome} está atrasado.` });
        }
    });
    const pagamentosPendentes = dados.pedidos.filter(p => Number(p.valorPendente || 0) > 0 && p.statusPedido !== "cancelado").length;
    if (pagamentosPendentes) alertas.push({ icone: "wallet-cards", texto: `${pagamentosPendentes} pedido(s) aguardando pagamento.` });
    dados.filamentos.filter(f => Number(f.pesoAtualKg || 0) <= Number(f.alertaMinimoKg || 0)).forEach(f => {
        alertas.push({ icone: "spool", texto: `${f.material} ${f.cor} está abaixo do estoque mínimo.` });
    });
    const lotesProducao = Storage.listarLotesExecucao?.() || [];
    const operacoesProducao = Storage.listarOperacoesProducao?.() || [];
    const impressoras = Storage.listarImpressoras?.().filter(i => i.ativa !== false) || [];
    const atrasadasProducao = lotesProducao.filter(l => ["em_execucao", "pausada"].includes(l.status) && Producao.calcularTempoDecorrido(l) > Number(l.tempoPrevistoMinutos || 0));
    if (atrasadasProducao.length) alertas.push({ icone: "timer-off", texto: `${atrasadasProducao.length} impressão(ões) ultrapassaram o tempo previsto.` });
    const pausadas = lotesProducao.filter(l => l.status === "pausada").length;
    if (pausadas) alertas.push({ icone: "pause-circle", texto: `${pausadas} impressão(ões) estão pausadas.` });
    const semImpressora = operacoesProducao.filter(o => o.tipo === "impressao" && ["aguardando", "aguardando_alocacao"].includes(o.status)).length;
    if (semImpressora) alertas.push({ icone: "printer", texto: `${semImpressora} operação(ões) aguardam alocação em impressora.` });
    const falhasHoje = lotesProducao.filter(l => l.status === "falhou" && String(l.concluidoEm || "").startsWith(Utils.hoje())).length;
    if (falhasHoje) alertas.push({ icone: "triangle-alert", texto: `${falhasHoje} falha(s) de produção registrada(s) hoje.` });
    impressoras.filter(i => Number(i.limiteManutencaoHoras || 0) > 0 && Number(i.horasDesdeManutencao || 0) >= Number(i.limiteManutencaoHoras || 0) * .9).forEach(i => alertas.push({ icone: "wrench", texto: `${i.nome} está próxima da manutenção.` }));

    return alertas;
}

function renderDashboard() {
    Storage.limparDadosOrfaosLojas();

    const dados = calcularResumoDashboard();
    const valorPorLoja = calcularValorPorLoja(dados.estoques, dados.lojas);
    const topProdutos = calcularTopProdutos(dados.estoques);
    const categorias = calcularCategorias(dados.estoques);
    const pedidosPorStatus = Object.entries(STATUS_PEDIDOS).map(([status, nome]) => ({
        nome,
        quantidade: dados.pedidos.filter(p => p.statusPedido === status).length
    })).filter(item => item.quantidade > 0);
    const pendentePorCliente = [...dados.pedidos.reduce((mapa, pedido) => {
        mapa.set(pedido.clienteNome || "Cliente", (mapa.get(pedido.clienteNome || "Cliente") || 0) + Number(pedido.valorPendente || 0));
        return mapa;
    }, new Map()).entries()].map(([nome, valor]) => ({ nome, valor })).filter(item => item.valor > 0).sort((a,b)=>b.valor-a.valor).slice(0,5);
    const movimentacoes = carregarUltimasMovimentacoes(
        dados.consignados,
        dados.conferencias
    );
    const alertas = carregarAlertas(dados);
    const agora = new Date();
    const hora = agora.getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const dataAtual = agora.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long"
    });

    app.innerHTML = `
        <div class="dashboard">
            <section class="dashboardHero">
                <div class="dashboardBrand">
                    <div class="brandMark brandMarkHero" aria-hidden="true">
                        <i data-lucide="box"></i>
                    </div>
                    <div>
                        <span>${saudacao}</span>
                        <h2>${escaparHtmlDashboard(APP.nome)}</h2>
                        <p>${escaparHtmlDashboard(capitalizarDashboard(dataAtual))}</p>
                    </div>
                </div>
                <div class="dashboardHeroIcon">
                    <i data-lucide="cpu"></i>
                </div>
            </section>

            <section class="dashboardSummaryGrid">
                ${dados.resumoCards.map(card => renderCardResumoDashboard(card)).join("")}
            </section>

            <section class="dashboardChartsGrid">
                ${renderGraficoValorLoja(valorPorLoja)}
                ${renderGraficoHorizontal(
                    "Produtos mais consignados",
                    topProdutos,
                    "quantidade",
                    valor => `${valor} peças`
                )}
                ${renderGraficoHorizontal(
                    "Categorias",
                    categorias,
                    "quantidade",
                    valor => `${valor} peças`
                )}
                ${renderGraficoHorizontal("Pedidos por status", pedidosPorStatus, "quantidade", valor => `${valor} pedido(s)`)}
                ${renderGraficoHorizontal("Valor pendente por cliente", pendentePorCliente, "valor", valor => Utils.moeda(valor))}
            </section>

            <section class="dashboardSection">
                <div class="dashboardSectionTitle">
                    <div>
                        <span>Acesso direto</span>
                        <h3>Ações Rápidas</h3>
                    </div>
                    <i data-lucide="zap"></i>
                </div>
                <div class="dashboardQuickGrid">
                    ${criarCard("clipboard-list", "Novo Pedido", "Produção e entrega", "pedidos")}
                    ${criarCard("spool", "Filamentos", "Controlar estoque", "filamentos")}
                    ${criarCard("calculator", "Calcular Custos", "Precificar projeto", "custos")}
                    ${criarCard("layers-3", "Novo Consignado", "Enviar produtos", "consignado")}
                    ${criarCard("scan-line", "Nova Conferência", "Registrar vendas", "conferencia")}
                    ${criarCard("printer", "Novo Orçamento", "Preparar documento", "orcamento")}
                    ${criarCard("box", "Cadastrar Produto", "Adicionar ao catálogo", "produtos")}
                    ${criarCard("store", "Cadastrar Loja", "Nova loja parceira", "lojas")}
                </div>
            </section>

            <section class="dashboardTwoColumns">
                ${renderUltimasMovimentacoes(movimentacoes)}
                ${renderAlertasDashboard(alertas)}
            </section>

            <section class="dashboardSection dashboardFinanceiro">
                <div class="dashboardSectionTitle">
                    <div>
                        <span>Visão geral</span>
                        <h3>Resumo Financeiro</h3>
                    </div>
                    <i data-lucide="landmark"></i>
                </div>
                <div class="dashboardFinanceGrid">
                    ${dados.financeiro.map(item => `
                        <div class="dashboardFinanceItem">
                            <span>${escaparHtmlDashboard(item.descricao)}</span>
                            <strong>${escaparHtmlDashboard(item.valor)}</strong>
                        </div>
                    `).join("")}
                </div>
            </section>
        </div>
    `;

    lucide.createIcons();
}

function renderHome() {
    renderDashboard();
}

function renderCardResumoDashboard(card) {
    return `
        <article class="dashboardSummaryCard">
            <div class="dashboardSummaryIcon">
                <i data-lucide="${card.icone}"></i>
            </div>
            <strong>${escaparHtmlDashboard(card.valor)}</strong>
            <span>${escaparHtmlDashboard(card.descricao)}</span>
        </article>
    `;
}

function renderGraficoValorLoja(itens) {
    const maiorValor = Math.max(...itens.map(item => item.valor), 0);

    return `
        <article class="dashboardChartCard dashboardChartWide">
            <div class="dashboardChartHeader">
                <div>
                    <span>Estoque atual</span>
                    <h3>Valor em Consignado por Loja</h3>
                </div>
                <i data-lucide="bar-chart-3"></i>
            </div>
            ${itens.length ? `
                <div class="dashboardVerticalChart">
                    ${itens.map(item => `
                        <div class="dashboardVerticalColumn">
                            <span>${escaparHtmlDashboard(Utils.moeda(item.valor))}</span>
                            <div class="dashboardVerticalTrack">
                                <div style="height:${Math.max(8, (item.valor / maiorValor) * 100)}%"></div>
                            </div>
                            <strong title="${escaparHtmlDashboard(item.nome)}">
                                ${escaparHtmlDashboard(item.nome)}
                            </strong>
                        </div>
                    `).join("")}
                </div>
            ` : renderDashboardVazio("Nenhum estoque em lojas no momento.")}
        </article>
    `;
}

function renderGraficoHorizontal(titulo, itens, campoValor, formatarValor) {
    const maiorValor = Math.max(...itens.map(item => Number(item[campoValor] || 0)), 0);

    return `
        <article class="dashboardChartCard">
            <div class="dashboardChartHeader">
                <div>
                    <span>Estoque atual</span>
                    <h3>${escaparHtmlDashboard(titulo)}</h3>
                </div>
                <i data-lucide="chart-bar-big"></i>
            </div>
            ${itens.length ? `
                <div class="dashboardHorizontalChart">
                    ${itens.map(item => {
                        const valor = Number(item[campoValor] || 0);
                        return `
                            <div class="dashboardBarRow">
                                <div class="dashboardBarLabel">
                                    <span>${escaparHtmlDashboard(item.nome)}</span>
                                    <strong>${escaparHtmlDashboard(formatarValor(valor))}</strong>
                                </div>
                                <div class="dashboardBarTrack">
                                    <div style="width:${maiorValor ? (valor / maiorValor) * 100 : 0}%"></div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            ` : renderDashboardVazio("Ainda não há dados para este gráfico.")}
        </article>
    `;
}

function renderUltimasMovimentacoes(movimentacoes) {
    return `
        <article class="dashboardSection dashboardListCard">
            <div class="dashboardSectionTitle">
                <div>
                    <span>Atividade recente</span>
                    <h3>Últimas movimentações</h3>
                </div>
                <i data-lucide="history"></i>
            </div>
            ${movimentacoes.length ? `
                <div class="dashboardTimeline">
                    ${movimentacoes.map(item => `
                        <div class="dashboardTimelineItem">
                            <div class="dashboardTimelineIcon">
                                <i data-lucide="${item.icone}"></i>
                            </div>
                            <div>
                                <strong>${escaparHtmlDashboard(item.tipo)}</strong>
                                <span>${escaparHtmlDashboard(item.loja)}</span>
                            </div>
                            <time>${formatarDataDashboard(item.data)}</time>
                        </div>
                    `).join("")}
                </div>
            ` : renderDashboardVazio("Nenhuma movimentação registrada.")}
        </article>
    `;
}

function renderAlertasDashboard(alertas) {
    return `
        <article class="dashboardSection dashboardListCard">
            <div class="dashboardSectionTitle">
                <div>
                    <span>Atenção necessária</span>
                    <h3>Alertas</h3>
                </div>
                <i data-lucide="bell-ring"></i>
            </div>
            ${alertas.length ? `
                <div class="dashboardAlerts">
                    ${alertas.map(alerta => `
                        <div class="dashboardAlertItem">
                            <i data-lucide="${alerta.icone}"></i>
                            <span>${escaparHtmlDashboard(alerta.texto)}</span>
                        </div>
                    `).join("")}
                </div>
            ` : `
                <div class="dashboardAlertSuccess">
                    <i data-lucide="circle-check-big"></i>
                    <span>Nenhum alerta no momento.</span>
                </div>
            `}
        </article>
    `;
}

function renderDashboardVazio(texto) {
    return `<div class="dashboardEmpty">${escaparHtmlDashboard(texto)}</div>`;
}

function obterTimestampDashboard(valor) {
    if (!valor) return 0;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function formatarDataDashboard(valor) {
    if (!valor) return "-";
    return formatarDataBR(String(valor).slice(0, 10));
}

function capitalizarDashboard(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function escaparHtmlDashboard(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* Dashboard executivo - camada de apresentação */
function renderDashboard() {
    Storage.limparDadosOrfaosLojas();
    const dados=calcularResumoDashboard(),alertas=carregarAlertas(dados),agora=new Date(),hora=agora.getHours();
    const receberClientes=dados.pedidos.reduce((t,p)=>t+Number(p.valorPendente||0),0);
    const receberConsignado=dados.conferencias.reduce((t,c)=>t+Number(c.valorTotalVendido||0),0);
    const emProducao=dados.pedidos.filter(p=>p.statusPedido==="em_producao").length;
    const prontos=dados.pedidos.filter(p=>p.statusPedido==="pronto").length;
    const atrasados=dados.pedidos.filter(p=>p.dataEntregaPrevista&&p.dataEntregaPrevista<Utils.hoje()&&!["entregue","cancelado"].includes(p.statusPedido)).length;
    const lojasAguardando=dados.estoques.filter(e=>(e.itens||[]).some(i=>Number(i.quantidade||0)>0)).length;
    const filamentosCriticos=dados.filamentos.filter(f=>Number(f.pesoAtualKg||0)<=Number(f.alertaMinimoKg||0)).length;
    const estoqueFilamento=dados.filamentos.reduce((t,f)=>t+Number(f.pesoAtualKg||0),0);
    const pedidosPorStatus=Object.entries(STATUS_PEDIDOS).map(([status,nome])=>({nome,quantidade:dados.pedidos.filter(p=>p.statusPedido===status).length})).filter(i=>i.quantidade);
    const recebimentos=[{nome:"Clientes",valor:receberClientes},{nome:"Consignado",valor:receberConsignado}].filter(i=>i.valor);
    const topProdutos=calcularTopProdutosVendidosDashboard(dados.conferencias);
    const movimentacoes=carregarMovimentacoesExecutivas(dados);
    const saudacao=hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";
    const dataAtual=agora.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
    app.innerHTML=`<div class="executiveDashboard">
        <section class="executiveWelcome"><div><span>VISÃO EXECUTIVA</span><h2>${saudacao}, vamos produzir?</h2><p>${escaparHtmlDashboard(capitalizarDashboard(dataAtual))}</p></div><div class="executiveCube"><i data-lucide="blocks"></i></div></section>
        <section class="executiveSummaryGrid">${renderResumoExecutivo("wallet",Utils.moeda(receberClientes+receberConsignado),"Receber","Valor total pendente")}${renderResumoExecutivo("printer",emProducao,"Produção","Pedidos em produção")}${renderResumoExecutivo("store",lojasAguardando,"Consignado","Lojas aguardando conferência")}${renderResumoExecutivo("triangle-alert",alertas.length,"Alertas","Atenção necessária",alertas.length?"warning":"success")}</section>
        <section class="executiveModulesGrid">${renderModuloExecutivo("landmark","Financeiro","Fluxo de recebimentos",[["Receber de clientes",Utils.moeda(receberClientes)],["Receber de consignado",Utils.moeda(receberConsignado)],["Total pendente",Utils.moeda(receberClientes+receberConsignado)]],"financeiro")}${renderModuloExecutivo("factory","Produção","Situação dos pedidos",[["Em produção",emProducao],["Prontos",prontos],["Atrasados",atrasados]],"producao")}${renderModuloExecutivo("store","Consignado","Operação nas lojas",[["Valor em lojas",Utils.moeda(dados.valorConsignado)],["Próximas visitas","Em preparação"],["Últimas conferências",dados.conferencias.length]],"consignado")}${renderModuloExecutivo("spool","Filamentos","Saúde do estoque",[["Filamentos críticos",filamentosCriticos],["Estoque total",`${estoqueFilamento.toLocaleString("pt-BR",{maximumFractionDigits:2})} kg`],["Consumo futuro","Em preparação"]],"filamentos")}</section>
        <section class="executiveCharts">${renderGraficoExecutivo("Recebimentos","Clientes x Consignado",recebimentos,"valor",v=>Utils.moeda(v))}${renderGraficoExecutivo("Produção","Pedidos por status",pedidosPorStatus,"quantidade",v=>`${v}`)}${renderGraficoExecutivo("Vendas","Produtos mais vendidos",topProdutos,"quantidade",v=>`${v} peças`)}</section>
        <section class="executiveTimelineSection"><div class="executiveSectionHeader"><div><span>ATIVIDADE</span><h3>Últimas movimentações</h3></div><i data-lucide="history"></i></div>${renderTimelineExecutiva(movimentacoes)}</section>
    </div>`;lucide.createIcons();
}

function renderResumoExecutivo(icone,valor,titulo,descricao,estado=""){return `<article class="executiveSummaryCard ${estado}"><div><i data-lucide="${icone}"></i></div><span>${titulo}</span><strong>${escaparHtmlDashboard(valor)}</strong><small>${descricao}</small></article>`;}
function renderModuloExecutivo(icone,titulo,subtitulo,linhas,chave){return `<article class="executiveModule" data-dashboard-module="${chave}"><div class="executiveSectionHeader"><div><span>${subtitulo}</span><h3>${titulo}</h3></div><i data-lucide="${icone}"></i></div><div class="executiveMetricList">${linhas.map(([l,v],i)=>`<div class="${i===linhas.length-1?"isTotal":""}"><span>${l}</span><strong>${escaparHtmlDashboard(v)}</strong></div>`).join("")}</div></article>`;}
function renderGraficoExecutivo(secao,titulo,itens,campo,formatar){const max=Math.max(...itens.map(i=>Number(i[campo]||0)),0);return `<article class="executiveChartCard"><div class="executiveSectionHeader"><div><span>${secao}</span><h3>${titulo}</h3></div><i data-lucide="chart-no-axes-column-increasing"></i></div>${itens.length?`<div class="executiveBars">${itens.slice(0,6).map(i=>`<div><header><span>${escaparHtmlDashboard(i.nome)}</span><strong>${escaparHtmlDashboard(formatar(Number(i[campo]||0)))}</strong></header><div><span style="width:${max?Math.max(4,Number(i[campo]||0)/max*100):0}%"></span></div></div>`).join("")}</div>`:renderDashboardVazio("Sem dados para este período.")}</article>`;}
function calcularTopProdutosVendidosDashboard(conferencias){const mapa=new Map();conferencias.forEach(c=>(c.itens||[]).forEach(i=>{const qtd=Number(i.quantidadeVendida||0);if(qtd)mapa.set(i.nome||"Produto",(mapa.get(i.nome||"Produto")||0)+qtd);}));return [...mapa.entries()].map(([nome,quantidade])=>({nome,quantidade})).sort((a,b)=>b.quantidade-a.quantidade).slice(0,5);}
function carregarMovimentacoesExecutivas(dados){return [...dados.pedidos.map(p=>({tipo:"Pedido",icone:"package",descricao:`${p.clienteNome||"Cliente"} · ${STATUS_PEDIDOS[p.statusPedido]||"Criado"}`,data:p.criadoEm||p.dataPedido,timestamp:obterTimestampDashboard(p.criadoEm||p.dataPedido)})),...(dados.orcamentos||[]).map(o=>({tipo:"Orçamento",icone:"file-text",descricao:`${o.clienteNome||o.cliente||"Cliente"} · ${o.status||"Enviado"}`,data:o.criadoEm||o.data,timestamp:obterTimestampDashboard(o.criadoEm||o.data)})),...(dados.pagamentos||[]).map(p=>({tipo:"Pagamento",icone:"badge-dollar-sign",descricao:`${p.clienteNome||"Cliente"} · ${Utils.moeda(p.valor)}`,data:p.criadoEm||p.data,timestamp:obterTimestampDashboard(p.criadoEm||p.data)})),...dados.consignados.map(c=>({tipo:"Consignado",icone:"store",descricao:c.lojaNome||"Loja",data:c.criadoEm||c.data,timestamp:obterTimestampDashboard(c.criadoEm||c.data)})),...dados.conferencias.map(c=>({tipo:"Conferência",icone:"badge-check",descricao:c.lojaNome||"Loja",data:c.criadoEm||c.data,timestamp:obterTimestampDashboard(c.criadoEm||c.data)}))].sort((a,b)=>b.timestamp-a.timestamp).slice(0,6);}
function renderTimelineExecutiva(itens){if(!itens.length)return renderDashboardVazio("Nenhuma movimentação registrada.");return `<div class="executiveTimeline">${itens.map(i=>`<div><span class="executiveTimelineIcon"><i data-lucide="${i.icone}"></i></span><section><strong>${i.tipo}</strong><p>${escaparHtmlDashboard(i.descricao)}</p></section><time>${formatarDataDashboard(i.data)}</time></div>`).join("")}</div>`;}

/* Central de Operações */
const acoesOperacionaisExpandidas = new Set();
function renderDashboard(){
    Storage.limparDadosOrfaosLojas();
    const financeiro=Financeiro.sincronizar(),resumo=Financeiro.calcularResumo(financeiro),notificacoes=gerarNotificacoesOperacionais(),hoje=Utils.hoje();
    const pedidos=Storage.listarPedidos().filter(p=>p.ativo!==false),filamentos=Storage.listarFilamentos().filter(f=>f.ativo!==false),lojasVisitar=calcularLojasParaVisitar();
    const producao=pedidos.filter(p=>p.statusPedido==='em_producao'),prontos=pedidos.filter(p=>p.statusPedido==='pronto'),atrasados=pedidos.filter(p=>p.dataEntregaPrevista&&p.dataEntregaPrevista<hoje&&!['entregue','cancelado'].includes(p.statusPedido));
    const criticos=filamentos.filter(f=>Number(f.pesoAtualKg||0)<=Number(f.alertaMinimoKg||0));
    const pendentes=financeiro.filter(i=>!['pago','cancelado'].includes(i.status)),maior=pendentes.sort((a,b)=>b.valorRestante-a.valorRestante)[0];
    const acoes=[...montarAcoesOperacionais({financeiro,pedidos,filamentos,lojasVisitar}),...montarAcoesCRM(),...montarAcoesProducaoAtual()];
    const gruposAcoes=agruparAcoesOperacionais(acoes);
    const agora=new Date(),saudacao=agora.getHours()<12?'Bom dia':agora.getHours()<18?'Boa tarde':'Boa noite';
    app.innerHTML=`<div class="operationsDashboard">
        <section class="operationsHero"><div><span>CENTRAL DE OPERAÇÕES</span><h1>${saudacao}. Aqui está o que pede atenção.</h1><p>${capitalizarDashboard(agora.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}))}</p></div><button onclick="abrirCentralNotificacoes()"><i data-lucide="bell-ring"></i><strong>${notificacoes.filter(n=>!n.visualizada).length}</strong><span>notificações</span></button></section>
        <section class="operationsSummaryGrid">${resumoOperacao('calendar-clock',Utils.moeda(resumo.hoje),'Receber hoje')}${resumoOperacao('calendar-range',Utils.moeda(resumo.mes),'Receber no mês')}${resumoOperacao('clock-alert',atrasados.length,'Pedidos atrasados',atrasados.length?'danger':'')}${resumoOperacao('printer',producao.length,'Em produção')}${resumoOperacao('spool',criticos.length,'Filamentos críticos',criticos.length?'warning':'')}${resumoOperacao('map-pinned',lojasVisitar.length,'Lojas para visitar')}</section>
        <section class="operationsActionSection"><div class="operationsSectionTitle"><div><span>PRIORIDADES</span><h2>Ações do dia</h2></div><div class="operationsActionMeta"><small>${acoes.length} ações sugeridas</small>${obterAcoesOperacionaisConcluidas().length?`<button type="button" onclick="resetarAcoesOperacionaisConcluidas()">Resetar concluídas</button>`:""}</div></div>${acoes.length?`<div class="operationsActionGroups">${gruposAcoes.map(renderGrupoAcoesOperacionais).join('')}</div>`:`<div class="operationsAllClear"><i data-lucide="circle-check-big"></i><div><strong>Operação em dia</strong><p>Nenhuma pendência crítica encontrada.</p></div></div>`}</section>
        <section class="operationsModulesGrid">
            ${moduloOperacao('wallet-cards','Financeiro','Recebimentos',[['Receber hoje',Utils.moeda(resumo.hoje)],['Em atraso',Utils.moeda(resumo.atraso)],['Maior recebimento',maior?`${maior.clienteNome} · ${Utils.moeda(maior.valorRestante)}`:'Nenhum']], 'financeiro')}
            ${moduloOperacao('factory','Produção','Pedidos',[['Em produção',producao.length],['Prontos',prontos.length],['Atrasados',atrasados.length]],'pedidos')}
            ${moduloOperacao('store','Consignado','Próximas visitas',lojasVisitar.length?lojasVisitar.slice(0,3).map(i=>[i.loja.nome,`${i.dias} dias`]):[['Situação','Nenhuma visita sugerida']],'conferencia')}
            ${moduloOperacao('spool','Filamentos','Alertas de estoque',criticos.length?criticos.slice(0,3).map(f=>[`${f.material} ${f.cor}`,`${(Number(f.pesoAtualKg||0)*1000).toFixed(0)} g`]):[['Situação','Estoque saudável']],'filamentos')}
        </section>
    </div>`;lucide.createIcons();
}
function resumoOperacao(icone,valor,rotulo,estado=''){return `<article class="operationsSummaryCard ${estado}"><i data-lucide="${icone}"></i><strong>${escaparHtmlDashboard(valor)}</strong><span>${rotulo}</span></article>`;}
function montarAcoesProducaoAtual(){const acoes=[],lotes=Storage.listarLotesExecucao?.()||[],ops=Storage.listarOperacoesProducao?.()||[],impressoras=Storage.listarImpressoras?.().filter(i=>i.ativa!==false)||[];const add=a=>acoes.push({...a,id:a.id||gerarIdAcaoOperacional(a),modulo:"producao"});ops.filter(o=>o.tipo==="impressao"&&["aguardando","aguardando_alocacao"].includes(o.status)).slice(0,3).forEach(o=>add({id:`alocar-${o.id}`,icone:"printer",titulo:`Alocar ${o.nome}`,descricao:o.produtoNome||"Operação aguardando impressora",prioridade:"alta"}));lotes.filter(l=>["pronta_para_iniciar","em_fila"].includes(l.status)).slice(0,3).forEach(l=>add({id:`iniciar-lote-${l.id}`,icone:"play",titulo:"Iniciar operação alocada",descricao:Storage.buscarOperacaoProducaoPorId(l.operacaoId)?.nome||"Lote pronto",prioridade:"media"}));lotes.filter(l=>["em_execucao","pausada"].includes(l.status)&&Producao.calcularTempoDecorrido(l)>Number(l.tempoPrevistoMinutos||0)).forEach(l=>add({id:`atraso-lote-${l.id}`,icone:"timer-off",titulo:"Impressão acima da previsão",descricao:`Ultrapassou ${formatarMinutosProducao(Producao.calcularTempoDecorrido(l)-l.tempoPrevistoMinutos)}`,prioridade:"alta"}));lotes.filter(l=>l.status==="pausada").forEach(l=>add({id:`pausa-lote-${l.id}`,icone:"pause-circle",titulo:"Impressora pausada",descricao:Storage.buscarImpressoraPorId(l.impressoraId)?.nome||"Verificar produção",prioridade:"alta"}));impressoras.filter(i=>Number(i.limiteManutencaoHoras||0)>0&&Number(i.horasDesdeManutencao||0)>=Number(i.limiteManutencaoHoras||0)*.9).forEach(i=>add({id:`manutencao-${i.id}`,icone:"wrench",titulo:`Manutenção próxima — ${i.nome}`,descricao:`${Number(i.horasDesdeManutencao||0).toFixed(1)} h de uso`,prioridade:"media"}));return acoes.filter(a=>!obterAcoesOperacionaisConcluidas().includes(String(a.id)));}
function montarAcoesOperacionais({financeiro,pedidos,filamentos,lojasVisitar}){const hoje=Utils.hoje(),acoes=[],concluidas=obterAcoesOperacionaisConcluidas();const add=a=>{const id=gerarIdAcaoOperacional({titulo:a.id||a.titulo,descricao:a.descricao,modulo:a.modulo});acoes.push({...a,id});};const produtos=Storage.listarProdutos().filter(p=>p.ativo!==false),clientes=Storage.listarClientes?Storage.listarClientes().filter(c=>c.ativo!==false):[],lojas=Storage.listarLojas().filter(l=>l.ativo!==false),consignados=Storage.listarConsignados(),empresas=Storage.listarEmpresas?Storage.listarEmpresas().filter(e=>e.ativa!==false):[];if(!produtos.length)add({id:"setup-produto",icone:"package-plus",titulo:"Cadastrar primeiro produto",descricao:"Monte seu catálogo para orçamentos e pedidos.",prioridade:"media",modulo:"produtos",auto:true,acao:"Configurar"});if(!clientes.length)add({id:"setup-cliente",icone:"user-plus",titulo:"Cadastrar cliente",descricao:"Crie sua primeira ficha de cliente.",prioridade:"media",modulo:"clientes",auto:true,acao:"Configurar"});if(!pedidos.length)add({id:"setup-pedido",icone:"clipboard-plus",titulo:"Criar primeiro pedido",descricao:"Controle produção, pagamento e entrega.",prioridade:"media",modulo:"pedidos",auto:true,acao:"Configurar"});if(!lojas.length&&!consignados.length)add({id:"setup-consignado",icone:"store",titulo:"Cadastrar loja parceira",descricao:"Prepare a operação de consignado.",prioridade:"media",modulo:"lojas",auto:true,acao:"Configurar"});if(!empresas.some(e=>e.nome&&e.logo))add({id:"setup-empresa",icone:"building-2",titulo:"Configurar empresa e logo",descricao:"Use sua identidade nos documentos.",prioridade:"media",modulo:"configuracoes",auto:true,acao:"Configurar"});financeiro.filter(i=>i.status!=='pago'&&(i.status==='atrasado'||i.vencimento===hoje)).forEach(i=>add({id:`financeiro-${i.id||i.origemId||i.clienteNome||i.vencimento}`,icone:'hand-coins',titulo:`Receber ${Utils.moeda(i.valorRestante)}`,descricao:i.clienteNome,prioridade:i.status==='atrasado'?'alta':'media',modulo:'financeiro',acao:'Receber'}));pedidos.filter(p=>['aprovado','aguardando_orcamento'].includes(p.statusPedido)).forEach(p=>add({id:`iniciar-${p.id}`,icone:'play',titulo:`Iniciar produção de ${p.clienteNome}`,descricao:p.dataEntregaPrevista?`Entrega ${formatarDataBR(p.dataEntregaPrevista)}`:'Sem previsão',prioridade:p.dataEntregaPrevista&&p.dataEntregaPrevista<=hoje?'alta':'media',modulo:'pedidos',acao:'Produzir'}));pedidos.filter(p=>p.statusPedido==='em_producao').forEach(p=>add({id:`producao-${p.id}`,icone:'printer',titulo:`Ver produção de ${p.clienteNome}`,descricao:p.dataEntregaPrevista?`Entrega ${formatarDataBR(p.dataEntregaPrevista)}`:'Em andamento',prioridade:p.dataEntregaPrevista&&p.dataEntregaPrevista<hoje?'alta':'media',modulo:'producao',acao:'Abrir'}));pedidos.filter(p=>p.statusPedido==='pronto').forEach(p=>add({id:`entregar-${p.id}`,icone:'package-check',titulo:`Entregar pedido de ${p.clienteNome}`,descricao:'Pedido pronto para retirada ou entrega',prioridade:'media',modulo:'pedidos',acao:'Entregar'}));lojasVisitar.filter(i=>i.dias>=30).forEach(i=>add({id:`conferir-${i.loja.id}`,icone:'store',titulo:`Conferir ${i.loja.nome}`,descricao:`Última visita há ${i.dias} dias`,prioridade:i.dias>=45?'alta':'media',modulo:'conferencia',acao:'Conferir'}));filamentos.filter(f=>Number(f.pesoAtualKg||0)<=Number(f.alertaMinimoKg||0)).forEach(f=>add({id:`filamento-${f.id}`,icone:'shopping-cart',titulo:`Comprar ${f.material} ${f.cor}`,descricao:`Restam ${(Number(f.pesoAtualKg||0)*1000).toFixed(0)} g`,prioridade:Number(f.pesoAtualKg||0)<=0?'alta':'media',modulo:'filamentos',acao:'Abrir'}));return acoes.filter(a=>!concluidas.includes(String(a.id))).sort((a,b)=>(a.prioridade==='alta'?0:1)-(b.prioridade==='alta'?0:1));}
function montarAcoesCRM(){const hoje=Utils.hoje(),concluidas=obterAcoesOperacionaisConcluidas(),acoes=[];Storage.listarClientes().filter(c=>c.ativo!==false).forEach(c=>{(c.retornos||[]).filter(r=>r.status==='pendente'&&String(r.dataHora||'').slice(0,10)<=hoje).forEach(r=>acoes.push({id:`retorno-${c.id}-${r.id}`,icone:'calendar-clock',titulo:`Retornar ${c.nome}`,descricao:r.motivo||'Contato agendado',prioridade:String(r.dataHora).slice(0,10)<hoje?'alta':'media',modulo:'clientes',registroId:c.id,acao:'Abrir'}));const status=typeof avaliarRelacionamentoCliente==='function'?avaliarRelacionamentoCliente(c):c.statusRelacionamento;if(status==='em_risco')acoes.push({id:`risco-${c.id}`,icone:'user-round-search',titulo:`Cliente em risco — ${c.nome}`,descricao:'Relacionamento precisa de atenção',prioridade:'media',modulo:'clientes',registroId:c.id,acao:'Abrir'});});return acoes.filter(a=>!concluidas.includes(a.id));}
function agruparAcoesOperacionais(acoes){const grupoDe=a=>a.auto?'configuracao':a.prioridade==='alta'?'urgentes':['financeiro','pedidos','conferencia','clientes'].includes(a.modulo)&&['Receber','Entregar','Conferir','Abrir'].includes(a.acao)?'hoje':'semana';const definicoes=[['urgentes','Urgentes'],['hoje','Hoje'],['semana','Esta semana'],['configuracao','Configuração']];return definicoes.map(([id,titulo])=>({id,titulo,acoes:acoes.filter(a=>grupoDe(a)===id)})).filter(g=>g.acoes.length);}
function renderGrupoAcoesOperacionais(grupo){const expandido=acoesOperacionaisExpandidas.has(grupo.id),visiveis=expandido?grupo.acoes:grupo.acoes.slice(0,3);return `<section class="operationsActionGroup"><header><div><strong>${grupo.titulo}</strong><span>${grupo.acoes.length}</span></div>${grupo.acoes.length>3?`<button onclick="alternarGrupoAcoesOperacionais('${grupo.id}')">${expandido?'Mostrar menos':'Ver todas'}</button>`:''}</header><div class="operationsActionList">${visiveis.map(renderAcaoOperacional).join('')}</div></section>`;}
function alternarGrupoAcoesOperacionais(id){acoesOperacionaisExpandidas.has(id)?acoesOperacionaisExpandidas.delete(id):acoesOperacionaisExpandidas.add(id);renderDashboard();}
function renderAcaoOperacional(a){return `<article class="operationsAction priority-${a.prioridade}" data-action-id="${escaparHtmlDashboard(a.id)}" role="button" tabindex="0" onclick="executarDestinoAcaoOperacional('${a.modulo}','${escaparHtmlDashboard(a.registroId||'')}')" onkeydown="if(event.key==='Enter')executarDestinoAcaoOperacional('${a.modulo}','${escaparHtmlDashboard(a.registroId||'')}')"><span><i data-lucide="${a.icone}"></i></span><div><strong>${escaparHtmlDashboard(a.titulo)}</strong><small>${escaparHtmlDashboard(a.descricao)}</small></div><section class="operationsActionButtons"><button onclick="event.stopPropagation();executarDestinoAcaoOperacional('${a.modulo}','${escaparHtmlDashboard(a.registroId||'')}')">${a.acao||'Abrir'} <i data-lucide="arrow-up-right"></i></button><button class="actionMoreButton" aria-label="Mais ações" onclick="event.stopPropagation();abrirMenuAcaoOperacional('${escaparHtmlDashboard(a.id)}')"><i data-lucide="ellipsis"></i></button></section></article>`;}
function executarDestinoAcaoOperacional(modulo,registroId=''){navegar(modulo);if(modulo==='clientes'&&registroId)setTimeout(()=>abrirDetalhesCliente(registroId),0);}
function abrirMenuAcaoOperacional(id){const acoes=[...montarAcoesOperacionais({financeiro:Financeiro.sincronizar(),pedidos:Storage.listarPedidos().filter(p=>p.ativo!==false),filamentos:Storage.listarFilamentos().filter(f=>f.ativo!==false),lojasVisitar:calcularLojasParaVisitar()}),...montarAcoesCRM(),...montarAcoesProducaoAtual()];const acao=acoes.find(a=>String(a.id)===String(id));if(!acao)return;Modal.abrir("Ação sugerida",`<div class="compactActionMenu"><button onclick="Modal.fechar();navegar('${acao.modulo}')"><i data-lucide="arrow-up-right"></i><span><strong>${acao.acao||'Abrir'}</strong><small>${escaparHtmlDashboard(acao.titulo)}</small></span></button><button onclick="Modal.fechar();concluirAcaoOperacional('${escaparHtmlDashboard(acao.id)}')"><i data-lucide="check"></i><span><strong>Marcar como concluída</strong><small>Ocultar esta sugestão</small></span></button></div>`);lucide.createIcons();}
function gerarIdAcaoOperacional(a){return String(`${a.modulo||"acao"}-${a.titulo||""}-${a.descricao||""}`).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");}
function obterAcoesOperacionaisConcluidas(){try{return JSON.parse(localStorage.getItem("primedocs_acoes_concluidas"))||[];}catch(e){return [];}}
function salvarAcoesOperacionaisConcluidas(lista){localStorage.setItem("primedocs_acoes_concluidas",JSON.stringify([...new Set(lista.map(String))]));}
function concluirAcaoOperacional(id){const lista=obterAcoesOperacionaisConcluidas();if(!lista.includes(String(id)))lista.push(String(id));salvarAcoesOperacionaisConcluidas(lista);renderDashboard();Toast.show("Ação marcada como concluída.");}
function resetarAcoesOperacionaisConcluidas(){salvarAcoesOperacionaisConcluidas([]);renderDashboard();Toast.show("Ações sugeridas restauradas.");}
function moduloOperacao(icone,titulo,subtitulo,linhas,modulo){return `<article class="operationsModule"><header><span><i data-lucide="${icone}"></i></span><div><small>${subtitulo}</small><h3>${titulo}</h3></div><button onclick="navegar('${modulo}')" aria-label="Abrir ${titulo}"><i data-lucide="arrow-up-right"></i></button></header><div>${linhas.map(([l,v])=>`<p><span>${escaparHtmlDashboard(l)}</span><strong>${escaparHtmlDashboard(v)}</strong></p>`).join('')}</div></article>`;}
