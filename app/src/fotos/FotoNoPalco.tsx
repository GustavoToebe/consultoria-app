import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { caixaQueCabe } from '../dominio/visualizadorDeFotos';
import { CAMADA_DA_FOTO, espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { useEnderecoDoBlob } from '../ui/ImagemProtegida';
import { Texto } from '../ui/Texto';
import { useAtrasado, useCarregar } from '../ui/useCarregar';

/** Segurar a seta passa várias fotos: só baixa a que ficar parada este tempo (as do meio não viram um GET cada). */
const ESPERA_AO_TROCAR = 200;

interface Props {
  /** Muda quando a foto é outra (id da foto). */
  chave: string;
  carregar: () => Promise<Blob>;
  descricao: string;
  /** Área disponível; a foto usa a maior caixa com a proporção dela que cabe aqui. */
  largura: number;
  altura: number;
  /** Proporção (largura ÷ altura) lida da foto carregada: a comparação a usa para deixar o par da mesma altura. */
  aoMedir?: (proporcao: number) => void;
}

/**
 * Foto grande do visualizador, sobre o palco escuro: inteira (`contain`), sem cortar nem esticar, com cantos arredondados.
 * Como a `ImagemProtegida`, só existe atrás da API (blob com o token) e solta o endereço ao trocar de foto ou sair
 * (`useEnderecoDoBlob`). Trocar de foto mantém a anterior até a nova chegar (sem piscar), com o indicador por cima.
 */
export function FotoNoPalco({ chave, carregar, descricao, largura, altura, aoMedir }: Props) {
  // A proporção é da imagem que está na tela (o endereço medido): trocar de foto não deixa a caixa com a da anterior.
  const [medida, setMedida] = useState<{ endereco: string; proporcao: number } | null>(null);
  const chaveParada = useAtrasado(chave, ESPERA_AO_TROCAR);
  const baixada = useCarregar(chaveParada, carregar);
  const lida = useEnderecoDoBlob(baixada.dados);
  const endereco = lida.endereco;
  const erro = chaveParada === chave ? (baixada.erro ?? (lida.erro || undefined)) : undefined;
  const carregando = chaveParada !== chave || baixada.carregando || !lida.emDia;
  const recarregar = baixada.recarregar;
  const proporcao = medida && medida.endereco === endereco ? medida.proporcao : null;
  const caixa = caixaQueCabe(largura, altura, proporcao);
  const tamanho = { width: caixa.largura, height: caixa.altura };
  if (erro) {
    return (
      <View style={[estilos.caixa, estilos.centro, tamanho, { backgroundColor: CAMADA_DA_FOTO.fundo }]}>
        <Texto cor={CAMADA_DA_FOTO.icone} style={estilos.textoCentro}>Não foi possível carregar a foto.</Texto>
        <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={recarregar} />
      </View>
    );
  }
  if (!endereco) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={`Carregando: ${descricao}`}
        style={[estilos.caixa, estilos.centro, tamanho, { backgroundColor: CAMADA_DA_FOTO.sobre }]}>
        <ActivityIndicator color={CAMADA_DA_FOTO.icone} />
      </View>
    );
  }
  return (
    <View style={[estilos.caixa, tamanho]}>
      <Image
        source={{ uri: endereco }}
        cachePolicy="none"
        accessibilityLabel={carregando ? `Carregando: ${descricao}` : descricao}
        contentFit="contain"
        style={estilos.imagem}
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width > 0 && height > 0) {
            setMedida({ endereco, proporcao: width / height });
            aoMedir?.(width / height);
          }
        }}
      />
      {carregando ? (
        <View style={[StyleSheet.absoluteFill, estilos.centro, { backgroundColor: CAMADA_DA_FOTO.fundo }]} accessibilityRole="progressbar" accessibilityLabel={`Carregando: ${descricao}`}>
          <ActivityIndicator color={CAMADA_DA_FOTO.icone} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: RAIO, overflow: 'hidden' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: espaco(1.5), padding: espaco(2) },
  textoCentro: { textAlign: 'center' },
  imagem: { width: '100%', height: '100%' },
});
