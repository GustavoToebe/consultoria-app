import { StyleSheet, View } from 'react-native';

import { dataParaTela } from '../dominio/formatos';
import type { DivisaoRelatorio } from '../dominio/relatorio';
import { textoCarga } from '../pdf/pdfCargas';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * Cargas por divisão (treinador e aluno): faixa com o nome da divisão e, para cada exercício, uma tabela com a data,
 * a carga de trabalho, as repetições e as séries feitas. Observação do aluno embaixo da linha.
 */
export function CargasPorDivisao({ divisoes }: { divisoes: DivisaoRelatorio[] }) {
  const { cores, marca } = useTema();
  return (
    <View style={estilos.lista}>
      {divisoes.map((d) => (
        <View key={d.chave} style={estilos.divisao}>
          <View style={[estilos.faixa, { backgroundColor: cores.superficie2, borderLeftColor: marca }]}>
            <Texto numerico style={estilos.nomeDivisao}>{d.nome}</Texto>
            <Texto numerico variante="pequeno">
              {d.exercicios.length} {d.exercicios.length === 1 ? 'exercício' : 'exercícios'}
            </Texto>
          </View>
          {d.exercicios.map((e) => (
            <View key={e.chave} style={[estilos.exercicio, { borderColor: cores.borda }]}>
              <View style={[estilos.cabecalho, { backgroundColor: cores.superficie2 }]}>
                <Texto numerico style={estilos.nomeExercicio}>{e.nome}</Texto>
                <Texto numerico variante="pequeno">
                  {e.linhas.length} {e.linhas.length === 1 ? 'sessão' : 'sessões'}
                </Texto>
              </View>
              <View style={[estilos.linha, { borderColor: cores.borda }]}>
                <Texto numerico variante="secao" style={estilos.colData}>Data</Texto>
                <Texto numerico variante="secao" style={estilos.colCarga}>Carga</Texto>
                <Texto numerico variante="secao" style={estilos.col}>Reps</Texto>
                <Texto numerico variante="secao" style={estilos.col}>Séries</Texto>
              </View>
              {[...e.linhas].reverse().map((l, i) => (
                <View key={`${l.data}-${i}`} style={[estilos.linha, { borderColor: cores.borda }]}>
                  <View style={estilos.celulas}>
                    <Texto numerico style={[estilos.colData, estilos.forte]}>{dataParaTela(l.data)}</Texto>
                    <Texto numerico style={[estilos.colCarga, estilos.carga, l.carga !== null && { color: marca }]}>{textoCarga(l)}</Texto>
                    <Texto numerico style={estilos.col}>{l.repeticoes ?? '—'}</Texto>
                    <Texto numerico cor="suave" style={estilos.col}>{l.series}</Texto>
                  </View>
                  {l.observacoes.length ? (
                    <View style={[estilos.obs, { borderLeftColor: cores.atencao }]}>
                      <Texto numerico cor="suave" style={estilos.obsTexto}>{l.observacoes.join(' · ')}</Texto>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(2.5) },
  divisao: { gap: espaco(1) },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
    borderLeftWidth: 4,
    borderRadius: RAIO,
    paddingVertical: espaco(1.25),
    paddingHorizontal: espaco(1.5),
  },
  nomeDivisao: { fontFamily: fontes.negrito, fontSize: 15, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
  exercicio: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
    paddingVertical: espaco(1),
    paddingHorizontal: espaco(1.5),
  },
  nomeExercicio: { fontFamily: fontes.semi, flexShrink: 1 },
  linha: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), gap: espaco(0.75), flexDirection: 'row', flexWrap: 'wrap' },
  celulas: { flexDirection: 'row', width: '100%' },
  colData: { flex: 1.3 },
  colCarga: { flex: 1.2 },
  col: { flex: 0.8 },
  forte: { fontFamily: fontes.semi },
  carga: { fontFamily: fontes.negrito },
  obs: { borderLeftWidth: 3, paddingLeft: espaco(1), width: '100%' },
  obsTexto: { fontStyle: 'italic' },
});
