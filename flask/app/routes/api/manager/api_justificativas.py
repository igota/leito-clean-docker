from flask import Blueprint, request, jsonify, session
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
from ....config.settings import atualizacao_evento
from ....events.redis_events import publicar_evento  
import json
from datetime import datetime
import traceback

# Criar o blueprint
justificativas_bp = Blueprint('justificativas', __name__)


# Listar justificativas (com filtros opcionais)
@justificativas_bp.route("/api/justificativas", methods=["GET"])
@tipo_required('ENFERMAGEM', 'ADMIN', 'GERENTE', 'NAO_CADASTRADO')
@login_required
def listar_justificativas():
    setor = request.args.get("setor")
    leito = request.args.get("leito")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 🔥 QUERY MODIFICADA: selecionar todos os campos
        query = """
            SELECT id, setor, leito, conteudo, data_criacao, data_atualizacao, 
                   criado_por_nome, editado_por_nome, versoes 
            FROM justificativas WHERE 1=1
        """
        params = []
        
        if setor:
            query += " AND setor = %s"
            params.append(setor)
        if leito:
            query += " AND leito = %s"
            params.append(leito)
        
        query += " ORDER BY data_atualizacao DESC"
        
        cursor.execute(query, params)
        justificativas = cursor.fetchall()
        
        # Converter datas para string no formato brasileiro
        for j in justificativas:
            # Converter data_criacao
            if j.get('data_criacao'):
                if isinstance(j['data_criacao'], datetime):
                    j['data_criacao'] = j['data_criacao'].strftime('%d/%m/%Y %H:%M')
                elif isinstance(j['data_criacao'], str) and ' ' in j['data_criacao']:
                    try:
                        dt = datetime.strptime(j['data_criacao'], '%Y-%m-%d %H:%M:%S')
                        j['data_criacao'] = dt.strftime('%d/%m/%Y %H:%M')
                    except:
                        pass
            
            # Converter data_atualizacao
            if j.get('data_atualizacao'):
                if isinstance(j['data_atualizacao'], datetime):
                    j['data_atualizacao'] = j['data_atualizacao'].strftime('%d/%m/%Y %H:%M')
                elif isinstance(j['data_atualizacao'], str) and ' ' in j['data_atualizacao']:
                    try:
                        dt = datetime.strptime(j['data_atualizacao'], '%Y-%m-%d %H:%M:%S')
                        j['data_atualizacao'] = dt.strftime('%d/%m/%Y %H:%M')
                    except:
                        pass
            
            # 🔥 CONVERTER VERSOES DE STRING PARA LISTA
            if j.get('versoes') and isinstance(j['versoes'], str):
                try:
                    j['versoes'] = json.loads(j['versoes'])
                except:
                    j['versoes'] = []
            
            # 🔥 ADICIONAR CONTAGEM DE VERSÕES
            if isinstance(j.get('versoes'), list):
                j['total_versoes'] = len(j['versoes'])
            else:
                j['total_versoes'] = 0
            
            # Garantir nomes
            if 'criado_por_nome' not in j or not j['criado_por_nome']:
                j['criado_por_nome'] = 'Sistema'
            if 'editado_por_nome' not in j or not j['editado_por_nome']:
                j['editado_por_nome'] = 'Sistema'
        
        return jsonify(justificativas)
    except Exception as e:
        print(f"Erro ao listar justificativas: {e}")
        return jsonify({"erro": "Erro ao carregar justificativas"}), 500
    finally:
        cursor.close()
        conn.close()


# Obter uma justificativa específica
@justificativas_bp.route("/api/justificativas/<int:id>", methods=["GET"])
@tipo_required('ENFERMAGEM', 'ADMIN', 'GERENTE', 'NAO_CADASTRADO')
@login_required
def obter_justificativa(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 🔥 QUERY MODIFICADA: selecionar todos os campos
        cursor.execute("""
            SELECT id, setor, leito, conteudo, data_criacao, data_atualizacao, 
                   criado_por_nome, editado_por_nome, versoes 
            FROM justificativas WHERE id = %s
        """, (id,))
        justificativa = cursor.fetchone()
        
        if not justificativa:
            return jsonify({"erro": "Justificativa não encontrada"}), 404
        
        # 🔥 GARANTIR QUE OS CAMPOS DE NOME EXISTEM
        from datetime import datetime
        import json
        
        # Formatar datas
        if justificativa.get('data_criacao'):
            if isinstance(justificativa['data_criacao'], datetime):
                justificativa['data_criacao'] = justificativa['data_criacao'].strftime('%d/%m/%Y %H:%M')
        
        if justificativa.get('data_atualizacao'):
            if isinstance(justificativa['data_atualizacao'], datetime):
                justificativa['data_atualizacao'] = justificativa['data_atualizacao'].strftime('%d/%m/%Y %H:%M')
        
        # Garantir nomes
        if 'criado_por_nome' not in justificativa or not justificativa['criado_por_nome']:
            justificativa['criado_por_nome'] = 'Sistema'
        if 'editado_por_nome' not in justificativa or not justificativa['editado_por_nome']:
            justificativa['editado_por_nome'] = 'Sistema'
        
        # 🔥 CALCULAR TOTAL DE VERSÕES
        total_versoes = 0
        if justificativa.get('versoes'):
            if isinstance(justificativa['versoes'], str):
                try:
                    versoes = json.loads(justificativa['versoes'])
                    total_versoes = len(versoes) if isinstance(versoes, list) else 0
                except:
                    total_versoes = 0
            elif isinstance(justificativa['versoes'], list):
                total_versoes = len(justificativa['versoes'])
        
        # 🔥 ADICIONAR TOTAL_VERSOES AO RETORNO
        justificativa['total_versoes'] = total_versoes
        
        print(f"🔍 Justificativa {id}: {total_versoes} versões encontradas")
        
        return jsonify(justificativa)
    except Exception as e:
        print(f"Erro ao obter justificativa {id}: {e}")
        traceback.print_exc()
        return jsonify({"erro": "Erro ao carregar justificativa"}), 500
    finally:
        cursor.close()
        conn.close()


# Criar nova justificativa
@justificativas_bp.route("/api/justificativas", methods=["POST"])
@tipo_required('ENFERMAGEM', 'ADMIN', 'GERENTE')
@login_required
def criar_justificativa():
    dados = request.json
    
    print(f"📥 Dados recebidos: {dados}")  # Debug
    
    # Validações mais robustas
    if not dados.get("setor"):
        return jsonify({"erro": "Setor é obrigatório"}), 400
    
    if not dados.get("leito"):
        return jsonify({"erro": "Leito é obrigatório"}), 400
    
    # Validar conteúdo (remover tags HTML vazias)
    conteudo = dados.get("conteudo", "").strip()
    if not conteudo or conteudo == "<br>" or conteudo == "<div><br></div>" or conteudo == "<p><br></p>":
        return jsonify({"erro": "Conteúdo da justificativa é obrigatório"}), 400
    
    # 🔥 CAPTURAR O NOME DO USUÁRIO DA SESSÃO
    usuario_logado = session.get("usuario_logado", "Sistema")
    nome_completo = session.get("nome_completo", usuario_logado)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Verificar se já existe justificativa para este setor/leito
        cursor.execute(
            "SELECT id FROM justificativas WHERE setor = %s AND leito = %s",
            (dados["setor"], dados["leito"])
        )
        
        # 🔥 CRIAR O HISTÓRICO INICIAL (VERSÃO 1)
        from datetime import datetime
        agora = datetime.now().strftime('%d/%m/%Y %H:%M')
        
        versao_inicial = [{
            "versao": 1,
            "conteudo": dados["conteudo"],
            "editado_por": nome_completo,
            "data": agora,
            "tipo": "criacao"
        }]
        
        # Converter para JSON string
        import json
        versoes_json = json.dumps(versao_inicial, ensure_ascii=False)
        
        # 🔥 QUERY MODIFICADA: adicionar versoes
        cursor.execute("""
            INSERT INTO justificativas 
            (setor, leito, conteudo, data_criacao, data_atualizacao, 
             criado_por_nome, editado_por_nome, versoes)
            VALUES (%s, %s, %s, NOW(), NOW(), %s, %s, %s)
        """, (dados["setor"], dados["leito"], dados["conteudo"], 
              nome_completo, nome_completo, versoes_json))
        
        conn.commit()
        
        # Buscar a justificativa recém-criada para retornar os dados completos
        cursor.execute("SELECT * FROM justificativas WHERE id = %s", (cursor.lastrowid,))
        nova_justificativa = cursor.fetchone()
        
        # Formatar datas para o frontend
        if nova_justificativa:
            from datetime import datetime
            if nova_justificativa.get('data_criacao'):
                if isinstance(nova_justificativa['data_criacao'], datetime):
                    nova_justificativa['data_criacao'] = nova_justificativa['data_criacao'].strftime('%d/%m/%Y %H:%M')
            if nova_justificativa.get('data_atualizacao'):
                if isinstance(nova_justificativa['data_atualizacao'], datetime):
                    nova_justificativa['data_atualizacao'] = nova_justificativa['data_atualizacao'].strftime('%d/%m/%Y %H:%M')
            
            # 🔥 Garantir que versoes seja um dicionário/list
            if nova_justificativa.get('versoes') and isinstance(nova_justificativa['versoes'], str):
                try:
                    nova_justificativa['versoes'] = json.loads(nova_justificativa['versoes'])
                except:
                    nova_justificativa['versoes'] = []
        
        print(f"✅ Justificativa criada com ID: {cursor.lastrowid} por {nome_completo}")
        
        # ===== EVENTOS =====
        # 🔥 Evento local (para a instância atual)
        
        atualizacao_evento.set()
        
        # 🔥 Evento Redis (para todas as instâncias)
        
        publicar_evento('justificativa_criada', {
            'id': cursor.lastrowid,
            'setor': dados['setor'],
            'leito': dados['leito'],
            'criado_por': nome_completo,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            "mensagem": "Justificativa criada com sucesso",
            "id": cursor.lastrowid,
            "justificativa": nova_justificativa
        }), 201
        
    except Exception as e:
        print(f"❌ Erro ao criar justificativa: {e}")
        conn.rollback()
        return jsonify({"erro": f"Erro ao criar justificativa: {str(e)}"}), 500
        
    finally:
        cursor.close()
        conn.close()


@justificativas_bp.route("/api/justificativas/<int:id>", methods=["PUT"])
@tipo_required('ADMIN', 'GERENTE', 'ENFERMAGEM')
@login_required
def atualizar_justificativa(id):
    dados = request.json
    
    # Validações
    if not dados.get("setor"):
        return jsonify({"erro": "Setor é obrigatório"}), 400
    if not dados.get("leito"):
        return jsonify({"erro": "Leito é obrigatório"}), 400
    if not dados.get("conteudo") or not dados["conteudo"].strip():
        return jsonify({"erro": "Conteúdo da justificativa é obrigatório"}), 400
    
    # 🔥 CAPTURAR O NOME DO USUÁRIO DA SESSÃO
    usuario_logado = session.get("usuario_logado", "Sistema")
    nome_completo = session.get("nome_completo", usuario_logado)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Verificar se a justificativa existe e buscar dados atuais
        cursor.execute("""
            SELECT setor, leito, conteudo, versoes 
            FROM justificativas 
            WHERE id = %s
        """, (id,))
        justificativa_atual = cursor.fetchone()
        
        if not justificativa_atual:
            return jsonify({"erro": "Justificativa não encontrada"}), 404
        
        # 🔥 VERIFICAR SE HOUVE ALGUMA ALTERAÇÃO (setor, leito OU conteudo)
        setor_alterado = justificativa_atual['setor'] != dados['setor']
        leito_alterado = justificativa_atual['leito'] != dados['leito']
        conteudo_alterado = justificativa_atual['conteudo'] != dados['conteudo']
        
        # Se nada mudou, retorna mensagem
        if not setor_alterado and not leito_alterado and not conteudo_alterado:
            return jsonify({"mensagem": "Nenhuma alteração detectada"})
        
        # 🔥 PROCESSSAR VERSÕES (APENAS SE O CONTEÚDO MUDOU)
        import json
        from datetime import datetime
        
        # Pegar versões existentes ou criar lista vazia
        versoes = []
        if justificativa_atual['versoes']:
            if isinstance(justificativa_atual['versoes'], str):
                try:
                    versoes = json.loads(justificativa_atual['versoes'])
                except:
                    versoes = []
            elif isinstance(justificativa_atual['versoes'], (list, dict)):
                versoes = justificativa_atual['versoes']
        
        # Garantir que versoes é uma lista
        if not isinstance(versoes, list):
            versoes = []
        
        # 🔥 SÓ ADICIONAR AO HISTÓRICO SE O CONTEÚDO MUDOU
        if conteudo_alterado:
            # Calcular próximo número de versão
            proxima_versao = len(versoes) + 1
            
            # Criar nova entrada no histórico
            agora = datetime.now().strftime('%d/%m/%Y %H:%M')
            
            nova_versao = {
                "versao": proxima_versao,
                "conteudo": dados["conteudo"],
                "conteudo_anterior": justificativa_atual['conteudo'],
                "editado_por": nome_completo,
                "data": agora,
                "tipo": "edicao"
            }
            
            # Adicionar ao histórico
            versoes.append(nova_versao)
            print(f"📝 Nova versão {proxima_versao} criada para justificativa {id}")
        else:
            print(f"ℹ️ Conteúdo não alterado, mantendo versões atuais")
            proxima_versao = len(versoes)  # Versão atual (não muda)
        
        # Converter para JSON
        versoes_json = json.dumps(versoes, ensure_ascii=False)
        
        # 🔥 QUERY MODIFICADA: atualizar tudo (setor, leito e/ou conteudo)
        cursor.execute("""
            UPDATE justificativas 
            SET setor = %s, leito = %s, conteudo = %s, 
                data_atualizacao = NOW(),
                editado_por_nome = %s,
                versoes = %s
            WHERE id = %s
        """, (dados["setor"], dados["leito"], dados["conteudo"], 
              nome_completo, versoes_json, id))
        
        conn.commit()
        
        # 🔥 LOG DETALHADO
        alteracoes = []
        if setor_alterado:
            alteracoes.append(f"setor: {justificativa_atual['setor']} → {dados['setor']}")
        if leito_alterado:
            alteracoes.append(f"leito: {justificativa_atual['leito']} → {dados['leito']}")
        if conteudo_alterado:
            alteracoes.append(f"conteúdo (versão {proxima_versao})")
        
        print(f"✅ Justificativa {id} atualizada por {nome_completo}")
        print(f"📋 Alterações: {', '.join(alteracoes)}")
        
        # ===== EVENTOS =====
        # 🔥 Evento local (para a instância atual)
        
        atualizacao_evento.set()
        
        
        
        # Determinar o tipo de alteração para o evento
        if conteudo_alterado:
            tipo_alteracao = "conteudo"
            versao = proxima_versao
        elif setor_alterado or leito_alterado:
            tipo_alteracao = "localizacao"
            versao = len(versoes)  # Versão atual (não mudou)
        else:
            tipo_alteracao = "outros"
            versao = None
        
        publicar_evento('justificativa_atualizada', {
            'id': id,
            'setor': dados['setor'],
            'leito': dados['leito'],
            'editado_por': nome_completo,
            'tipo_alteracao': tipo_alteracao,
            'versao': versao,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            "mensagem": "Justificativa atualizada com sucesso",
            "versao": proxima_versao if conteudo_alterado else None,
            "alteracoes": alteracoes
        })
        
    except Exception as e:
        print(f"❌ Erro ao atualizar justificativa {id}: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"erro": "Erro ao atualizar justificativa"}), 500
    finally:
        cursor.close()
        conn.close()

@justificativas_bp.route("/api/justificativas/<int:id>", methods=["DELETE"])
@tipo_required('ADMIN', 'GERENTE', 'ENFERMAGEM')
@login_required
def excluir_justificativa(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Verificar se a justificativa existe
        cursor.execute("SELECT id FROM justificativas WHERE id = %s", (id,))
        if not cursor.fetchone():
            return jsonify({"erro": "Justificativa não encontrada"}), 404
        
        # Excluir justificativa
        cursor.execute("DELETE FROM justificativas WHERE id = %s", (id,))
        conn.commit()
        
        # ===== EVENTOS =====
       
        atualizacao_evento.set()
        
       
        publicar_evento('justificativa_excluida', {
            'id': id,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({"mensagem": "Justificativa excluída com sucesso"})
        
    except Exception as e:
        print(f"❌ Erro ao excluir justificativa {id}: {e}")
        conn.rollback()
        return jsonify({"erro": "Erro ao excluir justificativa"}), 500
    finally:
        cursor.close()
        conn.close()


# Rota para verificar se já existe justificativa para um setor/leito (opcional)
@justificativas_bp.route("/api/justificativas/verificar", methods=["GET"])
@tipo_required('ADMIN', 'GERENTE', 'NAO_CADASTRADO', 'ENFERMAGEM')
@login_required
def verificar_justificativa():
    setor = request.args.get("setor")
    leito = request.args.get("leito")
    
    if not setor or not leito:
        return jsonify({"erro": "Setor e leito são obrigatórios"}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id FROM justificativas WHERE setor = %s AND leito = %s",
            (setor, leito)
        )
        existe = cursor.fetchone() is not None
        
        return jsonify({"existe": existe})
    except Exception as e:
        print(f"Erro ao verificar justificativa: {e}")
        return jsonify({"erro": "Erro ao verificar justificativa"}), 500
    finally:
        cursor.close()
        conn.close()


# 🔥 NOVA ROTA: Obter histórico de versões de uma justificativa
@justificativas_bp.route("/api/justificativas/<int:id>/versoes", methods=["GET"])
@tipo_required('ADMIN', 'GERENTE', 'NAO_CADASTRADO', 'ENFERMAGEM')
@login_required
def listar_versoes_justificativa(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT versoes FROM justificativas WHERE id = %s", (id,))
        resultado = cursor.fetchone()
        
        if not resultado:
            return jsonify({"erro": "Justificativa não encontrada"}), 404
        
        import json
        versoes = []
        if resultado['versoes']:
            if isinstance(resultado['versoes'], str):
                try:
                    versoes = json.loads(resultado['versoes'])
                except:
                    versoes = []
            elif isinstance(resultado['versoes'], list):
                versoes = resultado['versoes']
        
        return jsonify({
            "justificativa_id": id,
            "total_versoes": len(versoes),
            "versoes": versoes
        })
        
    except Exception as e:
        print(f"Erro ao listar versões: {e}")
        return jsonify({"erro": "Erro ao carregar versões"}), 500
    finally:
        cursor.close()
        conn.close()