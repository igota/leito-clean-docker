import logging
from venv import logger

from flask import Blueprint, request, jsonify, session
import pymysql
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
from ....config.settings import atualizacao_evento
from ....scheduler.scheduler import agendar_nova_limpeza, agendar_alertas_limpeza, cancelar_alertas_limpeza_antiga
from ....events.redis_events import publicar_evento  
import traceback
from datetime import datetime

# Criar o blueprint
limpezas_bp = Blueprint('limpezas', __name__)

# ==================== FUNÇÕES AUXILIARES ====================

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
@limpezas_bp.route('/api/pesquisar_limpezas', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def pesquisar_limpezas():
    data = request.get_json()
    setor = data.get('setor')
    leito = data.get('leito')
    modo = data.get('modo')  # 🔥 NOVO FILTRO

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:

            query = """
                SELECT 
                    rl.id,
                    rl.setor,
                    rl.numero_leito,
                    rl.paciente,
                    rl.tipo_limpeza,
                    rl.data_inicio,
                    rl.data_fim,
                    rl.data_validacao,
                    rl.vencimento,
                    rl.tempo_total_text,
                    rl.modo_registro,
                    rl.status,
                    asg.nome as funcionario_asg,
                    enf.nome as funcionario_enf,
                    tec.nome as funcionario_tec
                FROM registro_limpeza rl
                LEFT JOIN funcionarios asg ON rl.id_cartao_asg = asg.id_cartao
                LEFT JOIN funcionarios enf ON rl.id_cartao_enf = enf.id_cartao
                LEFT JOIN funcionarios tec ON rl.id_cartao_tec = tec.id_cartao
                WHERE 1=1
            """
            params = []

            # Filtro por setor
            if setor and setor != "TODOS":
                query += " AND rl.setor = %s"
                params.append(setor)

            # Filtro por leito
            if leito and leito != "TODOS":
                query += " AND rl.numero_leito = %s"
                params.append(leito)

            # 🔥 NOVO: Filtro por modo de registro
            if modo and modo != "TODOS":
                query += " AND rl.modo_registro = %s"
                params.append(modo)

            query += " ORDER BY rl.data_inicio DESC"

            cursor.execute(query, tuple(params))
            resultados = cursor.fetchall()

            # Converter datas para string ISO
            for r in resultados:
                for campo in ['data_inicio', 'data_fim', 'data_validacao', 'vencimento']:
                    if r.get(campo):
                        r[campo] = r[campo].isoformat()

            print(f"🔍 Encontradas {len(resultados)} limpezas (filtro modo: {modo})")
            return jsonify(resultados)

    except Exception as e:
        print(f"❌ Erro em pesquisar_limpezas: {e}")
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()

@limpezas_bp.route('/api/nova_limpeza_manual', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def nova_limpeza_manual():
    data = request.get_json()
    
    # Extrair dados
    setor = data.get('setor')
    leito = data.get('leito')
    tipo_limpeza = data.get('tipo_limpeza')
    paciente = data.get('paciente')
    id_cartao_asg = data.get('id_cartao_asg')
    id_cartao_enf = data.get('id_cartao_enf')
    data_inicio = data.get('data_inicio')
    data_fim = data.get('data_fim')
    data_validacao = data.get('data_validacao')
    vencimento = data.get('vencimento') 
    tempo_total_text = data.get('tempo_total_text')
    status = data.get('status', 'CONCLUIDA')

    conn = get_db_connection()
    try:
        # Buscar IP
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT d.ip 
                FROM setores s
                INNER JOIN dispositivos d ON s.id_dispositivo = d.id
                WHERE s.nome = %s AND s.status = TRUE AND d.status = TRUE
            """, (setor,))
            
            resultado = cursor.fetchone()
            
            if not resultado:
                return jsonify({"success": False, "error": "Setor não encontrado ou sem dispositivo ativo"})

            ip_dispositivo = resultado['ip']

        # ===== FUNÇÃO PARSE ISO CORRIGIDA =====
        def parse_iso(data_str):
            if not data_str:
                return None
            
            # Formato MySQL (YYYY-MM-DD HH:MM:SS)
            if ' ' in data_str and len(data_str) == 19:
                return datetime.strptime(data_str, '%Y-%m-%d %H:%M:%S')
            
            # Remove timezone
            data_limpa = data_str
            
            # Remove Z
            if data_limpa.endswith('Z'):
                data_limpa = data_limpa[:-1]
            
            # Remove timezone positivo (+00:00)
            if '+' in data_limpa:
                data_limpa = data_limpa.split('+')[0]
            
            # Remove timezone negativo se for depois da posição 19
            if len(data_limpa) > 19 and '-' in data_limpa[19:]:
                data_limpa = data_limpa[:19]
            
            # Tenta parse
            try:
                if ' ' in data_limpa:
                    return datetime.strptime(data_limpa, '%Y-%m-%d %H:%M:%S')
                elif 'T' in data_limpa:
                    return datetime.strptime(data_limpa, '%Y-%m-%dT%H:%M:%S')
                else:
                    return datetime.strptime(data_limpa, '%Y-%m-%d %H:%M:%S')
            except Exception as e:
                logger.error(f"❌ Erro ao parsear '{data_limpa}': {e}")
                return None

        # Converter as datas
        data_inicio_dt = parse_iso(data_inicio)
        data_fim_dt = parse_iso(data_fim)
        data_validacao_dt = parse_iso(data_validacao)
        vencimento_dt = parse_iso(vencimento)

        # 👇 ANTES DE INSERIR A NOVA, CANCELA OS TIMERS DA LIMPEZA ANTIGA
        limpeza_antiga_id = encontrar_limpeza_antiga(setor, leito)
        
        if limpeza_antiga_id:
            logger.info(f"🔄 Encontrada limpeza antiga {limpeza_antiga_id} para cancelar")
            cancelar_alertas_limpeza_antiga(limpeza_antiga_id)

        # Inserir limpeza
        with conn.cursor() as cursor:
            sql = """
                INSERT INTO registro_limpeza (
                    id_cartao_asg, id_cartao_enf, numero_leito, setor, paciente,
                    tipo_limpeza, data_inicio, data_fim, data_validacao, vencimento,
                    tempo_total_text, ip_dispositivo, status, modo_registro
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'MANUAL')
            """
            
            params = (
                id_cartao_asg, id_cartao_enf, leito, setor, paciente,
                tipo_limpeza, data_inicio_dt, data_fim_dt, data_validacao_dt, vencimento_dt,
                tempo_total_text, ip_dispositivo, status
            )
            
            cursor.execute(sql, params)
            limpeza_id = cursor.lastrowid

            # 👇 AGENDAR TIMERS PARA A NOVA LIMPEZA
            if vencimento_dt:
                agendar_nova_limpeza(limpeza_id, vencimento_dt)
                logger.info(f"📅 Limpeza manual {limpeza_id} agendada para vencimento em {vencimento_dt}")
            
            if data_validacao_dt:
                agendar_alertas_limpeza(limpeza_id, data_validacao_dt)
                logger.info(f"📅 Alertas 5/6/7 dias agendados para limpeza {limpeza_id}")
            
            # ===== EVENTOS =====
           
            atualizacao_evento.set()
            

            
            publicar_evento('nova_limpeza_manual', {
                'id': limpeza_id,
                'setor': setor,
                'leito': leito,
                'tipo_limpeza': tipo_limpeza,
                'status': status,
                'vencimento': vencimento_dt.isoformat() if vencimento_dt else None,
                'timestamp': datetime.now().isoformat()
            })
            
            # Se cancelou uma limpeza antiga, publicar evento também
            if limpeza_antiga_id:
                publicar_evento('limpeza_antiga_cancelada', {
                    'id_antiga': limpeza_antiga_id,
                    'id_nova': limpeza_id,
                    'setor': setor,
                    'leito': leito,
                    'timestamp': datetime.now().isoformat()
                })
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "id": limpeza_id,
                "message": "Limpeza registrada e agendada com sucesso!"
            })
            
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Erro ao registrar limpeza manual: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        conn.close()

@limpezas_bp.route('/api/limpeza/<int:id>', methods=['GET'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def get_limpeza(id):
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    rl.id,
                    rl.setor,
                    rl.numero_leito,
                    rl.paciente,
                    rl.tipo_limpeza,
                    rl.data_inicio,
                    rl.data_fim,
                    rl.data_validacao,
                    rl.vencimento,
                    rl.tempo_total_text,
                    rl.status,
                    rl.id_cartao_asg,
                    rl.id_cartao_enf,
                    asg.nome as nome_asg,
                    enf.nome as nome_enf
                FROM registro_limpeza rl
                LEFT JOIN funcionarios asg ON rl.id_cartao_asg = asg.id_cartao
                LEFT JOIN funcionarios enf ON rl.id_cartao_enf = enf.id_cartao
                WHERE rl.id = %s
            """, (id,))
            
            limpeza = cursor.fetchone()
            
            if not limpeza:
                return jsonify({"error": "Limpeza não encontrada"}), 404
            
            # Converter datas para string ISO
            for campo in ['data_inicio', 'data_fim', 'data_validacao', 'vencimento']:
                if limpeza.get(campo):
                    limpeza[campo] = limpeza[campo].isoformat()
            
            return jsonify(limpeza)
            
    except Exception as e:
        print(f"❌ Erro ao buscar limpeza: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@limpezas_bp.route('/api/atualizar_limpeza', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def atualizar_limpeza():
    data = request.get_json()
    
    id = data.get('id')
    setor = data.get('setor')
    leito = data.get('leito')
    tipo_limpeza = data.get('tipo_limpeza')
    status = data.get('status')
    id_cartao_asg = data.get('id_cartao_asg')
    id_cartao_enf = data.get('id_cartao_enf')
    paciente = data.get('paciente')
    data_inicio = data.get('data_inicio')
    data_fim = data.get('data_fim')
    data_validacao = data.get('data_validacao')
    vencimento = data.get('vencimento')  
    tempo_total_text = data.get('tempo_total_text')
    
    if not id:
        return jsonify({"success": False, "error": "ID não fornecido"}), 400

    conn = get_db_connection()
    try:
        # Guardar valores originais para o evento
        valores_originais = {}
        
        with conn.cursor() as cursor:
            
            # ===== FUNÇÃO PARSE ISO CORRIGIDA =====
            def parse_iso(data_str):
                if not data_str:
                    return None
                
                print(f"📅 Data recebida: {data_str}")
                
                # Formato MySQL (YYYY-MM-DD HH:MM:SS)
                if ' ' in data_str and len(data_str) == 19:
                    return datetime.strptime(data_str, '%Y-%m-%d %H:%M:%S')
                
                # Remove timezone
                data_limpa = data_str
                
                # Remove Z
                if data_limpa.endswith('Z'):
                    data_limpa = data_limpa[:-1]
                
                # Remove timezone positivo (+00:00)
                if '+' in data_limpa:
                    data_limpa = data_limpa.split('+')[0]
                
                # Remove timezone negativo se for depois da posição 19
                if len(data_limpa) > 19 and '-' in data_limpa[19:]:
                    data_limpa = data_limpa[:19]
                
                # Tenta parse
                try:
                    if ' ' in data_limpa:
                        return datetime.strptime(data_limpa, '%Y-%m-%d %H:%M:%S')
                    elif 'T' in data_limpa:
                        return datetime.strptime(data_limpa, '%Y-%m-%dT%H:%M:%S')
                    else:
                        return datetime.strptime(data_limpa, '%Y-%m-%d %H:%M:%S')
                except Exception as e:
                    logger.error(f"❌ Erro ao parsear '{data_limpa}': {e}")
                    return None
            
            # Converter as datas
            data_inicio_dt = parse_iso(data_inicio)
            data_fim_dt = parse_iso(data_fim)
            data_validacao_dt = parse_iso(data_validacao)
            vencimento_dt = parse_iso(vencimento)  
            
            print(f"📅 Datas convertidas:")
            print(f"   Início: {data_inicio_dt}")
            print(f"   Fim: {data_fim_dt}")
            print(f"   Validação: {data_validacao_dt}")
            print(f"   Vencimento: {vencimento_dt}")
            
            # ===== BUSCAR DADOS ORIGINAIS PARA O EVENTO =====
            cursor.execute("""
                SELECT setor, numero_leito, status, vencimento, data_validacao
                FROM registro_limpeza
                WHERE id = %s
            """, (id,))
            original = cursor.fetchone()
            if original:
                valores_originais = {
                    'setor': original['setor'],
                    'leito': original['numero_leito'],
                    'status': original['status'],
                    'vencimento': original['vencimento'].isoformat() if original['vencimento'] else None,
                    'data_validacao': original['data_validacao'].isoformat() if original['data_validacao'] else None
                }
            
            # ===== PASSO 1: CANCELA TIMERS ATUAIS =====
            logger.info(f"🔄 Cancelando timers atuais da limpeza {id} antes de atualizar")
            cancelar_alertas_limpeza_antiga(id)
            
            # ===== PASSO 2: ATUALIZA O BANCO (RESETA DIAS_ALERTA) =====
            cursor.execute("""
                UPDATE registro_limpeza
                SET setor = %s,
                    numero_leito = %s,
                    tipo_limpeza = %s,
                    status = %s,
                    id_cartao_asg = %s,
                    id_cartao_enf = %s,
                    paciente = %s,
                    data_inicio = %s,
                    data_fim = %s,
                    data_validacao = %s,
                    vencimento = %s,  
                    tempo_total_text = %s,
                    dias_alerta = NULL
                WHERE id = %s
            """, (
                setor, leito, tipo_limpeza, status, 
                id_cartao_asg, id_cartao_enf, paciente,
                data_inicio_dt, data_fim_dt, data_validacao_dt,
                vencimento_dt,  
                tempo_total_text, id
            ))
            
            conn.commit()
            
            # ===== PASSO 3: VERIFICA DIRETO (SEM SLEEP) =====
            cursor.execute("""
                SELECT 
                    rl.status,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM registro_limpeza rl2
                        WHERE rl2.setor = rl.setor 
                          AND rl2.numero_leito = rl.numero_leito 
                          AND rl2.data_validacao > rl.data_validacao
                          AND rl2.id != rl.id
                    ) THEN 1 ELSE 0 END as tem_mais_recente
                FROM registro_limpeza rl
                WHERE rl.id = %s
            """, (id,))
            
            resultado = cursor.fetchone()
            
            if not resultado:
                logger.warning(f"⚠️ Limpeza {id} não encontrada após atualização")
                return jsonify({"success": False, "error": "Limpeza não encontrada"}), 404
            
            status_atual = resultado['status']
            tem_mais_recente = resultado['tem_mais_recente']
            
            logger.info(f"🔍 Status atual: {status_atual}, Tem mais recente: {tem_mais_recente}")
            
            # ===== PASSO 4: SÓ REAGENDA SE FOR CONCLUIDA E MAIS RECENTE =====
            reagendou = False
            if status_atual == 'CONCLUIDA' and not tem_mais_recente:
                timers_agendados = 0
                
                if vencimento_dt:
                    agendar_nova_limpeza(id, vencimento_dt)
                    logger.info(f"📅 Limpeza {id} reagendada para vencimento (é a mais recente)")
                    timers_agendados += 1
                    reagendou = True
                
                if data_validacao_dt:
                    agendar_alertas_limpeza(id, data_validacao_dt)
                    logger.info(f"📅 Alertas 5/6/7 dias reagendados para limpeza {id} (é a mais recente)")
                    timers_agendados += 3
                    reagendou = True
                
                logger.info(f"✅ Total de {timers_agendados} timers reagendados")
            elif status_atual == 'CONCLUIDA' and tem_mais_recente:
                logger.info(f"⏭️ Limpeza {id} CONCLUIDA mas NÃO é mais a recente - não reagendando")
            else:
                logger.info(f"⏭️ Limpeza {id} com status '{status_atual}' - não reagendando timers")
            
            
            
            # Determinar quais campos foram alterados
            alteracoes = []
            if valores_originais.get('setor') != setor:
                alteracoes.append('setor')
            if valores_originais.get('leito') != leito:
                alteracoes.append('leito')
            if valores_originais.get('status') != status_atual:
                alteracoes.append(f"status: {valores_originais.get('status')} → {status_atual}")
            if vencimento_dt and valores_originais.get('vencimento') != vencimento_dt.isoformat():
                alteracoes.append('vencimento')
            
            publicar_evento('limpeza_atualizada', {
                'id': id,
                'setor': setor,
                'leito': leito,
                'status': status_atual,
                'alteracoes': alteracoes,
                'reagendou': reagendou,
                'timestamp': datetime.now().isoformat()
            })
            
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Nenhum registro atualizado"}), 404
            
            return jsonify({
                "success": True,
                "message": "Limpeza atualizada com sucesso!",
                "reagendou": reagendou,
                "status": status_atual
            })
            
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Erro ao atualizar limpeza: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


@limpezas_bp.route('/api/listar_limpezas', methods=['GET'])
@tipo_required('ADMIN', 'GERENTE','NAO_CADASTRADO','INATIVO')
@login_required 
def listar_limpezas():
    
    # 🔥 FORÇA HEADERS ANTI-CACHE
    response = jsonify([])  # Placeholder
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    response.headers['X-Accel-Expires'] = '0'
    
    setor = request.args.get("setor")
    conn = get_db_connection()
    
    try:
        with conn.cursor() as cursor:
            if setor:
                # 🔥 COM FILTRO DE SETOR ESPECÍFICO
                cursor.execute("""
                    SELECT 
                        rl.numero_leito, 
                        rl.setor, 
                        rl.paciente, 
                        rl.status, 
                        rl.tipo_limpeza,
                        asg.nome as funcionario_asg,
                        enf.nome as funcionario_enf,
                        rl.tempo_total_text, 
                        rl.data_validacao, 
                        rl.dias_alerta,
                        CASE 
                            WHEN j.id IS NOT NULL AND j.data_criacao > rl.data_inicio THEN TRUE 
                            ELSE FALSE 
                        END as tem_justificativa
                    FROM registro_limpeza rl
                    -- 🔥 JOIN com setores para filtrar apenas ativos
                    INNER JOIN setores s ON rl.setor = s.nome AND s.status = TRUE
                    LEFT JOIN funcionarios asg ON rl.id_cartao_asg = asg.id_cartao
                    LEFT JOIN funcionarios enf ON rl.id_cartao_enf = enf.id_cartao
                    -- 🔥 Subquery para pegar a última justificativa de cada leito
                    LEFT JOIN (
                        SELECT j1.* 
                        FROM justificativas j1
                        INNER JOIN (
                            SELECT setor, leito, MAX(data_atualizacao) as max_data
                            FROM justificativas
                            GROUP BY setor, leito
                        ) j2 ON j1.setor = j2.setor 
                            AND j1.leito = j2.leito 
                            AND j1.data_atualizacao = j2.max_data
                    ) j ON rl.setor = j.setor COLLATE utf8mb4_0900_ai_ci 
                        AND rl.numero_leito = j.leito COLLATE utf8mb4_0900_ai_ci
                    -- 🔥 CORREÇÃO: Pegar o registro MAIS RECENTE baseado na DATA DE INÍCIO
                    WHERE (rl.setor, rl.numero_leito, rl.data_inicio) IN (
                        SELECT setor, numero_leito, MAX(data_inicio)
                        FROM registro_limpeza rl2
                        WHERE rl2.setor = %s
                        GROUP BY rl2.numero_leito
                    )
                    ORDER BY rl.numero_leito ASC
                """, (setor,))
            else:
                # 🔥 SEM FILTRO DE SETOR (TODOS)
                cursor.execute("""
                    SELECT 
                        rl.numero_leito, 
                        rl.setor, 
                        rl.paciente, 
                        rl.status, 
                        rl.tipo_limpeza,
                        asg.nome as funcionario_asg,
                        enf.nome as funcionario_enf,
                        rl.tempo_total_text,
                        rl.data_validacao, 
                        rl.dias_alerta,
                        CASE 
                            WHEN j.id IS NOT NULL AND j.data_criacao > rl.data_inicio THEN TRUE 
                            ELSE FALSE 
                        END as tem_justificativa
                    FROM registro_limpeza rl
                    -- 🔥 JOIN com setores para filtrar apenas ativos
                    INNER JOIN setores s ON rl.setor = s.nome AND s.status = TRUE
                    LEFT JOIN funcionarios asg ON rl.id_cartao_asg = asg.id_cartao
                    LEFT JOIN funcionarios enf ON rl.id_cartao_enf = enf.id_cartao
                    -- 🔥 Subquery para pegar a última justificativa de cada leito
                    LEFT JOIN (
                        SELECT j1.* 
                        FROM justificativas j1
                        INNER JOIN (
                            SELECT setor, leito, MAX(data_atualizacao) as max_data
                            FROM justificativas
                            GROUP BY setor, leito
                        ) j2 ON j1.setor = j2.setor 
                            AND j1.leito = j2.leito 
                            AND j1.data_atualizacao = j2.max_data
                    ) j ON rl.setor = j.setor COLLATE utf8mb4_0900_ai_ci 
                        AND rl.numero_leito = j.leito COLLATE utf8mb4_0900_ai_ci
                    -- 🔥 CORREÇÃO: Pegar o registro MAIS RECENTE baseado na DATA DE INÍCIO
                    WHERE (rl.setor, rl.numero_leito, rl.data_inicio) IN (
                        SELECT setor, numero_leito, MAX(data_inicio)
                        FROM registro_limpeza rl2
                        GROUP BY setor, numero_leito
                    )
                    ORDER BY rl.setor ASC, rl.numero_leito ASC
                """)
            
            dados = cursor.fetchall()
            
            limpezas = []
            for row in dados:
                if hasattr(row, 'keys'):
                    limpeza = dict(row)
                    if limpeza.get('data_validacao'):
                        limpeza['data_validacao'] = limpeza['data_validacao'].isoformat()
                    limpeza['tem_justificativa'] = bool(limpeza.get('tem_justificativa', False))
                else:
                    limpeza = {
                        'numero_leito': row[0],
                        'setor': row[1],
                        'paciente': row[2],
                        'status': row[3],
                        'tipo_limpeza': row[4],
                        'funcionario_asg': row[5],
                        'funcionario_enf': row[6],
                        'tempo_total_text': row[7],
                        'data_validacao': row[8].isoformat() if row[8] else None,
                        'dias_alerta': row[9] if len(row) > 9 else None,
                        'tem_justificativa': bool(row[10]) if len(row) > 10 else False
                    }
                limpezas.append(limpeza)
            
            response = jsonify(limpezas)
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            response.headers['X-Accel-Expires'] = '0'
            
            return response
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        return jsonify([])
        
    finally:
        conn.close()