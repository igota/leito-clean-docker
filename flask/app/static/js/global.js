// Interceptor global de fetch para sessão expirada
let redirecionando = false;

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 401 && !redirecionando) {
        redirecionando = true;
        window.location.href = "/";
        return Promise.reject("Sessão expirada");
    }

    return response;
};

// Garante que apenas um modal Bootstrap fique visível por vez:
// ao abrir um modal com outro já aberto (ex.: busca dentro de um cadastro),
// o anterior é ocultado e volta a aparecer quando o novo for fechado.
const modalPaiDoModal = new WeakMap();

document.addEventListener('show.bs.modal', (event) => {
    const modalAtual = event.target;

    document.querySelectorAll('.modal.show').forEach(modalAnterior => {
        if (modalAnterior !== modalAtual) {
            modalPaiDoModal.set(modalAtual, modalAnterior);
            bootstrap.Modal.getInstance(modalAnterior)?.hide();
        }
    });
});

document.addEventListener('hidden.bs.modal', (event) => {
    const modalPai = modalPaiDoModal.get(event.target);

    if (modalPai) {
        modalPaiDoModal.delete(event.target);
        bootstrap.Modal.getOrCreateInstance(modalPai).show();
    }
});

// Desativa o autocomplete do navegador em todos os inputs/selects/textareas do sistema,
// inclusive os criados dinamicamente (modais, tabelas, popups).
function desativarAutocomplete(raiz) {
    raiz.querySelectorAll('input, select, textarea').forEach(el => {
        el.setAttribute('autocomplete', 'off');
    });
}

desativarAutocomplete(document);

new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            if (node.matches?.('input, select, textarea')) {
                node.setAttribute('autocomplete', 'off');
            }
            desativarAutocomplete(node);
        });
    });
}).observe(document.body, { childList: true, subtree: true });

