(() => {
    "use strict";

    /* =========================
       ESTADO
    ========================= */

    let segundos = 0;
    let limpezasAtivas = [];
    let limpezaSelecionada = null;
    const cronometros = new Map(); // id_limpeza → intervalo
    const btnNovaLimpeza = document.createElement("button");

    /* =========================
       DOM
    ========================= */
    const DOM = {
        cronometro: document.getElementById("cronometro"),
        tempo: document.getElementById("tempoDecorrido"),
        finalizarBtn: document.getElementById("finalizarLimpezaBtn"),
        popupFinalizar: document.getElementById("popupFinalizar"),
        popupConfirmacao: document.getElementById("popupConfirmacao"),
        inputCartaoFinalizar: document.getElementById("idcartaoFinalizarInput"),
        mensagemFuncionario: document.getElementById("mensagemFuncionario"),
        infoSetor: document.getElementById("infoSetor"),
        infoLeito: document.getElementById("infoLeito"),
        infoTipo: document.getElementById("infoTipo"),
        fecharFinalizar: document.getElementById("fecharFinalizar"),
        fecharConfirmacao: document.getElementById("fecharConfirmacao"),
        confirmarBtn: document.getElementById("confirmarFim"),
        cancelarBtn: document.getElementById("cancelarFim"),
        mensagemConfirmacao: document.getElementById("mensagemConfirmacao"),
        popupLeitorEnfermeiro: document.getElementById("popupLeitorEnfermeiro"),
        inputCartaoEnfermeiroOculto: document.getElementById("idcartaoEnfermeiroOculto"),
        fecharLeitorEnfermeiro: document.getElementById("fecharLeitorEnfermeiro"),
        popupLeitorASGFinalizar: document.getElementById("popupLeitorASGFinalizar"),
        inputCartaoASGFinalizarOculto: document.getElementById("idcartaoASGFinalizarOculto"),
        fecharLeitorASGFinalizar: document.getElementById("fecharLeitorASGFinalizar"),
        popupLeitorIntervalo: document.getElementById("popupLeitorIntervalo"),
        inputCartaoIntervaloOculto: document.getElementById("idcartaoIntervaloOculto"),
        fecharLeitorIntervalo: document.getElementById("fecharLeitorIntervalo"),
        btnIntervaloAlmocoJanta: document.getElementById("btnIntervaloAlmocoJanta"),
    };

    let idLimpezaParaFinalizar = null;

    /* =========================
       INIT
    ========================= */
    document.addEventListener("DOMContentLoaded", init);

    btnNovaLimpeza.id = "btnNovaLimpeza";
    btnNovaLimpeza.className = "btn-nova-limpeza hidden";
    btnNovaLimpeza.textContent = "+ Nova Limpeza";
    document.body.appendChild(btnNovaLimpeza);
    btnNovaLimpeza.addEventListener("click", () => window.location.href = "/tablet");

    async function init() {
        aplicarEstilo();
        bindEventos();
        await carregarLimpezaAtiva();
    }

    /* =========================
    EVENTOS GLOBAIS E MENSAGENS
    ========================= */
    // Adiciona o evento de clique no botão cancelar
    // ❌ Cancelar início
    DOM.cancelarBtn?.addEventListener("click", () => {
        ocultar(DOM.popupConfirmacao);
        mostrarPaginaPrincipal();
    });


    /* =========================
    FUNÇÃO PARA MOSTRAR MENSAGEM COM FOCO NO INPUT
    ========================= */
    function mostrarMensagem(texto, callback = null, opts = {}) {
        const popup = document.getElementById("popupMensagem");
        const msg = document.getElementById("mensagemTexto");
        const btn = document.getElementById("fecharMensagemBtn");
        const btnIntervalo = DOM.btnIntervaloAlmocoJanta;

        // Usa innerHTML para permitir quebras de linha
        msg.innerHTML = texto.replace(/\n/g, '<br>');

        // Centraliza o texto e aumenta a fonte
        msg.style.textAlign = 'center';
        msg.style.fontSize = '2.2rem';
        msg.style.lineHeight = '1.5';
        msg.style.padding = '20px';
        msg.style.whiteSpace = 'pre-line';

        // Botão de Intervalo Almoço/Janta só aparece quando explicitamente solicitado
        // (bloqueio por tempo mínimo), para permitir liberar a finalização a outro ASG
        if (opts.idLimpeza && btnIntervalo) {
            btnIntervalo.classList.remove("oculto");
            btnIntervalo.onclick = () => {
                popup.classList.add("oculto");
                abrirPopupLeitorIntervalo(opts.idLimpeza);
            };
        } else if (btnIntervalo) {
            btnIntervalo.classList.add("oculto");
            btnIntervalo.onclick = null;
        }

        popup.classList.remove("oculto");

        btn.onclick = () => {
            popup.classList.add("oculto");
            // Restaura os estilos originais
            msg.style.textAlign = '';
            msg.style.fontSize = '';
            msg.style.lineHeight = '';
            msg.style.padding = '';
            msg.style.whiteSpace = '';

            setTimeout(() => {
                DOM.inputCartaoFinalizar?.focus();
                DOM.inputCartaoFinalizar?.select();
            }, 50);

            if (callback) callback();
        };
    }

    /* =========================
       EVENTOS
    ========================= */
    function bindEventos() {
        // Remove todos os listeners existentes primeiro
        const novoConfirmar = DOM.confirmarBtn.cloneNode(true);
        DOM.confirmarBtn.replaceWith(novoConfirmar);
        DOM.confirmarBtn = novoConfirmar;



        // Adiciona novos listeners
        DOM.fecharConfirmacao?.addEventListener("click", () => ocultar(DOM.popupConfirmacao));




        // Adiciona listener ao botão confirmar (com delegação para evitar problemas)
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'confirmarFim') {
                e.preventDefault();
                handleConfirmarFinalizacao();
            }
        });
    }

    /* =========================
       HANDLE CONFIRMAR FINALIZAÇÃO
    ========================= */
    async function handleConfirmarFinalizacao() {
        if (!limpezaSelecionada) {
            console.warn("⚠ Nenhuma limpeza selecionada para finalizar");
            ocultar(DOM.popupConfirmacao);
            return;
        }

        DOM.confirmarBtn.disabled = true;
        DOM.confirmarBtn.textContent = "Finalizando...";

        try {
            ocultar(DOM.popupConfirmacao);

            const inicio = new Date(limpezaSelecionada.data_inicio);
            const fim = new Date();
            const tempoTotalSeconds = Math.floor((fim - inicio) / 1000);

            // Extrai nome do enfermeiro e ID do cartão da mensagem
            const mensagemHTML = DOM.mensagemConfirmacao.innerHTML;
            const enfMatch = mensagemHTML.match(/<span[^>]*>([^<]+)<\/span>/g);
            const enfNome = enfMatch ? enfMatch[0].replace(/<\/?span[^>]*>/g, '') : "Enfermeiro";

            // Busca ID do cartão do localStorage ou usa valor do input
            const idCartaoEnf = localStorage.getItem('ultimoCartaoEnf') ||
                                   DOM.inputCartaoFinalizar?.value || "";

            console.log("🔍 Finalizando limpeza:", {
                id: limpezaSelecionada.id,
                enfermagem: enfNome,
                cartao: idCartaoEnf
            });

            await registrarFinalizacao(
                limpezaSelecionada.id,
                enfNome,
                idCartaoEnf,
                tempoTotalSeconds
            );

            removerLimpezaDaTela(limpezaSelecionada.id);
            mostrarConclusao(enfNome, tempoTotalSeconds, limpezaSelecionada.id);

            // Reseta o estado
            limpezaSelecionada = null;

        } catch (e) {
            console.error("❌ Erro ao finalizar limpeza:", e);
            alert(`Erro ao finalizar limpeza: ${e.message}`);

            // Reativa o botão em caso de erro
            DOM.confirmarBtn.disabled = false;
            DOM.confirmarBtn.textContent = "Confirmar";

            // Reabre o popup de confirmação
            mostrar(DOM.popupConfirmacao);
        }
    }

    /* =========================
       LIMPEZA ATIVA
    ========================= */
    async function carregarLimpezaAtiva() {
        try {
            const response = await fetch("/api/limpeza_ativa_por_ip");
            validarJSON(response);

            const data = await response.json();

            if (!data.existe || !Array.isArray(data.limpezas)) {
                alert("Nenhuma limpeza ativa neste dispositivo.");
                return;
            }

            limpezasAtivas = data.limpezas;
            renderizarLimpezas(limpezasAtivas);
            atualizarBotoesLimpeza();

        } catch (erro) {
            console.error("Erro ao buscar limpezas ativas:", erro);
            alert("Erro ao conectar com o servidor.");
            window.location.href = "/tablet";
        }
    }

    /* =========================
       CRONÔMETRO
    ========================= */
    function iniciarCronometro(id, dataInicio) {
        const inicio = new Date(dataInicio.replace(" ", "T")).getTime();

        atualizarTempo(id, inicio);

        const intervalo = setInterval(() => {
            atualizarTempo(id, inicio);
        }, 1000);

        cronometros.set(id, intervalo);
    }

    function atualizarTempo(id, inicio) {
        const agora = Date.now();
        const diferencaMs = agora - inicio;
        let seg = Math.floor(diferencaMs / 1000);

        const el = document.getElementById(`tempo-${id}`);
        if (!el) return;

        if (seg < -10) {
            // Muito no futuro → mostra algo chamativo
            el.textContent = "Aguardando...";
            el.style.color = "#e74c3c";
        } else if (seg < 0) {
            // Pouco no futuro → mostra como 00:00 ou com -
            el.textContent = "00:00";
            el.style.color = "#e67e22";
        } else {
            el.textContent = formatarTempo(seg);
            el.style.color = ""; // cor normal
        }

        if (limpezaSelecionada?.id == id) {
            segundos = Math.max(0, seg); // nunca negativo no estado
        }
    }

    function formatarTempo(seg) {
        const m = String(Math.floor(seg / 60)).padStart(2, "0");
        const s = String(seg % 60).padStart(2, "0");
        return `${m}:${s}`;
    }

    /* =========================
       FINALIZAÇÃO
    ========================= */

    DOM.finalizarBtn?.addEventListener("click", () => {
        if (!limpezaSelecionada) return;
        abrirPopupFinalizar(limpezaSelecionada.id);
    });

    function abrirPopupFinalizar(idLimpeza) {
        const limpeza = limpezasAtivas.find(l => l.id == idLimpeza);

        if (!limpeza) {
            console.warn("⚠ Limpeza não encontrada:", idLimpeza);
            return;
        }

        limpezaSelecionada = limpeza;
        console.log("🔍 Abrindo popup para limpeza:", limpezaSelecionada);

        // Abre o novo popup visual do leitor
        abrirPopupLeitorEnfermeiro();
    }

    // 👉 Fechar popup do cartão
    DOM.fecharFinalizar.addEventListener("click", fecharPopupFinalizar);
    // Fechar popup do leitor do enfermeiro
    DOM.fecharLeitorEnfermeiro?.addEventListener("click", () => {
        ocultar(DOM.popupLeitorEnfermeiro);
    DOM.inputCartaoEnfermeiroOculto.value = "";
        mostrarPaginaPrincipal();
    });

    function fecharPopupFinalizar() {
        ocultar(DOM.popupFinalizar);
        DOM.inputCartaoFinalizar.value = "";
        DOM.inputCartaoFinalizar.blur();
        mostrarPaginaPrincipal(); // 👈 VOLTA
    }

    // Nova função para mostrar popup de confirmação de tempo (ASG)
    function mostrarPopupConfirmacaoFinalizar(limpeza, minutosDecorridos) {
        return new Promise((resolve) => {
            const popupConfirmacao = document.getElementById('popupConfirmacaoFinalizar');
            const confirmacaoTempo = document.getElementById('confirmacaoTempo');
            const confirmacaoMensagem = document.getElementById('confirmacaoMensagem');

            // 🔒 Esconde o botão de nova limpeza
            if (btnNovaLimpeza) {
                btnNovaLimpeza.classList.add('oculto');
            }

            // Atualiza as mensagens
            confirmacaoTempo.innerHTML = `<strong>${minutosDecorridos} minutos</strong> de limpeza`;
            confirmacaoMensagem.innerHTML = `Deseja realmente finalizar a limpeza do leito <span class="highlight">${limpeza.numero_leito}</span>?`;

            // Pega os botões atualizados
            const cancelarBtn = document.getElementById('cancelarFinalizarBtn');
            const confirmarBtn = document.getElementById('confirmarFinalizarBtn');
            const fecharBtn = document.getElementById('fecharConfirmacaoFinalizar');

            // Remove todos os listeners antigos clonando os botões
            const novoCancelar = cancelarBtn.cloneNode(true);
            const novoConfirmar = confirmarBtn.cloneNode(true);
            const novoFechar = fecharBtn.cloneNode(true);

            cancelarBtn.parentNode.replaceChild(novoCancelar, cancelarBtn);
            confirmarBtn.parentNode.replaceChild(novoConfirmar, confirmarBtn);
            fecharBtn.parentNode.replaceChild(novoFechar, fecharBtn);

            // Variável de controle para evitar múltiplas resoluções
            let resolvido = false;

            // Função para fechar o popup
            const fechar = (resultado) => {
                if (resolvido) return;
                resolvido = true;

                popupConfirmacao.classList.add('oculto');

                if (btnNovaLimpeza) {
                    btnNovaLimpeza.classList.remove('oculto');
                }

                document.removeEventListener('keydown', onEsc);
                resolve(resultado);
            };

            // Handlers
            const onCancelar = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fechar(false);
            };

            const onConfirmar = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fechar(true);
            };

            const onFechar = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fechar(false);
            };

            const onEsc = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    fechar(false);
                }
            };

            const onClickFora = (e) => {
                if (e.target === popupConfirmacao) {
                    e.preventDefault();
                    fechar(false);
                }
            };

            // Adiciona listeners nos novos botões
            novoCancelar.addEventListener('click', onCancelar);
            novoConfirmar.addEventListener('click', onConfirmar);
            novoFechar.addEventListener('click', onFechar);

            // Listeners adicionais
            popupConfirmacao.addEventListener('click', onClickFora);
            document.addEventListener('keydown', onEsc);

            // Mostra o popup
            popupConfirmacao.classList.remove('oculto');
            novoConfirmar.focus();
        });
    }
    function abrirPopupLeitorEnfermeiro() {
        ocultarPaginaPrincipal(); // Esconde cards e botões
        mostrar(DOM.popupLeitorEnfermeiro);
        DOM.inputCartaoEnfermeiroOculto.value = "";
        DOM.inputCartaoEnfermeiroOculto.focus();
    }

    // 👉 Enfermeiro bipa o cartão
    // 👉 Enfermeiro bipa o cartão (agora usando input oculto)
    DOM.inputCartaoEnfermeiroOculto.addEventListener("input", confirmarEnf);

    let validandoEnf = false;
    let timerLeitor = null;

    function confirmarEnf() {
        if (validandoEnf) return;

        let valor = DOM.inputCartaoEnfermeiroOculto.value.replace(/\D/g, "");

        if (valor.length > 1 && valor.startsWith("0")) {
            valor = valor.substring(1);
        }

        DOM.inputCartaoEnfermeiroOculto.value = valor;

        clearTimeout(timerLeitor);

        timerLeitor = setTimeout(() => {
            if (valor.length < 9 || valor.length > 10) return;
            validarCartao(valor);
        }, 120);
    }

    async function validarCartao(id) {
        validandoEnf = true;

        try {
            const resp = await fetch("/api/verificar_funcionarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_cartao: id, tipo: "enfermagem" })
            });

            validarJSON(resp);
            const dados = await resp.json();

            if (!dados.sucesso) {
                mostrarMensagem("Enfermeiro não encontrado ou inativo.", () => {
                    DOM.inputCartaoEnfermeiroOculto.value = "";
                    DOM.inputCartaoEnfermeiroOculto.focus();
                });
            return;
            }

            localStorage.setItem("ultimoCartaoEnf", id);
            abrirConfirmacao(dados.nome, id);

        } catch (erro) {
            console.error("Erro ao verificar enfermeiro:", erro);
            mostrarMensagem("Erro ao verificar enfermeiro.", () => {
                DOM.inputCartaoEnfermeiroOculto.value = "";
                DOM.inputCartaoEnfermeiroOculto.focus();
            });
        }finally {
            validandoEnf = false;
        }
    }



    function abrirConfirmacao(nomeEnf, idCartao) {
        ocultar(DOM.popupLeitorEnfermeiro); // Fecha popup do leitor
        DOM.inputCartaoEnfermeiroOculto.value = "";

        if (!limpezaSelecionada) {
            console.warn("⚠ Nenhuma limpeza selecionada ao abrir confirmação");
            return;
        }

        DOM.mensagemConfirmacao.innerHTML = `
            <span class="highlight">${nomeEnf}</span> confirma a finalização da limpeza
            <span class="highlight">${limpezaSelecionada.tipo_limpeza}</span> do Leito
            <span class="highlight">${limpezaSelecionada.numero_leito}</span>
            realizada por <span class="highlight">${limpezaSelecionada.funcionario_asg}</span>?
        `;

        mostrar(DOM.popupConfirmacao); // Mostra popup de confirmação

        DOM.confirmarBtn.disabled = false;
        DOM.confirmarBtn.textContent = "Confirmar";
    }

    // ✅ Envia finalização da limpeza para o backend
    async function registrarFinalizacao(idLimpeza, enfNome, idCartaoEnf, tempoTotalSeconds) {
        const minutos = Math.floor(tempoTotalSeconds / 60);
        const segundosRestantes = tempoTotalSeconds % 60;
        const tempoFormatado =
            `${minutos.toString().padStart(2, "0")}:${segundosRestantes.toString().padStart(2, "0")}`;

        const dados = {
            id_limpeza: Number(idLimpeza),
            id_cartao_enf: idCartaoEnf,
            funcionario_enf: enfNome,
            tempo_total_seconds: tempoTotalSeconds,
            tempo_total_text: tempoFormatado
        };

        console.log("📤 Enviando finalização da limpeza:", dados);

        try {
            const response = await fetch("/api/registrar_limpeza", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.erro || `Erro HTTP: ${response.status}`);
            }

            console.log("✅ Limpeza finalizada com sucesso:", resultado);
            return resultado;

        } catch (erro) {
            console.error("❌ Erro ao registrar finalização:", erro);
            throw erro;
        }
    }

    /* =========================
       CONCLUSÃO
    ========================= */
    function mostrarConclusao(enfermagem, tempoTotalSeconds, idFinalizado) {
        limpezaSelecionada = null;

        // 🔒 Esconde a página principal enquanto o banner estiver ativo
        ocultarPaginaPrincipal();

        // Remove banner anterior se existir
        document.getElementById("bannerConclusao")?.remove();

        const banner = document.createElement("div");
        banner.id = "bannerConclusao";
        banner.className = "banner-conclusao";

        banner.innerHTML = `
            <div class="banner-conteudo">
                <p class="icone">✅</p>
                <p class="titulo">Limpeza concluída</p>
                <p>Confirmada por ${enfermagem}</p>
                <p class="tempo">🕒 ${formatarTempo(tempoTotalSeconds)}</p>
            </div>
        `;

        document.body.appendChild(banner);
        requestAnimationFrame(() => banner.classList.add("ativo"));

        setTimeout(() => {
            banner.classList.remove("ativo");

            setTimeout(() => {
                banner.remove();

                // 👉 SE AINDA EXISTE OUTRA LIMPEZA
                if (limpezasAtivas.length > 0) {
                    mostrarPaginaPrincipal(); // 👈 agora sim mostra
                    return;
                }

                // 👉 SE NÃO EXISTE MAIS NENHUMA
                window.location.href = "/tablet";

            }, 400);

        }, 3500);
    }


    /* =========================
       HELPERS
    ========================= */
    function ocultarPaginaPrincipal() {
        document.getElementById("containerLimpezas")?.classList.add("oculto");
        btnNovaLimpeza?.classList.add("oculto");
    }

    function mostrarPaginaPrincipal() {
        document.getElementById("containerLimpezas")?.classList.remove("oculto");
        btnNovaLimpeza?.classList.remove("oculto");
    }



    function mostrar(el) { el?.classList.remove("oculto"); }
    function ocultar(el) { el?.classList.add("oculto"); }

    function validarJSON(response) {
        const type = response.headers.get("content-type");
        if (!type?.includes("application/json")) {
            throw new Error("Resposta inválida do servidor");
        }
    }

    function aplicarEstilo() {
        document.head.insertAdjacentHTML("beforeend", `
            <style>
                .highlight {
                    font-weight: bold;
                    color: #0069d9;
                    background: #e7f1ff;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                #confirmarFim:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* Estilos para o popup de confirmação de tempo */
                .popup-confirmacao-tempo {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    backdrop-filter: blur(5px);
                }
                .popup-confirmacao-tempo .popup-conteudo {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    max-width: 450px;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease;
                }
                .popup-confirmacao-tempo h3 {
                    color: #0069d9;
                    margin-bottom: 20px;
                    font-size: 28px;
                    font-weight: bold;
                }
                .mensagem-tempo {
                    font-size: 20px;
                    margin: 20px 0;
                    padding: 15px;
                    background: #e7f1ff;
                    border-radius: 10px;
                    color: #0069d9;
                    font-weight: 600;
                }
                .mensagem-aviso {
                    margin: 25px 0;
                    font-size: 18px;
                    color: #333;
                    line-height: 1.6;
                }
                .botoes-tempo {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 30px;
                }
                .botoes-tempo button {
                    padding: 15px 35px;
                    border: none;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    flex: 1;
                }
                .btn-cancelar-tempo {
                    background: #6c757d;
                    color: white;
                }
                .btn-cancelar-tempo:hover {
                    background: #5a6268;
                }
                .btn-confirmar-tempo {
                    background: #28a745;
                    color: white;
                }
                .btn-confirmar-tempo:hover {
                    background: #218838;
                }
                @keyframes slideIn {
                    from {
                        transform: translateY(-30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            </style>
        `);
    }



    /* =========================
    RENDERIZAÇÃO
    ========================= */
    function renderizarLimpezas(limpezas) {
        console.log("Limpezas recebidas para renderizar:", limpezas);
        // ou melhor ainda:
        limpezas.forEach(l => {
            console.log(`ID ${l.id} → status: ${l.status}`);
        });
        const container = document.getElementById("containerLimpezas");
        container.innerHTML = "";

        limpezas.forEach(l => {
            const card = document.createElement("div");
            card.className = "card-limpeza";
            card.dataset.id = l.id;

            card.innerHTML = `
                <p><span class="titulo">Setor:</span> <span class="valor">${l.setor}</span></p>
                <p><span class="titulo">Leito:</span> <span class="valor">${l.numero_leito}</span></p>
                <p><span class="titulo">Tipo:</span> <span class="valor">${l.tipo_limpeza}</span></p>

                <div class="tempo" id="tempo-${l.id}">00:00</div>

                ${l.intervalo_liberado ? '<div class="badge-intervalo">🍽️ Intervalo liberado</div>' : ''}

                <div class="acoes"></div>
            `;

            container.appendChild(card);

            iniciarCronometro(l.id, l.data_inicio);

            const acoes = card.querySelector(".acoes");

            // 🔁 Decide o que renderizar baseado no status
            if (l.status === "AGUARDANDO_VALIDACAO") {
                renderizarAguardandoUI(acoes, l.id);
            } else {
                renderizarBotaoFinalizarUI(acoes, l.id);
            }

            // Define como selecionada se for a única
            if (limpezas.length === 1) {
                limpezaSelecionada = l;
            }
        });

        // Delegação de eventos
        container.onclick = (e) => {
            if (e.target.classList.contains("btn-finalizar")) {
                const id = e.target.dataset.id;
                abrirPopupLeitorASGFinalizar(id); // 🪪 pede o cartão do ASG antes de finalizar
            }

            if (e.target.classList.contains("btn-validar")) {
                const id = e.target.dataset.id;
                abrirPopupFinalizar(id);
            }
        };
    }

    /* =========================
       LEITOR DE CARTÃO DO ASG (FINALIZAR)
    ========================= */
    function abrirPopupLeitorASGFinalizar(idLimpeza) {
        const limpeza = limpezasAtivas.find(l => l.id == idLimpeza);
        if (!limpeza) {
            console.warn("⚠ Limpeza não encontrada:", idLimpeza);
            return;
        }

        idLimpezaParaFinalizar = idLimpeza;

        ocultarPaginaPrincipal();
        mostrar(DOM.popupLeitorASGFinalizar);
        DOM.inputCartaoASGFinalizarOculto.value = "";
        DOM.inputCartaoASGFinalizarOculto.focus();
    }

    DOM.fecharLeitorASGFinalizar?.addEventListener("click", () => {
        ocultar(DOM.popupLeitorASGFinalizar);
        DOM.inputCartaoASGFinalizarOculto.value = "";
        idLimpezaParaFinalizar = null;
        mostrarPaginaPrincipal();
    });

    let timerLeitorASGFinalizar = null;
    let validandoASGFinalizar = false;

    DOM.inputCartaoASGFinalizarOculto?.addEventListener("input", () => {
        if (validandoASGFinalizar) return;

        let valor = DOM.inputCartaoASGFinalizarOculto.value.replace(/\D/g, "");
        if (valor.length > 1 && valor.startsWith("0")) {
            valor = valor.substring(1);
        }
        DOM.inputCartaoASGFinalizarOculto.value = valor;

        clearTimeout(timerLeitorASGFinalizar);
        timerLeitorASGFinalizar = setTimeout(() => {
            if (valor.length < 9 || valor.length > 10) return;
            validarCartaoASGFinalizar(valor);
        }, 120);
    });

    async function validarCartaoASGFinalizar(idCartao) {
        validandoASGFinalizar = true;

        try {
            const resp = await fetch("/api/verificar_funcionarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_cartao: idCartao, tipo: "asg" })
            });

            validarJSON(resp);
            const dados = await resp.json();

            if (!dados.sucesso) {
                mostrarMensagem("Funcionário não encontrado ou inativo.", () => {
                    DOM.inputCartaoASGFinalizarOculto.value = "";
                    DOM.inputCartaoASGFinalizarOculto.focus();
                });
                return;
            }

            const idLimpeza = idLimpezaParaFinalizar;

            ocultar(DOM.popupLeitorASGFinalizar);
            DOM.inputCartaoASGFinalizarOculto.value = "";

            await colocarEmAguardandoValidacao(idLimpeza, idCartao);

        } catch (erro) {
            console.error("❌ Erro ao verificar ASG:", erro);
            mostrarMensagem("Erro ao verificar funcionário.", () => {
                DOM.inputCartaoASGFinalizarOculto.value = "";
                DOM.inputCartaoASGFinalizarOculto.focus();
            });
        } finally {
            validandoASGFinalizar = false;
        }
    }

    async function colocarEmAguardandoValidacao(idLimpeza, idCartaoAsg) {
        try {
            const limpeza = limpezasAtivas.find(l => l.id == idLimpeza);
            if (!limpeza) return;

            const inicio = new Date(limpeza.data_inicio);
            const agora = new Date();
            const tempoDecorridoMinutos = Math.floor((agora - inicio) / 1000 / 60);

            console.log(`Tempo decorrido: ${tempoDecorridoMinutos} minutos`);

            // Centro Cirúrgico tem tempo mínimo reduzido (15 min); demais setores, 35 min
            const setorNorm = (limpeza.setor || "").trim().toUpperCase();
            const ehCentroCirurgico = setorNorm.includes("CENTRO CIRURGICO") || setorNorm.includes("CENTRO CIRÚRGICO");
            const TEMPO_MINIMO = ehCentroCirurgico ? 15 : 35;

            // Se for menor que o tempo mínimo, BLOQUEIA
            if (tempoDecorridoMinutos < TEMPO_MINIMO) {
                // Usa a função mostrarMensagem existente, com o botão de Intervalo Almoço/Janta
                mostrarMensagem(
                    `Tempo mínimo: ${TEMPO_MINIMO} minutos`,
                    () => mostrarPaginaPrincipal(),
                    { idLimpeza }
                );

                return;
            }



            // Se for maior ou igual, PERGUNTA CONFIRMAÇÃO
            if (tempoDecorridoMinutos >= TEMPO_MINIMO) {
                const confirmar = await mostrarPopupConfirmacaoFinalizar(limpeza, tempoDecorridoMinutos);

                if (!confirmar) {
                    mostrarPaginaPrincipal();
                    return;
                }

                const response = await fetch("/api/limpeza/aguardando_validacao", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id_limpeza: idLimpeza, id_cartao_asg: idCartaoAsg })
                });

                const resultado = await response.json();

                if (!response.ok) {
                    if (resultado.erro === "TEMPO_MINIMO_NAO_ATINGIDO") {
                        mostrarMensagem(resultado.mensagem, () => mostrarPaginaPrincipal(), { idLimpeza });
                        return;
                    }
                    if (resultado.erro === "ASG_INVALIDO") {
                        mostrarMensagem(resultado.mensagem, () => mostrarPaginaPrincipal());
                        return;
                    }
                    throw new Error(resultado.erro || "Erro ao finalizar limpeza");
                }

                console.log("✅ Limpeza finalizada, aguardando validação:", resultado);

                // Atualiza a UI
                const card = document.querySelector(`.card-limpeza[data-id="${idLimpeza}"]`);
                limpeza.status = "AGUARDANDO_VALIDACAO";

                card.querySelector(".btn-finalizar")?.remove();

                const aguardando = document.createElement("div");
                aguardando.className = "aguardando-validacao";
                aguardando.innerHTML = `
                    <div class="spinner"></div>
                    <p>Aguardando Validação</p>
                    <button class="btn-validar" data-id="${idLimpeza}">
                        Validar Limpeza
                    </button>
                `;
                card.appendChild(aguardando);

                mostrarPaginaPrincipal();
            }

        } catch (e) {
            console.error("Erro ao colocar em aguardando validação", e);

            // Em caso de erro, também usa a função mostrarMensagem
            mostrarMensagem(`❌ Erro: ${e.message}`, () => mostrarPaginaPrincipal());
        }
    }


    /* =========================
       LEITOR DE CARTÃO DO ASG (INTERVALO ALMOÇO/JANTA)
    ========================= */
    let idLimpezaParaIntervalo = null;

    function abrirPopupLeitorIntervalo(idLimpeza) {
        idLimpezaParaIntervalo = idLimpeza;

        ocultarPaginaPrincipal();
        mostrar(DOM.popupLeitorIntervalo);
        DOM.inputCartaoIntervaloOculto.value = "";
        DOM.inputCartaoIntervaloOculto.focus();
    }

    DOM.fecharLeitorIntervalo?.addEventListener("click", () => {
        ocultar(DOM.popupLeitorIntervalo);
        DOM.inputCartaoIntervaloOculto.value = "";
        idLimpezaParaIntervalo = null;
        mostrarPaginaPrincipal();
    });

    let timerLeitorIntervalo = null;
    let validandoIntervalo = false;

    DOM.inputCartaoIntervaloOculto?.addEventListener("input", () => {
        if (validandoIntervalo) return;

        let valor = DOM.inputCartaoIntervaloOculto.value.replace(/\D/g, "");
        if (valor.length > 1 && valor.startsWith("0")) {
            valor = valor.substring(1);
        }
        DOM.inputCartaoIntervaloOculto.value = valor;

        clearTimeout(timerLeitorIntervalo);
        timerLeitorIntervalo = setTimeout(() => {
            if (valor.length < 9 || valor.length > 10) return;
            ativarIntervalo(valor);
        }, 120);
    });

    async function ativarIntervalo(idCartao) {
        validandoIntervalo = true;
        const idLimpeza = idLimpezaParaIntervalo;

        try {
            const resp = await fetch("/api/limpeza/ativar_intervalo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_limpeza: idLimpeza, id_cartao_asg: idCartao })
            });

            validarJSON(resp);
            const resultado = await resp.json();

            ocultar(DOM.popupLeitorIntervalo);
            DOM.inputCartaoIntervaloOculto.value = "";

            if (!resp.ok) {
                mostrarMensagem(
                    resultado.mensagem || "Não foi possível ativar o Intervalo.",
                    () => mostrarPaginaPrincipal()
                );
                return;
            }

            const limpeza = limpezasAtivas.find(l => l.id == idLimpeza);
            if (limpeza) limpeza.intervalo_liberado = 1;
            marcarIntervaloLiberadoNaTela(idLimpeza);

            mostrarMensagem(
                "Intervalo liberado! Outro ASG já pode finalizar essa limpeza.",
                () => mostrarPaginaPrincipal()
            );

        } catch (erro) {
            console.error("❌ Erro ao ativar intervalo:", erro);
            ocultar(DOM.popupLeitorIntervalo);
            DOM.inputCartaoIntervaloOculto.value = "";
            mostrarMensagem("Erro ao ativar Intervalo.", () => mostrarPaginaPrincipal());
        } finally {
            validandoIntervalo = false;
            idLimpezaParaIntervalo = null;
        }
    }

    function marcarIntervaloLiberadoNaTela(idLimpeza) {
        const card = document.querySelector(`.card-limpeza[data-id="${idLimpeza}"]`);
        if (!card || card.querySelector(".badge-intervalo")) return;

        const badge = document.createElement("div");
        badge.className = "badge-intervalo";
        badge.textContent = "🍽️ Intervalo liberado";
        card.querySelector(".tempo")?.insertAdjacentElement("afterend", badge);
    }

    function renderizarBotaoFinalizarUI(container, id) {
        container.innerHTML = `
            <button class="btn-finalizar" data-id="${id}">
                Finalizar
            </button>
        `;
    }

    function renderizarAguardandoUI(container, id) {
        container.innerHTML = `
            <div class="aguardando-validacao">
                <div class="spinner"></div>
                <p>Aguardando Validação</p>
                <button class="btn-validar" data-id="${id}">
                    Validar Limpeza
                </button>
            </div>
        `;
    }




    function atualizarBotoesLimpeza() {
        if (limpezasAtivas.length === 1) {
            btnNovaLimpeza.classList.remove("hidden");
        } else {
            btnNovaLimpeza.classList.add("hidden");
        }
    }

    function removerLimpezaDaTela(idLimpeza) {
        // Remove do DOM
        document.querySelector(`.card-limpeza[data-id="${idLimpeza}"]`)?.remove();

        // Para cronômetro
        if (cronometros.has(idLimpeza)) {
            clearInterval(cronometros.get(idLimpeza));
            cronometros.delete(idLimpeza);
        }

        // Remove do array
        limpezasAtivas = limpezasAtivas.filter(l => l.id != idLimpeza);

        // Atualiza visibilidade do botão
        atualizarBotoesLimpeza();
    }
})();
