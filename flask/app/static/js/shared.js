// shared.js - Funções compartilhadas entre páginas



// ================================
// FUNÇÕES DE TOAST - GLOBAL
// ================================

window.mostrarToast = function(mensagem, tipo = "success") {
    console.log("🍞 Toast:", mensagem, tipo);
    
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
};

// ================================
// FUNÇÃO PARA FORMATAR DATA NO PADRÃO BRASILEIRO
// ================================

window.formatarDataBR = function(dataString) {
    if (!dataString) return '-';
    
    console.log("📅 Formatando data:", dataString);
    
    // Se já estiver no formato DD/MM/AAAA HH:MM:SS, retorna como está
    if (typeof dataString === 'string' && dataString.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
        return dataString;
    }
    
    // Se vier no formato "YYYY-MM-DD HH:MM:SS" do MySQL
    if (typeof dataString === 'string' && dataString.includes(' ') && dataString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        const [data, hora] = dataString.split(' ');
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano} ${hora}`;
    }
    
    // Se vier no formato RFC "Mon, 03 Mar 2026 16:27:27 GMT"
    if (typeof dataString === 'string' && dataString.includes('GMT')) {
        try {
            const data = new Date(dataString);
            if (!isNaN(data.getTime())) {
                // Usar UTC para manter o horário original
                const dia = String(data.getUTCDate()).padStart(2, '0');
                const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
                const ano = data.getUTCFullYear();
                const horas = String(data.getUTCHours()).padStart(2, '0');
                const minutos = String(data.getUTCMinutes()).padStart(2, '0');
                const segundos = String(data.getUTCSeconds()).padStart(2, '0');
                
                return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
            }
        } catch (e) {
            console.error("Erro ao converter data RFC:", e);
        }
    }
    
    // Se for objeto Date
    if (dataString instanceof Date) {
        const dia = String(dataString.getUTCDate()).padStart(2, '0');
        const mes = String(dataString.getUTCMonth() + 1).padStart(2, '0');
        const ano = dataString.getUTCFullYear();
        const horas = String(dataString.getUTCHours()).padStart(2, '0');
        const minutos = String(dataString.getUTCMinutes()).padStart(2, '0');
        const segundos = String(dataString.getUTCSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
    }
    
    return dataString;
};


// Função para gerenciar a visibilidade dos modais
function gerenciarVisibilidadeModais(modalAtivoId) {
    // Lista de todos os modais da página
    const modais = [
        'modalVisualizarJustificativa',
        'modalHistoricoVersoes'
    ];
    
    // Esconde todos os modais primeiro
    modais.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    });
    
    // Remove todos os backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
    });
    
    // Mostra apenas o modal ativo
    const modalAtivo = document.getElementById(modalAtivoId);
    if (modalAtivo) {
        modalAtivo.style.display = 'block';
        modalAtivo.classList.add('show');
        
        // Cria um novo backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
        
        // Adiciona classe no body
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '0px';
    }
}


// Função para abrir modal de visualização (chame ela quando clicar para visualizar)
function abrirModalVisualizacao(id) {
    gerenciarVisibilidadeModais('modalVisualizarJustificativa');
    
    // Seu código existente para carregar dados...
    fetch(`/api/justificativas/${id}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('visualizarSetorLeito').innerHTML = `${data.setor} - Leito ${data.leito}`;
            document.getElementById('visualizarCriadoPor').innerHTML = data.criado_por;
            document.getElementById('visualizarDataCriacao').innerHTML = data.data_criacao;
            document.getElementById('visualizarEditadoPor').innerHTML = data.editado_por || '-';
            document.getElementById('visualizarDataAtualizacao').innerHTML = data.data_atualizacao || '-';
            document.getElementById('visualizarConteudo').innerHTML = data.conteudo;
            document.getElementById('visualizarConteudo').dataset.id = id;
        });
}


// Função para fechar modal de visualização
function fecharModalVisualizacao() {
    const modal = document.getElementById('modalVisualizarJustificativa');
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    // Remove backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.remove();
    });
    
    // Remove classe do body
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

// ================================
// FUNÇÕES DO MODAL - VISUALIZAÇÃO
// ================================

function visualizarJustificativa(id) {
    fetch(`/api/justificativas/${id}`)
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
        fetch(`/api/justificativas/${id}/versoes`)
            .then(resposta => resposta.json())
            .then(data => {
                // Buscar dados da justificativa para o cabeçalho
                fetch(`/api/justificativas/${id}`)
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

window.preencherModalHistorico = function(id, justificativa, data) {
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
        
        card.innerHTML = `
            <div class="version-header">
                <div>
                    <span class="version-badge">
                        <i class="bi ${iconeTipo}"></i> ${textoTipo}
                    </span>
                    <span class="version-badge ms-2" style="position: relative; padding-right: 35px;">
                        <i class="bi bi-tag"></i> Versão ${versao.versao}
                        <button class="btn-view-version-btn" onclick="window.visualizarVersao(${id}, ${versao.versao})" 
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
};

function visualizarVersao(justificativaId, numeroVersao) {
    // Fechar o modal de histórico
    const modalHistorico = bootstrap.Modal.getInstance(document.getElementById('modalHistoricoVersoes'));
    if (modalHistorico) {
        modalHistorico.hide();
    }
    
    setTimeout(() => {
        fetch(`/api/justificativas/${justificativaId}/versoes`)
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



