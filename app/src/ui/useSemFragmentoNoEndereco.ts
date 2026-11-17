import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Tira o fragmento (`#codigo=`, `#token=`, `#indicacao=`) do endereço da web ao abrir a tela (histórico, captura de tela,
 * link copiado), mantendo o caminho e o `?busca`. Só o `replaceState` do efeito não bastava: o expo-router guarda o
 * caminho de entrada, com o fragmento, no estado de navegação e o regrava no endereço logo depois do primeiro efeito,
 * então a limpeza roda de novo depois que ele assentou. (`router.replace` e `setParams` não servem: o primeiro
 * remonta a tela e a perderia o que ela leu do fragmento, o segundo não troca o caminho guardado.) A tela lê o
 * fragmento ANTES (efeito declarado acima deste hook ou valor inicial do `useState`).
 */
export function useSemFragmentoNoEndereco() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.hash) return;
    const limpar = () => {
      if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    };
    // shortcut: limpeza por tempo (agora, 0 e 300 ms), não pelo evento do router; trocar se o expo-router deixar tirar o fragmento do estado de entrada.
    limpar();
    const depois = [setTimeout(limpar, 0), setTimeout(limpar, 300)];
    return () => depois.forEach(clearTimeout);
  }, []);
}
