from flask import Blueprint, request, jsonify, session
import pymysql
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
import os
import json
import logging
from pymysql import IntegrityError
from ....services.integracao_vitae import obter_lista_todos_setores, salvar_setores_json
from ....config.settings import SETORES_JSON
import traceback

# Criar o blueprint
setores_bp = Blueprint('setores', __name__)


@setores_bp.route('/api/setores', methods=['GET'])
def get_setores():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
        SELECT 
            s.nome as setor,
            d.ip,
            s.qtd_leitos
        FROM setores s
        LEFT JOIN dispositivos d ON s.id_dispositivo = d.id
        WHERE s.status = TRUE
        ORDER BY s.nome;
        """)
        dados = cursor.fetchall()
    conn.close()
    return jsonify(dados)


@setores_bp.route('/api/setores_painel', methods=['GET'])
def get_setores_painel():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
        SELECT 
            s.nome as setor,
            d.ip,
            s.qtd_leitos
        FROM setores s
        LEFT JOIN dispositivos d ON s.id_dispositivo = d.id
        WHERE s.status = TRUE
        ORDER BY s.nome;
        """)
        dados = cursor.fetchall()
    conn.close()
    return jsonify(dados)


@setores_bp.route("/api/ler_setores_json", methods=['GET'])
def ler_setores_json():
    """
    Rota para retornar os setores salvos no JSON local.
    """
    try:
        if not os.path.exists(SETORES_JSON):
            return jsonify([]), 200  # Retorna lista vazia se o JSON não existir

        with open(SETORES_JSON, "r", encoding="utf-8") as f:
            try:
                setores = json.load(f)
            except json.JSONDecodeError:
                print(f"⚠️ JSON corrompido: {SETORES_JSON}")
                setores = []

        return jsonify(setores), 200

    except Exception as e:
        print(f"Erro ao ler JSON de setores: {e}")
        return jsonify({"error": "Falha ao ler lista de setores"}), 500


@setores_bp.route("/api/atualizar_setores", methods=['POST'])
def atualizar_setores():
    """
    Rota para atualizar setores: faz scraping e salva no JSON local.
    Retorna a lista atualizada para o front-end.
    """
    try:
        setores = obter_lista_todos_setores()
        if not setores:
            return jsonify({"status": "erro", "mensagem": "Nenhum setor encontrado"}), 404

        salvar_setores_json(setores)
        return jsonify({"status": "ok", "setores": setores, "quantidade": len(setores)}), 200

    except Exception as e:
        logging.error(f"Erro na rota /atualizar_setores: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500       


@setores_bp.route("/api/config/setores", methods=["POST"])
@login_required  # PRIMEIRO verifica login
@tipo_required('ADMIN')  # DEPOIS verifica permissão
def salvar_setores():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        id_setor = request.form.get("id")
        nome = request.form["nome"].strip()
        qtd_leitos = request.form["qtd_leitos"]
        id_dispositivo = request.form.get("id_dispositivo") or None
        status = 1 if request.form.get("status") == "on" else 0

        # 🔍 LOG PARA DEBUG
        print(f"\n{'='*50}")
        print(f"📝 Salvar setor - ID: {id_setor}, Nome: {nome}")
        print(f"{'='*50}")

        if id_setor:
            cursor.execute("""
                UPDATE setores
                SET nome=%s, qtd_leitos=%s,
                    id_dispositivo=%s, status=%s
                WHERE id=%s
            """, (nome, qtd_leitos, id_dispositivo, status, id_setor))
            mensagem = "✅ Setor atualizado com sucesso!"
        else:
            cursor.execute("""
                INSERT INTO setores (nome, qtd_leitos, id_dispositivo, status)
                VALUES (%s, %s, %s, %s)
            """, (nome, qtd_leitos, id_dispositivo, status))
            mensagem = "✅ Setor cadastrado com sucesso!"

        conn.commit()
        
        return jsonify({
            'success': True,
            'message': mensagem,
            'type': 'success'
        })

    except IntegrityError as e:  # Captura erro de chave duplicada
        conn.rollback()
        
        # 🔥 TRATAMENTO ESPECÍFICO PARA SETOR DUPLICADO
        if "Duplicate entry" in str(e):
            print(f"⚠️ Tentativa de cadastrar setor duplicado: {nome}")
            return jsonify({
                'success': False,
                'message': f'❌ Já existe um setor com o nome "{nome}"',
                'type': 'danger'
            }), 400  # Bad Request
        
        # Outro erro de integridade
        print(f"Erro de integridade: {e}")
        return jsonify({
            'success': False,
            'message': 'Erro ao salvar setor (restrição de banco)',
            'type': 'danger'
        }), 400

    except Exception as e:
        conn.rollback()
        print("❌ Erro inesperado:", e)
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'message': f'Erro interno: {str(e)}',
            'type': 'danger'
        }), 500

    finally:
        cursor.close()
        conn.close()    


@setores_bp.route("/api/setores_completos", methods=["GET"])
@tipo_required('ADMIN')
@login_required
def listar_setores_completos_api():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            s.id, 
            s.nome, 
            s.qtd_leitos, 
            s.id_dispositivo, 
            s.status,
            d.ip as dispositivo_ip,
            d.nome as dispositivo_nome  
        FROM setores s
        LEFT JOIN dispositivos d ON s.id_dispositivo = d.id
        ORDER BY s.nome
    """)
    
    setores = cursor.fetchall()
    cursor.close()
    conn.close()
    
    setores_list = []
    for s in setores:
        setores_list.append({
            'id': s['id'],
            'nome': s['nome'],
            'qtd_leitos': s['qtd_leitos'],
            'id_dispositivo': s['id_dispositivo'],
            'dispositivo_ip': s['dispositivo_ip'],
            'dispositivo_nome': s['dispositivo_nome'],  
            'status': s['status']
        })
    
    return jsonify(setores_list)