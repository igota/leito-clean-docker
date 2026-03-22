from flask import Blueprint, jsonify
import logging
from ....scheduler.scheduler import scheduler
from ....database.conexao import get_db_connection

debug_bp = Blueprint('debug', __name__, url_prefix='/api/debug')
logger = logging.getLogger(__name__)

@debug_bp.route('/agendamentos', methods=['GET'])
def listar_agendamentos():
    """
    Retorna todos os agendamentos ativos no momento
    """
    try:
        # Agendamentos de vencimento
        vencimentos = []
        for limpeza_id, timer in scheduler.tarefas_agendadas.items():
            # Não temos acesso direto ao tempo restante, mas podemos estimar
            vencimentos.append({
                'tipo': 'vencimento',
                'limpeza_id': limpeza_id,
                'timer_activo': timer.is_alive() if hasattr(timer, 'is_alive') else True
            })
        
        # Alertas de 5,6,7 dias
        alertas = []
        for chave, timer in scheduler.alertas_agendados.items():
            limpeza_id, dias = chave.split('_')
            alertas.append({
                'tipo': 'alerta',
                'limpeza_id': int(limpeza_id),
                'dias': int(dias),
                'chave': chave,
                'timer_activo': timer.is_alive() if hasattr(timer, 'is_alive') else True
            })
        
        # Buscar informações do banco para complementar
        conn = get_db_connection()
        limpezas_info = {}
        try:
            with conn.cursor() as cursor:
                todos_ids = list(set([v['limpeza_id'] for v in vencimentos] + 
                                    [a['limpeza_id'] for a in alertas]))
                
                if todos_ids:
                    placeholders = ','.join(['%s'] * len(todos_ids))
                    cursor.execute(f"""
                        SELECT id, setor, numero_leito, status, vencimento, data_validacao
                        FROM registro_limpeza
                        WHERE id IN ({placeholders})
                    """, todos_ids)
                    
                    for row in cursor.fetchall():
                        limpezas_info[row['id']] = {
                            'setor': row['setor'],
                            'leito': row['numero_leito'],
                            'status': row['status'],
                            'vencimento': row['vencimento'].strftime('%Y-%m-%d %H:%M:%S') if row['vencimento'] else None,
                            'data_validacao': row['data_validacao'].strftime('%Y-%m-%d %H:%M:%S') if row['data_validacao'] else None
                        }
        finally:
            conn.close()
        
        # Montar resposta completa
        resposta = {
            'total_agendamentos': len(vencimentos) + len(alertas),
            'vencimentos': vencimentos,
            'alertas': alertas,
            'detalhes_limpezas': limpezas_info,
            'estatisticas': {
                'timers_vencimento': len(vencimentos),
                'timers_alerta': len(alertas),
                'total_limpezas_agendadas': len(set([v['limpeza_id'] for v in vencimentos] + 
                                                    [a['limpeza_id'] for a in alertas]))
            }
        }
        
        return jsonify(resposta)
        
    except Exception as e:
        logger.error(f"Erro ao listar agendamentos: {e}")
        return jsonify({'error': str(e)}), 500


@debug_bp.route('/agendamentos/<int:limpeza_id>', methods=['GET'])
def ver_agendamento_limpeza(limpeza_id):
    """
    Ver detalhes de agendamentos de uma limpeza específica
    """
    try:
        timers = []
        
        # Verificar vencimento
        if limpeza_id in scheduler.tarefas_agendadas:
            timers.append({
                'tipo': 'vencimento',
                'ativo': scheduler.tarefas_agendadas[limpeza_id].is_alive() if hasattr(scheduler.tarefas_agendadas[limpeza_id], 'is_alive') else True
            })
        
        # Verificar alertas
        for dias in [5,6,7]:
            chave = f"{limpeza_id}_{dias}"
            if chave in scheduler.alertas_agendados:
                timers.append({
                    'tipo': f'alerta_{dias}_dias',
                    'chave': chave,
                    'ativo': scheduler.alertas_agendados[chave].is_alive() if hasattr(scheduler.alertas_agendados[chave], 'is_alive') else True
                })
        
        return jsonify({
            'limpeza_id': limpeza_id,
            'timers_ativos': timers,
            'quantidade': len(timers)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500