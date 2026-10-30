import { router, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { propsDeLink } from './propsDeLink';
import { Selo, type TipoSelo } from './Selo';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  titulo: string;
  /** Linha `suave` abaixo do título (data, resumo). */
  detalhe?: string;
  Icone?: LucideIcon;
  /** `Icone` opcional: o selo vira a pílula com ícone ("Pronta", "Atrasada"), como na lista de alunos. */
  selo?: { texto: string; tipo: TipoSelo; Icone?: LucideIcon };
  /** Abre esta rota (o item é um link; na web é um `<a href>`, que abre em nova guia pelo botão direito). */
  href?: Href;
  /** Ou executa esta ação (o item é um botão). Com `href`, é a navegação do clique simples (ex.: passa pela guarda). */
  aoTocar?: () => void;
  /** Rótulo completo para o leitor de tela; padrão "título, detalhe, selo". */
  rotulo?: string;
  /** Conteúdo à direita no lugar da seta (ícone de ação, por exemplo). */
  direita?: ReactNode;
  /** Vermelho (sair, excluir), sem seta. */
  perigo?: boolean;
  children?: ReactNode;
}

/**
 * Item em que o cartão inteiro é o toque: título, detalhe, selo e a seta à direita (atalhos do perfil, início, financeiro,
 * área do aluno, folhas de ações; nada de link de texto solto dentro de cartão). Listas de registros (alunos,
 * atualizações, modelos, biblioteca) usam `ui/LinhaDaLista`.
 */
export function ItemDeLista({ titulo, detalhe, Icone, selo, href, aoTocar, rotulo, direita, perigo, children }: Props) {
  const { cores } = useTema();
  const abrir = () => {
    if (aoTocar) aoTocar();
    else if (href) router.navigate(href);
  };
  const corTexto = perigo ? cores.perigo : cores.texto;
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={rotulo ?? [titulo, detalhe, selo?.texto].filter(Boolean).join(', ')}
      {...(href ? propsDeLink(href, abrir) : { onPress: abrir })}
      style={(estado) => [estilos.item, { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda }]}>
      {Icone ? <Icone size={20} color={perigo ? cores.perigo : cores.textoSuave} strokeWidth={2} /> : null}
      <View style={estilos.textos}>
        <Texto style={[estilos.titulo, { color: corTexto }]}>{titulo}</Texto>
        {detalhe ? <Texto variante="suave" numerico>{detalhe}</Texto> : null}
        {children}
      </View>
      {selo ? <Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} /> : null}
      {direita ?? (perigo ? null : <ChevronRight size={20} color={cores.textoSuave} />)}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  item: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE + espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    paddingVertical: espaco(1.25),
    paddingHorizontal: espaco(1.5),
  },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.semi },
});
