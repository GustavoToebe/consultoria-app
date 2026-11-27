import type { ComponentProps, ReactNode } from 'react';

import { telaLargaDoAluno } from '../dominio/telaLargaDoAluno';
import { Tela, useFaixaDaTela } from '../ui/Tela';

type Conteudo = ReactNode | ((largo: boolean) => ReactNode);

type Props = Omit<ComponentProps<typeof Tela>, 'largura' | 'children'> & {
  /** Com função, recebe `largo` (faixa `larga` ou `ultralarga`) para a tela montar as colunas. */
  children: Conteudo;
};

/**
 * A `Tela` das telas do aluno com o mesmo contêiner do treinador (27/11): começa ao lado do menu e preenche a área, sem
 * teto próprio, respeitando a "Largura do conteúdo" (Automática preenche; Limitada para em 1800). Faixa e largura útil
 * vêm da própria `Tela` (`useAreaDaTela`); a função recebe `largo` para a tela que monta colunas.
 */
export function TelaDoAluno({ children, ...props }: Props) {
  return (
    <Tela {...props}>
      <ConteudoDoAluno>{children}</ConteudoDoAluno>
    </Tela>
  );
}

function ConteudoDoAluno({ children }: { children: Conteudo }) {
  const largo = telaLargaDoAluno(useFaixaDaTela());
  return <>{typeof children === 'function' ? children(largo) : children}</>;
}
