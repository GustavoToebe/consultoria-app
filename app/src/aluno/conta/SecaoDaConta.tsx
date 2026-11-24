import { router, usePathname, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { mesmaTela } from '../../dominio/mesmaTela';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Cartao } from '../../ui/Cartao';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** Ponto de rolagem de cada seção (o índice da web rola até ele). */
export const alvoDaSecao = (chave: string) => `conta-${chave}`;

/** Recuo interno do cartão, o mesmo do `Cartao` (16 no celular, 20 no PC): linhas e blocos ficam na mesma borda. */
export function useRecuoDaConta() {
  const { width } = useWindowDimensions();
  return espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2);
}

/**
 * Seção da Conta no estilo lista de ajustes (23/11): título pequeno em caixa alta fora do cartão (h2; o texto fica em caixa
 * normal e a variante `secao` sobe as letras) e um cartão com as linhas, separadas por um fio `divisor` de ponta a ponta.
 * Peça local de propósito: o `ItemDeLista` é um cartão por item e não agrupa (sugestão para o design system se outra tela
 * precisar).
 */
export function SecaoDaConta({ chave, titulo, children }: { chave: string; titulo: string; children: ReactNode }) {
  const { cores, bordas } = useTema();
  return (
    <AlvoDeRolagem chave={alvoDaSecao(chave)}>
      <View style={estilos.secao} testID={`secao-${chave}`}>
        <Texto variante="secao" nivel={2} style={estilos.titulo}>{titulo}</Texto>
        <Cartao style={estilos.cartao}>
          {Children.toArray(children).map((filho, i) => (
            <View key={i} style={i === 0 ? null : { borderTopWidth: bordas.item, borderTopColor: cores.divisor }}>{filho}</View>
          ))}
        </Cartao>
      </View>
    </AlvoDeRolagem>
  );
}

/** Bloco livre dentro da seção (Meu plano, convite, uso das fotos), com o recuo das linhas. */
export function BlocoDaConta({ children }: { children: ReactNode }) {
  const recuo = useRecuoDaConta();
  return <View style={[estilos.bloco, { padding: recuo }]}>{children}</View>;
}

interface PropsDaLinha {
  titulo: string;
  /** Resumo em `textoSuave` embaixo do título. */
  resumo?: string;
  Icone?: LucideIcon;
  /** No lugar do ícone (a prévia mini do perfil). */
  antes?: ReactNode;
  /** Abre um detalhe (folha): a linha inteira é o botão e ganha o ›. */
  aoTocar?: () => void;
  /** Abre outra tela: a linha inteira é o link (na web, `<a href>`), com o ›. */
  href?: Href;
  /** Nome para o leitor de tela; padrão "título, resumo". */
  rotulo?: string;
  /** Sem o › (ação que não abre detalhe, como "Sair"). */
  semSeta?: boolean;
  /** Controles à direita, numa linha que não é tocável (interruptor, "Sincronizar agora"). */
  direita?: ReactNode;
  /** Texto de apoio ou controles embaixo, na largura dos textos. */
  children?: ReactNode;
}

/**
 * Uma linha da seção: ícone, título, resumo e o › quando abre um detalhe. Com `aoTocar` ou `href` a linha inteira é o toque
 * (e não leva controle dentro: nada de botão dentro de botão); sem eles, os controles vão em `direita` e em `children`.
 */
export function LinhaDaConta({ titulo, resumo, Icone, antes, aoTocar, href, rotulo, semSeta, direita, children }: PropsDaLinha) {
  const { cores } = useTema();
  const recuo = useRecuoDaConta();
  const caminho = usePathname();
  const { confirmar } = useSaidaGuardada();
  const tocavel = !!aoTocar || !!href;
  const corpo = (
    <>
      {antes ?? (Icone ? <View style={estilos.icone}><Icone size={20} color={cores.textoSuave} strokeWidth={2} /></View> : null)}
      <View style={estilos.textos}>
        <Texto style={[estilos.tituloDaLinha, { color: cores.texto }]}>{titulo}</Texto>
        {resumo ? <Texto variante="suave">{resumo}</Texto> : null}
        {children}
      </View>
      {direita ? <View style={estilos.direita}>{direita}</View> : null}
      {tocavel && !semSeta ? <ChevronRight size={20} color={cores.textoSuave} /> : null}
    </>
  );
  if (!tocavel) return <View style={[estilos.linha, estilos.linhaComControles, { paddingHorizontal: recuo }]}>{corpo}</View>;
  // A mesma navegação do `ItemDeLista`: passa pela guarda de saída e não sai para a mesma tela.
  const abrir = () => {
    if (!href) aoTocar?.();
    else if (!mesmaTela(caminho, href)) confirmar(() => router.navigate(href));
  };
  return (
    <Pressable accessibilityRole={href ? 'link' : 'button'} accessibilityLabel={rotulo ?? [titulo, resumo].filter(Boolean).join(', ')}
      {...(href ? propsDeLink(href, abrir) : { onPress: abrir })}
      style={(estado) => [estilos.linha, { paddingHorizontal: recuo, backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
      {corpo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1) },
  titulo: { paddingHorizontal: espaco(0.5) },
  cartao: { padding: 0, gap: 0, overflow: 'hidden' },
  bloco: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(2), paddingVertical: espaco(1.5) },
  // Controles à direita quebram para baixo quando não cabem (390 px com texto grande).
  linhaComControles: { flexWrap: 'wrap' },
  icone: { width: 24, alignItems: 'center' },
  textos: { flex: 1, minWidth: 160, gap: 2 },
  tituloDaLinha: { fontFamily: fontes.semi },
  direita: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1), marginLeft: 'auto' },
});
