from flask import Blueprint, render_template

# Criar o blueprint
mobile_bp = Blueprint('mobile', __name__)


@mobile_bp.route("/tablet")
def tablet_inicio():
    return render_template("tabletInicio.html")


@mobile_bp.route("/tablet_limpeza_ativa")
def tablet_limpeza_ativa():
    return render_template("tabletLimpezaAtiva.html")


@mobile_bp.route("/tablet_leitos")
def tablet_leitos():
    return render_template("tabletLeitos.html")


@mobile_bp.route("/tablet_setores")
def tablet_setores():
    return render_template("tabletSetores.html")


@mobile_bp.route("/tablet_limpeza")
def tablet_limpeza():
    return render_template("tabletLimpeza.html")