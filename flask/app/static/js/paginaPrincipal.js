// =========================================================
// 📝 FUNÇÃO PARA ABRIR JUSTIFICATIVA DO LEITO (GLOBAL)
// =========================================================
async function abrirJustificativaLeito(setor, leito) {
    console.log("🔍 abrirJustificativaLeito chamada com:", { setor, leito });
    
    try {
        const url = `/api/justificativas?setor=${encodeURIComponent(setor)}&leito=${encodeURIComponent(leito)}`;
        console.log("📡 URL da requisição:", url);
        
        const resposta = await fetch(url);
        console.log("📥 Status da resposta:", resposta.status);
        
        const justificativas = await resposta.json();
        console.log("📦 Dados recebidos:", justificativas);
        
        if (justificativas && justificativas.length > 0) {
            console.log("✅ Justificativa encontrada, ID:", justificativas[0].id);
            visualizarJustificativa(justificativas[0].id);
        } else {
            console.log("ℹ️ Nenhuma justificativa encontrada");
            mostrarToast("Nenhuma justificativa encontrada para este leito", "info");
        }
    } catch (erro) {
        console.error("❌ Erro ao buscar justificativa:", erro);
        mostrarToast("Erro ao carregar justificativa", "danger");
    }
}

// =========================================================
// ⏱️ CRONÔMETRO AO VIVO (TOOLTIP) - EM_ANDAMENTO / AGUARDANDO_VALIDACAO
// Mesma lógica do tablet: conta a partir de data_inicio e só para
// quando o enfermeiro valida a limpeza.
// =========================================================
let cronometroTooltipEl = null;
let cronometroTooltipIntervalo = null;

function formatarTempoPainel(seg) {
    seg = Math.max(0, seg);
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;

    if (h > 0) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function garantirCronometroTooltip() {
    if (!cronometroTooltipEl) {
        cronometroTooltipEl = document.createElement("div");
        cronometroTooltipEl.className = "cronometro-tooltip";
        document.body.appendChild(cronometroTooltipEl);
    }
    return cronometroTooltipEl;
}

function posicionarCronometroTooltip(evento) {
    if (!cronometroTooltipEl) return;
    const offset = 14;
    cronometroTooltipEl.style.left = `${evento.pageX + offset}px`;
    cronometroTooltipEl.style.top = `${evento.pageY + offset}px`;
}

function anexarCronometroHover(elemento, marcos) {
    // marcos: array de { rotulo, dataStr } - cada um vira uma linha no tooltip
    const validos = marcos
        .map(m => ({ rotulo: m.rotulo, inicio: new Date((m.dataStr || "").replace(" ", "T")).getTime() }))
        .filter(m => !isNaN(m.inicio));

    if (validos.length === 0) return;

    elemento.style.cursor = "help";

    const atualizarTexto = () => {
        const agora = Date.now();
        cronometroTooltipEl.innerHTML = validos
            .map(m => `<i class="fas fa-stopwatch"></i> ${m.rotulo}: ${formatarTempoPainel(Math.floor((agora - m.inicio) / 1000))}`)
            .join("<br>");
    };

    elemento.addEventListener("mouseenter", (e) => {
        garantirCronometroTooltip();
        atualizarTexto();
        cronometroTooltipEl.style.display = "block";
        posicionarCronometroTooltip(e);

        clearInterval(cronometroTooltipIntervalo);
        cronometroTooltipIntervalo = setInterval(atualizarTexto, 1000);
    });

    elemento.addEventListener("mousemove", posicionarCronometroTooltip);

    elemento.addEventListener("mouseleave", () => {
        clearInterval(cronometroTooltipIntervalo);
        if (cronometroTooltipEl) cronometroTooltipEl.style.display = "none";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const painelLista = document.getElementById("viewLista");
    const painelGrade = document.getElementById("viewGrade");
    const seletor = document.getElementById("selectSetor");
    const btnLista = document.getElementById("btnLista");
    const btnGrade = document.getElementById("btnGrade");
    let modoVisualizacao = "grid";

    const btnMaximizar = document.getElementById("btnMaximizar");

    btnMaximizar.addEventListener("click", () => {
        const ocultando = !document.body.classList.contains("menu-oculto");

        document.body.classList.toggle("menu-oculto", ocultando);

        if (ocultando) {
            btnMaximizar.innerHTML = '<i class="fas fa-compress"></i>';
            btnMaximizar.title = "Mostrar menu lateral";
        } else {
            btnMaximizar.innerHTML = '<i class="fas fa-expand"></i>';
            btnMaximizar.title = "Ocultar menu lateral";
        }
    });

    // ===== CONTROLE DE VISUALIZAÇÃO =====
    btnLista.onclick = () => {
        modoVisualizacao = "tabela";
        btnLista.classList.add("ativo");
        btnGrade.classList.remove("ativo");
        painelLista.style.display = "block";
        painelGrade.style.display = "none";
        carregarPainel();
    };

    btnGrade.onclick = () => {
        modoVisualizacao = "grid";
        btnGrade.classList.add("ativo");
        btnLista.classList.remove("ativo");
        painelLista.style.display = "none";
        painelGrade.style.display = "flex";
        carregarPainel();
    };

    // ===== FUNÇÕES AUXILIARES DE RENDERIZAÇÃO =====
    function criarStatusHTML(l) {
        if (l.status === "EM_ANDAMENTO") {
            return `<span class="status-indicator status-andamento"></span> Em Andamento`;
        }
        
        if (l.status === "PENDENTE") {
            return `<span class="status-indicator status-pendente"></span> Pendente`;
        }
        
        if (l.status === "AGUARDANDO_VALIDACAO") {
            return `<span class="status-indicator status-validacao"></span> Aguardando Validação`;
        }

        if (l.status === "SUSPENSO") {
            return `<span class="status-indicator status-suspenso"></span> <i class="fas fa-lock"></i> Suspenso`;
        }

        if (l.status === "CONCLUIDA") {
            if (!l.data_validacao) {
                return `<span class="status-indicator status-concluida"></span> Concluída`;
            }
            
            const dias = l.dias_alerta;
            
            if (dias === 5) {
                return `
                    <div class="status-progress">
                        <span class="status-indicator status-concluida"></span>
                        <div class="progress-bars">
                            <div class="progress-bar progress-bar-5 active"></div>
                            <div class="progress-bar progress-bar-5"></div>
                            <div class="progress-bar progress-bar-5"></div>
                        </div>
                        <span class="status-ampulheta"><i class="fas fa-hourglass-half"></i> 5</span>
                    </div>
                `;
            }
            
            if (dias === 6) {
                return `
                    <div class="status-progress">
                        <span class="status-indicator status-concluida"></span>
                        <div class="progress-bars">
                            <div class="progress-bar progress-bar-6 active"></div>
                            <div class="progress-bar progress-bar-6 active"></div>
                            <div class="progress-bar progress-bar-6"></div>
                        </div>
                        <span class="status-ampulheta"><i class="fas fa-hourglass-half"></i> 6</span>
                    </div>
                `;
            }
            
            if (dias >= 7) {
                return `
                    <div class="status-progress">
                        <span class="status-indicator status-concluida"></span>
                        <div class="progress-bars">
                            <div class="progress-bar progress-bar-7 active"></div>
                            <div class="progress-bar progress-bar-7 active"></div>
                            <div class="progress-bar progress-bar-7 active"></div>
                        </div>
                        <span class="status-ampulheta"><i class="fas fa-hourglass-end"></i> 7</span>
                    </div>
                `;
            }
            
            return `<span class="status-indicator status-concluida"></span> Concluída`;
        }
        
        return '';
    }

    function criarBadgeHTML(dias) {
        if (dias === 5) {
            return `<span class="leito-badge badge-5dias">5</span>`;
        }
        if (dias === 6) {
            return `<span class="leito-badge badge-6dias">6</span>`;
        }
        if (dias === 7) {
            return `<span class="leito-badge badge-7dias">7</span>`;
        }
        return '';
    }

    // ===== RENDERIZAÇÃO OTIMIZADA =====
    function renderizarTabela(limpezas) {
        painelLista.classList.remove("hidden");
        
        const tabela = document.createElement("table");
        tabela.className = "tabela-limpezas";
        
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Setor</th>
                    <th>Leito</th>
                    <th>Paciente</th>
                    <th>Tipo de Limpeza</th>
                    <th>ASG</th>
                    <th>Enfermeiro(a)</th>
                    <th>Tempo</th>
                    <th style="text-align: center; width: 50px;">Just.</th>
                </tr>
            </thead>
        `;
        
        const tbody = document.createElement("tbody");
        
        limpezas.forEach(l => {
            const linha = document.createElement("tr");
            
            let justificativaHTML = l.tem_justificativa 
                ? `<div style="text-align: center;">
                    <span class="justificativa-icon-tabela" 
                          onclick="abrirJustificativaLeito('${l.setor}', '${l.numero_leito}')"
                          title="Clique para ver justificativa">
                        <i class="fas fa-comment-dots"></i>
                    </span>
                   </div>`
                : `<div style="text-align: center;">—</div>`;
            
            linha.innerHTML = `
                <td class="status-cell">${criarStatusHTML(l)}</td>
                <td><strong>${l.setor}</strong></td>
                <td><strong>${l.numero_leito}</strong></td>
                <td>${l.paciente || "S/P"}</td>
                <td>${l.tipo_limpeza || "—"}</td>
                <td>${l.funcionario_asg || "—"}</td>
                <td>${l.funcionario_enf || "—"}</td>
                <td>${l.tempo_total_text || "—"}</td>
                <td>${justificativaHTML}</td>
            `;
            
            tbody.appendChild(linha);
        });
        
        tabela.appendChild(tbody);
        painelLista.innerHTML = '';  // Limpa de forma eficiente
        painelLista.appendChild(tabela);
    }

    function renderizarGrade(limpezas, setorSelecionado) {
        painelGrade.classList.remove("hidden");
        painelGrade.innerHTML = '';  // Limpa de forma eficiente
        
        if (!setorSelecionado) {
            // Modo "Todos os setores"
            const setores = {};
            limpezas.forEach(l => {
                if (!setores[l.setor]) setores[l.setor] = [];
                setores[l.setor].push(l);
            });
            
            const containerSetores = document.createElement("div");
            containerSetores.className = "grid-setores";
            
            for (const setor in setores) {
                const setorCard = document.createElement("div");
                setorCard.className = "setor-card";
                setorCard.innerHTML = `<h3>${setor}</h3>`;
                
                const gridLeitos = document.createElement("div");
                gridLeitos.className = "grid-leitos";
                
                setores[setor].forEach(l => {
                    const statusClass = {
                        "EM_ANDAMENTO": "status-andamento-grid",
                        "CONCLUIDA": "status-concluida-grid",
                        "PENDENTE": "status-pendente-grid",
                        "AGUARDANDO_VALIDACAO": "status-validacao-grid",
                        "SUSPENSO": "status-suspenso-grid"
                    }[l.status] || "";
                    
                    const leito = document.createElement("div");
                    leito.className = `leito-card ${statusClass}`;
                    leito.style.position = "relative";
                    
                    // Número do leito
                    const numeroLeito = document.createElement("span");
                    numeroLeito.textContent = l.numero_leito;
                    leito.appendChild(numeroLeito);
                    
                    // Ícone de justificativa
                    if (l.tem_justificativa) {
                        const justificativaIcon = document.createElement("span");
                        justificativaIcon.className = "justificativa-icon";
                        justificativaIcon.innerHTML = '<i class="fas fa-comment-dots"></i>';
                        justificativaIcon.title = "Clique para ver justificativa";
                        justificativaIcon.onclick = (e) => {
                            e.stopPropagation();
                            abrirJustificativaLeito(l.setor, l.numero_leito);
                        };
                        leito.appendChild(justificativaIcon);
                    }

                    // ⏱️ CRONÔMETRO AO VIVO NO HOVER (em andamento / aguardando validação)
                    if (l.status === "EM_ANDAMENTO") {
                        anexarCronometroHover(leito, [
                            { rotulo: "Em limpeza há", dataStr: l.data_inicio }
                        ]);
                    } else if (l.status === "AGUARDANDO_VALIDACAO") {
                        anexarCronometroHover(leito, [
                            { rotulo: "Tempo total", dataStr: l.data_inicio },
                            { rotulo: "Aguardando validação há", dataStr: l.data_fim }
                        ]);
                    }

                    // Badge de alerta
                    if (l.status === "CONCLUIDA" && l.data_validacao) {
                        const badgeHTML = criarBadgeHTML(l.dias_alerta);
                        if (badgeHTML) {
                            leito.insertAdjacentHTML('beforeend', badgeHTML);
                        }
                        leito.title = `${l.dias_alerta || 0} dia(s) desde a limpeza`;
                    }

                    // 🔒 Leito extra suspenso: sumiu do PEP antes de uma nova limpeza
                    if (l.status === "SUSPENSO") {
                        leito.title = "Leito suspenso — sumiu do sistema antes de uma nova limpeza";
                        leito.insertAdjacentHTML('beforeend', '<span class="leito-badge badge-suspenso"><i class="fas fa-lock"></i></span>');
                    }

                    gridLeitos.appendChild(leito);
                });
                
                setorCard.appendChild(gridLeitos);
                containerSetores.appendChild(setorCard);
            }
            
            painelGrade.appendChild(containerSetores);
            
        } else {
            // Modo setor específico
            const setorCard = document.createElement("div");
            setorCard.className = "setor-card";
            setorCard.innerHTML = `<h3>${setorSelecionado}</h3>`;
            
            const gridLeitos = document.createElement("div");
            gridLeitos.className = "grid-leitos";
            
            limpezas.forEach(l => {
                const statusClass = {
                    "EM_ANDAMENTO": "status-andamento-grid",
                    "CONCLUIDA": "status-concluida-grid",
                    "PENDENTE": "status-pendente-grid",
                    "AGUARDANDO_VALIDACAO": "status-validacao-grid",
                    "SUSPENSO": "status-suspenso-grid"
                }[l.status] || "";
                
                const leito = document.createElement("div");
                leito.className = `leito-card ${statusClass}`;
                leito.style.position = "relative";
                
                const numeroLeito = document.createElement("span");
                numeroLeito.textContent = l.numero_leito;
                leito.appendChild(numeroLeito);
                
                if (l.tem_justificativa) {
                    leito.style.cursor = "pointer";
                    leito.title = "Clique para ver justificativa";
                    
                    leito.onclick = (e) => {
                        if (!e.target.closest('.justificativa-icon')) {
                            abrirJustificativaLeito(l.setor, l.numero_leito);
                        }
                    };
                    
                    const justificativaIcon = document.createElement("span");
                    justificativaIcon.className = "justificativa-icon";
                    justificativaIcon.innerHTML = '<i class="fas fa-comment-dots"></i>';
                    justificativaIcon.title = "Clique para ver justificativa";
                    justificativaIcon.onclick = (e) => {
                        e.stopPropagation();
                        abrirJustificativaLeito(l.setor, l.numero_leito);
                    };
                    leito.appendChild(justificativaIcon);
                }

                // ⏱️ CRONÔMETRO AO VIVO NO HOVER (em andamento / aguardando validação)
                if (l.status === "EM_ANDAMENTO") {
                    anexarCronometroHover(leito, [
                        { rotulo: "Em limpeza há", dataStr: l.data_inicio }
                    ]);
                } else if (l.status === "AGUARDANDO_VALIDACAO") {
                    anexarCronometroHover(leito, [
                        { rotulo: "Tempo total", dataStr: l.data_inicio },
                        { rotulo: "Aguardando validação há", dataStr: l.data_fim }
                    ]);
                }

                if (l.status === "CONCLUIDA" && l.data_validacao) {
                    const badgeHTML = criarBadgeHTML(l.dias_alerta);
                    if (badgeHTML) {
                        leito.insertAdjacentHTML('beforeend', badgeHTML);
                    }
                    leito.title = `${l.dias_alerta || 0} dia(s) aguardando`;
                }

                // 🔒 Leito extra suspenso: sumiu do PEP antes de uma nova limpeza
                if (l.status === "SUSPENSO") {
                    leito.title = "Leito suspenso — sumiu do sistema antes de uma nova limpeza";
                    leito.insertAdjacentHTML('beforeend', '<span class="leito-badge badge-suspenso"><i class="fas fa-lock"></i></span>');
                }

                gridLeitos.appendChild(leito);
            });
            
            setorCard.appendChild(gridLeitos);
            painelGrade.appendChild(setorCard);
        }
    }

    // ===== FUNÇÃO PRINCIPAL OTIMIZADA =====
    async function carregarPainel() {
        const setorSelecionado = seletor.value;
        let url = "/api/listar_limpezas";
        
        if (setorSelecionado) {
            url += `?setor=${encodeURIComponent(setorSelecionado)}`;
        }

        try {
            const resposta = await fetch(url);
            const limpezas = await resposta.json();

            // Ordenação
            limpezas.sort((a, b) => Number(a.numero_leito) - Number(b.numero_leito));

            // Atualiza contadores
            const contadores = { CONCLUIDA: 0, EM_ANDAMENTO: 0, PENDENTE: 0, AGUARDANDO_VALIDACAO: 0 };
            limpezas.forEach(l => contadores[l.status]++);
            
            document.getElementById("qtdConcluida").textContent = contadores.CONCLUIDA;
            document.getElementById("qtdAndamento").textContent = contadores.EM_ANDAMENTO;
            document.getElementById("qtdPendente").textContent = contadores.PENDENTE;
            document.getElementById("qtdValidacao").textContent = contadores.AGUARDANDO_VALIDACAO;

            // Renderiza baseado no modo
            if (limpezas.length === 0) {
                painelLista.innerHTML = '<p style="color: white;">Nenhuma limpeza encontrada.</p>';
                painelGrade.innerHTML = '<p style="color: white;">Nenhuma limpeza encontrada.</p>';
                painelLista.classList.remove("hidden");
                painelGrade.classList.remove("hidden");
                return;
            }

            if (modoVisualizacao === "tabela") {
                painelGrade.classList.add("hidden");
                renderizarTabela(limpezas);
            } else {
                painelLista.classList.add("hidden");
                renderizarGrade(limpezas, setorSelecionado);
            }

        } catch (erro) {
            console.error("Erro ao carregar painel:", erro);
            
            const alvo = modoVisualizacao === "tabela" ? painelLista : painelGrade;
            
            alvo.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 40px 30px; text-align: center; color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-width: 500px; margin: 40px auto; animation: fadeInUp 0.5s ease-out;">
                    <div style="font-size: 60px; margin-bottom: 20px;">😕</div>
                    <h2 style="font-size: 28px; margin-bottom: 15px; font-weight: 600;">Ops! Algo deu errado</h2>
                    <p style="font-size: 18px; margin-bottom: 25px; opacity: 0.9;">Não foi possível carregar os dados do painel</p>
                    <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px; margin-bottom: 25px; font-size: 18px;">
                        🔄 Tente recarregar a página<br>
                        📡 Verifique sua conexão<br>
                        ⏱️ Se o problema persistir, aguarde alguns minutos
                    </div>
                    <button onclick="window.location.reload()" style="background: white; color: #667eea; border: none; padding: 15px 40px; border-radius: 50px; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s;" 
                            onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.3)'" 
                            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.2)'">
                        🔄 Tentar novamente
                    </button>
                </div>
                <style>
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
            `;
            
            alvo.classList.remove("hidden");
        }
    }

    // ===== FUNÇÃO PARA CARREGAR SETORES =====
    async function carregarSetores() {
        try {
            const resposta = await fetch("/api/setores_painel");
            const setores = await resposta.json();

            seletor.innerHTML = '<option value="">Todos os setores</option>';
            
            setores.forEach(setor => {
                const option = document.createElement("option");
                option.value = setor.setor;
                option.textContent = setor.setor;
                seletor.appendChild(option);
            });
        } catch (erro) {
            console.error("Erro ao carregar setores:", erro);
            seletor.innerHTML = '<option value="">Erro ao carregar setores</option>';
        }
    }

    // ===== CONFIGURAÇÃO DO SSE COM THROTTLE E RECONEXÃO =====
    let ultimaAtualizacao = 0;
    const MIN_INTERVALO = 2000; // 2 segundos
    let timeoutAtualizacao = null;
    let eventSource = null;
    let tentativasReconexao = 0;
    const MAX_TENTATIVAS = 5;

    function conectarSSE() {
        // Fecha conexão anterior se existir
        if (eventSource) {
            eventSource.close();
        }
        
        eventSource = new EventSource("/stream");
        
        eventSource.onopen = () => {
            console.log("✅ Conexão SSE estabelecida");
            tentativasReconexao = 0; // Reseta contador de tentativas
        };
        
        eventSource.onmessage = (event) => {
            // Mensagem de keepalive (ignora)
            if (event.data === ": keepalive") {
                return;
            }
            
            // Mensagem de conexão inicial
            if (event.data === "conectado") {
                console.log("🎯 Handshake inicial com SSE");
                return;
            }
            
            // Mensagem simples de atualização
            if (event.data === "atualizacao") {
                processarAtualizacao();
                return;
            }
            
            // Tenta parsear como JSON (eventos Redis)
            try {
                const dados = JSON.parse(event.data);
                console.log(`🔔 Evento Redis recebido: ${dados.evento}`, dados.dados);
                
                // Qualquer evento deve atualizar o painel
                processarAtualizacao();
            } catch {
                // Se não for JSON, ignora
                console.log("📩 Mensagem SSE recebida:", event.data);
            }
        };
        
        eventSource.onerror = (erro) => {
            console.error("❌ Erro na conexão SSE:", erro);
            eventSource.close();
            
            // Tenta reconectar com backoff exponencial
            if (tentativasReconexao < MAX_TENTATIVAS) {
                tentativasReconexao++;
                const tempoEspera = Math.min(1000 * Math.pow(2, tentativasReconexao), 30000);
                console.log(`🔄 Tentando reconectar em ${tempoEspera/1000}s... (tentativa ${tentativasReconexao}/${MAX_TENTATIVAS})`);
                
                setTimeout(() => {
                    conectarSSE();
                }, tempoEspera);
            } else {
                console.log("❌ Máximo de tentativas atingido. Recarregue a página.");
                mostrarToast("Conexão perdida. Recarregue a página.", "warning");
            }
        };
    }

    function processarAtualizacao() {
        const agora = Date.now();
        
        if (timeoutAtualizacao) {
            clearTimeout(timeoutAtualizacao);
            timeoutAtualizacao = null;
        }
        
        if (agora - ultimaAtualizacao > MIN_INTERVALO) {
            console.log("🔔 Atualização recebida, recarregando painel...");
            carregarPainel();
            ultimaAtualizacao = agora;
        } else {
            const tempoRestante = MIN_INTERVALO - (agora - ultimaAtualizacao);
            timeoutAtualizacao = setTimeout(() => {
                console.log("🔔 Atualização atrasada, recarregando painel...");
                carregarPainel();
                ultimaAtualizacao = Date.now();
                timeoutAtualizacao = null;
            }, tempoRestante);
        }
    }

    // Fechar conexão ao sair da página
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });

    // Inicializar SSE depois de carregar a página
    setTimeout(() => {
        conectarSSE();
    }, 1000);

    // ===== INICIALIZAÇÃO =====
    seletor.addEventListener("change", carregarPainel);
    carregarSetores().then(carregarPainel);

    

    // ===== INICIALIZAÇÃO =====
    seletor.addEventListener("change", carregarPainel);
    carregarSetores().then(carregarPainel);
});