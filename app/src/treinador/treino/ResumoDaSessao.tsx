import { StyleSheet, View } from 'react-native';

import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import type { ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "5 exercícios · 18 séries · 12 séries de trabalho": os totais da sessão numa linha, no cabeçalho dela. */
export function textoDosTotaisDaSessao(r: Pick<ResumoDaSessaoPorContagem, 'exercicios' | 'series' | 'seriesDeTrabalho'>): string {
  return [plural(r.exercicios, 'exercício', 'exercícios'), plural(r.series, 'série', 'séries'), plural(r.seriesDeTrabalho, 'série de trabalho', 'séries de trabalho')].join(' · ');
}

/**
 * Totais da sessão e a distribuição sempre à vista (visual-ponytail, 17/11: o "Ver distribuição da sessão" recolhido
 * passava despercebido e deixava um buraco): séries por tipo em blocos com o número grande e o ponto na cor do tipo, e
 * séries de trabalho por grupo muscular em barras. Só contagens de `resumoDaSessaoPorContagem`: nada de meta, média,
 * percentual ou cor de bom/ruim (a barra é da cor de identificação, não de situação); lista vazia é "—". Sessão sem
 * exercício não mostra nada.
 */
export function ResumoDaSessao({ resumo }: { resumo: ResumoDaSessaoPorContagem }) {
  const { cores, identificacao } = useTema();
  if (resumo.exercicios === 0) return null;
  const maior = Math.max(1, ...resumo.porGrupoMuscular.map((g) => g.seriesDeTrabalho));
  return (
    <View style={estilos.resumo}>
      <Texto variante="suave" numerico>{textoDosTotaisDaSessao(resumo)}</Texto>
      <View style={[estilos.bloco, { borderTopColor: cores.divisor }]}>
        <View style={estilos.parte}>
          <Texto variante="rotulo" cor="suave">Séries por tipo</Texto>
          {resumo.porTipo.length ? (
            <View style={estilos.tipos}>
              {resumo.porTipo.map((t) => {
                const chave = corDoTipoDeSerie(t.codigo, null);
                return (
                  <View key={t.codigo} style={[estilos.tipo, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]} accessible accessibilityLabel={`${t.nome || t.codigo}: ${t.quantidade}`}>
                    <View style={estilos.cabecaDoTipo}>
                      <View style={[estilos.ponto, { backgroundColor: chave ? identificacao[chave].cor : cores.textoSuave }]} />
                      <Texto variante="pequeno" cor="suave" numberOfLines={1} style={estilos.flexivel}>{t.nome || t.codigo}</Texto>
                    </View>
                    <Texto numerico style={estilos.numeroDoTipo}>{t.quantidade}</Texto>
                  </View>
                );
              })}
            </View>
          ) : <Texto variante="suave">—</Texto>}
        </View>
        <View style={estilos.parte}>
          <Texto variante="rotulo" cor="suave">Séries de trabalho por grupo muscular</Texto>
          {resumo.porGrupoMuscular.length ? (
            <View style={estilos.grupos}>
              {resumo.porGrupoMuscular.map((g) => (
                <View key={g.grupo} style={estilos.grupo} accessible accessibilityLabel={`${g.grupo}: ${g.seriesDeTrabalho}`}>
                  <Texto variante="pequeno" cor="suave" numberOfLines={1} style={estilos.nomeDoGrupo}>{g.grupo}</Texto>
                  <View style={[estilos.trilho, { backgroundColor: cores.superficie2 }]}>
                    <View style={[estilos.barra, { width: `${(g.seriesDeTrabalho / maior) * 100}%`, backgroundColor: identificacao.CIANO.cor }]} />
                  </View>
                  <Texto numerico style={estilos.valor}>{g.seriesDeTrabalho}</Texto>
                </View>
              ))}
            </View>
          ) : <Texto variante="suave">—</Texto>}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(1) },
  // Tipo e grupo lado a lado quando cabem, um embaixo do outro no celular.
  bloco: { borderTopWidth: 1, paddingTop: espaco(1.5), flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3) },
  parte: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: espaco(1) },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  tipo: { flexGrow: 1, flexBasis: 100, minWidth: 90, borderWidth: 1, borderRadius: 12, paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), gap: 2 },
  cabecaDoTipo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  flexivel: { flexShrink: 1 },
  numeroDoTipo: { fontFamily: fontes.semi, fontSize: 22, lineHeight: 28 },
  grupos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1) },
  grupo: { flexGrow: 1, flexBasis: 220, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(1.25) },
  nomeDoGrupo: { width: 96 },
  trilho: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
  valor: { fontFamily: fontes.semi, minWidth: 18, textAlign: 'right' },
});
