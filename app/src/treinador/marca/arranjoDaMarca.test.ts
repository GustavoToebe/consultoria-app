import { arranjoDaMarca, FORMULARIO_E_PREVIA, PREVIA_AO_LADO } from './arranjoDaMarca';

describe('arranjoDaMarca', () => {
  it('sem medida não decide (nenhuma prévia pisca)', () => {
    expect(arranjoDaMarca(null)).toBeNull();
    expect(arranjoDaMarca(undefined)).toBeNull();
    expect(arranjoDaMarca(0)).toBeNull();
    expect(arranjoDaMarca(Number.NaN)).toBeNull();
  });

  it('celular e telas estreitas: prévia compacta acima', () => {
    expect(arranjoDaMarca(358)).toBe('acima');
    expect(arranjoDaMarca(PREVIA_AO_LADO - 1)).toBe('acima');
  });

  it('a partir de 880: prévia de 320 ao lado dos ajustes', () => {
    expect(PREVIA_AO_LADO).toBe(880);
    expect(arranjoDaMarca(PREVIA_AO_LADO)).toBe('lado');
    expect(arranjoDaMarca(FORMULARIO_E_PREVIA - 1)).toBe('lado');
  });

  it('a partir de 1104 (640 + 24 + 440): formulário de 640 e a prévia no resto', () => {
    expect(FORMULARIO_E_PREVIA).toBe(1104);
    expect(arranjoDaMarca(FORMULARIO_E_PREVIA)).toBe('larga');
    expect(arranjoDaMarca(2760)).toBe('larga');
  });
});
