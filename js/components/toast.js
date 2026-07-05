const Toast = {

    show(texto){

        let toast=document.getElementById("toast");

        if(!toast){

            toast=document.createElement("div");

            toast.id="toast";

            toast.className="toast";

            document.body.appendChild(toast);

        }

        toast.innerHTML=texto;

        toast.classList.add("show");

        setTimeout(()=>{

            toast.classList.remove("show");

        },2500);

    }

};