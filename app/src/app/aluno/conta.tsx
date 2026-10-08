import { Cabecalho } from '../../ui/Cabecalho';
import { PainelConta } from '../../ui/PainelConta';
import { Tela } from '../../ui/Tela';

export default function ContaAluno() {
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Conta" />
      <PainelConta />
    </Tela>
  );
}
