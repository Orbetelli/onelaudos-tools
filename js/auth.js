// ========================================
// AUTH — login dos atendentes (Supabase Auth)
// Usado pela aba Atendimento. O resto do Onelaudos Tools continua público.
// ========================================
const Auth = (function () {
    var cliente = null;
    var perfil = null;          // linha da tabela "atendentes"
    var recuperando = false;    // veio pelo link de "esqueci a senha"
    var ouvintes = [];
    var timerInativo = null;

    function configurado() {
        return !!(typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
    }

    function avisar() { ouvintes.forEach(function (fn) { fn(); }); }

    function iniciar() {
        if (cliente || !configurado()) return cliente;
        cliente = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: {
                flowType: 'pkce',           // o link de e-mail volta como ?code= e não briga com as rotas #/
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        cliente.auth.onAuthStateChange(function (evento) {
            if (evento === 'PASSWORD_RECOVERY') {
                recuperando = true;
                limparUrl();
                if (location.hash.indexOf('#/atendimento') !== 0) location.hash = '#/atendimento';
            }
            if (evento === 'SIGNED_OUT') { perfil = null; pararInatividade(); }
            // Só redesenha a tela nos eventos que mudam o que aparece
            if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_OUT') avisar();
        });
        return cliente;
    }

    // Tira o ?code= da barra de endereço depois de usar
    function limparUrl() {
        if (location.search) history.replaceState(null, '', location.pathname + location.hash);
    }

    function dominioOk(email) {
        return String(email).toLowerCase().endsWith('@' + CONFIG.DOMINIO);
    }

    async function carregarPerfil() {
        var r = await cliente.auth.getUser();
        if (r.error || !r.data.user) { perfil = null; return null; }
        var q = await cliente.from('atendentes').select('*').eq('id', r.data.user.id).maybeSingle();
        if (q.error) throw new Error('Não foi possível carregar seu cadastro: ' + q.error.message);
        if (!q.data) { await cliente.auth.signOut(); throw new Error('Seu usuário não está cadastrado como atendente. Fale com o administrador.'); }
        if (!q.data.ativo) { await cliente.auth.signOut(); throw new Error('Seu acesso está desativado. Fale com o administrador.'); }
        perfil = q.data;
        return perfil;
    }

    // ---------- Inatividade ----------
    function reiniciarInatividade() {
        clearTimeout(timerInativo);
        timerInativo = setTimeout(function () {
            if (!perfil) return;
            sair().then(function () { alert('Você foi desconectado por inatividade.'); });
        }, (CONFIG.INATIVIDADE_MIN || 30) * 60 * 1000);
    }
    var eventosAtividade = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    function iniciarInatividade() {
        eventosAtividade.forEach(function (ev) { document.addEventListener(ev, reiniciarInatividade, { passive: true }); });
        reiniciarInatividade();
    }
    function pararInatividade() {
        clearTimeout(timerInativo);
        eventosAtividade.forEach(function (ev) { document.removeEventListener(ev, reiniciarInatividade); });
    }

    function sair() {
        pararInatividade(); perfil = null; recuperando = false;
        return cliente ? cliente.auth.signOut() : Promise.resolve();
    }

    function validarSenha(senha, confirmar) {
        var min = CONFIG.SENHA_MIN || 8;
        if (senha.length < min) return 'A senha precisa ter pelo menos ' + min + ' caracteres.';
        if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
        if (senha !== confirmar) return 'As senhas não conferem.';
        return '';
    }

    return {
        configurado: configurado,
        // Por que está em modo demonstração (aparece no selo do painel)
        motivoDemo: function () {
            if (typeof CONFIG === 'undefined') return 'js/config.js não foi carregado (confira o index.html e a pasta js/).';
            if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return 'SUPABASE_URL ou SUPABASE_ANON_KEY vazios em js/config.js.';
            if (!window.supabase || !window.supabase.createClient) return 'A biblioteca do Supabase (cdn.jsdelivr.net) não carregou: rede bloqueada ou index.html antigo.';
            return '';
        },
        cliente: function () { return iniciar(); },
        perfil: function () { return perfil; },
        recuperando: function () { return recuperando; },
        aoMudar: function (fn) { ouvintes.push(fn); },
        dominioOk: dominioOk,
        validarSenha: validarSenha,

        // Estado atual: 'demo' | 'deslogado' | 'nova-senha' | 'trocar-senha' | 'ok'
        estado: async function () {
            if (!configurado()) return 'demo';
            iniciar();
            var s = await cliente.auth.getSession();
            if (!s.data.session) return 'deslogado';
            if (recuperando) return 'nova-senha';
            if (!perfil) await carregarPerfil();
            if (!perfil) return 'deslogado';
            if (perfil.trocar_senha) return 'trocar-senha';
            iniciarInatividade();
            return 'ok';
        },

        entrar: async function (email, senha) {
            iniciar();
            email = String(email).trim().toLowerCase();
            if (!dominioOk(email)) throw new Error('Use seu e-mail @' + CONFIG.DOMINIO + '.');
            var r = await cliente.auth.signInWithPassword({ email: email, password: senha });
            if (r.error) throw new Error('E-mail ou senha incorretos.'); // mensagem genérica de propósito
            await carregarPerfil();
        },

        // Serve para o 1º acesso e para o link de "esqueci a senha"
        definirSenha: async function (senha) {
            var r = await cliente.auth.updateUser({ password: senha });
            if (r.error) throw new Error('Não foi possível salvar a senha: ' + r.error.message);
            var m = await cliente.rpc('marcar_senha_trocada');
            if (m.error) throw new Error('Senha salva, mas houve um erro ao concluir: ' + m.error.message);
            recuperando = false;
            perfil = null;
            await carregarPerfil();
        },

        esqueciSenha: async function (email) {
            iniciar();
            email = String(email).trim().toLowerCase();
            if (!dominioOk(email)) throw new Error('Use seu e-mail @' + CONFIG.DOMINIO + '.');
            // Volta para a raiz do site (sem #) — o Supabase acrescenta ?code=
            var r = await cliente.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
            if (r.error) throw new Error('Não foi possível enviar o e-mail. Tente de novo em alguns minutos.');
        },

        sair: sair
    };
})();