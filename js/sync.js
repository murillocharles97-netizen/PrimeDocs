const PrimeSync = (() => {
    const PENDENTE_KEY = "primedocs_sync_pendente";
    const WORKSPACE_KEY = "primedocs_workspace_atual";
    const USER_KEY = "primedocs_usuario_atual";

    const COLLECTIONS = [
        { nome: "produtos", tipo: "lista", obter: () => Storage.listarProdutos(), salvar: lista => Storage.salvarProdutos(lista) },
        { nome: "clientes", tipo: "lista", obter: () => Storage.listarClientes(), salvar: lista => Storage.salvarClientes(lista) },
        { nome: "pedidos", tipo: "lista", obter: () => Storage.listarPedidos(), salvar: lista => Storage.salvarPedidos(lista) },
        { nome: "financeiro", tipo: "lista", obter: () => Storage.listarLancamentosFinanceiros(), salvar: lista => Storage.salvarLancamentosFinanceiros(lista) },
        { nome: "lojas", tipo: "lista", obter: () => Storage.listarLojas(), salvar: lista => Storage.salvarLojas(lista) },
        { nome: "estoques", tipo: "lista", obter: () => Storage.listarEstoquesLojas(), salvar: lista => Storage.salvarEstoquesLojas(lista), idCampo: "lojaId" },
        { nome: "consignados", tipo: "lista", obter: () => Storage.listarConsignados(), salvar: lista => localStorage.setItem(Storage.KEYS.consignados, JSON.stringify(lista)) },
        { nome: "conferencias", tipo: "lista", obter: () => Storage.listarConferencias(), salvar: lista => localStorage.setItem(Storage.KEYS.conferencias, JSON.stringify(lista)) },
        { nome: "filamentos", tipo: "lista", obter: () => Storage.listarFilamentos(), salvar: lista => Storage.salvarFilamentos(lista) },
        { nome: "empresas", tipo: "lista", obter: () => Storage.listarEmpresas(), salvar: lista => Storage.salvarEmpresas(lista) },
        { nome: "orcamentos", tipo: "lista", obter: () => Storage.listarOrcamentos(), salvar: lista => Storage.salvarOrcamentos(lista) },
        { nome: "pagamentos", tipo: "lista", obter: () => Storage.listarPagamentos(), salvar: lista => Storage.salvarPagamentos(lista) },
        { nome: "notificacoes", tipo: "lista", obter: () => Storage.listarNotificacoes(), salvar: lista => Storage.salvarNotificacoes(lista) },
        { nome: "custos", tipo: "objeto", obter: () => Storage.carregarConfigCustos(), salvar: valor => Storage.salvarConfigCustos(valor || {}) },
        { nome: "gerador3d", tipo: "objeto", obter: () => Storage.carregarConfigGerador3D(), salvar: valor => Storage.salvarConfigGerador3D(valor || {}) },
        { nome: "configuracoes", tipo: "objeto", obter: () => Storage.carregarConfiguracoes(), salvar: valor => Storage.salvarConfiguracoes(valor || {}) }
    ];

    const COLECOES_COM_DADOS_REAIS = [
        "produtos",
        "clientes",
        "pedidos",
        "financeiro",
        "lojas",
        "estoques",
        "consignados",
        "conferencias",
        "filamentos",
        "empresas",
        "orcamentos",
        "pagamentos",
        "notificacoes"
    ];

    let usuario = null;
    let workspaceId = localStorage.getItem(WORKSPACE_KEY) || "";
    let sincronizando = false;
    let restaurando = false;
    let timer = null;
    let storageInterceptado = false;
    let resolverEscolhaSync = null;

    async function prepararUsuario(user) {
        usuario = user;
        localStorage.setItem(USER_KEY, JSON.stringify({
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || ""
        }));

        if (!PrimeFirebase.disponivel()) throw new Error("Firebase indisponível.");

        const id = await garantirContextoSync();
        return id;
    }

    async function garantirContextoSync() {
        if (!PrimeFirebase.disponivel()) throw new Error("Firebase indisponível.");

        const user = PrimeFirebase.auth?.currentUser || usuario;
        if (!user) throw new Error("Usuário não autenticado.");

        usuario = user;

        const db = PrimeFirebase.db;
        const agora = firebase.firestore.FieldValue.serverTimestamp();
        const userRef = db.collection("users").doc(user.uid);
        const userSnap = await userRef.get();
        const dadosUsuario = userSnap.exists ? userSnap.data() : {};

        workspaceId = dadosUsuario?.workspaceAtual || workspaceId || `workspace-${user.uid}`;
        localStorage.setItem(WORKSPACE_KEY, workspaceId);
        localStorage.setItem(USER_KEY, JSON.stringify({
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || ""
        }));

        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const membroRef = workspaceRef.collection("membros").doc(user.uid);

        await workspaceRef.set({
            nome: Storage.buscarEmpresaPadrao()?.nome || "PrimeLine 3D",
            criadoPor: dadosUsuario?.criadoPor || user.uid,
            criadoEm: dadosUsuario?.criadoEm || agora,
            atualizadoEm: agora
        }, { merge: true });

        await membroRef.set({
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || "",
            papel: "admin",
            ativo: true,
            atualizadoEm: agora
        }, { merge: true });

        await userRef.set({
            nome: user.displayName || "",
            email: user.email || "",
            workspaceAtual: workspaceId,
            workspacesPermitidos: firebase.firestore.FieldValue.arrayUnion(workspaceId),
            atualizadoEm: agora
        }, { merge: true });

        console.log("[PrimeDocs Sync] Contexto pronto", {
            uid: user.uid,
            email: user.email,
            workspaceId
        });

        return workspaceId;
    }

    async function carregarFirestoreParaLocal(opcoes = {}) {
        if (!navigator.onLine) {
            marcarPendente();
            setStatus("Offline");
            return false;
        }

        try {
            await garantirContextoSync();
            setStatus("Sincronizando dados...");

            const local = obterSnapshotLocal();
            const remoto = await obterSnapshotRemoto();
            const localTemDados = temDadosReais(local);
            const remotoTemDados = temDadosReais(remoto);

            if (!remotoTemDados && localTemDados) {
                const escolha = await solicitarEscolhaSync({
                    titulo: "Enviar dados para a nuvem?",
                    texto: "Encontramos dados locais neste dispositivo. Deseja enviar para a nuvem?",
                    botoes: [
                        { acao: "cancelar", rotulo: "Cancelar", classe: "btnSecondary" },
                        { acao: "local", rotulo: "Enviar para nuvem", classe: "btn" }
                    ]
                });

                if (escolha === "local") {
                    await enviarLocalParaNuvem({ silencioso: true });
                    Toast.show(criarMensagemResumo("Enviado", resumoSnapshot(local)));
                } else {
                    setStatus("Sincronização pausada");
                }
                return true;
            }

            if (remotoTemDados && !localTemDados) {
                aplicarSnapshotRemotoNoLocal(remoto);
                localStorage.setItem(PENDENTE_KEY, "false");
                setStatus("Dados sincronizados");
                if (opcoes.manual) Toast.show("Dados da nuvem baixados!");
                return true;
            }

            if (remotoTemDados && localTemDados && snapshotsPrincipaisIguais(local, remoto)) {
                localStorage.setItem(PENDENTE_KEY, "false");
                setStatus("Dados sincronizados");
                return true;
            }

            if (remotoTemDados && localTemDados) {
                const escolha = await solicitarEscolhaSync({
                    titulo: "Escolher fonte dos dados",
                    texto: "Existem dados neste dispositivo e na nuvem. O que deseja fazer?",
                    botoes: [
                        { acao: "nuvem", rotulo: "Usar dados da nuvem", classe: "btnSecondary" },
                        { acao: "local", rotulo: "Enviar dados deste dispositivo", classe: "btn" },
                        { acao: "mesclar", rotulo: "Mesclar dados", classe: "btnSecondary", disabled: true, dica: "Em breve" }
                    ]
                });

                if (escolha === "nuvem") {
                    aplicarSnapshotRemotoNoLocal(remoto);
                    Toast.show("Dados da nuvem aplicados neste dispositivo!");
                } else if (escolha === "local") {
                    await enviarLocalParaNuvem({ silencioso: true });
                    Toast.show(criarMensagemResumo("Enviado", resumoSnapshot(local)));
                } else {
                    setStatus("Sincronização pausada");
                }
                return true;
            }

            setStatus("Online");
            return true;
        } catch (erro) {
            console.error("[PrimeDocs Sync] Erro ao carregar Firestore.", erro);
            marcarPendente();
            setStatus("Modo offline");
            Toast.show(erro?.message || "Erro ao sincronizar com a nuvem.");
            return false;
        }
    }

    async function sincronizarAgora() {
        return enviarLocalParaNuvem({ silencioso: true });
    }

    async function enviarLocalParaNuvem(opcoes = {}) {
        if (restaurando) return false;

        try {
            if (!navigator.onLine) throw new Error("Sem conexão com a internet.");
            await garantirContextoSync();

            const local = obterSnapshotLocal();
            const resumo = resumoSnapshot(local);

            if (!temDadosReais(local)) {
                throw new Error("Nenhum dado local encontrado para enviar.");
            }

            sincronizando = true;
            setStatus("Salvando online...");

            console.log("[PrimeDocs Sync] Enviando LocalStorage para Firestore", {
                uid: usuario?.uid,
                email: usuario?.email,
                workspaceId,
                caminhoBase: `workspaces/${workspaceId}`,
                resumo
            });

            for (const colecao of COLLECTIONS) {
                await substituirColecaoNaNuvem(colecao, local[colecao.nome]);
            }

            await workspaceRef().set({
                nome: Storage.buscarEmpresaPadrao()?.nome || "PrimeLine 3D",
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                ultimoSyncOrigem: "local"
            }, { merge: true });

            localStorage.setItem(PENDENTE_KEY, "false");
            setStatus("Online");

            console.log("[PrimeDocs Sync] Upload concluído", resumo);
            if (!opcoes.silencioso) Toast.show(criarMensagemResumo("Enviado", resumo));
            return true;
        } catch (erro) {
            console.error("[PrimeDocs Sync] Erro ao enviar dados locais para nuvem.", erro);
            marcarPendente();
            setStatus("Erro na sincronização");
            Toast.show(erro?.message || "Não foi possível enviar os dados para a nuvem.");
            return false;
        } finally {
            sincronizando = false;
        }
    }

    async function baixarNuvemParaLocal(opcoes = {}) {
        try {
            if (!navigator.onLine) throw new Error("Sem conexão com a internet.");
            await garantirContextoSync();

            setStatus("Baixando dados da nuvem...");
            const remoto = await obterSnapshotRemoto();
            const resumo = resumoSnapshot(remoto);

            console.log("[PrimeDocs Sync] Baixando Firestore para LocalStorage", {
                uid: usuario?.uid,
                email: usuario?.email,
                workspaceId,
                caminhoBase: `workspaces/${workspaceId}`,
                resumo
            });

            if (!temDadosReais(remoto)) {
                throw new Error("Nenhum dado encontrado na nuvem.");
            }

            aplicarSnapshotRemotoNoLocal(remoto);
            localStorage.setItem(PENDENTE_KEY, "false");
            setStatus("Dados sincronizados");

            if (!opcoes.silencioso) Toast.show("Dados baixados da nuvem com sucesso.");
            return true;
        } catch (erro) {
            console.error("[PrimeDocs Sync] Erro ao baixar dados da nuvem.", erro);
            marcarPendente();
            setStatus("Erro na sincronização");
            Toast.show(erro?.message || "Não foi possível baixar os dados da nuvem.");
            return false;
        }
    }

    async function sincronizarComResolucaoManual() {
        return carregarFirestoreParaLocal({ manual: true });
    }

    async function diagnostico() {
        const resultado = {
            firebaseAppOk: false,
            firestoreOk: false,
            usuarioLogado: false,
            uid: "",
            email: "",
            workspaceAtual: "",
            dadosLocais: {},
            leituraOk: false,
            escritaOk: false,
            caminhoTeste: ""
        };

        try {
            resultado.firebaseAppOk = Boolean(PrimeFirebase.iniciar()?.app);
            resultado.firestoreOk = PrimeFirebase.disponivel();
            const user = PrimeFirebase.auth?.currentUser || usuario;
            resultado.usuarioLogado = Boolean(user);
            resultado.uid = user?.uid || "";
            resultado.email = user?.email || "";
            resultado.dadosLocais = resumoSnapshot(obterSnapshotLocal());

            console.group("[PrimeDocs Sync] Diagnóstico da nuvem");
            console.log("Firebase app ok:", resultado.firebaseAppOk);
            console.log("Firestore ok:", resultado.firestoreOk);
            console.log("Usuário logado:", resultado.usuarioLogado);
            console.log("UID:", resultado.uid);
            console.log("E-mail:", resultado.email);
            console.log("Dados locais encontrados:", resultado.dadosLocais);

            if (!user) throw new Error("Usuário não autenticado.");

            await garantirContextoSync();
            resultado.workspaceAtual = workspaceId;
            resultado.caminhoTeste = `workspaces/${workspaceId}/_debug/teste`;
            console.log("Workspace atual:", workspaceId);

            const testeRef = workspaceRef().collection("_debug").doc("teste");
            await testeRef.set({
                uid: user.uid,
                email: user.email || "",
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                origem: "PrimeDocs diagnostico"
            }, { merge: true });
            resultado.escritaOk = true;

            const testeSnap = await testeRef.get();
            resultado.leituraOk = testeSnap.exists;

            console.log("Permissão de escrita:", resultado.escritaOk);
            console.log("Permissão de leitura:", resultado.leituraOk);
            console.log("Caminho de teste:", resultado.caminhoTeste);
            console.groupEnd();

            Toast.show("Diagnóstico concluído. Veja o console.");
            return resultado;
        } catch (erro) {
            console.error("[PrimeDocs Sync] Diagnóstico falhou.", erro, resultado);
            console.groupEnd?.();
            Toast.show(erro?.message || "Diagnóstico da nuvem falhou.");
            return resultado;
        }
    }

    function agendarSync() {
        if (restaurando || sincronizando) return;
        if (!usuario || !workspaceId || !navigator.onLine) {
            marcarPendente();
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(() => sincronizarAgora(), 900);
    }

    function interceptarStorage() {
        if (storageInterceptado || !window.Storage) return;
        storageInterceptado = true;
        [
            "salvarProdutos", "adicionarProduto", "atualizarProduto", "excluirProduto", "salvarProduto",
            "salvarLojas", "salvarLoja", "excluirLoja", "salvarEstoquesLojas", "salvarEstoqueLoja",
            "salvarConsignado", "salvarConferencia",
            "salvarEmpresas", "salvarEmpresa", "definirEmpresaPadrao", "excluirEmpresa",
            "salvarClientes", "salvarCliente", "excluirCliente",
            "salvarPedidos", "salvarPedido", "excluirPedido",
            "salvarOrcamentos", "salvarOrcamento",
            "salvarPagamentos", "salvarPagamento",
            "salvarLancamentosFinanceiros", "salvarLancamentoFinanceiro",
            "salvarFilamentos", "salvarFilamento", "excluirFilamento", "baixarFilamento",
            "salvarConfigCustos", "salvarConfiguracoes", "salvarConfigGerador3D", "restaurarDados", "importarBackup"
        ].forEach(nome => {
            if (typeof Storage[nome] !== "function") return;
            const original = Storage[nome].bind(Storage);
            Storage[nome] = function(...args) {
                const retorno = original(...args);
                agendarSync();
                return retorno;
            };
        });
    }

    function obterSnapshotLocal() {
        return COLLECTIONS.reduce((dados, colecao) => {
            dados[colecao.nome] = colecao.obter();
            return dados;
        }, {});
    }

    async function obterSnapshotRemoto() {
        const resultado = {};

        for (const colecao of COLLECTIONS) {
            const snap = await workspaceRef().collection(colecao.nome).get();

            if (colecao.tipo === "lista") {
                const itens = [];

                snap.forEach(doc => {
                    const dados = doc.data();
                    if (doc.id === "dados" && Array.isArray(dados?.itens)) {
                        itens.push(...dados.itens);
                        return;
                    }
                    if (!dados?._meta) itens.push({ id: dados?.id || doc.id, ...dados });
                });

                resultado[colecao.nome] = itens;
            } else {
                let valor = {};
                snap.forEach(doc => {
                    const dados = doc.data();
                    if (doc.id === "dados") valor = dados?.valor || filtrarMetadados(dados);
                });
                resultado[colecao.nome] = valor;
            }
        }

        return resultado;
    }

    function aplicarSnapshotRemotoNoLocal(snapshot) {
        restaurando = true;
        try {
            COLLECTIONS.forEach(colecao => {
                const valor = snapshot?.[colecao.nome];
                if (colecao.tipo === "lista") colecao.salvar(Array.isArray(valor) ? valor : []);
                if (colecao.tipo === "objeto") {
                    colecao.salvar(valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {});
                }
            });
        } finally {
            restaurando = false;
        }
    }

    async function substituirColecaoNaNuvem(colecao, valor) {
        const ref = workspaceRef().collection(colecao.nome);
        const existentes = await ref.get();
        const operacoes = [];
        const agora = firebase.firestore.FieldValue.serverTimestamp();

        existentes.forEach(doc => operacoes.push(batch => batch.delete(doc.ref)));

        if (colecao.tipo === "lista") {
            const lista = Array.isArray(valor) ? valor : [];
            console.log(`[PrimeDocs Sync] ${colecao.nome}: enviando ${lista.length} documentos em workspaces/${workspaceId}/${colecao.nome}`);

            lista.forEach((item, index) => {
                const id = criarIdDocumento(colecao, item, index);
                const payload = {
                    ...limparUndefined(item || {}),
                    id: item?.id || id,
                    atualizadoEmSync: agora
                };
                operacoes.push(batch => batch.set(ref.doc(id), payload, { merge: true }));
            });
        } else {
            console.log(`[PrimeDocs Sync] ${colecao.nome}: enviando documento dados em workspaces/${workspaceId}/${colecao.nome}/dados`);
            operacoes.push(batch => batch.set(ref.doc("dados"), {
                ...limparUndefined(valor || {}),
                atualizadoEmSync: agora
            }, { merge: true }));
        }

        await executarOperacoesEmLotes(operacoes);
    }

    async function executarOperacoesEmLotes(operacoes) {
        const tamanhoLote = 450;

        for (let inicio = 0; inicio < operacoes.length; inicio += tamanhoLote) {
            const batch = PrimeFirebase.db.batch();
            operacoes.slice(inicio, inicio + tamanhoLote).forEach(aplicar => aplicar(batch));
            await batch.commit();
        }
    }

    function workspaceRef() {
        if (!workspaceId) throw new Error("Workspace não definido.");
        return PrimeFirebase.db.collection("workspaces").doc(workspaceId);
    }

    function criarIdDocumento(colecao, item, index) {
        const preferido = item?.[colecao.idCampo || "id"] || item?.id || item?.codigo || item?.nome || `${colecao.nome}-${index + 1}`;
        return String(preferido)
            .trim()
            .replaceAll("/", "-")
            .replaceAll("\\", "-")
            .slice(0, 120) || `${colecao.nome}-${index + 1}`;
    }

    function resumoSnapshot(snapshot) {
        return COLLECTIONS.reduce((resumo, colecao) => {
            resumo[colecao.nome] = colecao.tipo === "lista"
                ? (Array.isArray(snapshot?.[colecao.nome]) ? snapshot[colecao.nome].length : 0)
                : (snapshot?.[colecao.nome] && Object.keys(snapshot[colecao.nome]).length ? 1 : 0);
            return resumo;
        }, {});
    }

    function criarMensagemResumo(prefixo, resumo) {
        return `${prefixo}: ${resumo.produtos || 0} produtos, ${resumo.clientes || 0} clientes, ${resumo.pedidos || 0} pedidos, ${resumo.lojas || 0} lojas.`;
    }

    function temDadosReais(snapshot) {
        return COLECOES_COM_DADOS_REAIS.some(nome => Array.isArray(snapshot?.[nome]) && snapshot[nome].length > 0);
    }

    function snapshotsPrincipaisIguais(local, remoto) {
        return COLECOES_COM_DADOS_REAIS.every(nome => {
            const localValor = Array.isArray(local?.[nome]) ? local[nome] : [];
            const remotoValor = Array.isArray(remoto?.[nome]) ? remoto[nome] : [];
            return JSON.stringify(localValor) === JSON.stringify(remotoValor);
        });
    }

    function filtrarMetadados(objeto = {}) {
        const copia = { ...objeto };
        delete copia.atualizadoEmSync;
        delete copia._meta;
        return copia;
    }

    function limparUndefined(valor) {
        if (Array.isArray(valor)) return valor.map(limparUndefined);
        if (!valor || typeof valor !== "object") return valor;

        return Object.entries(valor).reduce((obj, [chave, item]) => {
            if (item !== undefined) obj[chave] = limparUndefined(item);
            return obj;
        }, {});
    }

    function solicitarEscolhaSync({ titulo, texto, botoes }) {
        if (!window.Modal) return Promise.resolve("cancelar");

        return new Promise(resolve => {
            resolverEscolhaSync = escolha => {
                resolverEscolhaSync = null;
                Modal.fechar();
                resolve(escolha);
            };

            Modal.abrir(titulo, `
                <div class="backupWarning syncChoiceWarning">
                    <div class="backupWarningIcon"><i data-lucide="cloud"></i></div>
                    <div>
                        <strong>${escaparSync(texto)}</strong>
                        <p>Nenhum dado será apagado sem sua confirmação.</p>
                    </div>
                </div>
                <div class="backupModalActions syncChoiceActions">
                    ${botoes.map(botao => `
                        <button
                            class="${botao.classe || "btnSecondary"}"
                            type="button"
                            ${botao.disabled ? "disabled" : ""}
                            onclick="PrimeSync.responderEscolhaSync('${botao.acao}')"
                        >
                            ${escaparSync(botao.rotulo)}
                            ${botao.dica ? `<small>${escaparSync(botao.dica)}</small>` : ""}
                        </button>
                    `).join("")}
                </div>
            `);
        });
    }

    function responderEscolhaSync(escolha) {
        resolverEscolhaSync?.(escolha);
    }

    function podeSincronizar() {
        return Boolean(PrimeFirebase.disponivel() && (usuario || PrimeFirebase.auth?.currentUser) && workspaceId && navigator.onLine);
    }

    function marcarPendente() {
        localStorage.setItem(PENDENTE_KEY, "true");
    }

    function setStatus(texto) {
        const el = document.getElementById("syncStatusLabel");
        if (el) el.textContent = texto;
    }

    function obterEstado() {
        return {
            usuario: PrimeFirebase.auth?.currentUser || usuario,
            workspaceId,
            pendente: localStorage.getItem(PENDENTE_KEY) === "true"
        };
    }

    function escaparSync(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.addEventListener("online", () => {
        if (localStorage.getItem(PENDENTE_KEY) === "true") sincronizarAgora();
    });
    window.addEventListener("offline", () => setStatus("Offline"));

    return {
        prepararUsuario,
        carregarFirestoreParaLocal,
        sincronizarAgora,
        sincronizarComResolucaoManual,
        enviarLocalParaNuvem,
        baixarNuvemParaLocal,
        responderEscolhaSync,
        diagnostico,
        agendarSync,
        interceptarStorage,
        obterEstado
    };
})();

window.PrimeSync = PrimeSync;
window.Sync = PrimeSync;
