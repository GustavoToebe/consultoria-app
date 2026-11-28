import { inteiroComMilhar, somarDias } from './formatos';
import { hojeEmBrasilia } from './financeiro';
import { diasDoPeriodo, type Periodo } from './filtrosComuns';

/**
 * Atalhos de data dos painéis de filtro (regra única dos filtros, `docs/design-e-front.md` P2, 28/11): chips abaixo do
 * De/Até que preenchem as duas datas. "Hoje" é o de Brasília, não o do aparelho. "Este mês" e "Mês passado" são o mês
 * inteiro (do dia 1 ao último dia), para o vencimento das cobranças, que olha para a frente; "7 dias" e "30 dias" acabam
 * hoje, contando hoje (30 dias = hoje − 29 até hoje). Funções puras.
 */
export type AtalhoDePeriodo = 'HOJE' | 'SETE_DIAS' | 'TRINTA_DIAS' | 'ESTE_MES' | 'MES_PASSADO';

export const ATALHOS_DE_PERIODO: readonly { valor: AtalhoDePeriodo; rotulo: string }[] = [
  { valor: 'HOJE', rotulo: 'Hoje' },
  { valor: 'SETE_DIAS', rotulo: '7 dias' },
  { valor: 'TRINTA_DIAS', rotulo: '30 dias' },
  { valor: 'ESTE_MES', rotulo: 'Este mês' },
  { valor: 'MES_PASSADO', rotulo: 'Mês passado' },
];

function mesInteiro(ano: number, mes: number): { de: string; ate: string } {
  // `mes` de 1 a 12; o dia 0 do mês seguinte é o último deste.
  const de = new Date(Date.UTC(ano, mes - 1, 1));
  const ate = new Date(Date.UTC(ano, mes, 0));
  return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
}

/** O período do atalho, a partir de `hoje` (ISO). */
export function periodoDoAtalho(atalho: AtalhoDePeriodo, hoje: string = hojeEmBrasilia()): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number);
  switch (atalho) {
    case 'HOJE': return { de: hoje, ate: hoje };
    case 'SETE_DIAS': return { de: somarDias(hoje, -6), ate: hoje };
    case 'TRINTA_DIAS': return { de: somarDias(hoje, -29), ate: hoje };
    case 'ESTE_MES': return mesInteiro(ano, mes);
    case 'MES_PASSADO': return mes === 1 ? mesInteiro(ano - 1, 12) : mesInteiro(ano, mes - 1);
  }
}

/** Qual atalho o período é (para o chip aparecer marcado), ou `null` se não é nenhum. */
export function atalhoDoPeriodo(p: Periodo, hoje: string = hojeEmBrasilia()): AtalhoDePeriodo | null {
  if (!p.de || !p.ate) return null;
  return ATALHOS_DE_PERIODO.find((a) => {
    const q = periodoDoAtalho(a.valor, hoje);
    return q.de === p.de && q.ate === p.ate;
  })?.valor ?? null;
}

/** Os atalhos que cabem no limite do filtro (Atualizações aceita no máximo N dias): o que passa do limite não aparece. */
export function atalhosQueCabem(maximoDias: number | undefined, hoje: string = hojeEmBrasilia()): readonly { valor: AtalhoDePeriodo; rotulo: string }[] {
  if (!maximoDias) return ATALHOS_DE_PERIODO;
  return ATALHOS_DE_PERIODO.filter((a) => diasDoPeriodo(periodoDoAtalho(a.valor, hoje)) <= maximoDias);
}

/**
 * O botão principal do painel: "Mostrar 12 importações", "Mostrar 1 importação"; sem número (`null`) enquanto a contagem
 * não chegou ou falhou ("Mostrar importações"): o Aplicar nunca espera a contagem.
 */
export function rotuloDeMostrar(quantos: number | null, itens: { um: string; varios: string }): string {
  if (quantos === null) return `Mostrar ${itens.varios}`;
  return quantos === 1 ? `Mostrar 1 ${itens.um}` : `Mostrar ${inteiroComMilhar(quantos)} ${itens.varios}`;
}
