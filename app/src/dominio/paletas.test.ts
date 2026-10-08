import { avaliarMarca, paletaDaCor, PALETAS } from './paletas';

describe('paletas da marca', () => {
  it.each(PALETAS)('$nome passa sem bloqueio nem aviso', (p) => {
    expect(avaliarMarca(p.cor)).toEqual({ bloqueia: null, aviso: null });
  });

  it('ids e cores não se repetem e todas são #RRGGBB', () => {
    expect(new Set(PALETAS.map((p) => p.id)).size).toBe(PALETAS.length);
    expect(new Set(PALETAS.map((p) => p.cor)).size).toBe(PALETAS.length);
    for (const p of PALETAS) expect(p.cor).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('acha a paleta pela cor, sem diferenciar maiúsculas', () => {
    expect(paletaDaCor('#2563eb')?.id).toBe('azul');
    expect(paletaDaCor('#123456')).toBeUndefined();
  });

  it('amarelo vivo não segura texto branco: bloqueia o salvar e avisa no tema claro', () => {
    const r = avaliarMarca('#FFFF00');
    expect(r.bloqueia).toBe('Esta cor deixa o texto dos botões difícil de ler.');
    expect(r.aviso).toMatch(/tema claro/);
  });

  it('cor escura demais some no tema escuro: só avisa', () => {
    const r = avaliarMarca('#1F2937');
    expect(r.bloqueia).toBeNull();
    expect(r.aviso).toMatch(/tema escuro/);
  });

  it('cor inválida ou incompleta não avalia nada', () => {
    expect(avaliarMarca('#12')).toEqual({ bloqueia: null, aviso: null });
  });
});
