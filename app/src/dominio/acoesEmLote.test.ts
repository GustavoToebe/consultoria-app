import {
  juntarTentativa, linksGerados, linksParaTentarDeNovo, motivoDoItemDaAcao, nomeDoCsvDasSelecionadas, resumoDaAcaoEmLote, textoDaExportacaoDasSelecionadas,
} from './acoesEmLote';

const URL = 'https://checkout.exemplo.com/abc';

describe('resumoDaAcaoEmLote: cancelar', () => {
  it('todos certos = sucesso, na ordem do pedido', () => {
    const r = resumoDaAcaoEmLote('CANCELAR', ['a', 'b'], [{ cobrancaId: 'b', ok: true, codigo: null }, { cobrancaId: 'a', ok: true, codigo: null }]);
    expect(r).toMatchObject({ certos: 2, falhas: 0, tom: 'sucesso', texto: '2 cobranças canceladas.' });
    expect(r.itens.map((i) => i.cobrancaId)).toEqual(['a', 'b']);
    expect(resumoDaAcaoEmLote('CANCELAR', ['a'], [{ cobrancaId: 'a', ok: true, codigo: null }]).texto).toBe('1 cobrança cancelada.');
  });
  it('parcial: atenção, com o motivo de cada falha em português', () => {
    const r = resumoDaAcaoEmLote('CANCELAR', ['a', 'b', 'c'], [
      { cobrancaId: 'a', ok: true, codigo: null },
      { cobrancaId: 'b', ok: false, codigo: 'CONFLITO_EDICAO' },
      { cobrancaId: 'c', ok: false, codigo: 'COBRANCA_NAO_ABERTA' },
    ]);
    expect(r).toMatchObject({ certos: 1, falhas: 2, tom: 'atencao', texto: '1 de 3 cobranças canceladas. 2 não foram canceladas: veja o motivo abaixo.' });
    expect(r.itens[1].motivo).toBe('A cobrança foi alterada por outra pessoa ou aba.');
    expect(r.itens[2].motivo).toBe('A cobrança não está mais em aberto.');
  });
  it('nenhum certo = perigo; item sem resposta é falha, nunca sucesso', () => {
    const r = resumoDaAcaoEmLote('CANCELAR', ['a', 'b'], [{ cobrancaId: 'a', ok: false, codigo: 'ERRO_INESPERADO' }]);
    expect(r).toMatchObject({ certos: 0, falhas: 2, tom: 'perigo', texto: 'Nenhuma das 2 cobranças foi cancelada.' });
    expect(r.itens[0].motivo).toBe('Erro inesperado.');
    expect(r.itens[1].motivo).toBe('O servidor não respondeu por esta cobrança.');
    expect(resumoDaAcaoEmLote('CANCELAR', ['a'], []).texto).toBe('A cobrança não foi cancelada.');
  });
  it('código desconhecido nunca aparece cru', () => {
    expect(motivoDoItemDaAcao('CANCELAR', 'XYZ_RARO')).toBe('Erro inesperado.');
    expect(motivoDoItemDaAcao('LINK', null)).toBe('Erro inesperado.');
  });
});

describe('resumoDaAcaoEmLote: link', () => {
  it('traz a url dos itens certos e junta os links', () => {
    const r = resumoDaAcaoEmLote('LINK', ['a', 'b'], [
      { cobrancaId: 'a', ok: true, codigo: null, url: URL },
      { cobrancaId: 'b', ok: false, codigo: 'COBRANCA_SEM_LINK' },
    ]);
    expect(r).toMatchObject({ certos: 1, falhas: 1, tom: 'atencao', texto: '1 de 2 links gerados. 1 não foi gerado: veja o motivo abaixo.' });
    expect(r.itens[0].url).toBe(URL);
    expect(r.itens[1]).toMatchObject({ url: null, motivo: 'A cobrança de saída não tem link de pagamento.' });
    expect(linksGerados(r)).toEqual([URL]);
  });
  it('ok sem url, ou com url que não é https, é falha (não há o que copiar)', () => {
    const r = resumoDaAcaoEmLote('LINK', ['a', 'b'], [
      { cobrancaId: 'a', ok: true, codigo: null },
      { cobrancaId: 'b', ok: true, codigo: null, url: 'javascript:alert(1)' },
    ]);
    expect(r).toMatchObject({ certos: 0, falhas: 2, tom: 'perigo', texto: 'Nenhum dos 2 links foi gerado.' });
    expect(r.itens.every((i) => i.motivo === 'O servidor não devolveu o link desta cobrança.')).toBe(true);
    expect(linksGerados(r)).toEqual([]);
  });
  it('motivos do link', () => {
    expect(motivoDoItemDaAcao('LINK', 'RECEBIMENTO_ONLINE_NAO_CONFIGURADO')).toBe('O recebimento online não está configurado.');
    expect(motivoDoItemDaAcao('LINK', 'COBRANCA_NAO_ENCONTRADA')).toBe('A cobrança não foi encontrada.');
    expect(motivoDoItemDaAcao('LINK', 'ALUNO_INATIVO')).toBe('O aluno está inativo.');
    expect(motivoDoItemDaAcao('CANCELAR', 'COBRANCA_SEM_LINK')).toBe('Erro inesperado.');
  });
  it('todos certos: sucesso', () => {
    const r = resumoDaAcaoEmLote('LINK', ['a'], [{ cobrancaId: 'a', ok: true, codigo: null, url: URL }]);
    expect(r).toMatchObject({ tom: 'sucesso', texto: '1 link gerado.' });
  });
});

describe('tentar de novo os links que falharam', () => {
  const primeira = resumoDaAcaoEmLote('LINK', ['a', 'b', 'c', 'd', 'e'], [
    { cobrancaId: 'a', ok: true, codigo: null, url: URL },
    { cobrancaId: 'b', ok: false, codigo: 'PROVEDOR_INDISPONIVEL' },
    { cobrancaId: 'c', ok: false, codigo: 'COBRANCA_NAO_ABERTA' },
    { cobrancaId: 'd', ok: false, codigo: 'ERRO_INESPERADO' },
    // 'e' sem resposta
  ]);
  it('só as que podem dar certo: nunca a que saiu do aberto, a de saída ou a de aluno que saiu', () => {
    expect(primeira.itens[4].codigo).toBe('SEM_RESPOSTA');
    expect(linksParaTentarDeNovo(primeira)).toEqual(['b', 'd', 'e']);
    const definitivas = resumoDaAcaoEmLote('LINK', ['x', 'y', 'z', 'w'], [
      { cobrancaId: 'x', ok: false, codigo: 'COBRANCA_SEM_LINK' }, { cobrancaId: 'y', ok: false, codigo: 'ALUNO_INATIVO' },
      { cobrancaId: 'z', ok: false, codigo: 'RECEBIMENTO_ONLINE_NAO_CONFIGURADO' }, { cobrancaId: 'w', ok: false, codigo: 'COBRANCA_NAO_ENCONTRADA' },
    ]);
    expect(linksParaTentarDeNovo(definitivas)).toEqual([]);
  });
  it('a nova tentativa substitui só os itens dela, no mesmo lugar, e o texto conta o lote inteiro', () => {
    const tentativa = resumoDaAcaoEmLote('LINK', ['b', 'd', 'e'], [
      { cobrancaId: 'b', ok: true, codigo: null, url: `${URL}-b` },
      { cobrancaId: 'd', ok: true, codigo: null, url: `${URL}-d` },
      { cobrancaId: 'e', ok: false, codigo: 'PROVEDOR_INDISPONIVEL' },
    ]);
    const junto = juntarTentativa('LINK', primeira, tentativa);
    expect(junto.itens.map((i) => i.cobrancaId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(linksGerados(junto)).toEqual([URL, `${URL}-b`, `${URL}-d`]);
    expect(junto).toMatchObject({ certos: 3, falhas: 2, tom: 'atencao', texto: '3 de 5 links gerados. 2 não foram gerados: veja o motivo abaixo.' });
    expect(linksParaTentarDeNovo(junto)).toEqual(['e']);
  });
});

describe('exportar as selecionadas', () => {
  it('texto e nome do arquivo', () => {
    expect(textoDaExportacaoDasSelecionadas(1)).toBe('1 cobrança exportada.');
    expect(textoDaExportacaoDasSelecionadas(7)).toBe('7 cobranças exportadas.');
    expect(nomeDoCsvDasSelecionadas('2026-11-17')).toBe('financeiro-selecionadas-2026-11-17.csv');
  });
});
