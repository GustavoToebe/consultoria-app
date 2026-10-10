import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
  const animar = usePrimeiraLista(divisoes.length > 0, divisoes.map((d) => d.chave).join('|'));
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (chave: string) =>
    setRecolhidas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  return (
    <View style={estilos.lista}>
      {divisoes.map((d, i) => (
        <EntradaEmCascata indice={i} animar={animar} key={d.chave} style={estilos.divisao}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${d.nome}, ${recolhidas.has(d.chave) ? 'recolhida' : 'aberta'}`}
            accessibilityState={{ expanded: !recolhidas.has(d.chave) }}
            onPress={() => alternar(d.chave)}
            style={({ pressed }) => [estilos.faixa, { backgroundColor: cores.superficie2, borderLeftColor: marca, opacity: pressed ? 0.7 : 1 }]}>
            <Texto numerico style={estilos.nomeDivisao}>{d.nome}</Texto>
            <View style={estilos.resumoFaixa}>
              <Texto numerico variante="pequeno">
                {d.exercicios.length} {d.exercicios.length === 1 ? 'exercício' : 'exercícios'}
              </Texto>
              {recolhidas.has(d.chave) ? <ChevronDown size={18} color={cores.textoSuave} /> : <ChevronUp size={18} color={cores.textoSuave} />}
            </View>
          </Pressable>
          {recolhidas.has(d.chave) ? null : d.exercicios.map((e) => (
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
                    <Texto numerico variante="suave" style={estilos.col}>{l.series}</Texto>
                  </View>
                  {l.observacoes.length ? (
                    <View style={[estilos.obs, { borderLeftColor: cores.atencao }]}>
                      <Texto numerico variante="suave" style={estilos.obsTexto}>{l.observacoes.join(' · ')}</Texto>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </EntradaEmCascata>
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
  resumoFaixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
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
