from flask import Blueprint, render_template, request, session, redirect, url_for, current_app
import logging
from ...services.integracao_vitae import login_if_needed
from ...database.conexao import get_db_connection
from ...utils.helpers import login_required, tipo_required
from app.config.settings import redis_client
import json

# Criar o blueprint
manager_bp = Blueprint('manager', __name__)

# Variável global driver (se necessário)
driver = None

@manager_bp.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if not username or not password:
            return render_template(
                "index.html",
                error="Usuário e Senha são obrigatórios."
            )

        resultado_login = login_if_needed(username, password)
        
        if resultado_login and resultado_login.get("success"):
            session.clear()

            conn = get_db_connection()
            cursor = conn.cursor()

            try:
                cursor.execute(
                    "SELECT id, tipo, status, nome FROM usuarios WHERE login = %s",
                    (username.upper(),)
                )
                usuario = cursor.fetchone()

                from ...config.settings import TEMPOS_SESSAO, SESSION_REDIS
                from ...events.redis_events import redis_client
                import uuid
                import json

                username_upper = username.upper()

                # ===== DEFINE TIPO E TTL =====
                if usuario and usuario['status'] == 1:
                    tipo_usuario = usuario['tipo']

                    cursor.execute("""
                        UPDATE usuarios 
                        SET nome = %s, ultimo_acesso = NOW() 
                        WHERE login = %s
                    """, (resultado_login.get("nome_completo", username_upper), username_upper))

                    if tipo_usuario == 'ADMIN':
                        tempo_ttl = TEMPOS_SESSAO['ADMIN']
                    elif tipo_usuario == 'GERENTE':
                        tempo_ttl = TEMPOS_SESSAO['GERENTE']
                    else:
                        tempo_ttl = TEMPOS_SESSAO['NAO_CADASTRADO']

                else:
                    tipo_usuario = 'NAO_CADASTRADO'
                    tempo_ttl = TEMPOS_SESSAO['NAO_CADASTRADO']

                logging.info(f"👤 {tipo_usuario} {username_upper} - TTL {tempo_ttl}s")

                conn.commit()

                # ===== 🔒 BLOQUEIO DE LOGIN DUPLO =====
                chave_usuario = f"user_session:{username_upper}"
                sessao_antiga = SESSION_REDIS.get(chave_usuario)

                if sessao_antiga:
                    SESSION_REDIS.delete(f"sessao:{sessao_antiga}")
                    logging.info(f"🚫 Sessão antiga derrubada: {sessao_antiga}")

                    # 🔥 DISPARA EVENTO SSE
                # Quando derruba sessão antiga
                redis_client.publish("logout", json.dumps({
                    "evento": "logout",  # 👈 Mudar de "tipo" para "evento"
                    "session_id": sessao_antiga,
                    "motivo": "Você foi desconectado porque entrou em outro dispositivo."
                }))

                # ===== 🔥 CRIA NOVA SESSÃO =====
                session_id = str(uuid.uuid4())

                dados_sessao = {
                    "usuario": username_upper,
                    "nome": resultado_login.get("nome_completo", username_upper),
                    "tipo": tipo_usuario
                }

                SESSION_REDIS.setex(
                    f"sessao:{session_id}",
                    tempo_ttl,
                    json.dumps(dados_sessao)
                )

                # 🔥 Vincula usuário → sessão atual
                SESSION_REDIS.set(chave_usuario, session_id)

                # ===== COOKIE PERSONALIZADO =====
                session['session_id'] = session_id

                logging.info(f"✅ Sessão criada: sessao:{session_id} TTL={tempo_ttl}s")

            except Exception as e:
                logging.error(f"Erro ao processar usuário: {e}")
                return render_template("index.html", error="Erro interno")

            finally:
                cursor.close()
                conn.close()

            # 🔥 CRIA RESPOSTA COM COOKIE PERSONALIZADO
            response = redirect(url_for("manager.pagina_principal"))
            response.set_cookie(
                'session_id', 
                session_id, 
                max_age=tempo_ttl, 
                httponly=True, 
                samesite='Lax',
                path='/'
            )
            return response

        return render_template(
            "index.html",
            error="Usuário ou Senha incorretos."
        )

    # ===== GET: VERIFICA PARÂMETRO DE LOGOUT =====
    motivo = request.args.get("logout")
    mensagem = None

    if motivo == "duplicado":
        mensagem = "Você foi desconectado porque entrou em outro dispositivo."
    elif motivo == "expirado":
        mensagem = "Sua sessão atingiu o tempo limite."

    return render_template("index.html", motivo_logout=mensagem)

@manager_bp.route("/pagina_principal")
@login_required
@tipo_required('ADMIN', 'GERENTE', 'NAO_CADASTRADO')
def pagina_principal():
    """Página principal - acesso controlado por tipo"""
    
    # Se for não cadastrado, mostra apenas o painel
    if session.get('tipo_usuario') == 'NAO_CADASTRADO':
        return render_template("paginaPrincipal.html", modo_painel=True)
    
    # ADMIN e GERENTE veem o sistema completo
    return render_template("paginaPrincipal.html")


@manager_bp.route('/gerenciar_funcionarios')
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def gerenciar_funcionarios():
    return render_template('paginaFuncionarios.html')


@manager_bp.route("/config")
@tipo_required('ADMIN')
@login_required 
def config():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Buscar dispositivos
    cursor.execute("""
        SELECT id, nome, ip, status
        FROM dispositivos
        ORDER BY ip
    """)
    dispositivos = cursor.fetchall()

    # Buscar setores com JOIN para pegar o IP do dispositivo vinculado
    cursor.execute("""
        SELECT 
            s.id, 
            s.nome, 
            s.qtd_leitos, 
            s.id_dispositivo, 
            s.status,
            d.ip as dispositivo_ip
        FROM setores s
        LEFT JOIN dispositivos d ON s.id_dispositivo = d.id
        ORDER BY s.nome
    """)
    setores = cursor.fetchall()

    # BUSCAR USUÁRIOS
    cursor.execute("""
        SELECT id, login, nome, email, tipo, notificacoes, ultimo_acesso, status
        FROM usuarios
        ORDER BY nome
    """)
    usuarios = cursor.fetchall()

    # Para cada usuário, buscar os setores que ele monitora
    for user in usuarios:
        # Buscar nomes dos setores para exibição na tabela
        cursor.execute("""
            SELECT s.nome
            FROM setores s
            INNER JOIN notificacoes_emails ne ON s.id = ne.setor_id
            WHERE ne.usuario_id = %s AND ne.receber_notificacoes = 1
        """, (user['id'],))
        setores_nomes = cursor.fetchall()
        user['setores_notificacao'] = [s['nome'] for s in setores_nomes]
        
        # Buscar IDs dos setores para o botão de editar
        cursor.execute("""
            SELECT s.id
            FROM setores s
            INNER JOIN notificacoes_emails ne ON s.id = ne.setor_id
            WHERE ne.usuario_id = %s AND ne.receber_notificacoes = 1
        """, (user['id'],))
        setores_ids = cursor.fetchall()
        user['setores_ids'] = [s['id'] for s in setores_ids]
        
        # LOG para debug (remova depois)
        print(f"Usuário {user['nome']}: notificacoes={user['notificacoes']}, setores={user['setores_ids']}")

    cursor.close()
    conn.close()

    return render_template(
        "paginaConfig.html",
        dispositivos=dispositivos,
        setores=setores,
        usuarios=usuarios
    )


@manager_bp.route("/relatorios")
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def pagina_relatorios():
    return render_template("paginaRelatorios.html")


@manager_bp.route("/relatorios/previa")
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def previa_relatorio():
    return render_template("previaRelatorio.html")


@manager_bp.route('/gerenciar_limpezas')
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def gerenciar_limpezas():
    return render_template('paginaCadastroLimpeza.html')


@manager_bp.route('/gerenciar_justificativas')
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def gerenciar_justificativas():
    return render_template('paginaJustificativas.html')       


@manager_bp.route("/logout")
@tipo_required('ADMIN', 'GERENTE', 'NAO_CADASTRADO')
@login_required
def logout():
    global driver
    
    # 🔥 Pega session_id da sessão Flask
    session_id = session.get('session_id')
    
    # 🔥 Remove a sessão do Redis
    if session_id:
        from ...config.settings import SESSION_REDIS
        import json
        
        # Remove a sessão
        SESSION_REDIS.delete(f"sessao:{session_id}")
        
        # Remove o vínculo usuário → sessão
        usuario = session.get('usuario_logado')
        if usuario:
            chave_usuario = f"user_session:{usuario}"
            SESSION_REDIS.delete(chave_usuario)
        
        logging.info(f"🚪 Logout: sessão {session_id} removida do Redis")
    
    # Limpa a sessão Flask
    session.clear()
    
    # Fecha driver se existir
    if driver:
        driver.quit()
        driver = None
    
    # 🔥 Cria resposta e remove o cookie personalizado
    response = redirect(url_for("manager.index"))
    response.delete_cookie('session_id', path='/')
    
    return response