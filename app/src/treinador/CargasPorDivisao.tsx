import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataParaTela } from '../dominio/formatos';
import type { DivisaoRelatorio } from '../dominio/relatorio';
import { textoCarga } from '../pdf/pdfCargas';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Tabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';

/**
 * Cargas por divisão (treinador e aluno): faixa com o nome da divisão e, para cada exercício, uma tabela com a data,
 * a carga de trabalho, as repetições e as séries feitas. Observação do aluno embaixo da linha.
 */
export function CargasPorDivisao({ divisoes }: { divisoes: DivisaoRelatorio[] }) {
  const { cores, marca, marcaTexto } = useTema();
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
              <View style={estilos.tabela}>
                <Tabela
                  rotulo={`Cargas de ${e.nome}`}
                  linhas={[...e.linhas].reverse().map((l, i) => ({ ...l, chave: `${l.data}-${i}` }))}
                  chave={(l) => l.chave}
                  colunas={[
                    { chave: 'data', titulo: 'Data', flex: 1.3, principal: true, render: (l) => <Texto numerico style={estilos.forte}>{dataParaTela(l.data)}</Texto> },
                    { chave: 'carga', titulo: 'Carga', flex: 1.2, render: (l) => <Texto numerico style={[estilos.carga, l.carga !== null && { color: marcaTexto }]}>{textoCarga(l)}</Texto> },
                    { chave: 'reps', titulo: 'Reps', flex: 0.8, render: (l) => <Texto numerico>{l.repeticoes ?? '—'}</Texto> },
                    { chave: 'series', titulo: 'Séries', flex: 0.8, render: (l) => <Texto numerico variante="suave">{l.series}</Texto> },
                  ]}
                  detalhe={(l) => l.observacoes.length ? (
                    <View style={[estilos.obs, { borderLeftColor: cores.atencao }]}>
                      <Texto numerico variante="suave" style={estilos.obsTexto}>{l.observacoes.join(' · ')}</Texto>
                    </View>
                  ) : null}
                />
              </View>
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
  // A tabela já tem a própria borda; dentro do bloco do exercício fica só com o recuo.
  tabela: { padding: espaco(1) },
  forte: { fontFamily: fontes.semi },
  carga: { fontFamily: fontes.negrito },
  obs: { borderLeftWidth: 3, paddingLeft: espaco(1), width: '100%' },
  obsTexto: { fontStyle: 'italic' },
});
