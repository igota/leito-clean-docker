from flask import Blueprint, Response, request
import json
import time
from ..config.settings import redis_client

sse_bp = Blueprint('sse', __name__)


@sse_bp.route('/stream')
def stream():
    session_id_cliente = request.args.get('session_id')

    def event_stream():

        pubsub = redis_client.pubsub()
        pubsub.subscribe('painel', 'logout')

        print("✅ Cliente SSE conectado ao Redis")

        # Handshake inicial
        yield f"data: {json.dumps({'evento': 'conectado'})}\n\n"

        ultimo_ping = time.time()

        try:
            while True:

                mensagem = pubsub.get_message(timeout=1)

                if mensagem and mensagem['type'] == 'message':

                    try:
                        dados = json.loads(mensagem['data'])

                        # garante campo evento
                        evento = dados.get('evento') or dados.get('tipo')
                        dados['evento'] = evento

                        print(f"🔔 Evento Redis recebido: {evento}")

                        # logout apenas para sessão específica
                        if evento == "logout":
                            if session_id_cliente == dados.get('session_id'):
                                yield f"data: {json.dumps(dados)}\n\n"

                        else:
                            # eventos gerais
                            yield f"data: {json.dumps(dados)}\n\n"

                    except Exception as e_json:
                        print(f"❌ Erro ao processar mensagem Redis: {e_json}")

                # keepalive a cada 30s
                if time.time() - ultimo_ping > 30:
                    yield ": keepalive\n\n"
                    ultimo_ping = time.time()

                time.sleep(0.01)

        except GeneratorExit:
            print("👋 Cliente SSE desconectado")

        finally:
            pubsub.close()

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )