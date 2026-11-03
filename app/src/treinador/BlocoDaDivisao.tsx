import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { corDaLetra } from '../dominio/historicoDoAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LINHA_DA_FAIXA, RAIO, type CorDeIdentificacao } from '../tema/tokens';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

/** Barra lateral da divisão (a mesma largura da do tipo de série e da refeição). */
const BARRA_DA_DIVISAO = 6;

/** Cor da divisão pela letra (A azul, B magenta, C ciano…); sem letra, sem cor. */
export function useCorDaDivisao(letra: string | null): CorDeIdentificacao | null {
  const { identificacao } = useTema();
  return letra ? identificacao[corDaLetra(letra)] : null;
}

/** A letra da divisão numa caixa de 32 px, na cor dela. Decorativa: o título da divisão já diz qual é. */
export function LetraDaDivisao({ letra, tamanho = 32 }: { letra: string | null; tamanho?: number }) {
  const { cores } = useTema();
  const cor = useCorDaDivisao(letra);
  if (!letra) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        estilos.letra,
        { width: tamanho, height: tamanho, borderColor: cor?.cor ?? cores.bordaCampo, backgroundColor: cor?.fundo ?? cores.superficie },
      ]}>
      <Texto cor={cor?.cor ?? cores.texto} style={[estilos.textoDaLetra, tamanho < 28 ? estilos.letraPequena : null]}>{letra}</Texto>
    </View>
  );
}

interface Props {
  letra: string | null;
  titulo: string;
  /** O dia da semana pequeno em cima do título ("Quarta"), quando o nome da divisão o traz. */
  dia?: string | null;
  resumo?: string;
  /** Com `aoAlternar` a faixa vira botão que recolhe e abre. */
  aberto?: boolean;
  aoAlternar?: () => void;
  children?: ReactNode;
}

/**
 * Divisão do Histórico (Frente G, D13): um bloco com a barra lateral, a letra e a faixa tingidas na cor da divisão, e os
 * exercícios dentro. Usado nas "Cargas por divisão" e nos dias da visão por semana. A cor só identifica a divisão; as
 * séries dentro ficam em texto, sem a cor por tipo.
 */
export function BlocoDaDivisao({ letra, titulo, dia, resumo, aberto = true, aoAlternar, children }: Props) {
  const { cores, bordas } = useTema();
  const cor = useCorDaDivisao(letra);
  const comConteudo = aberto && !!children;
  const Seta = aberto ? ChevronUp : ChevronDown;
  const textos = (
    <>
      <LetraDaDivisao letra={letra} />
      <View style={estilos.textos}>
        {dia ? <Texto variante="pequeno" style={estilos.dia}>{dia}</Texto> : null}
        <Texto variante="bloco" style={estilos.titulo}>{titulo}</Texto>
        {resumo ? <Texto variante="suave" numerico>{resumo}</Texto> : null}
      </View>
    </>
  );
  const fundoDaFaixa = cor?.fundo ?? cores.superficie3;
  const linhaDaFaixa = comConteudo ? { borderBottomWidth: LINHA_DA_FAIXA, borderBottomColor: cor?.cor ?? cores.bordaCampo } : null;
  // "Treino A" só entra no nome lido quando o título ainda não o diz ("Treino A - Peito" não repete).
  const jaDiz = !!letra && new RegExp(`^(treino|divis[aã]o)\\s+${letra}(?![a-z])`, 'i').test(titulo);
  const nome = [letra && !jaDiz ? `Treino ${letra}` : null, dia ? `${dia} - ${titulo}` : titulo, resumo].filter(Boolean).join(', ');
  return (
    <View
      testID={letra ? `divisao-${letra}` : undefined}
      style={[
        estilos.bloco,
        { borderWidth: bordas.bloco, borderColor: cores.borda, backgroundColor: cores.superficie },
        cor ? { borderLeftWidth: BARRA_DA_DIVISAO, borderLeftColor: cor.cor } : null,
      ]}>
      {aoAlternar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nome}, ${aberto ? 'aberta' : 'recolhida'}`}
          accessibilityState={{ expanded: aberto }}
          onPress={aoAlternar}
          style={(estado) => [estilos.faixa, { backgroundColor: sobre(estado) ? cores.superficie3 : fundoDaFaixa }, linhaDaFaixa]}>
          {textos}
          <Seta size={20} color={cores.textoSuave} />
        </Pressable>
      ) : (
        <View accessible accessibilityRole="header" accessibilityLabel={nome} style={[estilos.faixa, { backgroundColor: fundoDaFaixa }, linhaDaFaixa]}>
          {textos}
        </View>
      )}
      {comConteudo ? <View style={estilos.conteudo}>{children}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderRadius: RAIO, overflow: 'hidden' },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingVertical: espaco(1.25), paddingHorizontal: espaco(1.5) },
  textos: { flex: 1, minWidth: 0, gap: 1 },
  dia: { fontFamily: fontes.semi, textTransform: 'uppercase', letterSpacing: 0.6 },
  titulo: { fontSize: 16, lineHeight: 21 },
  conteudo: { padding: espaco(1), gap: espaco(1) },
  letra: { borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textoDaLetra: { fontFamily: fontes.negrito, fontSize: 15, lineHeight: 18 },
  letraPequena: { fontSize: 11, lineHeight: 14 },
});
