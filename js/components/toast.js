let toastTimer = null;

const Toast = {

    show(texto, tipo = "info"){

        let toast=document.getElementById("toast");

        if(!toast){

            toast=document.createElement("div");

            toast.id="toast";

            toast.className="toast";

            document.body.appendChild(toast);

        }

        const tipos = ["info", "success", "error", "warning"];
        const tipoSeguro = tipos.includes(tipo) ? tipo : "info";
        toast.className = `toast ${tipoSeguro}`;
        toast.setAttribute("role", tipoSeguro === "error" ? "alert" : "status");
        toast.setAttribute("aria-live", tipoSeguro === "error" ? "assertive" : "polite");
        toast.textContent=texto;

        toast.classList.add("show");

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(()=>{

            toast.classList.remove("show");

        },2500);

    }

};
