import type { FotoDaLinha } from '../api/tipos';
import { dataCurta, numeroParaTela } from './formatos';

export const MINIMO_DATAS = 2;
export const MAXIMO_DATAS = 4;
/** Teto de imagens do carrossel, o mesmo das perguntas de foto do questionário. */
export const MAXIMO_IMAGENS = 6;
export const LARGURA_IMAGEM = 1080;
export const ALTURA_STORIES = 1920;
export const ALTURA_FEED = 1350;
export const ESPACO_IMAGEM = 8;
export const MARGEM_LOGO = 24;

export type FormatoDaImagem = 'STORIES' | 'FEED';
export type FormatoComparacao = 'STORIES' | 'FEED' | 'AMBOS';

export interface PedidoDeComparacao {
  formato: FormatoComparacao;
  comLogo: boolean;
  imagens: { fotoIds: string[] }[];
}

export interface RetanguloDaImagem {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface LayoutDaImagem {
  largura: number;
  altura: number;
  fotos: RetanguloDaImagem[];
  logo: RetanguloDaImagem | null;
}

export interface PosicaoDasFotos {
  chave: string;
  rotulo: string;
  fotos: FotoDaLinha[];
}

/** Igual à busca: sem acento, sem diferença de maiúsculas. */
export function rotuloNormalizado(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Agrupa pelo id da pergunta. Ids diferentes com o mesmo rótulo (questionário que mudou) ficam juntos.
 */
export function posicoesDe(fotos: readonly FotoDaLinha[]): PosicaoDasFotos[] {
  const porId = new Map<string, FotoDaLinha[]>();
  for (const foto of fotos) {
    const lista = porId.get(foto.perguntaId) ?? [];
    lista.push(foto);
    porId.set(foto.perguntaId, lista);
  }
  const grupos: PosicaoDasFotos[] = [];
  for (const [id, lista] of porId) {
    const rotulo = lista[0]?.posicao || id;
    const chave = rotuloNormalizado(rotulo) || id;
    const existente = grupos.find((g) => g.chave === chave);
    if (existente) existente.fotos.push(...lista);
    else grupos.push({ chave, rotulo, fotos: [...lista] });
  }
  for (const grupo of grupos) {
    grupo.fotos.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.fotoId.localeCompare(b.fotoId));
  }
  return grupos;
}

/** Datas da posição, da mais antiga à mais nova. */
export function datasDaPosicao(fotos: readonly FotoDaLinha[]): string[] {
  return [...new Set(fotos.map((f) => f.data))].sort();
}

/** Marca a primeira e a última data da posição. Uma data só devolve essa data. */
export function primeiraEUltima(datas: readonly string[]): string[] {
  if (datas.length === 0) return [];
  if (datas.length === 1) return [datas[0]];
  return [datas[0], datas[datas.length - 1]];
}

/** Ordem do arquivo: frente, costas, lado esquerdo, lado antigo, lado direito. */
export const POSES = ['frente', 'costas', 'lado-esquerdo', 'lado', 'lado-direito'] as const;
export type PoseDoCarrossel = (typeof POSES)[number];

export interface ParDoCarrossel {
  pose: PoseDoCarrossel;
  antes: FotoDaLinha;
  depois: FotoDaLinha;
}

/**
 * Pose pelo texto da pergunta e pelo id. "Livre" fica de fora. "Lado" sem esquerdo nem direito
 * é a pergunta antiga e continua no carrossel.
 */
function palavrasDe(rotulo: string, perguntaId: string): Set<string> {
  const texto = rotuloNormalizado(`${perguntaId} ${rotulo}`).replace(/[-_]/g, ' ');
  return new Set(texto.split(/[^a-z0-9]+/).filter(Boolean));
}

/** Palavra inteira: "colados" não vira lado. */
export function poseDe(rotulo: string, perguntaId: string): PoseDoCarrossel | null {
  const palavras = palavrasDe(rotulo, perguntaId);
  const tem = (palavra: string) => palavras.has(palavra);
  if (tem('livre')) return null;
  if (tem('lado') && tem('esquerdo')) return 'lado-esquerdo';
  if (tem('lado') && tem('direito')) return 'lado-direito';
  if (tem('lado')) return 'lado';
  if (tem('frente')) return 'frente';
  if (tem('costas')) return 'costas';
  return null;
}

export function rotuloDaPose(pose: PoseDoCarrossel): string {
  switch (pose) {
    case 'frente': return 'Frente';
    case 'costas': return 'Costas';
    case 'lado-esquerdo': return 'Lado esquerdo';
    case 'lado': return 'Lado';
    case 'lado-direito': return 'Lado direito';
  }
}

/**
 * Um par por pose com duas datas: a foto da data mais antiga e a da mais nova.
 * A mesma data não entra. No máximo {@link MAXIMO_IMAGENS}.
 */
export function paresDoCarrossel(fotos: readonly FotoDaLinha[]): ParDoCarrossel[] {
  const porPose = new Map<PoseDoCarrossel, FotoDaLinha[]>();
  for (const foto of fotos) {
    const pose = poseDe(foto.posicao, foto.perguntaId);
    if (!pose) continue;
    const lista = porPose.get(pose) ?? [];
    lista.push(foto);
    porPose.set(pose, lista);
  }
  const pares: ParDoCarrossel[] = [];
  for (const pose of POSES) {
    const lista = porPose.get(pose);
    if (!lista) continue;
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.fotoId.localeCompare(b.fotoId));
    const datas = [...new Set(lista.map((f) => f.data))].sort();
    if (datas.length < 2) continue;
    const antes = fotoEmUso(lista, datas[0]);
    const depois = fotoEmUso(lista, datas[datas.length - 1]);
    if (!antes || !depois) continue;
    pares.push({ pose, antes, depois });
  }
  return pares.slice(0, MAXIMO_IMAGENS);
}

export function fotosDaData(fotos: readonly FotoDaLinha[], data: string): FotoDaLinha[] {
  return fotos.filter((f) => f.data === data).sort((a, b) => a.ordem - b.ordem || a.fotoId.localeCompare(b.fotoId));
}

/** A primeira foto da data, ou a que o toque escolheu. */
export function fotoEmUso(fotos: readonly FotoDaLinha[], data: string, escolhidaId?: string): FotoDaLinha | undefined {
  const daData = fotosDaData(fotos, data);
  if (daData.length === 0) return undefined;
  return daData.find((f) => f.fotoId === escolhidaId) ?? daData[0];
}

export function proximaFoto(fotos: readonly FotoDaLinha[], data: string, atualId: string): string {
  const daData = fotosDaData(fotos, data);
  const indice = daData.findIndex((f) => f.fotoId === atualId);
  const seguinte = daData[(indice + 1) % daData.length];
  return seguinte?.fotoId ?? atualId;
}

/** Anamnese aparece como início. */
export function rotuloDaData(fotos: readonly FotoDaLinha[], data: string): string {
  const curta = dataCurta(data);
  return fotos.some((f) => f.data === data && f.origem === 'ANAMNESE') ? `Início · ${curta}` : curta;
}

/**
 * Diferença entre a primeira e a última foto marcada. Só sai quando as duas têm peso.
 * Exemplo: `01/01 → 22/01: −0,7 kg em 21 dias`.
 */
export function textoDaDiferenca(de: FotoDaLinha, ate: FotoDaLinha): string | null {
  if (de.pesoKg == null || ate.pesoKg == null) return null;
  const delta = ate.pesoKg - de.pesoKg;
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const dias = diasEntre(de.data, ate.data);
  const unidade = Math.abs(dias) === 1 ? 'dia' : 'dias';
  return `${dataCurta(de.data)} → ${dataCurta(ate.data)}: ${sinal}${numeroParaTela(Math.abs(delta))} kg em ${Math.abs(dias)} ${unidade}`;
}

export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function alturaDoFormato(formato: FormatoDaImagem): number {
  return formato === 'FEED' ? ALTURA_FEED : ALTURA_STORIES;
}

/** Com os dois formatos, a prévia mostra o Stories. */
export function formatoDaPrevia(formato: FormatoComparacao): FormatoDaImagem {
  return formato === 'FEED' ? 'FEED' : 'STORIES';
}

/** ZIP quando há mais de uma imagem ou os dois formatos. */
export function comparacaoEmZip(formato: FormatoComparacao, imagens: number): boolean {
  return imagens > 1 || formato === 'AMBOS';
}

export function nomeDaComparacao(formato: FormatoComparacao, imagens: number): string {
  if (comparacaoEmZip(formato, imagens)) return 'comparacao.zip';
  return formato === 'FEED' ? 'feed.jpg' : 'stories.jpg';
}

/** Mesma conta de `LayoutDaComparacao` no servidor: 1080 px, Stories ou Feed, 8 px, logo a 30%. */
export function layoutDaImagem(formato: FormatoDaImagem, quantidade: number, comLogo: boolean, logoLargura = 0, logoAltura = 0): LayoutDaImagem {
  if (quantidade < 1 || quantidade > 4) throw new Error('A imagem usa de 1 a 4 fotos.');
  const altura = alturaDoFormato(formato);
  const tileLargura = Math.floor((LARGURA_IMAGEM - (quantidade - 1) * ESPACO_IMAGEM) / quantidade);
  const usado = quantidade * tileLargura + (quantidade - 1) * ESPACO_IMAGEM;
  const origemX = Math.floor((LARGURA_IMAGEM - usado) / 2);
  const fotos: RetanguloDaImagem[] = [];
  for (let i = 0; i < quantidade; i++) {
    fotos.push({
      x: origemX + i * (tileLargura + ESPACO_IMAGEM),
      y: 0,
      largura: tileLargura,
      altura,
    });
  }
  let logo: RetanguloDaImagem | null = null;
  if (comLogo && logoLargura > 0 && logoAltura > 0) {
    const larguraLogo = Math.floor((LARGURA_IMAGEM * 30) / 100);
    const alturaLogo = Math.max(1, Math.floor((logoAltura * larguraLogo) / logoLargura));
    logo = {
      x: Math.floor((LARGURA_IMAGEM - larguraLogo) / 2),
      y: Math.max(0, altura - MARGEM_LOGO - alturaLogo),
      largura: larguraLogo,
      altura: alturaLogo,
    };
  }
  return { largura: LARGURA_IMAGEM, altura, fotos, logo };
}

/** Na tela, as fotos marcadas ficam sempre na mesma fileira. */
export function colunasNaTela(quantidade: number): number {
  return Math.max(quantidade, 1);
}
