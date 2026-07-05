let produtoEditando = null;

function renderProdutos() {

    app.innerHTML = `

    <button class="back" onclick="navegar('home')">
        <i data-lucide="arrow-left"></i>
        Voltar
    </button>

    ${Page.titulo(
        "📦 Produtos",
        "Cadastre os produtos da PrimeLine3D"
    )}

    <div class="cardForm">

        <input
            id="pesquisaProduto"
            placeholder="🔍 Pesquisar produto..."
            oninput="listarProdutos()">

    </div>

    <div id="listaProdutos"></div>

    <button
        class="fab"
        onclick="abrirModalProduto()">

        +

    </button>

    `;

    listarProdutos();

    lucide.createIcons();

}

function listarProdutos(){

    const lista=document.getElementById("listaProdutos");

    const pesquisa=document
        .getElementById("pesquisaProduto")
        .value
        .toLowerCase();

    let produtos=Storage.listarProdutos();

    if(pesquisa){

        produtos=produtos.filter(prod=>

            prod.nome.toLowerCase().includes(pesquisa)

        );

    }

    if(produtos.length===0){

        lista.innerHTML=`

        <div class="cardForm textCenter">

            <h3>Nenhum produto cadastrado</h3>

            <p>

            Clique no botão + para adicionar.

            </p>

        </div>

        `;

        return;

    }

    lista.innerHTML=produtos.map(prod=>criarCardProduto(prod)).join("");

    lucide.createIcons();

}

function criarCardProduto(prod){

return`

<div class="produtoCard">

<div class="produtoHeader">

<div>

<h3>${prod.nome}</h3>

<span>${prod.categoria}</span>

</div>

<div class="chips">

${prod.favorito?

`<div class="badge primary">

⭐ Favorito

</div>`

:""}

</div>

</div>

<div class="row">

<div class="col">

<strong>

Venda

</strong>

<br>

${Utils.moeda(prod.preco)}

</div>

<div class="col">

<strong>

Custo

</strong>

<br>

${Utils.moeda(prod.custo)}

</div>

</div>

<div class="space"></div>

<div class="row">

<button

class="btn"

onclick="editarProduto(${prod.id})">

Editar

</button>

<button

class="removeBtn"

onclick="excluirProduto(${prod.id})">

<i data-lucide="trash-2"></i>

</button>

</div>

</div>

`;

}
function excluirProduto(id){

    if(!confirm("Excluir produto?")){

        return;

    }

    Storage.excluirProduto(id);

    listarProdutos();

}
function editarProduto(id){

    produtoEditando=Storage.buscarProdutoPorId(id);

    Modal.abrir(

        "Editar Produto",

        montarFormularioProduto(produtoEditando)

    );

}

function montarFormularioProduto(prod={}){

return`

${Input.text(
    "Nome",
    "nomeProduto",
    "Ex: Taça da Copa",
    prod.nome || ""
)}

${Input.select(
    "Categoria",
    "categoria",
    CATEGORIAS,
    prod.categoria || ""
)}

${Input.number(
    "Preço",
    "preco",
    prod.preco || ""
)}

${Input.number(
    "Custo",
    "custo",
    prod.custo || ""
)}

${Input.number(
    "Peso (g)",
    "peso",
    prod.peso || ""
)}

${Input.text(
    "Tempo",
    "tempo",
    "3h25",
    prod.tempo || ""
)}

${Input.text(
    "Cor",
    "cor",
    "Branco",
    prod.cor || ""
)}

<label>

<input
id="favorito"
type="checkbox"
${prod.favorito?"checked":""}>

Favorito

</label>

<div class="space"></div>

${Button.primary(

    prod.id ? "Salvar Alterações" : "Salvar Produto",

    "salvarProduto()"

)}

`;

}

function abrirModalProduto(){

    produtoEditando=null;

    Modal.abrir(

        "Novo Produto",

        montarFormularioProduto()

    );

}

function salvarProduto(){

    const nome=document.getElementById("nomeProduto").value.trim();

    const categoria=document.getElementById("categoria").value;

    const preco=document.getElementById("preco").value;

    const custo=document.getElementById("custo").value;

    if(nome==""){

        Toast.show("Informe o nome do produto.");

        return;

    }

    if(preco==""){

        Toast.show("Informe o preço.");

        return;

    }

    if(custo==""){

        Toast.show("Informe o custo.");

        return;

    }

    const produto={

        id:produtoEditando?.id || Utils.gerarId(),

        codigo:produtoEditando?.codigo || Utils.gerarCodigo(categoria),

        nome,

        categoria,

        preco:Number(preco),

        custo:Number(custo),

        peso:Number(document.getElementById("peso").value)||0,

        tempo:document.getElementById("tempo").value,

        cor:document.getElementById("cor").value,

        favorito:document.getElementById("favorito").checked,

        ativo:true,

        criadoEm:produtoEditando?.criadoEm || Utils.hoje()

    };

    Storage.salvarProduto(produto);

    produtoEditando=null;

    Modal.fechar();

    listarProdutos();

    Toast.show("Produto salvo com sucesso!");
}