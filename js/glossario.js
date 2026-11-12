// ========================================
// GLOSSÁRIO — termos de imagem médica, rede e operação (content/glossario.json)
// Para incluir um termo: adicione um item em "termos" no JSON (id, termo, categoria, definicao; extenso, dia e ver são opcionais)
// Link direto para um termo: #/glossario/<id>
// ========================================
const Glossario = {
    dados: null,

    norm: function (s) {
        return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    },

    render: async function (el, param) {
        var esc = Docs.esc.bind(Docs);
        el.innerHTML = '<h1>Glossário</h1><p class="vazio">Carregando...</p>';
        try {
            this.dados = await Docs.load('content/glossario.json');
        } catch (e) {
            el.innerHTML = '<h1>Glossário</h1><p class="vazio">' + esc(e.message) + '</p>';
            return;
        }
        if (location.hash.indexOf('#/glossario') !== 0) return; // trocou de aba durante o carregamento
        try { this.montar(el, param); }
        catch (e) {
            console.error(e);
            el.innerHTML = '<h1>Glossário</h1><p class="vazio">Erro ao montar a página: ' + esc(e.message) + '</p>';
        }
    },

    montar: function (el, param) {
        var self = this, d = this.dados, esc = Docs.esc.bind(Docs);
        var termos = d.termos.slice().sort(function (a, b) { return self.norm(a.termo).localeCompare(self.norm(b.termo)); });
        var cats = [];
        termos.forEach(function (t) { if (cats.indexOf(t.categoria) < 0) cats.push(t.categoria); });
        this.estado = { q: '', cat: '', letra: '' };
        this.termos = termos;
        this.indice = {};
        termos.forEach(function (t) { self.indice[t.id] = t; });

        el.innerHTML =
            '<h1>Glossário</h1>' +
            '<p class="home-sub">Termos que aparecem no dia a dia do suporte: imagem médica, rede e sistemas. ' + termos.length + ' termos.</p>' +
            '<input type="search" id="glosQ" placeholder="Buscar termo ou explicação (ex.: AE Title, DNS, worklist)...">' +
            '<div class="glos-filtros" id="glosCats"></div>' +
            '<div class="glos-letras" id="glosLetras"></div>' +
            '<p class="tag" id="glosInfo"></p><div id="glosLista"></div>';

        var catsEl = document.getElementById('glosCats');
        [''].concat(cats).forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'pw-tab glos-chip'; b.dataset.cat = c;
            b.textContent = c || 'Todos';
            b.addEventListener('click', function () { self.estado.cat = c; self.atualizar(); });
            catsEl.appendChild(b);
        });
        var letras = [];
        termos.forEach(function (t) { var l = self.norm(t.termo).charAt(0).toUpperCase(); if (letras.indexOf(l) < 0) letras.push(l); });
        var letEl = document.getElementById('glosLetras');
        letras.forEach(function (l) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'glos-letra'; b.dataset.letra = l; b.textContent = l;
            b.addEventListener('click', function () { self.estado.letra = (self.estado.letra === l ? '' : l); self.atualizar(); });
            letEl.appendChild(b);
        });
        document.getElementById('glosQ').addEventListener('input', function (e) {
            self.estado.q = self.norm(e.target.value.trim()); self.atualizar();
        });
        document.getElementById('glosLista').addEventListener('click', function (e) {
            var a = e.target.closest('[data-ver]');
            if (!a) return;
            e.preventDefault();
            var q = document.getElementById('glosQ');
            q.value = ''; self.estado = { q: '', cat: '', letra: '' };
            self.atualizar(a.dataset.ver);
        });

        if (param && this.indice[param]) this.atualizar(param);
        else this.atualizar();
    },

    cartao: function (t) {
        var esc = Docs.esc.bind(Docs), self = this;
        var ver = (t.ver || []).filter(function (id) { return self.indice[id]; }).map(function (id) {
            return '<a href="#/glossario/' + esc(id) + '" data-ver="' + esc(id) + '">' + esc(self.indice[id].termo) + '</a>';
        }).join(' · ');
        return '<article class="card glos-termo" id="glos-' + esc(t.id) + '">' +
            '<h3>' + esc(t.termo) + '</h3>' +
            '<div class="tag">' + esc(t.extenso ? t.extenso + ' · ' : '') + esc(t.categoria) + '</div>' +
            '<p>' + Docs.inline(t.definicao) + '</p>' +
            (t.dia ? '<p class="glos-dia"><strong>No dia a dia:</strong> ' + Docs.inline(t.dia) + '</p>' : '') +
            (ver ? '<p class="tag">Veja também: ' + ver + '</p>' : '') + '</article>';
    },

    atualizar: function (destaque) {
        var self = this, s = this.estado;
        var lista = this.termos.filter(function (t) {
            if (s.cat && t.categoria !== s.cat) return false;
            if (s.letra && self.norm(t.termo).charAt(0).toUpperCase() !== s.letra) return false;
            if (s.q && !self.norm(t.termo + ' ' + (t.extenso || '') + ' ' + t.definicao + ' ' + (t.dia || '')).includes(s.q)) return false;
            return true;
        });
        if (destaque && !lista.some(function (t) { return t.id === destaque; })) lista = this.termos.slice();
        document.querySelectorAll('.glos-chip').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === s.cat); });
        document.querySelectorAll('.glos-letra').forEach(function (b) { b.classList.toggle('active', b.dataset.letra === s.letra); });
        document.getElementById('glosInfo').textContent = (s.q || s.cat || s.letra) ? (lista.length ? lista.length + ' termo(s)' : '') : '';
        document.getElementById('glosLista').innerHTML = lista.length ? lista.map(function (t) { return self.cartao(t); }).join('') : '<p class="vazio">Nada encontrado.</p>';
        if (destaque) {
            var c = document.getElementById('glos-' + destaque);
            if (c) { c.classList.add('glos-alvo'); c.scrollIntoView({ block: 'center' }); }
        }
    }
};