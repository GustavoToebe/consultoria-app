import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { alternarFavorito, chaveDosFavoritos, lerFavoritos } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';

/**
 * Telas favoritas do treinador (lista de ids em `treinos:<usuarioId>:favoritos`), na ordem em que foram marcadas.
 * Ficam só neste aparelho e saem dele ao sair da conta (`useLimparFavoritosAoSair`, no layout do treinador).
 *
 * Enquanto a lista do usuário atual não foi lida, `favoritos` é vazio e marcar não faz nada: senão a primeira estrela
 * gravaria `[id]` por cima do que já estava salvo, e a troca de usuário mostraria a lista do anterior.
 */
export function useFavoritos(): { favoritos: string[]; alternar: (id: string) => void } {
  const usuarioId = useSessao().usuario?.id;
  const [salvo, setSalvo] = useState<{ usuarioId: string; ids: string[] } | null>(null);
  useEffect(() => {
    if (!usuarioId) return;
    AsyncStorage.getItem(chaveDosFavoritos(usuarioId)).then(
      (v) => setSalvo({ usuarioId, ids: lerFavoritos(v) }),
      () => setSalvo({ usuarioId, ids: [] }),
    );
  }, [usuarioId]);
  const pronto = salvo !== null && salvo.usuarioId === usuarioId;
  const alternar = useCallback(
    (id: string) => {
      if (!usuarioId) return;
      setSalvo((atual) => {
        if (atual === null || atual.usuarioId !== usuarioId) return atual;
        const ids = alternarFavorito(atual.ids, id);
        AsyncStorage.setItem(chaveDosFavoritos(usuarioId), JSON.stringify(ids)).catch(() => undefined);
        return { usuarioId, ids };
      });
    },
    [usuarioId],
  );
  return { favoritos: pronto ? salvo.ids : [], alternar };
}

/**
 * Apaga os favoritos do aparelho ao sair. Fica no layout do treinador (sempre montado), e não no `useFavoritos`, que só
 * existe com a barra de topo: sair pelo Perfil do celular, ou com a janela estreita, também precisa limpar.
 */
export function useLimparFavoritosAoSair(): void {
  const { aoSair } = useSessao();
  useEffect(() => aoSair((id) => AsyncStorage.removeItem(chaveDosFavoritos(id)).catch(() => undefined)), [aoSair]);
}
