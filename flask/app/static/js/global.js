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

