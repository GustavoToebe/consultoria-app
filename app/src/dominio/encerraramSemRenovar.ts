import type { VisaoGeralDoFinanceiro } from '../api/financeiroTipos';
import { centavosParaTela, dataParaTela } from './formatos';

/**
 * "Encerraram sem renovar" na Visão geral (Gustavo, 23/11): parcela única ATIVA cujo término passou há até 30 dias. É um
 * grupo à parte das renovações próximas (nunca somado a elas); a API decide quem entra e a tela só escreve. Sem ninguém,
 * o grupo não aparece (nada de cartão vazio). A lista da API tem até 50 itens: o que passar disso vira "e mais N".
 */
export const TITULO_ENCERRARAM = 'Encerraram sem renovar';
export const DESCRICAO_ENCERRARAM = 'Parcela única que terminou nos últimos 30 dias, sem um plano novo.';

export interface LinhaEncerrada {
  chave: string;
  alunoId: string;
  titulo: string;
  /** "R$ 700,00". */
  detalhe: string;
  /** "Encerrado em 13/11/2026": o selo âmbar da linha. */
  selo: string;
  rotulo: string;
}

export interface GrupoEncerraram {
  /** "2 planos". */
  resumo: string;
  linhas: LinhaEncerrada[];
  /** Quantos passam da lista devolvida; 0 = nenhum. */
  resto: number;
}

export function grupoEncerraramSemRenovar(
  d: Pick<VisaoGeralDoFinanceiro, 'encerraramSemRenovarCount' | 'encerraramSemRenovar'> | null | undefined,
): GrupoEncerraram | null {
  const itens = d?.encerraramSemRenovar ?? [];
  if (!d || itens.length === 0) return null;
  const total = Math.max(d.encerraramSemRenovarCount, itens.length);
  return {
    resumo: `${total} ${total === 1 ? 'plano' : 'planos'}`,
    resto: total - itens.length,
    linhas: itens.map((i) => {
      const nome = i.alunoNome ?? '—';
      const selo = `Encerrado em ${dataParaTela(i.terminoVigencia)}`;
      return {
        chave: i.contratacaoId, alunoId: i.alunoId, titulo: nome, detalhe: centavosParaTela(i.valorCentavos), selo,
        rotulo: `Abrir ficha de ${i.alunoNome ?? 'aluno'}, plano ${selo.toLocaleLowerCase('pt-BR')}, ${centavosParaTela(i.valorCentavos)}`,
      };
    }),
  };
}
