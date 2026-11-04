import { dataDaTela, dataParaTela, hojeIso } from './formatos';

/**
 * Faixa de datas por tipo de campo (C76, reunião de 30/10: pastas no ano 0260 e "atrasada há 644943 dias"). A regra mora
 * aqui, e não em `dataDaTela`, porque a mesma data é válida num campo e absurda em outro. A API tem o espelho em
 * `web/FaixaDeData.java`: mudou uma, mude a outra.
 *
 * - `PLANEJAMENTO`: o que se agenda ou se planeja (pasta, plano, compromisso, evento, retorno, nova data da atualização,
 *   filtros de período, início da dieta). De 01/01/2000 até 31/12 do ano de hoje + 5.
 * - `REGISTRO`: o que aconteceu (peso, avaliação física, lesão, finalizar pasta) e nascimento. De 01/01/1900 até hoje:
 *   futuro não.
 * - `DATA_COM_FUTURO`: pergunta DATA do questionário sem `somentePassado`. De 01/01/1900 até 31/12 do ano de hoje + 5.
 *
 * "Hoje" é sempre o `hojeIso` do chamador (nos testes, fixo).
 */
export type RegraDeData = 'PLANEJAMENTO' | 'REGISTRO' | 'DATA_COM_FUTURO';

export const ANO_INICIAL_DE_PLANEJAMENTO = 2000;
export const ANO_INICIAL_DE_REGISTRO = 1900;
export const ANOS_A_FRENTE = 5;

/** A pergunta DATA do questionário: só passado (1900 até hoje) ou também o futuro próximo. */
export const regraDaPerguntaData = (somentePassado: boolean | undefined): RegraDeData => (somentePassado === true ? 'REGISTRO' : 'DATA_COM_FUTURO');

/** Primeiro e último dia aceitos (ISO) para a regra, no dia `hoje`. */
export function faixaDaRegra(regra: RegraDeData, hoje: string = hojeIso()): { minimo: string; maximo: string } {
  const ano = Number(hoje.slice(0, 4));
  switch (regra) {
    case 'PLANEJAMENTO': return { minimo: `${ANO_INICIAL_DE_PLANEJAMENTO}-01-01`, maximo: `${ano + ANOS_A_FRENTE}-12-31` };
    case 'REGISTRO': return { minimo: `${ANO_INICIAL_DE_REGISTRO}-01-01`, maximo: hoje };
    case 'DATA_COM_FUTURO': return { minimo: `${ANO_INICIAL_DE_REGISTRO}-01-01`, maximo: `${ano + ANOS_A_FRENTE}-12-31` };
  }
}

/** A data ISO (`AAAA-MM-DD`) está na faixa da regra? */
export function dataNaFaixa(iso: string, regra: RegraDeData, hoje: string = hojeIso()): boolean {
  const { minimo, maximo } = faixaDaRegra(regra, hoje);
  return iso >= minimo && iso <= maximo;
}

/**
 * A mensagem do campo: nomeia o campo e a faixa, e nunca repete o valor digitado.
 * Ex.: "Início da pasta: use uma data entre 01/01/2000 e 31/12/2031".
 */
export function mensagemDaFaixa(rotulo: string, regra: RegraDeData, hoje: string = hojeIso()): string {
  const { minimo, maximo } = faixaDaRegra(regra, hoje);
  return `${rotulo}: use uma data entre ${dataParaTela(minimo)} e ${regra === 'REGISTRO' ? 'hoje' : dataParaTela(maximo)}`;
}

/**
 * O que o campo mostra: nada enquanto a data está vazia ou incompleta (quem salva trava por `dataDaTelaNaFaixa`); com as
 * 10 posições preenchidas, "Data inválida." (31/02) ou a mensagem da faixa.
 */
export function erroDaData(texto: string, rotulo: string, regra: RegraDeData, hoje: string = hojeIso()): string | null {
  const t = texto.trim();
  if (t.length !== 10) return null;
  const iso = dataDaTela(t);
  if (iso === undefined) return 'Data inválida.';
  if (iso !== null && !dataNaFaixa(iso, regra, hoje)) return mensagemDaFaixa(rotulo, regra, hoje);
  return null;
}

/**
 * Como `dataDaTela`, com a faixa: vazio → `null`; incompleta, impossível ou fora da faixa → `undefined` (a tela mostra o
 * erro e não envia). É a troca de uma palavra nos formulários que já tratam o `undefined`.
 */
export function dataDaTelaNaFaixa(texto: string, regra: RegraDeData, hoje: string = hojeIso()): string | null | undefined {
  const iso = dataDaTela(texto);
  if (iso === null || iso === undefined) return iso;
  return dataNaFaixa(iso, regra, hoje) ? iso : undefined;
}
