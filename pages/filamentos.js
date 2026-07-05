let filamentoEditandoId = null;

function renderFilamentos() {
    const filamentos = Storage.listarFilamentos().filter(item => item.ativo !== false);
    const pesquisa = document.getElementById("pesquisaFilamento")?.value || "";
    const material = document.getElementById("filtroMaterialFilamento")?.value || "";
    const cor = document.getElementById("filtroCorFilamento")?.value || "";
    const filtrados = filtrarFilamentos(filamentos, pesquisa, material, cor);
    const totalKg = filamentos.reduce((t, f) => t + Number(f.pesoAtualKg || 0), 0);
    const valor = filamentos.reduce((t, f) => t + Number(f.pesoAtualKg || 0) * Number(f.precoKg || 0), 0);
    const baixos = filamentos.filter(f => Number(f.pesoAtualKg || 0) <= Number(f.alertaMinimoKg || 0)).length;
    const materiais = [...new Set(filamentos.map(f => f.material).filter(Boolean))].sort();
    const cores = [...new Set(filamentos.map(f => f.cor).filter(Boolean))].sort();

    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("🧵 Filamentos", "Estoque e consumo de materiais para impressão 3D.")}
        <section class="erpSummaryGrid">
            ${cardResumoERP("weight", totalKg.toLocaleString("pt-BR", {maximumFractionDigits:3}) + " kg", "Estoque total")}
            ${cardResumoERP("badge-dollar-sign", Utils.moeda(valor), "Valor em filamento")}
            ${cardResumoERP("triangle-alert", baixos, "Abaixo do mínimo")}
            ${cardResumoERP("palette", `${materiais.length} / ${cores.length}`, "Materiais / cores")}
        </section>
        <section class="erpToolbar">
            <label class="erpSearch"><i data-lucide="search"></i><input id="pesquisaFilamento" placeholder="Pesquisar material, cor ou marca" value="${escaparFilamento(pesquisa)}" oninput="atualizarListaFilamentos()"></label>
            <select id="filtroMaterialFilamento" onchange="atualizarListaFilamentos()"><option value="">Todos os materiais</option>${materiais.map(v => `<option ${v===material?"selected":""}>${escaparFilamento(v)}</option>`).join("")}</select>
            <select id="filtroCorFilamento" onchange="atualizarListaFilamentos()"><option value="">Todas as cores</option>${cores.map(v => `<option ${v===cor?"selected":""}>${escaparFilamento(v)}</option>`).join("")}</select>
            <button class="btn erpAddButton" onclick="abrirModalFilamento()"><i data-lucide="plus"></i> Novo filamento</button>
        </section>
        <div id="listaFilamentos" class="erpCardGrid">${renderCardsFilamentos(filtrados)}</div>`;
    lucide.createIcons();
}

function atualizarListaFilamentos() {
    const todos = Storage.listarFilamentos().filter(item => item.ativo !== false);
    const filtrados = filtrarFilamentos(todos, document.getElementById("pesquisaFilamento")?.value, document.getElementById("filtroMaterialFilamento")?.value, document.getElementById("filtroCorFilamento")?.value);
    document.getElementById("listaFilamentos").innerHTML = renderCardsFilamentos(filtrados);
    lucide.createIcons();
}

function filtrarFilamentos(lista, pesquisa="", material="", cor="") {
    const termo = String(pesquisa || "").toLocaleLowerCase("pt-BR");
    return lista.filter(f => (!material || f.material === material) && (!cor || f.cor === cor) && [f.material,f.cor,f.marca,f.local].join(" ").toLocaleLowerCase("pt-BR").includes(termo));
}

function renderCardsFilamentos(lista) {
    if (!lista.length) return `<div class="erpEmpty"><i data-lucide="spool"></i><strong>Nenhum filamento encontrado</strong><p>Cadastre o primeiro rolo para acompanhar o estoque.</p></div>`;
    return lista.map(f => {
        const baixo = Number(f.pesoAtualKg || 0) <= Number(f.alertaMinimoKg || 0);
        const percentual = Math.min(100, Number(f.pesoTotalKg) ? Number(f.pesoAtualKg || 0) / Number(f.pesoTotalKg) * 100 : 0);
        return `<article class="erpEntityCard filamentCard ${baixo?"isLow":""}">
            <div class="erpEntityTop"><div class="filamentSwatch"><i data-lucide="spool"></i></div><div><h3>${escaparFilamento(f.material)} ${escaparFilamento(f.cor)}</h3><p>${escaparFilamento(f.marca || "Marca não informada")}</p></div>${baixo?`<span class="erpBadge danger">Baixo estoque</span>`:""}</div>
            <div class="filamentProgress"><div style="width:${percentual}%"></div></div>
            <div class="filamentNumbers"><div><span>Atual</span><strong>${Number(f.pesoAtualKg||0).toLocaleString("pt-BR")} kg</strong></div><div><span>Preço/kg</span><strong>${Utils.moeda(f.precoKg)}</strong></div><div><span>Local</span><strong>${escaparFilamento(f.local||"-")}</strong></div></div>
            <div class="erpCardActions"><button onclick="abrirModalConsumoFilamento('${f.id}')"><i data-lucide="minus-circle"></i> Baixar consumo</button><button onclick="abrirModalFilamento('${f.id}')"><i data-lucide="pencil"></i> Editar</button><button class="danger" onclick="inativarFilamento('${f.id}')"><i data-lucide="archive"></i></button></div>
        </article>`;
    }).join("");
}

function abrirModalFilamento(id=null) {
    const f = id ? Storage.buscarFilamentoPorId(id) : null;
    filamentoEditandoId = f?.id || null;
    const campo = (label,idCampo,valor="",tipo="text",step="") => `<label class="inputGroup"><span>${label}</span><input id="${idCampo}" type="${tipo}" ${step?`step="${step}"`:""} min="0" value="${escaparFilamento(valor)}"></label>`;
    Modal.abrir(f?"Editar filamento":"Novo filamento", `<div class="erpFormGrid">
        ${campo("Material *","filamentoMaterial",f?.material||"")}${campo("Cor *","filamentoCor",f?.cor||"")}${campo("Marca","filamentoMarca",f?.marca||"")}
        ${campo("Peso total (kg) *","filamentoPesoTotal",f?.pesoTotalKg||1,"number","0.001")}${campo("Peso atual (kg) *","filamentoPesoAtual",f?.pesoAtualKg??1,"number","0.001")}${campo("Preço por kg *","filamentoPrecoKg",f?.precoKg||85,"number","0.01")}
        ${campo("Alerta mínimo (kg)","filamentoAlerta",f?.alertaMinimoKg??0.15,"number","0.001")}${campo("Local","filamentoLocal",f?.local||"")}
        <label class="inputGroup erpFull"><span>Observações</span><textarea id="filamentoObservacoes" rows="3">${escaparFilamento(f?.observacoes||"")}</textarea></label></div>
        <div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="salvarFilamento()">Salvar</button></div>`);
}

function salvarFilamento() {
    const valor = id => document.getElementById(id)?.value.trim() || "";
    const anterior = filamentoEditandoId ? Storage.buscarFilamentoPorId(filamentoEditandoId) : null;
    if (!valor("filamentoMaterial") || !valor("filamentoCor")) return Toast.show("Informe material e cor.");
    const agora = new Date().toISOString();
    Storage.salvarFilamento({id:anterior?.id||`fil-${Date.now()}`,material:valor("filamentoMaterial"),cor:valor("filamentoCor"),marca:valor("filamentoMarca"),pesoTotalKg:Number(valor("filamentoPesoTotal"))||0,pesoAtualKg:Number(valor("filamentoPesoAtual"))||0,precoKg:Number(valor("filamentoPrecoKg"))||0,alertaMinimoKg:Number(valor("filamentoAlerta"))||0,local:valor("filamentoLocal"),observacoes:valor("filamentoObservacoes"),ativo:true,criadoEm:anterior?.criadoEm||agora,atualizadoEm:agora});
    Modal.fechar(); renderFilamentos(); Toast.show("Filamento salvo!");
}

function abrirModalConsumoFilamento(id) {
    const f=Storage.buscarFilamentoPorId(id); if(!f)return;
    Modal.abrir("Baixar consumo", `<p class="erpModalHint">Disponível: <strong>${Number(f.pesoAtualKg||0)} kg</strong></p><label class="inputGroup"><span>Consumo em gramas</span><input id="consumoFilamentoGramas" type="number" min="1" step="1"></label><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="confirmarConsumoFilamento('${id}')">Confirmar</button></div>`);
}

function confirmarConsumoFilamento(id) { const g=Number(document.getElementById("consumoFilamentoGramas")?.value)||0;if(g<=0)return Toast.show("Informe o consumo.");Storage.baixarFilamento(id,g/1000);Modal.fechar();renderFilamentos();Toast.show("Consumo registrado!"); }
function inativarFilamento(id) { Storage.excluirFilamento(id);renderFilamentos();Toast.show("Filamento inativado."); }
function cardResumoERP(icone,valor,descricao){return `<article class="erpSummaryCard"><i data-lucide="${icone}"></i><strong>${valor}</strong><span>${descricao}</span></article>`;}
function escaparFilamento(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
