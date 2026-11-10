import { EntradaDoPublico } from '../../../ui/EntradaDoPublico';

/** Entrada do aluno (`/aluno/entrar`). No grupo `(entrada)`, fora do layout guardado do aluno: abre sem login. */
export default function EntrarAluno() {
  return <EntradaDoPublico publico="ALUNO" />;
}
