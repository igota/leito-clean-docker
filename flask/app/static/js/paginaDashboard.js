document.addEventListener("DOMContentLoaded", () => {

    const CORES = {
        azul: "#013757",
        azulClaro: "#0d6efd",
        verde: "#28a745",
        vermelho: "#dc3545",
        laranja: "#fd7e14",
        ciano: "#17a2b8",
        cinza: "#adb5bd"
    };

    const selectSetor = document.getElementById("filtroSetor");
    const selectLeito = document.getElementById("filtroLeito");
    const inputInicio = document.getElementById("filtroInicio");
    const inputFim = document.getElementById("filtroFim");
    const botoesPeriodo = document.querySelectorAll(".periodo-btn");
    const btnAplicar = document.getElementById("btnAplicarFiltros");
    const dashboardVazio = document.getElementById("dashboardVazio");
    const btnMaximizar = document.getElementById("btnMaximizarDashboard");

    const graficos = {}; // instâncias Chart.js ativas, por canvas id

    /* =========================
       EXPANDIR / RECOLHER MENU LATERAL + TELA CHEIA
    ========================== */

    function entrarModoExpandido() {
        document.body.classList.add("menu-oculto");
        btnMaximizar.innerHTML = '<i class="fas fa-compress"></i>';
        btnMaximizar.title = "Sair da tela cheia";

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }

    function sairModoExpandido() {
        document.body.classList.remove("menu-oculto");
        btnMaximizar.innerHTML = '<i class="fas fa-expand"></i>';
        btnMaximizar.title = "Ocultar menu lateral";

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }

    btnMaximizar.addEventListener("click", () => {
        if (document.body.classList.contains("menu-oculto")) {
            sairModoExpandido();
        } else {
            entrarModoExpandido();
        }
    });

    // Mantém o botão sincronizado se o usuário sair da tela cheia com ESC/F11
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && document.body.classList.contains("menu-oculto")) {
            sairModoExpandido();
        }
    });

    /* =========================
       HELPERS DE DATA / TEMPO
    ========================== */

    function formatarParaInput(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, "0");
        const dia = String(date.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    function formatarParaExibicao(dataYMD) {
        const [ano, mes, dia] = dataYMD.split("-");
        return `${dia}/${mes}`;
    }

    function tempoParaSegundos(texto) {
        if (!texto || typeof texto !== "string" || !texto.includes(":")) return null;
        const [minStr, segStr] = texto.split(":");
        const minutos = Number(minStr);
        const segundos = Number(segStr);
        if (Number.isNaN(minutos) || Number.isNaN(segundos)) return null;
        return minutos * 60 + segundos;
    }

    function segundosParaTempo(segTotais) {
        const m = Math.floor(segTotais / 60);
        const s = Math.round(segTotais % 60);
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function parseDataHora(texto) {
        if (!texto) return null;
        const d = new Date(texto.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    // Formata durações longas (atraso pode ser medido em horas/dias, não só minutos)
    function segundosParaDuracaoLonga(segTotais) {
        if (segTotais === null) return "—";
        const dias = Math.floor(segTotais / 86400);
        const horas = Math.floor((segTotais % 86400) / 3600);
        const minutos = Math.floor((segTotais % 3600) / 60);

        if (dias > 0) return `${dias}d ${horas}h`;
        if (horas > 0) return `${horas}h ${minutos}min`;
        return `${minutos}min`;
    }

    /* =========================
       CARREGAR SETORES
    ========================== */

    async function carregarSetores() {
        try {
            const response = await fetch("/api/setores");
            const setores = await response.json();

            setores.forEach(item => {
                const nome = item.setor || item.nome || "";
                if (!nome) return;
                const option = document.createElement("option");
                option.value = nome;
                option.textContent = nome;
                selectSetor.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar setores:", error);
        }
    }

    /* =========================
       CARREGAR LEITOS DO SETOR
    ========================== */

    async function carregarLeitos() {
        const setor = selectSetor.value;

        selectLeito.innerHTML = '<option value="__TODOS__">Todos os Leitos</option>';

        if (!setor || setor === "__TODOS__") {
            selectLeito.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/relatorios/leitos_registrados?setor=${encodeURIComponent(setor)}`);
            const leitos = await response.json();

            leitos
                .sort((a, b) => Number(a) - Number(b))
                .forEach(leito => {
                    const option = document.createElement("option");
                    option.value = leito;
                    option.textContent = leito;
                    selectLeito.appendChild(option);
                });

            selectLeito.disabled = false;
        } catch (error) {
            console.error("Erro ao carregar leitos:", error);
            selectLeito.disabled = true;
        }
    }

    /* =========================
       PERÍODO RÁPIDO
    ========================== */

    function aplicarPeriodo(periodo) {
        const hoje = new Date();
        let inicio, fim;

        if (periodo === "hoje") {
            inicio = hoje;
            fim = hoje;
        } else {
            fim = hoje;
            inicio = new Date();
            const dias = { "7dias": 6, "30dias": 29, "90dias": 89 }[periodo] ?? 29;
            inicio.setDate(hoje.getDate() - dias);
        }

        inputInicio.value = formatarParaInput(inicio);
        inputFim.value = formatarParaInput(fim);
    }

    botoesPeriodo.forEach(btn => {
        btn.addEventListener("click", () => {
            botoesPeriodo.forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            aplicarPeriodo(btn.dataset.periodo);
            carregarDashboard();
        });
    });

    [inputInicio, inputFim].forEach(input => {
        input.addEventListener("change", () => {
            botoesPeriodo.forEach(b => b.classList.remove("ativo"));
        });
    });

    btnAplicar.addEventListener("click", carregarDashboard);

    selectSetor.addEventListener("change", async () => {
        await carregarLeitos();
        carregarDashboard();
    });

    selectLeito.addEventListener("change", carregarDashboard);

    /* =========================
       BUSCAR DADOS
    ========================== */

    async function buscarRegistros() {
        const params = new URLSearchParams();
        const setor = selectSetor.value;
        const leito = selectLeito.value;

        if (setor && setor !== "__TODOS__") params.append("setor", setor);
        if (leito && leito !== "__TODOS__") params.append("leito", leito);
        if (inputInicio.value) params.append("inicio", inputInicio.value);
        if (inputFim.value) params.append("fim", inputFim.value);

        const response = await fetch(`/api/relatorios/dados?${params.toString()}`);
        const dados = await response.json();
        return Array.isArray(dados) ? dados : [];
    }

    /* =========================
       AGREGAÇÕES
    ========================== */

    function calcularAgregados(registros) {
        // --- Volume por data ---
        const volumeMap = new Map();
        registros.forEach(r => {
            if (!r.data_inicio) return;
            const data = r.data_inicio.substring(0, 10);
            volumeMap.set(data, (volumeMap.get(data) || 0) + 1);
        });
        const datasOrdenadas = [...volumeMap.keys()].sort();

        // --- SLA (linha do tempo por leito) ---
        const sla = classificarSla(registros);

        // --- Tipo de limpeza ---
        const tipoMap = new Map();
        registros.forEach(r => {
            const tipo = r.tipo_limpeza || "Não informado";
            tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
        });

        // --- Tempo médio por setor ---
        const tempoPorSetor = new Map(); // setor -> {somaSeg, qtd}
        let somaSegGeral = 0, qtdGeral = 0;
        registros.forEach(r => {
            const seg = tempoParaSegundos(r.tempo_total_text);
            if (seg === null) return;
            const setor = r.setor || "Não informado";
            const atual = tempoPorSetor.get(setor) || { somaSeg: 0, qtd: 0 };
            atual.somaSeg += seg;
            atual.qtd += 1;
            tempoPorSetor.set(setor, atual);
            somaSegGeral += seg;
            qtdGeral += 1;
        });

        const tempoMedioSetorArray = [...tempoPorSetor.entries()]
            .map(([setor, { somaSeg, qtd }]) => ({ setor, mediaSeg: somaSeg / qtd }))
            .sort((a, b) => b.mediaSeg - a.mediaSeg);

        // --- Desempenho por ASG (colaborador de limpeza) ---
        const asgMap = new Map(); // asg -> { qtdTotal, somaSeg, qtdComTempo }
        registros.forEach(r => {
            const asg = r.funcionario_asg || "Não informado";
            const atual = asgMap.get(asg) || { qtdTotal: 0, somaSeg: 0, qtdComTempo: 0 };
            atual.qtdTotal += 1;
            const seg = tempoParaSegundos(r.tempo_total_text);
            if (seg !== null) {
                atual.somaSeg += seg;
                atual.qtdComTempo += 1;
            }
            asgMap.set(asg, atual);
        });
        const desempenhoAsg = [...asgMap.entries()]
            .map(([asg, { qtdTotal, somaSeg, qtdComTempo }]) => ({
                asg,
                qtd: qtdTotal,
                tempoMedioSeg: qtdComTempo > 0 ? somaSeg / qtdComTempo : null
            }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 10);

        return {
            total: registros.length,
            volume: { labels: datasOrdenadas, valores: datasOrdenadas.map(d => volumeMap.get(d)) },
            sla,
            tipos: { labels: [...tipoMap.keys()], valores: [...tipoMap.values()] },
            tempoPorSetor: tempoMedioSetorArray,
            tempoMedioGeralSeg: qtdGeral > 0 ? somaSegGeral / qtdGeral : null,
            desempenhoAsg
        };
    }

    /* =========================
       SLA — LINHA DO TEMPO POR LEITO
       ========================
       "vencimento" de uma limpeza é o prazo para a PRÓXIMA limpeza daquele
       leito ser validada. Por isso a classificação compara o vencimento do
       registro N com a data_validacao do registro N+1 (mesmo setor+leito),
       não o vencimento com sua própria validação.
    ========================== */

    function classificarSla(registros) {
        const agora = new Date();

        const grupos = new Map(); // "setor||leito" -> registros
        registros.forEach(r => {
            const chave = `${r.setor || ""}||${r.numero_leito || ""}`;
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(r);
        });

        let noPrazo = 0, vencidaResolvida = 0, vencidaAberto = 0;
        const atrasosSeg = [];
        const atrasosPorLeito = new Map(); // "setor||leito" -> { setor, leito, qtd, somaSeg }

        grupos.forEach((lista, chave) => {
            lista.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

            const registrarAtraso = (segundos) => {
                const atual = atrasosPorLeito.get(chave) || {
                    setor: lista[0].setor || "Não informado",
                    leito: lista[0].numero_leito || "—",
                    qtd: 0,
                    somaSeg: 0
                };
                atual.qtd += 1;
                atual.somaSeg += segundos;
                atrasosPorLeito.set(chave, atual);
            };

            lista.forEach((registro, i) => {
                if (!registro.vencimento) return; // tipo/setor sem SLA aplicável

                const vencimento = parseDataHora(registro.vencimento);
                if (!vencimento) return;

                const proxima = lista[i + 1];
                const validacaoProxima = proxima ? parseDataHora(proxima.data_validacao) : null;

                // Leito extra suspenso (sumiu do PEP): a responsabilidade desse
                // registro pelo atraso termina no momento da suspensão — o tempo
                // parado fora do sistema (ou até uma limpeza nova, bem depois)
                // não conta contra ele. Suspensão é terminal (não retoma).
                const suspensoDesde = registro.suspenso_desde ? parseDataHora(registro.suspenso_desde) : null;

                if (suspensoDesde) {
                    if (suspensoDesde > vencimento) {
                        vencidaResolvida++;
                        const seg = (suspensoDesde - vencimento) / 1000;
                        atrasosSeg.push(seg);
                        registrarAtraso(seg);
                    } else {
                        noPrazo++; // suspendeu antes mesmo de vencer
                    }
                    return;
                }

                if (validacaoProxima) {
                    if (validacaoProxima <= vencimento) {
                        noPrazo++;
                    } else {
                        vencidaResolvida++;
                        const seg = (validacaoProxima - vencimento) / 1000;
                        atrasosSeg.push(seg);
                        registrarAtraso(seg);
                    }
                } else if (vencimento < agora) {
                    // não há próxima limpeza validada ainda, e o prazo já passou
                    vencidaAberto++;
                    const seg = (agora - vencimento) / 1000;
                    atrasosSeg.push(seg);
                    registrarAtraso(seg);
                } else {
                    noPrazo++; // ainda dentro do prazo, aguardando a próxima limpeza
                }
            });
        });

        const totalAvaliado = noPrazo + vencidaResolvida + vencidaAberto;
        const percentualSla = totalAvaliado > 0 ? Math.round((noPrazo / totalAvaliado) * 100) : null;
        const atrasoMedioSeg = atrasosSeg.length > 0
            ? atrasosSeg.reduce((a, b) => a + b, 0) / atrasosSeg.length
            : null;

        const rankingLeitos = [...atrasosPorLeito.values()]
            .map(l => ({ ...l, atrasoMedioSeg: l.somaSeg / l.qtd }))
            .sort((a, b) => b.qtd - a.qtd || b.atrasoMedioSeg - a.atrasoMedioSeg)
            .slice(0, 10);

        return { noPrazo, vencidaResolvida, vencidaAberto, percentualSla, atrasoMedioSeg, rankingLeitos };
    }

    /* =========================
       KPIs
    ========================== */

    function renderKPIs(agg) {
        document.getElementById("kpiTotal").textContent = agg.total;
        document.getElementById("kpiSla").textContent =
            agg.sla.percentualSla === null ? "—" : `${agg.sla.percentualSla}%`;
        document.getElementById("kpiTempoMedio").textContent =
            agg.tempoMedioGeralSeg === null ? "—" : segundosParaTempo(agg.tempoMedioGeralSeg);
        document.getElementById("kpiAtrasoMedio").textContent =
            segundosParaDuracaoLonga(agg.sla.atrasoMedioSeg);
    }

    /* =========================
       GRÁFICOS
    ========================== */

    function destruirGrafico(id) {
        if (graficos[id]) {
            graficos[id].destroy();
            delete graficos[id];
        }
    }

    function renderGraficoVolume(agg) {
        destruirGrafico("volume");
        const ctx = document.getElementById("graficoVolume");
        graficos.volume = new Chart(ctx, {
            type: "line",
            data: {
                labels: agg.volume.labels.map(formatarParaExibicao),
                datasets: [{
                    label: "Limpezas",
                    data: agg.volume.valores,
                    borderColor: CORES.azul,
                    backgroundColor: "rgba(1, 55, 87, 0.12)",
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    function renderGraficoSla(agg) {
        destruirGrafico("sla");
        const ctx = document.getElementById("graficoSla");
        const { noPrazo, vencidaResolvida, vencidaAberto } = agg.sla;

        graficos.sla = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Dentro do prazo", "Vencida (resolvida com atraso)", "Vencida (em aberto)"],
                datasets: [{
                    data: [noPrazo, vencidaResolvida, vencidaAberto],
                    backgroundColor: [CORES.verde, CORES.laranja, CORES.vermelho]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });
    }

    function renderGraficoTipo(agg) {
        destruirGrafico("tipo");
        const ctx = document.getElementById("graficoTipo");
        const paleta = [CORES.azul, CORES.azulClaro, CORES.ciano, CORES.laranja, CORES.cinza, CORES.verde];

        graficos.tipo = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: agg.tipos.labels,
                datasets: [{
                    data: agg.tipos.valores,
                    backgroundColor: agg.tipos.labels.map((_, i) => paleta[i % paleta.length])
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });
    }

    function renderGraficoTempoSetor(agg) {
        destruirGrafico("tempoSetor");
        const ctx = document.getElementById("graficoTempoSetor");

        graficos.tempoSetor = new Chart(ctx, {
            type: "bar",
            data: {
                labels: agg.tempoPorSetor.map(s => s.setor),
                datasets: [{
                    label: "Tempo médio (min)",
                    data: agg.tempoPorSetor.map(s => Math.round((s.mediaSeg / 60) * 10) / 10),
                    backgroundColor: CORES.azul
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (item) => segundosParaTempo(agg.tempoPorSetor[item.dataIndex].mediaSeg)
                        }
                    }
                },
                scales: { x: { beginAtZero: true, title: { display: true, text: "minutos" } } }
            }
        });
    }

    function renderGraficoAsg(agg) {
        destruirGrafico("asg");
        const ctx = document.getElementById("graficoAsg");

        graficos.asg = new Chart(ctx, {
            type: "bar",
            data: {
                labels: agg.desempenhoAsg.map(a => a.asg),
                datasets: [{
                    label: "Limpezas realizadas",
                    data: agg.desempenhoAsg.map(a => a.qtd),
                    backgroundColor: CORES.azulClaro
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const a = agg.desempenhoAsg[item.dataIndex];
                                const tempo = a.tempoMedioSeg === null ? "—" : segundosParaTempo(a.tempoMedioSeg);
                                return [`Limpezas: ${a.qtd}`, `Tempo médio: ${tempo}`];
                            }
                        }
                    }
                },
                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    function renderGraficoRankingLeitos(agg) {
        destruirGrafico("rankingLeitos");
        const ctx = document.getElementById("graficoRankingLeitos");
        const dados = agg.sla.rankingLeitos;

        graficos.rankingLeitos = new Chart(ctx, {
            type: "bar",
            data: {
                labels: dados.map(l => `${l.setor} - Leito ${l.leito}`),
                datasets: [{
                    label: "Atrasos",
                    data: dados.map(l => l.qtd),
                    backgroundColor: CORES.vermelho
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const l = dados[item.dataIndex];
                                return [`Atrasos: ${l.qtd}`, `Atraso médio: ${segundosParaDuracaoLonga(l.atrasoMedioSeg)}`];
                            }
                        }
                    }
                },
                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    /* =========================
       FLUXO PRINCIPAL
    ========================== */

    async function carregarDashboard() {
        const registros = await buscarRegistros();

        dashboardVazio.classList.toggle("oculto", registros.length > 0);

        const agg = calcularAgregados(registros);

        renderKPIs(agg);
        renderGraficoVolume(agg);
        renderGraficoSla(agg);
        renderGraficoTipo(agg);
        renderGraficoTempoSetor(agg);
        renderGraficoAsg(agg);
        renderGraficoRankingLeitos(agg);
    }

    (async function iniciar() {
        await carregarSetores();
        aplicarPeriodo("30dias");
        await carregarDashboard();
    })();

});
