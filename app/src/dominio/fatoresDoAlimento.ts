/**
 * Fator de correção (FC = peso bruto ÷ peso líquido) e fator de cocção (FCc = peso pronto ÷ peso cru) do alimento da
 * biblioteca. Só a lista de compras do aluno os usa. O catálogo público já traz fator em parte dos alimentos
 * (V027); a importação copia e o treinador pode mudar. Opcionais: vazio = não informado, nunca 1. Faixas iguais às do servidor
 * (`BibliotecaService.exigirFatores` e o CHECK da V011).
 */

export const FC_MINIMO = 1;
export const FC_MAXIMO = 20;
export const FCC_MINIMO = 0.1;
export const FCC_MAXIMO = 10;

/** Ajuda curta embaixo de cada campo do formulário. */
export const AJUDA_FC = 'Peso bruto ÷ peso limpo. Ex.: 1,75 = para 1 kg limpo, compre 1,75 kg. Vazio = não usar.';
export const AJUDA_FCC = 'Peso pronto ÷ peso cru. Ex.: 2,5 = 100 g cru rendem 250 g prontos. Vazio = não usar.';

const duasCasas = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-9;
const tela = (n: number) => String(n).replace('.', ',');

function erroDaFaixa(valor: number | null, minimo: number, maximo: number): string | null {
  if (valor === null) return null;
  if (valor < minimo || valor > maximo) return `Use um valor de ${tela(minimo)} a ${tela(maximo)}.`;
  if (!duasCasas(valor)) return 'Use no máximo duas casas decimais.';
  return null;
}

/** Mensagem do campo "Fator de correção"; `null` quando vazio ou válido. */
export function erroDoFatorCorrecao(valor: number | null): string | null {
  return erroDaFaixa(valor, FC_MINIMO, FC_MAXIMO);
}

/** Mensagem do campo "Fator de cocção"; `null` quando vazio ou válido. */
export function erroDoFatorCoccao(valor: number | null): string | null {
  return erroDaFaixa(valor, FCC_MINIMO, FCC_MAXIMO);
}

/** "FC 1,75 · FCc 2,5" na lista da biblioteca; sem nenhum fator, `null` e nada aparece. */
export function textoDosFatores(a: { fatorCorrecao: number | null; fatorCoccao: number | null }): string | null {
  const partes = [a.fatorCorrecao !== null ? `FC ${tela(a.fatorCorrecao)}` : null, a.fatorCoccao !== null ? `FCc ${tela(a.fatorCoccao)}` : null];
  const texto = partes.filter(Boolean).join(' · ');
  return texto || null;
}
