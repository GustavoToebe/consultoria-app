import { TelaDaConta } from '../../aluno/conta/TelaDaConta';
import { useRetornoDoPagamento } from '../../aluno/financeiro/useRetornoDoPagamento';

/**
 * Conta do aluno (reorganizada em 23/11: cabeçalho de perfil e seções; `aluno/conta/TelaDaConta`). Na web, esta tela também
 * recebe a volta do pagamento da InfinitePay (`useRetornoDoPagamento`).
 */
export default function ContaAluno() {
  useRetornoDoPagamento();
  return <TelaDaConta />;
}
