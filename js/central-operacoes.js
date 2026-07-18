(function () {
    "use strict";

    const STATUS_ATIVOS = new Set(["em_execucao", "pausada"]);
    const STATUS_PEDIDOS_ENCERRADOS = new Set(["entregue", "cancelado"]);
    const STATUS_FINANCEIROS_ENCERRADOS = new Set(["pago", "cancelado"]);
    const ROTAS = {
        pedidos: "pedidos",
        producao: "producao",
        financeiro: "financeiro",
        estoque: "estoque",
        produtos: "estoque:produtos",
        filamentos: "estoque:filamentos",
        consignado: "consignado",
        clientes: "clientes",
        impressoras: "impressoras"
    };

    let ultimoContexto = null;
    let timerProducao = null;

    const html = valor => String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
    const dataCurta = valor => String(valor || "").slice(0, 10);
    const timestamp = valor => {
        if (!valor) return 0;
        const texto = String(valor);
        const data = new Date(texto.length === 10 ? `${texto}T12:00:00` : texto);
        return Number.isNaN(data.getTime()) ? 0 : data.getTime();
    };
    const moeda = valor => typeof Utils !== "undefined" && Utils?.moeda ? Utils.moeda(numero(valor)) : numero(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const hojeISO = () => typeof Utils !== "undefined" && Utils?.hoje ? Utils.hoje() : new Date().toISOString().slice(0, 10);
    const somarDias = (data, dias) => {
        const base = new Date(`${data}T12:00:00`);
        base.setDate(base.getDate() + dias);
        return base.toISOString().slice(0, 10);
    };
    const formatarData = valor => {
        if (!valor) return "Durante o dia";
        if (typeof window.formatarDataBR === "function") return formatarDataBR(dataCurta(valor));
        return new Date(`${dataCurta(valor)}T12:00:00`).toLocaleDateString("pt-BR");
    };
    const formatarMinutos = valor => {
        const total = Math.max(0, Math.round(numero(valor)));
        const horas = Math.floor(total / 60);
        const minutos = total % 60;
        if (!horas) return `${minutos} min`;
        return minutos ? `${horas}h ${String(minutos).padStart(2, "0")}min` : `${horas}h`;
    };
    const capitalizar = valor => valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : "";
    const dataHumana = data => capitalizar(data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));
    const slug = valor => String(valor || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    function obterNomeUsuario() {
        const usuario = window.PrimeFirebase?.auth?.currentUser;
        const perfil = (() => {
            try { return JSON.parse(localStorage.getItem("primedocs_usuario") || "null"); } catch (_) { return null; }
        })();
        const candidato = usuario?.displayName || perfil?.apelido || perfil?.nome || usuario?.email?.split("@")[0] || "";
        const primeiro = String(candidato).trim().split(/[\s._-]+/)[0].replace(/\d+$/g, "");
        if (!primeiro) return "";
        return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
    }

    function saudacao(agora = new Date()) {
        const prefixo = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";
        const nome = obterNomeUsuario();
        return nome ? `${prefixo}, ${nome}! 👋` : "Olá! 👋";
    }

    function lerDados() {
        const lista = nome => typeof Storage?.[nome] === "function" ? Storage[nome]() || [] : [];
        const financeiro = typeof Financeiro !== "undefined" && Financeiro?.sincronizar ? Financeiro.sincronizar() : lista("listarLancamentosFinanceiros");
        const filamentos = lista("listarFilamentos").filter(item => item.ativo !== false);
        const gruposFilamentos = typeof window.agruparFilamentosDashboard === "function"
            ? agruparFilamentosDashboard(filamentos)
            : filamentos.map(item => ({
                chave: item.id,
                material: item.material || "Filamento",
                cor: item.cor || "Sem cor",
                pesoDisponivelTotal: numero(item.pesoAtualKg) * 1000,
                baixoEstoque: numero(item.pesoAtualKg) <= numero(item.alertaMinimoKg)
            }));
        return {
            agora: new Date(),
            hoje: hojeISO(),
            pedidos: lista("listarPedidos").filter(item => item.ativo !== false),
            financeiro,
            filamentos,
            gruposFilamentos,
            impressoras: lista("listarImpressoras").filter(item => item.ativa !== false),
            lotes: lista("listarLotesExecucao"),
            operacoes: lista("listarOperacoesProducao"),
            ordens: lista("listarOrdensProducao"),
            clientes: lista("listarClientes").filter(item => item.ativo !== false),
            lojasVisitar: typeof window.calcularLojasParaVisitar === "function" ? calcularLojasParaVisitar() : []
        };
    }

    function situacaoPedido(pedido, hoje) {
        if (STATUS_PEDIDOS_ENCERRADOS.has(pedido.statusPedido)) return "encerrado";
        if (pedido.statusPedido === "pronto") return `pronto-${dataCurta(pedido.atualizadoEm || pedido.dataEntregaPrevista)}`;
        if (pedido.dataEntregaPrevista && pedido.dataEntregaPrevista < hoje) return `atrasado-${pedido.dataEntregaPrevista}-${pedido.statusPedido}`;
        return `${pedido.statusPedido || "aberto"}-${pedido.dataEntregaPrevista || "sem-prazo"}`;
    }

    function calcularPrioridades(dados = lerDados()) {
        const prioridades = [];
        const concluidas = new Set(typeof window.obterAcoesOperacionaisConcluidas === "function" ? obterAcoesOperacionaisConcluidas().map(String) : []);
        const vistos = new Set();
        const porOrdem = new Map(dados.ordens.map(item => [String(item.id), item]));
        const porOperacao = new Map(dados.operacoes.map(item => [String(item.id), item]));
        const porImpressora = new Map(dados.impressoras.map(item => [String(item.id), item]));

        const incluir = item => {
            const situacao = slug(item.situacao || item.descricao || item.prioridade);
            const chave = `${item.tipo}:${item.entidadeTipo}:${item.entidadeId}:${situacao}`;
            const id = `central-${chave}`;
            if (vistos.has(chave) || concluidas.has(id)) return;
            vistos.add(chave);
            prioridades.push({
                id,
                tipo: item.tipo,
                entidadeId: String(item.entidadeId || ""),
                entidadeTipo: item.entidadeTipo,
                titulo: item.titulo,
                descricao: item.descricao || "",
                prioridade: item.pontuacao >= 100 ? "critica" : item.pontuacao >= 80 ? "alta" : item.pontuacao >= 60 ? "media" : "baixa",
                pontuacao: item.pontuacao,
                dataReferencia: item.dataReferencia || "",
                acaoPrincipal: item.acaoPrincipal || "Abrir",
                rota: item.rota,
                icone: item.icone || "circle-alert",
                badge: item.badge || "",
                criadoEm: item.criadoEm || ""
            });
        };

        dados.lotes.filter(lote => {
            if (lote.status !== "falhou" || lote.resolvidoEm) return false;
            const operacao = porOperacao.get(String(lote.operacaoId));
            const outraTentativaAtiva = dados.lotes.some(outro => String(outro.operacaoId) === String(lote.operacaoId) && String(outro.id) !== String(lote.id) && !["falhou", "cancelado", "concluido"].includes(outro.status));
            return operacao?.status === "falhou" && !outraTentativaAtiva;
        }).forEach(lote => {
            const ordem = porOrdem.get(String(lote.ordemProducaoId));
            incluir({ tipo: "falha_producao", entidadeTipo: "lote", entidadeId: lote.id, situacao: `falhou-${lote.atualizadoEm || lote.concluidoEm}`,
                titulo: `Falha na produção${ordem?.produtoNome ? ` de ${ordem.produtoNome}` : ""}`, descricao: lote.motivoFalha || lote.impressoraNome || "A produção precisa de atenção", pontuacao: 100,
                dataReferencia: lote.atualizadoEm || lote.concluidoEm, acaoPrincipal: "Resolver", rota: "producao", icone: "triangle-alert", badge: "Falha" });
        });

        dados.impressoras.filter(item => ["falha", "erro", "com_problema"].includes(item.status)).forEach(item => incluir({
            tipo: "impressora_problema", entidadeTipo: "impressora", entidadeId: item.id, situacao: `${item.status}-${item.operacaoAtualId || "livre"}`,
            titulo: `${item.nome || "Impressora"} precisa de atenção`, descricao: item.observacoes || "Verifique a máquina antes de continuar", pontuacao: 100,
            dataReferencia: item.atualizadoEm, acaoPrincipal: "Resolver", rota: "impressoras", icone: "printer-check", badge: "Crítico"
        }));

        dados.pedidos.forEach(pedido => {
            if (STATUS_PEDIDOS_ENCERRADOS.has(pedido.statusPedido)) return;
            const prazo = pedido.dataEntregaPrevista;
            const diasAtraso = prazo && prazo < dados.hoje ? Math.max(1, Math.floor((timestamp(dados.hoje) - timestamp(prazo)) / 86400000)) : 0;
            if (diasAtraso) {
                const pronto = pedido.statusPedido === "pronto";
                incluir({ tipo: pronto ? "pedido_pronto_atrasado" : "pedido_atrasado", entidadeTipo: "pedido", entidadeId: pedido.id, situacao: situacaoPedido(pedido, dados.hoje),
                    titulo: pronto ? `Pedido de ${pedido.clienteNome || "cliente"} aguarda entrega` : `Pedido de ${pedido.clienteNome || "cliente"} está atrasado`,
                    descricao: `${diasAtraso === 1 ? "Entrega prevista para ontem" : `Entrega atrasada há ${diasAtraso} dias`}`, pontuacao: diasAtraso >= 7 ? 100 : 90,
                    dataReferencia: prazo, acaoPrincipal: pronto ? "Entregar" : pedido.statusPedido === "em_producao" ? "Ver produção" : "Iniciar produção",
                    rota: pronto ? "pedidos" : pedido.statusPedido === "em_producao" ? "producao" : "pedidos", icone: pronto ? "package-check" : "package-x", badge: "Atrasado", criadoEm: pedido.criadoEm });
                return;
            }
            if (prazo === dados.hoje && !["em_producao", "pronto"].includes(pedido.statusPedido)) incluir({
                tipo: "pedido_prazo_hoje", entidadeTipo: "pedido", entidadeId: pedido.id, situacao: situacaoPedido(pedido, dados.hoje), titulo: `Pedido de ${pedido.clienteNome || "cliente"} vence hoje`,
                descricao: "A produção ainda não foi iniciada", pontuacao: 80, dataReferencia: prazo, acaoPrincipal: "Iniciar produção", rota: "pedidos", icone: "clock-alert", badge: "Hoje", criadoEm: pedido.criadoEm
            });
            if (pedido.statusPedido === "pronto") incluir({
                tipo: "pedido_pronto", entidadeTipo: "pedido", entidadeId: pedido.id, situacao: situacaoPedido(pedido, dados.hoje), titulo: `Pedido de ${pedido.clienteNome || "cliente"} está pronto`,
                descricao: "Pronto para retirada ou entrega", pontuacao: 70, dataReferencia: prazo || pedido.atualizadoEm, acaoPrincipal: "Entregar", rota: "pedidos", icone: "package-check", badge: "Pronto", criadoEm: pedido.criadoEm
            });
        });

        dados.financeiro.forEach(item => {
            const valor = numero(item.valorRestante);
            if (valor <= 0 || STATUS_FINANCEIROS_ENCERRADOS.has(item.status)) return;
            if (item.status === "atrasado" || (item.vencimento && item.vencimento < dados.hoje)) incluir({
                tipo: "pagamento_atrasado", entidadeTipo: "financeiro", entidadeId: item.id, situacao: `atrasado-${item.vencimento}-${valor}`,
                titulo: `${item.clienteNome || "Cliente"} tem ${moeda(valor)} pendentes`, descricao: `Vencimento ${formatarData(item.vencimento)}`, pontuacao: 90,
                dataReferencia: item.vencimento, acaoPrincipal: "Receber", rota: "financeiro", icone: "badge-dollar-sign", badge: "Vencido", criadoEm: item.dataCriacao
            });
            else if (item.vencimento === dados.hoje) incluir({
                tipo: "pagamento_hoje", entidadeTipo: "financeiro", entidadeId: item.id, situacao: `hoje-${item.vencimento}-${valor}`,
                titulo: `${item.clienteNome || "Cliente"} tem ${moeda(valor)} a receber`, descricao: "Vencimento hoje", pontuacao: 70,
                dataReferencia: item.vencimento, acaoPrincipal: "Receber", rota: "financeiro", icone: "hand-coins", badge: "Hoje", criadoEm: item.dataCriacao
            });
        });

        dados.lotes.filter(lote => STATUS_ATIVOS.has(lote.status)).forEach(lote => {
            const decorrido = calcularDecorrido(lote);
            const previsto = numero(lote.tempoPrevistoMinutos);
            const ordem = porOrdem.get(String(lote.ordemProducaoId));
            if (previsto > 0 && decorrido > previsto && lote.status === "em_execucao") incluir({
                tipo: "producao_atrasada", entidadeTipo: "lote", entidadeId: lote.id, situacao: `atrasada-${lote.iniciadoEm}-${previsto}`,
                titulo: `${ordem?.produtoNome || "Produção"} ultrapassou a previsão`, descricao: `${lote.impressoraNome || porImpressora.get(String(lote.impressoraId))?.nome || "Impressora"} · atraso de ${formatarMinutos(decorrido - previsto)}`,
                pontuacao: 90, dataReferencia: lote.iniciadoEm, acaoPrincipal: "Abrir", rota: "producao", icone: "timer-off", badge: "Atrasada"
            });
            if (lote.status === "pausada") incluir({
                tipo: "producao_pausada", entidadeTipo: "lote", entidadeId: lote.id, situacao: `pausada-${lote.pausadoEm}`,
                titulo: `${lote.impressoraNome || "Impressora"} está pausada`, descricao: ordem?.produtoNome || porOperacao.get(String(lote.operacaoId))?.nome || "Produção aguardando ação",
                pontuacao: 80, dataReferencia: lote.pausadoEm, acaoPrincipal: "Retomar", rota: "producao", icone: "pause-circle", badge: "Pausada"
            });
        });

        dados.operacoes.filter(item => ["aguardando_preparacao", "aguardando_alocacao"].includes(item.status)).forEach(item => incluir({
            tipo: "producao_aguardando", entidadeTipo: "operacao", entidadeId: item.id, situacao: item.status,
            titulo: `${item.nome || item.produtoNome || "Impressão"} aguarda ação`, descricao: item.status === "aguardando_preparacao" ? "Prepare os filamentos necessários" : "Selecione uma impressora",
            pontuacao: 80, dataReferencia: item.atualizadoEm || item.criadoEm, acaoPrincipal: item.status === "aguardando_preparacao" ? "Preparar" : "Alocar", rota: "producao", icone: "printer", badge: "Aguardando"
        }));

        dados.gruposFilamentos.filter(grupo => grupo.baixoEstoque).forEach(grupo => {
            const peso = numero(grupo.pesoDisponivelTotal);
            incluir({ tipo: "filamento_critico", entidadeTipo: "filamento", entidadeId: grupo.chave || `${grupo.material}-${grupo.cor}`, situacao: `baixo-${Math.round(peso)}`,
                titulo: `${grupo.material || "Filamento"} ${grupo.cor || ""} ${peso <= 0 ? "está sem estoque" : "está abaixo do mínimo"}`.trim(),
                descricao: peso <= 0 ? "Produções podem ser afetadas" : `${Math.round(peso)} g disponíveis`, pontuacao: peso <= 0 ? 80 : 60,
                dataReferencia: dados.hoje, acaoPrincipal: "Ver filamentos", rota: "estoque:filamentos", icone: "spool", badge: peso <= 0 ? "Sem estoque" : "Estoque baixo"
            });
        });

        dados.lojasVisitar.filter(item => numero(item.dias) >= 30).forEach(item => incluir({
            tipo: "conferencia_atrasada", entidadeTipo: "loja", entidadeId: item.loja.id, situacao: `sem-conferencia-${item.ultima || "sem-registro"}`,
            titulo: `Conferir estoque de ${item.loja.nome}`, descricao: `Última conferência há ${item.dias} dias`, pontuacao: 70,
            dataReferencia: item.ultima, acaoPrincipal: "Conferir", rota: "conferencia", icone: "store", badge: "Visita"
        }));

        dados.clientes.forEach(cliente => (cliente.retornos || []).filter(retorno => retorno.status === "pendente" && dataCurta(retorno.dataHora) <= dados.hoje).forEach(retorno => incluir({
            tipo: "retorno_cliente", entidadeTipo: "cliente", entidadeId: cliente.id, situacao: `retorno-${retorno.id}-${retorno.dataHora}`,
            titulo: `Retornar contato de ${cliente.nome}`, descricao: retorno.motivo || "Contato agendado", pontuacao: dataCurta(retorno.dataHora) < dados.hoje ? 70 : 60,
            dataReferencia: retorno.dataHora, acaoPrincipal: "Abrir cliente", rota: "clientes", icone: "calendar-clock", badge: dataCurta(retorno.dataHora) < dados.hoje ? "Atrasado" : "Hoje"
        })));

        dados.impressoras.filter(item => item.proximaManutencao && item.proximaManutencao >= dados.hoje && item.proximaManutencao <= somarDias(dados.hoje, 7)).forEach(item => incluir({
            tipo: "manutencao_proxima", entidadeTipo: "impressora", entidadeId: item.id, situacao: `manutencao-${item.proximaManutencao}`,
            titulo: `Manutenção próxima — ${item.nome}`, descricao: `Prevista para ${formatarData(item.proximaManutencao)}`, pontuacao: 60,
            dataReferencia: item.proximaManutencao, acaoPrincipal: "Ver impressora", rota: "impressoras", icone: "wrench", badge: "Manutenção"
        }));

        return prioridades.sort((a, b) => b.pontuacao - a.pontuacao || (timestamp(a.dataReferencia) || Infinity) - (timestamp(b.dataReferencia) || Infinity) || timestamp(a.criadoEm) - timestamp(b.criadoEm));
    }

    function calcularDecorrido(lote, agora = Date.now()) {
        if (typeof Producao !== "undefined" && Producao?.calcularTempoDecorrido) return numero(Producao.calcularTempoDecorrido(lote));
        if (!lote.iniciadoEm) return 0;
        const fim = lote.status === "concluido" ? timestamp(lote.concluidoEm) : agora;
        const pausaAtual = lote.status === "pausada" ? Math.max(0, agora - timestamp(lote.pausadoEm)) : 0;
        return Math.max(0, (fim - timestamp(lote.iniciadoEm) - numero(lote.tempoPausadoAcumulado) - pausaAtual) / 60000);
    }

    function calcularProgresso(lote) {
        if (lote.progresso !== null && lote.progresso !== undefined && lote.progresso !== "" && Number.isFinite(Number(lote.progresso))) return lote.status === "concluido" ? 100 : Math.min(99, Math.max(0, numero(lote.progresso)));
        if (!lote.iniciadoEm || numero(lote.tempoPrevistoMinutos) <= 0) return null;
        const calculado = typeof Producao !== "undefined" && Producao?.calcularProgressoLote ? numero(Producao.calcularProgressoLote(lote)) : calcularDecorrido(lote) / numero(lote.tempoPrevistoMinutos) * 100;
        return lote.status === "concluido" ? 100 : Math.min(99, Math.max(0, calculado));
    }

    function previsaoLote(lote) {
        if (lote.status === "pausada") return { texto: "Previsão suspensa", restante: null };
        if (!lote.iniciadoEm || numero(lote.tempoPrevistoMinutos) <= 0) return { texto: "Previsão indisponível", restante: null };
        const fim = timestamp(lote.iniciadoEm) + numero(lote.tempoPrevistoMinutos) * 60000 + numero(lote.tempoPausadoAcumulado);
        const restante = (fim - Date.now()) / 60000;
        if (restante < 0) return { texto: `Atrasada em ${formatarMinutos(Math.abs(restante))}`, restante: 0 };
        const data = new Date(fim);
        const amanha = dataCurta(data.toISOString()) !== hojeISO();
        return { texto: `${amanha ? `Termina ${formatarData(data.toISOString())} às` : "Termina às"} ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, restante };
    }

    function getPrinterImage(printer = {}) {
        const chaveExplicita = slug(printer.imagemKey);
        const validas = new Set(["generic-printer", "generic", "a1-mini", "a1", "enclosed-printer", "p1s", "x1-carbon", "x1c"]);
        let chave = validas.has(chaveExplicita) ? chaveExplicita : "";
        const modelo = slug(`${printer.fabricante || ""} ${printer.modelo || ""}`);
        if (!chave) {
            if (modelo.includes("a1-mini")) chave = "a1-mini";
            else if (/(^|-)a1($|-)/.test(modelo)) chave = "a1";
            else if (["p1s", "x1", "x1c", "carbon", "corexy", "fechada"].some(item => modelo.includes(item))) chave = "enclosed-printer";
            else chave = "generic-printer";
        }
        if (["generic", "p1s", "x1-carbon", "x1c"].includes(chave)) chave = chave === "generic" ? "generic-printer" : "enclosed-printer";
        return `assets/printers/${chave}.svg`;
    }

    function listarProximosPassos(dados = lerDados()) {
        const limite = somarDias(dados.hoje, 7);
        const itens = [];
        const incluir = item => {
            const data = dataCurta(item.data);
            if (!data || data < dados.hoje || data > limite) return;
            itens.push({ ...item, data, horario: String(item.data || "").includes("T") ? new Date(item.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "" });
        };
        dados.pedidos.filter(p => !STATUS_PEDIDOS_ENCERRADOS.has(p.statusPedido)).forEach(p => incluir({
            id: `pedido-${p.id}`, tipo: "pedido", titulo: p.statusPedido === "pronto" ? `Entregar pedido de ${p.clienteNome || "cliente"}` : `Prazo do pedido de ${p.clienteNome || "cliente"}`,
            descricao: p.statusPedido === "pronto" ? "Pedido pronto para retirada ou entrega" : `Status: ${String(p.statusPedido || "aberto").replaceAll("_", " ")}`,
            data: p.dataEntregaPrevista, rota: "pedidos", entidadeId: p.id, icone: p.statusPedido === "pronto" ? "package-check" : "package"
        }));
        dados.financeiro.filter(i => numero(i.valorRestante) > 0 && !STATUS_FINANCEIROS_ENCERRADOS.has(i.status)).forEach(i => incluir({
            id: `financeiro-${i.id}`, tipo: "financeiro", titulo: `Receber ${moeda(i.valorRestante)} de ${i.clienteNome || "cliente"}`,
            descricao: i.vencimento === dados.hoje ? "Vencimento hoje" : `Vencimento ${formatarData(i.vencimento)}`, data: i.vencimento, rota: "financeiro", entidadeId: i.id, icone: "badge-dollar-sign"
        }));
        dados.clientes.forEach(cliente => (cliente.retornos || []).filter(r => r.status === "pendente").forEach(r => incluir({
            id: `retorno-${cliente.id}-${r.id}`, tipo: "cliente", titulo: `Retornar ${cliente.nome}`, descricao: r.motivo || "Contato agendado", data: r.dataHora,
            rota: "clientes", entidadeId: cliente.id, icone: "phone-forwarded"
        })));
        dados.impressoras.filter(i => i.proximaManutencao).forEach(i => incluir({
            id: `manutencao-${i.id}`, tipo: "manutencao", titulo: `Manutenção de ${i.nome}`, descricao: "Revisão preventiva programada", data: i.proximaManutencao,
            rota: "impressoras", entidadeId: i.id, icone: "wrench"
        }));
        dados.lojasVisitar.filter(i => i.dias >= 14).forEach(i => incluir({
            id: `loja-${i.loja.id}`, tipo: "consignado", titulo: `Conferir estoque de ${i.loja.nome}`, descricao: `Última conferência há ${i.dias} dias`, data: dados.hoje,
            rota: "conferencia", entidadeId: i.loja.id, icone: "store"
        }));
        const vistos = new Set();
        return itens.filter(item => {
            const chave = `${item.tipo}-${item.entidadeId}-${item.data}`;
            if (vistos.has(chave)) return false;
            vistos.add(chave);
            return true;
        }).sort((a, b) => timestamp(a.data) - timestamp(b.data) || a.titulo.localeCompare(b.titulo, "pt-BR"));
    }

    function calcularResumo(dados, prioridades) {
        const pedidosAtrasados = dados.pedidos.filter(p => p.dataEntregaPrevista && p.dataEntregaPrevista < dados.hoje && !STATUS_PEDIDOS_ENCERRADOS.has(p.statusPedido));
        const lotesAtivos = dados.lotes.filter(l => STATUS_ATIVOS.has(l.status));
        const receberHoje = dados.financeiro.filter(i => i.vencimento === dados.hoje && numero(i.valorRestante) > 0 && !STATUS_FINANCEIROS_ENCERRADOS.has(i.status)).reduce((total, item) => total + numero(item.valorRestante), 0);
        const estoqueCritico = dados.gruposFilamentos.filter(item => item.baixoEstoque).length;
        return { pedidosAtrasados, lotesAtivos, receberHoje, estoqueCritico, totalAtencao: prioridades.filter(item => item.pontuacao >= 60).length };
    }

    function EmptyOperationsState(icone, titulo, descricao, acao = "", rota = "") {
        return `<div class="operationsEmpty"><span><i data-lucide="${icone}"></i></span><div><strong>${html(titulo)}</strong><p>${html(descricao)}</p></div>${acao ? `<button class="btnSecondary" type="button" onclick="CentralOperacoes.abrirRota('${rota}')">${html(acao)}</button>` : ""}</div>`;
    }

    function OperationsGreeting(contexto) {
        return `<header class="operationsGreeting"><div><h1>${html(saudacao(contexto.dados.agora))}</h1><p>${html(dataHumana(contexto.dados.agora))}</p><span>${contexto.resumo.totalAtencao ? `${contexto.resumo.totalAtencao} ${contexto.resumo.totalAtencao === 1 ? "item precisa" : "itens precisam"} da sua atenção hoje.` : "Sua operação está em ordem neste momento."}</span></div></header>`;
    }

    function OperationsSummaryStrip(contexto) {
        const itens = [
            ["clock-alert", contexto.resumo.pedidosAtrasados.length, "Atrasados", "Ver pedidos", "pedidos", "danger"],
            ["printer", contexto.resumo.lotesAtivos.length, "Em produção", "Ver produção", "producao", "production"],
            ["circle-dollar-sign", moeda(contexto.resumo.receberHoje), "A receber hoje", "Ver financeiro", "financeiro", "success"],
            ["spool", contexto.resumo.estoqueCritico, "Alertas de estoque", "Ver estoque", "estoque:filamentos", "warning"]
        ];
        return `<section class="operationsCompactStrip" aria-label="Resumo operacional">${itens.map(item => `<article class="summaryStripItem ${item[5]}"><span class="summaryStripIcon"><i data-lucide="${item[0]}"></i></span><div><strong>${html(item[1])}</strong><p>${html(item[2])}</p><button type="button" onclick="CentralOperacoes.abrirRota('${item[4]}')">${html(item[3])}</button></div></article>`).join("")}</section>`;
    }

    function PriorityActionCard(item) {
        return `<article class="priorityActionCard priority-${item.prioridade}" role="button" tabindex="0" onclick="CentralOperacoes.abrirPrioridade('${html(item.id)}')" onkeydown="CentralOperacoes.ativarComTeclado(event,'${html(item.id)}')">
            <span class="priorityActionIcon"><i data-lucide="${item.icone}"></i></span>
            <div class="priorityActionCopy"><strong>${html(item.titulo)}</strong><p>${html(item.descricao)}</p>${item.badge ? `<span class="priorityBadge">${html(item.badge)}</span>` : ""}</div>
            <div class="priorityActionControls"><button class="btn priorityMainAction" type="button" onclick="event.stopPropagation();CentralOperacoes.abrirPrioridade('${html(item.id)}')">${html(item.acaoPrincipal)} <i data-lucide="arrow-up-right"></i></button><button class="priorityMore" type="button" aria-label="Mais ações para ${html(item.titulo)}" onclick="event.stopPropagation();CentralOperacoes.abrirMenuPrioridade('${html(item.id)}')"><i data-lucide="ellipsis"></i></button></div>
        </article>`;
    }

    function PriorityNowSection(contexto) {
        const itens = contexto.prioridades.slice(0, 3);
        return `<section class="operationsPanel priorityNowSection"><header class="operationsSectionHeader"><div><span><i data-lucide="flag"></i> PRIORIDADE AGORA</span></div>${contexto.prioridades.length > 3 ? `<button type="button" onclick="CentralOperacoes.abrirTodasPrioridades()">Ver todas (${contexto.prioridades.length})</button>` : ""}</header>${itens.length ? `<div class="priorityActionsList">${itens.map(PriorityActionCard).join("")}</div>` : EmptyOperationsState("circle-check-big", "Tudo em ordem por enquanto.", "Nenhuma ação urgente precisa da sua atenção.")}</section>`;
    }

    function PrinterIllustration(printer) {
        const src = getPrinterImage(printer);
        return `<span class="printerIllustration"><img src="${src}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i data-lucide="printer" hidden></i></span>`;
    }

    function CompactPrinterCard(item) {
        const printer = item.printer;
        if (item.tipo === "livre") return `<article class="compactPrinterCard is-free" role="button" tabindex="0" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')">${PrinterIllustration(printer)}<div class="printerCardContent"><header><strong>${html(printer.nome || "Impressora")}</strong><span class="printerStatus free"><i></i> Livre</span></header><p>Pronta para iniciar nova produção</p><button class="btn" type="button" onclick="event.stopPropagation();CentralOperacoes.abrirRota('producao')">Iniciar produção</button></div></article>`;
        const lote = item.lote;
        const progresso = calcularProgresso(lote);
        const previsao = previsaoLote(lote);
        const status = lote.status === "pausada" ? "Pausada" : "Imprimindo";
        return `<article class="compactPrinterCard is-${lote.status}" role="button" tabindex="0" onclick="CentralOperacoes.abrirRota('producao')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'producao')">${PrinterIllustration(printer)}<div class="printerCardContent"><header><strong>${html(printer.nome || lote.impressoraNome || "Impressora")}</strong><span class="printerStatus ${lote.status}"><i></i> ${status}</span></header><h3>${html(item.ordem?.produtoNome || item.operacao?.produtoNome || item.operacao?.nome || "Produção em andamento")}</h3><p>${numero(lote.quantidade) ? `${numero(lote.quantidade)} unidades` : "Quantidade não informada"}</p>${progresso === null ? `<div class="printerProgressUnavailable">Progresso indisponível</div>` : `<div class="printerProgress" aria-label="Progresso ${Math.round(progresso)}%"><span><b data-progress-bar="${html(lote.id)}" style="width:${progresso}%"></b></span><strong data-progress-value="${html(lote.id)}">${Math.round(progresso)}%</strong></div>`}<small data-forecast="${html(lote.id)}">${html(previsao.texto)}</small>${lote.status === "pausada" ? `<button class="btnSecondary" type="button" onclick="event.stopPropagation();CentralOperacoes.abrirRota('producao')">Abrir produção</button>` : ""}</div></article>`;
    }

    function obterCardsImpressoras(contexto) {
        const porImpressora = new Map(contexto.dados.impressoras.map(i => [String(i.id), i]));
        const porOrdem = new Map(contexto.dados.ordens.map(i => [String(i.id), i]));
        const porOperacao = new Map(contexto.dados.operacoes.map(i => [String(i.id), i]));
        const ativos = contexto.dados.lotes.filter(l => STATUS_ATIVOS.has(l.status)).map(lote => ({
            tipo: "ocupada", lote, printer: porImpressora.get(String(lote.impressoraId)) || { id: lote.impressoraId, nome: lote.impressoraNome },
            ordem: porOrdem.get(String(lote.ordemProducaoId)), operacao: porOperacao.get(String(lote.operacaoId))
        }));
        const ocupadas = new Set(ativos.map(item => String(item.printer.id)));
        const livre = contexto.dados.impressoras.find(item => item.status === "livre" && !ocupadas.has(String(item.id)));
        return [...ativos, ...(livre ? [{ tipo: "livre", printer: livre }] : [])].slice(0, 3);
    }

    function ProductionNowSection(contexto) {
        const cards = obterCardsImpressoras(contexto);
        const trabalhando = contexto.dados.impressoras.filter(i => contexto.dados.lotes.some(l => String(l.impressoraId) === String(i.id) && STATUS_ATIVOS.has(l.status))).length;
        const restantes = contexto.dados.lotes.filter(l => l.status === "em_execucao").map(l => previsaoLote(l).restante).filter(Number.isFinite);
        const maior = restantes.length ? Math.max(...restantes) : null;
        const aguardando = contexto.dados.operacoes.filter(o => ["aguardando", "aguardando_alocacao", "aguardando_preparacao", "pronta_para_iniciar", "em_fila"].includes(o.status)).length;
        return `<section class="operationsPanel productionNowSection"><header class="operationsSectionHeader"><div><span><i data-lucide="factory"></i> PRODUÇÃO AGORA</span></div><button type="button" onclick="CentralOperacoes.abrirRota('producao')">Ver central de produção</button></header><div class="productionNowMeta"><strong>${trabalhando} de ${contexto.dados.impressoras.length} ${contexto.dados.impressoras.length === 1 ? "impressora trabalhando" : "impressoras trabalhando"}</strong><span>${maior === null ? "Previsão geral indisponível" : `Maior previsão: ${formatarMinutos(maior)}`}</span></div>${cards.length ? `<div class="compactPrintersGrid">${cards.map(CompactPrinterCard).join("")}</div>` : EmptyOperationsState("printer", "Nenhuma impressão em andamento.", aguardando ? `Existem ${aguardando} operações aguardando.` : "A fila de produção está livre.", "Planejar produção", "producao")}</section>`;
    }

    function NextStepsTimeline(contexto) {
        const proximosVisiveis = contexto.proximos.slice(0, 5);
        const grupos = [
            ["Hoje", contexto.dados.hoje],
            ["Amanhã", somarDias(contexto.dados.hoje, 1)],
            ["Esta semana", null]
        ];
        if (!contexto.proximos.length) return `<section class="operationsPanel nextStepsSection"><header class="operationsSectionHeader"><div><span><i data-lucide="calendar-days"></i> PRÓXIMOS PASSOS</span></div></header>${EmptyOperationsState("calendar-check", "Sem compromissos operacionais próximos.", "Novos prazos e retornos aparecerão aqui.")}</section>`;
        return `<section class="operationsPanel nextStepsSection"><header class="operationsSectionHeader"><div><span><i data-lucide="calendar-days"></i> PRÓXIMOS PASSOS</span></div><button type="button" onclick="CentralOperacoes.abrirAgenda()">Ver agenda completa</button></header><div class="nextStepsTimeline">${grupos.map(([rotulo, data]) => {
            const itens = proximosVisiveis.filter(item => data ? item.data === data : item.data > somarDias(contexto.dados.hoje, 1));
            if (!itens.length) return "";
            return `<div class="timelineGroup"><span class="timelineGroupLabel">${rotulo}</span><div>${itens.map(item => `<article role="button" tabindex="0" onclick="CentralOperacoes.abrirRota('${item.rota}')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'${item.rota}')"><span class="timelineIcon"><i data-lucide="${item.icone}"></i></span><div><strong>${html(item.titulo)}</strong><p>${html(item.descricao)}</p></div><time>${html(item.horario || (item.data === contexto.dados.hoje ? "Durante o dia" : formatarData(item.data)))}</time></article>`).join("")}</div></div>`;
        }).join("")}</div></section>`;
    }

    function ModuleSummaryCard(icone, titulo, resumo, link, rota, classe) {
        return `<article class="moduleSummaryCard ${classe}" role="button" tabindex="0" onclick="CentralOperacoes.abrirRota('${rota}')" onkeydown="CentralOperacoes.ativarRotaComTeclado(event,'${rota}')"><span><i data-lucide="${icone}"></i></span><div><strong>${html(titulo)}</strong><p>${html(resumo)}</p><button type="button" tabindex="-1">${html(link)} <i data-lucide="arrow-right"></i></button></div></article>`;
    }

    function ModuleSummaryGrid(contexto) {
        const atrasoFinanceiro = contexto.dados.financeiro.filter(i => i.status === "atrasado" && numero(i.valorRestante) > 0).reduce((t, i) => t + numero(i.valorRestante), 0);
        const visitas = contexto.dados.lojasVisitar.filter(i => i.dias >= 30).length;
        return `<section class="operationsPanel moduleSummarySection"><header class="operationsSectionHeader"><div><span>RESUMO DOS MÓDULOS</span></div></header><div class="moduleSummaryGrid">${ModuleSummaryCard("circle-dollar-sign", "Financeiro", atrasoFinanceiro ? `${moeda(atrasoFinanceiro)} atrasados` : "Tudo em dia", "Ver financeiro", "financeiro", "finance")}${ModuleSummaryCard("printer", "Produção", contexto.resumo.lotesAtivos.length ? `${contexto.resumo.lotesAtivos.length} em andamento` : "Nenhuma em andamento", "Ver produção", "producao", "production")}${ModuleSummaryCard("store", "Consignado", visitas ? `${visitas} ${visitas === 1 ? "visita sugerida" : "visitas sugeridas"}` : "Nenhuma visita sugerida", "Ver consignado", "consignado", "consignment")}${ModuleSummaryCard("spool", "Estoque", contexto.resumo.estoqueCritico ? `${contexto.resumo.estoqueCritico} ${contexto.resumo.estoqueCritico === 1 ? "item crítico" : "itens críticos"}` : "Tudo em dia", "Ver estoque", "estoque:filamentos", "stock")}</div></section>`;
    }

    function render() {
        const content = document.getElementById("content");
        if (!content) return;
        const dados = lerDados();
        const prioridades = calcularPrioridades(dados);
        const contexto = { dados, prioridades, proximos: listarProximosPassos(dados) };
        contexto.resumo = calcularResumo(dados, prioridades);
        ultimoContexto = contexto;
        content.innerHTML = `<main class="operationsCenter">${OperationsGreeting(contexto)}${OperationsSummaryStrip(contexto)}${PriorityNowSection(contexto)}${ProductionNowSection(contexto)}${NextStepsTimeline(contexto)}${ModuleSummaryGrid(contexto)}</main>`;
        if (window.lucide?.createIcons) lucide.createIcons();
        agendarAtualizacaoProducao();
    }

    function abrirRota(rota) {
        const destino = ROTAS[rota] || rota || "home";
        if (typeof window.navegar !== "function") return;
        if (String(destino).startsWith("estoque:")) return navegar("estoque", { section: String(destino).split(":")[1] });
        navegar(destino);
    }

    function abrirPrioridade(id) {
        const item = ultimoContexto?.prioridades.find(prioridade => String(prioridade.id) === String(id));
        if (item) abrirRota(item.rota);
    }

    function abrirMenuPrioridade(id) {
        const item = ultimoContexto?.prioridades.find(prioridade => String(prioridade.id) === String(id));
        if (!item || !window.Modal) return;
        Modal.abrir("Ação operacional", `<div class="compactActionMenu"><button onclick="Modal.fechar();CentralOperacoes.abrirPrioridade('${html(item.id)}')"><i data-lucide="arrow-up-right"></i><span><strong>${html(item.acaoPrincipal)}</strong><small>${html(item.titulo)}</small></span></button><button onclick="Modal.fechar();CentralOperacoes.concluirPrioridade('${html(item.id)}')"><i data-lucide="check"></i><span><strong>Marcar como concluída</strong><small>Ocultar enquanto a situação não mudar</small></span></button></div>`);
        if (window.lucide?.createIcons) lucide.createIcons();
    }

    function concluirPrioridade(id) {
        if (typeof window.concluirAcaoOperacional === "function") return concluirAcaoOperacional(id);
        try {
            const lista = JSON.parse(localStorage.getItem("primedocs_acoes_concluidas") || "[]");
            if (!lista.includes(String(id))) lista.push(String(id));
            localStorage.setItem("primedocs_acoes_concluidas", JSON.stringify(lista));
            render();
            window.Toast?.show("Ação marcada como concluída.");
        } catch (erro) { window.Toast?.show("Não foi possível concluir a ação."); }
    }

    function abrirTodasPrioridades() {
        if (!window.Modal || !ultimoContexto) return;
        Modal.abrir("Prioridades da operação", `<div class="allPrioritiesModal">${ultimoContexto.prioridades.map(PriorityActionCard).join("")}</div>`);
        if (window.lucide?.createIcons) lucide.createIcons();
    }

    function abrirAgenda() {
        if (!window.Modal || !ultimoContexto) return;
        const itens = ultimoContexto.proximos;
        Modal.abrir("Próximos passos", itens.length ? `<div class="agendaModalList">${itens.map(item => `<button onclick="Modal.fechar();CentralOperacoes.abrirRota('${item.rota}')"><i data-lucide="${item.icone}"></i><span><strong>${html(item.titulo)}</strong><small>${html(item.descricao)} · ${html(item.horario || formatarData(item.data))}</small></span><i data-lucide="chevron-right"></i></button>`).join("")}</div>` : EmptyOperationsState("calendar-check", "Agenda livre", "Sem compromissos próximos."));
        if (window.lucide?.createIcons) lucide.createIcons();
    }

    function ativarComTeclado(evento, id) {
        if (["Enter", " "].includes(evento.key)) { evento.preventDefault(); abrirPrioridade(id); }
    }
    function ativarRotaComTeclado(evento, rota) {
        if (["Enter", " "].includes(evento.key)) { evento.preventDefault(); abrirRota(rota); }
    }

    function atualizarRelogiosProducao() {
        if (!document.querySelector(".operationsCenter")) return;
        const lotes = typeof Storage?.listarLotesExecucao === "function" ? Storage.listarLotesExecucao() : [];
        lotes.filter(l => STATUS_ATIVOS.has(l.status)).forEach(lote => {
            const progresso = calcularProgresso(lote);
            const id = String(lote.id).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
            const barra = document.querySelector(`[data-progress-bar="${id}"]`);
            const valor = document.querySelector(`[data-progress-value="${id}"]`);
            const previsao = document.querySelector(`[data-forecast="${id}"]`);
            if (barra && progresso !== null) barra.style.width = `${progresso}%`;
            if (valor && progresso !== null) valor.textContent = `${Math.round(progresso)}%`;
            if (previsao) previsao.textContent = previsaoLote(lote).texto;
        });
    }

    function agendarAtualizacaoProducao() {
        clearInterval(timerProducao);
        timerProducao = setInterval(atualizarRelogiosProducao, 60000);
    }

    window.CentralOperacoes = {
        render,
        calcularPrioridades,
        listarProximosPassos,
        getPrinterImage,
        calcularProgresso,
        previsaoLote,
        abrirRota,
        abrirPrioridade,
        abrirMenuPrioridade,
        concluirPrioridade,
        abrirTodasPrioridades,
        abrirAgenda,
        ativarComTeclado,
        ativarRotaComTeclado,
        atualizarRelogiosProducao,
        _lerDados: lerDados,
        _calcularResumo: calcularResumo
    };
    window.renderDashboard = render;
})();
