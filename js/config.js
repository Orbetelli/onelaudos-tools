// ========================================
// CONFIGURAÇÃO — Onelaudos Atendimento
// Pegue os valores em Supabase > Project Settings > API
//
// A "anon key" PODE ficar aqui: ela é pública por natureza e quem protege
// os dados é a RLS do banco. NUNCA coloque a "service_role" neste arquivo.
//
// Com SUPABASE_URL vazio, o Atendimento roda em MODO DEMONSTRAÇÃO (sem login).
// ========================================
var CONFIG = {
    SUPABASE_URL: 'https://lcghgwgvyxuwarhlzttg.supabase.co',          // ex.: 'https://abcdefgh.supabase.co'
    SUPABASE_ANON_KEY: 'sb_publishable_8OAfGXWPd2qETvstze-rnA_vJRsUa0H',     // ex.: 'eyJhbGciOi...'
    DOMINIO: 'onelaudos.com.br',  // só e-mails @deste domínio entram (igual ao SQL)
    INATIVIDADE_MIN: 30,       // desloga depois de X minutos sem mexer no painel
    SENHA_MIN: 8               // tamanho mínimo da nova senha
};