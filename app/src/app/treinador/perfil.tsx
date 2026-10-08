import { Cabecalho } from '../../ui/Cabecalho';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';

export default function PerfilTreinador() {
  return (
    <Tela bordas={['top']} largura={640}>
      <Cabecalho titulo="Perfil" />
      <PainelConta />
    </Tela>
  );
}
