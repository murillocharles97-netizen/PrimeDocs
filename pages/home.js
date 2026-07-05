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
