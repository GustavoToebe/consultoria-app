import type { ReactNode } from 'react';

import { useSessao } from '../sessao/SessaoProvider';

/**
 * Mostra o conteúdo só se a funcionalidade está ligada no plano da consultoria (`MOBILIDADE`, `PDF`, `EQUIPE`).
 * É só apresentação: a API continua barrando.
 */
export function NoPlano({ funcionalidade, children }: { funcionalidade: string; children: ReactNode }) {
  const { temFuncionalidade } = useSessao();
  return temFuncionalidade(funcionalidade) ? <>{children}</> : null;
}
