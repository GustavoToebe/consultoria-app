import { planejamentoDoResumo, precisaRenovar, proximoPassoDoAluno, treinosDoResumo, type SituacaoDaFonte } from './resumoDoAluno';

const HOJE = '2026-10-19';
const pasta = (id: string, inicio: string | null, fim: string | null, concluidaEm: string | null = null) => ({ id, titulo: `Ciclo ${id}`, inicio, fim, concluidaEm });
const ativo = { ativo: true, anonimizado: false, temAcesso: true };
const OK = { atualizacao: 'ok', pastas: 'ok' } as const;

describe('precisaRenovar', () => {
  it('aberta e terminando em até 7 dias, sem a pasta seguinte', () => {
    const p = pasta('5', '2026-09-20', '2026-10-24');
    expect(precisaRenovar(p, [p], HOJE)).toBe(true);
    expect(precisaRenovar(pasta('5', '2026-09-20', '2026-10-27'), [], HOJE)).toBe(false);
  });
  it('já terminada também pede, se ninguém renovou', () => {
    expect(precisaRenovar(pasta('5', '2026-09-20', '2026-10-10'), [], HOJE)).toBe(true);
  });
  it('não pede com a pasta seguinte criada, concluída ou sem fim', () => {
    const p = pasta('5', '2026-09-20', '2026-10-19');
    expect(precisaRenovar(p, [p, pasta('6', '2026-10-20', '2026-11-18')], HOJE)).toBe(false);
    expect(precisaRenovar(pasta('5', '2026-09-20', '2026-10-19', '2026-10-19T10:00:00Z'), [], HOJE)).toBe(false);
    expect(precisaRenovar(pasta('5', '2026-09-20', null), [], HOJE)).toBe(false);
  });
});

describe('proximoPassoDoAluno', () => {
  const p = pasta('5', '2026-09-20', '2026-10-19');
  const longe = pasta('7', '2026-10-10', '2026-11-30');
  it('revisar vem antes de renovar', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'ENVIADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE, fontes: OK }).acao).toBe('revisar');
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'REVISADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE, fontes: OK }))
      .toEqual({ texto: 'A pasta Ciclo 5 termina hoje. Renove para o próximo ciclo.', acao: 'renovar', tipo: 'atencao' });
  });
  it('atraso é perigo e não tem botão', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'ATRASADA', diasDeAtraso: 2 }, pasta: p, pastas: [p], hoje: HOJE, fontes: OK }))
      .toMatchObject({ acao: null, tipo: 'perigo', texto: 'A atualização está atrasada há 2 dias. Vale falar com o aluno.' });
  });
  it('atraso de mais de um ano diz desde quando (C76)', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'ATRASADA', diasDeAtraso: 644943 }, pasta: p, pastas: [p], hoje: HOJE, fontes: OK }).texto)
      .toMatch(/^A atualização está atrasada desde \d{2}\/\d{2}\/\d{4}\. Vale falar com o aluno\.$/);
  });
  it('inativo e anonimizado não sugerem trabalho, mesmo com as fontes carregando', () => {
    expect(proximoPassoDoAluno({ aluno: { ...ativo, ativo: false }, atualizacao: { fase: 'ENVIADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE, fontes: OK }).acao).toBeNull();
    expect(proximoPassoDoAluno({ aluno: { ...ativo, anonimizado: true, ativo: false }, atualizacao: null, pasta: null, pastas: [], hoje: HOJE,
      fontes: { atualizacao: 'carregando', pastas: 'carregando' } })).toMatchObject({ tipo: 'neutro', acao: null, texto: expect.stringMatching(/anonimizado/) });
  });
  it('sem pasta, sem acesso (com o atalho para o acesso) e em dia', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: null, pastas: [], hoje: HOJE, fontes: OK }).texto).toMatch(/primeira/);
    expect(proximoPassoDoAluno({ aluno: { ...ativo, temAcesso: false }, atualizacao: null, pasta: longe, pastas: [longe], hoje: HOJE, fontes: OK }))
      .toEqual({ texto: 'O aluno ainda não entra no app. Abra o acesso e escolha como convidar.', acao: 'acesso', tipo: 'atencao' });
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: longe, pastas: [longe], hoje: HOJE, fontes: OK })).toEqual({ texto: 'Tudo em dia.', acao: null, tipo: 'neutro' });
  });
  it('pasta aberta sem vigente não pede a primeira pasta', () => {
    const aberta = pasta('8', null, null);
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: null, pastas: [aberta], hoje: HOJE, fontes: OK }).texto).toBe('Tudo em dia.');
  });

  describe('fontes que não chegaram (guia de 11/11, pág. 32)', () => {
    const passo = (fontes: { atualizacao: SituacaoDaFonte; pastas: 'ok' | 'carregando' | 'erro' }, extra: Partial<Parameters<typeof proximoPassoDoAluno>[0]> = {}) =>
      proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: null, pastas: [], hoje: HOJE, fontes, ...extra });

    it('nunca diz "Tudo em dia" enquanto uma fonte carrega', () => {
      expect(passo({ atualizacao: 'carregando', pastas: 'ok' }, { pasta: longe, pastas: [longe] })).toMatchObject({ carregando: true, acao: null, tipo: 'neutro' });
      expect(passo({ atualizacao: 'ok', pastas: 'carregando' })).toMatchObject({ carregando: true });
    });
    it('a ordem não muda: sem acesso não aparece antes de a atualização chegar', () => {
      expect(passo({ atualizacao: 'carregando', pastas: 'ok' }, { aluno: { ...ativo, temAcesso: false }, pasta: longe, pastas: [longe] }).acao).toBeNull();
    });
    it('atualização enviada já decide, mesmo com as pastas carregando', () => {
      expect(passo({ atualizacao: 'ok', pastas: 'carregando' }, { atualizacao: { fase: 'ENVIADA', diasDeAtraso: 0 } }).acao).toBe('revisar');
    });
    it('pastas com erro não viram "Sem pasta ainda"', () => {
      expect(passo({ atualizacao: 'ok', pastas: 'erro' }).texto).toBe('Não foi possível conferir as pastas. O resto não pede ação agora.');
    });
    it('fonte com erro é pulada, e o passo seguinte ainda vale', () => {
      expect(passo({ atualizacao: 'erro', pastas: 'ok' }, { aluno: { ...ativo, temAcesso: false }, pasta: longe, pastas: [longe] }).acao).toBe('acesso');
      expect(passo({ atualizacao: 'erro', pastas: 'erro' }).texto).toBe('Não foi possível conferir a atualização e as pastas. O resto não pede ação agora.');
    });
    it('sem permissão para ver a atualização, não afirma que está tudo em dia', () => {
      expect(passo({ atualizacao: 'sem-permissao', pastas: 'ok' }, { pasta: longe, pastas: [longe] }).texto).toBe('Nada pendente no que o seu perfil mostra.');
    });
  });
});

describe('planejamentoDoResumo', () => {
  it('pasta vigente: abre a própria pasta', () => {
    const v = pasta('1', '2026-10-01', '2026-10-31');
    expect(planejamentoDoResumo(v, [v])).toEqual({ titulo: 'Pasta vigente', vigente: v, linha: null, atalho: { rotulo: 'Abrir pasta', pastaId: '1' } });
  });
  it('"Nenhuma pasta vigente" não é "sem planejamento": uma aberta, com o período que falta', () => {
    expect(planejamentoDoResumo(null, [pasta('2', null, null)])).toEqual({
      titulo: 'Nenhuma pasta vigente', vigente: null, linha: '1 pasta aberta · Sem período definido', atalho: { rotulo: 'Abrir pasta', pastaId: '2' },
    });
    expect(planejamentoDoResumo(null, [pasta('2', '2026-11-01', '2026-11-30')]).linha).toBe('1 pasta aberta');
  });
  it('várias abertas: a contagem e a aba Planos, sem escolher uma', () => {
    const r = planejamentoDoResumo(null, [pasta('2', null, null), pasta('3', null, null), pasta('4', null, null, '2026-10-01T10:00:00Z')]);
    expect(r).toMatchObject({ linha: '2 pastas abertas', atalho: { rotulo: 'Ver as 2 pastas', aba: 'planos' } });
  });
  it('rascunho só com certeza: a pasta que a tela sabe que só tem rascunho', () => {
    expect(planejamentoDoResumo(null, [pasta('2', null, null)], new Set(['2']))).toEqual({
      titulo: 'Nenhuma pasta vigente', vigente: null, linha: '1 pasta em rascunho · Sem período definido', atalho: { rotulo: 'Abrir rascunho', pastaId: '2' },
    });
    const duas = [pasta('2', null, null), pasta('3', null, null)];
    expect(planejamentoDoResumo(null, duas, new Set(['2', '3']))).toMatchObject({ linha: '2 pastas em rascunho', atalho: { rotulo: 'Ver rascunhos', aba: 'planos' } });
    expect(planejamentoDoResumo(null, duas, new Set(['3']))).toMatchObject({ linha: '2 pastas abertas · 1 em rascunho', atalho: { rotulo: 'Ver as 2 pastas', aba: 'planos' } });
    // Pasta finalizada ou vigente não vira rascunho, mesmo com o id na lista.
    const v = pasta('1', '2026-10-01', '2026-10-31');
    expect(planejamentoDoResumo(v, [v], new Set(['1'])).atalho).toEqual({ rotulo: 'Abrir pasta', pastaId: '1' });
  });
  it('só finalizadas ou nenhuma pasta', () => {
    expect(planejamentoDoResumo(null, [pasta('4', null, null, '2026-10-01T10:00:00Z')])).toMatchObject({ linha: '1 pasta finalizada', atalho: { aba: 'planos' } });
    expect(planejamentoDoResumo(null, [])).toEqual({ titulo: 'Nenhuma pasta ainda', vigente: null, linha: null, atalho: null });
  });
});

describe('treinosDoResumo', () => {
  const SEGUNDA = '2026-10-19';
  it('sem registro no período: uma linha de apoio, com o escopo', () => {
    expect(treinosDoResumo({ semana: 0, ultimo: null, pasta: null }, SEGUNDA, HOJE)).toEqual({ apoio: 'Treinos: ainda sem registros nesta semana.' });
    expect(treinosDoResumo({ semana: 0, ultimo: null, pasta: { de: '2026-10-01' } }, SEGUNDA, HOJE)).toEqual({ apoio: 'Treinos: ainda sem registros desde 01/10.' });
  });
  it('com registro: a contagem da semana e o último, com o escopo da consulta', () => {
    expect(treinosDoResumo({ semana: 3, ultimo: '2026-10-18', pasta: { de: '2026-10-01' } }, SEGUNDA, HOJE)).toEqual({ contagem: '3 nesta semana', ultimo: 'Ontem · desde 01/10' });
    expect(treinosDoResumo({ semana: 0, ultimo: '2026-10-15', pasta: { de: '2026-10-01' } }, SEGUNDA, HOJE)).toEqual({ contagem: 'Nenhum nesta semana', ultimo: 'Há 4 dias · desde 01/10' });
    // Pasta que começou depois da segunda: a consulta é a semana.
    expect(treinosDoResumo({ semana: 1, ultimo: '2026-10-19', pasta: { de: '2026-10-19' } }, SEGUNDA, HOJE)).toEqual({ contagem: '1 nesta semana', ultimo: 'Hoje · nesta semana' });
  });
});
