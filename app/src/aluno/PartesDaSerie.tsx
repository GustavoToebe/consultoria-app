import { Medal } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { numeroParaTela } from '../dominio/formatos';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
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
 * "Série 3 · Back off" (o tipo é o toque da explicação), o selo da técnica e, enquanto a série não foi marcada, o selo
 * neutro "Ainda não registrado". Com recorde, a medalha e o selo "Recorde" (verde: é um fato concluído).
 */
export function CabecalhoDaSerie({ numero, tipo, tecnica, recordes, naoRegistrada }: {
  numero: number;
  tipo: SeloDaSerie | null;
  tecnica: SeloDaSerie | null;
  recordes?: Recorde[] | null;
  naoRegistrada: boolean;
}) {
  const { cores } = useTema();
  const comRecorde = !!recordes?.length;
  return (
    <View style={estilos.cabeca}>
      <View style={estilos.titulo}>
        {comRecorde ? (
          <View accessible accessibilityRole="text" accessibilityLabel={`Série ${numero}, recorde pessoal: ${recordes!.map(textoDoRecorde).join('; ')}`}>
            <Medal size={20} color={cores.sucesso} />
          </View>
        ) : null}
        <Texto style={estilos.nome} nivel={3}>{`Série ${numero}`}</Texto>
        {tipo ? (
          <>
            <Texto style={estilos.nome} accessibilityElementsHidden importantForAccessibility="no">·</Texto>
            <TipoDaSerieComExplicacao nome={tipo.nome} explicacao={tipo.explicacao} numero={numero} />
          </>
        ) : null}
      </View>
      {tecnica ? <SeloComExplicacao nome={tecnica.nome} explicacao={tecnica.explicacao} rotuloAcessivel={`Explicação de ${tecnica.nome}, série ${numero}`} /> : null}
      {comRecorde ? <Selo texto="Recorde" tipo="sucesso" /> : null}
      {naoRegistrada ? <Selo texto="Ainda não registrado" tipo="neutro" /> : null}
    </View>
  );
}

/** A meta do treinador em destaque: rótulo "Meta" e o texto maior, na cor do texto, numa faixa própria. */
export function MetaDaSerie({ texto, complemento }: { texto: string; complemento?: string | null }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.meta, { backgroundColor: cores.superficie3, borderLeftColor: cores.bordaCampo }]} accessible accessibilityLabel={`Meta: ${texto}${complemento ? `. ${complemento}` : ''}`}>
      <Texto variante="secao">Meta</Texto>
      <Texto numerico style={estilos.valorDaMeta} cor={cores.texto}>{texto}</Texto>
      {complemento ? <Texto numerico variante="pequeno">{complemento}</Texto> : null}
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

/** "Sugerido: 33,5 kg · 80% da WS registrada nesta sessão": o peso sugerido e de onde ele saiu (só a frase; a conta é do domínio). */
export function LinhaDaSugestao({ sugestao, origem }: { sugestao: number; origem: string | null }) {
  return (
    <Texto numerico variante="pequeno">
      <Texto numerico variante="pequeno" style={estilos.rotuloDaLinha}>Sugerido: </Texto>
      {`${numeroParaTela(sugestao)} kg`}
      {origem ? ` · ${origem}` : ''}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  cabeca: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: espaco(1), rowGap: espaco(0.5) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1 },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
  meta: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25), gap: 2 },
  valorDaMeta: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.75), flexWrap: 'wrap' },
  rotuloDaLinha: { fontFamily: fontes.semi },
  hoje: { marginTop: espaco(0.5) },
});
