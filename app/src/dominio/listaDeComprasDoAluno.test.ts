import type { LinhaDaLista } from './listaDeCompras';
import {
  ajustarQuantidade,
  alternarComprado,
  comMarcacoes,
  contagemDeComprados,
  errosDoAjuste,
  errosDoAvulso,
  estadoDaVersao,
  gravarAvulso,
  itensDoAluno,
  LIMITE_AVULSOS,
  limparComprados,
  listaNova,
  MARCACOES_VAZIAS,
  marcacoesDoPeriodo,
  normalizarListaSalva,
  quantidadeParaAjustar,
  removerAvulso,
  restaurarAvulso,
  restaurarComprados,
  semErros,
  textoDaContagem,
  textoDaOrigem,
  textoDaQuantidadeLivre,
  voltarAoCalculado,
} from './listaDeComprasDoAluno';

/** Linhas fictícias, como a conta da lista devolve. */
const linha = (chave: string, nome: string, quantidade: number, extra: Partial<LinhaDaLista> = {}): LinhaDaLista => ({
  chave, nome, unidade: 'g', quantidade, cru: false, bruto: false, semFator: true, naDieta: quantidade,
  quantidadeCru: null, fatorCorrecao: null, fatorCoccao: null, ...extra,
});
const ARROZ = linha('a:arroz:g', 'Arroz branco cozido', 420, { cru: true, semFator: false });
const FRANGO = linha('a:frango:g', 'Frango grelhado', 700);
const OVO = linha('a:ovo:un', 'Ovo', 14, { unidade: 'un' });

describe('marcações por versão e período', () => {
  it('versão diferente da guardada começa do zero; a mesma volta como estava', () => {
    const guardada = comMarcacoes(listaNova('v1'), 'semana', alternarComprado(MARCACOES_VAZIAS, ARROZ.chave));
    expect(estadoDaVersao(guardada, 'v1')).toBe(guardada);
    expect(estadoDaVersao(guardada, 'v2')).toEqual(listaNova('v2'));
    expect(estadoDaVersao(null, 'v1')).toEqual(listaNova('v1'));
  });

  it('cada período tem as próprias marcações', () => {
    const e = comMarcacoes(listaNova('v1'), 'semana', alternarComprado(MARCACOES_VAZIAS, ARROZ.chave));
    expect(marcacoesDoPeriodo(e, 'semana').comprados).toEqual([ARROZ.chave]);
    expect(marcacoesDoPeriodo(e, 'duasSemanas')).toBe(MARCACOES_VAZIAS);
    expect(marcacoesDoPeriodo(e, 'mes').comprados).toEqual([]);
  });

  it('marcar duas vezes desmarca; limpar tira só as marcas e deixa ajustes e avulsos', () => {
    let m = alternarComprado(MARCACOES_VAZIAS, ARROZ.chave);
    m = alternarComprado(m, FRANGO.chave);
    m = alternarComprado(m, ARROZ.chave);
    expect(m.comprados).toEqual([FRANGO.chave]);
    m = ajustarQuantidade(m, OVO.chave, { quantidade: '1', unidade: 'cartela' });
    m = gravarAvulso(m, { id: 'x1', nome: 'Café', quantidade: null, unidade: null });
    const limpa = limparComprados(m);
    expect(limpa.comprados).toEqual([]);
    expect(limpa.ajustes).toEqual(m.ajustes);
    expect(limpa.avulsos).toEqual(m.avulsos);
  });
});

describe('itens do aluno', () => {
  it('calculados com a quantidade da conta; ajuste troca o texto e guarda o calculado para comparar', () => {
    let m = ajustarQuantidade(MARCACOES_VAZIAS, ARROZ.chave, { quantidade: '  1 ', unidade: 'pacote de 1 kg' });
    m = alternarComprado(m, FRANGO.chave);
    const itens = itensDoAluno([ARROZ, FRANGO, OVO], m);
    expect(itens.map((i) => [i.nome, i.origem, i.quantidade, i.calculado, i.comprado])).toEqual([
      ['Arroz branco cozido', 'ajustado', '1 pacote de 1 kg', '420 g cru', false],
      ['Frango grelhado', 'calculado', '700 g (como na dieta)', null, true],
      ['Ovo', 'calculado', '14 un (como na dieta)', null, false],
    ]);
    const volta = itensDoAluno([ARROZ], voltarAoCalculado(m, ARROZ.chave));
    expect(volta[0]).toMatchObject({ origem: 'calculado', quantidade: '420 g cru', calculado: null });
  });

  it('avulsos vão depois dos calculados, na ordem em que entraram; editar troca no lugar; remover leva a marca junto', () => {
    let m = gravarAvulso(MARCACOES_VAZIAS, { id: 'x1', nome: ' Café ', quantidade: '2', unidade: 'pacotes' });
    m = gravarAvulso(m, { id: 'x2', nome: 'Sabão', quantidade: null, unidade: null });
    m = alternarComprado(m, 'avulso:x1');
    expect(itensDoAluno([OVO], m).map((i) => [i.nome, i.origem, i.quantidade, i.comprado])).toEqual([
      ['Ovo', 'calculado', '14 un (como na dieta)', false],
      ['Café', 'avulso', '2 pacotes', true],
      ['Sabão', 'avulso', '—', false],
    ]);
    m = gravarAvulso(m, { id: 'x1', nome: 'Café moído', quantidade: '1', unidade: null });
    expect(m.avulsos.map((a) => a.nome)).toEqual(['Café moído', 'Sabão']);
    m = removerAvulso(m, 'x1');
    expect(m.avulsos.map((a) => a.id)).toEqual(['x2']);
    expect(m.comprados).toEqual([]);
  });

  it('desfazer devolve o avulso no lugar e as marcas limpas, sem perder o que veio depois', () => {
    let m = gravarAvulso(MARCACOES_VAZIAS, { id: 'x1', nome: 'Café', quantidade: null, unidade: null });
    m = gravarAvulso(m, { id: 'x2', nome: 'Sabão', quantidade: null, unidade: null });
    m = alternarComprado(m, 'avulso:x1');
    const removido = removerAvulso(m, 'x1');
    const volta = restaurarAvulso(removido, m.avulsos[0], 0, true);
    expect(volta.avulsos.map((a) => a.id)).toEqual(['x1', 'x2']);
    expect(volta.comprados).toEqual(['avulso:x1']);
    expect(restaurarAvulso(volta, m.avulsos[0], 0, true)).toBe(volta);
    const limpa = alternarComprado(limparComprados(volta), ARROZ.chave);
    expect(restaurarComprados(limpa, volta.comprados).comprados).toEqual([ARROZ.chave, 'avulso:x1']);
  });

  it('a contagem só soma itens da lista atual (marca de item que saiu fica guardada, mas não conta)', () => {
    let m = alternarComprado(MARCACOES_VAZIAS, ARROZ.chave);
    m = alternarComprado(m, 'a:batata:g');
    const c = contagemDeComprados(itensDoAluno([ARROZ, FRANGO, OVO], m));
    expect(c).toEqual({ comprados: 1, total: 3 });
    expect(textoDaContagem(c)).toBe('1 de 3 comprados');
    expect(textoDaContagem({ comprados: 0, total: 1 })).toBe('0 de 1 comprado');
    expect(m.comprados).toContain('a:batata:g');
  });

  it('marca de origem e quantidade livre', () => {
    expect(textoDaOrigem('ajustado')).toBe('Ajustado por você');
    expect(textoDaOrigem('avulso')).toBe('Adicionado por você');
    expect(textoDaOrigem('calculado')).toBeNull();
    expect(textoDaQuantidadeLivre({ quantidade: null, unidade: 'kg' })).toBe('kg');
    expect(textoDaQuantidadeLivre({ quantidade: ' ', unidade: null })).toBe('—');
  });

  it('o formulário de ajuste começa no calculado separado em número e unidade, ou no ajuste guardado', () => {
    expect(quantidadeParaAjustar(linha('k', 'Arroz', 1800), undefined)).toEqual({ quantidade: '1,80', unidade: 'kg' });
    expect(quantidadeParaAjustar(OVO, undefined)).toEqual({ quantidade: '14', unidade: 'un' });
    expect(quantidadeParaAjustar(OVO, { quantidade: '1', unidade: null })).toEqual({ quantidade: '1', unidade: '' });
  });
});

describe('validação', () => {
  it('ajuste exige quantidade; tamanhos máximos', () => {
    expect(errosDoAjuste({ quantidade: '', unidade: 'kg' }).quantidade).toBe('Informe a quantidade.');
    expect(semErros(errosDoAjuste({ quantidade: '2', unidade: null }))).toBe(true);
    expect(errosDoAjuste({ quantidade: '1'.repeat(21), unidade: 'u'.repeat(21) })).toEqual({ quantidade: 'Até 20 caracteres.', unidade: 'Até 20 caracteres.' });
  });

  it('avulso exige só o nome, até 80, e respeita o teto da lista', () => {
    expect(errosDoAvulso({ nome: '  ', quantidade: null, unidade: null }).nome).toBe('Informe o nome do item.');
    expect(errosDoAvulso({ nome: 'x'.repeat(81), quantidade: null, unidade: null }).nome).toBe('Até 80 caracteres.');
    expect(semErros(errosDoAvulso({ nome: 'x'.repeat(80), quantidade: null, unidade: null }))).toBe(true);
    expect(errosDoAvulso({ nome: 'Café', quantidade: null, unidade: null }, LIMITE_AVULSOS).nome).toContain('100 itens');
  });
});

describe('normalizarListaSalva', () => {
  it('aceita o documento gravado e devolve igual', () => {
    const e = comMarcacoes({ ...listaNova('v1'), periodo: 'mes', escolhas: { almoco: 'b' } }, 'mes',
      gravarAvulso(ajustarQuantidade(alternarComprado(MARCACOES_VAZIAS, 'k'), 'k', { quantidade: '1', unidade: null }), { id: 'x', nome: 'Café', quantidade: null, unidade: null }));
    expect(normalizarListaSalva(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('descarta o que não confere, sem derrubar a tela', () => {
    expect(normalizarListaSalva(null)).toBeNull();
    expect(normalizarListaSalva({ periodo: 'mes' })).toBeNull();
    expect(normalizarListaSalva('lixo')).toBeNull();
    const lido = normalizarListaSalva({
      versaoId: 'v1', periodo: 'ano', escolhas: { r: 1, s: 'b' },
      periodos: {
        semana: { comprados: ['a', 3, 'a'], ajustes: { a: { quantidade: '' }, b: { quantidade: '2', unidade: 5 }, c: 'x' }, avulsos: [{ id: 'x', nome: '' }, { id: 'y', nome: 'Café' }, { id: 'y', nome: 'Repetido' }, 'z'] },
        quinzena: { comprados: ['q'] },
        mes: 'x',
      },
    });
    expect(lido).toEqual({
      versaoId: 'v1', periodo: 'semana', escolhas: { s: 'b' },
      periodos: { semana: { comprados: ['a'], ajustes: { b: { quantidade: '2', unidade: null } }, avulsos: [{ id: 'y', nome: 'Café', quantidade: null, unidade: null }] } },
    });
  });
});
