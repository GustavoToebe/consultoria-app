import type { DiaDeTreino, TreinoAtual } from '../api/tipos';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { normalizarTreino } from './editorTreino';
import { diaDaSemanaIso, somarDias } from './formatos';
export function periodoDaSemana(hoje: string) {
 const inicio = somarDias(hoje, 1 - diaDaSemanaIso(hoje));
 return { inicio, fim: somarDias(inicio, 6) };
}
/** Cada sessão conta uma vez; registro local desmarcado sobrepõe a versão do histórico. */
export function progressoSemana(treino: TreinoAtual | null, hoje: string, locais: RegistroLocal[], historico: DiaDeTreino[] = []) {
 if (!treino) return null;
 const { inicio } = periodoDaSemana(hoje);
 const registros = new Map<string, boolean>();
 for (const dia of historico) for (const sessao of dia.sessoes) {
  if (sessao.planoVersaoId !== treino.versaoId) continue;
  for (const e of sessao.exercicios) for (const s of e.series) registros.set(`${sessao.sessaoUid}|${s.serieUid}|${dia.data}`, s.concluida);
 }
 for (const r of locais) {
  if (r.planoVersaoId === treino.versaoId && r.situacao !== 'FALHOU') registros.set(`${r.sessaoUid}|${r.serieUid}|${r.data}`, r.concluida);
 }
 let total = 0, feitas = 0;
 for (const s of normalizarTreino(treino.conteudo).sessoes) {
  if (s.tipo !== 'TREINO' || !s.diaSemana) continue;
  const data = somarDias(inicio, s.diaSemana - 1);
  if ((treino.inicio && data < treino.inicio) || (treino.fim && data > treino.fim)) continue;
  total++;
  if (data <= hoje && s.exercicios.some(e => e.series.some(serie => registros.get(`${s.uid}|${serie.uid}|${data}`)))) feitas++;
 }
 return { feitas, total };
}
