import type { SessaoConcluidaDoServidor } from '../api/tipos';

/** Uma conclusão: o que importa para a tela, venha do aparelho ou do servidor. */
export type ConclusaoDoTreino = SessaoConcluidaDoServidor;

/** Conclusão do aparelho: a que falhou (recusada pelo servidor) não vale na tela. */
export interface ConclusaoLocal extends ConclusaoDoTreino {
  situacao: 'LOCAL' | 'ENVIADO' | 'FALHOU';
}

/** Chave natural do servidor: versão do plano, sessão e dia. */
export const chaveDaConclusao = (c: Pick<ConclusaoDoTreino, 'planoVersaoId' | 'sessaoUid' | 'data'>) =>
  `${c.planoVersaoId}|${c.sessaoUid}|${c.data}`;

const paraConclusao = (c: ConclusaoDoTreino): ConclusaoDoTreino => ({
  ...(c.id ? { id: c.id } : {}),
  ...(c.vistoEm ? { vistoEm: c.vistoEm } : {}),
  planoVersaoId: c.planoVersaoId,
  sessaoUid: c.sessaoUid,
  data: c.data,
  concluida: c.concluida,
  resultado: c.resultado,
  duracaoSegundos: c.duracaoSegundos,
  comentario: c.comentario,
});

/**
 * Conclusões que a tela usa: as do aparelho e as que o servidor já tem. Na mesma versão, sessão e dia, a do aparelho
 * ganha (é a mais recente, ainda pode estar na fila); a que falhou não conta e deixa valer a do servidor, se houver.
 * Reabrir é uma conclusão com `concluida` falso, que também ganha do servidor. Saída em ordem fixa (data, sessão,
 * versão), para a tela e os testes não dependerem da ordem de chegada.
 */
export function fundirConclusoes(
  locais: readonly ConclusaoLocal[],
  doServidor: readonly ConclusaoDoTreino[],
): ConclusaoDoTreino[] {
  const porChave = new Map<string, ConclusaoDoTreino>();
  for (const c of doServidor) porChave.set(chaveDaConclusao(c), paraConclusao(c));
  for (const c of locais) {
    if (c.situacao === 'FALHOU') continue;
    // O "Visto" do treinador (0.5) é do registro no servidor: continua com a conclusão do aparelho enquanto ela é concluída.
    const doServidor = porChave.get(chaveDaConclusao(c));
    const visto = c.concluida && doServidor?.vistoEm ? { vistoEm: doServidor.vistoEm } : {};
    porChave.set(chaveDaConclusao(c), { ...paraConclusao(c), ...visto });
  }
  return [...porChave.values()].sort(
    (a, b) => a.data.localeCompare(b.data) || a.sessaoUid.localeCompare(b.sessaoUid) || a.planoVersaoId.localeCompare(b.planoVersaoId),
  );
}

/** A conclusão fundida daquele treino (versão, sessão e dia), ou `null` se não há nenhuma. */
export function conclusaoDe(
  fundidas: readonly ConclusaoDoTreino[],
  planoVersaoId: string,
  sessaoUid: string,
  data: string,
): ConclusaoDoTreino | null {
  const chave = chaveDaConclusao({ planoVersaoId, sessaoUid, data });
  return fundidas.find((c) => chaveDaConclusao(c) === chave) ?? null;
}

/**
 * Total de treinos concluídos mostrado ao aluno. Regra: o total do servidor (todo o histórico, do último GET) mais a
 * diferença que o aparelho ainda não viu confirmada, comparando por chave dentro da janela baixada:
 * - concluída no aparelho e não concluída no servidor: +1;
 * - reaberta no aparelho e concluída no servidor: -1;
 * - `FALHOU` fica de fora (o servidor recusou); `LOCAL` e `ENVIADO` contam.
 * Depois que o servidor confirma e o GET é refeito, a diferença some sozinha. `null` = nunca baixou (a tela não
 * inventa número); nunca negativo.
 */
export function totalDeConcluidos(
  totalDoServidor: number | null,
  doServidor: readonly ConclusaoDoTreino[],
  locais: readonly ConclusaoLocal[],
): number | null {
  if (totalDoServidor === null) return null;
  const noServidor = new Map(doServidor.map((c) => [chaveDaConclusao(c), c.concluida]));
  let diferenca = 0;
  for (const c of locais) {
    if (c.situacao === 'FALHOU') continue;
    const servidor = noServidor.get(chaveDaConclusao(c)) === true;
    if (c.concluida && !servidor) diferenca++;
    else if (!c.concluida && servidor) diferenca--;
  }
  return Math.max(0, totalDoServidor + diferenca);
}
