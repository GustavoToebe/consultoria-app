#!/usr/bin/env node
/**
 * Converte as abas de planos da planilha do treinador ("Planos", "Refeições", "Suplementos", "Treinos_Rotinas" e
 * "Treinos_Exercicios") em um JSON por aluno com o rascunho de **dieta** e de **treino** no formato do `ConteudoDieta` e
 * do `ConteudoTreino`, mais um `problemas.csv` (só aba, linha e motivo). Regras em `planos-lib.mjs`; passo a passo em
 * `docs/importacao-alunos.md`.
 *
 *   node scripts/importacao/converter-planos.mjs --planilha C:\fora\do\repositorio\planilha.xlsx --saida C:\Users\<voce>\Documents\planos-saraiva
 *   node scripts/importacao/converter-planos.mjs --planilha ... --saida ... --simular   (não grava nada, só as contagens)
 *
 * A planilha e a pasta de saída precisam ficar **fora do repositório** (o script recusa as duas dentro dele). O nome de
 * cada arquivo é o código do aluno na planilha, nunca o nome. O terminal mostra só contagens. Não fala com a API e nunca
 * abre a aba "TACO". Depois de conferir os problemas, `importar-planos.mjs` leva os rascunhos para a API.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lerReferenciasDeSuplementos } from './biblioteca-local.mjs';
import { dentroDoRepositorio, real } from './fora-do-repositorio.mjs';
import { arquivosCsv, lerXlsx } from './planilha-lib.mjs';
import { ABAS_LIDAS, converterPlanos, nomeDoArquivo, resumoDosPlanos } from './planos-lib.mjs';

const argumento = (nome) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : null;
};
const SIMULAR = process.argv.includes('--simular');

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const PLANILHA = argumento('--planilha');
const SAIDA = argumento('--saida');
if (!PLANILHA || !SAIDA) sair('Informe a planilha e a pasta de saída: --planilha <arquivo.xlsx> --saida <pasta>.');
const planilha = real(PLANILHA);
const saida = real(SAIDA);
if (dentroDoRepositorio(planilha)) sair('A planilha está dentro do repositório. Deixe-a fora dele (dado de aluno nunca vai para o git).');
if (dentroDoRepositorio(saida)) sair('A pasta de saída está dentro do repositório. Use uma pasta fora dele (dado de aluno nunca vai para o git).');

let bytes;
try {
  bytes = readFileSync(planilha);
} catch {
  sair('Não consegui ler a planilha informada.');
}

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
let resultado;
try {
  // Só as abas de ABAS_LIDAS são abertas: a "TACO" (tabela de terceiros) nem é descomprimida.
  resultado = converterPlanos(lerXlsx(bytes, { abas: ABAS_LIDAS }), hoje, lerReferenciasDeSuplementos());
} catch (e) {
  // As mensagens da leitura e da conversão são fixas (nome de aba e de coluna esperados), nunca valor da planilha.
  sair(`Planilha não convertida: ${e.message}`);
}

if (!SIMULAR) {
  mkdirSync(saida, { recursive: true });
  const usados = new Set();
  for (const plano of resultado.arquivos) {
    // 0600: só o dono lê, porque o JSON tem nome, dieta e observações do aluno.
    writeFileSync(join(saida, nomeDoArquivo(plano.codigo, usados)), `${JSON.stringify(plano, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  writeFileSync(join(saida, 'problemas.csv'), arquivosCsv({ alunos: [], pesos: [], problemas: resultado.problemas })['problemas.csv'], { encoding: 'utf8', mode: 0o600 });
}
for (const linha of resumoDosPlanos(resultado)) console.log(linha);
console.log(SIMULAR
  ? 'Simulação: nada foi gravado.'
  : `Gravados na pasta de saída: ${resultado.arquivos.length} arquivo(s) JSON (um por aluno) e problemas.csv. Confira os problemas antes de importar.`);
