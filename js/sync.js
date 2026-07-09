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
        { nome: "configuracoes", tipo: "objeto", obter: () => Storage.carregarConfiguracoes(), salvar: valor => Storage.salvarConfiguracoes(valor || {}) }
    ];

    let usuario = null;
    let workspaceId = localStorage.getItem(WORKSPACE_KEY) || "";
    let sincronizando = false;
    let restaurando = false;
    let timer = null;
    let storageInterceptado = false;

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
            workspaceId = snap.data().workspaceAtual;
            localStorage.setItem(WORKSPACE_KEY, workspaceId);
            return workspaceId;
        }

        workspaceId = `workspace-${user.uid}`;
        const agora = firebase.firestore.FieldValue.serverTimestamp();
        await userRef.set({
            nome: user.displayName || "",
            email: user.email || "",
            workspaceAtual: workspaceId,
            workspacesPermitidos: [workspaceId],
            criadoEm: agora,
            atualizadoEm: agora
        }, { merge: true });
        await db.collection("workspaces").doc(workspaceId).set({
            nome: "PrimeLine 3D",
            criadoPor: user.uid,
            criadoEm: agora,
            atualizadoEm: agora
        }, { merge: true });

        localStorage.setItem(WORKSPACE_KEY, workspaceId);
        return workspaceId;
    }

    async function carregarFirestoreParaLocal() {
        if (!podeSincronizar()) return false;
        setStatus("Sincronizando dados...");
        restaurando = true;

        try {
            const docs = await Promise.all(COLLECTIONS.map(async colecao => {
                const snap = await docRef(colecao.nome).get();
                return [colecao, snap.exists ? snap.data() : null];
            }));

            const existeRemoto = docs.some(([, dados]) => dados && (Array.isArray(dados.itens) || dados.valor !== undefined));

            if (!existeRemoto) {
                restaurando = false;
                await sincronizarAgora();
                return true;
            }

            docs.forEach(([colecao, dados]) => {
                if (!dados) return;
                if (colecao.tipo === "lista") colecao.salvar(Array.isArray(dados.itens) ? dados.itens : []);
                if (colecao.tipo === "objeto") colecao.salvar(dados.valor || {});
            });

            localStorage.setItem(PENDENTE_KEY, "false");
            setStatus("Dados sincronizados");
            return true;
        } catch (erro) {
            console.error("Erro ao carregar Firestore.", erro);
            marcarPendente();
            setStatus("Modo offline");
            return false;
        } finally {
            restaurando = false;
        }
    }

    async function sincronizarAgora() {
        if (restaurando) return false;
        if (!podeSincronizar()) {
            marcarPendente();
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
        agendarSync,
        interceptarStorage,
        obterEstado
    };
})();

window.PrimeSync = PrimeSync;
