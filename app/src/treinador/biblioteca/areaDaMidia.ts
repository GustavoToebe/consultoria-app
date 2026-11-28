/**
 * Altura comum das áreas de Vídeo e de Imagem na folha do exercício: 16:9 da largura da coluna (a prévia do YouTube),
 * nunca abaixo do que a área vazia do vídeo precisa (play, campo com rótulo e a dica em duas linhas).
 */
export const AREA_DA_MIDIA_MINIMA = 180;

export const alturaDaMidia = (largura: number): number => Math.max(AREA_DA_MIDIA_MINIMA, Math.round((largura * 9) / 16));
