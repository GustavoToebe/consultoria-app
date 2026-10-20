import { precisaRenovar, proximoPassoDoAluno } from './resumoDoAluno';

const HOJE = '2026-10-19';
const pasta = (id: string, inicio: string | null, fim: string | null, concluidaEm: string | null = null) => ({ id, titulo: `Ciclo ${id}`, inicio, fim, concluidaEm });
const ativo = { ativo: true, anonimizado: false, temAcesso: true };

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
  it('revisar vem antes de renovar', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'ENVIADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE }).acao).toBe('revisar');
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'REVISADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE }))
      .toEqual({ texto: 'A pasta Ciclo 5 termina hoje. Renove para o próximo ciclo.', acao: 'renovar', tipo: 'atencao' });
  });
  it('atraso é perigo e não tem botão', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: { fase: 'ATRASADA', diasDeAtraso: 2 }, pasta: p, pastas: [p], hoje: HOJE }))
      .toMatchObject({ acao: null, tipo: 'perigo', texto: 'A atualização está atrasada há 2 dias. Vale falar com o aluno.' });
  });
  it('inativo e anonimizado não sugerem trabalho', () => {
    expect(proximoPassoDoAluno({ aluno: { ...ativo, ativo: false }, atualizacao: { fase: 'ENVIADA', diasDeAtraso: 0 }, pasta: p, pastas: [p], hoje: HOJE }).acao).toBeNull();
    expect(proximoPassoDoAluno({ aluno: { ...ativo, anonimizado: true, ativo: false }, atualizacao: null, pasta: null, pastas: [], hoje: HOJE }).tipo).toBe('neutro');
  });
  it('sem pasta, sem acesso e em dia', () => {
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: null, pastas: [], hoje: HOJE }).texto).toMatch(/primeira/);
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: undefined, pastas: [], hoje: HOJE }).texto).toBe('Tudo em dia.');
    const longe = pasta('7', '2026-10-10', '2026-11-30');
    expect(proximoPassoDoAluno({ aluno: { ...ativo, temAcesso: false }, atualizacao: null, pasta: longe, pastas: [longe], hoje: HOJE }).texto).toMatch(/convite/);
    expect(proximoPassoDoAluno({ aluno: ativo, atualizacao: null, pasta: longe, pastas: [longe], hoje: HOJE })).toEqual({ texto: 'Tudo em dia.', acao: null, tipo: 'neutro' });
  });
});
