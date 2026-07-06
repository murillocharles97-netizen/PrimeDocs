let periodoRelatorio = "mes";

function renderRelatorios() {
    const clientes = Storage.listarClientes().filter(c=>c.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
    const lojas = Storage.listarLojas().filter(l=>l.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
    const produtos = Storage.listarProdutos().filter(p=>p.ativo!==false).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt-BR"));
    const categorias = [...new Set(produtos.map(p=>p.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    app.innerHTML = `<button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("📊 Relatórios", "Inteligência comercial, financeira e operacional do PrimeDocs.")}
        <section class="reportFilterCard">
            <div class="reportPeriodTabs">${[["hoje","Hoje"],["semana","Semana"],["mes","Mês"],["ano","Ano"],["personalizado","Período"]].map(([v,l])=>`<button class="${periodoRelatorio===v?"active":""}" onclick="selecionarPeriodoRelatorio('${v}')">${l}</button>`).join("")}</div>
            <div id="periodoPersonalizado" class="reportCustomDates" ${periodoRelatorio==="personalizado"?"":"hidden"}><label>De<input id="relatorioDataInicio" type="date" onchange="atualizarRelatorios()"></label><label>Até<input id="relatorioDataFim" type="date" onchange="atualizarRelatorios()"></label></div>
            <div class="reportSelectFilters"><select id="relatorioCliente" onchange="atualizarRelatorios()"><option value="">Todos os clientes</option>${clientes.map(c=>`<option value="${escaparRelatorio(c.id)}">${escaparRelatorio(c.nome)}</option>`).join("")}</select><select id="relatorioLoja" onchange="atualizarRelatorios()"><option value="">Todas as lojas</option>${lojas.map(l=>`<option value="${escaparRelatorio(l.id)}">${escaparRelatorio(l.nome)}</option>`).join("")}</select><select id="relatorioProduto" onchange="atualizarRelatorios()"><option value="">Todos os produtos</option>${produtos.map(p=>`<option value="${escaparRelatorio(p.id)}">${escaparRelatorio(p.nome)}</option>`).join("")}</select><select id="relatorioCategoria" onchange="atualizarRelatorios()"><option value="">Todas as categorias</option>${categorias.map(c=>`<option value="${escaparRelatorio(c)}">${escaparRelatorio(c)}</option>`).join("")}</select></div>
            <div class="reportExportActions"><button class="btn" onclick="exportarRelatorioPDF()"><i data-lucide="file-down"></i> PDF</button><button class="btnSecondary" onclick="exportarRelatorioCSV()"><i data-lucide="sheet"></i> Excel (CSV)</button><button class="btnSecondary" onclick="imprimirRelatorio()"><i data-lucide="printer"></i> Imprimir</button></div>
        </section><div id="conteudoRelatorios"></div>`;
    atualizarRelatorios();
}

function selecionarPeriodoRelatorio(periodo){periodoRelatorio=periodo;renderRelatorios();}

function obterDadosRelatorio() {
    const intervalo = intervaloRelatorio();
    const clienteId = document.getElementById("relatorioCliente")?.value||"";
    const lojaId = document.getElementById("relatorioLoja")?.value||"";
    const produtoId = document.getElementById("relatorioProduto")?.value||"";
    const categoria = document.getElementById("relatorioCategoria")?.value||"";
    const noPeriodo = item => {const t=timestampRelatorio(item.atualizadoEm||item.criadoEm||item.data||item.dataPedido);return t>=intervalo.inicio&&t<=intervalo.fim;};
    const temItem = item => (!produtoId||String(item.produtoId)===String(produtoId))&&(!categoria||item.categoria===categoria);
    const pedidos = Storage.listarPedidos().filter(p=>p.ativo!==false&&noPeriodo(p)&&(!clienteId||String(p.clienteId)===String(clienteId))&&(!produtoId&&!categoria||(p.itens||[]).some(temItem)));
    const orcamentos = Storage.listarOrcamentos().filter(o=>o.ativo!==false&&noPeriodo(o)&&(!clienteId||String(o.clienteId)===String(clienteId))&&(!produtoId&&!categoria||(o.itens||[]).some(temItem)));
    const consignados = Storage.listarConsignados().filter(c=>noPeriodo(c)&&(!lojaId||String(c.lojaId)===String(lojaId))&&(!produtoId&&!categoria||(c.itens||[]).some(temItem)));
    const conferencias = Storage.listarConferencias().filter(c=>noPeriodo(c)&&(!lojaId||String(c.lojaId)===String(lojaId))&&(!produtoId&&!categoria||(c.itens||[]).some(i=>temItem({...i,quantidade:i.quantidadeVendida}))));
    const pagamentos = Storage.listarPagamentos().filter(p=>noPeriodo(p)&&(!clienteId||String(p.clienteId)===String(clienteId))&&(!lojaId||String(p.lojaId)===String(lojaId)));
    const itensVendidos = pedidos.filter(p=>p.statusPedido==="entregue").flatMap(p=>(p.itens||[]).filter(temItem).map(i=>({...i,clienteId:p.clienteId,clienteNome:p.clienteNome,origem:"pedido"}))).concat(conferencias.flatMap(c=>(c.itens||[]).filter(i=>!produtoId&&!categoria||temItem(i)).map(i=>({...i,quantidade:i.quantidadeVendida||0,valorUnitario:i.preco||0,valorTotal:i.valorVendido||Number(i.quantidadeVendida||0)*Number(i.preco||0),lojaId:c.lojaId,lojaNome:c.lojaNome,origem:"loja"}))));
    return {intervalo,pedidos,orcamentos,consignados,conferencias,pagamentos,itensVendidos};
}

function atualizarRelatorios(){
    const el=document.getElementById("conteudoRelatorios");if(!el)return;
    const d=obterDadosRelatorio();const entregues=d.pedidos.filter(p=>p.statusPedido==="entregue");const cancelados=d.pedidos.filter(p=>p.statusPedido==="cancelado");
    const faturamentoPedidos=entregues.reduce((t,p)=>t+Number(p.valorTotal||0),0);const faturamentoLojas=d.conferencias.reduce((t,c)=>t+Number(c.valorTotalVendido||0),0);const faturamento=faturamentoPedidos+faturamentoLojas;
    const custo=d.itensVendidos.reduce((t,i)=>{const produto=Storage.buscarProdutoPorId(i.produtoId);return t+Number(i.quantidade||0)*Number(produto?.custo||0);},0);const lucro=faturamento-custo;
    const qtdVendida=d.itensVendidos.reduce((t,i)=>t+Number(i.quantidade||0),0);const pendente=d.pedidos.reduce((t,p)=>t+Number(p.valorPendente||0),0);
    const metricas=[["circle-dollar-sign",Utils.moeda(faturamento),"Faturamento"],["trending-up",Utils.moeda(lucro),"Lucro estimado"],["package-check",qtdVendida,"Quantidade vendida"],["boxes",new Set(d.itensVendidos.map(i=>String(i.produtoId||i.nome))).size,"Produtos vendidos"],["clipboard-plus",d.pedidos.length,"Pedidos criados"],["badge-check",entregues.length,"Pedidos entregues"],["ban",cancelados.length,"Cancelados"],["file-text",d.orcamentos.length,"Orçamentos enviados"],["thumbs-up",d.orcamentos.filter(o=>o.status==="aprovado").length,"Orçamentos aprovados"],["store",d.consignados.length,"Consignados"],["chart-no-axes-combined",d.conferencias.length,"Conferências"],["hand-coins",Utils.moeda(d.pagamentos.reduce((t,p)=>t+Number(p.valor||0),0)),"Recebimentos"],["wallet-cards",Utils.moeda(pendente),"Pagamentos pendentes"]];
    const topProdutos=agruparRanking(d.itensVendidos,i=>i.produtoId||i.nome,i=>i.nome,i=>Number(i.quantidade||0));
    const topClientes=agruparRanking(entregues,p=>p.clienteId||p.clienteNome,p=>p.clienteNome,p=>Number(p.valorTotal||0));
    const topLojas=agruparRanking(d.conferencias,c=>c.lojaId||c.lojaNome,c=>c.lojaNome,c=>Number(c.valorTotalVendido||0));
    const categorias=agruparRanking(d.itensVendidos,i=>i.categoria||"Sem categoria",i=>i.categoria||"Sem categoria",i=>Number(i.quantidade||0));
    const status=Object.entries(STATUS_PEDIDOS).map(([chave,nome])=>({nome,valor:d.pedidos.filter(p=>p.statusPedido===chave).length})).filter(i=>i.valor);
    const recebimentos=[{nome:"Clientes",valor:faturamentoPedidos},{nome:"Consignado",valor:faturamentoLojas}];
    el.innerHTML=`<section class="reportMetricsGrid">${metricas.map(m=>`<article><i data-lucide="${m[0]}"></i><strong>${m[1]}</strong><span>${m[2]}</span></article>`).join("")}</section>
        <section class="reportChartsGrid">${graficoRelatorio("Recebimentos","Clientes x Consignado",recebimentos,true)}${graficoRelatorio("Pedidos por status","Visão operacional",status)}${graficoRelatorio("Produtos mais vendidos","Top produtos",topProdutos.slice(0,8))}</section>
        <section class="reportRankingsGrid">${rankingRelatorio("Top 10 Clientes",topClientes,true)}${rankingRelatorio("Top 10 Produtos",topProdutos)}${rankingRelatorio("Top 10 Lojas",topLojas,true)}${rankingRelatorio("Top Categorias",categorias)}</section>`;
    lucide.createIcons();
}

function intervaloRelatorio(){const agora=new Date(),fim=new Date(agora);fim.setHours(23,59,59,999);let inicio=new Date(agora);inicio.setHours(0,0,0,0);if(periodoRelatorio==="semana")inicio.setDate(inicio.getDate()-6);if(periodoRelatorio==="mes")inicio=new Date(agora.getFullYear(),agora.getMonth(),1);if(periodoRelatorio==="ano")inicio=new Date(agora.getFullYear(),0,1);if(periodoRelatorio==="personalizado"){const a=document.getElementById("relatorioDataInicio")?.value,b=document.getElementById("relatorioDataFim")?.value;if(a)inicio=new Date(`${a}T00:00:00`);if(b){fim.setTime(new Date(`${b}T23:59:59`).getTime());}}return{inicio:inicio.getTime(),fim:fim.getTime()};}
function agruparRanking(lista,chave,nome,valor){const m=new Map();lista.forEach(i=>{const k=String(chave(i)||"-");const a=m.get(k)||{nome:nome(i)||"Sem identificação",valor:0};a.valor+=Number(valor(i)||0);m.set(k,a);});return[...m.values()].sort((a,b)=>b.valor-a.valor).slice(0,10);}
function graficoRelatorio(titulo,subtitulo,itens,moeda=false){const max=Math.max(1,...itens.map(i=>Number(i.valor||0)));return`<article class="reportChart"><div class="sectionTitle"><div><span>${subtitulo}</span><h2>${titulo}</h2></div></div><div class="reportBars">${itens.length?itens.map(i=>`<div><span>${escaparRelatorio(i.nome)}</span><div><i style="width:${Math.max(3,Number(i.valor||0)/max*100)}%"></i></div><strong>${moeda?Utils.moeda(i.valor):Number(i.valor||0).toLocaleString("pt-BR")}</strong></div>`).join(""):`<div class="erpEmpty compact">Sem dados no período.</div>`}</div></article>`;}
function rankingRelatorio(titulo,itens,moeda=false){return`<article class="reportRanking"><h3>${titulo}</h3>${itens.length?itens.map((i,n)=>`<div><b>${n+1}</b><span>${escaparRelatorio(i.nome)}</span><strong>${moeda?Utils.moeda(i.valor):Number(i.valor||0).toLocaleString("pt-BR")}</strong></div>`).join(""):`<p>Sem dados no período.</p>`}</article>`;}
function exportarRelatorioCSV(){const d=obterDadosRelatorio(),linhas=[["Tipo","Data","Cliente/Loja","Descrição","Valor"]];d.pedidos.forEach(p=>linhas.push(["Pedido",p.dataPedido,p.clienteNome,STATUS_PEDIDOS[p.statusPedido]||p.statusPedido,p.valorTotal]));d.conferencias.forEach(c=>linhas.push(["Conferência",c.data||c.criadoEm,c.lojaNome,`${c.totalPecasVendidas||0} peças`,c.valorTotalVendido||0]));d.orcamentos.forEach(o=>linhas.push(["Orçamento",o.data,o.clienteNome||o.cliente,o.status||"enviado",o.valorFinal||0]));const csv="\uFEFF"+linhas.map(l=>l.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(";")).join("\n");baixarArquivoRelatorio(csv,`relatorio_primedocs_${Utils.hoje()}.csv`,"text/csv;charset=utf-8");Toast.show("Relatório CSV exportado!");}
function exportarRelatorioPDF(){const d=obterDadosRelatorio();const {jsPDF}=window.jspdf||{};if(!jsPDF)return Toast.show("Gerador de PDF indisponível.");const doc=new jsPDF({unit:"mm",format:"a4"});const faturamento=d.pedidos.filter(p=>p.statusPedido==="entregue").reduce((t,p)=>t+Number(p.valorTotal||0),0)+d.conferencias.reduce((t,c)=>t+Number(c.valorTotalVendido||0),0);doc.setFillColor(109,93,253);doc.rect(0,0,210,34,"F");doc.setTextColor(255);doc.setFontSize(20);doc.text("PrimeDocs",16,15);doc.setFontSize(12);doc.text("RELATÓRIO GERENCIAL",16,24);doc.setTextColor(17,24,39);doc.setFontSize(11);doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`,16,45);doc.setFontSize(16);doc.text(`Faturamento: ${Utils.moeda(faturamento)}`,16,59);doc.setFontSize(11);let y=72;[["Pedidos",d.pedidos.length],["Orçamentos",d.orcamentos.length],["Consignados",d.consignados.length],["Conferências",d.conferencias.length]].forEach(([l,v])=>{doc.text(`${l}: ${v}`,16,y);y+=9;});doc.save(`relatorio_primedocs_${Utils.hoje()}.pdf`);Toast.show("Relatório PDF exportado!");}
function imprimirRelatorio(){window.print();}
function baixarArquivoRelatorio(conteudo,nome,tipo){const blob=new Blob([conteudo],{type:tipo}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function timestampRelatorio(v){if(!v)return 0;const d=new Date(String(v).length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?0:d.getTime();}
function escaparRelatorio(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
