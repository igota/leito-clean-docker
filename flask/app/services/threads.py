from datetime import datetime
import threading
import time as time_module  # Renomeia o import para evitar conflitos
from flask import json
import logging
from ..services.integracao_vitae import buscar_ips_e_setores_ativos, login_e_buscar_leitos
from ..services.atualiza_pendentes import atualiza_pendentes
from ..config.settings import LEITOS_CACHE_FILE, INTERVALO_ATUALIZACAO


def thread_atualizar_leitos_por_ip():
    while True:
        print("🔄 Iniciando atualização de leitos por IP...")

        try:
            ips_setores = buscar_ips_e_setores_ativos()
            cache_final = {}

            for ip, setores in ips_setores.items():
                print(f"➡️ Coletando dados para IP {ip} | Setores: {setores}")

                dados = login_e_buscar_leitos(setores)

                if dados:
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
            import os
            os.replace(tmp_file, LEITOS_CACHE_FILE)

            print("✅ JSON atualizado com sucesso!")

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