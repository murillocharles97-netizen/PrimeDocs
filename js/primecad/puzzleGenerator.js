const PrimeCADPuzzleGenerator = (() => {
    const EPS = 1e-7;

    function gerarPacoteBambu(config) {
        const cfg = normalizarConfig(config);
        const pecas = [1, 2, 3, 4];
        const gruposLogo = extrairPoligonosSvgPorCor(cfg.logoSvg, cfg).slice(0, 4);
        const arquivos = {};

        pecas.forEach(peca => {
            const poligono = gerarPoligonoPeca(peca, cfg);
            const malhaBase = criarMalhaBase(poligono, peca, cfg);
            arquivos[`peca${peca}_base.stl`] = exportarSTL(`peca${peca}_base`, malhaBase);
        });

        pecas.forEach(peca => {
            const mascara = gerarMascaraLogoPeca(peca, cfg);

            gruposLogo.forEach((grupo, indice) => {
                const cor = indice + 1;
                const malhas = [];

                grupo.poligonos.forEach(poligono => {
                    const cortado = clipPoligonoConvexo(poligono, mascara);
                    if (cortado.length >= 3 && Math.abs(areaPoligono(cortado)) > 0.05) {
                        malhas.push(...extrudarPoligono(cortado, cfg.espessura, cfg.espessura + cfg.alturaLogo));
                    }
                });

                if (malhas.length) {
                    arquivos[`peca${peca}_logo_cor${cor}.stl`] = exportarSTL(`peca${peca}_logo_cor${cor}`, malhas);
                }
            });
        });

        arquivos["README_BAMBU.txt"] = gerarReadmeBambu(cfg, gruposLogo, arquivos);
        return { arquivos, gruposLogo };
    }

    function gerarKitBambu(config) {
        const cfg = normalizarConfig(config);
        const arquivos = {};

        [1, 2, 3, 4].forEach(peca => {
            const poligono = gerarPoligonoPeca(peca, cfg);
            const malhaBase = criarMalhaBase(poligono, peca, cfg);
            const numero = String(peca).padStart(2, "0");
            arquivos[`peca_${numero}.stl`] = exportarSTL(`peca_${numero}`, malhaBase);
        });

        [1, 2, 3, 4].forEach(peca => {
            const poligono = gerarPoligonoPeca(peca, cfg);
            const poligonoMascara = cfg.folgaMascara > 0
                ? expandirPoligonoPorCentroide(poligono, cfg.folgaMascara)
                : poligono;
            const z0 = Math.max(0, cfg.espessura - 0.2);
            const z1 = z0 + cfg.alturaMascara;
            const malhaMascara = extrudarPoligono(poligonoMascara, z0, z1);
            const numero = String(peca).padStart(2, "0");
            arquivos[`mascara_${numero}.stl`] = exportarSTL(`mascara_${numero}`, malhaMascara);
        });

        arquivos["README_BAMBU.txt"] = gerarReadmeKitBambu(cfg);
        return { arquivos };
    }

    function gerarMoldeBambu(config) {
        const cfg = normalizarConfig(config);
        const faces = criarMalhaMoldeCortador(cfg);
        return {
            stl: exportarSTL("molde_quebra_cabeca", faces),
            readme: gerarReadmeMoldeBambu(cfg)
        };
    }

    function normalizarConfig(config) {
        return {
            largura: Number(config.largura) || 120,
            altura: Number(config.altura) || 120,
            linhas: 2,
            colunas: 2,
            espessura: Number(config.espessura) || 3,
            alturaLogo: Number(config.alturaLogo) || 0.8,
            folga: Number(config.folga) || 0.3,
            raioCantos: Number(config.raioCantos) || 3,
            diametroEncaixe: Number(config.diametroEncaixe) || 18,
            diametroIma: Number(config.diametroIma) || 8.2,
            profundidadeIma: Number(config.profundidadeIma) || 2.1,
            alturaMascara: Number(config.alturaMascara) || 15,
            folgaMascara: Math.max(0, Number(config.folgaMascara) || 0.05),
            alturaCortador: Number(config.alturaCortador) || Number(config.alturaMascara) || 12,
            larguraLinha: Number(config.larguraLinha) || 1.2,
            posX: Number(config.posX) || 0,
            posY: Number(config.posY) || 0,
            centralizarOrigem: config.centralizarOrigem !== false,
            corteImaAtivo: config.corteImaAtivo !== false,
            imaOffsetX: Number(config.imaOffsetX) || 0,
            imaOffsetY: Number(config.imaOffsetY) || 0,
            modoPosicaoIma: config.modoPosicaoIma || "centro",
            logoX: Number(config.logoX) || 0,
            logoY: Number(config.logoY) || 0,
            logoEscala: Math.max(0.01, Number(config.logoEscala) || 1),
            logoRotacao: Number(config.logoRotacao) || 0,
            separarPecas: config.separarPecas !== false,
            espacoVisual: Math.max(0, Number(config.espacoVisual) || 0),
            logoSvg: String(config.logoSvg || "")
        };
    }

    function criarMalhaMoldeCortador(cfg) {
        const faces = [];
        const offset = cfg.centralizarOrigem ? [0, 0] : [cfg.posX, cfg.posY];
        const w = cfg.largura;
        const h = cfg.altura;
        const linha = Math.max(0.1, cfg.larguraLinha);
        const r = Math.max(1, cfg.diametroEncaixe / 2 + linha / 2);
        const z0 = 0;
        const z1 = Math.max(1, cfg.alturaCortador);

        adicionarFaces(faces, criarPrismaRetangular(offset[0] - linha / 2, offset[0] + linha / 2, offset[1] - h / 2, offset[1] + h / 2, z0, z1));
        adicionarFaces(faces, criarPrismaRetangular(offset[0] - w / 2, offset[0] + w / 2, offset[1] - linha / 2, offset[1] + linha / 2, z0, z1));

        [
            [0, h / 4],
            [0, -h / 4],
            [-w / 4, 0],
            [w / 4, 0]
        ].forEach(([x, y]) => {
            adicionarFaces(faces, criarCilindro(offset[0] + x, offset[1] + y, r, z0, z1, 64));
        });

        if (cfg.corteImaAtivo) {
            posicoesImaMolde(cfg).forEach(([x, y]) => {
                adicionarFaces(faces, criarCilindro(offset[0] + x, offset[1] + y, cfg.diametroIma / 2, z0, Math.max(cfg.profundidadeIma, cfg.alturaCortador), 48));
            });
        }

        return faces;
    }

    function posicoesIma(cfg) {
        const padrao = [
            [-cfg.largura / 4, cfg.altura / 4],
            [cfg.largura / 4, cfg.altura / 4],
            [-cfg.largura / 4, -cfg.altura / 4],
            [cfg.largura / 4, -cfg.altura / 4]
        ];

        if (cfg.modoPosicaoIma !== "personalizado") return padrao;

        return padrao.map((p, index) => {
            const i = index + 1;
            const x = Number(cfg[`ima${i}X`]);
            const y = Number(cfg[`ima${i}Y`]);
            return [
                Number.isFinite(x) ? x : p[0],
                Number.isFinite(y) ? y : p[1]
            ];
        });
    }

    function posicoesImaMolde(cfg) {
        return [
            [-cfg.largura / 4 + cfg.imaOffsetX, cfg.altura / 4 + cfg.imaOffsetY],
            [cfg.largura / 4 + cfg.imaOffsetX, cfg.altura / 4 + cfg.imaOffsetY],
            [-cfg.largura / 4 + cfg.imaOffsetX, -cfg.altura / 4 + cfg.imaOffsetY],
            [cfg.largura / 4 + cfg.imaOffsetX, -cfg.altura / 4 + cfg.imaOffsetY]
        ];
    }

    function criarPrismaRetangular(x0, x1, y0, y1, z0, z1) {
        return extrudarPoligono([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1);
    }

    function criarCilindro(cx, cy, raio, z0, z1, segmentos = 48) {
        const poligono = [];
        for (let i = 0; i < segmentos; i++) {
            const a = (Math.PI * 2 * i) / segmentos;
            poligono.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]);
        }
        return extrudarPoligono(poligono, z0, z1);
    }

    function adicionarFaces(destino, faces) {
        faces.forEach(face => destino.push(face));
    }

    function gerarPoligonoPeca(peca, cfg) {
        const w = cfg.largura;
        const h = cfg.altura;
        const r = Math.max(2, cfg.diametroEncaixe / 2);
        const left = peca === 1 || peca === 3;
        const top = peca === 1 || peca === 2;
        const x0 = left ? -w / 2 : cfg.folga / 2;
        const x1 = left ? -cfg.folga / 2 : w / 2;
        const y0 = top ? cfg.folga / 2 : -h / 2;
        const y1 = top ? h / 2 : -cfg.folga / 2;
        const pontos = [];

        adicionarPonto(pontos, [x0, y1]);

        adicionarArestaHorizontal(pontos, x0, x1, y1, top ? null : { tipo: "femea", direcao: 1 }, 1, r);
        adicionarArestaVertical(pontos, x1, y1, y0, left ? { tipo: "macho", direcao: 1 } : null, -1, r);
        adicionarArestaHorizontal(pontos, x1, x0, y0, top ? { tipo: "macho", direcao: -1 } : null, -1, r);
        adicionarArestaVertical(pontos, x0, y0, y1, left ? null : { tipo: "femea", direcao: -1 }, 1, r);

        let poligono = limparPoligono(pontos);
        if (areaPoligono(poligono) < 0) poligono = poligono.reverse();
        poligono = arredondarCantosPoligono(poligono, cfg.raioCantos);

        const deslocamento = deslocamentoPeca(peca, cfg);
        return poligono.map(p => [p[0] + deslocamento[0], p[1] + deslocamento[1]]);
    }

    function adicionarArestaHorizontal(pontos, xInicio, xFim, y, encaixe, sentido, r) {
        const dir = Math.sign(xFim - xInicio);
        const cx = (xInicio + xFim) / 2;
        const antes = cx - dir * r;
        const depois = cx + dir * r;

        if (!encaixe) {
            adicionarPonto(pontos, [xFim, y]);
            return;
        }

        adicionarPonto(pontos, [antes, y]);
        const fora = encaixe.tipo === "macho" ? encaixe.direcao : -encaixe.direcao;
        const passos = 18;
        for (let i = 0; i <= passos; i++) {
            const t = i / passos;
            const ang = dir > 0 ? Math.PI - Math.PI * t : 0 + Math.PI * t;
            const x = cx + Math.cos(ang) * r;
            const yy = y + Math.sin(ang) * r * fora;
            adicionarPonto(pontos, [x, yy]);
        }
        adicionarPonto(pontos, [xFim, y]);
    }

    function adicionarArestaVertical(pontos, x, yInicio, yFim, encaixe, sentido, r) {
        const dir = Math.sign(yFim - yInicio);
        const cy = (yInicio + yFim) / 2;
        const antes = cy - dir * r;
        const depois = cy + dir * r;

        if (!encaixe) {
            adicionarPonto(pontos, [x, yFim]);
            return;
        }

        adicionarPonto(pontos, [x, antes]);
        const fora = encaixe.tipo === "macho" ? encaixe.direcao : -encaixe.direcao;
        const passos = 18;
        for (let i = 0; i <= passos; i++) {
            const t = i / passos;
            const ang = dir < 0 ? Math.PI / 2 - Math.PI * t : -Math.PI / 2 + Math.PI * t;
            const xx = x + Math.cos(ang) * r * fora;
            const y = cy + Math.sin(ang) * r;
            adicionarPonto(pontos, [xx, y]);
        }
        adicionarPonto(pontos, [x, yFim]);
    }

    function gerarMascaraLogoPeca(peca, cfg) {
        const w = cfg.largura;
        const h = cfg.altura;
        const left = peca === 1 || peca === 3;
        const top = peca === 1 || peca === 2;
        const x0 = left ? -w / 2 - cfg.espacoVisual : 0;
        const x1 = left ? 0 : w / 2 + cfg.espacoVisual;
        const y0 = top ? 0 : -h / 2 - cfg.espacoVisual;
        const y1 = top ? h / 2 + cfg.espacoVisual : 0;
        const deslocamento = deslocamentoPeca(peca, cfg);

        return [
            [x0 + deslocamento[0], y0 + deslocamento[1]],
            [x1 + deslocamento[0], y0 + deslocamento[1]],
            [x1 + deslocamento[0], y1 + deslocamento[1]],
            [x0 + deslocamento[0], y1 + deslocamento[1]]
        ];
    }

    function deslocamentoPeca(peca, cfg) {
        if (!cfg.separarPecas) return [0, 0];
        const s = cfg.espacoVisual / 2;
        return [
            (peca === 1 || peca === 3) ? -s : s,
            (peca === 1 || peca === 2) ? s : -s
        ];
    }

    function criarMalhaBase(poligono, peca, cfg) {
        const faces = extrudarPoligono(poligono, 0, cfg.espessura);
        const centro = centroPecaComDeslocamento(peca, cfg);
        const raioIma = cfg.diametroIma / 2;
        const zFundoRebaixo = Math.min(cfg.espessura - 0.2, Math.max(0.1, cfg.profundidadeIma));
        const passos = 48;

        for (let i = 0; i < passos; i++) {
            const a1 = (Math.PI * 2 * i) / passos;
            const a2 = (Math.PI * 2 * (i + 1)) / passos;
            const p1 = [centro[0] + Math.cos(a1) * raioIma, centro[1] + Math.sin(a1) * raioIma];
            const p2 = [centro[0] + Math.cos(a2) * raioIma, centro[1] + Math.sin(a2) * raioIma];
            faces.push([[p1[0], p1[1], 0.02], [p2[0], p2[1], 0.02], [p2[0], p2[1], zFundoRebaixo]]);
            faces.push([[p1[0], p1[1], 0.02], [p2[0], p2[1], zFundoRebaixo], [p1[0], p1[1], zFundoRebaixo]]);
            faces.push([[centro[0], centro[1], zFundoRebaixo], [p2[0], p2[1], zFundoRebaixo], [p1[0], p1[1], zFundoRebaixo]]);
        }

        return faces;
    }

    function arredondarCantosPoligono(poligono, raio) {
        const r = Math.max(0, Math.min(raio || 0, 8));
        if (!r || poligono.length < 4) return poligono;

        const resultado = [];
        const ccw = areaPoligono(poligono) > 0;

        for (let i = 0; i < poligono.length; i++) {
            const a = poligono[(i - 1 + poligono.length) % poligono.length];
            const b = poligono[i];
            const c = poligono[(i + 1) % poligono.length];
            const convex = ccw ? cross2(a, b, c) > EPS : cross2(a, b, c) < -EPS;
            const la = distancia2(a, b);
            const lc = distancia2(b, c);

            if (!convex || la < r * 2 || lc < r * 2) {
                adicionarPonto(resultado, b);
                continue;
            }

            const corte = Math.min(r, la * 0.35, lc * 0.35);
            const p1 = [b[0] + (a[0] - b[0]) * (corte / la), b[1] + (a[1] - b[1]) * (corte / la)];
            const p2 = [b[0] + (c[0] - b[0]) * (corte / lc), b[1] + (c[1] - b[1]) * (corte / lc)];
            const passos = 5;

            for (let j = 0; j <= passos; j++) {
                const t = j / passos;
                const mt = 1 - t;
                adicionarPonto(resultado, [
                    mt * mt * p1[0] + 2 * mt * t * b[0] + t * t * p2[0],
                    mt * mt * p1[1] + 2 * mt * t * b[1] + t * t * p2[1]
                ]);
            }
        }

        return limparPoligono(resultado);
    }

    function expandirPoligonoPorCentroide(poligono, distancia) {
        if (!distancia) return poligono;
        const c = centroidePoligono(poligono);
        return poligono.map(p => {
            const vx = p[0] - c[0];
            const vy = p[1] - c[1];
            const len = Math.hypot(vx, vy) || 1;
            return [
                p[0] + (vx / len) * distancia,
                p[1] + (vy / len) * distancia
            ];
        });
    }

    function centroPecaComDeslocamento(peca, cfg) {
        const base = [
            (peca === 1 || peca === 3) ? -cfg.largura / 4 : cfg.largura / 4,
            (peca === 1 || peca === 2) ? cfg.altura / 4 : -cfg.altura / 4
        ];
        const d = deslocamentoPeca(peca, cfg);
        return [base[0] + d[0], base[1] + d[1]];
    }

    function extrudarPoligono(poligonoEntrada, z0, z1) {
        let poligono = limparPoligono(poligonoEntrada);
        if (poligono.length < 3) return [];
        if (areaPoligono(poligono) < 0) poligono = poligono.reverse();

        const faces = [];
        const indices = triangulacaoEarClip(poligono);

        for (let i = 0; i < indices.length; i += 3) {
            const a = poligono[indices[i]];
            const b = poligono[indices[i + 1]];
            const c = poligono[indices[i + 2]];
            faces.push([[a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1]]);
            faces.push([[c[0], c[1], z0], [b[0], b[1], z0], [a[0], a[1], z0]]);
        }

        for (let i = 0; i < poligono.length; i++) {
            const a = poligono[i];
            const b = poligono[(i + 1) % poligono.length];
            faces.push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1]]);
            faces.push([[a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]);
        }

        return faces;
    }

    function triangulacaoEarClip(poligono) {
        const pontos = areaPoligono(poligono) < 0 ? [...poligono].reverse() : [...poligono];
        const indices = pontos.map((_, i) => i);
        const resultado = [];
        let guarda = 0;

        while (indices.length > 3 && guarda < 10000) {
            guarda++;
            let cortou = false;

            for (let i = 0; i < indices.length; i++) {
                const ia = indices[(i - 1 + indices.length) % indices.length];
                const ib = indices[i];
                const ic = indices[(i + 1) % indices.length];
                const a = pontos[ia];
                const b = pontos[ib];
                const c = pontos[ic];

                if (cross2(a, b, c) <= EPS) continue;

                let contem = false;
                for (const idx of indices) {
                    if (idx === ia || idx === ib || idx === ic) continue;
                    if (pontoEmTriangulo(pontos[idx], a, b, c)) {
                        contem = true;
                        break;
                    }
                }
                if (contem) continue;

                resultado.push(ia, ib, ic);
                indices.splice(i, 1);
                cortou = true;
                break;
            }

            if (!cortou) {
                const c = centroidePoligono(pontos);
                pontos.push(c);
                const centroIndice = pontos.length - 1;
                for (let i = 0; i < indices.length; i++) {
                    resultado.push(centroIndice, indices[i], indices[(i + 1) % indices.length]);
                }
                return resultado;
            }
        }

        if (indices.length === 3) resultado.push(indices[0], indices[1], indices[2]);
        return resultado;
    }

    function extrairPoligonosSvgPorCor(svgTexto, cfg) {
        const doc = new DOMParser().parseFromString(svgTexto, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg || doc.querySelector("parsererror")) throw new Error("SVG inválido.");

        const viewBox = obterViewBox(svg);
        const elementos = Array.from(svg.querySelectorAll("path,rect,circle,ellipse,polygon,polyline"));
        const grupos = new Map();
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;";
        const svgClone = svg.cloneNode(true);
        host.appendChild(svgClone);
        document.body.appendChild(host);

        try {
            const clones = Array.from(svgClone.querySelectorAll("path,rect,circle,ellipse,polygon,polyline"));
            clones.forEach((elemento, indice) => {
                const original = elementos[indice];
                const cor = normalizarCorSvg(obterCorSvg(original));
                const poligonos = elementoParaPoligonosSvg(elemento, original, viewBox, cfg);
                if (!poligonos.length) return;
                if (!grupos.has(cor)) grupos.set(cor, []);
                grupos.get(cor).push(...poligonos);
            });
        } finally {
            host.remove();
        }

        return Array.from(grupos.entries()).map(([cor, poligonos], indice) => ({
            cor,
            nome: `Cor ${indice + 1}`,
            poligonos
        }));
    }

    function obterViewBox(svg) {
        const vb = String(svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
        if (vb.length === 4 && vb.every(Number.isFinite)) {
            return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
        }
        return {
            x: 0,
            y: 0,
            w: Number.parseFloat(svg.getAttribute("width")) || 100,
            h: Number.parseFloat(svg.getAttribute("height")) || 100
        };
    }

    function elementoParaPoligonosSvg(elemento, original, viewBox, cfg) {
        const tag = elemento.tagName.toLowerCase();
        if (tag === "polygon" || tag === "polyline") {
            const pontos = String(original.getAttribute("points") || "")
                .trim()
                .split(/[\s,]+/)
                .map(Number);
            const poligono = [];
            for (let i = 0; i < pontos.length; i += 2) {
                if (Number.isFinite(pontos[i]) && Number.isFinite(pontos[i + 1])) {
                    poligono.push(transformarPontoLogo([pontos[i], pontos[i + 1]], viewBox, cfg));
                }
            }
            return poligono.length >= 3 ? [poligono] : [];
        }

        if (tag === "rect") {
            const x = Number(original.getAttribute("x")) || 0;
            const y = Number(original.getAttribute("y")) || 0;
            const w = Number(original.getAttribute("width")) || 0;
            const h = Number(original.getAttribute("height")) || 0;
            if (w <= 0 || h <= 0) return [];
            return [[
                transformarPontoLogo([x, y], viewBox, cfg),
                transformarPontoLogo([x + w, y], viewBox, cfg),
                transformarPontoLogo([x + w, y + h], viewBox, cfg),
                transformarPontoLogo([x, y + h], viewBox, cfg)
            ]];
        }

        if (tag === "circle" || tag === "ellipse") {
            const cx = Number(original.getAttribute("cx")) || 0;
            const cy = Number(original.getAttribute("cy")) || 0;
            const rx = tag === "circle"
                ? Number(original.getAttribute("r")) || 0
                : Number(original.getAttribute("rx")) || 0;
            const ry = tag === "circle"
                ? rx
                : Number(original.getAttribute("ry")) || 0;
            if (rx <= 0 || ry <= 0) return [];
            const passos = 64;
            const poligono = [];
            for (let i = 0; i < passos; i++) {
                const a = (Math.PI * 2 * i) / passos;
                poligono.push(transformarPontoLogo([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], viewBox, cfg));
            }
            return [poligono];
        }

        if (typeof elemento.getTotalLength !== "function" || typeof elemento.getPointAtLength !== "function") {
            return [];
        }

        let comprimento = 0;
        try {
            comprimento = elemento.getTotalLength();
        } catch (erro) {
            return [];
        }

        if (!Number.isFinite(comprimento) || comprimento <= 0) return [];

        const passos = Math.max(24, Math.min(320, Math.ceil(comprimento / 2)));
        const poligono = [];
        for (let i = 0; i < passos; i++) {
            const p = elemento.getPointAtLength((comprimento * i) / passos);
            poligono.push(transformarPontoLogo([p.x, p.y], viewBox, cfg));
        }
        return poligono.length >= 3 ? [limparPoligono(poligono)] : [];
    }

    function transformarPontoLogo(ponto, viewBox, cfg) {
        const xLocal = ponto[0] - (viewBox.x + viewBox.w / 2);
        const yLocal = (viewBox.y + viewBox.h / 2) - ponto[1];
        const a = (cfg.logoRotacao * Math.PI) / 180;
        const xs = xLocal * cfg.logoEscala;
        const ys = yLocal * cfg.logoEscala;
        const xr = xs * Math.cos(a) - ys * Math.sin(a);
        const yr = xs * Math.sin(a) + ys * Math.cos(a);
        return [xr + cfg.logoX, yr + cfg.logoY];
    }

    function obterCorSvg(elemento) {
        const estilo = elemento.getAttribute("style") || "";
        const fillEstilo = estilo.split(";").map(s => s.trim()).find(s => s.toLowerCase().startsWith("fill:"));
        const strokeEstilo = estilo.split(";").map(s => s.trim()).find(s => s.toLowerCase().startsWith("stroke:"));
        return elemento.getAttribute("fill")
            || (fillEstilo ? fillEstilo.split(":").slice(1).join(":") : "")
            || elemento.getAttribute("stroke")
            || (strokeEstilo ? strokeEstilo.split(":").slice(1).join(":") : "")
            || "#111827";
    }

    function normalizarCorSvg(cor) {
        const texto = String(cor || "").trim().toLowerCase();
        if (!texto || texto === "none" || texto === "transparent") return "#111827";
        return texto;
    }

    function clipPoligonoConvexo(subject, clip) {
        let saida = [...subject];
        const clipCcw = areaPoligono(clip) < 0 ? [...clip].reverse() : clip;

        for (let i = 0; i < clipCcw.length; i++) {
            const a = clipCcw[i];
            const b = clipCcw[(i + 1) % clipCcw.length];
            const entrada = saida;
            saida = [];
            if (!entrada.length) break;

            for (let j = 0; j < entrada.length; j++) {
                const p = entrada[j];
                const q = entrada[(j + 1) % entrada.length];
                const pDentro = cross2(a, b, p) >= -EPS;
                const qDentro = cross2(a, b, q) >= -EPS;

                if (pDentro && qDentro) {
                    saida.push(q);
                } else if (pDentro && !qDentro) {
                    saida.push(intersecaoLinha(p, q, a, b));
                } else if (!pDentro && qDentro) {
                    saida.push(intersecaoLinha(p, q, a, b));
                    saida.push(q);
                }
            }
        }

        return limparPoligono(saida);
    }

    function intersecaoLinha(p1, p2, p3, p4) {
        const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
        const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < EPS) return p2;
        const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den;
        const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den;
        return [px, py];
    }

    function exportarSTL(nome, faces) {
        const linhas = [`solid ${nome}`];
        faces.forEach(face => {
            const n = normalFace(face);
            linhas.push(`  facet normal ${fmt(n[0])} ${fmt(n[1])} ${fmt(n[2])}`);
            linhas.push("    outer loop");
            face.forEach(v => linhas.push(`      vertex ${fmt(v[0])} ${fmt(v[1])} ${fmt(v[2])}`));
            linhas.push("    endloop");
            linhas.push("  endfacet");
        });
        linhas.push(`endsolid ${nome}`);
        return linhas.join("\n");
    }

    function normalFace(face) {
        const a = face[0], b = face[1], c = face[2];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        const len = Math.hypot(n[0], n[1], n[2]) || 1;
        return [n[0] / len, n[1] / len, n[2] / len];
    }

    function gerarReadmeBambu(cfg, grupos, arquivos) {
        const stls = Object.keys(arquivos).filter(nome => nome.endsWith(".stl")).sort();
        return `PrimeDocs - Quebra-Cabeça Magnético PRO

Este pacote contém STLs reais gerados diretamente no PrimeDocs.
Não depende de OpenSCAD, Blender ou Meshmixer.

Como importar no Bambu Studio:
1. Extraia este ZIP.
2. Selecione todos os arquivos .stl.
3. Arraste para o Bambu Studio.
4. Quando perguntado, importe como um único objeto / múltiplas partes.
5. Todos os STLs usam a mesma origem e devem abrir alinhados automaticamente.
6. Atribua as cores/filamentos do AMS para as partes de logo.

Arquivos STL:
${stls.map(nome => `- ${nome}`).join("\n")}

Cores detectadas:
${grupos.map((grupo, i) => `- cor${i + 1}: ${grupo.cor}`).join("\n") || "- Nenhuma cor detectada."}

Parâmetros:
- Largura total: ${cfg.largura} mm
- Altura total: ${cfg.altura} mm
- Linhas: 2
- Colunas: 2
- Espessura base: ${cfg.espessura} mm
- Relevo logo: ${cfg.alturaLogo} mm
- Folga: ${cfg.folga} mm
- Raio cantos: ${cfg.raioCantos} mm
- Encaixe: ${cfg.diametroEncaixe} mm
- Ímã: ${cfg.diametroIma} mm
- Profundidade ímã: ${cfg.profundidadeIma} mm
- Logo X: ${cfg.logoX}
- Logo Y: ${cfg.logoY}
- Escala logo: ${cfg.logoEscala}
- Rotação logo: ${cfg.logoRotacao}°

Observações:
- O motor PRO faz o corte 2D da logo antes da extrusão.
- SVGs simples com paths e fills sólidos funcionam melhor.
- Gradientes, máscaras, filtros e textos não convertidos em path podem precisar ser simplificados antes do upload.
`;
    }

    function gerarReadmeKitBambu(cfg) {
        return `PrimeDocs - Kit Bambu Quebra-Cabeça Magnético

Este ZIP contém somente:
- 4 peças reais do quebra-cabeça magnético;
- 4 máscaras STL auxiliares com o mesmo contorno das peças.

Arquivos:
- peca_01.stl
- peca_02.stl
- peca_03.stl
- peca_04.stl
- mascara_01.stl
- mascara_02.stl
- mascara_03.stl
- mascara_04.stl

Como usar no Bambu Studio:
1. Importe as 4 peças no Bambu Studio.
2. Importe a logo STL do cliente e posicione sobre o quebra-cabeça montado.
3. Para criar a parte da logo da peça 01:
   - duplique a logo STL;
   - adicione mascara_01.stl como Negative Part;
   - use a máscara para manter/cortar apenas a área da peça 01 conforme o fluxo do Bambu Studio;
   - repita o processo com mascara_02.stl, mascara_03.stl e mascara_04.stl.
4. Atribua as cores/filamentos do AMS.
5. Envie para impressão.

Alinhamento:
Todos os STLs compartilham o mesmo sistema de coordenadas/origem.
Ao importar peca_01.stl e mascara_01.stl, elas devem cair alinhadas automaticamente.

Parâmetros usados:
- Largura total: ${cfg.largura} mm
- Altura total: ${cfg.altura} mm
- Linhas: 2
- Colunas: 2
- Espessura base: ${cfg.espessura} mm
- Folga entre peças: ${cfg.folga} mm
- Raio dos cantos: ${cfg.raioCantos} mm
- Diâmetro do encaixe: ${cfg.diametroEncaixe} mm
- Diâmetro do ímã: ${cfg.diametroIma} mm
- Profundidade do rebaixo do ímã: ${cfg.profundidadeIma} mm
- Altura da máscara: ${cfg.alturaMascara} mm
- Folga extra da máscara: ${cfg.folgaMascara} mm
- Separar peças: ${cfg.separarPecas ? "sim" : "não"}
- Espaço visual entre peças: ${cfg.espacoVisual} mm

Observação:
Nesta versão, o PrimeDocs não corta a logo automaticamente. As máscaras foram criadas para servir como ferramenta auxiliar de corte no Bambu Studio usando Negative Part.
`;
    }

    function gerarReadmeMoldeBambu(cfg) {
        return `PrimeDocs - Molde de Quebra-Cabeça para Bambu Studio

Arquivo principal:
- molde_quebra_cabeca.stl

Objetivo:
Este STL é um molde/cortador para ser usado como Negative Part no Bambu Studio.
Ele contém:
- linhas internas do quebra-cabeça 2x2;
- encaixes circulares no padrão quebra-cabeça;
- cilindros para criar os rebaixos/furos dos ímãs, se ativado.

Como usar:
1. Importe a logo STL no Bambu Studio.
2. Ajuste a espessura da logo/base conforme desejar.
3. Importe molde_quebra_cabeca.stl.
4. Alinhe o molde sobre a logo.
5. Configure o molde como Negative Part.
6. Fatie para verificar se as divisões e os rebaixos dos ímãs foram criados.
7. Atribua as cores do AMS nas partes da logo normalmente.

Parâmetros usados:
- Largura X do molde: ${cfg.largura} mm
- Altura Y do molde: ${cfg.altura} mm
- Peças: 2x2
- Altura do cortador: ${cfg.alturaCortador} mm
- Largura das linhas de corte: ${cfg.larguraLinha} mm
- Raio dos cantos externos: ${cfg.raioCantos} mm
- Diâmetro do encaixe: ${cfg.diametroEncaixe} mm
- Posição X do molde: ${cfg.posX} mm
- Posição Y do molde: ${cfg.posY} mm
- Centralizar na origem: ${cfg.centralizarOrigem ? "sim" : "não"}
- Corte para ímã: ${cfg.corteImaAtivo ? "sim" : "não"}
- Diâmetro do ímã: ${cfg.diametroIma} mm
- Profundidade/rebaixo do ímã: ${cfg.profundidadeIma} mm
- Posição X dos ímãs: ${cfg.imaOffsetX} mm a partir do centro de cada peça
- Posição Y dos ímãs: ${cfg.imaOffsetY} mm a partir do centro de cada peça

Observação:
Este molde não contém a logo. Ele é apenas a ferramenta de corte para usar no Bambu Studio.
`;
    }

    function adicionarPonto(lista, p) {
        const ultimo = lista[lista.length - 1];
        if (!ultimo || distancia2(ultimo, p) > EPS) lista.push(p);
    }

    function limparPoligono(poligono) {
        const limpo = [];
        poligono.forEach(p => {
            if (Number.isFinite(p[0]) && Number.isFinite(p[1])) adicionarPonto(limpo, p);
        });
        if (limpo.length > 2 && distancia2(limpo[0], limpo[limpo.length - 1]) <= EPS) limpo.pop();
        return limpo;
    }

    function areaPoligono(poligono) {
        let area = 0;
        for (let i = 0; i < poligono.length; i++) {
            const a = poligono[i], b = poligono[(i + 1) % poligono.length];
            area += a[0] * b[1] - b[0] * a[1];
        }
        return area / 2;
    }

    function centroidePoligono(poligono) {
        const soma = poligono.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
        return [soma[0] / poligono.length, soma[1] / poligono.length];
    }

    function cross2(a, b, c) {
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    function pontoEmTriangulo(p, a, b, c) {
        const c1 = cross2(a, b, p);
        const c2 = cross2(b, c, p);
        const c3 = cross2(c, a, p);
        return c1 >= -EPS && c2 >= -EPS && c3 >= -EPS;
    }

    function distancia2(a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    function fmt(n) {
        return Number(n || 0).toFixed(6).replace(/\.?0+$/, "") || "0";
    }

    return {
        gerarMoldeBambu,
        gerarKitBambu,
        gerarPacoteBambu,
        gerarPoligonoPeca,
        createPuzzlePiece: gerarPoligonoPeca,
        createPuzzle(config) {
            return [1, 2, 3, 4].map(peca => gerarPoligonoPeca(peca, normalizarConfig(config)));
        },
        clipSvgByPiece: clipPoligonoConvexo,
        extrudePolygon: extrudarPoligono,
        meshUnion(meshes) {
            return meshes.flat();
        },
        clipPoligonoConvexo,
        exportarSTL,
        exportSTL: exportarSTL
    };
})();

if (typeof window !== "undefined") {
    window.PrimeCADPuzzleGenerator = PrimeCADPuzzleGenerator;
}
