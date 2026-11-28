import { Pressable, StyleSheet, View } from 'react-native';

import { textoDosTotaisDaSessao } from '../../dominio/contagemDoTreino';
import { corDoTipoDeSerie } from '../../dominio/corDaSerie';
import { nomesCurtosDosTipos, type ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import { textoDosPontos, type PontoParaRevisar } from '../../dominio/pontosParaRevisar';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { Alerta } from '../../ui/Estados';
import { SecaoRecolhivel } from '../../ui/SecaoRecolhivel';
import { sobre } from '../../ui/sobre';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';

/** Quantos pontos aparecem listados; o resto vira "e mais N" (a lista inteira está no selo das Sessões). */
const PONTOS_VISIVEIS = 5;

interface Props {
  resumo: ResumoDaSessaoPorContagem;
  /** Pontos para revisar da sessão (`pontosDaSessao`): "Agachamento livre · Série 5 sem descanso". Vazio, o bloco some. */
  pontos?: readonly PontoParaRevisar[];
  /** Tocar num ponto abre a série dele (o editor seleciona o exercício e a aba do bloco). Sem ele, os pontos são só texto. */
  aoAbrirPonto?: (ponto: PontoParaRevisar) => void;
  /**
   * Abaixo de 1600 px (SERIE-ABERTA 0.5): faixa acima das duas colunas, com os pontos à vista (os totais ficam no cabeçalho
   * da sessão) e o detalhe por tipo e grupo recolhido. Sem ele, o desenho da coluna fixa da direita (tudo aberto, tipos em 2 × 2).
   */
  compacto?: boolean;
}

/**
 * Resumo da sessão: totais, pontos para revisar, séries por tipo em ladrilhos com o número grande, pintados na cor do tipo
 * (cartão de indicador pintado, 23/11, `ui/superficiePintada`; ficam fora do `CartaoDeIndicador` porque são ladrilhos
 * menores que a célula da `GradeDeIndicadores`; tipo sem cor fica neutro), e séries de trabalho por grupo muscular em
 * barras. Só contagens de `resumoDaSessaoPorContagem`: nada de meta, média, percentual ou cor de bom/ruim (a barra é da
 * cor de identificação, não de situação); lista vazia é "—". Sessão sem exercício não mostra nada.
 */
export function ResumoDaSessao({ resumo, pontos = [], aoAbrirPonto, compacto }: Props) {
  if (resumo.exercicios === 0) return null;
  const detalhe = <Detalhe resumo={resumo} coluna={!compacto} />;
  const curtos = nomesCurtosDosTipos(resumo.porTipo.map((t) => t.nome || t.codigo));
  return (
    <View style={estilos.resumo}>
      {/* Na faixa compacta os totais já estão no cabeçalho da sessão (`CartaoSessao`). */}
      {compacto ? null : <Texto variante="suave" numerico>{textoDosTotaisDaSessao(resumo)}</Texto>}
      {pontos.length ? <PontosParaRevisar pontos={pontos} aoAbrir={aoAbrirPonto} /> : null}
      {compacto ? (
        <SecaoRecolhivel titulo="Séries por tipo e por grupo" nivel={4}
          resumo={resumo.porTipo.map((t, i) => `${t.quantidade} ${curtos[i]}`).join(', ') || undefined}>
          {detalhe}
        </SecaoRecolhivel>
      ) : detalhe}
    </View>
  );
}

/** Caixa âmbar com os pontos: aviso, não erro (não trava publicar). Cada ponto é um botão que abre a série. */
function PontosParaRevisar({ pontos, aoAbrir }: { pontos: readonly PontoParaRevisar[]; aoAbrir?: (p: PontoParaRevisar) => void }) {
  const { cores } = useTema();
  const resto = pontos.length - PONTOS_VISIVEIS;
  return (
    <Alerta tom="atencao" titulo={textoDosPontos(pontos.length)}>
      <View>
        {pontos.slice(0, PONTOS_VISIVEIS).map((p) => (aoAbrir ? (
          <Pressable key={`${p.exercicioUid}-${p.bloco}`} accessibilityRole="button" accessibilityLabel={`Abrir: ${p.texto}`} onPress={() => aoAbrir(p)}
            style={(s) => [estilos.ponto, { backgroundColor: sobre(s) ? cores.sobre : 'transparent' }]}>
            <Texto variante="pequeno" cor={cores.texto}>{p.texto}</Texto>
          </Pressable>
        ) : <Texto key={`${p.exercicioUid}-${p.bloco}`} variante="pequeno" cor={cores.texto}>{p.texto}</Texto>))}
        {resto > 0 ? <Texto variante="pequeno" cor={cores.texto}>{`e mais ${resto}`}</Texto> : null}
      </View>
    </Alerta>
  );
}

function Detalhe({ resumo, coluna }: { resumo: ResumoDaSessaoPorContagem; coluna: boolean }) {
  const { cores, identificacao, variante } = useTema();
  const maior = Math.max(1, ...resumo.porGrupoMuscular.map((g) => g.seriesDeTrabalho));
  return (
    <View style={[estilos.bloco, coluna ? estilos.blocoEmColuna : null, { borderTopColor: cores.divisor }]}>
      <View style={estilos.parte}>
        <Texto variante="rotulo" cor="suave">Séries por tipo</Texto>
        {resumo.porTipo.length ? (
          <View style={estilos.tipos}>
            {resumo.porTipo.map((t) => {
              const chave = corDoTipoDeSerie(t.codigo, null);
              const cor = chave ? identificacao[chave].cor : null;
              const p = cor ? superficiePintada(cor, cores.superficie2, variante, cores) : null;
              return (
                <View key={t.codigo} style={[estilos.tipo, coluna ? estilos.tipoEmColuna : null, { borderColor: p?.borda ?? cores.divisor }, p ? fundoPintado(p) : { backgroundColor: cores.superficie2 }]}
                  accessible accessibilityLabel={`${t.nome || t.codigo}: ${t.quantidade}`}>
                  <View style={estilos.cabecaDoTipo}>
                    {cor ? <View style={[estilos.bolinha, { backgroundColor: cor, boxShadow: `0px 0px 10px ${cor}` }]} /> : null}
                    <Texto variante="pequeno" numberOfLines={1} style={estilos.flexivel}>{t.nome || t.codigo}</Texto>
                  </View>
                  <Texto numerico cor={p?.texto} style={estilos.numeroDoTipo}>{t.quantidade}</Texto>
                </View>
              );
            })}
          </View>
        ) : <Texto variante="suave">—</Texto>}
      </View>
      <View style={estilos.parte}>
        <Texto variante="rotulo" cor="suave">Séries de trabalho por grupo</Texto>
        {resumo.porGrupoMuscular.length ? (
          <View style={estilos.grupos}>
            {resumo.porGrupoMuscular.map((g) => (
              <View key={g.grupo} style={[estilos.grupo, coluna ? estilos.grupoEmColuna : null]} accessible accessibilityLabel={`${g.grupo}: ${g.seriesDeTrabalho}`}>
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
  );
}

const estilos = StyleSheet.create({
  resumo: { gap: espaco(1.5) },
  // Faixa: tipo e grupo lado a lado quando cabem, um embaixo do outro no celular. Coluna (320 px): sempre empilhados.
  bloco: { borderTopWidth: 1, paddingTop: espaco(1.5), flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3) },
  blocoEmColuna: { flexDirection: 'column', flexWrap: 'nowrap' },
  parte: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: espaco(1) },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  tipo: { flexGrow: 1, flexBasis: 100, minWidth: 90, borderWidth: 1, borderRadius: 12, paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), gap: 2 },
  // 2 × 2 na coluna: duas por linha, a ímpar estica.
  tipoEmColuna: { flexBasis: '40%', minWidth: 0 },
  cabecaDoTipo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  bolinha: { width: 7, height: 7, borderRadius: 4 },
  flexivel: { flexShrink: 1 },
  numeroDoTipo: { fontFamily: fontes.semi, fontSize: 22, lineHeight: 28 },
  grupos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1) },
  grupo: { flexGrow: 1, flexBasis: 220, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(1.25) },
  grupoEmColuna: { flexBasis: '100%' },
  nomeDoGrupo: { width: 96 },
  trilho: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
  valor: { fontFamily: fontes.semi, minWidth: 18, textAlign: 'right' },
  // Alvo de 44 px (WCAG 2.5.8 pede 24; o projeto usa 44); recuo negativo para o texto alinhar com o título do alerta.
  ponto: { minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: 8, paddingHorizontal: espaco(0.75), marginHorizontal: -espaco(0.75) },
});
