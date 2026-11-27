import { FormAcompanhamento } from '../../marca/FormAcompanhamento';
import { TelaDaConsultoria } from './TelaDaConsultoria';

/** Padrões do acompanhamento: prazo da atualização, meta do peso e textos do ciclo (Configurações › Alunos e atendimento). */
export function TelaPadroesDoAcompanhamento() {
  return <TelaDaConsultoria titulo="Padrões do acompanhamento" descricao="O que vale para os alunos sem valor próprio no cadastro." formulario={(p) => <FormAcompanhamento {...p} />} />;
}
