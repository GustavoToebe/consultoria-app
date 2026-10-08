import { EntradaEmCascata, usePrimeiraLista } from '../../../../ui/EntradaEmCascata';
import { router, useLocalSearchParams } from 'expo-router';
import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CartaoExercicioDoDia } from '../../../../aluno/CartaoExercicioDoDia';
import { SeloSincronizacao } from '../../../../aluno/SeloSincronizacao';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { dataParaTela } from '../../../../dominio/formatos';
import { nomeComDia, totalDeSeries } from '../../../../dominio/semana';
import { espaco } from '../../../../tema/tokens';
import { BarraProgresso } from '../../../../ui/BarraProgresso';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Cartao } from '../../../../ui/Cartao';
import { Carregando, Vazio } from '../../../../ui/Estados';
import { Selo } from '../../../../ui/Selo';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';

/** Dia de treino: os exercícios da sessão em cartões, com o progresso da data escolhida. */
export default function SessaoAluno() {
  const { uid, data: dataDaRota } = useLocalSearchParams<{ uid: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  const { sessao, data, hoje } = dia;
  const animar = usePrimeiraLista(dia.carregado);

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno" />
        <Carregando />
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
  const abrir = (exercicioUid: string) => router.push(caminhoDaSessao(sessao.uid, data, exercicioUid));

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho
        titulo={nomeComDia(sessao)}
        subtitulo={`${sessao.exercicios.length} exercícios programados`}
        voltar="/aluno"
        acoes={<SeloSincronizacao />}
      />
      <View style={estilos.resumo}>
        <View style={estilos.linhaResumo}>
          <Selo texto={data === hoje ? `Hoje · ${dataParaTela(data)}` : dataParaTela(data)} tipo="neutro" />
          <Texto variante="pequeno">
            {feitas} de {total} séries feitas
          </Texto>
        </View>
        <BarraProgresso feitas={feitas} total={total} />
        {data !== hoje ? <Texto variante="pequeno">Você está registrando o treino de {dataParaTela(data)}.</Texto> : null}
      </View>
      {sessao.cardio || sessao.observacao ? (
        <Cartao>
          {sessao.cardio ? <Texto>Cardio: {sessao.cardio}</Texto> : null}
          {sessao.observacao ? <Texto variante="suave">{sessao.observacao}</Texto> : null}
        </Cartao>
      ) : null}
      {pendente ? (
        <Botao rotulo={feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'} Icone={Play} cheio aoTocar={() => abrir(pendente.uid)} />
      ) : null}
      {sessao.exercicios.map((e, i) => (
        <EntradaEmCascata key={e.uid} indice={i} animar={animar}>
        <CartaoExercicioDoDia
          exercicio={e}
          posicao={i}
          feitas={dia.feitas(e)}
          cargaDoDia={dia.cargaDoDia(e)}
          ultima={dia.ultimaCarga(e.exercicioId)}
          tipoTrabalho={dia.config.tipoTrabalho}
          aoAbrir={() => abrir(e.uid)}
        />
        </EntradaEmCascata>
      ))}
      <Texto variante="pequeno">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(1) },
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
