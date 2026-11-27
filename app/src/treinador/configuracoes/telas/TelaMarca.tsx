import { FormMarca } from '../../marca/FormMarca';
import { TelaDaConsultoria } from './TelaDaConsultoria';

/** Marca (nome, logo, cor, fonte e tema) com a prévia ao vivo do app do aluno. */
export function TelaMarca() {
  return <TelaDaConsultoria titulo="Marca" descricao="Nome, logo, cor, fonte e tema que os seus alunos veem no app." formulario={(p) => <FormMarca {...p} />} />;
}
