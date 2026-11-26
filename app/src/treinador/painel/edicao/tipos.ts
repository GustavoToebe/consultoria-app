import { Platform } from 'react-native';

import type { BlocoDoPainelId, BlocoParaEditar, OpcaoDoBloco, TamanhoDoBloco } from '../../../dominio/painelDoInicio';

export { textoDaBarra, textoDaPosicao } from '../../../dominio/painelDoInicio';

/** Item de `blocosParaEditar` (com as `opcoes` do bloco, quando ele tem). */
export type ItemDaEdicao = BlocoParaEditar;

export type { BlocoDoPainelId, OpcaoDoBloco, TamanhoDoBloco };

// ---- Foco depois que a grade se rearruma ----

/** Caixas com `nativeID` (o `id` na web) que recebem o foco depois de mover, mudar o tamanho, ocultar ou adicionar. */
/** Caixa do "Editar" do cabeçalho: o foco volta a ela ao sair da edição. */
export const ID_DO_EDITAR = 'painel-editar';

export const idDaEdicao = (id: BlocoDoPainelId, parte: 'bloco' | 'tamanho' | 'menu' | 'adicionar') => `edicao-${parte}-${id}`;

const MARCADO = '[role="radio"][aria-checked="true"]';
const FOCAVEL = 'button:not([disabled]):not([aria-disabled="true"]), [role="button"]:not([aria-disabled="true"]), [role="radio"][aria-checked="true"]';

/**
 * Leva o foco ao primeiro controle ativo da primeira caixa que existir (`ids` em ordem de preferência), depois que a tela
 * se redesenha. Mudar o tamanho, mover, ocultar e adicionar refazem as linhas da grade (a linha tem a chave dos blocos
 * dela) e o controle tocado sai da tela: sem isto o foco cairia no topo da página. Só na web; no celular o leitor de tela
 * segue o anúncio.
 */
export function focarDepois(ids: string[]) {
  if (Platform.OS !== 'web' || typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    for (const id of ids) {
      const caixa = document.getElementById(id);
      // O tamanho escolhido antes do primeiro botão do segmento (o seletor com vírgula pega o primeiro do documento).
      const el = caixa?.matches(FOCAVEL) ? caixa : caixa?.querySelector<HTMLElement>(MARCADO) ?? caixa?.querySelector<HTMLElement>(FOCAVEL);
      if (el) {
        el.focus();
        return;
      }
    }
  });
}

/** Na web o `ref` de uma `View` é o elemento do DOM; aqui sem conversão às cegas. */
export function elementoDaWeb(no: unknown): HTMLElement | null {
  return typeof HTMLElement !== 'undefined' && no instanceof HTMLElement ? no : null;
}

/** Tamanhos que fazem diferença nesta grade (P só, P e M, ou os três); com menos de dois o segmento some. */
export function tamanhosDaGrade(colunas: number): TamanhoDoBloco[] {
  return ([1, 2, 3] as const).filter((t) => t <= colunas);
}
