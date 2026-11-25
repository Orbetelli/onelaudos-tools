// ========================================
// ATENDIMENTO — partes que já usam o Supabase de verdade
// • CadastrosDB: links de cadastro, fichas recebidas e tempo real
// • Equipe: quem está online (Presence) e colegas para transferir
// Só funcionam com login (Auth.configurado() e sessão ativa).
// ========================================

const CadastrosDB = (function () {
    var canal = null, ouvintes = [];
    function cli() { return Auth.cliente(); }
    function avisar(linha) { ouvintes.forEach(function (fn) { fn(linha); }); }

    return {
        ativo: function () { return Auth.configurado() && !!Auth.perfil(); },

        // Cria o link no banco e devolve o token
        criarLink: async function (setor, unidade, tipo, chamadoId) {
            var r = await cli().from('solicitacoes_cadastro')
                .insert({ setor: setor, unidade: unidade || null, tipo: tipo === 'lote' ? 'lote' : 'um', chamado_id: chamadoId || null })
                .select('token').single();
            if (r.error) throw new Error('Não foi possível criar o link: ' + r.error.message);
            return r.data.token;
        },

        // Fichas do setor (a RLS já filtra o que a pessoa pode ver)
        listar: async function (setor, soPendentes) {
            var q = cli().from('cadastros_recebidos')
                .select('id, setor, lote, responsavel, dados, status, recebido_em, cadastrado_em')
                .eq('setor', setor).order('recebido_em', { ascending: false }).limit(300);
            if (soPendentes) q = q.eq('status', 'pendente');
            var r = await q;
            if (r.error) throw new Error('Não foi possível carregar os cadastros: ' + r.error.message);
            return r.data || [];
        },

        contarPendentes: async function (setores) {
            var r = await cli().from('cadastros_recebidos').select('id', { count: 'exact', head: true })
                .eq('status', 'pendente').in('setor', setores);
            return r.error ? 0 : (r.count || 0);
        },

        marcar: async function (ids, status) {
            var r = await cli().from('cadastros_recebidos').update({ status: status }).in('id', ids);
            if (r.error) throw new Error('Não foi possível atualizar: ' + r.error.message);
        },

        // Avisa quando chega cadastro novo (Realtime; a RLS vale aqui também)
        aoNovo: function (fn) {
            ouvintes.push(fn);
            if (canal) return;
            canal = cli().channel('cadastros-recebidos')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cadastros_recebidos' },
                    function (payload) { avisar(payload.new); })
                .subscribe();
        },

        desligar: function () {
            if (canal) { cli().removeChannel(canal); canal = null; }
            ouvintes = [];
        }
    };
})();

const Equipe = (function () {
    var canal = null, online = {}, ouvintes = [];
    function avisar() { ouvintes.forEach(function (fn) { fn(); }); }

    return {
        // Entra no canal de presença: cada aba aberta do painel conta como "online"
        entrar: function (perfil) {
            if (canal || !perfil) return;
            var cli = Auth.cliente();
            canal = cli.channel('atendentes-online', { config: { presence: { key: perfil.id } } });
            canal.on('presence', { event: 'sync' }, function () {
                var estado = canal.presenceState(), novo = {};
                Object.keys(estado).forEach(function (k) { var p = estado[k][0]; if (p) novo[k] = p; });
                online = novo; avisar();
            });
            canal.subscribe(function (status) {
                if (status === 'SUBSCRIBED') canal.track({ id: perfil.id, nome: perfil.nome, setores: perfil.setores, papel: perfil.papel });
            });
        },
        sair: function () {
            if (canal) { Auth.cliente().removeChannel(canal); canal = null; }
            online = {}; avisar();
        },
        online: function () { return Object.keys(online).map(function (k) { return online[k]; }); },
        estaOnline: function (id) { return !!online[id]; },
        aoMudar: function (fn) { ouvintes.push(fn); },

        colegas: async function () {
            var r = await Auth.cliente().rpc('colegas_do_setor');
            if (r.error) throw new Error(r.error.message);
            return r.data || [];
        }
    };
})();

// ========================================
// AtendimentoReal — chamados e mensagens no banco, com tempo real.
// Mesmas funções do AtendimentoDemo (js/atendimento.js), então a tela não muda.
// Precisa do supabase/06_chamados.sql.
// ========================================
const AtendimentoReal = (function () {
    var eu = null, canal = null, ouvintes = [];
    var chamados = {};          // setor -> lista crua do banco
    var msgs = {};              // chamado_id -> mensagens já convertidas para a tela
    var colegas = [];           // [{ id, nome }]
    var carregando = {};
    var POOL = {
        impl: [['Renato Dias', 'Clínica Bem Viver', 'Olá, o Worklist não está puxando os pacientes agendados de hoje.'],
               ['Luciana Prado', 'Instituto de Imagem Litoral', 'Esqueci a senha do portal, podem me ajudar?'],
               ['Fábio Nunes', 'Hospital Primavera', 'Os exames de tomografia não aparecem na lista do portal.'],
               ['Alan Souza', 'Clínica São Lucas', 'Bom dia, o Router parou de enviar os exames desde ontem à noite.']],
        med:  [['Dr. André Tavares', 'Médico executante', 'O visualizador não está abrindo as imagens do exame.'],
               ['Dra. Beatriz Moura', 'Médica executante', 'Meu login expirou e não consigo acessar os laudos pendentes.']]
    };

    function cli() { return Auth.cliente(); }
    function avisar(ev) { ouvintes.forEach(function (fn) { fn(ev || {}); }); }
    function hora(iso) { return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; }
    function erro(r, padrao) {
        if (!r.error) return null;
        var m = r.error.message || '';
        if (/row-level security|violates/i.test(m)) m = padrao || 'Você não tem permissão para isso.';
        return new Error(m.replace(/^.*?exception:\s*/i, ''));
    }

    // Mensagem do banco -> formato que a tela usa
    function converter(m) {
        var d = m.dados || {}, base = { msgId: m.id, hora: hora(m.criado_em) };
        switch (m.tipo) {
            case 'cliente':  return Object.assign(base, { de: 'cliente', texto: m.texto, imagem: d.imagem || null });
            case 'agente':   return Object.assign(base, { de: 'agente', autor: m.autor_nome, texto: m.texto, imagem: d.imagem || null });
            case 'interna':  return Object.assign(base, { de: 'interna', autor: m.autor_nome, texto: m.texto, imagem: d.imagem || null });
            case 'formulario': return Object.assign(base, { de: 'formulario', token: d.token, formato: d.formato, lote: !!d.lote, link: d.link || '' });
            case 'cadastro': return Object.assign(base, { de: 'cadastro', dados: d.dados || {}, status: d.status || 'pendente', origem: d.origem || 'formulário' });
            case 'cadastro-lote': return Object.assign(base, { de: 'cadastro-lote', lote: { unidade: d.unidade, responsavel: d.responsavel, usuarios: d.usuarios || [] } });
            default: return Object.assign(base, { de: m.tipo, texto: m.texto });   // bot, nota
        }
    }

    // Chamado do banco -> formato que a tela usa
    function paraTela(c) {
        var status = c.status === 'fila' ? 'fila' : c.status === 'fechado' ? 'fechado' : (c.atendente_id === eu.id ? 'meu' : 'outro');
        var min = Math.max(0, Math.round((Date.now() - new Date(c.criado_em).getTime()) / 60000));
        return {
            id: c.id, nome: c.cliente_nome, local: c.cliente_local || '', fone: c.cliente_fone || '—', setor: c.setor,
            status: status, atendente: c.atendente_nome, origem: c.origem, canal: c.canal, registradoPor: c.registrado_por,
            espera: min < 1 ? 'agora' : (min < 60 ? min + ' min' : Math.floor(min / 60) + ' h'),
            avaliacao: c.avaliacao_status ? { status: c.avaliacao_status, nota: c.avaliacao_nota } : null,
            carregado: !!msgs[c.id],
            msgs: msgs[c.id] || (c.ultima_msg ? [{ de: 'cliente', texto: c.ultima_msg, hora: hora(c.ultima_msg_em) }] : [])
        };
    }
    function acharCru(id) {
        var achado = null;
        Object.keys(chamados).forEach(function (s) { chamados[s].forEach(function (c) { if (c.id === id) achado = c; }); });
        return achado;
    }

    async function buscar(setor) {
        var desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();   // fechados das últimas 12h continuam abríveis
        var r = await cli().from('chamados').select('*').eq('setor', setor)
            .or('status.neq.fechado,encerrado_em.gt.' + desde).order('criado_em', { ascending: true }).limit(500);
        var e = erro(r); if (e) throw e;
        chamados[setor] = r.data || [];
        return chamados[setor];
    }

    var recarregar = {};
    function agendarRecarga(setor) {   // junta vários eventos seguidos numa recarga só
        clearTimeout(recarregar[setor]);
        recarregar[setor] = setTimeout(function () { buscar(setor).then(function () { avisar({ tipo: 'atualizou' }); }); }, 120);
    }

    // Depois de uma ação, recarrega o chamado e a conversa (o tempo real também faz isso; aqui é garantia)
    function depois(id, recarregarMsgs) {
        var c = acharCru(id);
        if (recarregarMsgs && msgs[id]) { delete msgs[id]; }
        return (c ? buscar(c.setor) : Promise.resolve()).then(function () { avisar({ tipo: 'atualizou', id: id }); });
    }

    function ligarCanal() {
        if (canal) return;
        canal = cli().channel('chamados-ao-vivo')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, function (p) {
                var c = p.new && p.new.id ? p.new : p.old;
                if (!c || !c.setor) return;
                if (p.eventType === 'INSERT' && c.status === 'fila') avisar({ tipo: 'novo', id: c.id, setor: c.setor, status: 'fila' });
                agendarRecarga(c.setor);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, function (p) {
                var m = p.new; if (!m || !m.chamado_id) return;
                var lista = msgs[m.chamado_id];
                if (lista) {
                    var conv = converter(m), i = lista.findIndex(function (x) { return x.msgId === m.id; });
                    if (i >= 0) lista[i] = conv; else lista.push(conv);
                }
                var c = acharCru(m.chamado_id);
                if (p.eventType === 'INSERT' && m.tipo === 'cliente' && c)
                    avisar({ tipo: 'mensagem', id: m.chamado_id, de: 'cliente', setor: c.setor, status: c.atendente_id === eu.id ? 'meu' : 'outro' });
                else avisar({ tipo: 'mensagem', id: m.chamado_id });
            })
            .subscribe();
    }

    return {
        real: true,
        atendente: function () { return eu ? eu.nome : ''; },
        definirAtendente: function () {},
        definirColegas: function (lista) { colegas = lista || []; },

        // Confere se o 06 foi rodado e liga o tempo real
        iniciar: async function (perfil) {
            eu = perfil;
            var r = await cli().from('chamados').select('id').limit(1);
            if (r.error) throw new Error(/does not exist|schema cache|relation/i.test(r.error.message)
                ? 'Falta rodar o supabase/06_chamados.sql.' : r.error.message);
            ligarCanal();
        },
        parar: function () {
            if (canal) { cli().removeChannel(canal); canal = null; }
            chamados = {}; msgs = {}; ouvintes = [];
        },

        aoMudar: function (fn) {
            ouvintes.push(fn);
            return function () { ouvintes = ouvintes.filter(function (f) { return f !== fn; }); };
        },

        listar: function (setor) {
            var pronto = chamados[setor] ? Promise.resolve(chamados[setor]) : buscar(setor);
            return pronto.then(function (lista) { return lista.map(paraTela); });
        },
        obter: function (id) { var c = acharCru(id); return Promise.resolve(c ? paraTela(c) : null); },

        // Carrega a conversa quando o chamado é aberto
        abrir: function (id) {
            if (msgs[id] || carregando[id]) return;
            carregando[id] = true;
            cli().from('mensagens').select('*').eq('chamado_id', id).order('id', { ascending: true }).limit(1000).then(function (r) {
                carregando[id] = false;
                if (r.error) { console.warn(r.error.message); return; }
                msgs[id] = (r.data || []).map(converter);
                avisar({ tipo: 'abriu', id: id });
            });
        },

        colegas: function () { return Promise.resolve(colegas.map(function (c) { return c.nome; })); },

        pegar: async function (id) {
            var r = await cli().rpc('pegar_chamado', { p_id: id }); var e = erro(r); if (e) { await depois(id); throw e; }
            await depois(id, true);
        },
        transferir: async function (id, nome) {
            var c = colegas.find(function (x) { return x.nome === nome; });
            if (!c) throw new Error('Colega não encontrado.');
            var r = await cli().rpc('transferir_chamado', { p_id: id, p_para: c.id }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },
        devolver: async function (id) {
            var r = await cli().rpc('devolver_chamado', { p_id: id }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },
        encerrar: async function (id) {
            var r = await cli().rpc('encerrar_chamado', { p_id: id }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },

        enviar: async function (id, texto, opcoes) {
            opcoes = opcoes || {};
            if (opcoes.imagem) throw new Error('O envio de imagens com dados reais chega na próxima etapa (armazenamento seguro). Por enquanto, só texto.');
            var r = await cli().from('mensagens').insert({ chamado_id: id, tipo: opcoes.interna ? 'interna' : 'agente', autor_id: eu.id, autor_nome: eu.nome, texto: texto });
            var e = erro(r, 'Pegue o chamado antes de responder.'); if (e) throw e;
            await depois(id, true);
        },

        // Chamado registrado à mão (atendimento que chegou fora do sistema)
        criarChamado: async function (d) {
            var r = await cli().rpc('criar_chamado', { p_setor: d.setor, p_nome: d.nome, p_local: d.local, p_fone: d.fone,
                                                      p_canal: d.canal, p_texto: d.texto, p_comigo: !!d.comigo });
            var e = erro(r); if (e) throw e;
            await buscar(d.setor); avisar({ tipo: 'atualizou', id: r.data });
            return r.data;
        },
        // Registra o que o cliente disse (só em chamado manual)
        registrarFala: async function (id, texto) {
            var r = await cli().rpc('registrar_fala_cliente', { p_id: id, p_texto: texto }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },

        // Teste: escreve como o cliente (só em chamados simulados)
        respostaDoCliente: async function (id, texto) {
            var r = await cli().rpc('responder_como_cliente', { p_id: id, p_texto: texto }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },

        simularContato: async function (setor) {
            var lista = POOL[setor] || POOL.impl, p = lista[Math.floor(Math.random() * lista.length)];
            var r = await cli().rpc('simular_contato', { p_setor: setor, p_nome: p[0], p_local: p[1], p_texto: p[2] }); var e = erro(r); if (e) throw e;
            await buscar(setor); avisar({ tipo: 'atualizou' });
        },

        solicitarCadastro: async function (id, opcoes) {
            var montado = opcoes.montar(opcoes.token);
            var r = await cli().from('mensagens').insert([
                { chamado_id: id, tipo: 'agente', autor_id: eu.id, autor_nome: eu.nome, texto: montado.texto },
                { chamado_id: id, tipo: 'formulario', autor_id: eu.id, autor_nome: eu.nome,
                  dados: { token: opcoes.token, formato: opcoes.formato, lote: !!opcoes.lote, link: montado.link || '' } }
            ]);
            var e = erro(r, 'Pegue o chamado antes de enviar o formulário.'); if (e) throw e;
            await depois(id, true);
            return opcoes.token;
        },
        // No modo real, as fichas chegam pelo banco (gatilho do 06), não pelo navegador
        receberCadastro: function () { return false; },
        receberCadastroLote: function () { return false; },
        lerCadastroTexto: function () { return 0; },

        marcarCadastrado: async function (id, indice) {
            var m = (msgs[id] || [])[indice]; if (!m) return;
            var r = await cli().rpc('marcar_ficha', { p_msg: m.msgId, p_indice: null }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },
        marcarLote: async function (id, indice, usuario) {
            var m = (msgs[id] || [])[indice]; if (!m) return;
            var r = await cli().rpc('marcar_ficha', { p_msg: m.msgId, p_indice: usuario === 'todos' ? null : usuario }); var e = erro(r); if (e) throw e;
            await depois(id, true);
        },

        avaliacoes: async function (setor) {
            var r = await cli().from('chamados').select('cliente_nome, cliente_local, setor, atendente_nome, avaliacao_nota, avaliacao_comentario, encerrado_em')
                .eq('setor', setor).not('avaliacao_nota', 'is', null).order('encerrado_em', { ascending: false }).limit(300);
            if (r.error) return [];
            return (r.data || []).map(function (a) {
                return { cliente: a.cliente_nome, local: a.cliente_local, setor: a.setor, atendente: a.atendente_nome || '—',
                         nota: a.avaliacao_nota, comentario: a.avaliacao_comentario || '',
                         quando: new Date(a.encerrado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) };
            });
        }
    };
})();