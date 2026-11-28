import { colunasDaAlvenaria } from './alvenaria';
import { colunasDaConta } from './colunasDaConta';
import { colunasMedidas, diferencaDasColunas } from './colunasMedidas';

describe('colunasDaConta', () => {
  it('uma coluna na compacta, por mais largo que seja', () => {
    expect(colunasDaConta(990, 'compacta', 24, 9)).toBe(1);
    expect(colunasDaConta(358, 'compacta', 24, 9)).toBe(1);
  });

  it('duas na normal, três na larga e na ultralarga (o teto da faixa)', () => {
    expect(colunasDaConta(1000, 'normal', 24, 9)).toBe(2);
    expect(colunasDaConta(1500, 'normal', 24, 9)).toBe(2);
    expect(colunasDaConta(1600, 'larga', 24, 9)).toBe(3);
    expect(colunasDaConta(3100, 'ultralarga', 24, 9)).toBe(3);
  });

  it('não passa do que cabe com a célula mínima nem do número de peças', () => {
    expect(colunasDaConta(880, 'normal', 24, 9)).toBe(1);
    expect(colunasDaConta(1300, 'larga', 24, 9)).toBe(2);
    expect(colunasDaConta(3100, 'ultralarga', 24, 2)).toBe(2);
    expect(colunasDaConta(0, 'larga', 24, 9)).toBe(1);
  });
});

// A Conta medida em 1920 (perfil, comunidade, dados, convite, privacidade, segurança, app e excluir), com o perfil preso
// no topo da primeira coluna, como a tela passa às `ColunasMedidas`.
const CONTA = [172, 98, 92, 190, 244, 152, 290, 90];
const REGRAS = CONTA.map((_, i) => (i === 0 ? { coluna: 0 } : undefined));

describe('Conta nas colunas medidas', () => {
  it('a alvenaria comum, mesmo com a altura medida como peso, deixa buraco (por isso a Conta não usa a `ui/Alvenaria`)', () => {
    const coluna = colunasDaAlvenaria(CONTA.map((a) => a + 24), 3);
    expect(diferencaDasColunas(coluna, CONTA, 3, 24)).toBeGreaterThan(200);
  });

  it.each([2, 3])('em %i colunas: o perfil no topo da primeira e os fins a menos de 80 px (o limite do e2e)', (colunas) => {
    const coluna = colunasMedidas(CONTA, colunas, 24, REGRAS);
    expect(coluna[0]).toBe(0);
    expect(new Set(coluna).size).toBe(colunas);
    expect(diferencaDasColunas(coluna, CONTA, colunas, 24)).toBeLessThan(80);
  });
});
