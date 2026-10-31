import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  chavePrimeirosPassos,
  estadoDaLeitura,
  serializarEstado,
  type EstadoGuardado,
  type LeituraDoEstado,
} from '../../dominio/primeirosPassos';

type Ouvinte = (usuarioId: string, valor: string) => void;

/**
 * Quem gravou avisa os outros abertos agora (o Início continua montado atrás da Ajuda: "Mostrar no Início de novo" tem de
 * aparecer ao voltar, sem esperar a releitura do aparelho).
 */
const ouvintes = new Set<Ouvinte>();

/**
 * Estado dos Primeiros passos guardado no aparelho, por usuário (como o `passeioVisto`; sobrevive ao Sair). `estado` é
 * `null` enquanto lê: a tela não mostra nem o bloco nem o Próximo passo. Nunca grava antes de ler. `releer` lê de novo
 * (ao voltar para a tela) sem apagar o que já estava, para nada piscar.
 */
export function usePrimeirosPassosGuardados(usuarioId: string | null) {
  const [leitura, setLeitura] = useState<{ usuarioId: string; leitura: LeituraDoEstado } | null>(null);
  const [rodada, setRodada] = useState(0);
  // Leitura que falhou: o que está no aparelho é desconhecido, então a mudança vale só na sessão e não grava por cima.
  const leituraFalhou = useRef(false);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    AsyncStorage.getItem(chavePrimeirosPassos(usuarioId))
      .then((valor) => {
        if (!ativo) return;
        leituraFalhou.current = false;
        setLeitura({ usuarioId, leitura: { valor } });
      })
      .catch(() => {
        if (!ativo) return;
        leituraFalhou.current = true;
        setLeitura((atual) => (atual?.usuarioId === usuarioId ? atual : { usuarioId, leitura: 'falhou' }));
      });
    return () => {
      ativo = false;
    };
  }, [usuarioId, rodada]);

  useEffect(() => {
    if (!usuarioId) return;
    const ouvir: Ouvinte = (id, valor) => {
      if (id === usuarioId) setLeitura({ usuarioId, leitura: { valor } });
    };
    ouvintes.add(ouvir);
    return () => {
      ouvintes.delete(ouvir);
    };
  }, [usuarioId]);

  const estado: EstadoGuardado | null = leitura && leitura.usuarioId === usuarioId ? estadoDaLeitura(leitura.leitura) : null;

  const gravar = useCallback(
    (mudar: (e: EstadoGuardado) => EstadoGuardado) => {
      if (!usuarioId || !estado) return;
      const valor = serializarEstado(mudar(estado));
      // Vale na sessão mesmo que o aparelho não grave (o bloco é só um guia).
      for (const ouvir of ouvintes) ouvir(usuarioId, valor);
      if (!leituraFalhou.current) AsyncStorage.setItem(chavePrimeirosPassos(usuarioId), valor).catch(() => undefined);
    },
    [usuarioId, estado],
  );

  const releer = useCallback(() => setRodada((r) => r + 1), []);

  return { estado, gravar, releer };
}
