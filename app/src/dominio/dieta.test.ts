import type { Alimento, ConteudoDieta, ItemDieta, Refeicao } from '../api/tipos';
import { aguaValida, anuncioDaOpcaoMovida, aplicarReceitaDeDieta, avisoDaNovaOpcaoA, letraDaPosicao, moverOpcao, reletrarOpcoes, restaurarOrdemDasOpcoes, comNomesPadrao, erroDaFibra, fibraValida, itensSemValorNoTotal, kcalPorRefeicao, MODO_DE_PREPARO_MAXIMO, modoDePreparoParaMostrar, modoDePreparoValido, novaRefeicao, textoEscolhaDasOpcoes, normalizarDieta, novoItem, recalcularItem, semConversao, somar, textoDaAgua, textoDoMacro, textoItensSemValor, totalDoDia, trocarAlimento, trocarAlimentoNasRefeicoes } from './dieta';
import { dataDaTela, dataParaTela, mascaraData, numeroDaTela, numeroParaTela } from './formatos';

jest.mock('./uid', () => ({ novoUid: () => 'uid' }));

const pao: Alimento = {
  id: 'p',
  nome: 'Pão de forma (fictício)',
  baseQuantidade: 100,
  baseUnidade: 'g',
  kcal: 266,
  proteina: 8.4,
  carboidrato: 49.6,
  gordura: 3.2,
  gramasPorUnidade: 25,
  fonte: null,
  origem: 'MANUAL',
  fatorCorrecao: null,
  fatorCoccao: null,
  grupo: null,
};

describe('dieta', () => {
  it('valor do item é proporcional à quantidade na base', () => {
    const item = recalcularItem({ ...novoItem(pao), quantidade: 50 }, pao);
    expect(item).toMatchObject({ kcal: 133, proteina: 4.2, carboidrato: 24.8, gordura: 1.6 });
  });

  it('converte unidade para gramas quando o alimento informa gramas por unidade', () => {
    const item = recalcularItem({ ...novoItem(pao), quantidade: 2, unidade: 'un' }, pao);
    expect(item.kcal).toBe(133);
  });

  it('nutriente ausente não vira zero no item', () => {
    const semMacro = { ...pao, proteina: null, carboidrato: null, gordura: null };
    const item = recalcularItem({ ...novoItem(semMacro), quantidade: 50 }, semMacro);
    expect(item).toMatchObject({ kcal: 133, proteina: null, carboidrato: null, gordura: null });
  });

  it('sem como converter, o valor fica vazio (não inventa)', () => {
    const semGramas = { ...pao, gramasPorUnidade: null };
    const item = recalcularItem({ ...novoItem(semGramas), quantidade: 2, unidade: 'ml' }, semGramas);
    expect(item.kcal).toBeNull();
  });

  it('semConversao (C49): só item da biblioteca cuja unidade não converte para a base do alimento', () => {
    const semGramas = { ...pao, gramasPorUnidade: null };
    const item = (a: Alimento, unidade: ItemDieta['unidade']): ItemDieta => ({ ...novoItem(a), quantidade: 2, unidade });
    expect(semConversao(item(semGramas, 'un'), semGramas)).toBe(true);
    expect(semConversao(item(semGramas, 'ml'), semGramas)).toBe(true);
    expect(semConversao(item(semGramas, 'g'), semGramas)).toBe(false); // mesma unidade da base
    expect(semConversao(item(pao, 'un'), pao)).toBe(false); // gramas por unidade informadas
    expect(semConversao({ ...item(semGramas, 'un'), manual: true }, semGramas)).toBe(false);
    expect(semConversao(item(semGramas, 'un'), undefined)).toBe(false); // alimento fora da biblioteca: nada a dizer
  });

  it('item manual não é recalculado', () => {
    const manual: ItemDieta = { ...novoItem(), nome: 'Outro', quantidade: 10, kcal: 99, manual: true };
    expect(recalcularItem(manual, pao).kcal).toBe(99);
  });

  it('total do dia soma só a primeira opção de cada refeição', () => {
    const item = (kcal: number): ItemDieta => ({ ...novoItem(), kcal, proteina: 1, carboidrato: 1, gordura: 1 });
    const conteudo = {
      refeicoes: [
        { opcoes: [{ itens: [item(100)] }, { itens: [item(999)] }] },
        { opcoes: [{ itens: [item(50), item(0.4)] }] },
      ],
    } as unknown as ConteudoDieta;
    expect(totalDoDia(conteudo).kcal).toBeCloseTo(150.4);
  });

  it('item sem valor deixa aquele total vazio', () => {
    expect(somar([{ ...novoItem(), kcal: null }]).kcal).toBeNull();
  });
});

describe('fibra (V089)', () => {
  const comFibra = { ...pao, fibra: 5.55 };
  const item = (fibra: number | null | undefined): ItemDieta => ({ ...novoItem(), kcal: 10, proteina: 1, carboidrato: 1, gordura: 1, fibra });

  it('o item leva a fibra do alimento proporcional à quantidade, com o mesmo arredondamento dos macros', () => {
    expect(recalcularItem({ ...novoItem(comFibra), quantidade: 50 }, comFibra).fibra).toBe(2.775);
    expect(recalcularItem({ ...novoItem(comFibra), quantidade: 2, unidade: 'un' }, comFibra).fibra).toBe(2.775); // 2 un × 25 g
    expect(recalcularItem({ ...novoItem(comFibra), quantidade: 33.3333 }, comFibra).fibra).toBe(1.85); // 3 casas
  });

  it('copiar o alimento para o item leva a fibra (novoItem e trocarAlimento)', () => {
    expect(novoItem(comFibra).fibra).toBe(5.55); // 100 g = a base
    expect(trocarAlimento(novoItem(pao), comFibra).fibra).toBe(5.55);
  });

  it('alimento sem fibra (nula ou ausente) deixa o item sem fibra, nunca zero', () => {
    expect(novoItem(pao).fibra).toBeNull();
    expect(novoItem({ ...pao, fibra: null }).fibra).toBeNull();
    expect(novoItem().fibra).toBeNull();
    expect(recalcularItem({ ...novoItem(comFibra), quantidade: 2, unidade: 'ml' }, comFibra).fibra).toBeNull(); // sem conversão
  });

  it('não entra na kcal nem nos macros', () => {
    const t = somar([item(7)]);
    expect(t).toMatchObject({ kcal: 10, proteina: 1, carboidrato: 1, gordura: 1, fibra: 7 });
    expect(somar([item(null)])).toMatchObject({ kcal: 10, proteina: 1 });
  });

  it('total nulo quando nenhum item tem fibra (nunca 0)', () => {
    expect(somar([item(null), item(undefined)])).toMatchObject({ fibra: null, fibraCompleta: false });
    expect(somar([])).toMatchObject({ fibra: null, fibraCompleta: false });
  });

  it('soma só os itens com fibra e marca o total parcial', () => {
    expect(somar([item(2), item(null), item(3.5)])).toMatchObject({ fibra: 5.5, fibraCompleta: false });
    expect(somar([item(0), item(null)])).toMatchObject({ fibra: 0, fibraCompleta: false }); // 0 digitado é valor
  });

  it('total completo quando todos têm fibra', () => {
    expect(somar([item(2), item(3.5)])).toMatchObject({ fibra: 5.5, fibraCompleta: true });
  });

  it('total do dia soma a primeira opção de cada refeição, com o mesmo critério de parcial', () => {
    const refeicoes = [
      { opcoes: [{ itens: [item(2)] }, { itens: [item(999)] }] },
      { opcoes: [{ itens: [item(null), item(1)] }] },
    ] as unknown as ConteudoDieta;
    expect(totalDoDia(refeicoes)).toMatchObject({ fibra: 3, fibraCompleta: false });
  });

  it('item sem fibra não vira "item sem valor" do total (fibra é opcional)', () => {
    expect(itensSemValorNoTotal([{ uid: 'r', opcoes: [{ itens: [item(null)] }] }] as unknown as Refeicao[])).toEqual([]);
  });

  it('normalizarDieta lê fibra ausente como nula e mantém a que veio', () => {
    const { refeicoes } = normalizarDieta({ refeicoes: [{ opcoes: [{ itens: [{ nome: 'a' }, { nome: 'b', fibra: 1.5 }] }] }] });
    expect(refeicoes[0].opcoes[0].itens.map((i) => i.fibra)).toEqual([null, 1.5]);
  });

  it('faixa do formulário: 0 a 99.999, até 2 casas; vazio é permitido', () => {
    for (const v of [null, undefined, 0, 0.01, 12.5, 99999]) expect(fibraValida(v)).toBe(true);
    for (const v of [-0.01, 99999.01, 100000, 1.234, Number.NaN]) expect(fibraValida(v)).toBe(false);
    expect(erroDaFibra(null)).toBeNull();
    expect(erroDaFibra(1.234)).toBe('Use de 0 a 99.999, com até 2 casas.');
  });
});

describe('normalizarDieta: ergogenicos', () => {
  it('nulo continua nulo (sem acesso) e lista vira itens completos', () => {
    expect(normalizarDieta({}).ergogenicos).toBeNull();
    expect(normalizarDieta({ ergogenicos: null }).ergogenicos).toBeNull();
    expect(normalizarDieta({ ergogenicos: [] }).ergogenicos).toEqual([]);
    const [item] = normalizarDieta({ ergogenicos: [{ uid: 'u1', nome: 'Item de teste A' }] }).ergogenicos ?? [];
    expect(item).toEqual({
      uid: 'u1', nome: 'Item de teste A', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '',
    });
  });
});

describe('formatos', () => {
  it('datas DD/MM/AAAA ↔ ISO, recusando data impossível', () => {
    expect(dataParaTela('2026-10-11')).toBe('11/10/2026');
    expect(dataDaTela('11/10/2026')).toBe('2026-10-11');
    expect(dataDaTela('')).toBeNull();
    expect(dataDaTela('31/02/2026')).toBeUndefined();
    expect(dataDaTela('1/10/2026')).toBeUndefined();
    expect(mascaraData('11102026')).toBe('11/10/2026');
  });

  it('números com vírgula, sem parse de faixa', () => {
    expect(numeroDaTela('25,5')).toBe(25.5);
    expect(numeroDaTela('')).toBeNull();
    expect(numeroDaTela('3 a 6', true)).toBeUndefined();
    expect(numeroDaTela('2,5', true)).toBeUndefined();
    expect(numeroParaTela(28.8, 1)).toBe('28,8');
    expect(numeroParaTela(null)).toBe('—');
  });
});

describe('água por dia (reunião de 17/10)', () => {
  it('vazia é válida e não aparece; preenchida mostra o número do treinador', () => {
    expect(aguaValida(null)).toBe(true);
    expect(textoDaAgua(null)).toBeNull();
    expect(textoDaAgua(3.5)).toBe('3,5 L por dia');
    expect(textoDaAgua(3)).toBe('3 L por dia');
  });

  it('mesma faixa do servidor: 0,1 a 20 L, uma casa decimal', () => {
    expect([0.1, 2.5, 20].map(aguaValida)).toEqual([true, true, true]);
    expect([0.05, 21, 2.25, -1].map(aguaValida)).toEqual([false, false, false, false]);
  });
});

describe('total do dia incompleto', () => {
  it('aponta só os itens da opção A sem valor', () => {
    const manual = { ...novoItem(), uid: 'm', nome: 'Item manual' };
    const comValor = { ...recalcularItem({ ...novoItem(pao), uid: 'c', quantidade: 50, unidade: 'g' as const }, pao) };
    const c: ConteudoDieta = normalizarDieta({ refeicoes: [
      { uid: 'r1', nome: 'Café', opcoes: [{ uid: 'a', rotulo: 'A', itens: [comValor, manual] }, { uid: 'b', rotulo: 'B', itens: [{ ...manual, uid: 'x' }] }] },
    ] });
    expect(itensSemValorNoTotal(c)).toEqual([{ refeicaoUid: 'r1', itemUid: 'm', nome: 'Item manual' }]);
    expect(textoItensSemValor(1)).toBe('1 item da opção A sem kcal, proteína, carboidrato ou gordura');
    expect(textoItensSemValor(2)).toMatch(/^2 itens/);
  });
  it('valor ausente não leva unidade', () => {
    expect(textoDoMacro('Proteína', null, 'g')).toBe('Proteína —');
    expect(textoDoMacro('Proteína', 180.25, 'g')).toBe('Proteína 180,3 g');
  });
});

describe('kcal por refeição (Total do dia, 25/11)', () => {
  const comKcal = (uid: string, kcal: number | null): ItemDieta => ({ ...novoItem(), uid, nome: uid, kcal, proteina: 0, carboidrato: 0, gordura: 0 });
  const refeicao = (uid: string, a: ItemDieta[], b: ItemDieta[] = []): Refeicao => ({
    uid, nome: uid, horario: null, observacao: null, modoDePreparo: null,
    opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: a }, ...(b.length ? [{ uid: `${uid}-b`, rotulo: 'B', itens: b }] : [])],
  });

  it('só a opção A, na ordem do dia, com a fração do total', () => {
    const linhas = kcalPorRefeicao([refeicao('cafe', [comKcal('p', 100)], [comKcal('x', 900)]), refeicao('almoco', [comKcal('a', 200), comKcal('f', 100)])]);
    expect(linhas).toEqual([{ uid: 'cafe', kcal: 100, fracao: 0.25 }, { uid: 'almoco', kcal: 300, fracao: 0.75 }]);
  });

  it('item sem kcal: a refeição fica "—" e o dia sem total, então nenhuma barra', () => {
    expect(kcalPorRefeicao([refeicao('cafe', [comKcal('p', 100)]), refeicao('almoco', [comKcal('m', null)])]))
      .toEqual([{ uid: 'cafe', kcal: 100, fracao: null }, { uid: 'almoco', kcal: null, fracao: null }]);
  });

  it('total 0 e refeição sem opção: sem fração', () => {
    expect(kcalPorRefeicao([refeicao('cafe', [comKcal('p', 0)]), { ...refeicao('vazia', []), opcoes: [] }]))
      .toEqual([{ uid: 'cafe', kcal: 0, fracao: null }, { uid: 'vazia', kcal: 0, fracao: null }]);
  });
});

describe('modo de preparo da refeição (28/10)', () => {
  it('é opcional, vai até 2000 caracteres e o que só tem espaços não aparece', () => {
    expect(MODO_DE_PREPARO_MAXIMO).toBe(2000);
    expect(modoDePreparoValido(null)).toBe(true);
    expect(modoDePreparoValido('x'.repeat(2000))).toBe(true);
    expect(modoDePreparoValido('x'.repeat(2001))).toBe(false);
    expect(modoDePreparoParaMostrar('  \n ')).toBeNull();
    expect(modoDePreparoParaMostrar(undefined)).toBeNull();
    expect(modoDePreparoParaMostrar('Cozinhe.\nSirva.')).toBe('Cozinhe.\nSirva.');
  });

  it('a normalização guarda o texto com as quebras e preenche nulo quando falta', () => {
    const c = normalizarDieta({ refeicoes: [{ nome: 'Almoço', modoDePreparo: 'Linha 1\nLinha 2', opcoes: [] }, { nome: 'Jantar', opcoes: [] }] });
    expect(c.refeicoes[0].modoDePreparo).toBe('Linha 1\nLinha 2');
    expect(c.refeicoes[1].modoDePreparo).toBeNull();
    expect(novaRefeicao('Ceia').modoDePreparo).toBeNull();
  });

  it('a refeição pronta (receita) leva o modo de preparo para o plano', () => {
    const atual = normalizarDieta({ refeicoes: [] });
    const receita = { refeicoes: [{ uid: 'r', nome: 'Almoço', modoDePreparo: 'Asse por 20 min.', opcoes: [{ uid: 'o', rotulo: 'A', itens: [] }] }] };
    expect(aplicarReceitaDeDieta(atual, receita).refeicoes[0].modoDePreparo).toBe('Asse por 20 min.');
  });
});

describe('opções da refeição: só apresentação (28/10)', () => {
  it('o aluno lê que deve escolher uma, sem a palavra "equivalente"', () => {
    expect(textoEscolhaDasOpcoes(['A'])).toBeNull();
    expect(textoEscolhaDasOpcoes(['A', 'B'])).toBe('Escolha uma das opções: A ou B.');
    expect(textoEscolhaDasOpcoes(['A', 'B', 'C'])).toBe('Escolha uma das opções: A, B ou C.');
    expect(textoEscolhaDasOpcoes(['A', ' '])).toBe('Escolha uma das opções: A ou 2.');
    expect(textoEscolhaDasOpcoes(['A', 'B', 'C']) ?? '').not.toMatch(/equivalent/i);
  });
});

describe('reordenar as opções: a letra segue a posição (26/11)', () => {
  const opcao = (uid: string, rotulo: string, nItens = 0) => ({ uid, rotulo, itens: Array.from({ length: nItens }, (_, i) => ({ ...novoItem(), uid: `${uid}-${i}` })) });
  const tres = [opcao('x', 'A', 1), opcao('y', 'B', 2), opcao('z', 'C')];
  const ordem = (os: { uid: string; rotulo: string }[]) => os.map((o) => `${o.rotulo}:${o.uid}`).join(' ');

  it('letras pela posição; depois de F, o número; quem já está certo fica a mesma instância', () => {
    expect([0, 1, 5, 6].map(letraDaPosicao)).toEqual(['A', 'B', 'F', '7']);
    const r = reletrarOpcoes([opcao('x', 'A'), opcao('y', 'C')]);
    expect(ordem(r)).toBe('A:x B:y');
    expect(reletrarOpcoes(tres)[0]).toBe(tres[0]);
  });

  it('mover para o primeiro lugar: a B vira A e conta no total; os itens vão junto', () => {
    const m = moverOpcao(tres, 1, 0)!;
    expect(ordem(m.opcoes)).toBe('A:y B:x C:z');
    expect(m.opcoes[0].itens).toBe(tres[1].itens);
    expect(m).toMatchObject({ uid: 'y', letraAntes: 'B', letraDepois: 'A', para: 0, novaPrimeira: 'B' });
    expect(avisoDaNovaOpcaoA(m.novaPrimeira!)).toBe('Opção B agora é a Opção A e conta no total do dia.');
  });

  it('a A sair do primeiro lugar também troca a que conta no total (aviso pela letra da nova primeira)', () => {
    const m = moverOpcao(tres, 0, 2)!;
    expect(ordem(m.opcoes)).toBe('A:y B:z C:x');
    expect(m.novaPrimeira).toBe('B');
    expect(anuncioDaOpcaoMovida(m)).toBe('Opção A movida para a posição 3: agora é a Opção C.');
  });

  it('mover sem mexer na primeira não avisa; o anúncio diz a posição e a letra novas', () => {
    const m = moverOpcao(tres, 2, 1)!;
    expect(ordem(m.opcoes)).toBe('A:x B:z C:y');
    expect(m.novaPrimeira).toBeNull();
    expect(anuncioDaOpcaoMovida(m)).toBe('Opção C movida para a posição 2: agora é a Opção B.');
  });

  it('nada muda (mesmo lugar, fora dos limites, uma opção só): nulo', () => {
    expect(moverOpcao(tres, 1, 1)).toBeNull();
    expect(moverOpcao(tres, 0, 3)).toBeNull();
    expect(moverOpcao(tres, -1, 0)).toBeNull();
    expect(moverOpcao([opcao('x', 'A')], 0, 0)).toBeNull();
  });

  it('letras fora da posição (opção excluída antes) passam a seguir a ordem ao mover', () => {
    const m = moverOpcao([opcao('x', 'A'), opcao('z', 'C'), opcao('w', 'D')], 2, 1)!;
    expect(ordem(m.opcoes)).toBe('A:x B:w C:z');
    expect(m.letraAntes).toBe('D');
  });

  it('Desfazer: volta a ordem e as letras de antes pelo uid, com os itens de agora; nova vai ao fim, excluída não volta', () => {
    const antes = tres.map(({ uid, rotulo }) => ({ uid, rotulo }));
    const movidas = moverOpcao(tres, 1, 0)!.opcoes;
    const editadas = movidas.map((o) => (o.uid === 'x' ? { ...o, itens: [] } : o));
    const voltou = restaurarOrdemDasOpcoes(editadas, antes);
    expect(ordem(voltou)).toBe('A:x B:y C:z');
    expect(voltou[0].itens).toEqual([]);
    const comNovaSemZ = [...editadas.filter((o) => o.uid !== 'z'), opcao('n', 'D')];
    expect(ordem(restaurarOrdemDasOpcoes(comNovaSemZ, antes))).toBe('A:x B:y D:n');
  });
});

describe('comNomesPadrao (C57)', () => {
  it('nome vazio ou só com espaços vira "Refeição N" (posição + 1); o que tem nome fica', () => {
    const c = normalizarDieta({ refeicoes: [{ nome: '', opcoes: [] }, { nome: 'Almoço', opcoes: [] }, { nome: '   ', opcoes: [] }] });
    expect(comNomesPadrao(c).refeicoes.map((r) => r.nome)).toEqual(['Refeição 1', 'Almoço', 'Refeição 3']);
  });

  it('sem nada a preencher devolve o mesmo conteúdo, sem tocar nas outras refeições', () => {
    const c = normalizarDieta({ refeicoes: [{ nome: 'Almoço', opcoes: [] }] });
    expect(comNomesPadrao(c)).toBe(c);
    const d = normalizarDieta({ refeicoes: [{ nome: 'Café', opcoes: [] }, { nome: '', opcoes: [] }] });
    expect(comNomesPadrao(d).refeicoes[0]).toBe(d.refeicoes[0]);
    expect(comNomesPadrao(normalizarDieta({ refeicoes: [] })).refeicoes).toEqual([]);
  });
});

describe('variações por dia da semana: normalizarDieta e receita', () => {
  const refeicao = (uid: string, nome = 'Almoço') => ({ uid, nome, opcoes: [{ uid: `o${uid}`, rotulo: 'A', itens: [{ uid: `i${uid}`, nome: 'Arroz (fictício)', kcal: 10 }] }] });

  it('preserva as variações com dias, rótulo e refeições; sem o campo vira lista vazia', () => {
    const c = normalizarDieta({ variacoes: [{ uid: 'v1', rotulo: 'Carbo alto', dias: [3, 1, 5], refeicoes: [refeicao('r1')] }] });
    expect(c.variacoes).toHaveLength(1);
    expect(c.variacoes[0]).toMatchObject({ uid: 'v1', rotulo: 'Carbo alto', dias: [1, 3, 5] });
    expect(c.variacoes[0].refeicoes[0].opcoes[0].itens[0]).toMatchObject({ nome: 'Arroz (fictício)', kcal: 10, quantidade: null });
    expect(normalizarDieta({}).variacoes).toEqual([]);
    expect(normalizarDieta(null).variacoes).toEqual([]);
  });

  it('aguenta variações malformadas sem quebrar (tela offline)', () => {
    expect(normalizarDieta({ variacoes: null }).variacoes).toEqual([]);
    expect(normalizarDieta({ variacoes: 'x' }).variacoes).toEqual([]);
    const c = normalizarDieta({ variacoes: [null, 3, { rotulo: null, dias: [0, 8, 2.5, '3', 4, 4, 7], refeicoes: null }, { dias: 'seg', refeicoes: [null, refeicao('r')] }] });
    expect(c.variacoes).toHaveLength(2);
    expect(c.variacoes[0]).toMatchObject({ uid: 'uid', rotulo: '', dias: [4, 7], refeicoes: [] });
    expect(c.variacoes[1].dias).toEqual([]);
    expect(c.variacoes[1].refeicoes).toHaveLength(1);
  });

  it('refeições da raiz nulas ou não-lista não quebram', () => {
    expect(normalizarDieta({ refeicoes: null }).refeicoes).toEqual([]);
    expect(normalizarDieta({ refeicoes: [null, refeicao('r')] }).refeicoes).toHaveLength(1);
  });

  it('aplicar a receita troca raiz e variações juntas, com uids novos', () => {
    const atual = normalizarDieta({ refeicoes: [], variacoes: [{ uid: 'antiga', rotulo: 'Antiga', dias: [1], refeicoes: [refeicao('x')] }] });
    const daReceita = aplicarReceitaDeDieta(atual, { refeicoes: [refeicao('r')] });
    expect(daReceita.variacoes).toEqual([]);
    expect(daReceita.refeicoes).toHaveLength(1);
    const comVariacoes = aplicarReceitaDeDieta(normalizarDieta({ refeicoes: [refeicao('r')] }), { variacoes: [{ uid: 'v', rotulo: 'Zero carbo', dias: [2, 4], refeicoes: [refeicao('z')] }] });
    expect(comVariacoes.refeicoes).toEqual([]);
    expect(comVariacoes.variacoes[0]).toMatchObject({ uid: 'uid', rotulo: 'Zero carbo', dias: [2, 4] });
  });

  it('total e itens sem valor aceitam a lista de refeições de uma variação', () => {
    const c = normalizarDieta({ variacoes: [{ uid: 'v', rotulo: 'A', dias: [1], refeicoes: [refeicao('r')] }] });
    expect(totalDoDia(c.variacoes[0].refeicoes)).toMatchObject({ kcal: 10, proteina: null }); // só o macro que falta fica "—"
    expect(itensSemValorNoTotal(c.variacoes[0].refeicoes)).toEqual([{ refeicaoUid: 'r', itemUid: 'ir', nome: 'Arroz (fictício)' }]);
  });

  it('comNomesPadrao também preenche o nome das refeições das variações', () => {
    const c = normalizarDieta({ variacoes: [{ uid: 'v', rotulo: 'A', dias: [1], refeicoes: [refeicao('r', ''), refeicao('s', 'Jantar')] }] });
    expect(comNomesPadrao(c).variacoes[0].refeicoes.map((r) => r.nome)).toEqual(['Refeição 1', 'Jantar']);
    const ok = normalizarDieta({ variacoes: [{ uid: 'v', rotulo: 'A', dias: [1], refeicoes: [refeicao('r')] }] });
    expect(comNomesPadrao(ok)).toBe(ok);
  });
});

describe('trocar alimento (C56)', () => {
  const arroz: Alimento = { ...pao, id: 'arroz', nome: 'Arroz fictício', kcal: 128, proteina: 2.5, carboidrato: 28, gordura: 0.2, gramasPorUnidade: null };
  const item = (uid: string, quantidade: number | null = 50, unidade: ItemDieta['unidade'] = 'g'): ItemDieta =>
    ({ ...novoItem(pao), uid, quantidade, unidade, fatorCorrecao: 1.1, fatorCoccao: 2 });

  it('mantém uid, quantidade e unidade e recalcula pelo novo alimento', () => {
    const trocado = trocarAlimento(item('i2'), arroz);
    expect(trocado).toMatchObject({ uid: 'i2', alimentoId: 'arroz', nome: 'Arroz fictício', quantidade: 50, unidade: 'g', manual: false, kcal: 64, proteina: 1.25, carboidrato: 14, gordura: 0.1 });
    expect(trocado).toMatchObject({ fatorCorrecao: null, fatorCoccao: null });
  });

  it('unidade que não converte para o novo alimento deixa o valor vazio ("—"), sem inventar gramas', () => {
    const trocado = trocarAlimento(item('i2', 2, 'un'), arroz);
    expect(trocado).toMatchObject({ quantidade: 2, unidade: 'un', kcal: null, proteina: null, carboidrato: null, gordura: null });
  });

  it('nas refeições, troca só o item do uid, no mesmo lugar', () => {
    const r = novaRefeicao('Almoço');
    const refeicoes = [{ ...r, opcoes: [{ ...r.opcoes[0], itens: [item('i1'), item('i2'), item('i3')] }] }];
    const depois = trocarAlimentoNasRefeicoes(refeicoes, 'i2', arroz);
    expect(depois[0].opcoes[0].itens.map((i) => [i.uid, i.nome])).toEqual([['i1', pao.nome], ['i2', 'Arroz fictício'], ['i3', pao.nome]]);
    expect(depois[0].opcoes[0].itens[0]).toBe(refeicoes[0].opcoes[0].itens[0]);
  });
});
