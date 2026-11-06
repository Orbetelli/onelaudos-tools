// Renderizador de conteúdo: carrega arquivos JSON e monta páginas com busca (search-first)
// Blocos: texto, subtitulo, lista, passos, aviso, checklist, link, tabela, contato, destaque, comando, imagem
const Docs = {
  esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  // Escapa primeiro e só depois aplica **negrito** (não abre brecha para HTML)
  inline(s){ return this.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); },
  async load(caminho){
    const r = await fetch(caminho);
    if(!r.ok) throw new Error('Não foi possível carregar ' + caminho);
    return r.json();
  },
  lista(itens){ return `<ul>${itens.map(i => `<li>${this.inline(i)}</li>`).join('')}</ul>`; },
  bloco(b){
    switch(b.tipo){
      case 'texto': return `<p>${this.inline(b.conteudo)}</p>`;
      case 'subtitulo': return `<h4>${this.esc(b.conteudo)}</h4>`;
      case 'lista': return this.lista(b.itens);
      case 'passos': return `<ol>${b.itens.map(i=>`<li>${this.inline(i)}</li>`).join('')}</ol>`;
      case 'aviso': {
        const rot = { importante: 'Importante', atencao: 'Atenção', observacao: 'Observação', seguranca: 'Recomendação de segurança', regra: 'Regra principal' };
        const v = rot[b.variante] ? b.variante : '';
        return `<div class="aviso${v ? ' aviso-' + v : ''}">${v ? '<strong>' + rot[v] + ':</strong> ' : ''}${this.inline(b.conteudo)}</div>`;
      }
      case 'checklist': return `<ul class="checklist">${b.itens.map(i => `<li><label><input type="checkbox"><span>${this.inline(i)}</span></label></li>`).join('')}</ul>`;
      case 'link': return /^(#\/|https:\/\/|downloads\/)/.test(String(b.href)) ? `<p><a class="btn sec" href="${this.esc(b.href)}">${this.esc(b.rotulo)}</a></p>` : '';
      case 'tabela': return `<div class="tabela-wrap"><table><thead><tr>${b.colunas.map(c=>`<th>${this.esc(c)}</th>`).join('')}</tr></thead><tbody>${b.linhas.map(l=>`<tr>${l.map(c=>`<td>${this.inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'contato': return `<p class="contato">${this.esc(b.rotulo)}: <a href="mailto:${this.esc(b.valor)}">${this.esc(b.valor)}</a><button type="button" class="sec mini" data-copy="${this.esc(b.valor)}">Copiar</button></p>`;
      case 'destaque': {
        const v = b.variante === 'nao-urgente' ? 'nao-urgente' : 'urgente';
        return `<div class="destaque destaque-${v}"><h4>${this.esc(b.titulo)}</h4>${(b.blocos||[]).map(x => this.bloco(x)).join('')}</div>`;
      }
      case 'comando': return `<pre class="cmd"><button class="copy sec" data-copy="${this.esc(b.conteudo)}">Copiar</button><code>${this.esc(b.conteudo)}</code></pre>`;
      case 'imagem': return `<figure><img src="${this.esc(b.src)}" style="max-width:100%"><figcaption class="tag">${this.esc(b.legenda||'')}</figcaption></figure>`;
      default: return '';
    }
  },
  async pagina(el, titulo, arquivo){
    el.innerHTML = `<h1>${this.esc(titulo)}</h1><input type="search" id="q" placeholder="Digite para buscar..."><div id="res"><p class="vazio">Digite algo para ver os resultados.</p></div>`;
    let secoes = [];
    const res = el.querySelector('#res');
    try { secoes = await this.load('content/' + arquivo); } catch(e){ res.innerHTML = `<p class="vazio">${this.esc(e.message)}</p>`; return; }
    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    el.querySelector('#q').addEventListener('input', ev => {
      const q = norm(ev.target.value.trim());
      if(!q){ res.innerHTML = '<p class="vazio">Digite algo para ver os resultados.</p>'; return; }
      const achados = secoes.filter(s => norm(JSON.stringify(s)).includes(q));
      res.innerHTML = achados.length ? achados.map(s => `<div class="card"><h3>${this.esc(s.titulo)}</h3><div class="tag">${this.esc(s.categoria||'')}</div>${s.blocos.map(b=>this.bloco(b)).join('')}</div>`).join('') : '<p class="vazio">Nada encontrado.</p>';
    });
  }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]');
  if(b){ navigator.clipboard.writeText(b.dataset.copy); const t=b.textContent; b.textContent='Copiado!'; setTimeout(()=>b.textContent=t,1200); }
});