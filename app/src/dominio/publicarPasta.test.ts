import type { PlanoResumo } from '../api/tipos';
import {
  agruparProblemasPorPlano,
  AVISO_DA_COPIA_DA_PASTA,
  mensagemPastaCopiada,
  motivoParaNaoCopiar,
  motivoParaNaoPublicar,
  notaDoPesoSugerido,
  planoPendente,
  planosDaPasta,
  podeSugerirPeso,
  resumoDaPublicacao,
  situacaoDoPublicar,
  TEXTO_DO_CONFLITO_DA_PUBLICACAO,
  textoDoErroDaCopia,
  textoDoErroDaPublicacao,
  textoDosPendentesDuplicados,
  versoesDosPendentes,
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

describe('publicarPasta: situação do "Publicar tudo" com lista que falhou', () => {
  const planos: PlanosDaPasta = { treino: [alteradoDepois('t', 'T')], dieta: null, mobilidade: [] };
  const tudo = tem('TREINO_PUBLICAR', 'DIETA_PUBLICAR');

  it('lista de um tipo falhou: desabilita, diz qual (concordância por tipo) e aponta o que recarregar', () => {
    const dieta = situacaoDoPublicar(planos, { dieta: true }, true, tudo);
    expect(dieta).toEqual({ podePublicar: false, motivo: 'Não foi possível carregar a dieta. Tente de novo.', tiposComFalha: ['dieta'] });
    expect(situacaoDoPublicar(planos, { treino: true }, true, tudo).motivo).toBe('Não foi possível carregar o treino. Tente de novo.');
    expect(situacaoDoPublicar(planos, { mobilidade: true }, true, tudo).motivo).toBe('Não foi possível carregar a mobilidade. Tente de novo.');
  });

  it('vários tipos: junta na ordem treino, dieta, mobilidade', () => {
    const r = situacaoDoPublicar(planos, { mobilidade: true, treino: true, dieta: true }, true, tudo);
    expect(r.motivo).toBe('Não foi possível carregar o treino, a dieta e a mobilidade. Tente de novo.');
    expect(r.tiposComFalha).toEqual(['treino', 'dieta', 'mobilidade']);
    expect(situacaoDoPublicar(planos, { treino: true, dieta: true }, true, tudo).motivo).toBe('Não foi possível carregar o treino e a dieta. Tente de novo.');
  });

  it('a falha vale mais que a permissão, que não é dita enquanto a lista não chega', () => {
    expect(situacaoDoPublicar(planos, { dieta: true }, true, tem()).tiposComFalha).toEqual(['dieta']);
  });

  it('mobilidade fora do plano não conta como falha', () => {
    expect(situacaoDoPublicar(planos, { mobilidade: true }, false, tudo)).toEqual({ podePublicar: true, motivo: null, tiposComFalha: [] });
  });

  it('sem falha vale a permissão: libera, ou diz o que falta', () => {
    expect(situacaoDoPublicar(planos, {}, true, tudo)).toEqual({ podePublicar: true, motivo: null, tiposComFalha: [] });
    expect(situacaoDoPublicar(planos, { treino: false }, true, tem('DIETA_PUBLICAR'))).toEqual({
      podePublicar: false, motivo: 'Falta permissão para publicar o treino.', tiposComFalha: [],
    });
  });

  it('alguma lista sendo buscada de novo: espera, com o motivo, mais forte que falha e permissão', () => {
    const esperando = { podePublicar: false, motivo: 'Atualizando os planos…', tiposComFalha: [] };
    expect(situacaoDoPublicar(planos, {}, true, tudo, true)).toEqual(esperando);
    expect(situacaoDoPublicar(planos, { dieta: true }, true, tudo, true)).toEqual(esperando);
    expect(situacaoDoPublicar(planos, {}, true, tem(), true)).toEqual(esperando);
    expect(situacaoDoPublicar(planos, {}, true, tudo, false).podePublicar).toBe(true);
  });

  it('nada chegou (planos nulos) e sem falha: não trava aqui', () => {
    expect(situacaoDoPublicar(null, {}, true, tudo).podePublicar).toBe(true);
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

describe('publicarPasta: versões que a tela leu', () => {
  it('só os pendentes, com a versão do rascunho (nunca a publicada)', () => {
    const planos: PlanosDaPasta = {
      treino: [plano('t1', 'T', { versao: 7 }), publicadoSemAlteracao('t2', 'T velho')],
      dieta: [{ ...alteradoDepois('d1', 'D'), versao: 4 }],
      mobilidade: [],
    };
    expect(versoesDosPendentes(planos)).toEqual({ t1: 7, d1: 4 });
  });

  it('tipo desconhecido fica de fora; sem planos ou nada pendente, objeto vazio', () => {
    expect(versoesDosPendentes({ treino: null, dieta: [plano('d1', 'D', { versao: 2 })], mobilidade: null })).toEqual({ d1: 2 });
    expect(versoesDosPendentes({ treino: [publicadoSemAlteracao('t', 'T')], dieta: [], mobilidade: [] })).toEqual({});
    expect(versoesDosPendentes(null)).toEqual({});
  });

  it('a lista do momento: lista recarregada com versão nova muda o que vai no pedido', () => {
    const antes: PlanosDaPasta = { treino: [], dieta: [plano('d1', 'D', { versao: 2 })], mobilidade: [] };
    const depois: PlanosDaPasta = { treino: [], dieta: [plano('d1', 'D', { versao: 3 })], mobilidade: [] };
    expect(versoesDosPendentes(antes)).toEqual({ d1: 2 });
    expect(versoesDosPendentes(depois)).toEqual({ d1: 3 });
  });
});

describe('publicarPasta: textos dos 409', () => {
  it('conflito de edição: aviso neutro, nada publicado', () => {
    expect(TEXTO_DO_CONFLITO_DA_PUBLICACAO).toBe('Os planos mudaram enquanto você olhava. Nada foi publicado; confira e publique de novo.');
  });

  it('pendentes duplicados: uma frase por tipo, com artigo certo, sem repetir, e a saída é arquivar', () => {
    const fim = 'Nada foi publicado. Arquive o que não deve ir ao aluno (⋯ › Excluir plano) e publique de novo.';
    expect(textoDosPendentesDuplicados([{ field: 'treino' }, { field: 'treino' }]))
      .toBe(`Há mais de um treino pendente nesta pasta. ${fim}`);
    expect(textoDosPendentesDuplicados([{ field: 'dieta' }, { field: 'dieta' }]))
      .toBe(`Há mais de uma dieta pendente nesta pasta. ${fim}`);
    expect(textoDosPendentesDuplicados([{ field: 'mobilidade' }, { field: 'dieta' }, { field: 'mobilidade' }]))
      .toBe(`Há mais de uma dieta pendente nesta pasta. Há mais de uma mobilidade pendente nesta pasta. ${fim}`);
  });

  it('pendentes duplicados: nunca manda publicar pelo editor', () => {
    expect(textoDosPendentesDuplicados([{ field: 'treino' }])).not.toMatch(/editor|Publique/);
  });

  it('pendentes duplicados: mostra o título dos planos repetidos que a lista da tela conhece', () => {
    const planos: PlanosDaPasta = {
      treino: [plano('t1', 'Treino A'), alteradoDepois('t2', 'Treino B'), alteradoDepois('t3', 'Treino C')],
      dieta: [plano('d1', 'Dieta X'), plano('d2', 'Dieta Y')],
      mobilidade: null,
    };
    const campos = [
      { field: 'treino', message: 't1' }, { field: 'treino', message: 't2' }, { field: 'treino', message: 't3' },
      { field: 'dieta', message: 'd1' }, { field: 'dieta', message: 'd9' },
    ];
    expect(textoDosPendentesDuplicados(campos, planos)).toBe(
      'Há mais de um treino pendente nesta pasta (“Treino A”, “Treino B” e “Treino C”). '
      + 'Há mais de uma dieta pendente nesta pasta (“Dieta X”). '
      + 'Nada foi publicado. Arquive o que não deve ir ao aluno (⋯ › Excluir plano) e publique de novo.',
    );
  });

  it('sem tipo reconhecido: null (a tela mostra a mensagem da API)', () => {
    expect(textoDosPendentesDuplicados([])).toBeNull();
    expect(textoDosPendentesDuplicados([{ field: 'outro' }, { field: 'treino[x].y' }])).toBeNull();
  });
});

describe('publicarPasta: aviso da cópia', () => {
  it('sem pulados, o texto de sempre; sem nome, "o aluno"', () => {
    expect(mensagemPastaCopiada('Aluna Destino')).toBe('Pasta copiada para Aluna Destino, com os planos em rascunho.');
    expect(mensagemPastaCopiada('  ', [])).toBe('Pasta copiada para o aluno, com os planos em rascunho.');
    expect(mensagemPastaCopiada(null)).toBe('Pasta copiada para o aluno, com os planos em rascunho.');
  });

  it('mobilidade pulada: diz que não foi copiada porque está fora do plano', () => {
    expect(mensagemPastaCopiada('Aluna Destino', [{ tipo: 'mobilidade' }]))
      .toBe('Pasta copiada para Aluna Destino, com os planos em rascunho. A mobilidade não foi copiada porque está fora do plano da consultoria.');
  });

  it('o aviso fixo da Folha diz que a cópia leva a versão publicada de cada plano', () => {
    expect(AVISO_DA_COPIA_DA_PASTA).toMatch(/^Copia a versão publicada de cada plano/);
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
    treino: [plano('t1', 'Treino A'), publicadoSemAlteracao('t0', 'Treino antigo')],
    dieta: [plano('d1', 'Dieta do Plano 17'), publicadoSemAlteracao('d2', 'Dieta antiga')],
    mobilidade: [],
  };

  it('agrupa pelo tipo, com o nome do único plano pendente dele', () => {
    const grupos = agruparProblemasPorPlano([
      { field: 'treino.sessoes[0].exercicios[1].series', message: 'Informe as séries.' },
      { field: 'dieta.refeicoes[0].itens[2].quantidade', message: 'Informe a quantidade.' },
      { field: 'treino.titulo', message: 'Informe o título.' },
      { field: 'dieta', message: 'A dieta precisa de uma refeição.' },
    ], planos);
    expect(grupos).toEqual([
      { chave: 'treino', tipo: 'treino', planoId: 't1', titulo: 'Treino: Treino A', problemas: [{ mensagem: 'Informe as séries.' }, { mensagem: 'Informe o título.' }] },
      { chave: 'dieta', tipo: 'dieta', planoId: 'd1', titulo: 'Dieta: Dieta do Plano 17', problemas: [{ mensagem: 'Informe a quantidade.' }, { mensagem: 'A dieta precisa de uma refeição.' }] },
    ]);
  });

  it('tipo não lido (ou sem pendente conhecido), fica só o tipo', () => {
    expect(agruparProblemasPorPlano([{ field: 'treino.x', message: 'm' }], { ...planos, treino: null })[0]?.titulo).toBe('Treino');
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
