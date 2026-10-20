import { createContext, useContext, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { baixarImagemDeQuestionario } from '../../api/rotas';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { Folha } from '../../ui/Folha';
import { ImagemProtegida } from '../../ui/ImagemProtegida';

/**
 * De onde vêm as imagens das perguntas: a equipe usa a rota dela (padrão); as telas do aluno trocam pela rota do aluno,
 * que só entrega imagem de questionário que ele responde. Sempre pela API, com token.
 */
export const ContextoDeImagens = createContext<(id: string) => Promise<Blob>>(baixarImagemDeQuestionario);

const LARGURA_MAXIMA = 480;

/**
 * Imagem de referência da pergunta (escala de Bristol, modelo da foto): a largura do conteúdo até 480 px, inteira (sem
 * corte) e na proporção dela depois de carregada. Tocar abre maior numa folha, para ler os detalhes no celular.
 * `pequena`: miniatura de 160 px (editor do treinador, ao lado dos campos da opção).
 */
export function ImagemDaPergunta({ id, descricao, pequena }: { id: string; descricao: string; pequena?: boolean }) {
  const carregar = useContext(ContextoDeImagens);
  if (pequena) return <ImagemDaOpcao id={id} descricao={descricao} largura={160} />;
  return <ImagemGrande id={id} descricao={descricao} carregar={carregar} />;
}

function ImagemGrande({ id, descricao, carregar }: { id: string; descricao: string; carregar: (id: string) => Promise<Blob> }) {
  const { width, height } = useWindowDimensions();
  const [largura, setLargura] = useState(0);
  const [aberta, setAberta] = useState(false);
  const grande = Math.min(width - 48, LARGURA_EDITOR - 48);
  return (
    <View style={estilos.area} onLayout={(e: LayoutChangeEvent) => setLargura(Math.floor(e.nativeEvent.layout.width))}>
      {largura > 0 ? (
        <ImagemProtegida chave={`questionario:${id}`} carregar={() => carregar(id)} descricao={`${descricao}. Toque para ampliar.`}
          tamanho={largura} altura={Math.round(largura * 0.6)} proporcional alturaMaxima={Math.round(height * 0.7)} ajuste="contain"
          aoTocar={() => setAberta(true)} />
      ) : null}
      <Folha titulo="Imagem" visivel={aberta} aoFechar={() => setAberta(false)} largura={LARGURA_EDITOR}>
        <ImagemProtegida chave={`questionario:${id}:grande`} carregar={() => carregar(id)} descricao={descricao}
          tamanho={grande} altura={Math.round(grande * 0.6)} proporcional ajuste="contain" />
      </Folha>
    </View>
  );
}

/**
 * Imagem de uma opção (aparelho, escala): largura fixa da célula, proporção 4:3 estável (as opções de uma linha ficam
 * alinhadas) e a imagem inteira. Sem toque próprio: o cartão inteiro da opção é que marca.
 */
export function ImagemDaOpcao({ id, descricao, largura }: { id: string; descricao: string; largura: number }) {
  const carregar = useContext(ContextoDeImagens);
  return <ImagemProtegida chave={`questionario:${id}`} carregar={() => carregar(id)} descricao={descricao}
    tamanho={largura} altura={Math.round(largura * 0.75)} ajuste="contain" />;
}

const estilos = StyleSheet.create({
  area: { width: '100%', maxWidth: LARGURA_MAXIMA },
});
