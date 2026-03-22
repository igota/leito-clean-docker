from flask import Blueprint, request, jsonify, session
from pymysql import IntegrityError
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
import traceback

# Criar o blueprint
dispositivos_bp = Blueprint('dispositivos', __name__)


@dispositivos_bp.route("/api/config/dispositivos", methods=["POST"])
@login_required
@tipo_required('ADMIN')
def salvar_dispositivos():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 🔍 LOG PARA DEBUG
        print(f"\n{'='*50}")
        print(f"📝 Usuário: {session.get('usuario_logado')} - Tipo: {session.get('tipo_usuario')}")
        print(f"Dados recebidos: {dict(request.form)}")
        print(f"{'='*50}")

        id_dispositivo = request.form.get("id")
        nome = request.form["nome"].strip()
        ip = request.form["ip"].strip()
        status = 1 if request.form.get("status") == "on" else 0

        # Validação básica
        if not nome or not ip:
            return jsonify({
                'success': False,
                'message': 'Nome e IP são obrigatórios',
                'type': 'warning'
            }), 400

        if id_dispositivo:
            cursor.execute("""
                UPDATE dispositivos
                SET nome=%s, ip=%s, status=%s
                WHERE id=%s
            """, (nome, ip, status, id_dispositivo))
            mensagem = "✅ Dispositivo atualizado com sucesso!"
            print(f"Editando dispositivo ID {id_dispositivo}")
        else:
            cursor.execute("""
                INSERT INTO dispositivos (nome, ip, status)
                VALUES (%s, %s, %s)
            """, (nome, ip, status))
            mensagem = "✅ Dispositivo cadastrado com sucesso!"
            print(f"Novo dispositivo: {nome} - {ip}")

        conn.commit()
        
        return jsonify({
            'success': True,
            'message': mensagem,
            'type': 'success'
        })

    except IntegrityError:
        conn.rollback()
        print(f"❌ IP duplicado: {ip}")
        return jsonify({
            'success': False,
            'message': '❌ Já existe um dispositivo com esse IP.',
            'type': 'danger'
        }), 400

    except Exception as e:
        conn.rollback()
        print("❌ Erro inesperado:", e)
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'❌ Erro ao salvar dispositivo: {str(e)}',
            'type': 'danger'
        }), 500

    finally:
        cursor.close()
        conn.close()


@dispositivos_bp.route("/api/dispositivos", methods=["GET"])
@tipo_required('ADMIN')
@login_required
def listar_dispositivos_api():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, nome, ip, status
            FROM dispositivos
            ORDER BY ip
        """)
        
        dispositivos = cursor.fetchall()
        
        dispositivos_list = []
        for d in dispositivos:
            dispositivos_list.append({
                'id': d['id'],
                'nome': d['nome'],
                'ip': d['ip'],
                'status': d['status']
            })
        
        return jsonify(dispositivos_list)
        
    except Exception as e:
        print(f"❌ Erro ao listar dispositivos: {e}")
        return jsonify([]), 500
        
    finally:
        cursor.close()
        conn.close()