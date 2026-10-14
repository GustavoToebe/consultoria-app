import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { SituacaoDasBoasVindas } from '../dominio/boasVindas';

interface Valor {
  situacao: SituacaoDasBoasVindas;
  informar: (situacao: SituacaoDasBoasVindas) => void;
}

// Sem o provedor (outras telas e testes) não há boas-vindas para esperar.
const Contexto = createContext<Valor>({ situacao: 'encerrada', informar: () => undefined });

/**
 * Deixa o que abre diálogo na área do aluno saber se as boas-vindas ainda vão aparecer. Começa em "lendo": nada abre
 * por engano enquanto a marca do aparelho não foi lida. Mora no layout, por usuário, junto com o `AlunoProvider`.
 */
export function ProvedorDasBoasVindas({ children }: { children: ReactNode }) {
  const [situacao, informar] = useState<SituacaoDasBoasVindas>('lendo');
  const valor = useMemo(() => ({ situacao, informar }), [situacao]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSituacaoDasBoasVindas = (): SituacaoDasBoasVindas => useContext(Contexto).situacao;

/** Quem controla as boas-vindas diz aqui em que pé elas estão. */
export function useInformarBoasVindas(situacao: SituacaoDasBoasVindas): void {
  const { informar } = useContext(Contexto);
  useEffect(() => {
    informar(situacao);
  }, [informar, situacao]);
}
