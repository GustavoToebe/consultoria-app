import type { FaseAtualizacao } from '../api/tipos';
import { agruparAlunos, colunasDaLista, metadadosDaLinha, primeiroNome, ultimoRegistroDaLinha, vazioDaLista } from './gruposDeAlunos';

type Aluno = { id: string; atualizacao?: { fase: FaseAtualizacao } | null };
const a = (id: string, fase?: FaseAtualizacao | null): Aluno => (fase === undefined ? { id } : { id, atualizacao: fase === null ? null : { fase } });
const ids = (lista: readonly Aluno[]) => lista.map((x) => x.id);

describe('agruparAlunos', () => {
  it('ordem fixa dos grupos, com título, tom e resumo', () => {
    const grupos = agruparAlunos(
      [a('1', null), a('2', 'REVISADA'), a('3', 'ATRASADA'), a('4', 'ENVIADA'), a('5', 'ENVIADA')],
      true,
    );
    expect(grupos.map((g) => [g.chave, g.titulo, g.tom])).toEqual([
      ['PARA_REVISAR', 'Para revisar', 'atencao'],
      ['ATRASADOS', 'Atrasados', 'perigo'],
      ['EM_DIA', 'Em dia', 'sucesso'],
      ['SEM_PASTA', 'Sem pasta com período', 'neutro'],
    ]);
    expect(grupos.map((g) => g.resumo)).toEqual([
      '2 alunos · A atualização chegou e espera o seu feedback.',
      '1 aluno · Passou da data e o aluno ainda não enviou.',
      '1 aluno · Atualização ainda por vir ou já revisada.',
      '1 aluno · Sem atualização para acompanhar ainda.',
    ]);
  });

  it('grupo vazio não aparece e lista vazia dá []', () => {
    expect(agruparAlunos([a('1', 'ATRASADA')], true).map((g) => g.chave)).toEqual(['ATRASADOS']);
    expect(agruparAlunos([], true)).toEqual([]);
    expect(agruparAlunos([], false)).toEqual([]);
  });

  it('cada fase cai no grupo certo', () => {
    const fases: [FaseAtualizacao, string][] = [
      ['ENVIADA', 'PARA_REVISAR'], ['ATRASADA', 'ATRASADOS'], ['NENHUMA', 'EM_DIA'], ['AVISO', 'EM_DIA'], ['ABERTA', 'EM_DIA'], ['REVISADA', 'EM_DIA'],
    ];
    for (const [fase, chave] of fases) {
      expect(agruparAlunos([a('x', fase)], true).map((g) => g.chave)).toEqual([chave]);
    }
  });

  it('atualização nula e ausente ficam em "Sem pasta com período"', () => {
    const grupos = agruparAlunos([a('1', null), a('2')], true);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe('SEM_PASTA');
    expect(ids(grupos[0].itens)).toEqual(['1', '2']);
  });

  it('sem permissão de ver atualização, um grupo só e sem tom', () => {
    const grupos = agruparAlunos([a('1', 'ENVIADA'), a('2', null), a('3')], false);
    expect(grupos).toEqual([{ chave: 'TODOS', titulo: 'Alunos', tom: null, resumo: '3 alunos', itens: [a('1', 'ENVIADA'), a('2', null), a('3')] }]);
    expect(agruparAlunos([a('1')], false)[0].resumo).toBe('1 aluno');
  });

  it('plural: 1 aluno, N alunos', () => {
    expect(agruparAlunos([a('1', 'ENVIADA')], true)[0].resumo.startsWith('1 aluno ·')).toBe(true);
    expect(agruparAlunos([a('1', 'ENVIADA'), a('2', 'ENVIADA')], true)[0].resumo.startsWith('2 alunos ·')).toBe(true);
  });

  it('mantém a ordem em que os itens vieram, dentro de cada grupo', () => {
    const grupos = agruparAlunos([a('c', 'REVISADA'), a('a', 'ENVIADA'), a('b', 'ABERTA'), a('d', 'ENVIADA'), a('e', 'NENHUMA')], true);
    expect(ids(grupos[0].itens)).toEqual(['a', 'd']);
    expect(ids(grupos[1].itens)).toEqual(['c', 'b', 'e']);
  });

  it('não altera a lista recebida', () => {
    const lista = [a('1', 'ENVIADA')];
    agruparAlunos(lista, false)[0].itens.push(a('2'));
    expect(lista).toHaveLength(1);
  });
});

describe('primeiroNome', () => {
  it('primeira palavra, sem espaços', () => {
    expect(primeiroNome('Maria da Silva')).toBe('Maria');
    expect(primeiroNome('  João   Pedro ')).toBe('João');
    expect(primeiroNome('Ana')).toBe('Ana');
  });
  it('vazio vira "—"', () => {
    expect(primeiroNome('')).toBe('—');
    expect(primeiroNome('   ')).toBe('—');
  });
});

describe('ultimoRegistroDaLinha', () => {
  const HOJE = '2026-10-19';
  it('nunca registrou é suave', () => {
    expect(ultimoRegistroDaLinha(null, HOJE)).toEqual({ texto: 'Nunca registrou', suave: true });
  });
  it('hoje e ontem com maiúscula, sem suavizar; aceita instante com hora', () => {
    expect(ultimoRegistroDaLinha('2026-10-19', HOJE)).toEqual({ texto: 'Hoje', suave: false });
    expect(ultimoRegistroDaLinha('2026-10-19T10:00:00Z', HOJE)).toEqual({ texto: 'Hoje', suave: false });
    expect(ultimoRegistroDaLinha('2026-10-18', HOJE)).toEqual({ texto: 'Ontem', suave: false });
  });
  it('7 dias não é suave; 8 dias é, e vira data curta', () => {
    expect(ultimoRegistroDaLinha('2026-10-12', HOJE)).toEqual({ texto: 'Há 7 dias', suave: false });
    expect(ultimoRegistroDaLinha('2026-10-11', HOJE)).toEqual({ texto: '11/10', suave: true });
  });
});

describe('colunasDaLista (N2)', () => {
  const todas = ['aluno', 'plano', 'atualizacao', 'ultimo', 'responsavel'].map((chave) => ({ chave }));
  const chaves = (ve: { atualizacao: boolean; registro: boolean }) => colunasDaLista(todas, ve).map((c) => c.chave);

  it('sem REGISTRO_LER a coluna Último registro some; sem atualização, a de Atualização', () => {
    expect(chaves({ atualizacao: true, registro: true })).toEqual(['aluno', 'plano', 'atualizacao', 'ultimo', 'responsavel']);
    expect(chaves({ atualizacao: true, registro: false })).toEqual(['aluno', 'plano', 'atualizacao', 'responsavel']);
    expect(chaves({ atualizacao: false, registro: false })).toEqual(['aluno', 'plano', 'responsavel']);
  });
});

describe('metadadosDaLinha (N2)', () => {
  it('com REGISTRO_LER diz o último registro ou "Nunca registrou"', () => {
    expect(metadadosDaLinha(null, null, true)).toBe('Sem plano ativo · Nunca registrou');
    expect(metadadosDaLinha('Treino A', null, true)).toBe('Treino A · Nunca registrou');
    expect(metadadosDaLinha('Treino A', '2026-10-30', true)).toMatch(/^Treino A · Último registro /);
  });

  it('sem REGISTRO_LER não afirma que o aluno nunca registrou', () => {
    expect(metadadosDaLinha('Treino A', null, false)).toBe('Treino A');
    expect(metadadosDaLinha(null, null, false)).toBe('Sem plano ativo');
  });
});

describe('vazioDaLista (N2, N23)', () => {
  it('busca, lista vazia e filtros têm textos próprios', () => {
    expect(vazioDaLista({ termo: 'ana', chaves: ['situacao'], responsaveis: [] })).toMatchObject({ titulo: 'Nenhum aluno encontrado', verTodos: false });
    expect(vazioDaLista({ termo: '', chaves: [], responsaveis: [] })).toMatchObject({ titulo: 'Nenhum aluno ainda', verTodos: false });
    const filtrado = vazioDaLista({ termo: '', chaves: ['situacao', 'responsavel'], responsaveis: ['meus'] });
    expect(filtrado.texto).toBe('Nenhum aluno passa nesses filtros. Tire algum dos filtros acima.');
    expect(filtrado.verTodos).toBe(false);
  });

  it('só "Meus alunos" sem nenhum aluno: "Você não é responsável por nenhum aluno"', () => {
    expect(vazioDaLista({ termo: '', chaves: ['responsavel'], responsaveis: ['meus'] }))
      .toEqual({ titulo: 'Nenhum aluno seu', texto: 'Você não é responsável por nenhum aluno.', verTodos: true });
    // Meus junto de outra pessoa não é o caso.
    expect(vazioDaLista({ termo: '', chaves: ['responsavel'], responsaveis: ['meus', 'x'] }).verTodos).toBe(false);
  });

  it('o texto do vazio não manda "limpar" (o botão é um só, na barra de filtros)', () => {
    expect(vazioDaLista({ termo: '', chaves: ['acesso'], responsaveis: [] }).texto).not.toMatch(/limpe/i);
  });
});
