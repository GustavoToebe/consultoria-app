import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import type { Papel } from '../api/tipos';
import { entradaDoPublico } from '../dominio/entradaPorPublico';
import { useSessao } from '../sessao/SessaoProvider';
import { Carregando } from './Estados';
import { GuardaDeTermos } from './GuardaDeTermos';
import { Tela } from './Tela';

/**
 * Só deixa entrar quem tem o papel da área. A API autoriza de novo em toda rota; isto é só para não mostrar a tela
 * errada.
 */
export function GuardaDePapel({ papel, children }: { papel: Papel; children: ReactNode }) {
  const { situacao, usuario } = useSessao();
  if (situacao === 'carregando') {
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  }
  if (situacao === 'anonimo' || !usuario) {
    // A entrada do público da área, no grupo `(entrada)`, fora do layout guardado: sem laço.
    return <Redirect href={entradaDoPublico(papel)} />;
  }
  if (usuario.papel !== papel) {
    return <Redirect href="/" />;
  }
  return <GuardaDeTermos>{children}</GuardaDeTermos>;
}
