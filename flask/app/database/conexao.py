# conexao.py
import pymysql
import os
import logging
from dbutils.pooled_db import PooledDB

# ===== CONFIGURAÇÕES DO BANCO =====
MYSQL_HOST = os.getenv('MYSQL_HOST')
MYSQL_PORT = int(os.getenv('MYSQL_PORT'))
MYSQL_USER = os.getenv('MYSQL_USER')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')

# Validação
if not MYSQL_HOST:
    raise ValueError("MYSQL_HOST não configurado")
if not MYSQL_PORT:
    raise ValueError("MYSQL_PORT não configurado")
if not MYSQL_USER:
    raise ValueError("MYSQL_USER não configurado")
if not MYSQL_PASSWORD:
    raise ValueError("MYSQL_PASSWORD não configurado")
if not MYSQL_DATABASE:
    raise ValueError("MYSQL_DATABASE não configurado")

# Configuração do pool
pool = PooledDB(
    creator=pymysql,
    host=MYSQL_HOST,
    port=MYSQL_PORT,
    user=MYSQL_USER,
    password=MYSQL_PASSWORD,
    database=MYSQL_DATABASE,
    autocommit=True,
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor,
    maxconnections=20,
    mincached=3,
    maxcached=7,
    maxusage=100,
    blocking=True,
    ping=1,
)

def get_db_connection():
    return pool.connection()

logging.info(f"🐬 MySQL conectado em {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE} com usuário {MYSQL_USER}")