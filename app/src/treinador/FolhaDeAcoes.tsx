import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { Folha } from '../ui/Folha';
import { ItemDeLista } from '../ui/ItemDeLista';

export interface AcaoDoMenu {
  rotulo: string;
  /** Linha suave abaixo do rótulo: o que a ação faz, em poucas palavras. */
  detalhe?: string;
  Icone?: LucideIcon;
  /** Destrutiva: vermelha, sem seta (a confirmação vem num `PainelConfirmacao`). */
  perigo?: boolean;
  aoTocar: () => void;
}

/**
 * Menu ⋯ como folha: uma ação por linha (o cartão inteiro é o toque), todas da mesma largura. Serve para as ações que
 * não são do dia a dia (PDF, replicar, copiar, excluir; inativar, exportar). Tocar fecha o menu antes de agir, para a
 * confirmação ou a folha seguinte não abrir por baixo dele. `children` fica depois das ações (peça com estado próprio,
 * como as ações de privacidade).
 */
export function FolhaDeAcoes({ titulo, acoes, aoFechar, children }: { titulo: string; acoes: (AcaoDoMenu | null | false)[]; aoFechar: () => void; children?: ReactNode }) {
  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}>
      {acoes.filter((a): a is AcaoDoMenu => !!a).map((a) => (
        <ItemDeLista key={a.rotulo} titulo={a.rotulo} detalhe={a.detalhe} Icone={a.Icone} perigo={a.perigo}
          aoTocar={() => { aoFechar(); a.aoTocar(); }} />
      ))}
      {children}
    </Folha>
  );
}
