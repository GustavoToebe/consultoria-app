import { AvisoDeRecorde, type RecordeParaAvisar } from '../../../../aluno/AvisoDeRecorde';
import { CabecalhoDoGrupo } from '../../../../aluno/CabecalhoDoGrupo';
import { DescansoManual } from '../../../../aluno/DescansoManual';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, List } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConcluirTreino } from '../../../../aluno/ConcluirTreino';
import { ExercicioAluno } from '../../../../aluno/ExercicioAluno';
import { FaixaDoTreino } from '../../../../aluno/FaixaDoTreino';
import { useSessao } from '../../../../sessao/SessaoProvider';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { useAluno } from '../../../../offline/AlunoProvider';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { posicaoNoGrupo } from '../../../../dominio/combinacoes';
import { podeConcluirEm } from '../../../../dominio/conclusaoDoTreino';
import { concluirEmDestaque } from '../../../../dominio/destaqueDaConclusao';
import { dataCurta } from '../../../../dominio/formatos';
import { textoDaContagem } from '../../../../dominio/recordesPessoais';
import { MODALIDADES } from '../../../../dominio/modalidades';
import { nomeComDia, totalDeSeries } from '../../../../dominio/semana';
import { vezNoGrupo } from '../../../../dominio/vezNoGrupo';
import { espaco, fontes } from '../../../../tema/tokens';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { LinhaDeAcoes } from '../../../../ui/LinhaDeAcoes';
import { Vazio } from '../../../../ui/Estados';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';

/**
 * Um exercício da sessão: séries em cartões para registrar carga e repetições. No rodapé, "Próximo" e, logo abaixo,
 * "Anterior" e "Lista do dia", para o aluno andar fora de ordem sem precisar subir até a seta do topo (pedido do
 * Saraiva na reunião de 17/10: o aluno pula exercício, troca a ordem e volta à lista quando quer). Num bi-set,
 * supersérie ou circuito o "Próximo" é a vez no grupo (`vezNoGrupo`) até o grupo acabar; no último exercício,
 * "Concluir treino" com o resumo do dia.
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

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Exercício" voltar={voltar} />
        <Esqueleto />
      </Tela>
    );
  }
  const posicao = sessao ? sessao.exercicios.findIndex((e) => e.uid === exercicioUid) : -1;
  const e = sessao && posicao >= 0 ? sessao.exercicios[posicao] : undefined;
  if (!dia.treino || !sessao || !e) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Exercício" voltar="/aluno/treino" />
        <Vazio texto="Este exercício não está mais no seu plano. Volte para ver o treino atual." />
      </Tela>
    );
  }

  const anterior = posicao > 0 ? sessao.exercicios[posicao - 1] : undefined;
  const nomeDoDia = nomeComDia(sessao);
  const noGrupo = posicaoNoGrupo(sessao, posicao, dia.config.metodologia);
  const vez = vezNoGrupo(noGrupo, (x) => dia.feitas(x) < x.series.length);
  const depoisDoGrupo = sessao.exercicios[noGrupo ? noGrupo.grupo.inicio + noGrupo.tamanho : posicao + 1];
  const proximo = vez ?? depoisDoGrupo;
  const ir = (destino: string) => router.replace(caminhoDaSessao(sessao.uid, data, destino));
  const feitasNoDia = sessao.exercicios.reduce((n, x) => n + dia.feitas(x), 0);
  const totalNoDia = totalDeSeries(sessao);
  const conclusao = { versaoId: dia.treino.versaoId, sessao, data, hoje: dia.hoje, feita: (serieUid: string) => !!dia.registroDe(serieUid)?.concluida };
  // Descanso do plano: o da próxima série a fazer (ou o da primeira que tiver), primeira opção da folha.
  const aFazer = e.series.find((s) => !dia.registroDe(s.uid)?.concluida);
  // Em superset, circuito etc. o descanso do plano é o do grupo (depois da volta); em pré e pós-exaustão, o de cada série.
  const descansoDoPlano =
    noGrupo && !noGrupo.descansoPorSerie
      ? noGrupo.descansoAposSegundos
      : ((aFazer?.descansoSegundos || e.series.find((s) => s.descansoSegundos)?.descansoSegundos) ?? null);
  const modalidade = e.modalidade ? `${MODALIDADES[e.modalidade] ?? e.modalidade} · ` : '';
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

  return (
    <View style={estilos.raiz}>
    <Tela bordas={['top']} largura={720}>
      <Cabecalho
        titulo={e.nome}
        subtitulo={`${modalidade}Exercício ${posicao + 1} de ${sessao.exercicios.length} · ${nomeDoDia} (${dataCurta(data)})`}
        voltar={voltar}
      />
      {/* Treino ao vivo (Engajamento 0.3): duração, volume e séries do dia; some com "Concluir treino" desligado. */}
      {retornoHabilitado ? (
        <Cartao>
          <FaixaDoTreino versaoId={dia.treino.versaoId} sessao={sessao} data={data} hoje={dia.hoje} feitas={feitasNoDia} total={totalNoDia} registroDe={dia.registroDe} />
        </Cartao>
      ) : null}
      {/* Topo do último exercício: secundário (o primário é o do rodapé). Em data futura a linha fica só no rodapé. */}
      {!proximo || emDestaque ? <ConcluirTreino {...conclusao} tipo="secundario" /> : null}
      {noGrupo ? (
        <Cartao>
          <View style={estilos.linhaGrupo}>
            <View style={estilos.textosDoGrupo}>
              <CabecalhoDoGrupo bloco={noGrupo.grupo} metodologia={dia.config.metodologia} />
              <Texto numerico style={estilos.faixa}>
                Exercício {noGrupo.posicao} de {noGrupo.tamanho}
              </Texto>
              <Texto numerico variante="suave">
                {vez ? `Depois: ${vez.nome || 'próximo do grupo'}` : 'Grupo feito.'}
              </Texto>
            </View>
            {vez ? <Botao rotulo="Ir" rotuloAcessivel={`Ir para ${vez.nome || 'o próximo do grupo'}`} tipo="secundario" Icone={ArrowRight} aoTocar={() => ir(vez.uid)} /> : null}
          </View>
        </Cartao>
      ) : null}
      <ExercicioAluno
        acaoDescanso={<DescansoManual sugeridoSegundos={descansoDoPlano} />}
        key={`${e.uid}|${data}`}
        exercicio={e}
        data={data}
        cargaDoDia={dia.cargaDoDia(e)}
        ultima={dia.ultimaCarga(e.exercicioId)}
        registroDe={dia.registroDe}
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
      />
      <View style={estilos.fim}>
        {proximo && emDestaque ? (
          <>
            <Texto numerico variante="suave">{resumoDoDia}</Texto>
            <ConcluirTreino {...conclusao} tipo="primario" cheio />
            <Botao rotulo={`Próximo: ${proximo.nome}`} Icone={ArrowRight} tipo="secundario" cheio aoTocar={() => ir(proximo.uid)} />
          </>
        ) : proximo ? (
          <Botao rotulo={`Próximo: ${proximo.nome}`} Icone={ArrowRight} cheio aoTocar={() => ir(proximo.uid)} />
        ) : retornoHabilitado ? (
          <>
            <Texto numerico variante="suave">{resumoDoDia}</Texto>
            <ConcluirTreino {...conclusao} tipo="primario" cheio avisarDataFutura />
          </>
        ) : (
          <>
            <Texto numerico variante="suave">
              {feitasNoDia} de {totalNoDia} {totalNoDia === 1 ? 'série feita' : 'séries feitas'} neste treino.
            </Texto>
            <Botao rotulo="Concluir treino" Icone={Check} cheio aoTocar={() => router.replace(voltar)} />
          </>
        )}
        <LinhaDeAcoes alinhar="entre">
          {anterior ? (
            <Botao rotulo="Anterior" rotuloAcessivel={`Anterior: ${anterior.nome}`} Icone={ArrowLeft} tipo="secundario" aoTocar={() => ir(anterior.uid)} />
          ) : (
            <View />
          )}
          {/* Com "Concluir treino" ligado o último exercício não volta mais sozinho à lista: a "Lista do dia" fica aqui também. */}
          {proximo || retornoHabilitado ? <Botao rotulo="Lista do dia" Icone={List} tipo="secundario" aoTocar={() => router.replace(voltar)} /> : null}
        </LinhaDeAcoes>
      </View>
      <Texto variante="suave">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
    <AvisoDeRecorde aviso={aviso} aoFechar={fecharAviso} />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  fim: { marginTop: espaco(1), gap: espaco(1) },
  faixa: { fontFamily: fontes.semi },
  textosDoGrupo: { flex: 1, gap: espaco(0.5) },
  linhaGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
