// Conteúdo da anamnese do Saraiva Team (o Google Forms "Anamnese Online" dele, de 18/09/2026) no formato 2 do
// questionário, e as regras puras que o script `anamnese-saraiva.mjs` usa. Sem dado de aluno: só as perguntas.
//
// Diferenças de propósito em relação ao Forms (o aluno responde logado, no app):
// - nome e e-mail não são perguntados: o app já sabe quem responde;
// - "estado" entrou no endereço (CEP, rua, número, bairro, cidade e UF), que vai para o cadastro do aluno;
// - telefone, CPF, objetivo e peso também vão para o cadastro (o treinador confere o que mudou);
// - altura e horas de sono são números (com unidade), não texto livre;
// - o peso tem a data da pesagem e "tem balança em casa?" separados, em vez de três perguntas numa;
// - as 4 fotos continuam separadas (frente, costas, lado, livre), uma foto cada; vídeo o app não recebe;
// - o sono vai de 1 a 10, como as estrelas do Forms (o texto dizia "0-10");
// - "algum sintoma a adicionar" e "exercícios da divisão" deixaram de ser obrigatórias (o próprio texto dizia "deixe em
//   branco");
// - erros de digitação corrigidos ("Opçõs", "encaixa-lo", "sessão"); o texto sobre menores saiu (a consultoria não
//   atende menores de 18 anos); "as imagens irão para o nosso e-mail" virou "ficam guardadas com segurança" (é o que o
//   app faz);
// - as regras da consultoria são um aceite (o aluno marca a declaração), com o texto formatado.
//
// Imagens: não ficam no git (algumas são de terceiros, com marca d'água). O script reaproveita as que já estão na
// anamnese publicada pelo `imagem` de cada item (`chaveDeImagem`).

export const NOME = 'Anamnese Saraiva Team';
export const DESCRICAO = 'Anamnese inicial do aluno (igual ao formulário "Anamnese Online" do Saraiva Team).';

/** Prefixo dos ids desta versão: a API recusa mudar o tipo de um id já publicado, e a versão anterior usava outros. */
const P = 'a2-';

const opcoes = (...rotulos) => rotulos.map((r, i) => (typeof r === 'string' ? { id: `o${i + 1}`, rotulo: r } : { id: `o${i + 1}`, ...r }));
const linhas = (...rotulos) => rotulos.map((rotulo, i) => ({ id: `l${i + 1}`, rotulo }));
const comImagem = (...rotulos) => rotulos.map((rotulo, i) => ({ id: `o${i + 1}`, rotulo, imagem: rotulo }));

const SINTOMAS = [
  'Dor de cabeça', 'Insônia', 'Dor de garganta', 'Aftas', 'Acne', 'Perda de cabelo', 'Suor excessivo', 'Asma ou bronquite',
  'Náuseas, vômito', 'Diarreia', 'Constipação', 'Azia', 'Dor muscular (não induzida por exercício)',
  'Dor articular (não induzida por exercício)', 'Fadiga', 'Hiperatividade', 'Ansiedade', 'Depressão', 'Frequentemente doente',
];

/** Colunas da grade de sintomas. As três primeiras aparecem no Forms; as duas últimas estão cortadas nos prints. */
export const COLUNAS_DOS_SINTOMAS = ['Nunca', 'Raramente', 'Ocasionalmente', 'Frequentemente', 'Sempre'];

const REGRAS = [
  '**REGRAS DA CONSULTORIA**',
  '',
  '**1 -** **__Evite__** mandar áudios. Peço que __evite o máximo possível__: assim conseguimos responder com agilidade tanto a você quanto às demais pessoas da consultoria. Caso envie um áudio, vamos considerar que é um __assunto importante__ e que demandará bastante tempo; por isso, vamos demorar um pouco mais para responder, __para dar a devida atenção__.',
  '',
  '**2 -** Quem ignorar as mensagens enviadas e não preencher os formulários de check-in __não terá direito à renovação da consultoria__. Por favor, entenda que o **__comprometimento com o nosso trabalho__** é um __requisito para a permanência na consultoria__.',
  '',
  '**3 -** As atualizações (e ajustes) do protocolo têm **prazo de 72h**. Em dias úteis (finais de semana e feriados não entram aqui), você será respondido em **no máximo** **__24h (dias úteis)__**. No entanto, __geralmente será antes desses prazos__.',
  '',
  '**4 -** Entendo que as atualizações do físico podem demorar um pouco a ser respondidas, e que você talvez queira respondê-las em outro momento e acabe esquecendo. Peço apenas que **__nos avise__** que vai demorar a responder. Caso contrário, se eu não identificar o preenchimento do formulário de atualização do físico em até 15 dias após o envio, você será **permanentemente** __desligado(a) da consultoria__.',
  '',
  'Peço que **__não leve para o pessoal__** as regras acima: são apenas para a nossa boa convivência daqui para frente! Seguindo-as, tenho certeza de que desenvolveremos uma ótima relação entre coach e aluno(a).',
].join('\n');

const ROTINA = [
  'Esta é uma das partes mais importantes do formulário: por favor, seja o mais específico possível! Se a sua rotina for **exatamente** igual em alguns dias da semana, pode escrever "igual ao dia x". Pode escrever em tópicos, se ficar mais fácil.',
  '',
  '**Exemplo:**',
  '06:00 acordar, refeição 1, ir ao trabalho;',
  '08:00-12:00 trabalho presencial, não faço mais nenhuma refeição pela manhã;',
  '12:00 almoço no trabalho, levo marmitas de casa;',
  '14:00-16:00 trabalho;',
  '16:00-16:30 intervalo, como no trabalho;',
  '18:00 saio do trabalho;',
  '19:00 chego em casa e faço o pré-treino;',
  '20:00-21:30 jantar;',
  '22:00 pós-treino e lazer;',
  '23:30 dormir.',
].join('\n');

const FOTOS = [
  'Para que possamos juntos alinhar metas e objetivos, vamos analisar a sua composição corporal; por isso, algumas fotos precisam ser enviadas. As fotos ficam guardadas com segurança e só a equipe tem acesso a elas.',
  '',
  'É importante tirar fotos do físico para analisarmos a composição corporal de forma subjetiva e acompanharmos os resultados. **Caso não se sinta à vontade para tirar as fotos, por favor, converse conosco!**',
  '',
  '**Vestimenta recomendada:**',
  '- Homens: sem camiseta, de sunga preta ou shorts preto (suba o shorts o suficiente para ser possível ver a perna).',
  '- Mulheres: biquíni preto.',
  '',
  '**- Celular na altura do tronco.**',
  '**- Procure uma boa iluminação.**',
  '**- Fique longe o suficiente para aparecer o corpo todo.**',
  '**- As fotos e o peso devem ser em jejum.**',
  '',
  'Se quiser, pode enviar também uma pose (não é obrigatório e não substitui as fotos relaxadas). Se for atleta, mande também as poses da sua categoria na foto livre.',
].join('\n');

/** Pergunta com os campos de sempre; `extra` completa por tipo. */
const q = (id, tipo, rotulo, obrigatoria, extra = {}) => ({ id: P + id, tipo, rotulo, obrigatoria, ...extra });

export function conteudoDaAnamnese() {
  return {
    formato: 2,
    instrucoes: [
      'Preencha com atenção todas as informações: elas são a base do seu plano.',
      'Você pode parar e continuar depois: o que já respondeu fica salvo neste aparelho.',
    ],
    secoes: [
      {
        uid: P + 'pessoais', titulo: 'Dados pessoais',
        descricao: 'Apenas para fins fiscais, preciso de algumas informações pessoais. O que você responder aqui vai para o seu cadastro na consultoria.',
        perguntas: [
          q('nascimento', 'DATA', 'Qual a sua data de nascimento?', true, { somentePassado: true }),
          q('telefone', 'TELEFONE', 'Qual o seu número de telefone com DDD?', true, { destino: 'TELEFONE' }),
          q('cpf', 'TEXTO', 'Qual o seu CPF?', true, { destino: 'CPF' }),
          q('endereco', 'ENDERECO', 'Qual o seu endereço completo?', true, {
            ajuda: 'CEP, rua, número, bairro, cidade e estado: todos são obrigatórios para fins legais.', destino: 'ENDERECO',
          }),
        ],
      },
      {
        uid: P + 'fotos', titulo: 'Envio de fotos', descricao: FOTOS,
        perguntas: [
          q('modelo-fotos', 'INFORMATIVO', 'Modelo de envio de fotos 1, 2 e 3', false, { imagem: 'modelo' }),
          q('foto-frente', 'FOTOS', 'Foto de frente, braços colados ao corpo, sem contrair a musculatura. Certifique-se de que é possível ver as coxas.', false, { max: 1 }),
          q('foto-costas', 'FOTOS', 'Foto de costas, braços colados ao corpo, sem contrair a musculatura. Certifique-se de que é possível ver as coxas.', false, { max: 1 }),
          q('foto-lado', 'FOTOS', 'Foto de lado, braços levantados à frente do corpo, formando um ângulo de 90° com o tronco.', false, { max: 1 }),
          q('foto-livre', 'FOTOS', 'Foto livre (não obrigatória)', false, { max: 1 }),
        ],
      },
      {
        uid: P + 'corpo', titulo: 'Corpo e saúde',
        perguntas: [
          q('objetivo', 'TEXTO', 'Em poucas palavras, qual o seu objetivo?', false, { destino: 'OBJETIVO' }),
          q('altura', 'NUMERO', 'Qual a sua altura?', true, { unidade: 'm', min: 1, max: 2.5, casas: 2 }),
          q('peso', 'PESO', 'Qual o seu peso atual?', true, { ajuda: 'Pese-se em jejum.', destino: 'PESO', destinoData: P + 'data-peso' }),
          q('data-peso', 'DATA', 'Quando foi a última vez que você se pesou?', true, { somentePassado: true }),
          q('balanca', 'SIM_NAO', 'Você tem balança em casa?', true),
          q('alteracao-peso', 'TEXTO_LONGO', 'Você teve alguma alteração de peso recente (últimos 3 meses)? Explique.', true),
          q('ocupacao', 'TEXTO', 'Qual a sua ocupação (trabalho)?', true),
          q('gasto-alimentacao', 'ESCOLHA_UNICA', 'Você consegue manter um gasto médio de R$ 1.000 por mês com alimentação?', true, {
            opcoes: opcoes('Sim', 'Não', 'Consigo além disso'),
          }),
          q('sintomas', 'GRADE', 'Lista de patologias/sintomas', true, {
            ajuda: 'Marque uma opção em cada linha.', linhas: linhas(...SINTOMAS),
            colunas: COLUNAS_DOS_SINTOMAS.map((rotulo, i) => ({ id: `c${i + 1}`, rotulo })),
          }),
          q('outro-sintoma', 'TEXTO', 'Algum sintoma que queira adicionar?', false),
          q('bristol', 'ESCOLHA_UNICA', 'Em que nível estão as suas fezes na escala de Bristol?', true, {
            imagem: 'bristol', opcoes: opcoes('Tipo 1', 'Tipo 2', 'Tipo 3', 'Tipo 4', 'Tipo 5', 'Tipo 6', 'Tipo 7'),
          }),
          q('armstrong', 'ESCOLHA_UNICA', 'Em que nível está a cor da sua urina na escala de Armstrong?', true, {
            imagem: 'armstrong', opcoes: opcoes('Opções 1 a 3', 'Opções 4 a 6', 'Opções 7 e 8'),
          }),
        ],
      },
      {
        uid: P + 'treino', titulo: 'Treinamento',
        perguntas: [
          q('outro-exercicio', 'TEXTO', 'Qual exercício físico você pratica, além da musculação?', false, { ajuda: 'Caso não tenha, deixe em branco.' }),
          q('tempo-esporte', 'TEXTO', 'Há quanto tempo você pratica este esporte?', false),
          q('academia', 'ESCOLHA_UNICA', 'Qual o tipo de academia que você frequenta?', true, {
            opcoes: opcoes('Academia de bairro', 'Academia de rede', 'Centro de treinamento (CT)'),
          }),
          q('horario', 'TEXTO', 'Em qual horário você treina?', true),
          q('frequencia', 'ESCOLHA_UNICA', 'Com que frequência você treina?', true, {
            opcoes: opcoes('1x na semana', '2x na semana', '3x na semana', '4x na semana', '5x na semana', '6x na semana', '7x na semana'),
          }),
          q('tempo-disponivel', 'TEXTO', 'Quanto tempo você tem disponível para treinar?', true),
          q('foco-1', 'TEXTO', 'Qual musculatura você tem maior foco em desenvolver atualmente?', true),
          q('foco-2', 'TEXTO', 'Qual musculatura seria o seu segundo maior foco em desenvolver atualmente?', true),
          q('divisao', 'TEXTO', 'Qual a sua divisão de treino atual?', true),
          q('exercicios-divisao', 'TEXTO_LONGO', 'Dentro dessa divisão de treino, quais os exercícios e a quantidade de séries de cada um deles?', false, {
            ajuda: 'Se não souber dizer, deixe em branco.',
          }),
          q('limitacao', 'TEXTO_LONGO', 'Você possui alguma limitação e/ou desconforto articular? Se sim, qual?', true),
          q('anabolizantes', 'TEXTO_LONGO', 'Você faz ou já fez uso de esteroides anabolizantes? Quais? Quais doses? E qual o protocolo atual?', true),
          q('outro-esporte', 'TEXTO', 'Você pratica algum esporte além dos mencionados acima? Se sim, com que frequência e duração?', false),
        ],
      },
      {
        uid: P + 'maquinas', titulo: 'Maquinário da academia',
        descricao: 'Caso você não tenha optado pelo plano com treinamento incluso, não é necessário preencher os campos abaixo: pode pular para a próxima seção.',
        perguntas: [
          q('maq-costas', 'MULTIPLA_ESCOLHA', 'Quais aparelhos de costas você tem na sua academia?', false, {
            opcoes: comImagem('Pullover Machine', 'T-Bar Row', 'Remada pronada e/ou neutra', 'Remada alta', 'Remada baixa'),
          }),
          q('maq-peito', 'MULTIPLA_ESCOLHA', 'Quais aparelhos de peito você tem na sua academia?', false, {
            opcoes: comImagem('Supino reto máquina', 'Supino declinado máquina', 'Supino reto deitado máquina', 'Supino inclinado máquina', 'Chest Dips'),
          }),
          q('maq-deltoide', 'MULTIPLA_ESCOLHA', 'Quais máquinas de deltoide você tem na sua academia?', false, {
            opcoes: comImagem('Desenvolvimento máquina (bateria de pesos)', 'Desenvolvimento máquina (plate loaded)', 'Elevação lateral máquina'),
          }),
          q('maq-inferiores', 'MULTIPLA_ESCOLHA', 'Quais máquinas de membros inferiores você tem na sua academia?', false, {
            opcoes: comImagem('Pendulum Squat', 'Hack Squat', 'Leg Press Horizontal', 'Elevação Pélvica', 'Hip Press', 'Belt Squat'),
          }),
          q('maq-faltou', 'TEXTO', 'Faltou alguma máquina que você gostaria que estivesse no seu treinamento? Qual(is)?', false),
        ],
      },
      {
        uid: P + 'habitos', titulo: 'Hábitos de vida',
        descricao: 'Nesta seção busco saber algumas informações que indiretamente podem afetar a sua saúde e diretamente intervir na montagem do seu plano alimentar.',
        perguntas: [
          q('sono-nota', 'NOTA', 'Em uma escala de 1 a 10, quão reparador é o seu sono em média?', true, { min: 1, max: 10 }),
          q('sono-horas', 'NUMERO', 'Quantas horas, em média, você dorme por noite?', true, { unidade: 'h', min: 0, max: 24, casas: 1 }),
          q('sono-obs', 'TEXTO', 'Alguma observação pertinente ao seu sono que queira adicionar?', false),
          q('fuma', 'TEXTO', 'Você fuma? Se sim, com que frequência?', false),
          q('alcool', 'TEXTO', 'Você consome bebidas alcoólicas? Se sim, com que frequência?', false),
        ],
      },
      {
        uid: P + 'rotina', titulo: 'Sua rotina', descricao: ROTINA,
        perguntas: [
          q('rotina', 'TEXTO_LONGO', 'Preencha abaixo a sua rotina, com detalhes das refeições e horários, seguindo o exemplo acima.', true),
        ],
      },
      {
        uid: P + 'alimentacao', titulo: 'Hábitos alimentares',
        descricao: 'Nesta seção busco saber um pouco mais sobre a sua alimentação.',
        perguntas: [
          q('suplementos', 'TEXTO_LONGO', 'Você toma algum suplemento alimentar? Qual? Como (horários, doses)?', false),
          q('alergia', 'TEXTO', 'Você possui alguma alergia alimentar? Qual?', true),
          q('intolerancia', 'TEXTO', 'Você possui alguma intolerância alimentar? Qual?', true),
          q('nao-gosta', 'TEXTO', 'Qual alimento você não gosta? (não irei colocar no plano alimentar, pense com cuidado)', true),
          q('ansiedade', 'TEXTO_LONGO', 'Você come movido(a) a ansiedade de forma frequente? Explique.', false),
          q('medicamentos', 'TEXTO_LONGO', 'Você faz uso de algum medicamento de forma contínua? Qual? Qual a dose?', true),
          q('cirurgias', 'TEXTO_LONGO', 'Você já passou por algum procedimento cirúrgico? Conte-me sobre.', true),
          q('alimento-desejado', 'TEXTO', 'Existe algum alimento, mesmo que não seja considerado "saudável", que você gostaria muito que estivesse na sua dieta? (faremos o possível para encaixá-lo)', true),
          q('fisico-almejado', 'TEXTO', 'Se tiver algum físico que almeje, seja atleta ou influenciador, coloque abaixo o Instagram ou o link da foto e fale sobre isso:', true),
        ],
      },
      {
        uid: P + 'regras', titulo: 'Regras da consultoria',
        descricao: 'Abaixo, listo as regras para permanência na consultoria, para desenvolvermos a melhor relação possível entre coach e aluno(a).',
        perguntas: [
          q('regras', 'ACEITE', 'Está ciente das regras da consultoria?', true, {
            texto: REGRAS, declaracao: 'Sim, declaro estar ciente das regras da consultoria.',
          }),
        ],
      },
    ],
  };
}

/** Minúsculas, sem acento, só letras e números separados por um espaço: a chave para casar rótulos. */
export function chaveDeImagem(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Imagens já gravadas na anamnese publicada: por rótulo da pergunta e por rótulo da opção (chaves normalizadas). A
 * versão anterior foi montada por outro script, então o que vale é o texto, não o id.
 */
export function imagensDoConteudo(conteudo) {
  const perguntas = [];
  const opcoesComImagem = [];
  for (const secao of conteudo?.secoes ?? []) {
    for (const p of secao.perguntas ?? []) {
      if (p.imagemId) perguntas.push({ chave: chaveDeImagem(`${p.rotulo} ${p.ajuda ?? ''} ${p.texto ?? ''}`), imagemId: p.imagemId });
      for (const o of p.opcoes ?? []) if (o.imagemId) opcoesComImagem.push({ chave: chaveDeImagem(o.rotulo), imagemId: o.imagemId });
    }
  }
  return { perguntas, opcoes: opcoesComImagem };
}

function acharOpcao(lista, rotulo) {
  const chave = chaveDeImagem(rotulo);
  return lista.find((o) => o.chave === chave) ?? lista.find((o) => o.chave.includes(chave) || chave.includes(o.chave)) ?? null;
}

/**
 * Troca o `imagem` (palavra-chave na pergunta, rótulo na opção) pelo `imagemId` encontrado em `imagens`. Devolve o
 * conteúdo sem nenhum `imagem` e a lista do que não achou (o script avisa; a pergunta fica sem imagem).
 */
export function aplicarImagens(conteudo, imagens) {
  const faltando = [];
  const secoes = conteudo.secoes.map((secao) => ({
    ...secao,
    perguntas: secao.perguntas.map((p) => {
      const { imagem, ...pergunta } = p;
      if (imagem) {
        const achada = imagens.perguntas.find((i) => i.chave.includes(chaveDeImagem(imagem)));
        if (achada) pergunta.imagemId = achada.imagemId;
        else faltando.push(`pergunta "${p.rotulo}"`);
      }
      if (pergunta.opcoes) {
        pergunta.opcoes = pergunta.opcoes.map((o) => {
          const { imagem: imagemDaOpcao, ...opcao } = o;
          if (imagemDaOpcao) {
            const achada = acharOpcao(imagens.opcoes, imagemDaOpcao);
            if (achada) opcao.imagemId = achada.imagemId;
            else faltando.push(`opção "${o.rotulo}"`);
          }
          return opcao;
        });
      }
      return pergunta;
    }),
  }));
  return { conteudo: { ...conteudo, secoes }, faltando };
}

/** Contagens para o resumo do script (sem nenhuma resposta: o questionário não tem dado de aluno). */
export function resumo(conteudo) {
  let perguntas = 0;
  let imagens = 0;
  for (const s of conteudo.secoes) {
    for (const p of s.perguntas) {
      perguntas += 1;
      if (p.imagemId) imagens += 1;
      for (const o of p.opcoes ?? []) if (o.imagemId) imagens += 1;
    }
  }
  return { secoes: conteudo.secoes.length, perguntas, imagens };
}
