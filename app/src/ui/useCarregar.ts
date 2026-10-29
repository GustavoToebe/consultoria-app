import { useCallback, useEffect, useRef, useState } from 'react';

interface Estado<T> {
  chave: string;
  rodada: number;
  dados?: T;
  erro?: unknown;
}

/**
 * Carrega dados da API para uma tela. `chave` muda → busca de novo (`null` = não buscar ainda). Enquanto recarrega,
 * os dados anteriores continuam na tela. O estado só muda no retorno da promessa (regra do React 19 para efeitos).
 */
export function useCarregar<T>(chave: string | null, buscar: (chave: string) => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T> | null>(null);
  const [rodada, setRodada] = useState(0);
  const buscarAtual = useRef(buscar);

  useEffect(() => {
    buscarAtual.current = buscar;
  });

  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    buscarAtual.current(chave).then(
      (dados) => vivo && setEstado({ chave, rodada, dados }),
      (erro: unknown) => vivo && setEstado({ chave, rodada, erro }),
    );
    return () => {
      vivo = false;
    };
  }, [chave, rodada]);

  const recarregar = useCallback(() => setRodada((r) => r + 1), []);
  /**
   * Troca os dados na tela depois de uma alteração (sem buscar de novo). Com `paraChave`, só troca se a tela ainda está
   * nessa chave: a resposta atrasada de um registro que já saiu da tela não cobre o que está aberto agora.
   */
  const definir = useCallback(
    (dados: T, paraChave?: string) => setEstado((atual) => {
      if (!atual || (paraChave !== undefined && atual.chave !== paraChave)) return atual;
      return { ...atual, dados, erro: undefined };
    }),
    [],
  );

  const emDia = estado !== null && estado.chave === chave && estado.rodada === rodada;
  return {
    dados: estado?.dados,
    erro: emDia ? estado.erro : undefined,
    carregando: chave !== null && !emDia,
    recarregar,
    definir,
  };
}

/** Valor que só muda depois de `ms` sem mudanças (busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms = 300): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const relogio = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(relogio);
  }, [valor, ms]);
  return atrasado;
}
