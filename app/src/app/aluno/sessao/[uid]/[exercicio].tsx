import { AvisoDeRecorde, type RecordeParaAvisar } from '../../../../aluno/AvisoDeRecorde';
import { CabecalhoDoGrupo } from '../../../../aluno/CabecalhoDoGrupo';
import { DescansoManual } from '../../../../aluno/DescansoManual';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, List } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CartaoExercicioDoDia } from '../../../../aluno/CartaoExercicioDoDia';
import { ConcluirTreino } from '../../../../aluno/ConcluirTreino';
import { ExercicioAluno } from '../../../../aluno/ExercicioAluno';
import { colunaDasSeriesNoBloco, colunasDoExercicio, FOLGA_NO_FIM_DA_ROLAGEM } from '../../../../aluno/exercicio/colunasDoExercicio';
import { BarraDescanso } from '../../../../aluno/BarraDescanso';
import { TopoDoExercicio } from '../../../../aluno/TopoDoExercicio';
import { HistoricoDoExercicio, PorDataDoHistorico, RecentesDoHistorico, temHistorico } from '../../../../aluno/HistoricoDoExercicio';
import { ehExercicioDeCardio } from '../../../../aluno/serieDoAluno';
import { TrocarSoHoje } from '../../../../aluno/TrocarSoHoje';
import { useSessao } from '../../../../sessao/SessaoProvider';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { useAluno } from '../../../../offline/AlunoProvider';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { posicaoNoGrupo } from '../../../../dominio/combinacoes';
import { contagemDeSeries, podeConcluirEm } from '../../../../dominio/conclusaoDoTreino';
import { concluirEmDestaque } from '../../../../dominio/destaqueDaConclusao';
import { dataCurta } from '../../../../dominio/formatos';
import { textoDaContagem } from '../../../../dominio/recordesPessoais';
import { contagemDoExercicio } from '../../../../dominio/semana';
import { indiceDaSerieAtiva, progressoDosExercicios, topoDoExercicio } from '../../../../dominio/telaDoExercicio';
import { vezNoGrupo } from '../../../../dominio/vezNoGrupo';
import { espaco, faixaDeLargura, fontes } from '../../../../tema/tokens';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { LinhaDeAcoes } from '../../../../ui/LinhaDeAcoes';
import { Vazio } from '../../../../ui/Estados';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';
import { AlvoDoVidro } from '../../../../ui/Vidro';

/**
 * Um exercício da sessão: séries em cartões para registrar carga e repetições. No rodapé, "Próximo" e, logo abaixo,
 * "Anterior" e "Lista do dia", para o aluno andar fora de ordem sem precisar subir até a seta do topo (pedido do
 * Saraiva na reunião de 17/10: o aluno pula exercício, troca a ordem e volta à lista quando quer). Num bi-set,
 * supersérie ou circuito o "Próximo" é a vez no grupo (`vezNoGrupo`) até o grupo acabar; no último exercício,
 * "Concluir treino" com o resumo do dia (com a chave do retorno desligada, "Voltar à lista do dia", secundário).
 */
export default function ExercicioDaSessao() {
  const { uid, exercicio: exercicioUid, data: dataDaRota } = useLocalSearchParams<{ uid: string; exercicio: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  useTelaAcesa();
  const { iniciarDescanso, cancelarDescansoDe, demonstracoes, sessaoConcluidaDe } = useAluno();
  const { retornoHabilitado } = useSessao();
  const { sessao, data } = dia;
  const voltar = caminhoDaSessao(uid ?? '', data);
  // Aviso de recorde pessoal no topo (Engajamento 0.2): aparece na hora em que a série é marcada, sem internet.
  const [aviso, setAviso] = useState<RecordeParaAvisar | null>(null);
  const contador = useRef(0);
  const fecharAviso = useCallback(() => setAviso(null), []);
  // O que passa por baixo do aviso (vidro, D11): no Android o blur só lê o que está dentro deste alvo, irmão do aviso.
  const alvoDoVidro = useRef<View>(null);
  // "Trocar só hoje" ainda sem série marcada: só na tela (decisão do plano), presa a este exercício e data.
  const [escolha, setEscolha] = useState<{ chave: string; exercicioId: string | null } | null>(null);
  const chaveDaEscolha = `${exercicioUid ?? ''}|${data}`;
  // Web larga: as colunas saem da largura útil medida (o bloco do conteúdo) e da faixa da área da rota, a mesma régua que a
  // `Tela` passa ao `ExercicioAluno` (`colunasDoExercicio`); a barra fixa de baixo, fora da rolagem, se alinha às séries.
  const [area, setArea] = useState<number | null>(null);
  const [larguraDaRota, setLarguraDaRota] = useState(0);
  // A barra de rolagem da página desloca o bloco do conteúdo em relação à janela: o topo e a barra de baixo se alinham ao
  // bloco MEDIDO (posição a partir da borda da rota), não a uma conta pela janela.
  const raiz = useRef<View>(null);
  const blocoMedido = useRef<View>(null);
  const [bloco, setBloco] = useState<{ esquerda: number; largura: number } | null>(null);
  const medirBloco = () => {
    blocoMedido.current?.measureInWindow((x, _y, largura) => {
      raiz.current?.measureInWindow((xDaRaiz) => {
        const esquerda = Math.round(x - xDaRaiz);
        setBloco((antes) => (antes && antes.esquerda === esquerda && antes.largura === largura ? antes : { esquerda, largura }));
      });
    });
  };
  // As barras desta rota (topo e rodapé) ficam fora da rolagem: a coluna do exercício só pode ter a altura da área que rola
  // (medida), menos o que a rolagem põe embaixo dela no fim (`FOLGA_NO_FIM_DA_ROLAGEM`).
  const janela = useWindowDimensions();
  const [alturaDaRolagem, setAlturaDaRolagem] = useState<number | null>(null);

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']}>
        <Cabecalho titulo="Exercício" voltar={voltar} />
        <Esqueleto />
      </Tela>
    );
  }
  const posicao = sessao ? sessao.exercicios.findIndex((e) => e.uid === exercicioUid) : -1;
  const principal = sessao && posicao >= 0 ? sessao.exercicios[posicao] : undefined;
  if (!dia.treino || !sessao || !principal) {
    return (
      <Tela bordas={['top']}>
        <Cabecalho titulo="Exercício" voltar="/aluno/treino" />
        <Vazio texto="Este exercício não está mais no seu plano. Volte para ver o treino atual."
          acao={{ rotulo: 'Ver meu treino', aoTocar: () => router.replace('/aluno/treino') }} />
      </Tela>
    );
  }

  // O exercício que vale hoje: tudo daqui para baixo (título, séries, cargas, "Anterior", recordes e registro) segue ele.
  const e = dia.diaDe(principal, escolha?.chave === chaveDaEscolha ? escolha.exercicioId : null);
  const trocado = dia.trocado(e);
  const nomeDe = (x: typeof principal) => dia.diaDe(x).nome;
  const anterior = posicao > 0 ? sessao.exercicios[posicao - 1] : undefined;
  const noGrupo = posicaoNoGrupo(sessao, posicao, dia.config.metodologia);
  const vez = vezNoGrupo(noGrupo, (x) => dia.feitas(x) < x.series.length);
  const depoisDoGrupo = sessao.exercicios[noGrupo ? noGrupo.grupo.inicio + noGrupo.tamanho : posicao + 1];
  const proximo = vez ?? depoisDoGrupo;
  const ir = (destino: string) => router.replace(caminhoDaSessao(sessao.uid, data, destino));
  // "x de y séries" do dia: só trabalho e pós-trabalho (D6); a vez no grupo segue olhando todas as séries.
  const { total: totalNoDia, feitas: feitasNoDia } = contagemDeSeries(sessao, dia.estaFeita, dia.config.metodologia);
  const conclusao = { versaoId: dia.treino.versaoId, sessao, data, hoje: dia.hoje, metodologia: dia.config.metodologia, feita: (serieUid: string) => !!dia.registroDe(serieUid)?.concluida };
  // Descanso do plano: o da próxima série a fazer (ou o da primeira que tiver), primeira opção da folha.
  const aFazer = e.series.find((s) => !dia.registroDe(s.uid)?.concluida);
  // Em superset, circuito etc. o descanso do plano é o do grupo (depois da volta); em pré e pós-exaustão, o de cada série.
  const descansoDoPlano =
    noGrupo && !noGrupo.descansoPorSerie
      ? noGrupo.descansoAposSegundos
      : ((aFazer?.descansoSegundos || e.series.find((s) => s.descansoSegundos)?.descansoSegundos) ?? null);
  const demonstracao = e.exercicioId ? demonstracoes.find((d) => d.exercicioId === e.exercicioId) ?? null : null;
  const recordesNoDia = textoDaContagem(dia.recordesNoDia);
  const resumoDoDia = `${feitasNoDia} de ${totalNoDia} ${totalNoDia === 1 ? 'série feita' : 'séries feitas'} neste treino.${recordesNoDia ? ` ${recordesNoDia}.` : ''}`;
  // B5 (30/10): tudo marcado e ainda não concluído, "Revisar e concluir treino" vira o primário do rodapé e o "Próximo"
  // passa a secundário (o aluno pode ter feito fora de ordem). Só abre a Folha; nada é concluído sozinho.
  const emDestaque = concluirEmDestaque({
    retornoHabilitado,
    total: totalNoDia,
    feitas: feitasNoDia,
    podeConcluir: podeConcluirEm(data, dia.hoje),
    concluida: !!sessaoConcluidaDe(dia.treino.versaoId, sessao.uid, data)?.concluida,
  });
  const registrarSerie = (serieUid: string, d: Parameters<typeof dia.registrar>[2]) => {
    const jaFeita = !!dia.registroDe(serieUid)?.concluida;
    const recordes = dia.registrar(e, serieUid, d);
    // Só ao marcar como feita (editar uma série já feita não repete o aviso; a medalha continua na série).
    if (recordes.length && !jaFeita) {
      contador.current += 1;
      setAviso({ chave: contador.current, exercicioId: e.exercicioId, nome: e.nome, numeroDaSerie: e.series.findIndex((x) => x.uid === serieUid) + 1, recordes, demonstracao });
    }
  };

  const cardio = ehExercicioDeCardio(e);
  const comHistorico = temHistorico(e, cardio);
  const colunas = colunasDoExercicio(area, faixaDeLargura(larguraDaRota), { proximo: !!proximo, historico: comHistorico });
  const emColunas = colunas !== null;
  const completo = indiceDaSerieAtiva(e.series, dia.estaFeita) === -1;
  const topo = topoDoExercicio(sessao, posicao);
  const progresso = progressoDosExercicios({ exercicios: sessao.exercicios.map((x) => dia.diaDe(x)) }, dia.estaFeita, dia.config.metodologia);
  // "Próximo: <exercício>" enquanto faltam séries; com todas feitas vira o principal, "Próximo exercício: <nome>". Com o
  // treino inteiro marcado (B5) o principal é o "Revisar e concluir" do fim da tela e o "Próximo" continua secundário.
  const botaoDoProximo = proximo ? (
    <Botao
      rotulo={`${completo ? 'Próximo exercício' : 'Próximo'}: ${nomeDe(proximo)} ›`}
      rotuloAcessivel={`${completo ? 'Próximo exercício' : 'Próximo'}: ${nomeDe(proximo)}`}
      tipo={completo && !emDestaque ? 'primario' : 'secundario'}
      cheio
      aoTocar={() => ir(proximo.uid)}
    />
  ) : null;
  const botaoDoAnterior = anterior ? (
    <Botao rotulo="Anterior" rotuloAcessivel={`Anterior: ${nomeDe(anterior)}`} Icone={ArrowLeft} tipo="secundario" aoTocar={() => ir(anterior.uid)} />
  ) : null;
  // Web larga: a barra fixa fica na largura da coluna das séries, com o Anterior à esquerda e o Próximo à direita.
  const colunaNoBloco = colunas ? colunaDasSeriesNoBloco(colunas) : null;
  const colunaDaBarra = bloco && colunaNoBloco ? { esquerda: bloco.esquerda + colunaNoBloco.esquerda, largura: colunaNoBloco.largura } : null;
  const conteudoDaBarra = emColunas
    ? botaoDoProximo || botaoDoAnterior
      ? (
        // Até o bloco ser medido (posição na janela), recuado pela coluna do exercício.
        <View style={colunaDaBarra ? estilos.barraEmColunas : [estilos.barra, estilos.barraEmColunas, colunaNoBloco && { paddingLeft: colunaNoBloco.esquerda }]}>
          {botaoDoAnterior}
          <View style={estilos.proximoEmColunas}>{botaoDoProximo}</View>
        </View>
      )
      : null
    : botaoDoProximo
      ? <View style={estilos.barra}>{botaoDoProximo}</View>
      : null;

  // Nome (o h1), troca do dia e grupo; e o fim (concluir, Anterior e Lista do dia, nota do salvamento). No celular ficam
  // onde sempre estiveram; na web larga, o nome vai para a coluna do exercício e o fim para a coluna das séries.
  const cabecalho = (
    <>
      <View style={estilos.nome}>
        <View style={estilos.nomeTexto}>
          <Texto variante="titulo" nivel={1} numberOfLines={2}>{e.nome}</Texto>
          {trocado ? <Texto numerico variante="suave">{data === dia.hoje ? 'Só hoje' : `Só em ${dataCurta(data)}`} · no lugar de {principal.nome}</Texto> : null}
          {data !== dia.hoje ? <Texto numerico variante="suave">Registro de {dataCurta(data)}</Texto> : null}
        </View>
        <TrocarSoHoje principal={principal} doDia={e} podeTrocar={dia.podeTrocar(principal)} outroDia={data === dia.hoje ? undefined : dataCurta(data)}
          aoEscolher={(exercicioId) => setEscolha({ chave: chaveDaEscolha, exercicioId })} />
      </View>
      {noGrupo ? (
        <Cartao>
          <View style={estilos.linhaGrupo}>
            <View style={estilos.textosDoGrupo}>
              <CabecalhoDoGrupo bloco={noGrupo.grupo} metodologia={dia.config.metodologia} />
              <Texto numerico style={estilos.faixa}>
                Exercício {noGrupo.posicao} de {noGrupo.tamanho}
              </Texto>
              <Texto numerico variante="suave">
                {vez ? `Depois: ${nomeDe(vez) || 'próximo do grupo'}` : 'Grupo feito.'}
              </Texto>
            </View>
            {vez ? <Botao rotulo="Ir" rotuloAcessivel={`Ir para ${nomeDe(vez) || 'o próximo do grupo'}`} tipo="secundario" Icone={ArrowRight} aoTocar={() => ir(vez.uid)} /> : null}
          </View>
        </Cartao>
      ) : null}
    </>
  );
  const fim = (
    <>
      <View style={estilos.fim}>
        {!proximo || emDestaque ? (
          <>
            <Texto numerico variante="suave">{resumoDoDia}</Texto>
            {retornoHabilitado ? (
              <ConcluirTreino {...conclusao} tipo="primario" cheio avisarDataFutura={!proximo} />
            ) : (
              // Chave desligada: nada é concluído, então o botão não promete isso e não é primário (auditoria de 03/11).
              <Botao rotulo="Voltar à lista do dia" Icone={List} tipo="secundario" cheio aoTocar={() => router.replace(voltar)} />
            )}
          </>
        ) : null}
        <LinhaDeAcoes alinhar="entre">
          {(emColunas ? null : botaoDoAnterior) ?? <View />}
          {proximo || retornoHabilitado ? <Botao rotulo="Lista do dia" Icone={List} tipo="secundario" aoTocar={() => router.replace(voltar)} /> : null}
        </LinhaDeAcoes>
      </View>
      <Texto variante="suave">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet. O que você digita também fica guardado no aparelho.</Texto>
    </>
  );

  // A 3ª coluna da web larga (`ExercicioAluno` decide se abre): o próximo exercício como na lista do dia e o histórico aberto.
  const posicaoDoProximo = proximo ? sessao.exercicios.indexOf(proximo) : -1;
  const doProximo = proximo ? dia.diaDe(proximo) : null;
  const grupoDoProximo = proximo ? posicaoNoGrupo(sessao, posicaoDoProximo, dia.config.metodologia) : null;
  const cartaoDoProximo = proximo && doProximo ? (
    <CartaoExercicioDoDia exercicio={doProximo} posicao={posicaoDoProximo}
      contagem={contagemDoExercicio(doProximo, dia.estaFeita, dia.config.metodologia)}
      cargaDoDia={dia.cargaDoDia(doProximo)} ultima={dia.ultimaCarga(doProximo.exercicioId)}
      tipoTrabalho={dia.config.tipoTrabalho} metodologia={dia.config.metodologia}
      descansoNaSerie={!grupoDoProximo || grupoDoProximo.descansoPorSerie}
      href={caminhoDaSessao(sessao.uid, data, proximo.uid)} aoAbrir={() => ir(proximo.uid)} />
  ) : null;
  const historicoAberto = comHistorico ? {
    recentes: <RecentesDoHistorico exercicio={e} ultimaVez={dia.ultimaVezDe(e)} ultima={dia.ultimaCarga(e.exercicioId)} />,
    porData: (comRotulo: boolean) => <PorDataDoHistorico exercicio={e} rotulo={comRotulo} />,
  } : null;

  return (
    <View ref={raiz} style={estilos.raiz} onLayout={(ev) => { setLarguraDaRota(ev.nativeEvent.layout.width); medirBloco(); }}>
    <AlvoDoVidro ref={alvoDoVidro} style={estilos.raiz}>
    <TopoDoExercicio titulo={topo.titulo} posicao={topo.posicao} voltar={voltar} progresso={progresso} atual={posicao}
      versaoId={dia.treino.versaoId} sessao={sessao} data={data} hoje={dia.hoje} bloco={emColunas ? bloco : null} />
    <View style={estilos.raiz} onLayout={(ev) => setAlturaDaRolagem(ev.nativeEvent.layout.height)}>
    <Tela bordas={[]}>
      <View ref={blocoMedido} style={estilos.conteudo} onLayout={(ev) => { setArea(ev.nativeEvent.layout.width); medirBloco(); }}>
        {emColunas ? null : cabecalho}
        <ExercicioAluno
          acaoDescanso={<DescansoManual sugeridoSegundos={descansoDoPlano} />}
          acaoHistorico={<HistoricoDoExercicio exercicio={e} ultimaVez={dia.ultimaVezDe(e)} ultima={dia.ultimaCarga(e.exercicioId)} cardio={cardio} />}
          key={`${e.uid}|${data}|${e.exercicioId ?? ''}`}
          exercicio={e}
          data={data}
          cargaDoDia={dia.cargaDoDia(e)}
          ultima={dia.ultimaCarga(e.exercicioId)}
          registroDe={dia.registroDe}
          rascunhoDe={(serieUid) => dia.rascunhoDe(e, serieUid)}
          salvarRascunho={(serieUid, mudanca) => dia.salvarRascunho(e, serieUid, mudanca)}
          config={dia.config}
          aoMudarCargaDoDia={(c) => dia.salvarCargaDoDia(e, c)}
          aoRegistrar={registrarSerie}
          recordes={dia.recordesDe(e)}
          ultimaVez={dia.ultimaVezDe(e)}
          aoIniciarPausa={iniciarDescanso}
          aoCancelarPausa={cancelarDescansoDe}
          chaveDaExecucao={dia.chaveDaExecucao}
          descansoNaSerie={!noGrupo || noGrupo.descansoPorSerie}
          demonstracao={demonstracao}
          emColunas={emColunas ? {
            topo: cabecalho, fim, proximo: cartaoDoProximo, historico: historicoAberto,
            alturaForaDaRolagem: alturaDaRolagem === null ? 0 : Math.max(0, janela.height - alturaDaRolagem) + FOLGA_NO_FIM_DA_ROLAGEM,
          } : undefined}
        />
        {emColunas ? null : fim}
      </View>
    </Tela>
    </View>
    {/* Fixa embaixo, fora da rolagem: o descanso (azul) quando conta, senão o "Próximo" (na web larga, na coluna das séries). */}
    <BarraDescanso proximo={conteudoDaBarra} coluna={colunaDaBarra} />
    </AlvoDoVidro>
    <AvisoDeRecorde aviso={aviso} aoFechar={fecharAviso} alvo={alvoDoVidro} />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  fim: { marginTop: espaco(1), gap: espaco(1) },
  nome: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), marginBottom: -espaco(1) },
  nomeTexto: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  conteudo: { gap: espaco(3) },
  barra: { width: '100%' },
  barraEmColunas: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  proximoEmColunas: { flex: 1, minWidth: 0 },
  faixa: { fontFamily: fontes.semi },
  textosDoGrupo: { flex: 1, gap: espaco(0.5) },
  linhaGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
