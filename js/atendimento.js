// ========================================
// ATENDIMENTO — fila de chamados estilo Chatwoot
// Colunas: Seus chamados | Fila | Chat
//
// Fase 1 (agora): dados de demonstração em memória (AtendimentoDados).
// Fase 2: trocar AtendimentoDados pela versão Supabase (mesmas funções),
//         sem mexer na tela (Atendimento).
// ========================================

// ---------- Camada de dados (demonstração) ----------
// Toda função devolve Promise, igual será com o Supabase.
const AtendimentoDados = (function () {
    var ATENDENTE = 'Demonstração'; // com login, vem do cadastro (Auth.perfil().nome)
    var TEXTO_AUTO = 'Somos a Onelaudos. Recebemos sua mensagem e já iremos dar sequência no seu chamado.';
    var ouvintes = [];
    var seq = 100;
    var poolIdx = { impl: 0, med: 0 };

    function agora() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function saudacao() { var h = new Date().getHours(); return h < 12 ? 'Bom dia!' : (h < 18 ? 'Boa tarde!' : 'Boa noite!'); }
    function auto(hora, sd) { return { de: 'bot', texto: (sd || 'Bom dia!') + ' ' + TEXTO_AUTO, hora: hora }; }

    // Imagem de exemplo (um "print" de erro), feita em SVG para não precisar de arquivo
    var PRINT_EXEMPLO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260">' +
        '<rect width="480" height="260" fill="#e9edf2"/><rect x="40" y="40" width="400" height="180" rx="6" fill="#fff" stroke="#9aa7b4"/>' +
        '<rect x="40" y="40" width="400" height="34" rx="6" fill="#c62828"/><text x="56" y="63" font-family="Arial" font-size="15" fill="#fff">MobileRouter - Erro</text>' +
        '<text x="60" y="110" font-family="Arial" font-size="15" fill="#222">Falha ao enviar estudo para o servidor.</text>' +
        '<text x="60" y="136" font-family="Arial" font-size="13" fill="#555">C-STORE recusado: tempo esgotado (timeout).</text>' +
        '<rect x="340" y="176" width="80" height="28" rx="4" fill="#1565c0"/><text x="368" y="195" font-family="Arial" font-size="13" fill="#fff">OK</text></svg>');
    var COLEGAS = ['Ana', 'Bruno', 'Carla'];  // com login, vem da tabela atendentes

    // Pesquisa de satisfação enviada ao encerrar (no real: o webhook trata a resposta)
    var TEXTO_PESQUISA = 'Seu atendimento foi encerrado ✅\nComo você avalia o atendimento de {atendente}?\n\n5 - Excelente\n4 - Bom\n3 - Regular\n2 - Ruim\n1 - Péssimo\n\nResponda só com o número.';
    var ROTULOS = { 5: 'Excelente', 4: 'Bom', 3: 'Regular', 2: 'Ruim', 1: 'Péssimo' };
    // Avaliações antigas, para o painel não começar vazio na demonstração
    var avaliacoes = [
        { cliente: 'Clínica Imagem Sul', setor: 'impl', atendente: 'Ana', nota: 5, comentario: 'Resolveram o router muito rápido!', quando: 'ontem 16:40' },
        { cliente: 'Hospital Bela Vista', setor: 'impl', atendente: 'Bruno', nota: 4, comentario: '', quando: 'ontem 14:12' },
        { cliente: 'Centro Diagnóstico Leste', setor: 'impl', atendente: 'Demonstração', nota: 5, comentario: 'Atendimento excelente.', quando: 'ontem 11:05' },
        { cliente: 'Clínica Santa Clara', setor: 'impl', atendente: 'Carla', nota: 3, comentario: 'Demorou para alguém pegar o chamado.', quando: 'ontem 09:30' },
        { cliente: 'Dr. Lucas Ferraz', setor: 'med', atendente: 'Ana', nota: 5, comentario: '', quando: 'ontem 17:20' },
        { cliente: 'Dra. Júlia Campos', setor: 'med', atendente: 'Carla', nota: 4, comentario: 'Ok, resolvido.', quando: 'ontem 10:02' }
    ];

    var chamados = [
        { id: 1, nome: 'Alan Souza', local: 'Clínica São Lucas', fone: '(11) 90000-0001', setor: 'impl', status: 'fila', espera: '4 min',
          msgs: [{ de: 'cliente', texto: 'Bom dia, o Router parou de enviar os exames desde ontem à noite.', hora: '09:41' }, auto('09:41'),
                 { de: 'cliente', texto: 'Segue o print do erro', imagem: { url: PRINT_EXEMPLO, nome: 'print-erro.png' }, hora: '09:42' }] },
        { id: 2, nome: 'Marina Costa', local: 'Centro de Imagem Vale Verde', fone: '(11) 90000-0002', setor: 'impl', status: 'fila', espera: '1 min',
          msgs: [{ de: 'cliente', texto: 'Olá, preciso cadastrar dois médicos novos no portal.', hora: '09:44' }, auto('09:44')] },
        { id: 3, nome: 'Jorge Almeida', local: 'Hospital Santa Rita', fone: '(11) 90000-0003', setor: 'impl', status: 'meu', atendente: ATENDENTE, respondido: true,
          msgs: [{ de: 'cliente', texto: 'O cabeçalho do laudo está saindo com o logo antigo.', hora: '09:20' }, auto('09:20'),
                 { de: 'nota', texto: ATENDENTE + ' assumiu o chamado', hora: '09:22' },
                 { de: 'agente', autor: ATENDENTE, texto: 'Bom dia, Jorge! Vou verificar a configuração de cabeçalho e rodapé da unidade.', hora: '09:23' },
                 { de: 'cliente', texto: 'Obrigado, fico no aguardo.', hora: '09:25' },
                 { de: 'interna', autor: 'Ana', texto: 'Já pedi o logo novo para o cliente por e-mail. Aguardando o arquivo para trocar no cabeçalho.', hora: '09:31' }] },
        { id: 4, nome: 'Patrícia Lima', local: 'Clínica Diagnóstica Norte', fone: '(11) 90000-0004', setor: 'impl', status: 'outro', atendente: 'Ana', msgs: [] },
        { id: 5, nome: 'Dr. Paulo Mendes', local: 'Médico executante', fone: '(11) 90000-0005', setor: 'med', status: 'fila', espera: '6 min',
          msgs: [{ de: 'cliente', texto: 'Não estou conseguindo assinar os laudos, aparece erro de certificado.', hora: '09:38' }, auto('09:38')] },
        { id: 6, nome: 'Dra. Helena Rocha', local: 'Médica executante', fone: '(11) 90000-0006', setor: 'med', status: 'fila', espera: '2 min',
          msgs: [{ de: 'cliente', texto: 'Preciso trocar meu plantão de sábado, como faço?', hora: '09:43' }, auto('09:43')] }
    ];

    var POOL = {
        impl: [
            { nome: 'Renato Dias', local: 'Clínica Bem Viver', texto: 'Olá, o Worklist não está puxando os pacientes agendados de hoje.' },
            { nome: 'Luciana Prado', local: 'Instituto de Imagem Litoral', texto: 'Esqueci a senha do portal, podem me ajudar?' },
            { nome: 'Fábio Nunes', local: 'Hospital Primavera', texto: 'Os exames de tomografia não aparecem na lista do portal.' }
        ],
        med: [
            { nome: 'Dr. André Tavares', local: 'Médico executante', texto: 'O visualizador não está abrindo as imagens do exame.' },
            { nome: 'Dra. Beatriz Moura', local: 'Médica executante', texto: 'Meu login expirou e não consigo acessar os laudos pendentes.' }
        ]
    };

    function avisar(evento) { ouvintes.forEach(function (fn) { fn(evento || {}); }); }
    function achar(id) { return chamados.find(function (c) { return c.id === id; }); }

    return {
        atendente: function () { return ATENDENTE; },
        definirAtendente: function (nome) { if (nome) ATENDENTE = nome; },

        // Avisa a tela quando algo muda (no Supabase: canal Realtime)
        aoMudar: function (fn) { ouvintes.push(fn); return function () { ouvintes = ouvintes.filter(function (f) { return f !== fn; }); }; },

        listar: function (setor) {
            return Promise.resolve(chamados.filter(function (c) { return c.setor === setor; }));
        },

        obter: function (id) { return Promise.resolve(achar(id) || null); },

        // Só pega se ainda estiver na fila (no Supabase: UPDATE ... WHERE status = 'fila')
        pegar: function (id) {
            var c = achar(id);
            if (!c || c.status !== 'fila') return Promise.reject(new Error('Este chamado já foi pego por outra pessoa.'));
            c.status = 'meu'; c.atendente = ATENDENTE;
            c.msgs.push({ de: 'nota', texto: ATENDENTE + ' assumiu o chamado', hora: agora() });
            avisar({ tipo: 'pegou', id: id });
            return Promise.resolve(c);
        },

        colegas: function () { return Promise.resolve(COLEGAS.filter(function (n) { return n !== ATENDENTE; })); },

        // opcoes: { imagem: { url, nome }, interna: true/false }
        // Nota interna: fica só no painel, NUNCA vai para o WhatsApp do cliente.
        enviar: function (id, texto, opcoes) {
            opcoes = opcoes || {};
            var c = achar(id);
            if (!c || c.status !== 'meu') return Promise.reject(new Error('Pegue o chamado antes de responder.'));
            if (opcoes.interna) {
                c.msgs.push({ de: 'interna', autor: ATENDENTE, texto: texto, imagem: opcoes.imagem || null, hora: agora() });
                avisar({ tipo: 'mensagem', id: id, de: 'interna', setor: c.setor, status: c.status });
                return Promise.resolve(c);
            }
            var primeira = !c.respondido;
            c.respondido = true;
            c.msgs.push({ de: 'agente', autor: ATENDENTE, texto: texto, imagem: opcoes.imagem || null, hora: agora() });
            avisar({ tipo: 'mensagem', id: id, de: 'agente', setor: c.setor, status: c.status });
            // Demonstração: o cliente "responde" depois da primeira resposta
            if (primeira) {
                setTimeout(function () { avisar({ tipo: 'digitando', id: id }); }, 700);
                setTimeout(function () {
                    c.msgs.push({ de: 'cliente', texto: 'Perfeito, obrigado pelo retorno!', hora: agora() });
                    avisar({ tipo: 'mensagem', id: id, de: 'cliente', setor: c.setor, status: c.status });
                }, 2400);
            }
            return Promise.resolve(c);
        },

        // Passa o chamado para outro atendente (ex.: saída para o almoço)
        transferir: function (id, para) {
            var c = achar(id);
            if (!c || c.status !== 'meu') return Promise.reject(new Error('Só dá para transferir um chamado que está com você.'));
            c.status = 'outro'; c.atendente = para;
            c.msgs.push({ de: 'nota', texto: ATENDENTE + ' transferiu o chamado para ' + para, hora: agora() });
            avisar({ tipo: 'transferiu', id: id });
            return Promise.resolve(c);
        },

        // Devolve para a fila, para qualquer um pegar
        devolver: function (id) {
            var c = achar(id);
            if (!c || c.status !== 'meu') return Promise.reject(new Error('Só dá para devolver um chamado que está com você.'));
            c.status = 'fila'; c.atendente = null; c.espera = 'agora';
            c.msgs.push({ de: 'nota', texto: ATENDENTE + ' devolveu o chamado para a fila', hora: agora() });
            avisar({ tipo: 'devolveu', id: id, setor: c.setor, status: c.status });
            return Promise.resolve(c);
        },

        // Encerra e envia a pesquisa de satisfação (o chamado fica "avaliando" até o cliente responder)
        encerrar: function (id) {
            var c = achar(id);
            if (!c) return Promise.resolve(null);
            var quem = c.atendente || ATENDENTE;
            c.status = 'fechado';
            c.avaliacao = { status: 'aguardando', atendente: quem };
            c.msgs.push({ de: 'nota', texto: 'Chamado encerrado', hora: agora() });
            c.msgs.push({ de: 'bot', texto: TEXTO_PESQUISA.replace('{atendente}', quem), hora: agora() });
            avisar({ tipo: 'encerrou', id: id });
            // Demonstração: o cliente responde a pesquisa sozinho
            var self = this, sorteio = [5, 5, 5, 4, 4, 3][Math.floor(Math.random() * 6)];
            var comentarios = { 5: 'Muito obrigado, resolveram rapidinho!', 4: 'Bom atendimento.', 3: 'Resolveu, mas demorou um pouco.' };
            setTimeout(function () { self.respostaDoCliente(id, String(sorteio)); }, 1800);
            setTimeout(function () { self.respostaDoCliente(id, comentarios[sorteio]); }, 3600);
            return Promise.resolve(c);
        },

        // Mesma lógica que o webhook do WhatsApp vai usar quando chegar mensagem de um chamado encerrado
        respostaDoCliente: function (id, texto) {
            var c = achar(id); if (!c || !c.avaliacao) return;
            var a = c.avaliacao, t = String(texto).trim();
            c.msgs.push({ de: 'cliente', texto: t, hora: agora() });
            if (a.status === 'aguardando') {
                var n = parseInt(t, 10);
                if (!(n >= 1 && n <= 5) || !/^[1-5]$/.test(t)) {
                    c.msgs.push({ de: 'bot', texto: 'Por favor, responda só com um número de 1 a 5.', hora: agora() });
                    return;
                }
                a.status = 'comentario'; a.nota = n;
                a.registro = { cliente: c.nome, local: c.local, setor: c.setor, atendente: a.atendente, nota: n, comentario: '', quando: 'hoje ' + agora() };
                avaliacoes.unshift(a.registro);
                c.msgs.push({ de: 'bot', texto: 'Obrigado pela avaliação! (' + n + ' - ' + ROTULOS[n] + ')\nSe quiser, deixe um comentário. É opcional.', hora: agora() });
                avisar({ tipo: 'avaliacao', id: id, setor: c.setor });
            } else if (a.status === 'comentario') {
                a.status = 'concluida'; a.registro.comentario = t;
                c.msgs.push({ de: 'bot', texto: 'Comentário registrado. A Onelaudos agradece! 💙', hora: agora() });
                avisar({ tipo: 'avaliacao', id: id, setor: c.setor });
            }
            // Fora disso (já concluída), no real uma nova mensagem abre um novo chamado
        },

        avaliacoes: function (setor) {
            return Promise.resolve(avaliacoes.filter(function (a) { return a.setor === setor; }));
        },

        // Demonstração: simula um cliente chamando no WhatsApp (no real: webhook)
        simularContato: function (setor) {
            var lista = POOL[setor], p = lista[poolIdx[setor] % lista.length], h = agora();
            poolIdx[setor]++; seq++;
            var c = { id: seq, nome: p.nome, local: p.local, fone: '(11) 90000-0' + seq, setor: setor, status: 'fila', espera: 'agora',
                      msgs: [{ de: 'cliente', texto: p.texto, hora: h }, auto(h, saudacao())] };
            chamados.push(c);
            avisar({ tipo: 'novo', id: c.id, setor: c.setor, status: c.status });
            return Promise.resolve(c);
        }
    };
})();

// ---------- Tela ----------
// ---------- Sons de aviso (gerados pelo navegador, sem arquivo de áudio) ----------
const AtendimentoSom = (function () {
    var ctx = null, naoLidas = 0, tituloOriginal = document.title;
    function ligado() { try { return localStorage.getItem('at-som') !== '0'; } catch (e) { return true; } }
    function contexto() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    // Uma nota curta com volume suave (sobe rápido e some devagar)
    function nota(freq, inicio, dur, vol) {
        var c = contexto(); if (!c) return;
        var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + inicio;
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + dur + 0.02);
    }
    // O navegador só libera áudio depois do primeiro clique na página
    document.addEventListener('pointerdown', function () { if (ligado()) contexto(); }, { once: true });
    // Ao voltar para a aba, limpa o contador do título
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { naoLidas = 0; document.title = tituloOriginal; }
    });
    return {
        ligado: ligado,
        alternar: function () {
            var novo = !ligado();
            try { localStorage.setItem('at-som', novo ? '1' : '0'); } catch (e) {}
            if (novo) this.tocar('mensagem', true);
            return novo;
        },
        // tipo: 'novo' (chamado novo na fila) | 'mensagem' (cliente respondeu num chamado seu)
        tocar: function (tipo, teste) {
            if (!ligado()) return;
            if (tipo === 'novo') { nota(784, 0, 0.18, 0.18); nota(1047, 0.14, 0.28, 0.18); } // dois toques subindo
            else { nota(988, 0, 0.16, 0.12); }                                              // um toque curto
            if (!teste && document.hidden) { naoLidas++; document.title = '(' + naoLidas + ') ' + tituloOriginal; }
        }
    };
})();

const Atendimento = {
    setor: 'impl',
    sel: null,
    digitandoId: null,
    desligar: null,

    render: function (el) {
        var self = this;
        if (this.desligar) { this.desligar(); this.desligar = null; }
        if (!this.ouvindoAuth) {
            this.ouvindoAuth = true;
            Auth.aoMudar(function () { if (location.hash.indexOf('#/atendimento') === 0) self.render(app); });
        }
        el.innerHTML = '<p class="vazio">Carregando...</p>';
        Auth.estado().then(function (st) {
            if (location.hash.indexOf('#/atendimento') !== 0) return; // trocou de aba
            if (st === 'deslogado') return self.telaLogin(el);
            if (st === 'trocar-senha' || st === 'nova-senha') return self.telaSenha(el, st);
            self.abrirPainel(el, st === 'demo');
        }).catch(function (e) { self.telaLogin(el, e.message); });
    },

    abrirPainel: function (el, demo) {
        var self = this, p = Auth.perfil();
        this.demo = demo;
        // Regra: ADMIN vê todos os setores; os demais só os setores do próprio cadastro
        var TODOS = ['impl', 'med'];
        this.ehAdmin = !p || p.papel === 'admin';   // demonstração se comporta como admin
        this.setores = this.ehAdmin ? TODOS : (p.setores || []).filter(function (x) { return TODOS.indexOf(x) >= 0; });
        if (!this.setores.length) { el.innerHTML = '<p class="vazio">Seu cadastro não tem setor definido. Fale com o administrador.</p>'; return; }
        if (this.setores.indexOf(this.setor) < 0) this.setor = this.setores[0];
        if (p) AtendimentoDados.definirAtendente(p.nome);
        AtendimentoDados.colegas().then(function (l) { self.colegas = l; });
        this.desligar = AtendimentoDados.aoMudar(function (ev) {
            // Som: chamado novo num setor seu, ou cliente respondeu num chamado seu
            if (ev.tipo === 'novo' && self.setores.indexOf(ev.setor) >= 0) AtendimentoSom.tocar('novo');
            if (ev.tipo === 'mensagem' && ev.de === 'cliente' && ev.status === 'meu') AtendimentoSom.tocar('mensagem');
            if (location.hash.indexOf('#/atendimento') !== 0) return; // saiu da aba
            self.digitandoId = ev.tipo === 'digitando' ? ev.id : null;
            self.desenhar();
        });
        this.montar(el);
        this.desenhar();
    },

    // ---------- Login ----------
    telaLogin: function (el, erro) {
        var self = this, dom = Docs.esc(CONFIG.DOMINIO);
        document.body.classList.remove('menu-recolhido');
        el.innerHTML =
            '<div class="at-login"><form class="at-login-card" id="atLogin" novalidate>' +
              '<div class="brand">Onelaudos <span>Atendimento</span></div>' +
              '<p class="tag">Entre com seu e-mail @' + dom + '.</p>' +
              '<label for="atEmail">E-mail</label>' +
              '<input type="email" id="atEmail" autocomplete="username" placeholder="nome@' + dom + '" required>' +
              '<label for="atSenha">Senha</label>' +
              '<input type="password" id="atSenha" autocomplete="current-password" required>' +
              '<div class="at-login-msg" id="atLoginMsg" role="alert"></div>' +
              '<button type="submit" id="atEntrar">Entrar</button>' +
              '<button type="button" class="at-link" id="atEsqueci">Esqueci minha senha</button>' +
            '</form></div>';
        var msg = el.querySelector('#atLoginMsg'), btn = el.querySelector('#atEntrar');
        var mostrar = function (t, ok) { msg.textContent = t || ''; msg.classList.toggle('ok', !!ok); };
        if (erro) mostrar(erro);
        el.querySelector('#atEmail').focus();

        el.querySelector('#atLogin').addEventListener('submit', function (e) {
            e.preventDefault();
            var email = el.querySelector('#atEmail').value, senha = el.querySelector('#atSenha').value;
            if (!email || !senha) return mostrar('Preencha e-mail e senha.');
            btn.disabled = true; btn.textContent = 'Entrando...'; mostrar('');
            Auth.entrar(email, senha)
                .then(function () { self.render(el); })
                .catch(function (e2) { mostrar(e2.message); btn.disabled = false; btn.textContent = 'Entrar'; });
        });
        el.querySelector('#atEsqueci').addEventListener('click', function () {
            var email = el.querySelector('#atEmail').value;
            if (!email) return mostrar('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".');
            Auth.esqueciSenha(email)
                .then(function () { mostrar('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Abra o link neste mesmo navegador.', true); })
                .catch(function (e2) { mostrar(e2.message); });
        });
    },

    // ---------- 1º acesso / nova senha ----------
    telaSenha: function (el, st) {
        var self = this, p = Auth.perfil();
        var titulo = st === 'nova-senha' ? 'Defina uma nova senha' : 'Primeiro acesso: crie sua senha';
        var texto = st === 'nova-senha'
            ? 'Digite a nova senha que você vai usar a partir de agora.'
            : 'Olá' + (p ? ', ' + Docs.esc(p.nome) : '') + '! Por segurança, troque a senha provisória antes de continuar.';
        el.innerHTML =
            '<div class="at-login"><form class="at-login-card" id="atSenhaForm" novalidate>' +
              '<div class="brand">Onelaudos <span>Atendimento</span></div>' +
              '<h2>' + titulo + '</h2><p class="tag">' + texto + '</p>' +
              '<label for="atNova">Nova senha</label>' +
              '<input type="password" id="atNova" autocomplete="new-password" required>' +
              '<label for="atConf">Confirme a nova senha</label>' +
              '<input type="password" id="atConf" autocomplete="new-password" required>' +
              '<p class="tag">Mínimo de ' + (CONFIG.SENHA_MIN || 8) + ' caracteres, com letras e números.</p>' +
              '<div class="at-login-msg" id="atSenhaMsg" role="alert"></div>' +
              '<button type="submit" id="atSalvar">Salvar e entrar</button>' +
              '<button type="button" class="at-link" id="atCancelar">Sair</button>' +
            '</form></div>';
        var msg = el.querySelector('#atSenhaMsg'), btn = el.querySelector('#atSalvar');
        el.querySelector('#atNova').focus();
        el.querySelector('#atSenhaForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var nova = el.querySelector('#atNova').value, conf = el.querySelector('#atConf').value;
            var erro = Auth.validarSenha(nova, conf);
            if (erro) { msg.textContent = erro; return; }
            btn.disabled = true; btn.textContent = 'Salvando...'; msg.textContent = '';
            Auth.definirSenha(nova)
                .then(function () { self.render(el); })
                .catch(function (e2) { msg.textContent = e2.message; btn.disabled = false; btn.textContent = 'Salvar e entrar'; });
        });
        el.querySelector('#atCancelar').addEventListener('click', function () { Auth.sair().then(function () { self.render(el); }); });
    },

    montar: function (el) {
        var self = this, nomeBruto = AtendimentoDados.atendente(), nome = Docs.esc(nomeBruto);
        var iniciais = Docs.esc(nomeBruto.split(/\s+/).filter(Boolean).map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase());
        el.innerHTML =
            '<div class="at">' +
              '<div class="at-topo">' +
                '<button type="button" class="sec at-menu-btn" id="atMenu"></button>' +
                '<h1>Atendimento</h1>' +
                (this.demo ? '<span class="at-demo" title="' + Docs.esc(Auth.motivoDemo()) + '">Modo demonstração (passe o mouse para ver o motivo)</span>' : '') +
                '<div class="at-setores" role="tablist" aria-label="Setor">' +
                  this.setores.map(function (st) { return '<button type="button" data-setor="' + st + '">' + (st === 'med' ? 'Suporte Médico' : 'Implantação') + '</button>'; }).join('') +
                '</div>' +
                '<span class="at-equipe" id="atEquipe"></span>' +
                '<button type="button" class="sec at-menu-btn" id="atAvaliacoes">⭐ Avaliações</button>' +
                '<button type="button" class="sec at-menu-btn" id="atSom"></button>' +
                '<button type="button" class="sec" id="atSimular">+ Simular novo contato</button>' +
                '<span class="at-eu"><span class="at-avatar">' + iniciais + '</span>' + nome +
                  (this.ehAdmin && !this.demo ? '<span class="at-papel">Admin</span>' : '') + '</span>' +
                (this.demo ? '' : '<button type="button" class="sec at-menu-btn" id="atSair">Sair</button>') +
              '</div>' +
              '<div class="at-colunas">' +
                '<section class="at-col" id="atColMeus" aria-label="Seus chamados"><div class="at-col-topo"><h2>Seus chamados</h2><span class="at-conta" id="atContaMeus"></span></div><div class="at-lista" id="atMeus"></div></section>' +
                '<div class="at-divisor" data-col="atColMeus" role="separator" aria-orientation="vertical" aria-label="Ajustar largura de Seus chamados" tabindex="0" title="Arraste para ajustar · duplo clique volta ao padrão"></div>' +
                '<section class="at-col at-col-fila" id="atColFila" aria-label="Fila"><div class="at-col-topo"><h2 id="atTituloFila">Fila</h2><span class="at-conta at-conta-fila" id="atContaFila"></span></div><div class="at-lista" id="atFila"></div></section>' +
                '<div class="at-divisor" data-col="atColFila" role="separator" aria-orientation="vertical" aria-label="Ajustar largura da Fila" tabindex="0" title="Arraste para ajustar · duplo clique volta ao padrão"></div>' +
                '<section class="at-chat" aria-label="Chat">' +
                  '<div id="atChatTopo" class="at-chat-topo"></div>' +
                  '<div class="at-msgs" id="atMsgs"></div>' +
                  '<div class="at-envio-box" id="atEnvio">' +
                    '<div class="at-modos" role="tablist" aria-label="Tipo de mensagem">' +
                      '<button type="button" class="ativo" data-modo="cliente" role="tab" aria-selected="true">Responder ao cliente</button>' +
                      '<button type="button" data-modo="interna" role="tab" aria-selected="false">🔒 Nota interna</button>' +
                    '</div>' +
                    '<div class="at-rapidas hidden" id="atRapidasMenu" role="listbox" aria-label="Respostas rápidas"></div>' +
                    '<div class="at-anexo hidden" id="atAnexo"><img id="atAnexoImg" alt="Imagem a enviar"><span id="atAnexoNome"></span>' +
                      '<button type="button" class="sec" id="atAnexoTirar" aria-label="Remover imagem">✕</button></div>' +
                  '<div class="at-envio">' +
                    '<input type="file" id="atArquivo" accept="image/png,image/jpeg,image/gif,image/webp" class="at-oculto">' +
                    '<label for="atArquivo" class="at-clipe" title="Anexar imagem (ou cole com Ctrl+V)" aria-label="Anexar imagem">📎</label>' +
                    '<label for="atTexto" class="at-oculto">Mensagem</label>' +
                    '<textarea id="atTexto" rows="1" placeholder="Digite sua resposta e pressione Enter" autocomplete="off"></textarea>' +
                    '<button type="button" class="sec at-raio" id="atRapidas" title="Respostas rápidas (digite / no campo)" aria-label="Respostas rápidas" aria-haspopup="listbox">⚡</button>' +
                    '<button type="button" id="atEnviar" aria-label="Enviar mensagem">Enviar</button>' +
                  '</div>' +
                  '</div>' +
                  '<div class="at-aviso-fila" id="atAvisoFila">Este chamado ainda está na fila. Clique em "Pegar chamado" para responder.</div>' +
                '</section>' +
              '</div>' +
            '</div>';

        el.querySelectorAll('[data-setor]').forEach(function (b) {
            b.addEventListener('click', function () { self.setor = b.dataset.setor; self.sel = null; self.desenhar(); });
        });
        // Recolher / mostrar o menu lateral (só vale nesta aba; fica salvo no navegador)
        var btnMenu = el.querySelector('#atMenu');
        var aplicarMenu = function (recolhido) {
            document.body.classList.toggle('menu-recolhido', recolhido);
            btnMenu.textContent = recolhido ? '☰ Mostrar menu' : '« Recolher menu';
            btnMenu.setAttribute('aria-expanded', String(!recolhido));
            try { localStorage.setItem('at-menu-recolhido', recolhido ? '1' : '0'); } catch (e) {}
        };
        var salvo = false;
        try { salvo = localStorage.getItem('at-menu-recolhido') === '1'; } catch (e) {}
        aplicarMenu(salvo);
        btnMenu.addEventListener('click', function () { aplicarMenu(!document.body.classList.contains('menu-recolhido')); });

        this.ativarDivisores(el);

        el.querySelector('#atAvaliacoes').addEventListener('click', function () { self.abrirAvaliacoes(); });

        var btnSom = el.querySelector('#atSom');
        var mostrarSom = function () {
            var on = AtendimentoSom.ligado();
            btnSom.textContent = on ? '🔔 Som ligado' : '🔕 Som desligado';
            btnSom.setAttribute('aria-pressed', String(on));
        };
        mostrarSom();
        btnSom.addEventListener('click', function () { AtendimentoSom.alternar(); mostrarSom(); });

        var btnSair = el.querySelector('#atSair');
        if (btnSair) btnSair.addEventListener('click', function () {
            if (self.desligar) { self.desligar(); self.desligar = null; }
            Auth.sair().then(function () { self.render(el); });
        });

        el.querySelector('#atSimular').addEventListener('click', function () { AtendimentoDados.simularContato(self.setor); });

        // Um ouvinte só para as listas e o topo do chat (delegação)
        el.querySelector('.at-colunas').addEventListener('click', function (e) {
            var b = e.target.closest('[data-acao]');
            if (!b) return;
            var id = Number(b.dataset.id);
            if (b.dataset.acao === 'abrir') { self.sel = id; self.desenhar(); }
            if (b.dataset.acao === 'pegar') self.pegar(id);
            if (b.dataset.acao === 'encerrar') AtendimentoDados.encerrar(id).then(function () { self.desenhar(); });
            if (b.dataset.acao === 'menu-transferir') { var m = document.getElementById('atMenuTransf'); if (m) m.classList.toggle('hidden'); }
            if (b.dataset.acao === 'transferir') {
                var para = b.dataset.para, menu = document.getElementById('atMenuTransf');
                if (menu) menu.classList.add('hidden');
                // Sem nota recente? Sugere deixar o recado antes (ex.: "aguardando teste de envio")
                if (!self.temNotaRecente(id) &&
                    !confirm('Você ainda não deixou uma nota interna para ' + para + '.\n\nOK = transferir mesmo assim\nCancelar = escrever a nota primeiro')) {
                    self.mudarModo('interna'); document.getElementById('atTexto').focus();
                    return;
                }
                AtendimentoDados.transferir(id, para).then(function () { self.sel = null; self.desenhar(); }).catch(function (e2) { alert(e2.message); });
            }
            if (b.dataset.acao === 'devolver') AtendimentoDados.devolver(id).then(function () { self.sel = null; self.desenhar(); }).catch(function (e2) { alert(e2.message); });
            if (b.dataset.acao === 'ampliar') self.ampliar(b.dataset.src, b.dataset.nome);
        });

        var campo = el.querySelector('#atTexto');
        var enviar = function () {
            var t = campo.value.trim(), img = self.anexo;
            if ((!t && !img) || self.sel == null) return;
            var interna = self.modo === 'interna';
            campo.value = '';
            self.ajustarAltura(); self.fecharRapidas();
            self.limparAnexo();
            AtendimentoDados.enviar(self.sel, t, { imagem: img ? { url: img.url, nome: img.nome } : null, interna: interna })
                .catch(function (e) { alert(e.message); });
        };
        el.querySelector('#atEnviar').addEventListener('click', enviar);
        campo.addEventListener('keydown', function (e) {
            if (self.rapidasTeclado(e)) return;                       // menu de respostas aberto
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
        });
        // Campo cresce com o texto; "/" no começo abre as respostas rápidas
        campo.addEventListener('input', function () {
            self.ajustarAltura();
            var m = campo.value.match(/^\.?\/([\w-]*)$/);
            if (m) self.abrirRapidas(m[1]); else self.fecharRapidas();
        });
        el.querySelector('#atRapidas').addEventListener('click', function () {
            if (document.getElementById('atRapidasMenu').classList.contains('hidden')) self.abrirRapidas(''); else self.fecharRapidas();
            campo.focus();
        });
        el.querySelector('#atRapidasMenu').addEventListener('mousedown', function (e) {
            var b = e.target.closest('[data-i]'); if (!b) return;
            e.preventDefault(); self.usarRapida(Number(b.dataset.i));
        });
        this.carregarRapidas();

        // Modo: responder ao cliente x nota interna
        this.modo = 'cliente';
        el.querySelectorAll('[data-modo]').forEach(function (b) {
            b.addEventListener('click', function () { self.mudarModo(b.dataset.modo); campo.focus(); });
        });

        // Anexo: botão 📎, colar (Ctrl+V) e arrastar para o chat
        this.anexo = null;
        el.querySelector('#atArquivo').addEventListener('change', function (e) {
            if (e.target.files[0]) self.definirAnexo(e.target.files[0]);
            e.target.value = '';
        });
        el.querySelector('#atAnexoTirar').addEventListener('click', function () { self.limparAnexo(); });
        campo.addEventListener('paste', function (e) {
            var itens = (e.clipboardData && e.clipboardData.files) || [];
            if (itens.length && /^image\//.test(itens[0].type)) { e.preventDefault(); self.definirAnexo(itens[0]); }
        });
        var area = el.querySelector('#atMsgs');
        area.addEventListener('dragover', function (e) { if (self.podeEscrever()) { e.preventDefault(); area.classList.add('soltar'); } });
        area.addEventListener('dragleave', function () { area.classList.remove('soltar'); });
        area.addEventListener('drop', function (e) {
            area.classList.remove('soltar');
            if (!self.podeEscrever()) return;
            e.preventDefault();
            var f = e.dataTransfer.files[0];
            if (f) self.definirAnexo(f);
        });
    },

    // ---------- Colunas com largura ajustável (arrastar o divisor) ----------
    LARGURA_PADRAO: 290, LARGURA_MIN: 200, LARGURA_MAX: 560,

    ativarDivisores: function (el) {
        var self = this, salvas = {};
        try { salvas = JSON.parse(localStorage.getItem('at-larguras') || '{}'); } catch (e) {}
        var limitar = function (w) { return Math.max(self.LARGURA_MIN, Math.min(self.LARGURA_MAX, Math.round(w))); };
        var aplicar = function (col, w) {
            col.style.width = limitar(w) + 'px';
            salvas[col.id] = limitar(w);
            try { localStorage.setItem('at-larguras', JSON.stringify(salvas)); } catch (e) {}
        };

        el.querySelectorAll('.at-divisor').forEach(function (div) {
            var col = el.querySelector('#' + div.dataset.col);
            if (salvas[col.id]) col.style.width = limitar(salvas[col.id]) + 'px';

            // Mouse / toque: arrastar
            div.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                var x0 = e.clientX, w0 = col.getBoundingClientRect().width;
                div.setPointerCapture(e.pointerId);
                div.classList.add('arrastando'); document.body.classList.add('at-redimensionando');
                var mover = function (ev) { aplicar(col, w0 + (ev.clientX - x0)); };
                var soltar = function () {
                    div.classList.remove('arrastando'); document.body.classList.remove('at-redimensionando');
                    div.removeEventListener('pointermove', mover);
                    div.removeEventListener('pointerup', soltar);
                    div.removeEventListener('pointercancel', soltar);
                };
                div.addEventListener('pointermove', mover);
                div.addEventListener('pointerup', soltar);
                div.addEventListener('pointercancel', soltar);
            });
            // Duplo clique: volta ao tamanho padrão
            div.addEventListener('dblclick', function () { aplicar(col, self.LARGURA_PADRAO); });
            // Teclado: setas ajustam de 20 em 20 px
            div.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                aplicar(col, col.getBoundingClientRect().width + (e.key === 'ArrowRight' ? 20 : -20));
            });
        });
    },

    // ---------- Pesquisa de satisfação: painel ----------
    // Admin vê a equipe toda do setor; atendente vê só as próprias avaliações.
    abrirAvaliacoes: function () {
        var self = this, esc = Docs.esc.bind(Docs), eu = AtendimentoDados.atendente();
        var nomeSetor = this.setor === 'med' ? 'Suporte Médico' : 'Implantação';
        AtendimentoDados.avaliacoes(this.setor).then(function (lista) {
            if (!self.ehAdmin) lista = lista.filter(function (a) { return a.atendente === eu; });
            var total = lista.length;
            var soma = lista.reduce(function (s, a) { return s + a.nota; }, 0);
            var media = total ? (soma / total) : 0;
            var satisfeitos = lista.filter(function (a) { return a.nota >= 4; }).length;
            var csat = total ? Math.round(satisfeitos / total * 100) : 0;
            var estrelas = function (n) { return '<span class="at-estrelas" aria-label="' + n + ' de 5">' + '★★★★★'.slice(0, n) + '<span>' + '★★★★★'.slice(n) + '</span></span>'; };

            var barras = [5, 4, 3, 2, 1].map(function (n) {
                var q = lista.filter(function (a) { return a.nota === n; }).length, pct = total ? Math.round(q / total * 100) : 0;
                return '<div class="at-barra"><span>' + n + ' ★</span><div><i style="width:' + pct + '%"></i></div><span>' + q + '</span></div>';
            }).join('');

            var porAtendente = '';
            if (self.ehAdmin && total) {
                var mapa = {};
                lista.forEach(function (a) { (mapa[a.atendente] = mapa[a.atendente] || []).push(a.nota); });
                porAtendente = '<h3>Por atendente</h3><table class="at-tabela"><thead><tr><th>Atendente</th><th>Avaliações</th><th>Média</th></tr></thead><tbody>' +
                    Object.keys(mapa).sort().map(function (k) {
                        var ns = mapa[k], m = ns.reduce(function (s, x) { return s + x; }, 0) / ns.length;
                        return '<tr><td>' + esc(k) + '</td><td>' + ns.length + '</td><td>' + m.toFixed(1).replace('.', ',') + ' ★</td></tr>';
                    }).join('') + '</tbody></table>';
            }

            var itens = lista.length ? lista.map(function (a) {
                return '<li>' + estrelas(a.nota) + '<div><strong>' + esc(a.cliente) + '</strong>' +
                       '<span class="tag">' + esc(a.atendente) + ' · ' + esc(a.quando) + '</span>' +
                       (a.comentario ? '<p>“' + esc(a.comentario) + '”</p>' : '') + '</div></li>';
            }).join('') : '<li class="at-vazio">Nenhuma avaliação ainda. Encerre um chamado para ver a pesquisa em ação.</li>';

            self.modal(
                '<h2>Avaliações · ' + esc(nomeSetor) + (self.ehAdmin ? '' : ' · só as suas') + '</h2>' +
                '<div class="at-resumo-aval">' +
                  '<div class="at-kpi"><strong>' + media.toFixed(1).replace('.', ',') + '</strong><span>média (de 5)</span></div>' +
                  '<div class="at-kpi"><strong>' + csat + '%</strong><span>satisfeitos (notas 4 e 5)</span></div>' +
                  '<div class="at-kpi"><strong>' + total + '</strong><span>respostas</span></div>' +
                '</div>' +
                '<div class="at-barras">' + barras + '</div>' +
                porAtendente +
                '<h3>Últimas avaliações</h3><ul class="at-lista-aval">' + itens + '</ul>'
            );
        });
    },

    // Janela por cima do painel (fecha no ✕, no fundo ou com Esc)
    modal: function (html) {
        var fundo = document.createElement('div');
        fundo.className = 'at-modal-fundo';
        fundo.innerHTML = '<div class="at-modal" role="dialog" aria-modal="true"><button type="button" class="sec at-modal-x" aria-label="Fechar">✕</button>' + html + '</div>';
        var sair = function () { fundo.remove(); document.removeEventListener('keydown', esc); };
        var esc = function (e) { if (e.key === 'Escape') sair(); };
        fundo.addEventListener('click', function (e) { if (e.target === fundo || e.target.closest('.at-modal-x')) sair(); });
        document.addEventListener('keydown', esc);
        document.body.appendChild(fundo);
        fundo.querySelector('.at-modal-x').focus();
    },

    // ---------- Respostas rápidas ( / no campo de mensagem ) ----------
    // Textos ficam em content/respostas-rapidas.json (editável sem mexer no código).
    // Fase 2: tabela "respostas_rapidas" no Supabase, gerenciada pelo admin.
    rapidas: [],
    rapidasFiltro: [],
    rapidasSel: 0,

    carregarRapidas: function () {
        var self = this;
        if (this.rapidas.length) return;
        Docs.load('content/respostas-rapidas.json')
            .then(function (d) { self.rapidas = (d && d.respostas) || []; })
            .catch(function (e) { console.warn('Respostas rápidas:', e.message); });
    },

    ajustarAltura: function () {
        var c = document.getElementById('atTexto'); if (!c) return;
        c.style.height = 'auto';
        c.style.height = Math.min(c.scrollHeight, 180) + 'px';
    },

    abrirRapidas: function (termo) {
        var self = this, menu = document.getElementById('atRapidasMenu'), esc = Docs.esc.bind(Docs);
        var setor = (this.ultimoChat && this.ultimoChat.setor) || this.setor;
        var q = String(termo || '').toLowerCase();
        this.rapidasFiltro = this.rapidas.filter(function (r) {
            var doSetor = r.setor === 'todos' || r.setor === setor;
            return doSetor && (!q || r.atalho.toLowerCase().indexOf(q) === 0 || r.titulo.toLowerCase().indexOf(q) >= 0);
        });
        this.rapidasSel = 0;
        if (!this.rapidasFiltro.length) {
            menu.innerHTML = '<div class="at-rapidas-vazio">' + (this.rapidas.length ? 'Nenhuma resposta com "/' + esc(termo) + '"' : 'Nenhuma resposta cadastrada (content/respostas-rapidas.json)') + '</div>';
        } else {
            menu.innerHTML = this.rapidasFiltro.map(function (r, i) {
                return '<button type="button" role="option" data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '">' +
                       '<strong>/' + esc(r.atalho) + '</strong><span>' + esc(r.titulo) + '</span>' +
                       '<em>' + esc(r.texto.split('\n')[0]) + '</em></button>';
            }).join('');
        }
        menu.classList.remove('hidden');
    },

    fecharRapidas: function () {
        var menu = document.getElementById('atRapidasMenu');
        if (menu) menu.classList.add('hidden');
        this.rapidasFiltro = [];
    },

    // Setas, Enter/Tab e Esc quando o menu está aberto. Devolve true se tratou a tecla.
    rapidasTeclado: function (e) {
        var menu = document.getElementById('atRapidasMenu');
        if (!menu || menu.classList.contains('hidden') || !this.rapidasFiltro.length) {
            if (menu && !menu.classList.contains('hidden') && e.key === 'Escape') { this.fecharRapidas(); return true; }
            return false;
        }
        var n = this.rapidasFiltro.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            this.rapidasSel = (this.rapidasSel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            menu.querySelectorAll('[data-i]').forEach(function (b, i) { b.classList.toggle('sel', i === this.rapidasSel); }, this);
            var atual = menu.querySelector('.sel'); if (atual) atual.scrollIntoView({ block: 'nearest' });
            return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.usarRapida(this.rapidasSel); return true; }
        if (e.key === 'Escape') { e.preventDefault(); this.fecharRapidas(); return true; }
        return false;
    },

    usarRapida: function (i) {
        var r = this.rapidasFiltro[i]; if (!r) return;
        var c = this.ultimoChat, campo = document.getElementById('atTexto');
        var h = new Date().getHours();
        var nome = c ? c.nome.split(/\s+/).slice(0, /^dr(a)?\.?$/i.test(c.nome.split(/\s+/)[0]) ? 2 : 1).join(' ') : '';
        var texto = r.texto
            .replace(/\{nome\}/g, nome)
            .replace(/\{atendente\}/g, AtendimentoDados.atendente())
            .replace(/\{saudacao\}/g, h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite'));
        campo.value = texto;
        this.fecharRapidas();
        this.ajustarAltura();
        campo.focus();
        // Seleciona o primeiro [campo a preencher], ex.: [IP do servidor]
        var ini = texto.indexOf('['), fim = texto.indexOf(']', ini);
        if (ini >= 0 && fim > ini) campo.setSelectionRange(ini, fim + 1);
        else campo.setSelectionRange(texto.length, texto.length);
    },

    // ---------- Anexos, modo da mensagem e ampliação ----------
    ANEXO_MAX_MB: 5,

    podeEscrever: function () {
        var e = document.getElementById('atEnvio');
        return e && !e.classList.contains('hidden');
    },

    definirAnexo: function (arquivo) {
        if (!/^image\/(png|jpeg|gif|webp)$/.test(arquivo.type)) { alert('Envie uma imagem (PNG, JPG, GIF ou WEBP).'); return; }
        if (arquivo.size > this.ANEXO_MAX_MB * 1024 * 1024) { alert('A imagem passa de ' + this.ANEXO_MAX_MB + ' MB.'); return; }
        this.limparAnexo();
        // Demonstração: link local do navegador. No real: upload para bucket PRIVADO do Supabase Storage.
        this.anexo = { url: URL.createObjectURL(arquivo), nome: arquivo.name || 'imagem-colada.png' };
        document.getElementById('atAnexoImg').src = this.anexo.url;
        document.getElementById('atAnexoNome').textContent = this.anexo.nome;
        document.getElementById('atAnexo').classList.remove('hidden');
        document.getElementById('atTexto').placeholder = 'Legenda (opcional) e Enter para enviar';
    },

    limparAnexo: function () {
        this.anexo = null;
        var box = document.getElementById('atAnexo');
        if (box) box.classList.add('hidden');
        this.mudarModo(this.modo || 'cliente');
    },

    mudarModo: function (modo) {
        this.modo = modo;
        var interna = modo === 'interna';
        document.querySelectorAll('[data-modo]').forEach(function (b) {
            var on = b.dataset.modo === modo;
            b.classList.toggle('ativo', on); b.setAttribute('aria-selected', String(on));
        });
        var box = document.getElementById('atEnvio'), campo = document.getElementById('atTexto'), btn = document.getElementById('atEnviar');
        if (!box) return;
        box.classList.toggle('interna', interna);
        btn.textContent = interna ? 'Salvar nota' : 'Enviar';
        if (!this.anexo) campo.placeholder = interna
            ? 'Nota interna: só a equipe vê. Ex.: "aguardando teste de envio"'
            : 'Digite sua resposta e pressione Enter';
    },

    // Há nota interna minha nas últimas mensagens deste chamado?
    temNotaRecente: function (id) {
        var c = this.ultimoChat; if (!c || c.id !== id) return false;
        var ult = c.msgs.slice(-3);
        return ult.some(function (m) { return m.de === 'interna' && m.autor === AtendimentoDados.atendente(); });
    },

    // Só aceita endereços de imagem seguros (blob local, data:image, ou https do Storage)
    urlSegura: function (u) { return /^(blob:|data:image\/|https:\/\/)/.test(String(u || '')); },

    imagemHtml: function (img) {
        if (!img || !this.urlSegura(img.url)) return '';
        var esc = Docs.esc.bind(Docs);
        return '<button type="button" class="at-img-btn" data-acao="ampliar" data-src="' + esc(img.url) + '" data-nome="' + esc(img.nome || '') + '" aria-label="Ampliar imagem">' +
               '<img class="at-img" src="' + esc(img.url) + '" alt="' + esc(img.nome || 'Imagem') + '" loading="lazy"></button>';
    },

    ampliar: function (src, nome) {
        if (!this.urlSegura(src)) return;
        var fundo = document.createElement('div');
        fundo.className = 'at-lightbox';
        fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-label', 'Imagem ampliada');
        var img = document.createElement('img'); img.src = src; img.alt = nome || 'Imagem';
        var fechar = document.createElement('button'); fechar.type = 'button'; fechar.textContent = 'Fechar ✕'; fechar.className = 'sec';
        var baixar = document.createElement('a'); baixar.href = src; baixar.download = nome || 'imagem'; baixar.textContent = 'Baixar'; baixar.className = 'btn';
        var barra = document.createElement('div'); barra.className = 'at-lightbox-barra'; barra.append(baixar, fechar);
        fundo.append(img, barra);
        var sair = function () { fundo.remove(); document.removeEventListener('keydown', esc); };
        var esc = function (e) { if (e.key === 'Escape') sair(); };
        fundo.addEventListener('click', function (e) { if (e.target === fundo || e.target === fechar) sair(); });
        document.addEventListener('keydown', esc);
        document.body.appendChild(fundo);
        fechar.focus();
    },

    pegar: function (id) {
        var self = this;
        AtendimentoDados.pegar(id)
            .then(function () { self.sel = id; self.desenhar(); var c = document.getElementById('atTexto'); if (c) c.focus(); })
            .catch(function (e) { alert(e.message); self.desenhar(); });
    },

    cartao: function (c, naFila) {
        var esc = Docs.esc.bind(Docs);
        var conversa = c.msgs.filter(function (m) { return m.de === 'cliente' || m.de === 'agente'; });
        var ult = conversa[conversa.length - 1];
        var resumo = ult ? (ult.de === 'agente' ? 'Você: ' : '') + (ult.texto || (ult.imagem ? '📷 Imagem' : '')) : '';
        var ativo = c.id === this.sel ? ' ativo' : '';
        var corpo =
            '<button type="button" class="at-abrir" data-acao="abrir" data-id="' + c.id + '">' +
              '<span class="at-nome">' + esc(c.nome) + (naFila ? '' : '<span class="at-hora">' + esc(ult ? ult.hora : '') + '</span>') + '</span>' +
              '<span class="at-local">' + esc(c.local) + '</span>' +
              '<span class="at-resumo">' + esc(resumo) + '</span>' +
            '</button>';
        if (naFila) {
            corpo += '<div class="at-cartao-rodape"><span class="at-espera">aguardando ' + esc(c.espera || '') + '</span>' +
                     '<button type="button" data-acao="pegar" data-id="' + c.id + '">Pegar</button></div>';
        }
        return '<div class="at-cartao' + ativo + '">' + corpo + '</div>';
    },

    desenhar: function () {
        var self = this, esc = Docs.esc.bind(Docs);
        if (!document.getElementById('atMeus')) return;

        document.querySelectorAll('[data-setor]').forEach(function (b) {
            var on = b.dataset.setor === self.setor;
            b.classList.toggle('ativo', on); b.setAttribute('aria-selected', on);
        });
        document.getElementById('atTituloFila').textContent = 'Fila · ' + (this.setor === 'impl' ? 'Implantação' : 'Suporte Médico');

        AtendimentoDados.listar(this.setor).then(function (lista) {
            var meus = lista.filter(function (c) { return c.status === 'meu'; });
            var fila = lista.filter(function (c) { return c.status === 'fila'; });
            var equipe = lista.filter(function (c) { return c.status === 'outro'; }).length;

            document.getElementById('atContaMeus').textContent = meus.length;
            document.getElementById('atContaFila').textContent = fila.length;
            document.getElementById('atEquipe').textContent = '4 atendentes online · ' + equipe + ' com a equipe';
            document.getElementById('atMeus').innerHTML = meus.length
                ? meus.map(function (c) { return self.cartao(c, false); }).join('')
                : '<p class="at-vazio">Nenhum chamado com você. Pegue um chamado da fila.</p>';
            document.getElementById('atFila').innerHTML = fila.length
                ? fila.map(function (c) { return self.cartao(c, true); }).join('')
                : '<p class="at-vazio">Fila vazia. Use "Simular novo contato" para ver um chamado chegando.</p>';

            var c = lista.find(function (x) { return x.id === self.sel; });
            self.desenharChat(c, esc);
        });
    },

    desenharChat: function (c, esc) {
        var topo = document.getElementById('atChatTopo'), msgs = document.getElementById('atMsgs');
        var envio = document.getElementById('atEnvio'), aviso = document.getElementById('atAvisoFila');
        if (!c) {
            topo.innerHTML = '';
            msgs.innerHTML = '<div class="at-sem-chat"><strong>Selecione um chamado</strong><span>Escolha um chamado em "Seus chamados" ou pegue o próximo da fila para começar o atendimento.</span></div>';
            envio.classList.add('hidden'); aviso.classList.add('hidden');
            return;
        }
        var naFila = c.status === 'fila', fechado = c.status === 'fechado';
        var av = c.avaliacao, rotuloFechado = 'Encerrado';
        if (av && av.status === 'aguardando') rotuloFechado = 'Encerrado · aguardando avaliação';
        else if (av && av.nota) rotuloFechado = 'Encerrado · nota ' + av.nota + ' ★';
        topo.innerHTML =
            '<div class="at-quem"><strong>' + esc(c.nome) + '</strong><span>' + esc(c.local) + ' · WhatsApp ' + esc(c.fone) + '</span></div>' +
            (fechado
                ? '<span class="at-status at-status-fechado">' + esc(rotuloFechado) + '</span>'
                : '<span class="at-status ' + (naFila ? 'at-status-fila' : 'at-status-meu') + '">' + (naFila ? 'Na fila' : 'Com você') + '</span>') +
            (fechado ? '' : naFila
                ? '<button type="button" data-acao="pegar" data-id="' + c.id + '">Pegar chamado</button>'
                : '<div class="at-acoes">' +
                    '<div class="at-transf"><button type="button" class="sec" data-acao="menu-transferir" data-id="' + c.id + '" aria-haspopup="true">Transferir ▾</button>' +
                      '<div class="at-menu-transf hidden" id="atMenuTransf" role="menu"><span>Transferir para:</span>' +
                        (this.colegas || []).map(function (n) { return '<button type="button" role="menuitem" data-acao="transferir" data-id="' + c.id + '" data-para="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') +
                      '</div></div>' +
                    '<button type="button" class="sec" data-acao="devolver" data-id="' + c.id + '">Devolver à fila</button>' +
                    '<button type="button" class="sec" data-acao="encerrar" data-id="' + c.id + '">Encerrar</button>' +
                  '</div>');
        this.ultimoChat = c;

        var self = this;
        var html = c.msgs.map(function (m) {
            var img = self.imagemHtml(m.imagem), txt = m.texto ? '<span>' + esc(m.texto) + '</span>' : '';
            if (m.de === 'nota') return '<div class="at-nota">' + esc(m.texto) + ' · ' + esc(m.hora) + '</div>';
            if (m.de === 'bot') return '<div class="at-msg at-msg-bot"><small>Mensagem automática</small>' + esc(m.texto) + '<time>' + esc(m.hora) + '</time></div>';
            if (m.de === 'interna') return '<div class="at-msg at-msg-interna"><small>🔒 Nota interna · ' + esc(m.autor || '') + ' · o cliente não vê</small>' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
            if (m.de === 'agente') return '<div class="at-msg at-msg-agente"><small>' + esc(m.autor || '') + '</small>' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
            return '<div class="at-msg at-msg-cliente">' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
        }).join('');
        if (this.digitandoId === c.id) html += '<div class="at-digitando">' + esc(c.nome) + ' está digitando…</div>';
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;

        envio.classList.toggle('hidden', naFila || fechado);
        aviso.textContent = fechado
            ? 'Chamado encerrado. A pesquisa de satisfação foi enviada ao cliente; a nota aparece em ⭐ Avaliações.'
            : 'Este chamado ainda está na fila. Clique em "Pegar chamado" para responder.';
        aviso.classList.toggle('hidden', !(naFila || fechado));
    }
};