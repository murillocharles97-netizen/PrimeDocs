const Button = {

    primary(texto, onclick){

        return `

        <button

        class="btn"

        onclick="${onclick}">

        ${texto}

        </button>

        `;

    },



    secondary(texto, onclick){

        return `

        <button

        class="btnSecondary"

        onclick="${onclick}">

        ${texto}

        </button>

        `;

    }

};