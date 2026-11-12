// ========================================
// BUSCA GLOBAL — procura em todas as páginas de uma vez (Guia, Portal, Padronização, Instalação,
// Sup 1/Sup 2, Glossário, Diagnóstico, Downloads e as ferramentas).
// O índice é montado a partir dos próprios arquivos de conteúdo, então novos textos já entram na busca.
// Rota: #/busca/<termo>
// ========================================
const Busca = {
    indice: null,
    falhas: [],

    // minúsculas e sem acento, mantendo o MESMO tamanho do texto original (necessário para destacar o trecho)
    norm: function (s) {
        s = String(s);
        var o = '';
        for (var i = 0; i < s.length; i++) {
            var m = s.charAt(i).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            o += m.length === 1 ? m : (s.charAt(i).toLowerCase().charAt(0) || s.charAt(i));
        }
        return o;
    },

    // junta todos os textos de um bloco de conteúdo, ignorando campos técnicos
    textos: function (x, out) {
        var self = this;
        if (Array.isArray(x)) { x.forEach(function (v) { self.textos(v, out); }); }
        else if (x && typeof x === 'object') {
            Object.keys(x).forEach(function (k) {
                if (k === 'tipo' || k === 'id' || k === 'variante' || k === 'vai' || k === 'href' || k === 'src' || k === 'mes') return;
                self.textos(x[k], out);
            });
        } else if (typeof x === 'string' && x.trim()) { out.push(x.replace(/\*\*/g, '')); }
        return out;
    },

    montarIndice: async function () {
        if (this.indice) return this.indice;
        var self = this, itens = [], falhas = [];
        var ler = async function (arq) {
            try { return await Docs.load(arq); } catch (e) { falhas.push(arq); return null; }
        };
        var docs = [
            ['Guia rápido', 'guia', 'content/guia.json'],
            ['Portal (tutorial)', 'portal', 'content/portal.json'],
            ['Padronização', 'padronizacao', 'content/padronizacao.json'],
            ['Instalação', 'instalacao', 'content/instalacao.json']
        ];
        var res = await Promise.all(docs.map(function (d) { return ler(d[2]); })
            .concat([ler('content/suporte.json'), ler('content/glossario.json'), ler('content/diagnostico.json'), ler('downloads/manifest.json')]));

        docs.forEach(function (d, i) {
            var dados = res[i];
            if (!dados) return;
            (dados.secoes || []).forEach(function (s) {
                itens.push({
                    pagina: d[0], titulo: (s.numero ? s.numero + '. ' : '') + s.titulo, resumo: s.resumo || '',
                    tags: (s.tags || []).join(' '), texto: self.textos(s.blocos, []).join(' · '),
                    hash: '#/' + d[1] + '/' + s.id
                });
            });
            if (dados.regra) itens.push({ pagina: d[0], titulo: dados.regra.titulo, resumo: '', tags: '', texto: self.textos(dados.regra, []).join(' · '), hash: '#/' + d[1] });
        });

        var sup = res[4];
        if (sup) {
            (sup.niveis || []).forEach(function (n) {
                itens.push({ pagina: 'Sup 1 e Sup 2', titulo: (n.rotulo || '') + ' — ' + (n.subtitulo || ''), resumo: '', tags: '', texto: self.textos(n, []).join(' · '), hash: '#/suporte' });
            });
            (sup.casos || []).forEach(function (c) {
                itens.push({ pagina: 'Sup 1 e Sup 2', titulo: c.texto, resumo: 'Atendido pelo Nível ' + c.nivel, tags: (c.palavras || []).join(' '), texto: '', hash: '#/suporte' });
            });
            itens.push({ pagina: 'Sup 1 e Sup 2', titulo: 'Comparativo e quando escalar', resumo: '', tags: '', texto: self.textos([sup.comparativo, sup.escalar], []).join(' · '), hash: '#/suporte' });
        }

        var glo = res[5];
        if (glo) glo.termos.forEach(function (t) {
            itens.push({ pagina: 'Glossário', titulo: t.termo, resumo: t.extenso || '', tags: t.categoria, texto: self.textos([t.definicao, t.dia || ''], []).join(' · '), hash: '#/glossario/' + t.id });
        });

        var dg = res[6];
        if (dg) {
            Object.keys(dg.nos).forEach(function (k) {
                var n = dg.nos[k];
                itens.push({ pagina: 'Diagnóstico de rede', titulo: n.titulo, resumo: n.resumo || n.texto || '', tags: '', texto: self.textos([n.blocos || [], n.opcoes ? n.opcoes.map(function (o) { return o.rotulo; }) : [], n.encaminhar || []], []).join(' · '), hash: '#/diagnostico' });
            });
            (dg.comandos || []).forEach(function (c) {
                itens.push({ pagina: 'Diagnóstico de rede', titulo: c.cmd.replace(/\n/g, ' / '), resumo: c.para, tags: 'comando', texto: c.onde, hash: '#/diagnostico/comandos' });
            });
        }

        var dl = res[7];
        if (dl) dl.forEach(function (d) {
            itens.push({ pagina: 'Downloads', titulo: d.titulo, resumo: d.categoria || '', tags: d.arquivo || '', texto: '', hash: '#/downloads' });
        });

        (Home.grupos || []).forEach(function (g) {
            g.itens.forEach(function (i) {
                if (['senhas', 'assinatura', 'downloads'].indexOf(i.rota) < 0) return; // as demais páginas já entram pelo conteúdo
                itens.push({ pagina: 'Ferramentas', titulo: i.titulo, resumo: i.descricao, tags: i.topicos.join(' '), texto: '', hash: '#/' + i.rota });
            });
        });

        itens.forEach(function (it) {
            it.nt = self.norm(it.titulo); it.nr = self.norm(it.resumo + ' ' + it.tags + ' ' + it.pagina); it.nx = self.norm(it.texto);
        });
        this.falhas = falhas;
        this.indice = itens;
        return itens;
    },

    buscar: function (q) {
        var self = this;
        var tokens = this.norm(q).split(/\s+/).filter(Boolean).slice(0, 6);
        if (!tokens.length) return { tokens: tokens, lista: [] };
        var frase = tokens.join(' '), lista = [];
        this.indice.forEach(function (it) {
            var score = 0;
            for (var i = 0; i < tokens.length; i++) {
                var t = tokens[i], pt = it.nt.indexOf(t) >= 0, pr = it.nr.indexOf(t) >= 0, px = it.nx.indexOf(t) >= 0;
                if (!pt && !pr && !px) return; // todas as palavras precisam aparecer
                score += (pt ? 10 : 0) + (pr ? 4 : 0) + (px ? 1 : 0);
            }
            if (it.nt === frase) score += 30;           // título exatamente igual ao que foi digitado
            else if (it.nt.indexOf(frase) === 0) score += 6; // título começa com o que foi digitado
            if (tokens.length > 1) {
                if (it.nt.indexOf(frase) >= 0) score += 15;
                else if (it.nx.indexOf(frase) >= 0) score += 5;
            }
            lista.push({ it: it, score: score });
        });
        lista.sort(function (a, b) { return b.score - a.score; });
        return { tokens: tokens, lista: lista };
    },

    // escapa o texto e envolve em <mark> as palavras buscadas
    marcar: function (orig, tokens) {
        var n = this.norm(orig), marc = [];
        tokens.forEach(function (t) {
            var p = n.indexOf(t);
            while (p >= 0) { marc.push([p, p + t.length]); p = n.indexOf(t, p + t.length); }
        });
        marc.sort(function (a, b) { return a[0] - b[0]; });
        var fund = [];
        marc.forEach(function (m) {
            var u = fund[fund.length - 1];
            if (u && m[0] <= u[1]) u[1] = Math.max(u[1], m[1]); else fund.push([m[0], m[1]]);
        });
        var html = '', pos = 0;
        fund.forEach(function (m) {
            html += Docs.esc(orig.slice(pos, m[0])) + '<mark>' + Docs.esc(orig.slice(m[0], m[1])) + '</mark>';
            pos = m[1];
        });
        return html + Docs.esc(orig.slice(pos));
    },

    trecho: function (it, tokens) {
        var base = it.texto || it.resumo || '', nb = it.texto ? it.nx : this.norm(base);
        if (!base) return '';
        var pos = -1;
        tokens.forEach(function (t) { var p = nb.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; });
        if (pos < 0) pos = 0;
        var ini = Math.max(0, pos - 60), fim = Math.min(base.length, pos + 160);
        return (ini > 0 ? '…' : '') + this.marcar(base.slice(ini, fim), tokens) + (fim < base.length ? '…' : '');
    },

    render: async function (el, param) {
        var esc = Docs.esc.bind(Docs), q = (param || '').trim(), self = this;
        el.innerHTML = '<h1>Busca</h1><p class="vazio">Carregando...</p>';
        try { await this.montarIndice(); }
        catch (e) { el.innerHTML = '<h1>Busca</h1><p class="vazio">Erro ao montar a busca: ' + esc(e.message) + '</p>'; return; }
        if (location.hash.indexOf('#/busca') !== 0) return; // trocou de aba durante o carregamento

        if (!q) {
            el.innerHTML = '<h1>Busca</h1><p class="home-sub">Digite na caixa de busca do menu para procurar em todas as páginas ao mesmo tempo. Atalho: tecle <kbd>/</kbd>.</p>' +
                '<div class="card"><h3>Experimente</h3><div class="home-tags">' +
                ['senha', 'router', 'AE Title', 'prioridade', 'worklist', 'ping'].map(function (t) {
                    return '<a class="busca-sug" href="#/busca/' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
                }).join('') + '</div></div>';
            return;
        }
        var r = this.buscar(q), lista = r.lista.slice(0, 40);
        var html = '<h1>Busca</h1><p class="home-sub">' + (r.lista.length
            ? r.lista.length + ' resultado(s) para <strong>' + esc(q) + '</strong>' + (r.lista.length > lista.length ? ' (mostrando os ' + lista.length + ' melhores)' : '')
            : 'Nada encontrado para <strong>' + esc(q) + '</strong>.') + '</p>';
        if (!r.lista.length) html += '<p class="tag">Tente uma palavra só, ou outra forma de escrever (ex.: "senha" em vez de "troca de senha").</p>';
        if (this.falhas.length) html += '<p class="tag">Não foi possível ler: ' + this.falhas.map(esc).join(', ') + '. Os resultados podem estar incompletos.</p>';
        html += lista.map(function (x) {
            var it = x.it;
            return '<a class="card busca-item" href="' + esc(it.hash) + '">' +
                '<span class="busca-pag">' + esc(it.pagina) + '</span>' +
                '<h3>' + self.marcar(it.titulo, r.tokens) + '</h3>' +
                '<p>' + self.trecho(it, r.tokens) + '</p></a>';
        }).join('');
        el.innerHTML = html;
    }
};