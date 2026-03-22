from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
from ..config.settings import EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD
from ..database.conexao import get_db_connection
from datetime import datetime


def enviar_email_pendente(destinatarios, leito, setor_nome, setor_id, ultima_limpeza, vencimento):
    """
    Envia email de notificação para múltiplos destinatários
    """
    if not destinatarios:
        print(f"⚠️ Nenhum email configurado para o setor {setor_nome} (ID: {setor_id})")
        return False

    # Formata as datas
    if isinstance(ultima_limpeza, datetime):
        ultima_limpeza_str = ultima_limpeza.strftime('%d/%m/%Y %H:%M')
    else:
        ultima_limpeza_str = str(ultima_limpeza)
        
    if isinstance(vencimento, datetime):
        vencimento_str = vencimento.strftime('%d/%m/%Y %H:%M')
    else:
        vencimento_str = str(vencimento)

    assunto = f"⚠️ ALERTA: Leito {leito} do setor {setor_nome} está PENDENTE!"

    corpo = f"""
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
        <h1 style="margin: 0;">⚠️ LIMPEZA PENDENTE</h1>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 5px 5px;">
        <p style="font-size: 16px;">Olá,</p>
        
        <p style="font-size: 16px;">O leito abaixo encontra-se com status <strong style="color: #dc3545;">PENDENTE</strong> e necessita de nova limpeza:</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Leito:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">{leito}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Setor:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">{setor_nome}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Última limpeza:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">{ultima_limpeza_str}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Vencimento:</strong></td>
                    <td style="padding: 8px;">{vencimento_str}</td>
                </tr>
            </table>
        </div>
        
        <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 30px;">
            Este é um email automático do sistema <strong>Leito Clean</strong>.<br>
            Por favor, não responda esta mensagem.
        </p>
    </div>
</body>
</html>
"""

    # Versão texto simples para fallback
    corpo_texto = f"""
ALERTA: LIMPEZA PENDENTE

Olá,

O leito abaixo encontra-se com status PENDENTE e necessita de nova limpeza:

Leito: {leito}
Setor: {setor_nome}
Última limpeza realizada em: {ultima_limpeza_str}
Vencimento da limpeza: {vencimento_str}

Atenciosamente,
Sistema Leito Clean
"""

    msg = MIMEMultipart('alternative')
    msg["From"] = EMAIL_USER
    msg["To"] = ", ".join(destinatarios)
    msg["Subject"] = assunto
    
    # Anexa as versões texto e HTML
    msg.attach(MIMEText(corpo_texto, "plain"))
    msg.attach(MIMEText(corpo, "html"))

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)

        print(f"📧 Email enviado com sucesso para {len(destinatarios)} destinatário(s): {destinatarios}")
        return True

    except Exception as e:
        print(f"❌ Erro ao enviar e-mail: {e}")
        import traceback
        traceback.print_exc()
        return False


def enviar_notificacoes_lote(leitos_pendentes):
    """
    Processa múltiplos leitos pendentes e envia notificações
    """
    for leito in leitos_pendentes:
        try:
            # Busca informações completas do leito
            info_leito = buscar_info_completa_para_notificacao(leito['id'])
            
            if not info_leito or not info_leito['setor_id']:
                print(f"⚠️ Setor não encontrado para o leito {leito['numero_leito']}")
                continue
            
            # Busca emails para o setor (agora com mais detalhes)
            emails_com_nomes = buscar_emails_por_setor_com_nomes(info_leito['setor_id'])
            
            if emails_com_nomes:
                print(f"\n📧 Enviando notificação para o setor: {info_leito['setor_nome']}")
                print(f"   Usuários notificados:")
                for item in emails_com_nomes:
                    print(f"   • {item['nome']} <{item['email']}>")
                
                # Extrair apenas os emails para envio
                destinatarios = [item['email'] for item in emails_com_nomes]
                
                # Envia o email
                enviado = enviar_email_pendente(
                    destinatarios=destinatarios,
                    leito=info_leito['numero_leito'],
                    setor_nome=info_leito['setor_nome'],
                    setor_id=info_leito['setor_id'],
                    ultima_limpeza=info_leito['data_validacao'],
                    vencimento=info_leito['vencimento']
                )
                
                if enviado:
                    print(f"✅ Email enviado com sucesso para {len(destinatarios)} usuário(s) do setor {info_leito['setor_nome']}")
                    
                    # Marca como email enviado
                    conn = get_db_connection()
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE registro_limpeza SET email_enviado = 1 WHERE id = %s",
                            (leito['id'],)
                        )
                        conn.commit()
                    conn.close()
            else:
                print(f"📭 Nenhum usuário configurado para receber notificações do setor {info_leito['setor_nome']}")
                    
        except Exception as e:
            print(f"❌ Erro ao processar notificação para leito {leito.get('numero_leito', 'desconhecido')}: {e}")


def buscar_emails_por_setor_com_nomes(setor_id):
    """
    Busca emails e nomes dos usuários que querem receber notificações para um setor específico
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT 
                u.id,
                u.nome,
                u.email,
                s.nome as setor_nome
            FROM usuarios u
            INNER JOIN notificacoes_emails ne ON u.id = ne.usuario_id
            INNER JOIN setores s ON ne.setor_id = s.id
            WHERE u.status = 1
              AND u.notificacoes = 1
              AND ne.receber_notificacoes = 1
              AND ne.setor_id = %s
              AND u.email IS NOT NULL 
              AND u.email != ''
        """, (setor_id,))
        rows = cursor.fetchall()
    conn.close()
    
    if rows:
        print(f"\n📋 Usuários que receberão notificação do setor {rows[0]['setor_nome']}:")
        for row in rows:
            print(f"   • ID {row['id']}: {row['nome']} - {row['email']}")
    
    return rows  # Retorna lista completa com nomes e emails




  
def buscar_emails_por_setor(setor_id):
    """
    Busca emails dos usuários que querem receber notificações para um setor específico
    Agora usando as novas tabelas: usuarios e notificacoes_emails
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT u.email
            FROM usuarios u
            INNER JOIN notificacoes_emails ne ON u.id = ne.usuario_id
            WHERE u.status = 1  -- Usuário ativo
              AND u.notificacoes = 1  -- Usuário quer receber notificações
              AND ne.receber_notificacoes = 1  -- Notificação ativa para este setor
              AND ne.setor_id = %s  -- Setor específico
              AND u.email IS NOT NULL 
              AND u.email != ''
        """, (setor_id,))
        rows = cursor.fetchall()
    conn.close()
    
    emails = [r["email"] for r in rows]
    print(f"📧 Encontrados {len(emails)} emails para o setor ID {setor_id}")
    return emails

def buscar_emails_todos_setores():
    """
    Busca emails de usuários que querem receber notificações de TODOS os setores
    (útil para notificações gerais)
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT u.email
            FROM usuarios u
            WHERE u.status = 1
              AND u.notificacoes = 1
              AND u.email IS NOT NULL 
              AND u.email != ''
        """)
        rows = cursor.fetchall()
    conn.close()
    
    return [r["email"] for r in rows]

def buscar_info_completa_para_notificacao(leito_id):
    """
    Busca todas as informações necessárias para a notificação de um leito
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT 
                rl.id,
                rl.numero_leito,
                rl.setor as setor_nome,
                rl.data_validacao,
                rl.vencimento,
                s.id as setor_id
            FROM registro_limpeza rl
            LEFT JOIN setores s ON s.nome = rl.setor  -- Relacionando pelo nome do setor
            WHERE rl.id = %s
        """, (leito_id,))
        leito = cursor.fetchone()
    conn.close()
    
    return leito