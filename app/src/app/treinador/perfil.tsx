import { LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';

export default function PerfilTreinador() {
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Perfil" />
      <PainelConta />
    </Tela>
  );
}
