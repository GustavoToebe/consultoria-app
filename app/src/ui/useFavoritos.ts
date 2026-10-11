import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { alternarFavorito, chaveDosFavoritos, lerFavoritos } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';

/**
 * Telas favoritas do treinador (lista de ids em `treinos:<usuarioId>:favoritos`), na ordem em que foram marcadas.
 * Ficam só neste aparelho e saem dele ao sair da conta, como as outras chaves por usuário.
 */
export function useFavoritos(): { favoritos: string[]; alternar: (id: string) => void } {
  const sessao = useSessao();
  const usuarioId = sessao.usuario?.id;
  const [favoritos, setFavoritos] = useState<string[]>([]);
  useEffect(() => {
    if (!usuarioId) return;
    AsyncStorage.getItem(chaveDosFavoritos(usuarioId)).then((v) => setFavoritos(lerFavoritos(v)), () => undefined);
  }, [usuarioId]);
  useEffect(
    () => sessao.aoSair((id) => AsyncStorage.removeItem(chaveDosFavoritos(id)).catch(() => undefined)),
    [sessao],
  );
  const alternar = useCallback(
    (id: string) => {
      if (!usuarioId) return;
      setFavoritos((atuais) => {
        const novos = alternarFavorito(atuais, id);
        AsyncStorage.setItem(chaveDosFavoritos(usuarioId), JSON.stringify(novos)).catch(() => undefined);
        return novos;
      });
    },
    [usuarioId],
  );
  return { favoritos, alternar };
}
