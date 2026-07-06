const app = document.getElementById("content");

function navegar(pagina){

    fecharDrawerPrimeDocs();

    switch(pagina){

        case "home":
            renderHome();
            break;

        case "consignado":
            renderConsignado();
            break;

        case "produtos":
            renderProdutos();
            break;

        case "lojas":
            renderLojas();
            break;

        case "conferencia":
            renderConferencia();
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

        case "financeiro":
            renderFinanceiro();
            break;

        case "clientes":
            renderClientes();
            break;

        case "relatorios":
            renderRelatorios();
            break;

        default:
            renderHome();

    }

    atualizarNavegacaoAtivaPrimeDocs(pagina);
    atualizarCabecalhoPrimeDocs();

    if(window.lucide){
        lucide.createIcons();
    }

}
