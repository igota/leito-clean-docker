document.addEventListener("DOMContentLoaded", async () => {
    const setoresContainer = document.getElementById("setoresContainer");
    const setoresRaw = localStorage.getItem("setores");

    const banner = document.getElementById("bannerLimpezaAtiva");
    const bannerTexto = document.getElementById("bannerTexto");
    const voltarLimpezaBtn = document.getElementById("voltarLimpezaBtn");

    // 🔹 Parte setores
    if (!setoresRaw) {
        setoresContainer.innerHTML = "<p style='color:red;'>Nenhum setor encontrado.</p>";
        return;
    }

    const setores = JSON.parse(setoresRaw);
    if (setores.length === 0) {
        setoresContainer.innerHTML = "<p style='color:red;'>Nenhum setor disponível.</p>";
        return;
    }

    setores.forEach(setor => {
        const btn = document.createElement("button");
        btn.className = "btnSetor";
        btn.textContent = setor;
        btn.onclick = () => {
            localStorage.setItem("setor_selecionado", setor);
            window.location.href = "/tablet_leitos";
        };
        setoresContainer.appendChild(btn);
    });

   // ===============================
    // 🔹 BANNER LIMPEZA ATIVA
    // ===============================
    try {
        const response = await fetch("/api/limpeza_ativa_por_ip");
        const data = await response.json();

        if (data.existe && data.limpezas.length > 0) {
            bannerTexto.innerHTML = data.limpezas
                .map(l => `🫧 ${l.setor} • ${l.numero_leito}`)
                .join(" ");

            banner.classList.remove("oculto");
            document.body.classList.add("banner-visivel");

            const irParaLimpeza = () => {
                window.location.href = "/tablet_limpeza_ativa";
            };

            banner.onclick = irParaLimpeza;
            if (voltarLimpezaBtn) voltarLimpezaBtn.onclick = irParaLimpeza;
            
            // Ajusta espaço do resultado quando banner está visível
            resultado.style.marginTop = '5px';
        }

    } catch (error) {
        console.error("Erro ao verificar limpeza ativa:", error);
    }

});
