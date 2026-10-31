import { AREIA, contraste, CLARO, ESCURO } from '../tema/tokens';
import { BLOCOS_DO_PAINEL } from './painelBlocos';
import {
  AGENDAS_OCULTAS_MAXIMO,
  coresComBordasReforcadas,
  coresComContraste,
  escalar,
  espessurasDasBordas,
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
    const salvo = { tema: 'SISTEMA', contraste: 'ALTO', tamanhoTexto: 'EXTRA', movimento: 'REDUZIDO', vibracao: false, graficos: false, bordasReforcadas: true, barrasEscuras: false, diasSemRegistro: 14, mostrarFasesDoCiclo: true, pdfDieta: { modo: 'detalhado', periodo: 'mes', fatores: false }, logoNaComparacao: false, lembretesCompromisso: true, agendasOcultas: ['compromissos', 'a1'], painelDoInicio: { ordem: ['financeiro', 'alunos', 'atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'recebido'], escondidos: ['agenda', 'recebido'], meus: { agenda: true, interessados: false } } };
    expect(normalizarPreferencias(salvo)).toEqual(salvo);
    expect(normalizarPreferencias(JSON.stringify(salvo))).toEqual(salvo);
    expect(normalizarPreferencias({ tema: 'CLARO' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'CLARO' });
    expect(normalizarPreferencias({ tema: 'AREIA' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'AREIA' });
  });

  it('logo na comparação: valor inválido volta ligada', () => {
    expect(normalizarPreferencias({ logoNaComparacao: 'sim' }).logoNaComparacao).toBe(true);
    expect(normalizarPreferencias({ mostrarFasesDoCiclo: 'sim' }).mostrarFasesDoCiclo).toBe(true);
    expect(normalizarPreferencias({ mostrarFasesDoCiclo: false }).mostrarFasesDoCiclo).toBe(false);
    expect(normalizarPreferencias({ logoNaComparacao: false }).logoNaComparacao).toBe(false);
  });

  it('bordas reforçadas: desligadas por padrão; ligadas, borda mais escura e bloco de 3 px, sem mexer em texto nem status', () => {
    expect(PREFERENCIAS_PADRAO.bordasReforcadas).toBe(false);
    expect(normalizarPreferencias({ bordasReforcadas: 'sim' }).bordasReforcadas).toBe(false);
    expect(normalizarPreferencias({ bordasReforcadas: true }).bordasReforcadas).toBe(true);
    for (const base of [CLARO, ESCURO, AREIA]) {
      expect(coresComBordasReforcadas(base, false)).toBe(base);
      const r = coresComBordasReforcadas(base, true);
      expect(r.borda).toBe(base.bordaCampo);
      expect(contraste(r.borda, r.superficie)).toBeGreaterThan(contraste(base.borda, base.superficie));
      expect({ ...r, borda: base.borda, divisor: base.divisor }).toEqual(base);
    }
    expect(espessurasDasBordas(false)).toEqual({ bloco: 2, item: 2 });
    expect(espessurasDasBordas(true)).toEqual({ bloco: 3, item: 2 });
  });

  it('lembretes de compromisso: desligados por padrão; só um booleano os liga', () => {
    expect(PREFERENCIAS_PADRAO.lembretesCompromisso).toBe(false);
    expect(normalizarPreferencias({ lembretesCompromisso: true }).lembretesCompromisso).toBe(true);
    for (const v of ['sim', 1, null]) expect(normalizarPreferencias({ lembretesCompromisso: v }).lembretesCompromisso).toBe(false);
  });

  it('painel do Início: padrão com todos os blocos na ordem do protótipo e nenhum escondido', () => {
    expect(PREFERENCIAS_PADRAO.painelDoInicio).toEqual({ ordem: [...BLOCOS_DO_PAINEL], escondidos: [], meus: {} });
    expect(PREFERENCIAS_PADRAO.painelDoInicio.ordem).toHaveLength(8);
    expect(normalizarPreferencias({}).painelDoInicio).toEqual(PREFERENCIAS_PADRAO.painelDoInicio);
  });

  it('painel do Início: ordem salva vale; id desconhecido e repetido saem; bloco que falta entra no fim, na ordem padrão', () => {
    const r = normalizarPreferencias({ painelDoInicio: { ordem: ['alunos', 'xis', 'alunos', 7, 'agenda'], escondidos: ['agenda', 'agenda', 'xis', null] } }).painelDoInicio;
    expect(r.ordem).toEqual(['alunos', 'agenda', 'atualizacoes', 'interessados', 'treinos', 'pastas', 'financeiro', 'recebido']);
    expect(r.escondidos).toEqual(['agenda']);
  });

  it('painel do Início: valor que não é objeto, ou com listas que não são listas, volta ao padrão', () => {
    for (const v of ['texto', 1, null, [], true, { ordem: 'alunos', escondidos: { a: 1 } }]) {
      expect(normalizarPreferencias({ painelDoInicio: v }).painelDoInicio).toEqual(PREFERENCIAS_PADRAO.painelDoInicio);
    }
  });

  it('painel do Início: o Todos/Meus de cada bloco é gravado; id desconhecido e valor que não é booleano saem', () => {
    const r = normalizarPreferencias({ painelDoInicio: { meus: { agenda: true, interessados: false, xis: true, treinos: 'sim', pastas: 1 } } }).painelDoInicio;
    expect(r.meus).toEqual({ agenda: true, interessados: false });
    for (const v of [null, 'Meus', ['agenda'], 3]) {
      expect(normalizarPreferencias({ painelDoInicio: { meus: v } }).painelDoInicio.meus).toEqual({});
    }
  });

  it('painel do Início: o padrão não é compartilhado (mexer na cópia não muda o padrão)', () => {
    const a = normalizarPreferencias({});
    a.painelDoInicio.escondidos.push('agenda');
    expect(normalizarPreferencias({}).painelDoInicio.escondidos).toEqual([]);
    expect(PREFERENCIAS_PADRAO.painelDoInicio.escondidos).toEqual([]);
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
    ['claro areia', AREIA, false],
  ])('contraste alto no tema %s: borda nítida e texto secundário ≥ 7:1 em todas as superfícies', (_nome, base, escuro) => {
    const alto = coresComContraste(base, 'ALTO', escuro);
    expect(alto.borda).toBe(base.bordaCampo);
    for (const superficie of [alto.fundo, alto.superficie, alto.superficie2, alto.superficie3]) {
      expect(contraste(alto.textoSuave, superficie)).toBeGreaterThanOrEqual(7);
    }
    expect(coresComContraste(base, 'PADRAO', escuro)).toBe(base);
  });
});
