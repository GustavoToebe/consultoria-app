#!/usr/bin/env node
/**
 * Converte as abas de planos da planilha do treinador ("Planos", "Refeições", "Suplementos", "Treinos_Rotinas" e
 * "Treinos_Exercicios") em um JSON por aluno com o rascunho de **dieta** e de **treino** no formato do `ConteudoDieta` e
 * do `ConteudoTreino`, mais um `problemas.csv` (só aba, linha e motivo). Regras em `planos-lib.mjs`; passo a passo em
 * `docs/importacao-alunos.md`.
 *
 *   node scripts/importacao/converter-planos.mjs --planilha C:\fora\do\repositorio\planilha.xlsx --saida C:\Users\<voce>\Documents\planos-saraiva
 *   node scripts/importacao/converter-planos.mjs --planilha ... --saida ... --simular   (não grava nada, só as contagens)
 *   node scripts/importacao/converter-planos.mjs --planilha ... --saida ... --pacote    (grava também a pasta para-o-saraiva)
 *
 * A planilha e a pasta de saída precisam ficar **fora do repositório** (o script recusa as duas dentro dele). O nome de
 * cada arquivo é o código do aluno na planilha, nunca o nome. O terminal mostra só contagens. Não fala com a API e nunca
 * abre a aba "TACO". Depois de conferir os problemas, `importar-planos.mjs` leva os rascunhos para a API.
 *
 * Também grava `correspondencias-exercicios.csv` na pasta de saída: os exercícios sem par exato na biblioteca, cada um com a
 * sugestão mais parecida e a coluna `confirmado` em branco. Quem escreve `sim` é o treinador; o importador usa só essas
 * linhas (ou escreve o nome certo em `nome_correto`). Gerar de novo não mexe nas linhas que já têm `confirmado` ou
 * `nome_correto` preenchido.
 *
 * Grava também `classificacao-suplementos.csv`: os itens da aba "Suplementos" que nenhuma lista reconhece (hoje na lista
 * sensível "Medicação e ergogênicos"), por nome normalizado e quantas vezes aparecem, com a coluna `destino` em branco.
 * O treinador escreve `suplemento` ou `sensivel` (ou `s`, `medicamento`, `medicacao`, `m`, com ou sem acento); o importador
 * usa só essas linhas. Valor que ninguém entende vira "destino não entendido" no resumo e no `problemas.csv` (aba, linha).
 * Gerar de novo preserva o `destino` já preenchido. O arquivo é sempre gravado (só com o cabeçalho quando não há nada a
 * classificar).
 *
 * Com `--pacote` grava, em `para-o-saraiva/` dentro da pasta de saída, as 3 planilhas que o Saraiva confere (suplementos,
 * exercícios sem par e o que corrigir) e a mensagem para mandar a ele: têm nome e dado real de aluno, nunca vão para o git
 * nem para o chat (só por canal privado). Com `--simular` só conta.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lerBibliotecaLocal, lerReferenciasDeSuplementos } from './biblioteca-local.mjs';
import { ARQUIVO_CLASSIFICACAO, csvDeClassificacao, destinosNaoEntendidos, lerClassificacao, linhasDeClassificacao } from './classificacao-suplementos-lib.mjs';
import { ARQUIVO_CORRESPONDENCIAS, csvDeCorrespondencias, decodificarCsv, lerCorrespondencias, linhasDeCorrespondencia, respostasEmDuvida } from './correspondencias-lib.mjs';
import { dentroDoRepositorio, real } from './fora-do-repositorio.mjs';
import { PASTA_DO_PACOTE, csvDeExerciciosParaConferir, csvDeSuplementosParaConferir, csvDoQueCorrigir, textoDaMensagem } from './pacote-saraiva-lib.mjs';
import { arquivosCsv, lerXlsx } from './planilha-lib.mjs';
import { ABAS_LIDAS, converterPlanos, nomeDoArquivo, resumoDosPlanos } from './planos-lib.mjs';

const argumento = (nome) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : null;
};
const SIMULAR = process.argv.includes('--simular');
const PACOTE = process.argv.includes('--pacote');

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
const correspondenciasAnteriores = lerAnterior(ARQUIVO_CORRESPONDENCIAS, lerCorrespondencias);
const correspondencias = linhasDeCorrespondencia(resultado.arquivos, lerBibliotecaLocal(), correspondenciasAnteriores);
const classificacaoAnterior = lerAnterior(ARQUIVO_CLASSIFICACAO, lerClassificacao);
const classificacao = linhasDeClassificacao(resultado.arquivos, refs, classificacaoAnterior);
// Destino que ninguém entende: vira problema (só a linha do arquivo, nunca o valor) junto com os da planilha.
const problemas = [
  ...resultado.problemas,
  ...[...destinosNaoEntendidos(classificacaoAnterior).values()].map((linha) => ({
    aba: ARQUIVO_CLASSIFICACAO, linha, tipo: 'destino não entendido', motivo: 'destino não entendido', codigo: null,
  })),
  // "sim" e um nome certo na mesma linha de correspondências: não vincula nada; o Saraiva confirma qual vale.
  ...[...respostasEmDuvida(correspondenciasAnteriores).values()].map((linha) => ({
    aba: ARQUIVO_CORRESPONDENCIAS, linha, tipo: 'resposta em dúvida', motivo: 'resposta em dúvida', codigo: null,
  })),
];

if (!SIMULAR) {
  mkdirSync(saida, { recursive: true });
  const usados = new Set();
  for (const plano of resultado.arquivos) {
    // 0600: só o dono lê, porque o JSON tem nome, dieta e observações do aluno.
    writeFileSync(join(saida, nomeDoArquivo(plano.codigo, usados)), `${JSON.stringify(plano, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  writeFileSync(join(saida, ARQUIVO_CORRESPONDENCIAS), csvDeCorrespondencias(correspondencias.linhas), { encoding: 'utf8', mode: 0o600 });
  writeFileSync(join(saida, ARQUIVO_CLASSIFICACAO), csvDeClassificacao(classificacao.linhas), { encoding: 'utf8', mode: 0o600 });
  writeFileSync(join(saida, 'problemas.csv'), arquivosCsv({ alunos: [], pesos: [], problemas })['problemas.csv'], { encoding: 'utf8', mode: 0o600 });
}

// O pacote do Saraiva: tem dado real de aluno, então fica na pasta de saída (fora do repositório), com 0600, e o terminal só conta.
let pacote = null;
if (PACOTE) {
  const suplementos = csvDeSuplementosParaConferir(classificacao.linhas);
  const exercicios = csvDeExerciciosParaConferir(correspondencias.linhas);
  const corrigir = csvDoQueCorrigir(problemas, resultado.nomes);
  pacote = { suplementos, exercicios, corrigir };
  if (!SIMULAR) {
    const pastaDoPacote = join(saida, PASTA_DO_PACOTE);
    mkdirSync(pastaDoPacote, { recursive: true });
    const grava = (nome, conteudo) => writeFileSync(join(pastaDoPacote, nome), conteudo, { encoding: 'utf8', mode: 0o600 });
    grava('1-suplementos.csv', suplementos.csv);
    grava('2-exercicios.csv', exercicios.csv);
    grava('3-o-que-corrigir.csv', corrigir.csv);
    grava('mensagem.txt', textoDaMensagem({ suplementos: suplementos.total, exercicios: exercicios.total, problemas: corrigir.total }));
  }
}
for (const linha of resumoDosPlanos({ ...resultado, problemas })) console.log(linha);
const r = correspondencias.resumo;
console.log(`Exercícios sem par exato na biblioteca nem no catálogo: ${r.nomesSemPar} nomes diferentes (${r.comSugestao} com sugestão da biblioteca, ${r.semSugestao} sem); ${r.confirmadosNoArquivo} linhas já respondidas no arquivo (${r.confirmadosSim} "sim", ${r.comNomeCorreto} com o nome certo escrito)${r.emDuvida ? `; ${r.emDuvida} respostas em dúvida (sim e nome certo na mesma linha: não vinculam; listadas em problemas.csv, com a linha)` : ''}.`);
const s = classificacao.resumo;
console.log(`Suplementos que nenhuma lista reconhece (hoje na lista sensível): ${s.itens} itens, ${s.nomesDistintos} nomes diferentes; ${s.comDestinoNoArquivo} linhas já com "destino" entendido no arquivo${s.naoEntendidos ? ` e ${s.naoEntendidos} com destino não entendido (listadas em problemas.csv, com a linha)` : ''}.${s.semNome ? ` Mais ${s.semNome} itens sem nome aproveitável (ficam na lista sensível).` : ''}`);
if (pacote) {
  console.log(`Pacote do Saraiva: ${pacote.suplementos.total} suplementos, ${pacote.exercicios.total} exercícios (${pacote.exercicios.semSugestao} sem sugestão) e ${pacote.corrigir.total} linhas a corrigir${SIMULAR ? ' (nada gravado)' : ` em ${PASTA_DO_PACOTE}/ (1-suplementos.csv, 2-exercicios.csv, 3-o-que-corrigir.csv e mensagem.txt): mande por canal privado, nunca em grupo`}.`);
}
console.log(SIMULAR
  ? 'Simulação: nada foi gravado.'
  : `Gravados na pasta de saída: ${resultado.arquivos.length} arquivo(s) JSON (um por aluno), problemas.csv, ${ARQUIVO_CORRESPONDENCIAS} (${correspondencias.linhas.length} linhas) e ${ARQUIVO_CLASSIFICACAO} (${classificacao.linhas.length} linhas). Confira os problemas antes de importar.`);
