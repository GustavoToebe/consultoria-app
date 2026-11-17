import type { Sessao } from '../api/tipos';
import type { RegistroLocal } from '../offline/repositorioLocal';

type Registro = Pick<RegistroLocal, 'planoVersaoId' | 'sessaoUid' | 'data' | 'concluida' | 'alteradoEm'>;

/**
 * Faixa "Treino em andamento" do Início do aluno (item 4 do `docs/planos/treino-do-aluno-lacunas-cbum.md`): a sessão do
 * plano em uso com ao menos uma série marcada hoje e ainda não concluída hoje. Desmarcar é o mesmo registro com
 * `concluida = false`, então não conta. Com duas sessões nessas condições vale a da série marcada por último.
 * Sem treino, sem registro ou sessão que saiu do plano = `null` (a faixa não aparece). Só lê o que está no aparelho.
 */
export function treinoEmAndamento({
  versaoId,
  sessoes,
  registros,
  hoje,
  concluidaHoje,
}: {
  versaoId: string | null;
  sessoes: readonly Sessao[];
  registros: readonly Registro[];
  hoje: string;
  /** A sessão (pelo `uid`) já foi concluída hoje nesta versão? */
  concluidaHoje: (sessaoUid: string) => boolean;
}): Sessao | null {
  if (!versaoId) return null;
  let escolhida: { sessao: Sessao; alteradoEm: string } | null = null;
  for (const r of registros) {
    if (!r.concluida || r.data !== hoje || r.planoVersaoId !== versaoId) continue;
    if (escolhida && r.alteradoEm <= escolhida.alteradoEm) continue;
    const sessao = sessoes.find((s) => s.uid === r.sessaoUid);
    if (!sessao || concluidaHoje(sessao.uid)) continue;
    escolhida = { sessao, alteradoEm: r.alteradoEm };
  }
  return escolhida?.sessao ?? null;
}
