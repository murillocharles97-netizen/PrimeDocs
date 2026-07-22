/* Editor de pedidos pensado exclusivamente para celulares. */
(function () {
    "use strict";

    const BREAKPOINT = "(max-width: 767px)";
    const abrirPedidoDesktop = window.abrirModalPedido;
    const fecharModalOriginal = Modal.fechar.bind(Modal);
    let abaAtual = "geral";
    let itemAberto = -1;
    let seletorProdutosAberto = false;

    const numero = valor => Math.max(0, Number(valor) || 0);
    const inteiro = valor => Math.max(1, Math.floor(Number(valor) || 1));
    const esc = valor => escaparPedido(valor);
    const moeda = valor => Utils.moeda(numero(valor));
    const minutosTexto = valor => {
        const total = Math.max(0, Math.round(numero(valor)));
        const horas = Math.floor(total / 60);
        const minutos = total % 60;
        return [horas ? `${horas}h` : "", minutos ? `${minutos}min` : ""].filter(Boolean).join(" ") || "0min";
    };

    function isMobile() {
        return window.matchMedia?.(BREAKPOINT).matches;
    }

    function imagemProduto(produto = {}, item = {}) {
        return item.imagem || produto.imagem || produto.foto || produto.imagemUrl || produto.image || produto.thumbnail || "";
    }

    function dadosTecnicosProduto(produto = {}) {
        const operacoes = window.Producao?.obterReceita ? Producao.obterReceita(produto) : [];
        if (!operacoes.length) return { peso: numero(produto.peso), tempo: numero(produto.tempoPrevistoMinutos) };
        return operacoes.reduce((resumo, operacao) => {
            resumo.peso += numero(operacao.pesoTotalGramas);
            resumo.tempo += numero(operacao.tempoHoras) * 60 + numero(operacao.tempoMinutos || operacao.tempoPrevistoMinutos);
            return resumo;
        }, { peso: 0, tempo: 0 });
    }

    function filamentoDoItem(item = {}) {
        return Storage.listarFilamentos().find(f => String(f.id) === String(item.filamentoId));
    }

    function calcularItem(item = {}) {
        const quantidade = inteiro(item.quantidade);
        const valorUnitario = numero(item.valorUnitario);
        const produto = item.produtoId ? Storage.buscarProdutoPorId(item.produtoId) : null;
        const tecnico = produto ? dadosTecnicosProduto(produto) : { peso: numero(item.pesoPrevistoGramas), tempo: numero(item.tempoPrevistoMinutos) };
        const pesoUnitario = numero(item.pesoPrevistoGramas ?? tecnico.peso);
        const tempoUnitario = numero(item.tempoPrevistoMinutos ?? tecnico.tempo);
        const config = Storage.carregarConfigCustos();
        const filamento = filamentoDoItem(item);
        const precoKg = numero(item.precoKgFilamento || filamento?.precoKg || config.precoKgFilamentoPadrao);

        let material = 0;
        let energia = 0;
        let depreciacao = 0;
        let maoDeObra = 0;
        let embalagem = 0;
        let adicionais = 0;
        let imposto = 0;
        let custoUnitario = numero(item.custoUnitario ?? produto?.custoEstimado ?? produto?.custo);

        if (item.personalizado) {
            const horas = tempoUnitario / 60;
            material = (precoKg / 1000) * pesoUnitario * (1 + numero(config.perdaPercentual) / 100);
            energia = horas * numero(config.custoEnergiaHora);
            depreciacao = horas * numero(config.custoDepreciacaoHora);
            maoDeObra = item.cobrarMaoDeObra
                ? horas * numero(config.valorMaoDeObraHora)
                : numero(item.custoMaoDeObraUnitario);
            embalagem = numero(item.custoEmbalagemUnitario ?? config.custoEmbalagemPadrao);
            adicionais = numero(item.custoAdicionalUnitario);
            const subtotal = material + energia + depreciacao + maoDeObra + embalagem + adicionais;
            imposto = subtotal * numero(config.taxaImpostoPercentual) / 100;
            custoUnitario = subtotal + imposto;
        }

        const valorTotal = valorUnitario * quantidade;
        const custoTotal = custoUnitario * quantidade;
        const lucroTotal = valorTotal - custoTotal;
        const margem = valorTotal > 0 ? (lucroTotal / valorTotal) * 100 : 0;
        return {
            quantidade,
            valorUnitario,
            valorTotal,
            pesoUnitario,
            pesoTotal: pesoUnitario * quantidade,
            tempoUnitario,
            tempoTotal: tempoUnitario * quantidade,
            precoKg,
            material,
            energia,
            depreciacao,
            maoDeObra,
            embalagem,
            adicionais,
            imposto,
            custoUnitario,
            custoTotal,
            lucroUnitario: valorUnitario - custoUnitario,
            lucroTotal,
            margem
        };
    }

    function enriquecerItem(item) {
        const calculo = calcularItem(item);
        const filamento = filamentoDoItem(item);
        Object.assign(item, {
            quantidade: calculo.quantidade,
            valorUnitario: calculo.valorUnitario,
            valorTotal: calculo.valorTotal,
            pesoPrevistoGramas: calculo.pesoUnitario,
            tempoPrevistoMinutos: calculo.tempoUnitario,
            precoKgFilamento: calculo.precoKg,
            filamentoNome: filamento ? [filamento.material, filamento.cor, filamento.marca].filter(Boolean).join(" · ") : (item.filamentoNome || ""),
            custoFilamentoUnitario: calculo.material,
            custoEnergiaUnitario: calculo.energia,
            custoDepreciacaoUnitario: calculo.depreciacao,
            custoMaoDeObraUnitario: calculo.maoDeObra,
            custoEmbalagemUnitario: calculo.embalagem,
            custoAdicionalUnitario: calculo.adicionais,
            custoImpostoUnitario: calculo.imposto,
            custoUnitario: calculo.custoUnitario,
            custoTotal: calculo.custoTotal,
            lucroUnitario: calculo.lucroUnitario,
            lucroTotal: calculo.lucroTotal,
            margemLucro: calculo.margem
        });
        return item;
    }

    function calcularResumo() {
        return itensPedidoEdicao.reduce((resumo, item) => {
            const calc = calcularItem(item);
            resumo.venda += calc.valorTotal;
            resumo.custo += calc.custoTotal;
            resumo.peso += calc.pesoTotal;
            resumo.tempo += calc.tempoTotal;
            resumo.pecas += calc.quantidade;
            resumo.filamento += calc.material * calc.quantidade;
            return resumo;
        }, { venda: 0, custo: 0, peso: 0, tempo: 0, pecas: 0, filamento: 0, itens: itensPedidoEdicao.length });
    }

    function analiseRentabilidade(resumo = calcularResumo()) {
        const lucro = resumo.venda - resumo.custo;
        const margem = resumo.venda > 0 ? lucro / resumo.venda * 100 : 0;
        if (!resumo.venda) return { nivel: "neutra", titulo: "Preencha os valores do pedido", texto: "A análise será atualizada automaticamente.", icone: "info" };
        if (margem >= 60) return { nivel: "excelente", titulo: "Excelente rentabilidade", texto: "Este pedido apresenta lucro e margem muito saudáveis.", icone: "badge-check" };
        if (margem >= 35) return { nivel: "boa", titulo: "Boa margem", texto: "A rentabilidade está dentro de uma faixa segura.", icone: "trending-up" };
        if (margem >= 15) return { nivel: "atencao", titulo: "Margem de atenção", texto: "Revise custos ou preço antes de confirmar.", icone: "triangle-alert" };
        return { nivel: "baixa", titulo: "Margem baixa", texto: "O pedido pode ter pouco retorno ou operar no prejuízo.", icone: "circle-alert" };
    }

    function renderResumoFinanceiro(compacto = false) {
        const r = calcularResumo();
        const lucro = r.venda - r.custo;
        const margem = r.venda > 0 ? lucro / r.venda * 100 : 0;
        return `<div class="mobileOrderFinancialGrid ${compacto ? "isCompact" : ""}">
            <div><span>Venda</span><strong>${moeda(r.venda)}</strong></div>
            <div><span>Custo</span><strong class="isCost">${moeda(r.custo)}</strong></div>
            <div><span>Lucro</span><strong class="${lucro < 0 ? "isCost" : "isProfit"}">${moeda(lucro)}</strong></div>
            <div><span>Margem</span><strong class="${margem < 15 ? "isCost" : "isProfit"}">${margem.toFixed(0)}%</strong></div>
        </div>`;
    }

    function renderGeral(pedido, clientes, clienteSelecionado) {
        return `<section class="mobileOrderTabPanel isActive" data-mobile-order-panel="geral">
            <div class="mobileOrderSectionCard">
                <div class="mobileOrderClientLine">
                    <label class="mobileOrderField isWide"><span>Cliente *</span><select id="pedidoCliente"><option value="">Selecione um cliente</option>${clientes.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(clienteSelecionado) ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
                    <button type="button" class="mobileOrderIconButton" onclick="PedidosEditorMobile.alternarClienteRapido()" aria-label="Cadastrar cliente"><i data-lucide="user-plus"></i></button>
                </div>
                <div id="clienteRapidoPedido" class="mobileOrderQuickClient" hidden>
                    <label class="mobileOrderField"><span>Nome *</span><input id="clienteRapidoNome" placeholder="Nome do cliente"></label>
                    <label class="mobileOrderField"><span>WhatsApp</span><input id="clienteRapidoWhatsapp" inputmode="tel" placeholder="(00) 00000-0000"></label>
                </div>
            </div>
            <div class="mobileOrderSectionCard mobileOrderFormGrid">
                <label class="mobileOrderField isWide"><span>Status do pedido</span><select id="pedidoStatus">${Object.entries(STATUS_PEDIDOS).map(([valor, rotulo]) => `<option value="${valor}" ${(pedido?.statusPedido || "aguardando_orcamento") === valor ? "selected" : ""}>${esc(rotulo)}</option>`).join("")}</select></label>
                <label class="mobileOrderField"><span>Data do pedido</span><input id="pedidoData" type="date" value="${pedido?.dataPedido || Utils.hoje()}"></label>
                <label class="mobileOrderField"><span>Previsão de entrega</span><input id="pedidoEntrega" type="date" value="${pedido?.dataEntregaPrevista || Utils.hoje()}"></label>
                <label class="mobileOrderField isWide"><span>Valor pago</span><div class="mobileOrderMoneyInput"><i data-lucide="banknote"></i><input id="pedidoValorPago" type="number" min="0" step="0.01" value="${numero(pedido?.valorPago)}" oninput="PedidosEditorMobile.atualizarResumos()"></div></label>
                <label class="mobileOrderField isWide"><span>Observações do pedido</span><textarea id="pedidoObservacoes" rows="4" placeholder="Informações importantes para este pedido">${esc(pedido?.observacoes || "")}</textarea></label>
            </div>
            <div class="mobileOrderSectionCard">
                <div class="mobileOrderCardTitle"><span>Resumo financeiro</span><i data-lucide="chart-no-axes-combined"></i></div>
                <div id="mobileOrderGeneralSummary">${renderResumoFinanceiro()}</div>
            </div>
        </section>`;
    }

    function renderItensTab() {
        return `<section class="mobileOrderTabPanel" data-mobile-order-panel="itens">
            <div class="mobileOrderAddGrid">
                <button type="button" onclick="PedidosEditorMobile.abrirProdutos()"><i data-lucide="plus"></i><span>Adicionar produto</span></button>
                <button type="button" onclick="PedidosEditorMobile.adicionarPersonalizado()"><i data-lucide="sparkles"></i><span>Produto personalizado</span></button>
            </div>
            <div id="mobileOrderProductPicker" class="mobileOrderProductPicker" hidden>
                <label><i data-lucide="search"></i><input id="mobileOrderProductSearch" placeholder="Buscar produto cadastrado" oninput="PedidosEditorMobile.renderProdutos()"></label>
                <div id="produtosPedidoDisponiveis"></div>
            </div>
            <div class="mobileOrderListHeading"><strong>Produtos do pedido</strong><span id="mobileOrderItemsCount">0 itens</span></div>
            <div id="itensPedidoEditor" class="mobileOrderItems"></div>
            <button type="button" class="mobileOrderAddAnother" onclick="PedidosEditorMobile.adicionarPersonalizado()"><i data-lucide="plus"></i> Adicionar novo item</button>
            <div id="totalPedidoEditor" class="mobileOrderTotal"></div>
        </section>`;
    }

    function renderCustosTab() {
        return `<section class="mobileOrderTabPanel" data-mobile-order-panel="custos">
            <div class="mobileOrderSectionCard">
                <div class="mobileOrderCardTitle"><span>Análise do pedido</span><i data-lucide="chart-spline"></i></div>
                <div id="mobileOrderCostsSummary"></div>
            </div>
            <div id="mobileOrderProfitAnalysis"></div>
        </section>`;
    }

    function contextoProducao() {
        const ordens = pedidoEditandoId ? Storage.listarOrdensProducao().filter(o => String(o.pedidoId) === String(pedidoEditandoId) && o.status !== "cancelada") : [];
        const lotes = Storage.listarLotesExecucao ? Storage.listarLotesExecucao().filter(l => ordens.some(o => String(o.id) === String(l.ordemProducaoId))) : [];
        const concluidas = ordens.filter(o => o.status === "concluida");
        const quantidadeProduzida = concluidas.reduce((total, ordem) => total + numero(ordem.quantidade), 0);
        const progresso = ordens.length ? ordens.reduce((total, ordem) => total + numero(ordem.progresso), 0) / ordens.length : 0;
        const tempoRestante = lotes.reduce((total, lote) => total + numero(lote.tempoPrevistoMinutos) * (1 - Math.min(100, numero(lote.progresso)) / 100), 0);
        const reservado = lotes.flatMap(l => l.filamentosSelecionados || []).reduce((total, f) => total + numero(f.pesoReservadoGramas || f.pesoPrevistoGramas), 0);
        return { ordens, quantidadeProduzida, progresso, tempoRestante, reservado };
    }

    function renderProducaoTab() {
        const c = contextoProducao();
        return `<section class="mobileOrderTabPanel" data-mobile-order-panel="producao">
            <div class="mobileOrderProductionHero">
                <div><span>Progresso geral</span><strong>${Math.round(c.progresso)}%</strong></div>
                <div class="mobileOrderProgress"><i style="width:${Math.min(100, c.progresso)}%"></i></div>
                <p>${c.ordens.length ? `${c.ordens.length} ordem(ns) vinculada(s)` : "A produção poderá ser criada após salvar o pedido."}</p>
            </div>
            <div class="mobileOrderProductionMetrics">
                <div><i data-lucide="package-check"></i><span>Produzido</span><strong>${c.quantidadeProduzida} un.</strong></div>
                <div><i data-lucide="clock-3"></i><span>Tempo restante</span><strong>${minutosTexto(c.tempoRestante)}</strong></div>
                <div><i data-lucide="spool"></i><span>Filamento reservado</span><strong>${c.reservado.toFixed(0)} g</strong></div>
                <div><i data-lucide="list-checks"></i><span>Ordens</span><strong>${c.ordens.length}</strong></div>
            </div>
            <button type="button" class="mobileOrderOpenProduction" onclick="PedidosEditorMobile.abrirProducao()"><i data-lucide="factory"></i> Abrir Produção</button>
        </section>`;
    }

    function abrir(id = null, clienteIdInicial = null) {
        const pedido = id ? Storage.buscarPedidoPorId(id) : null;
        if (pedido && ["pronto", "entregue", "cancelado"].includes(pedido.statusPedido)) return Toast.show("Este pedido está bloqueado para edição. Reative-o ou revise o histórico.");
        pedidoEditandoId = pedido?.id || null;
        itensPedidoEdicao = (pedido?.itens || []).map(item => enriquecerItem({ ...item }));
        abaAtual = "geral";
        itemAberto = -1;
        seletorProdutosAberto = false;
        const clientes = Storage.listarClientes().filter(c => c.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        const clienteSelecionado = pedido?.clienteId || clienteIdInicial;
        const numeroPedido = pedido ? `#${String(pedido.id).slice(-5)}` : "Novo pedido";

        Modal.abrir("", `<div class="mobileOrderEditor">
            <header class="mobileOrderEditorHeader">
                <div><h2>${pedido ? "Editar pedido" : "Novo pedido"}</h2><span>${numeroPedido}</span></div>
                <button type="button" onclick="Modal.fechar()" aria-label="Fechar"><i data-lucide="x"></i></button>
            </header>
            <nav class="mobileOrderTabs" aria-label="Etapas do pedido">
                ${[["geral", "house", "Geral"], ["itens", "shopping-bag", "Itens"], ["custos", "circle-dollar-sign", "Custos"], ["producao", "drill", "Produção"]].map(([idAba, icone, rotulo]) => `<button type="button" data-mobile-order-tab="${idAba}" class="${idAba === abaAtual ? "isActive" : ""}" onclick="PedidosEditorMobile.aba('${idAba}')"><i data-lucide="${icone}"></i><span>${rotulo}</span></button>`).join("")}
            </nav>
            <main class="mobileOrderEditorBody">
                ${renderGeral(pedido, clientes, clienteSelecionado)}
                ${renderItensTab()}
                ${renderCustosTab()}
                ${renderProducaoTab()}
            </main>
            <footer class="mobileOrderEditorFooter">
                <button type="button" class="mobileOrderCancel" onclick="Modal.fechar()">Cancelar</button>
                <button type="button" class="mobileOrderSave" onclick="PedidosEditorMobile.salvar()"><i data-lucide="save"></i> Salvar pedido</button>
            </footer>
        </div>`);
        const root = document.getElementById("modalRoot");
        root?.classList.add("mobileOrderEditorRoot");
        document.body.classList.add("mobileOrderEditorOpen");
        renderItens();
        atualizarCustos();
        lucide.createIcons();
    }

    function renderProdutos() {
        const alvo = document.getElementById("produtosPedidoDisponiveis");
        if (!alvo) return;
        const termo = (document.getElementById("mobileOrderProductSearch")?.value || "").toLocaleLowerCase("pt-BR");
        const produtos = Storage.listarProdutos().filter(p => p.ativo !== false && [p.nome, p.codigo, p.categoria].join(" ").toLocaleLowerCase("pt-BR").includes(termo))
            .sort((a, b) => Number(Boolean(b.favorito)) - Number(Boolean(a.favorito)) || String(a.nome).localeCompare(String(b.nome), "pt-BR")).slice(0, 12);
        alvo.innerHTML = produtos.map(produto => {
            const imagem = imagemProduto(produto);
            return `<button type="button" onclick="PedidosEditorMobile.adicionarProduto('${esc(produto.id)}')">
                <span class="mobileOrderProductThumb">${imagem ? `<img src="${esc(imagem)}" alt="">` : `<i data-lucide="box"></i>`}</span>
                <span><strong>${esc(produto.nome)}</strong><small>${esc(produto.codigo || produto.categoria || "Produto cadastrado")}</small></span>
                <b>${moeda(produto.preco)}</b>
            </button>`;
        }).join("") || `<div class="mobileOrderEmpty">Nenhum produto encontrado.</div>`;
        lucide.createIcons();
    }

    function abrirProdutos() {
        seletorProdutosAberto = !seletorProdutosAberto;
        const seletor = document.getElementById("mobileOrderProductPicker");
        if (!seletor) return;
        seletor.hidden = !seletorProdutosAberto;
        if (seletorProdutosAberto) {
            renderProdutos();
            document.getElementById("mobileOrderProductSearch")?.focus();
        }
    }

    function adicionarProduto(id) {
        const existente = itensPedidoEdicao.find(item => String(item.produtoId) === String(id) && !item.personalizado);
        if (existente) existente.quantidade = inteiro(existente.quantidade) + 1;
        else {
            const produto = Storage.buscarProdutoPorId(id);
            if (!produto) return Toast.show("Produto não encontrado.");
            const tecnico = dadosTecnicosProduto(produto);
            itensPedidoEdicao.push(enriquecerItem({
                produtoId: produto.id,
                codigo: produto.codigo || "",
                categoria: produto.categoria || "",
                imagem: imagemProduto(produto),
                nome: produto.nome,
                quantidade: 1,
                valorUnitario: numero(produto.preco),
                valorTotal: numero(produto.preco),
                pesoPrevistoGramas: tecnico.peso,
                tempoPrevistoMinutos: tecnico.tempo,
                custoUnitario: numero(produto.custoEstimado ?? produto.custo),
                personalizado: false,
                observacao: ""
            }));
        }
        renderItens();
        atualizarCustos();
        Toast.show("Produto adicionado.");
    }

    function adicionarPersonalizado() {
        const config = Storage.carregarConfigCustos();
        itensPedidoEdicao.push(enriquecerItem({
            produtoId: null,
            nome: "",
            codigo: "",
            categoria: "Personalizado",
            quantidade: 1,
            valorUnitario: 0,
            valorTotal: 0,
            personalizado: true,
            pesoPrevistoGramas: 0,
            tempoPrevistoMinutos: 0,
            filamentoId: "",
            precoKgFilamento: numero(config.precoKgFilamentoPadrao),
            custoEmbalagemUnitario: numero(config.custoEmbalagemPadrao),
            custoAdicionalUnitario: 0,
            observacao: ""
        }));
        itemAberto = itensPedidoEdicao.length - 1;
        renderItens();
        atualizarCustos();
    }

    function opcoesFilamento(item) {
        const filamentos = Storage.listarFilamentos().filter(f => f.ativo !== false).sort((a, b) => [a.material, a.cor].join(" ").localeCompare([b.material, b.cor].join(" "), "pt-BR"));
        return `<option value="">Preço padrão (${moeda(Storage.carregarConfigCustos().precoKgFilamentoPadrao)}/kg)</option>${filamentos.map(f => `<option value="${esc(f.id)}" ${String(f.id) === String(item.filamentoId) ? "selected" : ""}>${esc([f.material, f.cor, f.marca].filter(Boolean).join(" · "))}</option>`).join("")}`;
    }

    function renderEditorItem(item, indice) {
        const calc = calcularItem(item);
        const horas = Math.floor(calc.tempoUnitario / 60);
        const minutos = Math.round(calc.tempoUnitario % 60);
        return `<div class="mobileOrderItemEditor">
            ${item.personalizado ? `<label class="mobileOrderField isWide"><span>Nome do produto</span><input value="${esc(item.nome)}" placeholder="Ex.: Organizador personalizado" oninput="PedidosEditorMobile.editar(${indice},'nome',this.value)"></label>` : ""}
            <div class="mobileOrderFormGrid">
                <label class="mobileOrderField"><span>Quantidade</span><input type="number" min="1" value="${calc.quantidade}" oninput="PedidosEditorMobile.editar(${indice},'quantidade',this.value)"></label>
                <label class="mobileOrderField"><span>Valor unitário (R$)</span><input type="number" min="0" step="0.01" value="${calc.valorUnitario}" oninput="PedidosEditorMobile.editar(${indice},'valorUnitario',this.value)"></label>
                ${item.personalizado ? `<label class="mobileOrderField"><span>Peso estimado por unidade</span><div class="mobileOrderSuffixInput"><input type="number" min="0" step="0.1" value="${calc.pesoUnitario}" oninput="PedidosEditorMobile.editar(${indice},'pesoPrevistoGramas',this.value)"><b>g</b></div></label>
                <div class="mobileOrderField"><span>Tempo por unidade</span><div class="mobileOrderTimeInputs"><label><input type="number" min="0" value="${horas}" oninput="PedidosEditorMobile.editarTempo(${indice},'horas',this.value)"><b>h</b></label><label><input type="number" min="0" max="59" value="${minutos}" oninput="PedidosEditorMobile.editarTempo(${indice},'minutos',this.value)"><b>min</b></label></div></div>
                <label class="mobileOrderField isWide"><span>Filamento principal</span><select onchange="PedidosEditorMobile.editar(${indice},'filamentoId',this.value)">${opcoesFilamento(item)}</select></label>
                <details class="mobileOrderCostAdjustments isWide"><summary>Ajustar custos adicionais</summary><div><label class="mobileOrderField"><span>Embalagem (un.)</span><input type="number" min="0" step="0.01" value="${numero(item.custoEmbalagemUnitario)}" oninput="PedidosEditorMobile.editar(${indice},'custoEmbalagemUnitario',this.value)"></label><label class="mobileOrderField"><span>Outros custos (un.)</span><input type="number" min="0" step="0.01" value="${numero(item.custoAdicionalUnitario)}" oninput="PedidosEditorMobile.editar(${indice},'custoAdicionalUnitario',this.value)"></label></div></details>` : ""}
                <label class="mobileOrderField isWide"><span>Observação do item</span><textarea rows="3" placeholder="Detalhes de acabamento, cor ou entrega" oninput="PedidosEditorMobile.editar(${indice},'observacao',this.value)">${esc(item.observacao || "")}</textarea></label>
            </div>
            ${item.personalizado ? `<div class="mobileOrderItemCosts" id="mobileOrderItemCosts-${indice}">${renderCustosItem(calc)}</div>` : ""}
        </div>`;
    }

    function renderCustosItem(calc) {
        return `<div class="mobileOrderCostRows">
            <span>Filamento <b>${moeda(calc.material)}</b></span><span>Energia <b>${moeda(calc.energia)}</b></span><span>Depreciação <b>${moeda(calc.depreciacao)}</b></span><span>Embalagem <b>${moeda(calc.embalagem)}</b></span><span>Adicionais <b>${moeda(calc.adicionais + calc.maoDeObra + calc.imposto)}</b></span><strong>Custo unitário <b>${moeda(calc.custoUnitario)}</b></strong>
        </div><div class="mobileOrderProfitMini"><span>Lucro unitário <b>${moeda(calc.lucroUnitario)}</b></span><span>Margem <b>${calc.margem.toFixed(0)}%</b></span><span>Lucro total <b>${moeda(calc.lucroTotal)}</b></span></div>`;
    }

    function renderCardItem(item, indice) {
        const calc = calcularItem(item);
        const produto = item.produtoId ? Storage.buscarProdutoPorId(item.produtoId) : null;
        const imagem = imagemProduto(produto || {}, item);
        return `<article class="mobileOrderItemCard ${itemAberto === indice ? "isEditing" : ""}">
            <div class="mobileOrderItemSummary">
                <div class="mobileOrderItemImage">${imagem ? `<img src="${esc(imagem)}" alt="">` : `<i data-lucide="${item.personalizado ? "sparkles" : "box"}"></i>`}</div>
                <div class="mobileOrderItemIdentity"><strong>${esc(item.nome || "Produto personalizado")}</strong><span>${item.personalizado ? "Personalizado" : `Código: ${esc(item.codigo || produto?.codigo || "—")}`}</span><small>${calc.quantidade} ${calc.quantidade === 1 ? "unidade" : "unidades"} · ${moeda(calc.valorUnitario)} cada</small></div>
                <div class="mobileOrderItemActions"><button type="button" onclick="PedidosEditorMobile.expandir(${indice})" aria-label="Editar"><i data-lucide="pencil"></i></button><button type="button" class="isDelete" onclick="PedidosEditorMobile.remover(${indice})" aria-label="Excluir"><i data-lucide="trash-2"></i></button></div>
                <div class="mobileOrderItemValue">Total: <strong>${moeda(calc.valorTotal)}</strong></div>
            </div>
            ${itemAberto === indice ? renderEditorItem(item, indice) : ""}
        </article>`;
    }

    function renderItens() {
        const alvo = document.getElementById("itensPedidoEditor");
        if (!alvo) return;
        itensPedidoEdicao.forEach(enriquecerItem);
        alvo.innerHTML = itensPedidoEdicao.length ? itensPedidoEdicao.map(renderCardItem).join("") : `<div class="mobileOrderEmpty"><i data-lucide="shopping-bag"></i><strong>Nenhum item adicionado</strong><span>Escolha um produto cadastrado ou crie um personalizado.</span></div>`;
        const contador = document.getElementById("mobileOrderItemsCount");
        if (contador) contador.textContent = `${itensPedidoEdicao.length} ${itensPedidoEdicao.length === 1 ? "item" : "itens"}`;
        atualizarTotal();
        lucide.createIcons();
    }

    function atualizarTotal() {
        const r = calcularResumo();
        const alvo = document.getElementById("totalPedidoEditor");
        if (alvo) alvo.innerHTML = `<div><span>Total do pedido</span><strong>${moeda(r.venda)}</strong></div><p><span><i data-lucide="shopping-bag"></i>${r.itens} itens</span><span><i data-lucide="clock-3"></i>${minutosTexto(r.tempo)}</span><span><i data-lucide="weight"></i>${r.peso.toFixed(0)} g</span></p>`;
        lucide.createIcons();
    }

    function editar(indice, campo, valor) {
        const item = itensPedidoEdicao[indice];
        if (!item) return;
        if (["quantidade", "valorUnitario", "pesoPrevistoGramas", "custoEmbalagemUnitario", "custoAdicionalUnitario"].includes(campo)) valor = campo === "quantidade" ? inteiro(valor) : numero(valor);
        item[campo] = valor;
        enriquecerItem(item);
        atualizarResumos();
        const custos = document.getElementById(`mobileOrderItemCosts-${indice}`);
        if (custos) custos.innerHTML = renderCustosItem(calcularItem(item));
        const card = custos?.closest(".mobileOrderItemCard");
        if (card) {
            const total = card.querySelector(".mobileOrderItemValue strong");
            if (total) total.textContent = moeda(item.valorTotal);
        }
    }

    function editarTempo(indice, parte, valor) {
        const item = itensPedidoEdicao[indice];
        if (!item) return;
        const atual = numero(item.tempoPrevistoMinutos);
        const horas = parte === "horas" ? numero(valor) : Math.floor(atual / 60);
        const minutos = parte === "minutos" ? Math.min(59, numero(valor)) : atual % 60;
        editar(indice, "tempoPrevistoMinutos", horas * 60 + minutos);
    }

    function expandir(indice) {
        itemAberto = itemAberto === indice ? -1 : indice;
        renderItens();
        if (itemAberto >= 0) document.querySelectorAll(".mobileOrderItemCard")[itemAberto]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function remover(indice) {
        itensPedidoEdicao.splice(indice, 1);
        itemAberto = -1;
        renderItens();
        atualizarCustos();
    }

    function atualizarCustos() {
        itensPedidoEdicao.forEach(enriquecerItem);
        const r = calcularResumo();
        const lucro = r.venda - r.custo;
        const margem = r.venda > 0 ? lucro / r.venda * 100 : 0;
        const custoHora = r.tempo > 0 ? r.custo / (r.tempo / 60) : r.custo;
        const resumo = document.getElementById("mobileOrderCostsSummary");
        if (resumo) resumo.innerHTML = `<div class="mobileOrderAnalysisGrid">
            <div><i data-lucide="badge-dollar-sign"></i><span>Venda total</span><strong>${moeda(r.venda)}</strong></div>
            <div><i data-lucide="trending-up"></i><span>Lucro total</span><strong class="isProfit">${moeda(lucro)}</strong></div>
            <div><i data-lucide="percent"></i><span>Margem</span><strong>${margem.toFixed(0)}%</strong></div>
            <div><i data-lucide="thermometer"></i><span>Custo total</span><strong>${moeda(r.custo)}</strong></div>
            <div><i data-lucide="clock-3"></i><span>Tempo total</span><strong>${minutosTexto(r.tempo)}</strong></div>
            <div><i data-lucide="weight"></i><span>Filamento total</span><strong>${r.peso.toFixed(0)} g</strong></div>
            <div><i data-lucide="gauge"></i><span>Custo / hora</span><strong>${moeda(custoHora)}</strong></div>
            <div><i data-lucide="boxes"></i><span>Peças</span><strong>${r.pecas}</strong></div>
        </div>`;
        const analise = analiseRentabilidade(r);
        const alvoAnalise = document.getElementById("mobileOrderProfitAnalysis");
        if (alvoAnalise) alvoAnalise.innerHTML = `<article class="mobileOrderProfitAnalysis is-${analise.nivel}"><i data-lucide="${analise.icone}"></i><div><strong>${analise.titulo}</strong><p>${analise.texto}</p></div></article>`;
        const geral = document.getElementById("mobileOrderGeneralSummary");
        if (geral) geral.innerHTML = renderResumoFinanceiro();
        atualizarTotal();
        lucide.createIcons();
    }

    function atualizarResumos() {
        atualizarCustos();
    }

    function aba(nome) {
        abaAtual = nome;
        document.querySelectorAll("[data-mobile-order-tab]").forEach(botao => botao.classList.toggle("isActive", botao.dataset.mobileOrderTab === nome));
        document.querySelectorAll("[data-mobile-order-panel]").forEach(painel => painel.classList.toggle("isActive", painel.dataset.mobileOrderPanel === nome));
        document.querySelector(`.mobileOrderTabPanel[data-mobile-order-panel="${nome}"]`)?.scrollTo({ top: 0 });
        if (nome === "custos") atualizarCustos();
        lucide.createIcons();
    }

    function alternarClienteRapido() {
        const alvo = document.getElementById("clienteRapidoPedido");
        if (!alvo) return;
        alvo.hidden = !alvo.hidden;
        if (!alvo.hidden) document.getElementById("clienteRapidoNome")?.focus();
    }

    function salvar() {
        itensPedidoEdicao.forEach(enriquecerItem);
        const cliente = document.getElementById("pedidoCliente")?.value;
        const nomeRapido = document.getElementById("clienteRapidoNome")?.value.trim();
        if (!cliente && !nomeRapido) {
            aba("geral");
            return Toast.show("Selecione ou cadastre um cliente.");
        }
        if (!itensPedidoEdicao.length) {
            aba("itens");
            return Toast.show("Adicione ao menos um item ao pedido.");
        }
        const incompleto = itensPedidoEdicao.findIndex(item => !String(item.nome || "").trim());
        if (incompleto >= 0) {
            aba("itens");
            itemAberto = incompleto;
            renderItens();
            return Toast.show("Informe o nome do produto personalizado.");
        }
        salvarPedido();
    }

    function abrirProducao() {
        if (!pedidoEditandoId) return Toast.show("Salve o pedido antes de abrir a produção.");
        Modal.fechar();
        navegar("producao", { pedidoId: pedidoEditandoId });
    }

    Modal.fechar = function (event) {
        const root = document.getElementById("modalRoot");
        const eraEditorMobile = root?.classList.contains("mobileOrderEditorRoot");
        fecharModalOriginal(event);
        if (eraEditorMobile && (!event || event.target?.classList.contains("modalOverlay"))) {
            root?.classList.remove("mobileOrderEditorRoot");
            document.body.classList.remove("mobileOrderEditorOpen");
        }
    };

    window.abrirModalPedido = function (id = null, clienteIdInicial = null) {
        return isMobile() ? abrir(id, clienteIdInicial) : abrirPedidoDesktop(id, clienteIdInicial);
    };

    window.PedidosEditorMobile = {
        abrir,
        aba,
        abrirProdutos,
        renderProdutos,
        adicionarProduto,
        adicionarPersonalizado,
        editar,
        editarTempo,
        expandir,
        remover,
        atualizarResumos,
        alternarClienteRapido,
        salvar,
        abrirProducao,
        _calcularItem: calcularItem,
        _calcularResumo: calcularResumo,
        _analiseRentabilidade: analiseRentabilidade
    };
})();
