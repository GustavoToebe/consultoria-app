/**
 * Regras puras do conversor de planos da planilha do treinador: das abas "Planos", "Refeições", "Suplementos",
 * "Treinos_Rotinas" e "Treinos_Exercicios" saem, por aluno, o rascunho de **dieta** (`ConteudoDieta`) e de **treino**
 * (`ConteudoTreino`), no formato exato dos records Java (`api/.../dieta/ConteudoDieta.java`, `treino/ConteudoTreino.java`).
 * Nada aqui lê arquivo nem fala com a API; os testes (`node --test scripts/importacao/`) montam uma planilha fictícia.
 *
 * Regras que valem para tudo:
 * - **Valor ausente é nulo ("—"), nunca zero.** Zero só existe se estava escrito na planilha como número válido.
 * - **Nada some calado.** O que ficou de fora, foi cortado ou foi interpretado vira uma linha em `problemas` com aba,
 *   linha e motivo (nunca nome, peso, dieta nem observação).
 * - A aba "TACO" (tabela de terceiros) **nunca é aberta**: `lerXlsx(buf, { abas: ABAS_LIDAS })`.
 * - Só rascunho. Nada aqui publica; quem revisa e publica é o treinador.
 *
 * Como a metodologia do Saraiva aparece nas séries (a mesma de `ConfiguracaoConsultoria.padrao()`, espelhada em
 * `app/src/dominio/metodologiaPadrao.ts` e usada por `importar.mjs`): o `tipo` da série é o **código** do tipo (`FEEDER`,
 * `WORKING`, `TOP_SET`, `BACK_OFF`). "FS" tem `carga` `PERCENTUAL_WS` pela regra de preparação do total de FS (1 FS = 85; 2 =
 * 70/85; 3 = 50/70/85); "WS" = `CARGA_TRABALHO`; "Top set" sem número = `ACIMA_DA_ANTERIOR` sem percentual; "Back off" =
 * `PERCENTUAL_WS` com o % da coluna "Back Off %" (a planilha não aponta uma série de referência, então nunca
 * `ABAIXO_DA_REFERENCIA`). Esforço (RIR/RPE) é separado da carga e a planilha não o traz: `esforco` fica nulo.
 *
 * O **tipo** da série (Aquecimento, FS, WS, Back off, Top set) diz para que ela serve; a **técnica** (cluster, rest pause,
 * drop-set) diz como executar e fica em `serie.tecnica`, dentro da série de trabalho (`importar.mjs`). A planilha não tem
 * grupos de exercícios nem cardio: `sessao.grupos` sai vazio e `grupoUid` nulo.
 */
import METODOLOGIA_PADRAO from './metodologia-padrao.json' with { type: 'json' };
import { randomUUID } from 'node:crypto';

import { chaveDoNome } from './alunos-lib.mjs';
import { ALIAS, cargaDe, chave, codigoDoTipo } from './importar.mjs';
import { aba, cabecalho, converter, dataDoExcel, texto, vazia } from './planilha-lib.mjs';

/** Abas que o conversor abre. Qualquer outra (a "TACO" em especial) nem é descomprimida. */
export const ABAS_LIDAS = ['Alunos', 'Histórico Pesos', 'Planos', 'Refeições', 'Suplementos', 'Treinos_Rotinas', 'Treinos_Exercicios'];

export const FORMATO = 'planos-saraiva/1';
/** Título da pasta criada na importação: também é a marca de "já importado" (rodar de novo não duplica). */
export const TITULO_PASTA = 'Importada da planilha (rascunho)';

/** Espelho de `ConfiguracaoConsultoria.padrao()` (mudou um, mude o outro). */
export const METODOLOGIA = METODOLOGIA_PADRAO;
const MAX_SERIES_POR_TIPO = 10;
const tipoDaMetodologia = (nome) => METODOLOGIA.tipos.find((t) => t.nome === nome);
const repsDoTipo = (nome) => { const r = tipoDaMetodologia(nome).repeticoes; return r ? [r.min, r.max] : null; };

/** Limites do `@Size` dos records Java: passou, o `PUT` do rascunho do aluno inteiro seria recusado. */
const L = {
  sessoes: 20, sessaoNome: 80, exerciciosPorSessao: 40, exercicioNome: 120, exercicioObs: 1000, video: 500, orientacoesTreino: 8000,
  refeicoes: 12, refeicaoNome: 80, refeicaoObs: 1000, opcoes: 6, rotulo: 10, itens: 40, itemNome: 160,
  orientacoes: 30, orientacaoTexto: 2000, observacoes: 8000, suplementos: 40, ergogenicos: 40, campo: 120, suplObs: 500, titulo: 120,
};
/** Máximo de itens de suplementação por dieta na API (o que passar disso derrubaria o `PUT` do rascunho). */
export const LIMITE_DE_SUPLEMENTOS = L.suplementos;

const linhaUnica = (t) => t.replace(/\s+/g, ' ').trim();
const bloco = (t) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const celula = (linha, i) => (i < 0 ? undefined : linha.celulas[i]);
const emBranco = (linha) => linha.celulas.every(vazia);

/** Número da célula: `undefined` se vazia, `NaN` se não é número. Texto "2,5" vale. */
function numero(c) {
  if (vazia(c)) return undefined;
  if (c.tipo === 'numero') return c.valor;
  if (c.tipo === 'texto') {
    const t = c.valor.trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }
  return NaN;
}

/** Lógico da célula: `undefined` se vazia, `null` se não dá para saber. */
function logico(c) {
  if (vazia(c)) return undefined;
  if (c.tipo === 'logico') return c.valor;
  if (c.tipo === 'numero') return c.valor === 1 ? true : c.valor === 0 ? false : null;
  if (c.tipo === 'texto') {
    const t = chaveDoNome(c.valor);
    if (['sim', 's', 'true', 'verdadeiro', 'x'].includes(t)) return true;
    if (['nao', 'n', 'false', 'falso'].includes(t)) return false;
  }
  return null;
}

/** Faixa de repetições recuperada de uma data: o dia e o mês da data (um deles pode ser o "mínimo" ou o "máximo"). */
const PARTE_MAXIMA_DA_DATA = 50;
/** Janela de ano de uma data que o Excel fez de "6-8": o Excel põe o ano em que se digitou. Fora dela, não é um "6-8" que virou data. */
export const ANO_MINIMO_DA_DATA = 2015;
export const ANO_MAXIMO_DA_DATA = 2040;

/**
 * Faixa de repetições a partir de dia e mês de uma data que o Excel fez de "8-12" (ou "12-8"). Não importa se o Excel leu
 * dia/mês ou mês/dia: a faixa é sempre do menor para o maior. Só vale se os dois estão entre 1 e 50 e, quando a data tem
 * ano, se o ano está na janela razoável. Senão `{ erro: 'data' }` (vai para os problemas, repetições em branco).
 */
function faixaDaData(a, b, ano) {
  if (ano !== null && (ano < ANO_MINIMO_DA_DATA || ano > ANO_MAXIMO_DA_DATA)) return { erro: 'data' };
  if (![a, b].every((n) => Number.isInteger(n) && n >= 1 && n <= PARTE_MAXIMA_DA_DATA)) return { erro: 'data' };
  return { min: Math.min(a, b), max: Math.max(a, b), deData: true };
}

/**
 * Data escrita em texto (`6/8`, `06/08/2026`, `06-08-2026`, `2026-08-06`, com hora opcional): `{ a, b, ano }` com os dois
 * números que não são o ano, na ordem em que aparecem; `null` se o texto não tem cara de data.
 */
function partesDeDataEmTexto(t) {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?z?)?$/.exec(t);
  if (m) return { a: Number(m[2]), b: Number(m[3]), ano: Number(m[1]) };
  m = /^(\d{1,2})\s*([/-])\s*(\d{1,2})(?:\s*\2\s*(\d{4}|\d{2}))?$/.exec(t);
  if (!m || (m[2] === '-' && m[4] === undefined)) return null; // "6-8" sem ano é faixa escrita, tratada antes
  return { a: Number(m[1]), b: Number(m[3]), ano: m[4] === undefined ? null : m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4]) };
}

/**
 * Faixa de repetições da célula "Rep Range": `{ min, max }` ou `{ erro }`. "6a8", "6-8" e "6 à 8" são faixa; número
 * solto (8) é fixo (mínimo = máximo). O Excel costuma transformar "8-12" em data (08/12, no ano em que se digitou): a
 * data (número de série ou texto) é recuperada como faixa do menor para o maior entre o dia e o mês (`deData: true`, para
 * o aviso), desde que os dois estejam entre 1 e 50 e o ano esteja entre {@link ANO_MINIMO_DA_DATA} e
 * {@link ANO_MAXIMO_DA_DATA}; senão `{ erro: 'data' }`. O serial é convertido em UTC (`dataDoExcel`), sem fuso local;
 * `data1904` vem da planilha (o sistema de 1904 desloca o serial em 1462 dias).
 */
export function faixaDeRepeticoes(c, data1904 = false) {
  if (vazia(c)) return { erro: 'vazia' };
  if (c.tipo === 'numero') {
    if (Number.isInteger(c.valor) && c.valor >= 0 && c.valor <= 500) return { min: c.valor, max: c.valor };
    const iso = dataDoExcel(c.valor, data1904);
    if (!iso) return { erro: 'invalida' };
    const [ano, mes, dia] = iso.split('-').map(Number);
    return faixaDaData(dia, mes, ano);
  }
  if (c.tipo !== 'texto') return { erro: 'invalida' };
  const t = c.valor.trim().toLowerCase();
  let m = /^(\d{1,3})$/.exec(t);
  if (m) return { min: Number(m[1]), max: Number(m[1]) };
  m = /^(\d{1,3})\s*(?:a|à|-|–)\s*(\d{1,3})$/.exec(t);
  if (m && Number(m[1]) <= Number(m[2]) && Number(m[2]) <= 500) return { min: Number(m[1]), max: Number(m[2]) };
  const data = partesDeDataEmTexto(t);
  if (data) return faixaDaData(data.a, data.b, data.ano);
  return { erro: 'invalida' };
}

const HOSTS_VIDEO = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
/** Mesma regra do `VideoUrls` da API: https, host do YouTube, sem credencial. */
export function videoValido(url) {
  if (url.length > L.video) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOSTS_VIDEO.has(u.hostname.toLowerCase()) && !u.username && !u.password && (u.port === '' || u.port === '443');
  } catch {
    return false;
  }
}

const DIAS = /^(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?![a-z])/;
const NUMERO_DO_DIA = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 7 };
/** Dia da semana só quando o nome do treino começa por ele ("Segunda - Costas"); senão, sem dia fixo. */
export function diaDaSemana(nome) {
  const m = DIAS.exec(chaveDoNome(nome));
  return m ? NUMERO_DO_DIA[m[1]] : null;
}

// ---------------------------------------------------------------------------------------------------- suplementos

const tokens = (t) => chave(t).split(' ').filter(Boolean);
const contido = (a, b) => a.length > 0 && a.every((x) => b.includes(x));
const parecido = (nome, ref) => { const a = tokens(nome); const b = tokens(ref); return contido(a, b) || contido(b, a); };

/**
 * Dose ou unidade escrita junto do nome ("5g", "10.000ui", "2 caps", "500 mg", "1 scoop"): número seguido de unidade. Exige
 * a unidade, para "Ômega 3", "D3", "B12" e "K2" não perderem o número. Roda no texto já sem acento e em minúsculas.
 */
const DOSE = /\b\d+(?:[.,]\d+)*\s*(?:mg|mcg|ug|g|kg|ml|l|ui|iu|kcal|cap|caps|capsulas?|cps|comp|comprimidos?|tab|tabs|tabletes?|scoops?|doses?|gotas?|saches?|porcoes?|unid|unidades?|un|x)\b/g;

/**
 * Nome de suplemento comparável: sem acento, em minúsculas, sem texto entre parênteses, sem dose ou unidade e só com
 * letras e números separados por espaço ("Creatina monohidratada (5g) - 5 g" = "creatina monohidratada"). A mesma
 * função normaliza o nome da planilha e os itens da lista comum.
 */
export function nomeDeSuplementoNormalizado(nome) {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*(?:\)|$)/g, ' ')
    .replace(DOSE, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * O item da lista comum (`dados/suplementos-comuns.json`) que o nome da planilha traz como palavras inteiras **no começo**
 * ("Whey Protein isolado" -> "Whey Protein"; "Zincoxxx" e "Comprimido de Zinco" não casam com "Zinco"). Entre vários, o
 * mais longo (mais palavras). Devolve o item como está na lista, ou `null`. O nome do suplemento na dieta não muda: isto
 * só decide o destino.
 */
export function suplementoComumNoComeco(nome, comuns) {
  const palavras = nomeDeSuplementoNormalizado(nome).split(' ').filter(Boolean);
  let melhor = null;
  let tamanho = 0;
  for (const item of comuns) {
    const alvo = nomeDeSuplementoNormalizado(item).split(' ').filter(Boolean);
    if (alvo.length === 0 || alvo.length > palavras.length || !alvo.every((p, i) => p === palavras[i])) continue;
    if (alvo.length > tamanho) { melhor = item; tamanho = alvo.length; }
  }
  return melhor;
}

/**
 * Para onde vai uma linha de "Suplemento / Medicamento". Medicação e ergogênico é dado sensível (só quem tem
 * `ERGOGENICO_LER` vê), então o conservador é: só vai para `suplementacao` o que parece um suplemento conhecido; o que
 * casa com a lista de ergogênicos **ou não casa com nenhuma** vai para `ergogenicos`. O treinador move o que estiver no
 * lugar errado. Ordem (a de ergogênicos sempre vence): ergogênicos (`refs.ergogenicos`, por palavras contidas);
 * suplementos conhecidos (`refs.suplementos`, por palavras contidas: o nome tem todas as palavras do item, em qualquer
 * posição, ou o contrário); lista comum pelo começo do nome normalizado (`refs.comuns`, {@link suplementoComumNoComeco}).
 * Na planilha real o começo do nome não reconhece nada que as palavras contidas já não reconheçam (o prefixo é um caso
 * particular da contenção); ele só decide sozinho quando `refs.suplementos` não traz a lista comum.
 */
export function destinoDoSuplemento(nome, refs) {
  if (refs.ergogenicos.some((r) => parecido(nome, r))) return 'ergogenico';
  if (refs.suplementos.some((r) => parecido(nome, r))) return 'suplemento';
  if (suplementoComumNoComeco(nome, refs.comuns ?? [])) return 'suplemento-comum';
  return 'ergogenico-nao-reconhecido';
}

// ------------------------------------------------------------------------------------------------------- conversão

/**
 * Converte a planilha lida por `lerXlsx(buf, { abas: ABAS_LIDAS })`. `hoje` = `AAAA-MM-DD` (só para ler a aba Alunos como o
 * conversor de alunos). `refs` = `{ suplementos: string[], ergogenicos: string[] }`, nomes de referência para separar
 * suplemento de medicação. O conjunto de alunos é o do conversor de alunos (`converter()`): plano de quem ficou fora é
 * problema, não é importado. Devolve `{ arquivos, problemas, contagens }`; `arquivos` = lista de
 * `{ codigo, nome, pasta, treino, dieta }` só dos alunos que têm treino ou dieta.
 */
export function converterPlanos(planilha, hoje, refs = { suplementos: [], ergogenicos: [] }) {
  const problemas = [];
  const problema = (abaNome, linha, tipo, detalhe = '') => problemas.push({ aba: abaNome, linha, tipo, motivo: tipo + detalhe, codigo: null });
  // De quem é cada linha da planilha (código do aluno), anotado onde a conversão já o conhece; vira `codigo` do problema no fim.
  const donos = new Map();
  const nomesNaPlanilha = new Map();
  const dono = (abaNome, linha, codigo, nome = '') => {
    if (!codigo) return;
    donos.set(`${abaNome}|${linha}`, codigo);
    if (nome && !nomesNaPlanilha.has(codigo)) nomesNaPlanilha.set(codigo, nome);
  };
  const cortar = (abaNome, linha, rotulo, valor, max) => {
    if (valor.length <= max) return valor;
    problema(abaNome, linha, `${rotulo} com mais de ${max} letras (cortado)`);
    return valor.slice(0, max).trimEnd();
  };

  const alunos = new Map(converter(planilha, hoje).alunos.map((a) => [a.codigo, a]));
  const treinos = treinosDosAlunos(planilha, alunos, problema, cortar, dono);
  const dietas = dietasDosAlunos(planilha, alunos, refs, problema, cortar, dono);
  for (const p of problemas) p.codigo = donos.get(`${p.aba}|${p.linha}`) ?? null;

  const arquivos = [];
  for (const [codigo, aluno] of alunos) {
    const treino = treinos.porAluno.get(codigo) ?? null;
    const dieta = dietas.porAluno.get(codigo) ?? null;
    if (!treino && !dieta) continue;
    arquivos.push({
      formato: FORMATO,
      codigo,
      nome: aluno.nome,
      pasta: { titulo: TITULO_PASTA },
      treino: treino && { titulo: `Treino de ${aluno.nome}`.slice(0, L.titulo), conteudo: treino },
      dieta: dieta && { titulo: `Dieta de ${aluno.nome}`.slice(0, L.titulo), conteudo: dieta },
    });
  }
  const contagens = {
    alunosNaPlanilha: alunos.size,
    alunosComTreino: arquivos.filter((a) => a.treino).length,
    alunosComDieta: arquivos.filter((a) => a.dieta).length,
    alunosComAmbos: arquivos.filter((a) => a.treino && a.dieta).length,
    ...treinos.contagens,
    ...dietas.contagens,
  };
  // Nome de cada código, para dizer a quem pertence o problema: o dos alunos convertidos e, para quem ficou fora, o que a aba traz.
  const nomes = new Map([...nomesNaPlanilha, ...[...alunos].map(([codigo, a]) => [codigo, a.nome])]);
  return { arquivos, problemas, contagens, nomes };
}

/** Uma entrada por aluno com exatamente um plano/rotina ativo; o resto vira problema (nunca escolhe um). */
function ativosPorAluno(linhas, c, alunos, problema, abaNome, rotulo, dono) {
  const f = rotulo === 'rotina'; // feminino
  const porAluno = new Map();
  for (const linha of linhas) {
    if (emBranco(linha)) continue;
    const id = texto(celula(linha, c.id));
    const codigo = texto(celula(linha, c.aluno));
    dono(abaNome, linha.n, codigo, linhaUnica(texto(celula(linha, c.nomeAluno))));
    if (!id) { problema(abaNome, linha.n, `${rotulo} sem ID`); continue; }
    if (!codigo || !alunos.has(codigo)) { problema(abaNome, linha.n, `aluno do ${rotulo} não está entre os alunos convertidos`); continue; }
    if (logico(celula(linha, c.ativo)) !== true) { problema(abaNome, linha.n, `${rotulo} ${f ? 'inativa' : 'inativo'} (ignorad${f ? 'a' : 'o'})`); continue; }
    porAluno.set(codigo, [...(porAluno.get(codigo) ?? []), { id, linha }]);
  }
  const escolhidos = new Map();
  for (const [codigo, lista] of porAluno) {
    if (lista.length === 1) escolhidos.set(codigo, lista[0]);
    else for (const { linha } of lista) problema(abaNome, linha.n, `mais de ${f ? 'uma' : 'um'} ${rotulo} ativ${f ? 'a' : 'o'} para o aluno (nenhum${f ? 'a' : ''} usad${f ? 'a' : 'o'})`);
  }
  return escolhidos;
}

const colunasDe = (cab, nomes) => Object.fromEntries(Object.entries(nomes).map(([k, alternativas]) => [k, [].concat(alternativas).map((n) => cab.indices.get(n)).find((i) => i !== undefined) ?? -1]));

// ------------------------------------------------------------------------------------------------------- treino

function treinosDosAlunos(planilha, alunos, problema, cortar, dono) {
  const ABA_ROT = 'Treinos_Rotinas';
  const ABA_EX = 'Treinos_Exercicios';
  const linhasRot = aba(planilha, ['treinos_rotinas'], ABA_ROT);
  const linhasEx = aba(planilha, ['treinos_exercicios'], ABA_EX);
  const cr = cabecalho(linhasRot, ['id_rotina', 'id_aluno'], [], ABA_ROT);
  const ce = cabecalho(linhasEx, ['id_rotina', 'nome_exercicio'], [], ABA_EX);
  const r = colunasDe(cr, { id: 'id_rotina', aluno: 'id_aluno', nomeAluno: 'nome_aluno', obs: 'obs_gerais', recomendacoes: 'recomendacoes', ativo: 'ativo', divisao: 'divisao_semanal', acessorios: 'acessorios' });
  const e = colunasDe(ce, {
    rotina: 'id_rotina', letra: 'letra_treino', nomeTreino: 'nome_treino', ordem: 'ordem', nome: 'nome_exercicio', ws: 'ws', fs: 'fs', ts: 'ts', bo: 'bo',
    reps: 'rep_range', obs: 'obs_especifica', video: 'link_video', backoff: ['back_off', 'back_off_percentual'],
  });

  const rotinas = ativosPorAluno(linhasRot.slice(cr.inicio), r, alunos, problema, ABA_ROT, 'rotina', dono);
  const idsAtivos = new Map([...rotinas].map(([codigo, x]) => [x.id, codigo]));
  const todosIds = new Set(linhasRot.slice(cr.inicio).map((l) => texto(celula(l, r.id))).filter(Boolean));

  const exerciciosPorRotina = new Map();
  for (const linha of linhasEx.slice(ce.inicio)) {
    if (emBranco(linha)) continue;
    const id = texto(celula(linha, e.rotina));
    if (!id || !todosIds.has(id)) { problema(ABA_EX, linha.n, 'exercício de rotina que não existe na aba Treinos_Rotinas'); continue; }
    if (!idsAtivos.has(id)) continue; // rotina já tratada (inativa, duplicada ou de aluno fora): o problema foi anotado lá
    dono(ABA_EX, linha.n, idsAtivos.get(id));
    exerciciosPorRotina.set(id, [...(exerciciosPorRotina.get(id) ?? []), linha]);
  }

  const porAluno = new Map();
  const contagens = { exercicios: 0, series: 0, sessoes: 0, faixasRecuperadas: 0 };
  const aoRecuperarFaixa = () => { contagens.faixasRecuperadas++; };
  for (const [codigo, { id, linha: linhaRotina }] of rotinas) {
    const linhas = exerciciosPorRotina.get(id) ?? [];
    const porLetra = new Map();
    for (const linha of linhas) {
      const letra = linhaUnica(texto(celula(linha, e.letra))).toUpperCase();
      if (!letra) { problema(ABA_EX, linha.n, 'exercício sem a letra do treino (ignorado)'); continue; }
      porLetra.set(letra, [...(porLetra.get(letra) ?? []), linha]);
    }
    if (porLetra.size === 0) { problema(ABA_ROT, linhaRotina.n, 'rotina sem exercícios'); continue; }

    const sessoes = [];
    for (const letra of [...porLetra.keys()].sort()) {
      if (sessoes.length === L.sessoes) { problema(ABA_ROT, linhaRotina.n, `rotina com mais de ${L.sessoes} treinos (os últimos ficaram fora)`); break; }
      const doTreino = porLetra.get(letra);
      let nome = linhaUnica(texto(celula(doTreino[0], e.nomeTreino)));
      if (!nome) { nome = `Treino ${letra}`; problema(ABA_EX, doTreino[0].n, 'treino sem nome (usei "Treino" e a letra)'); }
      nome = cortar(ABA_EX, doTreino[0].n, 'nome do treino', nome, L.sessaoNome);
      const ordenados = doTreino
        .map((linha, i) => ({ linha, i, ordem: numero(celula(linha, e.ordem)) }))
        .sort((a, b) => (Number.isFinite(a.ordem) ? a.ordem : Infinity) - (Number.isFinite(b.ordem) ? b.ordem : Infinity) || a.i - b.i);
      const exercicios = [];
      for (const { linha } of ordenados) {
        if (exercicios.length === L.exerciciosPorSessao) { problema(ABA_EX, linha.n, `treino com mais de ${L.exerciciosPorSessao} exercícios (o resto ficou fora)`); break; }
        const ex = exercicioDaLinha(linha, e, problema, cortar, ABA_EX, planilha.data1904 === true, aoRecuperarFaixa);
        if (ex) exercicios.push(ex);
      }
      if (exercicios.length === 0) continue;
      sessoes.push({
        uid: randomUUID(), nome, diaSemana: diaDaSemana(nome), tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, exercicios, grupos: [],
      });
    }
    if (sessoes.length === 0) { problema(ABA_ROT, linhaRotina.n, 'rotina sem exercícios aproveitáveis'); continue; }

    const partes = [['Divisão semanal', r.divisao], ['Acessórios', r.acessorios], ['Recomendações', r.recomendacoes], ['Observações gerais', r.obs]]
      .map(([rotulo, i]) => [rotulo, bloco(texto(celula(linhaRotina, i)))]).filter(([, t]) => t);
    const orientacoes = partes.length ? cortar(ABA_ROT, linhaRotina.n, 'orientações do treino', partes.map(([rotulo, t]) => `${rotulo}: ${t}`).join('\n\n'), L.orientacoesTreino) : null;
    porAluno.set(codigo, { objetivo: null, orientacoes, sessoes, metodologia: null });
    contagens.sessoes += sessoes.length;
    contagens.exercicios += sessoes.reduce((t, s) => t + s.exercicios.length, 0);
    contagens.series += sessoes.reduce((t, s) => t + s.exercicios.reduce((u, x) => u + x.series.length, 0), 0);
  }
  return { porAluno, contagens };
}

function exercicioDaLinha(linha, e, problema, cortar, abaNome, data1904, aoRecuperarFaixa) {
  const completo = linhaUnica(texto(celula(linha, e.nome)));
  if (!completo) { problema(abaNome, linha.n, 'exercício sem nome (ignorado)'); return null; }
  let nome = completo;
  let obs = bloco(texto(celula(linha, e.obs)));
  if (completo.length > L.exercicioNome) {
    // O nome inteiro não cabe na API; o começo vira o nome e o inteiro fica na observação (nada se perde).
    problema(abaNome, linha.n, `nome do exercício com mais de ${L.exercicioNome} letras (cortado; o nome inteiro foi para a observação)`);
    nome = completo.slice(0, L.exercicioNome).trimEnd();
    obs = obs ? `Nome completo: ${completo}\n${obs}` : `Nome completo: ${completo}`;
  }
  obs = obs ? cortar(abaNome, linha.n, 'observação do exercício', obs, L.exercicioObs) : null;

  let videoUrl = texto(celula(linha, e.video)) || null;
  if (videoUrl && !videoValido(videoUrl)) { problema(abaNome, linha.n, 'link de vídeo não aceito (só https do YouTube; ficou sem vídeo)'); videoUrl = null; }

  const avisar = (tipo) => problema(abaNome, linha.n, tipo);
  const series = montarSeries({
    ws: numero(celula(linha, e.ws)),
    fs: numero(celula(linha, e.fs)),
    ts: logico(celula(linha, e.ts)),
    bo: logico(celula(linha, e.bo)),
    backoff: numero(celula(linha, e.backoff)),
    faixa: faixaDeRepeticoes(celula(linha, e.reps), data1904),
  }, avisar, aoRecuperarFaixa);
  if (series.length === 0) avisar('exercício ficou sem série (preencher à mão)');
  return {
    uid: randomUUID(), exercicioId: null, nome, modalidade: null, videoUrl, observacao: obs, progressao: true, unidade: 'kg', series,
    cadencia: null, isometriaSegundos: null, grupoUid: null,
  };
}

/**
 * Séries na ordem FS, WS, Top set, Back off. Rep Range vale só para a WS; FS e Back off pegam a faixa da metodologia.
 * `aoRecuperarFaixa` é chamado quando a faixa da WS foi recuperada de uma data do Excel: só conta, não vira problema.
 */
export function montarSeries({ ws, fs, ts, bo, backoff, faixa }, avisar, aoRecuperarFaixa = () => {}) {
  const serie = (nomeDoTipo, reps, carga) => ({
    uid: randomUUID(), tipo: codigoDoTipo(nomeDoTipo), repsMin: reps?.[0] ?? null, repsMax: reps?.[1] ?? null, amrap: null, carga, esforco: null,
    descansoSegundos: null, tecnica: null, cardio: null, alvoExtra: null,
  });
  const quantidade = (v, rotulo) => {
    if (v === undefined) return 0;
    if (!Number.isInteger(v) || v < 0) { avisar(`quantidade de ${rotulo} inválida (ignorada)`); return 0; }
    if (v > MAX_SERIES_POR_TIPO) { avisar(`quantidade de ${rotulo} acima de ${MAX_SERIES_POR_TIPO} (ignorada)`); return 0; }
    return v;
  };
  const series = [];
  const nFs = quantidade(fs, 'FS');
  const regra = tipoDaMetodologia('FS').regraPercentuais[nFs];
  if (nFs > 0 && !regra) avisar('FS sem regra de percentual na metodologia (séries sem carga)');
  for (let i = 0; i < nFs; i++) {
    series.push(serie('FS', repsDoTipo('FS'), regra ? cargaDe('PERCENTUAL_WS', { percentualMin: regra[i].min, percentualMax: regra[i].max }) : cargaDe('NENHUMA')));
  }
  const nWs = quantidade(ws, 'WS');
  let reps = null;
  if (nWs > 0) {
    if (faixa.erro) {
      avisar(faixa.erro === 'data' ? 'faixa de repetições virou data no Excel (repetições ficaram em branco)'
        : faixa.erro === 'vazia' ? 'faixa de repetições vazia' : 'faixa de repetições inválida (repetições ficaram em branco)');
    } else {
      reps = [faixa.min, faixa.max];
      if (faixa.deData) aoRecuperarFaixa();
    }
  }
  for (let i = 0; i < nWs; i++) series.push(serie('WS', reps, cargaDe('CARGA_TRABALHO')));
  if (ts === null) avisar('TS inválido (ignorado)');
  if (ts === true) { series.push(serie('Top set', null, cargaDe('ACIMA_DA_ANTERIOR'))); avisar('top set sem percentual prescrito (complete no editor)'); }
  if (bo === null) avisar('BO inválido (ignorado)');
  if (bo === true) {
    // A planilha diz só se há back off, não quantas séries: uma. Percentual da WS: fração da planilha (0,85) vira 85.
    const p = Number.isFinite(backoff) && backoff > 0 && backoff <= 2 ? Math.round(backoff * 100) : null;
    if (p === null) avisar('back off sem percentual válido (série sem carga)');
    series.push(serie('Back off', repsDoTipo('Back off'), p === null ? cargaDe('NENHUMA') : cargaDe('PERCENTUAL_WS', { percentualMin: p })));
  }
  return series;
}

// -------------------------------------------------------------------------------------------------------- dieta

function dietasDosAlunos(planilha, alunos, refs, problema, cortar, dono) {
  const ABA_P = 'Planos';
  const ABA_R = 'Refeições';
  const ABA_S = 'Suplementos';
  const linhasP = aba(planilha, ['planos'], ABA_P);
  const linhasR = aba(planilha, ['refeicoes'], ABA_R);
  const linhasS = aba(planilha, ['suplementos'], ABA_S);
  const cp = cabecalho(linhasP, ['id_plano', 'id_aluno'], [], ABA_P);
  const cr = cabecalho(linhasR, ['id_plano', 'alimento'], [], ABA_R);
  const cs = cabecalho(linhasS, ['id_plano', 'dose'], [], ABA_S);
  const p = colunasDe(cp, { id: 'id_plano', aluno: 'id_aluno', nomeAluno: 'nome_aluno', intra: 'intra_treino', hidratacao: 'hidratacao', livre: 'refeicao_livre', obs: 'obs_gerais', ativo: 'ativo' });
  const r = colunasDe(cr, {
    plano: 'id_plano', numero: 'n_refeicao', titulo: 'titulo', opcao: 'opcao', item: 'item_n', alimento: 'alimento', quantidade: 'quantidade_g',
    kcal: 'kcal', proteina: 'proteina_g', carbo: 'carb_g', gordura: 'gord_g', dica: 'dica', unidade: 'unidade_mode',
  });
  const s = colunasDe(cs, { plano: 'id_plano', nome: ['suplemento_medicamento', 'suplemento'], dose: 'dose', horario: 'horario', obs: 'observacao' });

  const planos = ativosPorAluno(linhasP.slice(cp.inicio), p, alunos, problema, ABA_P, 'plano', dono);
  const porIdPlano = new Map([...planos].map(([codigo, x]) => [x.id, { codigo, linha: x.linha }]));

  const refeicoesDoPlano = new Map();
  for (const linha of linhasR.slice(cr.inicio)) {
    if (emBranco(linha)) continue;
    const id = texto(celula(linha, r.plano));
    if (!porIdPlano.has(id)) continue;
    dono(ABA_R, linha.n, porIdPlano.get(id).codigo);
    refeicoesDoPlano.set(id, [...(refeicoesDoPlano.get(id) ?? []), linha]);
  }
  const suplementosDoPlano = new Map();
  for (const linha of linhasS.slice(cs.inicio)) {
    if (emBranco(linha)) continue;
    const id = texto(celula(linha, s.plano));
    if (!porIdPlano.has(id)) continue;
    dono(ABA_S, linha.n, porIdPlano.get(id).codigo);
    suplementosDoPlano.set(id, [...(suplementosDoPlano.get(id) ?? []), linha]);
  }

  const porAluno = new Map();
  const contagens = { refeicoes: 0, itens: 0, suplementos: 0, suplementosPorPrefixo: 0, ergogenicosReconhecidos: 0, ergogenicosNaoReconhecidos: 0 };
  for (const [id, { codigo, linha: linhaPlano }] of porIdPlano) {
    const refeicoes = refeicoesDaDieta(refeicoesDoPlano.get(id) ?? [], r, problema, cortar, ABA_R);
    if (refeicoes.length === 0) { problema(ABA_P, linhaPlano.n, 'plano sem refeições aproveitáveis'); continue; }

    const orientacoes = [['Intra-treino', p.intra], ['Hidratação', p.hidratacao], ['Refeição livre', p.livre]]
      .map(([titulo, i]) => [titulo, bloco(texto(celula(linhaPlano, i)))]).filter(([, t]) => t)
      .map(([titulo, t]) => ({ titulo, texto: cortar(ABA_P, linhaPlano.n, `orientação "${titulo}"`, t, L.orientacaoTexto) }));
    const observacoes = bloco(texto(celula(linhaPlano, p.obs)));

    const suplementacao = [];
    const ergogenicos = [];
    for (const linha of suplementosDoPlano.get(id) ?? []) {
      const nome = linhaUnica(texto(celula(linha, s.nome)));
      if (!nome) { problema(ABA_S, linha.n, 'suplemento ou medicamento sem nome (ignorado)'); continue; }
      const dose = linhaUnica(texto(celula(linha, s.dose))) || null;
      const horario = linhaUnica(texto(celula(linha, s.horario))) || null;
      const obs = bloco(texto(celula(linha, s.obs))) || null;
      const cortado = (rotulo, v, max) => (v === null ? null : cortar(ABA_S, linha.n, rotulo, v, max));
      const destino = destinoDoSuplemento(nome, refs);
      const comum = { uid: randomUUID(), nome: cortar(ABA_S, linha.n, 'nome', nome, L.campo), dose: cortado('dose', dose, L.campo), horario: cortado('horário', horario, L.campo), observacao: cortado('observação', obs, L.suplObs) };
      if (destino === 'suplemento' || destino === 'suplemento-comum') {
        suplementacao.push({ ...comum, link: null });
        if (destino === 'suplemento-comum') contagens.suplementosPorPrefixo++;
      } else {
        ergogenicos.push({ ...comum, principioAtivo: null, concentracao: null, prescricao: null });
        contagens[destino === 'ergogenico' ? 'ergogenicosReconhecidos' : 'ergogenicosNaoReconhecidos']++;
      }
    }
    if (suplementacao.length > L.suplementos) { problema(ABA_P, linhaPlano.n, `mais de ${L.suplementos} suplementos (o resto ficou fora)`); suplementacao.length = L.suplementos; }
    if (ergogenicos.length > L.ergogenicos) { problema(ABA_P, linhaPlano.n, `mais de ${L.ergogenicos} itens de medicação (o resto ficou fora)`); ergogenicos.length = L.ergogenicos; }

    porAluno.set(codigo, {
      objetivo: null,
      dataInicio: null,
      profissional: null,
      refeicoes,
      orientacoes: orientacoes.slice(0, L.orientacoes),
      observacoes: observacoes ? cortar(ABA_P, linhaPlano.n, 'observações gerais da dieta', observacoes, L.observacoes) : null,
      suplementacao,
      ergogenicos: ergogenicos.length ? ergogenicos : null,
      aguaLitros: null,
    });
    contagens.refeicoes += refeicoes.length;
    contagens.itens += refeicoes.reduce((t, f) => t + f.opcoes.reduce((u, o) => u + o.itens.length, 0), 0);
    contagens.suplementos += suplementacao.length;
  }
  return { porAluno, contagens };
}

function refeicoesDaDieta(linhas, r, problema, cortar, abaNome) {
  const porNumero = new Map();
  for (const linha of linhas) {
    const n = numero(celula(linha, r.numero));
    if (!Number.isInteger(n)) { problema(abaNome, linha.n, 'item sem número de refeição válido (ignorado)'); continue; }
    porNumero.set(n, [...(porNumero.get(n) ?? []), linha]);
  }
  const refeicoes = [];
  for (const n of [...porNumero.keys()].sort((a, b) => a - b)) {
    const doNumero = porNumero.get(n);
    if (refeicoes.length === L.refeicoes) { problema(abaNome, doNumero[0].n, `dieta com mais de ${L.refeicoes} refeições (as últimas ficaram fora)`); break; }
    const rotulos = new Set(doNumero.map((l) => linhaUnica(texto(celula(l, r.opcao)))).filter(Boolean));
    const opcoes = new Map();
    const dicas = [];
    for (const [i, linha] of doNumero.entries()) {
      const alimento = linhaUnica(texto(celula(linha, r.alimento)));
      if (!alimento) { problema(abaNome, linha.n, 'item sem alimento (ignorado)'); continue; }
      let rotulo = linhaUnica(texto(celula(linha, r.opcao)));
      if (!rotulo) {
        if (rotulos.size > 0) { problema(abaNome, linha.n, 'item sem opção, e a refeição tem outras opções (ignorado)'); continue; }
        rotulo = 'A';
      }
      rotulo = cortar(abaNome, linha.n, 'rótulo da opção', rotulo, L.rotulo);
      const item = itemDaLinha(linha, r, alimento, problema, cortar, abaNome);
      const ordem = numero(celula(linha, r.item));
      opcoes.set(rotulo, [...(opcoes.get(rotulo) ?? []), { item, ordem: Number.isFinite(ordem) ? ordem : Infinity, i }]);
      const dica = linhaUnica(texto(celula(linha, r.dica)));
      if (dica) dicas.push(`${item.nome}: ${dica}`);
    }
    if (opcoes.size === 0) { problema(abaNome, doNumero[0].n, 'refeição ficou sem itens (ignorada)'); continue; }
    let titulo = linhaUnica(texto(celula(doNumero[0], r.titulo)));
    if (!titulo) { titulo = `Refeição ${n}`; problema(abaNome, doNumero[0].n, 'refeição sem título (usei "Refeição" e o número)'); }
    const lista = [...opcoes].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([rotulo, itens]) => {
      const ordenados = itens.sort((a, b) => a.ordem - b.ordem || a.i - b.i).map((x) => x.item);
      if (ordenados.length > L.itens) { problema(abaNome, doNumero[0].n, `opção com mais de ${L.itens} itens (o resto ficou fora)`); ordenados.length = L.itens; }
      return { uid: randomUUID(), rotulo, itens: ordenados };
    });
    if (lista.length > L.opcoes) { problema(abaNome, doNumero[0].n, `refeição com mais de ${L.opcoes} opções (as últimas ficaram fora)`); lista.length = L.opcoes; }
    refeicoes.push({
      uid: randomUUID(),
      nome: cortar(abaNome, doNumero[0].n, 'título da refeição', titulo, L.refeicaoNome),
      horario: null,
      observacao: dicas.length ? cortar(abaNome, doNumero[0].n, 'dicas da refeição', dicas.join('\n'), L.refeicaoObs) : null,
      opcoes: lista,
    });
  }
  return refeicoes;
}

const MAXIMO_NUTRIENTE = 99999;
function itemDaLinha(linha, r, alimento, problema, cortar, abaNome) {
  const valor = (i, rotulo) => {
    const v = numero(celula(linha, i));
    if (v === undefined) return null;
    if (!Number.isFinite(v) || v < 0 || v > MAXIMO_NUTRIENTE) {
      problema(abaNome, linha.n, `${rotulo} fora de 0 a ${MAXIMO_NUTRIENTE} ou inválido (item mantido sem esse valor)`);
      return null;
    }
    return v;
  };
  let quantidade = numero(celula(linha, r.quantidade));
  if (quantidade === undefined || !Number.isFinite(quantidade) || quantidade <= 0) {
    problema(abaNome, linha.n, 'quantidade ausente, zero ou inválida (item mantido sem quantidade)');
    quantidade = null;
  }
  // Na planilha, `un` guarda o número de unidades na coluna de quantidade (nunca gramas): fica `un` com o número como está.
  const modo = chaveDoNome(texto(celula(linha, r.unidade)));
  const unidade = ['g', 'ml', 'un'].includes(modo) ? modo : 'g';
  if (modo && !['g', 'ml', 'un'].includes(modo)) problema(abaNome, linha.n, 'unidade desconhecida (usei g)');
  const kcal = valor(r.kcal, 'kcal');
  if (kcal === null) problema(abaNome, linha.n, 'item sem kcal (a publicação vai exigir)');
  return {
    uid: randomUUID(), alimentoId: null, nome: cortar(abaNome, linha.n, 'nome do alimento', alimento, L.itemNome), quantidade, unidade, kcal,
    proteina: valor(r.proteina, 'proteína'), carboidrato: valor(r.carbo, 'carboidrato'), gordura: valor(r.gordura, 'gordura'),
    manual: true, fatorCorrecao: null, fatorCoccao: null,
  };
}

// ---------------------------------------------------------------------------------------- resumo e arquivos de saída

/** Nome de arquivo seguro a partir do código da planilha (nunca o nome do aluno). */
export function nomeDoArquivo(codigo, usados) {
  const base = codigo.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'aluno';
  let nome = base;
  for (let k = 2; usados.has(nome.toLowerCase()); k++) nome = `${base}_${k}`;
  usados.add(nome.toLowerCase());
  return `${nome}.json`;
}

/** Agrupa os problemas por aba e tipo (o tipo é o motivo sem o detalhe entre parênteses finais, só para contar). */
export function problemasPorTipo(problemas) {
  const grupos = new Map();
  for (const p of problemas) grupos.set(`${p.aba}: ${p.tipo}`, (grupos.get(`${p.aba}: ${p.tipo}`) ?? 0) + 1);
  return grupos;
}

/** Resumo para o terminal: só contagens. */
export function resumoDosPlanos({ contagens: c, problemas }) {
  const linhas = [
    `Convertido: ${c.alunosComTreino} alunos com treino, ${c.alunosComDieta} com dieta (${c.alunosComAmbos} com os dois), de ${c.alunosNaPlanilha} alunos convertidos.`,
    `Treino: ${c.sessoes} treinos, ${c.exercicios} exercícios, ${c.series} séries (${c.faixasRecuperadas} faixas de repetições recuperadas de datas do Excel). Dieta: ${c.refeicoes} refeições, ${c.itens} itens, ${c.suplementos} suplementos (${c.suplementosPorPrefixo} reconhecidos pela lista comum, pelo começo do nome).`,
    `Medicação e ergogênicos (sensível): ${c.ergogenicosReconhecidos + c.ergogenicosNaoReconhecidos} itens (${c.ergogenicosReconhecidos} da lista conhecida e ${c.ergogenicosNaoReconhecidos} não reconhecidos como suplemento).`,
  ];
  if (problemas.length === 0) return [...linhas, 'Problemas: nenhum.'];
  return [
    ...linhas,
    `Problemas: ${problemas.length} linha(s) em problemas.csv (só aba, linha e motivo):`,
    ...[...problemasPorTipo(problemas)].map(([k, n]) => `- ${k}: ${n}`),
  ];
}

// ------------------------------------------------------------------------------------- lado da importação (puro)

/** Chave de comparação de exercício, com os apelidos que o `importar.mjs` já conhece ("Peck deck" = "Peck Deck (crossover máquina)"). */
export function chaveDoExercicio(nome) {
  const k = chave(nome.replace(/\*/g, ''));
  return ALIAS[k] ? chave(ALIAS[k]) : k;
}

/** Lê e confere o JSON de um aluno. Erro sem conteúdo do arquivo. */
export function lerArquivoDePlano(textoJson) {
  let o;
  try { o = JSON.parse(textoJson); } catch { throw new Error('não é um JSON válido'); }
  if (!o || o.formato !== FORMATO || typeof o.codigo !== 'string' || typeof o.nome !== 'string' || !o.nome.trim()) throw new Error(`não é um arquivo do formato ${FORMATO}`);
  if (!o.treino && !o.dieta) throw new Error('arquivo sem treino nem dieta');
  return o;
}

/** Nomes dos exercícios de um treino. */
export const exerciciosDoTreino = (treino) => treino.conteudo.sessoes.flatMap((s) => s.exercicios);

/**
 * Contagens do que a importação faria, sem tocar em nada. `pares` = `{ biblioteca: Set, catalogo: Set }` de chaves
 * ({@link chaveDoExercicio}): "na biblioteca" = o que o `importar.mjs` deixa na biblioteca do Saraiva (lista de vídeos e
 * modelos); "só no catálogo" = existe no catálogo público mas precisa ser importado para a biblioteca; "sem par" = em
 * nenhum. Nunca cria exercício.
 *
 * `vinculos` = `Map` chave do nome da planilha -> chave do nome da biblioteca, só das linhas com `confirmado` = sim ou
 * `nome_correto` do `correspondencias-exercicios.csv` ({@link vinculosConfirmados}). Vale só para quem **não** tem par exato; o destino
 * conta como qualquer par (`vinculados`). Vínculo cujo destino não está na biblioteca nem no catálogo fica sem par
 * (`vinculosSemDestino`).
 */
export function resumoDaImportacao(planos, pares, vinculos = new Map()) {
  const c = {
    alunos: planos.length, comTreino: 0, comDieta: 0, exercicios: 0, naBiblioteca: 0, soNoCatalogo: 0, semPar: 0, vinculados: 0, vinculosSemDestino: 0,
    nomesSemPar: new Set(), refeicoes: 0, itens: 0, ergogenicos: 0,
  };
  for (const a of planos) {
    if (a.treino) {
      c.comTreino++;
      for (const e of exerciciosDoTreino(a.treino)) {
        c.exercicios++;
        let k = chaveDoExercicio(e.nome);
        if (!pares.biblioteca.has(k) && !pares.catalogo.has(k) && vinculos.has(k)) {
          const destino = vinculos.get(k);
          if (pares.biblioteca.has(destino) || pares.catalogo.has(destino)) { c.vinculados++; k = destino; } else c.vinculosSemDestino++;
        }
        if (pares.biblioteca.has(k)) c.naBiblioteca++;
        else if (pares.catalogo.has(k)) c.soNoCatalogo++;
        else { c.semPar++; c.nomesSemPar.add(k); }
      }
    }
    if (a.dieta) {
      c.comDieta++;
      c.refeicoes += a.dieta.conteudo.refeicoes.length;
      c.itens += a.dieta.conteudo.refeicoes.reduce((t, f) => t + f.opcoes.reduce((u, o) => u + o.itens.length, 0), 0);
      c.ergogenicos += a.dieta.conteudo.ergogenicos?.length ?? 0;
    }
  }
  return c;
}

/**
 * Treino com `exercicioId`, modalidade e (se a planilha não trouxe) vídeo da biblioteca, pelo nome. `biblioteca` = Map
 * chave -> exercício da API. `vinculos` (ver {@link resumoDaImportacao}) só entra quando não há par exato; o exercício
 * confirmado mantém o nome da planilha e ganha o id, a modalidade e o vídeo do exercício da biblioteca.
 */
export function treinoComBiblioteca(conteudo, biblioteca, vinculos = new Map()) {
  return {
    ...conteudo,
    sessoes: conteudo.sessoes.map((s) => ({
      ...s,
      exercicios: s.exercicios.map((e) => {
        const k = chaveDoExercicio(e.nome);
        const par = biblioteca.get(k) ?? (vinculos.has(k) ? biblioteca.get(vinculos.get(k)) : undefined);
        if (!par) return e;
        // A planilha traz séries de força (tipo, carga): num exercício da biblioteca de cardio elas ficariam inválidas, então a modalidade fica a da planilha.
        const modalidade = par.modalidade === 'CARDIO' ? e.modalidade : par.modalidade ?? e.modalidade;
        return { ...e, exercicioId: par.id, modalidade, videoUrl: e.videoUrl ?? par.videoUrl ?? null };
      }),
    })),
  };
}
