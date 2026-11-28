import { alturaDaPreviaFixa, arranjoDaMarca, escalaParaCaber, FORMULARIO_E_PREVIA } from './arranjoDaMarca';

describe('arranjoDaMarca', () => {
  it('sem medida não decide (nenhuma prévia pisca)', () => {
    expect(arranjoDaMarca(null)).toBeNull();
    expect(arranjoDaMarca(undefined)).toBeNull();
    expect(arranjoDaMarca(0)).toBeNull();
    expect(arranjoDaMarca(Number.NaN)).toBeNull();
  });

  it('abaixo de 1600 de área (celular, 1280 e 1920 dentro de Configurações): a prévia embaixo do formulário', () => {
    expect(FORMULARIO_E_PREVIA).toBe(1600);
    expect(arranjoDaMarca(358)).toBe('empilhado');
    // 1920 de janela dentro de Configurações: 1920 - 240 (menu) - 300 (coluna) - 32 (recuo da Tela).
    expect(arranjoDaMarca(1348)).toBe('empilhado');
    expect(arranjoDaMarca(FORMULARIO_E_PREVIA - 1)).toBe('empilhado');
  });

  it('de 1600 em diante (3440 dentro de Configurações): o formulário e a prévia ao lado', () => {
    expect(arranjoDaMarca(1600)).toBe('larga');
    expect(arranjoDaMarca(2868)).toBe('larga');
  });
});

describe('escalaParaCaber', () => {
  const base = { largura: 776, altura: 668 };
  it('sem medida, 0; nunca maior que o desenho', () => {
    expect(escalaParaCaber(base, { largura: 0 })).toBe(0);
    expect(escalaParaCaber(base, { largura: 2000 })).toBe(1);
  });
  it('pela largura no celular e pela menor das duas na prévia fixa', () => {
    expect(escalaParaCaber(base, { largura: 388 })).toBeCloseTo(0.5);
    expect(escalaParaCaber(base, { largura: 776, altura: 334 })).toBeCloseTo(0.5);
    expect(escalaParaCaber(base, { largura: 388, altura: 2000 })).toBeCloseTo(0.5);
  });
});

describe('alturaDaPreviaFixa', () => {
  it('a da coluna do formulário, sem passar da janela', () => {
    expect(alturaDaPreviaFixa(null, 1080)).toBeUndefined();
    expect(alturaDaPreviaFixa(900, 1080)).toBe(900);
    // O recuo de cima (16) e a folga do botão de voltar ao topo (68) no fim da rolagem.
    expect(alturaDaPreviaFixa(1500, 1080)).toBe(1080 - 16 - 68);
  });
});
