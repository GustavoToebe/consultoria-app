import {
  chaveDosLancamentos, chipsDasCobrancas, chipsDosLancamentos, cobrancasParaApi, cobrancasParaEndereco, descricaoDasCobrancas,
  lancamentosParaEndereco, lerCobrancasDoEndereco, lerLancamentosDoEndereco, SEM_FILTROS_DE_COBRANCAS, SEM_FILTROS_DE_LANCAMENTOS,
  semOFiltroDeCobrancas, semOFiltroDeLancamentos, temFiltroDeLancamentos, vencimentoDaApi,
} from './filtrosDoFinanceiro';

const HOJE = '2026-10-19';

describe('filtros das cobranças', () => {
  const ALUNO = 'a0000000-0000-4000-8000-000000000001';
  const PLANO = 'p0000000-0000-4000-8000-000000000002';

  test('endereço: situações, meus, próximos 7 dias ou período, aluno, plano e forma; desconhecido é ignorado', () => {
    expect(lerCobrancasDoEndereco({})).toEqual(SEM_FILTROS_DE_COBRANCAS);
    expect(lerCobrancasDoEndereco({ situacao: 'QUALQUER,TODAS', vencimento: 'ONTEM', meus: 'talvez', forma: 'BOLETO', alunoId: '../x' }))
      .toEqual(SEM_FILTROS_DE_COBRANCAS);
    expect(lerCobrancasDoEndereco({ situacao: 'ABERTA', vencimento: 'PROXIMOS_7_DIAS', meus: 'true', de: '2026-10-01' }))
      .toEqual({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['ABERTA'], meus: true, proximos7Dias: true });
    expect(lerCobrancasDoEndereco({ situacao: 'vencida,PAGA', alunoId: ALUNO, planoId: PLANO, forma: 'online' }))
      .toEqual({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['VENCIDA', 'PAGA'], alunoId: ALUNO, planoId: PLANO, forma: 'ONLINE' });
    expect(lerCobrancasDoEndereco({ de: '2026-10-01', ate: '2026-10-31' }).periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  test('ida e volta pelo endereço', () => {
    const f = { ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['VENCIDA' as const, 'PAGA' as const], meus: true, periodo: { de: '2026-10-01', ate: null },
      alunoId: ALUNO, planoId: PLANO, forma: 'MANUAL' as const };
    expect(cobrancasParaEndereco(f)).toEqual({ situacao: 'VENCIDA,PAGA', meus: 'true', de: '2026-10-01', alunoId: ALUNO, planoId: PLANO, forma: 'MANUAL' });
    expect(lerCobrancasDoEndereco(cobrancasParaEndereco(f))).toEqual(f);
    expect(cobrancasParaEndereco({ ...SEM_FILTROS_DE_COBRANCAS, proximos7Dias: true })).toEqual({ vencimento: 'PROXIMOS_7_DIAS' });
  });

  test('vencimento e pedido para a API', () => {
    expect(vencimentoDaApi({ ...SEM_FILTROS_DE_COBRANCAS, proximos7Dias: true }, HOJE)).toEqual({ de: HOJE, ate: '2026-10-26' });
    expect(vencimentoDaApi({ ...SEM_FILTROS_DE_COBRANCAS, periodo: { de: null, ate: '2026-10-31' } }, HOJE)).toEqual({ ate: '2026-10-31' });
    expect(vencimentoDaApi(SEM_FILTROS_DE_COBRANCAS, HOJE)).toEqual({});
    expect(cobrancasParaApi({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['PAGA'], planoId: PLANO, forma: 'ONLINE', proximos7Dias: true }, HOJE))
      .toEqual({ situacoes: ['PAGA'], meus: false, de: HOJE, ate: '2026-10-26', planoId: PLANO, forma: 'ONLINE' });
  });

  test('chips, ✕ e descrição', () => {
    const f = { ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['ABERTA' as const, 'VENCIDA' as const], meus: true, proximos7Dias: true,
      alunoId: ALUNO, planoId: PLANO, forma: 'ONLINE' as const };
    expect(chipsDasCobrancas(f, HOJE, { aluno: 'Ana Fictícia', plano: () => 'Mensal' }).map((c) => c.texto)).toEqual([
      'Responsável: Meus', 'Situação: Em aberto, Vencidas', 'Vencimento: de hoje até 26/10/2026', 'Aluno: Ana Fictícia', 'Plano: Mensal',
      'Forma: Pagamento online',
    ]);
    expect(chipsDasCobrancas({ ...SEM_FILTROS_DE_COBRANCAS, alunoId: ALUNO }, HOJE).map((c) => c.texto)).toEqual(['Aluno: escolhido']);
    expect(semOFiltroDeCobrancas(f, 'vencimento').proximos7Dias).toBe(false);
    expect(semOFiltroDeCobrancas(f, 'responsavel').meus).toBe(false);
    expect(semOFiltroDeCobrancas(f, 'situacao').situacoes).toEqual([]);
    expect(semOFiltroDeCobrancas(f, 'aluno').alunoId).toBeNull();
    expect(semOFiltroDeCobrancas(f, 'plano').planoId).toBeNull();
    expect(semOFiltroDeCobrancas(f, 'forma').forma).toBeNull();
    expect(descricaoDasCobrancas({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['ABERTA'], proximos7Dias: true }, HOJE, 1))
      .toBe('Em aberto, vencimento de hoje até 26/10/2026: 1 cobrança, por vencimento. Toque na linha para abrir.');
    expect(descricaoDasCobrancas(SEM_FILTROS_DE_COBRANCAS, HOJE, 2)).toBe('Todas: 2 cobranças, por vencimento. Toque na linha para abrir.');
  });
});

describe('filtros dos lançamentos', () => {
  test('período, tipo e categorias no endereço e nos chips; categoria com vírgula volta inteira', () => {
    const f = lerLancamentosDoEndereco({ de: '2026-10-01', ate: '2026-10-31' });
    expect(lancamentosParaEndereco(f)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(chipsDosLancamentos(f)).toEqual([{ chave: 'periodo', texto: 'Data: 01/10/2026 a 31/10/2026' }]);
    expect(chipsDosLancamentos(lerLancamentosDoEndereco({ de: 'x' }))).toEqual([]);
    const g = { periodo: { de: null, ate: null }, tipo: 'SAIDA' as const, categorias: ['Aluguel, luz e água', '100% Aulas ~1'] };
    const endereco = lancamentosParaEndereco(g);
    expect(endereco).toEqual({ tipo: 'SAIDA', categoria: 'Aluguel~1 luz e água,100% Aulas ~01' });
    expect(lerLancamentosDoEndereco(endereco)).toEqual(g);
    expect(lerLancamentosDoEndereco({ tipo: 'TRANSFERENCIA', categoria: ' , ' })).toEqual(SEM_FILTROS_DE_LANCAMENTOS);
    expect(chipsDosLancamentos(g).map((c) => c.texto)).toEqual(['Tipo: Saídas', 'Categoria: Aluguel, luz e água, 100% Aulas ~1']);
    expect(semOFiltroDeLancamentos(g, 'categoria').categorias).toEqual([]);
    expect(semOFiltroDeLancamentos(g, 'tipo').tipo).toBeNull();
    expect(temFiltroDeLancamentos(SEM_FILTROS_DE_LANCAMENTOS)).toBe(false);
    expect(chaveDosLancamentos(g, 'luz')).not.toBe(chaveDosLancamentos(g));
  });
});
