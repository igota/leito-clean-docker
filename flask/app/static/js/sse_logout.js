// Conexão SSE para logout em tempo real (sessão expirada / login em outro
// dispositivo). Carregado SÓ na página principal (painel), que já precisa de
// uma conexão de streaming para as atualizações ao vivo de leitos — outras
// páginas (config, justificativas, funcionários, relatórios) não abrem essa
// conexão, para não esgotar o limite de conexões simultâneas por origem do
// navegador quando várias abas/tablets ficam abertos ao mesmo tempo.

// Lê o session_id diretamente do cookie (este script carrega antes do
// bloco de scripts do base.html, então não pode depender da variável
// global SESSION_ID definida lá).
function lerSessionIdDoCookie() {
    const match = document.cookie.match(/(?:^|;\s*)session_id=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
}

const SESSION_ID_LOGOUT = lerSessionIdDoCookie();
const eventSourceLogout = new EventSource(`/stream?session_id=${SESSION_ID_LOGOUT}`);

eventSourceLogout.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);

        // 🔥 Verifica se é evento de logout
        if (data.evento === "logout" && data.session_id === SESSION_ID_LOGOUT) {
            mostrarToast(data.motivo, "danger");

            setTimeout(() => {
                // 🔥 Decide para onde redirecionar baseado no motivo
                if (data.motivo && data.motivo.includes("outro dispositivo")) {
                    // Login duplicado
                    window.location.href = "/?logout=duplicado";
                } else {
                    // Expiração por inatividade
                    window.location.href = "/?logout=expirado";
                }
            }, 2000);
        }
    } catch (e) {
        console.error("Erro ao processar SSE:", e);
    }
};
