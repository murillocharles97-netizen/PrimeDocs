const Button = {

    primary(texto, onclick){

        return `

        <button

        class="btn btn-primary"

        onclick="${onclick}">

        ${texto}

        </button>

        `;

    },



    secondary(texto, onclick){

        return `

        <button

        class="btnSecondary btn-secondary"

        onclick="${onclick}">

        ${texto}

        </button>

        `;

    },

    ghost(texto, onclick){
        return `<button class="btn-ghost" type="button" onclick="${onclick}">${texto}</button>`;
    },

    danger(texto, onclick){
        return `<button class="btn-danger" type="button" onclick="${onclick}">${texto}</button>`;
    },

    icon(icone, label, onclick){
        return `<button class="btn-icon" type="button" onclick="${onclick}" aria-label="${label}" title="${label}"><i data-lucide="${icone}"></i></button>`;
    }

};
