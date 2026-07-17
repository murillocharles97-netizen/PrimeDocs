(function () {
    "use strict";

    const media = window.matchMedia("(max-width: 767px)");
    const renderDesktop = window.renderProdutos;
    const renderTelaDesktop = window.renderTelaProdutos;
    const listarDesktop = window.listarProdutos;
    const estado = {
        colecaoId: "todos", filtro: "todos", busca: "", ordem: "nome_az",
        pagina: 1, porPagina: 30, expandido: "", scroll: 0,
        avancado: { categoria: "", material: "", cor: "", ativo: "todos", precoMin: "", precoMax: "" }
    };
    let buscaTimer = 0;
    let contexto = null;

    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const chave = valor => String(valor ?? "");
    const num = valor => Number(valor) || 0;
    const normalizarTexto = valor => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

    function estoque(produto) {
        return typeof obterEstoqueProduto === "function" ? obterEstoqueProduto(produto) : Math.max(0, num(produto.estoque ?? produto.estoqueAtual ?? produto.quantidadeEstoque));
    }

    function limiteBaixo(produto) {
        const configuracoes = Storage.carregarConfiguracoes?.() || {};
        return Math.max(0, num(produto.estoqueMinimo ?? produto.alertaEstoqueMinimo ?? configuracoes.estoqueMinimo ?? 2));
    }

    function tempoMinutos(produto) {
        if (typeof minutosDoTempoProduto === "function") return Math.max(0, num(minutosDoTempoProduto(produto.tempo)));
        if (typeof produto.tempo === "number") return produto.tempo * 60;
        const texto = String(produto.tempo || "");
        const horas = num(texto.match(/(\d+(?:[.,]\d+)?)\s*h/i)?.[1]?.replace(",", "."));
        const minutos = num(texto.match(/(\d+)\s*m/i)?.[1]);
        return Math.round(horas * 60 + minutos);
    }

    function formatarTempo(minutos) {
        const total = Math.max(0, Math.round(num(minutos)));
        if (!total) return "Não informado";
        const h = Math.floor(total / 60), m = total % 60;
        return [h ? `${h}h` : "", m ? `${m}min` : ""].filter(Boolean).join(" ");
    }

    function materiaisProduto(produto) {
        const materiais = Array.isArray(produto.materiais) ? produto.materiais : [];
        const operacoes = Array.isArray(produto.operacoesModelo) ? produto.operacoesModelo : [];
        return [...materiais, ...operacoes.flatMap(op => Array.isArray(op.materiais) ? op.materiais : [])];
    }

    function construirContexto() {
        Storage.migrarColecoesProdutos?.();
        Producao.migrarDados?.();
        const produtos = Storage.listarProdutos();
        const colecoes = Storage.listarColecoesProdutos().filter(item => item.ativo !== false)
            .sort((a, b) => num(a.ordem) - num(b.ordem) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        const colecoesPorId = new Map(colecoes.map(item => [chave(item.id), item]));
        const vendasPorProduto = new Map();
        Storage.listarPedidos().filter(p => p.ativo !== false && !["cancelado", "aguardando_orcamento", "aguardando_aceite"].includes(p.statusPedido)).forEach(pedido => {
            (pedido.itens || []).forEach(item => {
                if (!item.produtoId) return;
                const id = chave(item.produtoId), atual = vendasPorProduto.get(id) || { quantidade: 0, valor: 0, ultima: "" };
                atual.quantidade += Math.max(0, num(item.quantidade));
                atual.valor += num(item.valorTotal || num(item.quantidade) * num(item.valorUnitario));
                const data = pedido.dataEntrega || pedido.dataPedido || pedido.criadoEm || "";
                if (data > atual.ultima) atual.ultima = data;
                vendasPorProduto.set(id, atual);
            });
        });
        const producaoPorProduto = new Map();
        Storage.listarOrdensProducao().filter(ordem => ordem.ativo !== false && !["concluida", "cancelada"].includes(ordem.status)).forEach(ordem => {
            const id = chave(ordem.produtoId); if (!id) return;
            producaoPorProduto.set(id, (producaoPorProduto.get(id) || 0) + Math.max(1, num(ordem.quantidade)));
        });
        return { produtos, colecoes, colecoesPorId, vendasPorProduto, producaoPorProduto };
    }

    function normalizarProduto(produto, ctx) {
        const mats = materiaisProduto(produto);
        const material = [...new Set(mats.map(item => item.material || item.tipo || item.nome).filter(Boolean))].join(", ") || produto.material || "";
        const cor = [...new Set(mats.map(item => item.cor).filter(Boolean))].join(", ") || produto.cor || "";
        const qtdEstoque = estoque(produto), minimo = limiteBaixo(produto), producao = ctx.producaoPorProduto.get(chave(produto.id)) || 0;
        const venda = ctx.vendasPorProduto.get(chave(produto.id)) || { quantidade: 0, valor: 0, ultima: "" };
        const preco = num(produto.preco), custo = num(produto.custo), lucro = preco - custo;
        let status = produto.ativo === false ? "inativo" : produto.arquivado ? "arquivado" : producao > 0 ? "produzindo" : qtdEstoque <= 0 ? "sem_estoque" : qtdEstoque <= minimo ? "baixo" : "estoque";
        return { ...produto, qtdEstoque, minimo, producao, venda, preco, custo, lucro, margem: preco ? lucro / preco * 100 : 0, material, cor, tempoMin: tempoMinutos(produto), colecao: ctx.colecoesPorId.get(chave(produto.colecaoId)), status };
    }

    function obterLista() {
        contexto = construirContexto();
        let lista = contexto.produtos.map(p => normalizarProduto(p, contexto));
        if (estado.filtro !== "arquivados") lista = lista.filter(p => p.ativo !== false && !p.arquivado);
        if (estado.colecaoId !== "todos") lista = lista.filter(p => chave(p.colecaoId) === estado.colecaoId);
        const termo = normalizarTexto(estado.busca.trim());
        if (termo) lista = lista.filter(p => normalizarTexto([p.nome, p.codigo, p.colecao?.nome, p.categoria, p.material, p.cor, p.tags?.join?.(" "), p.descricao].join(" ")).includes(termo));
        const filtros = {
            vendidos: p => p.venda.quantidade > 0,
            favoritos: p => Boolean(p.favorito),
            baixo: p => p.status === "baixo",
            sem_estoque: p => p.qtdEstoque <= 0,
            produzindo: p => p.producao > 0,
            arquivados: p => p.arquivado || p.ativo === false
        };
        if (filtros[estado.filtro]) lista = lista.filter(filtros[estado.filtro]);
        const av = estado.avancado;
        if (av.categoria) lista = lista.filter(p => p.categoria === av.categoria);
        if (av.material) lista = lista.filter(p => normalizarTexto(p.material).includes(normalizarTexto(av.material)));
        if (av.cor) lista = lista.filter(p => normalizarTexto(p.cor).includes(normalizarTexto(av.cor)));
        if (av.ativo !== "todos") lista = lista.filter(p => av.ativo === "ativo" ? p.ativo !== false : p.ativo === false);
        if (av.precoMin !== "") lista = lista.filter(p => p.preco >= num(av.precoMin));
        if (av.precoMax !== "") lista = lista.filter(p => p.preco <= num(av.precoMax));
        const ordenacoes = {
            nome_az: (a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"), nome_za: (a, b) => String(b.nome).localeCompare(String(a.nome), "pt-BR"),
            vendidos: (a, b) => b.venda.quantidade - a.venda.quantidade, recentes: (a, b) => new Date(b.atualizadoEm || b.criadoEm || 0) - new Date(a.atualizadoEm || a.criadoEm || 0),
            antigos: (a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0), preco_maior: (a, b) => b.preco - a.preco,
            preco_menor: (a, b) => a.preco - b.preco, lucro_maior: (a, b) => b.lucro - a.lucro, margem_maior: (a, b) => b.margem - a.margem,
            estoque_maior: (a, b) => b.qtdEstoque - a.qtdEstoque, estoque_menor: (a, b) => a.qtdEstoque - b.qtdEstoque,
            tempo_maior: (a, b) => b.tempoMin - a.tempoMin, peso_maior: (a, b) => num(b.peso) - num(a.peso), colecao: (a, b) => String(a.colecao?.nome || "").localeCompare(String(b.colecao?.nome || ""), "pt-BR")
        };
        return lista.sort(ordenacoes[estado.ordem] || ordenacoes.nome_az);
    }

    function contagens(listaTotal) {
        return {
            todos: listaTotal.filter(p => p.ativo !== false && !p.arquivado).length,
            vendidos: listaTotal.filter(p => p.venda.quantidade > 0).length,
            favoritos: listaTotal.filter(p => p.favorito).length,
            baixo: listaTotal.filter(p => p.status === "baixo").length,
            sem_estoque: listaTotal.filter(p => p.qtdEstoque <= 0).length,
            produzindo: listaTotal.filter(p => p.producao > 0).length,
            arquivados: listaTotal.filter(p => p.arquivado || p.ativo === false).length
        };
    }

    function CollectionsCarousel() {
        const totais = new Map();
        contexto.produtos.filter(p => p.ativo !== false && !p.arquivado).forEach(p => totais.set(chave(p.colecaoId), (totais.get(chave(p.colecaoId)) || 0) + 1));
        const principais = contexto.colecoes.filter(c => normalizarTexto(c.nome) !== "todos").slice(0, 4).map(c => ({ ...c, total: totais.get(chave(c.id)) || 0 }));
        const botoes = [{ id: "todos", nome: "Todos", icone: "layout-grid", cor: "#6D4AFF", total: contexto.produtos.filter(p => p.ativo !== false && !p.arquivado).length }, ...principais];
        return `<div class="mobileProductCollections" aria-label="Filtrar por coleção">${botoes.map(c => `<button class="${estado.colecaoId === chave(c.id) ? "isActive" : ""}" style="--collection:${esc(c.cor || "#6D4AFF")}" onclick="ProdutosMobile.colecao('${esc(c.id)}')"><span><i data-lucide="${esc(c.icone || "boxes")}"></i></span><strong>${esc(c.nome)}</strong><small>${c.total}</small></button>`).join("")}<button class="mobileCollectionMore" onclick="ProdutosMobile.abrirColecoes()"><span><i data-lucide="ellipsis"></i></span><strong>Mais</strong><small>${Math.max(0, contexto.colecoes.length - principais.length) || ""}</small></button></div>`;
    }

    function ProductFilterChips(listaTotal) {
        const counts = contagens(listaTotal);
        const chips = [["vendidos", "Mais vendidos", "flame"], ["favoritos", "Favoritos", "star"], ["baixo", "Estoque baixo", "triangle-alert"], ["sem_estoque", "Sem estoque", "package-x"], ["produzindo", "Produzindo", "factory"], ["arquivados", "Arquivados", "archive"]];
        return `<div class="mobileProductQuickFilters">${chips.map(([id, label, icone]) => `<button class="${estado.filtro === id ? "isActive" : ""}" onclick="ProdutosMobile.filtro('${id}')"><i data-lucide="${icone}"></i>${label}<b>${counts[id]}</b></button>`).join("")}</div>`;
    }

    function statusProduto(p) {
        return {
            estoque: ["Em estoque", "success", "circle-check"], baixo: ["Estoque baixo", "warning", "triangle-alert"], sem_estoque: ["Sem estoque", "danger", "package-x"],
            produzindo: [`Produzindo ${p.producao}`, "production", "factory"], arquivado: ["Arquivado", "muted", "archive"], inativo: ["Inativo", "muted", "circle-off"]
        }[p.status] || ["Produto", "muted", "box"];
    }

    function ProductImage(p) {
        const imagem = p.imagem || p.foto || p.imagemUrl || p.image || p.thumbnail || "";
        return `<div class="mobileProductImage">${imagem ? `<img src="${esc(imagem)}" alt="${esc(p.nome || "Produto")}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>` : "<span>"}<i data-lucide="box"></i></span><button class="mobileProductFavorite ${p.favorito ? "isActive" : ""}" onclick="event.stopPropagation();ProdutosMobile.favorito('${esc(p.id)}')" aria-label="${p.favorito ? "Remover dos favoritos" : "Favoritar produto"}"><i data-lucide="star"></i></button></div>`;
    }

    function MobileProductCard(p) {
        const [status, classe, icone] = statusProduto(p), aberto = estado.expandido === chave(p.id);
        return `<div class="mobileProductSwipe" data-product-swipe="${esc(p.id)}"><div class="swipeAction swipeProduce"><i data-lucide="factory"></i><span>Produzir</span></div><div class="swipeAction swipeEdit"><i data-lucide="pencil"></i><span>Editar</span></div><article class="mobileProductCard ${aberto ? "isExpanded" : ""}" onclick="ProdutosMobile.expandir('${esc(p.id)}')">
            <div class="mobileProductCardMain">${ProductImage(p)}<div class="mobileProductIdentity"><h3>${esc(p.nome || "Produto sem nome")}</h3><p>${esc(p.codigo || "Sem SKU")} <b>•</b> ${esc(p.colecao?.nome || "Geral")}</p><span class="mobileProductStatus ${classe}" onclick="${p.producao ? `event.stopPropagation();ProdutosMobile.verProducao('${esc(p.id)}')` : ""}"><i data-lucide="${icone}"></i>${esc(status)}</span><div class="mobileProductValues"><strong>${Utils.moeda(p.preco)}</strong><span class="${p.lucro < 0 ? "negative" : ""}">Lucro ${Utils.moeda(p.lucro)}</span></div></div><div class="mobileProductCardActions"><button class="mobileProductMore" onclick="event.stopPropagation();ProdutosMobile.menu('${esc(p.id)}')" aria-label="Mais ações"><i data-lucide="ellipsis-vertical"></i></button><button class="mobileProductProduce" onclick="event.stopPropagation();ProdutosMobile.produzir('${esc(p.id)}')"><i data-lucide="circle-play"></i> Produzir</button></div></div>
            <footer class="mobileProductMetrics"><div><i data-lucide="box"></i><span><strong>${p.qtdEstoque} un.</strong><small>Estoque</small></span></div><div><i data-lucide="clock-3"></i><span><strong>${formatarTempo(p.tempoMin)}</strong><small>Impressão</small></span></div><div><i data-lucide="weight"></i><span><strong>${num(p.peso).toFixed(num(p.peso) % 1 ? 1 : 0)}g</strong><small>Filamento</small></span></div><div><i data-lucide="circle-dollar-sign"></i><span><strong>${Utils.moeda(p.custo)}</strong><small>Custo</small></span></div></footer>
            ${aberto ? ExpandedProduct(p) : ""}
        </article></div>`;
    }

    function MobileProductsHeader(total) {
        return `<header class="mobileProductsHeader"><div><h1>Produtos</h1><p><strong>${total}</strong> produto${total === 1 ? "" : "s"} cadastrado${total === 1 ? "" : "s"}</p></div><button onclick="ProdutosMobile.abrirFiltros()"><i data-lucide="list-filter"></i> Filtrar${filtrosAtivos() ? `<b>${filtrosAtivos()}</b>` : ""}</button></header>`;
    }

    function MobileProductsSearch() {
        return `<label class="mobileProductSearch"><i data-lucide="search"></i><input id="mobileProductSearch" value="${esc(estado.busca)}" placeholder="Buscar por nome, SKU ou coleção" autocomplete="off" oninput="ProdutosMobile.buscar(this.value)"><button class="${estado.busca ? "isVisible" : ""}" onclick="ProdutosMobile.buscar('');document.getElementById('mobileProductSearch')?.focus()" type="button" aria-label="Limpar busca"><i data-lucide="x"></i></button></label>`;
    }

    function ProductSorting(total) {
        return `<div class="mobileProductListHead"><span><strong>${total}</strong> produto${total === 1 ? "" : "s"}</span><button onclick="ProdutosMobile.abrirOrdenacao()"><i data-lucide="arrow-up-down"></i><span>Ordenar: ${rotuloOrdem()}</span><i data-lucide="chevron-down"></i></button></div>`;
    }

    function MobileProductsSkeleton() {
        return `<div class="mobileProductsSkeleton" aria-label="Carregando produtos">${Array.from({ length: 3 }, () => `<span></span>`).join("")}</div>`;
    }

    function ExpandedProduct(p) {
        const ultimaVenda = p.venda.ultima ? new Date(p.venda.ultima).toLocaleDateString("pt-BR") : "Sem vendas";
        return `<section class="mobileProductExpanded"><p>${esc(p.descricao || "Sem descrição comercial.")}</p><dl>
            <div><dt>Categoria</dt><dd>${esc(p.categoria || "—")}</dd></div><div><dt>Coleção</dt><dd>${esc(p.colecao?.nome || "Geral")}</dd></div>
            <div><dt>Material / cor</dt><dd>${esc([p.material, p.cor].filter(Boolean).join(" · ") || "—")}</dd></div><div><dt>Custo</dt><dd>${Utils.moeda(p.custo)}</dd></div>
            <div><dt>Preço / lucro</dt><dd>${Utils.moeda(p.preco)} · ${Utils.moeda(p.lucro)}</dd></div><div><dt>Margem</dt><dd>${p.margem.toFixed(0)}%</dd></div>
            <div><dt>Estoque mínimo</dt><dd>${p.minimo}</dd></div><div><dt>Em produção</dt><dd>${p.producao} un.</dd></div>
            <div><dt>Última venda</dt><dd>${ultimaVenda}</dd></div><div><dt>Vendido</dt><dd>${p.venda.quantidade} un.</dd></div></dl>
            <button onclick="event.stopPropagation();abrirDetalhesProduto('${esc(p.id)}')"><i data-lucide="external-link"></i> Ver perfil completo</button></section>`;
    }

    function EmptyState() {
        const buscando = estado.busca || estado.filtro !== "todos" || estado.colecaoId !== "todos" || filtrosAtivos();
        return `<div class="mobileProductsEmpty"><i data-lucide="${buscando ? "search-x" : "package-open"}"></i><strong>${buscando ? "Nenhum produto encontrado" : "Seu catálogo começa aqui"}</strong><p>${buscando ? "Tente limpar a busca ou ajustar os filtros." : "Cadastre o primeiro produto para vender e produzir."}</p><button onclick="${buscando ? "ProdutosMobile.limpar()" : "abrirModalProduto()"}">${buscando ? "Limpar filtros" : "Novo produto"}</button></div>`;
    }

    function renderMobile(restaurarScroll = true) {
        const lista = obterLista();
        const todos = contexto.produtos.map(p => normalizarProduto(p, contexto));
        const visiveis = lista.slice(0, estado.pagina * estado.porPagina);
        app.innerHTML = `<main class="mobileProductsPage">${MobileProductsHeader(contagens(todos).todos)}
            ${MobileProductsSearch()}${CollectionsCarousel()}${ProductFilterChips(todos)}${ProductSorting(lista.length)}
            <section id="listaProdutos" class="mobileProductsList">${visiveis.length ? visiveis.map(MobileProductCard).join("") : EmptyState()}</section>
            ${visiveis.length < lista.length ? `<button class="mobileProductsLoadMore" onclick="ProdutosMobile.mais()">Carregar mais <span>${lista.length - visiveis.length}</span></button>` : ""}
        </main>`;
        requestAnimationFrame(() => { if (restaurarScroll) window.scrollTo({ top: estado.scroll, behavior: "instant" }); ativarSwipes(); });
        lucide.createIcons();
    }

    function rotuloOrdem() {
        return ({ nome_az: "Nome A–Z", nome_za: "Nome Z–A", vendidos: "Mais vendidos", recentes: "Mais recentes", antigos: "Mais antigos", preco_maior: "Maior preço", preco_menor: "Menor preço", lucro_maior: "Maior lucro", margem_maior: "Maior margem", estoque_maior: "Maior estoque", estoque_menor: "Menor estoque", tempo_maior: "Maior tempo", peso_maior: "Maior peso", colecao: "Coleção" })[estado.ordem] || "Ordenar";
    }

    function filtrosAtivos() {
        return Object.entries(estado.avancado).filter(([ch, val]) => val !== "" && !(ch === "ativo" && val === "todos")).length;
    }

    function abrirSheet(titulo, conteudo, classe = "") {
        Modal.abrir(titulo, `<div class="mobileProductSheet ${classe}">${conteudo}</div>`);
        document.querySelector("#modalRoot .modalContainer")?.classList.add("mobileBottomSheet");
        lucide.createIcons();
    }

    function ativarSwipes() {
        document.querySelectorAll("[data-product-swipe]").forEach(wrapper => {
            const card = wrapper.querySelector(".mobileProductCard"); let inicio = 0, delta = 0, ativo = false;
            card.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; inicio = e.clientX; delta = 0; ativo = true; card.setPointerCapture?.(e.pointerId); });
            card.addEventListener("pointermove", e => { if (!ativo) return; delta = Math.max(-92, Math.min(92, e.clientX - inicio)); if (Math.abs(delta) > 6) { card.style.transform = `translateX(${delta}px)`; wrapper.classList.toggle("showProduce", delta > 0); wrapper.classList.toggle("showEdit", delta < 0); } });
            const finalizar = () => { if (!ativo) return; ativo = false; card.style.transform = ""; const id = wrapper.dataset.productSwipe; if (Math.abs(delta) >= 72) { navigator.vibrate?.(18); delta > 0 ? api.produzir(id) : api.editar(id); } wrapper.classList.remove("showProduce", "showEdit"); delta = 0; };
            card.addEventListener("pointerup", finalizar); card.addEventListener("pointercancel", finalizar);
        });
    }

    const api = {
        render: renderMobile,
        buscar(valor) { estado.busca = valor; estado.pagina = 1; clearTimeout(buscaTimer); buscaTimer = setTimeout(() => renderMobile(false), 220); },
        colecao(id) { estado.colecaoId = chave(id); estado.pagina = 1; estado.scroll = 0; renderMobile(false); },
        filtro(id) { estado.filtro = estado.filtro === id ? "todos" : id; estado.pagina = 1; renderMobile(false); },
        mais() { estado.pagina++; estado.scroll = window.scrollY; renderMobile(); },
        expandir(id) { estado.scroll = window.scrollY; estado.expandido = estado.expandido === chave(id) ? "" : chave(id); renderMobile(); },
        favorito(id) { const p = Storage.buscarProdutoPorId(id); if (!p) return Toast.show("Produto não encontrado.", "error"); p.favorito = !Boolean(p.favorito); p.atualizadoEm = new Date().toISOString(); Storage.salvarProduto(p); estado.scroll = window.scrollY; renderMobile(); },
        editar(id) { estado.scroll = window.scrollY; editarProduto(id); },
        produzir(id) { estado.scroll = window.scrollY; abrirProducaoEstoque(); requestAnimationFrame(() => { const select = document.getElementById("produtoEstoqueProducao"); if (select) { select.value = id; atualizarPreviaProducaoEstoque(); } }); },
        verProducao(id) { sessionStorage.setItem("primedocs:producao:produto", id); navegar("producao", { produtoId: id }); },
        limpar() { estado.colecaoId = "todos"; estado.filtro = "todos"; estado.busca = ""; estado.avancado = { categoria: "", material: "", cor: "", ativo: "todos", precoMin: "", precoMax: "" }; estado.pagina = 1; renderMobile(false); },
        menu(id) { const p = Storage.buscarProdutoPorId(id); if (!p) return; abrirSheet(p.nome, `<div class="compactActionMenu"><button onclick="Modal.fechar();abrirDetalhesProduto('${esc(id)}')"><i data-lucide="eye"></i><span><strong>Abrir</strong><small>Ver perfil completo</small></span></button><button onclick="Modal.fechar();ProdutosMobile.editar('${esc(id)}')"><i data-lucide="pencil"></i><span><strong>Editar</strong><small>Alterar cadastro e receita</small></span></button><button onclick="Modal.fechar();ProdutosMobile.produzir('${esc(id)}')"><i data-lucide="factory"></i><span><strong>Produzir</strong><small>Criar produção para estoque</small></span></button><button onclick="Modal.fechar();ProdutosMobile.duplicar('${esc(id)}')"><i data-lucide="copy"></i><span><strong>Duplicar</strong><small>Criar uma cópia editável</small></span></button><button onclick="Modal.fechar();ProdutosMobile.abrirMoverColecao('${esc(id)}')"><i data-lucide="folder-input"></i><span><strong>Mover coleção</strong><small>Organizar em outra coleção</small></span></button><button onclick="Modal.fechar();ProdutosMobile.favorito('${esc(id)}')"><i data-lucide="star"></i><span><strong>${p.favorito ? "Remover favorito" : "Favorito"}</strong><small>Atualizar destaque do catálogo</small></span></button><button onclick="Modal.fechar();ProdutosMobile.arquivar('${esc(id)}')"><i data-lucide="archive"></i><span><strong>${p.arquivado ? "Desarquivar" : "Arquivar"}</strong><small>${p.arquivado ? "Devolver ao catálogo" : "Ocultar sem excluir"}</small></span></button><button class="danger" onclick="Modal.fechar();pedirExclusaoProduto('${esc(id)}')"><i data-lucide="trash-2"></i><span><strong>Excluir</strong><small>Remover produto do catálogo</small></span></button></div>`); },
        duplicar(id) { const original = Storage.buscarProdutoPorId(id); if (!original) return Toast.show("Produto não encontrado.", "error"); const agora = new Date().toISOString(); const copia = { ...original, id: `prod-${Date.now()}`, nome: `${original.nome || "Produto"} (cópia)`, codigo: original.codigo ? `${original.codigo}-COPIA` : "", favorito: false, arquivado: false, ativo: true, criadoEm: agora, atualizadoEm: agora }; Storage.salvarProduto(copia); estado.scroll = window.scrollY; renderMobile(); Toast.show("Produto duplicado com sucesso.", "success"); },
        abrirMoverColecao(id) { const p = Storage.buscarProdutoPorId(id); if (!p) return; abrirSheet("Mover coleção", `<div class="mobileMoveCollection"><p>Escolha a nova coleção de <strong>${esc(p.nome)}</strong>.</p>${contexto.colecoes.map(c => `<button class="${chave(p.colecaoId) === chave(c.id) ? "isActive" : ""}" onclick="ProdutosMobile.moverColecao('${esc(id)}','${esc(c.id)}')"><span style="--collection:${esc(c.cor || "#6D4AFF")}"><i data-lucide="${esc(c.icone || "boxes")}"></i></span><strong>${esc(c.nome)}</strong>${chave(p.colecaoId) === chave(c.id) ? '<i data-lucide="check"></i>' : '<i data-lucide="chevron-right"></i>'}</button>`).join("")}</div>`); },
        moverColecao(id, colecaoId) { const p = Storage.buscarProdutoPorId(id), colecao = Storage.buscarColecaoProdutoPorId?.(colecaoId) || contexto.colecoesPorId.get(chave(colecaoId)); if (!p || !colecao) return Toast.show("Não foi possível mover o produto.", "error"); p.colecaoId = colecaoId; p.atualizadoEm = new Date().toISOString(); Storage.salvarProduto(p); Modal.fechar(); renderMobile(false); Toast.show(`Produto movido para ${colecao.nome}.`, "success"); },
        arquivar(id) { const p = Storage.buscarProdutoPorId(id); if (!p) return; p.arquivado = !Boolean(p.arquivado); p.atualizadoEm = new Date().toISOString(); Storage.salvarProduto(p); renderMobile(false); Toast.show(p.arquivado ? "Produto arquivado." : "Produto desarquivado.", "success"); },
        abrirColecoes() { abrirSheet("Coleções", `<label class="mobileSheetSearch"><i data-lucide="search"></i><input placeholder="Buscar coleção" oninput="ProdutosMobile.filtrarColecoes(this.value)"></label><div id="mobileAllCollections" class="mobileAllCollections">${contexto.colecoes.map(c => `<button data-collection-name="${esc(normalizarTexto(c.nome))}" onclick="Modal.fechar();ProdutosMobile.colecao('${esc(c.id)}')"><span style="--collection:${esc(c.cor || "#6D4AFF")}"><i data-lucide="${esc(c.icone || "boxes")}"></i></span><strong>${esc(c.nome)}</strong><i data-lucide="chevron-right"></i></button>`).join("")}</div><button class="btn mobileSheetPrimary" onclick="Modal.fechar();abrirModalColecaoProduto()"><i data-lucide="folder-plus"></i> Nova coleção</button>`); },
        filtrarColecoes(valor) { const termo = normalizarTexto(valor); document.querySelectorAll("#mobileAllCollections [data-collection-name]").forEach(el => el.hidden = !el.dataset.collectionName.includes(termo)); },
        abrirOrdenacao() { const opcoes = [["nome_az", "Nome A–Z"], ["nome_za", "Nome Z–A"], ["vendidos", "Mais vendidos"], ["recentes", "Mais recentes"], ["antigos", "Mais antigos"], ["preco_maior", "Maior preço"], ["preco_menor", "Menor preço"], ["lucro_maior", "Maior lucro"], ["margem_maior", "Maior margem"], ["estoque_maior", "Maior estoque"], ["estoque_menor", "Menor estoque"], ["tempo_maior", "Maior tempo"], ["peso_maior", "Maior peso"], ["colecao", "Coleção"]]; abrirSheet("Ordenar produtos", `<div class="mobileSortOptions">${opcoes.map(([id, label]) => `<button class="${estado.ordem === id ? "isActive" : ""}" onclick="ProdutosMobile.ordenar('${id}')"><span>${label}</span>${estado.ordem === id ? '<i data-lucide="check"></i>' : ""}</button>`).join("")}</div>`); },
        ordenar(id) { estado.ordem = id; estado.pagina = 1; Modal.fechar(); renderMobile(false); },
        abrirFiltros() { const categorias = [...new Set(contexto.produtos.map(p => p.categoria).filter(Boolean))].sort(); const materiais = [...new Set(contexto.produtos.flatMap(p => materiaisProduto(p).map(m => m.material || m.tipo || m.nome)).filter(Boolean))].sort(); abrirSheet("Filtros", `<div class="mobileAdvancedFilters"><label><span>Categoria</span><select id="mpfCategoria"><option value="">Todas</option>${categorias.map(v => `<option ${estado.avancado.categoria === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label><label><span>Material</span><select id="mpfMaterial"><option value="">Todos</option>${materiais.map(v => `<option ${estado.avancado.material === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label><label><span>Cor</span><input id="mpfCor" value="${esc(estado.avancado.cor)}" placeholder="Ex: Branco"></label><label><span>Situação</span><select id="mpfAtivo"><option value="todos">Todos</option><option value="ativo" ${estado.avancado.ativo === "ativo" ? "selected" : ""}>Ativos</option><option value="inativo" ${estado.avancado.ativo === "inativo" ? "selected" : ""}>Inativos</option></select></label><div class="mobileFilterRange"><label><span>Preço mínimo</span><input id="mpfMin" type="number" inputmode="decimal" value="${esc(estado.avancado.precoMin)}"></label><label><span>Preço máximo</span><input id="mpfMax" type="number" inputmode="decimal" value="${esc(estado.avancado.precoMax)}"></label></div><div class="mobileSheetActions"><button onclick="ProdutosMobile.resetFiltros()">Limpar</button><button class="primary" onclick="ProdutosMobile.aplicarFiltros()">Aplicar filtros</button></div></div>`); },
        aplicarFiltros() { estado.avancado = { categoria: document.getElementById("mpfCategoria")?.value || "", material: document.getElementById("mpfMaterial")?.value || "", cor: document.getElementById("mpfCor")?.value || "", ativo: document.getElementById("mpfAtivo")?.value || "todos", precoMin: document.getElementById("mpfMin")?.value || "", precoMax: document.getElementById("mpfMax")?.value || "" }; estado.pagina = 1; Modal.fechar(); renderMobile(false); },
        resetFiltros() { estado.avancado = { categoria: "", material: "", cor: "", ativo: "todos", precoMin: "", precoMax: "" }; Modal.fechar(); renderMobile(false); }
    };

    window.ProdutosMobile = api;
    window.renderProdutos = function () { if (!media.matches) return renderDesktop(); return renderMobile(); };
    window.renderTelaProdutos = function () { if (!media.matches) return renderTelaDesktop(); return renderMobile(); };
    window.listarProdutos = function () { if (!media.matches) return listarDesktop(); estado.scroll = window.scrollY; return renderMobile(); };
    media.addEventListener?.("change", () => { if ((window.rotaAtual || window.paginaAtual) === "produtos") window.renderProdutos(); });
})();
