const app = document.getElementById("content");

function navegar(pagina, opcoes = {}){

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

        case "produtos":
            renderProdutos();
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

        case "filamentos":
            renderFilamentos();
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

    atualizarNavegacaoAtivaPrimeDocs(pagina);
    atualizarCabecalhoPrimeDocs();
    requestAnimationFrame(() => document.getElementById("content")?.classList.add("pageEntering"));
    if (!opcoes?.preservarScroll) window.scrollTo({ top: 0, behavior: "auto" });

    if(window.lucide){
        lucide.createIcons();
    }

}
