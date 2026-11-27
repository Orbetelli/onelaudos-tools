// ========================================
// ATENDIMENTO — fila de chamados estilo Chatwoot
// Colunas: Seus chamados | Fila | Chat
//
// Fase 1 (agora): dados de demonstração em memória (AtendimentoDados).
// Fase 2: trocar AtendimentoDados pela versão Supabase (mesmas funções),
//         sem mexer na tela (Atendimento).
// ========================================

// Se js/atendimento-db.js não carregou (arquivo fora da pasta ou index.html antigo),
// o painel continua funcionando, só sem as partes em tempo real, e avisa no console.
if (typeof CadastrosDB === 'undefined' || typeof Equipe === 'undefined') {
    console.error('Onelaudos Atendimento: js/atendimento-db.js não foi carregado. Confira se o arquivo está na pasta js/ e se o index.html tem a linha <script src="js/atendimento-db.js">.');
    var semDB = function () { return Promise.reject(new Error('O arquivo js/atendimento-db.js não foi carregado. Confira a pasta js/ e o index.html.')); };
    window.CadastrosDB = { ativo: function () { return false; }, criarLink: semDB, listar: semDB, marcar: semDB,
                           contarPendentes: function () { return Promise.resolve(0); }, aoNovo: function () {}, desligar: function () {}, faltando: true };
    window.Equipe = { entrar: function () {}, sair: function () {}, online: function () { return []; }, estaOnline: function () { return false; },
                      aoMudar: function () {}, colegas: semDB };
}

// ---------- Camada de dados (demonstração) ----------
// Toda função devolve Promise, igual será com o Supabase.
const AtendimentoDemo = (function () {
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
    var solicitacoes = {};                     // token do formulário de cadastro -> chamado

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

    // Chamados antigos (já encerrados), para mostrar o histórico do cliente na demonstração
    function diasAtras(n, h) { var d = new Date(); d.setDate(d.getDate() - n); if (h) d.setHours(h[0], h[1]); return d.toISOString(); }
    var ANTIGOS = [
        { id: 61, setor: 'impl', status: 'fechado', origem: 'whatsapp', canal: 'whatsapp', nome: 'Alan Souza', local: 'Clínica São Lucas', fone: '(11) 90000-0001',
          atendente: 'Ana', criado: diasAtras(12, [10, 5]), encerrado: diasAtras(12, [11, 40]), nota: 5,
          msgs: [{ de: 'cliente', texto: 'O Router está mandando os exames duplicados para o portal.', hora: '10:05' },
                 { de: 'nota', texto: 'Ana assumiu o chamado', hora: '10:07' },
                 { de: 'agente', autor: 'Ana', texto: 'Bom dia, Alan! Ajustei o AETitle e reiniciei o serviço do Router. Pode testar um envio?', hora: '10:30' },
                 { de: 'cliente', texto: 'Testei aqui, agora chegou só uma vez. Obrigado!', hora: '11:35' },
                 { de: 'interna', autor: 'Ana', texto: 'Combinado com o Alan: se voltar a duplicar, trocar a porta para 1777 e pedir acesso remoto ao T.I. (Carlos).', hora: '11:39' }] },
        { id: 58, setor: 'impl', status: 'fechado', origem: 'manual', canal: 'telefone', nome: 'Carlos (T.I.)', local: 'Clínica São Lucas', fone: '',
          atendente: 'Bruno', criado: diasAtras(25, [15, 10]), encerrado: diasAtras(25, [15, 50]), nota: null,
          msgs: [{ de: 'cliente', texto: 'Pediu a criação de 3 usuários novos para a recepção.', hora: '15:10' },
                 { de: 'agente', autor: 'Bruno', texto: 'Usuários criados e enviados por e-mail.', hora: '15:48' },
                 { de: 'interna', autor: 'Bruno', texto: 'O Carlos prefere contato por telefone, não por WhatsApp.', hora: '15:50' }] },
        { id: 44, setor: 'impl', status: 'fechado', origem: 'whatsapp', canal: 'whatsapp', nome: 'Jorge Almeida', local: 'Hospital Santa Rita', fone: '(11) 90000-0003',
          atendente: 'Carla', criado: diasAtras(40, [9, 0]), encerrado: diasAtras(40, [9, 45]), nota: 3, comentario: 'Demorou um pouco.',
          msgs: [{ de: 'cliente', texto: 'Reclamação: o laudo saiu sem a assinatura do médico.', hora: '09:00' },
                 { de: 'agente', autor: 'Carla', texto: 'Reenviamos o laudo assinado. Pedimos desculpas pelo transtorno.', hora: '09:40' },
                 { de: 'interna', autor: 'Carla', texto: 'Cliente ficou chateado. Na próxima, conferir a assinatura antes de liberar.', hora: '09:44' }] },
        { id: 39, setor: 'med', status: 'fechado', origem: 'whatsapp', canal: 'whatsapp', nome: 'Dr. Paulo Mendes', local: 'Médico executante', fone: '(11) 90000-0005',
          atendente: 'Ana', criado: diasAtras(7, [20, 12]), encerrado: diasAtras(7, [20, 40]), nota: 4,
          msgs: [{ de: 'cliente', texto: 'O certificado digital venceu, como renovo no portal?', hora: '20:12' },
                 { de: 'agente', autor: 'Ana', texto: 'Doutor, depois de renovar com a certificadora, é só reinstalar o token e entrar de novo no portal.', hora: '20:30' },
                 { de: 'interna', autor: 'Ana', texto: 'O certificado dele é A3 (token). Se der erro de novo, verificar o driver do token.', hora: '20:38' }] }
    ];
    function soNumeros(f) { var d = String(f || '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-8) : ''; }
    function chaveLocal(l) { return String(l || '').trim().toLowerCase().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    function resumoDe(h) {
        var ult = function (tipo) { for (var i = h.msgs.length - 1; i >= 0; i--) if (h.msgs[i].de === tipo && h.msgs[i].texto) return h.msgs[i].texto; return null; };
        var prim = h.msgs.find(function (m) { return m.de === 'cliente' && m.texto; });
        return { id: h.id, setor: h.setor, status: h.status, origem: h.origem, canal: h.canal, nome: h.nome, local: h.local, atendente: h.atendente,
                 criado: h.criado, encerrado: h.encerrado, nota: h.nota, comentario: h.comentario || '', motivo: prim ? prim.texto : null,
                 nota_interna: ult('interna'), resposta: ult('agente') };
    }

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
            c.msgs.push({ de: 'agente', autor: ATENDENTE, texto: texto, imagem: opcoes.imagem || null, acesso: !!opcoes.acesso, hora: agora() });
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

        // ---------- Solicitação de cadastro de usuários ----------
        // Gera um link único (token) por chamado. O cliente preenche cadastro.html e os dados
        // voltam para o chamado como uma "ficha". No real: tabela solicitacoes_cadastro (03_cadastro.sql).
        solicitarCadastro: function (id, opcoes) {
            var c = achar(id);
            if (!c || c.status !== 'meu') return Promise.reject(new Error('Pegue o chamado antes de enviar o formulário.'));
            var token = opcoes.token || (Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
            solicitacoes[token] = { chamado: id, unidade: opcoes.unidade, formato: opcoes.formato };
            var montado = opcoes.montar(token);   // { texto, link } — a tela monta o link com o token
            c.msgs.push({ de: 'agente', autor: ATENDENTE, texto: montado.texto, hora: agora() });
            c.msgs.push({ de: 'formulario', token: token, formato: opcoes.formato, lote: !!opcoes.lote, link: montado.link || '', hora: agora() });
            avisar({ tipo: 'mensagem', id: id, de: 'agente', setor: c.setor, status: c.status });
            // Demonstração: no formato texto, o cliente responde preenchido sozinho
            if (opcoes.formato === 'texto') {
                var self = this;
                setTimeout(function () { avisar({ tipo: 'digitando', id: id }); }, 900);
                setTimeout(function () {
                    var resposta = 'Nome completo: Fernanda Ribeiro Alves\nNumero de telefone: (11) 98765-4321\nCPF: 123.456.789-09\n' +
                                   'Email: fernanda.alves@exemplo.com.br\nFunção: Recepcionista\nUnidade: ' + (opcoes.unidade || c.local) + '\nCRM (caso seja médico):';
                    c.msgs.push({ de: 'cliente', texto: resposta, hora: agora() });
                    self.lerCadastroTexto(id, resposta);
                }, 3000);
            }
            return Promise.resolve(token);
        },

        // Dados que chegaram pelo formulário (cadastro.html)
        receberCadastro: function (token, dados) {
            var sol = solicitacoes[token], c = sol && achar(sol.chamado);
            if (!c) return false;
            c.msgs.push({ de: 'cadastro', dados: dados, origem: 'formulário', status: 'pendente', hora: agora() });
            avisar({ tipo: 'mensagem', id: c.id, de: 'cliente', setor: c.setor, status: c.status });
            return true;
        },

        // Lote de usuários (implantação nova): uma ficha só, com a lista toda
        receberCadastroLote: function (token, lote) {
            var sol = solicitacoes[token], c = sol && achar(sol.chamado);
            if (!c || !lote || !lote.usuarios) return false;
            lote.usuarios.forEach(function (u) { u.status = 'pendente'; });
            c.msgs.push({ de: 'cadastro-lote', lote: lote, hora: agora() });
            avisar({ tipo: 'mensagem', id: c.id, de: 'cliente', setor: c.setor, status: c.status });
            return true;
        },

        // indiceUsuario = número da linha, ou 'todos'
        marcarLote: function (id, indiceMsg, indiceUsuario) {
            var c = achar(id), m = c && c.msgs[indiceMsg];
            if (!m || m.de !== 'cadastro-lote') return Promise.resolve();
            var alvo = indiceUsuario === 'todos' ? m.lote.usuarios : [m.lote.usuarios[indiceUsuario]];
            alvo.forEach(function (u) { if (u) u.status = 'cadastrado'; });
            if (indiceUsuario === 'todos') c.msgs.push({ de: 'nota', texto: ATENDENTE + ' cadastrou os ' + m.lote.usuarios.length + ' usuários do lote no portal', hora: agora() });
            avisar({ tipo: 'cadastro', id: id });
            return Promise.resolve();
        },

        // Lê uma resposta em texto ("Nome completo: ...") e transforma em ficha(s)
        lerCadastroTexto: function (id, texto) {
            var c = achar(id); if (!c) return 0;
            var chaves = { 'nome completo': 'nome', 'nome': 'nome', 'numero de telefone': 'telefone', 'telefone': 'telefone', 'celular': 'telefone',
                           'cpf': 'cpf', 'email': 'email', 'e-mail': 'email', 'funcao': 'cargo', 'cargo': 'cargo', 'unidade': 'unidade',
                           'crm (caso seja medico)': 'crm', 'crm': 'crm' };
            var norm = function (x) { return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
            var pessoas = [], atual = null;
            texto.split(/\r?\n/).forEach(function (linha) {
                var m = linha.match(/^\s*([^:]{2,40}):\s*(.*)$/); if (!m) return;
                var campo = chaves[norm(m[1])]; if (!campo) return;
                if (campo === 'nome' && atual && atual.nome) atual = null;   // começou outra pessoa
                if (!atual) { atual = {}; pessoas.push(atual); }
                atual[campo] = m[2].trim();
            });
            pessoas = pessoas.filter(function (p) { return p.nome || p.email; });
            pessoas.forEach(function (p) {
                c.msgs.push({ de: 'cadastro', dados: p, origem: 'resposta no WhatsApp', status: 'pendente', hora: agora() });
            });
            if (pessoas.length) avisar({ tipo: 'mensagem', id: id, de: 'cliente', setor: c.setor, status: c.status });
            return pessoas.length;
        },

        marcarCadastrado: function (id, indice) {
            var c = achar(id), m = c && c.msgs[indice];
            if (!m || m.de !== 'cadastro') return Promise.resolve();
            m.status = 'cadastrado';
            c.msgs.push({ de: 'nota', texto: ATENDENTE + ' cadastrou ' + (m.dados.nome || 'o usuário') + ' no portal', hora: agora() });
            avisar({ tipo: 'cadastro', id: id });
            return Promise.resolve();
        },

        historico: function (id) {
            var c = achar(id); if (!c) return Promise.resolve({ lista: [] });
            var f = soNumeros(c.fone), l = c.setor === 'med' ? '' : chaveLocal(c.local);
            var lista = ANTIGOS.concat(chamados.filter(function (x) { return x.id !== id && x.status === 'fechado'; }))
                .filter(function (h) { return h.setor === c.setor && h.id !== id; })
                .map(function (h) {
                    var porFone = f && soNumeros(h.fone) === f, porLocal = l && chaveLocal(h.local) === l;
                    if (!porFone && !porLocal) return null;
                    var r = resumoDe(h); r.por = porFone ? 'telefone' : 'unidade'; return r;
                }).filter(Boolean)
                .sort(function (a, b) { return String(b.criado || '').localeCompare(String(a.criado || '')); });
            return Promise.resolve({ lista: lista });
        },
        conversa: function (id) {
            var h = ANTIGOS.find(function (x) { return x.id === id; }) || achar(id);
            return Promise.resolve(h ? h.msgs.slice() : []);
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
// Camada em uso: começa na demonstração; com login e o 06 rodado, troca para AtendimentoReal
var AtendimentoDados = AtendimentoDemo;

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
        if (!this.ouvindoFormulario) {
            this.ouvindoFormulario = true;
            window.addEventListener('message', function (e) {
                if (e.origin !== location.origin || !e.data) return;
                if (e.data.tipo === 'onelaudos-cadastro') AtendimentoDados.receberCadastro(String(e.data.token), e.data.dados || {});
                else if (e.data.tipo === 'onelaudos-cadastro-lote') AtendimentoDados.receberCadastroLote(String(e.data.token), e.data.lote);
                else return;
                // Fecha a janela do formulário logo depois do "Cadastro enviado ✅"
                setTimeout(function () {
                    var fr = document.querySelector('.at-iframe'), fundo = fr && fr.closest('.at-modal-fundo');
                    if (fundo) fundo.remove();
                }, 1500);
            });
        }
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
        // Com login, tenta os chamados reais (precisa do 06_chamados.sql); senão, segue com os exemplos
        if (!demo && p && typeof AtendimentoReal !== 'undefined' && !this.realTentado) {
            this.realTentado = true;
            el.innerHTML = '<p class="vazio">Carregando chamados...</p>';
            AtendimentoReal.iniciar(p).then(function () {
                AtendimentoDados = AtendimentoReal; self.chamadosReais = true;
            }).catch(function (e) {
                console.warn('Chamados reais desligados:', e.message);
                AtendimentoDados = AtendimentoDemo; self.chamadosReais = false; self.motivoExemplo = e.message;
            }).then(function () { if (location.hash.indexOf('#/atendimento') === 0) self.abrirPainel(el, demo); });
            return;
        }
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
        // Voltando do Gerador de senhas: abre o chamado para onde o acesso foi enviado
        try { var volta = Number(sessionStorage.getItem('at-abrir')); sessionStorage.removeItem('at-abrir'); if (volta) this.sel = volta; } catch (e) {}
        this.desenhar();
        if (!demo && p) this.ligarTempoReal(p);   // depois de montar: precisa do selo e do contador na tela
        if (!demo && CadastrosDB.faltando) this.aviso('⚠️ Falta o arquivo js/atendimento-db.js: cadastros e equipe online desligados.');
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
                (this.demo ? '<span class="at-demo" title="' + Docs.esc(Auth.motivoDemo()) + '">Demonstração</span>'
                           : (this.chamadosReais ? '' : '<span class="at-demo at-demo-info" title="' + Docs.esc('Os chamados da fila ainda são exemplos (cada pessoa vê a sua cópia). ' + (this.motivoExemplo || '')) + '">Chamados de exemplo</span>')) +
                '<div class="at-setores" role="tablist" aria-label="Setor">' +
                  this.setores.map(function (st) { return '<button type="button" data-setor="' + st + '">' + (st === 'med' ? 'Suporte Médico' : 'Implantação') + '</button>'; }).join('') +
                '</div>' +
                '<span class="at-equipe" id="atEquipe"></span>' +
                (this.demo ? '' : '<button type="button" class="sec at-menu-btn" id="atCadastros" title="Cadastros recebidos">📋 <span class="at-badge hidden" id="atCadBadge">0</span></button>') +
                '<button type="button" class="sec at-menu-btn" id="atAvaliacoes" title="Avaliações">⭐</button>' +
                '<button type="button" class="sec at-menu-btn" id="atSom"></button>' +
                (this.chamadosReais && typeof Implantacoes !== 'undefined' ? '<button type="button" class="sec at-menu-btn" id="atVista">🏗 Implantações</button>' : '') +
                (this.chamadosReais ? '<button type="button" id="atNovoChamado" title="Registrar um atendimento que chegou pelo WhatsApp normal, telefone, e-mail...">+ Novo chamado</button>' : '') +
                '<button type="button" class="sec" id="atSimular" title="Cria um chamado de teste na fila, como se um cliente tivesse chamado">🧪 Simular</button>' +
                '<span class="at-eu" title="' + nome + '"><span class="at-avatar">' + iniciais + '</span>' +
                  (this.ehAdmin && !this.demo ? '<span class="at-papel">Admin</span>' : '') + '</span>' +
                (this.demo ? '' : '<button type="button" class="sec at-menu-btn" id="atSair">Sair</button>') +
              '</div>' +
              '<div class="at-colunas">' +
                '<section class="at-col" id="atColMeus" aria-label="Seus chamados"><div class="at-col-topo"><h2>Seus chamados</h2><span class="at-conta" id="atContaMeus"></span></div><div class="at-lista" id="atMeus"></div></section>' +
                '<div class="at-divisor" data-col="atColMeus" role="separator" aria-orientation="vertical" aria-label="Ajustar largura de Seus chamados" tabindex="0" title="Arraste para ajustar · duplo clique volta ao padrão"></div>' +
                '<section class="at-col at-col-fila" id="atColFila" aria-label="Fila e todos os chamados">' +
                  '<div class="at-col-topo at-abas-fila" role="tablist" aria-label="Fila ou todos os chamados">' +
                    '<button type="button" role="tab" data-aba="fila">Fila <span class="at-conta at-conta-fila" id="atContaFila"></span></button>' +
                    '<button type="button" role="tab" data-aba="todos" title="Todos os chamados do setor e com quem estão">Todos <span class="at-conta" id="atContaTodos"></span></button>' +
                    '<span class="tag" id="atTituloFila"></span>' +
                  '</div>' +
                  '<div class="at-todos-barra hidden" id="atTodosBarra">' +
                    '<div class="at-resumo-equipe" id="atResumoEquipe"></div>' +
                    '<div class="at-todos-filtros"><label class="at-oculto" for="atTodosQuem">Filtrar</label><select id="atTodosQuem"></select>' +
                    '<label class="at-oculto" for="atTodosBusca">Buscar</label><input type="search" id="atTodosBusca" placeholder="Buscar cliente ou unidade"></div>' +
                  '</div>' +
                  '<div class="at-lista" id="atFila"></div></section>' +
                '<div class="at-divisor" data-col="atColFila" role="separator" aria-orientation="vertical" aria-label="Ajustar largura da Fila" tabindex="0" title="Arraste para ajustar · duplo clique volta ao padrão"></div>' +
                '<section class="at-chat" aria-label="Chat">' +
                  '<div id="atChatTopo" class="at-chat-topo"></div>' +
                  '<div class="at-msgs" id="atMsgs"></div>' +
                  '<div class="at-envio-box" id="atEnvio">' +
                    '<div class="at-modos" role="tablist" aria-label="Tipo de mensagem">' +
                      '<button type="button" class="ativo" data-modo="cliente" role="tab" aria-selected="true">Responder ao cliente</button>' +
                      '<button type="button" data-modo="interna" role="tab" aria-selected="false">🔒 Nota interna</button>' +
                      '<button type="button" data-modo="cliente-teste" role="tab" aria-selected="false" class="hidden" title="Só em chamados de teste: escreve como se fosse o cliente (para testar respostas e a pesquisa de satisfação)">🧪 Como cliente (teste)</button>' +
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
              '<div class="im-vista hidden" id="atImplView"></div>' +
            '</div>';

        el.querySelectorAll('[data-setor]').forEach(function (b) {
            b.addEventListener('click', function () { self.setor = b.dataset.setor; self.sel = null; self.desenhar(); });
        });
        // Recolher / mostrar o menu lateral (só vale nesta aba; fica salvo no navegador)
        var btnMenu = el.querySelector('#atMenu');
        var aplicarMenu = function (recolhido) {
            document.body.classList.toggle('menu-recolhido', recolhido);
            btnMenu.textContent = recolhido ? '☰' : '«';
            btnMenu.title = recolhido ? 'Mostrar menu' : 'Recolher menu';
            btnMenu.setAttribute('aria-expanded', String(!recolhido));
            try { localStorage.setItem('at-menu-recolhido', recolhido ? '1' : '0'); } catch (e) {}
        };
        var salvo = false;
        try { salvo = localStorage.getItem('at-menu-recolhido') === '1'; } catch (e) {}
        aplicarMenu(salvo);
        btnMenu.addEventListener('click', function () { aplicarMenu(!document.body.classList.contains('menu-recolhido')); });

        this.ativarDivisores(el);

        el.querySelector('#atAvaliacoes').addEventListener('click', function () { self.abrirAvaliacoes(); });
        var btnCad = el.querySelector('#atCadastros');
        if (btnCad) btnCad.addEventListener('click', function () { self.abrirCadastros(); });

        var btnSom = el.querySelector('#atSom');
        var mostrarSom = function () {
            var on = AtendimentoSom.ligado();
            btnSom.textContent = on ? '🔔' : '🔕';
            btnSom.title = on ? 'Som ligado (clique para desligar)' : 'Som desligado (clique para ligar)';
            btnSom.setAttribute('aria-pressed', String(on));
        };
        mostrarSom();
        btnSom.addEventListener('click', function () { AtendimentoSom.alternar(); mostrarSom(); });

        var btnSair = el.querySelector('#atSair');
        if (btnSair) btnSair.addEventListener('click', function () {
            if (self.desligar) { self.desligar(); self.desligar = null; }
            self.desligarTempoReal();
            if (typeof AtendimentoReal !== 'undefined') AtendimentoReal.parar();
            if (typeof Implantacoes !== 'undefined') Implantacoes.parar();
            self.vista = 'chamados';
            AtendimentoDados = AtendimentoDemo; self.chamadosReais = false; self.realTentado = false; self.sel = null;
            Auth.sair().then(function () { self.render(el); });
        });

        // Abas da coluna do meio: Fila | Todos
        this.abaFila = this.abaFila || 'fila';
        el.querySelectorAll('[data-aba]').forEach(function (b) {
            b.addEventListener('click', function () { self.abaFila = b.dataset.aba; self.desenhar(); });
        });
        el.querySelector('#atTodosQuem').addEventListener('change', function () { self.todosQuem = this.value; self.desenhar(); });
        el.querySelector('#atTodosBusca').addEventListener('input', function () { self.todosBusca = this.value; self.desenhar(); });

        var btnNovo = el.querySelector('#atNovoChamado');
        if (btnNovo) btnNovo.addEventListener('click', function () { self.abrirNovoChamado(); });

        // Alterna entre Chamados e Implantações
        var btnVista = el.querySelector('#atVista');
        if (btnVista) btnVista.addEventListener('click', function () { self.mostrarVista(self.vista === 'impl' ? 'chamados' : 'impl'); });
        if (this.vista === 'impl') this.mostrarVista('impl');

        el.querySelector('#atSimular').addEventListener('click', function () {
            Promise.resolve(AtendimentoDados.simularContato(self.setor)).catch(function (e) { alert(e.message); });
        });

        // Um ouvinte só para as listas e o topo do chat (delegação)
        el.querySelector('.at-colunas').addEventListener('click', function (e) {
            var b = e.target.closest('[data-acao]');
            if (!b) return;
            var id = Number(b.dataset.id);
            if (b.dataset.acao === 'abrir') { if (self.sel !== id) self.modo = 'cliente'; self.sel = id; self.desenhar(); }
            if (b.dataset.acao === 'pegar') self.pegar(id);
            var falhou = function (e2) { alert(e2.message); };
            if (b.dataset.acao === 'encerrar') Promise.resolve(AtendimentoDados.encerrar(id)).then(function () { self.desenhar(); }).catch(falhou);
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
            if (b.dataset.acao === 'assumir')
                Promise.resolve(AtendimentoDados.transferir(id, AtendimentoDados.atendente())).then(function () { self.abaFila = 'fila'; self.desenhar(); }).catch(falhou);
            if (b.dataset.acao === 'transferir-admin')
                Promise.resolve(AtendimentoDados.transferir(id, b.dataset.para)).then(function () { self.desenhar(); }).catch(falhou);
            if (b.dataset.acao === 'devolver') AtendimentoDados.devolver(id).then(function () { self.sel = null; self.desenhar(); }).catch(function (e2) { alert(e2.message); });
            if (b.dataset.acao === 'ampliar') self.ampliar(b.dataset.src, b.dataset.nome);
            if (b.dataset.acao === 'historico') self.abrirHistorico(self.ultimoChat);
            if (b.dataset.acao === 'solicitar-cadastro') self.abrirSolicitarCadastro(id);
            if (b.dataset.acao === 'simular-form') self.simularFormulario(b.dataset.token, b.dataset.link);
            if (b.dataset.acao === 'cpf') { var cel = b.parentNode.querySelector('.at-cpf'); var vis = cel.dataset.vis === '1';
                cel.textContent = vis ? cel.dataset.mask : cel.dataset.full; cel.dataset.vis = vis ? '0' : '1'; b.textContent = vis ? 'mostrar' : 'ocultar'; }
            if (b.dataset.acao === 'copiar-ficha') self.copiarFicha(Number(b.dataset.i), b);
            if (b.dataset.acao === 'csv-ficha') self.exportarFicha(Number(b.dataset.i));
            if (b.dataset.acao === 'gerar-acesso') self.gerarAcesso(Number(b.dataset.i));
            if (b.dataset.acao === 'ver-senha') {
                var sp = b.previousElementSibling, vis = sp.dataset.vis === '1';
                sp.textContent = vis ? '••••••••' : sp.dataset.full; sp.dataset.vis = vis ? '0' : '1'; b.textContent = vis ? 'mostrar' : 'ocultar';
            }
            if (b.dataset.acao === 'cadastrado') Promise.resolve(AtendimentoDados.marcarCadastrado(self.sel, Number(b.dataset.i))).catch(falhou);
            if (b.dataset.acao === 'lote-um') Promise.resolve(AtendimentoDados.marcarLote(self.sel, Number(b.dataset.i), Number(b.dataset.u))).catch(falhou);
            if (b.dataset.acao === 'lote-todos') Promise.resolve(AtendimentoDados.marcarLote(self.sel, Number(b.dataset.i), 'todos')).catch(falhou);
            if (b.dataset.acao === 'lote-csv') self.exportarLote(Number(b.dataset.i));
            if (b.dataset.acao === 'lote-copiar') self.copiarLote(Number(b.dataset.i), b);
        });

        var campo = el.querySelector('#atTexto');
        var enviar = function () {
            var t = campo.value.trim(), img = self.anexo;
            if ((!t && !img) || self.sel == null) return;
            var interna = self.modo === 'interna';
            if (self.modo === 'cliente-teste') {
                if (!t) return;
                campo.value = ''; self.ajustarAltura();
                var manual = self.ultimoChat && self.ultimoChat.origem === 'manual';
                Promise.resolve(manual ? AtendimentoDados.registrarFala(self.sel, t) : AtendimentoDados.respostaDoCliente(self.sel, t))
                    .catch(function (e) { alert(e.message); });
                return;
            }
            campo.value = '';
            self.ajustarAltura(); self.fecharRapidas();
            self.limparAnexo();
            AtendimentoDados.enviar(self.sel, t, { imagem: img ? { url: img.url, nome: img.nome, arquivo: img.arquivo } : null, interna: interna })
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
    LARGURA_PADRAO: 236, LARGURA_MIN: 180, LARGURA_MAX: 520,

    ativarDivisores: function (el) {
        var self = this, salvas = {};
        try { salvas = JSON.parse(localStorage.getItem('at-larguras-v2') || '{}'); } catch (e) {}
        var limitar = function (w) { return Math.max(self.LARGURA_MIN, Math.min(self.LARGURA_MAX, Math.round(w))); };
        var aplicar = function (col, w) {
            col.style.width = limitar(w) + 'px';
            salvas[col.id] = limitar(w);
            try { localStorage.setItem('at-larguras-v2', JSON.stringify(salvas)); } catch (e) {}
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

    // ---------- Vistas: Chamados x Implantações ----------
    mostrarVista: function (vista) {
        var self = this, impl = vista === 'impl';
        this.vista = vista;
        var colunas = document.querySelector('.at-colunas'), caixa = document.getElementById('atImplView'), b = document.getElementById('atVista');
        if (!colunas || !caixa) return;
        colunas.classList.toggle('hidden', impl);
        caixa.classList.toggle('hidden', !impl);
        if (b) b.textContent = impl ? '💬 Chamados' : '🏗 Implantações';
        ['atNovoChamado', 'atSimular'].forEach(function (id) { var x = document.getElementById(id); if (x) x.classList.toggle('hidden', impl); });
        if (impl) Implantacoes.abrir(caixa, {
            colegas: function () { return self.equipeCompleta || []; },
            aviso: function (t) { self.aviso(t); },
            modal: function (html, largo) { self.modal(html, largo); }
        });
    },

    // ---------- Chamado manual ----------
    rotuloCanal: function (canal) {
        return { whatsapp_pessoal: 'WhatsApp', telefone: 'telefone', email: 'e-mail', presencial: 'presencial', outro: 'outro canal', whatsapp: 'WhatsApp' }[canal] || 'outro canal';
    },
    ehManual: function () { return !!(this.ultimoChat && this.ultimoChat.origem === 'manual'); },

    abrirNovoChamado: function () {
        var self = this;
        this.modal(
            '<h2>+ Novo chamado</h2>' +
            '<p class="tag">Registre um atendimento que chegou fora do sistema. O histórico fica no painel; nada é enviado ao cliente por aqui.</p>' +
            '<form class="at-form" id="atNovoForm">' +
              (this.setores.length > 1 ? '<label for="atNSetor">Setor</label><select id="atNSetor">' + this.setores.map(function (st) {
                  return '<option value="' + st + '"' + (st === self.setor ? ' selected' : '') + '>' + (st === 'med' ? 'Suporte Médico' : 'Implantação') + '</option>'; }).join('') + '</select>' : '') +
              '<label for="atNNome">Cliente (nome de quem chamou)</label><input type="text" id="atNNome" required>' +
              '<label for="atNLocal">Unidade</label><input type="text" id="atNLocal" placeholder="Clínica, hospital...">' +
              '<label for="atNFone">Telefone (opcional)</label><input type="text" id="atNFone" placeholder="(11) 91234-5678">' +
              '<label for="atNCanal">Por onde entrou em contato</label><select id="atNCanal">' +
                '<option value="whatsapp_pessoal">WhatsApp</option><option value="telefone">Telefone</option><option value="email">E-mail</option>' +
                '<option value="presencial">Presencial</option><option value="outro">Outro</option></select>' +
              '<label for="atNTexto">O que o cliente pediu</label><textarea id="atNTexto" rows="4" placeholder="Ex.: o Router parou de enviar exames desde ontem"></textarea>' +
              '<fieldset class="at-formato"><legend>Depois de registrar</legend>' +
                '<label><input type="radio" name="atNDest" value="comigo" checked> <span><strong>Fica comigo</strong>: já vou atender.</span></label>' +
                '<label><input type="radio" name="atNDest" value="fila"> <span><strong>Vai para a fila</strong>: alguém da equipe pega.</span></label>' +
              '</fieldset>' +
              '<div class="erro" id="atNErro" role="alert"></div>' +
              '<button type="submit">Registrar chamado</button>' +
            '</form>');
        document.getElementById('atNNome').focus();
        document.getElementById('atNovoForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var v = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ''; };
            var erro = document.getElementById('atNErro'), btn = e.target.querySelector('button[type=submit]');
            if (v('atNNome').length < 2) { erro.textContent = 'Informe o nome do cliente.'; return; }
            if (v('atNTexto').length < 3) { erro.textContent = 'Descreva o que o cliente pediu.'; return; }
            var comigo = document.querySelector('[name=atNDest]:checked').value === 'comigo';
            var setor = v('atNSetor') || self.setor;
            btn.disabled = true; btn.textContent = 'Registrando...';
            AtendimentoDados.criarChamado({ setor: setor, nome: v('atNNome'), local: v('atNLocal'), fone: v('atNFone'), canal: v('atNCanal'), texto: v('atNTexto'), comigo: comigo })
                .then(function (id) {
                    document.querySelector('.at-modal-fundo').remove();
                    if (setor !== self.setor) { self.setor = setor; }
                    if (comigo) self.sel = id;
                    self.desenhar();
                    self.aviso(comigo ? '📝 Chamado registrado e já está com você.' : '📝 Chamado registrado na fila.');
                })
                .catch(function (e2) { erro.textContent = e2.message; btn.disabled = false; btn.textContent = 'Registrar chamado'; });
        });
    },

    // ---------- Tempo real: equipe online e cadastros (só com login) ----------
    ligarTempoReal: function (perfil) {
        var self = this;
        if (this.tempoRealLigado) { this.atualizarBadge(); return; }
        this.tempoRealLigado = true;
        Equipe.entrar(perfil);
        Equipe.aoMudar(function () { self.mostrarOnline(); });
        Equipe.colegas().then(function (lista) {
            self.equipeCompleta = lista;
            self.colegasReais = lista.filter(function (x) { return x.id !== perfil.id; });
            self.colegas = self.colegasReais.map(function (x) { return x.nome; });
            if (typeof AtendimentoReal !== 'undefined') AtendimentoReal.definirColegas(self.equipeCompleta);
        }).catch(function (e) { console.warn('Colegas:', e.message); });
        CadastrosDB.aoNovo(function (linha) {
            if (self.setores.indexOf(linha.setor) < 0) return;
            AtendimentoSom.tocar('novo');
            var d = linha.dados || {};
            self.aviso('📋 Cadastro recebido: ' + (d.nome || 'novo usuário') + (d.unidade ? ' · ' + d.unidade : ''));
            self.atualizarBadge();
            if (document.getElementById('atCadLista')) self.carregarCadastros();
        });
        this.atualizarBadge();
    },

    desligarTempoReal: function () {
        if (!this.tempoRealLigado) return;
        this.tempoRealLigado = false;
        Equipe.sair(); CadastrosDB.desligar();
        this.colegasReais = null;
    },

    mostrarOnline: function () {
        var alvo = document.getElementById('atEquipe'); if (!alvo || this.demo) return;
        var meus = this.setores, lista = Equipe.online().filter(function (p) {
            return p.papel === 'admin' || (p.setores || []).some(function (x) { return meus.indexOf(x) >= 0; });
        });
        alvo.textContent = lista.length + ' online' + (lista.length ? ': ' + lista.map(function (p) { return p.nome; }).join(', ') : '');
        alvo.title = 'Atendentes com o painel aberto agora';
    },

    colegaOnline: function (nome) {
        var c = (this.colegasReais || []).find(function (x) { return x.nome === nome; });
        return c ? Equipe.estaOnline(c.id) : this.demo;
    },

    atualizarBadge: function () {
        var b = document.getElementById('atCadBadge'); if (!b || !CadastrosDB.ativo()) return;
        CadastrosDB.contarPendentes(this.setores).then(function (n) {
            b.textContent = n; b.classList.toggle('hidden', !n);
        });
    },

    // Aviso rápido no canto da tela
    aviso: function (texto) {
        var t = document.createElement('div');
        t.className = 'at-toast'; t.setAttribute('role', 'status'); t.textContent = texto;
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add('sai'); }, 4500);
        setTimeout(function () { t.remove(); }, 5000);
    },

    // ---------- Lista de cadastros recebidos (banco) ----------
    abrirCadastros: function () {
        var self = this, esc = Docs.esc.bind(Docs);
        this.cadFiltro = this.cadFiltro || 'pendente';
        this.modal(
            '<h2>📋 Cadastros recebidos</h2>' +
            '<p class="tag">Tudo o que os clientes enviaram pelo formulário, ao vivo. Use o link mesmo pelo WhatsApp normal: as fichas chegam aqui.</p>' +
            '<div class="at-cad-barra">' +
              (this.setores.length > 1 ? '<select id="atCadSetor" aria-label="Setor">' + this.setores.map(function (st) {
                  return '<option value="' + st + '"' + (st === self.setor ? ' selected' : '') + '>' + (st === 'med' ? 'Suporte Médico' : 'Implantação') + '</option>'; }).join('') + '</select>' : '') +
              '<select id="atCadFiltro" aria-label="Filtro"><option value="pendente">Pendentes</option><option value="todos">Todos</option></select>' +
              '<button type="button" id="atCadNovo">+ Gerar link de cadastro</button>' +
            '</div>' +
            '<div id="atCadNovoBox" class="hidden"></div>' +
            '<div id="atCadLista"><p class="vazio">Carregando...</p></div>', true);
        document.getElementById('atCadFiltro').value = this.cadFiltro;
        document.getElementById('atCadFiltro').addEventListener('change', function () { self.cadFiltro = this.value; self.carregarCadastros(); });
        var selSetor = document.getElementById('atCadSetor');
        if (selSetor) selSetor.addEventListener('change', function () { self.carregarCadastros(); });
        document.getElementById('atCadNovo').addEventListener('click', function () { self.formNovoLink(); });
        document.getElementById('atCadLista').addEventListener('click', function (e) {
            var b = e.target.closest('[data-cad]'); if (!b) return;
            var ids = String(b.dataset.ids).split(',').map(Number);
            if (b.dataset.cad === 'marcar') CadastrosDB.marcar(ids, 'cadastrado').then(function () { self.carregarCadastros(); self.atualizarBadge(); }).catch(function (e2) { alert(e2.message); });
            if (b.dataset.cad === 'csv') self.cadCsv(ids);
            if (b.dataset.cad === 'copiar') self.cadCopiar(ids, b);
            if (b.dataset.cad === 'cpf') { var cel = b.parentNode.querySelector('.at-cpf'), vis = cel.dataset.vis === '1';
                cel.textContent = vis ? cel.dataset.mask : cel.dataset.full; cel.dataset.vis = vis ? '0' : '1'; b.textContent = vis ? 'mostrar' : 'ocultar'; }
        });
        this.carregarCadastros();
    },

    cadSetor: function () { var s = document.getElementById('atCadSetor'); return s ? s.value : this.setor; },

    carregarCadastros: function () {
        var self = this, alvo = document.getElementById('atCadLista'); if (!alvo) return;
        CadastrosDB.listar(this.cadSetor(), this.cadFiltro === 'pendente').then(function (linhas) {
            self.cadLinhas = linhas;
            if (!linhas.length) { alvo.innerHTML = '<p class="vazio">' + (self.cadFiltro === 'pendente' ? 'Nenhum cadastro pendente. 🎉' : 'Nenhum cadastro recebido ainda.') + '</p>'; return; }
            // Agrupa: cada lote vira um bloco; avulsos ficam sozinhos
            var grupos = [], porLote = {};
            linhas.forEach(function (l) {
                if (l.lote) { if (!porLote[l.lote]) { porLote[l.lote] = { lote: true, itens: [] }; grupos.push(porLote[l.lote]); } porLote[l.lote].itens.push(l); }
                else grupos.push({ lote: false, itens: [l] });
            });
            alvo.innerHTML = grupos.map(function (g) { return self.cadBloco(g); }).join('');
        }).catch(function (e) { alvo.innerHTML = '<p class="vazio">' + Docs.esc(e.message) + '</p>'; });
    },

    cadBloco: function (g) {
        var self = this, esc = Docs.esc.bind(Docs), primeiro = g.itens[0], d0 = primeiro.dados || {};
        var ids = g.itens.map(function (l) { return l.id; }).join(',');
        var pend = g.itens.filter(function (l) { return l.status === 'pendente'; });
        var quando = new Date(primeiro.recebido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        var mascara = function (cpf) { var dg = String(cpf || '').replace(/\D/g, ''); return dg.length === 11 ? '***.' + dg.slice(3, 6) + '.' + dg.slice(6, 9) + '-**' : (cpf ? '***' : '—'); };
        var linhas = g.itens.map(function (l) {
            var d = l.dados || {}, erros = self.checarPessoa(d);
            return '<tr class="' + (l.status === 'cadastrado' ? 'ok' : '') + '"><td>' + esc(d.nome) + '</td><td>' + esc(d.email) + '</td><td>' + esc(d.telefone) + '</td>' +
                   '<td><span class="at-cpf" data-mask="' + esc(mascara(d.cpf)) + '" data-full="' + esc(d.cpf || '') + '" data-vis="0">' + esc(mascara(d.cpf)) + '</span> ' +
                     (d.cpf ? '<button type="button" class="at-link" data-cad="cpf" data-ids="' + l.id + '">mostrar</button>' : '') + '</td>' +
                   '<td>' + esc(d.cargo) + (d.crm ? '<br><span class="tag">CRM ' + esc(d.crm) + '</span>' : '') + '</td>' +
                   '<td>' + (erros.length ? '<span class="at-chip ruim">✗ ' + esc(erros.join(', ')) + '</span>' : '<span class="at-chip ok">✓</span>') + '</td>' +
                   '<td>' + (l.status === 'cadastrado' ? '<span class="at-chip ok">Cadastrado</span>' : '<button type="button" class="at-link" data-cad="marcar" data-ids="' + l.id + '">marcar</button>') + '</td></tr>';
        }).join('');
        var resp = primeiro.responsavel && primeiro.responsavel.nome ? ' · enviado por ' + esc(primeiro.responsavel.nome) : '';
        return '<div class="at-ficha at-ficha-lote' + (pend.length ? '' : ' feito') + '">' +
            '<div class="at-ficha-topo"><strong>' + (g.lote ? '📋 Lote · ' : '📋 ') + esc(d0.unidade || 'Sem unidade') + '</strong>' +
              '<span class="at-status ' + (pend.length ? 'at-status-fila' : 'at-status-meu') + '">' + (g.itens.length - pend.length) + ' de ' + g.itens.length + ' cadastrados</span></div>' +
            '<small class="tag">Recebido em ' + esc(quando) + resp + '</small>' +
            '<div class="at-lote-wrap"><table class="at-lote"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>CPF</th><th>Função</th><th>Conferência</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
            '<div class="at-ficha-acoes">' +
              '<button type="button" class="sec" data-cad="csv" data-ids="' + ids + '">CSV p/ Gerador de senhas</button>' +
              '<button type="button" class="sec" data-cad="copiar" data-ids="' + ids + '">Copiar tabela</button>' +
              (pend.length ? '<button type="button" data-cad="marcar" data-ids="' + pend.map(function (l) { return l.id; }).join(',') + '">Marcar ' + (pend.length > 1 ? 'todos ' : '') + 'como cadastrado' + (pend.length > 1 ? 's' : '') + '</button>' : '') +
            '</div></div>';
    },

    cadSelecionar: function (ids) {
        return (this.cadLinhas || []).filter(function (l) { return ids.indexOf(l.id) >= 0; }).map(function (l) { return l.dados || {}; });
    },

    cadCsv: function (ids) {
        var self = this, lista = this.cadSelecionar(ids).filter(function (d) { return !self.checarPessoa(d).length; });
        if (!lista.length) { alert('Nenhum usuário válido para exportar.'); return; }
        var cel = function (v) { v = String(v || ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        var csv = '﻿' + ['Nome completo', 'E-mail', 'Telefone', 'Função', 'CRM', 'Unidade'].join(',') + '\r\n' +
                  lista.map(function (d) { return [d.nome, d.email, d.telefone, d.cargo, d.crm, d.unidade].map(cel).join(','); }).join('\r\n') + '\r\n';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = 'cadastros-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
    },

    cadCopiar: function (ids, botao) {
        var linhas = [['Nome completo', 'E-mail', 'Telefone', 'CPF', 'Função', 'CRM', 'Unidade'].join('\t')].concat(
            this.cadSelecionar(ids).map(function (d) { return [d.nome, d.email, d.telefone, d.cpf, d.cargo, d.crm, d.unidade].join('\t'); }));
        navigator.clipboard.writeText(linhas.join('\n')).then(function () {
            var antes = botao.textContent; botao.textContent = 'Copiado ✓'; setTimeout(function () { botao.textContent = antes; }, 1500);
        }, function () { alert('Não consegui copiar.'); });
    },

    // Gera um link avulso, sem chamado (para mandar pelo WhatsApp normal, e-mail etc.)
    formNovoLink: function () {
        var self = this, box = document.getElementById('atCadNovoBox');
        box.classList.remove('hidden');
        box.innerHTML = '<form class="at-form at-cad-novo" id="atCadNovoForm">' +
            '<label for="atCadUni">Unidade</label><input type="text" id="atCadUni" placeholder="Nome da clínica/hospital" required>' +
            '<fieldset class="at-formato"><legend>Tipo</legend>' +
              '<label><input type="radio" name="atCadTipo" value="um" checked> <span>Um usuário</span></label>' +
              '<label><input type="radio" name="atCadTipo" value="lote"> <span>Implantação nova (vários usuários)</span></label></fieldset>' +
            '<button type="submit">Gerar link</button></form>';
        document.getElementById('atCadUni').focus();
        document.getElementById('atCadNovoForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var uni = document.getElementById('atCadUni').value.trim(), tipo = document.querySelector('[name=atCadTipo]:checked').value;
            if (uni.length < 3) { alert('Informe a unidade.'); return; }
            CadastrosDB.criarLink(self.cadSetor(), uni, tipo).then(function (token) {
                var link = self.linkCadastro(token, uni, tipo === 'lote');
                var texto = self.textoCadastro('link', uni, tipo === 'lote').replace('[LINK]', link);
                box.innerHTML = '<div class="at-cad-pronto"><strong>Link criado ✅</strong><span class="tag">Vale 7 dias. Copie a mensagem e mande pelo WhatsApp ou e-mail.</span>' +
                    '<textarea readonly rows="7" id="atCadTexto"></textarea>' +
                    '<div class="at-ficha-acoes"><button type="button" id="atCadCopTexto">Copiar mensagem</button><button type="button" class="sec" id="atCadCopLink">Copiar só o link</button></div></div>';
                document.getElementById('atCadTexto').value = texto;
                var copiar = function (v, b) { navigator.clipboard.writeText(v).then(function () { var a = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = a; }, 1500); }); };
                document.getElementById('atCadCopTexto').addEventListener('click', function () { copiar(texto, this); });
                document.getElementById('atCadCopLink').addEventListener('click', function () { copiar(link, this); });
            }).catch(function (e2) { alert(e2.message); });
        });
    },

    // ---------- Solicitação de cadastro ----------
    linkCadastro: function (token, unidade, lote) {
        var base = location.origin + location.pathname.replace(/[^/]*$/, '');
        return base + 'cadastro.html#t=' + encodeURIComponent(token) + '&u=' + encodeURIComponent(unidade || '') + (lote ? '&m=lote' : '');
    },

    textoCadastro: function (formato, unidade, lote) {
        var h = new Date().getHours(), sd = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
        if (lote) {
            return sd + '! Para a implantação, cadastre de uma vez todas as pessoas que vão usar o portal:\n\n[LINK]\n\n' +
                   'Dá para preencher na tela, colar as linhas do Excel ou baixar a planilha modelo, preencher e enviar. ' +
                   'Se faltar alguém, é só abrir o mesmo link de novo.\n\nOs dados são usados somente para o cadastro no portal e para o treinamento.';
        }
        if (formato === 'link') {
            return sd + '! Para criarmos o acesso ao portal, preencha o formulário de cadastro abaixo (um por pessoa):\n\n[LINK]\n\n' +
                   'Os dados são usados somente para o cadastro no portal e para o treinamento.';
        }
        return sd + '! Para criarmos o acesso ao portal, copie a mensagem abaixo, preencha e envie de volta (uma por pessoa):\n\n' +
               'Nome completo:\nNumero de telefone:\nCPF:\nEmail:\nFunção:\nUnidade: ' + (unidade || '') + '\nCRM (caso seja médico):';
    },

    abrirSolicitarCadastro: function (id) {
        var self = this, esc = Docs.esc.bind(Docs);
        AtendimentoDados.listar(this.setor).then(function (lista) {
            var meus = lista.filter(function (c) { return c.status === 'meu'; });
            if (!meus.length) { alert('Pegue um chamado antes de enviar o formulário.'); return; }
            var atual = meus.find(function (c) { return c.id === id; }) || meus[0];
            self.modal(
                '<h2>📋 Solicitar cadastro de usuário</h2>' +
                '<p class="tag">O cliente recebe o formulário no WhatsApp e os dados voltam para o chamado como uma ficha.</p>' +
                '<form class="at-form" id="atSolForm">' +
                  '<label for="atSolChamado">Enviar para o chamado</label>' +
                  '<select id="atSolChamado">' + meus.map(function (c) {
                      return '<option value="' + c.id + '"' + (c.id === atual.id ? ' selected' : '') + ' data-local="' + esc(c.local) + '">' + esc(c.nome) + ' · ' + esc(c.local) + '</option>';
                  }).join('') + '</select>' +
                  '<label for="atSolUnidade">Unidade</label>' +
                  '<input type="text" id="atSolUnidade" value="' + esc(atual.local) + '">' +
                  '<fieldset class="at-formato"><legend>Tipo de solicitação</legend>' +
                    '<label><input type="radio" name="atSolTipo" value="um" checked> <span><strong>Um usuário</strong>: cadastro avulso.</span></label>' +
                    '<label><input type="radio" name="atSolTipo" value="lote"> <span><strong>Implantação nova (vários usuários)</strong>: o T.I. da unidade cadastra todo mundo de uma vez, na tela, colando do Excel ou enviando a planilha.</span></label>' +
                  '</fieldset>' +
                  '<fieldset class="at-formato" id="atSolFmtBox"><legend>Formato</legend>' +
                    '<label><input type="radio" name="atSolFmt" value="link" checked> <span><strong>Link do formulário</strong> (recomendado). Valida CPF, e-mail e telefone e pede o consentimento LGPD.</span></label>' +
                    '<label><input type="radio" name="atSolFmt" value="texto"> <span><strong>Texto no WhatsApp</strong>. O cliente copia, preenche e responde; o sistema lê a resposta.</span></label>' +
                  '</fieldset>' +
                  '<label for="atSolPrevia">Mensagem que será enviada</label>' +
                  '<textarea id="atSolPrevia" rows="7" readonly></textarea>' +
                  '<button type="submit">Enviar ao cliente</button>' +
                '</form>'
            );
            var sel = document.getElementById('atSolChamado'), uni = document.getElementById('atSolUnidade'), prev = document.getElementById('atSolPrevia');
            var ehLote = function () { return document.querySelector('[name=atSolTipo]:checked').value === 'lote'; };
            var fmt = function () { return ehLote() ? 'link' : document.querySelector('[name=atSolFmt]:checked').value; };
            var atualizar = function () {
                document.getElementById('atSolFmtBox').classList.toggle('hidden', ehLote());   // lote é sempre por link
                prev.value = self.textoCadastro(fmt(), uni.value, ehLote()).replace('[LINK]', '(o link é gerado ao enviar)');
            };
            document.querySelectorAll('[name=atSolTipo]').forEach(function (r) { r.addEventListener('change', atualizar); });
            sel.addEventListener('change', function () { uni.value = sel.selectedOptions[0].dataset.local; atualizar(); });
            uni.addEventListener('input', atualizar);
            document.querySelectorAll('[name=atSolFmt]').forEach(function (r) { r.addEventListener('change', atualizar); });
            atualizar();
            document.getElementById('atSolForm').addEventListener('submit', function (e) {
                e.preventDefault();
                var chamado = Number(sel.value), f = fmt(), unidade = uni.value.trim(), lote = ehLote();
                var botao = e.target.querySelector('button[type=submit]');
                botao.disabled = true; botao.textContent = 'Gerando link...';
                // Com login, o link é criado no banco (vale de verdade); na demonstração, só no navegador
                var pegarToken = CadastrosDB.ativo() ? CadastrosDB.criarLink(self.setor, unidade, lote ? 'lote' : 'um', AtendimentoDados.real ? chamado : null) : Promise.resolve(null);
                pegarToken.then(function (token) {
                  document.querySelector('.at-modal-fundo').remove();
                  self.sel = chamado;
                  return AtendimentoDados.solicitarCadastro(chamado, {
                    token: token, formato: f, unidade: unidade, lote: lote,
                    montar: function (token) {
                        var link = f === 'link' ? self.linkCadastro(token, unidade, lote) : '';
                        return { texto: self.textoCadastro(f, unidade, lote).replace('[LINK]', link), link: link };
                    }
                  });
                }).catch(function (e2) { alert(e2.message); botao.disabled = false; botao.textContent = 'Enviar ao cliente'; });
            });
        });
    },

    cartaoFormulario: function (m) {
        var esc = Docs.esc.bind(Docs);
        return '<div class="at-form-enviado"><span>📋 ' + (m.lote ? 'Formulário de implantação (vários usuários)' : 'Formulário de cadastro') + ' enviado (' + (m.formato === 'link' ? 'link' : 'texto') + ') · ' + esc(m.hora) + '</span>' +
               (m.formato === 'link' && m.link
                   ? '<button type="button" class="sec" data-acao="simular-form" data-token="' + esc(m.token) + '" data-link="' + esc(m.link) + '">Abrir como o cliente</button>'
                   : '<span class="tag">Aguardando a resposta do cliente</span>') + '</div>';
    },

    // Demonstração: abre o formulário real (cadastro.html) dentro do painel
    simularFormulario: function (token, link) {
        if (!/^https?:\/\//.test(link)) return;
        this.modal('<h2>Formulário como o cliente vê</h2><iframe class="at-iframe" src="' + Docs.esc(link) + '" title="Formulário de cadastro"></iframe>', /m=lote/.test(link));
    },

    cpfValido: function (c) {
        c = String(c || '').replace(/\D/g, '');
        if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
        for (var t = 9; t < 11; t++) {
            var s = 0;
            for (var i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
            if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
        }
        return true;
    },

    fichaCadastro: function (m, i) {
        var esc = Docs.esc.bind(Docs), d = m.dados || {};
        var cpf = String(d.cpf || ''), dig = cpf.replace(/\D/g, '');
        var mascara = dig.length === 11 ? '***.' + dig.slice(3, 6) + '.' + dig.slice(6, 9) + '-**' : (cpf ? '***' : '');
        var tel = String(d.telefone || '').replace(/\D/g, '');
        var checks = [
            ['CPF', this.cpfValido(cpf)],
            ['E-mail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')],
            ['Telefone', tel.length >= 10 && tel.length <= 11],
            ['Nome completo', String(d.nome || '').trim().split(/\s+/).length >= 2]
        ];
        if (/m[eé]dic/i.test(d.cargo || '')) checks.push(['CRM', String(d.crm || '').replace(/\D/g, '').length >= 4]);
        var linha = function (rot, val) { return '<dt>' + rot + '</dt><dd>' + (val ? esc(val) : '<span class="tag">—</span>') + '</dd>'; };
        var feito = m.status === 'cadastrado';
        return '<div class="at-ficha' + (feito ? ' feito' : '') + '">' +
            '<div class="at-ficha-topo"><strong>📋 Solicitação de cadastro</strong><span class="at-status ' + (feito ? 'at-status-meu' : 'at-status-fila') + '">' + (feito ? 'Cadastrado' : 'Pendente') + '</span></div>' +
            '<dl>' + linha('Nome', d.nome) + linha('E-mail', d.email) + linha('Telefone', d.telefone) +
              '<dt>CPF</dt><dd><span class="at-cpf" data-mask="' + esc(mascara) + '" data-full="' + esc(cpf) + '" data-vis="0">' + esc(mascara || '—') + '</span>' +
                (cpf ? ' <button type="button" class="at-link" data-acao="cpf">mostrar</button>' : '') + '</dd>' +
              linha('Função', d.cargo) + (d.crm ? linha('CRM', d.crm) : '') + linha('Unidade', d.unidade) +
              (d.possui_usuario ? linha('Já tem usuário?', d.possui_usuario) : '') + '</dl>' +
            '<div class="at-checks">' + checks.map(function (c) { return '<span class="' + (c[1] ? 'ok' : 'ruim') + '">' + (c[1] ? '✓ ' : '✗ ') + c[0] + (c[1] ? '' : ' inválido') + '</span>'; }).join('') + '</div>' +
            '<div class="at-ficha-acoes">' +
              '<button type="button" class="sec" data-acao="copiar-ficha" data-i="' + i + '">Copiar dados</button>' +
              (feito ? '' : '<button type="button" data-acao="gerar-acesso" data-i="' + i + '" title="Abre o Gerador de senhas já com este usuário; de lá você envia o acesso ao cliente">🔑 Gerar acesso</button>') +
              '<button type="button" class="sec" data-acao="csv-ficha" data-i="' + i + '" title="Planilha para importar no Gerador de senhas">CSV</button>' +
              (feito ? '' : '<button type="button" data-acao="cadastrado" data-i="' + i + '">Marcar como cadastrado</button>') +
            '</div>' +
            '<small class="tag">Recebido por ' + esc(m.origem || '') + ' · ' + esc(m.hora) + ' · visível só para a equipe</small>' +
        '</div>';
    },

    checarPessoa: function (d) {
        var tel = String(d.telefone || '').replace(/\D/g, ''), erros = [];
        if (!this.cpfValido(d.cpf)) erros.push('CPF');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) erros.push('E-mail');
        if (tel.length < 10 || tel.length > 11) erros.push('Telefone');
        if (String(d.nome || '').trim().split(/\s+/).length < 2) erros.push('Nome');
        if (/m[eé]dic/i.test(d.cargo || '') && String(d.crm || '').replace(/\D/g, '').length < 4) erros.push('CRM');
        return erros;
    },

    fichaLote: function (m, i) {
        var self = this, esc = Docs.esc.bind(Docs), l = m.lote, us = l.usuarios;
        var feitos = us.filter(function (u) { return u.status === 'cadastrado'; }).length;
        var comErro = us.filter(function (u) { return self.checarPessoa(u).length; }).length;
        var porCargo = {};
        us.forEach(function (u) { porCargo[u.cargo || '—'] = (porCargo[u.cargo || '—'] || 0) + 1; });
        var tudo = feitos === us.length;
        var linhas = us.map(function (u, k) {
            var erros = self.checarPessoa(u), dig = String(u.cpf || '').replace(/\D/g, '');
            var cpf = dig.length === 11 ? '***.' + dig.slice(3, 6) + '.' + dig.slice(6, 9) + '-**' : esc(u.cpf || '—');
            return '<tr class="' + (u.status === 'cadastrado' ? 'ok' : '') + '"><td>' + (k + 1) + '</td><td>' + esc(u.nome) + '</td><td>' + esc(u.email) + '</td>' +
                   '<td>' + esc(u.cargo) + (u.crm ? '<br><span class="tag">CRM ' + esc(u.crm) + '</span>' : '') + '</td><td>' + cpf + '</td>' +
                   '<td>' + (erros.length ? '<span class="at-chip ruim">✗ ' + esc(erros.join(', ')) + '</span>' : '<span class="at-chip ok">✓ ok</span>') + '</td>' +
                   '<td>' + (u.status === 'cadastrado' ? '<span class="at-chip ok">Cadastrado</span>'
                        : '<button type="button" class="at-link" data-acao="lote-um" data-i="' + i + '" data-u="' + k + '">marcar</button>') + '</td></tr>';
        }).join('');
        return '<div class="at-ficha at-ficha-lote' + (tudo ? ' feito' : '') + '">' +
            '<div class="at-ficha-topo"><strong>📋 Cadastro em lote · ' + esc(l.unidade) + '</strong>' +
              '<span class="at-status ' + (tudo ? 'at-status-meu' : 'at-status-fila') + '">' + feitos + ' de ' + us.length + ' cadastrados</span></div>' +
            '<div class="at-checks"><span class="ok">' + us.length + ' usuários</span>' +
              (comErro ? '<span class="ruim">' + comErro + ' com erro</span>' : '<span class="ok">✓ todos válidos</span>') +
              Object.keys(porCargo).map(function (k) { return '<span class="neutro">' + porCargo[k] + ' ' + esc(k) + '</span>'; }).join('') + '</div>' +
            (l.responsavel && l.responsavel.nome ? '<small class="tag">Enviado por ' + esc(l.responsavel.nome) + (l.responsavel.email ? ' · ' + esc(l.responsavel.email) : '') + (l.responsavel.telefone ? ' · ' + esc(l.responsavel.telefone) : '') + '</small>' : '') +
            '<div class="at-lote-wrap"><table class="at-lote"><thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Função</th><th>CPF</th><th>Conferência</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
            '<div class="at-ficha-acoes">' +
              (tudo ? '' : '<button type="button" data-acao="gerar-acesso" data-i="' + i + '" title="Abre o Gerador de senhas com os usuários válidos ainda não cadastrados">🔑 Gerar acessos</button>') +
              '<button type="button" class="sec" data-acao="lote-csv" data-i="' + i + '" title="Planilha para importar no Gerador de senhas (aba Implantação)">CSV</button>' +
              '<button type="button" class="sec" data-acao="lote-copiar" data-i="' + i + '">Copiar tabela</button>' +
              (tudo ? '' : '<button type="button" data-acao="lote-todos" data-i="' + i + '">Marcar todos como cadastrados</button>') +
            '</div>' +
            '<small class="tag">Recebido por formulário · ' + esc(m.hora) + ' · visível só para a equipe</small>' +
        '</div>';
    },

    // Leva os usuários da ficha para o Gerador de senhas; de lá o acesso é enviado de volta a este chamado
    gerarAcesso: function (i) {
        var self = this, c = this.ultimoChat, m = c && c.msgs[i]; if (!m) return;
        var usuarios = m.de === 'cadastro'
            ? [{ nome: m.dados.nome, email: m.dados.email }]
            : m.lote.usuarios.filter(function (u) { return u.status !== 'cadastrado' && !self.checarPessoa(u).length; })
                             .map(function (u) { return { nome: u.nome, email: u.email }; });
        usuarios = usuarios.filter(function (u) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email || ''); });
        if (!usuarios.length) { alert('Nenhum usuário com e-mail válido para gerar acesso.'); return; }
        try { sessionStorage.setItem('pw-handoff', JSON.stringify({ chamado: c.id, cliente: c.nome + (c.local ? ' · ' + c.local : ''), usuarios: usuarios })); } catch (e) {}
        location.hash = '#/senhas';
    },

    // Mensagem de acesso: a senha fica escondida no painel (clique em "mostrar" para ver)
    textoAcesso: function (texto, esc) {
        return String(texto || '').split('\n').map(function (linha) {
            var m = linha.match(/^(\s*senha[^:]*:\s*)(\S.*)$/i);
            if (!m) return esc(linha);
            return esc(m[1]) + '<span class="at-senha" data-full="' + esc(m[2]) + '">••••••••</span> <button type="button" class="at-link" data-acao="ver-senha">mostrar</button>';
        }).join('\n');
    },

    // CSV do lote (só os válidos), no formato que o Gerador de senhas importa
    exportarLote: function (i) {
        var self = this, m = this.ultimoChat && this.ultimoChat.msgs[i]; if (!m) return;
        var validos = m.lote.usuarios.filter(function (u) { return !self.checarPessoa(u).length; });
        var fora = m.lote.usuarios.length - validos.length;
        if (!validos.length) { alert('Nenhum usuário válido para exportar.'); return; }
        if (fora && !confirm(fora + ' usuário(s) com erro ficarão de fora do arquivo. Continuar?')) return;
        var cel = function (v) { v = String(v || ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        var csv = '﻿' + ['Nome completo', 'E-mail', 'Telefone', 'Função', 'CRM', 'Unidade'].join(',') + '\r\n' +
                  validos.map(function (u) { return [u.nome, u.email, u.telefone, u.cargo, u.crm, m.lote.unidade].map(cel).join(','); }).join('\r\n') + '\r\n';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = 'lote-' + String(m.lote.unidade || 'unidade').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
    },

    // Copia a tabela com tabulação (cola certinho no Excel)
    copiarLote: function (i, botao) {
        var m = this.ultimoChat && this.ultimoChat.msgs[i]; if (!m) return;
        var linhas = [['Nome completo', 'E-mail', 'Telefone', 'CPF', 'Função', 'CRM', 'Unidade'].join('\t')].concat(
            m.lote.usuarios.map(function (u) { return [u.nome, u.email, u.telefone, u.cpf, u.cargo, u.crm, m.lote.unidade].join('\t'); }));
        navigator.clipboard.writeText(linhas.join('\n')).then(function () {
            var antes = botao.textContent; botao.textContent = 'Copiado ✓'; setTimeout(function () { botao.textContent = antes; }, 1500);
        }, function () { alert('Não consegui copiar.'); });
    },

    copiarFicha: function (i, botao) {
        var m = this.ultimoChat && this.ultimoChat.msgs[i]; if (!m) return;
        var d = m.dados;
        var txt = ['Nome completo: ' + (d.nome || ''), 'E-mail: ' + (d.email || ''), 'Telefone: ' + (d.telefone || ''), 'CPF: ' + (d.cpf || ''),
                   'Função: ' + (d.cargo || ''), 'CRM: ' + (d.crm || ''), 'Unidade: ' + (d.unidade || '')].join('\n');
        navigator.clipboard.writeText(txt).then(function () {
            var antes = botao.textContent; botao.textContent = 'Copiado ✓'; setTimeout(function () { botao.textContent = antes; }, 1500);
        }, function () { alert('Não consegui copiar. Selecione e copie manualmente.'); });
    },

    // CSV com as colunas que o Gerador de senhas reconhece (Nome completo, E-mail). Sem CPF: o gerador não precisa dele.
    exportarFicha: function (i) {
        var m = this.ultimoChat && this.ultimoChat.msgs[i]; if (!m) return;
        var d = m.dados, cel = function (v) { v = String(v || ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
        var csv = '\uFEFF' + ['Nome completo', 'E-mail', 'Telefone', 'Função', 'CRM', 'Unidade'].join(',') + '\r\n' +
                  [d.nome, d.email, d.telefone, d.cargo, d.crm, d.unidade].map(cel).join(',') + '\r\n';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = 'cadastro-' + String(d.nome || 'usuario').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
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
    // ---------- Chamados anteriores do cliente ----------
    HIST_VALIDADE_MS: 60 * 1000,
    carregarHistorico: function (c) {
        if (!AtendimentoDados.historico || !c) return;
        this.histCache = this.histCache || {};
        var self = this, cache = this.histCache[c.id];
        if (cache && Date.now() - cache.t < this.HIST_VALIDADE_MS) { this.desenharHistBanner(c, cache.res); return; }
        if (cache && cache.buscando) return;
        this.histCache[c.id] = { t: 0, buscando: true, res: cache && cache.res };
        if (cache && cache.res) this.desenharHistBanner(c, cache.res);
        Promise.resolve(AtendimentoDados.historico(c.id)).then(function (res) {
            self.histCache[c.id] = { t: Date.now(), res: res };
            if (self.sel === c.id) self.desenharHistBanner(c, res);
        }).catch(function (e) { self.histCache[c.id] = { t: Date.now(), res: { lista: [] } }; console.warn('Histórico:', e.message); });
    },
    dataCurta: function (iso) {
        if (!iso) return '';
        var d = new Date(iso), dias = Math.floor((Date.now() - d.getTime()) / 86400000);
        var txt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        return txt + (dias <= 0 ? ' (hoje)' : dias === 1 ? ' (ontem)' : ' (há ' + dias + ' dias)');
    },
    desenharHistBanner: function (c, res) {
        // Só um botão discreto ao lado do nome do cliente; o histórico abre ao clicar
        var lista = (res && res.lista) || [];
        var velho = document.getElementById('atHistBtn'); if (velho) velho.remove();
        var quem = document.querySelector('#atChatTopo .at-quem strong');
        if (!quem || !lista.length) return;
        quem.insertAdjacentHTML('afterend', '<button type="button" class="at-hist-btn" id="atHistBtn" data-acao="historico" title="Ver os ' +
            lista.length + ' chamado(s) anteriores deste cliente">🕘 ' + lista.length + '</button>');
    },
    abrirHistorico: function (c) {
        if (!c) return;
        var self = this, esc = Docs.esc.bind(Docs);
        var cache = this.histCache && this.histCache[c.id], lista = (cache && cache.res && cache.res.lista) || [];
        var rot = function (h) {
            if (h.status !== 'fechado') return h.status === 'fila' ? 'Na fila' : 'Em atendimento';
            return h.nota ? 'Encerrado · nota ' + h.nota + ' ★' : 'Encerrado';
        };
        this.modal(
            '<h2>🕘 Histórico do cliente</h2>' +
            '<p class="tag">' + esc(c.nome) + (c.local ? ' · ' + esc(c.local) : '') + '. Chamados anteriores com o mesmo telefone' + (c.setor === 'med' ? '' : ' ou da mesma unidade') + '.</p>' +
            '<div class="at-hist-lista">' + lista.map(function (h) {
                return '<article class="at-hist-item">' +
                    '<header><strong>' + esc(self.dataCurta(h.criado)) + '</strong>' +
                      '<span>' + esc(h.nome || '') + (h.atendente ? ' · atendido por ' + esc(h.atendente) : '') + ' · ' +
                        (h.origem === 'manual' ? '📝 ' + esc(self.rotuloCanal(h.canal)) : 'WhatsApp') + '</span>' +
                      '<span class="at-status ' + (h.status === 'fechado' ? 'at-status-fechado' : 'at-status-fila') + '">' + esc(rot(h)) + '</span>' +
                      '<span class="tag">' + (h.por === 'telefone' ? 'mesmo telefone' : 'mesma unidade') + '</span></header>' +
                    (h.motivo ? '<p><b>Pedido:</b> ' + esc(h.motivo) + '</p>' : '') +
                    (h.resposta ? '<p><b>Última resposta:</b> ' + esc(h.resposta) + '</p>' : '') +
                    (h.nota_interna ? '<p class="at-hist-combinado"><b>📌 Nota interna:</b> ' + esc(h.nota_interna) + '</p>' : '') +
                    (h.comentario ? '<p><b>Comentário na avaliação:</b> ' + esc(h.comentario) + '</p>' : '') +
                    '<button type="button" class="sec" data-hist-ver="' + h.id + '">Ver conversa</button>' +
                    '<div class="at-hist-conversa hidden" id="atHistConv' + h.id + '"></div>' +
                '</article>';
            }).join('') + '</div>', true);
        var caixa = document.querySelector('.at-modal-fundo:last-of-type .at-hist-lista');
        if (!caixa) return;
        caixa.addEventListener('click', function (e) {
            var img = e.target.closest('[data-acao="ampliar"]');
            if (img) { self.ampliar(img.dataset.src, img.dataset.nome); return; }
            var b = e.target.closest('[data-hist-ver]'); if (!b) return;
            var id = Number(b.dataset.histVer), alvo = document.getElementById('atHistConv' + id);
            if (!alvo.classList.contains('hidden')) { alvo.classList.add('hidden'); b.textContent = 'Ver conversa'; return; }
            alvo.classList.remove('hidden'); b.textContent = 'Esconder conversa';
            if (alvo.dataset.ok) return;
            alvo.innerHTML = '<span class="tag">Carregando…</span>';
            Promise.resolve(AtendimentoDados.conversa(id)).then(function (msgs) {
                alvo.dataset.ok = '1';
                alvo.innerHTML = msgs.map(function (m) { return self.msgSoLeitura(m, esc); }).join('') || '<span class="tag">Sem mensagens.</span>';
            }).catch(function (e2) { alvo.innerHTML = '<span class="tag">Não foi possível carregar: ' + esc(e2.message) + '</span>'; });
        });
    },
    // Mensagem antiga, sem botões de ação
    msgSoLeitura: function (m, esc) {
        var img = this.imagemHtml(m.imagem), txt = m.texto ? '<span>' + esc(m.texto) + '</span>' : '', hora = '<time>' + esc(m.hora || '') + '</time>';
        if (m.de === 'nota') return '<div class="at-nota">' + esc(m.texto) + ' · ' + esc(m.hora || '') + '</div>';
        if (m.de === 'bot') return '<div class="at-msg at-msg-bot"><small>Mensagem automática</small>' + esc(m.texto) + hora + '</div>';
        if (m.de === 'interna') return '<div class="at-msg at-msg-interna"><small>🔒 Nota interna · ' + esc(m.autor || '') + '</small>' + img + txt + hora + '</div>';
        if (m.de === 'agente') return '<div class="at-msg at-msg-agente"><small>' + esc(m.autor || '') + '</small>' + img + txt + hora + '</div>';
        if (m.de === 'cliente') return '<div class="at-msg at-msg-cliente">' + img + txt + hora + '</div>';
        if (m.de === 'formulario') return '<div class="at-nota">📋 Link de cadastro enviado · ' + esc(m.hora || '') + '</div>';
        if (m.de === 'cadastro') return '<div class="at-nota">📋 Cadastro recebido: ' + esc((m.dados && m.dados.nome) || '') + ' · ' + esc(m.hora || '') + '</div>';
        if (m.de === 'cadastro-lote') return '<div class="at-nota">📋 Cadastro em lote recebido (' + ((m.lote && m.lote.usuarios) || []).length + ' usuários) · ' + esc(m.hora || '') + '</div>';
        return '';
    },

    modal: function (html, largo) {
        var fundo = document.createElement('div');
        fundo.className = 'at-modal-fundo';
        fundo.innerHTML = '<div class="at-modal' + (largo ? ' at-modal-largo' : '') + '" role="dialog" aria-modal="true"><button type="button" class="sec at-modal-x" aria-label="Fechar">✕</button>' + html + '</div>';
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
        // Prévia com link local do navegador. No modo real, o arquivo sobe para o bucket PRIVADO "anexos" ao enviar.
        this.anexo = { url: URL.createObjectURL(arquivo), nome: arquivo.name || 'imagem-colada.png', arquivo: arquivo };
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
        box.classList.toggle('teste', modo === 'cliente-teste');
        btn.textContent = interna ? 'Salvar nota' : 'Enviar';
        if (!this.anexo) campo.placeholder = interna
            ? 'Nota interna: só a equipe vê. Ex.: "aguardando teste de envio"'
            : modo === 'cliente-teste' ? (this.ehManual() ? 'O que o cliente disse? (fica só no histórico)' : 'Escreva como se fosse o cliente (teste)')
            : this.ehManual() ? 'Registre o que você respondeu ao cliente (não é enviado)' : 'Digite sua resposta e pressione Enter';
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
        if (img && img.path && !img.url) return '<span class="at-img-carregando">📷 Carregando imagem…</span>';
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

    // ---------- Aba "Todos": todos os chamados do setor e com quem estão ----------
    desenharTodos: function (lista) {
        var self = this, esc = Docs.esc.bind(Docs), eu = AtendimentoDados.atendente();
        var dono = function (c) { return c.status === 'fila' ? 'Na fila' : (c.status === 'meu' ? eu : (c.atendente || '—')); };
        var abertos = lista.filter(function (c) { return c.status !== 'fechado'; });

        // Resumo: quantos chamados com cada um
        var cont = {};
        abertos.forEach(function (c) { var d = dono(c); cont[d] = (cont[d] || 0) + 1; });
        var nomes = Object.keys(cont).sort(function (a, b) { return a === 'Na fila' ? -1 : b === 'Na fila' ? 1 : cont[b] - cont[a]; });
        document.getElementById('atResumoEquipe').innerHTML = nomes.length
            ? nomes.map(function (n) { return '<span class="' + (n === 'Na fila' ? 'fila' : '') + '">' + esc(n) + ' <b>' + cont[n] + '</b></span>'; }).join('')
            : '<span>Nenhum chamado aberto</span>';

        // Filtro por pessoa
        var selQuem = document.getElementById('atTodosQuem'), atual = this.todosQuem || 'abertos';
        var opcoes = [['abertos', 'Todos em aberto'], ['Na fila', 'Na fila']].concat(
            nomes.filter(function (n) { return n !== 'Na fila'; }).map(function (n) { return [n, 'Com ' + n]; }), [['fechados', 'Encerrados (12h)']]);
        if (!opcoes.some(function (o) { return o[0] === atual; })) atual = 'abertos';
        selQuem.innerHTML = opcoes.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === atual ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

        var busca = String(this.todosBusca || '').toLowerCase().trim();
        var mostrados = lista.filter(function (c) {
            if (atual === 'fechados') { if (c.status !== 'fechado') return false; }
            else if (c.status === 'fechado') return false;
            else if (atual !== 'abertos' && dono(c) !== atual) return false;
            return !busca || (c.nome + ' ' + c.local).toLowerCase().indexOf(busca) >= 0;
        });
        var ordem = { fila: 0, meu: 1, outro: 2, fechado: 3 };
        mostrados.sort(function (a, b) { return (ordem[a.status] - ordem[b.status]) || String(dono(a)).localeCompare(dono(b)) || (a.id - b.id); });

        document.getElementById('atFila').innerHTML = mostrados.length ? mostrados.map(function (c) {
            var conversa = c.msgs.filter(function (m) { return m.de === 'cliente' || m.de === 'agente'; }), ult = conversa[conversa.length - 1];
            var chip = c.status === 'fila' ? '<span class="at-chip-dono fila">Na fila · ' + esc(c.espera || '') + '</span>'
                     : c.status === 'meu' ? '<span class="at-chip-dono eu">Com você</span>'
                     : c.status === 'outro' ? '<span class="at-chip-dono">Com ' + esc(c.atendente || '—') + '</span>'
                     : '<span class="at-chip-dono fechado">Encerrado</span>';
            return '<div class="at-cartao' + (c.id === self.sel ? ' ativo' : '') + '">' +
                     '<button type="button" class="at-abrir" data-acao="abrir" data-id="' + c.id + '">' +
                       '<span class="at-nome">' + esc(c.nome) + (c.origem === 'manual' ? ' <span class="tag">📝</span>' : '') + '</span>' +
                       '<span class="at-local">' + esc(c.local) + '</span>' +
                       '<span class="at-resumo">' + esc(ult ? (ult.texto || '📷 Imagem') : '') + '</span>' +
                     '</button>' +
                     '<div class="at-cartao-rodape">' + chip + (c.status === 'fila' ? '<button type="button" data-acao="pegar" data-id="' + c.id + '">Pegar</button>' : '') + '</div>' +
                   '</div>';
        }).join('') : '<p class="at-vazio">Nenhum chamado ' + (atual === 'fechados' ? 'encerrado nas últimas 12 horas.' : 'com esse filtro.') + '</p>';
    },

    // Ações num chamado que está com outro atendente: admin pode assumir, transferir, devolver ou encerrar
    acoesOutro: function (c, esc) {
        if (!this.ehAdmin || !AtendimentoDados.real) return '<span class="tag">Você pode acompanhar e deixar nota interna.</span>';
        var eu = AtendimentoDados.atendente();
        var nomes = (this.colegas || []).filter(function (n) { return n !== c.atendente; });
        return '<div class="at-acoes">' +
            (AtendimentoDados.real ? '<button type="button" data-acao="assumir" data-id="' + c.id + '" title="Passa o chamado para você">Assumir</button>' : '') +
            '<div class="at-transf"><button type="button" class="sec" data-acao="menu-transferir" data-id="' + c.id + '" aria-haspopup="true">Transferir ▾</button>' +
              '<div class="at-menu-transf hidden" id="atMenuTransf" role="menu"><span>Transferir para:</span>' +
                nomes.map(function (n) {
                    var on = Atendimento.colegaOnline(n);
                    return '<button type="button" role="menuitem" data-acao="transferir-admin" data-id="' + c.id + '" data-para="' + esc(n) + '">' +
                           '<i class="at-dot' + (on ? ' on' : '') + '" aria-hidden="true"></i>' + esc(n) + '</button>';
                }).join('') +
              '</div></div>' +
            '<button type="button" class="sec" data-acao="devolver" data-id="' + c.id + '">Devolver à fila</button>' +
            '<button type="button" class="sec" data-acao="encerrar" data-id="' + c.id + '">Encerrar</button>' +
        '</div>';
    },

    cartao: function (c, naFila) {
        var esc = Docs.esc.bind(Docs);
        var conversa = c.msgs.filter(function (m) { return m.de === 'cliente' || m.de === 'agente'; });
        var ult = conversa[conversa.length - 1];
        var resumo = ult ? (ult.de === 'agente' ? 'Você: ' : '') + (ult.acesso ? '🔑 Acesso enviado' : (ult.texto || (ult.imagem ? '📷 Imagem' : ''))) : '';
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
        document.getElementById('atTituloFila').textContent = this.setor === 'impl' ? 'Implantação' : 'Suporte Médico';
        var todos = this.abaFila === 'todos';
        document.querySelectorAll('[data-aba]').forEach(function (b) {
            var on = b.dataset.aba === (todos ? 'todos' : 'fila');
            b.classList.toggle('ativo', on); b.setAttribute('aria-selected', String(on));
        });
        document.getElementById('atTodosBarra').classList.toggle('hidden', !todos);

        AtendimentoDados.listar(this.setor).then(function (lista) {
            var meus = lista.filter(function (c) { return c.status === 'meu'; });
            var fila = lista.filter(function (c) { return c.status === 'fila'; });
            var equipe = lista.filter(function (c) { return c.status === 'outro'; }).length;

            document.getElementById('atContaMeus').textContent = meus.length;
            document.getElementById('atContaFila').textContent = fila.length;
            if (self.demo) document.getElementById('atEquipe').textContent = '4 atendentes online · ' + equipe + ' com a equipe';
            else self.mostrarOnline();
            document.getElementById('atMeus').innerHTML = meus.length
                ? meus.map(function (c) { return self.cartao(c, false); }).join('')
                : '<p class="at-vazio">Nenhum chamado com você. Pegue um chamado da fila.</p>';
            var abertos = lista.filter(function (c) { return c.status !== 'fechado'; });
            document.getElementById('atContaTodos').textContent = abertos.length;
            if (todos) self.desenharTodos(lista);
            else document.getElementById('atFila').innerHTML = fila.length
                ? fila.map(function (c) { return self.cartao(c, true); }).join('')
                : '<p class="at-vazio">Fila vazia. Use "+ Simular contato" para ver um chamado chegando.</p>';

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
        var naFila = c.status === 'fila', fechado = c.status === 'fechado', comOutro = c.status === 'outro';
        var av = c.avaliacao, rotuloFechado = 'Encerrado';
        if (av && av.status === 'aguardando') rotuloFechado = 'Encerrado · aguardando avaliação';
        else if (av && av.nota) rotuloFechado = 'Encerrado · nota ' + av.nota + ' ★';
        topo.innerHTML =
            '<div class="at-quem"><div class="at-quem-linha"><strong>' + esc(c.nome) + '</strong></div><span>' + esc(c.local) +
              (c.origem === 'manual' ? (c.fone && c.fone !== '—' ? ' · ' + esc(c.fone) : '') + ' · 📝 via ' + esc(this.rotuloCanal(c.canal)) + (c.registradoPor ? ' (registrado por ' + esc(c.registradoPor) + ')' : '')
                                     : ' · WhatsApp ' + esc(c.fone)) + '</span></div>' +
            (fechado
                ? '<span class="at-status at-status-fechado">' + esc(rotuloFechado) + '</span>'
                : comOutro ? '<span class="at-status at-status-outro">Com ' + esc(c.atendente || 'outro atendente') + '</span>'
                : '<span class="at-status ' + (naFila ? 'at-status-fila' : 'at-status-meu') + '">' + (naFila ? 'Na fila' : 'Com você') + '</span>') +
            (fechado ? '' : comOutro ? this.acoesOutro(c, esc) : naFila
                ? '<button type="button" data-acao="pegar" data-id="' + c.id + '">Pegar chamado</button>'
                : '<div class="at-acoes">' +
                    '<div class="at-transf"><button type="button" class="sec" data-acao="menu-transferir" data-id="' + c.id + '" aria-haspopup="true">Transferir ▾</button>' +
                      '<div class="at-menu-transf hidden" id="atMenuTransf" role="menu"><span>Transferir para:</span>' +
                        ((this.colegas || []).length ? '' : '<span>Nenhum colega no setor.</span>') +
                        (this.colegas || []).map(function (n) {
                            var on = Atendimento.colegaOnline(n);
                            return '<button type="button" role="menuitem" data-acao="transferir" data-id="' + c.id + '" data-para="' + esc(n) + '">' +
                                   '<i class="at-dot' + (on ? ' on' : '') + '" aria-hidden="true"></i>' + esc(n) + (on ? '' : ' <span class="tag">offline</span>') + '</button>';
                        }).join('') +
                      '</div></div>' +
                    '<button type="button" class="sec" data-acao="solicitar-cadastro" data-id="' + c.id + '">📋 Solicitar cadastro</button>' +
                    '<button type="button" class="sec" data-acao="devolver" data-id="' + c.id + '">Devolver à fila</button>' +
                    '<button type="button" class="sec" data-acao="encerrar" data-id="' + c.id + '">Encerrar</button>' +
                  '</div>');
        this.ultimoChat = c;

        var self = this;
        var html = c.msgs.map(function (m, i) {
            if (m.de === 'formulario') return self.cartaoFormulario(m);
            if (m.de === 'cadastro') return self.fichaCadastro(m, i);
            if (m.de === 'cadastro-lote') return self.fichaLote(m, i);
            var img = self.imagemHtml(m.imagem), txt = m.texto ? '<span>' + esc(m.texto) + '</span>' : '';
            if (m.de === 'nota') return '<div class="at-nota">' + esc(m.texto) + ' · ' + esc(m.hora) + '</div>';
            if (m.de === 'bot') return '<div class="at-msg at-msg-bot"><small>Mensagem automática</small>' + esc(m.texto) + '<time>' + esc(m.hora) + '</time></div>';
            if (m.de === 'interna') return '<div class="at-msg at-msg-interna"><small>🔒 Nota interna · ' + esc(m.autor || '') + ' · o cliente não vê</small>' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
            if (m.de === 'agente') {
                if (m.acesso) txt = '<span>' + self.textoAcesso(m.texto, esc) + '</span>';
                return '<div class="at-msg at-msg-agente"><small>' + esc(m.autor || '') + (m.acesso ? ' · 🔑 acesso enviado' : '') + '</small>' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
            }
            return '<div class="at-msg at-msg-cliente">' + img + txt + '<time>' + esc(m.hora) + '</time></div>';
        }).join('');
        if (c.origem === 'manual') html = '<div class="at-manual-aviso">📝 Chamado registrado manualmente (contato por ' + esc(this.rotuloCanal(c.canal)) + '). As mensagens ficam só no histórico: nada é enviado ao cliente por aqui.</div>' + html;
        if (this.digitandoId === c.id) html += '<div class="at-digitando">' + esc(c.nome) + ' está digitando…</div>';
        msgs.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        this.carregarHistorico(c);

        // Conversa ainda não carregada (dados reais): pede e redesenha quando chegar
        if (c.carregado === false && AtendimentoDados.abrir) AtendimentoDados.abrir(c.id);
        // Teste sem WhatsApp: em chamado simulado dá para escrever como o cliente (inclusive responder a pesquisa)
        var manual = c.origem === 'manual';
        var teste = !!(AtendimentoDados.real && (c.origem === 'simulado' || (manual && !fechado)));
        var bTeste = document.querySelector('[data-modo="cliente-teste"]');
        if (bTeste) { bTeste.classList.toggle('hidden', !teste); bTeste.textContent = manual ? '🗣 Cliente disse' : '🧪 Como cliente (teste)'; }
        var bResp = document.querySelector('[data-modo="cliente"]');
        if (bResp) bResp.textContent = manual ? 'Registrar resposta' : 'Responder ao cliente';
        var pesquisaAberta = teste && fechado && c.avaliacao && (c.avaliacao.status === 'aguardando' || c.avaliacao.status === 'comentario');
        document.querySelectorAll('[data-modo="cliente"],[data-modo="interna"]').forEach(function (b) { b.classList.toggle('hidden', !!pesquisaAberta); });
        if (pesquisaAberta && this.modo !== 'cliente-teste') this.mudarModo('cliente-teste');
        if (!teste && this.modo === 'cliente-teste') this.mudarModo('cliente');
        this.mudarModo(this.modo || 'cliente');   // atualiza textos (manual x WhatsApp)
        if (pesquisaAberta) { envio.classList.remove('hidden'); aviso.classList.add('hidden'); return; }
        // Chamado com outro atendente: dá para acompanhar e deixar nota interna (responder, só quem está com ele)
        if (comOutro) {
            document.querySelectorAll('[data-modo="cliente"],[data-modo="cliente-teste"]').forEach(function (b) { b.classList.add('hidden'); });
            if (this.modo !== 'interna') this.mudarModo('interna');
            envio.classList.remove('hidden'); aviso.classList.add('hidden');
            return;
        }
        envio.classList.toggle('hidden', naFila || fechado);
        aviso.textContent = fechado
            ? 'Chamado encerrado. A pesquisa de satisfação foi enviada ao cliente; a nota aparece em ⭐ Avaliações.'
            : 'Este chamado ainda está na fila. Clique em "Pegar chamado" para responder.';
        aviso.classList.toggle('hidden', !(naFila || fechado));
    }
};