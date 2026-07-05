/* ==========================================
   PrimeDocs
   utils.js
========================================== */

const Utils = {

    gerarId() {

        return Date.now();

    },



    gerarCodigo(categoria) {

        const prefixos = {

            "Chaveiro": "CH",
            "Caixa": "CX",
            "Boneco": "BN",
            "Luminária": "LU",
            "Playbook": "PB",
            "Bandeja": "BD",
            "Outro": "OT"

        };

        const prefixo = prefixos[categoria] || "PD";

        const numero = Math.floor(Math.random() * 9000) + 1000;

        return `${prefixo}${numero}`;

    },



    moeda(valor) {

        return Number(valor).toLocaleString(

            "pt-BR",

            {

                style: "currency",

                currency: "BRL"

            }

        );

    },



    hoje() {

        return new Date().toISOString().split("T")[0];

    }

};