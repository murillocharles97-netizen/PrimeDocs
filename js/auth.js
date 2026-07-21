const PrimeAuth = (() => {
    let iniciado = false;
    let entrando = false;

    function iniciar(onReady) {
        if (iniciado) return;
        iniciado = true;

        try {
            PrimeFirebase.iniciar();
            PrimeSync.interceptarStorage();
        } catch (erro) {
            console.error("[PrimeDocs] Falha ao inicializar Firebase/Auth.", erro);
            mostrarLoginPrimeDocs("Não foi possível inicializar o Firebase.");
            return;
        }

        if (!PrimeFirebase.disponivel()) {
            mostrarLoginPrimeDocs("Não foi possível carregar o Firebase. Verifique sua conexão.");
            return;
        }

        console.log("[PrimeDocs] Firebase inicializado");

        PrimeFirebase.auth.onAuthStateChanged(async user => {
            if (!user) {
                console.log("[PrimeDocs] Nenhum usuário logado");
                entrando = false;
                mostrarLoginPrimeDocs();
                return;
            }

            console.log("[PrimeDocs] Usuário logado", user.uid);
            mostrarCarregandoAuth("Carregando seus dados...");

            try {
                const estadoSync = await PrimeSync.init(user);
                console.log("[PrimeDocs] Perfil carregado");
                console.log("[PrimeDocs] Workspace carregado", estadoSync.workspaceId);
                console.log("[PrimeDocs] Dados sincronizados");

                esconderLoginPrimeDocs();
                entrando = false;
                onReady?.(user);
            } catch (erro) {
                console.error("[PrimeDocs] Erro ao iniciar sessão.", erro);
                entrando = false;
                mostrarLoginPrimeDocs("Não foi possível carregar sua conta. Tente novamente.");
                Toast.show("Não foi possível carregar sua conta.");
            }
        }, erro => {
            console.error("[PrimeDocs] Erro no listener de autenticação.", erro);
            entrando = false;
            mostrarLoginPrimeDocs("Erro ao verificar autenticação.");
        });
    }

    function mostrarLoginPrimeDocs(mensagem = "") {
        document.getElementById("splash").style.display = "none";
        document.getElementById("app").style.display = "none";
        let tela = document.getElementById("authScreen");
        if (!tela) {
            tela = document.createElement("main");
            tela.id = "authScreen";
            document.body.appendChild(tela);
        }

        tela.innerHTML = `
            <section class="authShell">
                <div class="authBrandPanel">
                    <div class="brandMark brandMarkLarge"><img class="brandSymbol" src="assets/brand-symbol-white.svg" alt=""></div>
                    <span>PRIMEDOCS CLOUD</span>
                    <h1>Gestão 3D com login e sincronização online.</h1>
                    <p>Entre para carregar seu workspace e manter LocalStorage como cache offline.</p>
                </div>
                <form class="authCard" onsubmit="entrarPrimeDocs(event)">
                    <div>
                        <span>ACESSO</span>
                        <h2>Entrar no PrimeDocs</h2>
                        <p>Use e-mail e senha para sincronizar seus dados.</p>
                    </div>
                    ${mensagem ? `<div class="authMessage">${escaparAuth(mensagem)}</div>` : ""}
                    <label>E-mail<input id="authEmail" type="email" autocomplete="email" required placeholder="voce@email.com"></label>
                    <label>Senha<input id="authSenha" type="password" autocomplete="current-password" required placeholder="Sua senha"></label>
                    <button id="authEntrarBtn" class="btn" type="submit">Entrar</button>
                    <button id="authCriarBtn" class="btnSecondary" type="button" onclick="criarContaPrimeDocs()">Criar conta</button>
                    <button class="authLinkButton" type="button" onclick="recuperarSenhaPrimeDocs()">Esqueci minha senha</button>
                    <small id="authFeedback"></small>
                </form>
            </section>
        `;
        if (window.lucide) lucide.createIcons();
    }

    function mostrarCarregandoAuth(texto) {
        document.getElementById("splash").style.display = "none";
        document.getElementById("app").style.display = "none";
        let tela = document.getElementById("authScreen");
        if (!tela) {
            tela = document.createElement("main");
            tela.id = "authScreen";
            document.body.appendChild(tela);
        }
        tela.innerHTML = `<section class="authLoading"><div class="spinner"></div><strong>${escaparAuth(texto)}</strong><span>Preparando seu workspace...</span></section>`;
    }

    function esconderLoginPrimeDocs() {
        document.getElementById("authScreen")?.remove();
    }

    async function entrar(email, senha) {
        if (entrando) return;
        entrando = true;
        await PrimeFirebase.auth.signInWithEmailAndPassword(email, senha);
    }

    async function criarConta(email, senha) {
        if (entrando) return;
        entrando = true;
        await PrimeFirebase.auth.createUserWithEmailAndPassword(email, senha);
    }

    async function recuperarSenha(email) {
        await PrimeFirebase.auth.sendPasswordResetEmail(email);
    }

    async function sair() {
        await PrimeSync.sincronizarAgora();
        localStorage.removeItem("primedocs_usuario_atual");
        await PrimeFirebase.auth.signOut();
        mostrarLoginPrimeDocs();
    }

    function liberarEntrada() {
        entrando = false;
    }

    return { iniciar, entrar, criarConta, recuperarSenha, sair, liberarEntrada };
})();

window.PrimeAuth = PrimeAuth;

async function entrarPrimeDocs(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail")?.value.trim();
    const senha = document.getElementById("authSenha")?.value;
    const feedback = document.getElementById("authFeedback");
    const botao = document.getElementById("authEntrarBtn");

    try {
        if (feedback) feedback.textContent = "Entrando...";
        if (botao) {
            botao.disabled = true;
            botao.textContent = "Entrando...";
        }
        await PrimeAuth.entrar(email, senha);
        if (feedback) feedback.textContent = "Login confirmado. Carregando dados...";
    } catch (erro) {
        PrimeAuth.liberarEntrada();
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Entrar";
        }
        const mensagem = traduzirErroFirebase(erro);
        if (feedback) feedback.textContent = mensagem;
        Toast.show(mensagem);
    }
}

async function criarContaPrimeDocs() {
    const email = document.getElementById("authEmail")?.value.trim();
    const senha = document.getElementById("authSenha")?.value;
    const feedback = document.getElementById("authFeedback");
    const botao = document.getElementById("authCriarBtn");

    try {
        if (!email || !senha) throw new Error("Informe e-mail e senha.");
        if (feedback) feedback.textContent = "Criando conta...";
        if (botao) {
            botao.disabled = true;
            botao.textContent = "Criando...";
        }
        await PrimeAuth.criarConta(email, senha);
        if (feedback) feedback.textContent = "Conta criada. Carregando workspace...";
    } catch (erro) {
        PrimeAuth.liberarEntrada();
        if (botao) {
            botao.disabled = false;
            botao.textContent = "Criar conta";
        }
        const mensagem = traduzirErroFirebase(erro);
        if (feedback) feedback.textContent = mensagem;
        Toast.show(mensagem);
    }
}

async function recuperarSenhaPrimeDocs() {
    const email = document.getElementById("authEmail")?.value.trim();
    const feedback = document.getElementById("authFeedback");
    try {
        if (!email) throw new Error("Informe seu e-mail para recuperar a senha.");
        await PrimeAuth.recuperarSenha(email);
        if (feedback) feedback.textContent = "E-mail de recuperação enviado.";
        Toast.show("E-mail de recuperação enviado.");
    } catch (erro) {
        const mensagem = traduzirErroFirebase(erro);
        if (feedback) feedback.textContent = mensagem;
        Toast.show(mensagem);
    }
}

async function sairPrimeDocs() {
    try {
        await PrimeAuth.sair();
        Toast.show("Você saiu do PrimeDocs.");
    } catch (erro) {
        Toast.show("Não foi possível sair agora.");
    }
}

function traduzirErroFirebase(erro) {
    const codigo = erro?.code || "";
    if (codigo.includes("invalid-login-credentials") || codigo.includes("wrong-password")) return "E-mail ou senha inválidos.";
    if (codigo.includes("user-not-found")) return "Conta não encontrada.";
    if (codigo.includes("email-already-in-use")) return "Este e-mail já está cadastrado.";
    if (codigo.includes("weak-password")) return "Use uma senha com pelo menos 6 caracteres.";
    if (codigo.includes("network-request-failed")) return "Sem conexão com o Firebase.";
    if (codigo.includes("permission-denied")) return "Sem permissão no Firestore. Verifique as regras do Firebase.";
    if (codigo.includes("too-many-requests")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    return erro?.message || "Não foi possível concluir a operação.";
}

function escaparAuth(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
