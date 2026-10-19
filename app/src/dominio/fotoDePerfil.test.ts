import { iniciais, LIMITES_FOTO_PERFIL } from './fotoDePerfil';
import { reducoesDeFoto } from './fotosAtualizacao';

describe('foto de perfil', () => {
  it('iniciais do primeiro e do último nome', () => {
    expect(iniciais('Maria Fictícia Souza')).toBe('MS');
    expect(iniciais('  ana  ')).toBe('A');
    expect(iniciais('élio teste')).toBe('ÉT');
    expect(iniciais('')).toBe('?');
    expect(iniciais(null)).toBe('?');
  });

  it('a redução da foto de perfil nunca passa de 512 px e cabe no limite do servidor', () => {
    const lados = reducoesDeFoto(4000, 3000, LIMITES_FOTO_PERFIL.lados).map((r) => r.lado);
    expect(Math.max(...lados)).toBe(512);
    expect(new Set(lados)).toEqual(new Set([512, 384, 256]));
    expect(LIMITES_FOTO_PERFIL.bytesMaximo).toBeLessThanOrEqual(300_000);
    // Foto já pequena só é reencodada (sai o EXIF), sem ampliar.
    expect(Math.max(...reducoesDeFoto(200, 150, LIMITES_FOTO_PERFIL.lados).map((r) => r.lado))).toBe(200);
  });
});
