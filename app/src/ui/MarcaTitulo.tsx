import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { urlDaApi } from '../api/cliente';
import type { Marca } from '../api/tipos';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Marca do treinador: a logo (se houver) ou o nome da consultoria. Com a fonte "Metal" o nome sai em Metal Mania
 * (o Saraiva gosta de logo estilo death/black metal).
 */
export function MarcaTitulo({ marca, tamanho = 'medio' }: { marca: Marca | null; tamanho?: 'medio' | 'grande' }) {
  const { marca: corDoTema } = useTema();
  const grande = tamanho === 'grande';
  if (!marca) {
    return <Texto variante="titulo">Treinos</Texto>;
  }
  // A cor da própria marca: na tela de convite (antes do login) o tema ainda é neutro.
  const cor = marca.corPrimaria ?? corDoTema;
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
      accessibilityRole="header"
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
  logo: { height: 36, width: 160 },
  logoGrande: { height: 72, width: 260 },
  nome: { fontSize: 22, lineHeight: 28 },
  nomeGrande: { fontSize: 34, lineHeight: 42 },
  nomeMetal: { letterSpacing: 1 },
});
