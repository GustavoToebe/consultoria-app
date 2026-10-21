import { DescansoManual } from '../../../../aluno/DescansoManual';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, List } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ExercicioAluno } from '../../../../aluno/ExercicioAluno';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { useAluno } from '../../../../offline/AlunoProvider';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { posicaoNoGrupo } from '../../../../dominio/combinacoes';
import { dataCurta } from '../../../../dominio/formatos';
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
  const { iniciarDescanso, demonstracoes } = useAluno();
  const { sessao, data } = dia;
  const voltar = caminhoDaSessao(uid ?? '', data);

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
        <Cabecalho titulo="Exercício" voltar="/aluno" />
        <Vazio texto="Este exercício não está mais no seu plano. Volte para ver o treino atual." />
      </Tela>
    );
  }

  const anterior = posicao > 0 ? sessao.exercicios[posicao - 1] : undefined;
  const nomeDoDia = nomeComDia(sessao);
  const noGrupo = posicaoNoGrupo(sessao.exercicios, posicao);
  const vez = vezNoGrupo(noGrupo, (x) => dia.feitas(x) < x.series.length);
  const depoisDoGrupo = sessao.exercicios[noGrupo ? noGrupo.grupo.inicio + noGrupo.tamanho : posicao + 1];
  const proximo = vez ?? depoisDoGrupo;
  const ir = (destino: string) => router.replace(caminhoDaSessao(sessao.uid, data, destino));
  const feitasNoDia = sessao.exercicios.reduce((n, x) => n + dia.feitas(x), 0);
  const totalNoDia = totalDeSeries(sessao);
  // Descanso do plano: o da próxima série a fazer (ou o da primeira que tiver), primeira opção da folha.
  const aFazer = e.series.find((s) => !dia.registroDe(s.uid)?.concluida);
  const descansoDoPlano = (aFazer?.descansoSegundos || e.series.find((s) => s.descansoSegundos)?.descansoSegundos) ?? null;
  const modalidade = e.modalidade ? `${MODALIDADES[e.modalidade] ?? e.modalidade} · ` : '';

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho
        titulo={e.nome}
        subtitulo={`${modalidade}Exercício ${posicao + 1} de ${sessao.exercicios.length} · ${nomeDoDia} (${dataCurta(data)})`}
        voltar={voltar}
      />
      {noGrupo ? (
        <Cartao>
          <View style={estilos.linhaGrupo}>
            <Texto numerico style={estilos.faixa}>
              {noGrupo.nome} {noGrupo.posicao} de {noGrupo.tamanho} · sem descanso
              {vez ? <Texto numerico variante="suave">{`\nDepois: ${vez.nome || 'próximo do grupo'}`}</Texto> : <Texto numerico variante="suave">{'\nGrupo feito.'}</Texto>}
            </Texto>
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
        aoRegistrar={(serieUid, d) => dia.registrar(e, serieUid, d)}
        aoIniciarPausa={iniciarDescanso}
        demonstracao={e.exercicioId ? demonstracoes.find((d) => d.exercicioId === e.exercicioId) ?? null : null}
      />
      <View style={estilos.fim}>
        {proximo ? (
          <Botao rotulo={`Próximo: ${proximo.nome}`} Icone={ArrowRight} cheio aoTocar={() => ir(proximo.uid)} />
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
          {proximo ? <Botao rotulo="Lista do dia" Icone={List} tipo="secundario" aoTocar={() => router.replace(voltar)} /> : null}
        </LinhaDeAcoes>
      </View>
      <Texto variante="suave">Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.</Texto>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  fim: { marginTop: espaco(1), gap: espaco(1) },
  faixa: { fontFamily: fontes.semi, flex: 1 },
  linhaGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
});
