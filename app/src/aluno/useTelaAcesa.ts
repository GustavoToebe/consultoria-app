import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const ETIQUETA = 'sessao-de-treino';

/**
 * Mantém a tela acesa enquanto a tela de treino está aberta (o aluno olha o aparelho entre as séries). Na web o wake
 * lock pode ser negado (aba em segundo plano, economia de bateria, navegador sem suporte): isso nunca vira erro na tela.
 */
export function useTelaAcesa() {
  useEffect(() => {
    activateKeepAwakeAsync(ETIQUETA).catch(() => undefined);
    return () => {
      deactivateKeepAwake(ETIQUETA).catch(() => undefined);
    };
  }, []);
}
