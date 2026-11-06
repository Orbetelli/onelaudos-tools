// Guia rápido — Suporte Médico (conteúdo em content/guia.json; componente em docpage.js)
const Guia = criarPaginaDoc({
    titulo: 'Guia rápido',
    hash: '#/guia',
    arquivo: 'content/guia.json',
    busca: 'Buscar no guia (ex.: senha, AnyDesk, urgente)...',
    download: { href: 'downloads/Guia-Rapido-Suporte-Medico.docx', rotulo: 'Baixar guia (Word)' }
});