// Formulário "Quero ser aluno" do Saraiva Team (pedido de 04/11/2026) no formato 2 do questionário, o texto de
// apresentação do link e as regras puras que o script `inscricao-saraiva.mjs` usa. Sem dado de pessoa: só as perguntas.
//
// A página pública mostra primeiro os campos fixos (nome, WhatsApp, e-mail, previsão de início e origem; o Saraiva
// esconde sexo, objetivo, "o que procura" e modalidade) e, embaixo, estas perguntas. Quem responde ainda não é aluno e
// não tem login: por isso a inscrição não aceita FOTOS, ENDERECO, PESO, NOTAS_POR_DIA, DATA_AUTOMATICA, imagem,
// destino no cadastro nem ajuda automática (`ValidadorQuestionario.FORA_DA_INSCRICAO`, espelho `TIPOS_FORA_DA_INSCRICAO`).
//
// Decisão do Gustavo (04/11): "Você é hormonizado ou natural?" fica na inscrição pública, mesmo sendo dado de saúde.
// A pendência de LGPD está em `docs/planos/README.md`.

export const NOME = 'Inscrição Saraiva Team';
export const DESCRICAO = 'Formulário "Quero ser aluno" do Saraiva Team (14 perguntas depois dos campos fixos).';

/** Campos fixos escondidos da página: o Saraiva já pergunta isso (ou não precisa) nas perguntas abaixo. */
export const CAMPOS_ESCONDIDOS = ['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE'];

/** Texto de apresentação do link (até 2000). `**negrito**` vale: a página usa o mesmo formato do questionário. */
export const TEXTO_DO_LINK = [
  'Esta é uma lista do time da consultoria do SV Team e iremos te guiar rumo à sua melhor versão! Com foco em melhorar o seu estilo de vida. Ajudamos você a alcançar seus objetivos com estratégia e motivação.',
  '',
  'Seja para ganhar desempenho, melhorar a saúde, ganhar força, alcançar a sua estética ideal, ou conquistar aquela meta pessoal, estamos prontos para te acompanhar nessa jornada. Vamos juntos?',
  '',
  '**Obs: NÃO preencha este formulário caso NÃO tiver a pretensão de entrar AGORA.**',
  '',
  'Após responder todo o questionário, iremos entrar em contato.',
  '',
  'Seus dados são usados só para entrarmos em contato com você sobre a consultoria.',
].join('\n');

/** Tipos que a inscrição pública recusa (o mesmo conjunto de `TIPOS_FORA_DA_INSCRICAO` do app). */
export const TIPOS_FORA_DA_INSCRICAO = ['FOTOS', 'ENDERECO', 'PESO', 'NOTAS_POR_DIA', 'DATA_AUTOMATICA'];

/** Prefixo dos ids: a API recusa mudar o tipo de um id já publicado, então uma versão futura troca o prefixo. */
const P = 'i1-';

const opcoes = (...rotulos) => rotulos.map((rotulo, i) => ({ id: `o${i + 1}`, rotulo }));
const q = (id, tipo, rotulo, obrigatoria, extra = {}) => ({ id: P + id, tipo, rotulo, obrigatoria, ...extra });

export function conteudoDaInscricao() {
  return {
    formato: 2,
    instrucoes: [],
    secoes: [
      {
        uid: P + 'sobre-voce',
        titulo: 'Conte um pouco sobre você',
        perguntas: [
          q('instagram', 'TEXTO', 'Qual o seu Instagram? Pode enviar o @ ou o link do Instagram.', true),
          q('idade', 'ESCOLHA_UNICA', 'Qual a sua idade?', true, {
            opcoes: opcoes('Menos de 15 anos', '15 a 17 anos', '18 a 21 anos', '22 a 25 anos', '26 a 29 anos', '30 a 34 anos', '35 anos ou mais'),
          }),
          q('tempo-treino', 'TEXTO_LONGO', 'Treina musculação há quanto tempo? Você gosta de treinar?', true),
          q('planilha', 'SIM_NAO', 'Você tem alguma planilha do time?', false),
          // Só aparece com "Sim" na pergunta anterior; escondida, não é obrigatória e a resposta é descartada.
          q('planilha-experiencia', 'TEXTO_LONGO', 'Me conte como foi a sua experiência com a planilha.', false, {
            mostrarSe: { perguntaId: P + 'planilha', valores: ['sim'] },
          }),
          q('profissao', 'TEXTO', 'Qual a sua profissão?', true),
          q('consultoria-antes', 'ESCOLHA_UNICA', 'Você já contratou alguma consultoria antes?', true, {
            opcoes: opcoes(
              'Sim, tive uma boa experiência',
              'Não, nunca contratei um acompanhamento',
              'Sim, tive uma experiência ruim',
              'Sim, já tive acompanhamento presencial',
            ),
          }),
          q('academia', 'ESCOLHA_UNICA', 'Em que tipo de academia você treina?', true, {
            opcoes: opcoes(
              'Academia de bairro',
              'Academia de rede (Smart Fit, Blue Fit, Panobianco etc.)',
              'Academia premium (Retro Flex, Bodytech, Ironberg, Nation etc.)',
              'Academia de condomínio ou treino em casa',
            ),
          }),
          q('hormonizado', 'TEXTO', 'Você é hormonizado ou natural?', true),
          q('objetivo', 'TEXTO_LONGO', 'O que você busca com a consultoria SV Team? Qual o seu objetivo? Seja detalhista.', true),
          q('desafio', 'TEXTO_LONGO', 'Qual o seu maior desafio hoje? Seja detalhista.', true),
          q('por-que-eu', 'TEXTO_LONGO', 'Por que me vê como seu treinador?', true),
          q('o-que-fez-procurar', 'TEXTO_LONGO', 'O que te fez procurar o meu trabalho?', true),
          q('meta-um-ano', 'TEXTO_LONGO', 'O que você gostaria de conquistar com a consultoria em 1 ano? Alguma meta, algo no seu corpo te incomoda?', true),
          q('investimento', 'ESCOLHA_UNICA', 'Quanto você está disposto a investir mensalmente na consultoria?', true, {
            opcoes: opcoes('Até R$ 300', 'De R$ 300 a R$ 500', 'De R$ 500 a R$ 1.000', 'Mais de R$ 1.000', 'Não tenho nenhuma quantia para investir'),
          }),
        ],
      },
    ],
  };
}

/** Todas as perguntas do conteúdo, na ordem em que a página as mostra. */
export function perguntasDe(conteudo) {
  return (conteudo?.secoes ?? []).flatMap((s) => s.perguntas ?? []);
}

/** Contagens para o resumo do script (o questionário não tem dado de pessoa). */
export function resumo(conteudo) {
  const perguntas = perguntasDe(conteudo);
  return {
    secoes: (conteudo?.secoes ?? []).length,
    perguntas: perguntas.length,
    obrigatorias: perguntas.filter((p) => p.obrigatoria).length,
    condicionais: perguntas.filter((p) => p.mostrarSe).length,
  };
}

/**
 * O que a inscrição pública não aceita no conteúdo montado (a API confere de novo no `validar`; aqui o script não manda
 * o que ela vai recusar). Lista vazia = pode seguir.
 */
export function problemasDaInscricao(conteudo) {
  const problemas = [];
  for (const p of perguntasDe(conteudo)) {
    if (TIPOS_FORA_DA_INSCRICAO.includes(p.tipo)) problemas.push(`${p.id}: tipo ${p.tipo} não vale na inscrição.`);
    if (p.imagemId || p.imagem) problemas.push(`${p.id}: imagem não vale na inscrição.`);
    if (p.destino || p.destinoData) problemas.push(`${p.id}: destino no cadastro não vale na inscrição.`);
    if (p.ajudaAutomatica) problemas.push(`${p.id}: ajuda automática não vale na inscrição.`);
    for (const o of p.opcoes ?? []) if (o.imagemId || o.imagem) problemas.push(`${p.id}: imagem na opção não vale na inscrição.`);
  }
  return problemas;
}

/**
 * Forma comparável do conteúdo: sem campo nulo ou indefinido (a API devolve os ausentes como `null`), com as chaves em
 * ordem fixa. Duas execuções do script só não mudam nada se o que a API guardou for igual ao que o script monta.
 */
export function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.keys(valor).sort().filter((k) => valor[k] !== null && valor[k] !== undefined).map((k) => [k, canonico(valor[k])]),
    );
  }
  return valor;
}

export const mesmoConteudo = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

const mesmosCampos = (a, b) => a.length === b.length && [...a].sort().every((c, i) => c === [...b].sort()[i]);

/**
 * Plano da configuração do link a partir do que a API devolveu: troca só o texto e a lista de campos escondidos; ligado
 * ou desligado, responsável e o resto ficam como estão. `texto`/`campos` dizem se há o que gravar (idempotência).
 */
export function planoDaConfiguracao(atual) {
  const camposAtuais = atual?.camposOcultos ?? [];
  return {
    aberta: atual?.aberta === true,
    responsavelId: atual?.responsavelId ?? null,
    texto: (atual?.texto ?? null) !== TEXTO_DO_LINK,
    campos: !mesmosCampos(camposAtuais, CAMPOS_ESCONDIDOS),
    voltamAAparecer: camposAtuais.filter((c) => !CAMPOS_ESCONDIDOS.includes(c)),
  };
}
