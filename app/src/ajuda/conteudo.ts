/**
 * Texto da Ajuda, dos Primeiros passos, do Tutorial guiado e dos guias em PDF (treinador e aluno).
 * Só dados, sem imports: o app e o `scripts/guias/gerar.mjs` leem o mesmo arquivo, então o PDF nunca diverge da tela.
 * Descreve o uso do app; não orienta nada sobre saúde, suplementos ou protocolos.
 */
export type Publico = 'treinador' | 'aluno';

export interface PassoGuia {
  titulo: string;
  texto: string;
  /** Tela onde o passo acontece; vira o botão "Abrir esta tela". */
  rota?: string;
}

export interface SecaoGuia {
  titulo: string;
  itens: { titulo: string; texto: string }[];
}

export interface Guia {
  titulo: string;
  arquivoPdf: string;
  introducao: string;
  primeirosPassos: PassoGuia[];
  tutorial: PassoGuia[];
  secoes: SecaoGuia[];
  perguntas: { pergunta: string; resposta: string }[];
}

const TREINADOR: Guia = {
  titulo: 'Guia do treinador',
  arquivoPdf: 'guia-treinador.pdf',
  introducao:
    'Aqui você cadastra os alunos, monta treino, dieta e mobilidade em pastas por período e acompanha as cargas que eles registram. Cada consultoria é isolada: você só vê os dados da sua.',
  primeirosPassos: [
    { titulo: 'Cadastre o primeiro aluno', texto: 'Em Alunos, toque em Novo aluno e preencha nome e e-mail. O ciclo de atualização (em dias) define o período sugerido das pastas.', rota: '/treinador/alunos' },
    { titulo: 'Convide o aluno para o app', texto: 'Na ficha do aluno, no cartão Acesso ao app, toque em Gerar convite e envie o código ou o link. O aluno cria a senha por ele.' },
    { titulo: 'Crie a pasta do período', texto: 'Na ficha, em Pastas de plano, toque em Nova pasta. A pasta junta treino, dieta e mobilidade e dá o período a todos.' },
    { titulo: 'Monte e publique o treino', texto: 'Abra a pasta, crie o plano de treino, adicione exercícios da biblioteca e toque em Publicar. O que foi publicado não muda: editar cria uma versão nova.' },
    { titulo: 'Acompanhe os registros', texto: 'Na pasta, o cartão Registros e cargas mostra o que o aluno fez, por divisão ou por dia. Dá para baixar o PDF das cargas.' },
  ],
  tutorial: [
    { titulo: 'Bem-vindo', texto: 'Este tutorial passa pelas telas principais na ordem em que você vai usá-las. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Menu e barra de topo', texto: 'No computador o menu fica à esquerda (dá para minimizar) e a barra de topo traz a busca "O que você deseja fazer?" (atalho Ctrl+K), o botão Todas as telas, onde dá para marcar favoritas, e o seu usuário. No celular, a barra de baixo tem Início, Alunos, Biblioteca, Planejamento e Perfil; Marca, Equipe e Auditoria ficam nos atalhos do Perfil. Só aparece o que o seu perfil permite.', rota: '/treinador' },
    { titulo: 'Alunos', texto: 'Lista os alunos da consultoria, com busca e o filtro "Meus alunos". Toque em um aluno para abrir a ficha.', rota: '/treinador/alunos' },
    { titulo: 'Ficha do aluno', texto: 'Reúne dados, acesso ao app, lesões, pastas de plano, progresso por exercício e peso. Atualizações do aluno ficam dentro de cada pasta.', rota: '/treinador/alunos' },
    { titulo: 'Pastas de plano', texto: 'Cada pasta tem período e agrupa treino, dieta e mobilidade. Use o filtro Todas, Ativas ou Concluídas para achar uma pasta. Finalize a pasta ao fim do ciclo e replique para o próximo.' },
    { titulo: 'Editores de plano', texto: 'Nada é salvo sozinho: toque em Salvar rascunho (Validar e Publicar também salvam antes). Se sair com alterações não salvas, o app pergunta antes. Plano publicado é imutável.' },
    { titulo: 'Biblioteca', texto: 'Exercícios (com filtro por grupo muscular), alimentos, suplementos, catálogo público e importação por CSV. A aba Medicação e ergogênicos só aparece para quem tem a permissão.', rota: '/treinador/biblioteca' },
    { titulo: 'Planejamento', texto: 'Modelos reutilizáveis de treino, dieta e mobilidade, e pacotes de pasta inteira. Aplique o modelo a um aluno quando quiser. A aba Atualização guarda os questionários que o aluno responde ao fim de cada período.', rota: '/treinador/planejamento' },
    { titulo: 'Marca, Equipe e Auditoria', texto: 'Marca (cor, fonte e logo) aparece só a quem tem permissão para alterá-la. Equipe gerencia perfis e permissões; Auditoria lista o que foi feito. Aparecem conforme o seu perfil, no menu lateral do computador e nos atalhos do Perfil no celular.' },
    { titulo: 'Seu usuário e Ajuda', texto: 'No cartão com o seu nome (canto superior direito; no celular, em Perfil) ficam Meus dados (nome, telefone e senha), Minha conta (plano, cobranças e consumo; só aparece para quem tem permissão), Ajustes (tema claro/escuro e tamanho do texto) e Sair. Esta Ajuda fica sempre à mão.', rota: '/treinador/ajustes' },
  ],
  secoes: [
    {
      titulo: 'Alunos',
      itens: [
        { titulo: 'Cadastrar e editar', texto: 'Novo aluno pede nome e e-mail. Objetivo e observações são dados sensíveis: só aparecem para quem tem permissão.' },
        { titulo: 'Convite de acesso', texto: 'O convite tem código e link, vale por tempo limitado e só pode ser usado uma vez. Copie o código antes de sair da tela: ele não aparece de novo. Gerar outro invalida o anterior.' },
        { titulo: 'Inativar', texto: 'Inativar tira o aluno do app na hora; planos e registros ficam guardados e dá para reativar.' },
        { titulo: 'Lesões e peso', texto: 'Ficam na ficha, só para quem pode ver dados sensíveis. O app apenas guarda o que você registra.' },
      ],
    },
    {
      titulo: 'Pastas de plano',
      itens: [
        { titulo: 'Período', texto: 'O período da pasta vale para todos os planos dela. Mudar a pasta altera só os rascunhos.' },
        { titulo: 'Finalizar e reabrir', texto: 'Finalizar dá a pasta como concluída e pode registrar o peso do aluno. Dá para reabrir depois.' },
        { titulo: 'Replicar', texto: 'Cria uma pasta nova com cópia dos planos publicados, como rascunhos, para o próximo ciclo.' },
        { titulo: 'Filtro', texto: 'Escolha Todas, Ativas ou Concluídas acima da lista de pastas.' },
      ],
    },
    {
      titulo: 'Treino, dieta e mobilidade',
      itens: [
        { titulo: 'Rascunho e publicação', texto: 'Edições vão para o rascunho. Publicar valida e cria uma versão imutável; os registros do aluno apontam para a versão que ele executou.' },
        { titulo: 'Validação', texto: 'Erros impedem a publicação. Avisos pedem confirmação. Cada problema indica onde está no plano.' },
        { titulo: 'PDF', texto: 'Treino e dieta podem ser exportados em PDF para imprimir ou compartilhar.' },
        { titulo: 'Suplementação da dieta', texto: 'Na dieta, "Escolher da biblioteca" traz o nome e o link do produto; dose, horário e observação quem escreve é você. O link abre fora do app.' },
        { titulo: 'Medicação e ergogênicos', texto: 'Na dieta, o cartão só aparece para quem tem a permissão. Da biblioteca vêm só nome, princípio ativo e concentração; dose, horário e prescrição são texto seu. O sistema não sugere, não calcula nem compara. Modelos de dieta nunca levam esta lista, e quem não tem a permissão não a vê nem a apaga ao salvar.' },
        { titulo: 'Modelos', texto: 'Salve um plano como modelo ou aplique um modelo ao aluno em Planejamento.' },
      ],
    },
    {
      titulo: 'Registros e cargas',
      itens: [
        { titulo: 'Por divisão e por dia', texto: 'As duas visões têm um botão para minimizar cada divisão ou cada dia, para achar o que procura mais rápido.' },
        { titulo: 'Progresso por exercício', texto: 'Fica na ficha do aluno, fora das pastas, e soma o histórico de todas elas. Toque em "Escolher exercícios", busque pelo nome, filtre pelo grupo muscular e marque até 10 de uma vez. Cada um vira um bloco com o primeiro e o último registro, o gráfico da carga e as 5 datas mais recentes (com "Ver todos os registros"). O × tira o exercício da comparação sem apagar nada.' },
        { titulo: 'PDF das cargas', texto: 'Gera o relatório de cargas do período da pasta. Dado ausente aparece como "—", nunca como zero.' },
      ],
    },
    {
      titulo: 'Atualização do aluno',
      itens: [
        { titulo: 'Onde fica', texto: 'Dentro de cada pasta, ao fim do período. O aluno responde e envia; você revisa e escreve o retorno.' },
        { titulo: 'Atraso', texto: 'O aluno pode avisar que vai atrasar. Isso só avisa; não bloqueia nada.' },
        { titulo: 'Questionário', texto: 'Cada consultoria monta os próprios questionários em Planejamento, na aba Atualização: edite o rascunho, confira na Prévia e toque em Publicar. Um deles é o padrão da consultoria. Na ficha do aluno você escolhe o questionário dele ("Padrão da consultoria" usa o padrão) e, na pasta aberta, o questionário só daquele período ("O do aluno" usa o escolhido na ficha). Quem não é mais usado se arquiva; um que já foi respondido não se exclui.' },
      ],
    },
    {
      titulo: 'Consultoria',
      itens: [
        { titulo: 'Marca', texto: 'Cor, fonte do nome, tema padrão dos alunos e logo. Só quem tem a permissão de marca altera.' },
        { titulo: 'Equipe', texto: 'Cada membro tem um perfil com permissões. Ninguém concede mais do que tem.' },
        { titulo: 'Auditoria', texto: 'Lista ações importantes por pessoa e período, guardadas por um ano.' },
        { titulo: 'Tema claro/escuro', texto: 'Qualquer pessoa troca em Ajustes (menu do seu nome, no topo; no celular, em Perfil). Vale só para o seu usuário.' },
      ],
    },
  ],
  perguntas: [
    { pergunta: 'Editei um plano e o aluno ainda vê o antigo.', resposta: 'O aluno só vê o que está publicado. Toque em Publicar para gerar a versão nova.' },
    { pergunta: 'Se eu mudar o treino de um aluno, o modelo muda?', resposta: 'Não. Aplicar um modelo cria uma cópia só daquele aluno. Mudar a cópia não altera o modelo, e mudar o modelo não altera quem já recebeu.' },
    { pergunta: 'Não vejo o menu Marca.', resposta: 'Marca aparece só para quem tem permissão de alterar a marca da consultoria. No celular, fica em Perfil, nos atalhos. Peça a um administrador.' },
    { pergunta: 'O aluno não consegue entrar.', resposta: 'Gere um convite novo na ficha dele (cartão Acesso ao app) e confirme que o aluno está ativo.' },
    { pergunta: 'Aparece "Alterado em outra aba" no plano.', resposta: 'O mesmo plano foi alterado em outro lugar. Use a opção de recarregar, confira o que mudou e edite de novo.' },
    { pergunta: 'Mudei o questionário; e quem já respondeu?', resposta: 'Quem já enviou mantém a versão que respondeu. Quem ainda não enviou passa a ver a versão nova assim que você publica, e as respostas já digitadas que continuam valendo são mantidas. Um questionário que já foi respondido não se exclui: arquive.' },
    { pergunta: 'Por que há um traço "—" nas cargas?', resposta: 'O aluno não informou o valor. O app nunca inventa carga nem repetição.' },
  ],
};

const ALUNO: Guia = {
  titulo: 'Guia do aluno',
  arquivoPdf: 'guia-aluno.pdf',
  introducao:
    'Aqui você vê o treino e a dieta que o seu treinador montou e registra a carga e as repetições de cada série. Funciona também sem internet: o que você marca fica no aparelho e é enviado depois.',
  primeirosPassos: [
    { titulo: 'Entre com o convite', texto: 'Use o código ou o link que o treinador enviou, crie a sua senha e entre.' },
    { titulo: 'Veja o treino de hoje', texto: 'Na aba Treino, o cartão Treino de hoje mostra a divisão do dia. Toque nele para começar.', rota: '/aluno' },
    { titulo: 'Registre cada série', texto: 'Em cada exercício, informe o peso e as repetições feitas e toque no botão de marcar a série.' },
    { titulo: 'Confira o histórico', texto: 'Na aba Histórico você revê o que já registrou.', rota: '/aluno/historico' },
    { titulo: 'Escolha o tema', texto: 'Em Conta, deixe o app claro ou escuro e ajuste o tamanho do texto.', rota: '/aluno/conta' },
  ],
  tutorial: [
    { titulo: 'Bem-vindo', texto: 'Este tutorial mostra as abas do app. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Treino', texto: 'Mostra o treino de hoje e as divisões do período. Os chips de data deixam registrar dias próximos (até 60 dias para trás ou para frente).', rota: '/aluno' },
    { titulo: 'Registrar uma série', texto: 'Cada exercício tem uma tela. Preencha Peso e Reps e marque a série. A carga sugerida vem do plano; o que você digita é gravado como digitou.' },
    { titulo: 'Descanso', texto: 'Quando o plano define descanso, o contador começa ao marcar a série. Ele não usa notificação com o app fechado.' },
    { titulo: 'Dieta', texto: 'Mostra as refeições publicadas pelo treinador. Só consulta.', rota: '/aluno/dieta' },
    { titulo: 'Mobilidade', texto: 'Aparece só se o treinador publicou um plano de mobilidade. Vídeos abrem fora do app.', rota: '/aluno/mobilidade' },
    { titulo: 'Histórico', texto: 'Cargas e treinos que você já fez, por divisão.', rota: '/aluno/historico' },
    { titulo: 'Atualização', texto: 'Ao fim do período o treinador pede uma atualização. Um ponto aparece na aba Treino quando houver algo a fazer.' },
    { titulo: 'Sem internet', texto: 'Pode treinar sem conexão. Em Conta você vê o que está aguardando envio e toca em Sincronizar agora.', rota: '/aluno/conta' },
    { titulo: 'Conta e Ajuda', texto: 'Em Conta ficam tema, senha e sair. Esta Ajuda fica sempre à mão.', rota: '/aluno/conta' },
  ],
  secoes: [
    {
      titulo: 'Treino',
      itens: [
        { titulo: 'Treino de hoje', texto: 'O cartão em destaque abre a divisão do dia.' },
        { titulo: 'Trocar de plano', texto: 'Se houver mais de uma pasta, o seletor no topo mostra as outras. Pasta antiga é só para consultar.' },
        { titulo: 'Peso e repetições', texto: 'Deixe em branco o que não souber: aparece "—". O app não presume valor.' },
        { titulo: 'Vídeos', texto: 'O link do vídeo abre fora do app, no navegador ou aplicativo de vídeo.' },
        { titulo: 'PDF do treino', texto: 'Baixe o treino em PDF na aba Treino.' },
      ],
    },
    {
      titulo: 'Dieta e mobilidade',
      itens: [
        { titulo: 'Dieta', texto: 'Mostra o que foi publicado pelo treinador, refeição por refeição.' },
        { titulo: 'Mobilidade', texto: 'Aba só de consulta, visível quando existe plano publicado.' },
      ],
    },
    {
      titulo: 'Sem internet',
      itens: [
        { titulo: 'Registro no aparelho', texto: 'Cada série marcada é gravada na hora no aparelho.' },
        { titulo: 'Envio', texto: 'Com conexão, o app envia sozinho. Reenviar não duplica o registro.' },
        { titulo: 'Antes de sair da conta', texto: 'Sincronize antes: registros não enviados são apagados do aparelho ao sair.' },
      ],
    },
    {
      titulo: 'Atualização',
      itens: [
        { titulo: 'Responder', texto: 'Abra a atualização, responda e envie. O peso informado entra no seu histórico.' },
        { titulo: 'Vou atrasar', texto: 'Se precisar de mais tempo, avise pelo botão. Isso só avisa o treinador.' },
        { titulo: 'Lembretes', texto: 'No celular, o app lembra 3 dias antes, no dia e 1 dia depois, às 9h. Na web, só aparece um cartão.' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { titulo: 'Tema e texto', texto: 'Claro, escuro ou do sistema; tamanho do texto, contraste, animações e vibração.' },
        { titulo: 'Senha', texto: 'Trocar a senha encerra as outras sessões.' },
      ],
    },
  ],
  perguntas: [
    { pergunta: 'Marquei a série e não aparece para o treinador.', resposta: 'Pode estar aguardando envio. Abra Conta e toque em Sincronizar agora com internet.' },
    { pergunta: 'Não vejo o treino novo.', resposta: 'O treinador precisa ter publicado o plano. Confirme com ele e abra o app com internet.' },
    { pergunta: 'Esqueci a senha.', resposta: 'Fale com o seu treinador.' },
    { pergunta: 'Errei a carga de uma série.', resposta: 'Abra o exercício e altere o valor no campo da série: o registro é atualizado.' },
    { pergunta: 'Por que não tem aba Mobilidade?', resposta: 'Ela só aparece quando o treinador publica um plano de mobilidade.' },
  ],
};

export const GUIAS: Record<Publico, Guia> = { treinador: TREINADOR, aluno: ALUNO };
