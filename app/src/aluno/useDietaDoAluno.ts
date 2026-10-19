import { ErroApi } from '../api/cliente';
import { dietaAluno } from '../api/rotas';
import { useAluno } from '../offline/AlunoProvider';
import { useCarregar } from '../ui/useCarregar';

/**
 * Dieta publicada do aluno: busca online e guarda no aparelho; sem conexão devolve a última vista (`salva: true`). Usada
 * pela aba Dieta e pelo cartão do início.
 */
export function useDietaDoAluno() {
  const { repositorio } = useAluno();
  return useCarregar('dieta-aluno', async () => {
    try {
      const { dieta } = await dietaAluno();
      await repositorio.salvarDieta(dieta);
      return { dieta, salva: false };
    } catch (e) {
      const salva = e instanceof ErroApi && e.semConexao ? await repositorio.lerDieta() : null;
      if (salva) return { dieta: salva, salva: true };
      throw e;
    }
  });
}
