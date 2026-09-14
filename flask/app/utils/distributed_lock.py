import logging
import uuid

from ..config.settings import SESSION_REDIS

logger = logging.getLogger(__name__)


def adquirir_lock_ciclo(chave: str, ttl_segundos: int) -> bool:
    """Reserva a execução de um ciclo periódico entre múltiplos workers do gunicorn.

    Usa SET NX EX no Redis: dentro da janela de `ttl_segundos`, só o primeiro
    processo a chamar isso recebe True e deve rodar o trabalho do ciclo; os
    demais recebem False e apenas aguardam o próximo ciclo. Se o processo
    "dono" cair, o lock expira sozinho e outro assume no ciclo seguinte — não
    precisa de liberação explícita nem de heartbeat, então basta chamar isso
    no início de cada iteração de um `while True` com sleep de `ttl_segundos`.
    """
    lock_key = f"lock:{chave}"
    try:
        obtido = SESSION_REDIS.set(lock_key, uuid.uuid4().hex, nx=True, ex=max(ttl_segundos - 1, 1))
        return bool(obtido)
    except Exception:
        logger.exception("Erro ao tentar adquirir lock de ciclo '%s' no Redis", chave)
        # Redis indisponível: deixa o processo rodar o ciclo normalmente em vez
        # de travar a sincronização por completo.
        return True
