from datetime import timedelta
import logging
from multiprocessing import Event
import os
import redis

# ===== CONFIGURAÇÕES DE AMBIENTE =====
IS_DOCKER = os.getenv('IS_DOCKER') == 'true'

# ===== REDIS CONFIGURATION =====
REDIS_HOST = os.getenv('REDIS_HOST')
REDIS_PORT = int(os.getenv('REDIS_PORT'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')

# Validação
if not REDIS_HOST:
    raise ValueError("REDIS_HOST não configurado")
if not REDIS_PORT:
    raise ValueError("REDIS_PORT não configurado")
if not REDIS_PASSWORD:
    raise ValueError("REDIS_PASSWORD não configurado")

# 🔥 Conexão Redis para sessões
SESSION_REDIS = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    db=1,
    decode_responses=True,
    socket_keepalive=True,
    health_check_interval=30
)

# ===== REDIS PARA DADOS VOLÁTEIS =====
redis_volatile = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    db=2,
    decode_responses=False,
    socket_keepalive=True
)

# 🔥 Conexão Redis para eventos
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    db=0,
    decode_responses=True,
    socket_keepalive=True,
    health_check_interval=30
)

# ===== 🔐 CHAVE SECRETA =====
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY não configurado")

# ===== CONFIGURAÇÕES DE SESSÃO =====
SESSION_PERMANENT = False
SESSION_USE_SIGNER = True
SESSION_KEY_PREFIX = 'sessao:'
SESSION_REFRESH_EACH_REQUEST = False
PERMANENT_SESSION_LIFETIME = timedelta(days=30)

# ===== CONFIGURAÇÃO DE TEMPOS (segundos) =====
TEMPOS_SESSAO = {
    'ADMIN': 600,
    'GERENTE': 600,
    'NAO_CADASTRADO': 1000
}

# ===== ROTAS PÚBLICAS =====
ROTAS_PUBLICAS = [
    '/',
    '/health',
    '/teste-ip',
    '/static',
    '/service-worker.js',
    '/tablet',
    '/tablet_limpeza_ativa',
    '/tablet_leitos',
    '/tablet_setores',
    '/tablet_limpeza',
    '/api/carregar_leitos',
    '/api/limpeza_ativa_por_ip',
    '/api/get_leitos_por_setor',
    '/api/verificar_funcionarios',
    '/api/limpeza/aguardando_validacao',
    '/api/registrar_limpeza',
    '/api/verificar_limpeza_ativa',
    '/api/verificar_limpeza_funcionario'
]

# ===== CONFIGURAÇÕES DE LOG =====
logging.basicConfig(level=logging.INFO)

# ===== CONFIGURAÇÕES DE EMAIL =====
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = int(os.getenv('EMAIL_PORT'))
EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')

if not EMAIL_HOST:
    raise ValueError("EMAIL_HOST não configurado")
if not EMAIL_PORT:
    raise ValueError("EMAIL_PORT não configurado")
if not EMAIL_USER:
    raise ValueError("EMAIL_USER não configurado")
if not EMAIL_PASSWORD:
    raise ValueError("EMAIL_PASSWORD não configurado")

# ===== CONFIGURAÇÕES DE ARQUIVOS =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "json")

LEITOS_CACHE_FILE = os.path.join(DATA_DIR, "leitos_por_ip.json")
SETORES_JSON = os.path.join(DATA_DIR, "setores_dispositivos.json")

# ===== CONFIGURAÇÕES DO VITAE =====
BASE_URL = os.getenv('BASE_URL')
USERNAME_VITAE = os.getenv('USERNAME_VITAE')
PASSWORD_VITAE = os.getenv('PASSWORD_VITAE')

if not BASE_URL:
    raise ValueError("BASE_URL não configurado")
if not USERNAME_VITAE:
    raise ValueError("USERNAME_VITAE não configurado")
if not PASSWORD_VITAE:
    raise ValueError("PASSWORD_VITAE não configurado")

LOGIN_URL = f"{BASE_URL}/pacientehrn/login.jsf"
PAGINA_PRINCIPAL = f"{BASE_URL}/pacientehrn/paginaPrincipal.jsf"
PEP_URL = f"{BASE_URL}/pacientehrn/cs_pep_sem_status.jsf"

# ===== CONFIGURAÇÕES DO ICONTROL =====
ICONTROL_BASE_URL = os.getenv('ICONTROL_BASE_URL')
ICONTROL_LOGIN = os.getenv('ICONTROL_LOGIN')
ICONTROL_SENHA = os.getenv('ICONTROL_SENHA')

if not ICONTROL_BASE_URL:
    raise ValueError("ICONTROL_BASE_URL não configurado")
if not ICONTROL_LOGIN:
    raise ValueError("ICONTROL_LOGIN não configurado")
if not ICONTROL_SENHA:
    raise ValueError("ICONTROL_SENHA não configurado")

# ===== CONFIGURAÇÕES DE ATUALIZAÇÃO =====
INTERVALO_ATUALIZACAO = int(os.getenv('INTERVALO_ATUALIZACAO', '120'))

# ===== TEMPO MÍNIMO DE LIMPEZA (minutos) =====
TEMPO_MINIMO_LIMPEZA_PADRAO = int(os.getenv('TEMPO_MINIMO_LIMPEZA_PADRAO', '35'))
TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO = int(os.getenv('TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO', '15'))

# ===== VARIÁVEIS GLOBAIS =====
timers_limpeza = {}
atualizacao_evento = Event()

# ===== LOG DE INICIALIZAÇÃO =====
logging.info("🚀 Inicializando aplicação")
logging.info(f"🐳 Docker mode: {IS_DOCKER}")
logging.info(f"🔐 Redis: {REDIS_HOST}:{REDIS_PORT}")
logging.info(f"📧 Email: {EMAIL_USER}")
logging.info(f"🔗 Vitae: {USERNAME_VITAE} @ {BASE_URL}")