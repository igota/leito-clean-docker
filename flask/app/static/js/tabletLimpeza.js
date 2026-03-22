document.addEventListener("DOMContentLoaded", () => {
    const leito = JSON.parse(localStorage.getItem("leito_selecionado"));
    const titulo = document.getElementById("tituloLeito");
    const paciente = document.getElementById("infoPaciente");
    const iniciarBtn = document.getElementById("iniciarLimpezaBtn");

    // NOVO: Popup do leitor de cartão
    const popupLeitorCartao = document.getElementById("popupLeitorCartao");
    const inputCartaoOculto = document.getElementById("idcartaoInputOculto");
    const fecharLeitorCartao = document.getElementById("fecharLeitorCartao");
    
    const popupTipo = document.getElementById("popupTipo");
    const popupTerminal = document.getElementById("popupTerminal");
    const voltarBtn = document.getElementById("voltarBtn");

    const popupConfirmacao = document.getElementById("popupConfirmacao");
    const mensagemConfirmacao = document.getElementById("mensagemConfirmacao");
    const confirmarInicio = document.getElementById("confirmarInicio");
    const cancelarInicio = document.getElementById("cancelarInicio");

    // CSS sugerido (adicione no seu stylesheet)
    const estiloDestaque = `
        .highlight { 
            font-weight: bold; 
            color: #0069d9; 
            background: #e7f1ff; 
            padding: 2px 6px; 
            border-radius: 4px; 
        }
    `;

    let funcionarioASG = null;
    let idcartaoFuncionario = null;
    let tipoSelecionado = null;
    
    // NOVA: Função para abrir o popup do leitor
    function abrirPopupLeitorCartao() {
        popupLeitorCartao.classList.remove('oculto');
        inputCartaoOculto.value = "";
        inputCartaoOculto.focus();
    }

    function mostrarMensagem(texto, callback = null) {
        const popup = document.getElementById("popupMensagem");
        const msg = document.getElementById("mensagemTexto");
        const btn = document.getElementById("fecharMensagemBtn");

        msg.textContent = texto;
        popup.classList.remove("oculto");

        btn.onclick = () => {
            popup.classList.add("oculto");
            if (callback) callback();
        };
    }

    // Funções para controlar visibilidade do conteúdo principal
    function ocultarConteudoPrincipal() {
        const titulo = document.getElementById("tituloLeito");
        const paciente = document.getElementById("infoPaciente");
        const iniciarBtn = document.getElementById("iniciarLimpezaBtn");
        const voltarBtn = document.getElementById("voltarBtn");
        
        if (titulo) titulo.classList.add("oculto");
        if (paciente) paciente.classList.add("oculto");
        if (iniciarBtn) iniciarBtn.classList.add("oculto");
        if (voltarBtn) voltarBtn.classList.add("oculto");
    }

    if (leito) {
        titulo.textContent = `Leito ${leito.numero_leito}`;
        paciente.innerHTML = leito.paciente 
        ? `<strong>Paciente:</strong> ${leito.paciente}` 
        : "Sem paciente";
    }

    function mostrarConteudoPrincipal() {
        const titulo = document.getElementById("tituloLeito");
        const paciente = document.getElementById("infoPaciente");
        const iniciarBtn = document.getElementById("iniciarLimpezaBtn");
        const voltarBtn = document.getElementById("voltarBtn");
        
        if (titulo) titulo.classList.remove("oculto");
        if (paciente) paciente.classList.remove("oculto");
        if (iniciarBtn) iniciarBtn.classList.remove("oculto");
        if (voltarBtn) voltarBtn.classList.remove("oculto");
    }

    // 👉 Mostra popup do leitor (COM VERIFICAÇÃO)
    iniciarBtn.addEventListener("click", async () => {
        try {
            console.log("🔍 Verificando se existe limpeza ativa...");
            
            const resposta = await fetch("/api/verificar_limpeza_ativa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leito: leito,
                    funcionario_asg: funcionarioASG
                })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(dados.erro || "Erro ao verificar limpeza ativa");
            }

            if (dados.limpeza_ativa) {
                console.log("⚠️ " + dados.mensagem);
                mostrarMensagem(`❌ ${dados.mensagem}\n\nAguarde a conclusão da limpeza atual.`);
                return;
            }

            // ✅ PERMITIR - Abre o novo popup do leitor
            console.log("✅ " + dados.mensagem);
            abrirPopupLeitorCartao();

        } catch (erro) {
            console.error("❌ Erro ao verificar limpeza ativa:", erro);
            alert("Erro ao verificar status do leito. Tente novamente.");
        }
    });
        
    // 👉 Quando bipar cartão do funcionário (input oculto)
    let timerLeitorASG = null;
    let validandoASG = false;

    inputCartaoOculto.addEventListener("input", function () {
        if (validandoASG) return;

        // mantém só números
        let valor = this.value.replace(/\D/g, "");

        // remove APENAS o primeiro zero se estiver no início
        if (valor.length > 1 && valor.startsWith("0")) {
            valor = valor.substring(1);
        }

        this.value = valor;

        // cancela tentativa anterior
        clearTimeout(timerLeitorASG);

        // espera o leitor terminar
        timerLeitorASG = setTimeout(() => {
            if (valor.length < 9 || valor.length > 10) return;
            validarCartaoASG(valor);
        }, 120);
    });

    async function validarCartaoASG(id_cartao_enviado) {
        validandoASG = true;

        console.log("[DEBUG] Tentando buscar → ID enviado:", id_cartao_enviado);

        try {
            const resposta = await fetch("/api/verificar_funcionarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_cartao: id_cartao_enviado, tipo: "asg" })
            });

            if (!resposta.ok) {
                throw new Error(`HTTP ${resposta.status}`);
            }

            const dados = await resposta.json();

            if (!dados.sucesso) {
                mostrarMensagem("Funcionário não encontrado ou inativo.", () => {
                    inputCartaoOculto.value = "";
                    inputCartaoOculto.focus();
                    // Quando mensagem fechar, o conteúdo principal já está oculto
                    // pois o popup do leitor ainda está aberto
                });
                return;
            }

            // Funcionário identificado
            funcionarioASG = dados.nome;
            idcartaoFuncionario = id_cartao_enviado;

            // Verifica se já tem limpeza ativa com o ID do cartão
            const resLimpeza = await fetch("/api/verificar_limpeza_funcionario", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_cartao: id_cartao_enviado })
            });

            const verif = await resLimpeza.json();

            if (verif.limpeza_ativa) {
                mostrarMensagem(
                    `❌ ${verif.mensagem}\n\n`,
                    () => {
                        inputCartaoOculto.value = "";
                        inputCartaoOculto.focus();
                        // Quando mensagem fechar, o conteúdo principal já está oculto
                        // pois o popup do leitor ainda está aberto
                    }
                );
                return;
            }

            // Tudo ok → fecha popup do leitor e abre tipo
            popupLeitorCartao.classList.add("oculto");
            popupTipo.classList.remove("oculto");
            
            ocultarConteudoPrincipal();

        } catch (erro) {
            console.error("Erro ao processar cartão:", erro);
            mostrarMensagem(
                "Erro de comunicação com o servidor. Tente novamente.",
                () => {
                    inputCartaoOculto.value = "";
                    inputCartaoOculto.focus();
                    // Quando mensagem fechar, o conteúdo principal já está oculto
                    // pois o popup do leitor ainda está aberto
                }
            );
        } finally {
            validandoASG = false;
        }
    }

    // 👉 Fechar popups
    fecharLeitorCartao.addEventListener("click", () => popupLeitorCartao.classList.add("oculto"));

    document.getElementById("fecharTipo").addEventListener("click", () => {
    popupTipo.classList.add("oculto");
    mostrarConteudoPrincipal(); // 👈 Mostra conteúdo principal
    });
    document.getElementById("fecharTerminal").addEventListener("click", () => {
    popupTerminal.classList.add("oculto");
    mostrarConteudoPrincipal(); // 👈 Mostra conteúdo principal
    });

    // 👉 Escolha do tipo de limpeza (abre confirmação)
    document.querySelectorAll(".tipoBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            tipoSelecionado = btn.dataset.tipo;

            popupTipo.classList.add("oculto");

            // Se for Terminal, abre o segundo popup
            if (tipoSelecionado === "Terminal") {
                popupTerminal.classList.remove("oculto");
                return;
            }

            mensagemConfirmacao.innerHTML = `
                <span class="highlight">${funcionarioASG}</span> confirma o início da limpeza
                <span class="highlight">${tipoSelecionado}</span> do Leito
                <span class="highlight">${leito.numero_leito}</span>?
            `;    

            popupConfirmacao.classList.remove("oculto");
        });
    });

    // ✅ Confirmar início da limpeza
    confirmarInicio.addEventListener("click", async () => {
        popupConfirmacao.classList.add("oculto");
        popupTerminal.classList.add("oculto");
        await registrarInicioLimpeza();
        window.location.href = "/tablet_limpeza_ativa";
    });

    // ❌ Cancelar início
    cancelarInicio.addEventListener("click", () => {
        popupConfirmacao.classList.add("oculto");
        popupTerminal.classList.add("oculto");
        mostrarConteudoPrincipal();
    });

    voltarBtn.addEventListener("click", () => window.location.href = "/tablet_leitos");

    // No <head> ou em arquivo CSS:
    document.head.insertAdjacentHTML("beforeend", `<style>${estiloDestaque}</style>`);

    // ✅ Envia início da limpeza para o backend
    async function registrarInicioLimpeza() {
        const dados = {
            id_cartao_asg: idcartaoFuncionario,
            funcionario_asg: funcionarioASG,
            leito: leito,
            tipo_limpeza: tipoSelecionado,
        };

        console.log("📤 Enviando início da limpeza:", dados);

        try {
            const response = await fetch("/api/registrar_limpeza", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const resultado = await response.json();
            console.log("✅ Resposta do servidor:", resultado);

        } catch (erro) {
            console.error("❌ Erro ao registrar início:", erro);
            alert("Erro ao registrar início da limpeza. Tente novamente.");
        }
    }
});