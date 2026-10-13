import type { OpcaoQuestionario } from '../api/tipos';

export interface OpcaoDoSeletor {
  valor: string | null;
  rotulo: string;
  detalhe?: string;
}

/** Primeira opção é a "sem escolha" (`null`); depois os questionários publicados e ativos, o padrão marcado. */
export function opcoesDoSeletor(opcoes: readonly OpcaoQuestionario[], rotuloDoNulo: string): OpcaoDoSeletor[] {
  return [
    { valor: null, rotulo: rotuloDoNulo },
    ...opcoes.map((o) => ({ valor: o.id, rotulo: o.nome, detalhe: o.padrao ? 'Padrão da consultoria' : undefined })),
  ];
}

/**
 * Texto do valor atual. Escolhido que não está mais entre as opções (foi arquivado depois) não vale mais: a API
 * resolve como se não houvesse escolha, e o texto diz isso em vez de mostrar um nome que não está em uso.
 */
export function textoDoQuestionarioEscolhido(valor: string | null | undefined, opcoes: readonly OpcaoQuestionario[], rotuloDoNulo: string): string {
  if (!valor) return rotuloDoNulo;
  const achada = opcoes.find((o) => o.id === valor);
  return achada ? achada.nome : `Arquivado; vale: ${rotuloDoNulo}`;
}
