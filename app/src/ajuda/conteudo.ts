/**
 * Texto da Ajuda, dos Primeiros passos, do Tutorial guiado e dos guias em PDF (treinador e aluno).
 * Só dados, sem imports: o app e o `scripts/guias/gerar.mjs` leem o mesmo arquivo, então o PDF nunca diverge da tela.
 * Descreve o uso do app; não orienta nada sobre saúde, suplementos ou protocolos.
 */
/**
 * Frase do guia que só vale com o ciclo menstrual ligado na plataforma: a tela de Ajuda a tira quando está desligado
 * (`textoDoItem`). O guia em PDF é estático e a mantém.
 */
export const FRASE_DO_CICLO = 'Sexo diferente de Feminino desliga o acompanhamento do ciclo.';

/** Texto de um item do guia para a tela: sem a frase do ciclo quando o módulo está desligado. */
export function textoDoItem(texto: string, cicloHabilitado: boolean): string {
  return cicloHabilitado ? texto : texto.replace(` ${FRASE_DO_CICLO}`, '').replace(FRASE_DO_CICLO, '').trim();
}

export type Publico = 'treinador' | 'aluno';

export interface PassoGuia {
  titulo: string;
  texto: string;
  /** Tela onde o passo acontece; vira o botão "Abrir" (todo passo que acontece numa tela tem uma). */
  rota?: string;
  /** Só no guia em PDF: passo de quem ainda não entrou (o convite), que não serve a quem já está no app. */
  soNoPdf?: boolean;
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
    { titulo: 'Cadastre o primeiro aluno', texto: 'Em Alunos, toque em Novo aluno e preencha nome e e-mail. Telefone, CPF e endereço são opcionais. O ciclo de atualização (em dias) define o período sugerido das pastas; vazio usa o padrão da consultoria (Marca › Acompanhamento).', rota: '/treinador/alunos' },
    { titulo: 'Convide o aluno para o app', texto: 'Na ficha do aluno, em Dados do aluno, toque em Gerar convite e envie o código ou o link: o aluno cria a senha por ele. Se preferir, toque em Definir e-mail e senha e passe ao aluno o e-mail e a senha provisória; no primeiro acesso ele troca pela dele.', rota: '/treinador/alunos' },
    { titulo: 'Crie a pasta do período', texto: 'Na ficha, em Pastas de plano, toque em Nova pasta. A pasta junta treino, dieta e mobilidade e dá o período a todos.', rota: '/treinador/alunos' },
    { titulo: 'Monte e publique o treino', texto: 'Abra a pasta, crie o plano de treino, adicione exercícios da biblioteca (dá para marcar vários do mesmo grupo de uma vez) e toque em Publicar. O que foi publicado não muda: editar cria uma versão nova.', rota: '/treinador/alunos' },
    { titulo: 'Acompanhe os registros', texto: 'Na pasta, o cartão Registros e cargas mostra o que o aluno fez, por divisão ou por dia. Dá para baixar o PDF das cargas. As atualizações enviadas ficam em Atualizações, no menu.', rota: '/treinador/atualizacoes' },
  ],
  tutorial: [
    { titulo: 'Boas-vindas', texto: 'Este tutorial passa pelas telas principais na ordem em que você vai usá-las. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Menu e barra de topo', texto: 'No computador o menu fica à esquerda (dá para minimizar) e a barra de topo traz a busca "O que você deseja fazer?" (atalho Ctrl+K), o botão Todas as telas, onde dá para marcar favoritas, e o seu usuário. No celular, a barra de baixo tem Início, Alunos, Biblioteca, Planos e Perfil; Atualizações abre pelo Início, e Interessados, Equipe, Importação, Auditoria e a busca de telas ficam no Perfil, com a seta de voltar. Marca fica no menu do seu usuário, só para o perfil Administrador. Um ponto no ícone avisa que há algo a fazer. Só aparece o que o seu perfil permite.', rota: '/treinador' },
    { titulo: 'Alunos', texto: 'Lista os alunos da consultoria, com busca e o filtro "Meus alunos". Cada linha mostra a situação da atualização da pasta atual (para quem pode ver atualizações). Toque em um aluno para abrir a ficha.', rota: '/treinador/alunos' },
    { titulo: 'Interessados', texto: 'O link de inscrição da consultoria e a fila de quem se inscreveu por ele. Ligue o link, copie e divulgue; cada inscrição chega para o responsável escolhido. Abra a inscrição para conversar pelo WhatsApp, registrar o andamento e aceitar (o aluno é cadastrado na hora) ou recusar.', rota: '/treinador/interessados' },
    { titulo: 'Ficha do aluno', texto: 'Reúne dados, acesso ao app, lesões, pastas de plano, frequência, progresso por exercício, peso e a evolução das respostas das atualizações. Atualizações do aluno ficam dentro de cada pasta.', rota: '/treinador/alunos' },
    { titulo: 'Pastas de plano', texto: 'Cada pasta tem período e agrupa treino, dieta e mobilidade. Use o filtro Todas, Ativas ou Concluídas para achar uma pasta. Finalize a pasta ao fim do ciclo e replique para o próximo; em Mais ações (⋯), Renovar pasta faz isso de uma vez, com o próximo período e os planos em rascunho.', rota: '/treinador/alunos' },
    { titulo: 'Atualizações', texto: 'As atualizações que os alunos enviam ao fim de cada período, separadas em para revisar, atrasadas e todas. Abra uma, leia as respostas e escreva o retorno; "Próxima" passa para a seguinte da fila. O ponto no menu avisa quando há alguma para revisar. A Agenda (no menu lateral, no contador "Atualizações em 7 dias" do Início e na busca de telas) mostra as dos próximos 7 dias dia a dia, junto dos compromissos presenciais; vale o mesmo filtro Todos / Meus.', rota: '/treinador/atualizacoes' },
    { titulo: 'Agenda', texto: 'Os compromissos presenciais com os alunos (consultas, retornos, avaliações) e as atualizações que vencem, dia a dia. Escolha Dia ou Semana e ande com as setas; "Novo compromisso" marca um horário. Tocar num compromisso mostra os detalhes, com Editar, Marcar realizado, Marcar falta e Cancelar.', rota: '/treinador/agenda' },
    { titulo: 'Números', texto: 'As contagens da consultoria nos últimos 6 meses, sem nomes: alunos ativos no fim de cada mês e atualizações do mês, no prazo e atrasadas. Fica tudo numa tabela, do mês atual para o mais antigo; o mês corrente vem marcado "até hoje". Onde aparece “—”, o número não está disponível (não é zero). Fica no menu lateral, no link ao lado de "Ver alunos" no Início e na busca de telas.', rota: '/treinador/numeros' },
    { titulo: 'Editores de plano', texto: 'Nada é salvo sozinho: toque em Salvar rascunho (Validar e Publicar também salvam antes). O selo do topo diz "Alterações não salvas" e, depois de salvar, "Salvo às HH:MM". Se sair com alterações não salvas, o app pergunta antes. Plano publicado é imutável.', rota: '/treinador/planejamento' },
    { titulo: 'Biblioteca', texto: 'Exercícios (com filtro por um ou vários grupos musculares), alimentos, suplementos e catálogo público. A aba Outros (medicação e ergogênicos) só aparece para quem tem a permissão; as categorias dela são você quem escreve. Planilha entra em Importação.', rota: '/treinador/biblioteca' },
    { titulo: 'Importar planilhas', texto: 'Em Importação, escolha o destino, baixe o modelo (CSV ou Excel), envie o arquivo e confira a prévia. Nada é gravado antes de Importar. O arquivo não fica guardado. Quem já existe pode ser ignorado, completado ou atualizado; célula vazia não apaga e não vira zero. As linhas com erro ficam de fora e dá para baixar o CSV delas (só linha, campo e motivo). No celular, Importação fica em Perfil, nos atalhos.', rota: '/treinador/importacao' },
    { titulo: 'Planejamento', texto: 'Modelos reutilizáveis de treino, dieta e mobilidade, e pacotes de pasta inteira, agrupados por coleção. A busca procura em todas as coleções; recolha um grupo tocando no título e use o lápis para renomear a coleção. Aplique o modelo a um aluno quando quiser. A aba Atualização guarda os questionários que o aluno responde ao fim de cada período, e a aba Anamnese, os questionários iniciais que você envia pela ficha do aluno.', rota: '/treinador/planejamento' },
    { titulo: 'Marca, Equipe e Auditoria', texto: 'Marca (cor, fonte e logo) aparece só a quem tem permissão para alterá-la. Equipe gerencia membros e perfis de acesso; Auditoria lista o que foi feito. Aparecem conforme o seu perfil, no menu lateral do computador e nos atalhos do Perfil no celular.', rota: '/treinador/equipe' },
    { titulo: 'Seu usuário e Ajuda', texto: 'No cartão com o seu nome (canto superior direito; no celular, em Perfil) ficam Meus dados (nome, telefone e senha), Segurança (verificação em duas etapas com aplicativo autenticador, códigos de recuperação), Minha conta (plano, cobranças com o botão "Pagar" nas que estão em aberto, e consumo; só aparece para quem tem permissão), Marca (nome, logo, cor e tema; só o perfil Administrador), Ajustes (tema claro/escuro e tamanho do texto) e Sair. Esta Ajuda fica sempre à mão.', rota: '/treinador/ajustes' },
  ],
  passeio: [
    { titulo: 'Boas-vindas', texto: 'Um passeio rápido pelo menu, item por item. Leva menos de um minuto. Dá para pular agora e rever quando quiser em Ajuda.' },
    { titulo: 'Início', texto: 'O resumo da consultoria: atualizações para revisar e alunos sem registro há alguns dias.', alvo: 'menu:/treinador' },
    { titulo: 'Alunos', texto: 'Cadastre os alunos e abra a ficha de cada um: convite para o app, pastas com treino, dieta e mobilidade, registros, peso e atualizações.', alvo: 'menu:/treinador/alunos' },
    { titulo: 'Atualizações', texto: 'As atualizações que os alunos enviam ao fim de cada período. Um ponto aparece aqui quando há alguma para revisar.', alvo: 'menu:/treinador/atualizacoes' },
    { titulo: 'Interessados', texto: 'O link de inscrição da consultoria e a fila de quem se inscreveu por ele: contato pelo WhatsApp, notas, aceitar (vira aluno) ou recusar. Um ponto avisa de inscrição nova.', alvo: 'menu:/treinador/interessados' },
    { titulo: 'Biblioteca', texto: 'Exercícios, alimentos, suplementos e Outros (medicação e ergogênicos). Tudo o que entra nos planos sai daqui.', alvo: 'menu:/treinador/biblioteca' },
    { titulo: 'Planejamento', texto: 'Modelos de treino, dieta e mobilidade agrupados por coleção para aplicar aos alunos, e os questionários da atualização e da anamnese. No celular, "Planos".', alvo: 'menu:/treinador/planejamento' },
    { titulo: 'Marca', texto: 'Cor, logo, tema e o ciclo padrão de atualização da consultoria. Fica no menu do seu usuário e só o perfil Administrador vê.' },
    { titulo: 'Equipe', texto: 'Convide quem trabalha com você e escolha o que cada perfil pode ver e fazer.', alvo: 'menu:/treinador/equipe' },
    { titulo: 'Importação', texto: 'Planilhas de alunos, pesos, exercícios, alimentos, suplementos e outros. A prévia mostra o que entra; o arquivo não fica guardado.', alvo: 'menu:/treinador/importacao' },
    { titulo: 'Perfil', texto: 'Seus dados, senha, ajustes de tela, a busca de telas e os atalhos para Interessados, Equipe, Importação, Ajuda e Auditoria. Marca, quando o perfil é Administrador, fica junto de Meus dados.', alvo: 'menu:/treinador/perfil' },
    { titulo: 'Ajuda', texto: 'Guia, tutorial e perguntas frequentes. Para rever este passeio, toque em "Conhecer o menu" na Ajuda.', alvo: 'menu:/treinador/ajuda' },
  ],
  secoes: [
    {
      titulo: 'Alunos',
      itens: [
        { titulo: 'Cadastrar e editar', texto: 'Novo aluno pede nome e e-mail; telefone, CPF e endereço são opcionais. O telefone aparece e se edita na ficha só depois que o aluno criou o acesso (é do usuário dele), com a permissão de alterar aluno. CPF, endereço, objetivo e observações são dados sensíveis: só aparecem e se editam com a permissão de dados sensíveis; sem ela, a ficha não mostra e salvar mantém o que estava. O CPF é conferido (dígitos verificadores) e não pode repetir entre alunos da consultoria. O endereço é opcional, mas não vale pela metade: preenchido qualquer campo, CEP, rua, número (pode ser "s/n"), cidade e UF são obrigatórios; complemento e bairro são opcionais. Não há busca de CEP automática.' },
        { titulo: 'Convite de acesso', texto: 'O convite tem código e link, vale por tempo limitado e só pode ser usado uma vez. Copie o código antes de sair da tela: ele não aparece de novo. Gerar outro invalida o anterior.' },
        { titulo: 'Definir e-mail e senha', texto: 'Em Dados do aluno, Definir e-mail e senha cria o acesso com um e-mail de login e uma senha provisória (Gerar senha sugere uma). A senha aparece uma vez para copiar e passar ao aluno; no primeiro acesso ele cria a senha dele, e o acesso mostra "Aguardando primeiro acesso" até lá. Para quem já tem conta, Definir nova senha troca a senha e encerra as sessões abertas do aluno. O e-mail de login pode ser outro que o do cadastro. Aluno inativo precisa ser reativado antes.' },
        { titulo: 'Foto de perfil', texto: 'Quem a escolhe é o aluno, em Conta (é opcional). Ela aparece no cartão de cima da ficha para quem pode ver alunos; sem foto, aparecem as iniciais.' },
        { titulo: 'Inativar', texto: 'Inativar tira o aluno do app na hora; planos e registros ficam guardados e dá para reativar.' },
        { titulo: 'Ações em lote', texto: 'Na lista de Alunos, toque em Selecionar, marque os alunos (ou Marcar visíveis) e escolha Trocar responsável, Trocar questionário ou Desativar. Vale para até 100 alunos por vez, tudo ou nada, e cada ação pede confirmação. Desativar encerra as sessões dos alunos marcados; dá para reativar um por um na ficha.' },
        { titulo: 'Lesões e peso', texto: 'Ficam na ficha, só para quem pode ver dados sensíveis. O app apenas guarda o que você registra.' },
      ],
    },
    {
      titulo: 'Importar planilhas',
      itens: [
        { titulo: 'O que dá para trazer', texto: 'Alunos, pesos, exercícios, alimentos, suplementos e outros (medicação e ergogênicos). Treinos e dietas não entram por esta tela. Cada destino pede a permissão de alterar aquele cadastro; pesos pedem a de dados sensíveis.' },
        { titulo: 'Como fazer', texto: 'Em Importação, toque em Nova importação, escolha o destino e baixe o CSV ou o Excel. A primeira linha é o cabeçalho. No passo seguinte, escolha a aba (quando a planilha tem mais de uma), a chave e o que fazer com quem já existe. O mapeamento sugere a coluna pelo nome. Campo obrigatório sem coluna não deixa continuar.' },
        { titulo: 'Prévia e o que fica guardado', texto: 'A prévia não grava. Importar grava só as linhas válidas. As que têm erro ficam de fora; o histórico guarda até mil erros, só com linha, campo e motivo, e dá para baixar esse CSV. O arquivo enviado não fica no sistema. CPF, telefone e CEP precisam ser texto, para o zero à esquerda não sumir. Célula vazia não apaga o que já está e não vira zero.' },
        { titulo: 'Modelos', texto: 'Modelos de planilha, no topo da tela, baixa três linhas fictícias de cada destino. Troque pelos seus dados antes de enviar. No celular o modelo abre no site, sem token.' },
      ],
    },
    {
      titulo: 'Interessados (inscrição por link)',
      itens: [
        { titulo: 'Ligar e divulgar o link', texto: 'Em Interessados, no cartão Link de inscrição, ligue "Receber inscrições pelo link", escolha o responsável pelas novas e salve. Copie o link e divulgue onde quiser (Instagram, WhatsApp, site). A pessoa preenche nome, WhatsApp e, se quiser, e-mail, objetivo e uma observação, sem criar conta. Desligado, o link mostra que a inscrição está encerrada.' },
        { titulo: 'Texto de apresentação e privacidade', texto: 'O texto que você escreve no cartão do link aparece na página de inscrição. Com texto, a pessoa precisa marcar "Li e estou ciente" para enviar, e a inscrição guarda o texto e a hora. Use-o para dizer como a consultoria usa os dados.' },
        { titulo: 'Gerar novo link', texto: 'Se o link vazou ou você quer trocar, toque em Gerar novo link: o anterior para de funcionar na hora. As inscrições já recebidas não mudam.' },
        { titulo: 'Atender a fila', texto: 'A lista mostra as inscrições em atendimento, as mais novas primeiro; filtre pela situação ou por "Meus" (as que estão com você). Abra uma inscrição para ver o que a pessoa escreveu, tocar em Abrir WhatsApp (abre a conversa sem mensagem pronta; abrir não quer dizer que foi enviada), anotar o contato nas notas da equipe e mudar a situação, o responsável e o pagamento.' },
        { titulo: 'Pagamento', texto: 'É só um registro manual (não controlado, aguardando ou confirmado, com quem e quando). O app não confere pagamento e o aceite não depende dele.' },
        { titulo: 'Aceitar', texto: 'Aceitar cadastra o aluno com o nome e o e-mail da inscrição e o mesmo responsável; com "Enviar convite de acesso ao app" marcado, o link do convite aparece uma vez para você copiar e mandar. Aceitar de novo não cria outro aluno. Se já existe um aluno com o mesmo e-mail, o app avisa e oferece abrir a ficha dele. O limite de alunos do plano vale também aqui. Em "Enviar anamnese", escolha qual anamnese o aluno recebe ou "Não enviar agora".' },
        { titulo: 'Possível duplicidade', texto: 'A inscrição avisa quando há aluno com o mesmo e-mail ou outra inscrição em atendimento com o mesmo e-mail ou WhatsApp. É só um aviso: nada é juntado sozinho.' },
        { titulo: 'Recusar e por quanto tempo fica guardado', texto: 'Recusar tira a inscrição da fila. Inscrições recusadas ou de quem desistiu são apagadas sozinhas 180 dias depois da última mudança; a aceita segue as regras do aluno (ao anonimizar o aluno, a inscrição dele também é apagada).' },
        { titulo: 'Quem vê', texto: 'Interessados aparece para quem tem a permissão de interessados (nos perfis prontos, Administrador, Treinador e Assistente). Aceitar pede também a permissão de cadastrar alunos, e o convite, a de convidar. Enviar anamnese pede também as de anamnese (ler e alterar) e a de dados sensíveis.' },
      ],
    },
    {
      titulo: 'Agenda presencial',
      itens: [
        { titulo: 'Marcar um compromisso', texto: 'Na Agenda, toque em Novo compromisso e escolha o aluno (só alunos ativos), o responsável da equipe, a data, a hora, a duração (de 5 a 480 minutos) e, se quiser, o local. A hora é sempre a de Brasília. Só a equipe marca: o aluno não escolhe horário.' },
        { titulo: 'Horário ocupado', texto: 'O mesmo responsável não pode ter dois compromissos ao mesmo tempo. Se o horário já estiver tomado, o app avisa e não salva; escolha outro horário ou outro responsável. Um compromisso que termina às 10:00 não impede outro que começa às 10:00. Cancelado libera o horário.' },
        { titulo: 'Dia e Semana', texto: 'A visão Dia mostra um dia; a Semana mostra o dia escolhido e os 7 seguintes. Os filtros Todos / Meus e Membro mostram os compromissos de quem você escolher; Compromissos filtra por situação. As atualizações aparecem de hoje até 7 dias à frente.' },
        { titulo: 'Depois do horário', texto: 'Abra o compromisso e toque em Marcar realizado ou Marcar falta (só depois do horário de início). Dá para corrigir depois ou voltar para agendado.' },
        { titulo: 'Observação', texto: 'A observação é só da equipe: o aluno não vê. Ela aparece e se edita só para quem tem a permissão de dados sensíveis.' },
        { titulo: 'O que o aluno vê', texto: 'No Início do app, em Seus compromissos, o aluno vê os próximos: dia, hora, local e com quem. Os cancelados aparecem marcados como Cancelado.' },
        { titulo: 'Quem vê', texto: 'A agenda presencial aparece para quem tem as permissões da agenda (nos perfis prontos, Administrador, Treinador, Nutricionista e Assistente). Ao anonimizar um aluno, ou quando ele exclui a conta, os compromissos dele são apagados; a exportação dos dados do aluno leva os compromissos.' },
      ],
    },
    {
      titulo: 'Privacidade (LGPD)',
      itens: [
        { titulo: 'Termo de uso e aviso de privacidade', texto: 'No primeiro acesso, você e o aluno leem e aceitam os dois textos; sem o aceite o app não abre. Quando o texto muda, todos aceitam de novo. Dá para reler em Perfil › Termos e privacidade. Os textos atuais são rascunho e precisam de revisão jurídica.' },
        { titulo: 'Exportar os dados de um aluno', texto: 'Na ficha, em Exportar dados, o app baixa um arquivo com cadastro, planos publicados, registros, peso, lesões e atualizações. Só entra o que o seu perfil pode ver. O arquivo tem dados pessoais e de saúde: guarde com cuidado. A exportação fica na auditoria, sem o conteúdo. Só quem tem a permissão de exportar vê o botão (nos perfis prontos, o Administrador).' },
        { titulo: 'Anonimizar um aluno que saiu', texto: 'Com o aluno já inativo, Anonimizar apaga nome, e-mail, telefone, CPF, endereço, objetivo, observações, peso, lesões, respostas e feedback das atualizações, observações dos registros e a dieta, e encerra o acesso. Pastas, treinos e as cargas e repetições ficam, só para as contagens. Para confirmar, digite o nome do aluno. Não tem volta, e o cadastro anonimizado não é mais editado nem reativado.' },
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
        { titulo: 'Metodologia e tipos de série', texto: 'Em Planejamento › Treino › Metodologias ficam os tipos de série, as técnicas e as combinações de exercícios da consultoria. "Adicionar da lista" copia do catálogo (tipos, até 17 técnicas e até 7 combinações); a lixeira tira na hora e dá para desfazer. A padrão continua com 5 tipos, 6 técnicas e 7 combinações. Cada tipo tem nome exibido, código, papel, repetições, carga padrão, esforço padrão, variação por modalidade e explicação para o aluno. O código (como WORKING ou FEEDER) é gerado do nome quando o tipo é criado e a tela não deixa mudar: é ele que as séries gravam, então o nome pode ser trocado sem perder as séries. O papel indica aquecimento, preparação, trabalho, pós-trabalho ou outro, e o primeiro tipo de trabalho dá nome ao "% da série de trabalho". A regra de percentuais fica dentro do tipo de preparação: para 3 FS, por exemplo, 50%, 70% e 85–90% da carga da WS. Peso livre e máquina podem ter carga e esforço próprios (no padrão, a WS usa 1 RIR no peso livre e 0 RIR na máquina). O aluno lê a explicação ao tocar no nome do tipo. Salve pela barra do modelo. Os padrões preenchem séries novas; mudar a metodologia não altera séries já gravadas nem planos já publicados.' },
        { titulo: 'Séries', texto: 'Antes das séries, escolha a Carga do exercício (em kg ou sem carga). Em "Adicionar série" escolha o tipo da série, que é sempre obrigatório, e, se quiser, a técnica, e toque em Adicionar série; o tipo diz para que a série serve, e a técnica diz como executá-la. Séries iguais e seguidas formam um grupo e se editam juntas. Ao abrir o grupo, as seções vêm nesta ordem: Tipo e técnica; Estrutura (quantas séries e, com técnica, blocos, pausas ou etapas e a carga de cada parte; repetições nas séries sem Cluster; no cardio, a quantidade); Carga; Esforço; Descanso; Alvo extra; Cardio, quando houver; e por último "Para o aluno", a leitura da prescrição e de onde sai a carga. O "O que é?" ao lado do tipo e da técnica explica cada um. Repetições são uma faixa (mínimo e máximo) ou AMRAP, que só vale quando você escolhe essa opção: campo vazio nunca vira AMRAP, e série sem repetições é lida por tempo. O alvo extra é um texto curto, de até 120 caracteres, que o aluno lê junto da série. Aumentar um grupo de FS aplica a regra da quantidade escolhida, com as faixas de percentual por série. As setas mudam a ordem dos grupos, e o máximo é 30 séries por exercício. Cada campo mostra o erro no próprio lugar, com a mesma validação da publicação.' },
        { titulo: 'Carga e esforço', texto: 'Carga e esforço são campos separados. Carga: carga de trabalho (o aluno informa a carga do dia, que vira a referência da WS), % da série de trabalho (sempre da carga da WS, nunca do 1RM, com faixa como 85–90%), mesma carga da série de trabalho, acima da anterior, abaixo da referência ou sem carga. Esforço: RIR (de 0 a 5 repetições na reserva) ou RPE (de 1 a 10, de meio em meio), nunca os dois na mesma série. RIR 0 significa até a falha: o aluno vai até não conseguir mais repetir com boa técnica; é assim que a tela do aluno e o PDF mostram. RIR 0 em aquecimento ou preparação gera um aviso na publicação. Uma WS em RPE continua sendo série de trabalho.' },
        { titulo: 'Top set e Back off', texto: 'Top set é a série mais pesada que a anterior: carga "acima da anterior", com um percentual (no padrão, de 1 a 5% no peso livre e de 5 a 10% na máquina). Na primeira série do exercício a publicação avisa que não há carga anterior de referência. Back off vem depois da WS ou do Top set: no padrão, 85% da carga da WS; para reduzir a partir de outra série, escolha a carga "abaixo da referência", a série de referência (uma série anterior do mesmo exercício; ela nasce apontando a última série de trabalho) e o percentual de redução, de 1 a 50%. O aluno lê, por exemplo, "15% abaixo da referência (Top set)", e a carga sugerida sai do que ele registrou naquela série no dia; sem registro dela, não há sugestão.' },
        { titulo: 'Técnicas dentro da série', texto: 'A técnica não substitui o tipo: entra dentro da própria série, em geral na WS (tipo WS, carga de trabalho e a técnica escolhida). Rest pause: pausa em segundos ou respirações e quantas pausas (três micro-séries são duas pausas). Cluster: a série de trabalho é dividida em blocos iguais (quantos blocos e repetições em cada um) ou diferentes (4+2); as repetições da série são a soma. O aluno registra bloco por bloco, dentro da mesma série (os blocos nunca viram séries). A pausa entre blocos não é o descanso depois da série. Uma WS contínua antes é outra série, sem técnica. Em "Usar receita" há duas receitas de exemplo, "Exemplo: FS, WS e Cluster" e "Exemplo: FS e Cluster", que substituem as séries do exercício (dá para desfazer). O botão "Aplicar Rest-pause só na última série" fica dentro do grupo, na seção Técnica, só quando o grupo tem 2 ou mais séries de trabalho sem técnica e o Rest pause está na metodologia (em grupo de Cluster, Drop-set ou outra técnica ele não aparece); "Adicionar série" com tipo WS e técnica Rest pause cria uma série nova. A pausa é um número com a unidade (segundos ou respirações); "Informar também em…" mostra a outra unidade e usa as duas. A notação 4+2 aparece em "Blocos diferentes" ou em "Digitar como 4+2". A carga de trabalho do Cluster vem da base do dia quando o exercício tem carga. Esforço e descanso não são calculados pela técnica. Drop set: quantas quedas, a redução da carga em %, as repetições de cada queda e o descanso entre quedas, que pode ser 0; campo vazio não fixa valor. Myo-reps: de 2 a 10 mini-séries, repetições por mini-série e a pausa entre elas; a ativação são as repetições da própria série. Partial reps: quantas repetições parciais e a região (alongada, encurtada ou livre). Forced reps: de 1 a 5 repetições assistidas; a tela avisa que a técnica precisa de um parceiro. Há técnicas sem campo próprio (negativa, super-slow, 21s, EMOM, pirâmides, dupla progressão, GVT, FST-7 e especialização): o aluno lê a explicação. A metodologia usa só as que foram adicionadas da lista. No Cluster e no Rest-pause o aluno registra cada etapa (bloco, ou etapa inicial e retomadas) com repetições e carga, pode marcar uma etapa como não feita e conclui a série quando todas têm situação; o total é a soma das etapas feitas, calculada no servidor, e um registro incompleto aparece como parcial, sem total. Nas outras técnicas o aluno registra a série inteira, com a carga com que começou. Na prévia, o modo das repetições é Exatas (um número), Faixa (mínimo e máximo) ou AMRAP. No Cluster, "Personalizar carga por bloco" deixa cada bloco com a carga da série ou um % da WS (por exemplo, bloco 1 na carga da série e os outros a 90%). No Rest-pause, "Definir a meta das retomadas" dá a cada retomada repetições exatas, faixa ou AMRAP e a carga (a da série ou um % da WS); desligado, o aluno continua com a mesma carga até a falha. Todos os percentuais de uma série são sobre a mesma referência (na série de carga de trabalho, a carga do dia; nas outras, a última WS registrada antes, ou a carga do dia), fixada quando o aluno registra a primeira etapa: nunca percentual sobre percentual. Exercício sem carga não tem carga por bloco nem retomada em %. Nome exibido, explicação e padrões de cada técnica ficam nos cartões de técnica da metodologia; o aluno lê a explicação ao tocar no nome.' },
        { titulo: 'Cadência e isometria', texto: 'No exercício aberto, em "Execução": cadência em 4 números separados por hífen, em segundos, na ordem descida, pausa embaixo, subida e pausa em cima (ex.: 3-1-1-0; X = o mais rápido possível). Isometria: quantos segundos segurar (de 1 a 120); diga onde na observação. Os dois valem para o exercício todo e aparecem para o aluno antes das séries e no PDF.' },
        { titulo: 'Grupos de exercícios', texto: 'Na sessão, toque em "Criar grupo" (só as combinações da metodologia; sem nenhuma, o botão fica desabilitado), escolha o tipo do grupo e marque os exercícios, que precisam estar um ao lado do outro. Mínimos: superset e agonista-antagonista, 2 exercícios; tri-set, 3; giant set, 4 ou mais; circuito, 3 ou mais, com o número de voltas (de 1 a 20); pré-exaustão e pós-exaustão, exatamente 2. Um grupo vai até 6 exercícios. Nos cinco primeiros tipos os exercícios são feitos em sequência, sem descanso entre eles, e vale o "Descanso depois do grupo" (de 0 a 3600 s, depois de cada volta); o descanso por série dos exercícios do grupo não vale. Em pré e pós-exaustão os exercícios também são em sequência, mas cada série mantém o próprio descanso e não existe descanso do grupo. Pré-exaustão começa por um exercício que isola o músculo e termina no composto; pós-exaustão faz o contrário. No cartão do grupo dá para trocar o tipo, incluir o exercício vizinho, desfazer o grupo (os exercícios ficam soltos, com as séries) e mover o grupo inteiro pelas setas. Mover ou remover um exercício mantém o grupo contíguo, e um grupo que cai abaixo do mínimo é desfeito. O nome e a explicação de cada tipo de grupo ficam na metodologia, em Combinações de exercícios; o aluno lê a explicação ao tocar no nome.' },
        { titulo: 'Cardio', texto: 'Cardio é um exercício de modalidade Cardio (trocar a modalidade apaga as séries do exercício; dá para desfazer logo depois). A série de cardio não tem tipo, carga, esforço, repetições nem técnica: só a prescrição, com duração (min), distância (km), ritmo (texto, como "6 min/km"), zona de 1 a 5 e, se for intervalado, o tempo de esforço, o de descanso e as voltas. É preciso informar ao menos duração, distância ou intervalos. O aluno vê a prescrição e só marca como feito. O campo de texto "Cardio" da sessão só aparece em sessão que já o tem; em sessão nova, use um exercício de cardio.' },
        { titulo: 'Imagem ou GIF do exercício', texto: 'Na Biblioteca › Exercícios, abra o exercício e use "Imagem ou GIF" para enviar a sua demonstração (JPEG, PNG ou GIF animado, até 1 MB e 800 px), trocar ou remover. Quem tem a permissão de alterar a biblioteca envia. A sua imagem vale mais que as fotos do catálogo; sem ela, o exercício importado do catálogo mostra as duas fotos dele, que se alternam. A imagem aparece na lista da biblioteca, no editor do treino e, para o aluno, na tela do exercício que está no plano publicado dele. O vídeo continua sendo um link.' },
        { titulo: 'Validação', texto: 'Erros impedem a publicação. Avisos pedem confirmação. Cada problema indica onde está no plano, e o botão "N problemas para publicar" leva ao primeiro.' },
        { titulo: 'PDF', texto: 'Treino, dieta e mobilidade podem ser exportados em PDF para imprimir ou compartilhar. O treino mostra o tipo de cada série pelo nome exibido, faixas de percentual, esforço ("até a falha" para RIR 0), técnica, alvo extra, a prescrição de cardio e, nos grupos de exercícios, a ordem, as voltas e o descanso depois do grupo. No fim vem "Como ler este treino", o glossário só com o que o plano usa: tipos, técnicas, grupos e, quando aparecem, RIR e RPE (com "RIR 0 = até a falha"). Na mobilidade, o vídeo sai só como link.' },
        { titulo: 'Água por dia', texto: 'Na dieta, o campo "Água por dia" (em litros, de 0,1 a 20) aparece para o aluno no topo da dieta, no início do app e no PDF. É só o número que você escreve: o app não calcula meta nem pede para o aluno marcar copos. Vazio, não aparece.' },
        { titulo: 'Fatores e lista de compras', texto: 'O aluno tem, na Dieta, uma lista de compras da semana ou do mês. Para ela mostrar o que comprar, cadastre no alimento da biblioteca o fator de correção (peso bruto ÷ peso limpo, de 1 a 20; ex.: 1,75 = para 1 kg limpo, compre 1,75 kg) e o fator de cocção (peso pronto ÷ peso cru, de 0,1 a 10; ex.: 2,5 = 100 g cru rendem 250 g prontos). Parte do catálogo público já vem com fator de correção e de cocção; ao importar, eles entram no alimento e você pode mudar. O que não tem fator continua vazio (não informado, nunca 1). Os dois são opcionais; sem fator, a lista usa a quantidade da dieta. Na dieta escreva a quantidade como o alimento é comido (ex.: arroz cozido): a lista converte para cru e para o peso de compra. Só valem para itens em gramas escolhidos da biblioteca, e entram na dieta do aluno quando você publica (mudou um fator, publique de novo). No PDF da dieta, Simples traz só a dieta e Detalhado acrescenta a lista de compras; "Mostrar FC e FCc" só liga as colunas, a conta continua a mesma.' },
        { titulo: 'Conferir a lista antes de publicar', texto: 'No editor da dieta do aluno e no modelo de dieta do Planejamento, o botão Lista de compras mostra a mesma lista que o aluno vê (Semana ou Mês, opção por refeição, "cru"), calculada com o que está na tela, mesmo sem salvar. É uma prévia com os fatores atuais da biblioteca: o aluno vê os fatores que estiverem na biblioteca quando você publicar. Dá para baixar em PDF.' },
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
        { titulo: 'Volume de carga', texto: 'Cada exercício com carga mostra o volume de carga registrado, nas visões Por dia e Por divisão e no PDF das cargas: carga × repetições de cada série feita (no Cluster e no Rest-pause, de cada etapa feita). Se faltou carga ou repetição em alguma parte feita, aparece como subtotal. Exercício sem carga não tem volume. É só informação, sem meta nem comparação.' },
        { titulo: 'Frequência', texto: 'Na ficha, o cartão Frequência (para quem vê registros) conta os treinos com registro do aluno: os desta semana (segunda até hoje) e os da pasta vigente, do início até hoje (ou até o fim da pasta, se ela já terminou). É só a contagem: sem meta, previsto ou porcentagem. Cada treino de um dia conta uma vez, se tiver ao menos uma série marcada como feita. Sem pasta com período aparece "—"; sem registro, "Nenhum registro". A conta é diferente do "treinos da semana" que o aluno vê no app, que usa o dia marcado no plano.' },
        { titulo: 'Mobilidade', texto: 'Na ficha, o cartão Mobilidade (para quem vê registros e treino) conta os dias em que o aluno marcou algo como feito na mobilidade: nesta semana (segunda até hoje) e na pasta vigente. É só a contagem. Sem plano de mobilidade publicado na pasta aparece "—"; sem marcas, "Nenhum registro".' },
        { titulo: 'Progresso por exercício', texto: 'Fica na ficha do aluno, fora das pastas, e soma o histórico de todas elas. Toque em "Escolher exercícios", busque pelo nome, filtre pelo grupo muscular e marque até 10 de uma vez. Cada um vira um bloco com o primeiro e o último registro, o gráfico da carga e as 5 datas mais recentes (com "Ver todos os registros"). O × tira o exercício da comparação sem apagar nada.' },
        { titulo: 'PDF das cargas', texto: 'Gera o relatório de cargas do período da pasta. Dado ausente aparece como "—", nunca como zero. No Cluster e no Rest-pause, a tela Por divisão e o PDF mostram as repetições de cada etapa e o total ("4+4+4+2 = 14"), "parcial" quando faltou etapa e "Carga variável" quando as etapas tiveram cargas diferentes: o app não escolhe uma carga entre elas.' },
      ],
    },
    {
      titulo: 'Atualização do aluno',
      itens: [
        { titulo: 'Onde fica', texto: 'Dentro de cada pasta, ao fim do período. O aluno responde e envia; você revisa e escreve o retorno.' },
        { titulo: 'Revisar em fila', texto: 'Ao abrir uma atualização pela lista (Para revisar, Atrasadas...), o botão Próxima › abre a seguinte da mesma lista. Quando acabam, o app avisa "Nada mais para revisar".' },
        { titulo: 'Atraso', texto: 'O aluno pode avisar que vai atrasar. Isso só avisa; não bloqueia nada.' }, { titulo: 'Evolução das respostas', texto: 'Na ficha, depois do Peso, o cartão Evolução das respostas (para quem vê atualizações e dados sensíveis) junta as notas e os números que o aluno respondeu nas últimas 24 atualizações enviadas, uma pergunta por vez: o gráfico (com 2 respostas ou mais e os gráficos ligados nas preferências) e a lista das datas. A mesma pergunta em versões diferentes do questionário fica na mesma linha. Pergunta sem resposta não vira zero, e o peso fica no cartão Peso. Nada é calculado: sem média, meta ou tendência.' }, { titulo: 'Fotos', texto: 'Se o questionário tem a pergunta Fotos, o aluno anexa até 6 fotos por pergunta. Elas são dado sensível: só quem tem acesso à atualização e aos dados sensíveis do aluno as vê, dentro da atualização e no Resumo, e nunca por link público. Sem foto aparece "—". Quando o recurso ainda não está ligado na sua consultoria, a pergunta aparece como "Fotos ainda não disponíveis" para o aluno. Na exportação do aluno entra só a lista das fotos (data e tamanho), sem as imagens; ao anonimizar, elas são apagadas.' },
        { titulo: 'Comparação de fotos', texto: 'Na ficha, o cartão Fotos (para quem vê atualizações e dados sensíveis) lista as fotos já enviadas. Em Comparar, dá para ver de 2 a 4 datas da mesma posição, com a data e o peso; "Primeira × última" marca as pontas. "Gerar imagem" monta o JPG com as fotos que estão na tela, da esquerda para a direita. "Gerar carrossel" aparece com duas datas que tenham pelo menos duas fotos cada: a primeira com a primeira, a segunda com a segunda, até a data que tiver menos, no máximo 6. Só funciona se o aluno autorizou, em Conta › Uso das suas fotos. A imagem sai sem nome, data ou peso, no Stories (1080×1920), no Feed retrato (1080×1350) ou nos dois. Uma imagem em um formato baixa como JPG; o carrossel, ou os dois formatos, baixam num ZIP, cada formato numa pasta. Pode levar a logo da consultoria. Nada fica gravado no servidor.' },
        { titulo: 'Questionário', texto: 'Cada consultoria monta os próprios questionários em Planejamento, na aba Atualização: edite o rascunho, confira na Prévia e toque em Publicar. Um deles é o padrão da consultoria. Na ficha do aluno você escolhe o questionário dele ("Padrão da consultoria" usa o padrão) e, na pasta aberta, o questionário só daquele período ("O do aluno" usa o escolhido na ficha). Quem não é mais usado se arquiva; um que já foi respondido não se exclui.' },
      ],
    },
    {
      titulo: 'Anamnese',
      itens: [
        { titulo: 'Montar', texto: 'Em Planejamento, aba Anamnese, toque em Nova anamnese. Ela começa em branco: crie seções (dados, rotina, treino, alimentação) e perguntas. Além dos tipos da atualização, há Data, Telefone, E-mail, Endereço (só na anamnese), Grade (linhas e colunas, uma resposta por linha), Aceite de regras (texto e frase que o aluno marca) e Texto ou imagem (só para ler). Confira na Prévia e publique. Usar anamnese é opcional.' },
        { titulo: 'Mostrar só em alguns casos', texto: 'Numa pergunta (ou numa seção), ligue "Mostrar só conforme uma resposta anterior" e escolha uma pergunta de escolha ou de sim ou não que vem antes, e as respostas que mostram esta. Pergunta escondida não é obrigatória e a resposta dela não é enviada; nas respostas aparece como "Não se aplica".' },
        { titulo: 'Imagens', texto: 'Uma pergunta pode ter uma imagem de referência, e cada opção de escolha também (escalas, aparelhos). Use só imagens suas ou com licença de uso: você responde pelo que envia. Elas ficam guardadas sem os dados de câmera e só aparecem para a sua equipe e para o aluno que responde.' },
        { titulo: 'Enviar ao aluno', texto: 'Na ficha do aluno, no cartão Anamnese, toque em Enviar anamnese e escolha uma publicada. O aluno vê "Responda sua anamnese" no início do app e responde logado, no celular ou na web, aos poucos (o rascunho fica no aparelho). A versão enviada não muda: se você publicar outra, ela vale para os próximos envios. Só uma pode estar aguardando o aluno de cada vez.' },
        { titulo: 'Pergunta de sexo', texto: `Na anamnese, numa pergunta de escolha única, ligue "Guardar no sexo do cadastro do aluno". Em cada opção, escolha No cadastro: Masculino, Feminino ou Outro. Uma opção sem valor, como "Prefiro não dizer", não muda o cadastro. Sexo vazio é preenchido no envio; se já houver outro, a mudança fica para revisar na ficha. Aplicar pede a permissão de alterar o aluno. ${FRASE_DO_CICLO}` },
        { titulo: 'Respostas no cadastro do aluno', texto: 'Ligue o destino da pergunta: na de Peso, o registro de peso; na de Texto curto, o Objetivo ou o CPF do cadastro; na de Telefone, o telefone; na de Endereço (só na anamnese), o endereço (completo: CEP, rua, número, cidade e UF; em branco, se a pergunta não for obrigatória); na de escolha única, o Sexo. Cada destino vale uma vez por anamnese; nome e e-mail do aluno nunca mudam por aqui. No peso, escolha a data: a de uma pergunta de data com "Só hoje ou antes" ou a do envio; o aluno vê embaixo da pergunta qual data vale e para onde vai cada resposta. No envio, o que estava vazio no cadastro é preenchido; o que já era igual fica como está; o que é diferente não troca nada e aparece na ficha como "alterações do cadastro para revisar", com Aplicar e Descartar em cada uma. Telefone pede a permissão de alterar aluno; CPF, endereço, objetivo e peso pedem também acesso aos dados sensíveis do aluno. A resposta original continua na anamnese.' },
        { titulo: 'Ver, revisar e dispensar', texto: 'Toque na anamnese do cartão para ver todas as perguntas com as respostas ("—" quando ficou em branco). Depois de ler, toque em Marcar como revisada. Uma que o aluno ainda não respondeu pode ser dispensada, com o motivo; fica registrado quem dispensou. As respostas são dado sensível: só quem tem acesso à anamnese e aos dados sensíveis do aluno as vê. Exportar dados leva as anamneses, e anonimizar apaga as respostas.' },
      ],
    },
    {
      titulo: 'Consultoria',
      itens: [
        { titulo: 'Marca', texto: 'Cor, fonte do nome, tema padrão dos alunos (nasce claro) e logo. Fica no menu do seu usuário e só o perfil Administrador altera.' },
        { titulo: 'Ciclo de atualização padrão', texto: 'Em Marca, no cartão Acompanhamento, "Nova atualização a cada (dias)" vale para os alunos sem ciclo próprio no cadastro: sugere o fim da pasta nova e da renovação. O ciclo escrito no aluno sempre vale mais.' },
        { titulo: 'Equipe', texto: 'Cada membro tem um perfil com permissões. Ninguém concede mais do que tem.' },
        { titulo: 'Auditoria', texto: 'Lista ações importantes por pessoa e período, guardadas por um ano.' },
        { titulo: 'Tema claro/escuro', texto: 'Qualquer pessoa troca em Ajustes (menu do seu nome, no topo; no celular, em Perfil). Vale só para o seu usuário.' },
      ],
    },
    {
      titulo: 'Financeiro (cobrar seus alunos)',
      itens: [
        { titulo: 'Quem vê', texto: 'Financeiro aparece no menu (em Consultoria) só quando o módulo está ligado para a consultoria e para quem tem a permissão Financeiro.' },
        { titulo: 'O que é', texto: 'Aqui você cobra os seus alunos: cria planos comerciais, contrata um plano na ficha do aluno e registra os pagamentos. O app não cobra nem recebe dinheiro; você registra o que recebeu. Não tem nada a ver com o plano de treino nem com a assinatura da Central.' },
        { titulo: 'Planos comerciais', texto: 'Em Planos, toque em Novo plano e informe o nome, o valor e a periodicidade (mensal, trimestral, semestral, anual ou parcela única). Arquivar guarda o plano sem apagá-lo; os arquivados aparecem em Mostrar arquivados.' },
        { titulo: 'Contratar na ficha', texto: 'Na ficha do aluno, toque em Contratar plano e escolha o plano. Se deixar o valor em branco, vale o do plano; um valor diferente pede o motivo. Escolha o dia do vencimento (de 1 a 31); em meses mais curtos, vale o último dia do mês.' },
        { titulo: 'Registrar pagamento', texto: 'Na cobrança em aberto, toque em Registrar pagamento e informe a data (até hoje), a forma (Dinheiro, Pix direto, Transferência ou Outro) e uma observação, se quiser. Desfazer baixa só vale para baixa feita à mão e pede o motivo. Cancelar cobrança só vale para cobrança em aberto e também pede o motivo.' },
        { titulo: 'Recebimento online', texto: 'Em Financeiro, aba Recebimento online, você liga o recebimento pela sua conta InfinitePay. Informe a InfiniteTag da conta (obrigatória) e, se quiser, a API Key. A API Key não aparece depois de salva: para trocar, informe de novo. Sem API Key, o link pode ser pago mais de uma vez e não vence. Com API Key, ele vence 30 dias depois do vencimento da cobrança (ou de hoje, se o vencimento já passou) e não aceita um segundo pagamento. O dinheiro cai direto na conta InfinitePay do treinador; a plataforma não toca no dinheiro.' },
        { titulo: 'Juros do parcelamento', texto: 'Ainda em Recebimento online, escolha quem paga os juros quando o aluno parcela no cartão. Aluno: ele paga os juros quando parcela no cartão. Você: você absorve os juros do parcelamento. Para escolher "Você", a API Key precisa estar salva; sem ela, a opção não vale. Mudar essa opção, a InfiniteTag ou a API Key apaga o link das cobranças abertas: copie o link de novo.' },
        { titulo: 'Copiar link de pagamento', texto: 'Na cobrança aberta, toque em Copiar link de pagamento e envie o link ao aluno. O link abre fora do app. Com API Key, ele vence e não aceita segundo pagamento; sem ela, não vence e pode ser pago mais de uma vez. Se você mudar a InfiniteTag, a API Key ou os juros, o link da cobrança aberta é apagado e precisa ser copiado de novo.' },
        { titulo: 'Pagamentos para conferir', texto: 'Quando um pagamento chega e não dá para dar baixa sozinho, ele fica em Pagamentos para conferir, com o motivo. O app não dá baixa nesses casos: você resolve à mão e marca como conferido. Os motivos são: a cobrança foi cancelada; a cobrança já estava paga (por baixa manual, por estorno ou contestação, ou por um segundo pagamento, que mostra valor e data); a InfinitePay informou estorno de um pagamento que já tinha dado baixa (a cobrança continua paga: confira na InfinitePay); o valor pago é diferente do cobrado; o link não é o da cobrança; a forma de pagamento não foi reconhecida; a cobrança não foi encontrada; ou a InfinitePay não respondeu depois de várias tentativas.' },
        { titulo: 'Estorno', texto: 'O app não estorna nem devolve dinheiro. Se você estornar o pagamento pelo app da InfinitePay, a cobrança continua como paga e o aviso de estorno vai para Pagamentos para conferir. Depois de conferir, abra a cobrança paga e toque em Marcar estorno, com o motivo: ela fica "Estornada", deixa de contar o período e não volta a ficar paga. O app não cria outra cobrança para esse período. Por fim, marque o aviso como conferido.' },
        { titulo: 'Contestação', texto: 'A InfinitePay não avisa a contestação pela API. Quando o aluno contestar o pagamento no banco ou no cartão, abra a cobrança paga e toque em Marcar contestação, com o motivo: ela fica "Contestada" e continua contando o período. Quando a contestação terminar, abra a cobrança de novo: Manter como paga (terminou a seu favor) ou Marcar estorno (o dinheiro voltou ao aluno).' },
        { titulo: 'Valor líquido', texto: 'O app mostra o valor bruto da cobrança. O valor líquido, depois das taxas, aparece como "líquido indisponível": a InfinitePay não informa o líquido pela API e o app não tem as taxas. Veja o líquido no app da InfinitePay.' },
        { titulo: 'Próxima cobrança', texto: 'Nenhuma cobrança nasce sozinha por data. A próxima só é gerada quando a anterior é paga ou cancelada, ou quando você retoma a contratação. Por isso, atraso e inadimplência consideram só as cobranças já geradas.' },
        { titulo: 'Pausar, retomar e encerrar', texto: 'Na contratação, Pausar e Retomar mudam a situação do plano do aluno. Enquanto está pausado, não nasce cobrança nova. Pausar e Encerrar pedem confirmação, e as cobranças que já estão abertas continuam valendo: cancele uma a uma se precisar. Ao retomar, a próxima cobrança nunca cai num período que já foi pago nem no de uma cobrança que está aberta: ela começa no dia da retomada ou, se for depois, logo após o fim do período da última cobrança que não foi cancelada (paga ou aberta).' },
        { titulo: 'Visão geral', texto: 'Mostra o recebido, o a receber, o em atraso, a inadimplência, a receita recorrente mensal e um gráfico por mês. Em Como calculamos estes números, dá para ver cada regra. “Líquido para você” aparece como “indisponível”: o app não desconta taxa nenhuma; sem taxa informada, os valores são só os brutos.' },
        { titulo: 'Lançamentos', texto: 'Entradas e saídas avulsas da consultoria, sem aluno, com descrição, valor, data e categoria livre (opcional). “Resultado do mês” é entradas menos saídas registradas, somando os recebimentos das cobranças. Não é resultado contábil.' },
        { titulo: 'Exportar CSV', texto: 'Em Exportar CSV, baixe as cobranças (por vencimento) e os lançamentos (por data) do período. A exportação aceita até 5.000 linhas; se passar disso, escolha um período menor. O arquivo tem dados financeiros dos alunos: guarde com cuidado.' },
      ],
    },
  ],
  perguntas: [
    { pergunta: 'Editei um plano e o aluno ainda vê o antigo.', resposta: 'O aluno só vê o que está publicado. Toque em Publicar para gerar a versão nova.' },
    { pergunta: 'Se eu mudar o treino de um aluno, o modelo muda?', resposta: 'Não. Aplicar um modelo cria uma cópia só daquele aluno. Mudar a cópia não altera o modelo, e mudar o modelo não altera quem já recebeu.' },
    { pergunta: 'Não vejo o menu Marca.', resposta: 'Marca fica no menu do seu usuário (no computador, o cartão com o seu nome; no celular, em Perfil, em Sua conta) e só aparece para o perfil Administrador.' },
    { pergunta: 'Como importo uma planilha de alunos?', resposta: 'Em Importação (no celular, em Perfil › Atalhos), escolha Alunos, baixe o modelo e envie o arquivo. A prévia mostra o que entra; só o último botão grava. O arquivo não fica guardado.' },
    { pergunta: 'Como recebo interessados sem planilha nem formulário de fora?', resposta: 'Em Interessados, ligue o link de inscrição, copie e divulgue. Quem se inscreve aparece na lista; você conversa pelo WhatsApp e, quando fechar, toca em Aceitar.' },
    { pergunta: 'O aluno não consegue entrar.', resposta: 'Na ficha dele, em Dados do aluno, gere um convite novo ou toque em Definir nova senha e passe a senha provisória (as sessões abertas dele são encerradas). Confirme também que o aluno está ativo.' },
    { pergunta: 'Aparece "Alterado em outra aba" no plano.', resposta: 'O mesmo plano foi alterado em outro lugar. Use a opção de recarregar, confira o que mudou e edite de novo.' },
    { pergunta: 'Mudei o questionário; e quem já respondeu?', resposta: 'Quem já enviou mantém a versão que respondeu. Quem ainda não enviou passa a ver a versão nova assim que você publica, e as respostas já digitadas que continuam valendo são mantidas. Um questionário que já foi respondido não se exclui: arquive.' },
    { pergunta: 'O aluno pediu para apagar os dados dele.', resposta: 'Ele mesmo pode fazer isso no app, em Conta › Excluir minha conta; depois a ficha aparece como "Aluno anonimizado". Ou inative o aluno e, na ficha, use Anonimizar (quem tem a permissão). Se ele pedir uma cópia antes, use Exportar dados.' },
    { pergunta: 'Por que há um traço "—" nas cargas?', resposta: 'O aluno não informou o valor. O app nunca inventa carga nem repetição.' },
    { pergunta: 'Apareceu "Seu plano permite até N alunos ativos" (ou membros da equipe).', resposta: 'É o limite do plano da consultoria. Inative um aluno que não treina mais, ou veja o plano e o consumo em Minha conta (só aparece para quem tem permissão). Nada do que já existe é apagado: o limite só impede de cadastrar ou reativar além dele.' },
    { pergunta: 'Não vejo Mobilidade, Equipe ou o botão de PDF.', resposta: 'Esses recursos dependem do plano da consultoria. Quando não estão incluídos, o app esconde o botão ou mostra "Disponível em outro plano". O que já foi feito continua guardado e legível.' },
    { pergunta: 'A verificação de segurança não aparece ou não carrega.', resposta: 'Ao entrar, cadastrar a consultoria ou pedir nova senha, o app pede para confirmar que você é uma pessoa. Se não carregar, confira a internet, desligue bloqueadores de conteúdo da página e toque em Tentar de novo. Cada confirmação vale para um envio só: depois de um erro, espere a nova.' },
  ],
};

/** Explicações do aluno que aparecem em mais de um lugar (primeiros passos, tutorial e passeio pelo menu): um texto só. */
const TEXTO_TREINO_DE_HOJE = 'No Início, o cartão Hoje mostra a divisão do dia. Toque em "Ver meu treino" para abrir a lista de exercícios.';
const TEXTO_ABA_TREINO = 'Na aba Treino estão as divisões da semana, as orientações do treinador e o PDF. A mobilidade aparece aqui quando o treinador publica um plano.';
const TEXTO_DIETA = 'Mostra as refeições publicadas pelo treinador e a água do dia, quando ele escreveu. Só consulta. No início do app, o cartão Dieta leva até ela. O botão Lista de compras soma o que comprar na semana ou no mês.';
const TEXTO_ATUALIZACAO = 'Ao fim do período o treinador pede uma atualização. Um ponto aparece na aba Início quando houver algo a fazer, e o item fica em "Suas pendências": uma atualização ou uma anamnese para responder.';

const ALUNO: Guia = {
  titulo: 'Guia do aluno',
  arquivoPdf: 'guia-aluno.pdf',
  introducao:
    'Aqui você vê o treino e a dieta que o seu treinador montou e registra a carga e as repetições de cada série. Funciona também sem internet: o que você marca fica no aparelho e é enviado depois.',
  primeirosPassos: [
    { titulo: 'Entre com o convite', texto: 'Use o código ou o link que o treinador enviou, crie a sua senha e entre. Se o treinador passou um e-mail e uma senha provisória, entre com eles: o app pede para você criar a sua senha antes de abrir.', soNoPdf: true },
    { titulo: 'Veja o treino de hoje', texto: TEXTO_TREINO_DE_HOJE, rota: '/aluno' },
    { titulo: 'Registre cada série', texto: 'Em cada exercício, informe o peso e as repetições feitas e toque no botão de marcar a série.', rota: '/aluno' },
    { titulo: 'Confira o histórico', texto: 'Na aba Histórico você revê o que já registrou.', rota: '/aluno/historico' },
    { titulo: 'Escolha o tema', texto: 'Em Conta, deixe o app claro ou escuro e ajuste o tamanho do texto.', rota: '/aluno/conta' },
  ],
  tutorial: [
    { titulo: 'Boas-vindas', texto: 'Este tutorial mostra as abas do app. Use Próximo e Anterior; "Abrir esta tela" leva você até ela.' },
    { titulo: 'Início', texto: 'Mostra a dieta e a água do dia, o treino de hoje, suas pendências e o andamento da semana. Na tela de uma divisão, "Outras datas" deixa registrar dias próximos (até 60 dias para trás ou para frente).', rota: '/aluno' },
    { titulo: 'Treino', texto: TEXTO_ABA_TREINO, rota: '/aluno/treino' },
    { titulo: 'Registrar uma série', rota: '/aluno', texto: 'Cada exercício tem uma tela. Preencha Peso e Reps e marque a série. A carga sugerida vem do plano: a carga de trabalho é a que você informa para o dia, e as séries em porcentagem, na mesma carga da WS, acima da anterior ou abaixo da referência já vêm calculadas a partir do que você registrou, e você pode ajustar. O valor usado é gravado no registro. Sem dado aparece "—". Toque no nome do tipo, da técnica ou do grupo para ler a explicação do treinador. Os botões − e + mudam o peso de passo em passo, e "Repetir a série anterior" copia peso e repetições da série de cima e já marca como feita. No cardio você só marca como feito. Embaixo, Próximo leva ao exercício seguinte; Anterior volta e Lista do dia mostra todos: dá para fazer fora de ordem. A tela fica acesa enquanto você treina.' },
    { titulo: 'Descanso', texto: 'Quando o plano define descanso, o contador começa ao marcar a série. Em superset, tri-set, circuito e outros grupos, o descanso é o do grupo e começa quando você termina a volta; na pré e na pós-exaustão, cada série mantém o próprio descanso. Ele não usa notificação com o app fechado.' },
    { titulo: 'Dieta', texto: TEXTO_DIETA, rota: '/aluno/dieta' },
    { titulo: 'Mobilidade', texto: 'Fica na aba Treino, só se o treinador publicou um plano de mobilidade. Toque no ✓ de cada item para marcar como feito no dia; no topo você vê "Hoje: N de M feitos" e pode escolher outro dia recente. Vídeos abrem fora do app.', rota: '/aluno/treino' },
    { titulo: 'Histórico', texto: 'Cargas e treinos que você já fez, por divisão, com o nome do tipo de cada série.', rota: '/aluno/historico' },
    { titulo: 'Atualização', texto: TEXTO_ATUALIZACAO, rota: '/aluno' },
    { titulo: 'Compromissos', texto: 'Quando o treinador marca um horário presencial com você (consulta, retorno, avaliação), ele aparece no Início, em Seus compromissos, com dia, hora (de Brasília), local e com quem. Quem marca, remarca ou cancela é o treinador; o cancelado aparece marcado.', rota: '/aluno' },
    { titulo: 'Sem internet', texto: 'Pode treinar e marcar a mobilidade sem conexão. O aviso na parte de baixo de todas as telas mostra se está sem internet, enviando ou tudo enviado; se falhar, toque nele para tentar de novo. Em Conta você também vê o que está aguardando envio e toca em Sincronizar agora.', rota: '/aluno/conta' },
    { titulo: 'Meus dados', texto: `Em Conta, logo depois da foto de perfil, o cartão "Meus dados" mostra o seu cadastro. Toque em Editar para mudar telefone, endereço (o CEP preenche o resto) e sexo; o CPF você só preenche se ainda estiver vazio. Nome e e-mail só o seu treinador muda. Salvar vale na hora e precisa de internet. ${FRASE_DO_CICLO}`, rota: '/aluno/conta' },
    { titulo: 'Conta e Ajuda', texto: 'Em Conta ficam foto de perfil, seus dados, tema, senha e sair. Esta Ajuda fica sempre à mão.', rota: '/aluno/conta' },
  ],
  passeio: [
    { titulo: 'Início', texto: TEXTO_TREINO_DE_HOJE, alvo: 'menu:/aluno' },
    { titulo: 'Treino', texto: TEXTO_ABA_TREINO, alvo: 'menu:/aluno/treino' },
    { titulo: 'Dieta', texto: TEXTO_DIETA, alvo: 'menu:/aluno/dieta' },
    { titulo: 'Atualização', texto: TEXTO_ATUALIZACAO, alvo: 'menu:/aluno' },
    { titulo: 'Histórico', texto: 'Cargas e treinos que você já fez, por divisão.', alvo: 'menu:/aluno/historico' },
    { titulo: 'Conta', texto: 'Foto de perfil, tema, senha, sincronização e a Ajuda, onde "Conhecer o menu" mostra este passeio de novo.', alvo: 'menu:/aluno/conta' },
  ],
  secoes: [
    {
      titulo: 'Compromissos presenciais',
      itens: [
        { titulo: 'Onde aparecem', texto: 'No Início, em Seus compromissos, ficam os próximos horários que o treinador marcou com você: dia, hora (sempre a de Brasília), duração, local e com quem. Sem nenhum marcado, o bloco não aparece.' },
        { titulo: 'Remarcar ou cancelar', texto: 'Só o treinador marca, remarca ou cancela. Precisa mudar? Fale com ele. O compromisso cancelado continua na lista com o selo Cancelado até o horário passar.' },
      ],
    },
    {
      titulo: 'Treino',
      itens: [
        { titulo: 'Treino de hoje', texto: 'No Início, o cartão Hoje tem o botão "Ver meu treino", que abre a lista de exercícios da divisão do dia. As outras divisões ficam na aba Treino.' },
        { titulo: 'Trocar de plano', texto: 'Se houver mais de uma pasta, o seletor no topo da aba Treino mostra as outras. Pasta antiga é só para consultar.' },
        { titulo: 'Peso e repetições', texto: 'Deixe em branco o que não souber: aparece "—". O app não presume valor.' },
        { titulo: 'Tipos de série', texto: 'O nome do tipo indica para que a série serve (aquecimento, FS, WS, Top set, Back off...). Toque nele para ler a explicação do treinador. FS usa um percentual da carga da WS do dia; uma faixa como 85–90% mostra o intervalo prescrito. A sugestão de carga usa o menor percentual da faixa e o arredondamento do treinador; registre o peso que usou. Top set é "acima da anterior": a carga sobe um percentual sobre a série anterior. Back off pode vir "abaixo da referência", como "15% abaixo da referência (Top set)": a carga desce um percentual sobre o que você registrou na série indicada. Sem registro dela, ou sem valor informado, aparece "—".' },
        { titulo: 'Carga, esforço e repetições', texto: 'A meta da série mostra repetições, carga e esforço, cada um no seu lugar. Esforço é RIR (quantas repetições ainda sobrariam ao terminar: 2 RIR = parar com 2 sobrando) ou RPE (esforço de 1 a 10, em que 10 é nenhuma repetição sobrando), nunca os dois na mesma série. RIR 0 aparece como "até a falha": faça até não conseguir mais repetir com boa técnica. AMRAP é o máximo de repetições e só aparece quando o treinador pede. O treinador também pode escrever um alvo extra, um texto curto junto da série.' },
        { titulo: 'Técnicas na série', texto: 'A técnica aparece dentro da própria série (por exemplo, WS com rest pause), junto do tipo. Negativa, 21s, pirâmide, GVT, FST-7 e as outras sem campo próprio não têm botão de pausa: leia a explicação e registre a série inteira. Toque no nome dela para ler a explicação. Nas técnicas sem etapas, registre a série inteira, com a carga com que você começou; quando a série pede a mesma carga da WS, o peso vem preenchido e continua editável. Rest pause: pause e continue com a mesma carga até a falha; três micro-séries têm duas pausas. Cluster e Rest-pause são registrados por etapa, dentro da mesma série: para cada bloco (ou para a etapa inicial e cada retomada) informe as repetições e o peso e toque no ✓; marcar uma etapa que não é a última liga a contagem da "Pausa entre blocos" (ou "Pausa antes da retomada"), quando a pausa é em segundos. Desfazer essa etapa encerra a contagem dela (a de outra etapa ou a que você iniciou à mão não), e marcar de novo começa outra. Se não conseguiu fazer uma etapa, toque em "Não fiz"; "Desfazer" volta a etapa a pendente. Quando todas as etapas têm situação, toque em "Concluir série": aí começa o descanso depois da série. O total é a soma das etapas feitas; enquanto falta alguma, aparece como execução parcial, sem total. Quando o treinador escreveu a meta ou a carga de cada etapa (por exemplo, "Bloco 3 · Meta 2 reps · 80% da WS"), a carga sugerida de cada uma já vem calculada. A carga de referência fica guardada desde a primeira etapa e não muda se você registrar outra série depois; o peso de cada etapa continua editável. Registro antigo, sem etapas, aparece como "Registro sem detalhe por bloco/etapa". Quando o exercício tem carga, a sugestão de carga de trabalho vem da base do dia e você pode ajustar. Se o descanso depois da série vale e não foi escrito, a leitura diz que não foi informado. No superset e nas combinações em que o descanso é depois da volta, essa frase não aparece. O botão de pausa só aparece quando há segundos. Drop set: ao terminar, reduza a carga (o quanto o treinador escreveu, quando escreveu) e continue, quantas vezes ele pediu, descansando entre as quedas se houver tempo indicado. Myo-reps: depois da série de ativação, várias mini-séries curtas com a mesma carga e poucas respirações entre elas. Partial reps: ao chegar à falha, repetições parciais na região indicada (alongada, encurtada ou livre). Forced reps: ao chegar à falha, um parceiro ajuda só o necessário; a série pede alguém para ajudar.' },
        { titulo: 'Cadência e isometria', texto: 'Cadência são 4 tempos em segundos: descendo, parado embaixo, subindo e parado em cima (X = o mais rápido que puder). Isometria é segurar parado pelos segundos indicados, no ponto que a observação disser. Os dois aparecem antes das séries.' },
        { titulo: 'Grupos de exercícios', texto: 'Exercícios em grupo são feitos um depois do outro. Superset e agonista-antagonista (2 exercícios), tri-set (3), giant set (4 ou mais) e circuito (3 ou mais, repetido pelo número de voltas) não têm descanso entre os exercícios: você descansa depois de cada volta, e o contador começa quando você termina a série de mesma posição de todos os exercícios do grupo. Pré-exaustão e pós-exaustão (2 exercícios) também são em sequência, mas cada série mantém o próprio descanso. Na lista do dia o grupo aparece junto, com o nome (toque para ler a explicação), a ordem dos exercícios, as voltas e o descanso. Em cada exercício aparece qual vem em seguida, e o botão "Ir" leva até ele.' },
        { titulo: 'Cardio', texto: 'No exercício de cardio a série mostra o que o treinador prescreveu (duração, distância, ritmo, zona e intervalos) e tem um único botão: marcar como feito. Não há peso, repetições nem esforço para preencher.' },
        { titulo: 'Imagem do exercício', texto: 'Quando o treinador põe uma imagem ou GIF no exercício (ou ele veio do catálogo, com duas fotos que se alternam), ela aparece acima do "Como fazer". Toque para ampliar. Sem internet, a foto do catálogo que você já viu continua aparecendo; a imagem do treinador some até a conexão voltar, e o resto da tela funciona igual. Se o seu aparelho está com movimento reduzido, a foto não alterna.' },
        { titulo: 'Vídeos', texto: 'O link do vídeo abre fora do app, no navegador ou aplicativo de vídeo.' },
        { titulo: 'PDF do treino', texto: 'Na aba Treino, toque em "Baixar PDF do treino". O documento inclui o glossário "Como ler este treino", só com os tipos, as técnicas e os grupos de exercícios usados (e RIR e RPE, quando aparecem, com "RIR 0 = até a falha"), e as instruções do treinador. Série de cardio sai com a prescrição, sem carga nem repetições.' },
      ],
    },
    {
      titulo: 'Dieta e mobilidade',
      itens: [
        { titulo: 'Dieta', texto: 'Mostra o que foi publicado pelo treinador, refeição por refeição, e a água por dia quando ele escreveu. O cartão Dieta no início do app mostra quantas refeições e a água.' },
        { titulo: 'Lista de compras', texto: 'Na Dieta, toque em Lista de compras e escolha Semana (7 dias) ou Mês (30 dias). Nas refeições com mais de uma opção, escolha a que vai comprar (a primeira já vem marcada). A quantidade é arredondada para cima; "cru" quer dizer que o treinador cadastrou o fator de cocção e a lista já converteu o alimento cozido para cru. Sem fator, vale a quantidade da dieta. Funciona sem internet com a última dieta salva, e dá para baixar em PDF. No PDF da dieta, Simples traz só a dieta e Detalhado acrescenta a lista no fim; "Mostrar FC e FCc" só liga as colunas.' },
        { titulo: 'Mobilidade', texto: 'Fica na aba Treino quando existe plano publicado. Toque no ✓ de cada item para marcar como feito; desmarcar é tocar de novo. Dá para marcar hoje e os dias recentes (até 60 dias para trás ou para frente, dentro do período), e a marca vale na mobilidade em uso, não numa pasta antiga. Dá para baixar em PDF.' },
      ],
    },
    {
      titulo: 'Sem internet',
      itens: [
        { titulo: 'Registro no aparelho', texto: 'Cada série marcada e cada item de mobilidade marcado é gravado na hora no aparelho.' },
        { titulo: 'Envio', texto: 'Com conexão, o app envia sozinho. Reenviar não duplica o registro.' },
        { titulo: 'Antes de sair da conta', texto: 'Sincronize antes: treinos e marcas de mobilidade não enviados são apagados do aparelho ao sair.' },
      ],
    },
    {
      titulo: 'Atualização',
      itens: [
        { titulo: 'Responder', texto: 'Abra a atualização, responda e envie. O peso informado entra no seu histórico.' },
        { titulo: 'Fotos', texto: 'Quando a atualização pede fotos, escolha da galeria ou tire na hora. Na galeria dá para marcar várias de uma vez, até o limite da pergunta (no máximo 6). No celular elas ficam guardadas só dentro do app, sem ir para a galeria, e sobem quando você envia a atualização; na web é preciso estar conectado para anexar. Toque no X para remover antes de enviar. Só você e seu treinador veem as fotos. No Histórico, o cartão Fotos compara de 2 a 4 datas da mesma posição, com a data e o peso. Quem gera a imagem para divulgação é o treinador, com as fotos que ele está comparando ou com o carrossel das duas datas.' },
        { titulo: 'Vou atrasar', texto: 'Se precisar de mais tempo, avise pelo botão. Isso só avisa o treinador.' },
        { titulo: 'Lembretes', texto: 'No celular, o app lembra 3 dias antes, no dia e 1 dia depois, às 9h. Na web, só aparece um cartão.' },
      ],
    },
    {
      titulo: 'Anamnese',
      itens: [
        { titulo: 'Responder', texto: 'Quando o treinador pede, aparece no início o cartão "Responda sua anamnese". Responda com calma: o rascunho fica salvo no aparelho e dá para continuar depois, inclusive sem internet (para enviar, precisa de conexão). Algumas perguntas só aparecem conforme o que você responde antes.' },
        { titulo: 'Peso e objetivo', texto: 'Algumas respostas podem ir para o seu cadastro (peso, objetivo, telefone, CPF, endereço ou sexo): embaixo da pergunta o app avisa, e no peso diz qual data vai valer (a que você informar na pergunta indicada ou a do dia do envio). Se o seu cadastro já tiver outro valor, nada é trocado sozinho: o seu treinador revisa.' },
        { titulo: 'Enviar', texto: 'Ao tocar em Enviar anamnese, o app confere o que falta. Depois de enviada, ela fica só para consulta; para mudar uma resposta, fale com o seu treinador. Só você e a equipe do seu treinador veem as respostas e as fotos.' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { titulo: 'Foto de perfil', texto: 'Opcional. Em Conta, escolha uma foto da galeria ou tire na hora; ela aparece no seu início e para a equipe do seu treinador. Precisa de internet e não fica salva no aparelho. Dá para trocar ou remover quando quiser.' },
        { titulo: 'Uso das suas fotos', texto: 'Em Conta, o cartão "Uso das suas fotos" liga ou desliga a autorização para a consultoria usar suas fotos de evolução em comparações para divulgação, por exemplo no Instagram. Você desliga quando quiser. Sem internet o cartão some. A comparação no Histórico continua disponível; quem gera a imagem é o treinador, e só com a autorização ligada.' },
        { titulo: 'Tema e texto', texto: 'Claro, escuro ou do sistema; tamanho do texto, contraste, animações e vibração.' },
        { titulo: 'Senha', texto: 'Trocar a senha encerra as outras sessões.' },
        { titulo: 'Excluir minha conta', texto: 'O último cartão de Conta apaga a sua conta, com internet. Digite a sua senha e a palavra EXCLUIR. Seu nome, e-mail e senha, o peso, a dieta, as respostas das atualizações e da anamnese, as observações dos treinos e as fotos são apagados; os treinos e as cargas que você registrou ficam com a consultoria, sem o seu nome. Não tem volta: para usar o app de novo, peça um convite novo ao treinador.' },
      ],
    },
    {
      titulo: 'Meu plano e pagamentos',
      itens: [
        { titulo: 'Onde ver', texto: 'Em Conta, no cartão Meu plano. Ele só aparece quando a consultoria tem o módulo de pagamentos ligado.' },
        { titulo: 'O que aparece', texto: 'O plano comercial com o seu treinador (nome, valor, periodicidade e próximo vencimento), as cobranças em aberto e o histórico. O histórico mostra as últimas; “Ver todas” mostra o resto.' },
        { titulo: 'Como pagar', texto: 'Na web, o botão "Pagar" (Pix ou cartão) abre o pagamento em outra aba. No celular não há botão de pagar: o app mostra o valor e o vencimento da cobrança. Sem recebimento online, combine a forma de pagamento com o seu treinador. Quando ele recebe, registra o pagamento e a cobrança fica como paga.' },
        { titulo: 'Sem internet', texto: 'Os dados do plano só aparecem com internet e não são guardados no aparelho.' },
        { titulo: 'Pagamento em aberto', texto: 'Uma cobrança vencida, ou que vence em até 3 dias, aparece em Suas pendências como “Pagamento em aberto”. É só um aviso.' },
      ],
    },
  ],
  perguntas: [
    { pergunta: 'Marquei a série e não aparece para o treinador.', resposta: 'Pode estar aguardando envio. Abra Conta e toque em Sincronizar agora com internet.' },
    { pergunta: 'Não vejo o treino novo.', resposta: 'O treinador precisa ter publicado o plano. Confirme com ele e abra o app com internet.' },
    { pergunta: 'Esqueci a senha.', resposta: 'Na tela de entrar, toque em "Esqueci minha senha" e siga o link que chega no seu e-mail. Se não chegar, fale com o seu treinador.' },
    { pergunta: 'Errei a carga de uma série.', resposta: 'Abra o exercício e altere o valor no campo da série: o registro é atualizado.' },
    { pergunta: 'Onde leio de novo o termo de uso e o aviso de privacidade?', resposta: 'Em Conta, toque em Termos e privacidade. No primeiro acesso, e sempre que os textos mudam, o app pede o seu aceite antes de abrir.' },
    { pergunta: 'Como vejo de novo o passeio pelo menu?', resposta: 'Ele aparece uma vez em cada aparelho, no primeiro acesso, e dá para pular. Para rever, abra a Ajuda (em Conta) e toque em "Conhecer o menu".' },
    { pergunta: 'Por que não vejo a mobilidade?', resposta: 'Ela fica na aba Treino e só aparece quando o treinador publica um plano de mobilidade.' },
    { pergunta: 'Não consigo marcar a mobilidade.', resposta: 'Só dá para marcar na mobilidade em uso (as de pastas antigas são só para consultar), dentro do período dela e se a marcação estiver disponível (se não estiver, fale com o seu treinador). Se o aviso de envio mostrar uma falha, abra Conta para ver o motivo e toque em tentar de novo.' },
  ],
};

export const GUIAS: Record<Publico, Guia> = { treinador: TREINADOR, aluno: ALUNO };
