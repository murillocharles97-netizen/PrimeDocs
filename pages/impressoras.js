const STATUS_IMPRESSORAS = { livre: "Livre", imprimindo: "Imprimindo", pausada: "Pausada", manutencao: "Manutenção", offline: "Offline" };

function renderImpressoras() {
    const lista = Storage.listarImpressoras().filter(item => item.ativa !== false);
    const busca = String(document.getElementById("buscaImpressora")?.value || "").toLocaleLowerCase("pt-BR");
    const filtro = document.getElementById("filtroImpressora")?.value || "";
    const filtradas = lista.filter(item => (!filtro || item.status === filtro) && [item.nome, item.modelo, item.fabricante].join(" ").toLocaleLowerCase("pt-BR").includes(busca));
    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("🖨️ Impressoras", "Máquinas, disponibilidade e manutenção em um só lugar.")}
        <section class="erpSummaryGrid">
            ${cardResumoERP("circle-check", lista.filter(i => i.status === "livre").length, "Livres")}
            ${cardResumoERP("printer", lista.filter(i => i.status === "imprimindo").length, "Imprimindo")}
            ${cardResumoERP("wrench", lista.filter(i => i.status === "manutencao").length, "Em manutenção")}
            ${cardResumoERP("power", lista.filter(i => i.status === "offline").length, "Offline")}
        </section>
        <section class="erpToolbar">
            <label class="erpSearch"><i data-lucide="search"></i><input id="buscaImpressora" value="${escaparImpressora(busca)}" placeholder="Nome, modelo ou fabricante" oninput="renderImpressoras()"></label>
            <select id="filtroImpressora" onchange="renderImpressoras()"><option value="">Todos os status</option>${Object.entries(STATUS_IMPRESSORAS).map(([v,l]) => `<option value="${v}" ${v === filtro ? "selected" : ""}>${l}</option>`).join("")}</select>
            <button class="btn erpAddButton" onclick="abrirModalImpressora()"><i data-lucide="plus"></i> Nova impressora</button>
        </section>
        <div class="erpCardGrid printerGrid">${filtradas.length ? filtradas.map(cardImpressora).join("") : `<div class="erpEmpty"><i data-lucide="printer"></i><strong>Nenhuma impressora encontrada</strong><p>Cadastre a primeira máquina para preparar a produção.</p></div>`}</div>`;
    lucide.createIcons();
}

function cardImpressora(item) {
    const limite = Math.max(0, Number(item.limiteManutencaoHoras) || 0);
    const desde = Math.max(0, Number(item.horasDesdeManutencao) || 0);
    const manutencao = limite ? Math.min(100, (desde / limite) * 100) : 0;
    const operacao = item.operacaoAtualId ? Storage.buscarOperacaoProducaoPorId(item.operacaoAtualId) : null;
    const ordem = operacao ? Storage.buscarOrdemProducaoPorId(operacao.ordemProducaoId) : null;
    return `<article class="erpEntityCard printerCard">
        <div class="erpEntityTop"><div class="printerIcon"><i data-lucide="printer"></i></div><div><h3>${escaparImpressora(item.nome)}</h3><p>${escaparImpressora([item.fabricante,item.modelo].filter(Boolean).join(" · ") || "Modelo não informado")}</p></div><span class="erpBadge printer-${item.status}">${STATUS_IMPRESSORAS[item.status] || item.status}</span></div>
        <div class="printerCurrent"><span>Operação atual</span><strong>${escaparImpressora(operacao?.nome || "Nenhuma")}</strong>${ordem ? `<small>${escaparImpressora(ordem.produtoNome)} · Pedido #${String(ordem.pedidoId).slice(-5)}</small>` : ""}</div>
        <div class="productMetrics"><div><span>Mesa</span><strong>${escaparImpressora(item.tamanhoMesa || "-")}</strong></div><div><span>Bico</span><strong>${escaparImpressora(item.bico || "-")}</strong></div><div><span>Horas totais</span><strong>${Number(item.horasTotais || 0).toFixed(1)} h</strong></div><div><span>Próxima manutenção</span><strong>${item.proximaManutencao ? formatarDataBR(item.proximaManutencao) : "-"}</strong></div></div>
        <div class="maintenanceMeter"><div><span>Uso desde manutenção</span><strong>${desde.toFixed(1)} / ${limite || "-"} h</strong></div><i><b style="width:${manutencao}%"></b></i></div>
        <div class="erpCardActions printerActions"><button onclick="abrirModalImpressora('${item.id}')"><i data-lucide="pencil"></i> Editar</button>${item.status === "manutencao" ? `<button onclick="concluirManutencaoImpressora('${item.id}')"><i data-lucide="check"></i> Concluir manutenção</button>` : `<button onclick="iniciarManutencaoImpressora('${item.id}')"><i data-lucide="wrench"></i> Manutenção</button>`}${item.status === "imprimindo" ? `<button onclick="alterarStatusImpressora('${item.id}','pausada')"><i data-lucide="pause"></i> Pausar</button>` : ""}${["pausada","offline"].includes(item.status) ? `<button onclick="alterarStatusImpressora('${item.id}','livre')"><i data-lucide="play"></i> Liberar</button>` : ""}<button onclick="verHistoricoImpressora('${item.id}')"><i data-lucide="history"></i> Histórico</button></div>
    </article>`;
}

function abrirModalImpressora(id = null) {
    const item = id ? Storage.buscarImpressoraPorId(id) : null;
    Modal.abrir(item ? "Editar impressora" : "Nova impressora", `<div class="erpFormGrid">
        ${Input.text("Nome *", "impNome", "Ex: Bambu A1", item?.nome || "")}
        ${Input.text("Modelo", "impModelo", "A1", item?.modelo || "")}
        ${Input.text("Fabricante", "impFabricante", "Bambu Lab", item?.fabricante || "")}
        ${Input.text("Tamanho da mesa", "impMesa", "256 × 256 × 256 mm", item?.tamanhoMesa || "")}
        ${Input.text("Bico", "impBico", "0.4 mm", item?.bico || "")}
        ${Input.text("Materiais permitidos", "impMateriais", "PLA, PETG, TPU", (item?.materiaisPermitidos || []).join(", "))}
        <label class="inputGroup"><span>Status</span><select id="impStatus">${Object.entries(STATUS_IMPRESSORAS).map(([v,l]) => `<option value="${v}" ${(item?.status || "livre") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${Input.number("Horas totais", "impHoras", item?.horasTotais || 0)}
        ${Input.number("Horas desde manutenção", "impHorasManutencao", item?.horasDesdeManutencao || 0)}
        ${Input.number("Limite para manutenção (h)", "impLimite", item?.limiteManutencaoHoras || 500)}
        <label class="inputGroup"><span>Última manutenção</span><input id="impUltima" type="date" value="${item?.ultimaManutencao || ""}"></label>
        <label class="inputGroup"><span>Próxima manutenção</span><input id="impProxima" type="date" value="${item?.proximaManutencao || ""}"></label>
        <label class="inputGroup erpFull"><span>Observações</span><textarea id="impObs" rows="3">${escaparImpressora(item?.observacoes || "")}</textarea></label>
        <div class="modalActions erpFull"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="salvarImpressora('${item?.id || ""}')">Salvar</button></div>
    </div>`); lucide.createIcons();
}

function salvarImpressora(id) {
    const anterior = id ? Storage.buscarImpressoraPorId(id) : null;
    const nome = document.getElementById("impNome")?.value.trim();
    if (!nome) return Toast.show("Informe o nome da impressora.");
    const agora = new Date().toISOString();
    Storage.salvarImpressora({ ...anterior, id: anterior?.id || `imp-${Date.now()}`, nome, modelo: document.getElementById("impModelo").value.trim(), fabricante: document.getElementById("impFabricante").value.trim(), tamanhoMesa: document.getElementById("impMesa").value.trim(), bico: document.getElementById("impBico").value.trim(), materiaisPermitidos: document.getElementById("impMateriais").value.split(",").map(v => v.trim()).filter(Boolean), status: document.getElementById("impStatus").value, operacaoAtualId: anterior?.operacaoAtualId || null, horasTotais: Number(document.getElementById("impHoras").value) || 0, horasDesdeManutencao: Number(document.getElementById("impHorasManutencao").value) || 0, limiteManutencaoHoras: Number(document.getElementById("impLimite").value) || 500, ultimaManutencao: document.getElementById("impUltima").value, proximaManutencao: document.getElementById("impProxima").value, observacoes: document.getElementById("impObs").value.trim(), ativa: true, criadoEm: anterior?.criadoEm || agora, atualizadoEm: agora });
    Modal.fechar(); renderImpressoras(); Toast.show("Impressora salva!");
}

function alterarStatusImpressora(id, status) { const item = Storage.buscarImpressoraPorId(id); if (!item) return; item.status = status; item.atualizadoEm = new Date().toISOString(); Storage.salvarImpressora(item); renderImpressoras(); Toast.show("Status atualizado."); }
function iniciarManutencaoImpressora(id) { const item = Storage.buscarImpressoraPorId(id); if (!item) return; const agora = new Date().toISOString(); item.status = "manutencao"; item.atualizadoEm = agora; Storage.salvarImpressora(item); Storage.salvarManutencao({ id: `man-${Date.now()}`, impressoraId: id, tipo: "preventiva", status: "em_andamento", inicio: agora, observacoes: "", pecasTrocadas: [], criadoEm: agora }); renderImpressoras(); Toast.show("Manutenção iniciada."); }
function concluirManutencaoImpressora(id) { const item = Storage.buscarImpressoraPorId(id); if (!item) return; Modal.abrir("Concluir manutenção", `<label class="inputGroup"><span>Tipo</span><select id="manTipo"><option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option><option value="limpeza">Limpeza</option></select></label>${Input.text("Peças trocadas", "manPecas", "Bico, tubo PTFE...")}<label class="inputGroup"><span>Observações</span><textarea id="manObs" rows="4"></textarea></label><div class="modalActions"><button class="btnSecondary" onclick="Modal.fechar()">Cancelar</button><button class="btn" onclick="confirmarConclusaoManutencao('${id}')">Concluir</button></div>`); }
function confirmarConclusaoManutencao(id) { const item = Storage.buscarImpressoraPorId(id); const lista = Storage.listarManutencoes(); const ativa = [...lista].reverse().find(m => String(m.impressoraId) === String(id) && m.status === "em_andamento"); const agora = new Date().toISOString(); if (ativa) Storage.salvarManutencao({ ...ativa, tipo: document.getElementById("manTipo").value, status: "concluida", fim: agora, observacoes: document.getElementById("manObs").value.trim(), pecasTrocadas: document.getElementById("manPecas").value.split(",").map(v => v.trim()).filter(Boolean), atualizadoEm: agora }); item.status = "livre"; item.horasDesdeManutencao = 0; item.ultimaManutencao = Utils.hoje(); item.atualizadoEm = agora; Storage.salvarImpressora(item); Modal.fechar(); renderImpressoras(); Toast.show("Manutenção concluída."); }
function verHistoricoImpressora(id) { const item = Storage.buscarImpressoraPorId(id); const manutencoes = Storage.listarManutencoes().filter(m => String(m.impressoraId) === String(id)).sort((a,b) => new Date(b.inicio) - new Date(a.inicio)); const eventos = Storage.listarHistoricoProducao().filter(e => String(e.impressoraId) === String(id)).sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm)); Modal.abrir(`Histórico — ${item?.nome || "Impressora"}`, `<div class="historyList">${[...manutencoes.map(m => ({data:m.inicio,titulo:`Manutenção ${m.tipo}`,texto:m.observacoes || m.status})),...eventos.map(e => ({data:e.criadoEm,titulo:e.tipo,texto:e.descricao}))].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>`<article><i data-lucide="history"></i><div><strong>${escaparImpressora(e.titulo)}</strong><span>${new Date(e.data).toLocaleString("pt-BR")}</span><p>${escaparImpressora(e.texto)}</p></div></article>`).join("") || `<div class="erpEmpty compact">Nenhum histórico registrado.</div>`}</div>`); lucide.createIcons(); }
function escaparImpressora(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
