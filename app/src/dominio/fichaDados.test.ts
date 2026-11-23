import type { Lesao } from '../api/tipos';
import {
  contagemDeLesoes, DIAS_PARA_AVISAR_VIGENCIA, lesoesNaOrdem, observacaoLonga, periodoDaLesao, repeteAPeriodicidade, seloDaLesao,
  mostraVigencia, ultimasCobrancas, ultimoAcessoNaFicha, valorPorPeriodo, vigenciaDaContratacao,
} from './fichaDados';

// ficha do aluno: dados (23/11)

describe('ultimoAcessoNaFicha', () => {
  const agora = new Date('2026-11-23T15:00:00Z');
  it('login de dois dias atrás, no fuso de Brasília, com a data exata', () => {
    expect(ultimoAcessoNaFicha({ tipo: 'LOGIN', em: '2026-11-21T17:30:00Z' }, agora)).toEqual({ texto: 'Último login: há 2 dias', exata: '21/11/2026 às 14:30' });
  });
  it('a virada do dia é a de Brasília, não a do UTC', () => {
    // 01:00 UTC do dia 23 = 22:00 do dia 22 em Brasília: ontem.
    expect(ultimoAcessoNaFicha({ tipo: 'LOGIN', em: '2026-11-23T01:00:00Z' }, agora)?.texto).toBe('Último login: ontem');
  });
  it('acesso ao app só com o tipo ACESSO; ausente, malformado ou tipo desconhecido somem', () => {
    expect(ultimoAcessoNaFicha({ tipo: 'ACESSO', em: '2026-11-23T12:00:00Z' }, agora)?.texto).toBe('Último acesso ao app: hoje');
    expect(ultimoAcessoNaFicha(null, agora)).toBeNull();
    expect(ultimoAcessoNaFicha({ tipo: 'LOGIN', em: 'ontem' }, agora)).toBeNull();
    expect(ultimoAcessoNaFicha({ tipo: 'OUTRO' as never, em: '2026-11-23T12:00:00Z' }, agora)).toBeNull();
  });
});

describe('plano contratado', () => {
  it('valor por período; parcela única não é "por"', () => {
    expect(valorPorPeriodo('TRIMESTRAL')).toBe('por trimestre');
    expect(valorPorPeriodo('MENSAL')).toBe('por mês');
    expect(valorPorPeriodo('PARCELA_UNICA')).toBe('em parcela única');
    expect(valorPorPeriodo(null)).toBeNull();
  });
  it('a periodicidade some quando o nome do plano já é ela', () => {
    expect(repeteAPeriodicidade('Trimestral', 'Trimestral')).toBe(true);
    expect(repeteAPeriodicidade(' trimestral ', 'Trimestral')).toBe(true);
    expect(repeteAPeriodicidade('Consultoria trimestral', 'Trimestral')).toBe(false);
    expect(repeteAPeriodicidade(null, 'Mensal')).toBe(false);
  });
  it('vigência: 92 dias restantes no começo, neutra', () => {
    const v = vigenciaDaContratacao({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', inicio: '2026-11-23', terminoVigencia: '2027-02-23', diasRestantesVigencia: 92 });
    expect(v).toEqual({
      inicio: '23/11/2026', termino: '23/02/2027', fracao: 0, restantes: '92 dias restantes', tom: 'neutro',
      falado: 'Vigência de 23/11/2026 a 23/02/2027: 92 dias restantes',
    });
  });
  it(`vigência: com ${DIAS_PARA_AVISAR_VIGENCIA} dias ou menos, âmbar; com 16, neutra`, () => {
    const base = { periodicidade: 'TRIMESTRAL' as const, situacao: 'ATIVA' as const, inicio: '2026-11-23', terminoVigencia: '2027-02-23' };
    expect(vigenciaDaContratacao({ ...base, diasRestantesVigencia: 15 })?.tom).toBe('atencao');
    expect(vigenciaDaContratacao({ ...base, diasRestantesVigencia: 16 })?.tom).toBe('neutro');
    expect(vigenciaDaContratacao({ ...base, diasRestantesVigencia: 1 })?.restantes).toBe('1 dia restante');
    expect(vigenciaDaContratacao({ ...base, diasRestantesVigencia: 0 })).toMatchObject({ restantes: 'Termina hoje', tom: 'atencao' });
  });
  it('vigência vencida: vermelha, barra cheia, com os dias de atraso', () => {
    const v = vigenciaDaContratacao({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', inicio: '2026-08-05', terminoVigencia: '2026-09-05', diasRestantesVigencia: -79 });
    expect(v).toMatchObject({ restantes: 'Vencida há 79 dias', tom: 'perigo', fracao: 1 });
  });
  it('a barra anda pela fração do período que já passou', () => {
    const v = vigenciaDaContratacao({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', inicio: '2026-11-01', terminoVigencia: '2026-12-01', diasRestantesVigencia: 15 });
    expect(v?.fracao).toBeCloseTo(0.5, 2);
  });
  it('vigência só na contratação ATIVA de período maior que um mês (Gustavo, 23/11)', () => {
    expect(mostraVigencia('MENSAL', 'ATIVA')).toBe(false);
    expect(mostraVigencia(null, 'ATIVA')).toBe(false);
    for (const p of ['TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const) {
      expect(mostraVigencia(p, 'ATIVA')).toBe(true);
      expect(mostraVigencia(p, 'PAUSADA')).toBe(false);
      expect(mostraVigencia(p, 'ENCERRADA')).toBe(false);
    }
    expect(vigenciaDaContratacao({ periodicidade: 'MENSAL', situacao: 'ATIVA', inicio: '2026-08-05', terminoVigencia: '2026-09-05', diasRestantesVigencia: -79 })).toBeNull();
    expect(vigenciaDaContratacao({ periodicidade: 'ANUAL', situacao: 'PAUSADA', inicio: '2026-01-05', terminoVigencia: '2027-01-05', diasRestantesVigencia: 10 })).toBeNull();
    expect(vigenciaDaContratacao({ periodicidade: 'ANUAL', situacao: 'ATIVA', inicio: '2026-01-05', terminoVigencia: '2027-01-05', diasRestantesVigencia: 10 })?.tom).toBe('atencao');
  });
  it('sem término ou sem os dias da API, não há vigência', () => {
    expect(vigenciaDaContratacao({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', inicio: '2026-11-23', terminoVigencia: null, diasRestantesVigencia: 10 })).toBeNull();
    expect(vigenciaDaContratacao({ periodicidade: 'TRIMESTRAL', situacao: 'ATIVA', inicio: '2026-11-23', terminoVigencia: '2027-02-23', diasRestantesVigencia: null })).toBeNull();
  });
  it('as últimas 3 cobranças por vencimento, a mais recente primeiro, sem mexer na lista', () => {
    const lista = [{ vencimento: '2026-09-05' }, { vencimento: '2026-11-05' }, { vencimento: '2026-08-05' }, { vencimento: '2026-10-05' }];
    expect(ultimasCobrancas(lista).map((c) => c.vencimento)).toEqual(['2026-11-05', '2026-10-05', '2026-09-05']);
    expect(lista[0].vencimento).toBe('2026-09-05');
    expect(ultimasCobrancas([])).toEqual([]);
  });
});

describe('lesões', () => {
  const lesao = (id: string, situacao: Lesao['situacao'], dataInicio: string | null, dataFim: string | null = null): Lesao =>
    ({ id, regiao: `Região ${id}`, descricao: null, situacao, dataInicio, dataFim, observacao: null });

  it('período: "Desde" em aberto e "a" quando fechada, nunca "a em aberto"', () => {
    expect(periodoDaLesao({ dataInicio: '2026-11-01', dataFim: null })).toBe('Desde 01/11/2026');
    expect(periodoDaLesao({ dataInicio: '2026-11-01', dataFim: '2026-11-15' })).toBe('01/11/2026 a 15/11/2026');
    expect(periodoDaLesao({ dataInicio: null, dataFim: '2026-11-15' })).toBe('Até 15/11/2026');
    expect(periodoDaLesao({ dataInicio: null, dataFim: null })).toBe('—');
  });
  it('selo: ativa e em recuperação em âmbar, recuperada neutra', () => {
    expect(seloDaLesao('ATIVA')).toEqual({ texto: 'Ativa', tipo: 'atencao' });
    expect(seloDaLesao('EM_RECUPERACAO')).toEqual({ texto: 'Em recuperação', tipo: 'atencao' });
    expect(seloDaLesao('RECUPERADA')).toEqual({ texto: 'Recuperada', tipo: 'neutro' });
  });
  it('ativas primeiro (a ativa antes da em recuperação, a mais recente antes), recuperadas da que terminou por último', () => {
    const { ativas, recuperadas } = lesoesNaOrdem([
      lesao('r1', 'RECUPERADA', '2026-01-01', '2026-02-01'),
      lesao('e1', 'EM_RECUPERACAO', '2026-10-01'),
      lesao('a1', 'ATIVA', '2026-09-01'),
      lesao('r2', 'RECUPERADA', '2026-03-01', '2026-06-01'),
      lesao('a2', 'ATIVA', '2026-11-01'),
      lesao('a3', 'ATIVA', null),
    ]);
    expect(ativas.map((l) => l.id)).toEqual(['a2', 'a1', 'a3', 'e1']);
    expect(recuperadas.map((l) => l.id)).toEqual(['r2', 'r1']);
  });
  it('contagem: ativas (o mesmo critério do Resumo) e o total', () => {
    expect(contagemDeLesoes([lesao('a', 'ATIVA', null), lesao('r', 'RECUPERADA', null), lesao('s', 'RECUPERADA', null)])).toBe('1 ativa · 3 no total');
    expect(contagemDeLesoes([lesao('a', 'ATIVA', null), lesao('e', 'EM_RECUPERACAO', null)])).toBe('2 ativas · 2 no total');
    expect(contagemDeLesoes([lesao('r', 'RECUPERADA', null)])).toBe('Nenhuma ativa · 1 no total');
    expect(contagemDeLesoes([])).toBeNull();
  });
  it('observação longa: mais de 140 caracteres ou com quebra de linha', () => {
    expect(observacaoLonga('Curta.')).toBe(false);
    expect(observacaoLonga('a'.repeat(141))).toBe(true);
    expect(observacaoLonga('Linha 1\nLinha 2')).toBe(true);
  });
});
