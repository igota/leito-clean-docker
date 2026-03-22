import json
import threading
import logging
from app.config.settings import SESSION_REDIS

logger = logging.getLogger(__name__)

def iniciar_keyspace_listener():
    def escutar_expiracoes():
        try:
            pubsub = SESSION_REDIS.pubsub()
            
            # 🔥 Escuta expiração de chaves no DB 1 (ajuste se necessário)
            pubsub.psubscribe('__keyevent@1__:expired')

            logger.info("👂 Escutando expiração de sessões no Redis...")

            for mensagem in pubsub.listen():
                if mensagem['type'] == 'pmessage':
                    chave = mensagem['data']

                    if isinstance(chave, bytes):
                        chave = chave.decode()

                    # 🔥 Filtra só sessões
                    if chave.startswith('sessao:'):
                        session_id = chave.split(':')[1]

                        logger.info(f"⛔ Sessão expirou (Redis): {session_id}")

                        # 🔥 Dispara evento SSE
                        SESSION_REDIS.publish("logout", json.dumps({
                            "tipo": "logout",
                            "session_id": session_id,
                            "motivo": "Sua sessão expirou por tempo de inatividade."
                        }))

        except Exception as e:
            logger.error(f"❌ Erro no listener Redis: {e}")

    # 🔥 Thread separada (não trava Flask)
    thread = threading.Thread(target=escutar_expiracoes, daemon=True)
    thread.start()