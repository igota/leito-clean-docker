from datetime import datetime
import os
import threading
import time as time_module  # Renomeia o import para evitar conflitos
from flask import json
import logging
from ..services.integracao_vitae import buscar_ips_e_setores_ativos, login_e_buscar_leitos
from ..services.atualiza_pendentes import atualiza_pendentes
from ..config.settings import LEITOS_CACHE_FILE, INTERVALO_ATUALIZACAO
from ..database.conexao import get_db_connection


atualizar_leitos_lock = threading.Lock()


def _chave_extra(leito):
    numero = (leito.get("numero_leito") or "").strip()
    return (leito.get("setor"), numero)


def sincronizar_suspensao_extras(setores, leitos_atuais, leitos_anteriores):
    """
    Marca como SUSPENSO os leitos extras (numero_leito não numérico, ex.: "EXT01")
    que sumiram do PEP por 2 ciclos seguidos (ausentes tanto no snapshot atual
    quanto no anterior — evita suspender por uma falha passageira de scraping).

    SUSPENSO é terminal: não existe lógica de "retomar" no mesmo registro. O
    leito só volta a ser rastreado quando uma limpeza nova de fato acontecer
    (novo registro em registro_limpeza). vencimento nunca é alterado.
    """
    presentes_atual = {_chave_extra(l) for l in leitos_atuais}
    presentes_anterior = {_chave_extra(l) for l in leitos_anteriores}

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            for setor in setores:
                cursor.execute("""
                    SELECT r1.id, r1.numero_leito
                    FROM registro_limpeza r1
                    WHERE r1.setor = %s
                      AND r1.status IN ('CONCLUIDA', 'PENDENTE')
                      AND r1.numero_leito NOT REGEXP '^[0-9]+$'
                      AND r1.data_inicio = (
                          SELECT MAX(r2.data_inicio)
                          FROM registro_limpeza r2
                          WHERE r2.numero_leito = r1.numero_leito
                            AND r2.setor = r1.setor
                      )
                """, (setor,))

                for row in cursor.fetchall():
                    chave = (setor, row["numero_leito"])
                    if chave not in presentes_atual and chave not in presentes_anterior:
                        cursor.execute("""
                            UPDATE registro_limpeza
                            SET status = 'SUSPENSO', suspenso_desde = NOW()
                            WHERE id = %s
                        """, (row["id"],))
                        print(f"⏸️ Leito extra suspenso: {setor} - {row['numero_leito']} (registro {row['id']})")

        conn.commit()
    finally:
        conn.close()


def atualizar_leitos_por_ip_uma_vez():
    """Executa uma única rodada de coleta de leitos por IP e regrava o cache JSON.

    Chamador é responsável por serializar o acesso via `atualizar_leitos_lock`
    para evitar que a thread automática e uma chamada manual escrevam no mesmo
    arquivo .tmp ao mesmo tempo.
    """
    print("🔄 Iniciando atualização de leitos por IP...")

    # Cache da rodada anterior, usado só para confirmar (por 2 ciclos seguidos)
    # que um leito extra realmente sumiu antes de suspender seu registro.
    cache_anterior = {}
    if os.path.exists(LEITOS_CACHE_FILE):
        try:
            with open(LEITOS_CACHE_FILE, "r", encoding="utf-8") as f:
                cache_anterior = json.load(f)
        except Exception:
            logging.exception("Erro ao ler cache anterior para detecção de leitos suspensos")

    ips_setores = buscar_ips_e_setores_ativos()
    cache_final = {}

    for ip, setores in ips_setores.items():
        print(f"➡️ Coletando dados para IP {ip} | Setores: {setores}")

        dados = login_e_buscar_leitos(setores)

        if dados:
            # Só roda a detecção de suspensão quando o ciclo atual trouxe dado
            # de verdade — um retorno vazio pode ser falha de scraping (login
            # caiu, timeout), não leito ausente de verdade. Evita suspender
            # tudo de uma vez por causa de uma instabilidade temporária no PEP.
            try:
                leitos_anteriores = cache_anterior.get(ip, {}).get("leitos", [])
                sincronizar_suspensao_extras(setores, dados, leitos_anteriores)
            except Exception:
                logging.exception(f"Erro ao sincronizar suspensão de leitos extras para IP {ip}")

            cache_final[ip] = {
                "ultima_atualizacao": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "leitos": dados
            }
        else:
            print(f"⚠️ Nenhum dado retornado para IP {ip}")

    # 🔹 Escrita segura (arquivo temporário)
    tmp_file = LEITOS_CACHE_FILE + ".tmp"

    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(cache_final, f, ensure_ascii=False, indent=4)

    # 🔹 Substitui o arquivo antigo
    os.replace(tmp_file, LEITOS_CACHE_FILE)

    print("✅ JSON atualizado com sucesso!")
    return cache_final


def thread_atualizar_leitos_por_ip():
    while True:
        try:
            # Bloqueante: se uma chamada manual estiver em andamento, aguarda
            # ela terminar antes de rodar o próprio ciclo (evita escrita concorrente
            # no mesmo arquivo .tmp do cache).
            with atualizar_leitos_lock:
                atualizar_leitos_por_ip_uma_vez()
        except Exception as e:
            logging.error(f"❌ Erro na thread de atualização: {e}")

        print(f"⏳ Aguardando {INTERVALO_ATUALIZACAO}s para próxima execução...\n")
        time_module.sleep(INTERVALO_ATUALIZACAO)  # Usando o alias para evitar conflitos


def iniciar_threads():
    threads = [
        threading.Thread(target=thread_atualizar_leitos_por_ip, daemon=True),
        threading.Thread(target=atualiza_pendentes, daemon=True)
    ]

    for thread in threads:
        thread.start()

    print(f"🟢 {len(threads)} threads de background iniciadas")