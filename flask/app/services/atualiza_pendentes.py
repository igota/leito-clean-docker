
import time

from .notificacao_email import enviar_notificacoes_lote

from ..database.conexao import get_db_connection
from ..config.settings import INTERVALO_ATUALIZACAO


def atualiza_pendentes():
    while True:
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # =========================================================
                # VERIFICA LEITOS QUE DEVEM VIRAR PENDENTE (USANDO LEAD POR ID)
                # =========================================================
                cursor.execute("""
                    UPDATE registro_limpeza l
                    INNER JOIN (
                        SELECT 
                            id,
                            setor,
                            numero_leito,
                            data_validacao,
                            vencimento,
                            LEAD(data_validacao) OVER (
                                PARTITION BY setor, numero_leito
                                ORDER BY data_validacao, id
                            ) AS prox_validacao
                        FROM registro_limpeza
                        WHERE data_validacao IS NOT NULL
                    ) x ON x.id = l.id
                    SET l.status = 'PENDENTE'
                    WHERE 
                        l.status = 'CONCLUIDA'
                        AND l.vencimento <= NOW()
                        AND (
                            x.prox_validacao IS NULL
                            OR x.prox_validacao > l.vencimento
                        );
                """)
                
                pendentes_gerados = cursor.rowcount
                conn.commit()
                
                if pendentes_gerados > 0:
                    print(f"\n{'='*60}")
                    print(f"🔔 {pendentes_gerados} leito(s) viraram PENDENTE")

                    # 🔒 Reserva atômica dos leitos a notificar: SELECT ... FOR UPDATE
                    # dentro de uma transação explícita garante que, se mais de um
                    # processo rodar esse polling ao mesmo tempo (ex.: múltiplos
                    # workers do gunicorn), cada leito pendente só seja reservado
                    # por um processo só — evita e-mail duplicado pra equipe.
                    conn.begin()

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
                        WHERE rl.status = 'PENDENTE'
                          AND rl.email_enviado = 0
                        ORDER BY rl.setor, rl.numero_leito, rl.id
                        FOR UPDATE
                    """)

                    leitos_vencidos = cursor.fetchall()

                    if leitos_vencidos:
                        ids_reservados = [l['id'] for l in leitos_vencidos]
                        placeholders = ','.join(['%s'] * len(ids_reservados))
                        cursor.execute(
                            f"UPDATE registro_limpeza SET email_enviado = 1 WHERE id IN ({placeholders})",
                            ids_reservados
                        )

                    conn.commit()

                    for leito in leitos_vencidos:
                        print(f"\n   Leito: {leito['numero_leito']} - Setor: {leito['setor_nome']}")
                        print(f"   Última limpeza: {leito['data_validacao']}")
                        print(f"   Vencimento: {leito['vencimento']}")

                    if leitos_vencidos:
                        enviar_notificacoes_lote(leitos_vencidos)

                # =========================================================
                # ATUALIZA DIAS DE ALERTA
                # =========================================================
                cursor.execute("""
                    UPDATE registro_limpeza
                    SET dias_alerta = 5
                    WHERE status = 'CONCLUIDA'
                      AND data_validacao IS NOT NULL
                      AND NOW() >= DATE_ADD(data_validacao, INTERVAL 5 DAY)
                      AND NOW() < DATE_ADD(data_validacao, INTERVAL 6 DAY)
                      AND (dias_alerta IS NULL OR dias_alerta != 5)
                """)
                conn.commit()
                alerta_5dias = cursor.rowcount
                
                cursor.execute("""
                    UPDATE registro_limpeza
                    SET dias_alerta = 6
                    WHERE status = 'CONCLUIDA'
                      AND data_validacao IS NOT NULL
                      AND NOW() >= DATE_ADD(data_validacao, INTERVAL 6 DAY)
                      AND NOW() < DATE_ADD(data_validacao, INTERVAL 7 DAY)
                      AND (dias_alerta IS NULL OR dias_alerta != 6)
                """)
                conn.commit()
                alerta_6dias = cursor.rowcount
                
                cursor.execute("""
                    UPDATE registro_limpeza
                    SET dias_alerta = 7
                    WHERE status = 'CONCLUIDA'
                      AND data_validacao IS NOT NULL
                      AND NOW() >= DATE_ADD(data_validacao, INTERVAL 7 DAY)
                      AND NOW() < DATE_ADD(data_validacao, INTERVAL 8 DAY)
                      AND (dias_alerta IS NULL OR dias_alerta != 7)
                """)
                conn.commit()
                alerta_7dias = cursor.rowcount

                # =========================================================
                # LOG DE RESUMO
                # =========================================================
                if pendentes_gerados > 0 or alerta_5dias > 0 or alerta_6dias > 0 or alerta_7dias > 0:
                    print(f"\n📊 RESUMO DA ATUALIZAÇÃO:")
                    if pendentes_gerados > 0:
                        print(f"   🔔 Novos pendentes: {pendentes_gerados}")
                    if alerta_5dias > 0:
                        print(f"   🟡 Alerta 5 dias: {alerta_5dias}")
                    if alerta_6dias > 0:
                        print(f"   🟠 Alerta 6 dias: {alerta_6dias}")
                    if alerta_7dias > 0:
                        print(f"   🔴 Alerta 7 dias: {alerta_7dias}")
                    
                    # Notifica frontend
                    print("🔔 Notificando painel sobre atualizações...")

        except Exception as e:
            print(f"❌ Erro na atualização: {e}")
            import traceback
            traceback.print_exc()

        time.sleep(INTERVALO_ATUALIZACAO)
        



