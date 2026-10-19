import { DescansoManual } from '../../../../aluno/DescansoManual';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, List } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ExercicioAluno } from '../../../../aluno/ExercicioAluno';
import { useTelaAcesa } from '../../../../aluno/useTelaAcesa';
import { useAluno } from '../../../../offline/AlunoProvider';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import { posicaoNoGrupo, textoDaFaixa } from '../../../../dominio/combinacoes';
import { dataCurta } from '../../../../dominio/formatos';
import { nomeComDia } from '../../../../dominio/semana';
import { MODALIDADES } from '../../../../treinador/treino/FolhaBiblioteca';
import { espaco, fontes } from '../../../../tema/tokens';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { LinhaDeAcoes } from '../../../../ui/LinhaDeAcoes';
import { Vazio } from '../../../../ui/Estados';
import { Selo } from '../../../../ui/Selo';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';

/**
 * Um exercício da sessão: séries em cartões para registrar carga e repetições. No rodapé, "Próximo" e, logo abaixo,
 * "Anterior" e "Lista do dia", para o aluno andar fora de ordem sem precisar subir até a seta do topo (pedido do
 * Saraiva na reunião de 17/10: o aluno pula exercício, troca a ordem e volta à lista quando quer).
 */
export default function ExercicioDaSessao() {
  const { uid, exercicio: exercicioUid, data: dataDaRota } = useLocalSearchParams<{ uid: string; exercicio: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  useTelaAcesa();
  const { iniciarDescanso } = useAluno();
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

  const proximo = sessao.exercicios[posicao + 1];
  const anterior = posicao > 0 ? sessao.exercicios[posicao - 1] : undefined;
  const nomeDoDia = nomeComDia(sessao);
  // Bi-set, tri-set ou circuito: diz o que vem em seguida dentro do grupo (sem descanso entre eles).
  const noGrupo = posicaoNoGrupo(sessao.exercicios, posicao);
  const faixaDoGrupo = noGrupo
    ? textoDaFaixa(noGrupo, noGrupo.grupo.exercicios.some((x) => dia.feitas(x) < x.series.length))
    : null;

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho
        titulo={e.nome}
        subtitulo={`Exercício ${posicao + 1} de ${sessao.exercicios.length} · ${nomeDoDia} (${dataCurta(data)})`}
        voltar={voltar}
      />
      {e.modalidade ? (
        <View style={estilos.selos}>
          <Selo texto={MODALIDADES[e.modalidade] ?? e.modalidade} tipo="neutro" />
        </View>
      ) : null}
      {faixaDoGrupo ? (
        <Cartao>
          <Texto numerico style={estilos.faixa}>{faixaDoGrupo}</Texto>
          <Texto variante="pequeno">Faça os exercícios do grupo um depois do outro, sem descanso entre eles.</Texto>
        </Cartao>
      ) : null}
      <ExercicioAluno
        acaoAoLadoDoVideo={<DescansoManual />}
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
      />
      <View style={estilos.fim}>
        {proximo ? (
          <Botao
            rotulo={`Próximo: ${proximo.nome}`}
            Icone={ArrowRight}
            cheio
            aoTocar={() => router.replace(caminhoDaSessao(sessao.uid, data, proximo.uid))}
          />
        ) : (
          <Botao rotulo="Voltar para o dia" Icone={Check} cheio tipo="secundario" aoTocar={() => router.replace(voltar)} />
        )}
        <LinhaDeAcoes alinhar="entre">
          {anterior ? (
            <Botao
              rotulo="Anterior"
              rotuloAcessivel={`Anterior: ${anterior.nome}`}
              Icone={ArrowLeft}
              tipo="secundario"
              aoTocar={() => router.replace(caminhoDaSessao(sessao.uid, data, anterior.uid))}
            />
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
  selos: { flexDirection: 'row', gap: espaco(1), marginTop: -espaco(1) },
  fim: { marginTop: espaco(1), gap: espaco(1) },
  faixa: { fontFamily: fontes.semi },
});
