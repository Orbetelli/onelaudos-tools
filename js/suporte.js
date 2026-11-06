// ========================================
// NÍVEIS DE SUPORTE — Sup Nível 1 e Sup Nível 2
// O conteúdo fica em content/suporte.json
// ========================================
const Suporte = {
    dados: null,

    norm: function (s) {
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    },

    render: async function (el) {
        el.innerHTML = '<h1>Níveis de suporte</h1><p class="vazio">Carregando...</p>';
        try {
            this.dados = await Docs.load('content/suporte.json');
        } catch (e) {
            el.innerHTML = '<h1>Níveis de suporte</h1><p class="vazio">' + Docs.esc(e.message) + '</p>';
            return;
        }
        if (location.hash.indexOf('#/suporte') !== 0) return; // trocou de aba durante o carregamento
        try { this.montar(el); }
        catch (e) {
            console.error(e);
            el.innerHTML = '<h1>Níveis de suporte</h1><p class="vazio">Erro ao montar a página: ' + Docs.esc(e.message) +
                '</p><p class="tag">Confira se js/docs.js e content/suporte.json são as versões mais recentes e atualize com Ctrl+Shift+R.</p>';
        }
    },

    montar: function (el) {
        var self = this, d = this.dados, esc = Docs.esc.bind(Docs);

        var niveis = d.niveis.map(function (n) {
            var num = n.numero === 2 ? 2 : 1;
            return '<section class="card nivel nivel-' + num + '">' +
                '<span class="nivel-tag">' + esc(n.rotulo) + '</span>' +
                '<h3>' + esc(n.subtitulo) + '</h3>' +
                '<p>' + Docs.inline(n.descricao) + '</p>' +
                '<h4>O que resolve</h4>' + Docs.lista(n.resolve) + '</section>';
        }).join('');

        el.innerHTML =
            '<h1>' + esc(d.titulo) + '</h1>' +
            '<p class="home-sub">' + Docs.inline(d.intro) + '</p>' +
            '<div class="nivel-grid">' + niveis + '</div>' +
            '<h2 class="home-grupo">Qual nível? Consulta rápida</h2>' +
            '<input type="search" id="supQ" placeholder="Digite o problema (ex.: cabeçalho, router, cache, internet)...">' +
            '<div id="supRes"><p class="vazio">Digite um problema para ver qual nível atende.</p></div>' +
            '<h2 class="home-grupo">Comparativo</h2>' + Docs.bloco(d.comparativo) +
            '<h2 class="home-grupo">' + esc(d.escalar.titulo) + '</h2>' +
            '<section class="card">' + d.escalar.blocos.map(function (b) { return Docs.bloco(b); }).join('') +
            '<p><a href="#/guia">Abrir o Guia rápido →</a></p></section>';

        document.getElementById('supQ').addEventListener('input', function (e) {
            self.consultar(self.norm(e.target.value.trim()));
        });
    },

    consultar: function (q) {
        var res = document.getElementById('supRes'), esc = Docs.esc.bind(Docs), self = this;
        if (!q) { res.innerHTML = '<p class="vazio">Digite um problema para ver qual nível atende.</p>'; return; }
        var achados = this.dados.casos.filter(function (c) {
            return self.norm(c.texto + ' ' + c.palavras.join(' ')).includes(q);
        });
        res.innerHTML = achados.length
            ? achados.map(function (c) {
                var n = c.nivel === 2 ? 2 : 1;
                return '<div class="caso"><span class="nivel-pill nivel-pill-' + n + '">Nível ' + n + '</span><span>' + esc(c.texto) + '</span></div>';
            }).join('')
            : '<p class="vazio">Não encontrei esse caso. Se for uma checagem dentro do portal, é Nível 1; se envolver T.I. ou a Mobile, é Nível 2.</p>';
    }
};