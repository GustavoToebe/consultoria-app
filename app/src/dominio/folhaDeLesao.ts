import type { DadosLesao, Lesao, SituacaoLesao } from '../api/tipos';
import { dataDaTelaNaFaixa } from './datasValidas';
import { dataParaTela } from './formatos';

// ficha: folha de lesão (24/11)

/** Tamanho máximo da região na API (`LesaoRequest.regiao`, `@Size(max = 80)`). */
export const LIMITE_DA_REGIAO = 80;
export const LIMITE_DA_DESCRICAO = 500;
export const LIMITE_DA_OBSERVACAO = 500;

/** Atalhos de região (o treinador digita outra coisa quando não está aqui). Só preenchem o texto: a API não muda. */
export const REGIOES = ['Ombro', 'Cotovelo', 'Punho', 'Cervical', 'Lombar', 'Quadril', 'Joelho', 'Tornozelo'] as const;
export type RegiaoDoAtalho = (typeof REGIOES)[number];

export type LadoDaLesao = 'DIREITO' | 'ESQUERDO' | 'AMBOS';
export const LADOS: { valor: LadoDaLesao; rotulo: string }[] = [
  { valor: 'DIREITO', rotulo: 'Direito' },
  { valor: 'ESQUERDO', rotulo: 'Esquerdo' },
  { valor: 'AMBOS', rotulo: 'Ambos' },
];

/** Cervical e Lombar são femininas: "Lombar direita". "Ambos" não flexiona: "Ombro (ambos os lados)". */
const REGIOES_FEMININAS: readonly string[] = ['Cervical', 'Lombar'];

/**
 * O texto que vai para o campo "Região do corpo": sem região escolhida não há nada (o lado sozinho não preenche); região
 * sem lado é só a região; trocar a região recompõe com o mesmo lado, sem duplicá-lo.
 */
export function comporRegiao(regiao: RegiaoDoAtalho | null, lado: LadoDaLesao | null): string {
  if (!regiao) return '';
  if (!lado) return regiao;
  if (lado === 'AMBOS') return `${regiao} (ambos os lados)`;
  const feminina = REGIOES_FEMININAS.includes(regiao);
  const palavra = lado === 'DIREITO' ? (feminina ? 'direita' : 'direito') : (feminina ? 'esquerda' : 'esquerdo');
  return `${regiao} ${palavra}`;
}

/**
 * O contrário de `comporRegiao`: o atalho (e o lado) que o texto digitado reproduz exatamente, para os chips acompanharem
 * o que se digita à mão e para a edição de uma lesão já gravada abrir com os chips marcados. Texto livre = sem atalho.
 */
export function lerRegiao(texto: string): { regiao: RegiaoDoAtalho | null; lado: LadoDaLesao | null } {
  for (const regiao of REGIOES) {
    for (const lado of [null, ...LADOS.map((l) => l.valor)] as (LadoDaLesao | null)[]) {
      if (comporRegiao(regiao, lado) === texto) return { regiao, lado };
    }
  }
  return { regiao: null, lado: null };
}

/** Tudo o que a folha digita (datas como o campo mostra: DD/MM/AAAA). */
export interface FormularioDeLesao {
  regiao: string;
  descricao: string;
  inicio: string;
  fim: string;
  situacao: SituacaoLesao;
  observacao: string;
}

export const LESAO_EM_BRANCO: FormularioDeLesao = { regiao: '', descricao: '', inicio: '', fim: '', situacao: 'ATIVA', observacao: '' };

export function formularioDaLesao(lesao: Lesao | null): FormularioDeLesao {
  if (!lesao) return LESAO_EM_BRANCO;
  return {
    regiao: lesao.regiao,
    descricao: lesao.descricao ?? '',
    inicio: dataParaTela(lesao.dataInicio),
    fim: dataParaTela(lesao.dataFim),
    situacao: lesao.situacao,
    observacao: lesao.observacao ?? '',
  };
}

/** O Fim só existe na situação "Recuperada". */
export const temFim = (situacao: SituacaoLesao): boolean => situacao === 'RECUPERADA';

export const AVISO_FIM_ANTES_DO_INICIO = 'O fim vem antes do início.';

export interface AnaliseDaLesao {
  /** O corpo do envio; `null` enquanto algo impede de salvar. */
  corpo: DadosLesao | null;
  /** Por que o Salvar está apagado (a primeira coisa que falta); `null` quando pode salvar. */
  motivo: string | null;
  /** Erro do campo Fim: fim antes do início (o das datas fora da faixa quem mostra é o `CampoData`). */
  erroDoFim: string | null;
}

/**
 * Confere o formulário. Fora da situação "Recuperada" o Fim não vale: não trava o Salvar e o corpo leva `dataFim: null`
 * (o PUT substitui o registro inteiro, então `null` é o que apaga um fim que existia). Datas: faixa de REGISTRO, a mesma
 * que o `CampoData` mostra no campo.
 */
export function analisarLesao(f: FormularioDeLesao): AnaliseDaLesao {
  const inicio = dataDaTelaNaFaixa(f.inicio, 'REGISTRO');
  const fim = temFim(f.situacao) ? dataDaTelaNaFaixa(f.fim, 'REGISTRO') : null;
  const fimAntes = typeof inicio === 'string' && typeof fim === 'string' && fim < inicio;
  const erroDoFim = fimAntes ? AVISO_FIM_ANTES_DO_INICIO : null;
  const motivo = f.regiao.trim() === '' ? 'Informe a região do corpo'
    : inicio === undefined ? 'Corrija a data de início'
    : fim === undefined || fimAntes ? 'Corrija a data de fim'
    : null;
  if (motivo || inicio === undefined || fim === undefined) return { corpo: null, motivo, erroDoFim };
  return {
    corpo: {
      regiao: f.regiao.trim(),
      descricao: f.descricao.trim() || null,
      dataInicio: inicio,
      dataFim: fim,
      situacao: f.situacao,
      observacao: f.observacao.trim() || null,
    },
    motivo: null,
    erroDoFim,
  };
}

/** Algo diferente do que a folha abriu? (o Fim escondido não conta). Só com isso o fechar pergunta "Sair sem salvar?". */
export function lesaoAlterada(inicial: FormularioDeLesao, atual: FormularioDeLesao): boolean {
  const fimDe = (f: FormularioDeLesao) => (temFim(f.situacao) ? f.fim : '');
  return inicial.regiao !== atual.regiao || inicial.descricao !== atual.descricao || inicial.inicio !== atual.inicio
    || inicial.situacao !== atual.situacao || inicial.observacao !== atual.observacao || fimDe(inicial) !== fimDe(atual);
}
