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

