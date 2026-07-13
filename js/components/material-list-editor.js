const MaterialListEditor = (() => {
    const estados = new Map();

    function gerarId() {
        return `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function normalizar(material = {}) {
        return {
            id: material.id || gerarId(),
            material: material.material || "",
            cor: material.cor || "",
            pesoGramas: Math.max(0, Number(material.pesoGramas ?? material.peso ?? 0) || 0),
            filamentoPreferencialId: material.filamentoPreferencialId || material.filamentoId || "",
            slotAms: material.slotAms ?? material.amsSlot ?? "",
            obrigatorio: material.obrigatorio !== false
        };
    }

    function criar(padrao = {}) {
        return normalizar({ material: "", cor: "", pesoGramas: 0, filamentoPreferencialId: "", slotAms: "", obrigatorio: true, ...padrao });
    }

    function escapar(valor) {
        return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    }

    function garantirEstado(scope) {
        if (!estados.has(scope)) estados.set(scope, { materiais: [], opcoes: {} });
        return estados.get(scope);
    }

    function render(scope, materiais = [], opcoes = {}) {
        const container = document.getElementById(`material-editor-${scope}`);
        if (!container) return;
        const estado = { materiais: (materiais || []).map(normalizar), opcoes: { ...opcoes } };
        estados.set(scope, estado);
        desenhar(scope);
    }

    function desenhar(scope) {
        const container = document.getElementById(`material-editor-${scope}`);
        const estado = garantirEstado(scope);
        if (!container) return;
        const filamentos = typeof Storage !== "undefined" ? Storage.listarFilamentos().filter(item => item.ativo !== false) : [];
        const peso = calcularPesoTotalMateriais(estado.materiais);
        const cores = estado.materiais.filter(item => String(item.cor || "").trim()).length;
        const custo = calcularCustoMateriais(estado.materiais, filamentos);
        const pesoInformado = Number(estado.opcoes.pesoInformado) || 0;
        const divergente = pesoInformado > 0 && Math.abs(pesoInformado - peso) > 0.01;
        container.innerHTML = `<section class="materialListEditor" data-material-scope="${escapar(scope)}">
            <div class="materialEditorHeader"><div><strong>${escapar(estado.opcoes.titulo || "Materiais e cores")}</strong><small>${escapar(estado.opcoes.descricao || "Adicione todos os filamentos usados nesta impressão.")}</small></div></div>
            <div class="materialRows">${estado.materiais.length ? estado.materiais.map((item, index) => `<article class="materialRow" data-material-index="${index}">
                <div class="materialRowNumber">${index + 1}</div>
                <label><span>Material</span><input data-material-field="material" value="${escapar(item.material)}" placeholder="PLA"></label>
                <label><span>Cor</span><input data-material-field="cor" value="${escapar(item.cor)}" placeholder="Branco"></label>
                <label><span>Peso (g)</span><input data-material-field="pesoGramas" type="number" min="0" step="0.1" value="${item.pesoGramas}"></label>
                <label class="materialFilamentField"><span>Filamento preferencial</span><select data-material-field="filamentoPreferencialId"><option value="">Sugerir depois</option>${filamentos.map(f => `<option value="${f.id}" ${String(item.filamentoPreferencialId) === String(f.id) ? "selected" : ""}>${escapar([f.material, f.cor, f.marca].filter(Boolean).join(" · "))}</option>`).join("")}</select></label>
                <label><span>Slot AMS</span><input data-material-field="slotAms" value="${escapar(item.slotAms)}" placeholder="Opcional"></label>
                <label class="materialRequired"><input data-material-field="obrigatorio" type="checkbox" ${item.obrigatorio ? "checked" : ""}><span>Obrigatório</span></label>
                <button class="materialRemove" type="button" onclick="MaterialListEditor.removerMaterial('${escapar(scope)}',${index})" aria-label="Remover material"><i data-lucide="trash-2"></i><span>Remover material</span></button>
            </article>`).join("") : `<div class="erpEmpty compact"><strong>Nenhum material adicionado</strong><p>Uma operação de impressão precisa de pelo menos um material.</p></div>`}</div>
            <button class="btnSecondary materialAddButton" type="button" onclick="MaterialListEditor.adicionarMaterial('${escapar(scope)}')"><i data-lucide="plus"></i> Adicionar cor/material</button>
            <div class="materialSummary"><div><span>Peso total</span><strong data-material-total>${peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} g</strong></div><div><span>Cores</span><strong data-material-colors>${cores}</strong></div><div><span>AMS</span><strong data-material-ams>${cores > 4 ? "Multicolor avançado" : cores > 1 ? "Compatível com AMS" : "Uma cor"}</strong></div><div><span>Custo estimado</span><strong data-material-cost>${typeof Utils !== "undefined" ? Utils.moeda(custo) : custo.toFixed(2)}</strong></div></div>
            ${divergente ? `<div class="materialWarning"><i data-lucide="triangle-alert"></i><span>O peso anterior (${pesoInformado.toLocaleString("pt-BR")} g) difere da soma dos materiais (${peso.toLocaleString("pt-BR")} g). Ao salvar, a soma dos materiais será usada.</span></div>` : ""}
        </section>`;
        container.querySelectorAll("[data-material-field]").forEach(campo => {
            campo.addEventListener("input", () => atualizarMaterial(scope, Number(campo.closest("[data-material-index]")?.dataset.materialIndex), campo.dataset.materialField, campo.type === "checkbox" ? campo.checked : campo.value));
            campo.addEventListener("change", () => atualizarMaterial(scope, Number(campo.closest("[data-material-index]")?.dataset.materialIndex), campo.dataset.materialField, campo.type === "checkbox" ? campo.checked : campo.value));
        });
        if (window.lucide) lucide.createIcons();
    }

    function capturar(scope) {
        const estado = garantirEstado(scope);
        const container = document.getElementById(`material-editor-${scope}`);
        if (!container) return estado.materiais;
        container.querySelectorAll("[data-material-index]").forEach(linha => {
            const index = Number(linha.dataset.materialIndex);
            const campo = nome => linha.querySelector(`[data-material-field="${nome}"]`);
            estado.materiais[index] = normalizar({
                ...estado.materiais[index],
                material: campo("material")?.value.trim(),
                cor: campo("cor")?.value.trim(),
                pesoGramas: campo("pesoGramas")?.value,
                filamentoPreferencialId: campo("filamentoPreferencialId")?.value,
                slotAms: campo("slotAms")?.value.trim(),
                obrigatorio: Boolean(campo("obrigatorio")?.checked)
            });
        });
        return estado.materiais;
    }

    function adicionarMaterial(scope, padrao = {}) {
        const estado = garantirEstado(scope);
        capturar(scope);
        estado.materiais.push(criar(padrao));
        desenhar(scope);
        notificar(scope);
    }

    function removerMaterial(scope, index) {
        const estado = garantirEstado(scope);
        capturar(scope);
        if (estado.materiais.length <= 1) {
            if (window.Toast) Toast.show("A operação de impressão precisa ter pelo menos um material.");
            return;
        }
        estado.materiais.splice(index, 1);
        desenhar(scope);
        notificar(scope);
    }

    function atualizarMaterial(scope, index, campo, valor) {
        const estado = garantirEstado(scope);
        const item = estado.materiais[index];
        if (!item) return;
        item[campo] = campo === "pesoGramas" ? Math.max(0, Number(valor) || 0) : valor;
        const peso = calcularPesoTotalMateriais(estado.materiais);
        const total = document.querySelector(`#material-editor-${CSS.escape(scope)} [data-material-total]`);
        if (total) total.textContent = `${peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} g`;
        const cores = estado.materiais.filter(material => String(material.cor || "").trim()).length;
        const custo = calcularCustoMateriais(estado.materiais, typeof Storage !== "undefined" ? Storage.listarFilamentos().filter(item => item.ativo !== false) : []);
        const container = document.getElementById(`material-editor-${scope}`);
        const coresEl = container?.querySelector("[data-material-colors]");
        const amsEl = container?.querySelector("[data-material-ams]");
        const custoEl = container?.querySelector("[data-material-cost]");
        if (coresEl) coresEl.textContent = String(cores);
        if (amsEl) amsEl.textContent = cores > 4 ? "Multicolor avançado" : cores > 1 ? "Compatível com AMS" : "Uma cor";
        if (custoEl) custoEl.textContent = typeof Utils !== "undefined" ? Utils.moeda(custo) : custo.toFixed(2);
        notificar(scope);
    }

    function notificar(scope) {
        const estado = garantirEstado(scope);
        if (typeof estado.opcoes.onChange === "function") estado.opcoes.onChange(estado.materiais.map(normalizar), calcularPesoTotalMateriais(estado.materiais));
    }

    function obter(scope) {
        return capturar(scope).map(normalizar);
    }

    function calcularPesoTotalMateriais(entrada) {
        const lista = typeof entrada === "string" ? garantirEstado(entrada).materiais : (Array.isArray(entrada) ? entrada : []);
        return lista.reduce((total, item) => total + Math.max(0, Number(item.pesoGramas) || 0), 0);
    }

    function validarMateriais(entrada) {
        const lista = typeof entrada === "string" ? obter(entrada) : (Array.isArray(entrada) ? entrada.map(normalizar) : []);
        if (!lista.length) return { valido: false, mensagem: "Adicione pelo menos um material à operação de impressão." };
        if (lista.some(item => Number(item.pesoGramas) < 0)) return { valido: false, mensagem: "O peso dos materiais não pode ser negativo." };
        if (lista.some(item => !item.material && !item.cor)) return { valido: false, mensagem: "Informe o material ou a cor em todas as linhas." };
        return { valido: true, materiais: lista, pesoTotal: calcularPesoTotalMateriais(lista) };
    }

    function calcularCustoMateriais(materiais, filamentos = []) {
        const config = typeof Storage !== "undefined" ? Storage.carregarConfigCustos() : {};
        return (materiais || []).reduce((total, item) => {
            const preferido = filamentos.find(f => String(f.id) === String(item.filamentoPreferencialId));
            const compativel = preferido || filamentos.find(f => (!item.material || String(f.material).toLowerCase() === String(item.material).toLowerCase()) && (!item.cor || String(f.cor).toLowerCase() === String(item.cor).toLowerCase()));
            const precoKg = Number(compativel?.precoKg ?? config.precoKgFilamentoPadrao ?? 0) || 0;
            return total + (Math.max(0, Number(item.pesoGramas) || 0) / 1000) * precoKg;
        }, 0);
    }

    return { render, criar, normalizar, adicionarMaterial, removerMaterial, atualizarMaterial, obter, calcularPesoTotalMateriais, validarMateriais, calcularCustoMateriais };
})();

window.MaterialListEditor = MaterialListEditor;
window.adicionarMaterial = (...args) => MaterialListEditor.adicionarMaterial(...args);
window.removerMaterial = (...args) => MaterialListEditor.removerMaterial(...args);
window.atualizarMaterial = (...args) => MaterialListEditor.atualizarMaterial(...args);
window.calcularPesoTotalMateriais = (...args) => MaterialListEditor.calcularPesoTotalMateriais(...args);
window.validarMateriais = (...args) => MaterialListEditor.validarMateriais(...args);
window.adicionarMaterialProducao = (scope = "produto-simples") => MaterialListEditor.adicionarMaterial(scope);
window.removerMaterialProducao = (id, scope = "produto-simples") => {
    const lista = MaterialListEditor.obter(scope);
    const index = lista.findIndex(item => String(item.id) === String(id));
    if (index >= 0) MaterialListEditor.removerMaterial(scope, index);
};
window.atualizarMaterialProducao = (id, campo, valor, scope = "produto-simples") => {
    const lista = MaterialListEditor.obter(scope);
    const index = lista.findIndex(item => String(item.id) === String(id));
    if (index >= 0) MaterialListEditor.atualizarMaterial(scope, index, campo, valor);
};
window.renderMateriaisProducao = (scope = "produto-simples", materiais = []) => MaterialListEditor.render(scope, materiais);
window.calcularResumoMateriais = (scope = "produto-simples") => ({ pesoTotal: MaterialListEditor.calcularPesoTotalMateriais(scope), quantidadeCores: MaterialListEditor.obter(scope).filter(item => String(item.cor || "").trim()).length });
