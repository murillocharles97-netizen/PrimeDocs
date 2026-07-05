const Input = {

    text(label, id, placeholder = "", valor = "") {

        return `

        <label class="inputGroup">

            <span>${label}</span>

            <input
                id="${id}"
                placeholder="${placeholder}"
                value="${valor}">

        </label>

        `;

    },



    number(label, id, valor = "") {

        return `

        <label class="inputGroup">

            <span>${label}</span>

            <input
                type="number"
                id="${id}"
                value="${valor}">

        </label>

        `;

    },



    select(label, id, opcoes, valorSelecionado = "") {

        return `

        <label class="inputGroup">

            <span>${label}</span>

            <select id="${id}">

                ${opcoes.map(op => `

                    <option
                        value="${op}"
                        ${op === valorSelecionado ? "selected" : ""}>

                        ${op}

                    </option>

                `).join("")}

            </select>

        </label>

        `;

    }

};