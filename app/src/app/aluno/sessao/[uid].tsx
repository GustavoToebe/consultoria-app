import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ExercicioAluno } from '../../../aluno/ExercicioAluno';
import { SeloSincronizacao } from '../../../aluno/SeloSincronizacao';
import type { UltimaCarga } from '../../../api/tipos';
import { normalizarTreino } from '../../../dominio/editorTreino';
import { hojeIso } from '../../../dominio/formatos';
import { rotuloDoDia, rotuloDoTipo } from '../../../dominio/semana';
import { useAluno } from '../../../offline/AlunoProvider';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Cartao } from '../../../ui/Cartao';
import { Carregando, Vazio } from '../../../ui/Estados';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';

/** Sessão do dia: um cartão por exercício com o registro de cada série (grava no aparelho, envia depois). */
export default function SessaoAluno() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const aluno = useAluno();
  const [abertos, setAbertos] = useState<Set<string> | null>(null);
  const hoje = hojeIso();
  const treino = aluno.pacote?.pacote.treino ?? null;

  if (!aluno.pacote) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno" />
        <Carregando />
      </Tela>
    );
  }
  const sessao = treino ? normalizarTreino(treino.conteudo).sessoes.find((s) => s.uid === uid) : undefined;
  if (!treino || !sessao) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno" />
        <Vazio texto="Esta sessão não está mais no seu plano. Volte para ver o treino atual." />
      </Tela>
    );
  }

  // Primeiro exercício ainda não terminado abre sozinho; depois vale o que o aluno abrir/fechar.
  const primeiroPendente =
    sessao.exercicios.find((e) => e.series.some((s) => !aluno.registroDe(treino.versaoId, s.uid, hoje)?.concluida))?.uid ??
    sessao.exercicios[0]?.uid;
  const estaAberto = (exUid: string) => (abertos ? abertos.has(exUid) : exUid === primeiroPendente);
  const alternar = (exUid: string) =>
    setAbertos((atual) => {
      const novo = new Set(atual ?? (primeiroPendente ? [primeiroPendente] : []));
      if (novo.has(exUid)) novo.delete(exUid);
      else novo.add(exUid);
      return novo;
    });

  /** Última carga de trabalho: a mais recente entre o servidor e o que ficou no aparelho (antes de hoje). */
  const ultimaCarga = (exercicioId: string | null): UltimaCarga | null => {
    if (!exercicioId) return null;
    let ultima: UltimaCarga | null = aluno.pacote?.pacote.ultimasCargas[exercicioId] ?? null;
    for (const r of aluno.registros) {
      if (r.exercicioId === exercicioId && r.trabalho && r.carga != null && r.data < hoje && (!ultima || r.data > ultima.data)) {
        ultima = { carga: r.carga, repeticoes: r.repeticoes, data: r.data };
      }
    }
    return ultima;
  };

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo={sessao.nome} subtitulo={`${rotuloDoDia(sessao)} · ${rotuloDoTipo(sessao)}`} voltar="/aluno" acoes={<SeloSincronizacao />} />
      {sessao.cardio || sessao.observacao ? (
        <Cartao>
          {sessao.cardio ? <Texto>Cardio: {sessao.cardio}</Texto> : null}
          {sessao.observacao ? <Texto variante="suave">{sessao.observacao}</Texto> : null}
        </Cartao>
      ) : null}
      {sessao.exercicios.map((e, i) => (
        <ExercicioAluno
          key={e.uid}
          exercicio={e}
          posicao={i}
          aberto={estaAberto(e.uid)}
          aoAbrir={() => alternar(e.uid)}
          cargaDoDia={aluno.cargasDeTrabalho[`${e.uid}|${hoje}`] ?? null}
          ultima={ultimaCarga(e.exercicioId)}
          registroDe={(serieUid) => aluno.registroDe(treino.versaoId, serieUid, hoje)}
          config={aluno.pacote?.pacote.configuracao ?? { arredondamentoKg: 0.5, tipoTrabalho: 'WS' }}
          aoMudarCargaDoDia={(c) => void aluno.salvarCargaDeTrabalho(e.uid, c)}
          aoRegistrar={(serieUid, d) => {
            const serie = e.series.find((s) => s.uid === serieUid);
            void aluno.registrar({
              planoVersaoId: treino.versaoId,
              sessaoUid: sessao.uid,
              exercicioUid: e.uid,
              serieUid,
              exercicioId: e.exercicioId,
              trabalho: serie?.intensidade?.modo === 'CARGA_TRABALHO',
              data: hoje,
              carga: d.carga,
              repeticoes: d.repeticoes,
              concluida: d.concluida,
              observacao: null,
            });
          }}
        />
      ))}
      <Texto variante="pequeno">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
  );
}
