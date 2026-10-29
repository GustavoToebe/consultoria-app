import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { AvisoDeCompromisso, CompromissoDoAluno } from '../../api/agendaTipos';
import { avisosDeCompromisso, compromissosDoAluno, marcarAvisoDeCompromissoVisto } from '../../api/rotas';
import { useAluno } from '../../offline/AlunoProvider';
import { useTema } from '../../tema/TemaProvider';
import { useCarregar } from '../../ui/useCarregar';
import {
  desligarLembretesDeCompromisso, iniciarLembretesDeCompromisso, reagendarLembretesDeCompromisso,
} from './lembretes';

interface Valor {
  /** Avisos não vistos (D12), do mais novo ao mais antigo; vazio sem conexão, com erro ou sem aviso. */
  avisos: AvisoDeCompromisso[];
  /** Os próximos compromissos do aluno; `undefined` sem conexão ou com erro (o cartão some). */
  compromissos: CompromissoDoAluno[] | undefined;
  recarregar: () => void;
  /**
   * Tira o aviso da tela na hora e avisa o servidor. Falha de rede nunca trava quem tocou: o aviso volta na próxima
   * busca, porque no servidor ele continua não visto.
   */
  marcarVisto: (id: string) => void;
}

const Contexto = createContext<Valor | null>(null);

/**
 * Compromissos e avisos de compromisso do aluno (`GET /aluno/compromissos` e `/aluno/avisos-de-compromisso`), só em
 * memória: nada vai para o armazenamento do aparelho (D12: sem rede não há aviso, como o cartão "Seus compromissos").
 * Uma fonte só para o Início, para o ponto na aba e para os lembretes locais (D13), que se reagendam quando a lista
 * muda. Tem de ficar dentro do `AlunoProvider`.
 */
export function CompromissosDoAlunoProvider({ children }: { children: ReactNode }) {
  const { online, repositorio } = useAluno();
  const usuarioId = repositorio.usuarioId;
  const { preferencias } = useTema();
  const chave = online ? usuarioId : null;
  const avisosCarga = useCarregar(chave === null ? null : `aviso-de-compromisso:${chave}`, () => avisosDeCompromisso());
  const compromissosCarga = useCarregar(chave === null ? null : `compromissos-do-aluno:${chave}`, () => compromissosDoAluno());
  const { recarregar: recarregarAvisos } = avisosCarga;
  const { recarregar: recarregarCompromissos } = compromissosCarga;
  const recarregar = useCallback(() => { recarregarAvisos(); recarregarCompromissos(); }, [recarregarAvisos, recarregarCompromissos]);

  // Volta para a frente (app aberto de novo, aba do navegador): confere se a equipe marcou ou mudou algo.
  const buscando = chave !== null;
  useEffect(() => {
    if (!buscando) return;
    if (Platform.OS !== 'web') {
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') recarregar();
      });
      return () => assinatura.remove();
    }
    if (typeof document === 'undefined') return;
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [buscando, recarregar]);

  const [vistos, setVistos] = useState<ReadonlySet<string>>(() => new Set());
  const marcarVisto = useCallback((id: string) => {
    setVistos((atual) => new Set(atual).add(id));
    marcarAvisoDeCompromissoVisto(id).catch(() => setVistos((atual) => {
      const novo = new Set(atual);
      novo.delete(id);
      return novo;
    }));
  }, []);
  const dadosDosAvisos = chave === null ? undefined : avisosCarga.dados;
  const avisos = useMemo(() => (dadosDosAvisos ?? []).filter((a) => !vistos.has(a.id)), [dadosDosAvisos, vistos]);
  const compromissos = chave === null ? undefined : compromissosCarga.dados;

  // Lembretes locais (D13). Só reagenda com uma lista baixada: sem rede os que já estão agendados ficam como estão.
  const ligado = preferencias.lembretesCompromisso;
  const assinaturaDaLista = compromissos ? compromissos.map((c) => `${c.id}|${c.inicio}|${c.situacao}`).join(';') : null;
  const listaAtual = useRef(compromissos);
  useEffect(() => { listaAtual.current = compromissos; });
  useEffect(() => { iniciarLembretesDeCompromisso(usuarioId); }, [usuarioId]);
  const estavaLigado = useRef(false);
  useEffect(() => {
    if (!ligado) {
      // A preferência chega do armazenamento depois da primeira renderização: só apaga quando ela foi mesmo desligada.
      if (estavaLigado.current) void desligarLembretesDeCompromisso(usuarioId).catch(() => undefined);
      estavaLigado.current = false;
      return;
    }
    estavaLigado.current = true;
    if (assinaturaDaLista !== null) void reagendarLembretesDeCompromisso(usuarioId, listaAtual.current ?? null).catch(() => undefined);
  }, [ligado, assinaturaDaLista, usuarioId]);

  const valor = useMemo<Valor>(
    () => ({ avisos, compromissos, recarregar, marcarVisto }),
    [avisos, compromissos, recarregar, marcarVisto],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCompromissosDoAluno(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useCompromissosDoAluno fora do CompromissosDoAlunoProvider');
  return valor;
}

/** Busca de novo cada vez que a tela volta ao foco (a equipe pode ter marcado, remarcado ou cancelado). */
export function useRecarregarCompromissosAoFocar(): void {
  const { recarregar } = useCompromissosDoAluno();
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
}
