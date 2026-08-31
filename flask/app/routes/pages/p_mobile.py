from flask import Blueprint, render_template

from ...config.settings import TEMPO_MINIMO_LIMPEZA_PADRAO, TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO

# Criar o blueprint
mobile_bp = Blueprint('mobile', __name__)


@mobile_bp.route("/tablet")
def tablet_inicio():
    return render_template("tabletInicio.html")


@mobile_bp.route("/tablet_limpeza_ativa")
def tablet_limpeza_ativa():
    return render_template(
        "tabletLimpezaAtiva.html",
        tempo_minimo_limpeza_padrao=TEMPO_MINIMO_LIMPEZA_PADRAO,
        tempo_minimo_limpeza_centro_cirurgico=TEMPO_MINIMO_LIMPEZA_CENTRO_CIRURGICO,
    )


@mobile_bp.route("/tablet_leitos")
def tablet_leitos():
    return render_template("tabletLeitos.html")


@mobile_bp.route("/tablet_setores")
def tablet_setores():
    return render_template("tabletSetores.html")


@mobile_bp.route("/tablet_limpeza")
def tablet_limpeza():
    return render_template("tabletLimpeza.html")