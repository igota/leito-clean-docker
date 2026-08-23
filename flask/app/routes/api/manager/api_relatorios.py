from flask import Blueprint, request, jsonify, session
import pymysql
from ....database.conexao import get_db_connection
from ....utils.helpers import login_required, tipo_required
from datetime import datetime, timedelta
from ....reports.csv import exportar_csv
from ....reports.pdf import exportar_pdf
from ....reports.xlsx import exportar_xlsx


# Criar o blueprint
relatorios_bp = Blueprint('relatorios', __name__)


@relatorios_bp.route("/api/relatorios/leitos_registrados", methods=["GET"])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def leitos_registrados_por_setor():
    setor = request.args.get("setor")
    data_inicio = request.args.get("data_inicio")
    data_validacao = request.args.get("data_validacao")

    if not setor:
        return jsonify([])

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:

            sql = """
                SELECT DISTINCT numero_leito
                FROM registro_limpeza
                WHERE setor = %s
                  AND numero_leito REGEXP '^[0-9]+$'
            """
            params = [setor]

            # 🔹 Aplica período se informado
            if data_inicio and data_validacao:
                sql += " AND data_inicio BETWEEN %s AND %s"
                params.extend([data_inicio, data_validacao])

            elif data_inicio:
                sql += " AND data_inicio >= %s"
                params.append(data_inicio)

            elif data_validacao:
                sql += " AND data_inicio <= %s"
                params.append(data_validacao)

            sql += " ORDER BY CAST(numero_leito AS UNSIGNED)"

            cursor.execute(sql, params)

            leitos = [row["numero_leito"] for row in cursor.fetchall()]

        return jsonify(leitos)

    except Exception as e:
        print("❌ Erro ao listar leitos com período:", e)
        return jsonify([]), 500

    finally:
        conn.close()


@relatorios_bp.route("/api/relatorios/dados", methods=["GET"])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def dados_relatorio():
    setor = request.args.get("setor")
    leito = request.args.get("leito")
    tipo_limpeza = request.args.get("tipo_limpeza")
    status = request.args.get("status")
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT
                    rl.setor,
                    rl.numero_leito,
                    rl.paciente,
                    rl.tipo_limpeza,
                    rl.data_inicio,
                    rl.data_fim,
                    rl.data_validacao,
                    CASE
                        WHEN rl.asg_intervalo IS NOT NULL AND rl.asg_intervalo != rl.funcionario_asg_id
                        THEN CONCAT(asg.nome, ' / ', asg_int.nome)
                        ELSE asg.nome
                    END as funcionario_asg,
                    enf.nome as funcionario_enf,
                    rl.tempo_total_text,
                    rl.status,
                    rl.vencimento
                FROM registro_limpeza rl
                LEFT JOIN funcionarios asg ON rl.funcionario_asg_id = asg.id
                LEFT JOIN funcionarios asg_int ON rl.asg_intervalo = asg_int.id
                LEFT JOIN funcionarios enf ON rl.funcionario_enf_id = enf.id
                WHERE 1=1
            """
            params = []

            if setor and setor != "__TODOS__":
                sql += " AND rl.setor = %s"
                params.append(setor)

            if leito and leito != "__TODOS__":
                sql += " AND rl.numero_leito = %s"
                params.append(leito)

            if tipo_limpeza and tipo_limpeza != "__TODOS__":
                sql += " AND rl.tipo_limpeza = %s"
                params.append(tipo_limpeza)

            if status and status != "__TODOS__":
                sql += " AND rl.status = %s"
                params.append(status)

            if inicio and fim:
                inicio_dt = datetime.strptime(inicio, "%Y-%m-%d")
                fim_dt = datetime.strptime(fim, "%Y-%m-%d") + timedelta(days=1)
                sql += " AND rl.data_inicio >= %s AND rl.data_inicio < %s"
                params.extend([inicio_dt, fim_dt])

            sql += " ORDER BY rl.data_inicio ASC"

            cursor.execute(sql, params)
            rows = cursor.fetchall()

        # Conversão explícita de datas para strings locais
        dados = []
        for row in rows:
            d = dict(row)

            if d.get("data_inicio"):
                d["data_inicio"] = d["data_inicio"].strftime("%Y-%m-%d %H:%M:%S")

            if d.get("data_fim"):
                d["data_fim"] = d["data_fim"].strftime("%Y-%m-%d %H:%M:%S")

            if d.get("data_validacao"):
                d["data_validacao"] = d["data_validacao"].strftime("%Y-%m-%d %H:%M:%S")

            if d.get("vencimento"):
                d["vencimento"] = d["vencimento"].strftime("%Y-%m-%d %H:%M:%S")

            dados.append(d)

        return jsonify(dados)

    except Exception as e:
        print("❌ Erro ao carregar dados do relatório:", e)
        return jsonify({"erro": str(e)}), 500

    finally:
        conn.close()


@relatorios_bp.route("/api/relatorios/exportar", methods=["GET"])
@tipo_required('ADMIN', 'GERENTE')
@login_required 
def exportar_relatorio():

    setor = request.args.get("setor")
    leito = request.args.get("leito")
    tipo_limpeza = request.args.get("tipo_limpeza")
    status = request.args.get("status")
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    formato = request.args.get("formato")

    conn = get_db_connection()

    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:

            # ✅ SQL com JOINs para pegar nomes dos funcionários
            sql = """
                SELECT
                    rl.setor,
                    rl.numero_leito,
                    rl.paciente,
                    rl.tipo_limpeza,
                    rl.data_inicio,
                    rl.data_fim,
                    rl.data_validacao,
                    CASE
                        WHEN rl.asg_intervalo IS NOT NULL AND rl.asg_intervalo != rl.funcionario_asg_id
                        THEN CONCAT(asg.nome, ' / ', asg_int.nome)
                        ELSE asg.nome
                    END as funcionario_asg,
                    enf.nome as funcionario_enf,
                    rl.tempo_total_text,
                    rl.status,
                    rl.vencimento
                FROM registro_limpeza rl
                LEFT JOIN funcionarios asg ON rl.funcionario_asg_id = asg.id
                LEFT JOIN funcionarios asg_int ON rl.asg_intervalo = asg_int.id
                LEFT JOIN funcionarios enf ON rl.funcionario_enf_id = enf.id
                WHERE 1=1
            """

            params = []

            # filtros só CONCATENAM
            if setor and setor != "__TODOS__":
                sql += " AND rl.setor = %s"
                params.append(setor)

            if leito:
                sql += " AND rl.numero_leito = %s"
                params.append(leito)

            if tipo_limpeza:
                sql += " AND rl.tipo_limpeza = %s"
                params.append(tipo_limpeza)

            if status:
                sql += " AND rl.status = %s"
                params.append(status)

            if inicio and fim:
                sql += """
                    AND rl.data_inicio >= %s
                    AND rl.data_inicio < DATE_ADD(%s, INTERVAL 1 DAY)
                """
                params.extend([inicio, fim])

            sql += " ORDER BY rl.data_inicio ASC"

            # 👇 executa a query
            cursor.execute(sql, params)
            dados = cursor.fetchall()

    except Exception as e:
        print(f"❌ Erro ao exportar relatório: {e}")
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

    # decisão do formato (fora do try)
    if not dados:
        return "Nenhum dado para exportar", 404

    if formato == "csv":
        return exportar_csv(dados)

    if formato == "xlsx":
        return exportar_xlsx(dados)

    if formato == "pdf":
        return exportar_pdf(dados)

    return "Formato inválido", 400