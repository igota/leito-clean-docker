// ================================
// VARIÁVEIS GLOBAIS
// ================================

let dispositivos = []; // Array com setores e quantidade de leitos
let pollingTimer = null;
let pollingEmExecucao = false;
let ultimaPesquisaRealizada = false; // Flag para controlar se já pesquisou
let todasJustificativas = [];
let paginaAtual = 1;
let itensPorPagina = 10;
let filtrosAtuais = {};

// ========== FUNÇÕES DE PAGINAÇÃO ==========
function aplicarPaginacao() {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return todasJustificativas.slice(inicio, fim);
}

// ========== FUNÇÕES DE AJUSTE DE LAYOUT ==========
function ajustarPaddingBody() {
    const menu = document.getElementById("paginationFixed");
    if (menu && menu.classList.contains("visible")) {
        const alturaMenu = menu.offsetHeight;
        document.body.style.paddingBottom = (alturaMenu + 20) + "px";
    } else {
        document.body.style.paddingBottom = "0";
    }
}

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
    const paddingVertical = 40;
    
    let alturaPaginacao = 0;
    if (menuPaginacao && menuPaginacao.classList.contains('visible')) {
        alturaPaginacao = menuPaginacao.offsetHeight;
    }
    
    const alturaDisponivel = alturaTotal - alturaTitulo - alturaCard - paddingVertical - alturaPaginacao;
    tabelaContainer.style.height = `${Math.max(200, alturaDisponivel)}px`;
}

function ajustarParaMenuLateral() {
    const menuLateral = document.querySelector('.menu, .sidebar, [class*="sidebar"], [class*="menu"]');
    const paginationFixed = document.getElementById("paginationFixed");
    
    if (!paginationFixed) return;
    
    if (menuLateral && window.innerWidth > 768) {
        const larguraMenu = menuLateral.offsetWidth;
        document.body.classList.add('has-sidebar');
        paginationFixed.style.left = larguraMenu + 'px';
        paginationFixed.style.width = 'calc(100% - ' + larguraMenu + 'px)';
        paginationFixed.style.right = '0';
    } else {
        document.body.classList.remove('has-sidebar');
        paginationFixed.style.left = '0';
        paginationFixed.style.width = '100%';
        paginationFixed.style.right = '0';
    }
}

function mostrarMenuNavegacao(mostrar) {
    const menu = document.getElementById("paginationFixed");
    if (!menu) return;
    
    if (mostrar) {
        menu.classList.add("visible");
        menu.style.display = 'block';
        
        ajustarParaMenuLateral();
        
        setTimeout(() => {
            ajustarParaMenuLateral();
            ajustarPaddingBody();
            ajustarAlturaTabela();
        }, 10);
        
        setTimeout(() => {
            ajustarParaMenuLateral();
            ajustarAlturaTabela();
        }, 50);
        
    } else {
        menu.classList.remove("visible");
        menu.style.display = 'none';
        document.body.style.paddingBottom = "0";
        ajustarAlturaTabela();
    }
}

function esconderPaginacao() {
    document.getElementById("paginationInfo").innerHTML = "";
    document.getElementById("paginationControls").innerHTML = "";
    mostrarMenuNavegacao(false);
}

function atualizarPaginacao() {
    const totalItens = todasJustificativas.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
        paginaAtual = totalPaginas;
    }
    
    const inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    document.getElementById("paginationInfo").innerHTML = 
        `<i class="bi bi-layout-three-columns"></i> ${inicio} - ${fim} de ${totalItens} resultados`;

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
            renderizarTabelaPaginada(aplicarPaginacao());
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

    if (inicioPaginas > 1) {
        const btnFirst = document.createElement("button");
        btnFirst.className = "btn-pagination";
        btnFirst.textContent = "1";
        btnFirst.onclick = () => {
            paginaAtual = 1;
            renderizarTabelaPaginada(aplicarPaginacao());
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

    for (let i = inicioPaginas; i <= fimPaginas; i++) {
        const btn = document.createElement("button");
        btn.className = `btn-pagination ${i === paginaAtual ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => {
            paginaAtual = i;
            renderizarTabelaPaginada(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        };
        controls.appendChild(btn);
    }

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
            renderizarTabelaPaginada(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        };
        controls.appendChild(btnLast);
    }

    const btnNext = document.createElement("button");
    btnNext.className = "btn-pagination";
    btnNext.innerHTML = '<i class="bi bi-chevron-right"></i>';
    btnNext.disabled = paginaAtual === totalPaginas;
    btnNext.onclick = () => {
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarTabelaPaginada(aplicarPaginacao());
            atualizarPaginacao();
            rolarParaTopoTabela();
        }
    };
    controls.appendChild(btnNext);
}

function rolarParaTopoTabela() {
    const tabelaContainer = document.querySelector(".tabela-container");
    if (tabelaContainer) {
        tabelaContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}


// ========== FUNÇÃO DE RENDERIZAÇÃO PAGINADA ==========
function renderizarTabelaPaginada(justificativasPagina) {
    const tbody = document.querySelector("#tabelaJustificativas tbody");
    tbody.innerHTML = "";

    if (!justificativasPagina || justificativasPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="alert alert-info mb-0">
                        <i class="bi bi-info-circle"></i>
                        Nenhuma justificativa encontrada para os filtros selecionados.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    justificativasPagina.forEach(j => {
        const tr = document.createElement("tr");
        
        // Formata as datas
        const dataCriacao = formatarDataCompleta(j.data_criacao);
        const dataAtualizacao = formatarDataCompleta(j.data_atualizacao);
        
        // Nomes com fallback
        const criadoPor = j.criado_por_nome || j.criado_por || '-';
        const editadoPor = j.editado_por_nome || j.editado_por || '-';
        
        tr.innerHTML = `
            <td>${j.setor}</td>
            <td>${j.leito}</td>
            <td>${dataCriacao}</td>
            <td>
                <div class="nome-usuario-tabela" title="${criadoPor}">
                    <i class="bi bi-person-fill-add"></i>
                    ${criadoPor}
                </div>
            </td>
            <td>${dataAtualizacao}</td>
            <td>
                <div class="nome-usuario-tabela" title="${editadoPor}">
                    <i class="bi bi-person-fill-gear"></i>
                    ${editadoPor}
                </div>
            </td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-info" onclick="visualizarJustificativa(${j.id})" title="Visualizar">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="editarJustificativa(${j.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="excluirJustificativa(${j.id})" title="Excluir">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// ========== INICIALIZAÇÃO MODIFICADA ==========
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
    
    // Configurar seletor de itens por página
    const itemsPerPageFixed = document.getElementById("itemsPerPageFixed");
    if (itemsPerPageFixed) {
        itensPorPagina = parseInt(itemsPerPageFixed.value);
        
        itemsPerPageFixed.addEventListener("change", function() {
            itensPorPagina = parseInt(this.value);
            if (todasJustificativas.length > 0) {
                paginaAtual = 1;
                renderizarTabelaPaginada(aplicarPaginacao());
                atualizarPaginacao();
                rolarParaTopoTabela();
            }
        });
    }
    
    // Ajuste inicial
    setTimeout(() => {
        ajustarParaMenuLateral();
        ajustarAlturaTabela();
    }, 100);
    
    // Carregar setores e inicializar
    carregarSetores();
    
    // ✅ MOSTRAR MENSAGEM INICIAL NA TABELA
    const tbody = document.querySelector("#tabelaJustificativas tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center">
                <div class="alert alert-secondary mb-0">
                    <i class="bi bi-search"></i>
                    Selecione os filtros e clique em "Pesquisar" para buscar justificativas.
                </div>
            </td>
        </tr>
    `;
    
    // Evento para carregar leitos quando setor for selecionado no FILTRO
    document.getElementById("selectSetor").addEventListener("change", function() {
        atualizarLeitosFiltro();
    });
    
    // Evento para carregar leitos quando setor for selecionado no MODAL
    document.getElementById("modalSetor").addEventListener("change", function() {
        atualizarLeitosModal();
    });
    
    // Iniciar polling para atualizações (aguardando primeira pesquisa)
    iniciarPolling();
});

// Evento de redimensionamento
window.addEventListener('resize', () => {
    ajustarParaMenuLateral();
    ajustarAlturaTabela();
});

// ================================
// CARREGAR SETORES DA TABELA DISPOSITIVOS
// ================================

function carregarSetores() {
    fetch('/api/setores')
        .then(response => response.json())
        .then(data => {
            dispositivos = data;
            preencherSelectores();
        })
        .catch(error => {
            console.error("Erro ao carregar setores:", error);
            mostrarToast("Erro ao carregar setores", "danger");
        });
}

// ================================
// PREENCHER SELECTS DE SETORES
// ================================

function preencherSelectores() {
    const selectSetorFiltro = document.getElementById("selectSetor");
    const selectSetorModal = document.getElementById("modalSetor");
    
    // Preencher select do FILTRO
    selectSetorFiltro.innerHTML = '<option value="">Todos os setores</option>';
    
    // Preencher select do MODAL
    selectSetorModal.innerHTML = '<option value="">Selecione um setor</option>';
    
    // Resetar select de leitos do modal
    const selectLeitoModal = document.getElementById("modalLeito");
    selectLeitoModal.innerHTML = '<option value="">Primeiro selecione um setor</option>';
    selectLeitoModal.disabled = true;
    
    // Preencher com os setores
    dispositivos.forEach(dispositivo => {
        // Para o filtro
        const optionFiltro = document.createElement("option");
        optionFiltro.value = dispositivo.setor;
        optionFiltro.textContent = dispositivo.setor;
        selectSetorFiltro.appendChild(optionFiltro);
        
        // Para o modal
        const optionModal = document.createElement("option");
        optionModal.value = dispositivo.setor;
        optionModal.textContent = dispositivo.setor;
        selectSetorModal.appendChild(optionModal);
    });
    
    // Inicializar leitos do filtro
    atualizarLeitosFiltro();
}

// ================================
// ATUALIZAR LEITOS DO FILTRO
// ================================

function atualizarLeitosFiltro() {
    const setorSelecionado = document.getElementById("selectSetor").value;
    const selectLeito = document.getElementById("selectLeito");

    selectLeito.innerHTML = "";

    if (!setorSelecionado) {
        // Se "Todos os setores" estiver selecionado
        selectLeito.innerHTML = '<option value="">Todos os leitos</option>';
        selectLeito.disabled = false;
        return;
    }

    const dispositivo = dispositivos.find(d => d.setor === setorSelecionado);

    if (!dispositivo) {
        selectLeito.innerHTML = '<option value="">Todos os leitos</option>';
        selectLeito.disabled = false;
        return;
    }

    selectLeito.innerHTML = '<option value="">Todos os leitos</option>';

    for (let i = 1; i <= dispositivo.qtd_leitos; i++) {
        const leitoFormatado = i.toString().padStart(2, '0');
        const option = document.createElement("option");
        option.value = leitoFormatado;
        option.textContent = leitoFormatado;
        selectLeito.appendChild(option);
    }
    
    selectLeito.disabled = false;
}

// ================================
// ATUALIZAR LEITOS DO MODAL
// ================================

function atualizarLeitosModal() {
    const setorSelecionado = document.getElementById("modalSetor").value;
    const selectLeito = document.getElementById("modalLeito");

    selectLeito.innerHTML = "";

    if (!setorSelecionado) {
        selectLeito.innerHTML = '<option value="">Primeiro selecione um setor</option>';
        selectLeito.disabled = true;
        return;
    }

    const dispositivo = dispositivos.find(d => d.setor === setorSelecionado);

    if (!dispositivo) {
        selectLeito.innerHTML = '<option value="">Setor sem leitos configurados</option>';
        selectLeito.disabled = true;
        return;
    }

    selectLeito.disabled = false;
    selectLeito.innerHTML = '<option value="">Selecione um leito</option>';

    for (let i = 1; i <= dispositivo.qtd_leitos; i++) {
        const leitoFormatado = i.toString().padStart(2, '0');
        const option = document.createElement("option");
        option.value = leitoFormatado;
        option.textContent = leitoFormatado;
        selectLeito.appendChild(option);
    }
}

// ================================
// CARREGAR JUSTIFICATIVAS (TABELA)
// ================================

async function carregarJustificativas() {
    const setor = document.getElementById("selectSetor").value;
    const leito = document.getElementById("selectLeito").value;
    
    filtrosAtuais = { setor, leito };
    
    let url = "/api/justificativas";
    const params = [];
    
    if (setor) params.push(`setor=${encodeURIComponent(setor)}`);
    if (leito) params.push(`leito=${encodeURIComponent(leito)}`);
    
    if (params.length > 0) {
        url += "?" + params.join("&");
    }
    
    // ✅ MOSTRAR MENSAGEM DE CARREGAMENTO
    const tbody = document.querySelector("#tabelaJustificativas tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2">Buscando justificativas...</p>
            </td>
        </tr>
    `;
    
    try {
        const resposta = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });
        const justificativas = await resposta.json();
        
        if (justificativas.erro) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="alert alert-danger mb-0">
                            <i class="bi bi-exclamation-triangle"></i>
                            Erro: ${justificativas.erro}
                        </div>
                    </td>
                </tr>
            `;
            mostrarMenuNavegacao(false);
            return;
        }
        
        // Armazenar todas as justificativas
        todasJustificativas = justificativas || [];
        
        if (todasJustificativas.length === 0) {
            renderizarTabelaPaginada([]);
            mostrarMenuNavegacao(false);
        } else {
            paginaAtual = 1;
            const justificativasPagina = aplicarPaginacao();
            renderizarTabelaPaginada(justificativasPagina);
            atualizarPaginacao();
            mostrarMenuNavegacao(true);
            
            // Múltiplos ajustes para garantir
            setTimeout(() => {
                ajustarParaMenuLateral();
                ajustarPaddingBody();
                ajustarAlturaTabela();
            }, 100);
            
            setTimeout(() => {
                ajustarParaMenuLateral();
                ajustarAlturaTabela();
            }, 100);
        }
        
    } catch (erro) {
        console.error("Erro ao carregar justificativas:", erro);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle"></i>
                        Erro de conexão ao carregar justificativas.
                    </div>
                </td>
            </tr>
        `;
        mostrarMenuNavegacao(false);
        mostrarToast("Erro ao carregar justificativas", "danger");
    }
}
// ================================
// FUNÇÕES DO MODAL
// ================================

function abrirModalNova() {
    document.getElementById("modalTitulo").textContent = "Nova Justificativa";
    document.getElementById("justificativaId").value = "";
    document.getElementById("formJustificativa").reset();
    
    // Resetar selects
    const selectSetor = document.getElementById("modalSetor");
    selectSetor.value = "";
    
    const selectLeito = document.getElementById("modalLeito");
    selectLeito.innerHTML = '<option value="">Primeiro selecione um setor</option>';
    selectLeito.disabled = true;
    
    // Limpar editor
    document.getElementById("editorJustificativa").innerHTML = "";
    
    // Esconder alerta se existir
    const alerta = document.getElementById("alertJustificativa");
    if (alerta) alerta.style.display = 'none';
}

async function editarJustificativa(id) {
    try {
        const resposta = await fetch(`/api/justificativas/${id}`, {
            headers: {
                "Accept": "application/json"
            }
        });
        const justificativa = await resposta.json();
        
        document.getElementById("modalTitulo").textContent = "Editar Justificativa";
        document.getElementById("justificativaId").value = justificativa.id;
        
        // Selecionar setor
        const selectSetor = document.getElementById("modalSetor");
        selectSetor.value = justificativa.setor;
        
        // Atualizar leitos do setor
        await new Promise(resolve => {
            atualizarLeitosModal();
            setTimeout(resolve, 100);
        });
        
        // Selecionar leito
        const selectLeito = document.getElementById("modalLeito");
        selectLeito.value = justificativa.leito;
        
        // Carregar conteúdo
        document.getElementById("editorJustificativa").innerHTML = justificativa.conteudo || "";
        
        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById("modalJustificativa"));
        modal.show();
        
    } catch (erro) {
        console.error("Erro ao carregar justificativa:", erro);
        mostrarToast("Erro ao carregar justificativa", "danger");
    }
}

// ================================
// FUNÇÕES DO MODAL - VISUALIZAÇÃO
// ================================

function visualizarJustificativa(id) {
    fetch(`/api/justificativas/${id}`, {
        headers: {
            "Accept": "application/json"
        }
    })
        .then(resposta => resposta.json())
        .then(justificativa => {
            // Setor/Leito
            document.getElementById("visualizarSetorLeito").textContent = 
                `${justificativa.setor} - Leito ${justificativa.leito}`;
            
            // Datas
            document.getElementById("visualizarDataCriacao").textContent = 
                justificativa.data_criacao || '-';
            document.getElementById("visualizarDataAtualizacao").textContent = 
                justificativa.data_atualizacao || '-';
            
            // Nomes
            document.getElementById("visualizarCriadoPor").innerHTML = 
                `<i class="bi bi-person-fill-add text-success"></i> ${justificativa.criado_por_nome || '-'}`;
            document.getElementById("visualizarEditadoPor").innerHTML = 
                `<i class="bi bi-person-fill-gear text-warning"></i> ${justificativa.editado_por_nome || '-'}`;
            
            // TOTAL DE VERSÕES
            const totalVersoes = justificativa.total_versoes || 1;
            document.getElementById("visualizarTotalVersoes").textContent = totalVersoes;
            
            // Conteúdo
            const visualizarConteudo = document.getElementById("visualizarConteudo");
            visualizarConteudo.innerHTML = justificativa.conteudo || '<em>Sem conteúdo</em>';
            visualizarConteudo.scrollTop = 0;
            visualizarConteudo.dataset.id = id;
            
            // Abrir modal SEM delay
            const modal = new bootstrap.Modal(document.getElementById("modalVisualizarJustificativa"));
            modal.show();
        })
        .catch(erro => {
            console.error("Erro ao visualizar justificativa:", erro);
            mostrarToast("Erro ao carregar justificativa", "danger");
        });
}
// ================================
// FORMATAR DATA RFC PARA DD/MM/AAAA HH:MM:SS (SEM FUSO)
// ================================

function formatarDataCompleta(dataString) {
    if (!dataString) return '-';

    // O backend (api_justificativas.py) já envia a data pronta no formato
    // "DD/MM/AAAA HH:MM". Nesse caso, usar direto sem reprocessar: passar
    // por `new Date()` faria o JS interpretar a string como MM/DD/AAAA
    // (formato americano) e inverter dia/mês.
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
        return dataString;
    }

    // Fallback para formatos não pré-formatados (ex.: RFC "Mon, 02 Mar 2026 21:19:16 GMT")
    try {
        const data = new Date(dataString);
        if (!isNaN(data.getTime())) {
            const dia = String(data.getUTCDate()).padStart(2, '0');
            const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
            const ano = data.getUTCFullYear();
            const horas = String(data.getUTCHours()).padStart(2, '0');
            const minutos = String(data.getUTCMinutes()).padStart(2, '0');
            const segundos = String(data.getUTCSeconds()).padStart(2, '0');

            return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
        }
    } catch (e) {
        console.error("Erro ao formatar data:", e);
    }

    return dataString;
}


// ================================
// FUNÇÕES DO MODAL - HISTÓRICO
// ================================
function verVersoes(id) {
    // Fechar o modal de visualização
    const modalVisualizar = bootstrap.Modal.getInstance(document.getElementById('modalVisualizarJustificativa'));
    if (modalVisualizar) {
        modalVisualizar.hide();
    }
    
    // Aguardar o modal fechar (tempo reduzido)
    setTimeout(() => {
        fetch(`/api/justificativas/${id}/versoes`, {
            headers: {
                "Accept": "application/json"
            }
        })
            .then(resposta => resposta.json())
            .then(data => {
                // Buscar dados da justificativa para o cabeçalho
                fetch(`/api/justificativas/${id}`, {
                    headers: {
                        "Accept": "application/json"
                    }
                })
                    .then(res => res.json())
                    .then(justificativa => {
                        // Preencher o modal com os dados
                        preencherModalHistorico(id, justificativa, data);
                        
                        // Abrir o modal de histórico
                        const modalHistorico = new bootstrap.Modal(document.getElementById('modalHistoricoVersoes'));
                        modalHistorico.show();
                    });
            })
            .catch(erro => {
                console.error("Erro ao carregar versões:", erro);
                mostrarToast("Erro ao carregar histórico", "danger");
                
                // Se der erro, reabrir o modal de visualização
                setTimeout(() => {
                    const modalVisualizarReabrir = new bootstrap.Modal(document.getElementById('modalVisualizarJustificativa'));
                    modalVisualizarReabrir.show();
                }, 100);
            });
    }, 100); // Reduzido de 500ms para 300ms
}

// ================================
// FUNÇÃO PARA VOLTAR DO HISTÓRICO PARA VISUALIZAÇÃO
// ================================

function voltarParaVisualizacao() {
    const modalHistorico = bootstrap.Modal.getInstance(document.getElementById('modalHistoricoVersoes'));
    if (modalHistorico) {
        modalHistorico.hide();
    }
    
    // Sempre reabrir a visualização quando chamar esta função
    setTimeout(() => {
        const modalVisualizar = new bootstrap.Modal(document.getElementById('modalVisualizarJustificativa'));
        modalVisualizar.show();
    }, 100);
}

// Função para preencher o modal de histórico
function preencherModalHistorico(id, justificativa, data) {
    // Atualizar localização
    document.getElementById("historicoLocalizacao").innerHTML = `
        <i class="bi bi-hospital"></i> <strong>${justificativa.setor} - Leito ${justificativa.leito}</strong><br>
        <small class="text-muted">Total de ${data.total_versoes} versão(ões)</small>
    `;
    
    // Gerar cards das versões
    const timeline = document.getElementById("timelineVersoes");
    timeline.innerHTML = '';
    
    // Ordenar versões da mais recente para a mais antiga
    const versoesOrdenadas = [...data.versoes].reverse();
    
    versoesOrdenadas.forEach((versao, index) => {
        const card = document.createElement('div');
        card.className = `version-card ${versao.tipo}`;
        
        // Determinar ícone e texto do tipo
        let iconeTipo, textoTipo;
        if (versao.tipo === 'criacao') {
            iconeTipo = 'bi-plus-circle-fill';
            textoTipo = 'CRIAÇÃO';
        } else {
            iconeTipo = 'bi-pencil-fill';
            textoTipo = 'EDIÇÃO';
        }
        
        // 🔥 HTML do card com olho no lado direito da versão
        card.innerHTML = `
            <div class="version-header">
                <div>
                    <span class="version-badge">
                        <i class="bi ${iconeTipo}"></i> ${textoTipo}
                    </span>
                    <span class="version-badge ms-2" style="position: relative; padding-right: 35px;">
                        <i class="bi bi-tag"></i> Versão ${versao.versao}
                        <!-- 🔥 OLHO NO LADO DIREITO DO NÚMERO DA VERSÃO -->
                        <button class="btn-view-version-btn" onclick="visualizarVersao(${id}, ${versao.versao})" 
                                title="Visualizar esta versão">
                            <i class="bi bi-eye"></i>
                        </button>
                    </span>
                </div>
                <div>
                    <span class="version-date">
                        <i class="bi bi-calendar3"></i> ${versao.data}
                    </span>
                </div>
            </div>
            <div class="version-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="version-user">
                        <i class="bi bi-person-circle"></i> ${versao.editado_por}
                    </span>
                </div>
                
                <div class="version-content">
                    ${versao.conteudo || '<em>Sem conteúdo</em>'}
                </div>
                
                ${versao.conteudo_anterior ? `
                    <div class="version-diff">
                        <small class="text-muted">
                            <i class="bi bi-arrow-left-right"></i> 
                            <span class="diff-removed">${versao.conteudo_anterior.substring(0, 100)}${versao.conteudo_anterior.length > 100 ? '...' : ''}</span>
                            → 
                            <span class="diff-added">${versao.conteudo.substring(0, 100)}${versao.conteudo.length > 100 ? '...' : ''}</span>
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
        
        timeline.appendChild(card);
    });
}

function visualizarVersao(justificativaId, numeroVersao) {
    // Fechar o modal de histórico
    const modalHistorico = bootstrap.Modal.getInstance(document.getElementById('modalHistoricoVersoes'));
    if (modalHistorico) {
        modalHistorico.hide();
    }
    
    setTimeout(() => {
        fetch(`/api/justificativas/${justificativaId}/versoes`, {
            headers: {
                "Accept": "application/json"
            }
        })
            .then(resposta => resposta.json())
            .then(data => {
                const versao = data.versoes.find(v => v.versao === numeroVersao);
                
                if (!versao) {
                    mostrarToast("Versão não encontrada", "danger");
                    // Reabrir o histórico
                    const modalHistoricoReabrir = new bootstrap.Modal(document.getElementById('modalHistoricoVersoes'));
                    modalHistoricoReabrir.show();
                    return;
                }
                
                // Criar um modal temporário
                const modalHtml = `
                    <div class="modal fade" id="modalVersao${numeroVersao}" tabindex="-1" data-bs-backdrop="static">
                        <div class="modal-dialog modal-lg modal-dialog-centered">
                            <div class="modal-content">
                                <div class="modal-header bg-info text-white">
                                    <h5 class="modal-title">
                                        <i class="bi bi-file-text"></i> Versão ${numeroVersao}
                                    </h5>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <p><strong>Data:</strong> ${versao.data}</p>
                                    <p><strong>Editado por:</strong> ${versao.editado_por}</p>
                                    <p><strong>Tipo:</strong> ${versao.tipo === 'criacao' ? 'Criação' : 'Edição'}</p>
                                    <hr>
                                    <div class="p-3 bg-light rounded">
                                        ${versao.conteudo}
                                    </div>
                                    ${versao.conteudo_anterior ? `
                                        <hr>
                                        <h6>Conteúdo anterior:</h6>
                                        <div class="p-3 bg-light rounded text-muted">
                                            ${versao.conteudo_anterior}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Remover modal anterior se existir
                const modalAntigo = document.getElementById(`modalVersao${numeroVersao}`);
                if (modalAntigo) modalAntigo.remove();
                
                // Adicionar ao body
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Mostrar o modal usando Bootstrap
                const modalVersao = new bootstrap.Modal(document.getElementById(`modalVersao${numeroVersao}`));
                modalVersao.show();
                
                // Quando fechar o modal de versão, reabrir o histórico
                document.getElementById(`modalVersao${numeroVersao}`).addEventListener('hidden.bs.modal', function() {
                    const modalHistoricoReabrir = new bootstrap.Modal(document.getElementById('modalHistoricoVersoes'));
                    modalHistoricoReabrir.show();
                });
            })
            .catch(erro => {
                console.error("Erro ao carregar versão:", erro);
                mostrarToast("Erro ao carregar versão", "danger");
            });
    }, 100); // Reduzido de 500ms para 300ms
}




// Atualizar o botão no modal de visualização
function editarDaVisualizacao() {
    const id = document.getElementById("visualizarConteudo").dataset.id;
    
    // Fechar modal de visualização
    const modalVisualizar = bootstrap.Modal.getInstance(document.getElementById("modalVisualizarJustificativa"));
    if (modalVisualizar) {
        modalVisualizar.hide();
    }
    
    // Abrir modal de edição
    setTimeout(() => {
        editarJustificativa(id);
    }, 100); // Reduzido de 500ms para 300ms
}




// 🔥 FUNÇÃO PARA COLAR COMO TEXTO PURO (opcional)
function colarTextoSemFormatacao(event) {
    event.preventDefault();
    const texto = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, texto);
}

// Adicionar evento de colar no editor
document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editorJustificativa");
    if (editor) {
        editor.addEventListener('paste', colarTextoSemFormatacao);
    }
});

// 🔥 FUNÇÃO PARA REMOVER FUNDO DO TEXTO SELECIONADO
function removerFundo() {
    const editor = document.getElementById("editorJustificativa");
    
    // Comando para remover formatação de fundo
    document.execCommand('removeFormat', false, null);
    
    // Remover especificamente background-color
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = range.commonAncestorContainer.parentElement;
        
        if (span && span.style.backgroundColor) {
            span.style.backgroundColor = '';
            if (!span.style.cssText) {
                span.outerHTML = span.innerHTML; // Remove a span se estiver vazia
            }
        }
    }
    
    editor.focus();
}



// ================================
// FUNÇÕES DE FORMATAÇÃO DE TEXTO
// ================================

function formatarTexto(comando) {
    document.execCommand(comando, false, null);
    document.getElementById("editorJustificativa").focus();
}
// ================================
// SALVAR JUSTIFICATIVA (VERSÃO MELHORADA COM DEBUG)
// ================================

async function salvarJustificativa(event) {
    event.preventDefault();
    
    console.log("🔵 FUNÇÃO salvarJustificativa INICIADA");
    
    const id = document.getElementById("justificativaId").value;
    console.log("🔍 ID recuperado:", id);
    console.log("🔍 Tipo do ID:", typeof id);
    console.log("🔍 ID é vazio?", id === "");
    
    const setor = document.getElementById("modalSetor").value;
    const leito = document.getElementById("modalLeito").value;
    const conteudo = document.getElementById("editorJustificativa").innerHTML;
    
    console.log("📦 Dados coletados:", { id, setor, leito, conteudo: conteudo.substring(0, 50) + "..." });
    
    // Validações
    if (!setor) {
        console.warn("⚠️ Validação falhou: setor vazio");
        mostrarToast("Selecione um setor", "warning");
        return;
    }
    
    if (!leito) {
        console.warn("⚠️ Validação falhou: leito vazio");
        mostrarToast("Selecione um leito", "warning");
        return;
    }
    
    if (!conteudo || conteudo.trim() === "" || conteudo === "<br>") {
        console.warn("⚠️ Validação falhou: conteúdo vazio");
        mostrarToast("Digite o conteúdo da justificativa", "warning");
        return;
    }
    
    const dados = {
        setor: setor,
        leito: leito,
        conteudo: conteudo
    };
    
    // 🔥 DESABILITAR BOTÃO DURANTE O PROCESSAMENTO
    const btnSalvar = document.querySelector("#modalJustificativa .btn-primary");
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    
    try {
        let url = "/api/justificativas";
        let metodo = "POST";
        
        if (id) {
            url = `/api/justificativas/${id}`;
            metodo = "PUT";
        }
        
        console.log(`📤 Enviando ${metodo} para ${url}`, dados);
        
        const resposta = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(dados)
        });
        
        console.log("📥 Status da resposta:", resposta.status);
        console.log("📥 Status text:", resposta.statusText);
        
        const resultado = await resposta.json();
        console.log("📥 Resultado:", resultado);
        
        if (resposta.ok) {
            console.log("✅ Sucesso!", resultado);
            mostrarToast(id ? "Justificativa atualizada com sucesso" : "Justificativa criada com sucesso", "success");
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById("modalJustificativa"));
            if (modal) {
                modal.hide();
            }
            
            // Marcar que pesquisa foi realizada e recarregar
            ultimaPesquisaRealizada = true;
            await carregarJustificativas();
            
        } else {
            console.error("❌ Erro retornado pela API:", resultado);
            mostrarToast(resultado.erro || "Erro ao salvar justificativa", "danger");
        }
        
    } catch (erro) {
        console.error("❌ Erro na requisição:", erro);
        console.error("❌ Detalhes do erro:", erro.message);
        mostrarToast("Erro ao conectar com o servidor: " + erro.message, "danger");
        
    } finally {
        // 🔥 REATIVAR BOTÃO
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginal;
        console.log("🔵 FUNÇÃO salvarJustificativa FINALIZADA");
    }
}

// ================================
// EXCLUIR JUSTIFICATIVA
// ================================

function excluirJustificativa(id) {
    if (!confirm("Tem certeza que deseja excluir esta justificativa?")) {
        return;
    }
    
    fetch(`/api/justificativas/${id}`, {
        method: "DELETE",
        headers: {
            "Accept": "application/json"
        }
    })
    .then(resposta => {
        if (resposta.ok) {
            mostrarToast("Justificativa excluída com sucesso", "success");
            carregarJustificativas();
        } else {
            resposta.json().then(data => {
                mostrarToast(data.erro || "Erro ao excluir justificativa", "danger");
            });
        }
    })
    .catch(erro => {
        console.error("Erro ao excluir justificativa:", erro);
        mostrarToast("Erro ao conectar com o servidor", "danger");
    });
}

// ========== FUNÇÃO PESQUISAR MODIFICADA ==========
function pesquisarJustificativas(event) {
    event.preventDefault();
    ultimaPesquisaRealizada = true;
    carregarJustificativas();
}

// ========== FUNÇÃO LIMPAR PESQUISA MODIFICADA ==========
function limparPesquisa() {
    document.getElementById("selectSetor").value = "";
    atualizarLeitosFiltro();
    document.getElementById("selectLeito").value = "";
    
    // Resetar dados
    todasJustificativas = [];
    ultimaPesquisaRealizada = false;
    
    // Mostrar mensagem na tabela
    const tbody = document.querySelector("#tabelaJustificativas tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center">
                <div class="alert alert-secondary mb-0">
                    <i class="bi bi-search"></i>
                    Selecione os filtros e clique em "Pesquisar" para buscar justificativas.
                </div>
            </td>
        </tr>
    `;
    
    // Esconder paginação
    esconderPaginacao();
}

// ========== OBSERVERS ==========
const paginationObserver = new ResizeObserver(() => {
    ajustarParaMenuLateral();
    ajustarPaddingBody();
    ajustarAlturaTabela();
});

const sidebarObserver = new ResizeObserver(() => {
    ajustarParaMenuLateral();
    ajustarAlturaTabela();
});


// ================================
// FUNÇÕES DE TOAST
// ================================

function mostrarToast(mensagem, tipo = "success") {
    let toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '2000';
        document.body.appendChild(toastContainer);
    }
    
    const bgClass = tipo === 'success' ? 'bg-success' : 
                    tipo === 'danger' ? 'bg-danger' : 
                    tipo === 'warning' ? 'bg-warning' : 
                    tipo === 'info' ? 'bg-info' : 'bg-secondary';
    
    const toastHTML = `
        <div class="toast align-items-center text-white ${bgClass} border-0 show mb-2" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.innerHTML += toastHTML;
    
    const toastElements = toastContainer.querySelectorAll('.toast');
    const lastToast = toastElements[toastElements.length - 1];
    const bsToast = new bootstrap.Toast(lastToast, { autohide: true, delay: 3000 });
    bsToast.show();
    
    setTimeout(() => {
        if (lastToast && lastToast.parentNode) {
            lastToast.remove();
        }
    }, 3500);
}




// ================================
// FORMATAR DATA SEM FUSO HORÁRIO (NÃO USADA, MAS MANTIDA)
// ================================

function formatarDataSemFuso(dataString) {
    if (!dataString) return '-';
    return dataString; // As datas já vêm formatadas do backend
}