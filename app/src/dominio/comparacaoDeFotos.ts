import type { FotoDaLinha } from '../api/tipos';
import { dataCurta, numeroParaTela } from './formatos';

export const MINIMO_DATAS = 2;
export const MAXIMO_DATAS = 4;
export const LARGURA_IMAGEM = 1080;
export const ESPACO_IMAGEM = 8;
export const MARGEM_LOGO = 24;

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

/** Mesma conta de `LayoutDaComparacao` no servidor: 1080 px, 4:5, 8 px, logo a 30%. */
export function layoutDaImagem(quantidade: number, comLogo: boolean, logoLargura = 0, logoAltura = 0): LayoutDaImagem {
  if (quantidade < 2 || quantidade > 4) throw new Error('A comparação usa de 2 a 4 fotos.');
  const colunas = quantidade === 4 ? 2 : quantidade;
  const linhas = quantidade === 4 ? 2 : 1;
  const tileLargura = Math.floor((LARGURA_IMAGEM - (colunas - 1) * ESPACO_IMAGEM) / colunas);
  const tileAltura = Math.floor((tileLargura * 5) / 4);
  const usado = colunas * tileLargura + (colunas - 1) * ESPACO_IMAGEM;
  const origemX = Math.floor((LARGURA_IMAGEM - usado) / 2);
  const altura = linhas * tileAltura + (linhas - 1) * ESPACO_IMAGEM;
  const fotos: RetanguloDaImagem[] = [];
  for (let i = 0; i < quantidade; i++) {
    const coluna = quantidade === 4 ? i % 2 : i;
    const linha = quantidade === 4 ? Math.floor(i / 2) : 0;
    fotos.push({
      x: origemX + coluna * (tileLargura + ESPACO_IMAGEM),
      y: linha * (tileAltura + ESPACO_IMAGEM),
      largura: tileLargura,
      altura: tileAltura,
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

/** Na tela: 2 em linha; 3 ou 4 em grade 2×2 no celular; 3 em linha no PC; 4 sempre 2×2. */
export function colunasNaTela(quantidade: number, estreita: boolean): number {
  if (quantidade <= 2) return Math.max(quantidade, 1);
  if (estreita || quantidade === 4) return 2;
  return quantidade;
}
