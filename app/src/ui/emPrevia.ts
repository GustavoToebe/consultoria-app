import { createContext, useContext } from 'react';

/**
 * "Ver como o aluno" (C34): dentro da prévia do treinador os botões que registram (✓ da série, "Concluir série", "Não fiz",
 * "Desfazer", "Reabrir") ficam desabilitados. Fica em contexto porque eles moram no fundo de cartões que não conhecem a
 * tela; o `ExercicioAluno` liga ao receber `previa`.
 */
const EmPrevia = createContext(false);

export const ProvedorDaPrevia = EmPrevia.Provider;
export const useEmPrevia = () => useContext(EmPrevia);
