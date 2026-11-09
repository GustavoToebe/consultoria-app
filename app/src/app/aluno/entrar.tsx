import Entrar from '../entrar';

/**
 * Acesso exclusivo do Aluno (/aluno/entrar).
 * Foca 100% na experiência do aluno com subtítulo explicativo e sem links de criação de conta de treinador.
 */
export default function EntrarAluno() {
  return <Entrar modoFixo="ALUNO" />;
}
