import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Platform, type TextInput, View } from 'react-native';

import { nomeSemQuebra } from '../../dominio/complementosDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';

/** Sem a alça de redimensionar do textarea (o preflight da web põe `resize: vertical`): o campo já cresce sozinho. */
const SEM_ALCA = 'resize-none';

/** Medidas do textarea na web, em px: altura do texto (`scrollHeight` com `height: auto`), linha, recuos e bordas. */
export interface MedidasDoCampo {
  conteudo: number;
  linha: number;
  recuoDeCima: number;
  recuoDeBaixo: number;
  borda: number;
}

/**
 * Altura do campo pelo texto de verdade (26/11): de uma linha (o alvo de toque, 44) até `maximoDeLinhas`. Passou do
 * teto, a altura para em linhas inteiras e sem o recuo de baixo, para não aparecer o começo da linha seguinte (o texto
 * que rola pinta dentro do recuo); o resto rola dentro do campo.
 */
export function alturaDoCampo(m: MedidasDoCampo, maximoDeLinhas: number): { altura: number; rola: boolean } {
  const inteira = m.conteudo + m.borda;
  const teto = maximoDeLinhas * m.linha + m.recuoDeCima + m.recuoDeBaixo + m.borda;
  if (inteira > teto + 1) return { altura: maximoDeLinhas * m.linha + m.recuoDeCima + m.borda, rola: true };
  return { altura: Math.max(ALVO_TOQUE, inteira), rola: false };
}

function ajustarAltura(el: HTMLTextAreaElement, maximoDeLinhas: number): void {
  const cs = getComputedStyle(el);
  const px = (v: string) => parseFloat(v) || 0;
  // `auto` antes de medir: sem isso o `scrollHeight` nunca fica menor que a altura atual e o campo não encolhe.
  el.style.height = 'auto';
  const { altura, rola } = alturaDoCampo({
    conteudo: el.scrollHeight,
    linha: px(cs.lineHeight) || px(cs.fontSize) * 1.25,
    recuoDeCima: px(cs.paddingTop),
    recuoDeBaixo: px(cs.paddingBottom),
    borda: px(cs.borderTopWidth) + px(cs.borderBottomWidth),
  }, maximoDeLinhas);
  el.style.height = `${altura}px`;
  el.style.overflowY = rola ? 'auto' : 'hidden';
}

/** Linha do campo no celular: o `leading-5` do `Input` (20 px, não muda com o tamanho do texto). */
const LINHA_NO_CELULAR = 20;

/**
 * Fora da web (sem DOM para medir): altura do campo pelo `contentSize` que o `TextInput` informa (texto sem recuos).
 * Mesma regra da web (`alturaDoCampo`): de uma linha (44) até o teto, e acima dele para em linhas inteiras e rola.
 */
export function alturaNoCelular(conteudo: number, maximoDeLinhas: number): number {
  const recuo = espaco(1);
  return alturaDoCampo({ conteudo: conteudo + 2 * recuo, linha: LINHA_NO_CELULAR, recuoDeCima: recuo, recuoDeBaixo: recuo, borda: 2 }, maximoDeLinhas).altura;
}

/**
 * Campo de uma célula das tabelas dos Complementos (Suplementação e Outros, 26/11): cresce sozinho com o texto, de uma
 * linha (44, alinhado ao vizinho de uma linha) até `maximoDeLinhas` (2 na Suplementação, a regra do documento de
 * design; Outros passa mais), sem a alça de redimensionar e sem gravar quebra pelo Enter. Sempre textarea: trocar de
 * input para textarea no meio da digitação perderia o foco. Por padrão o rótulo fica no cabeçalho da tabela (o leitor de
 * tela lê `rotuloAcessivel`); Outros passa `rotuloOculto={false}` e mostra o rótulo.
 * Na web a altura é medida no `textarea` (a mesma técnica do `CampoQueCresce` da mobilidade); no celular, pelo
 * `onContentSizeChange` do `TextInput` (`alturaNoCelular`, mesmo teto). A estimativa por caractere deu uma linha a mais
 * nas colunas estreitas ("Pré-treino" em 104 px).
 */
export function CampoDaTabela({ valor, aoMudar, rotuloOculto = true, maximoDeLinhas = 2, ...resto }: Omit<ComponentProps<typeof Campo>, 'linhas' | 'ref'> & { maximoDeLinhas?: number }) {
  const { fatorTexto } = useTema();
  const campo = useRef<TextInput>(null);
  const [largura, setLargura] = useState(0);
  const [conteudo, setConteudo] = useState<number | null>(null);
  const web = Platform.OS === 'web';
  useEffect(() => {
    const el = campo.current as unknown;
    if (typeof HTMLTextAreaElement === 'undefined' || !(el instanceof HTMLTextAreaElement)) return;
    ajustarAltura(el, maximoDeLinhas);
    // A fonte da web pode chegar depois da primeira medida (a de reserva quebra em outro ponto): mede de novo.
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo) ajustarAltura(el, maximoDeLinhas); });
    return () => { vivo = false; };
  }, [valor, largura, maximoDeLinhas, fatorTexto]);
  return (
    <View onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
      <Campo {...resto} ref={campo} rotuloOculto={rotuloOculto} valor={valor}
        linhas={1} className={SEM_ALCA} altura={web || conteudo === null ? undefined : alturaNoCelular(conteudo, maximoDeLinhas)}
        onContentSizeChange={web ? undefined : (e) => setConteudo(Math.ceil(e.nativeEvent.contentSize.height))}
        blurOnSubmit onSubmitEditing={() => undefined} aoMudar={(v) => aoMudar(nomeSemQuebra(v))} />
    </View>
  );
}
