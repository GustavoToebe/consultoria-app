import { useAviso } from '../ui/Aviso';
import { textoDoErro } from '../ui/erros';
import type { Href } from 'expo-router';
import { useEffect } from 'react';

import type { ExercicioPlano, UltimaCarga } from '../api/tipos';
import { ehSerieDeTrabalho } from '../dominio/cargas';
import { tipoTrabalho as tipoTrabalhoDaMetodologia } from '../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { normalizarTreino } from '../dominio/editorTreino';
import { hojeIso } from '../dominio/formatos';
import { podeRegistrarEm } from '../dominio/semana';
import { useAluno } from '../offline/AlunoProvider';
import { descansoAoMarcar } from './descansoDoGrupo';
import type { DadosSerie } from './ExercicioAluno';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sessão do plano salvo em uma data (`?data=` da rota; sem ela, ou fora do que a API aceita, vale hoje). Junta o que as
 * telas do dia e do exercício precisam: registros da data, última carga e a gravação no aparelho.
 */
export function useSessaoDoDia(uid: string | undefined, dataDaRota: string | undefined) {
  const aluno = useAluno();
  const { avisar } = useAviso();
  const hoje = hojeIso();
  const data = dataDaRota && ISO.test(dataDaRota) && podeRegistrarEm(dataDaRota, hoje) ? dataDaRota : hoje;
  const treino = aluno.pacote?.pacote.treino ?? null;
  const sessao = treino ? normalizarTreino(treino.conteudo).sessoes.find((s) => s.uid === uid) : undefined;
  // O nome da série de trabalho ("WS") sai da metodologia copiada na versão do treino; o do pacote é só a reserva.
  const base = aluno.pacote?.pacote.configuracao ?? { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };
  const metodologia = treino?.conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  const config = { ...base, tipoTrabalho: tipoTrabalhoDaMetodologia(metodologia) ?? base.tipoTrabalho, metodologia };
  // O que já foi registrado no servidor (outro aparelho, ou antes de sair e entrar de novo) aparece como feito.
  const { carregarSemanaDoServidor } = aluno;
  useEffect(() => {
    void carregarSemanaDoServidor(data);
  }, [carregarSemanaDoServidor, data]);

  const registroDe = (serieUid: string) => (treino ? aluno.registroDe(treino.versaoId, serieUid, data) : undefined);
  const feitas = (e: ExercicioPlano) => e.series.filter((s) => registroDe(s.uid)?.concluida).length;
  const cargaDoDia = (e: ExercicioPlano) => aluno.cargasDeTrabalho[`${e.uid}|${data}`] ?? null;
  /** A divisão tem alguma série feita nesta data (o ✓ do chip em "Outras datas"). */
  const treinouEm = (d: string) =>
    !!sessao && !!treino && aluno.registros.some((r) => r.data === d && r.sessaoUid === sessao.uid && r.planoVersaoId === treino.versaoId && r.concluida);

  /** Última carga de trabalho antes desta data: a mais recente entre o servidor e o que ficou no aparelho. */
  const ultimaCarga = (exercicioId: string | null): UltimaCarga | null => {
    if (!exercicioId) return null;
    const doServidor = aluno.pacote?.pacote.ultimasCargas[exercicioId] ?? null;
    let ultima: UltimaCarga | null = doServidor && doServidor.data < data ? doServidor : null;
    for (const r of aluno.registros) {
      if (r.exercicioId === exercicioId && r.trabalho && r.carga != null && r.data < data && (!ultima || r.data > ultima.data)) {
        ultima = { carga: r.carga, repeticoes: r.repeticoes, data: r.data };
      }
    }
    return ultima;
  };

  const registrar = (e: ExercicioPlano, serieUid: string, d: DadosSerie) => {
    if (!treino || !sessao) return;
    const serie = e.series.find((s) => s.uid === serieUid);
    // Descanso da série, ou o do grupo quando a marcação fecha uma volta (superset, circuito...); ver `descansoAoMarcar`.
    const descanso = d.concluida
      ? descansoAoMarcar({ sessao, exercicioUid: e.uid, serieUid, concluida: (uid) => !!registroDe(uid)?.concluida, metodologia: config.metodologia })
      : null;
    void aluno.registrar({
      planoVersaoId: treino.versaoId,
      sessaoUid: sessao.uid,
      exercicioUid: e.uid,
      serieUid,
      exercicioId: e.exercicioId,
      trabalho: serie ? ehSerieDeTrabalho(serie) : false,
      data,
      carga: d.carga,
      repeticoes: d.repeticoes,
      concluida: d.concluida,
      observacao: null,
      etapas: d.etapas ?? null,
      referenciaCarga: d.referenciaCarga ?? null,
      referenciaOrigem: d.referenciaOrigem ?? null,
    }).then(() => { if (descanso) aluno.iniciarDescanso(descanso); }).catch(erro => avisar(textoDoErro(erro), 'perigo'));
  };

  return {
    carregado: !!aluno.pacote,
    hoje,
    data,
    treino,
    sessao,
    config,
    registroDe,
    feitas,
    cargaDoDia,
    treinouEm,
    ultimaCarga,
    registrar,
    salvarCargaDoDia: (e: ExercicioPlano, carga: number | null) => void aluno.salvarCargaDeTrabalho(e.uid, data, carga),
  };
}

/** Endereço da sessão (ou de um exercício dela) em uma data. */
export function caminhoDaSessao(sessaoUid: string, data: string, exercicioUid?: string): Href {
  return `/aluno/sessao/${sessaoUid}${exercicioUid ? `/${exercicioUid}` : ''}?data=${data}`;
}
