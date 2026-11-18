import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

import { usePassoNoHistorico } from '../ui/historicoDasFolhas';

/**
 * Coleção aberta pelo toque é um passo do histórico, como a edição dos Dados do aluno: o voltar do navegador e o do Android
 * chamam `fechar`, sem sair da Comunidade. Trocar de aba com a coleção aberta precisa fechá-la ANTES de gravar a aba (o pai
 * faz isso por `fecharRef`, em `depoisDeFecharAsFolhas`): desmontar com o passo no histórico devolveria a entrada depois de
 * o endereço mudar, e o voltar traria a aba Vídeos de volta.
 */
export function useVoltarFechaColecao(ativo: boolean, fechar: () => void) {
  usePassoNoHistorico(ativo, fechar);
  useEffect(() => {
    if (!ativo || Platform.OS === 'web') return undefined;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => { fechar(); return true; });
    return () => assinatura.remove();
  });
}
