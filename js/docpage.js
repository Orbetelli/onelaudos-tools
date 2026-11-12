// ========================================
// PÁGINA DE DOCUMENTO — componente reutilizável (índice + busca + seções em acordeão)
// Usado por: Guia rápido (guia.js) e Padronização (padronizacao.js)
// JSON esperado: { titulo, objetivoTitulo?, objetivo?[], secoes[{id,numero,titulo,resumo,blocos[]}], regra?{titulo,texto,itens,fechamento} }
// ========================================
function criarPaginaDoc(cfg) {
    return {
        dados: null,
        busca: {},

        norm: function (s) {
            return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        },

        render: async function (el, param) {
            var esc = Docs.esc.bind(Docs);
            el.innerHTML = '<h1>' + esc(cfg.titulo) + '</h1><p class="vazio">Carregando...</p>';
            try {
                this.dados = await Docs.load(cfg.arquivo);
            } catch (e) {
                el.innerHTML = '<h1>' + esc(cfg.titulo) + '</h1><p class="vazio">' + esc(e.message) + '</p>';
                return;
            }
            if (location.hash.indexOf(cfg.hash) !== 0) return; // trocou de aba durante o carregamento
            try { this.montar(el); if (param) this.abrir(param); }
            catch (e) {
                console.error(e);
                el.innerHTML = '<h1>' + esc(cfg.titulo) + '</h1><p class="vazio">Erro ao montar a página: ' + esc(e.message) +
                    '</p><p class="tag">Confira se js/docs.js, js/docpage.js e ' + esc(cfg.arquivo) + ' são as versões mais recentes e atualize com Ctrl+Shift+R.</p>';
            }
        },

        montar: function (el) {
            var self = this, d = this.dados, esc = Docs.esc.bind(Docs);
            this.busca = {};
            d.secoes.forEach(function (s) { self.busca[s.id] = self.norm(JSON.stringify(s)); });

            var objetivo = (d.objetivo && d.objetivo.length)
                ? '<section class="card"><h3>' + esc(d.objetivoTitulo || 'Objetivo') + '</h3>' +
                  d.objetivo.map(function (p) { return '<p>' + Docs.inline(p) + '</p>'; }).join('') + '</section>'
                : '';
            var indice = d.secoes.map(function (s) {
                return '<button type="button" class="guia-card" data-id="' + esc(s.id) + '">' +
                    '<span class="guia-num">' + esc(s.numero) + '</span>' +
                    '<span><strong>' + esc(s.titulo) + '</strong><small>' + esc(s.resumo || '') + '</small></span></button>';
            }).join('');
            var secoes = d.secoes.map(function (s) {
                return '<details class="guia-sec" id="guia-' + esc(s.id) + '" data-id="' + esc(s.id) + '">' +
                    '<summary><span class="guia-num">' + esc(s.numero) + '</span>' + esc(s.titulo) + '</summary>' +
                    '<div class="guia-corpo">' + s.blocos.map(function (b) { return Docs.bloco(b); }).join('') + '</div></details>';
            }).join('');
            var regra = d.regra
                ? '<section class="card guia-regra"><h3>' + esc(d.regra.titulo) + '</h3>' +
                  '<p>' + Docs.inline(d.regra.texto) + '</p>' + Docs.lista(d.regra.itens) +
                  '<p>' + Docs.inline(d.regra.fechamento) + '</p></section>'
                : '';
            var download = cfg.download
                ? '<a class="btn sec" href="' + esc(cfg.download.href) + '" download>' + esc(cfg.download.rotulo) + '</a>'
                : '';

            el.innerHTML =
                '<h1>' + esc(d.titulo) + '</h1>' + objetivo +
                '<input type="search" id="guiaQ" placeholder="' + esc(cfg.busca || 'Buscar...') + '">' +
                '<div class="guia-index" id="guiaIndex">' + indice + '</div>' +
                '<div class="pw-actions">' +
                    '<button type="button" class="sec" id="guiaExpandir">Expandir tudo</button>' +
                    '<button type="button" class="sec" id="guiaRecolher">Recolher tudo</button>' + download +
                '</div>' +
                '<p class="tag" id="guiaInfo"></p>' +
                '<div id="guiaSecoes">' + secoes + '</div>' + regra;

            el.querySelectorAll('.guia-card').forEach(function (c) {
                c.addEventListener('click', function () { self.abrir(c.dataset.id); });
            });
            document.getElementById('guiaQ').addEventListener('input', function (e) { self.filtrar(self.norm(e.target.value.trim())); });
            document.getElementById('guiaExpandir').addEventListener('click', function () { self.todos(true); });
            document.getElementById('guiaRecolher').addEventListener('click', function () { self.todos(false); });
            if (d.secoes.length === 1) document.querySelector('.guia-sec').open = true; // seção única já abre aberta
        },

        abrir: function (id) {
            var sec = document.getElementById('guia-' + id);
            if (!sec) return;
            sec.open = true;
            sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        todos: function (abrir) {
            document.querySelectorAll('.guia-sec:not(.hidden)').forEach(function (s) { s.open = abrir; });
        },

        filtrar: function (q) {
            var self = this, achados = 0;
            document.querySelectorAll('.guia-sec').forEach(function (sec) {
                var ok = !q || self.busca[sec.dataset.id].includes(q);
                sec.classList.toggle('hidden', !ok);
                if (q) sec.open = ok;   // abre só as seções encontradas
                if (ok) achados++;
            });
            document.getElementById('guiaIndex').classList.toggle('hidden', !!q);
            document.getElementById('guiaInfo').textContent = q ? (achados ? achados + ' seção(ões) encontrada(s)' : 'Nada encontrado.') : '';
            if (!q) this.todos(Object.keys(this.busca).length === 1); // com seção única, mantém aberta
        }
    };
}