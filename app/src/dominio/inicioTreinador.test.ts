import { proximoPassoDoInicio, tomDoContador, umPorAluno } from './inicioTreinador';

const nada = { paraRevisar: 0, atrasadas: 0, interessadosNovos: 0, planosTerminando: 0, semRegistro: 0, diasSemRegistro: 7 };

describe('proximoPassoDoInicio', () => {
  it('revisar vem primeiro, depois atrasadas, interessados, planos e sem registro', () => {
    expect(proximoPassoDoInicio({ ...nada, paraRevisar: 2, atrasadas: 1 })).toEqual({ texto: '2 atualizações chegaram para revisar.', acao: 'Revisar agora', destino: 'PARA_REVISAR' });
    expect(proximoPassoDoInicio({ ...nada, atrasadas: 1, interessadosNovos: 3 })?.texto).toBe('1 atualização está atrasada.');
    expect(proximoPassoDoInicio({ ...nada, interessadosNovos: 1, planosTerminando: 2 })?.destino).toBe('INTERESSADOS');
    expect(proximoPassoDoInicio({ ...nada, planosTerminando: 1 })?.texto).toBe('1 plano termina nos próximos 7 dias.');
    expect(proximoPassoDoInicio({ ...nada, semRegistro: 3, diasSemRegistro: 14 })?.texto).toBe('3 alunos estão sem registro há 14 dias.');
  });
  it('sem permissão (nulo) ou tudo zerado = nulo', () => {
    expect(proximoPassoDoInicio(nada)).toBeNull();
    expect(proximoPassoDoInicio({ ...nada, paraRevisar: null, atrasadas: null, interessadosNovos: null })).toBeNull();
  });
});

describe('umPorAluno', () => {
  it('o mais recente de cada aluno, até o limite', () => {
    const e = (id: string, data: string) => ({ aluno: { id }, data });
    const saida = umPorAluno([e('a', '2026-10-10'), e('a', '2026-10-12'), e('b', '2026-10-11'), e('c', '2026-10-01')], 2);
    expect(saida).toEqual([e('a', '2026-10-12'), e('b', '2026-10-11')]);
  });
});

describe('tomDoContador', () => {
  it('zerado suave; com algo, atenção ou perigo', () => {
    expect([tomDoContador(0), tomDoContador(2), tomDoContador(1, true)]).toEqual(['suave', 'atencao', 'perigo']);
  });
});
