import { StyleSheet, View } from 'react-native';

import type { ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

/**
 * "Resumo da sessão" da coluna da esquerda: só contagens de `resumoDaSessaoPorContagem` (exercícios, séries, séries de
 * trabalho, séries por tipo com o nome da metodologia e séries de trabalho por grupo muscular da biblioteca). Nada de
 * meta, média, percentual ou cor de bom/ruim; lista vazia é "—".
 */
export function ResumoDaSessao({ resumo }: { resumo: ResumoDaSessaoPorContagem }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.bloco, { backgroundColor: cores.superficie2, borderColor: cores.borda, borderWidth: bordas.item }]}>
      <Texto variante="secao" nivel={3}>Resumo da sessão</Texto>
      <Linha rotulo="Exercícios" valor={resumo.exercicios} />
      <Linha rotulo="Séries" valor={resumo.series} />
      <Linha rotulo="Séries de trabalho" valor={resumo.seriesDeTrabalho} />
      <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
      <Texto variante="rotulo">Séries por tipo</Texto>
      {resumo.porTipo.length
        ? resumo.porTipo.map((t) => <Linha key={t.codigo} rotulo={t.nome || t.codigo} valor={t.quantidade} />)
        : <Texto variante="suave">—</Texto>}
      <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
      <Texto variante="rotulo">Séries de trabalho por grupo muscular</Texto>
      {resumo.porGrupoMuscular.length
        ? resumo.porGrupoMuscular.map((g) => <Linha key={g.grupo} rotulo={g.grupo} valor={g.seriesDeTrabalho} />)
        : <Texto variante="suave">—</Texto>}
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <Texto variante="suave" style={estilos.rotulo}>{rotulo}</Texto>
      <Texto numerico style={estilos.valor}>{valor}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  linha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espaco(1) },
  rotulo: { flexShrink: 1 },
  valor: { fontFamily: fontes.semi },
  divisor: { height: StyleSheet.hairlineWidth, marginVertical: espaco(0.5) },
});
