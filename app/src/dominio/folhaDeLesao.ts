import type { DadosLesao, Lesao, SituacaoLesao } from '../api/tipos';
import { dataDaTelaNaFaixa } from './datasValidas';
import { dataParaTela } from './formatos';

// ficha: folha de lesão (24/11; grade de regiões, lado e datas, 26/11)

/** Tamanho máximo da região na API (`LesaoRequest.regiao`, `@Size(max = 80)`). */
export const LIMITE_DA_REGIAO = 80;
export const LIMITE_DA_DESCRICAO = 500;
export const LIMITE_DA_OBSERVACAO = 500;

/** As regiões da grade; o que não está aqui é "Outra", digitada. Só montam o texto: a API não muda. */
export const REGIOES = ['Ombro', 'Cotovelo', 'Punho', 'Cervical', 'Lombar', 'Quadril', 'Joelho', 'Tornozelo'] as const;
export type RegiaoDoAtalho = (typeof REGIOES)[number];
export const OUTRA = 'Outra';
export type RegiaoEscolhida = RegiaoDoAtalho | typeof OUTRA;
export const OPCOES_DE_REGIAO: readonly RegiaoEscolhida[] = [...REGIOES, OUTRA];

export type LadoDaLesao = 'DIREITO' | 'ESQUERDO' | 'AMBOS';
export const LADOS: { valor: LadoDaLesao; rotulo: string }[] = [
  { valor: 'DIREITO', rotulo: 'Direito' },
  { valor: 'ESQUERDO', rotulo: 'Esquerdo' },
  { valor: 'AMBOS', rotulo: 'Ambos' },
];

/** Coluna não tem lado: Cervical e Lombar não oferecem a escolha (e o texto nunca leva lado). */
const SEM_LADO: readonly string[] = ['Cervical', 'Lombar'];
export const temLado = (regiao: RegiaoEscolhida | null): boolean => regiao !== null && !SEM_LADO.includes(regiao);

/** A região "Outra" leva o lado sem flexionar (o gênero do que se digitou não se sabe): "Antebraço (lado direito)". */
const SUFIXO_DO_LADO: Record<LadoDaLesao, string> = { DIREITO: ' (lado direito)', ESQUERDO: ' (lado esquerdo)', AMBOS: ' (ambos os lados)' };
/** O "Qual região?" deixa espaço para o maior sufixo de lado caber nos 80 da API. */
export const LIMITE_DA_OUTRA = LIMITE_DA_REGIAO - Math.max(...Object.values(SUFIXO_DO_LADO).map((s) => s.length));

/**
 * O texto de uma região da grade: sem região não há nada; região sem lado (ou que não tem lado) é só a região. "Ambos" não
 * flexiona: "Ombro (ambos os lados)".
 */
export function comporRegiao(regiao: RegiaoDoAtalho | null, lado: LadoDaLesao | null): string {
  if (!regiao) return '';
  if (!lado || !temLado(regiao)) return regiao;
  if (lado === 'AMBOS') return `${regiao} (ambos os lados)`;
  return `${regiao} ${lado === 'DIREITO' ? 'direito' : 'esquerdo'}`;
}

/** O texto que vai à API: o da grade, ou o digitado em "Outra" com o sufixo do lado (sem texto, nada). */
export function textoDaRegiao(f: Pick<FormularioDeLesao, 'regiao' | 'lado' | 'outra'>): string {
  if (f.regiao !== OUTRA) return comporRegiao(f.regiao, f.lado);
  const texto = f.outra.trim();
  return texto && f.lado ? texto + SUFIXO_DO_LADO[f.lado] : texto;
}

/**
 * O contrário de `textoDaRegiao`, para a edição abrir com a grade marcada: o texto que uma região da grade reproduz
 * exatamente marca essa região (e o lado); qualquer outro abre em "Outra" com o texto inteiro (e o lado, se termina num
 * sufixo de lado). Assim abrir e salvar sem mexer grava o mesmo texto ("Lombar direita", de antes, vira "Outra").
 */
export function lerRegiao(texto: string): Pick<FormularioDeLesao, 'regiao' | 'lado' | 'outra'> {
  if (texto === '') return { regiao: null, lado: null, outra: '' };
  for (const regiao of REGIOES) {
    for (const lado of [null, ...LADOS.map((l) => l.valor)] as (LadoDaLesao | null)[]) {
      if ((lado === null || temLado(regiao)) && comporRegiao(regiao, lado) === texto) return { regiao, lado, outra: '' };
    }
  }
  for (const { valor } of LADOS) {
    const sufixo = SUFIXO_DO_LADO[valor];
    if (texto.endsWith(sufixo) && texto.length > sufixo.length) return { regiao: OUTRA, lado: valor, outra: texto.slice(0, -sufixo.length) };
  }
  return { regiao: OUTRA, lado: null, outra: texto };
}

/** Tudo o que a folha digita (datas como o campo mostra: DD/MM/AAAA). O texto de "Outra" fica guardado ao trocar de região. */
export interface FormularioDeLesao {
  regiao: RegiaoEscolhida | null;
  lado: LadoDaLesao | null;
  outra: string;
  descricao: string;
  inicio: string;
  fim: string;
  situacao: SituacaoLesao;
  observacao: string;
}

export const LESAO_EM_BRANCO: FormularioDeLesao = { regiao: null, lado: null, outra: '', descricao: '', inicio: '', fim: '', situacao: 'ATIVA', observacao: '' };

/** O Fim só existe na situação "Recuperada". */
export const temFim = (situacao: SituacaoLesao): boolean => situacao === 'RECUPERADA';

export function formularioDaLesao(lesao: Lesao | null): FormularioDeLesao {
  if (!lesao) return LESAO_EM_BRANCO;
  return {
    ...lerRegiao(lesao.regiao),
    descricao: lesao.descricao ?? '',
    inicio: dataParaTela(lesao.dataInicio),
    fim: temFim(lesao.situacao) ? dataParaTela(lesao.dataFim) : '',
    situacao: lesao.situacao,
    observacao: lesao.observacao ?? '',
  };
}

/** Trocar a região: a que não tem lado (Cervical, Lombar) descarta o lado escolhido. */
export function escolherRegiao(f: FormularioDeLesao, regiao: RegiaoEscolhida): FormularioDeLesao {
  return { ...f, regiao, lado: temLado(regiao) ? f.lado : null };
}

/**
 * Trocar a situação: sair de "Recuperada" limpa o Fim (o envio leva `dataFim: null`); entrar com o Fim vazio sugere
 * `sugestao` (a folha passa o fim com que a lesão abriu, senão hoje em Brasília), que a pessoa pode apagar.
 */
export function trocarSituacao(f: FormularioDeLesao, situacao: SituacaoLesao, sugestao: string): FormularioDeLesao {
  if (temFim(f.situacao) === temFim(situacao)) return { ...f, situacao };
  return { ...f, situacao, fim: temFim(situacao) ? sugestao : '' };
}

export const AVISO_FIM_ANTES_DO_INICIO = 'O fim não pode ser antes do início.';

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
  const regiao = textoDaRegiao(f);
  const inicio = dataDaTelaNaFaixa(f.inicio, 'REGISTRO');
  const fim = temFim(f.situacao) ? dataDaTelaNaFaixa(f.fim, 'REGISTRO') : null;
  const fimAntes = typeof inicio === 'string' && typeof fim === 'string' && fim < inicio;
  const erroDoFim = fimAntes ? AVISO_FIM_ANTES_DO_INICIO : null;
  const motivo = f.regiao === null ? 'Escolha a região do corpo'
    : regiao === '' ? 'Escreva qual é a região'
    : regiao.length > LIMITE_DA_REGIAO ? `Encurte a região (até ${LIMITE_DA_REGIAO} caracteres com o lado)`
    : inicio === undefined ? 'Corrija a data de início'
    : fim === undefined || fimAntes ? 'Corrija a data de fim'
    : null;
  if (motivo || inicio === undefined || fim === undefined) return { corpo: null, motivo, erroDoFim };
  return {
    corpo: {
      regiao,
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

/** Algo diferente do que a folha abriu? Compara o texto da região, não os botões. Só com isso o fechar pergunta "Sair sem salvar?". */
export function lesaoAlterada(inicial: FormularioDeLesao, atual: FormularioDeLesao): boolean {
  return inicial.regiao !== atual.regiao || textoDaRegiao(inicial) !== textoDaRegiao(atual) || inicial.descricao !== atual.descricao
    || inicial.inicio !== atual.inicio || inicial.situacao !== atual.situacao || inicial.observacao !== atual.observacao || inicial.fim !== atual.fim;
}

/**
 * Colunas das grades de região e de lado (3 por linha, alinhadas uma sob a outra), pela largura medida da grade: a célula
 * precisa caber "Tornozelo" (o nome mais largo, ~66 px a 14 px em semi-negrito, medido) mais o recuo; o ✓ desce para cima
 * do nome quando não cabe ao lado. Abaixo disso (o texto ampliado aumenta a conta) cai para `reserva` colunas; nunca menos de 1.
 */
const NOME_MAIS_LARGO = 68;
const RECUO_DA_CELULA = 16;
export function colunasDaGrade(largura: number, fatorTexto: number, reserva: 1 | 2, vao: number): 1 | 2 | 3 {
  const cabe = (n: number) => largura >= n * (NOME_MAIS_LARGO * fatorTexto + RECUO_DA_CELULA) + (n - 1) * vao;
  if (cabe(3)) return 3;
  return reserva === 2 && cabe(2) ? 2 : 1;
}
