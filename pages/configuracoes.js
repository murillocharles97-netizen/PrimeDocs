let backupPendente = null;

function renderConfiguracoes() {
    app.innerHTML = `
        <button class="back" onclick="navegar('home')">
            <i data-lucide="arrow-left"></i>
            Voltar
        </button>

        ${Page.titulo(
            "⚙️ Configurações",
            "Preferências, segurança e dados do PrimeDocs."
        )}

        <section class="backupCard">
            <div class="backupCardHeader">
                <div class="backupCardIcon">
                    <i data-lucide="database-backup"></i>
                </div>
                <div>
                    <span>SEGURANÇA DOS DADOS</span>
                    <h3>Backup</h3>
                    <p>Transfira todos os dados do PrimeDocs entre seus dispositivos.</p>
                </div>
            </div>

            <div class="backupInfo">
                <i data-lucide="shield-check"></i>
                <p>
                    O arquivo inclui produtos, lojas, estoques, consignados,
                    conferências, tema e configurações futuras.
                </p>
            </div>

            <div class="backupActions">
                <button class="backupActionButton backupExportButton" type="button" onclick="exportarDadosPrimeDocs()">
                    <span class="backupActionIcon">
                        <i data-lucide="upload"></i>
                    </span>
                    <span>
                        <strong>Exportar Dados</strong>
                        <small>Baixar backup em JSON</small>
                    </span>
                    <i data-lucide="download"></i>
                </button>

                <button class="backupActionButton" type="button" onclick="selecionarArquivoBackup()">
                    <span class="backupActionIcon">
                        <i data-lucide="file-down"></i>
                    </span>
                    <span>
                        <strong>Importar Dados</strong>
                        <small>Restaurar outro dispositivo</small>
                    </span>
                    <i data-lucide="chevron-right"></i>
                </button>
            </div>

            <input
                id="arquivoBackup"
                class="backupFileInput"
                type="file"
                accept=".json,application/json"
                onchange="lerArquivoBackup(this)">
        </section>
    `;

    lucide.createIcons();
}

function exportarDadosPrimeDocs() {
    try {
        const backup = Storage.exportarBackup();
        const conteudo = JSON.stringify(backup, null, 2);
        const arquivo = new Blob([conteudo], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(arquivo);
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
    const preencher = valor => String(valor).padStart(2, "0");
    const data = [
        agora.getFullYear(),
        preencher(agora.getMonth() + 1),
        preencher(agora.getDate())
    ].join("-");
    const hora = [
        preencher(agora.getHours()),
        preencher(agora.getMinutes())
    ].join("-");

    return `backup_primedocs_${data}_${hora}.json`;
}

function selecionarArquivoBackup() {
    const input = document.getElementById("arquivoBackup");

    if (!input) return;

    input.value = "";
    input.click();
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
        const conteudo = await arquivo.text();
        const backup = JSON.parse(conteudo);

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
    const dataBackup = formatarDataHoraBackup(backup.dataBackup);

    Modal.abrir(
        "Importar este backup?",
        `
            <div class="backupWarning">
                <div class="backupWarningIcon">
                    <i data-lucide="triangle-alert"></i>
                </div>
                <div>
                    <strong>Todos os dados atuais serão substituídos.</strong>
                    <p>Esta operação não pode ser desfeita sem um backup dos dados atuais.</p>
                </div>
            </div>

            <div class="backupMetadata">
                <div>
                    <span>Aplicativo</span>
                    <strong>${escaparHtmlConfiguracoes(backup.empresa)}</strong>
                </div>
                <div>
                    <span>Versão</span>
                    <strong>${escaparHtmlConfiguracoes(backup.versao)}</strong>
                </div>
                <div>
                    <span>Data do backup</span>
                    <strong>${escaparHtmlConfiguracoes(dataBackup)}</strong>
                </div>
            </div>

            <div class="backupModalActions">
                <button class="backupCancelButton" type="button" onclick="cancelarImportacaoBackup()">
                    Cancelar
                </button>
                <button class="btn" type="button" onclick="confirmarImportacaoBackup()">
                    Importar
                </button>
            </div>
        `
    );
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
        const importado = Storage.importarBackup(backupPendente);

        if (!importado) {
            Toast.show("Arquivo inválido.");
            return;
        }

        const configuracoes = Storage.carregarConfiguracoes();
        aplicarTemaPrimeDocs(configuracoes.tema || "light");
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

    return Number.isNaN(data.getTime())
        ? "Não informada"
        : data.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        });
}

function escaparHtmlConfiguracoes(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
