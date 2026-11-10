import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from './BotaoDeAbrir';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "5 exercícios · 18 séries · 12 séries de trabalho": os totais da sessão numa linha, no cabeçalho dela. */
export function textoDosTotaisDaSessao(r: Pick<ResumoDaSessaoPorContagem, 'exercicios' | 'series' | 'seriesDeTrabalho'>): string {
  return [plural(r.exercicios, 'exercício', 'exercícios'), plural(r.series, 'série', 'séries'), plural(r.seriesDeTrabalho, 'série de trabalho', 'séries de trabalho')].join(' · ');
}

/**
 * Totais da sessão em linha e, recolhida, "Ver distribuição da sessão": séries por tipo (nome da metodologia) e séries de
 * trabalho por grupo muscular da biblioteca. Só contagens de `resumoDaSessaoPorContagem`: nada de meta, média, percentual
 * ou cor de bom/ruim; lista vazia é "—". Sessão sem exercício não mostra nada (sem resumo de zeros).
 */
export function ResumoDaSessao({ resumo }: { resumo: ResumoDaSessaoPorContagem }) {
  const { cores, bordas } = useTema();
  const [aberto, setAberto] = useState(false);
  if (resumo.exercicios === 0) return null;
  return (
    <View style={estilos.resumo}>
      <Texto variante="suave" numerico>{textoDosTotaisDaSessao(resumo)}</Texto>
      <BotaoDeAbrir texto="Ver distribuição da sessão" aberto={aberto} aoAlternar={() => setAberto(!aberto)} />
      {aberto ? (
        <View style={[estilos.bloco, { backgroundColor: cores.superficie2, borderColor: cores.borda, borderWidth: bordas.item }]}>
          <View style={estilos.parte}>
            <Texto variante="rotulo">Séries por tipo</Texto>
            {resumo.porTipo.length
              ? resumo.porTipo.map((t) => <Linha key={t.codigo} rotulo={t.nome || t.codigo} valor={t.quantidade} />)
              : <Texto variante="suave">—</Texto>}
          </View>
          <View style={estilos.parte}>
            <Texto variante="rotulo">Séries de trabalho por grupo muscular</Texto>
            {resumo.porGrupoMuscular.length
              ? resumo.porGrupoMuscular.map((g) => <Linha key={g.grupo} rotulo={g.grupo} valor={g.seriesDeTrabalho} />)
              : <Texto variante="suave">—</Texto>}
          </View>
        </View>
      ) : null}
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
  resumo: { gap: espaco(0.5) },
  // Tipo e grupo lado a lado quando cabem (cada parte pede 240), um embaixo do outro no celular.
  bloco: { borderRadius: RAIO, padding: espaco(1.5), flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  parte: { flexGrow: 1, flexBasis: 240, minWidth: 0, gap: espaco(0.75) },
  linha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espaco(1) },
  rotulo: { flexShrink: 1 },
  valor: { fontFamily: fontes.semi },
});
