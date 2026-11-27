import type { ReactNode } from 'react';

import { chipsDoMural, MURAL_SEM_FILTRO, semOFiltroDoMural, type ChaveDoFiltroDoMural, type FiltroDoMural } from '../dominio/comunidade';
import { type AbaDoMural, opcoesDoTipoNaAba } from '../dominio/muralEmAbas';
import { BarraDeFiltros, GrupoDoPainel } from '../ui/BarraDeFiltros';
import { CaixaSelecao } from '../ui/CaixaSelecao';
import { Escolha } from '../ui/Escolha';

/**
 * Busca de uma linha (sempre à vista) e o botão "Filtros" com o painel "Filtros do mural" (`docs/planos/filtros-laterais.md`):
 * tipo de publicação e, só para quem modera, "Só denunciadas"; os dois combinam. A tela atrasa a busca (`useAtrasado`)
 * antes de pedir à API; o filtro vale no "Aplicar filtros" e cada etiqueta tirada vale na hora. O tipo lista só os da
 * `aba` (Avisos ou Alunos, C39); a tela passa o filtro já valendo na aba (`filtroNaAba`).
 */
export function BarraDoMural({ aba, filtro, aoFiltrar, busca, aoBuscar, comDenunciados, depois }: {
  aba: AbaDoMural;
  filtro: FiltroDoMural;
  aoFiltrar: (f: FiltroDoMural) => void;
  busca: string;
  aoBuscar: (b: string) => void;
  comDenunciados: boolean;
  /** Na mesma linha, logo depois do "Filtros" (o "Nova publicação" do aluno na web); as etiquetas ficam embaixo da linha toda. */
  depois?: ReactNode;
}) {
  return (
    <BarraDeFiltros busca={{ valor: busca, aoMudar: aoBuscar, rotulo: 'Buscar na comunidade', placeholder: 'Palavra da publicação', inputMode: 'search' }}
      valor={filtro} aoAplicar={aoFiltrar} limpo={MURAL_SEM_FILTRO} chips={chipsDoMural(filtro)}
      aoTirar={(chave) => aoFiltrar(semOFiltroDoMural(filtro, chave as ChaveDoFiltroDoMural))}
      painelLateral={{ titulo: 'Filtros do mural' }} depois={depois}
      seletores={(atuais, mudar) => <>
        <GrupoDoPainel titulo="Identificação" primeiro>
          <Escolha rotulo="Tipo de publicação" chips valor={atuais.tipo} aoMudar={(tipo) => mudar({ ...atuais, tipo })} opcoes={opcoesDoTipoNaAba(aba)} />
        </GrupoDoPainel>
        {comDenunciados ? (
          <GrupoDoPainel titulo="Situação">
            <CaixaSelecao rotulo="Só denunciadas" ajuda="Publicações com alguma denúncia."
              marcado={atuais.denunciados} aoMudar={(denunciados) => mudar({ ...atuais, denunciados })} />
          </GrupoDoPainel>
        ) : null}
      </>} />
  );
}
