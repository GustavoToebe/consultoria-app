import type { FotoDaLinha } from '../api/tipos';
import { datasDaPosicao, diasEntre, posicoesDe, type PosicaoDasFotos } from './comparacaoDeFotos';
import { numeroParaTela, SEM_DADO } from './formatos';
import { pesoComCasas } from './variacaoDoPeso';

/** Proporção usada antes de a foto carregar: retrato 3:4, o da câmera do celular em pé (a mesma da comparação). */
export const PROPORCAO_PADRAO = 3 / 4;
/** Deslize horizontal mínimo, em px, para trocar de foto no celular. */
export const DESLIZE_MINIMO = 48;
export const MOTIVO_SEM_PAR = 'Só há fotos de uma data neste ângulo.';

/** Ordem do visualizador: da mais antiga à mais nova; na mesma data, a ordem do envio. */
export function fotosEmOrdem(fotos: readonly FotoDaLinha[]): FotoDaLinha[] {
  return [...fotos].sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.fotoId.localeCompare(b.fotoId));
}

/** Posição da foto na lista; a que saiu da lista (recarga) volta para a primeira. */
export function indiceDaFoto(fotos: readonly FotoDaLinha[], fotoId: string): number {
  return Math.max(0, fotos.findIndex((f) => f.fotoId === fotoId));
}

/** Índice vizinho sem dar a volta: nas pontas não há para onde ir (`null`). */
export function vizinho(indice: number, total: number, passo: -1 | 1): number | null {
  const seguinte = indice + passo;
  return seguinte < 0 || seguinte >= total ? null : seguinte;
}

export const textoDaPosicao = (indice: number, total: number) => `${indice + 1} de ${total}`;

/** Deslizar para a esquerda leva à próxima (mais nova); para a direita, à anterior. Pouco movimento não troca. */
export function passoDoDeslize(deslocamentoX: number): -1 | 1 | 0 {
  if (deslocamentoX <= -DESLIZE_MINIMO) return 1;
  if (deslocamentoX >= DESLIZE_MINIMO) return -1;
  return 0;
}

export const pesoDaFoto = (foto: FotoDaLinha) => (foto.pesoKg == null ? SEM_DADO : `${numeroParaTela(foto.pesoKg)} kg`);

/** Hoje só o aluno envia foto de evolução: na anamnese ou na atualização. */
export const quemEnviou = (foto: FotoDaLinha) => (foto.origem === 'ANAMNESE' ? 'Aluno, na anamnese' : 'Aluno, na atualização');

/** O ângulo (a pergunta de foto: Frente, Lado, Costas) da foto, com as fotos dele em todas as datas. */
export function grupoDaFoto(fotos: readonly FotoDaLinha[], fotoId: string): PosicaoDasFotos | undefined {
  return posicoesDe(fotos).find((g) => g.fotos.some((f) => f.fotoId === fotoId));
}

export interface ParDeDatas {
  antes: string;
  depois: string;
}

/** Comparar abre na primeira e na mais recente data do mesmo ângulo; com uma data só não há par. */
export function parPadrao(grupo: PosicaoDasFotos | undefined): ParDeDatas | null {
  const datas = grupo ? datasDaPosicao(grupo.fotos) : [];
  return datas.length < 2 ? null : { antes: datas[0], depois: datas[datas.length - 1] };
}

/**
 * Diferença do par, sempre da data mais antiga para a mais nova: `62 dias · peso −2,4 kg`. Sem o peso de uma das duas,
 * `peso —`; na mesma data, `Mesma data`. Neutra: subir ou descer de peso só tem sentido com a meta.
 */
export function textoDaDiferencaDoPar(a: FotoDaLinha, b: FotoDaLinha): string {
  const [de, ate] = a.data <= b.data ? [a, b] : [b, a];
  const dias = diasEntre(de.data, ate.data);
  const tempo = dias === 0 ? 'Mesma data' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  if (de.pesoKg == null || ate.pesoKg == null) return `${tempo} · peso ${SEM_DADO}`;
  const delta = Math.round((ate.pesoKg - de.pesoKg) * 100) / 100;
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${tempo} · peso ${sinal}${pesoComCasas(Math.abs(delta))} kg`;
}

/** Maior caixa com a proporção da foto (largura ÷ altura) que cabe na área: a foto inteira, sem cortar nem esticar. */
export function caixaQueCabe(largura: number, altura: number, proporcao: number | null): { largura: number; altura: number } {
  const p = proporcao && proporcao > 0 ? proporcao : PROPORCAO_PADRAO;
  return {
    largura: Math.max(1, Math.floor(Math.min(largura, altura * p))),
    altura: Math.max(1, Math.floor(Math.min(altura, largura / p))),
  };
}

/** Altura que as fotos do par usam juntas: a mais larga cabe na coluna, e as duas ficam da mesma altura. */
export function alturaComum(largura: number, altura: number, proporcoes: readonly (number | null)[]): number {
  const limites = proporcoes.map((p) => largura / (p && p > 0 ? p : PROPORCAO_PADRAO));
  return Math.max(1, Math.floor(Math.min(altura, ...limites)));
}
