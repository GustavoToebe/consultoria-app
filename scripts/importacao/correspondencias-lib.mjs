/**
 * Regras puras do `correspondencias-exercicios.csv`: a lista, para o treinador conferir, dos exercícios da planilha que
 * **não têm par exato** na biblioteca nem no catálogo, cada um com a sugestão mais parecida da biblioteca do Saraiva.
 * O arquivo fica na pasta de saída do conversor (fora do repositório). O treinador escreve `sim` (ou `s`, `x`, `ok`) na
 * coluna `confirmado` das sugestões certas, ou o nome certo na coluna `nome_correto`; o `importar-planos.mjs` lê o arquivo e
 * usa **só** essas linhas para ligar o exercício ao da biblioteca (`exercicioId`, modalidade e vídeo; o nome da planilha
 * fica). Sugestão não confirmada nunca vincula nada, e nunca nasce exercício novo. Os cabeçalhos do arquivo que o Saraiva
 * recebe ("Nome na planilha", "Quantas vezes aparece", "Sugestão do app", "Está certo?", "Se não, qual é") também são lidos.
 *
 * Nada aqui lê ou grava arquivo. Os exercícios são os do JSON já convertido (`exerciciosDoTreino`), na mesma chave que a
 * importação usa (`chaveDoExercicio`: sem acento, caixa, pontuação e artigos, mais os apelidos do `importar.mjs`).
 */
import { chaveDoNome, coluna, lerCsv } from './alunos-lib.mjs';
import { decodificarCsv, semApostrofoDeFormula, textoDeCsv } from './csv-apoio-lib.mjs';
import { chaveDoExercicio, exerciciosDoTreino } from './planos-lib.mjs';

export const ARQUIVO_CORRESPONDENCIAS = 'correspondencias-exercicios.csv';

/** Nota mínima (0 a 1) para o conversor sugerir alguma coisa; abaixo dela, sugestão e nota ficam em branco (nunca 0). */
export const LIMIAR_DE_SUGESTAO = 0.5;

const CABECALHO = ['nome_na_planilha', 'ocorrencias', 'sugestao_da_biblioteca', 'nota_de_semelhanca', 'confirmado', 'nome_correto'];

const SIM = new Set(['sim', 's', 'x', 'ok']);
const NAO = new Set(['nao', 'n']);

/** O que a pessoa escreveu em `confirmado`, entendido: `sim`, `nao` ou `''` (em branco ou outra coisa). Sem acento, caixa nem espaços. */
export function respostaDeConfirmacao(valor) {
  const v = chaveDoNome(valor ?? '');
  return SIM.has(v) ? 'sim' : NAO.has(v) ? 'nao' : '';
}

/** O traço que o arquivo do Saraiva mostra quando não há sugestão não é um nome. */
const semTraco = (v) => (v.trim() === '—' ? '' : v);

/** Distância de edição (Levenshtein) entre duas strings. */
function distanciaDeEdicao(a, b) {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Nota de semelhança (0 a 1, duas casas) entre duas chaves já normalizadas: a **média** de (1) semelhança de edição,
 * `1 - distância de edição / tamanho da maior`, que pega erro de digitação e plural, e (2) coeficiente de Dice sobre as
 * palavras, `2 * palavras em comum / (palavras de uma + palavras da outra)`, que pega palavras trocadas de ordem.
 */
export function notaDeSemelhanca(a, b) {
  if (!a || !b) return 0;
  const edicao = 1 - distanciaDeEdicao(a, b) / Math.max(a.length, b.length);
  const pa = new Set(a.split(' '));
  const pb = new Set(b.split(' '));
  const emComum = [...pa].filter((p) => pb.has(p)).length;
  const dice = (2 * emComum) / (pa.size + pb.size);
  return Math.round(((edicao + dice) / 2) * 100) / 100;
}

/**
 * O nome da biblioteca mais parecido com a chave: `{ nome, nota }` ou `null` se nenhum chega a {@link LIMIAR_DE_SUGESTAO}.
 * `biblioteca` = `Map` chave -> nome. Empate de nota: a menor chave (o resultado não muda de uma geração para outra).
 */
export function sugerirDaBiblioteca(chave, biblioteca) {
  let melhor = null;
  for (const [k, nome] of biblioteca) {
    const nota = notaDeSemelhanca(chave, k);
    if (!melhor || nota > melhor.nota || (nota === melhor.nota && k < melhor.chave)) melhor = { chave: k, nome, nota };
  }
  return melhor && melhor.nota >= LIMIAR_DE_SUGESTAO ? { nome: melhor.nome, nota: melhor.nota } : null;
}

const notaEmTexto = (n) => String(n).replace('.', ',');
/** A linha que a pessoa já respondeu (`confirmado` ou `nome_correto`): fica como está ao gerar de novo. */
const preenchida = (l) => Boolean(l?.confirmado?.trim() || l?.correcao?.trim());

/**
 * As linhas do arquivo e o resumo. `arquivos` = os JSON convertidos; `pares` = `{ biblioteca: Map chave -> nome, catalogo: Set }`;
 * `anteriores` = o arquivo já existente lido por {@link lerCorrespondencias} (ou vazio).
 *
 * Só entra nome **sem par exato** (fora da biblioteca e do catálogo). Quem já tem `confirmado` ou `nome_correto` preenchido
 * no arquivo anterior fica como está, **inclusive a sugestão e a nota** (o `sim` vale para a sugestão que o treinador
 * viu, não para a que um algoritmo novo escolheria), e nunca sai do arquivo; só `ocorrencias` é atualizada (0 se o nome
 * sumiu da planilha). As demais linhas são geradas de novo. Ordem: mais frequentes primeiro. Cada linha leva `semPar`:
 * `true` se o nome ainda está sem par exato na planilha de agora.
 */
export function linhasDeCorrespondencia(arquivos, pares, anteriores = new Map()) {
  const contagem = new Map();
  for (const a of arquivos) {
    if (!a.treino) continue;
    for (const e of exerciciosDoTreino(a.treino)) {
      const k = chaveDoExercicio(e.nome);
      const x = contagem.get(k);
      if (x) x.n++; else contagem.set(k, { nome: e.nome, n: 1 });
    }
  }
  const semPar = new Set();
  const linhas = [];
  for (const [k, { nome, n }] of contagem) {
    if (pares.biblioteca.has(k) || pares.catalogo.has(k)) continue;
    semPar.add(k);
    if (preenchida(anteriores.get(k))) continue;
    const s = sugerirDaBiblioteca(k, pares.biblioteca);
    linhas.push({ chave: k, nome, ocorrencias: n, sugestao: s?.nome ?? '', nota: s ? notaEmTexto(s.nota) : '', confirmado: '', correcao: '', semPar: true });
  }
  for (const [k, antes] of anteriores) {
    if (!preenchida(antes)) continue;
    linhas.push({
      chave: k, nome: antes.nome, ocorrencias: contagem.get(k)?.n ?? 0, sugestao: antes.sugestao, nota: antes.nota, confirmado: antes.confirmado,
      correcao: antes.correcao, semPar: semPar.has(k),
    });
  }
  linhas.sort((x, y) => y.ocorrencias - x.ocorrencias || (x.chave < y.chave ? -1 : x.chave > y.chave ? 1 : 0));
  const dosSemPar = linhas.filter((l) => l.semPar);
  return {
    linhas,
    resumo: {
      nomesSemPar: semPar.size,
      comSugestao: dosSemPar.filter((l) => l.sugestao).length,
      semSugestao: dosSemPar.filter((l) => !l.sugestao).length,
      confirmadosNoArquivo: linhas.filter(preenchida).length,
      confirmadosSim: linhas.filter((l) => respostaDeConfirmacao(l.confirmado) === 'sim').length,
      comNomeCorreto: linhas.filter((l) => l.correcao.trim()).length,
    },
  };
}

/** O arquivo, em UTF-8 com BOM (o Excel reconhece os acentos) e `;`. */
export function csvDeCorrespondencias(linhas) {
  return textoDeCsv(CABECALHO, linhas.map((l) => [l.nome, l.ocorrencias, l.sugestao, l.nota, l.confirmado, l.correcao ?? '']));
}

export { decodificarCsv };

/**
 * Lê o arquivo (já decodificado) em `Map` chave do nome -> `{ nome, ocorrencias, sugestao, nota, confirmado, correcao }`. As
 * colunas vêm pelo cabeçalho (a ordem pode mudar; vale também o do arquivo que o Saraiva recebe). `nome_correto` pode faltar
 * (arquivos gerados antes dela): vira em branco. Linha repetida para o mesmo nome: vale a primeira. Erro com mensagem
 * fixa, sem conteúdo do arquivo.
 */
export function lerCorrespondencias(texto) {
  const { colunas, linhas } = lerCsv(texto);
  const tem = (c) => colunas.includes(coluna(c));
  const sugestaoCol = tem('sugestao_da_biblioteca') ? 'sugestao_da_biblioteca' : 'sugestao_do_app';
  const confirmadoCol = tem('confirmado') ? 'confirmado' : 'esta_certo';
  const faltam = [];
  if (!tem('nome_na_planilha')) faltam.push('nome_na_planilha');
  if (!tem(sugestaoCol)) faltam.push('sugestao_da_biblioteca');
  if (!tem(confirmadoCol)) faltam.push('confirmado');
  if (faltam.length) throw new Error(`o ${ARQUIVO_CORRESPONDENCIAS} não tem as colunas: ${faltam.join(', ')}`);
  const correcaoCol = tem('nome_correto') ? 'nome_correto' : 'se_nao_qual_e';
  const lidas = new Map();
  for (const l of linhas) {
    const nome = semApostrofoDeFormula(l.nome_na_planilha);
    const k = chaveDoExercicio(nome);
    if (!k || lidas.has(k)) continue;
    lidas.set(k, {
      nome,
      ocorrencias: l.ocorrencias ?? l.quantas_vezes_aparece ?? '',
      sugestao: semTraco(semApostrofoDeFormula(l[sugestaoCol])),
      nota: l.nota_de_semelhanca ?? '',
      confirmado: l[confirmadoCol],
      correcao: semApostrofoDeFormula(l[correcaoCol] ?? ''),
    });
  }
  return lidas;
}

/**
 * Os vínculos que valem: `Map` chave do nome da planilha -> chave do nome da biblioteca. Duas origens:
 * - `confirmado` igual a `sim` (`sim`, `s`, `x` ou `ok`, com ou sem acento, em qualquer caixa) e com sugestão: vale a
 *   sugestão; é a que vale mesmo se `nome_correto` também estiver preenchido;
 * - senão, `nome_correto` preenchido: vale esse nome, procurado na biblioteca pela mesma chave da importação (sem acento
 *   nem diferença de caixa). Se ele não existir na biblioteca nem no catálogo, o exercício fica sem vínculo e o resumo da
 *   importação conta (`vinculosSemDestino`); exercício novo nunca é criado.
 */
export function vinculosConfirmados(lidas) {
  const vinculos = new Map();
  for (const [k, l] of lidas) {
    const nome = respostaDeConfirmacao(l.confirmado) === 'sim' && l.sugestao ? l.sugestao : l.correcao?.trim();
    if (!nome) continue;
    const destino = chaveDoExercicio(nome);
    if (destino && destino !== k) vinculos.set(k, destino);
  }
  return vinculos;
}

/** Quantos vínculos vêm de `sim` e quantos de `nome_correto` (os mesmos de {@link vinculosConfirmados}). */
export function origemDosVinculos(lidas) {
  let sim = 0;
  let corrigidos = 0;
  for (const l of lidas.values()) {
    if (respostaDeConfirmacao(l.confirmado) === 'sim' && l.sugestao) sim++;
    else if (l.correcao?.trim()) corrigidos++;
  }
  return { sim, corrigidos };
}
