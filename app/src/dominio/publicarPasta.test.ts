import type { PlanoResumo } from '../api/tipos';
import {
  agruparProblemasPorPlano,
  motivoParaNaoCopiar,
  motivoParaNaoPublicar,
  notaDoPesoSugerido,
  planoPendente,
  planosDaPasta,
  podeSugerirPeso,
  resumoDaPublicacao,
  textoDoErroDaCopia,
  textoDoErroDaPublicacao,
  type PlanosDaPasta,
} from './publicarPasta';

const PASTA = 'p1';

function plano(id: string, titulo: string, extra: Partial<PlanoResumo> = {}): PlanoResumo {
  return {
    id, alunoId: 'a1', pastaId: PASTA, titulo, inicio: null, fim: null, ativo: false,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1, ...extra,
  };
}

const publicadoSemAlteracao = (id: string, titulo: string) => plano(id, titulo, { versaoPublicada: 2 });
const alteradoDepois = (id: string, titulo: string) => plano(id, titulo, { versaoPublicada: 1, rascunhoAlteradoDepoisDePublicar: true });

const tem = (...codigos: string[]) => (c: string) => codigos.includes(c);

describe('publicarPasta: plano pendente', () => {
  it('nunca publicado ou alterado depois de publicar entra; publicado sem alteração não', () => {
    expect(planoPendente(plano('1', 'A'))).toBe(true);
    expect(planoPendente(alteradoDepois('1', 'A'))).toBe(true);
    expect(planoPendente(publicadoSemAlteracao('1', 'A'))).toBe(false);
  });
});

describe('publicarPasta: planos da pasta', () => {
  it('filtra pela pasta, mantém desconhecido como null e ignora a mobilidade fora do plano', () => {
    const outra = plano('x', 'Outra', { pastaId: 'p2' });
    const r = planosDaPasta(PASTA, { treino: [plano('t', 'T'), outra], dieta: null, mobilidade: [plano('m', 'M')] }, false);
    expect(r.treino?.map((p) => p.id)).toEqual(['t']);
    expect(r.dieta).toBeNull();
    expect(r.mobilidade).toEqual([]);
  });

  it('com a funcionalidade, a mobilidade da pasta conta', () => {
    const r = planosDaPasta(PASTA, { mobilidade: [plano('m', 'M')] }, true);
    expect(r.mobilidade?.map((p) => p.id)).toEqual(['m']);
    expect(r.treino).toBeNull();
  });
});

describe('publicarPasta: permissão para publicar', () => {
  const planos: PlanosDaPasta = { treino: [alteradoDepois('t', 'T')], dieta: [publicadoSemAlteracao('d', 'D')], mobilidade: [] };

  it('tipo sem alteração não pede permissão', () => {
    expect(motivoParaNaoPublicar(planos, tem('TREINO_PUBLICAR'))).toBeNull();
  });

  it('falta a de um tipo com alteração: diz qual', () => {
    expect(motivoParaNaoPublicar(planos, tem('DIETA_PUBLICAR'))).toBe('Falta permissão para publicar o treino.');
    const comDieta: PlanosDaPasta = { ...planos, dieta: [plano('d', 'D')] };
    expect(motivoParaNaoPublicar(comDieta, tem('TREINO_PUBLICAR'))).toBe('Falta permissão para publicar a dieta.');
  });

  it('treino e mobilidade pedem a do treino e aparecem juntos', () => {
    const p: PlanosDaPasta = { treino: [plano('t', 'T')], dieta: [plano('d', 'D')], mobilidade: [plano('m', 'M')] };
    expect(motivoParaNaoPublicar(p, tem())).toBe('Falta permissão para publicar o treino, a dieta e a mobilidade.');
    expect(motivoParaNaoPublicar(p, tem('DIETA_PUBLICAR'))).toBe('Falta permissão para publicar o treino e a mobilidade.');
  });

  it('tipo desconhecido (não lido) não trava: o servidor decide', () => {
    expect(motivoParaNaoPublicar({ treino: null, dieta: null, mobilidade: null }, tem())).toBeNull();
  });
});

describe('publicarPasta: permissão para copiar', () => {
  it('pede o ALTERAR de cada tipo presente, publicado ou não', () => {
    const p: PlanosDaPasta = { treino: [publicadoSemAlteracao('t', 'T')], dieta: [publicadoSemAlteracao('d', 'D')], mobilidade: [] };
    expect(motivoParaNaoCopiar(p, tem('TREINO_ALTERAR', 'DIETA_ALTERAR'))).toBeNull();
    expect(motivoParaNaoCopiar(p, tem('TREINO_ALTERAR'))).toBe('Falta permissão para alterar a dieta.');
    expect(motivoParaNaoCopiar({ treino: [], dieta: null, mobilidade: [] }, tem())).toBeNull();
  });
});

describe('publicarPasta: resumo', () => {
  const pub = (n: number) => Array.from({ length: n }, (_, i) => ({ tipo: 'treino' as const, planoId: `${i}`, versao: 1 }));
  const pul = (n: number) => Array.from({ length: n }, (_, i) => ({ tipo: 'dieta' as const, planoId: `${i}` }));

  it('singular, plural e sem os pulados', () => {
    expect(resumoDaPublicacao({ publicados: pub(1), pulados: pul(1) })).toBe('1 publicado, 1 sem alteração.');
    expect(resumoDaPublicacao({ publicados: pub(2), pulados: pul(3) })).toBe('2 publicados, 3 sem alteração.');
    expect(resumoDaPublicacao({ publicados: pub(3), pulados: [] })).toBe('3 publicados.');
  });

  it('nada publicado: diz que não havia o que publicar', () => {
    expect(resumoDaPublicacao({ publicados: [], pulados: pul(2) })).toBe('Nada para publicar: os planos já estão publicados e sem alteração.');
    expect(resumoDaPublicacao({ publicados: [], pulados: [] })).toBe('Nada para publicar: os planos já estão publicados e sem alteração.');
  });
});

describe('publicarPasta: problemas por plano', () => {
  const planos: PlanosDaPasta = {
    treino: [plano('t1', 'Treino A'), alteradoDepois('t2', 'Treino B')],
    dieta: [plano('d1', 'Dieta do Plano 17'), publicadoSemAlteracao('d2', 'Dieta antiga')],
    mobilidade: [],
  };

  it('agrupa pelo prefixo, com o nome pelo id ou pelo único pendente do tipo', () => {
    const grupos = agruparProblemasPorPlano([
      { field: 'treino[t1].sessoes[0].exercicios[1].series', message: 'Informe as séries.' },
      { field: 'dieta.refeicoes[0].itens[2].quantidade', message: 'Informe a quantidade.' },
      { field: 'treino[t2].titulo', message: 'Informe o título.' },
      { field: 'dieta', message: 'A dieta precisa de uma refeição.' },
    ], planos);
    expect(grupos).toEqual([
      { chave: 'treino[t1]', tipo: 'treino', planoId: 't1', titulo: 'Treino: Treino A', problemas: [{ mensagem: 'Informe as séries.' }] },
      { chave: 'dieta', tipo: 'dieta', planoId: 'd1', titulo: 'Dieta: Dieta do Plano 17', problemas: [{ mensagem: 'Informe a quantidade.' }, { mensagem: 'A dieta precisa de uma refeição.' }] },
      { chave: 'treino[t2]', tipo: 'treino', planoId: 't2', titulo: 'Treino: Treino B', problemas: [{ mensagem: 'Informe o título.' }] },
    ]);
  });

  it('sem id e com mais de um pendente (ou tipo não lido), fica só o tipo', () => {
    expect(agruparProblemasPorPlano([{ field: 'treino.x', message: 'm' }], planos)[0]?.titulo).toBe('Treino');
    expect(agruparProblemasPorPlano([{ field: 'mobilidade.secoes', message: 'm' }], { ...planos, mobilidade: null })[0]?.titulo).toBe('Mobilidade');
  });

  it('campo fora do formato vai para "Outros", nunca some', () => {
    expect(agruparProblemasPorPlano([{ field: 'pasta', message: 'Algo.' }, { field: 'treinos.x', message: 'Outro.' }], planos)).toEqual([
      { chave: 'outros', tipo: null, planoId: null, titulo: 'Outros', problemas: [{ mensagem: 'Algo.' }, { mensagem: 'Outro.' }] },
    ]);
  });
});

describe('publicarPasta: textos de erro', () => {
  it('publicar: 403 e 404 com texto próprio; o resto, a mensagem da API', () => {
    expect(textoDoErroDaPublicacao({ status: 403, codigo: 'PERMISSAO_NEGADA', mensagem: 'x' })).toMatch(/permissão.*Nada foi publicado/);
    expect(textoDoErroDaPublicacao({ status: 404, codigo: null, mensagem: 'x' })).toMatch(/não foi encontrada/);
    expect(textoDoErroDaPublicacao({ status: 0, codigo: 'SEM_CONEXAO', mensagem: 'Sem conexão.' })).toBe('Sem conexão.');
  });

  it('copiar: anonimizado, não encontrado, sem permissão e 400 da API', () => {
    expect(textoDoErroDaCopia({ status: 409, codigo: 'ALUNO_ANONIMIZADO', mensagem: 'x' })).toMatch(/anonimizado/);
    expect(textoDoErroDaCopia({ status: 404, codigo: null, mensagem: 'x' })).toMatch(/Não encontramos/);
    expect(textoDoErroDaCopia({ status: 403, codigo: null, mensagem: 'x' })).toMatch(/permissão/);
    expect(textoDoErroDaCopia({ status: 400, codigo: null, mensagem: 'Escolha outro aluno.' })).toBe('Escolha outro aluno.');
  });
});

describe('publicarPasta: peso sugerido', () => {
  it('só com ler o sensível, ler a atualização e gravar o peso', () => {
    expect(podeSugerirPeso(tem('ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_ALTERAR'))).toBe(true);
    expect(podeSugerirPeso(tem('ALUNO_SENSIVEL_LER', 'ATUALIZACAO_LER'))).toBe(false);
    expect(podeSugerirPeso(tem('ATUALIZACAO_LER', 'ALUNO_SENSIVEL_ALTERAR'))).toBe(false);
  });

  it('nota com a data da atualização', () => {
    expect(notaDoPesoSugerido('2026-10-20')).toBe('Peso preenchido com o da atualização de 20/10/2026; confira antes de salvar.');
    expect(notaDoPesoSugerido(null)).toBe('Peso preenchido com o da atualização; confira antes de salvar.');
  });
});
