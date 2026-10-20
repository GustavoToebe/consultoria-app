/**
 * Regras puras do `classificacao-suplementos.csv`: a lista, para o treinador conferir, dos itens da aba "Suplementos" que
 * **nenhuma lista reconhece** (nem a de ergogênicos, nem a de suplementos conhecidos e comuns). Hoje eles vão para a lista
 * sensível "Medicação e ergogênicos"; o treinador escreve na coluna `destino` o que cada nome é:
 *
 * - `suplemento`: o `importar-planos.mjs` leva o item para a Suplementação da dieta;
 * - `sensivel`: continua em Medicação e ergogênicos (é o que acontece em branco ou sem o arquivo; só passa a contar como
 *   "classificado");
 * - qualquer outro valor é ignorado e o item conta como não classificado (e continua na lista sensível).
 *
 * O arquivo fica na pasta de saída do conversor (fora do repositório), com os nomes normalizados
 * ({@link nomeDeSuplementoNormalizado}: sem acento, minúsculas, sem dose, unidade nem parênteses) e quantas vezes cada um
 * aparece. Os que a lista de ergogênicos ou a de suplementos reconhecem **não** entram: a lista de ergogênicos continua
 * tendo precedência sempre, no conversor e no importador (que recalcula o destino de cada item com as mesmas listas).
 *
 * Nada aqui lê ou grava arquivo. Mesmo molde do `correspondencias-lib.mjs` (BOM, `;`, apóstrofo contra fórmula,
 * windows-1252 na leitura, regerar preserva o que foi preenchido).
 */
import { coluna, lerCsv } from './alunos-lib.mjs';
import { semApostrofoDeFormula, textoDeCsv } from './csv-apoio-lib.mjs';
import { LIMITE_DE_SUPLEMENTOS, destinoDoSuplemento, nomeDeSuplementoNormalizado } from './planos-lib.mjs';

export const ARQUIVO_CLASSIFICACAO = 'classificacao-suplementos.csv';

const CABECALHO = ['nome_normalizado', 'ocorrencias', 'destino'];

/** O item nenhuma lista reconhece: é o único que o treinador classifica. */
const naoReconhecido = (nome, refs) => destinoDoSuplemento(nome, refs) === 'ergogenico-nao-reconhecido';

/**
 * As linhas do arquivo e o resumo. `arquivos` = os JSON convertidos; `refs` = as listas de referência do conversor;
 * `anteriores` = o arquivo já existente lido por {@link lerClassificacao} (ou vazio).
 *
 * Só entra item da lista sensível que nenhuma lista reconhece, por nome normalizado (nome que fica vazio depois da
 * normalização, como "500 mg", não dá para classificar e não entra). Quem já tem `destino` preenchido no arquivo anterior
 * fica como está e nunca sai do arquivo; só `ocorrencias` é atualizada (0 se o nome sumiu da planilha). O `destino` de um
 * nome que continua na planilha é sempre o do arquivo anterior (em branco continua em branco). Ordem: mais frequentes
 * primeiro.
 */
export function linhasDeClassificacao(arquivos, refs, anteriores = new Map()) {
  const contagem = new Map();
  let itens = 0;
  let semNome = 0;
  for (const a of arquivos) {
    for (const e of a.dieta?.conteudo.ergogenicos ?? []) {
      if (!naoReconhecido(e.nome, refs)) continue;
      const k = nomeDeSuplementoNormalizado(e.nome);
      if (!k) { semNome++; continue; }
      itens++;
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
  }
  const linhas = [...contagem].map(([k, n]) => ({ nome: k, ocorrencias: n, destino: anteriores.get(k)?.destino ?? '' }));
  for (const [k, antes] of anteriores) {
    if (antes.destino && !contagem.has(k)) linhas.push({ nome: antes.nome, ocorrencias: 0, destino: antes.destino });
  }
  linhas.sort((x, y) => y.ocorrencias - x.ocorrencias || (x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : 0));
  return {
    linhas,
    resumo: {
      nomesDistintos: contagem.size,
      itens,
      semNome,
      comDestinoNoArquivo: linhas.filter((l) => l.destino).length,
    },
  };
}

/** O arquivo, em UTF-8 com BOM (o Excel reconhece os acentos) e `;`. */
export const csvDeClassificacao = (linhas) => textoDeCsv(CABECALHO, linhas.map((l) => [l.nome, l.ocorrencias, l.destino]));

/**
 * Lê o arquivo (já decodificado) em `Map` nome normalizado -> `{ nome, ocorrencias, destino }`. O nome é normalizado de novo
 * na leitura (o Excel pode ter mexido na caixa); as colunas vêm pelo cabeçalho; linha repetida: vale a primeira. Erro com
 * mensagem fixa, sem conteúdo do arquivo.
 */
export function lerClassificacao(texto) {
  const { colunas, linhas } = lerCsv(texto);
  const faltam = ['nome_normalizado', 'destino'].filter((c) => !colunas.includes(coluna(c)));
  if (faltam.length) throw new Error(`o ${ARQUIVO_CLASSIFICACAO} não tem as colunas: ${faltam.join(', ')}`);
  const lidas = new Map();
  for (const l of linhas) {
    const nome = semApostrofoDeFormula(l.nome_normalizado);
    const k = nomeDeSuplementoNormalizado(nome);
    if (!k || lidas.has(k)) continue;
    lidas.set(k, { nome: k, ocorrencias: l.ocorrencias ?? '', destino: l.destino });
  }
  return lidas;
}

/** Os destinos que valem: `Map` nome normalizado -> `suplemento` ou `sensivel` (caixa e espaços nas pontas não importam). */
export function destinosClassificados(lidas) {
  const destinos = new Map();
  for (const [k, l] of lidas) {
    const d = l.destino.trim().toLowerCase();
    if (d === 'suplemento' || d === 'sensivel') destinos.set(k, d);
  }
  return destinos;
}

const comoSuplemento = (e) => ({ uid: e.uid, nome: e.nome, dose: e.dose, horario: e.horario, observacao: e.observacao, link: null });

/**
 * Aplica os destinos aos planos já convertidos, sem mudar os de entrada. Só mexe em item da lista sensível que nenhuma lista
 * reconhece (recalculado aqui com `refs`): o que a lista de ergogênicos reconhece nunca sai de lá, mesmo que o nome
 * normalizado seja igual ao de uma linha `suplemento`. `suplemento` leva o item para a Suplementação (formato dela: sem
 * princípio ativo, concentração nem prescrição); passando do limite da API, ele fica na lista sensível e conta em
 * `semVaga`. A lista sensível que esvazia vira `null`, como no conversor. Devolve os planos novos e as contagens, só de
 * itens que nenhuma lista reconhece: `suplemento` (movidos), `sensivel`, `naoClassificado` (em branco, valor inválido,
 * nome sem letras ou sem linha no arquivo) e `semVaga`.
 */
export function aplicarClassificacao(planos, refs, destinos = new Map()) {
  const c = { suplemento: 0, sensivel: 0, naoClassificado: 0, semVaga: 0 };
  const novos = planos.map((p) => {
    const sensiveis = p.dieta?.conteudo.ergogenicos;
    if (!sensiveis?.length) return p;
    const suplementacao = [...(p.dieta.conteudo.suplementacao ?? [])];
    const ficam = [];
    for (const e of sensiveis) {
      if (!naoReconhecido(e.nome, refs)) { ficam.push(e); continue; }
      const k = nomeDeSuplementoNormalizado(e.nome);
      const destino = k ? destinos.get(k) : undefined;
      if (destino === 'suplemento') {
        if (suplementacao.length < LIMITE_DE_SUPLEMENTOS) { suplementacao.push(comoSuplemento(e)); c.suplemento++; continue; }
        c.semVaga++;
      } else if (destino === 'sensivel') c.sensivel++;
      else c.naoClassificado++;
      ficam.push(e);
    }
    return { ...p, dieta: { ...p.dieta, conteudo: { ...p.dieta.conteudo, suplementacao, ergogenicos: ficam.length ? ficam : null } } };
  });
  return { planos: novos, contagens: c };
}
