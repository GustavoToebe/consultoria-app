import type { ReactNode } from 'react';

import { unidadeEfetiva } from '../dominio/unidadeDeCarga';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ContextoDaUnidadeDeCarga } from './unidadeDeCargaEmUso';

/** Aluno com a chave da plataforma ligada e `lb` escolhido em Preferências vê libra; qualquer outro caso, kg. */
export function ProvedorDaUnidadeDeCarga({ children }: { children: ReactNode }) {
  const { unidadeDeCargaHabilitada, usuario } = useSessao();
  const { preferencias } = useTema();
  const unidade = unidadeEfetiva({ chaveLigada: unidadeDeCargaHabilitada, ehAluno: usuario?.papel === 'ALUNO', preferida: preferencias.unidadeDeCarga });
  return <ContextoDaUnidadeDeCarga.Provider value={unidade}>{children}</ContextoDaUnidadeDeCarga.Provider>;
}
