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

/** Um passo do passeio pelo menu: `alvo` = `menu:<caminho do item>`; sem alvo, o balão fica no meio da tela. */
export interface PassoPasseio {
  titulo: string;
  texto: string;
  alvo?: string;
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
  /** Passeio pelo menu no primeiro acesso (destaca item por item); dá para rever na Ajuda. */
  passeio: PassoPasseio[];
  secoes: SecaoGuia[];
  perguntas: { pergunta: string; resposta: string }[];
}

const TREINADOR: Guia = {
  titulo: 'Guia do treinador',
  arquivoPdf: 'guia-treinador.pdf',
  introducao:
    'Aqui você cadastra os alunos, monta treino, dieta e mobilidade em pastas por período e acompanha as cargas que eles registram. Cada consultoria é isolada: você só vê os dados da sua.',
  primeirosPassos: [
    { titulo: 'Cadastre o primeiro aluno', texto: 'Em Alunos, toque em Novo aluno e preencha nome e e-mail. O ciclo de atualização (em dias) define o período sugerido das pastas; vazio usa o padrão da consultoria (Marca › Acompanhamento).', rota: '/treinador/alunos' },
    { titulo: 'Convide o aluno para o app', texto: 'Na ficha do aluno, no cartão Acesso ao app, toque em Gerar convite e envie o código ou o link. O aluno cria a senha por ele.' },
    { titulo: 'Crie a pasta do período', texto: 'Na ficha, em Pastas de plano, toque em Nova pasta. A pasta junta treino, dieta e mobilidade e dá o período a todos.' },
    { titulo: 'Monte e publique o treino', texto: 'Abra a pasta, crie o plano de treino, adicione exercícios da biblioteca e toque em Publicar. O que foi publicado não muda: editar cria uma versão nova.' },
    { titulo: 'Acompanhe os registros', texto: 'Na pasta, o cartão Registros e cargas mostra o que o aluno fez, por divisão ou por dia. Dá para baixar o PDF das cargas.' },
  ],
  tutorial: [
    { titulo: 'Boas-vindas', texto: 'Este tutorial passa pelas telas principais na ordem em que você vai usá-las. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Menu e barra de topo', texto: 'No computador o menu fica à esquerda (dá para minimizar) e a barra de topo traz a busca "O que você deseja fazer?" (atalho Ctrl+K), o botão Todas as telas, onde dá para marcar favoritas, e o seu usuário. No celular, a barra de baixo tem Início, Alunos, Biblioteca, Planejamento e Perfil; Marca, Equipe e Auditoria ficam nos atalhos do Perfil. Só aparece o que o seu perfil permite.', rota: '/treinador' },
    { titulo: 'Alunos', texto: 'Lista os alunos da consultoria, com busca e o filtro "Meus alunos". Cada linha mostra a situação da atualização da pasta atual (para quem pode ver atualizações). Toque em um aluno para abrir a ficha.', rota: '/treinador/alunos' },
    { titulo: 'Ficha do aluno', texto: 'Reúne dados, acesso ao app, lesões, pastas de plano, frequência, progresso por exercício e peso. Atualizações do aluno ficam dentro de cada pasta.', rota: '/treinador/alunos' },
    { titulo: 'Pastas de plano', texto: 'Cada pasta tem período e agrupa treino, dieta e mobilidade. Use o filtro Todas, Ativas ou Concluídas para achar uma pasta. Finalize a pasta ao fim do ciclo e replique para o próximo; em Mais ações (⋯), Renovar pasta faz isso de uma vez, com o próximo período e os planos em rascunho.' },
    { titulo: 'Editores de plano', texto: 'Nada é salvo sozinho: toque em Salvar rascunho (Validar e Publicar também salvam antes). O selo do topo diz "Alterações não salvas" e, depois de salvar, "Salvo às HH:MM". Se sair com alterações não salvas, o app pergunta antes. Plano publicado é imutável.' },
    { titulo: 'Biblioteca', texto: 'Exercícios (com filtro por grupo muscular), alimentos, suplementos, catálogo público e importação por CSV. A aba Outros (medicação e ergogênicos) só aparece para quem tem a permissão; as categorias dela são você quem escreve.', rota: '/treinador/biblioteca' },
    { titulo: 'Planejamento', texto: 'Modelos reutilizáveis de treino, dieta e mobilidade, e pacotes de pasta inteira. Aplique o modelo a um aluno quando quiser. A aba Atualização guarda os questionários que o aluno responde ao fim de cada período, e a aba Anamnese, os questionários iniciais que você envia pela ficha do aluno.', rota: '/treinador/planejamento' },
    { titulo: 'Marca, Equipe e Auditoria', texto: 'Marca (cor, fonte e logo) aparece só a quem tem permissão para alterá-la. Equipe gerencia perfis e permissões; Auditoria lista o que foi feito. Aparecem conforme o seu perfil, no menu lateral do computador e nos atalhos do Perfil no celular.' },
    { titulo: 'Seu usuário e Ajuda', texto: 'No cartão com o seu nome (canto superior direito; no celular, em Perfil) ficam Meus dados (nome, telefone e senha), Segurança (verificação em duas etapas com aplicativo autenticador, códigos de recuperação), Minha conta (plano, cobranças com o botão "Pagar" nas que estão em aberto, e consumo; só aparece para quem tem permissão), Ajustes (tema claro/escuro e tamanho do texto) e Sair. Esta Ajuda fica sempre à mão.', rota: '/treinador/ajustes' },
  ],
  passeio: [
    { titulo: 'Boas-vindas', texto: 'Um passeio rápido pelo menu, item por item. Leva menos de um minuto. Dá para pular agora e rever quando quiser em Ajuda.' },
    { titulo: 'Início', texto: 'O resumo da consultoria: atualizações para revisar e alunos sem registro há alguns dias.', alvo: 'menu:/treinador' },
    { titulo: 'Alunos', texto: 'Cadastre os alunos e abra a ficha de cada um: convite para o app, pastas com treino, dieta e mobilidade, registros, peso e atualizações.', alvo: 'menu:/treinador/alunos' },
    { titulo: 'Biblioteca', texto: 'Exercícios, alimentos, suplementos e Outros (medicação e ergogênicos). Tudo o que entra nos planos sai daqui.', alvo: 'menu:/treinador/biblioteca' },
    { titulo: 'Planejamento', texto: 'Modelos de treino, dieta e mobilidade para aplicar aos alunos, e os questionários da atualização e da anamnese.', alvo: 'menu:/treinador/planejamento' },
    { titulo: 'Marca', texto: 'Cor, logo, tema e o ciclo padrão de atualização da consultoria.', alvo: 'menu:/treinador/marca' },
    { titulo: 'Equipe', texto: 'Convide quem trabalha com você e escolha o que cada perfil pode ver e fazer.', alvo: 'menu:/treinador/equipe' },
    { titulo: 'Perfil', texto: 'Seus dados, senha, ajustes de tela e os atalhos para Marca, Equipe, Ajuda e Auditoria.', alvo: 'menu:/treinador/perfil' },
    { titulo: 'Ajuda', texto: 'Guia, tutorial e perguntas frequentes. Este passeio também fica lá, para rever quando quiser.', alvo: 'menu:/treinador/ajuda' },
  ],
  secoes: [
    {
      titulo: 'Alunos',
      itens: [
        { titulo: 'Cadastrar e editar', texto: 'Novo aluno pede nome e e-mail. Objetivo e observações são dados sensíveis: só aparecem para quem tem permissão.' },
        { titulo: 'Convite de acesso', texto: 'O convite tem código e link, vale por tempo limitado e só pode ser usado uma vez. Copie o código antes de sair da tela: ele não aparece de novo. Gerar outro invalida o anterior.' },
        { titulo: 'Foto de perfil', texto: 'Quem a escolhe é o aluno, em Conta (é opcional). Ela aparece no cartão Dados da ficha para quem pode ver alunos; sem foto, aparecem as iniciais.' },
        { titulo: 'Inativar', texto: 'Inativar tira o aluno do app na hora; planos e registros ficam guardados e dá para reativar.' },
        { titulo: 'Ações em lote', texto: 'Na lista de Alunos, toque em Selecionar, marque os alunos (ou Marcar visíveis) e escolha Trocar responsável, Trocar questionário ou Desativar. Vale para até 100 alunos por vez, tudo ou nada, e cada ação pede confirmação. Desativar encerra as sessões dos alunos marcados; dá para reativar um por um na ficha.' },
        { titulo: 'Lesões e peso', texto: 'Ficam na ficha, só para quem pode ver dados sensíveis. O app apenas guarda o que você registra.' },
      ],
    },
    {
      titulo: 'Privacidade (LGPD)',
      itens: [
        { titulo: 'Termo de uso e aviso de privacidade', texto: 'No primeiro acesso, você e o aluno leem e aceitam os dois textos; sem o aceite o app não abre. Quando o texto muda, todos aceitam de novo. Dá para reler em Perfil › Termos e privacidade. Os textos atuais são rascunho e precisam de revisão jurídica.' },
        { titulo: 'Exportar os dados de um aluno', texto: 'Na ficha, em Exportar dados, o app baixa um arquivo com cadastro, planos publicados, registros, peso, lesões e atualizações. Só entra o que o seu perfil pode ver. O arquivo tem dados pessoais e de saúde: guarde com cuidado. A exportação fica na auditoria, sem o conteúdo. Só quem tem a permissão de exportar vê o botão (nos perfis prontos, o Administrador).' },
        { titulo: 'Anonimizar um aluno que saiu', texto: 'Com o aluno já inativo, Anonimizar apaga nome, e-mail, objetivo, observações, peso, lesões, respostas e feedback das atualizações, observações dos registros e a dieta, e encerra o acesso. Pastas, treinos e as cargas e repetições ficam, só para as contagens. Para confirmar, digite o nome do aluno. Não tem volta, e o cadastro anonimizado não é mais editado nem reativado.' },
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
        { titulo: 'Séries', texto: 'Em cada exercício, "Adicionar série" pergunta a técnica (simples, cluster ou rest pause) e o tipo: se forem os mesmos do último grupo, soma uma série a ele; se não, cria um grupo novo no fim (assim dá para ter uma WS simples seguida de uma WS em cluster). As setas ↑ e ↓ mudam a ordem dos grupos. O campo Descanso (em segundos) liga o contador do aluno depois de cada série. Cada exercício tem no máximo 30 séries.' },
        { titulo: 'Cluster e rest pause', texto: 'No grupo de séries, escolha a técnica. Cluster: quantos blocos, quantas repetições por bloco e a pausa entre os blocos. Rest pause: a pausa, quantas retomadas e, se quiser, as repetições de cada retomada (vazio = até a falha). O aluno lê a técnica por extenso e registra a série inteira, como as outras; se quiser, toca em "Iniciar pausa" para o cronômetro contar a pausa (nada começa sozinho).' },
        { titulo: 'Validação', texto: 'Erros impedem a publicação. Avisos pedem confirmação. Cada problema indica onde está no plano, e o botão "N problemas para publicar" leva ao primeiro.' },
        { titulo: 'PDF', texto: 'Treino, dieta e mobilidade podem ser exportados em PDF para imprimir ou compartilhar. Na mobilidade, o vídeo sai só como link.' },
        { titulo: 'Água por dia', texto: 'Na dieta, o campo "Água por dia" (em litros, de 0,1 a 20) aparece para o aluno no topo da dieta, no início do app e no PDF. É só o número que você escreve: o app não calcula meta nem pede para o aluno marcar copos. Vazio, não aparece.' },
        { titulo: 'Suplementação da dieta', texto: 'Na dieta, "Escolher da biblioteca" traz o nome e o link do produto; dose, horário e observação quem escreve é você. O link abre fora do app.' },
        { titulo: 'Medicação e ergogênicos', texto: 'Na biblioteca ficam na aba Outros, agrupados pela categoria que você escreve (opcional, como "Injetáveis"). Na dieta, o cartão só aparece para quem tem a permissão. Da biblioteca vêm só nome, princípio ativo e concentração; dose, horário e prescrição são texto seu. O sistema não sugere, não calcula nem compara. Modelos de dieta nunca levam esta lista, e quem não tem a permissão não a vê nem a apaga ao salvar.' },
        { titulo: 'Modelos', texto: 'Salve um plano como modelo ou aplique um modelo ao aluno em Planejamento.' },
        { titulo: 'Copiar para outro aluno', texto: 'No plano, "Copiar para outro aluno" cria um rascunho novo para o aluno que você escolher, numa pasta que ele já tem ou numa pasta nova (que pede a permissão de alterar pastas). A cópia leva o conteúdo da última versão publicada, ou o rascunho atual se o plano nunca foi publicado. O plano de origem não muda, e a cópia só vale para o aluno depois que você revisar e publicar. Na dieta, medicação e ergogênicos nunca são copiados. Exige poder alterar o tipo de plano e ver alunos. Fica na auditoria, sem o conteúdo.' },
      ],
    },
    {
      titulo: 'Registros e cargas',
      itens: [
        { titulo: 'Por divisão e por dia', texto: 'As duas visões têm um botão para minimizar cada divisão ou cada dia, para achar o que procura mais rápido.' },
        { titulo: 'Frequência', texto: 'Na ficha, o cartão Frequência (para quem vê registros) conta os treinos com registro do aluno: os desta semana (segunda até hoje) e os da pasta vigente, do início até hoje (ou até o fim da pasta, se ela já terminou). É só a contagem: sem meta, previsto ou porcentagem. Cada treino de um dia conta uma vez, se tiver ao menos uma série marcada como feita. Sem pasta com período aparece "—"; sem registro, "Nenhum registro". A conta é diferente do "treinos da semana" que o aluno vê no app, que usa o dia marcado no plano.' },
        { titulo: 'Progresso por exercício', texto: 'Fica na ficha do aluno, fora das pastas, e soma o histórico de todas elas. Toque em "Escolher exercícios", busque pelo nome, filtre pelo grupo muscular e marque até 10 de uma vez. Cada um vira um bloco com o primeiro e o último registro, o gráfico da carga e as 5 datas mais recentes (com "Ver todos os registros"). O × tira o exercício da comparação sem apagar nada.' },
        { titulo: 'PDF das cargas', texto: 'Gera o relatório de cargas do período da pasta. Dado ausente aparece como "—", nunca como zero.' },
      ],
    },
    {
      titulo: 'Atualização do aluno',
      itens: [
        { titulo: 'Onde fica', texto: 'Dentro de cada pasta, ao fim do período. O aluno responde e envia; você revisa e escreve o retorno.' },
        { titulo: 'Revisar em fila', texto: 'Ao abrir uma atualização pela lista (Para revisar, Atrasadas...), o botão Próxima › abre a seguinte da mesma lista. Quando acabam, o app avisa "Nada mais para revisar".' },
        { titulo: 'Atraso', texto: 'O aluno pode avisar que vai atrasar. Isso só avisa; não bloqueia nada.' }, { titulo: 'Fotos', texto: 'Se o questionário tem a pergunta Fotos, o aluno anexa até 6 fotos por pergunta. Elas são dado sensível: só quem tem acesso à atualização e aos dados sensíveis do aluno as vê, dentro da atualização e no Resumo, e nunca por link público. Sem foto aparece "—". Quando o recurso ainda não está ligado na sua consultoria, a pergunta aparece como "Fotos ainda não disponíveis" para o aluno. Na exportação do aluno entra só a lista das fotos (data e tamanho), sem as imagens; ao anonimizar, elas são apagadas.' },
        { titulo: 'Questionário', texto: 'Cada consultoria monta os próprios questionários em Planejamento, na aba Atualização: edite o rascunho, confira na Prévia e toque em Publicar. Um deles é o padrão da consultoria. Na ficha do aluno você escolhe o questionário dele ("Padrão da consultoria" usa o padrão) e, na pasta aberta, o questionário só daquele período ("O do aluno" usa o escolhido na ficha). Quem não é mais usado se arquiva; um que já foi respondido não se exclui.' },
      ],
    },
    {
      titulo: 'Anamnese',
      itens: [
        { titulo: 'Montar', texto: 'Em Planejamento, aba Anamnese, toque em Nova anamnese. Ela começa em branco: crie seções (dados, rotina, treino, alimentação) e perguntas. Além dos tipos da atualização, há Data, Telefone, E-mail, Grade (linhas e colunas, uma resposta por linha), Aceite de regras (texto e frase que o aluno marca) e Texto ou imagem (só para ler). Confira na Prévia e publique. Usar anamnese é opcional.' },
        { titulo: 'Mostrar só em alguns casos', texto: 'Numa pergunta (ou numa seção), ligue "Mostrar só conforme uma resposta anterior" e escolha uma pergunta de escolha ou de sim ou não que vem antes, e as respostas que mostram esta. Pergunta escondida não é obrigatória e a resposta dela não é enviada; nas respostas aparece como "Não se aplica".' },
        { titulo: 'Imagens', texto: 'Uma pergunta pode ter uma imagem de referência, e cada opção de escolha também (escalas, aparelhos). Use só imagens suas ou com licença de uso: você responde pelo que envia. Elas ficam guardadas sem os dados de câmera e só aparecem para a sua equipe e para o aluno que responde.' },
        { titulo: 'Enviar ao aluno', texto: 'Na ficha do aluno, no cartão Anamnese, toque em Enviar anamnese e escolha uma publicada. O aluno vê "Responda sua anamnese" no início do app e responde logado, no celular ou na web, aos poucos (o rascunho fica no aparelho). A versão enviada não muda: se você publicar outra, ela vale para os próximos envios. Só uma pode estar aguardando o aluno de cada vez.' },
        { titulo: 'Ver, revisar e dispensar', texto: 'Toque na anamnese do cartão para ver todas as perguntas com as respostas ("—" quando ficou em branco). Depois de ler, toque em Marcar como revisada. Uma que o aluno ainda não respondeu pode ser dispensada, com o motivo; fica registrado quem dispensou. As respostas são dado sensível: só quem tem acesso à anamnese e aos dados sensíveis do aluno as vê. Exportar dados leva as anamneses, e anonimizar apaga as respostas.' },
      ],
    },
    {
      titulo: 'Consultoria',
      itens: [
        { titulo: 'Marca', texto: 'Cor, fonte do nome, tema padrão dos alunos (nasce claro) e logo. Só quem tem a permissão de marca altera.' },
        { titulo: 'Ciclo de atualização padrão', texto: 'Em Marca, no cartão Acompanhamento, "Nova atualização a cada (dias)" vale para os alunos sem ciclo próprio no cadastro: sugere o fim da pasta nova e da renovação. O ciclo escrito no aluno sempre vale mais.' },
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
    { pergunta: 'O aluno pediu para apagar os dados dele.', resposta: 'Inative o aluno e, na ficha, use Anonimizar (quem tem a permissão). Se ele pedir uma cópia antes, use Exportar dados.' },
    { pergunta: 'Por que há um traço "—" nas cargas?', resposta: 'O aluno não informou o valor. O app nunca inventa carga nem repetição.' },
    { pergunta: 'Apareceu "Seu plano permite até N alunos ativos" (ou membros da equipe).', resposta: 'É o limite do plano da consultoria. Inative um aluno que não treina mais, ou veja o plano e o consumo em Minha conta (só aparece para quem tem permissão). Nada do que já existe é apagado: o limite só impede de cadastrar ou reativar além dele.' },
    { pergunta: 'Não vejo Mobilidade, Equipe ou o botão de PDF.', resposta: 'Esses recursos dependem do plano da consultoria. Quando não estão incluídos, o app esconde o botão ou mostra "Disponível em outro plano". O que já foi feito continua guardado e legível.' },
    { pergunta: 'A verificação de segurança não aparece ou não carrega.', resposta: 'Ao entrar, cadastrar a consultoria ou pedir nova senha, o app pede para confirmar que você é uma pessoa. Se não carregar, confira a internet, desligue bloqueadores de conteúdo da página e toque em Tentar de novo. Cada confirmação vale para um envio só: depois de um erro, espere a nova.' },
  ],
};

/** Explicações do aluno que aparecem em mais de um lugar (primeiros passos, tutorial e passeio pelo menu): um texto só. */
const TEXTO_TREINO_DE_HOJE = 'Na aba Treino, o cartão Treino de hoje mostra a divisão do dia. Toque nele para começar.';
const TEXTO_DIETA = 'Mostra as refeições publicadas pelo treinador e a água do dia, quando ele escreveu. Só consulta. No início do app, o cartão Dieta leva até ela.';
const TEXTO_ATUALIZACAO = 'Ao fim do período o treinador pede uma atualização. Um ponto aparece na aba Treino quando houver algo a fazer.';

const ALUNO: Guia = {
  titulo: 'Guia do aluno',
  arquivoPdf: 'guia-aluno.pdf',
  introducao:
    'Aqui você vê o treino e a dieta que o seu treinador montou e registra a carga e as repetições de cada série. Funciona também sem internet: o que você marca fica no aparelho e é enviado depois.',
  primeirosPassos: [
    { titulo: 'Entre com o convite', texto: 'Use o código ou o link que o treinador enviou, crie a sua senha e entre.' },
    { titulo: 'Veja o treino de hoje', texto: TEXTO_TREINO_DE_HOJE, rota: '/aluno' },
    { titulo: 'Registre cada série', texto: 'Em cada exercício, informe o peso e as repetições feitas e toque no botão de marcar a série.' },
    { titulo: 'Confira o histórico', texto: 'Na aba Histórico você revê o que já registrou.', rota: '/aluno/historico' },
    { titulo: 'Escolha o tema', texto: 'Em Conta, deixe o app claro ou escuro e ajuste o tamanho do texto.', rota: '/aluno/conta' },
  ],
  tutorial: [
    { titulo: 'Boas-vindas', texto: 'Este tutorial mostra as abas do app. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Treino', texto: 'Mostra o treino de hoje e as divisões do período. Os chips de data deixam registrar dias próximos (até 60 dias para trás ou para frente).', rota: '/aluno' },
    { titulo: 'Registrar uma série', texto: 'Cada exercício tem uma tela. Preencha Peso e Reps e marque a série. A carga sugerida vem do plano; o que você digita é gravado como digitou. Os botões − e + mudam o peso de passo em passo, e "Repetir a série anterior" copia peso e repetições da série de cima e já marca como feita. Embaixo, Próximo leva ao exercício seguinte; Anterior volta e Lista do dia mostra todos: dá para fazer fora de ordem. A tela fica acesa enquanto você treina.' },
    { titulo: 'Descanso', texto: 'Quando o plano define descanso, o contador começa ao marcar a série. Ele não usa notificação com o app fechado.' },
    { titulo: 'Dieta', texto: TEXTO_DIETA, rota: '/aluno/dieta' },
    { titulo: 'Mobilidade', texto: 'Aparece só se o treinador publicou um plano de mobilidade. Vídeos abrem fora do app.', rota: '/aluno/mobilidade' },
    { titulo: 'Histórico', texto: 'Cargas e treinos que você já fez, por divisão.', rota: '/aluno/historico' },
    { titulo: 'Atualização', texto: TEXTO_ATUALIZACAO },
    { titulo: 'Sem internet', texto: 'Pode treinar sem conexão. O aviso na parte de baixo de todas as telas mostra se está sem internet, enviando ou tudo enviado; se falhar, toque nele para tentar de novo. Em Conta você também vê o que está aguardando envio e toca em Sincronizar agora.', rota: '/aluno/conta' },
    { titulo: 'Conta e Ajuda', texto: 'Em Conta ficam foto de perfil, tema, senha e sair. Esta Ajuda fica sempre à mão.', rota: '/aluno/conta' },
  ],
  passeio: [
    { titulo: 'Treino de hoje', texto: TEXTO_TREINO_DE_HOJE, alvo: 'menu:/aluno' },
    { titulo: 'Dieta', texto: TEXTO_DIETA, alvo: 'menu:/aluno/dieta' },
    { titulo: 'Atualização', texto: TEXTO_ATUALIZACAO, alvo: 'menu:/aluno' },
    { titulo: 'Histórico', texto: 'Cargas e treinos que você já fez, por divisão.', alvo: 'menu:/aluno/historico' },
    { titulo: 'Conta', texto: 'Foto de perfil, tema, senha, sincronização e a Ajuda, onde dá para rever este passeio.', alvo: 'menu:/aluno/conta' },
  ],
  secoes: [
    {
      titulo: 'Treino',
      itens: [
        { titulo: 'Treino de hoje', texto: 'O cartão em destaque abre a divisão do dia.' },
        { titulo: 'Trocar de plano', texto: 'Se houver mais de uma pasta, o seletor no topo mostra as outras. Pasta antiga é só para consultar.' },
        { titulo: 'Peso e repetições', texto: 'Deixe em branco o que não souber: aparece "—". O app não presume valor.' },
        { titulo: 'Cluster e rest pause', texto: 'Quando a série tem uma técnica, o exercício explica antes das séries (por exemplo, quantos blocos e a pausa entre eles). Registre a série inteira, como as outras. Se quiser, toque em "Iniciar pausa" para o cronômetro contar a pausa entre os blocos ou antes da retomada.' },
        { titulo: 'Vídeos', texto: 'O link do vídeo abre fora do app, no navegador ou aplicativo de vídeo.' },
        { titulo: 'PDF do treino', texto: 'Baixe o treino em PDF na aba Treino.' },
      ],
    },
    {
      titulo: 'Dieta e mobilidade',
      itens: [
        { titulo: 'Dieta', texto: 'Mostra o que foi publicado pelo treinador, refeição por refeição, e a água por dia quando ele escreveu. O cartão Dieta no início do app mostra quantas refeições e a água.' },
        { titulo: 'Mobilidade', texto: 'Aba só de consulta, visível quando existe plano publicado. Dá para baixar em PDF.' },
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
        { titulo: 'Fotos', texto: 'Quando a atualização pede fotos, escolha da galeria ou tire na hora (até 6 por pergunta). No celular elas ficam guardadas só dentro do app, sem ir para a galeria, e sobem quando você envia a atualização; na web é preciso estar conectado para anexar. Toque no X para remover antes de enviar. Só você e seu treinador veem as fotos.' },
        { titulo: 'Vou atrasar', texto: 'Se precisar de mais tempo, avise pelo botão. Isso só avisa o treinador.' },
        { titulo: 'Lembretes', texto: 'No celular, o app lembra 3 dias antes, no dia e 1 dia depois, às 9h. Na web, só aparece um cartão.' },
      ],
    },
    {
      titulo: 'Anamnese',
      itens: [
        { titulo: 'Responder', texto: 'Quando o treinador pede, aparece no início o cartão "Responda sua anamnese". Responda com calma: o rascunho fica salvo no aparelho e dá para continuar depois, inclusive sem internet (para enviar, precisa de conexão). Algumas perguntas só aparecem conforme o que você responde antes.' },
        { titulo: 'Enviar', texto: 'Ao tocar em Enviar anamnese, o app confere o que falta. Depois de enviada, ela fica só para consulta; para mudar uma resposta, fale com o seu treinador. Só você e a equipe do seu treinador veem as respostas e as fotos.' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { titulo: 'Foto de perfil', texto: 'Opcional. Em Conta, escolha uma foto da galeria ou tire na hora; ela aparece no seu início e para a equipe do seu treinador. Precisa de internet e não fica salva no aparelho. Dá para trocar ou remover quando quiser.' },
        { titulo: 'Tema e texto', texto: 'Claro, escuro ou do sistema; tamanho do texto, contraste, animações e vibração.' },
        { titulo: 'Senha', texto: 'Trocar a senha encerra as outras sessões.' },
      ],
    },
  ],
  perguntas: [
    { pergunta: 'Marquei a série e não aparece para o treinador.', resposta: 'Pode estar aguardando envio. Abra Conta e toque em Sincronizar agora com internet.' },
    { pergunta: 'Não vejo o treino novo.', resposta: 'O treinador precisa ter publicado o plano. Confirme com ele e abra o app com internet.' },
    { pergunta: 'Esqueci a senha.', resposta: 'Na tela de entrar, toque em "Esqueci minha senha" e siga o link que chega no seu e-mail. Se não chegar, fale com o seu treinador.' },
    { pergunta: 'Errei a carga de uma série.', resposta: 'Abra o exercício e altere o valor no campo da série: o registro é atualizado.' },
    { pergunta: 'Onde leio de novo o termo de uso e o aviso de privacidade?', resposta: 'Em Conta, toque em Termos e privacidade. No primeiro acesso, e sempre que os textos mudam, o app pede o seu aceite antes de abrir.' },
    { pergunta: 'Como vejo de novo o passeio pelo menu?', resposta: 'Ele aparece uma vez em cada aparelho, no primeiro acesso, e dá para pular. Para rever, em Conta toque em "Ajuda, primeiros passos e tutorial" e depois em "Rever o passeio".' },
    { pergunta: 'Por que não tem aba Mobilidade?', resposta: 'Ela só aparece quando o treinador publica um plano de mobilidade.' },
  ],
};

export const GUIAS: Record<Publico, Guia> = { treinador: TREINADOR, aluno: ALUNO };
