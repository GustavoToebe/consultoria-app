import type { Problema } from '../../api/tipos';
import type { Problemas } from '../../dominio/validacaoDeSerie';

/**
 * Como o editor lê a lista da validação do treino (`validarTreino` ou a resposta do servidor): os problemas de um grupo e
 * de um exercício da sessão aberta, com a chave relativa a ele. Nada daqui conhece componente.
 */

/** Junta duas listas sem repetir o mesmo caminho (a validação local e a do servidor falam dos mesmos campos). */
export function juntarProblemas(...listas: readonly (readonly Problema[])[]): Problema[] {
  const vistos = new Set<string>();
  const junto: Problema[] = [];
  for (const lista of listas) {
    for (const p of lista) {
      const chave = `${p.caminho}\u0000${p.mensagem}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      junto.push(p);
    }
  }
  return junto;
}

/** Problemas sob um caminho: o próprio caminho vira `geral`, e `caminho.campo` vira `campo` (a primeira mensagem de cada). */
function sob(lista: readonly Problema[], caminho: string, excluir?: RegExp): Problemas {
  const resultado: Problemas = {};
  for (const p of lista) {
    let chave: string;
    if (p.caminho === caminho) chave = 'geral';
    else if (p.caminho.startsWith(`${caminho}.`)) chave = p.caminho.slice(caminho.length + 1);
    else continue;
    if (excluir?.test(chave)) continue;
    if (!(chave in resultado)) resultado[chave] = p.mensagem;
  }
  return resultado;
}

/** Problemas do grupo `g` da sessão `s`: `geral` (membros), `tecnica`, `descansoAposSegundos`, `voltas`. */
export function problemasDoGrupo(lista: readonly Problema[], s: number, g: number): Problemas {
  return sob(lista, `sessoes[${s}].grupos[${g}]`);
}

/** Problemas do exercício `e` da sessão `s` que não são de uma série: `nome`, `videoUrl`, `cadencia`, `grupoUid`, `geral`... */
export function problemasDoExercicio(lista: readonly Problema[], s: number, e: number): Problemas {
  return sob(lista, `sessoes[${s}].exercicios[${e}]`, /^series(\[|$)/);
}
