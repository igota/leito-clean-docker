"""
tasks.py - Contém APENAS as funções que executam as tarefas
(Consultas SQL, atualizações, notificações)
"""
import logging
from datetime import datetime
from ..database.conexao import get_db_connection
from ..services.notificacao_email import enviar_notificacoes_lote
from ..config.settings import atualizacao_evento
from ..events.redis_events import publicar_evento 

logger = logging.getLogger(__name__)

def verificar_pendentes_por_vencimento(limpeza_id=None):
    """
    TAREFA: Verifica leitos que devem se tornar pendentes
    """
    leito_info_para_notificar = None

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if limpeza_id:
                logger.info(f"🔍 Verificando limpeza específica {limpeza_id}")
                
                # Primeiro, busca dados completos (setor, leito para o evento)
                cursor.execute("""
                    SELECT status, vencimento, setor, numero_leito
                    FROM registro_limpeza
                    WHERE id = %s
                """, (limpeza_id,))
                
                atual = cursor.fetchone()
                if not atual:
                    return 0
                
                setor = atual['setor']
                leito = atual['numero_leito']
                
                logger.info(f"   Status atual: {atual['status']}, Vencimento: {atual['vencimento']}")
                
                # Se já está pendente, não faz nada
                if atual['status'] == 'PENDENTE':
                    logger.info(f"   Limpeza {limpeza_id} já está PENDENTE")
                    return 0
                
                # Verifica se há limpeza mais recente
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM registro_limpeza 
                    WHERE setor = %s
                      AND numero_leito = %s
                      AND data_validacao > (SELECT data_validacao FROM registro_limpeza WHERE id = %s)
                """, (setor, leito, limpeza_id))
                
                tem_mais_recente = cursor.fetchone()['count'] > 0
                
                if tem_mais_recente:
                    logger.info(f"   Limpeza {limpeza_id} tem registro mais recente")
                    return 0
                
                # Verifica se venceu
                if atual['vencimento'] and atual['vencimento'] <= datetime.now():
                    # Executa o UPDATE
                    cursor.execute("""
                        UPDATE registro_limpeza
                        SET status = 'PENDENTE'
                        WHERE id = %s
                          AND status = 'CONCLUIDA'
                          AND vencimento <= NOW()
                    """, (limpeza_id,))
                    
                    afetados = cursor.rowcount
                    conn.commit()
                    
                    if afetados > 0:
                        logger.info(f"🔔 Limpeza {limpeza_id} alterada para PENDENTE")
                        
                        # 🔥 CONFIRMA QUE O STATUS MUDOU NO BANCO
                        cursor.execute("SELECT status FROM registro_limpeza WHERE id = %s", (limpeza_id,))
                        novo_status = cursor.fetchone()['status']
                        logger.info(f"   ✅ Status no banco após UPDATE: {novo_status}")
                        
                        # ===== EVENTOS =====
                        # Evento local
                        atualizacao_evento.set()
                        
                        # Evento Redis
                        publicar_evento('limpeza_vencida', {
                            'id': limpeza_id,
                            'setor': setor,
                            'leito': leito,
                            'status_anterior': 'CONCLUIDA',
                            'status_novo': 'PENDENTE',
                            'vencimento': atual['vencimento'].isoformat() if atual['vencimento'] else None,
                            'timestamp': datetime.now().isoformat()
                        })
                        
                        # Notificações
                        cursor.execute("""
                            SELECT 
                                rl.id, 
                                rl.numero_leito, 
                                rl.setor as setor_nome,
                                rl.data_validacao, 
                                rl.vencimento,
                                s.id as setor_id
                            FROM registro_limpeza rl
                            LEFT JOIN setores s ON s.nome = rl.setor
                            WHERE rl.id = %s
                        """, (limpeza_id,))
                        
                        leito_info_para_notificar = cursor.fetchone()
                    else:
                        logger.info(f"   Nenhuma alteração - limpeza {limpeza_id} não atende critérios")

                    return afetados
                else:
                    logger.info(f"   Limpeza {limpeza_id} ainda não venceu")
                    return 0
    except Exception as e:
        logger.error(f"❌ Erro: {e}")
        conn.rollback()
        return 0
    finally:
        conn.close()

        # 🔴 Envia a notificação só DEPOIS de liberar a conexão do banco —
        # o envio de email é síncrono (SMTP) e pode levar segundos; não faz
        # sentido prender uma vaga do pool (maxconnections=20) durante isso.
        if leito_info_para_notificar:
            enviar_notificacoes_lote([leito_info_para_notificar])


def verificar_alerta_dias(limpeza_id: int, dias: int):
    """
    TAREFA: Verifica e atualiza o alerta para uma limpeza específica
    SOMENTE se ainda estiver CONCLUIDA
    """
    logger.info(f"🔍 Verificando alerta de {dias} dias para limpeza {limpeza_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Primeiro verifica o status ATUAL (incluindo setor/leito)
            cursor.execute("""
                SELECT status, setor, numero_leito
                FROM registro_limpeza
                WHERE id = %s
            """, (limpeza_id,))
            
            resultado = cursor.fetchone()
            if not resultado:
                logger.warning(f"⚠️ Limpeza {limpeza_id} não encontrada")
                return 0
            
            setor = resultado['setor']
            leito = resultado['numero_leito']
            
            # 🔥 SÓ CONTINUA SE AINDA ESTIVER CONCLUIDA!
            if resultado['status'] != 'CONCLUIDA':
                logger.info(f"⏭️ Limpeza {limpeza_id} não está mais CONCLUIDA (status={resultado['status']}) - ignorando alerta")
                
                # Auto-cancela este timer específico
                from .scheduler import scheduler
                chave = f"{limpeza_id}_{dias}"
                
                if chave in scheduler.alertas_agendados:
                    scheduler.alertas_agendados[chave].cancel()
                    del scheduler.alertas_agendados[chave]
                    logger.info(f"   ✅ Timer do alerta {dias} dias cancelado do scheduler")
                
                return 0
            
            # Verifica se é a mais recente
            cursor.execute("""
                SELECT 1 FROM registro_limpeza 
                WHERE setor = %s
                  AND numero_leito = %s
                  AND data_validacao > (SELECT data_validacao FROM registro_limpeza WHERE id = %s)
                LIMIT 1
            """, (setor, leito, limpeza_id))
            
            if cursor.fetchone():
                logger.info(f"⏭️ Limpeza {limpeza_id} não é a mais recente - ignorando alerta")
                return 0
            
            # Atualiza o alerta
            cursor.execute("""
                UPDATE registro_limpeza
                SET dias_alerta = %s
                WHERE id = %s
                  AND (dias_alerta IS NULL OR dias_alerta < %s)
            """, (dias, limpeza_id, dias))
            
            afetados = cursor.rowcount
            conn.commit()
            
            if afetados > 0:
                logger.info(f"✅ Alerta {dias} dias atualizado para limpeza {limpeza_id}")
                
                # ===== EVENTOS =====
                atualizacao_evento.set()
                
                publicar_evento('alerta_dias_atualizado', {
                    'id': limpeza_id,
                    'setor': setor,
                    'leito': leito,
                    'dias': dias,
                    'timestamp': datetime.now().isoformat()
                })
            
            return afetados
            
    except Exception as e:
        logger.error(f"❌ Erro ao verificar alerta: {e}")
        conn.rollback()
        return 0
    finally:
        conn.close()


def atualizar_dias_alerta():
    """
    TAREFA: Função de fallback para atualizar dias de alerta
    Mantida para compatibilidade, mas não é mais usada como principal
    """
    logger.info("⚠️ Função atualizar_dias_alerta chamada (fallback)")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Alerta 5 dias
            cursor.execute("""
                UPDATE registro_limpeza
                SET dias_alerta = 5
                WHERE status = 'CONCLUIDA'
                  AND data_validacao IS NOT NULL
                  AND NOW() >= DATE_ADD(data_validacao, INTERVAL 5 DAY)
                  AND NOW() < DATE_ADD(data_validacao, INTERVAL 6 DAY)
                  AND (dias_alerta IS NULL OR dias_alerta != 5)
            """)
            alerta_5dias = cursor.rowcount
            
            # Alerta 6 dias
            cursor.execute("""
                UPDATE registro_limpeza
                SET dias_alerta = 6
                WHERE status = 'CONCLUIDA'
                  AND data_validacao IS NOT NULL
                  AND NOW() >= DATE_ADD(data_validacao, INTERVAL 6 DAY)
                  AND NOW() < DATE_ADD(data_validacao, INTERVAL 7 DAY)
                  AND (dias_alerta IS NULL OR dias_alerta != 6)
            """)
            alerta_6dias = cursor.rowcount
            
            # Alerta 7 dias
            cursor.execute("""
                UPDATE registro_limpeza
                SET dias_alerta = 7
                WHERE status = 'CONCLUIDA'
                  AND data_validacao IS NOT NULL
                  AND NOW() >= DATE_ADD(data_validacao, INTERVAL 7 DAY)
                  AND NOW() < DATE_ADD(data_validacao, INTERVAL 8 DAY)
                  AND (dias_alerta IS NULL OR dias_alerta != 7)
            """)
            alerta_7dias = cursor.rowcount
            
            conn.commit()
            
            if alerta_5dias > 0 or alerta_6dias > 0 or alerta_7dias > 0:
                logger.info(f"📊 Alertas atualizados (fallback): 5d:{alerta_5dias} 6d:{alerta_6dias} 7d:{alerta_7dias}")
                
                # ===== EVENTOS =====
                atualizacao_evento.set()
                
                publicar_evento('alertas_fallback_atualizados', {
                    'alerta_5dias': alerta_5dias,
                    'alerta_6dias': alerta_6dias,
                    'alerta_7dias': alerta_7dias,
                    'timestamp': datetime.now().isoformat()
                })
                
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar dias de alerta: {e}")
        conn.rollback()
    finally:
        conn.close()