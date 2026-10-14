import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { GUIAS } from '../ajuda/conteudo';
import { chaveBoasVindas, situacaoDasBoasVindas, type SituacaoDasBoasVindas } from '../dominio/boasVindas';

export const PASSOS_DAS_BOAS_VINDAS = GUIAS.aluno.boasVindas ?? [];

interface Valor {
  situacao: SituacaoDasBoasVindas;
  /** Pular, fechar ou chegar ao fim: conta como visto e guarda a marca no aparelho. */
  dispensar: () => void;
}

// Sem o provedor (outras telas e testes) não há boas-vindas para esperar.
const Contexto = createContext<Valor>({ situacao: 'encerrada', dispensar: () => undefined });

/**
 * Dono do estado das boas-vindas do aluno: lê a marca do aparelho e diz em que pé elas estão. Quem desenha
 * (`BoasVindas`) e quem abre outro diálogo (o lembrete da atualização, que espera `encerrada`) só consultam. Começa em
 * "lendo": nada abre por engano antes de a marca ser lida. A marca é por usuário e sobrevive a sair e entrar. Mora no
 * layout, dentro do `AlunoProvider` (um por usuário).
 */
export function ProvedorDasBoasVindas({ usuarioId, children }: { usuarioId: string; children: ReactNode }) {
  const [leitura, setLeitura] = useState<'lendo' | 'falhou' | { valor: string | null }>('lendo');
  const [dispensada, setDispensada] = useState(false);

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(chaveBoasVindas(usuarioId))
      .then((valor) => ativo && setLeitura({ valor }))
      .catch(() => ativo && setLeitura('falhou'));
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const dispensar = useCallback(() => {
    setDispensada(true);
    AsyncStorage.setItem(chaveBoasVindas(usuarioId), '1').catch(() => undefined);
  }, [usuarioId]);

  const situacao = situacaoDasBoasVindas(leitura, dispensada, PASSOS_DAS_BOAS_VINDAS.length);
  const valor = useMemo(() => ({ situacao, dispensar }), [situacao, dispensar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useBoasVindas = (): Valor => useContext(Contexto);
