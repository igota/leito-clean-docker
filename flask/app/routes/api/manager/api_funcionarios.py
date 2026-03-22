from flask import Blueprint, request, jsonify, session
import pymysql
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
import traceback

# Criar o blueprint
funcionarios_bp = Blueprint('funcionarios', __name__)


@funcionarios_bp.route('/api/funcionarios', methods=['GET'])
@tipo_required('ADMIN', 'GERENTE')
@login_required  
def listar_funcionarios():
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT id_cartao, nome, tipo
                FROM funcionarios
                WHERE status = TRUE
                ORDER BY nome
            """)
            funcionarios = cursor.fetchall()
            return jsonify(funcionarios)
    except Exception as e:
        print(f"❌ Erro ao listar funcionários: {e}")
        return jsonify([]), 500
    finally:
        conn.close()    


@funcionarios_bp.route('/api/cadastrar_funcionarios', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def cadastrar_funcionarios():
    dados = request.json
    nome = dados.get("nome")
    cpf = dados.get("cpf")
    id_cartao = dados.get("id_cartao", "").strip()
    tipo = dados.get("tipo")

    if not (nome and cpf and id_cartao and tipo):
        return jsonify({"erro": "⚠️ Preencha todos os campos obrigatórios."}), 400

    # Validação: 9 a 10 dígitos, apenas números
    if not (9 <= len(id_cartao) <= 10) or not id_cartao.isdigit():
        return jsonify({"erro": "⚠️ O ID do cartão deve conter entre 8 e 10 números."}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO funcionarios (nome, cpf, id_cartao, tipo, status)
                VALUES (%s, %s, %s, %s, %s)
            """, (nome, cpf, id_cartao, tipo, 1))
            conn.commit()
        conn.close()

        return jsonify({"mensagem": "Funcionário cadastrado com sucesso!"})

    except Exception as e:
        erro = str(e)

        if "Duplicate entry" in erro and "cpf" in erro:
            return jsonify({"erro": "⚠️ Este CPF já está cadastrado."}), 400

        if "Duplicate entry" in erro and "id_cartao" in erro:
            return jsonify({"erro": "⚠️ Este ID de cartão já está em uso."}), 400

        return jsonify({"erro": "❌ Erro interno ao cadastrar funcionário."}), 500


@funcionarios_bp.route('/api/consultar_funcionarios', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def consultar_funcionarios():
    dados = request.get_json(silent=True) or {}

    nome = dados.get("nome", "").strip()
    id_cartao = dados.get("id_cartao", "").strip()
    tipo = dados.get("tipo", "").strip()

    conn = get_db_connection()
    funcionarios = []

    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            query = """
                SELECT 
                    id,
                    nome,
                    cpf,
                    id_cartao,
                    tipo,
                    status
                FROM funcionarios
                WHERE 1=1
            """
            params = []

            if nome:
                query += " AND nome LIKE %s"
                params.append(f"%{nome}%")

            if id_cartao:
                query += " AND id_cartao = %s"
                params.append(id_cartao)

            if tipo:
                query += " AND tipo = %s"
                params.append(tipo)

            cursor.execute(query, params)
            funcionarios = cursor.fetchall()

            print("FILTROS RECEBIDOS:", dados)
            print("ID CARTAO FILTRADO:", id_cartao)

            for u in funcionarios:
                u["status"] = int(u["status"]) if u["status"] is not None else 0
                u["id_cartao"] = str(u["id_cartao"]) if u["id_cartao"] is not None else ""
                u["cpf"] = u["cpf"] or ""
                u["tipo"] = u["tipo"] or ""

    except Exception as e:
        print("❌ ERRO AO CONSULTAR FUNCIONÁRIOS:", e)
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()

    return jsonify({"funcionarios": funcionarios})


@funcionarios_bp.route('/api/editar_funcionarios', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def editar_funcionarios():
    dados = request.json
    id = dados.get("id")
    nome = dados.get("nome")
    cpf = dados.get("cpf")
    id_cartao = dados.get("id_cartao")
    tipo = dados.get("tipo")
    status = dados.get("status")
    
    if not (nome and cpf and id_cartao and tipo):
        return jsonify({"erro": "⚠️ Preencha todos os campos obrigatórios."}), 400

    if not id:
        return jsonify({"erro": "ID do funcionário não informado"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE funcionarios
                SET nome=%s, cpf=%s, id_cartao=%s, tipo=%s, status=%s
                WHERE id=%s
            """, (nome, cpf, id_cartao, tipo, status, id))
            conn.commit()
        conn.close()
        return jsonify({"mensagem": "Funcionário atualizado com sucesso!"})
        
    except Exception as e:
        erro = str(e)

        if "Duplicate entry" in erro and "cpf" in erro:
            return jsonify({"erro": "⚠️ Este CPF já está cadastrado."}), 400

        if "Duplicate entry" in erro and "id_cartao" in erro:
            return jsonify({"erro": "⚠️ Este ID de cartão já está em uso."}), 400

        return jsonify({"erro": "❌ Erro interno ao editar funcionário."}), 500