import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ESTILOS_TEXTO } from './tipografia';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type TextInputProps } from 'react-native';

import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

interface Props extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  numerico?: boolean;
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  erro?: string | null;
  ajuda?: string;
  /** Campo de várias linhas (observações). */
  linhas?: number;
  /** Botão dentro do campo, à direita (ex.: calendário). */
  acao?: ReactNode;
}

/**
 * Campo de digitar com rótulo, ajuda e erro. O erro vai ao leitor de tela: `aria-invalid` na web, região viva no
 * Android e anúncio no iOS. Foco = borda de 2 px na cor do anel de foco (a cor da marca não contrasta no escuro).
 */
export function Campo({ rotulo, valor, aoMudar, erro, ajuda, linhas, numerico, acao, ...resto }: Props) {
  const { cores, fatorTexto } = useTema();
  const [foco, setFoco] = useState(false);
  const corBorda = erro ? cores.perigo : foco ? cores.anelFoco : cores.bordaCampo;
  // Foco e erro têm borda de 2 px; o padding cede 1 px para a altura e o texto não mexerem.
  const destaque = foco || !!erro ? 1 : 0;
  useAnunciarErro(erro, rotulo);
  return (
    <View style={estilos.campo}>
      <Label style={[ESTILOS_TEXTO.rotulo, { color: cores.textoSuave }]}>{rotulo}</Label>
      <View>
      <Input
        {...resto}
        accessibilityLabel={rotulo}
        accessibilityHint={erro ?? ajuda}
        aria-invalid={!!erro}
        value={valor}
        onChangeText={aoMudar}
        onFocus={(e) => {
          setFoco(true);
          resto.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          resto.onBlur?.(e);
        }}
        multiline={!!linhas}
        numberOfLines={linhas}
        placeholderTextColor={cores.textoSuave}
        style={[
          estilos.entrada,
          { borderWidth: 1 + destaque, paddingHorizontal: espaco(1.5) - destaque, paddingVertical: espaco(1) - destaque },
          numerico ? { fontVariant: ['tabular-nums'] } : null,
          linhas ? { minHeight: linhas * escalar(22, fatorTexto) + 20, textAlignVertical: 'top' } : null,
          acao ? { paddingRight: ALVO_TOQUE } : null,
          { color: cores.texto, backgroundColor: cores.campo, borderColor: corBorda, fontSize: escalar(16, fatorTexto) },
        ]}
      />
      {acao ? <View style={estilos.acao}>{acao}</View> : null}
      </View>
      {erro ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erro}</Texto> : null}
      {!erro && ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    </View>
  );
}

/** No iOS a região viva não existe: o erro novo é anunciado com o nome do campo. */
export function useAnunciarErro(erro: string | null | undefined, rotulo: string): void {
  useEffect(() => {
    if (Platform.OS === 'ios' && erro) AccessibilityInfo.announceForAccessibility(`${rotulo}: ${erro}`);
  }, [erro, rotulo]);
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  acao: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  entrada: {
    minHeight: ALVO_TOQUE,
    borderRadius: RAIO,
    fontFamily: fontes.normal,
    fontSize: 16,
  },
});
