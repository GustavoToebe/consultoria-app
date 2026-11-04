import type { Href } from 'expo-router';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano, UltimaCarga } from '../api/tipos';
import { resumoTecnicasEDescanso, textoCardio } from '../dominio/agrupamento';
import { usaCargaDeTrabalho } from '../dominio/cargas';
import { MODALIDADES } from '../dominio/modalidades';
import { textoDaCarga } from '../dominio/unidadeDeCarga';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { propsDeLink } from '../ui/propsDeLink';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { ehExercicioDeCardio } from './serieDoAluno';

/**
 * Exercício na lista do dia: nome, modalidade, a carga de trabalho (a do dia ou, sem ela, a última registrada) e
 * quantas séries já foram feitas, com a técnica de cada série e o descanso ("Cluster na série 4 · descanso 90 s").
 * Toque abre o exercício.
 */
export function CartaoExercicioDoDia({
  exercicio: e,
  posicao,
  contagem: { total, feitas },
  cargaDoDia,
  ultima,
  tipoTrabalho,
  metodologia,
  href,
  descansoNaSerie = true,
  aoAbrir,
}: {
  exercicio: ExercicioPlano;
  posicao: number;
  /** A contagem da D6 (`contagemDoExercicio`): a mesma do título do exercício e da faixa. */
  contagem: { total: number; feitas: number };
  cargaDoDia: number | null;
  ultima: UltimaCarga | null;
  tipoTrabalho: string;
  metodologia?: Configuracao;
  /** Destino do exercício; na web vira `<a href>`. */
  href?: Href;
  /** Falso nos membros de grupo cujo descanso é o do grupo (depois da volta): o resumo não mostra o descanso por série. */
  descansoNaSerie?: boolean;
  aoAbrir: () => void;
}) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const completo = total > 0 && feitas >= total;
  // Só aquecimento: nada entra na contagem, mas as séries continuam planejadas.
  const planejadas = total || e.series.length;
  const cardio = ehExercicioDeCardio(e);
  const resumo = cardio
    ? null
    : resumoTecnicasEDescanso(descansoNaSerie ? e.series : e.series.map((s) => ({ ...s, descansoSegundos: null })), metodologia);
  // Cardio: a prescrição da primeira série no lugar da carga (o aluno só marca "feito").
  const prescricaoDeCardio = cardio && e.series[0]?.cardio ? textoCardio(e.series[0].cardio) : null;
  const carga = usaCargaDeTrabalho(e)
    ? cargaDoDia !== null
      ? { rotulo: `Carga de trabalho (${tipoTrabalho}) hoje`, valor: textoDaCarga(cargaDoDia, unidade) }
      : { rotulo: 'Última carga', valor: ultima?.carga != null ? textoDaCarga(ultima.carga, unidade) : '—' }
    : null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${e.nome}, ${feitas} de ${total} séries feitas`}
      {...(href ? propsDeLink(href, aoAbrir) : { onPress: aoAbrir })}
      style={({ pressed }) => [
        estilos.cartao,
        { backgroundColor: pressed ? cores.superficie3 : cores.superficie2, borderColor: completo ? cores.sucesso : cores.borda },
      ]}>
      <View style={estilos.topo}>
        <View style={estilos.nomes}>
          <Texto numerico style={estilos.nome}>
            {posicao + 1}. {e.nome}
          </Texto>
          {e.modalidade ? <Texto numerico variante="suave">{MODALIDADES[e.modalidade] ?? e.modalidade}</Texto> : null}
          {resumo ? <Texto numerico variante="pequeno">{resumo}</Texto> : null}
          {prescricaoDeCardio ? <Texto numerico variante="pequeno">{prescricaoDeCardio}</Texto> : null}
        </View>
        {completo ? <CheckCircle2 size={22} color={cores.sucesso} /> : <ChevronRight size={22} color={cores.textoSuave} />}
      </View>
      <View style={[estilos.rodape, { borderTopColor: cores.borda }]}>
        {carga ? (
          <Texto numerico variante="suave" style={estilos.carga}>
            {carga.rotulo}: <Texto numerico style={estilos.valor}>{carga.valor}</Texto>
          </Texto>
        ) : (
          <Texto numerico variante="suave" style={estilos.carga}>
            {planejadas} {planejadas === 1 ? 'série planejada' : 'séries planejadas'}
          </Texto>
        )}
        {total > 0 ? (
          <Selo texto={`${feitas}/${total} séries`} tipo={completo ? 'sucesso' : feitas ? 'atencao' : 'neutro'} />
        ) : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  nomes: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 17, lineHeight: 23 },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
    borderTopWidth: 1,
    paddingTop: espaco(1.5),
  },
  carga: { flexShrink: 1 },
  valor: { fontFamily: fontes.negrito },
});
