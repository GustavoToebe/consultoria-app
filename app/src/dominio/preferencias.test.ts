import { contraste, CLARO, ESCURO } from '../tema/tokens';
import {
  coresComContraste,
  escalar,
  fatorDoTexto,
  normalizarPreferencias,
  PREFERENCIAS_PADRAO,
} from './preferencias';

describe('preferências pessoais', () => {
  it('valor desconhecido, faltando ou texto quebrado volta ao padrão', () => {
    expect(normalizarPreferencias(undefined)).toEqual(PREFERENCIAS_PADRAO);
    expect(normalizarPreferencias('{quebrado')).toEqual(PREFERENCIAS_PADRAO);
    expect(normalizarPreferencias({ tema: 'ROXO', contraste: 1, tamanhoTexto: 'GIGANTE', movimento: null, vibracao: 'sim', graficos: 'não', barrasEscuras: 'não', diasSemRegistro: 5 })).toEqual(PREFERENCIAS_PADRAO);
  });

  it('aceita o objeto e o texto salvo, valor por valor', () => {
    const salvo = { tema: 'SISTEMA', contraste: 'ALTO', tamanhoTexto: 'EXTRA', movimento: 'REDUZIDO', vibracao: false, graficos: false, barrasEscuras: false, diasSemRegistro: 14 };
    expect(normalizarPreferencias(salvo)).toEqual(salvo);
    expect(normalizarPreferencias(JSON.stringify(salvo))).toEqual(salvo);
    expect(normalizarPreferencias({ tema: 'CLARO' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'CLARO' });
  });

  it('dias sem registro: só 3, 7, 14 ou 30; outro valor volta a 7', () => {
    for (const n of [3, 7, 14, 30]) expect(normalizarPreferencias({ diasSemRegistro: n }).diasSemRegistro).toBe(n);
    for (const n of [0, 5, 90, '14', null]) expect(normalizarPreferencias({ diasSemRegistro: n }).diasSemRegistro).toBe(7);
  });

  it('fator do texto: 1,00 · 1,12 · 1,25 · 1,40, arredondando em inteiro', () => {
    expect([fatorDoTexto('PADRAO'), fatorDoTexto('MEDIO'), fatorDoTexto('GRANDE'), fatorDoTexto('EXTRA')]).toEqual([1, 1.12, 1.25, 1.4]);
    expect(escalar(15, 1.4)).toBe(21);
    expect(escalar(16, 1)).toBe(16);
  });

  it.each([
    ['escuro', ESCURO, true],
    ['claro', CLARO, false],
  ])('contraste alto no tema %s: borda nítida e texto secundário ≥ 7:1 em todas as superfícies', (_nome, base, escuro) => {
    const alto = coresComContraste(base, 'ALTO', escuro);
    expect(alto.borda).toBe(base.bordaCampo);
    for (const superficie of [alto.fundo, alto.superficie, alto.superficie2, alto.superficie3]) {
      expect(contraste(alto.textoSuave, superficie)).toBeGreaterThanOrEqual(7);
    }
    expect(coresComContraste(base, 'PADRAO', escuro)).toBe(base);
  });
});
