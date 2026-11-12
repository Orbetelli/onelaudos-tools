// ========================================
// DIAGNÓSTICO DE REDE E CONEXÃO
// Abas: passo a passo guiado, comandos, teste do navegador e resumo para o chamado.
// O conteúdo (perguntas, resultados, comandos) fica em content/diagnostico.json
// ========================================
const Diagnostico = {
    dados: null,
    estado: null,

    render: async function (el, param) {
        var esc = Docs.esc.bind(Docs);
        el.innerHTML = '<h1>Diagnóstico de rede e conexão</h1><p class="vazio">Carregando...</p>';
        try {
            this.dados = await Docs.load('content/diagnostico.json');
        } catch (e) {
            el.innerHTML = '<h1>Diagnóstico de rede e conexão</h1><p class="vazio">' + esc(e.message) + '</p>';
            return;
        }
        if (location.hash.indexOf('#/diagnostico') !== 0) return; // trocou de aba durante o carregamento
        try { this.montar(el, param); }
        catch (e) {
            console.error(e);
            el.innerHTML = '<h1>Diagnóstico de rede e conexão</h1><p class="vazio">Erro ao montar a página: ' + esc(e.message) + '</p>';
        }
    },

    abas: [
        { id: 'passo', rotulo: 'Passo a passo' },
        { id: 'comandos', rotulo: 'Comandos' },
        { id: 'navegador', rotulo: 'Teste do navegador' },
        { id: 'resumo', rotulo: 'Resumo do chamado' }
    ],

    montar: function (el, param) {
        var self = this;
        var aba = this.abas.some(function (a) { return a.id === param; }) ? param : 'passo';
        this.estado = { aba: aba, no: this.dados.inicio, caminho: [], teste: '', form: {}, alvo: 'site', urlCustom: '' };
        el.innerHTML =
            '<h1>' + Docs.esc(this.dados.titulo) + '</h1>' +
            '<p class="home-sub">Descubra onde está o problema antes de encaminhar. Os testes rodam no computador de quem está com o problema.</p>' +
            '<div class="pw-tabs" id="diagAbas"></div><div id="diagCorpo"></div>';
        var abasEl = document.getElementById('diagAbas');
        this.abas.forEach(function (a) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'pw-tab'; b.dataset.aba = a.id; b.textContent = a.rotulo;
            b.addEventListener('click', function () { self.estado.aba = a.id; self.desenhar(); });
            abasEl.appendChild(b);
        });
        this.desenhar();
    },

    desenhar: function () {
        var s = this.estado, corpo = document.getElementById('diagCorpo');
        document.querySelectorAll('#diagAbas .pw-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.aba === s.aba); });
        corpo.innerHTML = '';
        if (s.aba === 'passo') this.abaPasso(corpo);
        else if (s.aba === 'comandos') this.abaComandos(corpo);
        else if (s.aba === 'navegador') this.abaNavegador(corpo);
        else this.abaResumo(corpo);
    },

    // ---------- Passo a passo ----------
    abaPasso: function (corpo) {
        var self = this, s = this.estado, esc = Docs.esc.bind(Docs), no = this.dados.nos[s.no];
        var trilha = s.caminho.length
            ? '<ol class="diag-trilha">' + s.caminho.map(function (c) {
                return '<li><span>' + esc(c.pergunta) + '</span> <strong>' + esc(c.resposta) + '</strong></li>';
              }).join('') + '</ol>'
            : '';
        var html = trilha + '<section class="card diag-no">';
        var blocos = (no.blocos || []).map(function (b) { return Docs.bloco(b); }).join('');
        if (no.tipo === 'pergunta') {
            html += '<h3>' + esc(no.titulo) + '</h3>' + (no.texto ? '<p>' + Docs.inline(no.texto) + '</p>' : '') + blocos +
                '<div class="diag-opcoes">' + no.opcoes.map(function (o, i) {
                    return '<button type="button" class="diag-opcao" data-i="' + i + '">' + esc(o.rotulo) + '</button>';
                }).join('') + '</div>';
        } else {
            html += '<span class="diag-selo">Resultado</span><h3>' + esc(no.titulo) + '</h3>' +
                (no.resumo ? '<p class="tag">' + esc(no.resumo) + '</p>' : '') + blocos;
            if (no.encaminhar) {
                html += '<div class="diag-encaminhar"><strong>Encaminhar para: ' + esc(no.encaminhar.para) + '</strong><p>' + Docs.inline(no.encaminhar.texto) + '</p></div>';
            }
        }
        html += '</section><div class="pw-actions">';
        if (s.caminho.length) html += '<button type="button" class="sec" id="diagVoltar">← Voltar</button><button type="button" class="sec" id="diagReiniciar">Recomeçar</button>';
        if (no.tipo === 'resultado') html += '<button type="button" id="diagResumo">Preencher resumo do chamado</button>';
        html += '</div>';
        corpo.innerHTML = html;

        corpo.querySelectorAll('.diag-opcao').forEach(function (b) {
            b.addEventListener('click', function () {
                var o = no.opcoes[Number(b.dataset.i)];
                s.caminho.push({ no: s.no, pergunta: no.titulo, resposta: o.rotulo });
                s.no = o.vai;
                self.desenhar();
                window.scrollTo({ top: 0 });
            });
        });
        var v = document.getElementById('diagVoltar');
        if (v) v.addEventListener('click', function () { var u = s.caminho.pop(); s.no = u.no; self.desenhar(); });
        var r = document.getElementById('diagReiniciar');
        if (r) r.addEventListener('click', function () { s.caminho = []; s.no = self.dados.inicio; self.desenhar(); });
        var rs = document.getElementById('diagResumo');
        if (rs) rs.addEventListener('click', function () { s.aba = 'resumo'; self.desenhar(); });
    },

    // ---------- Comandos ----------
    HOST_OK: /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/,

    abaComandos: function (corpo) {
        var self = this, esc = Docs.esc.bind(Docs), d = this.dados;
        var ref = d.comandos.map(function (c) {
            return '<tr><td data-rot="Comando"><code>' + esc(c.cmd).replace(/\n/g, '<br>') + '</code>' +
                '<button type="button" class="sec mini" data-copy="' + esc(c.cmd) + '">Copiar</button></td>' +
                '<td data-rot="Para quê">' + esc(c.para) + '<div class="tag">' + esc(c.onde) + '</div></td></tr>';
        }).join('');
        var leitura = d.leitura.map(function (l) {
            return '<tr><td>' + esc(l[0]) + '</td><td>' + esc(l[1]) + '</td></tr>';
        }).join('');
        corpo.innerHTML =
            '<section class="card"><h3>Gerar comandos para um endereço</h3>' +
            '<p class="tag">Digite o IP ou o nome do que quer testar (um site, o Router, a Worklist). Só letras, números, ponto e hífen.</p>' +
            '<div class="diag-form"><div><label for="diagHost">IP ou endereço</label><input type="text" id="diagHost" placeholder="ex.: onelaudos.mobilemed.com.br ou 192.168.0.10" autocomplete="off" spellcheck="false"></div>' +
            '<div><label for="diagPorta">Porta (opcional)</label><input type="number" id="diagPorta" min="1" max="65535" placeholder="ex.: 104"></div></div>' +
            '<div id="diagGerados"></div></section>' +
            '<h2 class="home-grupo">Comandos úteis</h2>' +
            '<p class="tag">Prompt de Comando: Windows + R, digite cmd. PowerShell: Windows + X e escolha Windows PowerShell.</p>' +
            '<div class="tabela-wrap"><table class="diag-tab"><thead><tr><th>Comando</th><th>Para quê</th></tr></thead><tbody>' + ref + '</tbody></table></div>' +
            '<h2 class="home-grupo">Como ler o resultado</h2>' +
            '<div class="tabela-wrap"><table><thead><tr><th>O que aparece</th><th>O que significa</th></tr></thead><tbody>' + leitura + '</tbody></table></div>';
        var host = document.getElementById('diagHost'), porta = document.getElementById('diagPorta');
        var f = function () { self.gerar(host.value.trim(), porta.value.trim()); };
        host.addEventListener('input', f); porta.addEventListener('input', f);
        self.gerar('', '');
    },

    gerar: function (host, porta) {
        var out = document.getElementById('diagGerados'), esc = Docs.esc.bind(Docs);
        if (!host) { out.innerHTML = ''; return; }
        if (!this.HOST_OK.test(host)) { out.innerHTML = '<div class="message message-error">Endereço inválido. Use só letras, números, ponto e hífen (sem http://, barras ou espaços).</div>'; return; }
        var p = null;
        if (porta) {
            var n = Number(porta);
            if (!/^\d{1,5}$/.test(porta) || n < 1 || n > 65535) { out.innerHTML = '<div class="message message-error">Porta inválida. Use um número de 1 a 65535.</div>'; return; }
            p = n;
        }
        var lista = [
            ['Ping (10 tentativas)', 'ping -n 10 ' + host],
            ['Caminho até o destino', 'tracert ' + host],
            ['Consulta de DNS', 'nslookup ' + host],
            ['Perda ao longo do caminho (demora uns 5 minutos)', 'pathping ' + host]
        ];
        lista.push(p ? ['Teste da porta ' + p + ' (PowerShell)', 'Test-NetConnection -ComputerName ' + host + ' -Port ' + p]
                     : ['Teste de conexão (PowerShell)', 'Test-NetConnection -ComputerName ' + host]);
        out.innerHTML = lista.map(function (i) {
            return '<h4>' + esc(i[0]) + '</h4>' + Docs.bloco({ tipo: 'comando', conteudo: i[1] });
        }).join('');
    },

    // ---------- Teste do navegador ----------
    ALVOS: {
        site: { rotulo: 'Este site', url: 'css/style.css', mesma: true },
        google: { rotulo: 'Internet (Google)', url: 'https://www.google.com/generate_204', mesma: false },
        onelaudos: { rotulo: 'Telerradiologia', url: 'https://onelaudos.mobilemed.com.br/', mesma: false },
        outro: { rotulo: 'Outro endereço', url: '', mesma: false }
    },

    abaNavegador: function (corpo) {
        var self = this, s = this.estado, esc = Docs.esc.bind(Docs);
        var chips = Object.keys(this.ALVOS).map(function (k) {
            return '<button type="button" class="pw-tab diag-alvo' + (s.alvo === k ? ' active' : '') + '" data-alvo="' + k + '">' + esc(self.ALVOS[k].rotulo) + '</button>';
        }).join('');
        corpo.innerHTML =
            '<section class="card"><h3>Teste de resposta do navegador</h3>' +
            '<p class="tag">Faz 8 requisições a partir deste navegador e mede o tempo de resposta. Mostra se o endereço está acessível desta máquina e se a conexão está estável. Não testa o Router nem a Worklist.</p>' +
            '<div class="pw-tabs">' + chips + '</div>' +
            '<div id="diagUrlBox" class="' + (s.alvo === 'outro' ? '' : 'hidden') + '"><label for="diagUrl">Endereço completo</label>' +
            '<input type="text" id="diagUrl" placeholder="https://exemplo.com.br" value="' + esc(s.urlCustom) + '" autocomplete="off" spellcheck="false"></div>' +
            '<div class="pw-actions"><button type="button" id="diagRodar">Rodar teste</button><span class="tag" id="diagProg"></span></div>' +
            '<div id="diagSaida"></div></section>' +
            '<p class="tag">A 1ª tentativa inclui a abertura da conexão e costuma ser mais lenta, então ela é mostrada à parte. Resultados dependem do momento e do navegador. Use como indício, junto com os comandos.</p>';
        corpo.querySelectorAll('.diag-alvo').forEach(function (b) {
            b.addEventListener('click', function () { s.alvo = b.dataset.alvo; self.desenhar(); });
        });
        var url = document.getElementById('diagUrl');
        if (url) url.addEventListener('input', function () { s.urlCustom = url.value; });
        document.getElementById('diagRodar').addEventListener('click', function () { self.rodarTeste(); });
        if (s.ultimoHtml) document.getElementById('diagSaida').innerHTML = s.ultimoHtml;
    },

    espera: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },

    rodarTeste: async function () {
        var s = this.estado, esc = Docs.esc.bind(Docs), alvo = this.ALVOS[s.alvo];
        var saida = document.getElementById('diagSaida'), prog = document.getElementById('diagProg'), btn = document.getElementById('diagRodar');
        var url = alvo.url, mesma = alvo.mesma;
        if (s.alvo === 'outro') {
            try {
                var u = new URL(s.urlCustom.trim());
                if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocolo');
                url = u.href;
            } catch (e) {
                saida.innerHTML = '<div class="message message-error">Digite um endereço completo, começando com https://</div>';
                return;
            }
        }
        btn.disabled = true;
        var N = 8, tempos = [], falhas = 0;
        for (var i = 0; i < N; i++) {
            prog.textContent = 'Tentativa ' + (i + 1) + ' de ' + N + '...';
            var ctrl = new AbortController(), to = setTimeout(function () { ctrl.abort(); }, 8000);
            var alvoUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'diag=' + Date.now() + i;
            var t0 = performance.now();
            try {
                await fetch(alvoUrl, { mode: mesma ? 'same-origin' : 'no-cors', cache: 'no-store', signal: ctrl.signal });
                tempos.push(performance.now() - t0);
            } catch (e) { falhas++; }
            clearTimeout(to);
            await this.espera(150);
        }
        prog.textContent = '';
        btn.disabled = false;

        var primeira = tempos.length ? tempos[0] : null;
        var resto = tempos.length > 1 ? tempos.slice(1) : tempos.slice();
        var soma = resto.reduce(function (a, b) { return a + b; }, 0);
        var media = resto.length ? soma / resto.length : null;
        var min = resto.length ? Math.min.apply(null, resto) : null, max = resto.length ? Math.max.apply(null, resto) : null;
        var jitter = null;
        if (resto.length > 1) {
            var dif = 0; for (var j = 1; j < resto.length; j++) dif += Math.abs(resto[j] - resto[j - 1]);
            jitter = dif / (resto.length - 1);
        }
        var fmt = function (v) { return v === null ? '-' : Math.round(v) + ' ms'; };
        var veredito, classe;
        if (falhas === N) { veredito = 'Sem resposta. Esta máquina não conseguiu acessar o endereço (sem conexão, bloqueio da rede ou endereço fora do ar).'; classe = 'message-error'; }
        else if (falhas > 0) { veredito = 'Conexão instável: ' + falhas + ' de ' + N + ' tentativas falharam.'; classe = 'message-error'; }
        else if (media > 150) { veredito = 'Acessível, mas com tempo de resposta alto (acima de 150 ms em média).'; classe = 'message-error'; }
        else { veredito = 'Acessível, com resposta estável.'; classe = 'message-success'; }

        var linhas = [
            ['Online (segundo o navegador)', navigator.onLine ? 'Sim' : 'Não'],
            ['Tentativas com sucesso', (N - falhas) + ' de ' + N],
            ['1ª tentativa', fmt(primeira)],
            ['Tempo médio (demais)', fmt(media)],
            ['Mínimo / máximo', fmt(min) + ' / ' + fmt(max)],
            ['Variação (jitter)', fmt(jitter)]
        ];
        var c = navigator.connection;
        if (c && c.effectiveType) linhas.push(['Tipo de conexão (estimativa do navegador)', c.effectiveType + (c.downlink ? ', cerca de ' + c.downlink + ' Mbps' : '')]);

        s.ultimoHtml = '<div class="message ' + classe + '">' + esc(veredito) + '</div>' +
            '<div class="tabela-wrap"><table><tbody>' + linhas.map(function (l) { return '<tr><th>' + esc(l[0]) + '</th><td>' + esc(l[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        var alvoNome = s.alvo === 'outro' ? url : alvo.rotulo;
        s.teste = 'Teste do navegador para "' + alvoNome + '": ' + veredito + ' Sucesso ' + (N - falhas) + '/' + N + ', média ' + fmt(media) + ', mínimo/máximo ' + fmt(min) + '/' + fmt(max) + ', jitter ' + fmt(jitter) + '.';
        saida.innerHTML = s.ultimoHtml +
            '<div class="pw-actions"><button type="button" class="sec" id="diagUsar">Usar no resumo do chamado</button></div>';
        var self = this;
        document.getElementById('diagUsar').addEventListener('click', function () { s.aba = 'resumo'; self.desenhar(); });
    },

    // ---------- Resumo do chamado ----------
    abaResumo: function (corpo) {
        var self = this, s = this.estado, esc = Docs.esc.bind(Docs), f = s.form;
        var sel = function (id, rot, opcoes) {
            return '<div><label for="' + id + '">' + esc(rot) + '</label><select id="' + id + '">' +
                opcoes.map(function (o) { return '<option' + ((f[id] || opcoes[0]) === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
        };
        var txt = function (id, rot, ph) {
            return '<div><label for="' + id + '">' + esc(rot) + '</label><input type="text" id="' + id + '" value="' + esc(f[id] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off"></div>';
        };
        corpo.innerHTML =
            '<section class="card"><h3>Resumo para o chamado</h3>' +
            '<p class="tag">Preencha o que souber. O caminho do diagnóstico e o teste do navegador entram automaticamente. Depois é só copiar e colar no chamado.</p>' +
            '<div class="diag-form">' + txt('rUnidade', 'Unidade ou cliente', 'ex.: nome da clínica') + txt('rPc', 'Computador ou IP', 'ex.: recepção, 192.168.0.25') + '</div>' +
            '<div class="diag-form">' + sel('rMaq', 'Máquinas afetadas', ['Não informado', 'Uma máquina', 'Várias máquinas', 'Toda a unidade']) +
            sel('rSites', 'Outros sites abrem?', ['Não informado', 'Sim', 'Não']) + sel('rTi', 'TI local acionada?', ['Não informado', 'Sim', 'Não', 'Não se aplica']) + '</div>' +
            '<label for="rObs">Observações e resultados dos testes (cole aqui o que apareceu nos comandos)</label>' +
            '<textarea id="rObs" placeholder="ex.: ping 8.8.8.8 com 20% de perda; tracert para no salto 3...">' + esc(f.rObs || '') + '</textarea></section>' +
            '<section class="card"><h3>Texto pronto</h3><textarea id="rSaida" readonly></textarea>' +
            '<div class="pw-actions"><button type="button" id="rCopiar" data-copy="">Copiar texto</button></div></section>';
        var ids = ['rUnidade', 'rPc', 'rMaq', 'rSites', 'rTi', 'rObs'];
        var atualizar = function () {
            ids.forEach(function (id) { f[id] = document.getElementById(id).value; });
            var t = self.montarResumo();
            document.getElementById('rSaida').value = t;
            document.getElementById('rCopiar').dataset.copy = t;
        };
        ids.forEach(function (id) {
            var e = document.getElementById(id);
            e.addEventListener('input', atualizar); e.addEventListener('change', atualizar);
        });
        atualizar();
    },

    montarResumo: function () {
        var s = this.estado, f = s.form, d = this.dados, no = d.nos[s.no];
        var v = function (x) { return (x && String(x).trim()) || 'Não informado'; };
        var l = ['CHAMADO: problema de rede/conexão', ''];
        l.push('Unidade/cliente: ' + v(f.rUnidade));
        l.push('Computador/IP: ' + v(f.rPc));
        l.push('Máquinas afetadas: ' + v(f.rMaq));
        l.push('Outros sites abrem: ' + v(f.rSites));
        l.push('TI local acionada: ' + v(f.rTi));
        l.push('');
        if (s.caminho.length) {
            l.push('Testes realizados (passo a passo):');
            s.caminho.forEach(function (c) { l.push('- ' + c.pergunta + ' ' + c.resposta); });
        } else {
            l.push('Testes realizados: o passo a passo ainda não foi percorrido.');
        }
        if (no.tipo === 'resultado') {
            l.push('');
            l.push('Conclusão: ' + no.titulo + (no.encaminhar ? ' (encaminhar para: ' + no.encaminhar.para + ')' : ''));
        }
        if (s.teste) { l.push(''); l.push(s.teste); }
        if (f.rObs && f.rObs.trim()) { l.push(''); l.push('Observações: ' + f.rObs.trim()); }
        l.push('');
        l.push('Registrado em: ' + new Date().toLocaleString('pt-BR'));
        return l.join('\n');
    }
};