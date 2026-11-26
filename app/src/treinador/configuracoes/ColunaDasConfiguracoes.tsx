import { router, usePathname, type Href } from 'expo-router';
import { ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { abreDentro, buscarCartoes, destinoNaColuna, gruposDeCartoes, type CartaoDeConfiguracao } from '../../dominio/configuracoes';
import { mesmaTela } from '../../dominio/mesmaTela';
import { itemDoCaminho } from '../../dominio/rotasDasConfiguracoes';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { BuscaDasConfiguracoes } from './BuscaDasConfiguracoes';
import { nadaEncontrado, useCartoesDoPerfil } from './comum';
import { iconeDaConfiguracao } from './icones';

/** Coluna da esquerda: larga o bastante para os títulos mais longos em até duas linhas. */
export const LARGURA_DA_COLUNA = 300;

/**
 * Coluna da esquerda de Configurações no PC (4.10, a partir de 1024 px de janela): `nav` "Configurações" com a busca no topo
 * e os grupos como subtítulos, um item por linha (ícone e título; a descrição vai no `title`, que é a dica do mouse e a
 * descrição acessível). Fica no layout da rota aninhada: trocar de item não remonta a coluna nem a busca. Ela não rola com o
 * item, porque cada um tem a rolagem própria da `Tela`; a lista dos grupos rola por dentro quando não cabe na altura.
 */
export function ColunaDasConfiguracoes() {
  const { cores } = useTema();
  const caminho = usePathname();
  const visiveis = useCartoesDoPerfil();
  const [busca, setBusca] = useState('');
  const campo = useRef<TextInput>(null);
  const achados = buscarCartoes(busca, visiveis);
  const grupos = gruposDeCartoes(achados);
  const aberto = itemDoCaminho(caminho);
  return (
    <SafeAreaView edges={['top']} style={[estilos.coluna, { borderRightColor: cores.divisor }]}>
      <View role="navigation" aria-label="Configurações" style={estilos.nav}>
        <View style={estilos.topo}>
          {/* O nome da área à vista; o leitor de tela já o ouve no nome da navegação. O h1 é o do item à direita. */}
          <Texto variante="bloco" aria-hidden>Configurações</Texto>
          <BuscaDasConfiguracoes valor={busca} aoMudar={setBusca} achados={achados.length} campo={campo} />
        </View>
        <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.lista}>
          {grupos.length === 0 ? (
            <View style={estilos.vazio}>
              <Texto>{nadaEncontrado(busca)}</Texto>
              <Texto variante="suave">Tente outra palavra, como “senha”, “logo” ou “cobrança”.</Texto>
              <View style={estilos.acaoDoVazio}>
                <Botao rotulo="Limpar busca" tipo="secundario" aoTocar={() => { setBusca(''); campo.current?.focus(); }} />
              </View>
            </View>
          ) : grupos.map(({ grupo, cartoes }) => (
            // Como os grupos do menu lateral: `group` com o nome; o subtítulo à vista não é título (o h1 vem depois, à direita).
            <View key={grupo} role="group" aria-label={grupo} style={estilos.grupo}>
              <Texto variante="secao" aria-hidden style={estilos.subtitulo}>{grupo}</Texto>
              {cartoes.map((c) => <ItemDaColuna key={c.id} cartao={c} aberto={c.id === aberto} Icone={iconeDaConfiguracao(c.id)} />)}
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/**
 * Item no padrão do item ativo do menu lateral (`ui/Navegacao`): realce `superficie2`, barrinha `marcaPeca` de 3 × 16 à
 * esquerda, texto principal em semi; os outros em `textoSuave` médio. Cada escolha empilha no histórico (`router.push`), para
 * o voltar do navegador voltar ao item anterior; a guarda de saída pergunta antes de largar uma alteração.
 */
function ItemDaColuna({ cartao, aberto, Icone }: { cartao: CartaoDeConfiguracao; aberto: boolean; Icone: LucideIcon }) {
  const { cores, marcaPeca } = useTema();
  const caminho = usePathname();
  const { confirmar } = useSaidaGuardada();
  const no = useRef<View>(null);
  const fora = !abreDentro(cartao);
  const destino = destinoNaColuna(cartao) as Href;
  const cor = aberto ? cores.texto : cores.textoSuave;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = no.current as unknown as HTMLElement | null;
    // O react-native-web não repassa `title`: a descrição entra direto no `<a>` (dica do mouse e descrição acessível).
    el?.setAttribute?.('title', cartao.descricao);
    // Aberto por link direto no fim da lista: o item fica à vista na coluna.
    if (aberto) el?.scrollIntoView?.({ block: 'nearest' });
  }, [cartao.descricao, aberto]);
  return (
    <Pressable
      ref={no}
      accessibilityRole="link"
      accessibilityLabel={fora ? `${cartao.titulo}, abre a tela inteira` : cartao.titulo}
      accessibilityHint={Platform.OS === 'web' ? undefined : cartao.descricao}
      accessibilityState={{ selected: aberto }}
      aria-current={aberto ? 'page' : undefined}
      {...propsDeLink(destino, () => { if (!mesmaTela(caminho, String(destino))) confirmar(() => router.push(destino)); })}
      style={(estado) => [estilos.item, (aberto || sobre(estado)) && { backgroundColor: cores.superficie2 }]}>
      {aberto ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      <Icone size={20} color={cor} strokeWidth={2} />
      <Texto numberOfLines={2} style={[estilos.rotulo, { color: cor, fontFamily: aberto ? fontes.semi : fontes.medio }]}>{cartao.titulo}</Texto>
      {fora ? <View aria-hidden style={estilos.fora}><ArrowUpRight size={16} color={cores.textoSuave} strokeWidth={2} /></View> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  coluna: { width: LARGURA_DA_COLUNA, borderRightWidth: 1 },
  nav: { flex: 1, minHeight: 0 },
  topo: { gap: espaco(2), paddingHorizontal: espaco(2), paddingTop: espaco(2), paddingBottom: espaco(1) },
  rolagem: { flex: 1 },
  lista: { gap: espaco(2), paddingHorizontal: espaco(1), paddingBottom: espaco(3) },
  grupo: { gap: 2 },
  // 14 semi como o título de grupo do menu, sem caixa alta; o espaço de cima é o do `gap` da lista.
  subtitulo: { textTransform: 'none', letterSpacing: 0, fontSize: 14, lineHeight: 20, paddingHorizontal: espaco(1.5), paddingTop: espaco(1), paddingBottom: espaco(0.5) },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), borderRadius: RAIO_CONTROLE,
  },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  rotulo: { flex: 1, fontSize: 15, lineHeight: 20 },
  fora: { marginLeft: 'auto' },
  vazio: { gap: espaco(1), paddingHorizontal: espaco(1), paddingTop: espaco(1) },
  acaoDoVazio: { flexDirection: 'row' },
});
