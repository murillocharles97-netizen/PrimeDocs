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

        root.innerHTML = `

        <div class="modalOverlay" onclick="Modal.fechar(event)">

            <div class="modalContainer" onclick="event.stopPropagation()">

                <div class="modalHeader">

                    <h2>${titulo}</h2>

                    <button class="modalClose" onclick="Modal.fechar()">

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

    },



    fechar(event){

        if(event){

            if(event.target.classList.contains("modalOverlay")){

                document.getElementById("modalRoot").innerHTML="";

            }

            return;

        }

        document.getElementById("modalRoot").innerHTML="";

    }

};