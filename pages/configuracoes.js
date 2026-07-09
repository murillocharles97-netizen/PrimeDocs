let backupPendente = null;
let empresaEditandoId = null;
let logoEmpresaPendente = "";

function renderConfiguracoes() {
    const empresas = Storage.listarEmpresas();
    const empresaPadrao = Storage.buscarEmpresaPadrao();
    const temaEscuro = document.body.classList.contains("dark-mode");

    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i> Voltar
        </button>

        ${Page.titulo("⚙️ Configurações", "Empresas, aparência, documentos e segurança.")}

        <div class="settingsLayout">
            <section class="settingsCard settingsCompanies">
                <div class="settingsCardHeader">
                    <div class="settingsCardIcon"><i data-lucide="building-2"></i></div>
                    <div>
                        <span>IDENTIDADE</span>
                        <h3>Empresas</h3>
                        <p>Cadastre as marcas usadas nos orçamentos e PDFs.</p>
                    </div>
                    <button class="btn settingsHeaderAction" type="button" onclick="abrirModalEmpresa()">
                        <i data-lucide="plus"></i> Nova empresa
                    </button>
                </div>
                <div class="companiesList">
                    ${renderListaEmpresasConfiguracoes(empresas)}
                </div>
            </section>

            <section class="settingsCard">
                <div class="settingsCardHeader">
                    <div class="settingsCardIcon"><i data-lucide="palette"></i></div>
                    <div>
                        <span>INTERFACE</span>
                        <h3>Aparência</h3>
                        <p>Escolha o tema mais confortável para trabalhar.</p>
                    </div>
                </div>
                <div class="themeSettingRow">
                    <div class="themeSettingPreview ${temaEscuro ? "isDark" : ""}">
                        <i data-lucide="${temaEscuro ? "moon" : "sun"}"></i>
                    </div>
                    <div>
                        <strong>${temaEscuro ? "Tema escuro" : "Tema claro"}</strong>
                        <small>A preferência fica salva neste dispositivo.</small>
                    </div>
                    <button class="btnSecondary" type="button" onclick="alternarTemaConfiguracoes()">
                        Alternar tema
                    </button>
                </div>
            </section>

            <section class="settingsCard">
                <div class="settingsCardHeader">
                    <div class="settingsCardIcon"><i data-lucide="file-text"></i></div>
                    <div>
                        <span>DOCUMENTOS</span>
                        <h3>PDFs</h3>
                        <p>Identidade padrão aplicada automaticamente aos documentos.</p>
                    </div>
                </div>
                ${renderResumoPDFConfiguracoes(empresaPadrao)}
            </section>

            ${renderCardDashboardConfiguracoes()}
            ${renderCardCustosConfiguracoes()}
            ${renderCardBackupConfiguracoes()}
        </div>
    `;

    lucide.createIcons();
}

function renderListaEmpresasConfiguracoes(empresas) {
    if (!empresas.length) {
        return `
            <div class="settingsEmptyState">
                <i data-lucide="building"></i>
                <strong>Nenhuma empresa cadastrada</strong>
                <p>Enquanto isso, os PDFs continuam usando a identidade padrão do PrimeDocs.</p>
            </div>
        `;
    }

    return empresas.map(empresa => `
        <article class="companyCard ${empresa.ativa === false ? "isInactive" : ""}">
            <div class="companyLogo" style="--company-color:${escaparHtmlConfiguracoes(empresa.corPrincipal || "#6D5DFD")}">
                ${empresa.logo
                    ? `<img src="${empresa.logo}" alt="Logo de ${escaparHtmlConfiguracoes(empresa.nome)}">`
                    : `<i data-lucide="${iconeTipoEmpresa(empresa.tipo)}"></i>`}
            </div>
            <div class="companyMain">
                <div class="companyTitleRow">
                    <h4>${escaparHtmlConfiguracoes(empresa.nome)}</h4>
                    ${empresa.padrao && empresa.ativa !== false ? `<span class="companyDefaultBadge"><i data-lucide="star"></i> Padrão</span>` : ""}
                    ${empresa.ativa === false ? `<span class="companyInactiveBadge">Inativa</span>` : ""}
                </div>
                <span class="companyTypeBadge">${rotuloTipoEmpresa(empresa.tipo)}</span>
                <p>${escaparHtmlConfiguracoes(empresa.whatsapp || empresa.instagram || "Contatos não informados")}</p>
            </div>
            <div class="companyActions">
                ${empresa.ativa !== false && !empresa.padrao
                    ? `<button type="button" onclick="definirEmpresaPadraoConfiguracoes('${empresa.id}')"><i data-lucide="star"></i><span>Definir padrão</span></button>`
                    : ""}
                <button type="button" onclick="abrirModalEmpresa('${empresa.id}')"><i data-lucide="pencil"></i><span>Editar</span></button>
                ${empresa.ativa !== false
                    ? `<button class="danger" type="button" onclick="confirmarInativacaoEmpresa('${empresa.id}')"><i data-lucide="archive"></i><span>Inativar</span></button>`
                    : ""}
            </div>
        </article>
    `).join("");
}

function renderResumoPDFConfiguracoes(empresa) {
    if (!empresa) {
        return `<div class="pdfIdentityEmpty"><i data-lucide="info"></i><span>Fallback ativo: PrimeDocs / PrimeLine 3D.</span></div>`;
    }

    return `
        <div class="pdfIdentitySummary">
            <span class="pdfColorSwatch" style="background:${escaparHtmlConfiguracoes(empresa.corPrincipal || "#6D5DFD")}"></span>
            <div><small>Empresa padrão</small><strong>${escaparHtmlConfiguracoes(empresa.nome)}</strong></div>
            <div><small>Cor principal</small><strong>${escaparHtmlConfiguracoes(empresa.corPrincipal || "#6D5DFD")}</strong></div>
            <div class="pdfFooterSetting"><small>Rodapé</small><strong>${escaparHtmlConfiguracoes(empresa.rodapePDF || "Documento gerado pelo PrimeDocs")}</strong></div>
        </div>
    `;
}

function abrirModalEmpresa(id = null) {
    const empresa = id ? Storage.buscarEmpresaPorId(id) : null;
    empresaEditandoId = empresa?.id || null;
    logoEmpresaPendente = empresa?.logo || "";

    Modal.abrir(
        empresa ? "Editar empresa" : "Nova empresa",
        `
            <div class="companyFormGrid">
                ${Input.text("Nome *", "empresaNome", "Ex.: PrimeLine 3D", escaparHtmlConfiguracoes(empresa?.nome || ""))}
                <label class="inputGroup">
                    <span>Tipo *</span>
                    <select id="empresaTipo">
                        ${["impressao3d", "transporte", "geral"].map(tipo => `
                            <option value="${tipo}" ${empresa?.tipo === tipo ? "selected" : ""}>${rotuloTipoEmpresa(tipo)}</option>
                        `).join("")}
                    </select>
                </label>
                ${Input.text("WhatsApp", "empresaWhatsapp", "(00) 00000-0000", escaparHtmlConfiguracoes(empresa?.whatsapp || ""))}
                ${Input.text("Instagram", "empresaInstagram", "@empresa", escaparHtmlConfiguracoes(empresa?.instagram || ""))}
                ${Input.text("CNPJ", "empresaCnpj", "00.000.000/0000-00", escaparHtmlConfiguracoes(empresa?.cnpj || ""))}
                ${Input.text("Endereço", "empresaEndereco", "Endereço completo", escaparHtmlConfiguracoes(empresa?.endereco || ""))}
                <label class="inputGroup companyColorField">
                    <span>Cor principal</span>
                    <div class="companyColorControl">
                        <input type="color" id="empresaCorPrincipal" value="${empresa?.corPrincipal || "#6D5DFD"}">
                        <output id="empresaCorValor">${empresa?.corPrincipal || "#6D5DFD"}</output>
                    </div>
                </label>
                <label class="inputGroup companyLogoField">
                    <span>Logo</span>
                    <div class="companyLogoUpload">
                        <div id="empresaLogoPreview" class="companyLogoPreview">${renderPreviewLogoEmpresa()}</div>
                        <button class="btnSecondary" type="button" onclick="document.getElementById('empresaLogoArquivo').click()">Escolher imagem</button>
                        ${logoEmpresaPendente ? `<button class="companyRemoveLogo" type="button" onclick="removerLogoEmpresa()">Remover</button>` : ""}
                    </div>
                    <input class="backupFileInput" id="empresaLogoArquivo" type="file" accept="image/png,image/jpeg,image/webp" onchange="carregarLogoEmpresa(this)">
                </label>
                <label class="inputGroup companyFullField">
                    <span>Texto de rodapé do PDF</span>
                    <textarea id="empresaRodapePDF" rows="3" placeholder="Ex.: Obrigado pela preferência!">${escaparHtmlConfiguracoes(empresa?.rodapePDF || "")}</textarea>
                </label>
                <label class="companyCheckbox"><input id="empresaAtiva" type="checkbox" ${empresa?.ativa === false ? "" : "checked"}> Empresa ativa</label>
                <label class="companyCheckbox"><input id="empresaPadrao" type="checkbox" ${empresa?.padrao ? "checked" : ""}> Usar como empresa padrão</label>
            </div>
            <div class="modalActions companyModalActions">
                <button class="btnSecondary" type="button" onclick="Modal.fechar()">Cancelar</button>
                <button class="btn" type="button" onclick="salvarEmpresaConfiguracoes()">Salvar empresa</button>
            </div>
        `
    );

    document.getElementById("empresaCorPrincipal")?.addEventListener("input", evento => {
        document.getElementById("empresaCorValor").textContent = evento.target.value.toUpperCase();
    });
    lucide.createIcons();
}

function salvarEmpresaConfiguracoes() {
    const nome = document.getElementById("empresaNome")?.value.trim();
    const tipo = document.getElementById("empresaTipo")?.value;

    if (!nome || !["impressao3d", "transporte", "geral"].includes(tipo)) {
        Toast.show("Informe o nome e o tipo da empresa.");
        return;
    }

    const anterior = empresaEditandoId ? Storage.buscarEmpresaPorId(empresaEditandoId) : null;
    Storage.salvarEmpresa({
        id: anterior?.id || (crypto.randomUUID?.() || `empresa-${Date.now()}`),
        nome,
        tipo,
        logo: logoEmpresaPendente,
        corPrincipal: document.getElementById("empresaCorPrincipal")?.value || "#6D5DFD",
        whatsapp: document.getElementById("empresaWhatsapp")?.value.trim() || "",
        instagram: document.getElementById("empresaInstagram")?.value.trim() || "",
        endereco: document.getElementById("empresaEndereco")?.value.trim() || "",
        cnpj: document.getElementById("empresaCnpj")?.value.trim() || "",
        rodapePDF: document.getElementById("empresaRodapePDF")?.value.trim() || "",
        ativa: Boolean(document.getElementById("empresaAtiva")?.checked),
        padrao: Boolean(document.getElementById("empresaPadrao")?.checked),
        criadoEm: anterior?.criadoEm || new Date().toISOString()
    });

    Modal.fechar();
    renderConfiguracoes();
    Toast.show(anterior ? "Empresa atualizada!" : "Empresa cadastrada!");
}

function carregarLogoEmpresa(input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    const formatosPermitidos = ["image/png", "image/jpeg", "image/webp"];
    if (!formatosPermitidos.includes(arquivo.type) || arquivo.size > 1500000) {
        Toast.show("Use uma imagem de até 1,5 MB.");
        input.value = "";
        return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
        logoEmpresaPendente = leitor.result;
        const preview = document.getElementById("empresaLogoPreview");
        if (preview) preview.innerHTML = renderPreviewLogoEmpresa();
    };
    leitor.onerror = () => Toast.show("Não foi possível carregar a imagem.");
    leitor.readAsDataURL(arquivo);
}

function removerLogoEmpresa() {
    logoEmpresaPendente = "";
    const preview = document.getElementById("empresaLogoPreview");
    if (preview) preview.innerHTML = renderPreviewLogoEmpresa();
}

function renderPreviewLogoEmpresa() {
    return logoEmpresaPendente
        ? `<img src="${logoEmpresaPendente}" alt="Prévia do logo">`
        : `<i data-lucide="image"></i>`;
}

function definirEmpresaPadraoConfiguracoes(id) {
    if (Storage.definirEmpresaPadrao(id)) {
        renderConfiguracoes();
        Toast.show("Empresa padrão atualizada!");
    }
}

function confirmarInativacaoEmpresa(id) {
    const empresa = Storage.buscarEmpresaPorId(id);
    if (!empresa) return;
    Modal.abrir("Inativar empresa?", `
        <div class="settingsConfirmText">
            <p><strong>${escaparHtmlConfiguracoes(empresa.nome)}</strong> deixará de aparecer nas novas seleções.</p>
            <p>O cadastro será preservado para não afetar documentos e históricos.</p>
        </div>
        <div class="modalActions">
            <button class="btnSecondary" type="button" onclick="Modal.fechar()">Cancelar</button>
            <button class="btn" type="button" onclick="inativarEmpresaConfiguracoes('${empresa.id}')">Inativar</button>
        </div>
    `);
}

function inativarEmpresaConfiguracoes(id) {
    Storage.excluirEmpresa(id);
    Modal.fechar();
    renderConfiguracoes();
    Toast.show("Empresa inativada.");
}

function alternarTemaConfiguracoes() {
    alternarTemaPrimeDocs();
    renderConfiguracoes();
}

function rotuloTipoEmpresa(tipo) {
    return ({ impressao3d: "Impressão 3D", transporte: "Transporte", geral: "Geral" })[tipo] || "Geral";
}

function iconeTipoEmpresa(tipo) {
    return ({ impressao3d: "box", transporte: "car", geral: "building-2" })[tipo] || "building-2";
}

function renderCardCustosConfiguracoes() {
    const config = Storage.carregarConfigCustos();
    const campos = [
        ["Preço padrão do kg", "custoPrecoKg", config.precoKgFilamentoPadrao],
        ["Energia por hora", "custoEnergiaHora", config.custoEnergiaHora],
        ["Depreciação por hora", "custoDepreciacaoHora", config.custoDepreciacaoHora],
        ["Mão de obra por hora", "custoMaoDeObraHora", config.valorMaoDeObraHora],
        ["Margem padrão (%)", "custoMargemPadrao", config.margemLucroPadrao],
        ["Embalagem padrão", "custoEmbalagemPadrao", config.custoEmbalagemPadrao],
        ["Taxa / imposto (%)", "custoTaxaImposto", config.taxaImpostoPercentual],
        ["Falha / perda (%)", "custoPerda", config.perdaPercentual]
    ];

    return `
        <section class="settingsCard settingsCostsCard">
            <div class="settingsCardHeader">
                <div class="settingsCardIcon"><i data-lucide="calculator"></i></div>
                <div><span>PRODUÇÃO 3D</span><h3>Custos e Precificação</h3><p>Parâmetros padrão usados pela calculadora.</p></div>
            </div>
            <div class="costSettingsGrid">
                ${campos.map(([label, id, valor]) => `<label class="inputGroup"><span>${label}</span><input id="${id}" type="number" min="0" step="0.01" value="${Number(valor || 0)}"></label>`).join("")}
            </div>
            <label class="companyCheckbox costLaborToggle"><input id="custoCobrarMaoDeObra" type="checkbox" ${config.cobrarMaoDeObraPorPadrao ? "checked" : ""}> Cobrar mão de obra por padrão</label>
            <button class="btn settingsCostSave" type="button" onclick="salvarConfiguracoesCustos()"><i data-lucide="save"></i> Salvar parâmetros</button>
        </section>`;
}

function renderCardDashboardConfiguracoes() {
    const modulos = ["Financeiro", "Produção", "Consignado", "Filamentos", "Clientes", "Timeline"];
    return `<section class="settingsCard settingsDashboardCard"><div class="settingsCardHeader"><div class="settingsCardIcon"><i data-lucide="layout-dashboard"></i></div><div><span>EXPERIÊNCIA</span><h3>Dashboard</h3><p>Estrutura preparada para personalização futura.</p></div></div><div class="dashboardModuleOptions">${modulos.map(modulo=>`<label><input type="checkbox" checked disabled><span>${modulo}</span><small>Visível</small></label>`).join("")}</div><div class="settingsPreparedNotice"><i data-lucide="sparkles"></i><span>Em breve você poderá ocultar, ordenar e personalizar estes módulos.</span></div></section>`;
}

function salvarConfiguracoesCustos() {
    const numero = id => Math.max(0, Number(document.getElementById(id)?.value) || 0);
    Storage.salvarConfigCustos({
        precoKgFilamentoPadrao: numero("custoPrecoKg"),
        custoEnergiaHora: numero("custoEnergiaHora"),
        custoDepreciacaoHora: numero("custoDepreciacaoHora"),
        valorMaoDeObraHora: numero("custoMaoDeObraHora"),
        margemLucroPadrao: numero("custoMargemPadrao"),
        custoEmbalagemPadrao: numero("custoEmbalagemPadrao"),
        taxaImpostoPercentual: numero("custoTaxaImposto"),
        perdaPercentual: numero("custoPerda"),
        cobrarMaoDeObraPorPadrao: Boolean(document.getElementById("custoCobrarMaoDeObra")?.checked)
    });
    Toast.show("Parâmetros de custo salvos!");
}

function renderCardBackupConfiguracoes() {
    return `
        <section class="backupCard settingsBackupCard">
            <div class="backupCardHeader">
                <div class="backupCardIcon"><i data-lucide="database-backup"></i></div>
                <div><span>SEGURANÇA DOS DADOS</span><h3>Backup e Sincronização</h3><p>Transfira todos os dados do PrimeDocs entre seus dispositivos.</p></div>
            </div>
            <div class="backupInfo"><i data-lucide="shield-check"></i><p>O arquivo inclui empresas, clientes, pedidos, financeiro, notificações, filamentos, produtos, lojas, estoques, históricos, tema e configurações.</p></div>
            <div class="backupActions">
                <button class="backupActionButton backupExportButton" type="button" onclick="exportarDadosPrimeDocs()"><span class="backupActionIcon"><i data-lucide="upload"></i></span><span><strong>Exportar Dados</strong><small>Baixar backup em JSON</small></span><i data-lucide="download"></i></button>
                <button class="backupActionButton" type="button" onclick="selecionarArquivoBackup()"><span class="backupActionIcon"><i data-lucide="file-down"></i></span><span><strong>Importar Dados</strong><small>Restaurar outro dispositivo</small></span><i data-lucide="chevron-right"></i></button>
                <button class="backupActionButton" type="button" onclick="sincronizarNuvemAgoraConfiguracoes()"><span class="backupActionIcon"><i data-lucide="refresh-cw"></i></span><span><strong>Sincronizar agora</strong><small>Escolher melhor fonte</small></span><i data-lucide="cloud"></i></button>
                <button class="backupActionButton" type="button" onclick="confirmarEnviarLocalNuvemConfiguracoes()"><span class="backupActionIcon"><i data-lucide="cloud-upload"></i></span><span><strong>Enviar local para nuvem</strong><small>Substitui a nuvem por este dispositivo</small></span><i data-lucide="arrow-up"></i></button>
                <button class="backupActionButton" type="button" onclick="confirmarBaixarNuvemConfiguracoes()"><span class="backupActionIcon"><i data-lucide="cloud-download"></i></span><span><strong>Baixar dados da nuvem</strong><small>Atualiza este dispositivo</small></span><i data-lucide="arrow-down"></i></button>
                <button class="backupActionButton" type="button" onclick="diagnosticoNuvemConfiguracoes()"><span class="backupActionIcon"><i data-lucide="bug"></i></span><span><strong>Diagnóstico da nuvem</strong><small>Testar login, workspace e permissões</small></span><i data-lucide="terminal"></i></button>
            </div>
            <input id="arquivoBackup" class="backupFileInput" type="file" accept=".json,application/json" onchange="lerArquivoBackup(this)">
        </section>
    `;
}

function exportarDadosPrimeDocs() {
    try {
        const conteudo = JSON.stringify(Storage.exportarBackup(), null, 2);
        const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = criarNomeArquivoBackup();
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Toast.show("Backup exportado com sucesso!");
    } catch (erro) {
        console.error("Erro ao exportar backup.", erro);
        Toast.show("Não foi possível exportar o backup.");
    }
}

function criarNomeArquivoBackup() {
    const agora = new Date();
    const dois = valor => String(valor).padStart(2, "0");
    return `backup_primedocs_${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}_${dois(agora.getHours())}-${dois(agora.getMinutes())}.json`;
}

function selecionarArquivoBackup() {
    const input = document.getElementById("arquivoBackup");
    if (!input) return;
    input.value = "";
    input.click();
}

async function sincronizarNuvemAgoraConfiguracoes() {
    if (!window.PrimeSync) {
        Toast.show("Sincronização online indisponível.");
        return;
    }

    Toast.show("Verificando dados locais e da nuvem...");
    await PrimeSync.sincronizarComResolucaoManual();
}

function confirmarEnviarLocalNuvemConfiguracoes() {
    Modal.abrir("Enviar dados locais para a nuvem?", `
        <div class="backupWarning">
            <div class="backupWarningIcon"><i data-lucide="cloud-upload"></i></div>
            <div>
                <strong>Os dados deste dispositivo serão enviados para o Firestore.</strong>
                <p>Use esta opção no celular ou computador que possui os dados mais completos.</p>
            </div>
        </div>
        <div class="backupModalActions">
            <button class="backupCancelButton" type="button" onclick="Modal.fechar()">Cancelar</button>
            <button class="btn" type="button" onclick="enviarLocalNuvemConfiguracoes()">Enviar para nuvem</button>
        </div>
    `);
    lucide.createIcons();
}

async function enviarLocalNuvemConfiguracoes() {
    if (!window.PrimeSync) {
        Toast.show("Sincronização online indisponível.");
        return;
    }

    Modal.fechar();
    Toast.show("Enviando dados para a nuvem...");
    await PrimeSync.enviarLocalParaNuvem();
}

function confirmarBaixarNuvemConfiguracoes() {
    Modal.abrir("Baixar dados da nuvem?", `
        <div class="backupWarning">
            <div class="backupWarningIcon"><i data-lucide="cloud-download"></i></div>
            <div>
                <strong>Os dados da nuvem serão aplicados neste dispositivo.</strong>
                <p>Os dados locais serão mantidos apenas se também existirem na nuvem. Exporte um backup antes se quiser guardar uma cópia.</p>
            </div>
        </div>
        <div class="backupModalActions">
            <button class="backupCancelButton" type="button" onclick="Modal.fechar()">Cancelar</button>
            <button class="btn" type="button" onclick="baixarNuvemConfiguracoes()">Baixar da nuvem</button>
        </div>
    `);
    lucide.createIcons();
}

async function baixarNuvemConfiguracoes() {
    if (!window.PrimeSync) {
        Toast.show("Sincronização online indisponível.");
        return;
    }

    Modal.fechar();
    Toast.show("Baixando dados da nuvem...");
    const ok = await PrimeSync.baixarNuvemParaLocal();
    if (ok) renderConfiguracoes();
}

async function diagnosticoNuvemConfiguracoes() {
    const sync = window.Sync || window.PrimeSync;
    if (!sync?.diagnostico) {
        Toast.show("Diagnóstico online indisponível.");
        return;
    }

    Toast.show("Rodando diagnóstico da nuvem...");
    await sync.diagnostico();
}

async function lerArquivoBackup(input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    if (!arquivo.name.toLocaleLowerCase("pt-BR").endsWith(".json")) {
        Toast.show("Arquivo inválido.");
        input.value = "";
        return;
    }
    try {
        const backup = JSON.parse(await arquivo.text());
        if (!Storage.validarBackup(backup)) {
            Toast.show("Arquivo inválido.");
            return;
        }
        backupPendente = backup;
        abrirConfirmacaoImportacaoBackup(backup);
    } catch (erro) {
        Toast.show("Arquivo inválido.");
    } finally {
        input.value = "";
    }
}

function abrirConfirmacaoImportacaoBackup(backup) {
    Modal.abrir("Importar este backup?", `
        <div class="backupWarning"><div class="backupWarningIcon"><i data-lucide="triangle-alert"></i></div><div><strong>Todos os dados atuais serão substituídos.</strong><p>Faça uma exportação antes caso queira preservar os dados atuais.</p></div></div>
        <div class="backupMetadata"><div><span>Aplicativo</span><strong>${escaparHtmlConfiguracoes(backup.empresa)}</strong></div><div><span>Versão</span><strong>${escaparHtmlConfiguracoes(backup.versao)}</strong></div><div><span>Data</span><strong>${escaparHtmlConfiguracoes(formatarDataHoraBackup(backup.dataBackup))}</strong></div></div>
        <div class="backupModalActions"><button class="backupCancelButton" type="button" onclick="cancelarImportacaoBackup()">Cancelar</button><button class="btn" type="button" onclick="confirmarImportacaoBackup()">Importar</button></div>
    `);
    lucide.createIcons();
}

function cancelarImportacaoBackup() {
    backupPendente = null;
    Modal.fechar();
}

function confirmarImportacaoBackup() {
    if (!backupPendente || !Storage.validarBackup(backupPendente)) {
        backupPendente = null;
        Modal.fechar();
        Toast.show("Arquivo inválido.");
        return;
    }
    try {
        if (!Storage.importarBackup(backupPendente)) {
            Toast.show("Arquivo inválido.");
            return;
        }
        const configuracoes = Storage.carregarConfiguracoes();
        aplicarTemaPrimeDocs(configuracoes.tema || localStorage.getItem(Storage.KEYS.tema) || "light");
        backupPendente = null;
        Modal.fechar();
        navegar("home");
        Toast.show("Backup restaurado!");
    } catch (erro) {
        console.error("Erro ao restaurar backup.", erro);
        Toast.show("Não foi possível restaurar o backup.");
    }
}

function formatarDataHoraBackup(valor) {
    if (!valor) return "Não informada";
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? "Não informada" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function escaparHtmlConfiguracoes(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
