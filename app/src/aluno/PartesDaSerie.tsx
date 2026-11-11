import { Check, Medal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { partesDaDica } from '../dominio/dicaDeCarga';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { SeloComExplicacao } from './SeloComExplicacao';
import type { SeloDaSerie } from './serieDoAluno';
import { TipoDaSerieComExplicacao } from './TipoDaSerieComExplicacao';

/**
 * Peças do cartão da série no aluno (A8 e A9 da reunião de 30/10), comuns à série simples e à série com etapas. A ordem
 * do cartão é sempre: título ("Série 3 · Back off"), Meta em destaque, observação e técnica, Último registro, Hoje (o que o
 * aluno digita) e, embaixo do peso, de onde saiu o peso sugerido.
 */

/**
 * "Série 3 · Back off" (o tipo é o toque da explicação), o selo da técnica e, só na série já registrada, o selo "Feita" ou
 * "Não feita" (série sem registro não tem selo). Com recorde, a medalha e o selo "Recorde" (verde: é um fato concluído).
 * "Feita" só é verde na série que a pessoa acabou de marcar (`agora`); a que já estava feita leva o selo neutro.
 */
export function CabecalhoDaSerie({ numero, tipo, tecnica, recordes, registro, agora = false }: {
  numero: number;
  tipo: SeloDaSerie | null;
  tecnica: SeloDaSerie | null;
  recordes?: Recorde[] | null;
  /** Só a série registrada tem selo (auditoria 03/11): sem registro, os campos já dizem que está vazia. */
  registro: 'FEITA' | 'NAO_FEITA' | null;
  /** Marcada agora, com a tela aberta (`useMarcadoAgora`). */
  agora?: boolean;
}) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const comRecorde = !!recordes?.length;
  return (
    <View style={estilos.cabeca}>
      <View style={estilos.titulo}>
        {comRecorde ? (
          <View accessible accessibilityRole="text" accessibilityLabel={`Série ${numero}, recorde pessoal: ${recordes!.map((r) => textoDoRecorde(r, unidade)).join('; ')}`}>
            <Medal size={20} color={cores.sucesso} />
          </View>
        ) : null}
        <Texto variante="bloco" nivel={3}>{`Série ${numero}`}</Texto>
        {tipo ? (
          <>
            <Texto variante="bloco" accessibilityElementsHidden importantForAccessibility="no">·</Texto>
            <TipoDaSerieComExplicacao nome={tipo.nome} explicacao={tipo.explicacao} numero={numero} cor={tipo.cor} />
          </>
        ) : null}
      </View>
      {tecnica ? <SeloComExplicacao nome={tecnica.nome} explicacao={tecnica.explicacao} rotuloAcessivel={`Explicação de ${tecnica.nome}, série ${numero}`} /> : null}
      {comRecorde ? <Selo texto="Recorde" tipo="sucesso" /> : null}
      {registro === 'FEITA' ? <Selo texto="Feita" tipo={agora ? 'sucesso' : 'neutro'} Icone={Check} /> : null}
      {registro === 'NAO_FEITA' ? <Selo texto="Não feita" tipo="neutro" /> : null}
    </View>
  );
}

/** Largura da barra lateral do cartão da série com a cor do tipo (Frente G, D10: barra de 6 px + selo colorido). */
export const LARGURA_DA_BARRA_DO_TIPO = 6;

/**
 * A barra lateral do cartão da série na cor de identificação do tipo (`useTema().identificacao[chave].cor`); sem cor, nada
 * (a borda de sempre). A cor nunca é a única informação: o selo com o nome do tipo continua (D7).
 */
export function barraDoTipo(cor: string | null): { borderLeftWidth: number; borderLeftColor: string } | null {
  return cor ? { borderLeftWidth: LARGURA_DA_BARRA_DO_TIPO, borderLeftColor: cor } : null;
}

/** A meta do treinador em destaque: rótulo "Meta" e o texto maior, na cor do texto, numa faixa própria. */
export function MetaDaSerie({ texto, complemento }: { texto: string; complemento?: string | null }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.meta, { backgroundColor: cores.superficie3, borderLeftColor: cores.bordaCampo }]} accessible accessibilityLabel={`Meta: ${texto}${complemento ? `. ${complemento}` : ''}`}>
      <Texto variante="secao">Meta</Texto>
      <Texto numerico variante="bloco" cor={cores.texto}>{texto}</Texto>
      {complemento ? <Texto numerico variante="pequeno">{complemento}</Texto> : null}
    </View>
  );
}

/**
 * A meta ao lado do campo de carga (D5, 02/11): rótulo "Meta", as repetições grandes ("3 a 6 reps") e, menores, o resto
 * da prescrição e o descanso. Mesmo visual da `MetaDaSerie` (faixa `superficie3` com borda à esquerda), mas compacta, para
 * caber na linha do peso e das repetições.
 */
export function MetaAoLado({ repeticoes, resto, descanso, numero }: { repeticoes: string; resto: string | null; descanso: string | null; numero: number }) {
  const { cores } = useTema();
  const complemento = [resto, descanso].filter(Boolean).join(' · ');
  return (
    <View
      style={[estilos.metaAoLado, { backgroundColor: cores.superficie3, borderLeftColor: cores.bordaCampo }]}
      accessible
      accessibilityLabel={`Meta da série ${numero}: ${repeticoes}${complemento ? `. ${complemento}` : ''}`}>
      <Texto variante="secao">Meta</Texto>
      <Texto numerico style={estilos.repsDaMeta} cor={cores.texto}>{repeticoes}</Texto>
      {complemento ? <Texto numerico variante="pequeno">{complemento}</Texto> : null}
    </View>
  );
}

/**
 * A dica ao lado do campo (D1, 02/11): "Sugestão: 60 kg · Última vez: 60 kg × 7" (ou "Primeira vez: escolha a carga") e,
 * menor, de onde saiu a sugestão. Só texto: a carga nunca vai para o campo sem o aluno escolher. `de` = "o bloco 2 da
 * série 3" na etapa (Frente G, D17: mesma dica, ao lado do campo de peso da etapa).
 */
export function DicaDoCampo({ dica, origem, numero, de }: { dica: string; origem: string | null; numero: number; de?: string }) {
  const { cores } = useTema();
  const { destaque, resto } = partesDaDica(dica);
  return (
    <View style={estilos.dica} accessible accessibilityLabel={`Dica ${de ? `d${de}` : `da série ${numero}`}: ${dica}${origem ? `. ${origem}` : ''}`}>
      <Texto numerico variante="suave">
        {destaque ? <Texto numerico variante="suave" style={estilos.textoDaDica} cor={cores.texto}>{destaque}</Texto> : null}
        {destaque && resto ? ' · ' : null}
        {resto}
      </Texto>
      {origem ? <Texto numerico variante="pequeno">{origem}</Texto> : null}
    </View>
  );
}

/** "Último registro 60 kg × 8": a mesma série da última vez ("—" = não casou com nenhuma ou não foi feita). */
export function LinhaDoUltimoRegistro({ texto, numero }: { texto: string; numero: number }) {
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`Série ${numero} da última vez: ${texto === '—' ? 'sem registro' : texto}`}>
      <Texto variante="pequeno" style={estilos.rotuloDaLinha}>Último registro</Texto>
      <Texto numerico variante="pequeno">{texto}</Texto>
    </View>
  );
}

/** Rótulo da área do que o aluno faz hoje (peso, repetições e o ✓). */
export function RotuloDeHoje() {
  return <Texto variante="secao" nivel={3} style={estilos.hoje}>Hoje</Texto>;
}

const estilos = StyleSheet.create({
  cabeca: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: espaco(1), rowGap: espaco(0.5) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1 },
  meta: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25), gap: 2 },
  linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.75), flexWrap: 'wrap' },
  rotuloDaLinha: { fontFamily: fontes.semi },
  hoje: { marginTop: espaco(0.5) },
  metaAoLado: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(0.75), paddingHorizontal: espaco(1), gap: 2, justifyContent: 'center', minHeight: 52 },
  repsDaMeta: { fontFamily: fontes.semi, fontSize: 20, lineHeight: 26 },
  dica: { gap: 2 },
  textoDaDica: { fontFamily: fontes.semi },
});
