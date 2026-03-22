// Remove as funções alternarMenu(), abrirMenu() e fecharMenu()
// Mantém apenas a função novoCronograma() se ainda for necessária

document.addEventListener("DOMContentLoaded", function () {
    const trigger = document.getElementById("userMenuTrigger");
    const dropdown = document.getElementById("userDropdown");

    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", function (e) {
        e.stopPropagation();

        dropdown.classList.toggle("show");
        trigger.classList.toggle("active"); // 👈 ativa rotação
    });

    document.addEventListener("click", function () {
        dropdown.classList.remove("show");
        trigger.classList.remove("active"); // 👈 reseta rotação
    });
    
    // Verificar se há mensagem de toast na sessão (via atributo data)
    const toastData = document.body.getAttribute('data-toast');
    if (toastData) {
        try {
            const toast = JSON.parse(toastData);
            mostrarToast(toast.texto, toast.tipo);
        } catch (e) {
            console.error('Erro ao parsear toast:', e);
        }
    }
});

// ================================
// FUNÇÃO DE TOAST (GLOBAL)
// ================================
function mostrarToast(mensagem, tipo = "success") {
    let toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const bgClass = tipo === 'success' ? 'bg-success' : 
                    tipo === 'danger' ? 'bg-danger' : 
                    tipo === 'warning' ? 'bg-warning' : 
                    tipo === 'info' ? 'bg-info' : 'bg-secondary';
    
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 show mb-2" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.innerHTML += toastHTML;
    
    const toastElement = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElement, { 
        autohide: true, 
        delay: 3000,
        animation: true
    });
    
    bsToast.show();
    
    // Remove o toast do DOM após desaparecer
    setTimeout(() => {
        if (toastElement && toastElement.parentNode) {
            toastElement.remove();
        }
    }, 3500);
}

// ================================
// FUNÇÃO NOVO CRONOGRAMA
// ================================
function novoCronograma() {
    const botao = document.getElementById("botaoNovo");

    // Array de mensagens e ícones
    const mensagens = [
        { texto: "Acessando Vitae...", icone: "fas fa-truck-medical" },
        { texto: "Buscando Dados...", icone: "fas fa-database" },
        { texto: "Carregando...", icone: "fas fa-spinner fa-spin" }
    ];

    let index = 0;

    // Função para alternar mensagens e ícones
    const alternarMensagens = () => {
        botao.innerHTML = `<i class="${mensagens[index].icone}"></i> ${mensagens[index].texto}`;
        index = (index + 1) % mensagens.length;
    };

    // Inicia a alternância de mensagens e ícones imediatamente
    alternarMensagens();

    // Inicia a alternância de mensagens e ícones a cada 1 segundo
    const intervalo = setInterval(alternarMensagens, 2000);

    // Desabilita o botão para evitar múltiplos cliques
    botao.disabled = true;

    // Cria um formulário dinâmico para enviar a requisição POST
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/pagina_principal';

    // Adiciona o formulário ao corpo do documento e o submete
    document.body.appendChild(form);
    form.submit();
}

const eventSource = new EventSource(`/stream?session_id=${SESSION_ID}`);

eventSource.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);

        // 🔥 Verifica se é evento de logout
        if (data.evento === "logout" && data.session_id === SESSION_ID) {
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

// ================================
// MENU DROPDOWN
// ================================
document.addEventListener("DOMContentLoaded", function () {
    const trigger = document.getElementById("userMenuTrigger");
    const dropdown = document.getElementById("userDropdown");

    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", function (e) {
        e.stopPropagation();

        dropdown.classList.toggle("show");
        trigger.classList.toggle("active");
    });

    document.addEventListener("click", function () {
        dropdown.classList.remove("show");
        trigger.classList.remove("active");
    });
    
    // Verificar se há mensagem de toast na sessão (via atributo data)
    const toastData = document.body.getAttribute('data-toast');
    if (toastData) {
        try {
            const toast = JSON.parse(toastData);
            mostrarToast(toast.texto, toast.tipo);
        } catch (e) {
            console.error('Erro ao parsear toast:', e);
        }
    }
    
    // 🔥 INICIAR CRONÔMETRO
    iniciarCronometro();
});

// ================================
// CRONÔMETRO DE SESSÃO
// ================================
let timerInterval = null;
let sessionEndTime = null;

function formatTime(seconds) {
    if (seconds < 0) return "00:00:00";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateSessionTimer() {
    if (!sessionEndTime) return;
    
    const now = new Date().getTime();
    const timeLeft = Math.max(0, Math.floor((sessionEndTime - now) / 1000));
    
    const timerElement = document.getElementById('sessionTimer');
    if (timerElement) {
        timerElement.textContent = formatTime(timeLeft);
        
        // Adiciona classes de warning/danger baseado no tempo restante
        const timerSection = document.querySelector('.session-timer-section');
        if (timerSection) {
            timerSection.classList.remove('warning', 'danger');
            
            if (timeLeft <= 60) {
                timerSection.classList.add('danger');
            } else if (timeLeft <= 300) {
                timerSection.classList.add('warning');
            }
        }
        
        // Se acabou o tempo
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            mostrarToast("Sua sessão expirou!", "danger");
            setTimeout(() => {
                window.location.href = "/?logout=expirado";
            }, 2000);
        }
    }
}

function iniciarCronometro() {
    // Para qualquer timer existente
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Se não tem login_time, não inicia cronômetro
    if (!SESSION_LOGIN_TIME) {
        return;
    }
    
    // Obtém o tempo de login
    const loginTime = new Date(SESSION_LOGIN_TIME).getTime();
    const now = new Date().getTime();
    
    // Define o tempo total da sessão baseado no tipo de usuário
    let totalSessionSeconds = 0;
    
    switch (USER_TYPE) {
        case 'ADMIN':
            totalSessionSeconds = 86400; // 1 dia
            break;
        case 'GERENTE':
            totalSessionSeconds = 600; // 10 minutos
            break;
        case 'NAO_CADASTRADO':
            totalSessionSeconds = 2592000; // 30 dias
            break;
        default:
            totalSessionSeconds = 2592000; // 30 dias
    }
    
    // Calcula o tempo restante
    const elapsedSeconds = Math.floor((now - loginTime) / 1000);
    const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedSeconds);
    sessionEndTime = loginTime + (totalSessionSeconds * 1000);
    
    // Atualiza o timer imediatamente
    updateSessionTimer();
    
    // Inicia o intervalo
    timerInterval = setInterval(updateSessionTimer, 1000);
}

// ================================
// FUNÇÃO DE TOAST (GLOBAL)
// ================================
function mostrarToast(mensagem, tipo = "success") {
    let toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const bgClass = tipo === 'success' ? 'bg-success' : 
                    tipo === 'danger' ? 'bg-danger' : 
                    tipo === 'warning' ? 'bg-warning' : 
                    tipo === 'info' ? 'bg-info' : 'bg-secondary';
    
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 show mb-2" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.innerHTML += toastHTML;
    
    const toastElement = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElement, { 
        autohide: true, 
        delay: 3000,
        animation: true
    });
    
    bsToast.show();
    
    // Remove o toast do DOM após desaparecer
    setTimeout(() => {
        if (toastElement && toastElement.parentNode) {
            toastElement.remove();
        }
    }, 3500);
}

// ================================
// FUNÇÃO NOVO CRONOGRAMA
// ================================
function novoCronograma() {
    const botao = document.getElementById("botaoNovo");

    // Array de mensagens e ícones
    const mensagens = [
        { texto: "Acessando Vitae...", icone: "fas fa-truck-medical" },
        { texto: "Buscando Dados...", icone: "fas fa-database" },
        { texto: "Carregando...", icone: "fas fa-spinner fa-spin" }
    ];

    let index = 0;

    // Função para alternar mensagens e ícones
    const alternarMensagens = () => {
        botao.innerHTML = `<i class="${mensagens[index].icone}"></i> ${mensagens[index].texto}`;
        index = (index + 1) % mensagens.length;
    };

    // Inicia a alternância de mensagens e ícones imediatamente
    alternarMensagens();

    // Inicia a alternância de mensagens e ícones a cada 1 segundo
    const intervalo = setInterval(alternarMensagens, 2000);

    // Desabilita o botão para evitar múltiplos cliques
    botao.disabled = true;

    // Cria um formulário dinâmico para enviar a requisição POST
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/pagina_principal';

    // Adiciona o formulário ao corpo do documento e o submete
    document.body.appendChild(form);
    form.submit();
}

// ================================
// SSE - SERVER SENT EVENTS
// ================================
const eventSource = new EventSource(`/stream?session_id=${SESSION_ID}`);

eventSource.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);

        // 🔥 Verifica se é evento de logout
        if (data.evento === "logout" && data.session_id === SESSION_ID) {
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

// Para o cronômetro quando o usuário sair da página (opcional)
window.addEventListener('beforeunload', function() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});