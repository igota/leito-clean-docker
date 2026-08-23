import json
from ..config.settings import redis_client


def publicar_evento(evento, dados):
    mensagem = {
        "evento": evento,
        "dados": dados
    }

    redis_client.publish("painel", json.dumps(mensagem))