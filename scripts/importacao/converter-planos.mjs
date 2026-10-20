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
 *
 * Também grava `correspondencias-exercicios.csv` na pasta de saída: os exercícios sem par exato na biblioteca, cada um com a
 * sugestão mais parecida e a coluna `confirmado` em branco. Quem escreve `sim` é o treinador; o importador usa só essas
 * linhas. Gerar de novo não mexe nas linhas que já têm `confirmado` preenchido.
 *
 * Grava também `classificacao-suplementos.csv`: os itens da aba "Suplementos" que nenhuma lista reconhece (hoje na lista
 * sensível "Medicação e ergogênicos"), por nome normalizado e quantas vezes aparecem, com a coluna `destino` em branco.
 * O treinador escreve `suplemento` ou `sensivel`; o importador usa só essas linhas. Gerar de novo preserva o `destino`
 * já preenchido. O arquivo é sempre gravado (só com o cabeçalho quando não há nada a classificar).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lerBibliotecaLocal, lerReferenciasDeSuplementos } from './biblioteca-local.mjs';
import { ARQUIVO_CLASSIFICACAO, csvDeClassificacao, lerClassificacao, linhasDeClassificacao } from './classificacao-suplementos-lib.mjs';
import { ARQUIVO_CORRESPONDENCIAS, csvDeCorrespondencias, decodificarCsv, lerCorrespondencias, linhasDeCorrespondencia } from './correspondencias-lib.mjs';
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

const refs = lerReferenciasDeSuplementos();
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
let resultado;
try {
  // Só as abas de ABAS_LIDAS são abertas: a "TACO" (tabela de terceiros) nem é descomprimida.
  resultado = converterPlanos(lerXlsx(bytes, { abas: ABAS_LIDAS }), hoje, refs);
} catch (e) {
  // As mensagens da leitura e da conversão são fixas (nome de aba e de coluna esperados), nunca valor da planilha.
  sair(`Planilha não convertida: ${e.message}`);
}

/** O CSV que já existe na pasta de saída (se existir) guarda o que o treinador preencheu; arquivo estranho para tudo. */
function lerAnterior(arquivo, ler) {
  if (!existsSync(join(saida, arquivo))) return new Map();
  try {
    return ler(decodificarCsv(readFileSync(join(saida, arquivo))));
  } catch (e) {
    return sair(`Planilha não convertida: ${e.message}. Corrija ou apague esse arquivo da pasta de saída.`);
  }
}
const correspondencias = linhasDeCorrespondencia(resultado.arquivos, lerBibliotecaLocal(), lerAnterior(ARQUIVO_CORRESPONDENCIAS, lerCorrespondencias));
const classificacao = linhasDeClassificacao(resultado.arquivos, refs, lerAnterior(ARQUIVO_CLASSIFICACAO, lerClassificacao));

if (!SIMULAR) {
  mkdirSync(saida, { recursive: true });
  const usados = new Set();
  for (const plano of resultado.arquivos) {
    // 0600: só o dono lê, porque o JSON tem nome, dieta e observações do aluno.
    writeFileSync(join(saida, nomeDoArquivo(plano.codigo, usados)), `${JSON.stringify(plano, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  writeFileSync(join(saida, ARQUIVO_CORRESPONDENCIAS), csvDeCorrespondencias(correspondencias.linhas), { encoding: 'utf8', mode: 0o600 });
  writeFileSync(join(saida, ARQUIVO_CLASSIFICACAO), csvDeClassificacao(classificacao.linhas), { encoding: 'utf8', mode: 0o600 });
  writeFileSync(join(saida, 'problemas.csv'), arquivosCsv({ alunos: [], pesos: [], problemas: resultado.problemas })['problemas.csv'], { encoding: 'utf8', mode: 0o600 });
}
for (const linha of resumoDosPlanos(resultado)) console.log(linha);
const r = correspondencias.resumo;
console.log(`Exercícios sem par exato na biblioteca nem no catálogo: ${r.nomesSemPar} nomes diferentes (${r.comSugestao} com sugestão da biblioteca, ${r.semSugestao} sem); ${r.confirmadosNoArquivo} linhas já com "confirmado" preenchido no arquivo (${r.confirmadosSim} "sim").`);
const s = classificacao.resumo;
console.log(`Suplementos que nenhuma lista reconhece (hoje na lista sensível): ${s.itens} itens, ${s.nomesDistintos} nomes diferentes; ${s.comDestinoNoArquivo} linhas já com "destino" preenchido no arquivo.${s.semNome ? ` Mais ${s.semNome} itens sem nome aproveitável (ficam na lista sensível).` : ''}`);
console.log(SIMULAR
  ? 'Simulação: nada foi gravado.'
  : `Gravados na pasta de saída: ${resultado.arquivos.length} arquivo(s) JSON (um por aluno), problemas.csv, ${ARQUIVO_CORRESPONDENCIAS} (${correspondencias.linhas.length} linhas) e ${ARQUIVO_CLASSIFICACAO} (${classificacao.linhas.length} linhas). Confira os problemas antes de importar.`);
