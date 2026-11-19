import type { PreviaDeGeracao } from '../api/financeiroF1';
import { hojeEmBrasilia } from './financeiro';
import { centavosParaTela } from './formatos';

/**
 * Contratar com início no passado (D10 de `docs/planos/financeiro-em-fases.md`): quando o interruptor dos meses anteriores
 * aparece e o texto da prévia. O app nunca conta mensalidade nem soma valor: quantidade e total vêm da API
 * (`POST /contratacoes/previa-de-geracao`) e aqui só viram texto.
 */

export const ROTULO_GERAR_MESES_ANTERIORES = 'Gerar também as mensalidades dos meses anteriores';
export const AJUDA_GERAR_MESES_ANTERIORES =
  'Desligado, a data de início fica gravada (vale para o tempo mínimo) e as cobranças começam neste mês. Ligado, nascem também as mensalidades dos meses anteriores, em aberto.';
export const PREVIA_CARREGANDO = 'Calculando as mensalidades que vão nascer…';
export const PREVIA_INCOMPLETA = 'Preencha o plano, o valor e o dia do vencimento para ver quantas mensalidades vão nascer.';
export const PREVIA_ERRO = 'Não foi possível calcular as mensalidades que vão nascer.';

/** O início (`AAAA-MM-DD`) é de um mês anterior ao corrente de Brasília? Só então o interruptor aparece. */
export function inicioAntesDoMesCorrente(inicio: string | null | undefined, hoje: string = hojeEmBrasilia()): boolean {
  return !!inicio && inicio.slice(0, 7) < hoje.slice(0, 7);
}

/** `AAAA-MM` (ou `AAAA-MM-DD`) → `MM/AAAA`. */
function competenciaParaTela(c: string): string {
  return `${c.slice(5, 7)}/${c.slice(0, 4)}`;
}

/**
 * "3 mensalidades vão nascer em aberto, total R$ 450,00 (08/2026 a 10/2026)." Quantidade 0: nada nasce além do que já existe.
 * As competências só entram quando a API as manda.
 */
export function textoDaPrevia(p: PreviaDeGeracao): string {
  if (p.quantidade <= 0) return 'Nenhuma mensalidade nova vai nascer: o período já tem cobrança.';
  const quantas = p.quantidade === 1 ? '1 mensalidade vai nascer em aberto' : `${p.quantidade} mensalidades vão nascer em aberto`;
  const de = p.primeiraCompetencia ? competenciaParaTela(p.primeiraCompetencia) : null;
  const ate = p.ultimaCompetencia ? competenciaParaTela(p.ultimaCompetencia) : null;
  const periodo = de && ate ? (de === ate ? ` (${de})` : ` (${de} a ${ate})`) : '';
  return `${quantas}, total ${centavosParaTela(p.totalCentavos)}${periodo}.`;
}
