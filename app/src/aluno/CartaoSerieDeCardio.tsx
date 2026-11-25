import { StyleSheet, View } from 'react-native';

import type { Serie } from '../api/tipos';
import { metaDaLinhaDaSerie } from '../dominio/telaDoExercicio';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { fundoPintado, superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';
import { MarcarSerie } from './MarcarSerie';
import { linhasDoCardio } from './serieDoAluno';

/**
 * Série de cardio: a prescrição (duração, distância, ritmo, zona, intervalos) e um único gesto, marcar "feito". Não há
 * peso, repetições nem esforço; o registro vai com carga e repetições nulas. Mesmo desenho da linha da série (25/11): a
 * ativa com a borda na cor de ação, a feita pintada de verde com o ✓ verde.
 */
export function CartaoSerieDeCardio({
  serie,
  numero,
  feita,
  ativa = false,
  ultimaDoExercicio,
  aoMarcar,
}: {
  serie: Serie;
  numero: number;
  feita: boolean;
  ativa?: boolean;
  ultimaDoExercicio: boolean;
  aoMarcar: (concluida: boolean) => void;
}) {
  const { cores, variante, bordas } = useTema();
  const linhas = linhasDoCardio(serie.cardio);
  const pintada = feita ? superficiePintada(cores.sucesso, cores.superficie, variante, cores) : null;
  return (
    <View style={[
      estilos.serie,
      { borderWidth: bordas.item, borderColor: ativa && !feita ? cores.acao : cores.divisor, backgroundColor: cores.superficie },
      pintada ? [fundoPintado(pintada), { borderColor: pintada.borda }] : null,
    ]}>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          <Texto variante="bloco" nivel={3} style={estilos.nome}>Série {numero}</Texto>
          {linhas.length ? linhas.map((l) => <Texto key={l} numerico>{l}</Texto>) : <Texto numerico>{metaDaLinhaDaSerie(serie) || '—'}</Texto>}
        </View>
        <MarcarSerie
          estado={feita ? 'FEITA' : 'PRONTA'}
          numero={numero}
          ultimaDoExercicio={ultimaDoExercicio}
          rotulo={`Marcar cardio da série ${numero} como feito`}
          aoTocar={() => aoMarcar(!feita)}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderRadius: RAIO, padding: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
});
