document.addEventListener("DOMContentLoaded", async () => {
    const loading = document.getElementById("loading");
    const resultado = document.getElementById("resultado");
    const banner = document.getElementById("bannerLimpezaAtiva");
    const bannerTexto = document.getElementById("bannerTexto");
    const voltarLimpezaBtn = document.getElementById("voltarLimpezaBtn");
    const carregarBtn = document.getElementById("carregarBtn");

    // ===============================
    // 🔹 HELPERS
    // ===============================
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function mostrarLoading() {
        loading.classList.remove("hidden", "fade-out");
        loading.offsetHeight;
        loading.classList.add("fade-in");
    }

    function esconderLoading() {
        loading.classList.remove("fade-in");
        loading.classList.add("fade-out");
        setTimeout(() => loading.classList.add("hidden"), 400);
    }

    // 🔥 FUNÇÃO DE ERRO - AJUSTADA PARA SEU CSS
    function mostrarTextoErro(mensagem) {
        resultado.innerHTML = `
            <div style="
                color: #dc3545;
                font-size: 0.95rem;
                margin-top: 25px;
                padding: 6px 12px;
                background: rgba(220, 53, 69, 0.05);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                animation: fadeIn 0.3s ease;
            ">
                <span style="font-size: 1.1rem;">⚠️</span>
                <span>${mensagem}</span>
            </div>
        `;
        
        // Se o banner de limpeza ativa estiver visível, ajusta posição
        if (banner && !banner.classList.contains('oculto')) {
            resultado.style.marginTop = '5px';
        }
    }

    // ===============================
    // 🔹 CARREGAR LEITOS
    // ===============================
    if (carregarBtn) {
        carregarBtn.addEventListener("click", async () => {
            // reset visual
            resultado.innerHTML = "";
            resultado.style.marginTop = '0';

            carregarBtn.classList.add("subindo");
            await delay(100);

            mostrarLoading();
            
            await delay(2000);

            try {
                const resp = await fetch("/api/carregar_leitos");
                const data = await resp.json();

                esconderLoading();
                carregarBtn.classList.remove("subindo");

                if (data.status === "ok") {
                    localStorage.setItem("setores", JSON.stringify(data.setores));
                    localStorage.setItem("ultima_atualizacao", data.ultima_atualizacao);
                    window.location.href = "/tablet_setores";
                    
                } else {
                    mostrarTextoErro(data.mensagem || "Erro ao carregar dados");
                }

            } catch (err) {
                esconderLoading();
                carregarBtn.classList.remove("subindo");
                
                mostrarTextoErro("Erro de conexão. Tente novamente.");
                console.error("Erro detalhado:", err);
            }
        });
    }

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