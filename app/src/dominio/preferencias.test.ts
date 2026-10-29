import { contraste, CLARO, ESCURO } from '../tema/tokens';
import {
  AGENDAS_OCULTAS_MAXIMO,
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
    const salvo = { tema: 'SISTEMA', contraste: 'ALTO', tamanhoTexto: 'EXTRA', movimento: 'REDUZIDO', vibracao: false, graficos: false, barrasEscuras: false, diasSemRegistro: 14, mostrarFasesDoCiclo: true, pdfDieta: { modo: 'detalhado', periodo: 'mes', fatores: false }, logoNaComparacao: false, lembretesCompromisso: true, agendasOcultas: ['compromissos', 'a1'] };
    expect(normalizarPreferencias(salvo)).toEqual(salvo);
    expect(normalizarPreferencias(JSON.stringify(salvo))).toEqual(salvo);
    expect(normalizarPreferencias({ tema: 'CLARO' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'CLARO' });
  });

  it('logo na comparação: valor inválido volta ligada', () => {
    expect(normalizarPreferencias({ logoNaComparacao: 'sim' }).logoNaComparacao).toBe(true);
    expect(normalizarPreferencias({ mostrarFasesDoCiclo: 'sim' }).mostrarFasesDoCiclo).toBe(true);
    expect(normalizarPreferencias({ mostrarFasesDoCiclo: false }).mostrarFasesDoCiclo).toBe(false);
    expect(normalizarPreferencias({ logoNaComparacao: false }).logoNaComparacao).toBe(false);
  });

  it('lembretes de compromisso: desligados por padrão; só um booleano os liga', () => {
    expect(PREFERENCIAS_PADRAO.lembretesCompromisso).toBe(false);
    expect(normalizarPreferencias({ lembretesCompromisso: true }).lembretesCompromisso).toBe(true);
    for (const v of ['sim', 1, null]) expect(normalizarPreferencias({ lembretesCompromisso: v }).lembretesCompromisso).toBe(false);
  });

  it('agendas ocultas: nenhuma por padrão; só lista de textos, sem repetir, vazio nem texto enorme; o resto volta a nenhuma', () => {
    expect(PREFERENCIAS_PADRAO.agendasOcultas).toEqual([]);
    expect(normalizarPreferencias({ agendasOcultas: ['atualizacoes', 'a1', 'a1', '', 7, null, 'x'.repeat(65), 'b2'] }).agendasOcultas)
      .toEqual(['atualizacoes', 'a1', 'b2']);
    for (const v of ['a1', 1, { a: 1 }, null, true]) expect(normalizarPreferencias({ agendasOcultas: v }).agendasOcultas).toEqual([]);
    const muitas = Array.from({ length: 200 }, (_, i) => `a${i}`);
    expect(normalizarPreferencias({ agendasOcultas: muitas }).agendasOcultas).toEqual(muitas.slice(0, AGENDAS_OCULTAS_MAXIMO));
    // Não poda por existência: o id fica guardado até a lista de agendas dizer que sumiu (a leitura pode ter falhado).
    expect(normalizarPreferencias(JSON.stringify({ agendasOcultas: ['id-que-nao-existe-mais'] })).agendasOcultas).toEqual(['id-que-nao-existe-mais']);
  });

  it('pdf da dieta: valor inválido volta a simples, 7 dias e fatores ligados', () => {
    expect(normalizarPreferencias({ pdfDieta: { modo: 'pasta', periodo: 30, fatores: 'sim' } }).pdfDieta).toEqual(PREFERENCIAS_PADRAO.pdfDieta);
    expect(normalizarPreferencias({ pdfDieta: { modo: 'detalhado', periodo: 'mes', fatores: false } }).pdfDieta).toEqual({ modo: 'detalhado', periodo: 'mes', fatores: false });
    expect(normalizarPreferencias({ pdfDieta: { modo: 'simples', periodo: 'duasSemanas', fatores: true } }).pdfDieta.periodo).toBe('duasSemanas');
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
