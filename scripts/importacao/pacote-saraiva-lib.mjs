/**
 * Regras puras do pacote que o Saraiva recebe para conferir (`converter-planos.mjs --pacote`): três planilhas que ele abre
 * no Excel do Brasil (CSV em UTF-8 com BOM e `;`) e o texto da mensagem que o Gustavo manda junto.
 *
 * - `1-suplementos.csv`: os itens que nenhuma lista reconhece, para ele escrever o destino de cada um;
 * - `2-exercicios.csv`: os exercícios sem par na biblioteca, com a sugestão do app, para ele confirmar ou corrigir;
 * - `3-o-que-corrigir.csv`: os problemas da planilha dele, em português simples, aluno por aluno.
 *
 * **Têm nome e dado real de aluno**: ficam fora do repositório e vão ao Saraiva por canal privado. Nada aqui lê ou grava
 * arquivo, e nenhum texto de problema repete o conteúdo da planilha.
 */
import { chaveDoNome } from './alunos-lib.mjs';
import { textoDeCsv } from './csv-apoio-lib.mjs';

export const PASTA_DO_PACOTE = 'para-o-saraiva';
export const ARQUIVOS_DO_PACOTE = ['1-suplementos.csv', '2-exercicios.csv', '3-o-que-corrigir.csv', 'mensagem.txt'];

/** O que o arquivo mostra quando o app não tem sugestão. */
export const SEM_SUGESTAO = '—';

/** `linhas` de {@link import('./classificacao-suplementos-lib.mjs').linhasDeClassificacao}: só os nomes que ainda aparecem na planilha. */
export function csvDeSuplementosParaConferir(linhas) {
  const corpo = linhas.filter((l) => l.ocorrencias > 0).map((l) => [l.nome, l.ocorrencias, l.destino]);
  return { csv: textoDeCsv(['Nome na planilha', 'Quantas vezes aparece', 'Destino'], corpo), total: corpo.length };
}

/** `linhas` de {@link import('./correspondencias-lib.mjs').linhasDeCorrespondencia}: só os sem par, do que mais aparece para o que menos aparece. */
export function csvDeExerciciosParaConferir(linhas) {
  const sem = linhas.filter((l) => l.semPar);
  const corpo = sem.map((l) => [l.nome, l.ocorrencias, l.sugestao || SEM_SUGESTAO, l.confirmado, l.correcao ?? '']);
  return {
    csv: textoDeCsv(['Nome na planilha', 'Quantas vezes aparece', 'Sugestão do app', 'Está certo?', 'Se não, qual é'], corpo),
    total: corpo.length,
    semSugestao: sem.filter((l) => !l.sugestao).length,
  };
}

const quantos = (m, i = 1) => Number(m[i]);

/**
 * Um texto por tipo de problema: [expressão sobre o `tipo` do problema, função que monta o texto]. Sem código, sem número
 * de coluna e sem conteúdo da planilha: só o que o Saraiva precisa fazer. Os números vêm do próprio tipo.
 */
const TEXTOS = [
  // alunos e planos
  [/^(plano|rotina) sem ID$/, (m) => `falta o código deste ${m[1] === 'rotina' ? 'treino' : 'plano'}; confira a coluna do código`],
  [/^aluno do (plano|rotina) não está entre os alunos convertidos$/, (m) => `este ${m[1] === 'rotina' ? 'treino' : 'plano'} é de um aluno que não está na aba Alunos`],
  [/^(plano|rotina) inativ[oa] \(ignorad[oa]\)$/, (m) => `este ${m[1] === 'rotina' ? 'treino' : 'plano'} está marcado como inativo e não vai ser importado; se era para importar, marque como ativo`],
  [/^mais de uma? (plano|rotina) ativ[oa] para o aluno/, (m) => `este aluno tem mais de um ${m[1] === 'rotina' ? 'treino' : 'plano'} marcado como ativo; deixe só um`],
  // treino
  [/^exercício de rotina que não existe/, () => 'este exercício aponta para um treino que não existe; confira o código do treino'],
  [/^exercício sem a letra do treino/, () => 'falta a letra do treino (A, B, C...) deste exercício'],
  [/^rotina sem exercícios aproveitáveis$/, () => 'nenhum exercício deste treino pôde ser aproveitado; confira os nomes e as séries'],
  [/^rotina sem exercícios$/, () => 'este treino não tem nenhum exercício'],
  [/^rotina com mais de (\d+) treinos/, (m) => `este plano tem mais de ${quantos(m)} treinos (letras); o app aceita até ${quantos(m)}`],
  [/^treino sem nome/, () => 'falta o nome deste treino; no app vai aparecer só como "Treino" e a letra'],
  [/^treino com mais de (\d+) exercícios/, (m) => `este treino tem mais de ${quantos(m)} exercícios; o app aceita até ${quantos(m)}`],
  [/^exercício sem nome/, () => 'falta o nome do exercício'],
  [/^nome do exercício com mais de (\d+) letras/, (m) => `o nome passa de ${quantos(m)} letras; encurte`],
  [/^link de vídeo não aceito/, () => 'o link do vídeo precisa ser um link https do YouTube; confira ou apague'],
  [/^top set sem percentual prescrito/, () => 'falta a porcentagem de aumento do Top set sobre a série anterior; preencha no editor'],
  [/^FS sem regra de percentual/, () => 'a série FS não tem a porcentagem da WS; diga a porcentagem ou troque o tipo da série'],
  [/^quantidade de (WS|FS) acima de (\d+)/, (m) => `mais de ${quantos(m, 2)} séries ${m[1]}; confira o número`],
  [/^quantidade de (WS|FS) inválida/, (m) => `o número de séries ${m[1]} não é um número inteiro válido; confira`],
  [/^faixa de repetições virou data/, () => 'a faixa de repetições virou uma data no Excel; escreva de novo, por exemplo 8a10'],
  [/^faixa de repetições vazia$/, () => 'falta a faixa de repetições'],
  [/^faixa de repetições inválida/, () => 'a faixa de repetições não foi entendida; escreva por exemplo 8a10'],
  [/^(TS|BO) inválido/, (m) => `a coluna ${m[1]} não foi entendida; use sim ou não`],
  [/^back off sem percentual válido/, () => 'o back off não tem uma porcentagem válida; confira'],
  [/^exercício ficou sem série/, () => 'este exercício ficou sem séries; confira as colunas WS e FS'],
  // dieta
  [/^plano sem refeições aproveitáveis$/, () => 'este plano não tem refeições que possam ser importadas; confira a aba Refeições'],
  [/^item sem número de refeição válido/, () => 'falta o número da refeição deste item'],
  [/^dieta com mais de (\d+) refeições/, (m) => `esta dieta tem mais de ${quantos(m)} refeições; o app aceita até ${quantos(m)}`],
  [/^item sem alimento/, () => 'falta o nome do alimento'],
  [/^item sem opção, e a refeição tem outras opções/, () => 'falta a opção (A, B...) deste item, e a refeição tem outras opções'],
  [/^refeição ficou sem itens/, () => 'esta refeição não tem nenhum item aproveitável'],
  [/^refeição sem título/, () => 'falta o título desta refeição; no app vai aparecer só como "Refeição" e o número'],
  [/^opção com mais de (\d+) itens/, (m) => `esta opção tem mais de ${quantos(m)} itens; o app aceita até ${quantos(m)}`],
  [/^refeição com mais de (\d+) opções/, (m) => `esta refeição tem mais de ${quantos(m)} opções; o app aceita até ${quantos(m)}`],
  [/^quantidade ausente, zero ou inválida/, () => 'falta a quantidade em gramas deste alimento'],
  [/^unidade desconhecida/, () => 'a unidade não foi entendida; use g, ml ou un'],
  [/^item sem kcal/, () => 'falta o valor de kcal deste alimento'],
  [/^(kcal|proteína|carboidrato|gordura) fora de 0 a \d+/, (m) => `o valor de ${m[1]} é inválido; confira`],
  [/^suplemento ou medicamento sem nome/, () => 'falta o nome do suplemento ou medicamento'],
  [/^mais de (\d+) suplementos/, (m) => `este plano tem mais de ${quantos(m)} suplementos; o app aceita até ${quantos(m)}`],
  [/^mais de (\d+) itens de medicação/, (m) => `este plano tem mais de ${quantos(m)} itens de medicação; o app aceita até ${quantos(m)}`],
  // textos longos: "nome" vale para o que o app mostra como nome ou título; o resto é texto corrido
  [/^(?:nome|nome do treino|nome do alimento|título da refeição|rótulo da opção) com mais de (\d+) letras/, (m) => `o nome passa de ${quantos(m)} letras; encurte`],
  [/^.+ com mais de (\d+) letras \(cortado\)$/, (m) => `o texto passa de ${quantos(m)} letras; encurte`],
  // arquivos de decisão
  [/^destino não entendido$/, () => 'o destino não foi entendido; escreva suplemento ou medicamento'],
  [/^resposta em dúvida$/, () => 'tem "sim" e um nome em "Se não, qual é" ao mesmo tempo; deixe só um dos dois'],
];

/**
 * O texto "O que corrigir" de um problema `{ tipo, motivo }`. Tipo que a tabela não conhece vira um texto genérico com o
 * motivo (que nunca tem conteúdo da planilha).
 */
export function textoDoProblema(problema) {
  for (const [regra, monta] of TEXTOS) {
    const m = regra.exec(problema.tipo);
    if (m) return monta(m);
  }
  return `confira esta linha (${problema.motivo})`;
}

/**
 * As linhas do `3-o-que-corrigir.csv`. `nomes` = `Map` código -> nome do aluno (`converterPlanos().nomes`); código sem nome
 * aparece como está na planilha; problema sem aluno conhecido, "—". Ordem: aluno, aba, linha.
 */
export function csvDoQueCorrigir(problemas, nomes = new Map()) {
  const linhas = problemas.map((p) => ({
    aluno: p.codigo ? (nomes.get(p.codigo) ?? p.codigo) : '—',
    aba: p.aba,
    linha: p.linha,
    texto: textoDoProblema(p),
  }));
  linhas.sort((a, b) => chaveDoNome(a.aluno).localeCompare(chaveDoNome(b.aluno), 'pt-BR') || a.aba.localeCompare(b.aba, 'pt-BR') || a.linha - b.linha);
  return { csv: textoDeCsv(['Aluno', 'Aba', 'Linha', 'O que corrigir'], linhas.map((l) => [l.aluno, l.aba, l.linha, l.texto])), total: linhas.length };
}

/** A mensagem que o Gustavo manda junto (só contagens, nenhum dado de aluno). Negrito e itálico no jeito do WhatsApp. */
export function textoDaMensagem({ suplementos, exercicios, problemas }) {
  return [
    'Saraiva, para eu importar os treinos e as dietas dos seus alunos para o app, preciso que você confira 3 planilhas (estão',
    'anexadas):',
    '',
    `1. *Suplementos* (${suplementos} nomes): na coluna "Destino", escreva _suplemento_ ou _medicamento_ em cada um. Os que ficarem em`,
    '   branco entram como medicamento, e você pode mudar depois no app.',
    `2. *Exercícios* (${exercicios} nomes que o app não achou na biblioteca): confira a sugestão. Se estiver certa, escreva _sim_. Se`,
    '   não, escreva o nome certo na última coluna (nunca os dois na mesma linha). Os que ficarem em branco entram com o nome da planilha mesmo, sem vídeo.',
    `3. *O que corrigir* (${problemas} linhas): ajuste direto na sua planilha original e me mande de novo, junto com as correções dos`,
    '   alunos que já te pedi.',
    '',
    'Nada disso vai para os alunos sozinho: tudo entra como rascunho, e você revisa e publica cada plano no app.',
    '',
  ].join('\n');
}
