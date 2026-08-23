import json
from ..config.settings import SESSION_REDIS

def monitorar_sessoes():
    """Função para debug - monitora sessões ativas no Redis"""
    
    # Conectar ao Redis DB 1 (sessões)
    r = SESSION_REDIS
    
    # Buscar todas as chaves de sessão
    keys = r.keys('sessao:*')
    
    print(f"\n{'='*60}")
    print(f"SESSÕES ATIVAS NO REDIS: {len(keys)}")
    print(f"{'='*60}")
    
    for key in keys:
        ttl = r.ttl(key)
        dados = r.get(key)
        
        if dados:
            try:
                # Tenta decodificar a sessão
                if isinstance(dados, str):
                    dados_dict = json.loads(dados)
                else:
                    dados_dict = json.loads(dados.decode('utf-8'))
                
                user = dados_dict.get('usuario_logado', 'Desconhecido')
                tipo = dados_dict.get('tipo_usuario', 'N/A')
                
                print(f"🔑 {key}")
                print(f"   👤 Usuário: {user} ({tipo})")
                print(f"   ⏱️  TTL: {ttl} segundos ({ttl//60} minutos)")
                print()
                
            except:
                print(f"🔑 {key} - TTL: {ttl}s (dados não decodificáveis)")
                print()
    
    return len(keys)

monitorar_sessoes()