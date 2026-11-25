import { misturar, type Cores } from '../tema/tokens';

/** Quanto do verde entra no "Fiz em parte": com 35% o miolo fica ≥ 3:1 contra o "Fiz tudo" em toda paleta (`coresDoMapa.test.ts`). */
const TINTA_DO_PARCIAL = 0.35;

/**
 * Escala do mapa de treinos (Gustavo, 25/11): o verde de treino feito (`sucesso`) em intensidade. Vazio = `superficie3`;
 * "Fiz em parte" = o verde a 35% sobre o vazio com contorno no verde cheio (o contorno separa do vazio e do cartão);
 * "Fiz tudo" = o verde cheio.
 */
export function coresDoMapa(cores: Pick<Cores, 'superficie3' | 'sucesso'>) {
  return { vazio: cores.superficie3, parcial: misturar(cores.superficie3, cores.sucesso, TINTA_DO_PARCIAL), tudo: cores.sucesso };
}
