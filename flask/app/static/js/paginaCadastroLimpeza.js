// ================================
// VARIÁVEIS GLOBAIS
// ================================

let dispositivos = [];
let tipoFuncionarioBuscando = ''; // 'asg' ou 'enf'
let funcionariosCache = []; // Cache de todos os funcionários
let timeoutBusca = null;
let tipoFuncionarioBuscandoEdicao = ''; // 'asg' ou 'enf' para o modal de edição
let paginaAtual = 1;
let itensPorPagina = 10;

// Setores que usam o vocabulário próprio de tipo de limpeza (Programada/Extra)
function ehCentroCirurgicoSetor(setor) {
    const s = (setor || "").trim().toUpperCase();
    return s === "CENTRO CIRURGICO" || s === "CENTRO CIRÚRGICO";
}

// Preenche o <select> de tipo de limpeza de acordo com o setor escolhido
function preencherOpcoesTipoLimpeza(selectEl, setor, valorAtual = "") {
    if (!selectEl) return;

    const opcoes = ehCentroCirurgicoSetor(setor)
        ? ["Programada", "Extra"]
        : ["Concorrente", "Alta / Óbito / Transferência", "Longa Permanência"];

    selectEl.innerHTML = '<option value="">Selecione...</option>' +
        opcoes.map(o => `<option value="${o}">${o}</option>`).join("");

    if (valorAtual && opcoes.includes(valorAtual)) {
        selectEl.value = valorAtual;
    }
}

// Atualiza os labels de "+1 dia / +8 dias" e "15 min / 35 min" conforme o
// setor escolhido, e recalcula o tempo mínimo se o checkbox já estiver
// marcado. prefixo = '' para o modal de criação, 'edit' para o de edição.
function atualizarLabelsPorSetor(setor, prefixo) {
    const cc = ehCentroCirurgicoSetor(setor);

    const idLabelVencimento = prefixo ? 'editLabelVencimento' : 'labelVencimento';
    const labelVencimento = document.getElementById(idLabelVencimento);
    if (labelVencimento) labelVencimento.textContent = cc ? '+1 dia' : '+8 dias';

    const idLabelTempo = prefixo ? 'editLabelTempoMinimo' : 'labelTempoMinimo';
    const labelTempo = document.getElementById(idLabelTempo);
    if (labelTempo) labelTempo.textContent = cc ? '15 min' : '35 min';

    const idCheckboxTempo = prefixo ? 'editTempo50min' : 'tempo50min';
    const checkboxTempo = document.getElementById(idCheckboxTempo);
    if (checkboxTempo && checkboxTempo.checked) {
        const idCampoTempo = prefixo ? 'editTempoTotal' : 'tempoTotalText';
        const minutos = cc ? 15 : 35;
        const valor = `${String(minutos).padStart(2, '0')}:00`;
        document.getElementById(idCampoTempo).value = valor;

        // No modal de criação, o checkbox também recalcula a Data Fim a
        // partir da Data Início — refaz esse cálculo com o novo tempo mínimo.
        if (!prefixo) {
            const dataInicioInput = document.getElementById('dataInicio');
            if (dataInicioInput && dataInicioInput.value) {
                const dataInicio = new Date(dataInicioInput.value);
                if (!isNaN(dataInicio.getTime())) {
                    dataInicio.setMinutes(dataInicio.getMinutes() + minutos);
                    const ano = dataInicio.getFullYear();
                    const mes = String(dataInicio.getMonth() + 1).padStart(2, '0');
                    const dia = String(dataInicio.getDate()).padStart(2, '0');
                    const horas = String(dataInicio.getHours()).padStart(2, '0');
                    const minutosFim = String(dataInicio.getMinutes()).padStart(2, '0');
                    document.getElementById('dataFim').value = `${ano}-${mes}-${dia}T${horas}:${minutosFim}`;

                    if (document.getElementById('dataFimNow').checked) {
                        document.getElementById('dataFimNow').checked = false;
                    }
                }
            }
        }
    }
}

// ========== FUNÇÕES DE PAGINAÇÃO ==========
function aplicarPaginacao() {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return todasLimpezas.slice(inicio, fim);
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
    const totalItens = todasLimpezas.length;
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

// ========== FUNÇÃO MODIFICADA DE RENDERIZAÇÃO ==========
function renderizarTabelaPaginada(limpezasPagina) {
    const tbody = document.querySelector("#tabelaLimpezas tbody");
    tbody.innerHTML = "";

    if (!limpezasPagina || limpezasPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="text-center">
                    <div class="alert alert-info mb-0">
                        <i class="bi bi-info-circle"></i>
                        Nenhuma limpeza encontrada para os filtros selecionados.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    limpezasPagina.forEach(item => {
        let classeModo = item.modo_registro === "MANUAL"
            ? "modo-manual"
            : "modo-automatico";

        let statusClass = "";

        switch (item.status) {
            case "CONCLUIDA":
                statusClass = "status-concluida";
                break;
            case "PENDENTE":
                statusClass = "status-pendente";
                break;
            case "EM_ANDAMENTO":
                statusClass = "status-em-andamento";
                break;
            case "AGUARDANDO_VALIDACAO":
                statusClass = "status-aguardando-validacao";
                break;
            case "SUSPENSO":
                statusClass = "status-suspenso";
                break;
        }

        let funcionario = item.funcionario_asg || item.funcionario_tec || '';
        
        const leitoFormatado = item.numero_leito ? 
            item.numero_leito.toString().padStart(2, '0') : '';

        let tipoLimpezaExibicao = item.tipo_limpeza || '';
        const tipoLower = tipoLimpezaExibicao.toLowerCase();
        
        if (tipoLower.includes('alta') || tipoLower.includes('óbito') || tipoLower.includes('transferência')) {
            tipoLimpezaExibicao = 'Alta / Óbito / Transferência';
        } else if (tipoLower.includes('longa')) {
            tipoLimpezaExibicao = 'Longa Permanência';
        } else if (tipoLower === 'concorrente' || tipoLower.includes('concorrente')) {
            tipoLimpezaExibicao = 'Concorrente';
        }

        tbody.innerHTML += `
            <tr>
                <td>${formatarData(item.data_inicio)}</td>
                <td>${formatarData(item.data_fim)}</td>
                <td>${formatarData(item.data_validacao)}</td>
                <td>${formatarData(item.vencimento)}</td>
                <td>${item.setor || ''}</td>
                <td>${leitoFormatado}</td>
                <td>${item.paciente || 'S/P'}</td>
                <td>${funcionario}</td>
                <td>${item.funcionario_enf || ''}</td>
                <td>${tipoLimpezaExibicao}</td>
                <td>${item.tempo_total_text || ''}</td>
                <td><span class="${classeModo}">${item.modo_registro || ''}</span></td>
                <td><span class="${statusClass}">${item.status || ''}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary"
                        onclick="editarLimpeza(${item.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `;
    });
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


// ========== INICIALIZAÇÃO MODIFICADA ==========
document.addEventListener("DOMContentLoaded", function() {
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
            if (todasLimpezas.length > 0) {
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
    limparPesquisa();

    // Máscara de tempo e cálculo automático da data fim a partir do tempo digitado
    configurarCamposTempo();
});

// Evento de redimensionamento
window.addEventListener('resize', () => {
    ajustarParaMenuLateral();
    ajustarAlturaTabela();
});


// ================================
// AO CARREGAR A PÁGINA
// ================================

window.onload = function () {
    carregarSetores();
    limparPesquisa();
};


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
        });
}




// ================================
// PREENCHER SELECT DE SETORES (TELA + MODAL)
// ================================

function preencherSelectores() {
    const selectSetor = document.getElementById("selectSetor");
    const modalSetor = document.getElementById("modalSetor");
    const selectLeito = document.getElementById("modalLeito");
    
    // 🔥 Preencher select de setores do FILTRO PRINCIPAL
    selectSetor.innerHTML = "";
    selectSetor.innerHTML += `<option value="TODOS">Todos os Setores</option>`;
    
    // 🔥 Preencher select de setores do MODAL
    modalSetor.innerHTML = '<option value="">Selecione um setor</option>';
    
    // Resetar e desabilitar select de leitos do modal
    selectLeito.innerHTML = '<option value="">Primeiro selecione um setor</option>';
    selectLeito.disabled = true;
    
    // Preencher ambos os selects com os setores
    dispositivos.forEach(dispositivo => {
        selectSetor.innerHTML += `<option value="${dispositivo.setor}">${dispositivo.setor}</option>`;
        modalSetor.innerHTML += `<option value="${dispositivo.setor}">${dispositivo.setor}</option>`;
    });
    
    // 🔥 Atualizar leitos do filtro principal
    atualizarLeitos();
}

// ================================
// ATUALIZAR LEITOS PRINCIPAL
// ================================

function atualizarLeitos() {
    const setorSelecionado = document.getElementById("selectSetor").value;
    const selectLeito = document.getElementById("selectLeito");

    selectLeito.innerHTML = "";

    if (setorSelecionado === "TODOS") {
        selectLeito.innerHTML += `<option value="TODOS">Todos os Leitos</option>`;
        return;
    }

    const dispositivo = dispositivos.find(d => d.setor === setorSelecionado);

    if (!dispositivo) return;

    selectLeito.innerHTML += `<option value="TODOS">Todos os Leitos</option>`;

    for (let i = 1; i <= dispositivo.qtd_leitos; i++) {
        // 🔥 CORREÇÃO: value como STRING com 2 dígitos
        const leitoFormatado = i.toString().padStart(2, '0');
        selectLeito.innerHTML += `<option value="${leitoFormatado}">${leitoFormatado}</option>`;
    }
}

// ================================
// ATUALIZAR LEITOS MODAL
// ================================
function atualizarLeitosModal() {
    const setorSelecionado = document.getElementById("modalSetor").value;
    const selectLeito = document.getElementById("modalLeito");
    const dispositivo = dispositivos.find(d => d.setor === setorSelecionado);

    selectLeito.innerHTML = "";

    if (!setorSelecionado) {
        selectLeito.innerHTML = '<option value="">Primeiro selecione um setor</option>';
        selectLeito.disabled = true;
        return;
    }

    if (!dispositivo) {
        selectLeito.innerHTML = '<option value="">Setor sem leitos configurados</option>';
        selectLeito.disabled = true;
        return;
    }

    selectLeito.disabled = false;
    selectLeito.innerHTML = '<option value="">Selecione um leito</option>';

    for (let i = 1; i <= dispositivo.qtd_leitos; i++) {
        // 🔥 CORREÇÃO: value como STRING com 2 dígitos
        const leitoFormatado = i.toString().padStart(2, '0');
        selectLeito.innerHTML += `<option value="${leitoFormatado}">${leitoFormatado}</option>`;
    }
}


// EVENTOS DE MUDANÇA
document.addEventListener("change", function (e) {
    if (e.target.id === "selectSetor") {
        atualizarLeitos();
    }

    if (e.target.id === "modalSetor") {
        atualizarLeitosModal();

        const tipoAtual = document.getElementById("tipoLimpeza").value;
        preencherOpcoesTipoLimpeza(document.getElementById("tipoLimpeza"), e.target.value, tipoAtual);

        atualizarLabelsPorSetor(e.target.value, '');

        const checkboxVencimento = document.getElementById("calcular8dias");
        if (checkboxVencimento && checkboxVencimento.checked) {
            const tipo = document.getElementById("tipoLimpeza").value;
            const validacao = document.getElementById("dataValidacao").value;
            const fim = document.getElementById("dataFim").value;
            const dataRef = validacao || fim;

            if (dataRef && tipo) {
                const vencimento = calcularVencimentoParaInput(tipo, dataRef, e.target.value);
                if (vencimento) {
                    document.getElementById("dataVencimento").value = vencimento;
                }
            }
        }
    }

    if (e.target.id === "editSetor") {
        const tipoAtual = document.getElementById("editTipoLimpeza").value;
        preencherOpcoesTipoLimpeza(document.getElementById("editTipoLimpeza"), e.target.value, tipoAtual);

        atualizarLabelsPorSetor(e.target.value, 'edit');

        const checkboxVencimento = document.getElementById("editCalcular8dias");
        if (checkboxVencimento && checkboxVencimento.checked) {
            const tipo = document.getElementById("editTipoLimpeza").value;
            const validacao = document.getElementById("editDataValidacao")?.value;
            const fim = document.getElementById("editDataFim")?.value;
            const dataRef = validacao || fim;

            if (dataRef && tipo) {
                const vencimento = calcularVencimentoParaInput(tipo, dataRef, e.target.value);
                if (vencimento) {
                    document.getElementById("editDataVencimento").value = vencimento;
                }
            }
        }
    }
});

// ================================
// PESQUISAR LIMPEZAS MANUAIS
// ================================

function pesquisar(event) {
    if (event) event.preventDefault();

    const setor = document.getElementById("selectSetor").value;
    const leito = document.getElementById("selectLeito").value;
    const modo = document.getElementById("selectModo").value;

    // ✅ MOSTRAR MENSAGEM DE CARREGAMENTO
    const tbody = document.querySelector("#tabelaLimpezas tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="14" class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2">Buscando limpezas...</p>
            </td>
        </tr>
    `;

    fetch('/api/pesquisar_limpezas', {
        method: 'POST',
        headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
        },
        body: JSON.stringify({ setor, leito, modo })
    })
    .then(response => response.json())
    .then(data => {
        if (data.erro) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="text-center">
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
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="text-center">
                        <div class="alert alert-info mb-0">
                            <i class="bi bi-info-circle"></i>
                            Nenhuma limpeza encontrada para os filtros selecionados.
                        </div>
                    </td>
                </tr>
            `;
            mostrarMenuNavegacao(false);
            return;
        }
        
        // ORDENAR POR DATA DE INÍCIO (MAIS RECENTE PRIMEIRO)
        todasLimpezas = data.sort((a, b) => {
            const dataA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
            const dataB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
            return dataB - dataA;
        });
        
        paginaAtual = 1;
        const limpezasPagina = aplicarPaginacao();
        renderizarTabelaPaginada(limpezasPagina);
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
        }, 300);
    })
    .catch(error => {
        console.error("Erro na pesquisa:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="text-center">
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle"></i>
                        Erro de conexão ao buscar limpezas.
                    </div>
                </td>
            </tr>
        `;
        mostrarMenuNavegacao(false);
    });
}


// ================================
// FORMATAR DATA
// ================================

function formatarData(dataString) {
    if (!dataString) return "";

    const data = new Date(dataString);
    
    // Usar o fuso horário do sistema (local)
    return data.toLocaleString("pt-BR", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}





function limparPesquisa() {
    document.getElementById("selectSetor").value = "TODOS";
    atualizarLeitos();
    document.getElementById("selectLeito").value = "TODOS";
    document.getElementById("selectModo").value = "TODOS";
    
    // Limpar dados
    todasLimpezas = [];
    
    // ✅ MOSTRAR MENSAGEM DE TABELA VAZIA
    const tbody = document.querySelector("#tabelaLimpezas tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="14" class="text-center">
                <div class="alert alert-secondary mb-0">
                    <i class="bi bi-search"></i>
                    Selecione os filtros e clique em "Pesquisar" para buscar limpezas.
                </div>
            </td>
        </tr>
    `;
    
    // Esconder paginação
    esconderPaginacao();
}

// ================================
// FUNÇÕES PARA O MODAL DE CADASTRO
// ================================

// Inicializar modal quando abrir
document.getElementById('modalCadastro').addEventListener('show.bs.modal', function() {
    // Resetar formulário
    document.getElementById('formCadastroLimpeza').reset();

    // Resetar opções do tipo de limpeza (form.reset() não restaura innerHTML alterado via JS)
    preencherOpcoesTipoLimpeza(document.getElementById('tipoLimpeza'), '');
    atualizarLabelsPorSetor('', '');

    // Esconder alertas
    document.getElementById('alertCadastroLimpeza').style.display = 'none';
    
    // Resetar campos de funcionário
    document.getElementById('nomeAsg').value = '';
    document.getElementById('idCartaoAsg').value = '';
    document.getElementById('nomeAsg').style.opacity = '1';
    document.getElementById('asgPadrao').checked = false;
    
    document.getElementById('nomeEnf').value = '';
    document.getElementById('idCartaoEnf').value = '';
    document.getElementById('nomeEnf').style.opacity = '1';
    document.getElementById('enfPadrao').checked = false;
    
    // Resetar paciente
    document.getElementById('paciente').readOnly = false;
    document.getElementById('paciente').value = '';
    document.getElementById('semPaciente').checked = false;
    
    // DESMARCAR TODOS OS CHECKBOXES DE DATA E TEMPO
    document.getElementById('dataInicioNow').checked = false;
    document.getElementById('dataFimNow').checked = false;
    document.getElementById('validacaoIgualFim').checked = false;
    document.getElementById('tempo50min').checked = false;
    
    // LIMPAR CAMPOS DE DATA
    document.getElementById('dataInicio').value = '';
    document.getElementById('dataFim').value = '';
    document.getElementById('dataValidacao').value = '';
    document.getElementById('dataValidacao').readOnly = false;
    document.getElementById('dataInicio').readOnly = false;
    document.getElementById('dataFim').readOnly = false;
    
    // Resetar campo de vencimento
    document.getElementById('dataVencimento').value = '';
    document.getElementById('calcular8dias').checked = false;
    
    // Resetar cores dos campos
    document.getElementById('dataInicio').style.backgroundColor = '#ffffff';
    document.getElementById('dataFim').style.backgroundColor = '#ffffff';
    document.getElementById('dataValidacao').style.backgroundColor = '#ffffff';
    document.getElementById('dataVencimento').style.backgroundColor = '#e9ecef';
    
    // Carregar setores se necessário
    if (dispositivos.length === 0) {
        carregarSetores();
    } else {
        preencherModalSetores();
    }
    
   
    
    // ============================================
    // 🔥 ADICIONAR EVENTOS DO CHECKBOX +8 DIAS AQUI
    // ============================================

    // Remover eventos anteriores (usando cloneNode)
    const calcular8dias = document.getElementById('calcular8dias');
    if (calcular8dias) {
        const novoCalcular8dias = calcular8dias.cloneNode(true);
        calcular8dias.parentNode.replaceChild(novoCalcular8dias, calcular8dias);
        
        novoCalcular8dias.addEventListener('change', function() {
            const campoVencimento = document.getElementById('dataVencimento');
            
            if (this.checked) {
                // QUANDO MARCA: desabilita o campo e calcula
                campoVencimento.disabled = true;
                campoVencimento.style.backgroundColor = '#e9ecef';
                
                const tipo = document.getElementById('tipoLimpeza').value;
                const validacao = document.getElementById('dataValidacao').value;
                const fim = document.getElementById('dataFim').value;
                
                const dataRef = validacao || fim;
                
                if (!dataRef) {
                    alert('Preencha a data de validação ou fim primeiro!');
                    this.checked = false;
                    campoVencimento.disabled = false; // Reativa se der erro
                    return;
                }
                
                if (!tipo) {
                    alert('Selecione um tipo de limpeza!');
                    this.checked = false;
                    campoVencimento.disabled = false; // Reativa se der erro
                    return;
                }
                
                const setorAtual = document.getElementById('modalSetor').value;
                const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                if (vencimento) {
                    campoVencimento.value = vencimento;
                } else {
                    alert('Tipo de limpeza não elegível para vencimento');
                    this.checked = false;
                    campoVencimento.disabled = false; // Reativa se der erro
                }
            } else {
                // QUANDO DESMARCA: reativa o campo e limpa
                campoVencimento.disabled = false;
                campoVencimento.style.backgroundColor = '#ffffff';
                campoVencimento.value = ''; // Limpa o valor
            }
        });
    }
    
    // Evento para tipo de limpeza
    const tipoLimpeza = document.getElementById('tipoLimpeza');
    if (tipoLimpeza) {
        const novoTipoLimpeza = tipoLimpeza.cloneNode(true);
        tipoLimpeza.parentNode.replaceChild(novoTipoLimpeza, tipoLimpeza);
        
        novoTipoLimpeza.addEventListener('change', function() {
            if (document.getElementById('calcular8dias')?.checked) {
                const validacao = document.getElementById('dataValidacao').value;
                const fim = document.getElementById('dataFim').value;
                const dataRef = validacao || fim;
                
                if (dataRef) {
                    const setorAtual = document.getElementById('modalSetor').value;
                    const vencimento = calcularVencimentoParaInput(this.value, dataRef, setorAtual);
                    if (vencimento) {
                        document.getElementById('dataVencimento').value = vencimento;
                    }
                }
            }
        });
    }

    // Evento para data validação
    const dataValidacao = document.getElementById('dataValidacao');
    if (dataValidacao) {
        const novoDataValidacao = dataValidacao.cloneNode(true);
        dataValidacao.parentNode.replaceChild(novoDataValidacao, dataValidacao);
        
        novoDataValidacao.addEventListener('change', function() {
            if (document.getElementById('calcular8dias')?.checked) {
                const tipo = document.getElementById('tipoLimpeza').value;
                const fim = document.getElementById('dataFim').value;
                const dataRef = this.value || fim;
                
                if (dataRef && tipo) {
                    const setorAtual = document.getElementById('modalSetor').value;
                    const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                    if (vencimento) {
                        document.getElementById('dataVencimento').value = vencimento;
                    }
                }
            }
        });
    }

    // Evento para data fim
    const dataFim = document.getElementById('dataFim');
    if (dataFim) {
        const novoDataFim = dataFim.cloneNode(true);
        dataFim.parentNode.replaceChild(novoDataFim, dataFim);

        novoDataFim.addEventListener('change', function() {
            if (document.getElementById('calcular8dias')?.checked) {
                const tipo = document.getElementById('tipoLimpeza').value;
                const validacao = document.getElementById('dataValidacao').value;
                const dataRef = validacao || this.value;

                if (dataRef && tipo) {
                    const setorAtual = document.getElementById('modalSetor').value;
                    const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                    if (vencimento) {
                        document.getElementById('dataVencimento').value = vencimento;
                    }
                }
            }
        });
    }
});

// Quando o modal de busca for fechado
document.getElementById('modalBuscaFuncionario').addEventListener('hidden.bs.modal', function () {
    // Apenas resetar a variável - NÃO mexer no body class
    tipoFuncionarioBuscandoEdicao = '';
});

function preencherModalSetores() {
    const modalSetor = document.getElementById("modalSetor");
    modalSetor.innerHTML = '<option value="">Selecione um setor</option>';
    
    dispositivos.forEach(dispositivo => {
        modalSetor.innerHTML += `<option value="${dispositivo.setor}">${dispositivo.setor}</option>`;
    });
}

// Buscar funcionário (simulação - você pode implementar busca real)
function buscarFuncionario(tipo) {
    if (tipo === 'asg') {
        // Aqui você pode abrir um modal de busca de funcionários
        // Por enquanto, vamos simular
        const nome = prompt("Digite o nome do ASG:");
        if (nome) {
            document.getElementById('nomeAsg').value = nome;
            document.getElementById('idCartaoAsg').value = prompt("Digite o ID do cartão do ASG:");
        }
    } else if (tipo === 'enf') {
        const nome = prompt("Digite o nome do Enfermeiro:");
        if (nome) {
            document.getElementById('nomeEnf').value = nome;
            document.getElementById('idCartaoEnf').value = prompt("Digite o ID do cartão do Enfermeiro:");
        }
    }
}

// ================================
// FUNÇÕES PARA FUNCIONÁRIOS PADRÃO
// ================================

function toggleFuncionarioPadrao(tipo) {
    if (tipo === 'asg') {
        const isPadrao = document.getElementById('asgPadrao').checked;
        
        if (isPadrao) {
            // Selecionar ASG Padrão
            document.getElementById('nomeAsg').value = 'ASG Padrão';
            document.getElementById('idCartaoAsg').value = '1111111111';
            
            // Desabilitar clique no campo (já é readonly, mas vamos remover o onclick temporariamente)
            document.getElementById('nomeAsg').style.opacity = '0.7';
            
            // Se o outro checkbox estiver marcado? Não interfere
        } else {
            // Limpar campos
            document.getElementById('nomeAsg').value = '';
            document.getElementById('idCartaoAsg').value = '';
            document.getElementById('nomeAsg').style.opacity = '1';
        }
    } else if (tipo === 'enf') {
        const isPadrao = document.getElementById('enfPadrao').checked;
        
        if (isPadrao) {
            // Selecionar Enfermeiro Padrão
            document.getElementById('nomeEnf').value = 'Enfermagem Padrão';
            document.getElementById('idCartaoEnf').value = '2222222222';
            
            // Desabilitar clique no campo
            document.getElementById('nomeEnf').style.opacity = '0.7';
        } else {
            // Limpar campos
            document.getElementById('nomeEnf').value = '';
            document.getElementById('idCartaoEnf').value = '';
            document.getElementById('nomeEnf').style.opacity = '1';
        }
    }
}

// Setar data e hora atual
function setDataHoraAtual(tipo) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    
    const dataHoraStr = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
    
    if (tipo === 'inicio' && document.getElementById('dataInicioNow').checked) {
        document.getElementById('dataInicio').value = dataHoraStr;
    } else if (tipo === 'fim' && document.getElementById('dataFimNow').checked) {
        document.getElementById('dataFim').value = dataHoraStr;
    }
}

// Validação igual à data fim
function validacaoIgualDataFim() {
    const checkbox = document.getElementById('validacaoIgualFim');
    const inputValidacao = document.getElementById('dataValidacao');
    const inputFim = document.getElementById('dataFim');
    
    if (checkbox.checked) {
        inputValidacao.value = inputFim.value;
        inputValidacao.readOnly = true;
        inputValidacao.style.backgroundColor = '#e9ecef';
    } else {
        inputValidacao.readOnly = false;
        inputValidacao.style.backgroundColor = '#ffffff';
    }
}

// Toggle tempo 50 minutos
function toggleTempo50min() {
    const tempo50minCheckbox = document.getElementById('tempo50min');
    const tempoTotalInput = document.getElementById('tempoTotalText');
    const dataInicioInput = document.getElementById('dataInicio');
    const dataFimInput = document.getElementById('dataFim');

    if (tempo50minCheckbox.checked) {
        // Verifica se tem data de início
        if (!dataInicioInput.value) {
            alert('⚠️ Para usar o tempo mínimo automático, primeiro selecione uma Data de Início!');
            tempo50minCheckbox.checked = false;
            return;
        }

        const dataInicio = new Date(dataInicioInput.value);

        // Verifica se a data é válida
        if (isNaN(dataInicio.getTime())) {
            alert('⚠️ Data de Início inválida!');
            tempo50minCheckbox.checked = false;
            return;
        }

        const setorAtual = document.getElementById('modalSetor').value;
        const minutos = ehCentroCirurgicoSetor(setorAtual) ? 15 : 35;

        // Calcula data fim = data início + minutos
        dataInicio.setMinutes(dataInicio.getMinutes() + minutos);

        // Formata para datetime-local (YYYY-MM-DDThh:mm)
        const ano = dataInicio.getFullYear();
        const mes = String(dataInicio.getMonth() + 1).padStart(2, '0');
        const dia = String(dataInicio.getDate()).padStart(2, '0');
        const horas = String(dataInicio.getHours()).padStart(2, '0');
        const minutosFim = String(dataInicio.getMinutes()).padStart(2, '0');

        dataFimInput.value = `${ano}-${mes}-${dia}T${horas}:${minutosFim}`;
        tempoTotalInput.value = `${String(minutos).padStart(2, '0')}:00`;
        tempoTotalInput.readOnly = true;

        // Se o checkbox "Agora" da data fim estiver marcado, desmarca
        if (document.getElementById('dataFimNow').checked) {
            document.getElementById('dataFimNow').checked = false;
        }

    } else {
        // Quando desmarca, apenas libera o campo de tempo
        tempoTotalInput.readOnly = false;
        // Não limpa a data fim automaticamente
    }
}

// ================================
// SALVAR NOVA LIMPEZA MANUAL
// ================================
function salvarNovaLimpeza(event) {
    event.preventDefault();
    let vencimento = null;

    // Validar campos obrigatórios
    const setor = document.getElementById("modalSetor").value;
    const leito = document.getElementById("modalLeito").value;
    const tipo_limpeza = document.getElementById("tipoLimpeza").value;
    const id_cartao_asg = document.getElementById("idCartaoAsg").value;
    const id_cartao_enf = document.getElementById("idCartaoEnf").value;
    
    // Validar se os campos estão preenchidos
    if (!id_cartao_asg) {
        mostrarAlerta("alertCadastroLimpeza", "Selecione um ASG (use a busca ou marque 'ASG Padrão').");
        return;
    }
    
    if (!id_cartao_enf) {
        mostrarAlerta("alertCadastroLimpeza", "Selecione um Enfermeiro (use a busca ou marque 'Enfermeiro Padrão').");
        return;
    }

    // Processar paciente
    let paciente = document.getElementById("paciente").value;
    const semPaciente = document.getElementById("semPaciente").checked;
    
    if (semPaciente) {
        paciente = "S/P";
    } else if (!paciente) {
        paciente = null;
    }

    // Processar datas
    let dataInicio, dataFim, dataValidacao;
    
    // Data Início
    if (document.getElementById('dataInicioNow').checked) {
        const agora = new Date();
        dataInicio = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
    } else {
        dataInicio = document.getElementById('dataInicio').value.replace('T', ' ') + ':00';
    }
    
    // Data Fim
    if (document.getElementById('dataFimNow').checked) {
        const agora = new Date();
        dataFim = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
    } else {
        dataFim = document.getElementById('dataFim').value.replace('T', ' ') + ':00';
    }
    
    // Data Validação
    if (document.getElementById('validacaoIgualFim').checked) {
        dataValidacao = dataFim;
    } else if (document.getElementById('dataValidacao').value) {
        dataValidacao = document.getElementById('dataValidacao').value.replace('T', ' ') + ':00';
    } else {
        dataValidacao = null;
    }

   

    // Primeiro, verifica se tem valor manual no campo
    if (document.getElementById('dataVencimento').value) {
        vencimento = document.getElementById('dataVencimento').value.replace('T', ' ') + ':00';
    } 
    // Se não tem valor manual, mas o checkbox está marcado, calcula
    else if (document.getElementById('calcular8dias').checked) {
        const dataRef = dataValidacao || dataFim;
        if (dataRef) {
            vencimento = calcularVencimento(tipo_limpeza, dataRef, setor);
        }
    }

    const payload = {
        setor,
        leito,
        tipo_limpeza,
        id_cartao_asg,
        id_cartao_enf,
        paciente,
        data_inicio: dataInicio,
        data_fim: dataFim,
        data_validacao: dataValidacao,
        vencimento: vencimento,  // 🔥 AGORA USA O VALOR CORRETO
        tempo_total_text: document.getElementById('tempoTotalText').value,
        status: document.getElementById('status').value
    };

    console.log("📤 Enviando payload:", payload);

    fetch('/api/nova_limpeza_manual', {
        method: 'POST',
        headers: {"Content-Type": "application/json","Accept": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCadastro'));
            modal.hide();
            mostrarToast("Limpeza cadastrada com sucesso!", "success");
            pesquisar();
        } else {
            mostrarAlerta("alertCadastroLimpeza", data.error || "Erro ao cadastrar.");
        }
    })
    .catch(error => {
        console.error("Erro ao salvar:", error);
        mostrarAlerta("alertCadastroLimpeza", "Erro de conexão.");
    });
}

// Calcular vencimento (para MySQL)
function calcularVencimento(tipo, dataRefStr, setor = null) {
    const tiposComVencimento = [
        "Alta / Óbito / Transferência",
        "Longa Permanência",
        "Programada",
        "Extra"
    ];

    if (tiposComVencimento.includes(tipo) && dataRefStr) {
        const dias = ehCentroCirurgicoSetor(setor) ? 1 : 8;

        const data = new Date(dataRefStr);
        data.setDate(data.getDate() + dias);

        // Formatar para MySQL (YYYY-MM-DD HH:MM:SS)
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const horas = String(data.getHours()).padStart(2, '0');
        const minutos = String(data.getMinutes()).padStart(2, '0');
        const segundos = String(data.getSeconds()).padStart(2, '0');

        return `${ano}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
    }
    return null;
}



function mostrarAlerta(elementId, mensagem) {
    const alerta = document.getElementById(elementId);
    alerta.style.display = 'block';
    alerta.innerHTML = mensagem;
}

// Toggle sem paciente
function toggleSemPaciente() {
    const semPaciente = document.getElementById('semPaciente').checked;
    const pacienteInput = document.getElementById('paciente');
    
    if (semPaciente) {
        pacienteInput.value = 'S/P';
        pacienteInput.readOnly = true;
        pacienteInput.required = false; // Remove required se tiver
    } else {
        pacienteInput.value = '';
        pacienteInput.readOnly = false;
    }
}


// ================================
// FUNÇÕES DE BUSCA DE FUNCIONÁRIOS
// ================================

// Carregar todos os funcionários (pode ser chamada uma vez ou quando necessário)
function carregarFuncionarios() {
    return fetch('/api/funcionarios')
        .then(response => response.json())
        .then(data => {
            funcionariosCache = data;
            return data;
        })
        .catch(error => {
            console.error("Erro ao carregar funcionários:", error);
            return [];
        });
}

// Modificar a função buscarFuncionario para respeitar os checkboxes
function buscarFuncionario(tipo) {
    // Verificar se o checkbox padrão está marcado
    if (tipo === 'asg' && document.getElementById('asgPadrao').checked) {
        mostrarAlerta("alertCadastroLimpeza", "Desmarque 'ASG Padrão' para buscar outro funcionário.");
        return;
    }
    if (tipo === 'enf' && document.getElementById('enfPadrao').checked) {
        mostrarAlerta("alertCadastroLimpeza", "Desmarque 'Enfermeiro Padrão' para buscar outro funcionário.");
        return;
    }
    
    tipoFuncionarioBuscando = tipo;
    
    // Atualizar título do modal
    const titulo = tipo === 'asg' ? 'Buscar ASG' : 'Buscar Enfermeiro(a)';
    document.getElementById('modalBuscaTitulo').textContent = titulo;
    
    // Limpar campo de busca
    document.getElementById('buscaFuncionarioInput').value = '';
    
    // Mostrar mensagem inicial
    document.getElementById('listaFuncionariosBody').innerHTML = `
        <tr>
            <td colspan="4" class="text-center text-muted py-3">
                Digite para pesquisar...
            </td>
        </tr>
    `;
    
    // Se cache estiver vazio, carregar funcionários
    if (funcionariosCache.length === 0) {
        carregarFuncionarios().then(() => {
            // Abrir modal
            const modal = new bootstrap.Modal(document.getElementById('modalBuscaFuncionario'));
            modal.show();
            
            // Focar no input
            setTimeout(() => {
                document.getElementById('buscaFuncionarioInput').focus();
            }, 500);
        });
    } else {
        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('modalBuscaFuncionario'));
        modal.show();
        
        // Focar no input
        setTimeout(() => {
            document.getElementById('buscaFuncionarioInput').focus();
        }, 500);
    }
}

// Filtrar funcionários enquanto digita
document.getElementById('buscaFuncionarioInput')?.addEventListener('input', function() {
    const termo = this.value.toLowerCase().trim();
    
    // Debounce para não filtrar a cada tecla
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
        filtrarFuncionarios(termo);
    }, 300);
});

function filtrarFuncionarios(termo) {
    const tbody = document.getElementById('listaFuncionariosBody');
    
    if (!funcionariosCache.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-3">
                    Carregando funcionários...
                </td>
            </tr>
        `;
        return;
    }
    
    // Determinar qual tipo de funcionário estamos buscando (cadastro ou edição)
    const tipoBusca = tipoFuncionarioBuscando || tipoFuncionarioBuscandoEdicao;
    
    // Filtrar pelo tipo selecionado
    let funcionariosFiltrados = funcionariosCache.filter(f => {
        if (tipoBusca === 'asg') {
            return f.tipo === 'asg';
        } else if (tipoBusca === 'enf') {
            return f.tipo === 'enfermagem';
        }
        return true;
    });
    
    // Aplicar filtro de texto
    if (termo.length > 0) {
        funcionariosFiltrados = funcionariosFiltrados.filter(f => 
            f.nome.toLowerCase().includes(termo) || 
            f.id_cartao.toString().includes(termo)
        );
    }
    
    // Mostrar resultados
    if (funcionariosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-3">
                    Nenhum funcionário encontrado.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = '';
        funcionariosFiltrados.forEach(f => {
            tbody.innerHTML += `
                <tr onclick="selecionarFuncionario(this)" 
                    data-id="${f.id_cartao}" 
                    data-nome="${f.nome}"
                    data-tipo="${f.tipo}"
                    style="cursor: pointer;">
                    <td>${f.id_cartao}</td>
                    <td>${f.nome}</td>
                    <td>${f.tipo === 'asg' ? 'ASG' : 'Enfermagem'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-selecionar-funcionario"
                                onclick="event.stopPropagation(); selecionarFuncionario(this.parentElement.parentElement)">
                            Selecionar
                        </button>
                    </td>
                </tr>
            `;
        });
    }
}

function selecionarFuncionario(linha) {
    const id = linha.dataset.id;
    const nome = linha.dataset.nome;
    const tipoSelecionado = linha.dataset.tipo;
    
    // Determinar qual tipo de funcionário estamos buscando
    const tipoBusca = tipoFuncionarioBuscando || tipoFuncionarioBuscandoEdicao;
    const isEdicao = tipoFuncionarioBuscandoEdicao !== '';
    
    // Validar se o tipo do funcionário selecionado é compatível
    if (tipoBusca === 'asg' && tipoSelecionado !== 'asg') {
        alert("Por favor, selecione um funcionário do tipo ASG.");
        return;
    }
    if (tipoBusca === 'enf' && tipoSelecionado !== 'enfermagem') {
        alert("Por favor, selecione um funcionário do tipo Enfermagem.");
        return;
    }
    
    // Verificar se é um funcionário padrão
    if (nome.includes('Padrão')) {
        if (!confirm('Este é um funcionário padrão. Deseja selecioná-lo?')) {
            return;
        }
    }
    
    if (isEdicao) {
        // Estamos no modal de edição
        if (tipoFuncionarioBuscandoEdicao === 'asg') {
            document.getElementById('editIdCartaoAsg').value = id;
            document.getElementById('editNomeAsg').value = nome;
            document.getElementById('editNomeAsg').style.opacity = '1';
            
            // Desmarcar checkbox de padrão se estiver marcado
            if (document.getElementById('editAsgPadrao').checked) {
                document.getElementById('editAsgPadrao').checked = false;
            }
        } else if (tipoFuncionarioBuscandoEdicao === 'enf') {
            document.getElementById('editIdCartaoEnf').value = id;
            document.getElementById('editNomeEnf').value = nome;
            document.getElementById('editNomeEnf').style.opacity = '1';
            
            // Desmarcar checkbox de padrão se estiver marcado
            if (document.getElementById('editEnfPadrao').checked) {
                document.getElementById('editEnfPadrao').checked = false;
            }
        }
    } else {
        // Estamos no modal de cadastro
        if (tipoFuncionarioBuscando === 'asg') {
            document.getElementById('idCartaoAsg').value = id;
            document.getElementById('nomeAsg').value = nome;
            document.getElementById('nomeAsg').style.opacity = '1';
            
            if (document.getElementById('asgPadrao').checked) {
                document.getElementById('asgPadrao').checked = false;
            }
        } else if (tipoFuncionarioBuscando === 'enf') {
            document.getElementById('idCartaoEnf').value = id;
            document.getElementById('nomeEnf').value = nome;
            document.getElementById('nomeEnf').style.opacity = '1';
            
            if (document.getElementById('enfPadrao').checked) {
                document.getElementById('enfPadrao').checked = false;
            }
        }
    }
    
    // Fechar apenas o modal de busca
    const modalBusca = bootstrap.Modal.getInstance(document.getElementById('modalBuscaFuncionario'));
    if (modalBusca) {
        modalBusca.hide();
    }
    
    // Resetar as variáveis de controle
    tipoFuncionarioBuscando = '';
    tipoFuncionarioBuscandoEdicao = '';
}



// ================================
// FUNÇÕES DE EDIÇÃO
// ================================

// Buscar funcionário no modal de edição
function buscarFuncionarioEdicao(tipo) {
    // Verificar se o checkbox padrão está marcado
    if (tipo === 'asg' && document.getElementById('editAsgPadrao').checked) {
        mostrarAlerta("alertEdicaoLimpeza", "Desmarque 'ASG Padrão' para buscar outro funcionário.");
        return;
    }
    if (tipo === 'enf' && document.getElementById('editEnfPadrao').checked) {
        mostrarAlerta("alertEdicaoLimpeza", "Desmarque 'Enfermeiro Padrão' para buscar outro funcionário.");
        return;
    }
    
    tipoFuncionarioBuscandoEdicao = tipo;
    
    // Atualizar título do modal
    const titulo = tipo === 'asg' ? 'Buscar ASG' : 'Buscar Enfermeiro(a)';
    document.getElementById('modalBuscaTitulo').textContent = titulo;
    
    // Limpar campo de busca
    document.getElementById('buscaFuncionarioInput').value = '';
    
    // Mostrar mensagem inicial
    document.getElementById('listaFuncionariosBody').innerHTML = `
        <tr>
            <td colspan="4" class="text-center text-muted py-3">
                Digite para pesquisar...
            </td>
        </tr>
    `;
    
    // Função para abrir o modal de busca
    const abrirModalBusca = () => {
        // ✅ SIMPLES: apenas criar e mostrar o modal
        const modalBusca = new bootstrap.Modal(document.getElementById('modalBuscaFuncionario'));
        modalBusca.show();
        
        // Focar no input após abrir
        setTimeout(() => {
            document.getElementById('buscaFuncionarioInput').focus();
        }, 500);
    };
    
    // Se cache estiver vazio, carregar funcionários
    if (funcionariosCache.length === 0) {
        carregarFuncionarios().then(() => {
            abrirModalBusca();
        });
    } else {
        abrirModalBusca();
    }
}

// Toggle funcionário padrão no modal de edição
function toggleFuncionarioPadraoEdicao(tipo) {
    if (tipo === 'asg') {
        const isPadrao = document.getElementById('editAsgPadrao').checked;
        
        if (isPadrao) {
            document.getElementById('editNomeAsg').value = 'ASG Padrão';
            document.getElementById('editIdCartaoAsg').value = '1111111111';
            document.getElementById('editNomeAsg').style.opacity = '0.7';
        } else {
            document.getElementById('editNomeAsg').value = '';
            document.getElementById('editIdCartaoAsg').value = '';
            document.getElementById('editNomeAsg').style.opacity = '1';
        }
    } else if (tipo === 'enf') {
        const isPadrao = document.getElementById('editEnfPadrao').checked;
        
        if (isPadrao) {
            document.getElementById('editNomeEnf').value = 'Enfermagem Padrão';
            document.getElementById('editIdCartaoEnf').value = '2222222222';
            document.getElementById('editNomeEnf').style.opacity = '0.7';
        } else {
            document.getElementById('editNomeEnf').value = '';
            document.getElementById('editIdCartaoEnf').value = '';
            document.getElementById('editNomeEnf').style.opacity = '1';
        }
    }
}

// Toggle sem paciente no modal de edição
function toggleEditSemPaciente() {
    const semPaciente = document.getElementById('editSemPaciente').checked;
    const pacienteInput = document.getElementById('editPaciente');
    
    if (semPaciente) {
        pacienteInput.value = 'S/P';
        pacienteInput.readOnly = true;
    } else {
        pacienteInput.value = '';
        pacienteInput.readOnly = false;
    }
}
function editarLimpeza(id) {
    // Buscar dados da limpeza
    fetch(`/api/limpeza/${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                mostrarToast(data.error, "danger");
                return;
            }
            
            console.log("📦 Dados recebidos:", data);
            
            // Preencher setores primeiro
            preencherSetoresEdicao();
            
            // Preencher campos
            document.getElementById('editIdLimpeza').value = data.id || '';
            document.getElementById('editSetor').value = data.setor || '';
            
            // Atualizar leitos baseado no setor
            atualizarLeitosModalEdicao();
            
            // Aguardar leitos carregarem e setar o valor
            setTimeout(() => {
                document.getElementById('editLeito').value = data.numero_leito || '';
            }, 100);
            
            // Funcionários
            document.getElementById('editNomeAsg').value = data.nome_asg || '';
            document.getElementById('editIdCartaoAsg').value = data.id_cartao_asg || '';
            document.getElementById('editNomeEnf').value = data.nome_enf || '';
            document.getElementById('editIdCartaoEnf').value = data.id_cartao_enf || '';
            
            // Resetar checkboxes de padrão
            document.getElementById('editAsgPadrao').checked = false;
            document.getElementById('editEnfPadrao').checked = false;
            document.getElementById('editNomeAsg').style.opacity = '1';
            document.getElementById('editNomeEnf').style.opacity = '1';
            
            // Verificar se são funcionários padrão
            if (data.id_cartao_asg == '1111111111') {
                document.getElementById('editAsgPadrao').checked = true;
                document.getElementById('editNomeAsg').style.opacity = '0.7';
            }
            if (data.id_cartao_enf == '2222222222') {
                document.getElementById('editEnfPadrao').checked = true;
                document.getElementById('editNomeEnf').style.opacity = '0.7';
            }
            
            // Função para ajustar data ao fuso local
            function ajustarDataParaFusoLocal(dataString) {
                if (!dataString) return '';
                const data = new Date(dataString);
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                const dia = String(data.getDate()).padStart(2, '0');
                const horas = String(data.getHours()).padStart(2, '0');
                const minutos = String(data.getMinutes()).padStart(2, '0');
                return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
            }
            
            // Aplicar ajuste nas datas
            if (data.data_inicio) {
                document.getElementById('editDataInicio').value = ajustarDataParaFusoLocal(data.data_inicio);
            }
            if (data.data_fim) {
                document.getElementById('editDataFim').value = ajustarDataParaFusoLocal(data.data_fim);
            }
            if (data.data_validacao) {
                document.getElementById('editDataValidacao').value = ajustarDataParaFusoLocal(data.data_validacao);
            }
            
            // Carregar vencimento
            if (data.vencimento) {
                const vencimento = new Date(data.vencimento);
                const ano = vencimento.getFullYear();
                const mes = String(vencimento.getMonth() + 1).padStart(2, '0');
                const dia = String(vencimento.getDate()).padStart(2, '0');
                const horas = String(vencimento.getHours()).padStart(2, '0');
                const minutos = String(vencimento.getMinutes()).padStart(2, '0');
                
                document.getElementById('editDataVencimento').value = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
            } else {
                document.getElementById('editDataVencimento').value = '';
            }
            
            // Tempo
            document.getElementById('editTempoTotal').value = data.tempo_total_text || '35:00';
            
            // Status
            document.getElementById('editStatus').value = data.status || '';
            
            // Paciente
            const paciente = data.paciente || '';
            document.getElementById('editPaciente').value = paciente;
            
            // Checkbox "Sem Paciente"
            if (paciente === 'S/P') {
                document.getElementById('editSemPaciente').checked = true;
                document.getElementById('editPaciente').readOnly = true;
            } else {
                document.getElementById('editSemPaciente').checked = false;
                document.getElementById('editPaciente').readOnly = false;
            }
            
            // Checkboxes de data - desmarcar "Agora"
            document.getElementById('editDataInicioNow').checked = false;
            document.getElementById('editDataFimNow').checked = false;
            document.getElementById('editValidacaoIgualFim').checked = false;
            document.getElementById('editDataValidacao').readOnly = false;
            
            // Checkbox de tempo
            const minutoMinimoEsperado = ehCentroCirurgicoSetor(data.setor) ? '15:00' : '35:00';
            if (data.tempo_total_text === minutoMinimoEsperado) {
                document.getElementById('editTempo50min').checked = true;
                document.getElementById('editTempoTotal').readOnly = true;
            } else {
                document.getElementById('editTempo50min').checked = false;
                document.getElementById('editTempoTotal').readOnly = false;
            }
            
            // Configurar evento do checkbox +8 dias
            const editCalcular8dias = document.getElementById('editCalcular8dias');
            if (editCalcular8dias) {
                const novoEditCalcular8dias = editCalcular8dias.cloneNode(true);
                editCalcular8dias.parentNode.replaceChild(novoEditCalcular8dias, editCalcular8dias);
                
                novoEditCalcular8dias.addEventListener('change', function() {
                    const campoVencimento = document.getElementById('editDataVencimento');
                    
                    if (this.checked) {
                        // QUANDO MARCA: desabilita o campo e calcula
                        campoVencimento.disabled = true;
                        campoVencimento.style.backgroundColor = '#e9ecef';
                        
                        const tipo = document.getElementById('editTipoLimpeza').value;
                        const validacao = document.getElementById('editDataValidacao').value;
                        const fim = document.getElementById('editDataFim').value;
                        
                        const dataRef = validacao || fim;
                        
                        if (!dataRef) {
                            alert('Preencha a data de validação ou fim primeiro!');
                            this.checked = false;
                            campoVencimento.disabled = false; // Reativa se der erro
                            return;
                        }
                        
                        if (!tipo) {
                            alert('Selecione um tipo de limpeza!');
                            this.checked = false;
                            campoVencimento.disabled = false; // Reativa se der erro
                            return;
                        }
                        
                        const setorAtual = document.getElementById('editSetor').value;
                        const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                        if (vencimento) {
                            campoVencimento.value = vencimento;
                        } else {
                            alert('Tipo de limpeza não elegível para vencimento');
                            this.checked = false;
                            campoVencimento.disabled = false; // Reativa se der erro
                        }
                    } else {
                        // QUANDO DESMARCA: reativa o campo e limpa
                        campoVencimento.disabled = false;
                        campoVencimento.style.backgroundColor = '#ffffff';
                        campoVencimento.value = ''; // Limpa o valor
                    }
                });
            }
            
            // Configurar evento para tipo de limpeza
            const editTipoLimpeza = document.getElementById('editTipoLimpeza');
            if (editTipoLimpeza) {
                const novoEditTipoLimpeza = editTipoLimpeza.cloneNode(true);
                editTipoLimpeza.parentNode.replaceChild(novoEditTipoLimpeza, editTipoLimpeza);
                
                novoEditTipoLimpeza.addEventListener('change', function() {
                    if (document.getElementById('editCalcular8dias')?.checked) {
                        const validacao = document.getElementById('editDataValidacao').value;
                        const fim = document.getElementById('editDataFim').value;
                        const dataRef = validacao || fim;
                        
                        if (dataRef) {
                            const setorAtual = document.getElementById('editSetor').value;
                            const vencimento = calcularVencimentoParaInput(this.value, dataRef, setorAtual);
                            if (vencimento) {
                                document.getElementById('editDataVencimento').value = vencimento;
                            }
                        }
                    }
                });
            }

            // Configurar evento para data validação
            const editDataValidacao = document.getElementById('editDataValidacao');
            if (editDataValidacao) {
                const novoEditDataValidacao = editDataValidacao.cloneNode(true);
                editDataValidacao.parentNode.replaceChild(novoEditDataValidacao, editDataValidacao);
                
                novoEditDataValidacao.addEventListener('change', function() {
                    if (document.getElementById('editCalcular8dias')?.checked) {
                        const tipo = document.getElementById('editTipoLimpeza').value;
                        const fim = document.getElementById('editDataFim').value;
                        const dataRef = this.value || fim;
                        
                        if (dataRef && tipo) {
                            const setorAtual = document.getElementById('editSetor').value;
                            const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                            if (vencimento) {
                                document.getElementById('editDataVencimento').value = vencimento;
                            }
                        }
                    }
                });
            }

            // Configurar evento para data fim
            const editDataFim = document.getElementById('editDataFim');
            if (editDataFim) {
                const novoEditDataFim = editDataFim.cloneNode(true);
                editDataFim.parentNode.replaceChild(novoEditDataFim, editDataFim);
                
                novoEditDataFim.addEventListener('change', function() {
                    if (document.getElementById('editCalcular8dias')?.checked) {
                        const tipo = document.getElementById('editTipoLimpeza').value;
                        const validacao = document.getElementById('editDataValidacao').value;
                        const dataRef = validacao || this.value;
                        
                        if (dataRef && tipo) {
                            const setorAtual = document.getElementById('editSetor').value;
                            const vencimento = calcularVencimentoParaInput(tipo, dataRef, setorAtual);
                            if (vencimento) {
                                document.getElementById('editDataVencimento').value = vencimento;
                            }
                        }
                    }
                });
            }
            
            // Configurar eventos dos checkboxes "Agora"
            const editDataInicioNow = document.getElementById('editDataInicioNow');
            if (editDataInicioNow) {
                const novoEditDataInicioNow = editDataInicioNow.cloneNode(true);
                editDataInicioNow.parentNode.replaceChild(novoEditDataInicioNow, editDataInicioNow);
                
                novoEditDataInicioNow.addEventListener('change', function() {
                    const input = document.getElementById('editDataInicio');
                    if (this.checked) {
                        const agora = new Date();
                        const ano = agora.getFullYear();
                        const mes = String(agora.getMonth() + 1).padStart(2, '0');
                        const dia = String(agora.getDate()).padStart(2, '0');
                        const horas = String(agora.getHours()).padStart(2, '0');
                        const minutos = String(agora.getMinutes()).padStart(2, '0');
                        
                        input.value = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
                        input.readOnly = true;
                        input.style.backgroundColor = '#e9ecef';
                    } else {
                        input.readOnly = false;
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }
            
            const editDataFimNow = document.getElementById('editDataFimNow');
            if (editDataFimNow) {
                const novoEditDataFimNow = editDataFimNow.cloneNode(true);
                editDataFimNow.parentNode.replaceChild(novoEditDataFimNow, editDataFimNow);
                
                novoEditDataFimNow.addEventListener('change', function() {
                    const input = document.getElementById('editDataFim');
                    if (this.checked) {
                        const agora = new Date();
                        const ano = agora.getFullYear();
                        const mes = String(agora.getMonth() + 1).padStart(2, '0');
                        const dia = String(agora.getDate()).padStart(2, '0');
                        const horas = String(agora.getHours()).padStart(2, '0');
                        const minutos = String(agora.getMinutes()).padStart(2, '0');
                        
                        input.value = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
                        input.readOnly = true;
                        input.style.backgroundColor = '#e9ecef';
                    } else {
                        input.readOnly = false;
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }
            
            // ============================================
            // 🔥 DEPOIS: DEFINIR OS VALORES (APÓS OS CLONES)
            // ============================================
            
            // 🔥 NORMALIZAR E DEFINIR O TIPO DE LIMPEZA
            let tipoLimpeza = data.tipo_limpeza || '';
            const tipoLower = tipoLimpeza.toLowerCase();
            
            if (tipoLower.includes('alta') || tipoLower.includes('óbito') || tipoLower.includes('transferência')) {
                tipoLimpeza = 'Alta / Óbito / Transferência';
            } else if (tipoLower.includes('longa')) {
                tipoLimpeza = 'Longa Permanência';
            } else if (tipoLower === 'concorrente' || tipoLower.includes('concorrente')) {
                tipoLimpeza = 'Concorrente';
            }
            
            preencherOpcoesTipoLimpeza(document.getElementById('editTipoLimpeza'), data.setor, tipoLimpeza);
            atualizarLabelsPorSetor(data.setor, 'edit');

            // Verificar se o vencimento corresponde ao calculado (AGORA COM O TIPO JÁ DEFINIDO)
            if (data.vencimento) {
                const tiposComVencimento = ["Alta / Óbito / Transferência", "Longa Permanência", "Programada", "Extra"];

                if (tiposComVencimento.includes(tipoLimpeza)) {
                    const dataRefStr = data.data_validacao || data.data_fim;

                    if (dataRefStr) {
                        const dias = ehCentroCirurgicoSetor(data.setor) ? 1 : 8;
                        const dataRef = new Date(dataRefStr);
                        const dataVencimentoCalculada = new Date(dataRef);
                        dataVencimentoCalculada.setDate(dataRef.getDate() + dias);

                        const vencimentoAtual = new Date(data.vencimento);
                        
                        const mesmaData = 
                            vencimentoAtual.getFullYear() === dataVencimentoCalculada.getFullYear() &&
                            vencimentoAtual.getMonth() === dataVencimentoCalculada.getMonth() &&
                            vencimentoAtual.getDate() === dataVencimentoCalculada.getDate() &&
                            Math.abs(vencimentoAtual.getHours() - dataVencimentoCalculada.getHours()) <= 1;
                        
                        document.getElementById('editCalcular8dias').checked = mesmaData;
                    } else {
                        document.getElementById('editCalcular8dias').checked = false;
                    }
                } else {
                    document.getElementById('editCalcular8dias').checked = false;
                }
            }
            
            // ============================================
            
            // Abrir modal
            const modal = new bootstrap.Modal(document.getElementById('modalEditar'));
            modal.show();
        })
        .catch(error => {
            console.error("Erro ao buscar limpeza:", error);
            mostrarToast("Erro ao carregar dados da limpeza", "danger");
        });
}

function salvarEdicaoLimpeza(event) {
    event.preventDefault();
    let vencimento = null;
    
    const id = document.getElementById('editIdLimpeza').value;
    const setor = document.getElementById('editSetor').value;
    const leito = document.getElementById('editLeito').value;
    const tipo_limpeza = document.getElementById('editTipoLimpeza').value;
    const status = document.getElementById('editStatus').value;
    const id_cartao_asg = document.getElementById('editIdCartaoAsg').value;
    const id_cartao_enf = document.getElementById('editIdCartaoEnf').value;
    
    // Validar campos obrigatórios
    if (!setor || !leito) {
        mostrarAlerta("alertEdicaoLimpeza", "Selecione setor e leito.");
        return;
    }
    
    if (!id_cartao_asg) {
        mostrarAlerta("alertEdicaoLimpeza", "Selecione um ASG.");
        return;
    }
    
    if (!id_cartao_enf) {
        mostrarAlerta("alertEdicaoLimpeza", "Selecione um Enfermeiro.");
        return;
    }
    
    // Função para formatar para MySQL
    function formatarParaMySQL(dataLocalStr) {
        if (!dataLocalStr) return null;
        return dataLocalStr.replace('T', ' ') + ':00';
    }
    
    // Processar data de início
    let dataInicio;
    if (document.getElementById('editDataInicioNow').checked) {
        const agora = new Date();
        dataInicio = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
    } else {
        dataInicio = formatarParaMySQL(document.getElementById('editDataInicio').value);
    }
    
    // Processar data de fim
    let dataFim;
    if (document.getElementById('editDataFimNow').checked) {
        const agora = new Date();
        dataFim = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
    } else {
        dataFim = formatarParaMySQL(document.getElementById('editDataFim').value);
    }
    
    // Processar data de validação
    let dataValidacao;
    if (document.getElementById('editValidacaoIgualFim').checked) {
        dataValidacao = dataFim;
    } else if (document.getElementById('editDataValidacao').value) {
        dataValidacao = formatarParaMySQL(document.getElementById('editDataValidacao').value);
    } else {
        dataValidacao = null;
    }
    
    // 🔥 PROCESSAR VENCIMENTO
    // Primeiro, verifica se tem valor manual no campo
    if (document.getElementById('editDataVencimento').value) {
        vencimento = formatarParaMySQL(document.getElementById('editDataVencimento').value);
    } 
    // Se não tem valor manual, mas o checkbox está marcado, calcula
    else if (document.getElementById('editCalcular8dias').checked) {
        const dataRef = dataValidacao || dataFim;
        if (dataRef) {
            const setorAtual = document.getElementById('editSetor').value;
            vencimento = calcularVencimento(tipo_limpeza, dataRef, setorAtual);
        }
    }
    
    // Processar paciente
    let paciente = document.getElementById('editPaciente').value;
    const semPaciente = document.getElementById('editSemPaciente').checked;
    
    if (semPaciente) {
        paciente = 'S/P';
    } else if (!paciente) {
        paciente = null;
    }
    
    console.log("📤 Enviando dados:", {
        id, setor, leito, tipo_limpeza, status,
        dataInicio, dataFim, dataValidacao, vencimento
    });
    
    fetch('/api/atualizar_limpeza', {
        method: 'POST',
        headers: {"Content-Type": "application/json","Accept": "application/json" },
        body: JSON.stringify({
            id,
            setor,
            leito,
            tipo_limpeza,
            status,
            id_cartao_asg,
            id_cartao_enf,
            paciente,
            data_inicio: dataInicio,
            data_fim: dataFim,
            data_validacao: dataValidacao,
            vencimento: vencimento,  // 🔥 ADICIONADO
            tempo_total_text: document.getElementById('editTempoTotal').value
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditar'));
            modal.hide();
            mostrarToast("Limpeza atualizada com sucesso!", "success");
            pesquisar();
        } else {
            mostrarAlerta("alertEdicaoLimpeza", data.error || "Erro ao atualizar.");
        }
    })
    .catch(error => {
        console.error("Erro ao atualizar:", error);
        mostrarAlerta("alertEdicaoLimpeza", "Erro de conexão.");
    });
}

// Função para formatar data no padrão brasileiro
function formatarDataBR(dataString) {
    if (!dataString) return '';
    
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return dataString;
        
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        console.error("Erro ao formatar data:", e);
        return dataString;
    }
}

// Função para mostrar alerta
function mostrarAlerta(elementId, mensagem) {
    const alerta = document.getElementById(elementId);
    if (alerta) {
        alerta.style.display = 'block';
        alerta.innerHTML = mensagem;
        
        // Auto-esconder após 5 segundos
        setTimeout(() => {
            alerta.style.display = 'none';
        }, 5000);
    } else {
        console.error("Elemento alerta não encontrado:", elementId);
        alert(mensagem);
    }
}

// Função para mostrar toast
function mostrarToast(mensagem, tipo = "success") {
    
    // Criar toast container se não existir
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        // ALTERADO: de top-50 start-50 translate-middle para top-0 end-0
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
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.innerHTML += toastHTML;
    
    // Inicializar o toast do Bootstrap
    const toastElements = toastContainer.querySelectorAll('.toast');
    const lastToast = toastElements[toastElements.length - 1];
    const bsToast = new bootstrap.Toast(lastToast, { autohide: true, delay: 3000 });
    bsToast.show();
    
    // Auto-remover após 3 segundos
    setTimeout(() => {
        if (lastToast && lastToast.parentNode) {
            lastToast.remove();
        }
    }, 3500);
}

// Toggle tempo 50 minutos no modal de edição
function toggleTempo50minEdicao() {
    if (document.getElementById('editTempo50min').checked) {
        const setorAtual = document.getElementById('editSetor').value;
        const minutos = ehCentroCirurgicoSetor(setorAtual) ? 15 : 35;
        document.getElementById('editTempoTotal').value = `${String(minutos).padStart(2, '0')}:00`;
        document.getElementById('editTempoTotal').readOnly = true;
    } else {
        document.getElementById('editTempoTotal').readOnly = false;
    }
}

// Validação igual à data fim no modal de edição
function validacaoIgualDataFimEdicao() {
    const checkbox = document.getElementById('editValidacaoIgualFim');
    const inputValidacao = document.getElementById('editDataValidacao');
    const inputFim = document.getElementById('editDataFim');
    
    if (checkbox.checked) {
        inputValidacao.value = inputFim.value;
        inputValidacao.readOnly = true;
        inputValidacao.style.backgroundColor = '#e9ecef';
    } else {
        inputValidacao.readOnly = false;
        inputValidacao.style.backgroundColor = '#ffffff';
    }
}

// Setar data e hora atual
function setDataHoraAtual(tipo) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    
    const dataHoraStr = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
    
    if (tipo === 'inicio') {
        const checkbox = document.getElementById('dataInicioNow');
        const input = document.getElementById('dataInicio');
        
        if (checkbox.checked) {
            input.value = dataHoraStr;
            input.readOnly = true;
            input.style.backgroundColor = '#e9ecef';
        } else {
            input.readOnly = false;
            input.style.backgroundColor = '#ffffff';
        }
    } else if (tipo === 'fim') {
        const checkbox = document.getElementById('dataFimNow');
        const input = document.getElementById('dataFim');
        
        if (checkbox.checked) {
            input.value = dataHoraStr;
            input.readOnly = true;
            input.style.backgroundColor = '#e9ecef';
        } else {
            input.readOnly = false;
            input.style.backgroundColor = '#ffffff';
        }
    }
}

// Preencher setores no modal de edição
function preencherSetoresEdicao() {
    const editSetor = document.getElementById("editSetor");
    editSetor.innerHTML = '<option value="">Selecione um setor</option>';
    
    dispositivos.forEach(dispositivo => {
        editSetor.innerHTML += `<option value="${dispositivo.setor}">${dispositivo.setor}</option>`;
    });
}

// Atualizar leitos no modal de edição
function atualizarLeitosModalEdicao() {
    const setorSelecionado = document.getElementById("editSetor").value;
    const dispositivo = dispositivos.find(d => d.setor === setorSelecionado);
    const selectLeito = document.getElementById("editLeito");
    
    selectLeito.innerHTML = '<option value="">Selecione um leito</option>';
    
    if (!dispositivo) {
        selectLeito.disabled = true;
        return;
    }
    
    selectLeito.disabled = false;
    
    for (let i = 1; i <= dispositivo.qtd_leitos; i++) {
        // 🔥 CORREÇÃO: value como STRING com 2 dígitos
        const leitoFormatado = i.toString().padStart(2, '0');
        selectLeito.innerHTML += `<option value="${leitoFormatado}">${leitoFormatado}</option>`;
    }
}


// Recalcular quando mudar o tipo de limpeza ou datas (APENAS SE O CHECKBOX ESTIVER MARCADO)
document.getElementById('tipoLimpeza')?.addEventListener('change', function() {
    if (document.getElementById('calcular8dias')?.checked) {
        const dataValidacao = document.getElementById('dataValidacao').value;
        const dataFim = document.getElementById('dataFim').value;
        const dataRef = dataValidacao || dataFim;
        
        if (dataRef) {
            const setorAtual = document.getElementById('modalSetor').value;
            const vencimento = calcularVencimentoParaInput(this.value, dataRef, setorAtual);
            if (vencimento) {
                document.getElementById('dataVencimento').value = vencimento;
            }
        }
    }
});

// Também recalcular quando mudar data de validação ou fim (se checkbox marcado)
document.getElementById('dataValidacao')?.addEventListener('change', function() {
    if (document.getElementById('calcular8dias')?.checked) {
        const tipoLimpeza = document.getElementById('tipoLimpeza').value;
        const dataFim = document.getElementById('dataFim').value;
        const dataRef = this.value || dataFim;

        if (dataRef) {
            const setorAtual = document.getElementById('modalSetor').value;
            const vencimento = calcularVencimentoParaInput(tipoLimpeza, dataRef, setorAtual);
            if (vencimento) {
                document.getElementById('dataVencimento').value = vencimento;
            }
        }
    }
});

document.getElementById('dataFim')?.addEventListener('change', function() {
    if (document.getElementById('calcular8dias')?.checked) {
        const tipoLimpeza = document.getElementById('tipoLimpeza').value;
        const dataValidacao = document.getElementById('dataValidacao').value;
        const dataRef = dataValidacao || this.value;

        if (dataRef) {
            const setorAtual = document.getElementById('modalSetor').value;
            const vencimento = calcularVencimentoParaInput(tipoLimpeza, dataRef, setorAtual);
            if (vencimento) {
                document.getElementById('dataVencimento').value = vencimento;
            }
        }
    }
});





// ============================================
// FUNÇÃO AUXILIAR PARA CALCULAR VENCIMENTO
// ============================================
function calcularVencimentoParaInput(tipo, dataRefStr, setor = null) {
    const tiposComVencimento = [
        "Alta / Óbito / Transferência",
        "Longa Permanência",
        "Programada",
        "Extra"
    ];

    if (tiposComVencimento.includes(tipo) && dataRefStr) {
        const dias = ehCentroCirurgicoSetor(setor) ? 1 : 8;

        const data = new Date(dataRefStr);
        data.setDate(data.getDate() + dias);

        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const horas = String(data.getHours()).padStart(2, '0');
        const minutos = String(data.getMinutes()).padStart(2, '0');

        return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
    }
    return null;
}

// ================================
// MÁSCARA DE TEMPO E CÁLCULO AUTOMÁTICO DA DATA FIM A PARTIR DO TEMPO DIGITADO
// ================================

// Aplica máscara MM:SS enquanto o usuário digita (só dígitos, insere ":" após os 2 primeiros)
function aplicarMascaraTempo(inputEl) {
    if (!inputEl) return;

    inputEl.setAttribute('maxlength', '5');
    inputEl.addEventListener('input', function() {
        const digitos = this.value.replace(/\D/g, '').slice(0, 4);
        this.value = digitos.length > 2
            ? `${digitos.slice(0, 2)}:${digitos.slice(2)}`
            : digitos;
    });
}

// Calcula data fim = data início + tempo digitado (MM:SS) e sobrescreve o campo de data fim
function calcularDataFimPorTempoDigitado(tempoInputId, dataInicioInputId, dataFimInputId) {
    const tempoInput = document.getElementById(tempoInputId);
    const dataInicioInput = document.getElementById(dataInicioInputId);
    const dataFimInput = document.getElementById(dataFimInputId);
    if (!tempoInput || tempoInput.readOnly || !dataInicioInput || !dataFimInput) return;

    const match = /^(\d{1,2}):([0-5]\d)$/.exec(tempoInput.value.trim());
    if (!match) return;

    if (!dataInicioInput.value) return;

    const dataInicio = new Date(dataInicioInput.value);
    if (isNaN(dataInicio.getTime())) return;

    const minutos = parseInt(match[1], 10);
    const segundos = parseInt(match[2], 10);
    dataInicio.setSeconds(dataInicio.getSeconds() + minutos * 60 + segundos);

    const ano = dataInicio.getFullYear();
    const mes = String(dataInicio.getMonth() + 1).padStart(2, '0');
    const dia = String(dataInicio.getDate()).padStart(2, '0');
    const h = String(dataInicio.getHours()).padStart(2, '0');
    const m = String(dataInicio.getMinutes()).padStart(2, '0');

    dataFimInput.value = `${ano}-${mes}-${dia}T${h}:${m}`;
}

// Liga a máscara e o recálculo automático nos dois campos de Tempo (cadastro e edição)
function configurarCamposTempo() {
    const tempoTotalText = document.getElementById('tempoTotalText');
    const editTempoTotal = document.getElementById('editTempoTotal');

    aplicarMascaraTempo(tempoTotalText);
    aplicarMascaraTempo(editTempoTotal);

    tempoTotalText?.addEventListener('change', function() {
        calcularDataFimPorTempoDigitado('tempoTotalText', 'dataInicio', 'dataFim');
    });
    editTempoTotal?.addEventListener('change', function() {
        calcularDataFimPorTempoDigitado('editTempoTotal', 'editDataInicio', 'editDataFim');
    });
}

