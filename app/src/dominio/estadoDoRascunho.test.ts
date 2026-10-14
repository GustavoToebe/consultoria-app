import { horaDoSalvamento, textoDoSalvo } from './estadoDoRascunho';

describe('estadoDoRascunho', () => {
  it('formata a hora com dois dígitos', () => {
    expect(horaDoSalvamento(new Date(2026, 9, 13, 9, 5))).toBe('09:05');
    expect(horaDoSalvamento(new Date(2026, 9, 13, 23, 59))).toBe('23:59');
    expect(horaDoSalvamento(new Date(2026, 9, 13, 0, 0))).toBe('00:00');
  });

  it('sem salvamento nesta tela não inventa hora', () => {
    expect(textoDoSalvo(null)).toBe('Salvo');
    expect(textoDoSalvo(null, 'Rascunho salvo')).toBe('Rascunho salvo');
  });

  it('depois de salvar diz a hora', () => {
    expect(textoDoSalvo(new Date(2026, 9, 13, 14, 30))).toBe('Salvo às 14:30');
    expect(textoDoSalvo(new Date(2026, 9, 13, 14, 30), 'Rascunho salvo')).toBe('Rascunho salvo às 14:30');
  });
});
