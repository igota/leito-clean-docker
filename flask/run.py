import sys
import os

# Obtém o caminho absoluto da pasta flask
FLASK_DIR = os.path.dirname(os.path.abspath(__file__))

# Adiciona a pasta flask ao path (para encontrar 'app' e 'config')
if FLASK_DIR not in sys.path:
    sys.path.insert(0, FLASK_DIR)

print(f"🔍 Python path: {sys.path}")  # Debug
print(f"📂 Diretório flask: {FLASK_DIR}")

try:
    from app import create_app
    print("✅ Módulo 'app' encontrado!")
except ImportError as e:
    print(f"❌ Erro ao importar 'app': {e}")
    sys.exit(1)

app = create_app()

if __name__ == '__main__':
    print("🚀 Iniciando servidor...")
    app.run(debug=True, host='0.0.0.0', port=5000)