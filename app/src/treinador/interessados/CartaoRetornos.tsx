import type { RetornoPendente } from '../../api/inscricoesTipos';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela } from '../../dominio/formatos';
import { seloDoRetorno } from '../../dominio/inscricoes';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';

/** Quantos retornos o cartão mostra (os mais antigos primeiro); o resto aparece na folha de cada inscrição. */
const MAXIMO = 8;

/**
 * Só os retornos atrasados ou de hoje (os que levam selo), como os conta o Início: `?retornos=ATE_HOJE` na tela Interessados.
 */
export function retornosAteHoje(retornos: readonly RetornoPendente[], hoje: string): RetornoPendente[] {
  return retornos.filter((r) => seloDoRetorno(r.data, hoje) !== null);
}

/**
 * Retornos pendentes das inscrições em atendimento, do mais antigo ao mais novo: atrasado em vermelho, hoje em âmbar.
 * Tocar abre a inscrição. Some quando não há nenhum. `todos` tira o limite de {@link MAXIMO} (a lista filtrada pelo
 * endereço é a própria fila do dia, então mostra todos os que vieram).
 */
export function CartaoRetornos({ retornos, todos = false, aoAbrir }: {
  retornos: readonly RetornoPendente[] | undefined;
  todos?: boolean;
  aoAbrir: (inscricaoId: string) => void;
}) {
  if (!retornos || retornos.length === 0) return null;
  const hoje = hojeEmBrasilia();
  const visiveis = todos ? retornos : retornos.slice(0, MAXIMO);
  const atrasados = retornos.filter((r) => r.data < hoje).length;
  return (
    <Cartao titulo="Retornos" descricao={`${retornos.length} ${retornos.length === 1 ? 'pendente' : 'pendentes'}${atrasados ? `, ${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'}` : ''}.`}>
      <ListaDeLinhas>
        {visiveis.map((r) => {
          const selo = seloDoRetorno(r.data, hoje);
          return (
            <LinhaDaLista key={r.id} titulo={r.inscricaoNome}
              metadados={`${dataParaTela(r.data)} · ${r.responsavelNome ?? 'Sem responsável'}`}
              descricao={r.descricao}
              selos={selo ? [selo] : undefined}
              aoTocarTextos={() => aoAbrir(r.inscricaoId)}
              acoes={<Botao rotulo="Abrir" rotuloAcessivel={`Abrir inscrição de ${r.inscricaoNome}`} tipo="secundario" aoTocar={() => aoAbrir(r.inscricaoId)} />} />
          );
        })}
      </ListaDeLinhas>
    </Cartao>
  );
}
