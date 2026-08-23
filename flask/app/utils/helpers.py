from datetime import datetime
from functools import wraps
from flask import session, request, redirect, url_for, jsonify
from app.config import settings
import logging

# ===== FUNÇÕES AUXILIARES =====

def converter_data(data_str):
    """Converte uma data no formato DD/MM/YYYY para YYYY-MM-DD."""
    try:
        return datetime.strptime(data_str, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def datetimeformat(value, format='%d/%m/%Y %H:%M'):
    """Filtro para formatar datas nos templates"""
    if value is None:
        return ''
    
    if isinstance(value, str):
        try:
            if 'T' in value:
                value = datetime.fromisoformat(value.replace('Z', '+00:00'))
            elif ' ' in value and len(value) == 19:
                value = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
            elif len(value) == 10 and '-' in value:
                value = datetime.strptime(value, '%Y-%m-%d')
            else:
                return value
        except:
            return value
    
    if isinstance(value, datetime):
        return value.strftime(format)
    
    return value


def inject_user():
    """Disponibiliza variáveis do usuário para todos os templates"""
    return dict(
        usuario_logado=session.get("usuario_logado"),
        nome_completo=session.get("nome_completo"),
        tipo_usuario=session.get("tipo_usuario")
    )


def get_client_ip():
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr


# ===== CONTROLE DE SESSÃO =====

def controle_sessao():
    """
    Controle de sessão com Redis como fonte da verdade
    """
    # 🔥 Rotas públicas
    is_public_route = any(
        request.path == rota or request.path.startswith(rota + '/')
        for rota in settings.ROTAS_PUBLICAS
    ) or request.path.startswith('/static')

    if is_public_route:
        return None

    from app.config.settings import SESSION_REDIS
    import json

    # 🔥 Pega session_id da sessão Flask ou do cookie
    session_id = session.get('session_id')
    
    # Se não tem session_id, verifica se tem no cookie personalizado
    if not session_id:
        session_id = request.cookies.get('session_id')
    
    logging.info(f"🔍 controle_sessao - session_id: {session_id}, path: {request.path}")

    # ❌ Sem session_id → não logado
    if not session_id:
        logging.info(f"🔒 Sem session_id: {request.path}")
        # Limpa sessão Flask e redireciona
        session.clear()
        response = redirect(url_for('manager.index', logout='expirado'))
        # Remove cookie personalizado
        response.delete_cookie('session_id')
        return response

    chave = f"sessao:{session_id}"
    dados = SESSION_REDIS.get(chave)

    if not dados:
        logging.info(f"⛔ Sessão expirada ou não encontrada: {session_id}")
        session.clear()
        response = redirect(url_for('manager.index', logout='expirado'))
        response.delete_cookie('session_id')
        return response

    try:
        dados = json.loads(dados)
        usuario = dados.get('usuario')
        
        # Verifica se a sessão ainda está vinculada ao usuário
        chave_usuario = f"user_session:{usuario}"
        sessao_atual = SESSION_REDIS.get(chave_usuario)

        if sessao_atual != session_id:
            logging.info(f"🔒 Sessão substituída: {session_id} != {sessao_atual}")
            session.clear()
            response = redirect(url_for('manager.index', logout='duplicado'))
            response.delete_cookie('session_id')
            return response

        # ✅ Recria dados na sessão Flask
        session['usuario_logado'] = usuario
        session['nome_completo'] = dados.get('nome')
        session['tipo_usuario'] = dados.get('tipo')
        session['logado'] = True
        session['session_id'] = session_id

        # 🔥 Renova o TTL a cada requisição (janela deslizante, igual ao
        # sistema original: usuário ativo nunca é derrubado por inatividade)
        tempo_ttl = settings.TEMPOS_SESSAO.get(dados.get('tipo'), settings.TEMPOS_SESSAO['NAO_CADASTRADO'])
        SESSION_REDIS.expire(chave, tempo_ttl)

        logging.info(f"✅ Sessão válida: {usuario} - {session_id}")

    except Exception as e:
        logging.error(f"Erro ao ler sessão Redis: {e}")
        session.clear()
        response = redirect(url_for('manager.index', logout='expirado'))
        response.delete_cookie('session_id')
        return response

    return None

def _requisicao_ajax():
    return (
        request.headers.get("Accept") == "application/json"
        or request.headers.get("X-Requested-With") == "XMLHttpRequest"
    )


def tipo_required(*tipos_permitidos):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):

            is_public_route = any(
                request.path == rota or request.path.startswith(rota + '/')
                for rota in settings.ROTAS_PUBLICAS
            ) or request.path.startswith('/static')

            if is_public_route:
                return f(*args, **kwargs)

            if not session.get('logado'):
                if _requisicao_ajax():
                    return jsonify({"erro": "Não autorizado"}), 401
                return redirect(url_for('manager.index'))

            tipo_usuario = session.get('tipo_usuario', 'NAO_CADASTRADO')

            if tipo_usuario in tipos_permitidos:
                return f(*args, **kwargs)

            # Mensagem personalizada baseada no tipo
            if tipo_usuario == 'ENFERMAGEM':
                mensagem = "🔒 Esta funcionalidade é restrita a ADMIN ou GERENTE."
            elif tipo_usuario in ['NAO_CADASTRADO', 'INATIVO']:
                mensagem = "🔒 Você precisa estar cadastrado no sistema para acessar esta funcionalidade."
            elif tipo_usuario == 'GERENTE':
                mensagem = "🔒 Acesso restrito a administradores. Gerentes não têm permissão para esta área."
            else:
                mensagem = "🔒 Você não tem permissão para acessar esta página."

            # 🔥 Para requisições AJAX/JSON, retorna JSON em vez de redirecionar
            if _requisicao_ajax():
                return jsonify({
                    "erro": "acesso_negado",
                    "mensagem": mensagem,
                    "tipo_usuario": tipo_usuario
                }), 403

            session['toast_message'] = {
                'texto': mensagem,
                'tipo': 'warning'
            }

            return redirect(url_for('manager.pagina_principal'))

        return decorated_function
    return decorator

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):

        is_public_route = any(
            request.path == rota or request.path.startswith(rota + '/')
            for rota in settings.ROTAS_PUBLICAS
        ) or request.path.startswith('/static')

        if is_public_route:
            return f(*args, **kwargs)

        if not session.get('logado'):
            if _requisicao_ajax():
                return jsonify({"erro": "Não autorizado"}), 401
            return redirect(url_for('manager.index'))

        return f(*args, **kwargs)

    return decorated_function


