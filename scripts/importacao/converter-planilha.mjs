#!/usr/bin/env node
/**
 * Converte a planilha do treinador (`.xlsx` com as abas "Alunos" e "Histórico Pesos") nos dois CSV do importador de
 * alunos e pesos (`importar-alunos.mjs`), mais um `problemas.csv` com as linhas que ficaram de fora. Pedido da reunião de
 * 17/10 (R25/R26/R51); as regras estão em `planilha-lib.mjs` e o passo a passo em `docs/importacao-alunos.md`.
 *
 *   node scripts/importacao/converter-planilha.mjs --planilha C:\fora\do\repositorio\alunos.xlsx --saida C:\fora\do\repositorio\csv
 *
 * A planilha e a pasta de saída precisam ficar **fora do repositório** (dado de aluno nunca vai para o git); o script
 * recusa as duas dentro dele. O terminal mostra só contagens, e `problemas.csv` só aba, linha e motivo: nunca nome,
 * e-mail ou peso. Não fala com a API: depois de conferir os problemas, rode o importador com `--pasta` na mesma saída.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { arquivosCsv, converter, lerXlsx, resumo } from './planilha-lib.mjs';

/** Caminho real (sem link simbólico) do que já existe; o que ainda não existe, pelo caminho real da pasta mais próxima. */
function real(caminho) {
  const absoluto = resolve(caminho);
  if (existsSync(absoluto)) return realpathSync(absoluto);
  const pai = dirname(absoluto);
  return pai === absoluto ? absoluto : join(real(pai), relative(pai, absoluto));
}

const REPOSITORIO = real(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const argumento = (nome) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : null;
};

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const dentroDoRepositorio = (caminho) => {
  const r = relative(REPOSITORIO, caminho);
  return !r.startsWith('..') && !isAbsolute(r);
};

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
  resultado = converter(lerXlsx(bytes), hoje);
} catch (e) {
  // As mensagens da leitura e da conversão são fixas (nome de aba e de coluna esperados), nunca valor da planilha.
  sair(`Planilha não convertida: ${e.message}`);
}

mkdirSync(saida, { recursive: true });
for (const [nome, conteudo] of Object.entries(arquivosCsv(resultado))) {
  // 0600: só o dono lê, porque alunos.csv e pesos.csv têm dado pessoal e de saúde.
  writeFileSync(join(saida, nome), conteudo, { encoding: 'utf8', mode: 0o600 });
}
for (const linha of resumo(resultado)) console.log(linha);
console.log('Arquivos gravados na pasta de saída: alunos.csv, pesos.csv e problemas.csv. Confira os problemas antes de importar.');
