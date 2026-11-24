import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { larguraDaTelaDoAluno, telaLargaDoAluno } from '../dominio/telaLargaDoAluno';
import { espaco } from '../tema/tokens';
import { Tela, useFaixaDaTela } from '../ui/Tela';

type Conteudo = ReactNode | ((largo: boolean) => ReactNode);

type Props = Omit<ComponentProps<typeof Tela>, 'largura' | 'children'> & {
  /** `2` mantém 1120 em qualquer largura (a tela não tem o que pôr numa terceira coluna). */
  faixas?: 2 | 3;
  /** Com função, recebe `largo` (faixa `larga` ou `ultralarga`) para a tela montar as colunas. */
  children: Conteudo;
};

/**
 * A `Tela` das telas do aluno com o teto por faixa (tela larga, revisão de 24/11): 1120 até a faixa `normal` e 1688 (três
 * faixas) da `larga` em diante. A faixa é a que a própria `Tela` mede para a régua de 4.10 (`useFaixaDaTela`): a `Tela` fica
 * com o teto maior e o conteúdo por dentro segura 1120 fora da tela larga. Passa `largo` à tela que monta colunas.
 */
export function TelaDoAluno({ faixas = 3, children, ...props }: Props) {
  return (
    <Tela {...props} largura={larguraDaTelaDoAluno('larga', faixas)}>
      <ConteudoDoAluno faixas={faixas}>{children}</ConteudoDoAluno>
    </Tela>
  );
}

function ConteudoDoAluno({ faixas, children }: { faixas: 2 | 3; children: Conteudo }) {
  const faixa = useFaixaDaTela();
  const largo = faixas === 3 && telaLargaDoAluno(faixa);
  return (
    <View style={[estilos.conteudo, { maxWidth: larguraDaTelaDoAluno(faixa, faixas) }]}>
      {typeof children === 'function' ? children(largo) : children}
    </View>
  );
}

// O mesmo arranjo do conteúdo da `Tela` (largura toda até o teto, no meio, 24 entre os blocos).
const estilos = StyleSheet.create({ conteudo: { width: '100%', alignSelf: 'center', gap: espaco(3) } });
