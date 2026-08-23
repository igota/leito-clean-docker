#!/usr/bin/env bash
# Backup lógico do MySQL do LeitoClean via mysqldump dentro do container.
# Não depende de mysqldump instalado no host (funciona igual em Windows/git-bash
# durante os testes locais e em Linux/Proxmox em produção).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
CONTAINER="leito-clean-mysql"
RETENCAO_DIAS=10

mkdir -p "$BACKUP_DIR"

# Carrega credenciais do .env (não fica hardcoded no script)
set -a
source "$PROJECT_DIR/.env"
set +a

DATA=$(date +%Y-%m-%d)
ARQUIVO="$BACKUP_DIR/${MYSQL_DATABASE}-${DATA}.sql"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup do ${MYSQL_DATABASE}" >> "$LOG_FILE"

if docker exec "$CONTAINER" mysqldump --no-tablespaces \
    -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" > "$ARQUIVO" 2>> "$LOG_FILE"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup bem-sucedido: $(basename "$ARQUIVO")" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] FALHA no backup do ${MYSQL_DATABASE}" >> "$LOG_FILE"
    rm -f "$ARQUIVO"
    exit 1
fi

# Remove backups com mais de N dias
find "$BACKUP_DIR" -maxdepth 1 -name "${MYSQL_DATABASE}-*.sql" -mtime "+${RETENCAO_DIAS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backups com mais de ${RETENCAO_DIAS} dias foram removidos." >> "$LOG_FILE"
