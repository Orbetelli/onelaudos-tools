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

const rotas = {
  home: () => Home.render(app),
  guia: () => Guia.render(app),
  senhas: () => Senha.render(app),
  assinatura: () => Assinatura.render(app),
  portal: () => Portal.render(app),
  padronizacao: () => Padronizacao.render(app),
  suporte: () => Suporte.render(app),
  instalacao: () => Docs.pagina(app, 'Tutoriais de instalação', 'instalacao.json'),
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
  const nome = (location.hash.replace('#/','') || 'home');
  try { Promise.resolve((rotas[nome] || rotas.home)()).catch(mostrarErro); }
  catch (e) { mostrarErro(e); }
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + nome));
}
window.addEventListener('hashchange', navegar);
navegar();