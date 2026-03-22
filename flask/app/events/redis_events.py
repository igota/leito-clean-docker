import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

def publicar_evento(evento, dados):
    mensagem = {
        "evento": evento,
        "dados": dados
    }

    redis_client.publish("painel", json.dumps(mensagem))