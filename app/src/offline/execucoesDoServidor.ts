import type { DiaDeTreino } from '../api/tipos';
import type { RegistroLocal } from './repositorioLocal';

/**
 * Séries que já estão no servidor, no formato do registro do aparelho (situação `ENVIADO`). Servem para a tela mostrar
 * como feito o que o aluno registrou em outro aparelho ou antes de entrar de novo (o "Sair" apaga o aparelho, e a tela
 * dizia "0 de 23 feitas" com tudo já enviado). Nunca entram no repositório nem na fila de envio: só a leitura muda.
 *
 * O `alteradoEm` fica no começo do dia: se o aluno mexer na série aqui, o registro novo (com a hora do aparelho) é mais
 * novo e o servidor o aceita pela chave (aluno, versão, série, dia), sem duplicar.
 */
export function registrosDoServidor(dias: readonly DiaDeTreino[]): RegistroLocal[] {
  const lista: RegistroLocal[] = [];
  for (const dia of dias) {
    for (const sessao of dia.sessoes) {
      for (const e of sessao.exercicios) {
        for (const s of e.series) {
          lista.push({
            id: s.id,
            planoVersaoId: sessao.planoVersaoId,
            sessaoUid: sessao.sessaoUid,
            exercicioUid: e.exercicioUid,
            serieUid: s.serieUid,
            exercicioId: e.exercicioId,
            trabalho: s.trabalho,
            data: dia.data,
            carga: s.carga,
            repeticoes: s.repeticoes,
            concluida: s.concluida,
            observacao: s.observacao,
            alteradoEm: `${dia.data}T00:00:00.000Z`,
            situacao: 'ENVIADO',
            motivo: null,
          });
        }
      }
    }
  }
  return lista;
}

const chave = (r: Pick<RegistroLocal, 'planoVersaoId' | 'serieUid' | 'data'>) => `${r.planoVersaoId}|${r.serieUid}|${r.data}`;

/**
 * Troca, no que já veio do servidor, as datas de `de` a `ate` pelo que acabou de chegar (o que sumiu lá some aqui).
 */
export function trocarPeriodo(atuais: readonly RegistroLocal[], de: string, ate: string, novos: readonly RegistroLocal[]): RegistroLocal[] {
  return [...atuais.filter((r) => r.data < de || r.data > ate), ...novos];
}

/**
 * Registros que as telas leem: os do aparelho e, para a mesma série no mesmo dia e versão, o do aparelho sempre ganha
 * (pode ter mudança ainda não enviada). Do servidor só entra o que o aparelho não tem.
 */
export function fundirComServidor(locais: readonly RegistroLocal[], doServidor: readonly RegistroLocal[]): RegistroLocal[] {
  if (!doServidor.length) return [...locais];
  const noAparelho = new Set(locais.map(chave));
  const vistos = new Set<string>();
  const extras: RegistroLocal[] = [];
  for (const r of doServidor) {
    const k = chave(r);
    if (noAparelho.has(k) || vistos.has(k)) continue;
    vistos.add(k);
    extras.push(r);
  }
  return [...extras, ...locais];
}
