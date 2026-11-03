import type { Atualizacao, RegistroPeso } from '../api/tipos';
import { dataSemAnoCorrente } from './datasRelativas';
import { hojeIso, numeroParaTela } from './formatos';

/**
 * Peso na finalização da pasta (reunião de 30/10): a atualização enviada já grava o peso respondido na data dela
 * (`AtualizacaoService`, só com a pergunta PESO respondida). A folha "Finalizar" mostra esse peso e avisa quando um peso
 * novo na mesma data vai substituí-lo. Desde a D8 (02/11) o campo já nasce com o peso da atualização da pasta (rota
 * `peso-sugerido`, `podeSugerirPeso` em `publicarPasta.ts`) e a data dela, editáveis. Decisão do Gustavo (02/11): sem
 * edição (mesmo valor, a data da atualização e sem observação) finalizar **não grava peso**, porque a atualização já o
 * registrou na data dela; mudou o valor, a data ou escreveu observação, grava como qualquer peso novo (na data da
 * atualização, substitui o registro dela).
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

/** O que está no formulário "Finalizar" (datas ISO; `dataIso` `undefined` = data inválida no campo). */
export interface FormularioDaFinalizacao {
  /** `ALUNO_SENSIVEL_ALTERAR`: sem ela o peso nunca vai. */
  podeGravarPeso: boolean;
  /** Peso sugerido pela atualização da pasta; `null` = sem sugestão (sem permissão, rota falhou ou sem peso). */
  sugerido: number | null;
  /** Peso no campo (número: "90" e "90,0" são o mesmo). */
  peso: number | null;
  dataIso: string | null | undefined;
  /** Data com que o campo nasceu: `dataInicialDoPeso`. */
  dataInicial: string;
  observacao: string;
}

/**
 * Data com que o campo "Data do peso" nasce (ISO): com peso sugerido, a data da atualização (a do peso sugerido); sem
 * sugestão (ou sugestão sem data), hoje.
 */
export function dataInicialDoPeso(sugestao: { pesoKg: number | null; data: string | null } | null | undefined, hoje: string = hojeIso()): string {
  return sugestao && sugestao.pesoKg !== null && sugestao.data ? sugestao.data.slice(0, 10) : hoje;
}

/**
 * A sugestão de peso que chega depois de a Folha abrir só PREENCHE os campos se a pessoa ainda não mexeu em peso, data ou
 * observação antes de ela chegar (`mexeuAntesDeChegar`). Se mexeu, nenhum campo recebe a sugestão (vale para todos ou para
 * nenhum: preencher só o que sobrou trocaria a data debaixo de quem digitou o peso). Quem chama marca `mexeuAntesDeChegar`
 * só enquanto a resposta não chegou; depois disso a decisão não muda e mexer num campo preenchido é edição normal.
 */
export function sugestaoParaPreencher<T>(sugestao: T | null | undefined, mexeuAntesDeChegar: boolean): T | null {
  return mexeuAntesDeChegar ? null : sugestao ?? null;
}

const mesmoNumero = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** O peso sugerido ficou como veio: mesmo valor, a data que o campo trouxe e sem observação (que só vai com peso). */
export function pesoSugeridoSemEdicao(f: FormularioDaFinalizacao): boolean {
  return f.sugerido !== null && f.peso !== null && mesmoNumero(f.peso, f.sugerido)
    && f.dataIso === f.dataInicial && f.observacao.trim() === '';
}

/**
 * Corpo do `POST /pastas/{id}/finalizar`: sem peso (tudo nulo) quando não pode gravar, o campo está vazio ou o peso
 * sugerido não foi editado (a atualização já o gravou); senão, peso, data e observação.
 */
export function corpoDaFinalizacao(f: FormularioDaFinalizacao): { data: string | null; pesoKg: number | null; observacao: string | null } {
  if (!f.podeGravarPeso || f.peso === null || pesoSugeridoSemEdicao(f)) return { data: null, pesoKg: null, observacao: null };
  return { data: f.dataIso ?? null, pesoKg: f.peso, observacao: f.observacao.trim() || null };
}

/** "90 kg, da atualização de 20/10 (já registrado)" (ano só quando é outro). */
export function notaDoPesoJaRegistrado(pesoKg: number, dataIso: string | null, hoje: string = hojeIso()): string {
  const quando = dataIso ? ` de ${dataSemAnoCorrente(dataIso.slice(0, 10), hoje)}` : '';
  return `${numeroParaTela(pesoKg, 1)} kg, da atualização${quando} (já registrado)`;
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
