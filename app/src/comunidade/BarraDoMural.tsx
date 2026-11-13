import { chipsDoMural, MURAL_SEM_FILTRO, opcoesDoTipoDoMural, semOFiltroDoMural, type ChaveDoFiltroDoMural, type FiltroDoMural } from '../dominio/comunidade';
import { BarraDeFiltros, GrupoDoPainel } from '../ui/BarraDeFiltros';
import { CaixaSelecao } from '../ui/CaixaSelecao';
import { Escolha } from '../ui/Escolha';

/**
 * Busca de uma linha (sempre à vista) e o botão "Filtros" com o painel "Filtros do mural" (`docs/planos/filtros-laterais.md`):
 * tipo de publicação e, só para quem modera, "Só denunciadas"; os dois combinam. A tela atrasa a busca (`useAtrasado`)
 * antes de pedir à API; o filtro vale no "Aplicar filtros" e cada etiqueta tirada vale na hora.
 */
export function BarraDoMural({ filtro, aoFiltrar, busca, aoBuscar, comDenunciados }: {
  filtro: FiltroDoMural;
  aoFiltrar: (f: FiltroDoMural) => void;
  busca: string;
  aoBuscar: (b: string) => void;
  comDenunciados: boolean;
}) {
  return (
    <BarraDeFiltros busca={{ valor: busca, aoMudar: aoBuscar, rotulo: 'Buscar na comunidade', placeholder: 'Palavra da publicação' }}
      valor={filtro} aoAplicar={aoFiltrar} limpo={MURAL_SEM_FILTRO} chips={chipsDoMural(filtro)}
      aoTirar={(chave) => aoFiltrar(semOFiltroDoMural(filtro, chave as ChaveDoFiltroDoMural))}
      rotuloDoResultado="Ver publicações" painelLateral={{ titulo: 'Filtros do mural' }}
      seletores={(atuais, mudar) => <>
        <GrupoDoPainel titulo="Identificação" primeiro>
          <Escolha rotulo="Tipo de publicação" chips valor={atuais.tipo} aoMudar={(tipo) => mudar({ ...atuais, tipo })} opcoes={opcoesDoTipoDoMural()} />
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
