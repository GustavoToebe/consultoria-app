import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { useMovimentoReduzido } from '../../../../ui/useMovimentoReduzido';
import { usePrimeiraLista } from '../../../../ui/EntradaEmCascata';
import { router, useLocalSearchParams } from 'expo-router';
import { Medal, Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';

import { CartaoExercicioDoDia } from '../../../../aluno/CartaoExercicioDoDia';
import { ConcluirTreino } from '../../../../aluno/ConcluirTreino';
import { DatasDaDivisao } from '../../../../aluno/DatasDaDivisao';
import { ExerciciosDoDia } from '../../../../aluno/ExerciciosDoDia';
import { colunasDoExercicio } from '../../../../aluno/exercicio/colunasDoExercicio';
import { FaixaDoTreino } from '../../../../aluno/FaixaDoTreino';
import { PorDataDoHistorico, RecentesDoHistorico, temHistorico } from '../../../../aluno/HistoricoDoExercicio';
import { ehExercicioDeCardio } from '../../../../aluno/serieDoAluno';
import { ColunaDoProximo, type ProximoDoTreinoDoDia } from '../../../../aluno/treino/ColunaDoProximo';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { posicaoNoGrupo } from '../../../../dominio/combinacoes';
import { contagem } from '../../../../dominio/contagens';
import { dataParaTela } from '../../../../dominio/formatos';
import { textoDaContagem } from '../../../../dominio/recordesPessoais';
import { contagemDeSeries } from '../../../../dominio/conclusaoDoTreino';
import { equipamentosDoDia } from '../../../../dominio/equipamentosDoDia';
import { contagemDoExercicio, datasDaSessao, nomeComDia } from '../../../../dominio/semana';
import { useSessao } from '../../../../sessao/SessaoProvider';
import { useTema } from '../../../../tema/TemaProvider';
import { ALVO_TOQUE, coresDoBotaoPrincipal, espaco, fontes, RAIO_CONTROLE } from '../../../../tema/tokens';
import { BarraProgresso } from '../../../../ui/BarraProgresso';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { useDestaques } from '../../../../ui/NumeroDeDestaque';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { Vazio } from '../../../../ui/Estados';
import { Selo } from '../../../../ui/Selo';
import { PrincipalComApoio } from '../../../../ui/PrincipalComApoio';
import { Tela } from '../../../../ui/Tela';
import { useAreaDaTela } from '../../../../ui/useAreaDaTela';
import { Texto } from '../../../../ui/Texto';
import { TelaDoAluno } from '../../../../aluno/TelaDoAluno';
import { fraseDaDataDoTreino, temColunasDoAluno } from '../../../../aluno/treino/arranjoDoTreino';

/** Dia de treino: os exercícios da sessão em cartões, com o progresso da data escolhida. */
export default function SessaoAluno() {
  const { uid, data: dataDaRota } = useLocalSearchParams<{ uid: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  useTelaAcesa();
  const { sessao, data, hoje } = dia;
  const animar = usePrimeiraLista(dia.carregado);
  const reduzido = useMovimentoReduzido();
  const { cores, marcaPeca } = useTema();
  // Botão principal neutro (D7, 17/11), o mesmo par do `Botao primario`.
  const principal = coresDoBotaoPrincipal(cores);
  const { violeta } = useDestaques();
  const { retornoHabilitado } = useSessao();

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']}>
        <Cabecalho titulo="Treino" voltar="/aluno/treino" />
        <Esqueleto />
      </Tela>
    );
  }
  if (!dia.treino || !sessao) {
    return (
      <Tela bordas={['top']}>
        <Cabecalho titulo="Treino" voltar="/aluno/treino" />
        <Vazio texto="Esta sessão não está mais no seu plano. Volte para ver o treino atual."
          acao={{ rotulo: 'Ver meu treino', aoTocar: () => router.replace('/aluno/treino') }} />
      </Tela>
    );
  }

  // "x de y séries" conta só trabalho e pós-trabalho (D6); o exercício pendente continua olhando todas as séries.
  const { total, feitas } = contagemDeSeries(sessao, dia.estaFeita, dia.config.metodologia);
  // Cada exercício como vale hoje (a alternativa, quando a troca já tem série marcada): nomes, cargas e equipamentos seguem ele.
  const doDia = { ...sessao, exercicios: sessao.exercicios.map((e) => dia.diaDe(e)) };
  const equipamentos = equipamentosDoDia(doDia);
  const pendente = doDia.exercicios.find((e) => dia.feitas(e) < e.series.length);
  const datas = sessao.exercicios.length ? datasDaSessao(sessao, dia.treino.inicio, dia.treino.fim, hoje) : [];
  const abrir = (exercicioUid: string) => router.push(caminhoDaSessao(sessao.uid, data, exercicioUid));
  // "Concluir treino" no topo e no rodapé (some com a chave desligada): os dois leem a mesma conclusão.
  const conclusao = { versaoId: dia.treino.versaoId, sessao, data, hoje, metodologia: dia.config.metodologia, feita: (serieUid: string) => !!dia.registroDe(serieUid)?.concluida };

  const frase = fraseDaDataDoTreino(data, hoje, retornoHabilitado);
  const resumo = (largo: boolean) => (
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
        <FaixaDoTreino versaoId={conclusao.versaoId} sessao={sessao} data={data} hoje={hoje} feitas={feitas} total={total} registroDe={dia.registroDe} />
        <BarraProgresso feitas={feitas} total={total} cor={marcaPeca} trilho={cores.superficie3} />
        {dia.recordesNoDia ? (
          <View style={estilos.recordes}>
            <Medal size={18} color={violeta.cor} aria-hidden />
            <Texto numerico cor={violeta.cor}>{textoDaContagem(dia.recordesNoDia)} neste treino</Texto>
          </View>
        ) : null}
        {/* Web: as duas frases da data numa só (`fraseDaDataDoTreino`) e a nota do salvamento aqui dentro. */}
        {largo
          ? frase ? <Texto variante="suave">{frase}</Texto> : null
          : data !== hoje ? <Texto variante="suave">Você está registrando o treino de {dataParaTela(data)}.</Texto> : null}
        <ConcluirTreino {...conclusao} tipo="secundario" avisarDataFutura={!largo} />
        {largo ? <Texto variante="suave">{NOTA_DO_SALVAMENTO}</Texto> : null}
      </Cartao>
  );
  // Logo depois do cartão do dia, antes de "Outras datas": em 390×844 o começar aparece sem rolar (auditoria de 03/11).
  const lateral = (largo: boolean) => (<>
      {resumo(largo)}
      {pendente ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'}
          onPress={() => abrir(pendente.uid)}
          style={({ pressed }) => [
            estilos.ctaTreino,
            { backgroundColor: pressed ? principal.fundoAoPassar : principal.fundo },
          ]}>
          <Play size={18} color={principal.texto} />
          <Texto style={[estilos.ctaTreinoTexto, { color: principal.texto }]}>
            {feitas ? `Continuar: ${pendente.nome}` : 'Começar treino'}
          </Texto>
        </Pressable>
      ) : null}
      {equipamentos.length ? (
        <Cartao titulo="Equipamentos para hoje">
          <Texto numerico>{equipamentos.join(' · ')}</Texto>
        </Cartao>
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
  </>);
  // Web larga: o exercício a fazer (o mesmo do "Começar/Continuar") e o histórico dele numa 3ª coluna. Sem nada por fazer
  // (treino todo marcado, ou dia sem exercício) não há próximo e a coluna não abre: a lista volta a ocupar a largura.
  const posicaoDoPendente = pendente ? doDia.exercicios.indexOf(pendente) : -1;
  const grupoDoPendente = pendente ? posicaoNoGrupo(sessao, posicaoDoPendente, dia.config.metodologia) : null;
  const proximo: ProximoDoTreinoDoDia | null = pendente ? {
    titulo: feitas ? 'Próximo exercício' : 'Primeiro exercício',
    cartao: (
      <CartaoExercicioDoDia exercicio={pendente} posicao={posicaoDoPendente}
        contagem={contagemDoExercicio(pendente, dia.estaFeita, dia.config.metodologia)}
        cargaDoDia={dia.cargaDoDia(pendente)} ultima={dia.ultimaCarga(pendente.exercicioId)}
        tipoTrabalho={dia.config.tipoTrabalho} metodologia={dia.config.metodologia}
        descansoNaSerie={!grupoDoPendente || grupoDoPendente.descansoPorSerie}
        href={caminhoDaSessao(sessao.uid, data, pendente.uid)} aoAbrir={() => abrir(pendente.uid)} />
    ),
    historico: temHistorico(pendente, ehExercicioDeCardio(pendente)) ? {
      titulo: `Histórico de ${pendente.nome}`,
      recentes: <RecentesDoHistorico exercicio={pendente} ultimaVez={dia.ultimaVezDe(pendente)} ultima={dia.ultimaCarga(pendente.exercicioId)} />,
      porData: (comRotulo: boolean) => <PorDataDoHistorico exercicio={pendente} rotulo={comRotulo} />,
    } : null,
  } : null;
  const exercicios = (largo: boolean) => (<>
      <ExerciciosDoDia
        sessao={doDia}
        metodologia={dia.config.metodologia}
        tipoTrabalho={dia.config.tipoTrabalho}
        contagemDe={(e) => contagemDoExercicio(e, dia.estaFeita, dia.config.metodologia)}
        cargaDoDia={dia.cargaDoDia}
        ultimaCarga={(e) => dia.ultimaCarga(e.exercicioId)}
        href={(e) => caminhoDaSessao(sessao.uid, data, e.uid)}
        aoAbrir={(e) => abrir(e.uid)}
        animar={animar}
        emColunas={largo}
      />
      {/* Rodapé: primário só quando já não há o "Começar/Continuar" lá em cima (um primário por área). */}
      <ConcluirTreino {...conclusao} tipo={pendente ? 'secundario' : 'primario'} cheio={!largo} />
      {largo ? null : <Texto variante="suave">{NOTA_DO_SALVAMENTO}</Texto>}
  </>);

  return (
    <TelaDoAluno bordas={['top']}>
      <Animated.View entering={reduzido ? undefined : FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}>
      <Cabecalho
        titulo={nomeComDia(sessao)}
        subtitulo={contagem(sessao.exercicios.length, 'exercício programado', 'exercícios programados')}
        voltar="/aluno/treino"
      />
      </Animated.View>
      <ArranjoDoDia lateral={lateral} exercicios={exercicios} proximo={proximo} />
    </TelaDoAluno>
  );
}

const NOTA_DO_SALVAMENTO = 'Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.';

/**
 * Web, da faixa `normal` em diante (`docs/planos/orientacoes-de-design-26-11.md`, 1.3): o resumo, o começar e as datas no apoio
 * à esquerda, fixo ao rolar (empilhado, antes dos exercícios), e os exercícios na ordem. Na `larga` e na `ultralarga` (item 7
 * do pedido de 27/11) a régua é a do Exercício (`colunasDoExercicio`, sobre a largura útil medida): a lista para em 880 e o
 * resto vira a 3ª coluna, também fixa ao rolar, com o próximo exercício e o histórico dele (em duas a partir de 752). Próximo
 * sem histórico (cardio, exercício livre): a 3ª coluna fica com a largura do apoio e a lista com o resto (em colunas). Sem
 * próximo, ou abaixo de 640 para a lista, a coluna não abre. Celular: uma pilha, como antes (o vão é o da `Tela`).
 */
function ArranjoDoDia({ lateral, exercicios, proximo }: {
  lateral: (largo: boolean) => ReactNode;
  exercicios: (largo: boolean) => ReactNode;
  proximo: ProximoDoTreinoDoDia | null;
}) {
  const area = useAreaDaTela();
  if (!temColunasDoAluno(area.faixa)) return <View style={estilos.pilha}>{lateral(false)}{exercicios(false)}</View>;
  const c = proximo ? colunasDoExercicio(area.largura || null, area.faixa, { proximo: true, historico: !!proximo.historico }) : null;
  // A peça de dentro existe sempre (sem apoio ela não desenha nada): abrir ou fechar a 3ª coluna não remonta a lista.
  return (
    <PrincipalComApoio apoioAEsquerda apoioNoTopo rotuloDoApoio="Resumo do treino" larguraDoApoio={c?.apoio}
      apoio={lateral(true)} principal={
        <PrincipalComApoio larguraDoApoio={c?.extras} rotuloDoApoio="Próximo exercício e histórico" idDoApoio="coluna-do-proximo"
          principal={exercicios(true)} apoio={proximo && c && c.colunasDosExtras > 0 ? <ColunaDoProximo {...proximo} emDuas={c.colunasDosExtras === 2} /> : null} />
      } />
  );
}

const estilos = StyleSheet.create({
  pilha: { gap: espaco(3) },
  recordes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  ctaTreino: {
    minHeight: ALVO_TOQUE + 4,
    borderRadius: RAIO_CONTROLE,
    paddingHorizontal: espaco(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco(1),
  },
  ctaTreinoTexto: { fontFamily: fontes.negrito, fontSize: 16, lineHeight: 22 },
});
