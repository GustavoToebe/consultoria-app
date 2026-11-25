import { coresComContraste } from '../dominio/preferencias';
import { contraste, PALETAS } from '../tema/tokens';
import { coresDoMapa } from './coresDoMapa';

describe.each(Object.entries(PALETAS))('mapa de treinos na paleta %s', (_, { cores: base, modo }) => {
  it.each(['PADRAO', 'ALTO'] as const)('os três níveis se separam (contraste %s)', (nivel) => {
    const cores = coresComContraste(base, nivel, modo !== 'CLARO');
    const { vazio, parcial, tudo } = coresDoMapa(cores);
    // "Fiz tudo" e o contorno do "Fiz em parte" (o verde cheio) contra o vazio e o cartão: 3:1 (WCAG 1.4.11).
    expect(contraste(tudo, vazio)).toBeGreaterThanOrEqual(3);
    expect(contraste(tudo, cores.superficie)).toBeGreaterThanOrEqual(3);
    // O miolo do "Fiz em parte" contra o "Fiz tudo": 3:1; contra o vazio quem separa é o contorno.
    expect(contraste(parcial, tudo)).toBeGreaterThanOrEqual(3);
  });
});
