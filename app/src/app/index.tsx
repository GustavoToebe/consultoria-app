import { Redirect } from 'expo-router';

import { useSessao } from '../sessao/SessaoProvider';
import { Carregando } from '../ui/Estados';
import { Tela } from '../ui/Tela';

/** Sem sessão → Entrar; treinador → /treinador; aluno → /aluno. O papel vem do login. */
export default function Inicio() {
  const { situacao, usuario } = useSessao();
  if (situacao === 'carregando') {
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  }
  if (situacao === 'anonimo' || !usuario) {
    return <Redirect href="/entrar" />;
  }
  return <Redirect href={usuario.papel === 'TREINADOR' ? '/treinador' : '/aluno'} />;
}
