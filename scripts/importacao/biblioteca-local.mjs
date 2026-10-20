/**
 * Fontes locais (arquivos do repositório, sem rede) para o modo `--simular` do importador de planos: quais exercícios
 * existiriam na biblioteca do Saraiva e no catálogo público, e os nomes de referência para separar suplemento de
 * medicação. Nada aqui é dado de aluno.
 *
 * - **biblioteca** = o que o `importar.mjs` deixa na biblioteca do Saraiva: a lista de vídeos (`dados/videos.json`) e os
 *   exercícios dos modelos de treino (`dados/modelos.json`), com os apelidos do `importar.mjs`.
 * - **catálogo** = o catálogo público de exercícios, lido do SQL gerado (`V003__catalogo_exercicios_ptbr.sql`, que já
 *   leva os 52 exercícios próprios e os nomes revisados); o treinador precisa importá-los para a biblioteca para usar.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chaveDoExercicio } from './planos-lib.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const lerJson = (...partes) => JSON.parse(readFileSync(join(AQUI, ...partes), 'utf8'));

/**
 * `biblioteca` é um `Map` chave -> nome (o da lista de vídeos quando existe, senão o do modelo): `.has` serve para saber
 * se há par, e o nome alimenta as sugestões do `correspondencias-exercicios.csv`. `catalogo` é um `Set` de chaves.
 */
export function lerBibliotecaLocal() {
  const biblioteca = new Map();
  const incluir = (nome) => { const k = chaveDoExercicio(nome); if (!biblioteca.has(k)) biblioteca.set(k, nome); };
  for (const [, nome] of lerJson('dados', 'videos.json').linhas) incluir(nome);
  for (const m of lerJson('dados', 'modelos.json').modelos) {
    for (const s of m.sessoes ?? []) for (const x of s.exercicios ?? []) incluir(x.nome);
  }
  const sql = readFileSync(join(AQUI, '..', '..', 'api', 'src', 'main', 'resources', 'db', 'migration', 'V003__catalogo_exercicios_ptbr.sql'), 'utf8');
  const catalogo = new Set();
  for (const m of sql.matchAll(/\|\| '((?:[^']|'')*)'\)::uuid/g)) catalogo.add(chaveDoExercicio(m[1].replace(/''/g, "'")));
  return { biblioteca, catalogo };
}

/**
 * Nomes de referência: `suplementos` = lista da Heavy Suppz (parte antes do " - " do produto) mais a lista comum de
 * `dados/suplementos-comuns.json`, que casam por palavras contidas (a regra de sempre); `comuns` = só a lista comum, que
 * também casa pelo começo do nome normalizado (sem dose, unidade nem parênteses); e medicação/ergogênicos (nome e
 * princípio ativo). Regra mais estrita (a lista comum só pelo começo do nome): tirar `...comuns` de `suplementos`.
 */
export function lerReferenciasDeSuplementos() {
  const comuns = lerJson('dados', 'suplementos-comuns.json').itens;
  const suplementos = [...lerJson('dados', 'suplementos-heavysuppz.json').itens.map((i) => i.nome.split(' - ')[0]), ...comuns];
  const ergogenicos = lerJson('dados', 'medicacao-ergogenicos.json').itens.flatMap((i) => [i.nome, i.principioAtivo].filter(Boolean));
  return { suplementos, comuns, ergogenicos };
}
