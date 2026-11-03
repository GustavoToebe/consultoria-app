import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { useMovimentoReduzido } from '../../../../ui/useMovimentoReduzido';
import { usePrimeiraLista } from '../../../../ui/EntradaEmCascata';
import { router, useLocalSearchParams } from 'expo-router';
import { Medal, Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ConcluirTreino } from '../../../../aluno/ConcluirTreino';
import { DatasDaDivisao } from '../../../../aluno/DatasDaDivisao';
import { ExerciciosDoDia } from '../../../../aluno/ExerciciosDoDia';
import { FaixaDoTreino } from '../../../../aluno/FaixaDoTreino';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { contagem } from '../../../../dominio/contagens';
import { dataParaTela } from '../../../../dominio/formatos';
import { textoDaContagem } from '../../../../dominio/recordesPessoais';
import { contagemDeSeries } from '../../../../dominio/conclusaoDoTreino';
import { contagemDoExercicio, datasDaSessao, nomeComDia } from '../../../../dominio/semana';
import { useSessao } from '../../../../sessao/SessaoProvider';
import { useTema } from '../../../../tema/TemaProvider';
import { espaco } from '../../../../tema/tokens';
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
  const { retornoHabilitado } = useSessao();

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno/treino" />
        <Esqueleto />
      </Tela>
    );
  }
  if (!dia.treino || !sessao) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar="/aluno/treino" />
        <Vazio texto="Esta sessão não está mais no seu plano. Volte para ver o treino atual." />
      </Tela>
    );
  }

  // "x de y séries" conta só trabalho e pós-trabalho (D6); o exercício pendente continua olhando todas as séries.
  const { total, feitas } = contagemDeSeries(sessao, dia.estaFeita, dia.config.metodologia);
  const pendente = sessao.exercicios.find((e) => dia.feitas(e) < e.series.length);
  const datas = sessao.exercicios.length ? datasDaSessao(sessao, dia.treino.inicio, dia.treino.fim, hoje) : [];
  const abrir = (exercicioUid: string) => router.push(caminhoDaSessao(sessao.uid, data, exercicioUid));
  // "Concluir treino" no topo e no rodapé (some com a chave desligada): os dois leem a mesma conclusão.
  const conclusao = { versaoId: dia.treino.versaoId, sessao, data, hoje, metodologia: dia.config.metodologia, feita: (serieUid: string) => !!dia.registroDe(serieUid)?.concluida };

  return (
    <Tela bordas={['top']} largura={720}>
      <Animated.View entering={reduzido ? undefined : FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}>
      <Cabecalho
        titulo={nomeComDia(sessao)}
        subtitulo={contagem(sessao.exercicios.length, 'exercício programado', 'exercícios programados')}
        voltar="/aluno/treino"
      />
      </Animated.View>
      <Cartao>
        <View style={estilos.linhaResumo}>
          <Selo texto={data === hoje ? `Hoje · ${dataParaTela(data)}` : dataParaTela(data)} tipo="neutro" />
          {/* Com a faixa do treino ao vivo (0.3) as séries feitas já estão nela. */}
          {retornoHabilitado ? null : (
            <Texto variante="suave" numerico>
              {feitas} de {contagem(total, 'série feita', 'séries feitas')}
            </Texto>
          )}
        </View>
        <FaixaDoTreino versaoId={dia.treino.versaoId} sessao={sessao} data={data} hoje={hoje} feitas={feitas} total={total} registroDe={dia.registroDe} />
        <BarraProgresso feitas={feitas} total={total} />
        {dia.recordesNoDia ? (
          <View style={estilos.recordes}>
            <Medal size={18} color={cores.sucesso} />
            <Texto numerico cor={cores.sucesso}>{textoDaContagem(dia.recordesNoDia)} neste treino</Texto>
          </View>
        ) : null}
        {data !== hoje ? <Texto variante="suave">Você está registrando o treino de {dataParaTela(data)}.</Texto> : null}
        <ConcluirTreino {...conclusao} tipo="secundario" avisarDataFutura />
      </Cartao>
      {/* Logo depois do cartão do dia, antes de "Outras datas": em 390×844 o começar aparece sem rolar (auditoria de 03/11). */}
      {pendente ? (
        <Botao rotulo={feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'} Icone={Play} cheio aoTocar={() => abrir(pendente.uid)} />
      ) : null}
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
      <ExerciciosDoDia
        sessao={sessao}
        metodologia={dia.config.metodologia}
        tipoTrabalho={dia.config.tipoTrabalho}
        contagemDe={(e) => contagemDoExercicio(e, dia.estaFeita, dia.config.metodologia)}
        cargaDoDia={dia.cargaDoDia}
        ultimaCarga={(e) => dia.ultimaCarga(e.exercicioId)}
        href={(e) => caminhoDaSessao(sessao.uid, data, e.uid)}
        aoAbrir={(e) => abrir(e.uid)}
        animar={animar}
      />
      {/* Rodapé: primário só quando já não há o "Começar/Continuar" lá em cima (um primário por área). */}
      <ConcluirTreino {...conclusao} tipo={pendente ? 'secundario' : 'primario'} cheio />
      <Texto variante="suave">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  recordes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
