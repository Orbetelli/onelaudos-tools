// ========================================
// INÍCIO — painel com todas as seções e o que cada uma faz
// Para incluir uma nova aba aqui: adicione um item em Home.grupos
// ========================================
const Home = {
    grupos: [
        { titulo: 'Atendimento', itens: [
            { rota: 'guia', icone: '📘', titulo: 'Guia rápido',
              descricao: 'Triagem do Suporte Médico: o que fazer em cada situação, quem acionar e como priorizar os chamados.',
              topicos: ['Exames não sobem', 'Troca de senha', 'Falha no login', 'Quem acionar?'], pronto: true },
            { rota: 'suporte', icone: '🧭', titulo: 'Sup 1 e Sup 2',
              descricao: 'Como o atendimento se divide: o que o Nível 1 resolve dentro do portal e o que sobe para o Nível 2 (T.I. e Mobile).',
              topicos: ['Nível 1', 'Nível 2', 'Qual nível?', 'Antes de escalar'], pronto: true }
        ]},
        { titulo: 'Ferramentas', itens: [
            { rota: 'senhas', icone: '🔑', titulo: 'Gerador de senhas',
              descricao: 'Cria senhas temporárias no padrão Onelaudos, uma a uma ou em lote, já com a mensagem de boas-vindas pronta para enviar.',
              topicos: ['Geral e implantação', 'Importar CSV/Excel', 'Exportar', 'Mensagem pronta'], pronto: true },
            { rota: 'assinatura', icone: '✍️', titulo: 'Gerador de assinatura',
              descricao: 'Monta a assinatura do médico a partir de uma imagem: remove o fundo, ajusta o contraste e acrescenta nome, registro e RQE.',
              topicos: ['Remover fundo', 'Assinatura dupla', 'Arrastar para posicionar', 'Baixar PNG'], pronto: true }
        ]},
        { titulo: 'Documentação', itens: [
            { rota: 'portal', icone: '🖥️', titulo: 'Portal (tutorial)',
              descricao: 'Tutorial do portal Onelaudos: permissões de usuário e o que cada uma faz, mais vídeos tutoriais da playlist de Técnicos. Novos tópicos em breve.',
              topicos: ['Permissões', 'Vídeos de Técnico', 'Mobile Router', 'Filtros'], pronto: false },
            { rota: 'padronizacao', icone: '📐', titulo: 'Padronização',
              descricao: 'Procedimentos operacionais padronizados: cadastro de usuários, cabeçalho e rodapé e alteração de senha.',
              topicos: ['Cadastro de usuários', 'Cabeçalho e rodapé', 'Alteração de senha', 'Checklist'], pronto: true },
            { rota: 'instalacao', icone: '🛠️', titulo: 'Instalação',
              descricao: 'Tutoriais passo a passo de instalação: MobileRouter, SQL Server e Worklist (instalação e configuração), com comandos prontos para copiar.',
              topicos: ['MobileRouter', 'SQL Server', 'Worklist', 'Configuração'], pronto: false },
            { rota: 'downloads', icone: '📥', titulo: 'Downloads',
              descricao: 'Documentos e tutoriais em arquivo para baixar, como PDFs e arquivos do Word.',
              topicos: ['Guias', 'Tutoriais'], pronto: true }
        ]}
    ],

    render: function (el) {
        var esc = Docs.esc.bind(Docs);
        var html = '<h1>Onelaudos <span class="home-acc">Tools</span></h1>' +
            '<p class="home-sub">Ferramentas e documentação para a equipe de suporte. Escolha uma seção abaixo.</p>';
        this.grupos.forEach(function (g) {
            html += '<h2 class="home-grupo">' + esc(g.titulo) + '</h2><div class="home-grid">';
            g.itens.forEach(function (i) {
                html += '<a class="home-card" href="#/' + esc(i.rota) + '">' +
                    '<div class="home-topo"><span class="home-ico">' + i.icone + '</span>' +
                    (i.pronto ? '' : '<span class="home-badge">Em construção</span>') + '</div>' +
                    '<strong>' + esc(i.titulo) + '</strong>' +
                    '<p>' + esc(i.descricao) + '</p>' +
                    '<div class="home-tags">' + i.topicos.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
                    '</a>';
            });
            html += '</div>';
        });
        el.innerHTML = html;
    }
};