import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Platform, type TextInput, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE } from '../tema/tokens';
import { Campo } from './Campo';

/**
 * Campo de várias linhas que cresce com o texto, de `linhas` até `maximoDeLinhas` (depois rola), sem a alça de
 * redimensionar. Com 1 linha fica da altura de um campo de uma linha (44), para alinhar com o vizinho. Usado na mobilidade
 * (descrição e orientações) e na observação e modo de preparo da refeição (27/11).
 * shortcut: na web a altura é posta no `textarea` pelo DOM (o `Campo` não tem essa opção e o react-native-web não encolhe um
 * campo de várias linhas sozinho); no celular o campo nativo já cresce, sem o teto. Se mais telas pedirem, vira prop do `Campo`.
 */
export function CampoQueCresce({ linhas, maximoDeLinhas, valor, ...resto }: ComponentProps<typeof Campo> & { linhas: number; maximoDeLinhas: number }) {
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
