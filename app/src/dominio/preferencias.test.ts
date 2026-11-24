import { contraste, PALETAS } from '../tema/tokens';
import { BLOCOS_DO_PAINEL } from './painelBlocos';
import {
  AGENDAS_OCULTAS_MAXIMO,
  coresComBordasReforcadas,
  coresComContraste,
  contornoDoCartao,
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
    expect(normalizarPreferencias({ tema: 'CAFE' })).toEqual(PREFERENCIAS_PADRAO);
    expect(normalizarPreferencias({ tema: 'ROXO', contraste: 1, tamanhoTexto: 'GIGANTE', movimento: null, vibracao: 'sim', graficos: 'não', barrasEscuras: 'não', diasSemRegistro: 5 })).toEqual(PREFERENCIAS_PADRAO);
  });

  it('aceita o objeto e o texto salvo, valor por valor', () => {
    const salvo = { tema: 'SISTEMA', contraste: 'ALTO', tamanhoTexto: 'EXTRA', larguraConteudo: 'LIMITADA', detalhesAbrem: 'CENTRO', movimento: 'REDUZIDO', vibracao: false, graficos: false, bordasReforcadas: true, barrasEscuras: false, diasSemRegistro: 14, diasAniversario: 3, mostrarFasesDoCiclo: true, pdfDieta: { modo: 'detalhado', periodo: 'mes', fatores: false }, logoNaComparacao: false, lembretesCompromisso: true, avisoNoCelular: true, agendasOcultas: ['compromissos', 'a1'], gruposRecolhidos: ['Acompanhamento', 'Negócio'], unidadeDeCarga: 'lb', corDeAcao: 'VIOLETA', painelDoInicio: { ordem: ['financeiro', 'alunos', 'atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'recebido'], escondidos: ['agenda', 'recebido'], meus: { agenda: true, interessados: false }, tamanhos: { alunos: 3 } } };
    expect(normalizarPreferencias(salvo)).toEqual(salvo);
    expect(normalizarPreferencias(JSON.stringify(salvo))).toEqual(salvo);
    expect(normalizarPreferencias({ tema: 'CLARO' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'CLARO' });
    expect(normalizarPreferencias({ tema: 'AREIA' })).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'AREIA' });
  });

  it('unidade da carga: kg por padrão; só kg ou lb valem e o resto volta a kg', () => {
    expect(PREFERENCIAS_PADRAO.unidadeDeCarga).toBe('kg');
    // visual-ponytail (17/11): cor de ação (índigo por padrão); valor desconhecido cai no índigo.
    expect(normalizarPreferencias({}).corDeAcao).toBe('INDIGO');
    expect(normalizarPreferencias({ corDeAcao: 'ROXO' }).corDeAcao).toBe('INDIGO');
    expect(normalizarPreferencias({ unidadeDeCarga: 'lb' }).unidadeDeCarga).toBe('lb');
    for (const v of ['LB', 'libra', 1, null, true, undefined]) expect(normalizarPreferencias({ unidadeDeCarga: v }).unidadeDeCarga).toBe('kg');
  });

  it('largura do conteúdo: Automática por padrão; só AUTOMATICA ou LIMITADA valem e o resto volta ao padrão', () => {
    expect(PREFERENCIAS_PADRAO.larguraConteudo).toBe('AUTOMATICA');
    expect(normalizarPreferencias({ larguraConteudo: 'LIMITADA' }).larguraConteudo).toBe('LIMITADA');
    expect(normalizarPreferencias({ larguraConteudo: 'AUTOMATICA' }).larguraConteudo).toBe('AUTOMATICA');
    for (const v of ['automatica', 'LARGA', 1800, null, true, undefined]) {
      expect(normalizarPreferencias({ larguraConteudo: v }).larguraConteudo).toBe('AUTOMATICA');
    }
  });

  it('detalhes abrem: Na lateral por padrão; só LATERAL ou CENTRO valem e o resto volta ao padrão', () => {
    expect(PREFERENCIAS_PADRAO.detalhesAbrem).toBe('LATERAL');
    expect(normalizarPreferencias({ detalhesAbrem: 'CENTRO' }).detalhesAbrem).toBe('CENTRO');
    expect(normalizarPreferencias(JSON.stringify({ detalhesAbrem: 'CENTRO' })).detalhesAbrem).toBe('CENTRO');
    for (const v of ['centro', 'DIREITA', 1, null, true, undefined]) {
      expect(normalizarPreferencias({ detalhesAbrem: v }).detalhesAbrem).toBe('LATERAL');
    }
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
    for (const { cores: base } of Object.values(PALETAS)) {
      expect(coresComBordasReforcadas(base, false)).toBe(base);
      const r = coresComBordasReforcadas(base, true);
      expect(r.borda).toBe(base.bordaCampo);
      expect(contraste(r.borda, r.superficie)).toBeGreaterThan(contraste(base.borda, base.superficie));
      expect({ ...r, borda: base.borda, divisor: base.divisor }).toEqual(base);
    }
    expect(espessurasDasBordas(false)).toEqual({ bloco: 1, item: 1 });
    expect(espessurasDasBordas(true)).toEqual({ bloco: 2, item: 2 });
  });

  it('lembretes de compromisso: desligados por padrão; só um booleano os liga', () => {
    expect(PREFERENCIAS_PADRAO.lembretesCompromisso).toBe(false);
    expect(normalizarPreferencias({ lembretesCompromisso: true }).lembretesCompromisso).toBe(true);
    for (const v of ['sim', 1, null]) expect(normalizarPreferencias({ lembretesCompromisso: v }).lembretesCompromisso).toBe(false);
    expect(PREFERENCIAS_PADRAO.avisoNoCelular).toBe(false);
    expect(normalizarPreferencias({ avisoNoCelular: true }).avisoNoCelular).toBe(true);
    for (const v of ['sim', 1, null]) expect(normalizarPreferencias({ avisoNoCelular: v }).avisoNoCelular).toBe(false);
  });

  it('painel do Início: padrão com todos os blocos na ordem do protótipo e nenhum escondido', () => {
    expect(PREFERENCIAS_PADRAO.painelDoInicio).toEqual({ ordem: [...BLOCOS_DO_PAINEL], escondidos: [], meus: {}, tamanhos: {} });
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

  it('painel do Início: tamanho salvo vale; id desconhecido e valor fora de 1, 2 ou 3 saem', () => {
    const r = normalizarPreferencias({ painelDoInicio: { tamanhos: { agenda: 3, alunos: 2, treinos: 0, pastas: 4, financeiro: '2', recebido: 2.5, xis: 1 } } }).painelDoInicio;
    expect(r.tamanhos).toEqual({ agenda: 3, alunos: 2 });
    for (const v of [null, 'Grande', [3], 2]) {
      expect(normalizarPreferencias({ painelDoInicio: { tamanhos: v } }).painelDoInicio.tamanhos).toEqual({});
    }
  });

  it('painel do Início: a preferência gravada antes dos tamanhos continua valendo (ordem, ocultos e Meus), com os de fábrica', () => {
    const antiga = { ordem: ['agenda', 'alunos'], escondidos: ['treinos'], meus: { agenda: true } };
    const r = normalizarPreferencias({ painelDoInicio: antiga }).painelDoInicio;
    expect(r.ordem.slice(0, 2)).toEqual(['agenda', 'alunos']);
    expect(r.escondidos).toEqual(['treinos']);
    expect(r.meus).toEqual({ agenda: true });
    expect(r.tamanhos).toEqual({});
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

  it('grupos recolhidos: nenhum por padrão; só nomes de grupos do menu, sem repetir, na ordem do menu; o resto volta a tudo aberto', () => {
    expect(PREFERENCIAS_PADRAO.gruposRecolhidos).toEqual([]);
    expect(normalizarPreferencias({ gruposRecolhidos: ['Negócio', 'Xis', 7, null, 'Negócio', 'Acompanhamento'] }).gruposRecolhidos)
      .toEqual(['Acompanhamento', 'Negócio']);
    for (const v of ['Negócio', 1, { a: 1 }, null, true, undefined]) expect(normalizarPreferencias({ gruposRecolhidos: v }).gruposRecolhidos).toEqual([]);
    expect(normalizarPreferencias(JSON.stringify({ gruposRecolhidos: ['Conteúdo'] })).gruposRecolhidos).toEqual(['Conteúdo']);
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

  it('dias de aniversário: só 0, 3, 7 ou 15; padrão e outro valor voltam a 7', () => {
    expect(PREFERENCIAS_PADRAO.diasAniversario).toBe(7);
    for (const n of [0, 3, 7, 15]) expect(normalizarPreferencias({ diasAniversario: n }).diasAniversario).toBe(n);
    for (const n of [1, 5, 14, -3, '3', null, true]) expect(normalizarPreferencias({ diasAniversario: n }).diasAniversario).toBe(7);
  });

  it('fator do texto: 1,00 · 1,12 · 1,25 · 1,40, arredondando em inteiro', () => {
    expect([fatorDoTexto('PADRAO'), fatorDoTexto('MEDIO'), fatorDoTexto('GRANDE'), fatorDoTexto('EXTRA')]).toEqual([1, 1.12, 1.25, 1.4]);
    expect(escalar(15, 1.4)).toBe(21);
    expect(escalar(16, 1)).toBe(16);
  });

  it.each(Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO'] as const))('contraste alto no tema %s: borda nítida e texto secundário ≥ 7:1 em todas as superfícies', (_nome, base, escuro) => {
    const alto = coresComContraste(base, 'ALTO', escuro);
    expect(alto.borda).toBe(base.bordaCampo);
    for (const superficie of [alto.fundo, alto.superficie, alto.superficie2, alto.superficie3, alto.sobre, alto.sobreNaFaixa]) {
      expect(contraste(alto.textoSuave, superficie)).toBeGreaterThanOrEqual(7);
    }
    expect(coresComContraste(base, 'PADRAO', escuro)).toBe(base);
  });

  // 14/11: a Areia ficou mais escura e o #3F3F46 fixo do Claro caiu a ~6,2:1 sobre ela; a conta vale para toda superfície em que o
  // texto secundário aparece, não só para uma delas.
  it('contraste alto na Areia: textoSuave ≥ 7:1 sobre fundo, painel, superficie, superficie2, superficie3 e faixaForte', () => {
    const alto = coresComContraste(PALETAS.AREIA.cores, 'ALTO', false);
    for (const s of [alto.fundo, alto.painel, alto.superficie, alto.superficie2, alto.superficie3, alto.sobre, alto.sobreNaFaixa, alto.faixaForte]) {
      expect(contraste(alto.textoSuave, s)).toBeGreaterThanOrEqual(7);
    }
  });

  it('contraste alto no Claro (e nas outras paletas claras): o texto secundário fecha ≥ 7:1 sobre todas as superfícies', () => {
    for (const codigo of ['CLARO', 'LAVANDA', 'CEU', 'ROSA'] as const) {
      const alto = coresComContraste(PALETAS[codigo].cores, 'ALTO', false);
      for (const s of [alto.fundo, alto.painel, alto.superficie, alto.superficie2, alto.superficie3, alto.sobre, alto.sobreNaFaixa, alto.faixaForte]) {
        expect(contraste(alto.textoSuave, s)).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it.each(Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO'] as const))('contorno do cartão no tema %s: divisor no padrão; no contraste alto ≥ 3:1 contra a página e o cartão, e a divisória fica na borda original', (_nome, base, escuro) => {
    expect(contornoDoCartao(base, 'PADRAO')).toBe(base.divisor);
    for (const reforcadas of [false, true]) {
      const alto = coresComBordasReforcadas(coresComContraste(base, 'ALTO', escuro), reforcadas);
      const contorno = contornoDoCartao(alto, 'ALTO');
      for (const fundo of [alto.fundo, alto.painel, alto.superficie]) expect(contraste(contorno, fundo)).toBeGreaterThanOrEqual(3);
      // Só o contorno do cartão sobe: a divisória interna fica na `borda` original (sem "bordas reforçadas").
      if (!reforcadas) expect(alto.divisor).toBe(base.borda);
    }
  });
});
