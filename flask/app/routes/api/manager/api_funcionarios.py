from flask import Blueprint, request, jsonify, session
import pymysql
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required


# Criar o blueprint
funcionarios_bp = Blueprint('funcionarios', __name__)


def validar_disponibilidade_cartao(id_cartao, funcionario_id=None):
    """
    Verifica se o cartão pode ser usado.
    Retorna (bool, str) - (pode_usar, mensagem)
    """
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            if funcionario_id:
                # Para edição: busca OUTROS funcionários com mesmo cartão
                cursor.execute("""
                    SELECT id, nome, status
                    FROM funcionarios
                    WHERE id_cartao = %s AND id != %s
                """, (id_cartao, funcionario_id))
            else:
                # Para cadastro: busca QUALQUER funcionário com mesmo cartão
                cursor.execute("""
                    SELECT id, nome, status
                    FROM funcionarios
                    WHERE id_cartao = %s
                """, (id_cartao,))

            funcionarios_com_mesmo_cartao = cursor.fetchall()

            if not funcionarios_com_mesmo_cartao:
                return True, "Cartão disponível"

            # Verifica se algum deles está ATIVO
            for func in funcionarios_com_mesmo_cartao:
                if func['status'] == 1:
                    return False, f"⚠️ Cartão já está em uso pelo funcionário ATIVO: {func['nome']}"

            # Se chegou aqui, só existem funcionários INATIVOS com este cartão
            return True, "Cartão disponível (pertencia a funcionário inativo)"

    except Exception as e:
        return False, f"Erro ao validar cartão: {str(e)}"
    finally:
        conn.close()


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


@funcionarios_bp.route('/api/buscar_funcionario_icontrol', methods=['POST'])
@tipo_required('ADMIN', 'GERENTE')
@login_required
def buscar_funcionario_icontrol():
    from ....services.icontrol import obter_sessao_icontrol

    dados = request.json or {}
    tipo = dados.get('tipo', '')  # 'nome' ou 'identificador'
    valor = (dados.get('valor') or '').strip()

    if not valor:
        return jsonify({"sucesso": False, "erro": "Informe o valor para busca."}), 400

    if tipo not in ('nome', 'identificador'):
        return jsonify({"sucesso": False, "erro": "Tipo de busca inválido."}), 400

    with obter_sessao_icontrol() as busca:
        if tipo == 'nome':
            resultados = busca.buscar_por_nome(valor)
        else:
            resultados = busca.buscar_por_identificador(valor)

    return jsonify({"sucesso": True, "resultados": resultados, "total": len(resultados)})


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

    # Validação: 8 a 10 dígitos, apenas números
    if not (8 <= len(id_cartao) <= 10) or not id_cartao.isdigit():
        return jsonify({"erro": "⚠️ O ID do cartão deve conter entre 8 e 10 números."}), 400

    # 🔥 VALIDAÇÃO: Verifica se o cartão pode ser usado
    pode_usar, mensagem = validar_disponibilidade_cartao(id_cartao)
    if not pode_usar:
        return jsonify({"erro": mensagem}), 400

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

        # Não precisa mais verificar id_cartao duplicado (já validamos antes)
        return jsonify({"erro": f"❌ Erro interno ao cadastrar: {erro}"}), 500


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

            query += " ORDER BY nome ASC"

            cursor.execute(query, params)
            funcionarios = cursor.fetchall()

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
    id_func = dados.get("id")
    nome = dados.get("nome")
    cpf = dados.get("cpf")
    id_cartao = dados.get("id_cartao", "").strip()
    tipo = dados.get("tipo")
    status = dados.get("status")

    if not (nome and cpf and id_cartao and tipo):
        return jsonify({"erro": "⚠️ Preencha todos os campos obrigatórios."}), 400

    if not id_func:
        return jsonify({"erro": "ID do funcionário não informado"}), 400

    # Validação: 8 a 10 dígitos, apenas números
    if not (8 <= len(id_cartao) <= 10) or not id_cartao.isdigit():
        return jsonify({"erro": "⚠️ O ID do cartão deve conter entre 8 e 10 números."}), 400

    # Converte status para inteiro
    if status is not None:
        if isinstance(status, str):
            status = 1 if status.lower() in ['true', '1', 'ativo'] else 0
        elif isinstance(status, bool):
            status = 1 if status else 0
        else:
            status = int(status) if status else 0

    # 🔥 VALIDAÇÃO: Verifica se o cartão pode ser usado (ignorando o próprio)
    pode_usar, mensagem = validar_disponibilidade_cartao(id_cartao, id_func)
    if not pode_usar:
        return jsonify({"erro": mensagem}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE funcionarios
                SET nome=%s, cpf=%s, id_cartao=%s, tipo=%s, status=%s
                WHERE id=%s
            """, (nome, cpf, id_cartao, tipo, status, id_func))
            conn.commit()

            if cursor.rowcount == 0:
                conn.close()
                return jsonify({"erro": "Funcionário não encontrado"}), 404

        conn.close()
        return jsonify({"mensagem": "Funcionário atualizado com sucesso!"})

    except Exception as e:
        erro = str(e)

        if "Duplicate entry" in erro and "cpf" in erro:
            return jsonify({"erro": "⚠️ Este CPF já está cadastrado."}), 400

        return jsonify({"erro": f"❌ Erro interno ao editar: {erro}"}), 500