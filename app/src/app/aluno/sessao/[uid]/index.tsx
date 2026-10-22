import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { useMovimentoReduzido } from '../../../../ui/useMovimentoReduzido';
import { EntradaEmCascata, usePrimeiraLista } from '../../../../ui/EntradaEmCascata';
import { router, useLocalSearchParams } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoExercicioDoDia } from '../../../../aluno/CartaoExercicioDoDia';
import { DatasDaDivisao } from '../../../../aluno/DatasDaDivisao';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { gruposDaSessao } from '../../../../dominio/combinacoes';
import { contagem } from '../../../../dominio/contagens';
import { dataParaTela } from '../../../../dominio/formatos';
import { datasDaSessao, nomeComDia, totalDeSeries } from '../../../../dominio/semana';
import { useTema } from '../../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../../tema/tokens';
import { BarraProgresso } from '../../../../ui/BarraProgresso';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { Vazio } from '../../../../ui/Estados';
import { Selo } from '../../../../ui/Selo';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';

/** Dia de treino: os exercícios da sessão em cartões, com o progresso da data escolhida. */
export default function SessaoAluno() {
  const { uid, data: dataDaRota } = useLocalSearchParams<{ uid: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  useTelaAcesa();
  const { sessao, data, hoje } = dia;
  const animar = usePrimeiraLista(dia.carregado);
  const reduzido = useMovimentoReduzido();
  const { cores } = useTema();

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno" />
        <Esqueleto />
      </Tela>
    );
  }
  if (!dia.treino || !sessao) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno" />
        <Vazio texto="Esta sessão não está mais no seu plano. Volte para ver o treino atual." />
      </Tela>
    );
  }

  const total = totalDeSeries(sessao);
  const feitas = sessao.exercicios.reduce((n, e) => n + dia.feitas(e), 0);
  const pendente = sessao.exercicios.find((e) => dia.feitas(e) < e.series.length);
  const datas = sessao.exercicios.length ? datasDaSessao(sessao, dia.treino.inicio, dia.treino.fim, hoje) : [];
  const abrir = (exercicioUid: string) => router.push(caminhoDaSessao(sessao.uid, data, exercicioUid));

  return (
    <Tela bordas={['top']} largura={720}>
      <Animated.View entering={reduzido ? undefined : FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}>
      <Cabecalho
        titulo={nomeComDia(sessao)}
        subtitulo={contagem(sessao.exercicios.length, 'exercício programado', 'exercícios programados')}
        voltar="/aluno"
      />
      </Animated.View>
      <Cartao>
        <View style={estilos.linhaResumo}>
          <Selo texto={data === hoje ? `Hoje · ${dataParaTela(data)}` : dataParaTela(data)} tipo="neutro" />
          <Texto variante="suave" numerico>
            {feitas} de {contagem(total, 'série feita', 'séries feitas')}
          </Texto>
        </View>
        <BarraProgresso feitas={feitas} total={total} />
        {data !== hoje ? <Texto variante="suave">Você está registrando o treino de {dataParaTela(data)}.</Texto> : null}
      </Cartao>
      {datas.length > 1 ? (
        <Cartao titulo="Outras datas">
          <Texto variante="suave">Para registrar este treino em outro dia do período, escolha a data.</Texto>
          <DatasDaDivisao
            sessao={sessao}
            datas={datas}
            hoje={hoje}
            atual={data}
            treinouEm={dia.treinouEm}
            aoAbrir={(d) => router.replace(caminhoDaSessao(sessao.uid, d))}
          />
        </Cartao>
      ) : null}
      {sessao.cardio || sessao.observacao ? (
        <Cartao>
          {sessao.cardio ? <Texto>Cardio: {sessao.cardio}</Texto> : null}
          {sessao.observacao ? <Texto variante="suave">{sessao.observacao}</Texto> : null}
        </Cartao>
      ) : null}
      {pendente ? (
        <Botao rotulo={feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'} Icone={Play} cheio aoTocar={() => abrir(pendente.uid)} />
      ) : null}
      {gruposDaSessao(sessao.exercicios).map((g) => {
        const cartoes = g.exercicios.map((e, j) => {
          const i = g.inicio + j;
          return (
            <EntradaEmCascata key={e.uid} indice={i} animar={animar}>
            <CartaoExercicioDoDia
              exercicio={e}
              posicao={i}
              feitas={dia.feitas(e)}
              cargaDoDia={dia.cargaDoDia(e)}
              ultima={dia.ultimaCarga(e.exercicioId)}
              tipoTrabalho={dia.config.tipoTrabalho}
              metodologia={dia.config.metodologia}
              href={caminhoDaSessao(sessao.uid, data, e.uid)}
              aoAbrir={() => abrir(e.uid)}
            />
            </EntradaEmCascata>
          );
        });
        // Exercícios feitos juntos (bi-set, tri-set, circuito) aparecem numa moldura com o nome do grupo.
        return g.nome ? (
          <View key={`grupo-${g.exercicios[0].uid}`} style={[estilos.grupo, { borderColor: cores.bordaCampo }]}>
            <Texto variante="bloco">{g.nome}</Texto>
            <Texto variante="pequeno">{contagem(g.exercicios.length, 'exercício', 'exercícios')}, um depois do outro, sem descanso entre eles.</Texto>
            {cartoes}
          </View>
        ) : (
          <Fragment key={g.exercicios[0].uid}>{cartoes}</Fragment>
        );
      })}
      <Texto variante="suave">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // Moldura do bi-set/supersérie com `bordaCampo` (a `borda` de cartão quase sumia no tema escuro).
  grupo: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
