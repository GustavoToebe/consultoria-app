import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

import { baixarImagemDeQuestionario } from '../../api/rotas';
import { espaco } from '../../tema/tokens';
import { ImagemProtegida } from '../../ui/ImagemProtegida';

/**
 * De onde vêm as imagens das perguntas: a equipe usa a rota dela (padrão); as telas do aluno trocam pela rota do aluno,
 * que só entrega imagem de questionário que ele responde. Sempre pela API, com token.
 */
export const ContextoDeImagens = createContext<(id: string) => Promise<Blob>>(baixarImagemDeQuestionario);

/** Imagem de referência da pergunta ou da opção, inteira (sem corte), até 480 px de largura. */
export function ImagemDaPergunta({ id, descricao, pequena }: { id: string; descricao: string; pequena?: boolean }) {
  const carregar = useContext(ContextoDeImagens);
  const { width } = useWindowDimensions();
  const largura = Math.min(width - espaco(8), pequena ? 160 : 480);
  return <ImagemProtegida chave={`questionario:${id}`} carregar={() => carregar(id)} descricao={descricao} tamanho={largura}
    altura={Math.round(largura * (pequena ? 0.75 : 0.6))} ajuste="contain" />;
}
