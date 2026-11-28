import { blocosGravados, blocosIguais, blocosQueChegaram, estadoInicialDosBlocos, reduzirBlocos, resumoDaLinhaDosBlocos, textoDosBlocosNaLinha, textoDosBlocosParaDigitar, blocosSeValidos, blocosValidos, comRepsIguais, lerBlocos, listaDeBlocosIguais, listaDeBlocosIguaisSeValidos, maisUmBloco, menosUmBloco, modoInicialDosBlocos, rascunhoDoModoDiferente, rascunhoInicialDosBlocos, somaDosBlocos, textoDeBlocos } from './blocos';

test.each([['4+2', [4, 2]], ['3×4', [4, 4, 4]], ['3 x 4', [4, 4, 4]], [' 4 + 2 ', [4, 2]], ['5-5', [5, 5]], ['10-15', [10, 15]], ['5–5–5', [5, 5, 5]], ['5×5', [5, 5, 5, 5, 5]]])('lê blocos %s', (texto, esperado) => {
  expect(lerBlocos(texto as string)).toEqual(esperado);
});
test.each(['', '4+', '5-', '-5', '4--2', '2.5+2', '0x4'])('não aceita texto incompleto ou desconhecido: %s', (texto) => expect(lerBlocos(texto)).toBeNull());
test.each([[0, 2], [1], [51, 2], [1.5, 2], Array(11).fill(2)])('recusa blocos fora dos limites: %j', (...blocos) => expect(blocosValidos(blocos)).toBe(false));
test('formata blocos iguais e desiguais e soma as repetições sem alterar a entrada', () => {
  expect(textoDeBlocos([4, 2])).toBe('4+2');
  expect(textoDeBlocos([4, 4, 4])).toBe('3×4');
  expect(textoDeBlocos(null)).toBe('');
  expect(blocosValidos([4, 2])).toBe(true);
  expect(somaDosBlocos([4, 2])).toBe(6);
  expect(somaDosBlocos(null)).toBeNull();
  expect(blocosIguais([4, 4, 4])).toBe(true);
  expect(blocosIguais([4, 2])).toBe(false);
});

test('número inválido não reaproveita os blocos anteriores', () => {
  expect(listaDeBlocosIguais(4, 4)).toEqual([4, 4, 4, 4]);
  expect(listaDeBlocosIguais(null, 4)).toBeNull();
  expect(listaDeBlocosIguais(4, null)).toBeNull();
  expect(listaDeBlocosIguais(0, 4)).toBeNull();
  expect(listaDeBlocosIguais(11, 4)).toBeNull();
  expect(listaDeBlocosIguais(1.5, 4)).toBeNull();
  expect(listaDeBlocosIguais(4, 0)).toBeNull();
  expect(listaDeBlocosIguais(4, 51)).toBeNull();
  expect(blocosGravados([4, null, 4])).toBeNull();
  expect(blocosGravados([4, 0, 4])).toBeNull();
  expect(blocosGravados([4, 2])).toEqual([4, 2]);
});

test('texto inválido num campo não reaproveita o número que ficou por baixo', () => {
  expect(listaDeBlocosIguaisSeValidos(4, 5, true, false)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(3, 4, false, true)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(null, 4, false, false)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(3, 5, false, false)).toEqual([5, 5, 5]);
  expect(blocosSeValidos([4, 2], true)).toBeNull();
  expect(blocosSeValidos([6, 2], false)).toEqual([6, 2]);
});

test('voltar para blocos diferentes mostra a lista gravada, não a distribuição anterior', () => {
  expect(rascunhoDoModoDiferente([4, 4], [4, 2])).toEqual([4, 4]);
  expect(rascunhoDoModoDiferente(null, [4, 2])).toEqual([4, 2]);
});

describe('edição dos blocos (defeito de 27/11: mais e menos um bloco)', () => {
  test('adicionar entra no fim com as repetições do último, até 10; remover tira o último, até 2', () => {
    expect(maisUmBloco([5, 5, 4])).toEqual([5, 5, 4, 4]);
    expect(maisUmBloco([5, null])).toEqual([5, null, null]);
    expect(maisUmBloco(Array(10).fill(3))).toHaveLength(10);
    expect(menosUmBloco([5, 5, 4])).toEqual([5, 5]);
    expect(menosUmBloco([5, 4])).toEqual([5, 4]);
  });

  test('blocos iguais trocam as repetições de todos e mantêm a quantidade', () => {
    expect(comRepsIguais([5, 5, 5], 6)).toEqual([6, 6, 6]);
    expect(comRepsIguais([5, 5], null)).toEqual([null, null]);
  });

  test('abre com a lista gravada ou com dois blocos vazios; o modo sai do formato só na abertura', () => {
    expect(rascunhoInicialDosBlocos(null)).toEqual([null, null]);
    expect(rascunhoInicialDosBlocos([4, 2])).toEqual([4, 2]);
    expect(modoInicialDosBlocos([4, 4, 4])).toBe('iguais');
    expect(modoInicialDosBlocos(null)).toBe('iguais');
    expect(modoInicialDosBlocos([4, 2])).toBe('diferentes');
  });

  test('o eco do que o campo gravou não troca o modo: 5+5+5+5 + 1 bloco continua em "diferentes"', () => {
    const lista = maisUmBloco([5, 5, 5, 5]) as number[];
    expect(blocosQueChegaram(lista, lista, 'diferentes')).toEqual({ mudou: false });
    const menos = menosUmBloco([5, 5, 4]) as number[];
    expect(blocosQueChegaram(menos, menos, 'diferentes')).toEqual({ mudou: false });
  });

  test('lista de fora entra no modo atual; só sai de "iguais" quando não é toda igual', () => {
    expect(blocosQueChegaram([6, 6, 6], [5, 5], 'iguais')).toEqual({ mudou: true, rascunho: [6, 6, 6], modo: 'iguais' });
    expect(blocosQueChegaram([6, 6, 6], [5, 4], 'diferentes')).toEqual({ mudou: true, rascunho: [6, 6, 6], modo: 'diferentes' });
    expect(blocosQueChegaram([4, 2], [5, 5], 'iguais')).toEqual({ mudou: true, rascunho: [4, 2], modo: 'diferentes' });
    expect(blocosQueChegaram(null, [5, 5], 'iguais')).toEqual({ mudou: false });
  });
});

describe('textos dos blocos na série aberta e na linha fechada', () => {
  test('digitar como texto separa por hífen; o 5×5 do PDF não muda', () => {
    expect(textoDosBlocosParaDigitar([5, 5, 5, 5, 5])).toBe('5-5-5-5-5');
    expect(textoDosBlocosParaDigitar([4, 2])).toBe('4-2');
    expect(textoDosBlocosParaDigitar(null)).toBe('');
    expect(lerBlocos(textoDosBlocosParaDigitar([4, 4, 2]))).toEqual([4, 4, 2]);
    expect(textoDeBlocos([5, 5, 5, 5, 5])).toBe('5×5');
  });

  test('resumo da linha só com blocos válidos', () => {
    expect(resumoDaLinhaDosBlocos([5, 5, 5, 5, 5])).toBe('5 blocos · 25 reps por série');
    expect(resumoDaLinhaDosBlocos([4, null])).toBeNull();
    expect(resumoDaLinhaDosBlocos([6])).toBeNull();
    expect(resumoDaLinhaDosBlocos(null)).toBeNull();
  });

  test('linha fechada: iguais em multiplicação, diferentes somados, com o total', () => {
    expect(textoDosBlocosNaLinha([5, 5, 5, 5, 5])).toBe('5 × 5 (25)');
    expect(textoDosBlocosNaLinha([4, 4, 2])).toBe('4+4+2 (10)');
    expect(textoDosBlocosNaLinha(null)).toBe('');
  });
});

describe('reduzirBlocos (estado do campo dos blocos)', () => {
  test('estado inicial a partir da lista gravada', () => {
    expect(estadoInicialDosBlocos([4, 2])).toMatchObject({ rascunho: [4, 2], modo: 'diferentes', publicado: [4, 2], texto: '4-2', focar: null, confirmar: false, notacaoAberta: false });
    expect(estadoInicialDosBlocos(null)).toMatchObject({ rascunho: [null, null], modo: 'iguais', publicado: null, texto: '' });
  });

  test('mais em "diferentes" mantém o modo, publica e foca o bloco novo; a ação seguinte zera o foco', () => {
    const r = reduzirBlocos(estadoInicialDosBlocos([5, 5, 5, 4]), { tipo: 'mais' });
    expect(r.gravar).toEqual([5, 5, 5, 4, 4]);
    expect(r.estado).toMatchObject({ modo: 'diferentes', rascunho: [5, 5, 5, 4, 4], publicado: [5, 5, 5, 4, 4], texto: '5-5-5-4-4', focar: 4 });
    expect(reduzirBlocos(r.estado, { tipo: 'modo', modo: 'diferentes' }).estado.focar).toBeNull();
    expect(reduzirBlocos(r.estado, { tipo: 'modo', modo: 'iguais' }).estado.focar).toBeNull();
    expect(reduzirBlocos(r.estado, { tipo: 'alternarNotacao' }).estado.focar).toBeNull();
    expect(reduzirBlocos(r.estado, { tipo: 'menos' }).estado).toMatchObject({ modo: 'diferentes', focar: null, rascunho: [5, 5, 5, 4] });
    expect(reduzirBlocos(r.estado, { tipo: 'editar', indice: 4, valor: 3 }).estado).toMatchObject({ modo: 'diferentes', focar: null, rascunho: [5, 5, 5, 4, 3] });
    expect(reduzirBlocos(r.estado, { tipo: 'mais' }).estado).toMatchObject({ modo: 'diferentes', focar: 5 });
  });

  test('5+5+5+5 em "diferentes" + 1 bloco e o eco do pai: continua em "diferentes", sem mudar nada', () => {
    const inicio = { ...estadoInicialDosBlocos([5, 4, 5, 5]), rascunho: [5, 5, 5, 5], publicado: [5, 5, 5, 5] };
    const e = reduzirBlocos(inicio, { tipo: 'mais' });
    expect(e.gravar).toEqual([5, 5, 5, 5, 5]);
    const eco = reduzirBlocos(e.estado, { tipo: 'chegou', valor: [5, 5, 5, 5, 5] });
    expect(eco.estado).toBe(e.estado);
    expect(eco.gravar).toBeUndefined();
    expect(eco.estado).toMatchObject({ modo: 'diferentes', focar: 4 });
  });

  test('mais em "iguais" não foca nada; menos mantém o modo; limites 2 e 10', () => {
    const iguais = reduzirBlocos(estadoInicialDosBlocos([5, 5]), { tipo: 'mais' });
    expect(iguais.estado).toMatchObject({ modo: 'iguais', rascunho: [5, 5, 5], focar: null });
    const menos = reduzirBlocos(estadoInicialDosBlocos([5, 5, 4]), { tipo: 'menos' });
    expect(menos.gravar).toEqual([5, 5]);
    expect(menos.estado.modo).toBe('diferentes');
    const noMinimo = estadoInicialDosBlocos([5, 4]);
    expect(reduzirBlocos(noMinimo, { tipo: 'menos' })).toEqual({ estado: noMinimo });
    const noMaximo = estadoInicialDosBlocos(Array(10).fill(3));
    expect(reduzirBlocos(noMaximo, { tipo: 'mais' })).toEqual({ estado: noMaximo });
  });

  test('bloco com texto inválido publica null e bloqueia o mais; editar o bloco libera', () => {
    const invalido = reduzirBlocos(estadoInicialDosBlocos([5, 4]), { tipo: 'invalidar', indice: 1, ok: false });
    expect(invalido.gravar).toBeNull();
    expect(invalido.estado.publicado).toBeNull();
    expect(reduzirBlocos(invalido.estado, { tipo: 'mais' })).toEqual({ estado: invalido.estado });
    const corrigido = reduzirBlocos(invalido.estado, { tipo: 'editar', indice: 1, valor: 3 });
    expect(corrigido.gravar).toEqual([5, 3]);
    expect(corrigido.estado.invalidos.size).toBe(0);
    expect(reduzirBlocos(corrigido.estado, { tipo: 'mais' }).gravar).toEqual([5, 3, 3]);
    expect(reduzirBlocos(estadoInicialDosBlocos([5, 4]), { tipo: 'invalidar', indice: 0, ok: true }).gravar).toBeUndefined();
  });

  test('trocar de modo com bloco inválido limpa a marca e grava o rascunho de novo (o + volta)', () => {
    // "Blocos iguais" com "1.5" digitado: o rascunho segue 5-5-5 por baixo, mas o publicado virou null.
    const invalido = reduzirBlocos(estadoInicialDosBlocos([5, 5, 5]), { tipo: 'invalidar', indice: 0, ok: false }).estado;
    const trocado = reduzirBlocos(invalido, { tipo: 'modo', modo: 'diferentes' });
    expect(trocado.gravar).toEqual([5, 5, 5]);
    expect(trocado.estado).toMatchObject({ modo: 'diferentes', publicado: [5, 5, 5] });
    expect(trocado.estado.invalidos.size).toBe(0);
    expect(reduzirBlocos(trocado.estado, { tipo: 'mais' }).gravar).toEqual([5, 5, 5, 5]);
    // Sem inválido, trocar de modo não grava nada (nenhum `aoMudar` sem mudança).
    expect(reduzirBlocos(estadoInicialDosBlocos([5, 5, 5]), { tipo: 'modo', modo: 'diferentes' }).gravar).toBeUndefined();
  });

  test('remover o bloco inválido do fim tira a marca dele', () => {
    const invalido = reduzirBlocos(estadoInicialDosBlocos([5, 4, 3]), { tipo: 'invalidar', indice: 2, ok: false }).estado;
    expect(reduzirBlocos(invalido, { tipo: 'menos' }).gravar).toEqual([5, 4]);
  });

  test('editar em "iguais" vale para todos; bloco fora da faixa não grava', () => {
    expect(reduzirBlocos(estadoInicialDosBlocos([5, 5, 5]), { tipo: 'editar', indice: 0, valor: 6 }).gravar).toEqual([6, 6, 6]);
    const fora = reduzirBlocos(estadoInicialDosBlocos([5, 4]), { tipo: 'editar', indice: 0, valor: 51 });
    expect(fora.gravar).toBeNull();
    expect(fora.estado.rascunho).toEqual([51, 4]);
    expect(fora.estado.texto).toBe('5-4');
  });

  test('"iguais" com blocos desiguais pede confirmação; converter ou manter', () => {
    const pedido = reduzirBlocos(estadoInicialDosBlocos([4, 4, 2]), { tipo: 'modo', modo: 'iguais' });
    expect(pedido.gravar).toBeUndefined();
    expect(pedido.estado).toMatchObject({ modo: 'diferentes', confirmar: true });
    const convertido = reduzirBlocos(pedido.estado, { tipo: 'converterParaIguais' });
    expect(convertido.gravar).toEqual([4, 4, 4]);
    expect(convertido.estado).toMatchObject({ modo: 'iguais', confirmar: false });
    expect(reduzirBlocos(pedido.estado, { tipo: 'manterDiferentes' }).estado).toMatchObject({ modo: 'diferentes', confirmar: false });
    const paraDiferentes = reduzirBlocos(estadoInicialDosBlocos([5, 5, 5]), { tipo: 'modo', modo: 'diferentes' });
    expect(paraDiferentes.estado).toMatchObject({ modo: 'diferentes', confirmar: false, rascunho: [5, 5, 5] });
    expect(reduzirBlocos(paraDiferentes.estado, { tipo: 'modo', modo: 'iguais' }).estado).toMatchObject({ modo: 'iguais', confirmar: false });
  });

  test('texto digitado atualiza o rascunho e publica; desigual passa para "diferentes"', () => {
    const r = reduzirBlocos(estadoInicialDosBlocos([5, 5]), { tipo: 'texto', texto: '5-5-4' });
    expect(r.gravar).toEqual([5, 5, 4]);
    expect(r.estado).toMatchObject({ rascunho: [5, 5, 4], modo: 'diferentes', texto: '5-5-4', publicado: [5, 5, 4] });
    const iguais = reduzirBlocos(estadoInicialDosBlocos([5, 5]), { tipo: 'texto', texto: '3×6' });
    expect(iguais.estado).toMatchObject({ rascunho: [6, 6, 6], modo: 'iguais' });
    const incompleto = reduzirBlocos(r.estado, { tipo: 'texto', texto: '5-' });
    expect(incompleto.gravar).toBeNull();
    expect(incompleto.estado).toMatchObject({ rascunho: [5, 5, 4], texto: '5-', publicado: null });
  });

  test('lista de fora troca os campos; o eco e a lista inválida não mudam nada', () => {
    const e = estadoInicialDosBlocos([5, 5]);
    expect(reduzirBlocos(e, { tipo: 'chegou', valor: [5, 5] }).estado).toBe(e);
    expect(reduzirBlocos(e, { tipo: 'chegou', valor: null }).estado).toBe(e);
    const fora = reduzirBlocos({ ...e, confirmar: true }, { tipo: 'chegou', valor: [4, 2] });
    expect(fora.gravar).toBeUndefined();
    expect(fora.estado).toMatchObject({ rascunho: [4, 2], modo: 'diferentes', publicado: [4, 2], texto: '4-2', confirmar: false });
    expect(reduzirBlocos({ ...e, texto: '4 - 2' }, { tipo: 'chegou', valor: [4, 2] }).estado.texto).toBe('4 - 2');
  });

  test('abrir e fechar a notação não publica', () => {
    const aberta = reduzirBlocos(estadoInicialDosBlocos([5, 5]), { tipo: 'alternarNotacao' });
    expect(aberta.estado.notacaoAberta).toBe(true);
    expect(aberta.gravar).toBeUndefined();
    expect(reduzirBlocos(aberta.estado, { tipo: 'alternarNotacao' }).estado.notacaoAberta).toBe(false);
  });
});
