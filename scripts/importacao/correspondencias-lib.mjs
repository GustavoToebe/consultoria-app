/**
 * Regras puras do `correspondencias-exercicios.csv`: a lista, para o treinador conferir, dos exercícios da planilha que
 * **não têm par exato** na biblioteca nem no catálogo, cada um com a sugestão mais parecida da biblioteca do Saraiva.
 * O arquivo fica na pasta de saída do conversor (fora do repositório). O treinador escreve `sim` na coluna `confirmado`
 * das sugestões certas; o `importar-planos.mjs` lê o arquivo e usa **só** as linhas `sim` para ligar o exercício ao da
 * biblioteca (`exercicioId`, modalidade e vídeo; o nome da planilha fica). Sugestão não confirmada nunca vincula nada.
 *
 * Nada aqui lê ou grava arquivo. Os exercícios são os do JSON já convertido (`exerciciosDoTreino`), na mesma chave que a
 * importação usa (`chaveDoExercicio`: sem acento, caixa, pontuação e artigos, mais os apelidos do `importar.mjs`).
 */
import { coluna, lerCsv } from './alunos-lib.mjs';
import { chaveDoExercicio, exerciciosDoTreino } from './planos-lib.mjs';

export const ARQUIVO_CORRESPONDENCIAS = 'correspondencias-exercicios.csv';

/** Nota mínima (0 a 1) para o conversor sugerir alguma coisa; abaixo dela, sugestão e nota ficam em branco (nunca 0). */
export const LIMIAR_DE_SUGESTAO = 0.5;

const CABECALHO = ['nome_na_planilha', 'ocorrencias', 'sugestao_da_biblioteca', 'nota_de_semelhanca', 'confirmado'];

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
const ehConfirmado = (valor) => valor.trim().toLowerCase() === 'sim';

/**
 * As linhas do arquivo e o resumo. `arquivos` = os JSON convertidos; `pares` = `{ biblioteca: Map chave -> nome, catalogo: Set }`;
 * `anteriores` = o arquivo já existente lido por {@link lerCorrespondencias} (ou vazio).
 *
 * Só entra nome **sem par exato** (fora da biblioteca e do catálogo). Quem já tem `confirmado` preenchido ("sim" ou
 * "não") no arquivo anterior fica como está, **inclusive a sugestão e a nota** (o `sim` vale para a sugestão que o
 * treinador viu, não para a que um algoritmo novo escolheria), e nunca sai do arquivo; só `ocorrencias` é atualizada
 * (0 se o nome sumiu da planilha). As demais linhas são geradas de novo. Ordem: mais frequentes primeiro.
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
    if (anteriores.get(k)?.confirmado) continue;
    const s = sugerirDaBiblioteca(k, pares.biblioteca);
    linhas.push({ chave: k, nome, ocorrencias: n, sugestao: s?.nome ?? '', nota: s ? notaEmTexto(s.nota) : '', confirmado: '' });
  }
  for (const [k, antes] of anteriores) {
    if (antes.confirmado) linhas.push({ chave: k, nome: antes.nome, ocorrencias: contagem.get(k)?.n ?? 0, sugestao: antes.sugestao, nota: antes.nota, confirmado: antes.confirmado });
  }
  linhas.sort((x, y) => y.ocorrencias - x.ocorrencias || (x.chave < y.chave ? -1 : x.chave > y.chave ? 1 : 0));
  const dosSemPar = linhas.filter((l) => semPar.has(l.chave));
  return {
    linhas,
    resumo: {
      nomesSemPar: semPar.size,
      comSugestao: dosSemPar.filter((l) => l.sugestao).length,
      semSugestao: dosSemPar.filter((l) => !l.sugestao).length,
      confirmadosNoArquivo: linhas.filter((l) => l.confirmado).length,
      confirmadosSim: linhas.filter((l) => ehConfirmado(l.confirmado)).length,
    },
  };
}

/** Campo CSV com `;`. Texto que começaria uma fórmula no Excel (`=`, `+`, `-`, `@`) ganha um apóstrofo, tirado na leitura. */
const campoCsv = (v) => {
  let t = String(v ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`;
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** O arquivo, em UTF-8 com BOM (o Excel reconhece os acentos) e `;`. */
export function csvDeCorrespondencias(linhas) {
  const corpo = linhas.map((l) => [l.nome, l.ocorrencias, l.sugestao, l.nota, l.confirmado]);
  return `﻿${[CABECALHO, ...corpo].map((l) => l.map(campoCsv).join(';')).join('\n')}\n`;
}

/**
 * Texto de um CSV: UTF-8 estrito e, se os bytes não forem UTF-8 válido, windows-1252 (o "CSV" comum do Excel salva assim,
 * e sem isso os nomes com acento deixariam de casar).
 */
export function decodificarCsv(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Lê o arquivo (já decodificado) em `Map` chave do nome -> `{ nome, ocorrencias, sugestao, nota, confirmado }`. As colunas
 * vêm pelo cabeçalho (a ordem pode mudar); linha repetida para o mesmo nome: vale a primeira. Erro com mensagem fixa,
 * sem conteúdo do arquivo.
 */
export function lerCorrespondencias(texto) {
  const { colunas, linhas } = lerCsv(texto);
  const faltam = ['nome_na_planilha', 'sugestao_da_biblioteca', 'confirmado'].filter((c) => !colunas.includes(coluna(c)));
  if (faltam.length) throw new Error(`o ${ARQUIVO_CORRESPONDENCIAS} não tem as colunas: ${faltam.join(', ')}`);
  const lidas = new Map();
  for (const l of linhas) {
    const nome = l.nome_na_planilha.replace(/^'(?=[=+\-@])/, '');
    const k = chaveDoExercicio(nome);
    if (!k || lidas.has(k)) continue;
    lidas.set(k, {
      nome,
      ocorrencias: l.ocorrencias ?? '',
      sugestao: l.sugestao_da_biblioteca.replace(/^'(?=[=+\-@])/, ''),
      nota: l.nota_de_semelhanca ?? '',
      confirmado: l.confirmado,
    });
  }
  return lidas;
}

/**
 * Os vínculos que valem: `Map` chave do nome da planilha -> chave do nome da biblioteca, só das linhas com `confirmado`
 * igual a `sim` (maiúsculas, minúsculas e espaços nas pontas não importam; "s", "x" ou "talvez" não valem) e com sugestão.
 */
export function vinculosConfirmados(lidas) {
  const vinculos = new Map();
  for (const [k, l] of lidas) {
    if (!ehConfirmado(l.confirmado) || !l.sugestao) continue;
    const destino = chaveDoExercicio(l.sugestao);
    if (destino && destino !== k) vinculos.set(k, destino);
  }
  return vinculos;
}
