from flask import Blueprint, request, jsonify  
from datetime import datetime, timedelta
import os
import json
import logging
from ....config.settings import (
    LEITOS_CACHE_FILE,
    atualizacao_evento,
    TEMPO_MINIMO_LIMPEZA_PADRAO,
    TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO,
)
from ....database.conexao import get_db_connection
from ....utils.helpers import get_client_ip
from ....events.redis_events import publicar_evento

# 👇 CRIAR O BLUEPRINT
mobile_api_bp = Blueprint('mobile_api', __name__)


# ==================== FUNÇÕES AUXILIARES ====================

@mobile_api_bp.route("/teste-ip")
def teste_ip():

    print("REMOTE_ADDR:", request.remote_addr)
    print("X_REAL_IP:", request.headers.get("X-Real-IP"))
    print("X_FORWARDED_FOR:", request.headers.get("X-Forwarded-For"))

    return "ok"

def encontrar_limpeza_antiga(setor, numero_leito):
    """Busca o ID da limpeza mais recente antes da nova (que será substituída)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id
                FROM registro_limpeza
                WHERE setor = %s
                  AND numero_leito = %s
                  AND status = 'CONCLUIDA'
                ORDER BY data_validacao DESC
                LIMIT 1
            """, (setor, numero_leito))
            
            resultado = cursor.fetchone()
            return resultado['id'] if resultado else None
    except Exception as e:
        logging.error(f"Erro ao buscar limpeza antiga: {e}")
        return None
    finally:
        conn.close()


# ==================== ROTAS ====================

@mobile_api_bp.route("/api/carregar_leitos", methods=['GET'])
def carregar_leitos():
    try:
        ip = get_client_ip()

        # 🔹 Setores CONFIGURADOS para este IP (fonte de verdade: banco de dados).
        # Não deriva mais dos dados capturados de pacientes, pois setores sem
        # nenhum paciente no momento (ex.: Centro Cirúrgico quando só há RPA
        # GERAL/SPA GERAL, que são descartados na captura) ficariam de fora.
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT s.nome
                    FROM setores s
                    JOIN dispositivos d ON s.id_dispositivo = d.id
                    WHERE d.ip = %s AND d.status = TRUE AND s.status = TRUE
                    ORDER BY s.nome
                """, (ip,))
                setores = [row["nome"] for row in cursor.fetchall()]
        finally:
            conn.close()

        if not setores:
            return jsonify({
                "status": "erro",
                "mensagem": f"Nenhum setor configurado para o IP {ip}"
            }), 404

        # 🔹 Abre o JSON gerado pela thread apenas para obter o horário da última atualização
        ultima_atualizacao = None
        try:
            with open(LEITOS_CACHE_FILE, "r", encoding="utf-8") as f:
                cache = json.load(f)
            ultima_atualizacao = cache.get(ip, {}).get("ultima_atualizacao")
        except FileNotFoundError:
            pass

        return jsonify({
            "status": "ok",
            "setores": setores,
            "ultima_atualizacao": ultima_atualizacao
        })

    except Exception as e:
        logging.error(f"Erro em /carregar_leitos: {e}")
        return jsonify({
            "status": "erro",
            "mensagem": str(e)
        }), 500


@mobile_api_bp.route("/api/limpeza_ativa_por_ip", methods=['GET'])
def limpeza_ativa_por_ip():
    ip = get_client_ip()
    
    print(f"[LOG] IP detectado: {ip}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    r.id,
                    r.setor,
                    r.numero_leito,
                    r.tipo_limpeza,
                    r.data_inicio,
                    r.status,
                    r.intervalo_liberado,
                    CASE
                        WHEN r.asg_intervalo IS NOT NULL AND r.asg_intervalo != r.funcionario_asg_id
                        THEN CONCAT(f.nome, ' / ', f_int.nome)
                        ELSE f.nome
                    END as funcionario_asg,
                    TIMESTAMPDIFF(SECOND, r.data_inicio, NOW()) AS segundos_decorridos
                FROM registro_limpeza r
                LEFT JOIN funcionarios f ON r.funcionario_asg_id = f.id
                LEFT JOIN funcionarios f_int ON r.asg_intervalo = f_int.id
                WHERE r.ip_dispositivo = %s
                  AND r.status IN ('EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO')
                ORDER BY r.data_inicio ASC
                LIMIT 2
            """, (ip,))

            limpezas = cursor.fetchall()
            
            print(f"[LOG] Limpezas encontradas: {len(limpezas)}")

            resultado = []
            for l in limpezas:
                item = dict(l)
                if isinstance(item.get("data_inicio"), datetime):
                    item["data_inicio"] = item["data_inicio"].strftime("%Y-%m-%d %H:%M:%S")
                resultado.append(item)

            return jsonify({
                "existe": bool(resultado),
                "limpezas": resultado
            })

    finally:
        conn.close()


@mobile_api_bp.route("/api/get_leitos_por_setor", methods=['GET'])
def get_leitos_por_setor():
    setor = request.args.get("setor")
    ip_cliente = get_client_ip()

    logging.info(f"➡️ IP do cliente: {ip_cliente}")
    logging.info(f"➡️ Setor solicitado: {setor}")

    if not setor:
        return jsonify({
            "status": "erro",
            "mensagem": "Setor não informado"
        }), 400

    # Busca qtd_leitos no banco
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT s.qtd_leitos
                FROM setores s
                JOIN dispositivos d ON s.id_dispositivo = d.id
                WHERE d.ip = %s
                AND s.nome = %s
                AND d.status = TRUE
                AND s.status = TRUE
                LIMIT 1
            """, (ip_cliente, setor))

            row = cursor.fetchone()
        conn.close()

        if not row or row["qtd_leitos"] is None:
            return jsonify({
                "status": "erro",
                "mensagem": "Quantidade de leitos não configurada para este setor"
            }), 404

        total_fixos = int(row["qtd_leitos"])

    except Exception:
        logging.exception("Erro ao buscar qtd_leitos em dispositivos")
        return jsonify({
            "status": "erro",
            "mensagem": "Erro ao consultar configuração de leitos"
        }), 500

    # Carrega cache de leitos
    caminho_json = LEITOS_CACHE_FILE

    if not os.path.exists(caminho_json):
        logging.error(f"❌ JSON não encontrado: {caminho_json}")
        return jsonify({
            "status": "erro",
            "mensagem": "Dados não disponíveis"
        }), 404

    try:
        with open(caminho_json, "r", encoding="utf-8") as f:
            dados = json.load(f)
    except json.JSONDecodeError as e:
        logging.error(f"JSON inválido: {e}")
        return jsonify({
            "status": "erro",
            "mensagem": "Formato de dados inválido"
        }), 500
    except Exception:
        logging.exception("Erro ao ler JSON de cache")
        return jsonify({
            "status": "erro",
            "mensagem": "Erro ao ler dados"
        }), 500

    dados_ip = dados.get(ip_cliente)

    if not dados_ip:
        return jsonify({
            "status": "erro",
            "mensagem": "Nenhum dado encontrado para este dispositivo"
        }), 404

    leitos_setor = [
        l for l in dados_ip.get("leitos", [])
        if l.get("setor") == setor
    ]

    logging.info(f"📦 Registros no setor '{setor}': {len(leitos_setor)}")

    # Busca leitos pendentes no banco
    leitos_pendentes = set()
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT numero_leito
                FROM registro_limpeza r1
                WHERE setor = %s
                AND data_inicio = (
                    SELECT MAX(data_inicio)
                    FROM registro_limpeza r2
                    WHERE r2.numero_leito = r1.numero_leito
                        AND r2.setor = r1.setor
                )
                AND status = 'PENDENTE'
            """, (setor,))
            
            for row in cursor.fetchall():
                leitos_pendentes.add(row["numero_leito"])
        conn.close()
        logging.info(f"🔴 Leitos pendentes no setor {setor}: {leitos_pendentes}")
    except Exception:
        logging.exception("Erro ao buscar leitos pendentes")

    # Separa leitos fixos e extras
    leitos_fixos_ocupados = []
    leitos_extras = []
    todos_leitos_processados = []

    for l in leitos_setor:
        numero_leito = (l.get("numero_leito") or "").strip()
        tem_paciente = bool(l.get("paciente"))

        if numero_leito in leitos_pendentes:
            icone = "vermelho"
            status = "pendente"
        elif tem_paciente:
            icone = "amarelo"
            status = "ocupado"
        else:
            icone = "verde"
            status = "livre"

        leito_processado = {
            "numero_str": numero_leito,
            "paciente": l.get("paciente"),
            "icone": icone,
            "status": status,
            "dados": l
        }
        todos_leitos_processados.append(leito_processado)

        if numero_leito.isdigit():
            leito_processado["numero_int"] = int(numero_leito)
            leitos_fixos_ocupados.append(leito_processado)
        else:
            leitos_extras.append(leito_processado)

    # Lógica de preenchimento
    # qtd_leitos configurada = SOMENTE fixos. Extras não contam para essa meta
    # e são sempre exibidos além dos fixos (nunca "roubam vaga" nem viram excedente).
    resultado = []

    logging.info(f"📊 Leitos existentes: fixos reais: {len(leitos_fixos_ocupados)}, extras: {len(leitos_extras)}")

    leitos_fixos_por_numero = {item["numero_int"]: item for item in leitos_fixos_ocupados}

    # Sempre exibe 1..total_fixos; se o PEP retornar um fixo numérico acima de
    # total_fixos (configuração desatualizada), ele também é incluído em vez de descartado.
    numeros_fixos_a_exibir = sorted(set(range(1, total_fixos + 1)) | set(leitos_fixos_por_numero.keys()))

    for numero_atual in numeros_fixos_a_exibir:
        fixo = leitos_fixos_por_numero.get(numero_atual)
        if fixo:
            resultado.append({
                "numero_leito": fixo["numero_str"],
                "setor": setor,
                "tipo": "fixo",
                "status": fixo["status"],
                "icone": fixo["icone"],
                "paciente": fixo["paciente"]
            })
        else:
            # Leito fixo sem dado no PEP: cria virtual livre (ou pendente, se aplicável)
            numero_str = str(numero_atual).zfill(2)
            if numero_str in leitos_pendentes:
                icone = "vermelho"
                status = "pendente"
            else:
                icone = "verde"
                status = "livre"

            resultado.append({
                "numero_leito": numero_str,
                "setor": setor,
                "tipo": "fixo",
                "status": status,
                "icone": icone,
                "paciente": None
            })

    # Extras: sempre todos, sempre depois dos fixos
    for extra in leitos_extras:
        resultado.append({
            "numero_leito": extra["numero_str"],
            "setor": setor,
            "tipo": "extra",
            "status": extra["status"],
            "icone": extra["icone"],
            "paciente": extra["paciente"]
        })

    # Ordenação final
    resultado.sort(key=lambda x: (
        0 if x["tipo"] == "fixo" else 1,
        int(x["numero_leito"]) if x["numero_leito"].isdigit() else 99999,
        x["numero_leito"]
    ))

    # Contagem de pendentes
    pendentes_no_setor = len([l for l in todos_leitos_processados 
                            if l["numero_str"] in leitos_pendentes])
    
    pendentes_nos_leitos_virtuais = len([l for l in resultado 
                                       if l["status"] == "pendente" and l["paciente"] is None])
    
    total_pendentes_real = pendentes_no_setor + pendentes_nos_leitos_virtuais
    
    ocupados_com_paciente = len([l for l in todos_leitos_processados if l["paciente"]])
    pendentes_com_paciente = len([l for l in todos_leitos_processados 
                                 if l["paciente"] and l["numero_str"] in leitos_pendentes])
    pendentes_sem_paciente = len([l for l in todos_leitos_processados 
                                 if not l["paciente"] and l["numero_str"] in leitos_pendentes])

    logging.info(f"📊 Total leitos retornados: {len(resultado)}")
    logging.info(f"🔴 Total pendentes REAL: {total_pendentes_real}")

    fixos_no_resultado = [l for l in resultado if l["tipo"] == "fixo"]
    livres_fixos = len([l for l in fixos_no_resultado if l["status"] == "livre"])

    return jsonify({
        "status": "ok",
        "configuracao": {
            "total_fixos": total_fixos,
            "ocupados": len(fixos_no_resultado) - livres_fixos,
            "livres": livres_fixos,
            "extras": len(leitos_extras),
            "pendentes": total_pendentes_real,
            "pendentes_com_paciente": pendentes_com_paciente,
            "pendentes_sem_paciente": pendentes_sem_paciente + pendentes_nos_leitos_virtuais
        },
        "leitos": resultado
    })


@mobile_api_bp.route('/api/verificar_funcionarios', methods=['POST'])
def verificar_funcionarios():
    dados = request.json
    id_cartao = dados.get("id_cartao")
    tipo = dados.get("tipo")

    if not id_cartao or not tipo:
        return jsonify({"erro": "id_cartao ou tipo não informados"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT nome FROM funcionarios
                WHERE id_cartao = %s AND tipo = %s AND status = 1
            """, (id_cartao, tipo))
            funcionarios = cursor.fetchone()

        conn.close()

        if funcionarios:
            return jsonify({"sucesso": True, "nome": funcionarios['nome']})
        else:
            return jsonify({"sucesso": False, "erro": "Funcionário não encontrado ou inativo"})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@mobile_api_bp.route("/api/limpeza/aguardando_validacao", methods=["POST"])
def limpeza_aguardando_validacao():
    dados = request.json
    id_limpeza = dados.get("id_limpeza")
    id_cartao_asg = dados.get("id_cartao_asg")

    if not id_limpeza:
        return jsonify({"erro": "ID da limpeza obrigatório"}), 400

    if not id_cartao_asg:
        return jsonify({"erro": "Cartão do ASG obrigatório"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Busca a limpeza para verificar o tempo e o ASG responsável
            cursor.execute("""
                SELECT data_inicio, status, setor, numero_leito, funcionario_asg_id, intervalo_liberado
                FROM registro_limpeza
                WHERE id = %s
            """, (id_limpeza,))

            limpeza = cursor.fetchone()

            if not limpeza:
                return jsonify({"erro": "Limpeza não encontrada"}), 404

            if limpeza["status"] != "EM_ANDAMENTO":
                return jsonify({"erro": "Limpeza não está em andamento"}), 400

            setor = limpeza["setor"]
            leito = limpeza["numero_leito"]

            # 🔒 Apenas o ASG que iniciou a limpeza pode finalizá-la
            # (a menos que o Intervalo Almoço/Janta tenha sido liberado para este registro)
            cursor.execute("""
                SELECT id FROM funcionarios
                WHERE id_cartao = %s AND status = 1
                LIMIT 1
            """, (id_cartao_asg,))

            funcionario_asg = cursor.fetchone()

            if not funcionario_asg:
                return jsonify({"erro": "Funcionário ASG não encontrado ou inativo"}), 400

            if not limpeza["intervalo_liberado"] and funcionario_asg["id"] != limpeza["funcionario_asg_id"]:
                return jsonify({
                    "erro": "ASG_INVALIDO",
                    "mensagem": "Apenas o ASG que iniciou a limpeza pode finalizá-la."
                }), 403

            # ⏱️ Verifica se já passou o tempo mínimo (configurável via .env: TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO / TEMPO_MINIMO_LIMPEZA_PADRAO)
            data_inicio = limpeza["data_inicio"]
            agora = datetime.now()
            minutos_decorridos = (agora - data_inicio).total_seconds() / 60

            setor_norm = (setor or "").strip().upper()
            eh_centro_cirurgico = "CENTRO CIRURGICO" in setor_norm or "CENTRO CIRÚRGICO" in setor_norm
            tempo_minimo = TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO if eh_centro_cirurgico else TEMPO_MINIMO_LIMPEZA_PADRAO

            if minutos_decorridos < tempo_minimo:
                minutos_faltantes = round(tempo_minimo - minutos_decorridos, 1)
                return jsonify({
                    "erro": "TEMPO_MINIMO_NAO_ATINGIDO",
                    "mensagem": f"Tempo mínimo: {tempo_minimo} minutos",
                    "tempo_minimo": tempo_minimo,
                    "minutos_decorridos": round(minutos_decorridos, 1),
                    "minutos_faltantes": minutos_faltantes
                }), 400

            # Se passou da validação, prossegue com a atualização
            # (id_cartao_intervalo/asg_intervalo registram quem efetivamente finalizou,
            # que pode ser diferente de funcionario_asg_id quando o Intervalo foi liberado)
            cursor.execute("""
                UPDATE registro_limpeza
                SET status = 'AGUARDANDO_VALIDACAO',
                    data_fim = NOW(),
                    id_cartao_intervalo = %s,
                    asg_intervalo = %s
                WHERE id = %s
                  AND status = 'EM_ANDAMENTO'
            """, (id_cartao_asg, funcionario_asg["id"], id_limpeza))

            if cursor.rowcount == 0:
                return jsonify({"erro": "Limpeza não encontrada ou status inválido"}), 404

        conn.commit()

        atualizacao_evento.set()

        publicar_evento('limpeza_aguardando_validacao', {
            'id': id_limpeza,
            'setor': setor,
            'leito': leito,
            'minutos_decorridos': round(minutos_decorridos, 1),
            'timestamp': datetime.now().isoformat()
        })

        return jsonify({
            "mensagem": "Limpeza finalizada (aguardando validação)",
            "minutos_decorridos": round(minutos_decorridos, 1)
        })

    except Exception as e:
        conn.rollback()
        print(f"❌ ERRO em limpeza_aguardando_validacao: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@mobile_api_bp.route("/api/limpeza/ativar_intervalo", methods=["POST"])
def ativar_intervalo_limpeza():
    dados = request.json
    id_limpeza = dados.get("id_limpeza")
    id_cartao_asg = dados.get("id_cartao_asg")

    if not id_limpeza:
        return jsonify({"erro": "ID da limpeza obrigatório"}), 400

    if not id_cartao_asg:
        return jsonify({"erro": "Cartão do ASG obrigatório"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT status, funcionario_asg_id
                FROM registro_limpeza
                WHERE id = %s
            """, (id_limpeza,))

            limpeza = cursor.fetchone()

            if not limpeza:
                return jsonify({"erro": "Limpeza não encontrada"}), 404

            if limpeza["status"] != "EM_ANDAMENTO":
                return jsonify({"erro": "Limpeza não está em andamento"}), 400

            # 🔒 Apenas o ASG que iniciou a limpeza pode ativar o Intervalo
            cursor.execute("""
                SELECT id FROM funcionarios
                WHERE id_cartao = %s AND status = 1
                LIMIT 1
            """, (id_cartao_asg,))

            funcionario_asg = cursor.fetchone()

            if not funcionario_asg:
                return jsonify({"erro": "Funcionário ASG não encontrado ou inativo"}), 400

            if funcionario_asg["id"] != limpeza["funcionario_asg_id"]:
                return jsonify({
                    "erro": "INTERVALO_ASG_INVALIDO",
                    "mensagem": "Apenas o ASG que iniciou a limpeza pode ativar o Intervalo."
                }), 403

            cursor.execute("""
                UPDATE registro_limpeza
                SET intervalo_liberado = 1
                WHERE id = %s
                  AND status = 'EM_ANDAMENTO'
            """, (id_limpeza,))

            if cursor.rowcount == 0:
                return jsonify({"erro": "Limpeza não encontrada ou status inválido"}), 404

        conn.commit()
        atualizacao_evento.set()
        return jsonify({"mensagem": "Intervalo liberado com sucesso"})

    except Exception as e:
        conn.rollback()
        print(f"❌ ERRO em ativar_intervalo_limpeza: {e}")
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@mobile_api_bp.route('/api/registrar_limpeza', methods=['POST'])
def registrar_limpeza():
    dados = request.json
    print("📩 Dados recebidos:", dados)

    ip_dispositivo = get_client_ip()
    print("📡 IP do dispositivo:", ip_dispositivo)

    id_limpeza = dados.get("id_limpeza")

    # Início
    id_cartao_asg = dados.get("id_cartao_asg")

    # Finalização
    id_cartao_enf = dados.get("id_cartao_enf")

    leito = dados.get("leito", {})
    numero_leito = leito.get("numero_leito")
    setor = leito.get("setor")
    paciente = leito.get("paciente")

    tipo_limpeza = dados.get("tipo_limpeza")
    
    # Dados de tempo da requisição
    tempo_total_seconds = dados.get("tempo_total_seconds")
    tempo_total_text = dados.get("tempo_total_text")

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:

            # =============================
            # 🔹 INÍCIO DA LIMPEZA
            # =============================
            if not id_cartao_enf:

                if not numero_leito or not tipo_limpeza:
                    return jsonify({
                        "erro": "Número do leito e tipo de limpeza são obrigatórios"
                    }), 400

                cursor.execute("""
                    SELECT COUNT(*) AS total
                    FROM registro_limpeza
                    WHERE ip_dispositivo = %s
                      AND status = 'EM_ANDAMENTO'
                """, (ip_dispositivo,))

                total = cursor.fetchone()["total"]

                if total >= 2:
                    return jsonify({
                        "erro": "LIMITE_ATINGIDO",
                        "mensagem": "Este tablet já possui 2 limpezas em andamento."
                    }), 400

                # Buscar o funcionario_asg_id baseado no cartão
                cursor.execute("""
                    SELECT id FROM funcionarios
                    WHERE id_cartao = %s AND status = 1
                    LIMIT 1
                """, (id_cartao_asg,))

                funcionario = cursor.fetchone()

                if not funcionario:
                    return jsonify({
                        "erro": "Funcionário ASG não encontrado ou inativo"
                    }), 400

                funcionario_asg_id = funcionario['id']

                # Tratar paciente null/vazio
                if not paciente or paciente.strip() == "":
                    paciente_para_inserir = "S/P"
                else:
                    paciente_para_inserir = paciente

                cursor.execute("""
                    INSERT INTO registro_limpeza (
                        id_cartao_asg,
                        funcionario_asg_id,
                        ip_dispositivo,
                        numero_leito,
                        paciente,
                        setor,
                        tipo_limpeza,
                        status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'EM_ANDAMENTO')
                """, (
                    id_cartao_asg,
                    funcionario_asg_id,
                    ip_dispositivo,
                    numero_leito,
                    paciente_para_inserir,
                    setor,
                    tipo_limpeza
                ))

                id_gerado = cursor.lastrowid
                conn.commit()

              
                atualizacao_evento.set()
                
                from ....events.redis_events import publicar_evento
                from datetime import datetime
                
                publicar_evento('limpeza_iniciada', {
                    'id': id_gerado,
                    'setor': setor,
                    'leito': numero_leito,
                    'asg': id_cartao_asg,
                    'ip': ip_dispositivo,
                    'timestamp': datetime.now().isoformat()
                })

                return jsonify({
                    "mensagem": "Limpeza iniciada com sucesso!",
                    "id_limpeza": id_gerado
                })

            # =============================
            # 🔹 FINALIZAÇÃO (VALIDAÇÃO DO ENFERMEIRO)
            # =============================
            else:
                if not id_limpeza:
                    return jsonify({
                        "erro": "ID da limpeza é obrigatório para finalizar"
                    }), 400

                data_validacao = datetime.now()

                # Buscar funcionario_enf_id baseado no cartão
                cursor.execute("""
                    SELECT id FROM funcionarios
                    WHERE id_cartao = %s AND status = 1
                    LIMIT 1
                """, (id_cartao_enf,))

                funcionario_enf = cursor.fetchone()

                if not funcionario_enf:
                    return jsonify({
                        "erro": "Funcionário Enfermeiro não encontrado ou inativo"
                    }), 400

                funcionario_enf_id = funcionario_enf['id']

                # Busca os dados completos da limpeza (incluindo setor/leito)
                cursor.execute("""
                    SELECT tipo_limpeza, data_fim, setor, numero_leito
                    FROM registro_limpeza
                    WHERE id = %s
                """, (id_limpeza,))
                row = cursor.fetchone()

                if not row:
                    return jsonify({"erro": "Limpeza não encontrada"}), 404

                tipo_limpeza_db = row["tipo_limpeza"] or ""
                tipo_norm = tipo_limpeza_db.strip().upper()
                data_fim = row["data_fim"]
                setor = row["setor"]
                leito = row["numero_leito"]
                setor_norm = (setor or "").strip().upper()

                if not data_fim:
                    return jsonify({
                        "erro": "Data de fim não encontrada. Finalize primeiro a limpeza."
                    }), 400

                print("🧪 tipo_limpeza banco:", repr(tipo_limpeza_db))
                print(f"📅 Data fim original: {data_fim}")
                print(f"📅 Data validação: {data_validacao}")

                # ============================================================
                # 🔥 REGRA DE VENCIMENTO:
                # - Aplica para: ALTA/ÓBITO/TRANSFERÊNCIA, LONGA PERMANÊNCIA (demais setores)
                #   ou PROGRAMADA/EXTRA (Centro Cirúrgico)
                # - CENTRO CIRÚRGICO: vence em 1 dia
                # - Demais setores: vence em 8 dias
                # ============================================================
                vencimento = None
                tipos_com_vencimento = (
                    "ALTA / ÓBITO / TRANSFERÊNCIA", "LONGA PERMANÊNCIA", "LONGA PERMANENCIA",
                    "PROGRAMADA", "EXTRA"
                )

                if tipo_norm in tipos_com_vencimento:
                    if "CENTRO CIRURGICO" in setor_norm or "CENTRO CIRÚRGICO" in setor_norm:
                        vencimento = data_validacao + timedelta(days=1)
                    else:
                        vencimento = data_validacao + timedelta(days=8)

                # UPDATE finalizando (com as duas colunas: id_cartao_enf + funcionario_enf_id)
                cursor.execute("""
                    UPDATE registro_limpeza
                    SET id_cartao_enf = %s,
                        funcionario_enf_id = %s,
                        data_validacao = %s,
                        tempo_total_seconds = %s,
                        tempo_total_text = %s,
                        status = 'CONCLUIDA',
                        vencimento = %s
                    WHERE id = %s
                    AND status = 'AGUARDANDO_VALIDACAO'
                """, (
                    id_cartao_enf,
                    funcionario_enf_id,
                    data_validacao,
                    tempo_total_seconds,
                    tempo_total_text,
                    vencimento,
                    id_limpeza
                ))

                if cursor.rowcount == 0:
                    return jsonify({
                        "erro": "Limpeza não encontrada em AGUARDANDO_VALIDACAO"
                    }), 404

                conn.commit()

                atualizacao_evento.set()
                
               
                
                publicar_evento('limpeza_finalizada', {
                    'id': id_limpeza,
                    'setor': setor,
                    'leito': leito,
                    'tipo_limpeza': tipo_limpeza_db,
                    'enf': id_cartao_enf,
                    'vencimento': vencimento.isoformat() if vencimento else None,
                    'timestamp': datetime.now().isoformat()
                })

                return jsonify({
                    "mensagem": "Limpeza validada com sucesso!",
                    "id_limpeza": id_limpeza,
                    "vencimento": vencimento.strftime("%Y-%m-%d %H:%M:%S") if vencimento else None
                })

    except Exception as e:
        conn.rollback()
        print("❌ ERRO:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()

@mobile_api_bp.route("/api/verificar_limpeza_ativa", methods=["POST"])
def verificar_limpeza_ativa():
    data = request.get_json()
    leito = data.get("leito")
    ip = get_client_ip()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT 1
                FROM registro_limpeza
                WHERE setor = %s
                  AND numero_leito = %s
                 AND status IN ('EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO')
                LIMIT 1
            """, (leito["setor"], leito["numero_leito"]))

            if cursor.fetchone():
                return jsonify({
                    "limpeza_ativa": True,
                    "motivo": "LEITO_OCUPADO",
                    "mensagem": "Este leito já possui uma limpeza em andamento."
                })

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM registro_limpeza
                WHERE ip_dispositivo = %s
                  AND status IN ('EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO')
            """, (ip,))

            total = cursor.fetchone()["total"]

            if total >= 2:
                return jsonify({
                    "limpeza_ativa": True,
                    "motivo": "LIMITE_TABLET",
                    "mensagem": "Este dispositivo já possui 2 limpezas em andamento."
                })

            return jsonify({
                "limpeza_ativa": False,
                "mensagem": "Limpeza liberada para início."
            })

    finally:
        conn.close()


@mobile_api_bp.route("/api/verificar_limpeza_funcionario", methods=["POST"])
def verificar_limpeza_funcionario():
    data = request.get_json()
    id_cartao = data.get("id_cartao")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:

            # Resolve o funcionario_id atual baseado no cartão
            cursor.execute("""
                SELECT id FROM funcionarios
                WHERE id_cartao = %s AND status = 1
            """, (id_cartao,))

            funcionario = cursor.fetchone()

            if not funcionario:
                return jsonify({
                    "limpeza_ativa": False,
                    "mensagem": "Funcionário não encontrado ou inativo."
                })

            cursor.execute("""
                SELECT 1
                FROM registro_limpeza
                WHERE (funcionario_asg_id = %s
                       OR funcionario_enf_id = %s
                       OR funcionario_tec_id = %s)
                  AND status IN ('EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO')
                LIMIT 1
            """, (funcionario['id'], funcionario['id'], funcionario['id']))

            if cursor.fetchone():
                return jsonify({
                    "limpeza_ativa": True,
                    "motivo": "FUNCIONARIO_OCUPADO",
                    "mensagem": "Este funcionário já está envolvido em uma limpeza em andamento."
                })
            
            return jsonify({
                "limpeza_ativa": False,
                "mensagem": "Funcionário liberado para nova limpeza."
            })
            
    except Exception as e:
        print(f"Erro ao verificar limpeza do funcionário: {e}")
        return jsonify({
            "limpeza_ativa": False,
            "mensagem": "Erro na verificação, permitindo continuar."
        }), 500
    finally:
        conn.close()