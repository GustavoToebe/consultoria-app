/**
 * Imagem ou GIF de demonstração do exercício: regras puras. O que aparece, nesta ordem: a imagem própria que o
 * treinador enviou, depois as fotos do catálogo (duas, que alternam), depois nada (sem espaço vazio). O vídeo do
 * treinador continua um link, fora daqui.
 */

/** Os mesmos tetos do servidor (`ExercicioImagemService.BYTES_MAXIMOS` e `LADO_MAXIMO`). */
export const LIMITES_IMAGEM_EXERCICIO = {
  bytesMaximo: 1_000_000,
  ladoMaximo: 800,
  /** Lados tentados na redução de JPEG e PNG, do maior para o menor, até caber em `bytesMaximo`. */
  lados: [800, 640, 480, 360],
} as const;

/** Tempo de cada foto do catálogo antes de passar para a outra. */
export const INTERVALO_ALTERNANCIA_MS = 800;

export type ComDemonstracao = {
  /** Caminhos das fotos do catálogo (`<id>/0.jpg`), vazio sem origem no catálogo. */
  imagens?: readonly string[] | null;
  /** Quando a imagem própria foi enviada; nulo = não tem. Serve também para renovar o que o aparelho guardou. */
  imagemPropriaEm?: string | null;
};

export type Demonstracao =
  | { tipo: 'PROPRIA'; versao: string }
  | { tipo: 'CATALOGO'; caminhos: readonly string[] };

const CAMINHO_DE_FOTO = /^[A-Za-z0-9_-]+\/[01]\.jpg$/;

/**
 * Só aceita o formato que o script do catálogo gera: o caminho vira parte de uma URL do próprio site, então nada de
 * `..`, barra extra ou esquema. Caminho estranho é descartado, nunca consertado.
 */
export function caminhosValidosDoCatalogo(imagens: readonly string[] | null | undefined): string[] {
  return (imagens ?? []).filter((c) => CAMINHO_DE_FOTO.test(c)).slice(0, 2);
}

/** Própria > catálogo > nada (nulo: a tela não reserva espaço). */
export function demonstracaoDe(e: ComDemonstracao | null | undefined): Demonstracao | null {
  if (!e) return null;
  if (e.imagemPropriaEm) return { tipo: 'PROPRIA', versao: e.imagemPropriaEm };
  const caminhos = caminhosValidosDoCatalogo(e.imagens);
  return caminhos.length ? { tipo: 'CATALOGO', caminhos } : null;
}

/** Qual foto está na vez: alterna a cada `INTERVALO_ALTERNANCIA_MS`; com movimento reduzido fica na primeira. */
export function fotoDaVez(total: number, passo: number, movimentoReduzido: boolean): number {
  if (total <= 1 || movimentoReduzido) return 0;
  return ((passo % total) + total) % total;
}

/** Só alterna quando há mais de uma foto e a pessoa não pediu menos movimento. */
export function deveAlternar(total: number, movimentoReduzido: boolean): boolean {
  return total > 1 && !movimentoReduzido;
}

export function textoAlternativoDaDemonstracao(nomeDoExercicio: string): string {
  return `Demonstração: ${nomeDoExercicio.trim() || 'exercício'}`;
}

/** Endereço de uma foto do catálogo no próprio site (`/catalogo/exercicios/...`); `base` é a origem, sem barra final. */
export function urlDaFotoDoCatalogo(base: string, caminho: string): string | null {
  if (!CAMINHO_DE_FOTO.test(caminho)) return null;
  return `${base.replace(/\/+$/, '')}/catalogo/exercicios/${caminho}`;
}

export type TipoDeImagemDoExercicio = 'image/jpeg' | 'image/png' | 'image/gif';

/** O tipo que o seletor informou (ou, faltando, a extensão); o servidor confere pelos bytes de qualquer jeito. */
export function tipoDaImagemEscolhida(
  mime: string | null | undefined,
  nome: string | null | undefined,
): TipoDeImagemDoExercicio | null {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'image/jpeg';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/gif') return 'image/gif';
  const extensao = /\.([a-z0-9]+)$/i.exec(nome ?? '')?.[1]?.toLowerCase();
  if (extensao === 'jpg' || extensao === 'jpeg') return 'image/jpeg';
  if (extensao === 'png') return 'image/png';
  if (extensao === 'gif') return 'image/gif';
  return null;
}

/**
 * GIF vai como está (reencodar mataria a animação); o servidor tira os metadados e recusa acima de 1 MB e 800 px.
 * JPEG e PNG o app reduz antes de enviar. Devolve a mensagem do problema ou nulo se cabe.
 */
export function problemaDoGif(bytes: number): string | null {
  if (bytes > LIMITES_IMAGEM_EXERCICIO.bytesMaximo) {
    return 'Este GIF passou de 1 MB. Reduza o GIF e envie de novo.';
  }
  return null;
}

/** Textos fixos da tela, num lugar só (ajuda e e2e usam os mesmos). */
export const TEXTOS_IMAGEM_EXERCICIO = {
  titulo: 'Imagem ou GIF',
  enviar: 'Enviar imagem ou GIF',
  trocar: 'Trocar imagem ou GIF',
  remover: 'Remover imagem',
  confirmarRemocao: 'Remover a imagem deste exercício? As fotos do catálogo, se houver, voltam a aparecer.',
  semImagem: 'Sem imagem própria.',
  dica: 'JPEG, PNG ou GIF animado, até 1 MB e 800 px. O vídeo continua sendo um link.',
} as const;
