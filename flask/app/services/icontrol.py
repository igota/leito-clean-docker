import requests
import unicodedata
import urllib3
from typing import List, Dict, Any

urllib3.disable_warnings()


def _remover_acentos(texto: str) -> str:
    """Remove acentos/cedilha (ex.: 'GRAÇAS' -> 'GRACAS'), pois o iControl
    faz a busca de forma sensível a acento e os cadastros costumam estar sem eles."""
    nfkd = unicodedata.normalize('NFKD', texto)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


class BuscaCredencial:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.base_url = 'https://172.22.61.250:8889'
        self.logado = False

    def login(self) -> bool:
        login_data = {'Login': 'igor', 'Senha': '123456'}
        try:
            response = self.session.post(
                f'{self.base_url}/usuariosistema/login',
                data=login_data,
                allow_redirects=False
            )
            if response.status_code == 302:
                self.logado = True
                return True
            return False
        except Exception as e:
            print(f"❌ Erro no login iControl: {e}")
            return False

    def buscar_por_nome(self, nome: str) -> List[Dict[str, Any]]:
        """Busca pessoas pelo nome (coluna 2)"""
        form = self._montar_form_base()
        form['columns[2][search][value]'] = _remover_acentos(nome)
        return self._executar_busca(form)

    def buscar_por_identificador(self, identificador: str) -> List[Dict[str, Any]]:
        """Busca pessoas pelo identificador (coluna 5)"""
        form = self._montar_form_base()
        form['columns[5][search][value]'] = _remover_acentos(identificador)
        return self._executar_busca(form)

    def _montar_form_base(self) -> dict:
        colunas = [
            {'data': 'IdCredencial',     'name': '',                'searchable': 'false', 'orderable': 'false'},
            {'data': 'TipoCredencial',   'name': 'TipoCredencial',  'searchable': 'true',  'orderable': 'true'},
            {'data': 'Nome',             'name': 'Nome',            'searchable': 'true',  'orderable': 'true'},
            {'data': 'NumeroCartao',     'name': 'NumeroCartao',    'searchable': 'true',  'orderable': 'true'},
            {'data': 'CodigoInstalacao', 'name': 'CodigoInstalacao','searchable': 'true',  'orderable': 'true'},
            {'data': 'Identificador',    'name': 'Identificador',   'searchable': 'true',  'orderable': 'true'},
            {'data': 'TipoUsuario',      'name': 'TipoUsuario',     'searchable': 'true',  'orderable': 'true'},
            {'data': 'IdCredencial',     'name': '',                'searchable': 'false', 'orderable': 'false'},
        ]
        form: dict = {
            'draw': 1, 'start': 0, 'length': 50,
            'search[value]': '', 'search[regex]': 'false',
            'order[0][column]': 2, 'order[0][dir]': 'asc',
        }
        for i, col in enumerate(colunas):
            form[f'columns[{i}][data]']            = col['data']
            form[f'columns[{i}][name]']            = col['name']
            form[f'columns[{i}][searchable]']      = col['searchable']
            form[f'columns[{i}][orderable]']       = col['orderable']
            form[f'columns[{i}][search][value]']   = ''
            form[f'columns[{i}][search][regex]']   = 'false'
        return form

    def _executar_busca(self, form_data: dict) -> List[Dict[str, Any]]:
        if not self.logado:
            if not self.login():
                return []
        headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': f'{self.base_url}/credencial',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        }
        try:
            response = self.session.post(f'{self.base_url}/credencial', data=form_data, headers=headers)
            if response.status_code != 200:
                return []
            data = response.json()
            resultados = []
            for p in data.get('data') or []:
                resultados.append({
                    'id_credencial':     p.get('IdCredencial'),
                    'tipo_credencial':   p.get('TipoCredencial'),
                    'nome':              p.get('Nome'),
                    'numero_cartao':     p.get('NumeroCartao'),
                    'codigo_instalacao': p.get('CodigoInstalacao'),
                    'identificador':     p.get('Identificador'),
                    'tipo_usuario':      p.get('TipoUsuario'),
                    'status':            p.get('Status'),
                })
            return resultados
        except Exception as e:
            print(f"❌ Erro na requisição ao iControl: {e}")
            return []
