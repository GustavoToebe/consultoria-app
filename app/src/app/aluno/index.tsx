import { router } from 'expo-router';
import { ChevronRight, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import type { Sessao } from '../../api/tipos';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataHoraParaTela, dataParaTela, diaDaSemana, hojeIso } from '../../dominio/formatos';
import { rotuloDoDia, rotuloDoTipo, sessaoDoDia, sessoesDaSemana, totalDeSeries } from '../../dominio/semana';
import { useAluno } from '../../offline/AlunoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Treino do aluno: "Treino de hoje" em destaque e a semana em cartões. Funciona com o pacote salvo, sem internet. */
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
  const feitasHoje = (s: Sessao) =>
    registros.filter((r) => r.data === hoje && r.sessaoUid === s.uid && r.planoVersaoId === treino?.versaoId && r.concluida).length;
  const abrir = (s: Sessao) => router.push(`/aluno/sessao/${s.uid}`);

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho mostrarMarca="sempre" acoes={<SeloSincronizacao />} />
      <Texto variante="subtitulo">Olá, {pacote.pacote.aluno.nome.split(' ')[0]}</Texto>
      {!treino || !conteudo ? (
        <Vazio texto="Seu treinador ainda não publicou um treino para você." />
      ) : (
        <>
          <CartaoHoje sessao={deHoje} feitas={deHoje ? feitasHoje(deHoje) : 0} aoAbrir={abrir} />
          <Cartao titulo="Semana">
            {sessoesDaSemana(conteudo).map((s) => (
              <LinhaSessao key={s.uid} sessao={s} hoje={s.uid === deHoje?.uid} feitas={feitasHoje(s)} aoAbrir={() => abrir(s)} />
            ))}
          </Cartao>
          {conteudo.objetivo || conteudo.orientacoes ? (
            <Cartao titulo="Orientações do treinador">
              {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
              {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
            </Cartao>
          ) : null}
          <Texto variante="pequeno">
            {treino.titulo} (v{treino.numero}) · {dataParaTela(treino.inicio) || '—'} a {dataParaTela(treino.fim) || '—'} · atualizado em{' '}
            {dataHoraParaTela(pacote.salvoEm)}
          </Texto>
        </>
      )}
    </Tela>
  );
}

function CartaoHoje({ sessao, feitas, aoAbrir }: { sessao: Sessao | null; feitas: number; aoAbrir: (s: Sessao) => void }) {
  if (!sessao) {
    return (
      <Cartao titulo="Treino de hoje">
        <Texto variante="suave">Nenhuma sessão marcada para hoje. Veja a semana abaixo.</Texto>
      </Cartao>
    );
  }
  const total = totalDeSeries(sessao);
  return (
    <Cartao titulo="Treino de hoje">
      <Texto variante="titulo">{sessao.nome}</Texto>
      <View style={estilos.selos}>
        <Selo texto={rotuloDoTipo(sessao)} tipo="neutro" />
        {total ? <Selo texto={`${feitas} de ${total} séries feitas`} tipo={feitas >= total ? 'sucesso' : feitas ? 'atencao' : 'neutro'} /> : null}
      </View>
      {sessao.cardio ? <Texto>Cardio: {sessao.cardio}</Texto> : null}
      {sessao.observacao ? <Texto variante="suave">{sessao.observacao}</Texto> : null}
      {sessao.exercicios.length ? (
        <Botao rotulo={feitas ? 'Continuar treino' : 'Começar treino'} Icone={Play} cheio aoTocar={() => aoAbrir(sessao)} />
      ) : null}
    </Cartao>
  );
}

function LinhaSessao({ sessao, hoje, feitas, aoAbrir }: { sessao: Sessao; hoje: boolean; feitas: number; aoAbrir: () => void }) {
  const { cores } = useTema();
  const total = totalDeSeries(sessao);
  const conteudoLinha = (
    <>
      <View style={estilos.dadosLinha}>
        <Texto variante="pequeno">
          {rotuloDoDia(sessao)}
          {hoje ? ' · hoje' : ''}
        </Texto>
        <Texto style={estilos.nome}>{sessao.nome}</Texto>
        <Texto variante="suave">
          {sessao.exercicios.length ? `${sessao.exercicios.length} exercícios` : rotuloDoTipo(sessao)}
          {sessao.cardio ? ` · ${sessao.cardio}` : ''}
          {total && feitas ? ` · ${feitas}/${total} hoje` : ''}
        </Texto>
      </View>
      {sessao.exercicios.length ? <ChevronRight size={20} color={cores.textoSuave} /> : null}
    </>
  );
  if (!sessao.exercicios.length) {
    return <View style={[estilos.linha, { borderColor: cores.borda }]}>{conteudoLinha}</View>;
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${sessao.nome}`}
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.linha, { borderColor: hoje ? cores.texto : cores.borda, opacity: pressed ? 0.7 : 1 }]}>
      {conteudoLinha}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    minHeight: 56,
  },
  dadosLinha: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.semi },
});
