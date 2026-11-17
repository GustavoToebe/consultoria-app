import type { Sessao } from '../api/tipos';

/**
 * Equipamentos do dia ("Equipamentos para hoje"): os `equipamento` dos exercícios da sessão, copiados da biblioteca na
 * publicação. Sem repetir (maiúsculas e minúsculas contam como igual; fica a primeira grafia), na ordem em que aparecem,
 * cardio e grupos como qualquer outro exercício. Nada é inventado: sem equipamento nenhum a lista é vazia e a seção não aparece.
 */
export function equipamentosDoDia(sessao: Pick<Sessao, 'exercicios'>): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const e of sessao.exercicios ?? []) {
    const nome = e.equipamento?.trim();
    if (!nome) continue;
    const chave = nome.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(nome);
  }
  return lista;
}
