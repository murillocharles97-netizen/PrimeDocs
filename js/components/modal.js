/* ==========================================
   PrimeDocs
   Modal Component
========================================== */

const Modal = {

    abrir(titulo, conteudo){

        let root = document.getElementById("modalRoot");

        if(!root){

            root = document.createElement("div");

            root.id = "modalRoot";

            document.body.appendChild(root);

        }

        document.body.classList.add("modalOpen");
        root.innerHTML = `

        <div class="modalOverlay" onclick="Modal.fechar(event)">

            <div class="modalContainer" role="dialog" aria-modal="true" aria-labelledby="primeDocsModalTitle" onclick="event.stopPropagation()">

                <span class="modalHandle" aria-hidden="true"></span>

                <div class="modalHeader">

                    <h2 id="primeDocsModalTitle">${titulo}</h2>

                    <button class="modalClose" type="button" onclick="Modal.fechar()" aria-label="Fechar janela">

                        <i data-lucide="x"></i>

                    </button>

                </div>

                <div class="modalBody">

                    ${conteudo}

                </div>

            </div>

        </div>

        `;

        lucide.createIcons();
        root.querySelector(".modalClose")?.focus();

    },



    fechar(event){

        if(event){

            if(event.target.classList.contains("modalOverlay")){

                document.getElementById("modalRoot").innerHTML="";
                document.body.classList.remove("modalOpen");

            }

            return;

        }

        document.getElementById("modalRoot").innerHTML="";
        document.body.classList.remove("modalOpen");

    }

};

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("modalRoot")?.innerHTML) Modal.fechar();
});
