const app = document.getElementById("content");

function navegar(pagina, opcoes = {}){

    const rotaSolicitada = String(pagina || "home").toLowerCase();
    const aliasesEstoque = { produtos: "produtos", products: "produtos", filamentos: "filamentos", filaments: "filamentos", inventory: "" };
    if (Object.prototype.hasOwnProperty.call(aliasesEstoque, rotaSolicitada)) {
        opcoes = { ...opcoes, section: aliasesEstoque[rotaSolicitada] || opcoes.section };
        pagina = "estoque";
    }
    window.InventoryPage?.leave?.(pagina);

    if (pagina !== "producao" && typeof producaoTimer !== "undefined") clearInterval(producaoTimer);

    fecharDrawerPrimeDocs();
    document.getElementById("content")?.classList.remove("pageEntering");
    window.__primeDocsNavigationOptions = opcoes || {};

    switch(pagina){

        case "home":
            renderHome();
            break;

        case "dashboard":
            renderDashboardExecutivo();
            break;

        case "consignado":
            renderConsignado(opcoes?.modo || window.modoConsignadoInicial || "hub");
            window.modoConsignadoInicial = "";
            break;

        case "estoque":
            InventoryPage.render(opcoes?.section, { restaurarScroll: opcoes?.preservarScroll !== false, history: opcoes?.history || "replace" });
            break;

        case "lojas":
            renderLojas();
            break;

        case "conferencia":
            renderConsignado("conferencia");
            pagina = "consignado";
            break;

        case "configuracoes":
            renderConfiguracoes();
            break;

        case "orcamento":
            renderOrcamento();
            break;

        case "custos":
            renderCustos();
            break;

        case "pedidos":
            renderPedidos();
            break;

        case "producao":
            renderProducao();
            break;

        case "impressoras":
            renderImpressoras();
            break;

        case "financeiro":
            renderFinanceiro();
            break;

        case "clientes":
            renderClientes();
            break;

        case "relatorios":
            pagina = "dashboard";
            renderDashboardExecutivo();
            setTimeout(abrirFiltrosDashboardExecutivo, 0);
            break;

        default:
            renderHome();

    }

    window.rotaAtual = pagina;
    window.paginaAtual = pagina;
    atualizarNavegacaoAtivaPrimeDocs(pagina);
    atualizarCabecalhoPrimeDocs();
    requestAnimationFrame(() => document.getElementById("content")?.classList.add("pageEntering"));
    if (!opcoes?.preservarScroll && pagina !== "estoque") window.scrollTo({ top: 0, behavior: "auto" });

    if(window.lucide){
        lucide.createIcons();
    }

}
