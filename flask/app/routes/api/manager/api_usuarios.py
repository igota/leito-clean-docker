from flask import Blueprint, request, jsonify
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
import traceback
from datetime import datetime

# Criar o blueprint
usuarios_bp = Blueprint('usuarios', __name__)


@usuarios_bp.route("/api/config/usuarios", methods=["POST"])
@tipo_required('ADMIN')
@login_required 
def salvar_usuarios():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        id_usuario = request.form.get("id")
        login = request.form["login"].strip()
        nome = request.form["nome"].strip()
        email = request.form.get("email") or None
        tipo = request.form["tipo"]
        status = 1 if request.form.get("status") == "on" else 0
        
        # Pegar o checkbox de notificações
        notificacoes = 1 if request.form.get("receber_notificacoes") == "on" else 0
        
        # 🔴 Pegar os setores selecionados
        setores_selecionados = request.form.getlist("setores[]")
        
        # Se não veio como lista, tenta pegar do campo hidden
        if not setores_selecionados:
            setores_str = request.form.get("setores_selecionados", "")
            setores_selecionados = setores_str.split(',') if setores_str else []
        
        print(f"📋 Setores selecionados (raw): {setores_selecionados}")

        # 🔴 VERIFICAR SE "TODOS OS SETORES" FOI SELECIONADO
        # Isso depende de como você implementou no frontend
        todos_setores_selecionado = 'todos' in setores_selecionados or '-1' in setores_selecionados
        
        if id_usuario:  # UPDATE
            cursor.execute("""
                UPDATE usuarios
                SET login=%s, nome=%s, email=%s, tipo=%s, status=%s, notificacoes=%s
                WHERE id=%s
            """, (login, nome, email, tipo, status, notificacoes, id_usuario))
            
            # Remove configurações antigas
            cursor.execute("DELETE FROM notificacoes_emails WHERE usuario_id = %s", (id_usuario,))
            
            mensagem = "Usuário atualizado com sucesso!"
            
        else:  # INSERT
            cursor.execute("""
                INSERT INTO usuarios (login, nome, email, tipo, status, notificacoes)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (login, nome, email, tipo, status, notificacoes))
            
            id_usuario = cursor.lastrowid
            mensagem = "Usuário cadastrado com sucesso!"

        # 🔴 LÓGICA PARA INSERIR SETORES
        if notificacoes:
            if todos_setores_selecionado:
                # 🔴 Caso 1: Usuário selecionou "Todos os Setores"
                print("🔵 Usuário selecionou TODOS os setores")
                
                # Buscar todos os setores ativos
                cursor.execute("SELECT id FROM setores WHERE status = 1")
                todos_setores = cursor.fetchall()
                
                for setor in todos_setores:
                    cursor.execute("""
                        INSERT INTO notificacoes_emails (usuario_id, setor_id, receber_notificacoes)
                        VALUES (%s, %s, 1)
                    """, (id_usuario, setor['id']))
                
                print(f"✅ Inseridos {len(todos_setores)} setores para o usuário")
                
            elif setores_selecionados:
                # 🔴 Caso 2: Usuário selecionou setores específicos
                # Remover o valor 'todos' se estiver presente e filtrar apenas números
                setores_filtrados = []
                for setor in setores_selecionados:
                    if setor and setor != 'todos' and setor != '-1':
                        try:
                            # Tenta converter para inteiro (ignora strings não numéricas)
                            setores_filtrados.append(int(setor))
                        except ValueError:
                            print(f"⚠️ Valor ignorado (não é número): {setor}")
                
                # Remover duplicatas
                setores_unicos = list(set(setores_filtrados))
                
                if setores_unicos:
                    print(f"📋 Inserindo setores específicos: {setores_unicos}")
                    for setor_id in setores_unicos:
                        cursor.execute("""
                            INSERT INTO notificacoes_emails (usuario_id, setor_id, receber_notificacoes)
                            VALUES (%s, %s, 1)
                        """, (id_usuario, setor_id))
                    
                    print(f"✅ Inseridos {len(setores_unicos)} setores para o usuário")
                else:
                    print("📭 Nenhum setor válido para inserir")
            else:
                print("📭 Nenhum setor selecionado")
        else:
            print("📭 Notificações desativadas, nenhum setor inserido")

        conn.commit()
        
        return jsonify({
            'success': True,
            'message': mensagem,
            'type': 'success'
        })

    except Exception as e:
        conn.rollback()
        print("❌ Erro inesperado:", e)
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar usuário: {str(e)}',
            'type': 'danger'
        }), 500

    finally:
        cursor.close()
        conn.close()


@usuarios_bp.route("/api/usuarios", methods=["GET"])
@tipo_required('ADMIN')
@login_required
def listar_usuarios_api():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Busca usuários com o campo notificacoes
            cursor.execute("""
                SELECT id, login, nome, email, tipo, status, 
                       notificacoes, ultimo_acesso
                FROM usuarios
                ORDER BY nome
            """)
            usuarios = cursor.fetchall()
            
            # Para cada usuário, busca os setores que ele monitora
            for user in usuarios:
                cursor.execute("""
                    SELECT s.id, s.nome
                    FROM setores s
                    INNER JOIN notificacoes_emails ne ON s.id = ne.setor_id
                    WHERE ne.usuario_id = %s AND ne.receber_notificacoes = 1
                """, (user['id'],))
                user['setores_notificacao'] = cursor.fetchall()
                
                # Formatar a data de último acesso
                if user['ultimo_acesso']:
                    try:
                        dt = user['ultimo_acesso']
                        if isinstance(dt, str):
                            dt = datetime.strptime(dt, '%Y-%m-%d %H:%M:%S')
                        user['ultimo_acesso'] = dt.strftime('%d/%m/%Y %H:%M')
                    except:
                        pass  # Mantém o valor original se não conseguir formatar
            
        conn.close()
        
        # O Flask já converte booleanos automaticamente:
        # notificacoes = True/False no Python vira true/false no JSON
        return jsonify(usuarios)
        
    except Exception as e:
        print(f"Erro ao carregar usuários: {e}")
        return jsonify([]), 500