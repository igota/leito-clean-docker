from flask import Flask
import threading
import logging
import os

# Imports relativos
from .config import settings
from .utils import helpers

# Blueprints
from .routes.pages.p_manager import manager_bp
from .routes.pages.p_mobile import mobile_bp

from .routes.api.manager.api_dispositivos import dispositivos_bp
from .routes.api.manager.api_funcionarios import funcionarios_bp
from .routes.api.manager.api_justificativas import justificativas_bp
from .routes.api.manager.api_limpezas import limpezas_bp
from .routes.api.manager.api_relatorios import relatorios_bp
from .routes.api.manager.api_setores import setores_bp
from .routes.api.manager.api_usuarios import usuarios_bp
from .routes.api.mobile.api_mobile import mobile_api_bp
from .routes.sse import sse_bp
from .routes.api.manager.api_debug import debug_bp

from app.events.redis_keyspace_listener import iniciar_keyspace_listener

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(
        __name__,
        template_folder='templates',
        static_folder='static'
    )

    # ================================
    # 🔐 CONFIG BÁSICA
    # ================================
    app.secret_key = settings.SECRET_KEY

    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.config['JSON_SORT_KEYS'] = False

    # ================================
    # 🔗 REDIS (SEM Flask-Session)
    # ================================
    app.config['SESSION_REDIS'] = settings.SESSION_REDIS

    # ================================
    # 🎨 FILTERS / CONTEXT
    # ================================
    app.template_filter('datetimeformat')(helpers.datetimeformat)
    app.context_processor(helpers.inject_user)
    app.before_request(helpers.controle_sessao)

    # ================================
    # 📦 BLUEPRINTS
    # ================================
    app.register_blueprint(manager_bp)
    app.register_blueprint(mobile_bp)
    app.register_blueprint(dispositivos_bp)
    app.register_blueprint(funcionarios_bp)
    app.register_blueprint(justificativas_bp)
    app.register_blueprint(limpezas_bp)
    app.register_blueprint(relatorios_bp)
    app.register_blueprint(setores_bp)
    app.register_blueprint(usuarios_bp)
    app.register_blueprint(mobile_api_bp)
    app.register_blueprint(sse_bp)
    app.register_blueprint(debug_bp)

    # ================================
    # 🔍 TESTE REDIS + START LISTENER
    # ================================
    try:
        settings.SESSION_REDIS.ping()
        logger.info("✅ Redis conectado com sucesso!")

        # 🔥 IMPORTANTE: evitar múltiplos listeners no Gunicorn
        if os.environ.get("RUN_MAIN") == "true" or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
            logger.info("🚀 Iniciando listener Redis (Keyspace)...")
            iniciar_keyspace_listener()

    except Exception as e:
        logger.error(f"❌ Redis indisponível: {e}")

    # ================================
    # 🧠 SCHEDULER (UMA VEZ)
    # ================================
    try:
        from .scheduler.scheduler import iniciar_scheduler
        logger.info("🚀 Iniciando scheduler...")
        iniciar_scheduler()
    except Exception as e:
        logger.error(f"❌ Erro scheduler: {e}")

    # ================================
    # 🔄 THREADS BACKGROUND
    # ================================
    def iniciar_threads_background():
        with app.app_context():
            try:
                from .services.threads import iniciar_threads
                logger.info("🔄 Iniciando threads externas...")
                iniciar_threads()
            except Exception as e:
                logger.error(f"❌ Erro threads: {e}")

    threading.Thread(target=iniciar_threads_background, daemon=True).start()

    logger.info("🟢 Sistema inicializado com sucesso")
    return app