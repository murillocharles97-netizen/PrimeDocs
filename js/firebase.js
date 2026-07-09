const firebaseConfig = {
    apiKey: "AIzaSyDQHdXKcBmQvGT1zVRSFaV4-vsu48zSppc",
    authDomain: "primedocs-3e6c3.firebaseapp.com",
    projectId: "primedocs-3e6c3",
    storageBucket: "primedocs-3e6c3.firebasestorage.app",
    messagingSenderId: "1066491257779",
    appId: "1:1066491257779:web:56f84e968b89b9173be1c6",
    measurementId: "G-QB1M4VQMZH"
};

const PrimeFirebase = (() => {
    let app = null;
    let auth = null;
    let db = null;
    let inicializado = false;

    function iniciar() {
        if (inicializado) return { app, auth, db };

        if (!window.firebase?.initializeApp) {
            console.warn("Firebase SDK não carregado.");
            return { app: null, auth: null, db: null };
        }

        app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        inicializado = true;

        try {
            db.settings({ ignoreUndefinedProperties: true });
        } catch (erro) {
            // O Firestore só permite settings antes do primeiro uso; se já iniciou, seguimos sem interromper o app.
        }

        try {
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (erro) {
            console.warn("Não foi possível configurar persistência local do Auth.", erro);
        }

        try {
            db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (erro) {
            console.warn("Persistência offline do Firestore indisponível.", erro);
        }

        return { app, auth, db };
    }

    function disponivel() {
        return Boolean(iniciar().auth && iniciar().db);
    }

    return {
        iniciar,
        disponivel,
        get auth() {
            return iniciar().auth;
        },
        get db() {
            return iniciar().db;
        }
    };
})();
