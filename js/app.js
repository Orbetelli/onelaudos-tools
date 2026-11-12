const app = document.getElementById('app');

async function downloads(){
  app.innerHTML = '<h1>Downloads</h1><input type="search" id="q" placeholder="Buscar documento..."><div id="res"></div>';
  const res = app.querySelector('#res');
  let lista = [];
  try { lista = await Docs.load('downloads/manifest.json'); } catch(e){ res.innerHTML = `<p class="vazio">${Docs.esc(e.message)}</p>`; return; }
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const mostrar = q => {
    const f = lista.filter(d => !q || norm(d.titulo + ' ' + d.categoria).includes(q));
    res.innerHTML = f.length ? f.map(d => `<div class="card"><h3>${Docs.esc(d.titulo)}</h3><div class="tag">${Docs.esc(d.categoria)}</div><p><a class="btn" href="downloads/${encodeURIComponent(d.arquivo)}" download>Baixar ${Docs.esc(d.arquivo.split('.').pop().toUpperCase())}</a></p></div>`).join('') : '<p class="vazio">Nada encontrado.</p>';
  };
  mostrar('');
  app.querySelector('#q').addEventListener('input', e => mostrar(norm(e.target.value.trim())));
}

// Cada rota recebe "param": o que vem depois da rota no endereço (ex.: #/guia/internet-conexao abre essa seção)
const rotas = {
  home: () => Home.render(app),
  guia: p => Guia.render(app, p),
  senhas: () => Senha.render(app),
  assinatura: () => Assinatura.render(app),
  portal: p => Portal.render(app, p),
  padronizacao: p => Padronizacao.render(app, p),
  suporte: () => Suporte.render(app),
  instalacao: p => Instalacao.render(app, p),
  diagnostico: p => Diagnostico.render(app, p),
  glossario: p => Glossario.render(app, p),
  busca: p => Busca.render(app, p),
  downloads
};

// Em vez de deixar a página em branco, mostra o que deu errado
function mostrarErro(e){
  console.error(e);
  app.textContent = '';
  const h = document.createElement('h1'); h.textContent = 'Erro ao abrir a página';
  const p = document.createElement('p'); p.className = 'vazio'; p.textContent = (e && e.message) ? e.message : String(e);
  const t = document.createElement('p'); t.className = 'tag';
  t.textContent = 'Confira se os arquivos estão nas pastas certas (js/, content/, css/) e atualize com Ctrl+Shift+R. Detalhes no console (F12).';
  app.append(h, p, t);
}

function navegar(){
  const partes = location.hash.replace('#/','').split('/');
  const nome = partes[0] || 'home';
  let param = partes.slice(1).join('/');
  try { param = decodeURIComponent(param); } catch (e) {}
  try { Promise.resolve((rotas[nome] || rotas.home)(param)).catch(mostrarErro); }
  catch (e) { mostrarErro(e); }
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + nome));
  // caixa de busca do menu: acompanha a busca aberta e limpa ao sair dela
  const cx = document.getElementById('buscaGlobal');
  if (cx && document.activeElement !== cx) cx.value = (nome === 'busca') ? param : '';
}
window.addEventListener('hashchange', navegar);

// ---- Caixa de busca global (menu lateral) ----
(function(){
  const cx = document.getElementById('buscaGlobal');
  if (!cx) return;
  let t;
  const ir = () => {
    const q = cx.value.trim();
    const alvo = q ? '#/busca/' + encodeURIComponent(q) : '#/busca';
    if (location.hash.indexOf('#/busca') === 0) location.replace(alvo); // já estava na busca: não enche o histórico
    else location.hash = alvo;
  };
  cx.addEventListener('input', () => { clearTimeout(t); t = setTimeout(ir, 250); });
  cx.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(t); ir(); }
    if (e.key === 'Escape') { cx.value = ''; cx.blur(); }
  });
  // tecla "/" foca a busca (fora de campos de digitação)
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement, tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    e.preventDefault(); cx.focus(); cx.select();
  });
})();

navegar();