import { linhaDeDatas, seloDaSituacao } from './cabecalhoDaFicha';

describe('linhaDeDatas', () => {
  it('as três partes, na ordem, no fuso de Brasília', () => {
    expect(linhaDeDatas({
      cadastroAlteradoEm: '2026-11-18T17:32:00Z',
      ultimoAcesso: { tipo: 'ACESSO', em: '2026-11-18T12:05:00Z' },
      ultimoPlanoPublicado: { em: '2026-11-15T13:00:00Z', porNome: 'Treinador Fictício' },
    })).toEqual([
      'Cadastro alterado em 18/11/2026 14:32',
      'Último acesso ao app em 18/11/2026 09:05',
      'Último plano publicado em 15/11/2026 por Treinador Fictício',
    ]);
  });

  it('perto da meia-noite UTC vale o dia de Brasília', () => {
    expect(linhaDeDatas({ cadastroAlteradoEm: '2026-11-19T02:30:00Z' })).toEqual(['Cadastro alterado em 18/11/2026 23:30']);
  });

  it('login nunca é chamado de acesso', () => {
    expect(linhaDeDatas({ ultimoAcesso: { tipo: 'LOGIN', em: '2026-11-18T12:05:00Z' } })).toEqual(['Último login em 18/11/2026 09:05']);
  });

  it('sem autor gravado, sem o " por"', () => {
    expect(linhaDeDatas({ ultimoPlanoPublicado: { em: '2026-11-15T13:00:00Z', porNome: null } })).toEqual(['Último plano publicado em 15/11/2026']);
    expect(linhaDeDatas({ ultimoPlanoPublicado: { em: '2026-11-15T13:00:00Z', porNome: '  ' } })).toEqual(['Último plano publicado em 15/11/2026']);
  });

  it('ausente, nulo, malformado ou de tipo desconhecido: a parte some, sem traço nem data inventada', () => {
    expect(linhaDeDatas({})).toEqual([]);
    expect(linhaDeDatas({ cadastroAlteradoEm: null, ultimoAcesso: null, ultimoPlanoPublicado: null })).toEqual([]);
    expect(linhaDeDatas({ cadastroAlteradoEm: 'ontem', ultimoPlanoPublicado: { em: '', porNome: 'X' } })).toEqual([]);
    const desconhecido = { tipo: 'OUTRO', em: '2026-11-18T12:05:00Z' } as unknown as { tipo: 'ACESSO'; em: string };
    expect(linhaDeDatas({ ultimoAcesso: desconhecido })).toEqual([]);
  });
});

describe('seloDaSituacao', () => {
  it('ativo em verde; inativo e anonimizado neutros, e anonimizado vale mais', () => {
    expect(seloDaSituacao({ ativo: true, anonimizado: false })).toEqual({ texto: 'Ativo', tipo: 'sucesso' });
    expect(seloDaSituacao({ ativo: false, anonimizado: false })).toEqual({ texto: 'Inativo', tipo: 'neutro' });
    expect(seloDaSituacao({ ativo: false, anonimizado: true })).toEqual({ texto: 'Anonimizado', tipo: 'neutro' });
  });

  it('acesso pausado (âmbar) e desativado (neutro com ●) só com o aluno ativo e não anonimizado', () => {
    expect(seloDaSituacao({ ativo: true, anonimizado: false, acessoDesativadoMotivo: 'ATRASO' })).toEqual({ texto: 'Acesso pausado', tipo: 'atencao' });
    expect(seloDaSituacao({ ativo: true, anonimizado: false, acessoDesativadoMotivo: 'MANUAL' })).toEqual({ texto: 'Acesso desativado', tipo: 'neutro', ponto: true });
    expect(seloDaSituacao({ ativo: false, anonimizado: false, acessoDesativadoMotivo: 'ATRASO' })).toEqual({ texto: 'Inativo', tipo: 'neutro' });
    expect(seloDaSituacao({ ativo: true, anonimizado: true, acessoDesativadoMotivo: 'MANUAL' })).toEqual({ texto: 'Anonimizado', tipo: 'neutro' });
  });
});
