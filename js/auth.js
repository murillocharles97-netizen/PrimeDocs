const PrimeAuth = (() => {
    let iniciado = false;

    function iniciar(onReady) {
        if (iniciado) return;
        iniciado = true;

        PrimeFirebase.iniciar();
        PrimeSync.interceptarStorage();

        if (!PrimeFirebase.disponivel()) {
            mostrarLoginPrimeDocs("Não foi possível carregar o Firebase. Verifique sua conexão.");
            return;
        }

        PrimeFirebase.auth.onAuthStateChanged(async user => {
            if (!user) {
                mostrarLoginPrimeDocs();
                return;
            }

            mostrarCarregandoAuth("Carregando seus dados...");
            try {
                await PrimeSync.prepararUsuario(user);
                await PrimeSync.carregarFirestoreParaLocal();
                esconderLoginPrimeDocs();
                onReady?.(user);
            } catch (erro) {
                console.error("Erro ao iniciar sessão.", erro);
                mostrarLoginPrimeDocs("Não foi possível carregar sua conta. Tente novamente.");
            }
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
                    <div class="brandMark brandMarkLarge"><i data-lucide="box"></i></div>
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
                    <button class="btn" type="submit">Entrar</button>
                    <button class="btnSecondary" type="button" onclick="criarContaPrimeDocs()">Criar conta</button>
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
        document.getElementById("app").style.display = "block";
    }

    async function entrar(email, senha) {
        await PrimeFirebase.auth.signInWithEmailAndPassword(email, senha);
    }

    async function criarConta(email, senha) {
        const credencial = await PrimeFirebase.auth.createUserWithEmailAndPassword(email, senha);
        await PrimeSync.prepararUsuario(credencial.user);
        await PrimeSync.sincronizarAgora();
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

    return { iniciar, entrar, criarConta, recuperarSenha, sair };
})();

async function entrarPrimeDocs(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail")?.value.trim();
    const senha = document.getElementById("authSenha")?.value;
    const feedback = document.getElementById("authFeedback");
    try {
        if (feedback) feedback.textContent = "Entrando...";
        await PrimeAuth.entrar(email, senha);
    } catch (erro) {
        if (feedback) feedback.textContent = traduzirErroFirebase(erro);
    }
}

async function criarContaPrimeDocs() {
    const email = document.getElementById("authEmail")?.value.trim();
    const senha = document.getElementById("authSenha")?.value;
    const feedback = document.getElementById("authFeedback");
    try {
        if (!email || !senha) throw new Error("Informe e-mail e senha.");
        if (feedback) feedback.textContent = "Criando conta...";
        await PrimeAuth.criarConta(email, senha);
    } catch (erro) {
        if (feedback) feedback.textContent = traduzirErroFirebase(erro);
    }
}

async function recuperarSenhaPrimeDocs() {
    const email = document.getElementById("authEmail")?.value.trim();
    const feedback = document.getElementById("authFeedback");
    try {
        if (!email) throw new Error("Informe seu e-mail para recuperar a senha.");
        await PrimeAuth.recuperarSenha(email);
        if (feedback) feedback.textContent = "E-mail de recuperação enviado.";
    } catch (erro) {
        if (feedback) feedback.textContent = traduzirErroFirebase(erro);
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
    return erro?.message || "Não foi possível concluir a operação.";
}

function escaparAuth(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
