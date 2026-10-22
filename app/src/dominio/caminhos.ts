/**
 * O validador da API aponta cada problema por caminho no conteúdo (`sessoes[0].exercicios[1].series[2].repsMax`).
 * Aqui o caminho vira texto legível ("Segunda - Costas › Remada baixa › série 3") e a lista de uids dos itens no
 * caminho, para o editor destacar os cartões com problema.
 */

const SEGMENTO = /^([A-Za-z]+)(?:\[(\d+)\])?$/;

const NOMES_DE_CAMPO: Record<string, string> = {
  sessoes: 'Sessões',
  exercicios: 'exercícios',
  series: 'séries',
  refeicoes: 'Refeições',
  opcoes: 'opções',
  itens: 'itens',
  fim: 'Período',
  inicio: 'Período',
};

interface Rotulavel {
  uid?: string;
  nome?: string;
  rotulo?: string;
}

export interface Localizacao {
  texto: string;
  uids: string[];
}

export function localizar(conteudo: unknown, caminho: string): Localizacao {
  const partes: string[] = [];
  const uids: string[] = [];
  let atual: unknown = conteudo;
  for (const segmento of caminho.split('.')) {
    const m = SEGMENTO.exec(segmento);
    if (!m) break;
    const [, campo, indice] = m;
    if (indice === undefined) {
      if (NOMES_DE_CAMPO[campo] && partes.length === 0) partes.push(NOMES_DE_CAMPO[campo]);
      break;
    }
    const lista = (atual as Record<string, unknown> | null)?.[campo];
    const item = Array.isArray(lista) ? (lista[Number(indice)] as Rotulavel | undefined) : undefined;
    if (!item) break;
    if (item.uid) uids.push(item.uid);
    const posicao = Number(indice) + 1;
    if (campo === 'series') partes.push(`série ${posicao}`);
    else if (campo === 'opcoes') partes.push(`opção ${item.rotulo || posicao}`);
    else if (campo === 'grupos') partes.push(`grupo ${posicao}`);
    else partes.push(item.nome?.trim() || `${campo === 'sessoes' ? 'sessão' : 'item'} ${posicao}`);
    atual = item;
  }
  return { texto: partes.join(' › '), uids };
}

/** Uids de todos os itens com problema (para marcar os cartões). */
export function uidsComProblema(conteudo: unknown, caminhos: string[]): Set<string> {
  const conjunto = new Set<string>();
  for (const c of caminhos) {
    for (const uid of localizar(conteudo, c).uids) conjunto.add(uid);
  }
  return conjunto;
}
