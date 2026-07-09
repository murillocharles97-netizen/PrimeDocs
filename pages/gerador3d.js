const GERADOR3D_PRESET_MOLDE_QUEBRA_CABECA = {
    largura: 120,
    altura: 120,
    larguraLinha: 1.2,
    alturaCortador: 12,
    raioCantos: 3,
    diametroEncaixe: 18,
    corteImaAtivo: true,
    diametroIma: 8.2,
    imaOffsetX: 0,
    imaOffsetY: 0
};

function renderGerador3D() {
    const config = carregarConfigMoldeQuebraCabeca3D();

    app.innerHTML = `
        <button class="back" onclick="navegar('home')"><i data-lucide="arrow-left"></i> Voltar</button>
        ${Page.titulo("🧩 Gerador 3D", "Molde de Quebra-Cabeça para usar como Negative Part no Bambu Studio.")}

        <section class="generatorHero">
            <div>
                <span>MOLDE DE QUEBRA-CABEÇA</span>
                <h2>Cortador STL único para logo/base no Bambu Studio</h2>
                <p>Gere somente os vãos do quebra-cabeça 2x2 e os cilindros dos ímãs em um único arquivo STL.</p>
            </div>
            <div class="generatorHeroIcon"><i data-lucide="scissors"></i></div>
        </section>

        <div class="generatorLayout">
            <section class="generatorPanel">
                <div class="generatorPanelHeader">
                    <div>
                        <span>PARÂMETROS</span>
                        <h3>Molde / Cortador</h3>
                    </div>
                    <button class="btnSecondary" type="button" onclick="resetarMoldeQuebraCabeca3D()">
                        <i data-lucide="rotate-ccw"></i> Resetar padrão
                    </button>
                </div>

                <div class="generatorFormGrid">
                    ${campoNumeroGerador3D("Largura total / X (mm)", "largura", config.largura, "1")}
                    ${campoNumeroGerador3D("Altura total / Y (mm)", "altura", config.altura, "1")}
                    ${campoNumeroGerador3D("Largura do corte (mm)", "larguraLinha", config.larguraLinha, "0.1")}
                    ${campoNumeroGerador3D("Altura do cortador (mm)", "alturaCortador", config.alturaCortador, "0.5")}
                    ${campoNumeroGerador3D("Raio dos cantos (mm)", "raioCantos", config.raioCantos, "0.1")}
                    ${campoNumeroGerador3D("Diâmetro do encaixe (mm)", "diametroEncaixe", config.diametroEncaixe, "0.1")}
                    <label class="inputGroup">
                        <span>Ativar ímãs</span>
                        <select id="gerador3d_corteImaAtivo" onchange="atualizarMoldeQuebraCabeca3D()">
                            <option value="true" ${config.corteImaAtivo ? "selected" : ""}>Sim</option>
                            <option value="false" ${!config.corteImaAtivo ? "selected" : ""}>Não</option>
                        </select>
                    </label>
                    ${campoNumeroGerador3D("Diâmetro do ímã (mm)", "diametroIma", config.diametroIma, "0.1")}
                    ${campoNumeroGerador3D("Posição X dos ímãs (mm)", "imaOffsetX", config.imaOffsetX, "0.5", true)}
                    ${campoNumeroGerador3D("Posição Y dos ímãs (mm)", "imaOffsetY", config.imaOffsetY, "0.5", true)}
                </div>

                <div class="primecadInfoBox">
                    <i data-lucide="info"></i>
                    <div>
                        <strong>Lógica do STL</strong>
                        <span>O molde representa o resultado de retângulo total arredondado menos as 4 peças montadas: ficam apenas as linhas/vãos internos, os encaixes circulares e, se ativado, os cilindros dos ímãs.</span>
                    </div>
                </div>

                <div class="generatorActionsGrid">
                    <button class="pdfButton generatorDownload generatorDownloadBambu" type="button" onclick="baixarMoldeSTLQuebraCabeca3D()">
                        <i data-lucide="download"></i> Baixar Molde STL
                    </button>
                </div>
            </section>

            <section class="generatorPreviewCard">
                <div class="generatorPanelHeader">
                    <div>
                        <span>PRÉVIA</span>
                        <h3>Linhas de corte e ímãs</h3>
                    </div>
                    <small id="gerador3d_statusPreview">2x2</small>
                </div>
                <div id="previewQuebraCabeca3D" class="generatorPreviewStage"></div>
                <div class="generatorTips">
                    <div><i data-lucide="minus"></i><span>O STL exportado não contém peças cheias.</span></div>
                    <div><i data-lucide="circle-dot"></i><span>Os círculos ciano indicam os cortes dos ímãs.</span></div>
                    <div><i data-lucide="box"></i><span>Use o arquivo como Negative Part no Bambu Studio.</span></div>
                </div>
            </section>
        </div>
    `;

    document.querySelectorAll("[id^='gerador3d_']").forEach(campo => {
        campo.addEventListener("input", atualizarMoldeQuebraCabeca3D);
    });

    renderPreviewMoldeQuebraCabeca3D();
    lucide.createIcons();
}

function campoNumeroGerador3D(label, chave, valor, step, permiteNegativo = false) {
    return `
        <label class="inputGroup">
            <span>${label}</span>
            <input id="gerador3d_${chave}" type="number" ${permiteNegativo ? "" : "min='0'"} step="${step}" value="${escaparGerador3D(valor)}">
        </label>
    `;
}

function carregarConfigMoldeQuebraCabeca3D() {
    const salvo = Storage.carregarConfigGerador3D
        ? Storage.carregarConfigGerador3D()
        : JSON.parse(localStorage.getItem("primedocs_gerador_3d")) || {};

    return {
        ...GERADOR3D_PRESET_MOLDE_QUEBRA_CABECA,
        ...salvo,
        linhas: 2,
        colunas: 2,
        centralizarOrigem: true,
        posX: 0,
        posY: 0
    };
}

function salvarConfigMoldeQuebraCabeca3D(config) {
    const dados = {
        ...config,
        linhas: 2,
        colunas: 2,
        centralizarOrigem: true,
        posX: 0,
        posY: 0
    };

    if (Storage.salvarConfigGerador3D) {
        Storage.salvarConfigGerador3D(dados);
        return;
    }

    localStorage.setItem("primedocs_gerador_3d", JSON.stringify({
        ...carregarConfigMoldeQuebraCabeca3D(),
        ...dados
    }));
}

function lerConfigFormularioMoldeQuebraCabeca3D() {
    const atual = carregarConfigMoldeQuebraCabeca3D();
    const numero = (chave, fallback) => {
        const campo = document.getElementById(`gerador3d_${chave}`);
        const valor = Number(campo?.value);
        return Number.isFinite(valor) ? valor : fallback;
    };

    return {
        largura: Math.max(20, numero("largura", atual.largura)),
        altura: Math.max(20, numero("altura", atual.altura)),
        larguraLinha: Math.max(0.1, numero("larguraLinha", atual.larguraLinha)),
        alturaCortador: Math.max(1, numero("alturaCortador", atual.alturaCortador)),
        raioCantos: Math.max(0, numero("raioCantos", atual.raioCantos)),
        diametroEncaixe: Math.max(2, numero("diametroEncaixe", atual.diametroEncaixe)),
        corteImaAtivo: document.getElementById("gerador3d_corteImaAtivo")?.value !== "false",
        diametroIma: Math.max(1, numero("diametroIma", atual.diametroIma)),
        imaOffsetX: numero("imaOffsetX", atual.imaOffsetX),
        imaOffsetY: numero("imaOffsetY", atual.imaOffsetY),
        linhas: 2,
        colunas: 2,
        centralizarOrigem: true,
        posX: 0,
        posY: 0
    };
}

function atualizarMoldeQuebraCabeca3D() {
    const config = lerConfigFormularioMoldeQuebraCabeca3D();
    salvarConfigMoldeQuebraCabeca3D(config);
    renderPreviewMoldeQuebraCabeca3D();
}

function resetarMoldeQuebraCabeca3D() {
    salvarConfigMoldeQuebraCabeca3D(GERADOR3D_PRESET_MOLDE_QUEBRA_CABECA);
    renderGerador3D();
    Toast.show("Padrão restaurado.");
}

function renderPreviewMoldeQuebraCabeca3D() {
    const el = document.getElementById("previewQuebraCabeca3D");
    if (!el) return;

    const config = lerConfigFormularioMoldeQuebraCabeca3D();
    const w = config.largura;
    const h = config.altura;
    const linha = config.larguraLinha;
    const raioEncaixe = config.diametroEncaixe / 2 + linha / 2;
    const margem = Math.max(18, raioEncaixe + 8);
    const encaixes = [
        [0, h / 4],
        [0, -h / 4],
        [-w / 4, 0],
        [w / 4, 0]
    ];
    const imas = calcularPosicoesImaMoldePreview(config);

    el.innerHTML = `
        <svg class="generatorPuzzleSvg" viewBox="${-w / 2 - margem} ${-h / 2 - margem} ${w + margem * 2} ${h + margem * 2}" role="img" aria-label="Prévia do molde de quebra-cabeça">
            <defs>
                <filter id="moldeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#6D5DFD" flood-opacity=".18"/>
                </filter>
            </defs>
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${config.raioCantos}" fill="rgba(109,93,253,.05)" stroke="rgba(109,93,253,.35)" stroke-width="1"/>
            <g filter="url(#moldeShadow)">
                <rect x="${-linha / 2}" y="${-h / 2}" width="${linha}" height="${h}" rx="${linha / 2}" fill="#6D5DFD" opacity=".9"/>
                <rect x="${-w / 2}" y="${-linha / 2}" width="${w}" height="${linha}" rx="${linha / 2}" fill="#6D5DFD" opacity=".9"/>
                ${encaixes.map(([x, y]) => `<circle cx="${x}" cy="${-y}" r="${raioEncaixe}" fill="#8B5CF6" opacity=".75"/>`).join("")}
                ${config.corteImaAtivo ? imas.map(([x, y], index) => `
                    <circle cx="${x}" cy="${-y}" r="${config.diametroIma / 2}" fill="#22D3EE" opacity=".92"/>
                    <text x="${x}" y="${-y + 1.7}" text-anchor="middle" font-size="4" fill="#07111f">${index + 1}</text>
                `).join("") : ""}
            </g>
            <line x1="0" y1="${-h / 2}" x2="0" y2="${h / 2}" stroke="rgba(17,24,39,.2)" stroke-dasharray="2 3" stroke-width=".35"/>
            <line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="rgba(17,24,39,.2)" stroke-dasharray="2 3" stroke-width=".35"/>
        </svg>
    `;

    const status = document.getElementById("gerador3d_statusPreview");
    if (status) status.textContent = `${w} × ${h} mm`;
}

function calcularPosicoesImaMoldePreview(config) {
    return [
        [-config.largura / 4 + config.imaOffsetX, config.altura / 4 + config.imaOffsetY],
        [config.largura / 4 + config.imaOffsetX, config.altura / 4 + config.imaOffsetY],
        [-config.largura / 4 + config.imaOffsetX, -config.altura / 4 + config.imaOffsetY],
        [config.largura / 4 + config.imaOffsetX, -config.altura / 4 + config.imaOffsetY]
    ];
}

function gerarMoldePrimeCAD() {
    const config = lerConfigFormularioMoldeQuebraCabeca3D();
    salvarConfigMoldeQuebraCabeca3D(config);
    const motor = window.PrimeCADPuzzleGenerator || PrimeCADPuzzleGenerator;
    return motor.gerarMoldeBambu(config);
}

function baixarMoldeSTLQuebraCabeca3D() {
    try {
        const resultado = gerarMoldePrimeCAD();
        baixarBlobGerador3D(new Blob([resultado.stl], { type: "model/stl" }), "molde_quebra_cabeca.stl");
        Toast.show("Molde STL gerado!");
    } catch (erro) {
        console.error(erro);
        Toast.show("Não foi possível gerar o molde.");
    }
}

function baixarBlobGerador3D(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
}

function escaparGerador3D(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
