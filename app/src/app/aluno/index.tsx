import { router } from 'expo-router';

import { CartaoDivisao } from '../../aluno/CartaoDivisao';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import type { Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataHoraParaTela, dataParaTela, diaDaSemana, hojeIso } from '../../dominio/formatos';
import { sessaoDoDia, sessoesDaSemana } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Treino do aluno: "Treino de hoje" em destaque e as divisões do plano com as datas do período. Funciona com o pacote
 * salvo, sem internet.
 */
export default function TreinoAluno() {
  const { pacote, carregando, erroPacote, registros } = useAluno();
  const hoje = hojeIso();
  const treino = pacote?.pacote.treino ?? null;

  if (!pacote) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho mostrarMarca="sempre" />
        {carregando ? <Carregando texto="Carregando seu treino" /> : null}
        {!carregando && erroPacote ? (
          <MensagemErro texto={`${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`} />
        ) : null}
      </Tela>
    );
  }

  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const deHoje = conteudo ? sessaoDoDia(conteudo, diaDaSemana()) : null;
  const registrosDe = (s: Sessao, data: string) =>
    registros.filter((r) => r.data === data && r.sessaoUid === s.uid && r.planoVersaoId === treino?.versaoId && r.concluida);
  const periodo =
    treino && (treino.inicio || treino.fim) ? `${dataParaTela(treino.inicio) || '—'} a ${dataParaTela(treino.fim) || '—'}` : null;

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho mostrarMarca="sempre" acoes={<SeloSincronizacao />} />
      <Texto variante="titulo">Olá, {pacote.pacote.aluno.nome.split(' ')[0]}</Texto>
      {!treino || !conteudo ? (
        <Vazio texto="Seu treinador ainda não publicou um treino para você." />
      ) : (
        <>
          <Texto variante="suave">
            {treino.titulo}
            {periodo ? ` · ${periodo}` : ''}
          </Texto>
          <CartaoHoje
            sessao={deHoje}
            hoje={hoje}
            feitas={deHoje ? registrosDe(deHoje, hoje).length : 0}
            aoAbrir={() => deHoje && router.push(caminhoDaSessao(deHoje.uid, hoje))}
          />
          <Texto variante="secao">Divisões da semana</Texto>
          {sessoesDaSemana(conteudo).map((s) => (
            <CartaoDivisao
              key={s.uid}
              sessao={s}
              inicio={treino.inicio}
              fim={treino.fim}
              hoje={hoje}
              treinouEm={(d) => registrosDe(s, d).length > 0}
              aoAbrir={(d) => router.push(caminhoDaSessao(s.uid, d))}
            />
          ))}
          {conteudo.objetivo || conteudo.orientacoes ? (
            <Cartao titulo="Orientações do treinador">
              {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
              {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
            </Cartao>
          ) : null}
          <Texto variante="pequeno">
            {treino.titulo} (v{treino.numero}) · atualizado em {dataHoraParaTela(pacote.salvoEm)}
          </Texto>
        </>
      )}
    </Tela>
  );
}
