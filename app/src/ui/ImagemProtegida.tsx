import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { Texto } from './Texto';
import { useCarregar } from './useCarregar';

/**
 * Endereço que o componente de imagem entende, feito do `Blob` já baixado pela API (com token): na web um `blob:` da
 * página; no celular um `data:` na memória. Nunca vira arquivo no aparelho nem link direto para o bucket.
 */
export async function enderecoDaImagem(blob: Blob): Promise<string> {
  if (Platform.OS === 'web') return URL.createObjectURL(blob);
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
}

interface Props {
  /** Muda quando a imagem é outra (id da foto). */
  chave: string;
  carregar: () => Promise<Blob>;
  /** Texto para o leitor de tela. */
  descricao: string;
  tamanho?: number;
  /** Com `aoTocar` a miniatura vira botão (ex.: abrir ampliada). */
  aoTocar?: () => void;
  /** Retângulo em vez de quadrado (imagem de pergunta). */
  altura?: number;
  /** `contain` mostra a imagem inteira (escala, aparelho); padrão `cover` (foto em miniatura). */
  ajuste?: 'cover' | 'contain';
}

/** Miniatura de foto que só existe atrás da API: baixa com o token, mostra e solta o endereço ao sair da tela. */
export function ImagemProtegida({ chave, carregar, descricao, tamanho = 96, aoTocar, altura, ajuste = 'cover' }: Props) {
  const { cores } = useTema();
  const { dados: endereco, erro, carregando, recarregar } = useCarregar(chave, async () => enderecoDaImagem(await carregar()));
  useEffect(
    () => () => {
      if (endereco?.startsWith('blob:')) URL.revokeObjectURL(endereco);
    },
    [endereco],
  );
  const caixa = [estilos.caixa, { width: tamanho, height: altura ?? tamanho, maxWidth: '100%' as const, borderColor: cores.borda, backgroundColor: cores.superficie2 }];
  if (erro) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${descricao}: não foi possível carregar. Tocar para tentar de novo`}
        onPress={recarregar} style={[caixa, estilos.centro]}>
        <Texto variante="pequeno" style={{ textAlign: 'center' }}>Tentar de novo</Texto>
      </Pressable>
    );
  }
  if (carregando || !endereco) {
    return <View accessibilityRole="progressbar" accessibilityLabel={`Carregando: ${descricao}`} style={caixa} />;
  }
  const imagem = <Image source={{ uri: endereco }} cachePolicy="none" accessibilityLabel={descricao} contentFit={ajuste} style={estilos.imagem} />;
  return aoTocar ? (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={descricao} onPress={aoTocar}
      style={[caixa, { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE }]}>{imagem}</Pressable>
  ) : (
    <View style={caixa}>{imagem}</View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  imagem: { width: '100%', height: '100%' },
});
