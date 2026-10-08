import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Tema } from '../api/tipos';
import { useSessao } from '../sessao/SessaoProvider';
import { CLARO, ESCURO, MARCA_NEUTRA, textoSobre, type Cores } from './tokens';

/**
 * Tema claro/escuro à escolha de cada usuário (o Saraiva pediu "fundo branco e fundo preto, a pessoa escolhe").
 * Padrão = tema da marca do treinador. A escolha fica no aparelho, por usuário: é preferência visual, não dado
 * sensível.
 */
interface ValorTema {
  modo: Tema;
  cores: Cores;
  marca: string;
  sobreMarca: string;
  escolha: Tema | null;
  escolher: (tema: Tema | null) => void;
}

const Contexto = createContext<ValorTema | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const sessao = useSessao();
  const usuarioId = sessao.usuario?.id ?? null;
  // A escolha vale só para o usuário que a fez: trocou de conta, volta ao padrão até ler a do novo usuário.
  const [salva, setSalva] = useState<{ usuarioId: string; tema: Tema | null } | null>(null);
  const escolha = salva && salva.usuarioId === usuarioId ? salva.tema : null;

  useEffect(() => {
    if (!usuarioId) {
      return;
    }
    let ativo = true;
    AsyncStorage.getItem(chave(usuarioId))
      .then((valor) => {
        if (ativo) {
          setSalva({ usuarioId, tema: valor === 'CLARO' || valor === 'ESCURO' ? valor : null });
        }
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const valor = useMemo<ValorTema>(() => {
    const modo: Tema = escolha ?? sessao.marca?.temaPadrao ?? 'ESCURO';
    const marca = sessao.marca?.corPrimaria ?? MARCA_NEUTRA;
    return {
      modo,
      cores: modo === 'CLARO' ? CLARO : ESCURO,
      marca,
      sobreMarca: textoSobre(marca),
      escolha,
      escolher: (tema) => {
        if (usuarioId) {
          setSalva({ usuarioId, tema });
          const acao = tema ? AsyncStorage.setItem(chave(usuarioId), tema) : AsyncStorage.removeItem(chave(usuarioId));
          acao.catch(() => undefined);
        }
      },
    };
  }, [escolha, sessao.marca, usuarioId]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useTema fora do TemaProvider');
  }
  return valor;
}

function chave(usuarioId: string) {
  return `treinos:${usuarioId}:tema`;
}
