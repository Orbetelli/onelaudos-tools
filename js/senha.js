// ========================================
// GERADOR DE SENHAS — Onelaudos Tools
// Portado do senha.js do Mobilemed Tools (nomes pw* mantidos para facilitar comparação)
// ========================================

var PW_PREFIXO_PADRAO = 'Onelaudos';
var PW_DOMINIO_PADRAO = 'mobilemed.com.br';
var PW_PORTAL = { url: 'https://onelaudos.mobilemed.com.br/login', marca: 'Onelaudos' };

// Os usuários ficam só em memória (de propósito: senhas não são gravadas no navegador)
var pwSavedUsers = [];

var PW_ICONES = {
    regen: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    save:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    copy:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38ef7d" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
};

// ── Helpers de DOM (textContent em vez de innerHTML: dispensa escape) ──
function pwEl(tag, props, children) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
        if (k === 'text') el.textContent = props[k];
        else if (k === 'class') el.className = props[k];
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), props[k]);
        else el.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { el.appendChild(c); });
    return el;
}

function pwBtnIcone(titulo, svg, fn) {
    var b = pwEl('button', { type: 'button', title: titulo, onclick: fn });
    b.innerHTML = svg; // svg estático, definido neste arquivo
    return b;
}

function pwVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function pwHoje() { return new Date().toLocaleDateString('pt-BR'); }

// Só recebe conteúdo estático (ícones/textos fixos deste arquivo)
function pwFeedback(btn, conteudo) {
    if (!btn || btn.dataset.fb) return;
    btn.dataset.fb = '1';
    var orig = btn.innerHTML;
    btn.innerHTML = conteudo;
    setTimeout(function () { btn.innerHTML = orig; delete btn.dataset.fb; }, 1500);
}

function pwCopiarTexto(texto, btn, feedback) {
    navigator.clipboard.writeText(texto).then(
        function () { pwFeedback(btn, feedback || 'Copiado!'); },
        function () { pwFeedback(btn, 'Falhou'); }
    );
}

// ── Aleatoriedade segura (crypto em vez de Math.random) ──
function pwRandInt(max) {
    var limite = Math.floor(4294967296 / max) * max; // descarta valores que causariam viés
    var buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limite);
    return buf[0] % max;
}

function pwRand(str) { return str[pwRandInt(str.length)]; }

function pwGerarSenha(len, useSpecial, upperOnly) {
    var lower = 'abcdefghijklmnopqrstuvwxyz', upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits = '0123456789', special = '@$&';
    var chars = upperOnly ? upper + digits : lower + upper + digits;
    if (useSpecial) chars += special;
    var m = [];
    if (!upperOnly) m.push(pwRand(lower));
    m.push(pwRand(upper)); m.push(pwRand(digits));
    if (useSpecial) m.push(pwRand(special));
    var rest = Math.max(len - m.length, 0);
    for (var i = 0; i < rest; i++) m.push(pwRand(chars));
    for (var k = m.length - 1; k > 0; k--) {
        var j = pwRandInt(k + 1), t = m[k]; m[k] = m[j]; m[j] = t;
    }
    return m.join('');
}

function pwSenhaCompleta(cfg) { return cfg.prefix + '@' + pwGerarSenha(cfg.len, cfg.special, cfg.upper); }

function pwCfgGeral() {
    return {
        prefix:  pwVal('pwPrefix') || PW_PREFIXO_PADRAO,
        len:     parseInt(pwVal('pwLen'), 10) || 6,
        special: document.getElementById('pwSpecial').checked,
        upper:   document.getElementById('pwUpper').checked
    };
}

function pwCfgImp() {
    return {
        prefix:  pwVal('pwPrefixImp') || PW_PREFIXO_PADRAO,
        len:     parseInt(pwVal('pwLenImp'), 10) || 6,
        special: document.getElementById('pwSpecialImp').checked,
        upper:   document.getElementById('pwUpperImp').checked
    };
}

// ── Abas ──
function pwTab(nome) {
    document.querySelectorAll('.pw-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === nome); });
    document.getElementById('pwTabGeral').classList.toggle('active', nome === 'geral');
    document.getElementById('pwTabImp').classList.toggle('active', nome === 'imp');
}

// ── Atalhos de prefixo (Onelaudos / Mobile) ──
function pwSincronizarChipsPrefixo(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var grupo = input.closest('.form-group');
    if (!grupo) return;
    var valor = input.value.trim();
    grupo.querySelectorAll('.pw-prefix-chip').forEach(function (c) {
        c.classList.toggle('active', c.textContent.trim() === valor);
    });
}

function pwSetPrefix(inputId, valor) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.value = valor;
    pwSincronizarChipsPrefixo(inputId);
}

// ── Modo de e-mail (automático x manual) ──
function toggleEmailManual(on) {
    document.getElementById('pwModoAuto').style.display = on ? 'none' : 'block';
    document.getElementById('pwModoManual').style.display = on ? 'block' : 'none';
    if (on) {
        document.getElementById('pwNomeManual').value = '';
        document.getElementById('pwEmailManualInput').value = '';
    } else {
        document.getElementById('pwNomes').value = '';
        pwAtualizarContador();
    }
}

function pwParsearNomes() {
    var ta = document.getElementById('pwNomes');
    if (!ta) return [];
    return ta.value.split('\n').map(function (n) { return n.trim(); }).filter(function (n) { return n.length > 0; });
}

function pwAtualizarContador() {
    var n = pwParsearNomes().length, el = document.getElementById('pwNomeCount');
    if (el) el.textContent = n + ' nome' + (n !== 1 ? 's' : '');
}

function pwAtualizarPreview() {
    var el = document.getElementById('pwDominioPreview');
    if (el) el.textContent = pwVal('pwDominio') || PW_DOMINIO_PADRAO;
}

function pwNomeParaEmail(nome) {
    var t = nome.trim();
    if (t.includes('.')) {
        return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]/g, '');
    }
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '').trim().split(/\s+/).join('.');
}

function pwIsValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }

// ── Lista de usuários salvos ──
// modo 'senha'      → ignora se a senha já está salva (usado no Gerador Geral)
// modo 'substituir' → mesmo e-mail recebe a senha nova (usado na Implantação)
// modo 'ignorar'    → mesmo e-mail é pulado (usado na importação)
function pwAdicionarUsuario(u, modo) {
    var i = pwSavedUsers.findIndex(function (s) {
        return modo === 'senha' ? s.password === u.password : s.email.toLowerCase() === u.email.toLowerCase();
    });
    if (i === -1) { pwSavedUsers.push(u); return 'novo'; }
    if (modo === 'substituir') { pwSavedUsers[i] = u; return 'atualizado'; }
    return 'ignorado';
}

function pwRemoveUser(i) {
    pwSavedUsers.splice(i, 1);
    pwRenderUsers();
}

function pwLimparTudo() {
    if (!pwSavedUsers.length) return;
    if (!confirm('Remover todos os ' + pwSavedUsers.length + ' usuários salvos?')) return;
    pwSavedUsers = [];
    pwRenderUsers();
}

function pwRenderUsers() {
    var list = document.getElementById('pwUserList');
    if (!list) return;
    var total = pwSavedUsers.length;
    ['savedCount', 'savedCountGeral'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = total;
    });
    document.getElementById('pwModalActions').style.display = total ? 'flex' : 'none';
    document.getElementById('pwMsgSection').style.display = total ? 'block' : 'none';
    list.textContent = '';
    if (!total) { list.appendChild(pwEl('div', { class: 'pw-empty', text: 'Nenhum usuário salvo ainda.' })); return; }

    pwSavedUsers.forEach(function (u, i) {
        var info = pwEl('div', { style: 'min-width:0;flex:1;' }, [
            pwEl('div', { style: 'font-weight:600;', text: u.name }),
            pwEl('div', { class: 'uemail', text: u.email + ' · ' + u.date }),
            pwEl('div', { class: 'pw-mono', text: u.password })
        ]);
        var btnCopiar = pwEl('button', { type: 'button', class: 'sec', text: 'Copiar senha',
            onclick: function (ev) { pwCopiarTexto(u.password, ev.currentTarget, 'Copiado!'); } });
        var btnRemover = pwEl('button', { type: 'button', class: 'del-btn', text: 'Remover',
            onclick: function () { pwRemoveUser(i); } });
        list.appendChild(pwEl('div', { class: 'pw-user-item' }, [info, pwEl('div', { class: 'uactions' }, [btnCopiar, btnRemover])]));
    });
}

// ── Gerador Geral ──
function pwGerarSenhas() {
    var cfg = pwCfgGeral();
    var qty = Math.min(Math.max(parseInt(pwVal('pwQty'), 10) || 1, 1), 50);
    var list = document.getElementById('pwList');
    list.textContent = '';
    for (var i = 0; i < qty; i++) list.appendChild(pwCriarItemGeral(cfg));
}

function pwCriarItemGeral(cfg) {
    var span = pwEl('span', { text: pwSenhaCompleta(cfg) });
    return pwEl('div', { class: 'pw-password-item' }, [
        span,
        pwBtnIcone('Regerar', PW_ICONES.regen, function () { span.textContent = pwSenhaCompleta(cfg); }),
        pwBtnIcone('Salvar', PW_ICONES.save, function (ev) { pwSalvarGeral(span.textContent, ev.currentTarget); }),
        pwBtnIcone('Copiar', PW_ICONES.copy, function (ev) { pwCopiarTexto(span.textContent, ev.currentTarget, PW_ICONES.check); })
    ]);
}

function pwSalvarGeral(senha, btn) {
    pwAdicionarUsuario({
        name: pwVal('pwGeralNome') || 'Sem nome',
        email: pwVal('pwGeralEmail') || '—',
        password: senha,
        date: pwHoje()
    }, 'senha');
    pwRenderUsers();
    pwFeedback(btn, '✅');
}

// ── Gerador de Implantação (lote) ──
function pwGerarImplantacao() {
    var cfg = pwCfgImp();
    var manual = document.getElementById('pwEmailManual').checked;
    var list = document.getElementById('pwListImp');
    var pares = [], invalidos = [];

    if (manual) {
        var nome = pwVal('pwNomeManual'), email = pwVal('pwEmailManualInput');
        if (!nome || !email) { alert('Preencha o nome e o e-mail completo do usuário.'); return; }
        if (!pwIsValidEmail(email)) { alert('Digite um e-mail válido com @.'); return; }
        pares.push([nome, email]);
    } else {
        var nomes = pwParsearNomes();
        if (!nomes.length) { alert('Digite pelo menos um nome.'); return; }
        var dominio = pwVal('pwDominio') || PW_DOMINIO_PADRAO;
        nomes.forEach(function (n) {
            var e = pwNomeParaEmail(n) + '@' + dominio;
            if (pwIsValidEmail(e)) pares.push([n, e]); else invalidos.push(n);
        });
    }

    list.textContent = '';
    pares.forEach(function (p) {
        var senha = pwSenhaCompleta(cfg);
        list.appendChild(pwCriarItemImp(p[0], p[1], senha));
        pwAdicionarUsuario({ name: p[0], email: p[1], password: senha, date: pwHoje() }, 'substituir');
    });
    pwRenderUsers();
    if (invalidos.length) alert('Não consegui montar um e-mail válido para:\n' + invalidos.join('\n'));
}

function pwCriarItemImp(nome, email, senha) {
    var info = pwEl('div', { style: 'flex:1;min-width:0;' }, [
        pwEl('div', { class: 'tag', text: nome }),
        pwEl('div', { style: 'font-size:13px;word-break:break-all;', text: email }),
        pwEl('div', { class: 'pw-mono', text: senha })
    ]);
    return pwEl('div', { class: 'pw-password-item pw-implantacao-item' }, [
        info,
        pwBtnIcone('Copiar e-mail e senha', PW_ICONES.copy, function (ev) {
            pwCopiarTexto('Email: ' + email + ' | Senha: ' + senha, ev.currentTarget, PW_ICONES.check);
        })
    ]);
}

// ── Mensagem de boas-vindas ──
function pwGetMsgPadrao() {
    return [
        'Seja bem-vindo(a) ao nosso sistema de Telerradiologia ' + PW_PORTAL.marca + '!',
        'Seguem abaixo as informacoes necessarias para o seu primeiro acesso:',
        '',
        'Portal: ' + PW_PORTAL.url,
        'Login (e-mail): {email}',
        'Senha Temporaria: {senha}',
        '',
        'Atenciosamente,',
        'Equipe ' + PW_PORTAL.marca
    ].join('\n');
}

function pwCarregarMensagemPadrao() {
    var ed = document.getElementById('pwMensagemCustom');
    if (ed) ed.value = pwGetMsgPadrao();
}

function pwLimparMensagem() {
    var ed = document.getElementById('pwMensagemCustom');
    if (ed) ed.value = '';
}

function pwToggleMensagemEditor() {
    var ed = document.getElementById('pwMensagemEditor');
    var ic = document.getElementById('pwMsgToggleIcon');
    var aberto = ed.style.display !== 'none';
    ed.style.display = aberto ? 'none' : 'block';
    if (ic) ic.textContent = aberto ? '▼' : '▲';
}

function pwCopiarMensagem(btn) {
    if (!pwSavedUsers.length) return;
    var ed = document.getElementById('pwMensagemCustom');
    var template = ed && ed.value.trim() ? ed.value : pwGetMsgPadrao();
    var partes = pwSavedUsers.map(function (u) {
        return template.split('{nome}').join(u.name).split('{email}').join(u.email).split('{senha}').join(u.password);
    });
    pwCopiarTexto(partes.join('\n\n---\n\n'), btn, 'Copiado!');
}

function pwCopiarCredenciais(btn) {
    if (!pwSavedUsers.length) return;
    var texto = pwSavedUsers.map(function (u) { return 'Email: ' + u.email + ' | Senha: ' + u.password; }).join('\n');
    pwCopiarTexto(texto, btn, 'Copiado!');
}

// ── Exportação ──
function pwNomeArquivo(ext) {
    return 'onelaudos_usuarios_' + pwHoje().replace(/\//g, '-') + '.' + ext;
}

// Escapa aspas e neutraliza fórmulas (=, +, -, @) para o Excel não executar conteúdo de células
function pwCsvCelula(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}

function pwExportarCSV(btn) {
    if (!pwSavedUsers.length) return;
    var linhas = ['Nome,Email,Senha,Data'];
    pwSavedUsers.forEach(function (u) {
        linhas.push([u.name, u.email, u.password, u.date].map(pwCsvCelula).join(','));
    });
    var blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = pwNomeArquivo('csv');
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    pwFeedback(btn, 'Baixando!');
}

function pwExportarExcel(btn) {
    if (!pwSavedUsers.length) return;
    if (typeof XLSX === 'undefined') { alert('Biblioteca Excel ainda carregando. Tente novamente.'); return; }
    var dados = pwSavedUsers.map(function (u) { return { 'Nome': u.name, 'Email': u.email, 'Senha': u.password, 'Data': u.date }; });
    var ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, pwNomeArquivo('xlsx'));
    pwFeedback(btn, 'Baixando!');
}

// ── Importação CSV / Excel ──
function pwNormalizeStr(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

var PW_NAME_KEYS  = ['nome completo', 'nome', 'name', 'colaborador', 'funcionario', 'usuario', 'user', 'medico', 'responsavel'];
var PW_EMAIL_KEYS = ['e-mail', 'email', 'mail', 'correio', 'login'];

function pwFindColumn(headers, keywords) {
    var norm = headers.map(pwNormalizeStr);
    for (var k = 0; k < keywords.length; k++)
        for (var i = 0; i < norm.length; i++) if (norm[i] === keywords[k]) return i;        // exato primeiro
    for (var k2 = 0; k2 < keywords.length; k2++)
        for (var i2 = 0; i2 < norm.length; i2++) if (norm[i2].includes(keywords[k2])) return i2; // depois parcial
    return -1;
}

// Divide uma linha respeitando aspas e MANTENDO campos vazios (a regex antiga descartava e deslocava colunas)
function pwSplitLinhaCSV(linha, sep) {
    var campos = [], atual = '', aspas = false;
    for (var i = 0; i < linha.length; i++) {
        var c = linha[i];
        if (aspas) {
            if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
            else if (c === '"') aspas = false;
            else atual += c;
        } else if (c === '"') aspas = true;
        else if (c === sep) { campos.push(atual); atual = ''; }
        else atual += c;
    }
    campos.push(atual);
    return campos.map(function (v) { return v.trim(); });
}

var PW_ERRO_COLUNA = 'Não encontrei uma coluna de E-mail no arquivo. Colunas aceitas: Nome, Email, E-mail, Login, Usuário.';

// linhas: array de arrays (primeira linha = cabeçalho). Serve para CSV e Excel.
function pwLinhasParaUsuarios(linhas) {
    if (linhas.length < 2) return [];
    var iNome = pwFindColumn(linhas[0], PW_NAME_KEYS);
    var iEmail = pwFindColumn(linhas[0], PW_EMAIL_KEYS);
    if (iEmail === -1) throw new Error(PW_ERRO_COLUNA);
    var cfg = pwCfgImp(), vistos = {};
    return linhas.slice(1).map(function (cols) {
        var email = String(cols[iEmail] == null ? '' : cols[iEmail]).trim();
        if (!pwIsValidEmail(email)) return null;
        var chave = email.toLowerCase();
        if (vistos[chave]) return null; // duplicado dentro do próprio arquivo
        vistos[chave] = true;
        var nome = iNome >= 0 ? String(cols[iNome] == null ? '' : cols[iNome]).trim() : '';
        return { name: nome || 'Importado', email: email, password: pwSenhaCompleta(cfg), date: pwHoje() };
    }).filter(Boolean);
}

function pwParsearCSV(texto) {
    texto = texto.replace(/^\uFEFF/, '');
    var linhas = texto.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (linhas.length < 2) return [];
    var sep = (linhas[0].split(';').length > linhas[0].split(',').length) ? ';' : ',';
    return pwLinhasParaUsuarios(linhas.map(function (l) { return pwSplitLinhaCSV(l, sep); }));
}

function pwImportarArquivo(input) {
    var file = input.files[0]; if (!file) return;
    var info = document.getElementById('pwImportInfo');
    var ext = file.name.split('.').pop().toLowerCase();
    info.textContent = 'Lendo arquivo...';
    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var usuarios = [];
            if (ext === 'csv') {
                usuarios = pwParsearCSV(e.target.result);
            } else if (ext === 'xlsx' || ext === 'xls') {
                if (typeof XLSX === 'undefined') { info.textContent = 'Biblioteca Excel ainda carregando. Tente novamente em instantes.'; return; }
                var wb = XLSX.read(e.target.result, { type: 'array' });
                var linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
                usuarios = pwLinhasParaUsuarios(linhas);
            } else {
                info.textContent = 'Formato não suportado. Use .csv, .xlsx ou .xls.';
                return;
            }
            if (!usuarios.length) { info.textContent = 'Nenhum e-mail válido encontrado no arquivo.'; return; }
            var add = 0, dup = 0;
            usuarios.forEach(function (u) { if (pwAdicionarUsuario(u, 'ignorar') === 'novo') add++; else dup++; });
            pwRenderUsers();
            info.textContent = add + ' usuário(s) importado(s) com senha gerada!' +
                (dup ? ' (' + dup + ' já existiam e foram ignorados)' : '');
            setTimeout(function () { info.textContent = ''; }, 5000);
        } catch (err) {
            info.textContent = err.message || 'Erro ao ler o arquivo.';
        }
        input.value = '';
    };
    reader.onerror = function () { info.textContent = 'Não foi possível ler o arquivo.'; };
    if (ext === 'csv') reader.readAsText(file, 'UTF-8'); else reader.readAsArrayBuffer(file);
}

// ── Tela ──
var PW_MARKUP = `
<h1>Gerador de senhas</h1>
<div class="pw-tabs">
  <button type="button" class="pw-tab active" data-tab="geral" onclick="pwTab('geral')">Geral</button>
  <button type="button" class="pw-tab" data-tab="imp" onclick="pwTab('imp')">Implantação</button>
</div>

<section id="pwTabGeral" class="pw-panel active">
  <div class="card">
    <div class="pw-grid">
      <div class="form-group">
        <label for="pwPrefix">Prefixo</label>
        <input type="text" id="pwPrefix" value="Onelaudos">
        <div class="pw-chips">
          <button type="button" class="pw-prefix-chip" onclick="pwSetPrefix('pwPrefix','Onelaudos')">Onelaudos</button>
          <button type="button" class="pw-prefix-chip" onclick="pwSetPrefix('pwPrefix','Mobile')">Mobile</button>
        </div>
      </div>
      <div class="form-group"><label for="pwQty">Quantidade</label><input type="number" id="pwQty" value="5" min="1" max="50"></div>
      <div class="form-group"><label for="pwLen">Tamanho</label><input type="number" id="pwLen" value="6" min="4" max="32"></div>
    </div>
    <label class="pw-check"><input type="checkbox" id="pwSpecial" checked> Caracteres especiais (@ $ &amp;)</label>
    <label class="pw-check"><input type="checkbox" id="pwUpper"> Somente maiúsculas e números</label>
    <div class="pw-grid" style="margin-top:12px">
      <div class="form-group"><label for="pwGeralNome">Nome (opcional, para salvar)</label><input type="text" id="pwGeralNome"></div>
      <div class="form-group"><label for="pwGeralEmail">E-mail (opcional, para salvar)</label><input type="text" id="pwGeralEmail"></div>
    </div>
    <button type="button" onclick="pwGerarSenhas()">Gerar senhas</button>
  </div>
  <div id="pwList"></div>
  <p class="tag">Salvos: <span id="savedCountGeral">0</span></p>
</section>

<section id="pwTabImp" class="pw-panel">
  <div class="card">
    <div class="pw-grid">
      <div class="form-group">
        <label for="pwPrefixImp">Prefixo</label>
        <input type="text" id="pwPrefixImp" value="Onelaudos">
        <div class="pw-chips">
          <button type="button" class="pw-prefix-chip" onclick="pwSetPrefix('pwPrefixImp','Onelaudos')">Onelaudos</button>
          <button type="button" class="pw-prefix-chip" onclick="pwSetPrefix('pwPrefixImp','Mobile')">Mobile</button>
        </div>
      </div>
      <div class="form-group"><label for="pwLenImp">Tamanho</label><input type="number" id="pwLenImp" value="6" min="4" max="32"></div>
    </div>
    <label class="pw-check"><input type="checkbox" id="pwSpecialImp" checked> Caracteres especiais (@ $ &amp;)</label>
    <label class="pw-check"><input type="checkbox" id="pwUpperImp"> Somente maiúsculas e números</label>
    <label class="pw-check"><input type="checkbox" id="pwEmailManual" onchange="toggleEmailManual(this.checked)"> Informar o e-mail completo manualmente</label>

    <div id="pwModoAuto" style="margin-top:12px">
      <label for="pwNomes">Nomes (um por linha) — <span id="pwNomeCount">0 nomes</span></label>
      <textarea id="pwNomes" oninput="pwAtualizarContador()" placeholder="Maria da Silva&#10;joao.souza"></textarea>
      <div class="form-group" style="margin-top:10px">
        <label for="pwDominio">Domínio do e-mail: @<span id="pwDominioPreview"></span></label>
        <input type="text" id="pwDominio" value="onelaudos.com.br" oninput="pwAtualizarPreview()">
      </div>
    </div>

    <div id="pwModoManual" style="display:none;margin-top:12px">
      <div class="pw-grid">
        <div class="form-group"><label for="pwNomeManual">Nome</label><input type="text" id="pwNomeManual"></div>
        <div class="form-group"><label for="pwEmailManualInput">E-mail completo</label><input type="text" id="pwEmailManualInput"></div>
      </div>
    </div>

    <div class="pw-actions">
      <button type="button" onclick="pwGerarImplantacao()">Gerar credenciais</button>
      <label class="btn sec" style="margin:0;cursor:pointer;color:#fff">Importar CSV/Excel
        <input type="file" accept=".csv,.xlsx,.xls" style="display:none" onchange="pwImportarArquivo(this)">
      </label>
    </div>
    <p class="tag" id="pwImportInfo"></p>
  </div>
  <div id="pwListImp"></div>
</section>

<section class="card">
  <h3>Usuários salvos (<span id="savedCount">0</span>)</h3>
  <div id="pwUserList"></div>
  <div id="pwModalActions" class="pw-actions" style="display:none">
    <button type="button" class="sec" onclick="pwCopiarCredenciais(this)">Copiar credenciais</button>
    <button type="button" class="sec" onclick="pwExportarCSV(this)">Exportar CSV</button>
    <button type="button" class="sec" onclick="pwExportarExcel(this)">Exportar Excel</button>
    <button type="button" class="sec del-btn" onclick="pwLimparTudo()">Limpar tudo</button>
  </div>
  <div id="pwMsgSection" style="display:none;margin-top:14px">
    <button type="button" class="sec" onclick="pwToggleMensagemEditor()">Mensagem de boas-vindas <span id="pwMsgToggleIcon">▼</span></button>
    <div id="pwMensagemEditor" style="display:none;margin-top:10px">
      <textarea id="pwMensagemCustom" style="min-height:190px"></textarea>
      <p class="tag">Variáveis: {nome} {email} {senha}</p>
      <div class="pw-actions">
        <button type="button" onclick="pwCopiarMensagem(this)">Copiar para todos</button>
        <button type="button" class="sec" onclick="pwCarregarMensagemPadrao()">Restaurar padrão</button>
        <button type="button" class="sec" onclick="pwLimparMensagem()">Limpar</button>
      </div>
    </div>
  </div>
</section>
`;

const Senha = {
    render: function (el) {
        el.innerHTML = PW_MARKUP;
        ['pwPrefix', 'pwPrefixImp'].forEach(function (id) {
            var input = document.getElementById(id);
            input.addEventListener('input', function () { pwSincronizarChipsPrefixo(id); });
            pwSincronizarChipsPrefixo(id);
        });
        pwCarregarMensagemPadrao();
        pwAtualizarContador();
        pwAtualizarPreview();
        pwRenderUsers(); // reexibe usuários salvos ao voltar para esta aba
    }
};