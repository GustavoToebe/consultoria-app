import type { MetodologiaEmEdicao } from '../../dominio/edicaoMetodologia';
import { nomeDaTecnica } from '../../dominio/metodologia';
import type { Problemas } from '../../dominio/validacaoDeSerie';

/**
 * Como a tela da metodologia lê os problemas de `problemasDaMetodologia` (chaves como `tipos[1].cargaPadrao.percentualMin`):
 * os de cada cartão com a chave relativa a ele, a lista visível acima dos cartões (onde fica cada um, para o toque levar
 * até lá) e o motivo do botão "Salvar modelo". Nada daqui conhece componente.
 */

export type SecaoDaMetodologia = 'tipo' | 'tecnica' | 'combinacao' | 'geral';

export interface LinhaDeProblema {
  chave: string;
  secao: SecaoDaMetodologia;
  /** Posição do tipo, da técnica ou da combinação na lista; nulo nos gerais. */
  indice: number | null;
  /** Chave do cartão que a tela abre e rola até (`tipo:CODIGO`, `tecnica:CLUSTER`, `combinacao:SUPERSET`, `geral`, `tipos`...). */
  alvo: string;
  /** Onde está: `Tipo “WS” · Carga padrão`. */
  onde: string;
  mensagem: string;
}

const RELATIVA = /^(tipos|tecnicas|combinacoes)\[(\d+)\]\.(.+)$/;

/** Os problemas de um item da lista (`tipos`, `tecnicas` ou `combinacoes`) com a chave relativa a ele (`nome`, `cargaPadrao.modo`...). */
export function problemasDoItem(problemas: Problemas, lista: 'tipos' | 'tecnicas' | 'combinacoes', indice: number): Problemas {
  const prefixo = `${lista}[${indice}].`;
  const resultado: Problemas = {};
  for (const [chave, mensagem] of Object.entries(problemas)) if (chave.startsWith(prefixo)) resultado[chave.slice(prefixo.length)] = mensagem;
  return resultado;
}

const ROTULOS_DO_CAMPO: [RegExp, string][] = [
  [/^nome$/, 'Nome'],
  [/^codigo$/, 'Código'],
  [/^papel$/, 'Papel'],
  [/^repeticoes$/, 'Repetições'],
  [/^cargaPadrao/, 'Carga padrão'],
  [/^esforcoPadrao/, 'Esforço padrão'],
  [/^porModalidade\.LIVRE/, 'Peso livre'],
  [/^porModalidade\.MAQUINA/, 'Máquina'],
  [/^porModalidade/, 'Variação por modalidade'],
  [/^regraPercentuais/, 'Regra de percentuais'],
  [/^explicacao$/, 'Explicação'],
  [/^padrao/, 'Padrão'],
];

const GERAIS: Record<string, string> = {
  arredondamentoKg: 'Arredondamento da carga',
  instrucoesTreino: 'Instruções do treino',
  rodapePdf: 'Rodapé do PDF',
};

function rotuloDoCampo(campo: string): string {
  return ROTULOS_DO_CAMPO.find(([padrao]) => padrao.test(campo))?.[1] ?? campo;
}

/** Todos os problemas, na ordem da validação, cada um com o cartão a que pertence. */
export function listaDeProblemas(c: MetodologiaEmEdicao, problemas: Problemas): LinhaDeProblema[] {
  const linhas: LinhaDeProblema[] = [];
  for (const [chave, mensagem] of Object.entries(problemas)) {
    const m = RELATIVA.exec(chave);
    if (m) {
      const indice = Number(m[2]);
      const campo = rotuloDoCampo(m[3]);
      if (m[1] === 'tipos') {
        const t = c.tipos[indice];
        linhas.push({ chave, secao: 'tipo', indice, alvo: `tipo:${t?.codigo ?? indice}`, onde: `Tipo “${t?.nome.trim() || 'sem nome'}” · ${campo}`, mensagem });
      } else if (m[1] === 'tecnicas') {
        const t = c.tecnicas[indice];
        linhas.push({ chave, secao: 'tecnica', indice, alvo: `tecnica:${t?.tipo ?? indice}`, onde: `Técnica “${t?.nome.trim() || (t ? nomeDaTecnica(null, t.tipo) : 'sem nome')}” · ${campo}`, mensagem });
      } else {
        const k = c.combinacoes?.[indice];
        linhas.push({ chave, secao: 'combinacao', indice, alvo: `combinacao:${k?.tipo ?? indice}`, onde: `Combinação “${k?.nome.trim() || 'sem nome'}” · ${campo}`, mensagem });
      }
    } else if (chave === 'tipos') {
      linhas.push({ chave, secao: 'tipo', indice: null, alvo: 'tipos', onde: 'Tipos de série', mensagem });
    } else if (chave === 'tecnicas') {
      linhas.push({ chave, secao: 'tecnica', indice: null, alvo: 'tecnicas', onde: 'Técnicas', mensagem });
    } else if (chave === 'combinacoes') {
      linhas.push({ chave, secao: 'combinacao', indice: null, alvo: 'combinacoes', onde: 'Combinações', mensagem });
    } else {
      linhas.push({ chave, secao: 'geral', indice: null, alvo: 'geral', onde: GERAIS[chave] ?? 'Geral', mensagem });
    }
  }
  return linhas;
}

/** Motivo do "Salvar modelo" travado: quantos problemas e o primeiro, com onde está; `null` sem problema. */
export function motivoDoSalvar(linhas: readonly LinhaDeProblema[]): string | null {
  if (linhas.length === 0) return null;
  const primeira = linhas[0];
  const quantos = linhas.length === 1 ? '1 problema' : `${linhas.length} problemas`;
  return `Corrija ${quantos} da metodologia antes de salvar. Primeiro: ${primeira.onde}: ${primeira.mensagem}`;
}

/** Quantas linhas a lista mostra de início; o resto aparece ao pedir. */
export const LINHAS_VISIVEIS = 6;
