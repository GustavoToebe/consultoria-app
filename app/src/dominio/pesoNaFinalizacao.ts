import type { Atualizacao, RegistroPeso } from '../api/tipos';
import { dataSemAnoCorrente } from './datasRelativas';
import { hojeIso, numeroParaTela } from './formatos';

/**
 * Peso na finalização da pasta (reunião de 30/10): a atualização enviada já grava o peso respondido na data dela
 * (`AtualizacaoService`, só com a pergunta PESO respondida). A folha "Finalizar" mostra esse peso para o treinador não
 * digitar de novo, nunca o copia para o campo e avisa quando um peso novo na mesma data vai substituí-lo.
 */
type Peso = Pick<RegistroPeso, 'data' | 'pesoKg'>;

/**
 * Data em que a atualização gravou o peso: a `dataAtualizacao`, mas só depois de enviada. Numa atualização ainda aberta
 * a data é o fim da pasta, e um peso lançado à mão nesse dia não é "da atualização".
 */
export function dataDoPesoDaAtualizacao(a: Pick<Atualizacao, 'dataAtualizacao' | 'enviadaEm'> | null | undefined): string | null {
  return a?.enviadaEm && a.dataAtualizacao ? a.dataAtualizacao.slice(0, 10) : null;
}

/** O peso registrado na data da atualização, ou `null` (sem data ou sem peso naquele dia). */
export function pesoDaAtualizacao<T extends Peso>(pesos: readonly T[] | null | undefined, dataAtualizacao: string | null | undefined): T | null {
  if (!pesos || !dataAtualizacao) return null;
  const dia = dataAtualizacao.slice(0, 10);
  return pesos.find((p) => p.data.slice(0, 10) === dia) ?? null;
}

/** "Peso já registrado na data da atualização: 82,4 kg em 20/10" (ano só quando é outro). */
export function textoDoPesoDaAtualizacao(peso: Peso, hoje: string = hojeIso()): string {
  return `Peso já registrado na data da atualização: ${numeroParaTela(peso.pesoKg, 1)} kg em ${dataSemAnoCorrente(peso.data.slice(0, 10), hoje)}`;
}

/**
 * O peso novo vai substituir o da atualização? Só com um peso digitado e a data escolhida igual à do peso registrado
 * (a API guarda um peso por dia e o novo toma o lugar do antigo). `dataEscolhida` é ISO (`aaaa-mm-dd`); data
 * vazia ou inválida não avisa.
 */
export function substituiPesoDaAtualizacao(dataEscolhida: string | null | undefined, pesoRegistrado: Peso | null, pesoDigitado: number | null): boolean {
  if (pesoDigitado === null || !pesoRegistrado || !dataEscolhida) return false;
  return dataEscolhida.slice(0, 10) === pesoRegistrado.data.slice(0, 10);
}
