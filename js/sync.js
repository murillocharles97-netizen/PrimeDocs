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
        { nome: "estoques", tipo: "lista", obter: () => Storage.listarEstoquesLojas(), salvar: lista => Storage.salvarEstoquesLojas(lista) },
        { nome: "consignados", tipo: "lista", obter: () => Storage.listarConsignados(), salvar: lista => localStorage.setItem(Storage.KEYS.consignados, JSON.stringify(lista)) },
        { nome: "conferencias", tipo: "lista", obter: () => Storage.listarConferencias(), salvar: lista => localStorage.setItem(Storage.KEYS.conferencias, JSON.stringify(lista)) },
        { nome: "filamentos", tipo: "lista", obter: () => Storage.listarFilamentos(), salvar: lista => Storage.salvarFilamentos(lista) },
        { nome: "custos", tipo: "objeto", obter: () => Storage.carregarConfigCustos(), salvar: valor => Storage.salvarConfigCustos(valor || {}) },
        { nome: "empresas", tipo: "lista", obter: () => Storage.listarEmpresas(), salvar: lista => Storage.salvarEmpresas(lista) },
        { nome: "orcamentos", tipo: "lista", obter: () => Storage.listarOrcamentos(), salvar: lista => Storage.salvarOrcamentos(lista) },
        { nome: "pagamentos", tipo: "lista", obter: () => Storage.listarPagamentos(), salvar: lista => Storage.salvarPagamentos(lista) },
        { nome: "notificacoes", tipo: "lista", obter: () => Storage.listarNotificacoes(), salvar: lista => Storage.salvarNotificacoes(lista) },
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

        const db = PrimeFirebase.db;
        const userRef = db.collection("users").doc(user.uid);
        let snap = null;

        try {
            snap = await userRef.get();
        } catch (erro) {
            if (workspaceId) {
                console.warn("[PrimeDocs] Perfil remoto indisponível. Usando workspace local em cache.", erro);
                return workspaceId;
            }
            throw erro;
        }

        if (snap.exists && snap.data()?.workspaceAtual) {
            const dadosUsuario = snap.data();
            workspaceId = dadosUsuario.workspaceAtual;
            localStorage.setItem(WORKSPACE_KEY, workspaceId);
            await garantirMembroWorkspace(user, workspaceId);
            return workspaceId;
        }

        workspaceId = `workspace-${user.uid}`;
        const agora = firebase.firestore.FieldValue.serverTimestamp();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const membroRef = workspaceRef.collection("membros").doc(user.uid);

        await userRef.set({
            nome: user.displayName || "",
            email: user.email || "",
            workspaceAtual: workspaceId,
            workspacesPermitidos: [workspaceId],
            criadoEm: agora,
            atualizadoEm: agora
        }, { merge: true });

        await workspaceRef.set({
            nome: "PrimeLine 3D",
            criadoPor: user.uid,
            criadoEm: agora,
            atualizadoEm: agora
        }, { merge: true });

        await membroRef.set({
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || "",
            papel: "admin",
            ativo: true,
            criadoEm: agora,
            atualizadoEm: agora
        }, { merge: true });

        localStorage.setItem(WORKSPACE_KEY, workspaceId);
        return workspaceId;
    }

    async function garantirMembroWorkspace(user, idWorkspace) {
        if (!user || !idWorkspace || !PrimeFirebase.disponivel()) return;

        const db = PrimeFirebase.db;
        const agora = firebase.firestore.FieldValue.serverTimestamp();
        const workspaceRef = db.collection("workspaces").doc(idWorkspace);
        const membroRef = workspaceRef.collection("membros").doc(user.uid);

        const dadosMembro = {
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || "",
            papel: "admin",
            ativo: true,
            atualizadoEm: agora
        };

        try {
            await membroRef.set(dadosMembro, { merge: true });
        } catch (erro) {
            if (idWorkspace !== `workspace-${user.uid}`) throw erro;

            await workspaceRef.set({
                nome: "PrimeLine 3D",
                criadoPor: user.uid,
                criadoEm: agora,
                atualizadoEm: agora
            }, { merge: true });

            await membroRef.set({
                ...dadosMembro,
                criadoEm: agora
            }, { merge: true });
        }
    }

    async function carregarFirestoreParaLocal(opcoes = {}) {
        if (!podeSincronizar()) return false;
        setStatus("Sincronizando dados...");

        try {
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
                    Toast.show("Dados locais enviados para a nuvem!");
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
                    Toast.show("Dados deste dispositivo enviados para a nuvem!");
                } else {
                    setStatus("Sincronização pausada");
                }
                return true;
            }

            await enviarLocalParaNuvem({ silencioso: true });
            return true;
        } catch (erro) {
            console.error("Erro ao carregar Firestore.", erro);
            marcarPendente();
            setStatus("Modo offline");
            return false;
        }
    }

    async function sincronizarAgora() {
        return enviarLocalParaNuvem({ silencioso: true });
    }

    async function enviarLocalParaNuvem(opcoes = {}) {
        if (restaurando) return false;
        if (!podeSincronizar()) {
            marcarPendente();
            if (!opcoes.silencioso) Toast.show("Sem conexão para sincronizar agora.");
            return false;
        }

        sincronizando = true;
        setStatus("Salvando online...");

        try {
            const batch = PrimeFirebase.db.batch();
            const agora = firebase.firestore.FieldValue.serverTimestamp();
            COLLECTIONS.forEach(colecao => {
                const dados = colecao.tipo === "lista"
                    ? { itens: colecao.obter(), atualizadoEm: agora }
                    : { valor: colecao.obter(), atualizadoEm: agora };
                batch.set(docRef(colecao.nome), dados, { merge: true });
            });
            batch.set(PrimeFirebase.db.collection("workspaces").doc(workspaceId), {
                atualizadoEm: agora,
                nome: Storage.buscarEmpresaPadrao()?.nome || "PrimeLine 3D"
            }, { merge: true });
            await batch.commit();
            localStorage.setItem(PENDENTE_KEY, "false");
            setStatus("Online");
            if (!opcoes.silencioso) Toast.show("Dados locais enviados para a nuvem!");
            return true;
        } catch (erro) {
            console.error("Erro ao sincronizar Firestore.", erro);
            marcarPendente();
            setStatus("Pendente de sincronização");
            return false;
        } finally {
            sincronizando = false;
        }
    }

    async function baixarNuvemParaLocal(opcoes = {}) {
        if (!podeSincronizar()) {
            marcarPendente();
            Toast.show("Sem conexão para baixar dados da nuvem.");
            return false;
        }

        try {
            setStatus("Baixando dados da nuvem...");
            const remoto = await obterSnapshotRemoto();
            if (!temDadosReais(remoto)) {
                Toast.show("Nenhum dado encontrado na nuvem.");
                setStatus("Online");
                return false;
            }

            aplicarSnapshotRemotoNoLocal(remoto);
            localStorage.setItem(PENDENTE_KEY, "false");
            setStatus("Dados sincronizados");
            if (!opcoes.silencioso) Toast.show("Dados da nuvem baixados!");
            return true;
        } catch (erro) {
            console.error("Erro ao baixar dados da nuvem.", erro);
            marcarPendente();
            setStatus("Pendente de sincronizaÃ§Ã£o");
            Toast.show("Não foi possível baixar os dados da nuvem.");
            return false;
        }
    }

    async function sincronizarComResolucaoManual() {
        return carregarFirestoreParaLocal({ manual: true });
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
            "salvarConfigCustos", "salvarConfiguracoes", "restaurarDados", "importarBackup"
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
        const docs = await Promise.all(COLLECTIONS.map(async colecao => {
            const snap = await docRef(colecao.nome).get();
            return [colecao, snap.exists ? snap.data() : null];
        }));

        return docs.reduce((dados, [colecao, remoto]) => {
            if (colecao.tipo === "lista") {
                dados[colecao.nome] = Array.isArray(remoto?.itens) ? remoto.itens : [];
            } else {
                dados[colecao.nome] = remoto?.valor && typeof remoto.valor === "object" && !Array.isArray(remoto.valor)
                    ? remoto.valor
                    : {};
            }
            return dados;
        }, {});
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

    function escaparSync(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function docRef(nome) {
        return PrimeFirebase.db
            .collection("workspaces")
            .doc(workspaceId)
            .collection(nome)
            .doc("dados");
    }

    function podeSincronizar() {
        return Boolean(usuario && workspaceId && navigator.onLine && PrimeFirebase.disponivel());
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
            usuario,
            workspaceId,
            pendente: localStorage.getItem(PENDENTE_KEY) === "true"
        };
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
        agendarSync,
        interceptarStorage,
        obterEstado
    };
})();

window.PrimeSync = PrimeSync;
