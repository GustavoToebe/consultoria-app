import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, type TextInput, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_EDITOR, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';

/** Limite das orientações (o `@Size(max = 2000)` de `receitas/ConteudoMobilidade` na API). */
const ORIENTACOES_MAXIMO = 2000;

/**
 * Orientações do plano ou do modelo de mobilidade (26/11): um campo normal, na largura de leitura, que nasce com 2 linhas e
 * cresce com o texto (até 2.000 caracteres). Antes ficavam recolhidas atrás de um "Orientações ⌄" com o começo do texto.
 */
export function OrientacoesDaMobilidade({ valor, aoMudar }: { valor: string; aoMudar: (orientacoes: string) => void }) {
  return (
    <View style={estilos.orientacoes}>
      <CampoQueCresce rotulo="Orientações (opcional)" valor={valor} linhas={2} maximoDeLinhas={12} maxLength={ORIENTACOES_MAXIMO}
        ajuda="O aluno lê antes das seções." aoMudar={aoMudar} />
    </View>
  );
}

/**
 * Topo do editor do modelo de mobilidade: um cartão só, "Sobre o modelo". Linha 1: Nome (~40%) e Descrição (~60%) lado a
 * lado, alinhados pelo topo (empilhados quando não cabem); a Descrição nasce com 1 linha, da altura do Nome, e cresce até 4.
 * Linha 2: as Orientações, na largura de leitura. Nome e descrição são da receita (o `EditorModelo` os guarda); as
 * orientações, do conteúdo.
 */
export function SobreOModelo({ nome, descricao, maximoDaDescricao, erroDoNome, orientacoes, aoMudarNome, aoMudarDescricao, aoMudarOrientacoes }: {
  nome: string;
  descricao: string;
  maximoDaDescricao: number;
  erroDoNome: string | null;
  orientacoes: string;
  aoMudarNome: (nome: string) => void;
  aoMudarDescricao: (descricao: string) => void;
  aoMudarOrientacoes: (orientacoes: string) => void;
}) {
  return (
    <Cartao titulo="Sobre o modelo">
      <View style={estilos.campos}>
        <View style={estilos.nome}>
          <Campo rotulo="Nome do modelo" valor={nome} aoMudar={aoMudarNome} maxLength={120} erro={erroDoNome} />
        </View>
        <View style={estilos.descricao}>
          <CampoQueCresce rotulo="Descrição (opcional)" valor={descricao} linhas={1} maximoDeLinhas={4} maxLength={maximoDaDescricao} aoMudar={aoMudarDescricao} />
        </View>
      </View>
      <OrientacoesDaMobilidade valor={orientacoes} aoMudar={aoMudarOrientacoes} />
    </Cartao>
  );
}

/**
 * Campo de várias linhas que cresce com o texto, de `linhas` até `maximoDeLinhas` (depois rola), sem a alça de
 * redimensionar. Com 1 linha fica da altura de um campo de uma linha (44), para alinhar com o vizinho.
 * shortcut: na web a altura é posta no `textarea` pelo DOM (o `Campo` não tem essa opção e o react-native-web não encolhe um
 * campo de várias linhas sozinho); no celular o campo nativo já cresce, sem o teto. Se mais telas pedirem, vira prop do `Campo`.
 */
function CampoQueCresce({ linhas, maximoDeLinhas, valor, ...resto }: ComponentProps<typeof Campo> & { linhas: number; maximoDeLinhas: number }) {
  const { fatorTexto } = useTema();
  const campo = useRef<TextInput>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = campo.current as unknown;
    if (Platform.OS !== 'web' || typeof HTMLTextAreaElement === 'undefined' || !(el instanceof HTMLTextAreaElement)) return;
    // As linhas pela altura de linha de verdade do campo (muda com o tamanho do texto), mais recuo e borda (caixa `border-box`).
    const cs = getComputedStyle(el);
    const px = (v: string) => parseFloat(v) || 0;
    const linha = px(cs.lineHeight) || px(cs.fontSize) * 1.25;
    const borda = px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    const extra = px(cs.paddingTop) + px(cs.paddingBottom) + borda;
    const minimo = Math.max(ALVO_TOQUE, linhas * linha + extra);
    const maximo = maximoDeLinhas * linha + extra;
    el.style.resize = 'none';
    // `auto` antes de medir: sem isso o `scrollHeight` nunca fica menor que a altura atual e o campo não encolhe.
    el.style.height = 'auto';
    const conteudo = el.scrollHeight + borda;
    el.style.height = `${Math.min(maximo, Math.max(minimo, conteudo))}px`;
    el.style.overflowY = conteudo > maximo + 1 ? 'auto' : 'hidden';
  }, [valor, largura, linhas, maximoDeLinhas, fatorTexto]);
  return (
    <View onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
      <Campo {...resto} ref={campo} valor={valor} linhas={linhas} />
    </View>
  );
}

const estilos = StyleSheet.create({
  orientacoes: { maxWidth: LARGURA_TEXTO_CORRIDO },
  // Tela larga (24/11): Nome e Descrição param no teto do nome do modelo de treino (`NomeDoModeloDeTreino`), sem esticar.
  campos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(2), maxWidth: LARGURA_EDITOR },
  // 40% e 60% da linha (o vão sai das duas); abaixo de ~600 px de cartão a Descrição desce para baixo do Nome.
  nome: { flexGrow: 2, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  descricao: { flexGrow: 3, flexShrink: 1, flexBasis: 330, minWidth: 0 },
});
