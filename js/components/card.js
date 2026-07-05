/* ==========================================
   PrimeDocs
   Card Component
========================================== */

function criarCard(icone, titulo, descricao, pagina) {

    return `

    <div class="menuCard" onclick="navegar('${pagina}')">

        <div class="icon">

            <i data-lucide="${icone}"></i>

        </div>

        <div class="menuInfo">

            <h3>${titulo}</h3>

            <span>${descricao}</span>

        </div>

        <i class="arrow" data-lucide="chevron-right"></i>

    </div>

    `;

}