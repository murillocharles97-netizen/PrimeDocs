(function () {
    "use strict";

    const media = window.matchMedia("(max-width: 767px)");
    const STORAGE_SECTION = "primedocs_mobile_inventory_section";
    const renderFilamentosDesktop = window.renderFilamentos;
    let buscaTimer = 0;

    const estado = {
        secao: localStorage.getItem(STORAGE_SECTION) === "produtos" ? "produtos" : "filamentos",
        busca: "",
        filtro: "todos",
        ordem: "nome_az",
        expandido: "",
        scrollFilamentos: 0,
        avancado: {
            material: "", cor: "", marca: "", diametro: "", localizacao: "", impressora: "",
            status: "", rolo: "", favorito: false, pesoMin: "", pesoMax: "", valorMin: "",
            valorMax: "", fornecedor: "", lote: ""
        }
    };

    const esc = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const num = valor => Number(valor) || 0;
    const chave = valor => String(valor ?? "");
    const normalizar = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
    const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, num(valor)));
    const lista = nome => typeof Storage?.[nome] === "function" ? Storage[nome]() : [];
    const peso = valor => typeof formatarPesoFilamento === "function" ? formatarPesoFilamento(valor) : `${Math.max(0, num(valor)).toFixed(0)} g`;

    function InventoryTabs(secao = estado.secao) {
        return `<div class="mobileInventoryTabs" role="tablist" aria-label="Seção do estoque">
            <button type="button" role="tab" aria-selected="${secao === "produtos"}" class="${secao === "produtos" ? "isActive" : ""}" onclick="MobileInventory.secao('produtos')"><i data-lucide="boxes"></i><span>Produtos</span></button>
            <button type="button" role="tab" aria-selected="${secao === "filamentos"}" class="${secao === "filamentos" ? "isActive" : ""}" onclick="MobileInventory.secao('filamentos')"><i data-lucide="spool"></i><span>Filamentos</span></button>
        </div>`;
    }

    function InventoryHeading() {
        return `<header class="mobileInventoryHeading"><h1>Estoque</h1><p>Gerencie produtos e filamentos da sua produção.</p></header>`;
    }

    function corExplicita(grupo) {
        const valor = grupo.rolos.map(rolo => rolo.corHex || rolo.codigoCor || rolo.hexCor || "").find(Boolean);
        return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(String(valor || "").trim()) ? String(valor).trim() : "";
    }

    function imagemGrupo(grupo) {
        const rolo = grupo.rolos.find(item => item.imagem || item.foto || item.imageUrl || item.imagemUrl);
        const origem = rolo?.imagem || rolo?.foto || rolo?.imageUrl || rolo?.imagemUrl || "";
        if (!origem) return `<span class="mobileFilamentFallback"><i data-lucide="spool"></i></span>`;
        return `<img src="${esc(origem)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="mobileFilamentFallback" hidden><i data-lucide="spool"></i></span>`;
    }

    function valorDisponivelGrupo(grupo) {
        let informouCusto = false;
        const valor = grupo.rolos.reduce((total, rolo) => {
            const precoKg = num(rolo.precoKg);
            if (precoKg > 0) informouCusto = true;
            return total + (Math.max(0, FilamentIntegration.pesoDisponivel(rolo.id)) / 1000) * precoKg;
        }, 0);
        return { valor, informado: informouCusto };
    }

    function statusGrupo(grupo) {
        const limite = Math.max(0, ...grupo.rolos.map(rolo => num(rolo.alertaGrupoGramas || rolo.alertaMinimoGramas)));
        const esgotado = grupo.pesoDisponivelTotal <= 0;
        const critico = !esgotado && limite > 0 && grupo.pesoDisponivelTotal <= limite * .5;
        if (esgotado) return { id: "esgotado", rotulo: "Esgotado", icone: "circle-off" };
        if (critico) return { id: "critico", rotulo: "Crítico", icone: "badge-alert" };
        if (grupo.baixoEstoque) return { id: "baixo", rotulo: "Baixo estoque", icone: "triangle-alert" };
        if (grupo.emUso > 0) return { id: "em_uso", rotulo: "Em uso", icone: "printer" };
        if (grupo.pesoReservadoTotal > 0) return { id: "reservado", rotulo: "Reservado", icone: "bookmark" };
        return { id: "normal", rotulo: "Normal", icone: "circle-check" };
    }

    function normalizarGrupo(grupo, contexto) {
        const inicial = grupo.rolos.reduce((total, rolo) => total + Math.max(0, num(rolo.pesoInicialGramas || rolo.pesoTotalKg * 1000)), 0);
        const disponivel = Math.max(0, num(grupo.pesoDisponivelTotal));
        const percentual = inicial > 0 ? limitar(disponivel / inicial * 100, 0, 100) : null;
        const locais = grupo.rolos.map(rolo => FilamentIntegration.localizacaoDoRolo(rolo.id));
        const emUso = grupo.rolos.filter(rolo => Boolean(FilamentIntegration.localDoRolo(rolo.id)));
        const reservas = grupo.rolos.flatMap(rolo => contexto.reservasPorFilamento.get(chave(rolo.id)) || []);
        const favorito = grupo.rolos.some(rolo => rolo.favorito === true || rolo.favoritoGrupo === true);
        const valor = valorDisponivelGrupo(grupo);
        const status = statusGrupo(grupo);
        const abertos = grupo.rolos.filter(rolo => rolo.aberto === true || rolo.roloAberto === true || Boolean(FilamentIntegration.localDoRolo(rolo.id))).length;
        const lacrados = grupo.rolos.filter(rolo => rolo.lacrado === true || rolo.roloAberto === false).length;
        const corVisual = corExplicita(grupo);
        const busca = normalizar([
            grupo.material, grupo.cor, grupo.marca, grupo.diametro, grupo.acabamento,
            ...grupo.rolos.flatMap(rolo => [rolo.codigo, rolo.observacoes, rolo.local, rolo.localizacaoNome, rolo.fornecedor, rolo.lote]),
            ...locais.flatMap(local => [local.tipo, local.impressoraNome, local.slotAms ? `slot ${local.slotAms}` : ""])
        ].join(" "));
        return { ...grupo, inicial, disponivel, percentual, locais, emUso, reservas, favorito, valor, status, abertos, lacrados, corVisual, busca };
    }

    function getMobileInventoryData() {
        FilamentIntegration.migrarDados();
        const rolos = lista("listarFilamentos").map(FilamentIntegration.normalizarRolo);
        const reservas = lista("listarReservasFilamento").filter(item => item.status === "ativa");
        const reservasPorFilamento = new Map();
        reservas.forEach(reserva => {
            const id = chave(reserva.filamentoId);
            if (!reservasPorFilamento.has(id)) reservasPorFilamento.set(id, []);
            reservasPorFilamento.get(id).push(reserva);
        });
        const contexto = {
            rolos, reservas, reservasPorFilamento,
            impressoras: lista("listarImpressoras"),
            lotes: lista("listarLotesExecucao"),
            ordens: lista("listarOrdensProducao"),
            operacoes: lista("listarOperacoesProducao")
        };
        contexto.grupos = FilamentIntegration.agruparRolos(rolos).map(grupo => normalizarGrupo(grupo, contexto));
        return contexto;
    }

    function filtrosAtivos() {
        return Object.entries(estado.avancado).filter(([, valor]) => valor !== "" && valor !== false).length;
    }

    function correspondeAvancado(grupo) {
        const f = estado.avancado;
        const algum = (campo, valor) => grupo.rolos.some(rolo => normalizar(rolo[campo]) === normalizar(valor));
        if (f.material && normalizar(grupo.material) !== normalizar(f.material)) return false;
        if (f.cor && normalizar(grupo.cor) !== normalizar(f.cor)) return false;
        if (f.marca && normalizar(grupo.marca) !== normalizar(f.marca)) return false;
        if (f.diametro && normalizar(grupo.diametro) !== normalizar(f.diametro)) return false;
        if (f.localizacao && !grupo.locais.some(local => local.tipo === f.localizacao)) return false;
        if (f.impressora && !grupo.locais.some(local => chave(local.impressoraId) === chave(f.impressora))) return false;
        if (f.status && grupo.status.id !== f.status) return false;
        if (f.rolo === "aberto" && grupo.abertos <= 0) return false;
        if (f.rolo === "lacrado" && grupo.lacrados <= 0) return false;
        if (f.favorito && !grupo.favorito) return false;
        if (f.pesoMin !== "" && grupo.disponivel < num(f.pesoMin)) return false;
        if (f.pesoMax !== "" && grupo.disponivel > num(f.pesoMax)) return false;
        if (f.valorMin !== "" && grupo.valor.valor < num(f.valorMin)) return false;
        if (f.valorMax !== "" && grupo.valor.valor > num(f.valorMax)) return false;
        if (f.fornecedor && !algum("fornecedor", f.fornecedor)) return false;
        if (f.lote && !algum("lote", f.lote)) return false;
        return true;
    }

    function filtrarGrupos(grupos) {
        const termo = normalizar(estado.busca);
        return grupos.filter(grupo => {
            if (termo && !grupo.busca.includes(termo)) return false;
            if (estado.filtro !== "todos") {
                if (estado.filtro.startsWith("material:")) {
                    if (normalizar(grupo.material) !== estado.filtro.slice(9)) return false;
                } else if (estado.filtro === "favoritos" && !grupo.favorito) return false;
                else if (estado.filtro === "baixo" && !["baixo", "critico"].includes(grupo.status.id)) return false;
                else if (estado.filtro === "em_uso" && grupo.emUso.length <= 0) return false;
                else if (estado.filtro === "esgotados" && grupo.status.id !== "esgotado") return false;
            }
            return correspondeAvancado(grupo);
        });
    }

    function ordenarGrupos(grupos) {
        const comparadores = {
            nome_az: (a, b) => `${a.material} ${a.cor}`.localeCompare(`${b.material} ${b.cor}`, "pt-BR"),
            nome_za: (a, b) => `${b.material} ${b.cor}`.localeCompare(`${a.material} ${a.cor}`, "pt-BR"),
            menor: (a, b) => a.disponivel - b.disponivel,
            maior: (a, b) => b.disponivel - a.disponivel,
            baixo: (a, b) => Number(["baixo", "critico"].includes(b.status.id)) - Number(["baixo", "critico"].includes(a.status.id)) || a.disponivel - b.disponivel,
            critico: (a, b) => Number(b.status.id === "critico") - Number(a.status.id === "critico") || a.disponivel - b.disponivel,
            mais_usados: (a, b) => b.emUso.length - a.emUso.length,
            menos_usados: (a, b) => a.emUso.length - b.emUso.length,
            recentes: (a, b) => new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0),
            antigos: (a, b) => new Date(a.atualizadoEm || 0) - new Date(b.atualizadoEm || 0),
            valor_maior: (a, b) => b.valor.valor - a.valor.valor,
            valor_menor: (a, b) => a.valor.valor - b.valor.valor,
            material: (a, b) => String(a.material).localeCompare(String(b.material), "pt-BR"),
            cor: (a, b) => String(a.cor).localeCompare(String(b.cor), "pt-BR"),
            marca: (a, b) => String(a.marca).localeCompare(String(b.marca), "pt-BR")
        };
        return [...grupos].sort(comparadores[estado.ordem] || comparadores.nome_az);
    }

    function Summary(contexto) {
        const grupos = contexto.grupos;
        const disponivel = grupos.reduce((total, grupo) => total + grupo.disponivel, 0);
        const baixos = grupos.filter(grupo => ["baixo", "critico"].includes(grupo.status.id)).length;
        const emUso = contexto.rolos.filter(rolo => rolo.ativo !== false && Boolean(FilamentIntegration.localDoRolo(rolo.id))).length;
        const esgotados = contexto.rolos.filter(rolo => rolo.ativo !== false && (rolo.esgotado || num(rolo.pesoAtualGramas) <= 0)).length;
        return `<section class="mobileFilamentSummary" aria-label="Resumo de filamentos">
            <button type="button" onclick="MobileInventory.filtro('todos')"><span class="tonePurple"><i data-lucide="spool"></i></span><small>Disponível</small><strong>${peso(disponivel)}</strong></button>
            <button type="button" onclick="MobileInventory.filtro('baixo')"><span class="toneWarning"><i data-lucide="triangle-alert"></i></span><small>Baixo estoque</small><strong>${baixos}</strong></button>
            <button type="button" onclick="MobileInventory.filtro('em_uso')"><span class="toneInfo"><i data-lucide="printer"></i></span><small>Em uso</small><strong>${emUso}</strong></button>
            <button type="button" onclick="MobileInventory.filtro('esgotados')"><span class="toneDanger"><i data-lucide="circle-off"></i></span><small>Esgotados</small><strong>${esgotados}</strong></button>
        </section>`;
    }

    function Search() {
        return `<label class="mobileFilamentSearch"><i data-lucide="search"></i><input id="mobileFilamentSearch" autocomplete="off" value="${esc(estado.busca)}" placeholder="Buscar por material, cor, marca ou código" oninput="MobileInventory.buscar(this.value)"><button type="button" class="${estado.busca ? "isVisible" : ""}" aria-label="Limpar busca" onclick="MobileInventory.buscar('');document.getElementById('mobileFilamentSearch')?.focus()"><i data-lucide="x"></i></button></label>`;
    }

    function QuickFilters(contexto) {
        const materiais = [...new Set(contexto.grupos.map(grupo => grupo.material).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        const contagemMaterial = material => contexto.grupos.filter(grupo => normalizar(grupo.material) === normalizar(material)).length;
        const chips = [
            ["todos", "Todos", contexto.grupos.length],
            ...materiais.map(material => [`material:${normalizar(material)}`, material, contagemMaterial(material)]),
            ["baixo", "Baixo estoque", contexto.grupos.filter(g => ["baixo", "critico"].includes(g.status.id)).length],
            ["em_uso", "Em uso", contexto.grupos.filter(g => g.emUso.length).length],
            ["esgotados", "Esgotados", contexto.grupos.filter(g => g.status.id === "esgotado").length],
            ["favoritos", "Favoritos", contexto.grupos.filter(g => g.favorito).length]
        ];
        return `<div class="mobileFilamentFiltersRow"><div class="mobileFilamentQuickFilters" aria-label="Filtros rápidos">${chips.map(([id, label, total]) => `<button type="button" class="${estado.filtro === id ? "isActive" : ""}" onclick="MobileInventory.filtro('${esc(id)}')"><span>${esc(label)}</span><b>${total}</b></button>`).join("")}</div><button type="button" class="mobileFilamentAdvancedButton" onclick="MobileInventory.abrirFiltros()"><i data-lucide="list-filter"></i><span>Filtros</span>${filtrosAtivos() ? `<b>${filtrosAtivos()}</b>` : ""}</button></div>`;
    }

    function StockStatus(grupo) {
        return `<span class="mobileFilamentStatus status-${grupo.status.id}"><i data-lucide="${grupo.status.icone}"></i>${grupo.status.rotulo}</span>`;
    }

    function Availability(grupo) {
        const inicial = grupo.inicial;
        if (!(inicial > 0)) return `<div class="mobileFilamentAvailability"><small>Disponível</small><strong>${peso(grupo.disponivel)}</strong><span>Saldo atual</span></div>`;
        return `<div class="mobileFilamentAvailability"><small>Disponível</small><strong>${peso(grupo.disponivel)}</strong><span>de ${peso(inicial)}</span><div><i><b style="width:${grupo.percentual}%"></b></i><em>${Math.round(grupo.percentual)}%</em></div></div>`;
    }

    function GroupMetrics(grupo) {
        const valor = grupo.valor.informado ? Utils.moeda(grupo.valor.valor) : "Não informado";
        return `<footer class="mobileFilamentMetrics">
            <button type="button" onclick="event.stopPropagation();MobileInventory.reservas('${encodeURIComponent(grupo.chave)}')"><i data-lucide="bookmark"></i><span><small>Reservado</small><strong>${peso(grupo.pesoReservadoTotal)}</strong><em>${grupo.reservas.length ? `${grupo.reservas.length} reserva(s)` : "Sem reservas"}</em></span></button>
            <button type="button" onclick="event.stopPropagation();MobileInventory.uso('${encodeURIComponent(grupo.chave)}')"><i data-lucide="printer"></i><span><small>Em uso</small><strong>${peso(grupo.emUso.reduce((t, r) => t + FilamentIntegration.pesoDisponivel(r.id), 0))}</strong><em>${grupo.emUso.length ? `${grupo.emUso.length} impressora(s)` : "Nenhuma"}</em></span></button>
            <button type="button" onclick="event.stopPropagation();MobileInventory.detalhes('${encodeURIComponent(grupo.chave)}')"><i data-lucide="spool"></i><span><small>Rolos</small><strong>${grupo.quantidadeRolos}</strong><em>${grupo.abertos ? `${grupo.abertos} aberto(s)` : grupo.lacrados ? `${grupo.lacrados} lacrado(s)` : "Ver rolos"}</em></span></button>
            <div><i data-lucide="circle-dollar-sign"></i><span><small>Valor estimado</small><strong>${valor}</strong><em>Saldo disponível</em></span></div>
        </footer>`;
    }

    function Expanded(grupo) {
        const locais = grupo.rolos.map(rolo => {
            const local = FilamentIntegration.localizacaoDoRolo(rolo.id);
            const rotulo = local.tipo === "ams" ? `${local.impressoraNome || "Impressora"} · AMS ${local.slotAms}` : local.tipo === "externo" ? `${local.impressoraNome || "Impressora"} · externo` : rolo.esgotado ? "Sem rolo disponível" : (rolo.local || rolo.localizacaoNome || "Estoque");
            return `<li><strong>${esc(rolo.codigo || "Rolo")}</strong><span>${esc(rotulo)}</span></li>`;
        }).join("");
        const metadados = grupo.rolos.find(rolo => rolo.fornecedor || rolo.lote || rolo.dataCompra || rolo.dataAquisicao);
        return `<section class="mobileFilamentExpanded"><dl><div><dt>Localizações</dt><dd><ul>${locais}</ul></dd></div>${metadados?.fornecedor ? `<div><dt>Fornecedor</dt><dd>${esc(metadados.fornecedor)}</dd></div>` : ""}${metadados?.lote ? `<div><dt>Lote</dt><dd>${esc(metadados.lote)}</dd></div>` : ""}${metadados?.dataCompra || metadados?.dataAquisicao ? `<div><dt>Compra</dt><dd>${new Date(metadados.dataCompra || metadados.dataAquisicao).toLocaleDateString("pt-BR")}</dd></div>` : ""}</dl><button type="button" onclick="event.stopPropagation();MobileInventory.detalhes('${encodeURIComponent(grupo.chave)}')"><i data-lucide="external-link"></i>Abrir ficha completa</button></section>`;
    }

    function FilamentCard(grupo) {
        const cod = encodeURIComponent(grupo.chave);
        const cor = grupo.corVisual ? `<span class="mobileFilamentColor" style="--filament-color:${esc(grupo.corVisual)}"></span>` : `<span class="mobileFilamentColor isNeutral"></span>`;
        const corStyle = grupo.corVisual ? `style="--group-color:${esc(grupo.corVisual)}"` : "";
        return `<div class="mobileFilamentSwipe" data-filament-swipe="${cod}"><div class="mobileFilamentSwipeAction action-entry"><i data-lucide="package-plus"></i><span>Adicionar rolo</span></div><div class="mobileFilamentSwipeAction action-consume"><i data-lucide="package-minus"></i><span>Registrar consumo</span></div><article class="mobileFilamentCard status-${grupo.status.id} ${estado.expandido === grupo.chave ? "isExpanded" : ""}" ${corStyle} aria-expanded="${estado.expandido === grupo.chave}" onclick="MobileInventory.expandir('${cod}')">
            <div class="mobileFilamentMain"><div class="mobileFilamentImage">${imagemGrupo(grupo)}<button type="button" class="mobileFilamentFavorite ${grupo.favorito ? "isActive" : ""}" aria-label="${grupo.favorito ? "Remover favorito" : "Favoritar filamento"}" onclick="event.stopPropagation();MobileInventory.favorito('${cod}')"><i data-lucide="heart"></i></button></div>
            <div class="mobileFilamentIdentity"><span class="mobileFilamentMaterial">${esc(grupo.material || "Material")}</span><h3>${esc(grupo.cor || "Cor não informada")} ${grupo.cor ? cor : ""}</h3><p>${esc(grupo.marca || "Marca não informada")}${grupo.diametro ? ` · ${esc(grupo.diametro)} mm` : ""}</p>${StockStatus(grupo)}</div>
            ${Availability(grupo)}<button type="button" class="mobileFilamentMore" aria-label="Mais ações" onclick="event.stopPropagation();MobileInventory.menu('${cod}')"><i data-lucide="ellipsis-vertical"></i></button></div>
            ${GroupMetrics(grupo)}${estado.expandido === grupo.chave ? Expanded(grupo) : ""}
        </article></div>`;
    }

    function EmptyState(buscando) {
        return `<section class="mobileInventoryEmpty"><i data-lucide="${buscando ? "search-x" : "spool"}"></i><strong>${buscando ? "Nenhum filamento encontrado." : "Nenhum filamento cadastrado."}</strong><p>${buscando ? "Revise a busca ou os filtros." : "Adicione seu primeiro rolo para controlar consumo e disponibilidade."}</p><button type="button" onclick="${buscando ? "MobileInventory.limpar()" : "AddMultipleRollsModal.abrir()"}">${buscando ? "Limpar filtros" : "Adicionar rolo"}</button></section>`;
    }

    function renderFilamentosMobile(restaurarScroll = true) {
        estado.secao = "filamentos";
        localStorage.setItem(STORAGE_SECTION, estado.secao);
        const contexto = getMobileInventoryData();
        const grupos = ordenarGrupos(filtrarGrupos(contexto.grupos));
        app.innerHTML = `<main class="mobileInventoryPage mobileFilamentsInventory">${InventoryHeading()}${InventoryTabs("filamentos")}${Summary(contexto)}<section class="mobileFilamentToolbar">${Search()}${QuickFilters(contexto)}</section><div class="mobileFilamentListHead"><h2>Rolos de filamento</h2><button type="button" onclick="MobileInventory.abrirOrdenacao()"><i data-lucide="arrow-up-down"></i><span>Ordenar: ${esc(rotuloOrdem())}</span><i data-lucide="chevron-down"></i></button></div><section class="mobileFilamentList">${grupos.length ? grupos.map(FilamentCard).join("") : EmptyState(Boolean(estado.busca || estado.filtro !== "todos" || filtrosAtivos()))}</section></main>`;
        requestAnimationFrame(() => { if (restaurarScroll) window.scrollTo({ top: estado.scrollFilamentos, behavior: "instant" }); ativarSwipes(); });
        atualizarNavegacao();
        if (window.lucide) lucide.createIcons();
    }

    function rotuloOrdem() {
        return ({ nome_az: "Nome A–Z", nome_za: "Nome Z–A", menor: "Menor disponibilidade", maior: "Maior disponibilidade", baixo: "Baixo estoque primeiro", critico: "Crítico primeiro", mais_usados: "Mais utilizados", menos_usados: "Menos utilizados", recentes: "Mais recentes", antigos: "Mais antigos", valor_maior: "Maior valor estimado", valor_menor: "Menor valor estimado", material: "Material", cor: "Cor", marca: "Marca" })[estado.ordem] || "Nome A–Z";
    }

    function abrirSheet(titulo, conteudo) {
        Modal.abrir(titulo, `<div class="mobileInventorySheet">${conteudo}</div>`);
        document.querySelector("#modalRoot .modalContainer")?.classList.add("mobileBottomSheet", "mobileInventoryBottomSheet");
        if (window.lucide) lucide.createIcons();
    }

    function selectCampo(rotulo, id, valores, atual) {
        return `<label><span>${rotulo}</span><select id="${id}"><option value="">Todos</option>${valores.map(valor => `<option value="${esc(valor)}" ${chave(valor) === chave(atual) ? "selected" : ""}>${esc(valor)}</option>`).join("")}</select></label>`;
    }

    function atualizarNavegacao() {
        if (!media.matches) return;
        if (typeof renderNavegacaoInferiorPrimeDocs === "function") renderNavegacaoInferiorPrimeDocs("filamentos");
        document.querySelectorAll("[data-bottom-page]").forEach(botao => {
            const ativo = botao.dataset.bottomPage === "filamentos";
            botao.classList.toggle("isActive", ativo);
            ativo ? botao.setAttribute("aria-current", "page") : botao.removeAttribute("aria-current");
        });
        if (window.lucide) lucide.createIcons();
    }

    function ativarSwipes() {
        document.querySelectorAll("[data-filament-swipe]").forEach(wrapper => {
            const card = wrapper.querySelector(".mobileFilamentCard");
            let inicioX = 0, inicioY = 0, delta = 0, ativo = false;
            card.addEventListener("pointerdown", evento => {
                if (evento.target.closest("button")) return;
                inicioX = evento.clientX; inicioY = evento.clientY; delta = 0; ativo = true;
                card.setPointerCapture?.(evento.pointerId);
            });
            card.addEventListener("pointermove", evento => {
                if (!ativo) return;
                const dx = evento.clientX - inicioX, dy = evento.clientY - inicioY;
                if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { ativo = false; card.style.transform = ""; return; }
                delta = limitar(dx, -96, 96);
                if (Math.abs(delta) > 7) {
                    card.style.transform = `translateX(${delta}px)`;
                    wrapper.classList.toggle("showEntry", delta > 0);
                    wrapper.classList.toggle("showConsume", delta < 0);
                }
            });
            const finalizar = () => {
                if (!ativo) return;
                ativo = false; card.style.transform = "";
                if (Math.abs(delta) >= 76) {
                    navigator.vibrate?.(18);
                    delta > 0 ? api.adicionarIgual(wrapper.dataset.filamentSwipe) : api.consumirGrupo(wrapper.dataset.filamentSwipe);
                }
                wrapper.classList.remove("showEntry", "showConsume"); delta = 0;
            };
            card.addEventListener("pointerup", finalizar);
            card.addEventListener("pointercancel", finalizar);
        });
    }

    function encontrarGrupo(codificado) {
        const chaveGrupo = decodeURIComponent(codificado || "");
        return getMobileInventoryData().grupos.find(grupo => grupo.chave === chaveGrupo);
    }

    const api = {
        section() { return estado.secao; },
        isActive(secao) { return media.matches && estado.secao === secao; },
        renderFilamentos: renderFilamentosMobile,
        getMobileInventoryData,
        tabs: InventoryTabs,
        secao(secao) {
            estado.secao = secao === "produtos" ? "produtos" : "filamentos";
            localStorage.setItem(STORAGE_SECTION, estado.secao);
            window.scrollTo({ top: 0, behavior: "auto" });
            if (estado.secao === "produtos") ProdutosMobile.render(false);
            else renderFilamentosMobile(false);
        },
        decorateProducts() {
            if (!media.matches) return;
            estado.secao = "produtos";
            localStorage.setItem(STORAGE_SECTION, estado.secao);
            const pagina = document.querySelector(".mobileProductsPage");
            const cabecalho = pagina?.querySelector(".mobileProductsHeader");
            if (!pagina || !cabecalho || pagina.querySelector(".mobileInventoryTabs")) return;
            cabecalho.querySelector("h1").textContent = "Estoque";
            const p = cabecalho.querySelector("p");
            if (p) p.textContent = "Gerencie produtos e filamentos da sua produção.";
            cabecalho.insertAdjacentHTML("afterend", InventoryTabs("produtos"));
            pagina.classList.add("mobileInventoryProducts");
            atualizarNavegacao();
        },
        buscar(valor) { estado.busca = valor; clearTimeout(buscaTimer); buscaTimer = setTimeout(() => renderFilamentosMobile(false), 200); },
        filtro(id) { estado.filtro = estado.filtro === id && id !== "todos" ? "todos" : id; renderFilamentosMobile(false); },
        limpar() { estado.busca = ""; estado.filtro = "todos"; Object.keys(estado.avancado).forEach(campo => estado.avancado[campo] = typeof estado.avancado[campo] === "boolean" ? false : ""); renderFilamentosMobile(false); },
        expandir(codificado) { const id = decodeURIComponent(codificado); estado.expandido = estado.expandido === id ? "" : id; estado.scrollFilamentos = window.scrollY; renderFilamentosMobile(); },
        favorito(codificado) {
            const grupo = encontrarGrupo(codificado); if (!grupo) return;
            const novo = !grupo.favorito;
            grupo.rolos.forEach(rolo => Storage.salvarFilamento({ ...rolo, favoritoGrupo: novo, atualizadoEm: new Date().toISOString() }));
            renderFilamentosMobile(false); Toast.show(novo ? "Filamento adicionado aos favoritos." : "Filamento removido dos favoritos.", "success");
        },
        novoItem() { estado.secao === "produtos" ? abrirModalProduto() : AddMultipleRollsModal.abrir(); },
        abrirOrdenacao() {
            const opcoes = [["nome_az", "Nome A–Z"], ["nome_za", "Nome Z–A"], ["menor", "Menor disponibilidade"], ["maior", "Maior disponibilidade"], ["baixo", "Baixo estoque primeiro"], ["critico", "Crítico primeiro"], ["mais_usados", "Mais utilizados"], ["menos_usados", "Menos utilizados"], ["recentes", "Mais recentes"], ["antigos", "Mais antigos"], ["valor_maior", "Maior valor estimado"], ["valor_menor", "Menor valor estimado"], ["material", "Material"], ["cor", "Cor"], ["marca", "Marca"]];
            abrirSheet("Ordenar filamentos", `<div class="mobileInventorySortOptions">${opcoes.map(([id, label]) => `<button type="button" class="${estado.ordem === id ? "isActive" : ""}" onclick="MobileInventory.ordenar('${id}')"><span>${label}</span>${estado.ordem === id ? '<i data-lucide="check"></i>' : ""}</button>`).join("")}</div>`);
        },
        ordenar(id) { estado.ordem = id; Modal.fechar(); renderFilamentosMobile(false); },
        abrirFiltros() {
            const contexto = getMobileInventoryData();
            const unicos = campo => [...new Set(contexto.rolos.map(rolo => rolo[campo]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
            const impressoras = `<label><span>Impressora</span><select id="mifImpressora"><option value="">Todas</option>${contexto.impressoras.map(item => `<option value="${esc(item.id)}" ${chave(estado.avancado.impressora) === chave(item.id) ? "selected" : ""}>${esc(item.nome || item.modelo || "Impressora")}</option>`).join("")}</select></label>`;
            abrirSheet("Filtros de filamentos", `<div class="mobileInventoryAdvancedFilters">${selectCampo("Material", "mifMaterial", unicos("material"), estado.avancado.material)}${selectCampo("Cor", "mifCor", unicos("cor"), estado.avancado.cor)}${selectCampo("Marca", "mifMarca", unicos("marca"), estado.avancado.marca)}${selectCampo("Diâmetro", "mifDiametro", unicos("diametro"), estado.avancado.diametro)}${selectCampo("Localização", "mifLocal", ["estoque", "ams", "externo"], estado.avancado.localizacao)}${impressoras}<label><span>Situação</span><select id="mifStatus"><option value="">Todas</option>${[["normal", "Normal"], ["baixo", "Baixo estoque"], ["critico", "Crítico"], ["em_uso", "Em uso"], ["reservado", "Reservado"], ["esgotado", "Esgotado"]].map(([id, label]) => `<option value="${id}" ${estado.avancado.status === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Estado do rolo</span><select id="mifRolo"><option value="">Todos</option><option value="aberto" ${estado.avancado.rolo === "aberto" ? "selected" : ""}>Aberto</option><option value="lacrado" ${estado.avancado.rolo === "lacrado" ? "selected" : ""}>Lacrado</option></select></label><label class="mobileInventoryCheck"><input id="mifFavorito" type="checkbox" ${estado.avancado.favorito ? "checked" : ""}><span>Somente favoritos</span></label><div class="mobileInventoryRange"><label><span>Peso mínimo (g)</span><input id="mifPesoMin" type="number" min="0" value="${esc(estado.avancado.pesoMin)}"></label><label><span>Peso máximo (g)</span><input id="mifPesoMax" type="number" min="0" value="${esc(estado.avancado.pesoMax)}"></label></div><div class="mobileInventoryRange"><label><span>Valor mínimo</span><input id="mifValorMin" type="number" min="0" step="0.01" value="${esc(estado.avancado.valorMin)}"></label><label><span>Valor máximo</span><input id="mifValorMax" type="number" min="0" step="0.01" value="${esc(estado.avancado.valorMax)}"></label></div>${selectCampo("Fornecedor", "mifFornecedor", unicos("fornecedor"), estado.avancado.fornecedor)}${selectCampo("Lote", "mifLote", unicos("lote"), estado.avancado.lote)}</div><div class="mobileInventorySheetActions"><button type="button" onclick="MobileInventory.limparFiltros()">Limpar filtros</button><button class="primary" type="button" onclick="MobileInventory.aplicarFiltros()">Aplicar filtros</button></div>`);
        },
        aplicarFiltros() {
            const valor = id => document.getElementById(id)?.value || "";
            Object.assign(estado.avancado, { material: valor("mifMaterial"), cor: valor("mifCor"), marca: valor("mifMarca"), diametro: valor("mifDiametro"), localizacao: valor("mifLocal"), impressora: valor("mifImpressora"), status: valor("mifStatus"), rolo: valor("mifRolo"), favorito: Boolean(document.getElementById("mifFavorito")?.checked), pesoMin: valor("mifPesoMin"), pesoMax: valor("mifPesoMax"), valorMin: valor("mifValorMin"), valorMax: valor("mifValorMax"), fornecedor: valor("mifFornecedor"), lote: valor("mifLote") });
            Modal.fechar(); renderFilamentosMobile(false);
        },
        limparFiltros() { Object.keys(estado.avancado).forEach(campo => estado.avancado[campo] = typeof estado.avancado[campo] === "boolean" ? false : ""); Modal.fechar(); renderFilamentosMobile(false); },
        detalhes(codificado) { const grupo = encontrarGrupo(codificado); if (grupo) abrirGrupoFilamento(encodeURIComponent(grupo.chave)); },
        adicionarIgual(codificado) { const grupo = encontrarGrupo(codificado); if (grupo) AddMultipleRollsModal.abrir({ material: grupo.material, cor: grupo.cor, marca: grupo.marca, acabamento: grupo.acabamento, diametro: grupo.diametro }); },
        consumirGrupo(codificado) { const grupo = encontrarGrupo(codificado); if (!grupo) return; const rolos = grupo.rolos.filter(r => r.ativo !== false && !r.esgotado); if (rolos.length === 1) return api.abrirConsumo(rolos[0].id); abrirSheet("Escolher rolo para consumo", `<div class="mobileInventoryRollChoices">${rolos.map(rolo => `<button type="button" onclick="Modal.fechar();MobileInventory.abrirConsumo('${esc(rolo.id)}')"><span><strong>${esc(rolo.codigo)}</strong><small>${peso(FilamentIntegration.pesoDisponivel(rolo.id))} disponíveis</small></span><i data-lucide="chevron-right"></i></button>`).join("")}</div>`); },
        abrirConsumo(id) { const rolo = FilamentIntegration.normalizarRolo(Storage.buscarFilamentoPorId(id)); if (!rolo?.id) return; abrirSheet("Registrar consumo", `<div class="mobileInventoryOperationIntro"><i data-lucide="package-minus"></i><div><strong>${esc(rolo.codigo)}</strong><span>${peso(rolo.pesoAtualGramas)} registrados</span></div></div><label class="mobileInventoryField"><span>Consumo (g)</span><input id="mobileFilamentConsumption" type="number" min="0.1" max="${rolo.pesoAtualGramas}" step="0.1" inputmode="decimal"></label><label class="mobileInventoryField"><span>Motivo</span><textarea id="mobileFilamentConsumptionNote" rows="2" placeholder="Consumo manual"></textarea></label><div class="mobileInventorySheetActions"><button type="button" onclick="Modal.fechar()">Cancelar</button><button class="primary" type="button" onclick="MobileInventory.confirmarConsumo('${esc(id)}')">Registrar</button></div>`); },
        confirmarConsumo(id) { try { const rolo = FilamentIntegration.normalizarRolo(Storage.buscarFilamentoPorId(id)); const consumo = num(document.getElementById("mobileFilamentConsumption")?.value); if (!(consumo > 0)) throw new Error("Informe o consumo em gramas."); if (consumo > rolo.pesoAtualGramas) throw new Error("O consumo não pode superar o peso atual."); FilamentIntegration.corrigirPeso(id, rolo.pesoAtualGramas - consumo, "consumo_manual", document.getElementById("mobileFilamentConsumptionNote")?.value || ""); Modal.fechar(); renderFilamentosMobile(false); Toast.show("Consumo registrado com sucesso.", "success"); } catch (erro) { Toast.show(erro.message || "Não foi possível registrar o consumo.", "error"); } },
        reservas(codificado) { const grupo = encontrarGrupo(codificado); if (!grupo) return; abrirSheet("Reservas do filamento", grupo.reservas.length ? `<div class="mobileInventoryDetailsList">${grupo.reservas.map(reserva => { const lote = lista("listarLotesExecucao").find(item => chave(item.id) === chave(reserva.loteExecucaoId)); const ordem = lista("listarOrdensProducao").find(item => chave(item.id) === chave(lote?.ordemProducaoId)); return `<article><i data-lucide="bookmark"></i><div><strong>${peso(reserva.pesoReservadoGramas)}</strong><span>${esc(ordem?.produtoNome || lote?.produtoNome || "Produção reservada")}</span><small>${esc(lote?.status || "Reserva ativa")}</small></div></article>`; }).join("")}</div>` : `<div class="mobileInventoryDetailEmpty"><i data-lucide="bookmark-x"></i><p>Nenhuma reserva ativa neste filamento.</p></div>`); },
        uso(codificado) { const grupo = encontrarGrupo(codificado); if (!grupo) return; abrirSheet("Filamentos em uso", grupo.emUso.length ? `<div class="mobileInventoryDetailsList">${grupo.emUso.map(rolo => { const local = FilamentIntegration.localizacaoDoRolo(rolo.id); const impressora = lista("listarImpressoras").find(item => chave(item.id) === chave(local.impressoraId)); const lote = lista("listarLotesExecucao").find(item => chave(item.id) === chave(impressora?.operacaoAtualId) || chave(item.operacaoId) === chave(impressora?.operacaoAtualId)); return `<article><i data-lucide="printer"></i><div><strong>${esc(local.impressoraNome || impressora?.nome || "Impressora")}</strong><span>${local.tipo === "ams" ? `AMS · Slot ${local.slotAms}` : "Rolo externo"}</span><small>${esc(lote?.status || "Rolo carregado")} · ${peso(FilamentIntegration.pesoDisponivel(rolo.id))}</small></div></article>`; }).join("")}</div>` : `<div class="mobileInventoryDetailEmpty"><i data-lucide="printer-check"></i><p>Nenhum rolo está vinculado a uma impressora.</p></div>`); },
        menu(codificado) { const grupo = encontrarGrupo(codificado); if (!grupo) return; const primeiro = grupo.rolos[0]; abrirSheet(`${grupo.material} ${grupo.cor}`, `<div class="compactActionMenu"><button onclick="Modal.fechar();MobileInventory.detalhes('${codificado}')"><i data-lucide="eye"></i><span><strong>Abrir detalhes</strong><small>Rolos, saldos e localizações</small></span></button><button onclick="Modal.fechar();MobileInventory.adicionarIgual('${codificado}')"><i data-lucide="copy-plus"></i><span><strong>Adicionar rolo</strong><small>Cadastrar outro rolo igual</small></span></button><button onclick="Modal.fechar();MobileInventory.consumirGrupo('${codificado}')"><i data-lucide="package-minus"></i><span><strong>Registrar consumo</strong><small>Baixar peso manualmente</small></span></button><button onclick="Modal.fechar();abrirEditarRoloFilamento('${esc(primeiro.id)}')"><i data-lucide="pencil"></i><span><strong>Editar cadastro</strong><small>Material, preço e alertas</small></span></button><button onclick="Modal.fechar();abrirHistoricoRolo('${esc(primeiro.id)}')"><i data-lucide="history"></i><span><strong>Ver histórico</strong><small>Entradas, consumo e ajustes</small></span></button><button onclick="Modal.fechar();MobileInventory.favorito('${codificado}')"><i data-lucide="heart"></i><span><strong>${grupo.favorito ? "Remover favorito" : "Marcar como favorito"}</strong></span></button>${grupo.status.id !== "esgotado" ? `<button class="danger" onclick="Modal.fechar();MarkRollEmptyModal.abrir('${esc(primeiro.id)}')"><i data-lucide="circle-off"></i><span><strong>Marcar como esgotado</strong><small>Revisar saldo e reservas</small></span></button>` : ""}</div>`); }
    };

    window.MobileInventory = api;
    window.getMobileInventoryData = getMobileInventoryData;
    window.renderFilamentos = function () {
        if (!media.matches) return renderFilamentosDesktop();
        if (estado.secao === "produtos") return ProdutosMobile.render(false);
        return renderFilamentosMobile();
    };
})();
