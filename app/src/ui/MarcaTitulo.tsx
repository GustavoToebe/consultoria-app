import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { urlDaApi } from '../api/cliente';
import type { Marca } from '../api/tipos';
import { useTema } from '../tema/TemaProvider';
import { fontes, marcaParaTexto } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Marca do treinador: a logo (se houver) ou o nome da consultoria. Com a fonte "Metal" o nome sai em Metal Mania
 * (o Saraiva gosta de logo estilo death/black metal). O nome usa a cor da marca em variante legível sobre o fundo
 * (`marcaParaTexto`). `nivel` faz dele o título da tela para o leitor de tela (h1 nas telas públicas e do aluno).
 */
export function MarcaTitulo({ marca, tamanho = 'medio', nivel }: { marca: Marca | null; tamanho?: 'medio' | 'grande'; nivel?: 1 | 2 | 3 }) {
  const { cores, marcaTexto } = useTema();
  const grande = tamanho === 'grande';
  if (!marca) {
    return <Texto variante="titulo" nivel={nivel}>Treinos</Texto>;
  }
  // A cor da própria marca: na tela de convite (antes do login) o tema ainda é neutro.
  const cor = marca.corPrimaria ? marcaParaTexto(marca.corPrimaria, cores.superficie3) : marcaTexto;
  if (marca.logoUrl) {
    return (
      <View accessibilityRole="image" accessibilityLabel={marca.nome}>
        <Image
          source={{ uri: urlDaApi(marca.logoUrl) }}
          style={grande ? estilos.logoGrande : estilos.logo}
          contentFit="contain"
          contentPosition="left"
        />
      </View>
    );
  }
  const familia = FAMILIAS[marca.fonteTitulo] ?? fontes.negrito;
  const metal = marca.fonteTitulo === 'METAL';
  return (
    <Texto
      nivel={nivel}
      numberOfLines={2}
      style={[
        { color: cor, fontFamily: familia },
        grande ? estilos.nomeGrande : estilos.nome,
        metal && estilos.nomeMetal,
      ]}>
      {marca.nome}
    </Texto>
  );
}

/** Família de cada fonte do nome da consultoria (a Padrão é a Inter em negrito). */
export const FAMILIAS: Record<string, string> = {
  PADRAO: fontes.negrito,
  METAL: fontes.metal,
  ESPORTIVA: fontes.esportiva,
  CONDENSADA: fontes.condensada,
};

const estilos = StyleSheet.create({
  // Logo em selo (quase quadrada, como a do Saraiva Team) precisa de altura para o nome ser legível.
  logo: { height: 64, width: 160 },
  logoGrande: { height: 112, width: 260 },
  nome: { fontSize: 22, lineHeight: 28 },
  nomeGrande: { fontSize: 34, lineHeight: 42 },
  nomeMetal: { letterSpacing: 1 },
});
