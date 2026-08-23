// ========== VARIÁVEIS GLOBAIS ==========
let todosFuncionarios = [];
let paginaAtual = 1;
let itensPorPagina = 10;
let filtrosAtuais = {};

// ========== FUNÇÕES DE UTILIDADE ==========
function traduzirTipo(tipo) {
    if (tipo === "asg") return "ASG";
    if (tipo === "enfermagem") return "Enfermagem";
    return tipo;
}

// ========== FUNÇÕES DE PAGINAÇÃO ==========
function aplicarPaginacao() {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return todosFuncionarios.slice(inicio, fim);
}

// ========== FUNÇÕES DE AJUSTE DE LAYOUT ==========

/**
 * Ajusta o padding inferior do body baseado na altura do menu de paginação
 */
function ajustarPaddingBody() {
    const menu = document.getElementById("paginationFixed");
    if (menu && menu.classList.contains("visible")) {
        const alturaMenu = menu.offsetHeight;
        document.body.style.paddingBottom = (alturaMenu + 20) + "px";
    } else {
        document.body.style.paddingBottom = "0";
    }
}

/**
 * Ajusta a altura da tabela para ocupar o espaço disponível
 */
function ajustarAlturaTabela() {
    const containerSecundario = document.querySelector('.container-secundario');
    const titulo = document.querySelector('h2');
    const cardFiltro = document.querySelector('.card');
    const tabelaContainer = document.querySelector('.tabela-container');
    const menuPaginacao = document.getElementById('paginationFixed');
    
    if (!containerSecundario || !titulo || !cardFiltro || !tabelaContainer) return;
    
    const alturaTotal = containerSecundario.clientHeight;
    const alturaTitulo = titulo.offsetHeight;
    const alturaCard = cardFiltro.offsetHeight;
    const paddingVertical = 40; // padding do container (20px top + 20px bottom)
    
    let alturaPaginacao = 0;
    if (menuPaginacao && menuPaginacao.classList.contains('visible')) {
        alturaPaginacao = menuPaginacao.offsetHeight;
    }
    
    const alturaDisponivel = alturaTotal - alturaTitulo - alturaCard - paddingVertical - alturaPaginacao;
    tabelaContainer.style.height = `${Math.max(200, alturaDisponivel)}px`;
}

/**
 * Ajusta a posição do menu de paginação para respeitar o menu lateral
 */
function ajustarParaMenuLateral() {
    const menuLateral = document.querySelector('.menu, .sidebar, [class*="sidebar"], [class*="menu"]');
    const paginationFixed = document.getElementById("paginationFixed");
    
    if (!paginationFixed) return;
    
    if (menuLateral && window.innerWidth > 768) {
        const larguraMenu = menuLateral.offsetWidth;
        
        // Aplica estilos diretamente
        paginationFixed.style.left = larguraMenu + 'px';
        paginationFixed.style.width = 'calc(100% - ' + larguraMenu + 'px)';
        
        // Adiciona classe ao body
        document.body.classList.add('has-sidebar');
    } else {
        // Reset para mobile ou sem menu lateral
        paginationFixed.style.left = '0';
        paginationFixed.style.width = '100%';
        document.body.classList.remove('has-sidebar');
    }
}

/**
 * Mostra ou esconde o menu de navegação
 */
function mostrarMenuNavegacao(mostrar) {
    const menu = document.getElementById("paginationFixed");
    if (!menu) return;
    
    if (mostrar) {
        menu.classList.add("visible");
        
        // Ajusta posição para menu lateral imediatamente
        ajustarParaMenuLateral();
        
        // Pequeno atraso para garantir renderização completa
        setTimeout(() => {
            ajustarPaddingBody();
            ajustarAlturaTabela();
        }, 50);
        
        // Segundo ajuste para garantir
        setTimeout(() => {
            ajustarParaMenuLateral();
            ajustarAlturaTabela();
        }, 200);
        
    } else {
        menu.classList.remove("visible");
        document.body.style.paddingBottom = "0";
        ajustarAlturaTabela();
    }
}

/**
 * Esconde os controles de paginação
 */
function esconderPaginacao() {
    document.getElementById("paginationInfo").innerHTML = "";
    document.getElementById("paginationControls").innerHTML = "";
    mostrarMenuNavegacao(false);
}

/**
 * Atualiza os controles de paginação
 */
function atualizarPaginacao() {
    const totalItens = todosFuncionarios.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    
    // Ajusta página atual se necessário
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
        paginaAtual = totalPaginas;
    }
    
    // Atualiza informação de itens
    const inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    document.getElementById("paginationInfo").innerHTML = 
        `<i class="bi bi-layout-three-columns"></i> ${inicio} - ${fim} de ${totalItens} resultados`;

    // Gera botões de paginação
    const controls = document.getElementById("paginationControls");
    controls.innerHTML = "";

    if (totalPaginas <= 1) return;

    // Botão Anterior
    const btnPrev = document.createElement("button");
    btnPrev.className = "btn-pagination";
    btnPrev.innerHTML = '<i class="bi bi-chevron-left"></i>';
    btnPrev.disabled = paginaAtual === 1;
    btnPrev.onclick = () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarTabela(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        }
    };
    controls.appendChild(btnPrev);

    // Lógica para mostrar páginas (máximo 5 botões)
    let inicioPaginas = Math.max(1, paginaAtual - 2);
    let fimPaginas = Math.min(totalPaginas, inicioPaginas + 4);
    
    if (fimPaginas - inicioPaginas < 4) {
        inicioPaginas = Math.max(1, fimPaginas - 4);
    }

    // Primeira página se necessário
    if (inicioPaginas > 1) {
        const btnFirst = document.createElement("button");
        btnFirst.className = "btn-pagination";
        btnFirst.textContent = "1";
        btnFirst.onclick = () => {
            paginaAtual = 1;
            renderizarTabela(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        };
        controls.appendChild(btnFirst);
        
        if (inicioPaginas > 2) {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.style.padding = "0 5px";
            ellipsis.style.color = "#013757";
            ellipsis.style.fontWeight = "bold";
            controls.appendChild(ellipsis);
        }
    }

    // Botões das páginas
    for (let i = inicioPaginas; i <= fimPaginas; i++) {
        const btn = document.createElement("button");
        btn.className = `btn-pagination ${i === paginaAtual ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => {
            paginaAtual = i;
            renderizarTabela(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        };
        controls.appendChild(btn);
    }

    // Última página se necessário
    if (fimPaginas < totalPaginas) {
        if (fimPaginas < totalPaginas - 1) {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.style.padding = "0 5px";
            ellipsis.style.color = "#013757";
            ellipsis.style.fontWeight = "bold";
            controls.appendChild(ellipsis);
        }
        
        const btnLast = document.createElement("button");
        btnLast.className = "btn-pagination";
        btnLast.textContent = totalPaginas;
        btnLast.onclick = () => {
            paginaAtual = totalPaginas;
            renderizarTabela(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        };
        controls.appendChild(btnLast);
    }

    // Botão Próximo
    const btnNext = document.createElement("button");
    btnNext.className = "btn-pagination";
    btnNext.innerHTML = '<i class="bi bi-chevron-right"></i>';
    btnNext.disabled = paginaAtual === totalPaginas;
    btnNext.onclick = () => {
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarTabela(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        }
    };
    controls.appendChild(btnNext);
}

/**
 * Rola suavemente para o topo da tabela
 */
function rolarParaTopoTabela() {
    const tabelaContainer = document.querySelector(".tabela-container");
    if (tabelaContainer) {
        tabelaContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// ========== FUNÇÕES DE RENDERIZAÇÃO ==========
function renderizarTabela(funcionariosPagina) {
    const tbody = document.querySelector("#tabelaFuncionarios tbody");
    tbody.innerHTML = "";

    if (!funcionariosPagina || funcionariosPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="alert alert-info mb-0">
                        <i class="bi bi-info-circle"></i>
                        Nenhum funcionário encontrado para os filtros selecionados.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    funcionariosPagina.forEach(u => {
        // Escapa aspas simples para o JSON não quebrar
        const funcionarioJson = JSON.stringify(u).replace(/'/g, "&apos;");
        
        const linha = `
            <tr>
                <td>${u.nome}</td>
                <td>${u.cpf || "-"}</td>
                <td>${u.id_cartao || "-"}</td>
                <td>${traduzirTipo(u.tipo)}</td>
                <td>
                    <span class="${u.status ? "status-ativo" : "status-inativo"}">
                        ${u.status ? "Ativo" : "Inativo"}
                    </span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick='abrirModalEditar(${funcionarioJson})'>
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML("beforeend", linha);
    });
}

// ========== FUNÇÃO PRINCIPAL DE CARREGAMENTO ==========
async function carregarFuncionarios(filtros = {}) {
    filtrosAtuais = filtros;
    const tbody = document.querySelector("#tabelaFuncionarios tbody");
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2">Buscando funcionários...</p>
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch("/api/consultar_funcionarios", {
            method: "POST",
            headers: {"Content-Type": "application/json","Accept": "application/json" },
            body: JSON.stringify(filtros)
        });
        
        const data = await response.json();
        
        if (data.erro) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="alert alert-danger mb-0">
                            <i class="bi bi-exclamation-triangle"></i>
                            Erro: ${data.erro}
                        </div>
                    </td>
                </tr>
            `;
            mostrarMenuNavegacao(false);
            return;
        }
        
        todosFuncionarios = data.funcionarios || [];
        
        if (todosFuncionarios.length === 0) {
            renderizarTabela([]);
            mostrarMenuNavegacao(false);
        } else {
            paginaAtual = 1;
            const funcionariosPagina = aplicarPaginacao();
            renderizarTabela(funcionariosPagina);
            atualizarPaginacao();
            mostrarMenuNavegacao(true);
            
            // Múltiplos ajustes para garantir o posicionamento correto
            setTimeout(() => {
                ajustarParaMenuLateral();
                ajustarPaddingBody();
                ajustarAlturaTabela();
            }, 100);
            
            setTimeout(() => {
                ajustarParaMenuLateral();
                ajustarAlturaTabela();
            }, 300);
            
            setTimeout(() => {
                ajustarParaMenuLateral();
            }, 500);
        }
        
    } catch (erro) {
        console.error("Erro ao carregar funcionários:", erro);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle"></i>
                        Erro de conexão ao carregar funcionários.
                    </div>
                </td>
            </tr>
        `;
        mostrarMenuNavegacao(false);
    }
}

// ========== FUNÇÕES DE LIMPEZA E BUSCA ==========
function limparConsulta() {
    // Limpa os campos de filtro
    document.getElementById("nomeBusca").value = "";
    document.getElementById("idCartaoBusca").value = "";
    document.getElementById("tipoBusca").value = "";
    
    // Limpa os dados
    todosFuncionarios = [];
    
    // Mostra mensagem de tabela vazia
    const tbody = document.querySelector("#tabelaFuncionarios tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                <div class="alert alert-secondary mb-0">
                    <i class="bi bi-search"></i>
                    Selecione os filtros e clique em "Pesquisar" para buscar funcionários.
                </div>
            </td>
        </tr>
    `;
    
    // Esconde o menu de navegação
    esconderPaginacao();
}

// ========== OBSERVERS ==========

// Observer para ajustar quando o menu de paginação mudar de tamanho
const paginationObserver = new ResizeObserver(() => {
    ajustarParaMenuLateral();
    ajustarPaddingBody();
    ajustarAlturaTabela();
});

// Observer para ajustar quando o menu lateral mudar de tamanho
const sidebarObserver = new ResizeObserver(() => {
    ajustarParaMenuLateral();
    ajustarAlturaTabela();
});

// ========== EVENTOS ==========

// Evento de busca
document.getElementById("formBusca").addEventListener("submit", e => {
    e.preventDefault();
    const filtros = {
        nome: document.getElementById("nomeBusca").value.trim(),
        id_cartao: document.getElementById("idCartaoBusca").value.trim(),
        tipo: document.getElementById("tipoBusca").value.trim()
    };
    carregarFuncionarios(filtros);
});

// Evento para mudar quantidade de itens por página
document.getElementById("itemsPerPageFixed").addEventListener("change", function() {
    itensPorPagina = parseInt(this.value);
    if (todosFuncionarios.length > 0) {
        paginaAtual = 1;
        renderizarTabela(aplicarPaginacao());
        atualizarPaginacao();
        rolarParaTopoTabela();
    }
});

// ========== FUNÇÕES DE MODAL ==========
function abrirModalEditar(funcionario) {
    document.getElementById("editId").value = funcionario.id;
    document.getElementById("editNome").value = funcionario.nome;
    document.getElementById("editCpf").value = funcionario.cpf || "";
    document.getElementById("editIdcartao").value = funcionario.id_cartao || "";
    document.getElementById("editTipo").value = funcionario.tipo;
    document.querySelector(`input[name='editAtivo'][value='${funcionario.status}']`).checked = true;

    const modal = new bootstrap.Modal(document.getElementById("modalEditar"));
    modal.show();
}

// ========== FUNÇÕES DE VALIDAÇÃO ==========
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf[10]);
}

function validarid_cartaoNumerica(input) {
    input.value = input.value.replace(/\D/g, "");
    if (input.value.length > 10) {
        input.value = input.value.slice(0, 10);
    }
}

function aplicarMascaraCPF(input) {
    let valor = input.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);

    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    input.value = valor;
}

// ========== FUNÇÕES DE CRUD ==========
async function salvarFuncionario(event) {
    event.preventDefault();
    const nome = document.getElementById("nome").value.trim();
    const cpf = document.getElementById("cpf").value.trim();
    const id_cartao = document.getElementById("id_cartao").value.trim();
    const tipo = document.getElementById("tipo").value;

    if (!nome || !cpf || !id_cartao || !tipo) {
        mostrarAlerta("⚠️ Preencha todos os campos obrigatórios antes de salvar.");
        return;
    }

    if (!validarCPF(cpf)) {
        mostrarAlerta("⚠️ CPF inválido! Verifique e tente novamente.");
        return;
    }

    const dados = { nome, cpf, id_cartao, tipo };

    try {
        const response = await fetch("/api/cadastrar_funcionarios", {
            method: "POST",
            headers: {"Content-Type": "application/json","Accept": "application/json" },
            body: JSON.stringify(dados)
        });

        const data = await response.json();

        if (data.mensagem) {
            mostrarAlertaSucesso("Funcionário cadastrado com sucesso!");
            document.getElementById("formCadastro").reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById("modalCadastro"));
            modal.hide();
            carregarFuncionarios(filtrosAtuais);
        } else {
            mostrarAlerta(data.erro || "Falha ao cadastrar");
        }
    } catch (erro) {
        console.error("Erro ao cadastrar funcionário:", erro);
        mostrarAlerta("❌ Erro ao conectar ao servidor. Tente novamente.");
    }
}

async function salvarEdicao(event) {
    event.preventDefault();

    const form = event.target;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const nome = document.getElementById("editNome");
    const cpf = document.getElementById("editCpf");
    const id_cartao = document.getElementById("editIdcartao");
    const tipo = document.getElementById("editTipo");
    const status = document.querySelector('input[name="editAtivo"]:checked');

    [nome, cpf, id_cartao, tipo].forEach(el => el.classList.remove("is-invalid"));

    if (!validarCPF(cpf.value)) {
        cpf.classList.add("is-invalid");
        mostrarAlerta("⚠️ CPF inválido! Verifique e tente novamente.", "edicao");
        cpf.focus();
        return;
    }

    if (id_cartao.value.length < 8 || id_cartao.value.length > 10) {
        id_cartao.classList.add("is-invalid");
        mostrarAlerta("⚠️ O ID do Cartão deve conter entre 8 e 10 dígitos.", "edicao");
        id_cartao.focus();
        return;
    }

    if (!status) {
        mostrarAlerta("Por favor, selecione o Status (Ativo ou Inativo).", "edicao");
        return;
    }

    const dados = {
        id: document.getElementById("editId").value,
        nome: nome.value.trim(),
        cpf: cpf.value.trim(),
        id_cartao: id_cartao.value.trim(),
        tipo: tipo.value,
        status: status.value
    };

    try {
        const response = await fetch("/api/editar_funcionarios", {
            method: "POST",
            headers: {"Content-Type": "application/json","Accept": "application/json" },
            body: JSON.stringify(dados)
        });

        const data = await response.json();

        if (data.mensagem) {
            bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
            carregarFuncionarios(filtrosAtuais);
            mostrarAlertaSucesso("Funcionário editado com sucesso!");
        } else {
            mostrarAlerta(data.erro || "Falha ao atualizar funcionário.", "edicao");
        }
    } catch (erro) {
        mostrarAlerta("Erro de conexão com o servidor.", "edicao");
        console.error(erro);
    }
}

// ========== BUSCA NO ICONTROL ==========
function abrirBuscaIcontrol() {
    document.getElementById("valorBuscaIcontrol").value = "";
    document.getElementById("tipoBuscaNome").checked = true;
    document.getElementById("valorBuscaIcontrol").placeholder = "Digite o nome...";
    document.getElementById("alertBuscaIcontrol").style.display = "none";
    document.getElementById("resultadosBuscaIcontrolBody").innerHTML = `
        <tr><td colspan="5" class="text-center text-muted py-3">Escolha o tipo de busca e digite o valor.</td></tr>
    `;

    const modal = new bootstrap.Modal(document.getElementById("modalBuscaIcontrol"));
    modal.show();
}

document.querySelectorAll('input[name="tipoBuscaIcontrol"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const input = document.getElementById("valorBuscaIcontrol");
        input.placeholder = radio.value === "nome" ? "Digite o nome..." : "Digite o identificador...";
    });
});

async function buscarIcontrol(event) {
    event.preventDefault();

    const tipo = document.querySelector('input[name="tipoBuscaIcontrol"]:checked').value;
    const valor = document.getElementById("valorBuscaIcontrol").value.trim();
    const tbody = document.getElementById("resultadosBuscaIcontrolBody");
    const alertBox = document.getElementById("alertBuscaIcontrol");

    alertBox.style.display = "none";
    if (!valor) return;

    tbody.innerHTML = `
        <tr><td colspan="5" class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary"></div> Buscando...
        </td></tr>
    `;

    try {
        const response = await fetch("/api/buscar_funcionario_icontrol", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ tipo, valor })
        });
        const data = await response.json();

        if (!data.sucesso) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum resultado.</td></tr>`;
            alertBox.textContent = data.erro || "Erro na busca.";
            alertBox.style.display = "block";
            return;
        }

        if (data.resultados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum usuário encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        data.resultados.forEach(u => {
            const usuarioJson = JSON.stringify(u).replace(/'/g, "&apos;");
            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>${u.nome || "-"}</td>
                    <td>${u.tipo_usuario || "-"}</td>
                    <td>${u.numero_cartao || "-"}</td>
                    <td>${u.identificador || "-"}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-primary" onclick='selecionarFuncionarioIcontrol(${usuarioJson})'>
                            Selecionar
                        </button>
                    </td>
                </tr>
            `);
        });
    } catch (erro) {
        console.error("Erro ao buscar no iControl:", erro);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Erro de conexão.</td></tr>`;
    }
}

function selecionarFuncionarioIcontrol(usuario) {
    if (!usuario.numero_cartao) {
        const alertBox = document.getElementById("alertBuscaIcontrol");
        alertBox.textContent = "Este registro do iControl não possui número de cartão.";
        alertBox.style.display = "block";
        return;
    }

    document.getElementById("nome").value = usuario.nome || "";

    const idCartaoInput = document.getElementById("id_cartao");
    idCartaoInput.value = usuario.numero_cartao;
    validarid_cartaoNumerica(idCartaoInput);

    bootstrap.Modal.getInstance(document.getElementById("modalBuscaIcontrol"))?.hide();
}

// ========== FUNÇÕES DE ALERTA ==========
function mostrarAlerta(mensagem, contexto = "cadastro") {
    const alertBox =
        contexto === "edicao"
            ? document.getElementById("alertEdicao")
            : document.getElementById("alertCadastro");

    if (!alertBox) return;

    alertBox.textContent = mensagem;
    alertBox.style.display = "block";

    setTimeout(() => {
        alertBox.style.display = "none";
    }, 4000);
}

function mostrarAlertaSucesso(mensagem) {
    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center text-bg-success border-0 show shadow-lg";
    toastEl.role = "alert";
    toastEl.ariaLive = "assertive";
    toastEl.ariaAtomic = "true";
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body text-center">
                ✅ ${mensagem}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    document.getElementById("toastContainer").appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 1000 });
    toast.show();

    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener("DOMContentLoaded", () => {
    // Configurar observers
    const menu = document.getElementById("paginationFixed");
    if (menu) {
        paginationObserver.observe(menu);
    }
    
    const menuLateral = document.querySelector('.menu, .sidebar, [class*="sidebar"], [class*="menu"]');
    if (menuLateral) {
        sidebarObserver.observe(menuLateral);
    }
    
    // Máscaras e validações
    const cpfCadastro = document.getElementById("cpf");
    if (cpfCadastro) {
        cpfCadastro.addEventListener("input", () => aplicarMascaraCPF(cpfCadastro));
    }

    const cpfEdicao = document.getElementById("editCpf");
    if (cpfEdicao) {
        cpfEdicao.addEventListener("input", () => aplicarMascaraCPF(cpfEdicao));
    }

    const id_cartaoInput = document.getElementById("id_cartao");
    if (id_cartaoInput) {
        id_cartaoInput.addEventListener("input", () => validarid_cartaoNumerica(id_cartaoInput));
    }

    const idCartaoEdicao = document.getElementById("editIdcartao");
    if (idCartaoEdicao) {
        idCartaoEdicao.addEventListener("input", () => validarid_cartaoNumerica(idCartaoEdicao));
    }
    
    // Configura o seletor de itens por página
    const itemsPerPageFixed = document.getElementById("itemsPerPageFixed");
    if (itemsPerPageFixed) {
        itensPorPagina = parseInt(itemsPerPageFixed.value);
    }
    
    // Ajuste inicial de layout
    setTimeout(() => {
        ajustarParaMenuLateral();
        ajustarAlturaTabela();
    }, 100);
    
    // Inicializa com a tabela vazia
    limparConsulta();
});

// Evento de redimensionamento da janela
window.addEventListener('resize', () => {
    ajustarParaMenuLateral();
    ajustarAlturaTabela();
});

// Evento para limpar o modal de cadastro quando fechado
document.getElementById("modalCadastro")?.addEventListener("hidden.bs.modal", () => {
    const form = document.getElementById("formCadastro");
    if (form) {
        form.reset();
        form.querySelectorAll(".is-invalid").forEach(el => {
            el.classList.remove("is-invalid");
        });
    }
    const alert = document.getElementById("alertCadastro");
    if (alert) alert.style.display = "none";
});

// Evento para limpar o modal de edição quando fechado
document.getElementById("modalEditar")?.addEventListener("hidden.bs.modal", () => {
    const form = document.getElementById("formEditarFuncionario");
    if (form) {
        form.reset();
        form.querySelectorAll(".is-invalid").forEach(el => {
            el.classList.remove("is-invalid");
        });
    }
    const alert = document.getElementById("alertEdicao");
    if (alert) alert.style.display = "none";
});

// Eventos para ajustar layout quando modais abrem/fecham
document.getElementById("modalCadastro")?.addEventListener("shown.bs.modal", () => {
    setTimeout(ajustarAlturaTabela, 300);
});

document.getElementById("modalCadastro")?.addEventListener("hidden.bs.modal", () => {
    setTimeout(ajustarAlturaTabela, 300);
});

document.getElementById("modalEditar")?.addEventListener("shown.bs.modal", () => {
    setTimeout(ajustarAlturaTabela, 300);
});

document.getElementById("modalEditar")?.addEventListener("hidden.bs.modal", () => {
    setTimeout(ajustarAlturaTabela, 300);
});