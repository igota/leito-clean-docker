from datetime import timedelta
import logging
from multiprocessing import Event
import os
import redis

# ===== CONFIGURAÇÕES DA APLICAÇÃO =====

# ===== 🔐 CHAVE FIXA =====
SECRET_KEY = os.environ.get('SECRET_KEY', 'fallback_key_desenvolvimento')

# ===== CONFIGURAÇÕES DE SESSÃO COM REDIS =====

SESSION_PERMANENT = False
SESSION_USE_SIGNER = True
SESSION_KEY_PREFIX = 'sessao:'
SESSION_REFRESH_EACH_REQUEST = False
PERMANENT_SESSION_LIFETIME = timedelta(days=30)

# ===== CONFIGURAÇÃO DE TEMPOS (EM SEGUNDOS) =====
TEMPOS_SESSAO = {
    'ADMIN': 30,        # 1 dia
    'GERENTE': 30,        # 10 minutos
    'NAO_CADASTRADO': 1000  # 30 dias
}

# ===== ROTAS PÚBLICAS =====
# 🔥 Rotas que NÃO exigem login e NUNCA expiram (imortais)
ROTAS_PUBLICAS = [
    '/',
    
    # 🔥 ESSENCIAL
    '/static',
    '/service-worker.js',
    
    # suas rotas
    '/tablet',
    '/tablet_limpeza_ativa',
    '/tablet_leitos',
    '/tablet_setores',
    '/tablet_limpeza',
    '/api/carregar_leitos',
    '/api/limpeza_ativa_por_ip',
    '/api/get_leitos_por_setor',
    '/api/verificar_funcionarioss',
    '/api/limpeza/aguardando_validacao',
    '/api/registrar_limpeza',
    '/api/verificar_limpeza_ativa',
    '/api/verificar_limpeza_funcionario'
]

# 🔥 Conexão Redis para sessões
SESSION_REDIS = redis.Redis(
    host='localhost',
    port=6379,
    db=1,
    decode_responses=True,
    socket_keepalive=True,
    health_check_interval=30
)

# ===== REDIS PARA DADOS VOLÁTEIS =====
redis_volatile = redis.Redis(
    host='localhost',
    port=6379,
    db=2,
    decode_responses=False,
    socket_keepalive=True
)

# ===== CONFIGURAÇÕES DE LOG =====
logging.basicConfig(level=logging.INFO)

# ===== CONFIGURAÇÕES DE EMAIL =====
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USER = "cleanleito@gmail.com"
EMAIL_PASSWORD = "eosuudoeqcwqgdnf"

# ===== CONFIGURAÇÕES DE ARQUIVOS =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "json")

LEITOS_CACHE_FILE = os.path.join(DATA_DIR, "leitos_por_ip.json")
SETORES_JSON = os.path.join(DATA_DIR, "setores_dispositivos.json")

# ===== CONFIGURAÇÕES DO VITAE =====
BASE_URL = "http://10.2.2.8:8080"
LOGIN_URL = f"{BASE_URL}/pacientehrn/login.jsf"
PAGINA_PRINCIPAL = f"{BASE_URL}/pacientehrn/paginaPrincipal.jsf"
PEP_URL = f"{BASE_URL}/pacientehrn/cs_pep_sem_status.jsf"
USERNAME = "MAPACCG"
PASSWORD = "@isgh#nti2"

# ===== CONFIGURAÇÕES DE ATUALIZAÇÃO =====
INTERVALO_ATUALIZACAO = 120

# ===== VARIÁVEIS GLOBAIS =====
timers_limpeza = {}
atualizacao_evento = Event()

# 🔥 Conexão Redis para eventos
redis_client = redis.Redis(
    host="localhost", 
    port=6379, 
    db=0,
    decode_responses=True,
    socket_keepalive=True,
    health_check_interval=30
)