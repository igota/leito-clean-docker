
from collections import Counter
import html
import os
import time
from typing import Dict, List
from ..config.settings import SETORES_JSON, DATA_DIR, LOGIN_URL, BASE_URL, PAGINA_PRINCIPAL, PEP_URL, USERNAME, PASSWORD
from ..database.conexao import get_db_connection
from bs4 import BeautifulSoup
from flask import json
import requests
import logging


def login_if_needed(username, password):
    """
    Função para login e navegação até a página de prontuário (Principal)
    Retorna um dicionário com success e nome_completo
    """
    
   
   
    

    session_http = requests.Session()

    try:
        # =========================
        # 1️⃣ GET login.jsf (captura ViewState + cookie)
        # =========================
        resp_get = session_http.get(LOGIN_URL, timeout=5)

        if resp_get.status_code != 200:
            logging.error("Falha ao acessar login.jsf")
            return {"success": False}

        soup = BeautifulSoup(resp_get.text, "html.parser")
        viewstate_input = soup.find("input", {"name": "javax.faces.ViewState"})

        if not viewstate_input:
            logging.error("ViewState não encontrado")
            return {"success": False}

        viewstate = viewstate_input["value"]

        # =========================
        # 2️⃣ POST login
        # =========================
        payload = {
            "formulario": "formulario",
            "login": username,
            "xyb-ac": password,
            "formulario:botaoLogin": "confirmar",
            "formulario:host": "10.2.2.8:8080",
            "javax.faces.ViewState": viewstate
        }

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0"
        }

        resp_post = session_http.post(
            LOGIN_URL,
            data=payload,
            headers=headers,
            timeout=5,
            allow_redirects=True
        )

        # =========================
        # 3️⃣ Teste REAL de autenticação
        # =========================
        resp_check = session_http.get(
            PAGINA_PRINCIPAL,
            timeout=5,
            allow_redirects=True
        )

        # Se foi redirecionado para login → falhou
        if "login.jsf" in resp_check.url.lower():
            return {"success": False}

        # =========================
        # 4️⃣ Capturar o nome completo do usuário
        # =========================
        nome_completo = extrair_nome_usuario(resp_check.text)
        
        if nome_completo:
            logging.info(f"Nome completo capturado: {nome_completo}")
            return {
                "success": True,
                "nome_completo": nome_completo
            }
        else:
            # Se não conseguir capturar o nome, retorna apenas o sucesso
            logging.warning(f"Não foi possível capturar o nome completo para {username}")
            return {
                "success": True,
                "nome_completo": username.upper()
            }

    except requests.exceptions.Timeout:
        logging.error("Timeout na requisição HTTP")
        return {"success": False}
    except requests.exceptions.ConnectionError:
        logging.error("Erro de conexão com o servidor")
        return {"success": False}
    except Exception as e:
        logging.error(f"Erro no login HTTP: {e}")
        return {"success": False}


def extrair_nome_usuario(html_content):
    """
    Extrai o nome completo do usuário do HTML da página principal
    XPath alvo: /html/body/div[2]/form/div[6]/div[1]/span
    """
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        
        # =============================================
        # ESTRATÉGIA 1: Seguir a estrutura exata do XPath
        # =============================================
        try:
            # Encontra o body
            body = soup.find("body")
            if body:
                # Encontra todos os divs filhos diretos do body
                body_divs = body.find_all("div", recursive=False)
                
                # Pega o segundo div (índice 1, já que Python é 0-based)
                if len(body_divs) >= 2:
                    div_2 = body_divs[1]  # div[2] no XPath
                    
                    # Encontra o form dentro deste div
                    form = div_2.find("form")
                    if form:
                        # Encontra todos os divs filhos diretos do form
                        form_divs = form.find_all("div", recursive=False)
                        
                        # Pega o sexto div (índice 5)
                        if len(form_divs) >= 6:
                            div_6 = form_divs[5]  # div[6] no XPath
                            
                            # Encontra todos os divs filhos diretos do div_6
                            div_6_divs = div_6.find_all("div", recursive=False)
                            
                            # Pega o primeiro div (índice 0)
                            if len(div_6_divs) >= 1:
                                div_1 = div_6_divs[0]  # div[1] no XPath
                                
                                # Encontra o span
                                span_nome = div_1.find("span")
                                if span_nome:
                                    nome = span_nome.get_text(strip=True)
                                    if nome and len(nome) > 3:
                                        return nome
        except Exception as e:
            logging.debug(f"Estratégia 1 falhou: {e}")
        

        
        # Se nenhuma estratégia funcionar
        return None
        
    except Exception as e:
        logging.error(f"Erro ao extrair nome do usuário: {e}")
        return None






def login_e_buscar_leitos(setores_desejados: List[str]) -> List[Dict]:
     
    
    
    print(f"🏥 BUSCA VIA HTTP OTIMIZADA - {len(setores_desejados)} setores")
    print("=" * 60)
    
    inicio_total = time.time()
    
    # Criar sessão HTTP
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    })
    
    try:
        # ============================================================
        # 1. LOGIN VIA HTTP (Rápido - ~2 segundos)
        # ============================================================
        print("🔸 Etapa 1/3: Login...")
        
        # 1.1 Obter página de login
        resp_login = session.get(LOGIN_URL, timeout=15)
        resp_login.raise_for_status()
        soup_login = BeautifulSoup(resp_login.text, 'html.parser')
        
        # 1.2 Extrair ViewState
        viewstate_input = soup_login.find("input", {"name": "javax.faces.ViewState"})
        if not viewstate_input:
            logging.error("❌ ViewState não encontrado")
            return []
        
        viewstate = viewstate_input["value"]
        
        # 1.3 Fazer login
        payload_login = {
            "formulario": "formulario",
            "login": USERNAME,
            "xyb-ac": PASSWORD,
            "formulario:botaoLogin": "confirmar",
            "formulario:host": "10.2.2.8:8080",
            "javax.faces.ViewState": viewstate
        }
        
        headers_login = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": BASE_URL,
            "Referer": LOGIN_URL,
        }
        
        resp_pos_login = session.post(LOGIN_URL, data=payload_login, headers=headers_login, timeout=15)
        
        # Verificar se login foi bem-sucedido
        if "login.jsf" in resp_pos_login.url:
            logging.error("❌ Login falhou - redirecionado para login")
            return []
        
        print("✅ Login realizado")
        
        # ============================================================
        # 2. PREPARAR SESSÃO - OBTER VIEWSTATE ATUAL
        # ============================================================
        print("🔸 Etapa 2/3: Preparando sessão...")
        
        # 2.1 Acessar página PEP
        resp_pep = session.get(PEP_URL, timeout=15)
        resp_pep.raise_for_status()
        soup_pep = BeautifulSoup(resp_pep.text, 'html.parser')
        
        # 2.2 Verificar se ainda está logado
        if "login.jsf" in resp_pep.url:
            logging.error("❌ Sessão expirada após login")
            return []
        
        # 2.3 Extrair ViewState atual
        viewstate_atual_input = soup_pep.find("input", {"name": "javax.faces.ViewState"})
        if not viewstate_atual_input:
            logging.error("❌ ViewState não encontrado na PEP")
            return []
        
        viewstate_atual = viewstate_atual_input["value"]
        
        # 2.4 Mapear setores disponíveis
        select_clinica = soup_pep.find("select", {"id": "formMedicos:selClinica"})
        if not select_clinica:
            logging.error("❌ Select de clínicas não encontrado")
            return []
        
        options = select_clinica.find_all("option")
        mapa_setores = {}
        
        for option in options:
            nome = option.text.strip()
            valor = option.get("value")
            if nome and valor and valor != "0":  # Ignorar "Selecione a Clínica"
                mapa_setores[nome] = valor
        
        print(f"✅ {len(mapa_setores)} setores disponíveis no sistema")
        
        # Filtrar setores que existem
        setores_validos = []
        setores_nao_encontrados = []
        for setor in setores_desejados:
            if setor in mapa_setores:
                setores_validos.append(setor)
            else:
                setores_nao_encontrados.append(setor)
                print(f"⚠️ Setor não disponível: '{setor}'")
        
        if not setores_validos:
            print("❌ Nenhum setor válido para buscar")
            return []
        
        # ============================================================
        # 3. BUSCAR DADOS DOS SETORES (OTIMIZADO)
        # ============================================================
        print(f"🔸 Etapa 3/3: Buscando {len(setores_validos)} setores...")
        
        dados_totais = []
        pacientes_vistos = set()  # Para evitar duplicatas
        setores_com_dados = []
        
        for setor_nome in setores_validos:
            valor_setor = mapa_setores[setor_nome]
            
            print(f"\n🔹 {setor_nome}...")
            inicio_setor = time.time()
            
            try:
                # 3.1 Preparar requisição AJAX
                headers_ajax = {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Origin": BASE_URL,
                    "Referer": PEP_URL,
                    "X-Requested-With": "XMLHttpRequest",
                    "Faces-Request": "partial/ajax",
                }
                
                payload_ajax = {
                    "AJAXREQUEST": "_viewRoot",
                    "formMedicos": "formMedicos",
                    "formMedicos:selClinica": valor_setor,
                    "formMedicos:selEnfermaria": "0",
                    "formMedicos:iptProntuario": "",
                    "javax.faces.ViewState": viewstate_atual,
                    "formMedicos:j_id264": "formMedicos:j_id264",
                }
                
                # 3.2 Fazer requisição
                resp = session.post(PEP_URL, data=payload_ajax, headers=headers_ajax, timeout=15)

                if resp.status_code == 200:
                    # 🔥 ATUALIZAR VIEWSTATE SE O JSF GERAR UM NOVO
                    novo_viewstate = _extrair_viewstate(resp.text)
                    if novo_viewstate:
                        viewstate_atual = novo_viewstate

                    dados_setor = _processar_resposta_setor_otimizada(resp.text, setor_nome)
                    
                    if dados_setor:
                        # Filtrar duplicatas dentro do mesmo setor
                        dados_filtrados = []
                        vistos_no_setor = set()
                        
                        for item in dados_setor:
                            chave = f"{item['prontuario']}_{setor_nome}"
                            if chave not in vistos_no_setor:
                                vistos_no_setor.add(chave)
                                dados_filtrados.append(item)
                        
                        # Filtrar pacientes já vistos em outros setores
                        dados_novos = []
                        for item in dados_filtrados:
                            if item['prontuario'] not in pacientes_vistos:
                                pacientes_vistos.add(item['prontuario'])
                                dados_novos.append(item)
                            else:
                                logging.debug(f"Paciente duplicado ignorado: {item['paciente']}")
                        
                        if dados_novos:
                            dados_totais.extend(dados_novos)
                            setores_com_dados.append(setor_nome)
                            fim_setor = time.time()
                            tempo_setor = fim_setor - inicio_setor
                            
                            # Mostrar amostra rápida
                            if len(dados_novos) <= 3:
                                for item in dados_novos[:2]:
                                    print(f"   • {item['paciente'][:25]:25} | Leito: {item['numero_leito']}")
                            else:
                                primeiro = dados_novos[0]
                                print(f"   • {primeiro['paciente'][:20]}... | Leito: {primeiro['numero_leito']}")
                            
                            print(f"✅ {len(dados_novos)} leito(s) em {tempo_setor:.1f}s")
                        else:
                            print(f"ℹ️ Todos os pacientes já foram capturados")
                    else:
                        print(f"ℹ️ Nenhum leito encontrado")
                else:
                    print(f"⚠️ HTTP {resp.status_code}")
                
                # Pequena pausa entre setores
                time.sleep(0.3)
                
            except requests.exceptions.Timeout:
                print(f"⏱️ Timeout ao buscar {setor_nome}")
                continue
            except Exception as e:
                print(f"❌ Erro: {str(e)[:50]}...")
                continue
        
        # ============================================================
        # 4. RESULTADO FINAL OTIMIZADO
        # ============================================================
        fim_total = time.time()
        tempo_total = fim_total - inicio_total
        
        print(f"\n" + "=" * 60)
        print("📊 RELATÓRIO FINAL")
        print("=" * 60)
        
        print(f"⏱️  Tempo total: {tempo_total:.2f} segundos")
        print(f"📊 Setores processados: {len(setores_validos)}")
        print(f"🛏️  Total de leitos: {len(dados_totais)}")
        print(f"🏥 Setores com dados: {len(setores_com_dados)}")
        
        if setores_nao_encontrados:
            print(f"⚠️  Setores não disponíveis: {', '.join(setores_nao_encontrados)}")
        
        if dados_totais:
            # Estatísticas por setor
            contagem = Counter([item['setor'] for item in dados_totais])
            
            print(f"\n📋 DISTRIBUIÇÃO POR SETOR:")
            for setor, count in sorted(contagem.items()):
                print(f"  • {setor}: {count} leito(s)")
            
            # Amostra dos resultados
            print(f"\n🎯 AMOSTRA DOS DADOS (5 primeiros):")
            for i, item in enumerate(dados_totais[:5], 1):
                paciente = item['paciente']
                if len(paciente) > 25:
                    paciente = paciente[:22] + "..."
                print(f"{i}. {paciente}")
                print(f"   Pront: {item['prontuario']:8} | Leito: {item['numero_leito']:3} | Setor: {item['setor']}")
        
        print("=" * 60)
        
        return dados_totais
        
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Erro de conexão: {str(e)}")
        return []
    except Exception as e:
        logging.error(f"❌ Erro geral: {str(e)}")
        return []


def _processar_resposta_setor_otimizada(resposta_texto: str, setor_nome: str) -> List[Dict]:
    """
    Processa resposta do servidor - VERSÃO OTIMIZADA
    """
    dados = []
    
    try:
        # Verificar se é resposta XML
        if '<update id="formMedicos:oTableNovo">' in resposta_texto:
            # Extrair HTML da resposta XML
            inicio = resposta_texto.find('<update id="formMedicos:oTableNovo">')
            fim = resposta_texto.find('</update>', inicio)
            
            if inicio != -1 and fim != -1:
                html_tabela = resposta_texto[inicio + len('<update id="formMedicos:oTableNovo">'):fim]
                html_tabela = html.unescape(html_tabela)
                soup = BeautifulSoup(html_tabela, 'html.parser')
            else:
                return []
        else:
            # É HTML normal - verificar se contém a tabela
            if '<table class="rich-table" id="formMedicos:oTableNovo"' not in resposta_texto:
                return []
            
            # Extrair tabela
            inicio = resposta_texto.find('<table class="rich-table" id="formMedicos:oTableNovo"')
            if inicio == -1:
                return []
            
            fim = resposta_texto.find('</table>', inicio)
            if fim == -1:
                fim = len(resposta_texto)
            
            html_tabela = resposta_texto[inicio:fim + 8]
            html_tabela = html.unescape(html_tabela)
            soup = BeautifulSoup(html_tabela, 'html.parser')
        
        # Buscar tabela
        tabela = soup.find("table", {"id": "formMedicos:oTableNovo"})
        if not tabela:
            return []
        
        # Encontrar linhas (detectar cabeçalho automaticamente)
        linhas = tabela.find_all("tr")
        
        # Verificar se a primeira linha é cabeçalho
        primeira_linha_texto = linhas[0].get_text().upper() if linhas else ""
        if "PRONTUÁRIO" in primeira_linha_texto or "PACIENTE" in primeira_linha_texto:
            linhas = linhas[1:]  # Pular cabeçalho
        
        # Processar cada linha
        for linha in linhas:
            try:
                celulas = linha.find_all("td")
                
                # Precisamos de pelo menos 3 células: Prontuário, Paciente, Clínica-Leito
                if len(celulas) < 3:
                    continue
                
                # Extrair dados básicos
                prontuario = celulas[0].get_text(strip=True)
                paciente = celulas[1].get_text(strip=True)
                
                # Coluna IMPORTANTE: Clínica - Enf.Leito (índice 2)
                texto_setor = celulas[2].get_text(strip=True)
                
                # Processar setor e leito COM PARSER OTIMIZADO
                setor, numero_leito = _parse_setor_leito_otimizado(texto_setor, setor_nome)
                
                # Validar dados mínimos
                if not prontuario or not paciente:
                    continue
                
                # Criar item
                item = {
                    "prontuario": prontuario,
                    "paciente": paciente,
                    "setor": setor,
                    "numero_leito": numero_leito,
                    "setor_original": setor_nome
                }
                
                # Adicionar campos extras se disponíveis
                campos_extras = [
                    ("dias_leito", 3),
                    ("dias_hospital", 4),
                    ("escala_braden", 5)
                ]
                
                for campo, indice in campos_extras:
                    if len(celulas) > indice:
                        item[campo] = celulas[indice].get_text(strip=True)
                
                dados.append(item)
                
            except Exception as e:
                logging.debug(f"Erro processando linha: {e}")
                continue
        
        return dados
        
    except Exception as e:
        logging.error(f"Erro processamento resposta: {e}")
        return []


def _parse_setor_leito_otimizado(texto_setor: str, setor_original: str) -> tuple:
    """
    Versão que mantém EXATAMENTE o formato original
    
    Não altera o número do leito de forma alguma!
    O sistema já envia no formato correto.
    """
    
    if not texto_setor:
        return setor_original, ""
    
    texto = texto_setor.strip()
    
    # Deve ter o formato: "SETOR - ALGO.NUMERO"
    if " - " not in texto:
        return texto, ""
    
    # Separa
    setor, resto = texto.split(" - ", 1)
    setor = setor.strip()
    resto = resto.strip()
    
    # Extrai após último ponto
    if "." not in resto:
        return setor, ""
    
    ultimo_ponto = resto.rfind(".")
    numero_leito = resto[ultimo_ponto + 1:].strip()
    
    # Retorna sem modificar o número!
    return setor, numero_leito

def _extrair_dados_xml_corrigida(xml_text: str, setor_nome: str) -> List[Dict]:
    """Extrai dados de resposta XML AJAX - Compatibilidade"""
    try:
        if '<update id="formMedicos:oTableNovo">' not in xml_text:
            return []
        
        inicio = xml_text.find('<update id="formMedicos:oTableNovo">') + len('<update id="formMedicos:oTableNovo">')
        fim = xml_text.find('</update>', inicio)
        
        if inicio <= 0 or fim <= inicio:
            return []
        
        html_tabela = xml_text[inicio:fim]
        html_tabela = html.unescape(html_tabela)
        
        soup = BeautifulSoup(html_tabela, 'html.parser')
        return _extrair_dados_da_tabela_soup_otimizada(soup, setor_nome)
        
    except Exception:
        return []


def _extrair_dados_da_tabela_soup_otimizada(soup, setor_nome: str) -> List[Dict]:
    """Extrai dados de um objeto BeautifulSoup da tabela - VERSÃO OTIMIZADA"""
    dados = []
    
    try:
        # Método 1: Buscar por IDs específicos
        for i in range(100):
            try:
                prontuario_elem = soup.find(id=f"formMedicos:oTableNovo:{i}:j_id308")
                paciente_elem = soup.find(id=f"formMedicos:oTableNovo:{i}:j_id311")
                setor_elem = soup.find(id=f"formMedicos:oTableNovo:{i}:j_id314")
                
                if not (prontuario_elem and paciente_elem and setor_elem):
                    break
                
                prontuario = prontuario_elem.get_text(strip=True)
                paciente = paciente_elem.get_text(strip=True)
                texto_setor = setor_elem.get_text(strip=True)
                
                setor, numero_leito = _parse_setor_leito_otimizado(texto_setor, setor_nome)
                
                if prontuario and paciente:
                    dados.append({
                        "prontuario": prontuario,
                        "paciente": paciente,
                        "setor": setor,
                        "numero_leito": numero_leito,
                        "setor_original": setor_nome
                    })
                    
            except Exception:
                continue
        
        # Se não encontrou pelos IDs, tentar método genérico
        if not dados:
            tabela = soup.find("table")
            if tabela:
                linhas = tabela.find_all("tr")
                for linha in linhas:
                    celulas = linha.find_all("td")
                    if len(celulas) >= 3:
                        prontuario = celulas[0].get_text(strip=True)
                        paciente = celulas[1].get_text(strip=True)
                        texto_setor = celulas[2].get_text(strip=True)
                        
                        setor, numero_leito = _parse_setor_leito_otimizado(texto_setor, setor_nome)
                        
                        if prontuario and paciente:
                            dados.append({
                                "prontuario": prontuario,
                                "paciente": paciente,
                                "setor": setor,
                                "numero_leito": numero_leito,
                                "setor_original": setor_nome
                            })
        
        return dados
        
    except Exception:
        return []


def _extrair_viewstate(texto: str) -> str:
    """
    Extrai o javax.faces.ViewState de uma resposta JSF
    """
    try:
        soup = BeautifulSoup(texto, 'html.parser')
        vs = soup.find("input", {"name": "javax.faces.ViewState"})
        if vs and vs.get("value"):
            return vs["value"]
    except Exception:
        pass
    return ""





def obter_lista_todos_setores() -> list[str]:
    """
    Faz login e retorna apenas a lista de nomes de setores/clínicas disponíveis
    no select 'formMedicos:selClinica'.
    
    Retorna: lista de strings (nomes dos setores)
    """
   

    print("🔸 Iniciando obtenção de lista de setores...")
    inicio = time.time()

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    })

    try:
        # 1. Login
        resp_login = session.get(LOGIN_URL, timeout=15)
        resp_login.raise_for_status()
        soup = BeautifulSoup(resp_login.text, 'html.parser')

        viewstate_input = soup.find("input", {"name": "javax.faces.ViewState"})
        if not viewstate_input:
            logging.error("❌ ViewState não encontrado na página de login")
            return []

        viewstate = viewstate_input["value"]

        payload_login = {
            "formulario": "formulario",
            "login": USERNAME,
            "xyb-ac": PASSWORD,
            "formulario:botaoLogin": "confirmar",
            "formulario:host": "10.2.2.8:8080",
            "javax.faces.ViewState": viewstate
        }

        resp_pos_login = session.post(LOGIN_URL, data=payload_login, timeout=15)

        if "login.jsf" in resp_pos_login.url:
            logging.error("❌ Login falhou")
            return []

        print("✅ Login OK")

        # 2. Acessar página PEP e extrair select de clínicas/setores
        resp_pep = session.get(PEP_URL, timeout=15)
        resp_pep.raise_for_status()

        if "login.jsf" in resp_pep.url:
            logging.error("❌ Sessão expirada após login")
            return []

        soup_pep = BeautifulSoup(resp_pep.text, 'html.parser')

        select_clinica = soup_pep.find("select", {"id": "formMedicos:selClinica"})
        if not select_clinica:
            logging.error("❌ Select 'formMedicos:selClinica' não encontrado")
            return []

        options = select_clinica.find_all("option")
        setores = []

        for option in options:
            valor = option.get("value", "").strip()
            nome = option.get_text(strip=True)
            if valor and valor != "0" and nome:
                setores.append(nome)

        tempo_total = time.time() - inicio
        print(f"✅ Encontrados {len(setores)} setores em {tempo_total:.2f} segundos")
        if setores:
            print("Lista de setores:", setores[:10], "..." if len(setores) > 10 else "")

        return setores

    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Erro de rede/conexão: {e}")
        return []
    except Exception as e:
        logging.error(f"❌ Erro inesperado: {e}")
        return []

def salvar_setores_json(setores: list[str]):
    """Salva a lista de setores no JSON local."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SETORES_JSON, "w", encoding="utf-8") as f:
        json.dump(setores, f, ensure_ascii=False, indent=2)
    print(f"✅ Lista de setores salva em {SETORES_JSON} ({len(setores)} itens)")    
    
    
def buscar_ips_e_setores_ativos():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT d.ip, s.nome as setor
                FROM dispositivos d
                INNER JOIN setores s ON d.id = s.id_dispositivo
                WHERE d.status = TRUE
                  AND s.status = TRUE
            """)
            rows = cursor.fetchall()

        ips = {}
        for row in rows:
            ip = row["ip"]
            setor = row["setor"]

            if ip not in ips:
                ips[ip] = []

            ips[ip].append(setor)

        return ips

    finally:
        conn.close()    


