"""
scheduler.py - Gerencia OS AGENDAMENTOS (quando e como executar as tarefas)
Controla os timers e chama as funções de tasks.py nos momentos certos
"""
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict
from ..database.conexao import get_db_connection
from .tasks import verificar_pendentes_por_vencimento, verificar_alerta_dias

logger = logging.getLogger(__name__)


class LimpezaScheduler:
    """
    GERENCIADOR: Controla os timers e agenda as execuções
    NÃO contém a lógica das tarefas, apenas QUANDO executá-las
    """
    
    def __init__(self):
        self.tarefas_agendadas: Dict[int, threading.Timer] = {}  # Para vencimentos
        self.alertas_agendados: Dict[str, threading.Timer] = {}  # Para alertas (chave: f"{limpeza_id}_{dias}")
        
    # ==================== VENCIMENTOS ====================
    
    def agendar_verificacao(self, limpeza_id: int, data_vencimento: datetime):
        """
        Agenda uma verificação para quando a limpeza vencer
        """
        # Cancela agendamento existente
        if limpeza_id in self.tarefas_agendadas:
            self.tarefas_agendadas[limpeza_id].cancel()
            
        agora = datetime.now()
        if data_vencimento <= agora:
            # Já venceu, executa imediatamente
            logger.info(f"⚡ Limpeza {limpeza_id} já vencida, executando agora...")
            threading.Thread(
                target=verificar_pendentes_por_vencimento,
                args=(limpeza_id,)
            ).start()
            return
            
        # Calcula tempo até o vencimento (+1 minuto)
        segundos_ate_vencimento = (data_vencimento - agora).total_seconds()
        segundos_para_verificar = segundos_ate_vencimento + 60
        
        logger.info(f"📅 Limpeza {limpeza_id} - Agendada para {data_vencimento + timedelta(minutes=1)}")
        
        timer = threading.Timer(
            segundos_para_verificar,
            self._executar_verificacao,
            args=[limpeza_id]
        )
        timer.daemon = True
        timer.start()
        
        self.tarefas_agendadas[limpeza_id] = timer
        
    def _executar_verificacao(self, limpeza_id: int):
        """
        Callback interno que executa a tarefa de vencimento
        """
        logger.info(f"🔔 Executando verificação agendada para limpeza {limpeza_id}")
        
        # Remove da lista de agendadas
        if limpeza_id in self.tarefas_agendadas:
            del self.tarefas_agendadas[limpeza_id]
            
        # Chama a TAREFA
        verificar_pendentes_por_vencimento(limpeza_id)
    
    # ==================== ALERTAS ====================
    
    def agendar_alerta(self, limpeza_id: int, data_alerta: datetime, dias: int):
        """
        Agenda um alerta para dias específicos (5, 6 ou 7)
        """
        chave = f"{limpeza_id}_{dias}"
        
        # Cancela alerta existente
        if chave in self.alertas_agendados:
            self.alertas_agendados[chave].cancel()
            
        agora = datetime.now()
        if data_alerta <= agora:
            # Já passou, verifica se é para executar agora
            logger.info(f"⚡ Alerta {dias} dias para limpeza {limpeza_id} já passou, verificando...")
            threading.Thread(
                target=self._executar_alerta,
                args=[limpeza_id, dias]
            ).start()
            return
            
        # Calcula tempo até o alerta
        segundos_ate_alerta = (data_alerta - agora).total_seconds()
        
        logger.info(f"📅 Alerta {dias} dias para limpeza {limpeza_id} agendado para {data_alerta.strftime('%d/%m/%Y %H:%M:%S')}")
        
        timer = threading.Timer(
            segundos_ate_alerta,
            self._executar_alerta,
            args=[limpeza_id, dias]
        )
        timer.daemon = True
        timer.start()
        
        self.alertas_agendados[chave] = timer
        
    def _executar_alerta(self, limpeza_id: int, dias: int):
        """
        Executa um alerta agendado
        """
        logger.info(f"🔔🔔🔔 EXECUTANDO ALERTA DE {dias} DIAS PARA LIMPEZA {limpeza_id} 🔔🔔🔔")
        
        # Remove da lista
        chave = f"{limpeza_id}_{dias}"
        if chave in self.alertas_agendados:
            del self.alertas_agendados[chave]
            
        # Chama a TAREFA específica para alerta
        verificar_alerta_dias(limpeza_id, dias)
    
    # ==================== CARREGAMENTO INICIAL ====================
    
    def carregar_agendamentos_existentes(self):
        """
        Carrega todas as limpezas ativas e agenda seus vencimentos
        """
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, vencimento
                    FROM registro_limpeza
                    WHERE status = 'CONCLUIDA'
                      AND vencimento > NOW()
                """)
                
                limpezas = cursor.fetchall()
                
                for limpeza in limpezas:
                    self.agendar_verificacao(
                        limpeza['id'],
                        limpeza['vencimento']
                    )
                    
                logger.info(f"✅ Carregados {len(limpezas)} agendamentos de vencimento do banco")
                
        except Exception as e:
            logger.error(f"❌ Erro ao carregar agendamentos: {e}")
        finally:
            conn.close()
            
    def carregar_alertas_existentes(self):
        """
        Carrega APENAS as limpezas MAIS RECENTES de cada leito
        """
        logger.info("📚 Carregando alertas apenas para limpezas mais recentes...")

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # Busca APENAS a limpeza mais recente de cada leito
                cursor.execute("""
                    SELECT rl.id, rl.data_validacao
                    FROM registro_limpeza rl
                    INNER JOIN (
                        SELECT setor, numero_leito, MAX(data_validacao) as max_data
                        FROM registro_limpeza
                        WHERE status = 'CONCLUIDA'
                        AND data_validacao IS NOT NULL
                        GROUP BY setor, numero_leito
                    ) ultima ON rl.setor = ultima.setor
                            AND rl.numero_leito = ultima.numero_leito
                            AND rl.data_validacao = ultima.max_data
                    WHERE rl.status = 'CONCLUIDA'
                """)

                limpezas = cursor.fetchall()
                total_alertas = 0
                atrasados = []

                for limpeza in limpezas:
                    limpeza_id = limpeza['id']
                    data_validacao = limpeza['data_validacao']

                    # Calcula quantos dias se passaram
                    dias_desde = (datetime.now() - data_validacao).days

                    # Para cada dia de alerta (5, 6, 7)
                    for dias in [5, 6, 7]:
                        data_alerta = data_validacao + timedelta(days=dias, minutes=1)

                        if dias_desde >= dias:
                            # Já passou do dia do alerta
                            if datetime.now() > data_alerta:
                                # ⚡ ALERTA ATRASADO! Marca para recuperar em sequência
                                atrasados.append((limpeza_id, dias))
                        else:
                            # Alerta futuro, agenda normalmente
                            if data_alerta > datetime.now():
                                self.agendar_alerta(limpeza_id, data_alerta, dias)
                                total_alertas += 1

                if atrasados:
                    # 🔴 Processa os atrasados em SEQUÊNCIA numa única thread, em vez de
                    # disparar uma thread por item — evitar rajada de dezenas de conexões
                    # simultâneas no pool do banco (maxconnections=20) competindo com
                    # requisições de usuário logo após o boot.
                    threading.Thread(
                        target=self._recuperar_atrasados_em_sequencia,
                        args=[atrasados],
                        daemon=True
                    ).start()

                logger.info(f"✅ {total_alertas} alertas futuros agendados, {len(atrasados)} alertas atrasados recuperados")

        except Exception as e:
            logger.error(f"❌ Erro ao carregar alertas: {e}")
        finally:
            conn.close()

    def _recuperar_atrasados_em_sequencia(self, atrasados):
        """
        Executa os alertas atrasados um de cada vez (mesma thread), para não
        esgotar o pool de conexões do banco com dezenas de threads simultâneas.
        """
        for limpeza_id, dias in atrasados:
            logger.info(f"⚡ Alerta {dias} dias atrasado para limpeza {limpeza_id}")
            try:
                verificar_alerta_dias(limpeza_id, dias)
            except Exception as e:
                logger.error(f"❌ Erro ao recuperar alerta atrasado (limpeza {limpeza_id}, {dias} dias): {e}")
    
    def iniciar(self):
        """
        Inicia o scheduler completo
        """
        logger.info("🚀 Iniciando Scheduler de Limpezas...")
        self.carregar_agendamentos_existentes()  # Vencimentos
        self.carregar_alertas_existentes()       # Alertas de dias
        
    def parar(self):
        """
        Para todos os agendamentos
        """
        logger.info("🛑 Parando Scheduler...")
        
        # Para vencimentos
        for limpeza_id, timer in self.tarefas_agendadas.items():
            timer.cancel()
        self.tarefas_agendadas.clear()
        
        # Para alertas
        for chave, timer in self.alertas_agendados.items():
            timer.cancel()
        self.alertas_agendados.clear()
        
    def cancelar_alertas_limpeza(self, limpeza_id: int):
        """
        Cancela TODOS os timers associados a uma limpeza específica
        (útil quando uma limpeza deixa de ser a mais recente)
        """
        logger.info(f"🛑 Cancelando todos os timers da limpeza {limpeza_id}")
        
        total = 0
        
        # Cancela timer de vencimento
        if limpeza_id in self.tarefas_agendadas:
            self.tarefas_agendadas[limpeza_id].cancel()
            del self.tarefas_agendadas[limpeza_id]
            total += 1
            logger.info(f"   ✅ Timer de vencimento cancelado")
        
        # Cancela alertas de 5, 6, 7 dias
        for dias in [5, 6, 7]:
            chave = f"{limpeza_id}_{dias}"
            if chave in self.alertas_agendados:
                self.alertas_agendados[chave].cancel()
                del self.alertas_agendados[chave]
                total += 1
                logger.info(f"   ✅ Alerta de {dias} dias cancelado")
        
        if total > 0:
            logger.info(f"🛑 Total de {total} timers cancelados para limpeza {limpeza_id}")
        
        return total    


# Instância única do scheduler
scheduler = LimpezaScheduler()


def agendar_nova_limpeza(limpeza_id: int, data_vencimento: datetime):
    """
    Função pública para agendar uma nova limpeza (vencimento)
    Chamada pelos endpoints da API
    """
    scheduler.agendar_verificacao(limpeza_id, data_vencimento)


def agendar_alertas_limpeza(limpeza_id: int, data_validacao: datetime):
    """
    Função pública para agendar alertas de 5, 6 e 7 dias
    Chamada quando uma limpeza é finalizada
    """
    for dias in [5, 6, 7]:
        data_alerta = data_validacao + timedelta(days=dias, minutes=1)
        scheduler.agendar_alerta(limpeza_id, data_alerta, dias)
    
    logger.info(f"📅 Alertas 5/6/7 dias agendados para limpeza {limpeza_id}")


def iniciar_scheduler():
    """
    Inicia o scheduler (chamado pelo app)
    """
    scheduler.iniciar()



def cancelar_alertas_limpeza_antiga(limpeza_id: int):
    """
    Função pública para cancelar timers de uma limpeza que não é mais a recente
    Chamada quando uma nova limpeza é registrada no mesmo leito
    """
    scheduler.cancelar_alertas_limpeza(limpeza_id) 

def diagnosticar_limpeza(self, limpeza_id):
    """
    Diagnostico completo de uma limpeza
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, setor, numero_leito, status, 
                       data_validacao, vencimento, dias_alerta
                FROM registro_limpeza
                WHERE id = %s
            """, (limpeza_id,))
            
            dados_banco = cursor.fetchone()
            
            timers = {
                'vencimento': limpeza_id in self.tarefas_agendadas,
                'alertas': []
            }
            
            for dias in [5,6,7]:
                chave = f"{limpeza_id}_{dias}"
                timers['alertas'].append({
                    'dias': dias,
                    'ativo': chave in self.alertas_agendados
                })
            
            return {
                'banco': dados_banco,
                'timers': timers,
                'consistente': self._verificar_consistencia(limpeza_id, dados_banco, timers)
            }
    finally:
        conn.close()

def _verificar_consistencia(self, limpeza_id, dados_banco, timers):
    """Verifica se banco e timers estão consistentes"""
    if not dados_banco:
        return False
    
    # Se está PENDENTE, não deveria ter timers
    if dados_banco['status'] == 'PENDENTE':
        if timers['vencimento'] or any(a['ativo'] for a in timers['alertas']):
            logger.warning(f"⚠️ INCONSISTÊNCIA: Limpeza {limpeza_id} PENDENTE mas tem timers ativos!")
            return False
    
    # Se está CONCLUIDA e já passou do vencimento, deveria ter virado PENDENTE
    if dados_banco['status'] == 'CONCLUIDA' and dados_banco['vencimento']:
        if dados_banco['vencimento'] <= datetime.now():
            logger.warning(f"⚠️ INCONSISTÊNCIA: Limpeza {limpeza_id} CONCLUIDA mas vencida!")
            return False
    
    return True    