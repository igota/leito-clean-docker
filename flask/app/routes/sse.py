from flask import Blueprint, Response, request, session
from ..config.settings import atualizacao_evento
import redis
import json
import time

sse_bp = Blueprint('sse', __name__)

# Cliente Redis para escutar eventos
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

@sse_bp.route('/stream')
def stream():
    session_id_cliente = request.args.get('session_id')

    def event_stream():
        pubsub = redis_client.pubsub()
        pubsub.subscribe('painel', 'logout')

        print("✅ Cliente SSE conectado ao Redis")
        yield "data: conectado\n\n"

        ultimo_ping = time.time()

        try:
            for mensagem in pubsub.listen():
                try:
                    if mensagem['type'] == 'message':
                        dados = json.loads(mensagem['data'])
                        
                        # 🔥 Garante que sempre use "evento"
                        evento = dados.get('evento') or dados.get('tipo')
                        dados['evento'] = evento
                        
                        print(f"🔔 Evento Redis recebido: {evento}")

                        # Verifica se é logout para a sessão específica
                        if evento == "logout" and session_id_cliente == dados.get('session_id'):
                            # Envia apenas para a sessão que foi derrubada
                            yield f"data: {json.dumps(dados)}\n\n"
                        elif evento != "logout":
                            # Outros eventos vão para todos
                            yield f"data: {json.dumps(dados)}\n\n"

                    if time.time() - ultimo_ping > 30:
                        yield ": keepalive\n\n"
                        ultimo_ping = time.time()

                except Exception as e_inner:
                    print(f"❌ Erro interno no loop SSE: {e_inner}")
                    continue

        except GeneratorExit:
            print("👋 Cliente SSE desconectado")
        finally:
            pubsub.close()

    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'Connection': 'keep-alive'
        }
    )

