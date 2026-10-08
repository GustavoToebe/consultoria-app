import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { IconeBotao } from './IconeBotao';
import { MarcaTitulo } from './MarcaTitulo';
import { Selo } from './Selo';
import { Texto } from './Texto';

interface Props {
  titulo?: string;
  /** Linha menor abaixo do título (nome do aluno, período). */
  subtitulo?: string;
  acoes?: ReactNode;
  /** `sempre` (área do aluno, sem menu lateral) ou `celular` (treinador: no PC a marca já está no menu). */
  mostrarMarca?: 'sempre' | 'celular';
  /** Seta de voltar. Sem histórico (link aberto direto na web), vai para este endereço. */
  voltar?: Href;
}

/** Topo das telas: marca do treinador (ou título da página), selo de "sem conexão" e ações à direita. */
export function Cabecalho({ titulo, subtitulo, acoes, mostrarMarca, voltar }: Props) {
  const { marca, offline } = useSessao();
  const { width } = useWindowDimensions();
  const comMarca = mostrarMarca === 'sempre' || (mostrarMarca === 'celular' && width < LARGURA_MENU_LATERAL);
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.inicio}>
        {voltar ? (
          <View style={estilos.seta}>
            <IconeBotao
              Icone={ArrowLeft}
              rotulo="Voltar"
              aoTocar={() => (router.canGoBack() ? router.back() : router.replace(voltar))}
            />
          </View>
        ) : null}
        <View style={estilos.esquerda}>
          {comMarca ? <MarcaTitulo marca={marca} /> : null}
          {titulo ? <Texto variante="titulo">{titulo}</Texto> : null}
          {subtitulo ? <Texto variante="suave">{subtitulo}</Texto> : null}
          {offline ? <Selo texto="Sem conexão" tipo="neutro" /> : null}
        </View>
      </View>
      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
  },
  inicio: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 1, gap: espaco(0.5) },
  seta: { marginLeft: -espaco(1.5), marginTop: -espaco(1) + 2 },
  esquerda: { flexShrink: 1, gap: espaco(0.5) },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', justifyContent: 'flex-end' },
});
