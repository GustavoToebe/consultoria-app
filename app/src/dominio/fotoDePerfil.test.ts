import { fotoNaFicha, iniciais, LIMITES_FOTO_PERFIL } from './fotoDePerfil';
import { reducoesDeFoto } from './fotosAtualizacao';

describe('foto no círculo do topo da ficha', () => {
  const base = { largura: 1280, comMouse: true, podeAlterar: true, anonimizado: false, temFoto: true };

  it('96 px a partir de 768 px de largura, 72 abaixo', () => {
    expect(fotoNaFicha({ ...base, largura: 768 }).tamanho).toBe(96);
    expect(fotoNaFicha({ ...base, largura: 767 }).tamanho).toBe(72);
    expect(fotoNaFicha({ ...base, largura: 390, podeAlterar: false }).tamanho).toBe(72);
  });

  it('com mouse e círculo grande, camada; sem mouse ou no círculo pequeno, o botão do canto', () => {
    expect(fotoNaFicha(base).edicao).toBe('camada');
    expect(fotoNaFicha({ ...base, comMouse: false }).edicao).toBe('canto');
    expect(fotoNaFicha({ ...base, largura: 700 }).edicao).toBe('canto');
  });

  it('sem ALUNO_ALTERAR ou com o aluno anonimizado, só a foto', () => {
    expect(fotoNaFicha({ ...base, podeAlterar: false })).toEqual({ tamanho: 96, edicao: 'nenhuma', lixeira: false });
    expect(fotoNaFicha({ ...base, anonimizado: true })).toEqual({ tamanho: 96, edicao: 'nenhuma', lixeira: false });
  });

  it('a lixeira só aparece quando se sabe que há foto', () => {
    expect(fotoNaFicha(base).lixeira).toBe(true);
    expect(fotoNaFicha({ ...base, temFoto: false }).lixeira).toBe(false);
    expect(fotoNaFicha({ ...base, temFoto: null }).lixeira).toBe(false);
    expect(fotoNaFicha({ ...base, comMouse: false }).lixeira).toBe(true);
  });
});

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
