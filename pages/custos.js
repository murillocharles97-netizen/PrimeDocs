let ultimoCalculoCustos = null;

function renderCustos() {
    const config = Storage.carregarConfigCustos();
    const filamentos = Storage.listarFilamentos().filter(f => f.ativo !== false);
    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("🧮 Calculadora de Custos", "Transforme tempo, material e despesas em um preço sustentável.")}
        <div class="costCalculatorLayout">
            <section class="budgetCard costInputCard">
                <div class="budgetFormTitle"><div><span>PROJETO</span><h3>Dados da impressão</h3></div><i data-lucide="printer"></i></div>
                <div class="erpFormGrid">
                    ${Input.text("Nome do projeto *","custoProjeto","Ex.: Luminária personalizada")}
                    <label class="inputGroup"><span>Filamento</span><select id="custoFilamento" onchange="calcularCustosTela()"><option value="">Preço padrão (${Utils.moeda(config.precoKgFilamentoPadrao)}/kg)</option>${filamentos.map(f=>`<option value="${f.id}">${escaparCusto(f.material)} ${escaparCusto(f.cor)} — ${Utils.moeda(f.precoKg)}/kg</option>`).join("")}</select></label>
                    ${campoNumeroCusto("Peso por peça (g)","custoPeso",0,"1")}${campoNumeroCusto("Quantidade de peças","custoQuantidade",1,"1")}
                    ${campoNumeroCusto("Horas de impressão","custoHoras",0,"1")}${campoNumeroCusto("Minutos","custoMinutos",0,"1")}
                    ${campoNumeroCusto("Embalagem","custoEmbalagem",config.custoEmbalagemPadrao,"0.01")}${campoNumeroCusto("Custo extra","custoExtra",0,"0.01")}
                    ${campoNumeroCusto("Mão de obra fixa","custoMaoObra",0,"0.01")}${campoNumeroCusto("Margem de lucro (%)","custoMargem",config.margemLucroPadrao,"1")}
                    ${campoNumeroCusto("Desconto (%)","custoDesconto",0,"1")}
                    <label class="companyCheckbox"><input id="custoCobrarHora" type="checkbox" ${config.cobrarMaoDeObraPorPadrao?"checked":""} onchange="calcularCustosTela()"> Calcular mão de obra por hora</label>
                </div>
            </section>
            <section class="budgetCard costResultCard">
                <div class="budgetFormTitle"><div><span>RESULTADO</span><h3>Composição do preço</h3></div><i data-lucide="badge-dollar-sign"></i></div>
                <div id="resultadoCustos" class="costResultList"></div>
                <div class="costActions"><button class="btn" onclick="salvarCalculoComoProduto()"><i data-lucide="package-plus"></i> Salvar como produto</button><button class="btnSecondary" onclick="gerarOrcamentoDoCalculo()"><i data-lucide="file-text"></i> Gerar orçamento</button><button class="btnSecondary" onclick="copiarResumoCustos()"><i data-lucide="copy"></i> Copiar resumo</button><button class="costClear" onclick="renderCustos()"><i data-lucide="rotate-ccw"></i> Limpar</button></div>
            </section>
        </div>`;
    document.querySelectorAll(".costInputCard input").forEach(input=>input.addEventListener("input",calcularCustosTela));
    calcularCustosTela(); lucide.createIcons();
}

function campoNumeroCusto(label,id,valor,step){return `<label class="inputGroup"><span>${label}</span><input id="${id}" type="number" min="0" step="${step}" value="${valor}"></label>`;}
function numeroCusto(id){return Math.max(0,Number(document.getElementById(id)?.value)||0);}

function calcularCustosTela() {
    const filamento=Storage.buscarFilamentoPorId(document.getElementById("custoFilamento")?.value);
    ultimoCalculoCustos=CalculadoraCustos.calcular({pesoGramas:numeroCusto("custoPeso"),quantidade:numeroCusto("custoQuantidade"),horas:numeroCusto("custoHoras"),minutos:numeroCusto("custoMinutos"),embalagem:numeroCusto("custoEmbalagem"),custoExtra:numeroCusto("custoExtra"),maoDeObra:numeroCusto("custoMaoObra"),margem:numeroCusto("custoMargem"),desconto:numeroCusto("custoDesconto"),cobrarMaoDeObra:Boolean(document.getElementById("custoCobrarHora")?.checked),precoKg:filamento?.precoKg});
    const r=ultimoCalculoCustos;
    const linhas=[["Material",r.material],["Energia",r.energia],["Depreciação",r.depreciacao],["Mão de obra",r.maoDeObra],["Embalagem",r.embalagem],["Extras",r.extras],["Impostos",r.imposto],["Custo total",r.custoTotal],["Preço sugerido",r.precoSugerido],["Lucro estimado",r.lucroEstimado],["Lucro por hora",r.lucroPorHora]];
    const el=document.getElementById("resultadoCustos");if(!el)return;
    el.innerHTML=linhas.map(([l,v],i)=>`<div class="${i===8?"isHighlight":""}"><span>${l}</span><strong>${Utils.moeda(v)}</strong></div>`).join("")+`<small>${r.pesoTotal.toLocaleString("pt-BR")} g · ${r.horasTotais.toLocaleString("pt-BR",{maximumFractionDigits:2})} h</small>`;
}

function validarNomeCalculo(){const nome=document.getElementById("custoProjeto")?.value.trim();if(!nome){Toast.show("Informe o nome do projeto.");return null;}if(!ultimoCalculoCustos?.precoSugerido){Toast.show("Preencha peso, tempo e custos.");return null;}return nome;}
function salvarCalculoComoProduto(){const nome=validarNomeCalculo();if(!nome)return;const agora=new Date().toISOString();Storage.salvarProduto({id:`prod-${Date.now()}`,codigo:Utils.gerarCodigo("Outro"),nome,categoria:"Outro",preco:Number(ultimoCalculoCustos.precoSugerido.toFixed(2)),custo:Number(ultimoCalculoCustos.custoTotal.toFixed(2)),peso:numeroCusto("custoPeso"),tempo:ultimoCalculoCustos.horasTotais,cor:"",favorito:false,ativo:true,criadoEm:agora});Toast.show("Produto criado a partir do cálculo!");}
function gerarOrcamentoDoCalculo(){const nome=validarNomeCalculo();if(!nome)return;itensOrcamento=[{tipo:"personalizado",produtoId:null,codigo:"",nome,categoria:"Personalizado",quantidade:Math.max(1,numeroCusto("custoQuantidade")),valorUnitario:ultimoCalculoCustos.precoSugerido/Math.max(1,numeroCusto("custoQuantidade")),valorTotal:ultimoCalculoCustos.precoSugerido,observacao:`Projeto calculado: ${ultimoCalculoCustos.pesoTotal} g`}];empresaOrcamentoId=Storage.buscarEmpresaPadrao()?.id||"fallback";navegar("orcamento");Toast.show("Cálculo enviado para o orçamento.");}
async function copiarResumoCustos(){const nome=document.getElementById("custoProjeto")?.value.trim()||"Projeto 3D";const texto=`${nome}\nCusto total: ${Utils.moeda(ultimoCalculoCustos?.custoTotal)}\nPreço sugerido: ${Utils.moeda(ultimoCalculoCustos?.precoSugerido)}\nLucro estimado: ${Utils.moeda(ultimoCalculoCustos?.lucroEstimado)}`;try{await navigator.clipboard.writeText(texto);Toast.show("Resumo copiado!");}catch(e){Toast.show("Não foi possível copiar o resumo.");}}
function escaparCusto(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}
