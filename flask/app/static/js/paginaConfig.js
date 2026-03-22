// Função para carregar setores de dispositivos a partir do JSON local
async function carregarSetoresDispositivoDoJson(selectElement) {
    if (!selectElement) return;

    try {
        const response = await fetch('/api/ler_setores_json');
        if (!response.ok) throw new Error(`HTTP ${response.status} ao ler JSON local`);

        const setores = await response.json();

        selectElement.innerHTML = '<option value="">Selecione um setor</option>';

        setores.forEach(nome => {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            selectElement.appendChild(option);
        });

        console.log(`Setores carregados do JSON em ${selectElement.id} (${setores.length} itens)`);
    } catch (error) {
        console.error(`Erro ao carregar setores do JSON em ${selectElement.id}:`, error);
        selectElement.innerHTML = '<option value="">Erro ao carregar setores</option>';
    }
}

// Botão "Atualizar setores" - VERSÃO COMPLETA COM DESATIVAÇÃO DO NOVO SETOR
document.getElementById('btnAtualizarSetores')?.addEventListener('click', async () => {
    const btnAtualizar = document.getElementById('btnAtualizarSetores');
    const btnNovoSetor = document.querySelector('button[data-bs-target="#modalSetorCadastro"]');
    const textoOriginal = btnAtualizar.innerHTML;
    const textoOriginalNovoSetor = btnNovoSetor ? btnNovoSetor.innerHTML : '';
    
    try {
        // 🔥 Desabilitar botão de atualizar
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Atualizando...';
        
        // 🔥 Desabilitar botão de Novo Setor
        if (btnNovoSetor) {
            btnNovoSetor.disabled = true;
            btnNovoSetor.style.opacity = '0.6';
            btnNovoSetor.style.cursor = 'not-allowed';
        }

        console.log('🔵 Atualizando setores...');
        
        const response = await fetch('/api/atualizar_setores', { method: 'POST' });
        const data = await response.json();

        if (data.status === 'ok') {
            const selects = [
                document.getElementById('setorDispositivoCadastro'),
                document.getElementById('setorDispositivoEditar')
            ];

            selects.forEach(select => {
                if (!select) return;
                select.innerHTML = '<option value="">Selecione um setor</option>';
                data.setores.forEach(nome => {
                    select.innerHTML += `<option value="${nome}">${nome}</option>`;
                });
            });

            console.log(`✅ ${data.quantidade} setores atualizados!`);
            
            if (typeof mostrarToast === 'function') {
                mostrarToast(`✅ ${data.quantidade} setores atualizados!`, 'success');
            }
        } else {
            throw new Error(data.mensagem || 'Erro ao atualizar setores');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        if (typeof mostrarToast === 'function') {
            mostrarToast(`❌ ${error.message}`, 'danger');
        }
    } finally {
        // 🔥 Reabilitar botão de atualizar
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = textoOriginal;
        
        // 🔥 Reabilitar botão de Novo Setor
        if (btnNovoSetor) {
            btnNovoSetor.disabled = false;
            btnNovoSetor.style.opacity = '';
            btnNovoSetor.style.cursor = '';
        }
    }
});

// Função auxiliar para definir valor no select de edição
async function definirValorSelect(select, valor) {
    if (!select || !valor) return;

    if (select.options.length > 1) {
        select.value = valor;
        if (select.value !== valor) console.warn(`Valor "${valor}" não encontrado em ${select.id}`);
        return;
    }

    return new Promise(resolve => {
        const observer = new MutationObserver(() => {
            if (select.options.length > 1) {
                observer.disconnect();
                select.value = valor;
                if (select.value !== valor) console.warn(`Valor "${valor}" não encontrado após espera`);
                resolve();
            }
        });

        observer.observe(select, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 5000);
    });
}

// ================================
// FUNÇÕES DE CONTROLE DE NOTIFICAÇÕES (NOVO)
// ================================

// Controle do checkbox de notificações no cadastro
function configurarControleNotificacoesCadastro() {
    const checkbox = document.getElementById('receberNotificacoesCadastro');
    const container = document.getElementById('setoresContainerCadastro');
    
    if (checkbox && container) {
        checkbox.addEventListener('change', function() {
            container.style.display = this.checked ? 'block' : 'none';
            
            // Se desmarcar, desmarca todos os setores
            if (!this.checked) {
                document.querySelectorAll('.setor-checkbox-cadastro').forEach(cb => {
                    cb.checked = false;
                });
            }
        });
    }
}

// Controle do checkbox de notificações na edição
function configurarControleNotificacoesEdicao() {
    const checkbox = document.getElementById('editReceberNotificacoes');
    const container = document.getElementById('setoresContainerEditar');
    
    if (checkbox && container) {
        checkbox.addEventListener('change', function() {
            container.style.display = this.checked ? 'block' : 'none';
            
            // Se desmarcar, desmarca todos os setores
            if (!this.checked) {
                document.querySelectorAll('.setor-checkbox-editar').forEach(cb => {
                    cb.checked = false;
                });
            }
        });
    }
}

// ================================
// CONFIGURAÇÃO DE EVENTOS DE EDIÇÃO
// ================================

function configurarEventosEdicao() {
    // Dispositivos
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modalEditar');
            if (!modal) return;

            document.getElementById('editId').value = btn.dataset.id || '';
            document.getElementById('editNome').value = btn.dataset.nome || '';
            document.getElementById('editIp').value = btn.dataset.ip || '';
            document.getElementById('editSituacao').checked = Number(btn.dataset.status) === 1;

            new bootstrap.Modal(modal).show();
        });
    });

    // Setores
    document.querySelectorAll('.btn-editar-setor').forEach(btn => {
        btn.addEventListener('click', async () => {
            const modal = document.getElementById('modalSetorEditar');
            if (!modal) return;

            document.getElementById('editSetorId').value = btn.dataset.id || '';
            document.getElementById('editSetorLeitos').value = btn.dataset.leitos || '';
            document.getElementById('editSetorDispositivo').value = btn.dataset.dispositivo || '';
            document.getElementById('editSetorAtivo').checked = Number(btn.dataset.status) === 1;

            // definir setor no select (vindo do JSON)
            const selectNome = document.getElementById('editSetorNome');
            if (selectNome) {
                await carregarSetoresDispositivoDoJson(selectNome);
                selectNome.value = btn.dataset.nome || '';
            }

            new bootstrap.Modal(modal).show();
        });
    });
}

function configurarEventosEdicaoUsuarios() {
    document.querySelectorAll('.btn-editar-usuario').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modalUsuarioEditar');
            if (!modal) return;

            // 🔴 LOGS PARA DEBUG
            console.log('=== DEBUG EDIÇÃO USUÁRIO ===');
            console.log('data-notificacoes:', btn.dataset.notificacoes);
            console.log('data-notificacoes (tipo):', typeof btn.dataset.notificacoes);
            console.log('data-setores:', btn.dataset.setores);
            
            // 🔴 CORREÇÃO: Aceitar tanto "true" quanto "1" como verdadeiro
            const valorNotificacoes = btn.dataset.notificacoes;
            const receberNotificacoes = valorNotificacoes === 'true' || valorNotificacoes === '1';
            
            console.log('receberNotificacoes (convertido):', receberNotificacoes);
            
            document.getElementById('editUsuarioId').value = btn.dataset.id || '';
            document.getElementById('editUsuarioLogin').value = btn.dataset.login || '';
            document.getElementById('editUsuarioNome').value = btn.dataset.nome || '';
            document.getElementById('editUsuarioEmail').value = btn.dataset.email || '';
            document.getElementById('editUsuarioTipo').value = btn.dataset.tipo || 'GERENTE';
            
            // Notificações
            const checkboxNotificacoes = document.getElementById('editReceberNotificacoes');
            const containerSetores = document.getElementById('setoresContainerEditar');
            
            if (checkboxNotificacoes) {
                checkboxNotificacoes.checked = receberNotificacoes;
                console.log('checkbox marcado:', checkboxNotificacoes.checked);
                
                if (containerSetores) {
                    containerSetores.style.display = receberNotificacoes ? 'block' : 'none';
                }
            }
            
            // Setores selecionados
            const setoresSelecionados = btn.dataset.setores ? btn.dataset.setores.split(',').map(Number) : [];
            console.log('setoresSelecionados:', setoresSelecionados);
            
            // 🔴 CORREÇÃO: Garantir que o campo hidden seja atualizado
            const campoHidden = document.getElementById('editSetoresSelecionados');
            if (campoHidden) {
                campoHidden.value = setoresSelecionados.join(',');
                console.log('campo hidden atualizado:', campoHidden.value);
            }
            
            // Verificar se todos os setores estão selecionados
            const totalSetores = document.querySelectorAll('.setor-checkbox-editar').length;
            const todosSelecionados = setoresSelecionados.length === totalSetores && totalSetores > 0;
            
            // Marcar checkbox "Todos" se necessário
            const checkboxTodos = document.getElementById('setorTodosEditar');
            if (checkboxTodos) {
                checkboxTodos.checked = todosSelecionados;
                checkboxTodos.indeterminate = !todosSelecionados && setoresSelecionados.length > 0;
            }
            
            // Marcar os checkboxes visualmente
            document.querySelectorAll('.setor-checkbox-editar').forEach(cb => {
                const deveEstarMarcado = setoresSelecionados.includes(parseInt(cb.value));
                cb.checked = deveEstarMarcado;
            });
            
            document.getElementById('editUsuarioStatus').checked = Number(btn.dataset.status) === 1;

            new bootstrap.Modal(modal).show();
        });
    });
}

// ================================
// FUNÇÕES DE CARREGAMENTO DE DADOS (CORRIGIDA)
async function carregarUsuarios() {
    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const usuarios = await response.json();
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        
        if (tbody) {
            tbody.innerHTML = '';
            usuarios.forEach(u => {
                // Formatar setores para exibição
                let setoresDisplay = '';
                let setoresIds = '';
                
                if (u.setores_notificacao && u.setores_notificacao.length > 0) {
                    // 🔴 SIMPLES: Se tem mais de 3 setores, mostra "Todos"
                    if (u.setores_notificacao.length >= 3) {
                        setoresDisplay = '<span class="badge bg-info text-dark">Todos</span>';
                    } else {
                        // Mostrar badges individuais
                        setoresDisplay = u.setores_notificacao.map(s => 
                            `<span class="badge bg-primary text-white me-1">${s.nome}</span>`
                        ).join('');
                    }
                    setoresIds = u.setores_notificacao.map(s => s.id).join(',');
                } else {
                    setoresDisplay = '<span class="text-muted">Nenhum</span>';
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${u.login}</td>
                    <td>${u.nome}</td>
                    <td>${u.email || '-'}</td>
                    <td>
                        ${u.tipo === 'ADMIN' 
                            ? '<span class="badge bg-danger">Administrador</span>'
                            : '<span class="badge bg-primary">Gerente</span>'}
                    </td>
                    <td class="text-center">
                        ${u.notificacoes
                            ? '<span class="badge bg-success">Sim</span>'
                            : '<span class="badge bg-secondary">Não</span>'}
                    </td>
                    <td>
                        ${setoresDisplay}
                    </td>
                    <td>${u.ultimo_acesso || '<span class="text-muted">Nunca acessou</span>'}</td>
                    <td>
                        ${u.status == 1 
                            ? '<span class="badge bg-success">Ativo</span>'
                            : '<span class="badge bg-danger">Inativo</span>'}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary btn-editar-usuario"
                            data-id="${u.id}"
                            data-login="${u.login}"
                            data-nome="${u.nome}"
                            data-email="${u.email || ''}"
                            data-tipo="${u.tipo}"
                            data-notificacoes="${u.notificacoes}"
                            data-setores="${setoresIds}"
                            data-status="${u.status}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            configurarEventosEdicaoUsuarios();
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        mostrarToast('Erro ao carregar usuários', 'danger');
    }
}

// Agora atualizar as funções de carregamento
async function carregarDispositivos() {
    try {
        const response = await fetch('/api/dispositivos');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const dispositivos = await response.json();
        const tbody = document.querySelector('#tabelaDispositivos tbody');
        
        if (tbody) {
            tbody.innerHTML = '';
            dispositivos.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d.nome}</td>
                    <td>${d.ip}</td>
                    <td>
                        ${d.status == 1 
                            ? '<span class="badge bg-success">Ativo</span>'
                            : '<span class="badge bg-danger">Inativo</span>'}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary btn-editar"
                            data-id="${d.id}"
                            data-nome="${d.nome}"
                            data-ip="${d.ip}"
                            data-status="${d.status}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // 🔴 SÓ configura eventos de dispositivos
            configurarEventosEdicaoDispositivos();
        }
    } catch (error) {
        console.error('Erro ao carregar dispositivos:', error);
        mostrarToast('Erro ao carregar dispositivos', 'danger');
    }
}

async function carregarSetores() {
    try {
        const response = await fetch('/api/setores_completos');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const setores = await response.json();
        const tbody = document.querySelector('#setores tbody');
        
        if (tbody) {
            tbody.innerHTML = '';
            setores.forEach(s => {
                const tr = document.createElement('tr');
                
                // 🔴 Formatar dispositivo como "nome - ip"
                let dispositivoText = '';
                if (s.id_dispositivo && s.dispositivo_ip && s.dispositivo_nome) {
                    dispositivoText = `${s.dispositivo_nome} - ${s.dispositivo_ip}`;
                } else if (s.id_dispositivo && s.dispositivo_ip) {
                    dispositivoText = s.dispositivo_ip; // fallback se tiver só IP
                } else if (s.id_dispositivo && s.dispositivo_nome) {
                    dispositivoText = s.dispositivo_nome; // fallback se tiver só nome
                } else if (s.id_dispositivo && !s.dispositivo_ip) {
                    dispositivoText = '<span class="text-warning">Dispositivo sem IP</span>';
                } else {
                    dispositivoText = '<span class="text-muted">Não vinculado</span>';
                }
                
                tr.innerHTML = `
                    <td>${s.nome}</td>
                    <td>${s.qtd_leitos}</td>
                    <td>${dispositivoText}</td>
                    <td>
                        ${s.status == 1 
                            ? '<span class="badge bg-success">Ativo</span>'
                            : '<span class="badge bg-danger">Inativo</span>'}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary btn-editar-setor"
                            data-id="${s.id}"
                            data-nome="${s.nome}"
                            data-leitos="${s.qtd_leitos}"
                            data-dispositivo="${s.id_dispositivo || ''}"
                            data-dispositivo-ip="${s.dispositivo_ip || ''}"
                            data-dispositivo-nome="${s.dispositivo_nome || ''}"  
                            data-status="${s.status}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // Configura eventos de setores
            configurarEventosEdicaoSetores();
        }
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
        mostrarToast('Erro ao carregar setores', 'danger');
    }
}

// ================================
// CONFIGURAÇÃO DE EVENTOS DE EDIÇÃO - VERSÃO CORRIGIDA
// ================================

// Eventos APENAS para dispositivos
function configurarEventosEdicaoDispositivos() {
    document.querySelectorAll('.btn-editar').forEach(btn => {
        // Remove eventos antigos para não duplicar
        btn.removeEventListener('click', btn._clickHandler);
        
        const handler = () => {
            const modal = document.getElementById('modalEditar');
            if (!modal) return;

            document.getElementById('editId').value = btn.dataset.id || '';
            document.getElementById('editNome').value = btn.dataset.nome || '';
            document.getElementById('editIp').value = btn.dataset.ip || '';
            document.getElementById('editSituacao').checked = Number(btn.dataset.status) === 1;

            new bootstrap.Modal(modal).show();
        };
        
        // Guarda o handler para poder remover depois
        btn._clickHandler = handler;
        btn.addEventListener('click', handler);
    });
}

// Eventos APENAS para setores
function configurarEventosEdicaoSetores() {
    document.querySelectorAll('.btn-editar-setor').forEach(btn => {
        // Remove eventos antigos para não duplicar
        btn.removeEventListener('click', btn._clickHandler);
        
        const handler = async () => {
            const modal = document.getElementById('modalSetorEditar');
            if (!modal) return;

            console.log('Editando setor:', {
                id: btn.dataset.id,
                nome: btn.dataset.nome,
                leitos: btn.dataset.leitos,
                dispositivo: btn.dataset.dispositivo,
                status: btn.dataset.status
            });

            document.getElementById('editSetorId').value = btn.dataset.id || '';
            document.getElementById('editSetorLeitos').value = btn.dataset.leitos || '';
            document.getElementById('editSetorDispositivo').value = btn.dataset.dispositivo || '';
            document.getElementById('editSetorAtivo').checked = Number(btn.dataset.status) === 1;

            const selectNome = document.getElementById('editSetorNome');
            if (selectNome) {
                await carregarSetoresDispositivoDoJson(selectNome);
                selectNome.value = btn.dataset.nome || '';
            }

            new bootstrap.Modal(modal).show();
        };
        
        // Guarda o handler para poder remover depois
        btn._clickHandler = handler;
        btn.addEventListener('click', handler);
    });
}

// Função para enviar formulário de usuário via fetch (CORRIGIDA)
function configurarFormularioUsuarios() {
    // Formulário de cadastro
    const formCadastro = document.querySelector('#modalUsuarioCadastro form');
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formCadastro);
            
            // Verificar setores selecionados
            const setoresSelecionados = [];
            document.querySelectorAll('.setor-checkbox-cadastro:checked').forEach(cb => {
                setoresSelecionados.push(cb.value);
            });
            
            // 🔴 VERIFICAR SE NENHUM SETOR ESTÁ SELECIONADO
            const checkboxNotificacoes = document.getElementById('receberNotificacoesCadastro');
            
            if (setoresSelecionados.length === 0 && checkboxNotificacoes) {
                // Se não há setores selecionados, desmarca o checkbox de notificações
                checkboxNotificacoes.checked = false;
                console.log('⚠️ Nenhum setor selecionado, desmarcando notificações');
            }
            
            // Atualizar o formData com o estado atual do checkbox
            formData.set('receber_notificacoes', checkboxNotificacoes.checked ? 'on' : 'off');
            
            // Limpar e adicionar setores
            formData.delete('setores[]');
            setoresSelecionados.forEach(setorId => {
                formData.append('setores[]', setorId);
            });
            
            try {
                const response = await fetch('/api/config/usuarios', {
                    headers: {"Accept": "application/json" },
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalUsuarioCadastro')).hide();
                    formCadastro.reset();
                    
                    document.getElementById('setoresContainerCadastro').style.display = 'none';
                    await carregarUsuarios();
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
    
    // No formulário de edição
    const formEdicao = document.querySelector('#modalUsuarioEditar form');
    if (formEdicao) {
        formEdicao.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formEdicao);
            
            // Debug
            console.log('Enviando formulário de edição:');
            
            // 🔴 VERIFICAR SETORES SELECIONADOS
            const setoresSelecionados = [];
            document.querySelectorAll('.setor-checkbox-editar:checked').forEach(cb => {
                setoresSelecionados.push(cb.value);
            });
            console.log('setores selecionados:', setoresSelecionados);
            
            // 🔴 VERIFICAR SE NENHUM SETOR ESTÁ SELECIONADO
            const checkboxNotificacoes = document.getElementById('editReceberNotificacoes');
            
            if (setoresSelecionados.length === 0 && checkboxNotificacoes) {
                // Se não há setores selecionados, desmarca o checkbox de notificações
                checkboxNotificacoes.checked = false;
                console.log('⚠️ Nenhum setor selecionado, desmarcando notificações');
            }
            
            // 🔴 ATUALIZAR O FORMDATA COM O ESTADO ATUAL DO CHECKBOX
            formData.set('receber_notificacoes', checkboxNotificacoes.checked ? 'on' : 'off');
            
            console.log('receber_notificacoes:', formData.get('receber_notificacoes'));
            
            // Limpar e adicionar setores
            formData.delete('setores[]');
            setoresSelecionados.forEach(setorId => {
                formData.append('setores[]', setorId);
            });
            
            try {
                const response = await fetch('/api/config/usuarios', {
                    method: 'POST',
                    headers: {"Accept": "application/json" },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalUsuarioEditar')).hide();
                    formEdicao.reset();
                    
                    document.getElementById('setoresContainerEditar').style.display = 'none';
                    await carregarUsuarios();
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
}

// Atualizar a função de formulário de setores
function configurarFormularioSetores() {
    const formCadastro = document.querySelector('#modalSetorCadastro form');
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formCadastro);
            
            try {
                const response = await fetch('/api/config/setores', {
                    method: 'POST',
                    headers: {"Accept": "application/json" },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalSetorCadastro')).hide();
                    formCadastro.reset();
                    
                    // 🔴 ATUALIZAR TUDO QUE DEPENDE DE SETORES
                    await Promise.all([
                        carregarSetores(),              // Tabela de setores
                        carregarSetoresAtivosModais(),  // Modais de usuário (filtrado)
                        carregarUsuarios()               // Tabela de usuários (pode ter setores)
                    ]);
                    
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
    
    const formEdicao = document.querySelector('#modalSetorEditar form');
    if (formEdicao) {
        formEdicao.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formEdicao);
            
            try {
                const response = await fetch('/api/config/setores', {
                    method: 'POST',
                    headers: {"Accept": "application/json" },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalSetorEditar')).hide();
                    formEdicao.reset();
                    
                    // 🔴 ATUALIZAR TUDO QUE DEPENDE DE SETORES
                    await Promise.all([
                        carregarSetores(),              // Tabela de setores
                        carregarSetoresAtivosModais(),  // Modais de usuário (filtrado)
                        carregarUsuarios()               // Tabela de usuários (pode ter setores)
                    ]);
                    
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
}

// Atualizar a função de formulário de dispositivos
function configurarFormularioDispositivos() {
    const formCadastro = document.querySelector('#modalCadastro form');
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formCadastro);
            
            try {
                const response = await fetch('/api/config/dispositivos', {
                    method: 'POST',
                    headers: {"Accept": "application/json" },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalCadastro')).hide();
                    formCadastro.reset();
                    
                    // 🔴 ATUALIZAR TUDO QUE DEPENDE DE DISPOSITIVOS
                    await Promise.all([
                        carregarDispositivos(),           // Tabela de dispositivos
                        carregarSetores(),                // Tabela de setores (mostra IP)
                        carregarSetoresAtivosModais(),    // Modais de usuário (filtrado)
                        carregarUsuarios(),               // Tabela de usuários (pode ter setores)
                        carregarDispositivosAtivosNoSelect(document.getElementById('editSetorDispositivo')),
                        carregarDispositivosAtivosNoSelect(document.querySelector('#modalSetorCadastro select[name="id_dispositivo"]'))
                    ]);
                    
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
    
    const formEdicao = document.querySelector('#modalEditar form');
    if (formEdicao) {
        formEdicao.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formEdicao);
            
            try {
                const response = await fetch('/api/config/dispositivos', {
                    method: 'POST',
                    headers: {"Accept": "application/json" },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    mostrarToast(data.message, data.type);
                    bootstrap.Modal.getInstance(document.getElementById('modalEditar')).hide();
                    formEdicao.reset();
                    
                    // 🔴 ATUALIZAR TUDO QUE DEPENDE DE DISPOSITIVOS
                    await Promise.all([
                        carregarDispositivos(),           // Tabela de dispositivos
                        carregarSetores(),                // Tabela de setores (mostra IP)
                        carregarSetoresAtivosModais(),    // Modais de usuário (filtrado)
                        carregarUsuarios(),               // Tabela de usuários (pode ter setores)
                        carregarDispositivosAtivosNoSelect(document.getElementById('editSetorDispositivo')),
                        carregarDispositivosAtivosNoSelect(document.querySelector('#modalSetorCadastro select[name="id_dispositivo"]'))
                    ]);
                    
                } else {
                    mostrarToast(data.message, data.type);
                }
            } catch (error) {
                console.error('Erro:', error);
                mostrarToast('Erro ao processar requisição', 'danger');
            }
        });
    }
}

// ================================
// FUNÇÕES DE TOAST E UTILITÁRIOS
// ================================
function mostrarToast(mensagem, tipo = "success") {

    const toastContainer = document.getElementById("toastContainer");

    const bgClass =
        tipo === "success" ? "bg-success" :
        tipo === "danger" ? "bg-danger" :
        tipo === "warning" ? "bg-warning text-dark" :
        tipo === "info" ? "bg-info" :
        "bg-secondary";

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white ${bgClass} border-0`;
    toast.setAttribute("role", "alert");

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${mensagem}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, {
        delay: 2000
    });

    bsToast.show();

    toast.addEventListener("hidden.bs.toast", () => {
        toast.remove();
    });
}

// Função para salvar a aba ativa no sessionStorage
function salvarAbaAtiva(abaId) {
    sessionStorage.setItem('configAbaAtiva', abaId);
}

// Função para restaurar a aba ativa
function restaurarAbaAtiva() {
    const abaAtiva = sessionStorage.getItem('configAbaAtiva');
    if (abaAtiva) {
        const aba = document.querySelector(`button[data-bs-target="${abaAtiva}"]`);
        if (aba) {
            const tab = new bootstrap.Tab(aba);
            tab.show();
        }
    }
}

// Configurar evento para salvar a aba quando mudar
function configurarEventoAbas() {
    const abas = document.querySelectorAll('button[data-bs-toggle="tab"]');
    abas.forEach(aba => {
        aba.addEventListener('shown.bs.tab', (event) => {
            const targetId = event.target.getAttribute('data-bs-target');
            salvarAbaAtiva(targetId);
        });
    });
}

// ================================
// FUNÇÕES PARA CONTROLE DE "TODOS OS SETORES"
// ================================

function configurarTodosSetoresCadastro() {
    const checkboxTodos = document.getElementById('setorTodosCadastro');
    const checkboxesIndividuais = document.querySelectorAll('.setor-checkbox-cadastro');
    
    if (checkboxTodos) {
        checkboxTodos.addEventListener('change', function() {
            checkboxesIndividuais.forEach(cb => {
                cb.checked = this.checked;
            });
        });
        
        // Quando um checkbox individual muda, verificar se todos estão marcados
        checkboxesIndividuais.forEach(cb => {
            cb.addEventListener('change', function() {
                const todosMarcados = Array.from(checkboxesIndividuais).every(c => c.checked);
                checkboxTodos.checked = todosMarcados;
                checkboxTodos.indeterminate = !todosMarcados && 
                    Array.from(checkboxesIndividuais).some(c => c.checked);
            });
        });
    }
}

function configurarTodosSetoresEditar() {
    const checkboxTodos = document.getElementById('setorTodosEditar');
    const checkboxesIndividuais = document.querySelectorAll('.setor-checkbox-editar');
    
    if (checkboxTodos) {
        checkboxTodos.addEventListener('change', function() {
            checkboxesIndividuais.forEach(cb => {
                cb.checked = this.checked;
            });
        });
        
        // Quando um checkbox individual muda, verificar se todos estão marcados
        checkboxesIndividuais.forEach(cb => {
            cb.addEventListener('change', function() {
                const todosMarcados = Array.from(checkboxesIndividuais).every(c => c.checked);
                checkboxTodos.checked = todosMarcados;
                checkboxTodos.indeterminate = !todosMarcados && 
                    Array.from(checkboxesIndividuais).some(c => c.checked);
            });
        });
    }
}


// Função para carregar dispositivos ativos no select
async function carregarDispositivosAtivosNoSelect(selectElement) {
    if (!selectElement) return;

    try {
        const response = await fetch('/api/dispositivos');
        if (!response.ok) throw new Error('Erro ao buscar dispositivos');
        
        const dispositivos = await response.json();
        
        // Filtra apenas os ativos
        const dispositivosAtivos = dispositivos.filter(d => d.status == 1);
        
        // Guarda o valor atualmente selecionado (se houver)
        const valorAtual = selectElement.value;
        
        selectElement.innerHTML = '<option value="">Não vinculado</option>';
        
        dispositivosAtivos.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = `${d.nome} - ${d.ip}`;
            selectElement.appendChild(option);
        });
        
        // Tenta restaurar o valor selecionado
        if (valorAtual && dispositivosAtivos.some(d => d.id == valorAtual)) {
            selectElement.value = valorAtual;
        }
        
        console.log(`✅ ${dispositivosAtivos.length} dispositivos ativos carregados no select ${selectElement.id || 'sem id'}`);
        
    } catch (error) {
        console.error('Erro ao carregar dispositivos ativos:', error);
        selectElement.innerHTML = '<option value="">Erro ao carregar dispositivos</option>';
    }
}

// 🔴 Função para carregar APENAS setores ativos nos modais de usuário
async function carregarSetoresAtivosModais() {
    try {
        // Usa a MESMA rota /api/setores_completos
        const response = await fetch('/api/setores_completos');
        if (!response.ok) throw new Error('Erro ao buscar setores');
        
        const setores = await response.json();
        
        // 🔴 FILTRA apenas os ativos no frontend
        const setoresAtivos = setores.filter(s => s.status == 1);
        
        // Atualizar modal de cadastro
        const containerCadastro = document.querySelector('#setoresContainerCadastro .border');
        if (containerCadastro) {
            containerCadastro.innerHTML = '';
            setoresAtivos.forEach(s => {
                const div = document.createElement('div');
                div.className = 'form-check';
                div.innerHTML = `
                    <input class="form-check-input setor-checkbox-cadastro" 
                           type="checkbox" 
                           name="setores[]" 
                           value="${s.id}"
                           id="setorCadastro${s.id}">
                    <label class="form-check-label" for="setorCadastro${s.id}">
                        ${s.nome} (${s.qtd_leitos} leitos)
                        
                    </label>
                `;
                containerCadastro.appendChild(div);
            });
            
            // Reconfigurar eventos
            configurarTodosSetoresCadastro();
        }
        
        // Atualizar modal de edição
        const containerEditar = document.querySelector('#setoresContainerEditar .border');
        if (containerEditar) {
            containerEditar.innerHTML = '';
            setoresAtivos.forEach(s => {
                const div = document.createElement('div');
                div.className = 'form-check';
                div.innerHTML = `
                    <input class="form-check-input setor-checkbox-editar" 
                           type="checkbox" 
                           name="setores[]" 
                           value="${s.id}"
                           id="editSetor${s.id}">
                    <label class="form-check-label" for="editSetor${s.id}">
                        ${s.nome} (${s.qtd_leitos} leitos)
                        
                    </label>
                `;
                containerEditar.appendChild(div);
            });
            
            // Reconfigurar eventos
            configurarTodosSetoresEditar();
        }
        
        console.log(`✅ ${setoresAtivos.length} setores ativos carregados nos modais (de um total de ${setores.length})`);
        
    } catch (error) {
        console.error('Erro ao carregar setores ativos:', error);
    }
}


// ================================
// INICIALIZAÇÃO
// ================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando paginaConfig.js');

    configurarEventoAbas();
    restaurarAbaAtiva();

    const selectsDispositivos = [
        document.getElementById('setorDispositivoCadastro'),
        document.getElementById('setorDispositivoEditar')
    ];
    for (const select of selectsDispositivos) {
        if (select) await carregarSetoresDispositivoDoJson(select);
    }

    configurarControleNotificacoesCadastro();
    configurarControleNotificacoesEdicao();
    
    // 🔴 Carrega setores ativos para os modais de usuário
    await carregarSetoresAtivosModais();
    configurarTodosSetoresCadastro();
    configurarTodosSetoresEditar();

    // Carrega os dados das tabelas
    await carregarDispositivos();
    await carregarSetores();
    await carregarUsuarios();
    
    // Carrega dispositivos ativos nos selects
    await Promise.all([
        carregarDispositivosAtivosNoSelect(document.getElementById('editSetorDispositivo')),
        carregarDispositivosAtivosNoSelect(document.querySelector('#modalSetorCadastro select[name="id_dispositivo"]'))
    ]);
    
    configurarFormularioUsuarios();
    configurarFormularioDispositivos();
    configurarFormularioSetores();

    console.log('Inicialização concluída');
});