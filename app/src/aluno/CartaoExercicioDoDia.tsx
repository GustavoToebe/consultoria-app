import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ExercicioPlano, UltimaCarga } from '../api/tipos';
import { usaCargaDeTrabalho } from '../dominio/cargas';
import { numeroParaTela } from '../dominio/formatos';
import { MODALIDADES } from '../treinador/treino/FolhaBiblioteca';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Exercício na lista do dia: nome, modalidade, a carga de trabalho (a do dia ou, sem ela, a última registrada) e
 * quantas séries já foram feitas. Toque abre o exercício.
 */
export function CartaoExercicioDoDia({
  exercicio: e,
  posicao,
  feitas,
  cargaDoDia,
  ultima,
  tipoTrabalho,
  aoAbrir,
}: {
  exercicio: ExercicioPlano;
  posicao: number;
  feitas: number;
  cargaDoDia: number | null;
  ultima: UltimaCarga | null;
  tipoTrabalho: string;
  aoAbrir: () => void;
}) {
  const { cores } = useTema();
  const total = e.series.length;
  const completo = total > 0 && feitas >= total;
  const carga = usaCargaDeTrabalho(e)
    ? cargaDoDia !== null
      ? { rotulo: `Carga de trabalho (${tipoTrabalho})`, valor: `${numeroParaTela(cargaDoDia)} kg` }
      : { rotulo: 'Última carga', valor: ultima?.carga != null ? `${numeroParaTela(ultima.carga)} kg` : '—' }
    : null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${e.nome}, ${feitas} de ${total} séries feitas`}
      onPress={aoAbrir}
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
            {total} {total === 1 ? 'série planejada' : 'séries planejadas'}
          </Texto>
        )}
        <Selo texto={`${feitas}/${total} séries`} tipo={completo ? 'sucesso' : feitas ? 'atencao' : 'neutro'} />
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
