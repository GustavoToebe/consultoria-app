import type { ItemDaVitrine, ItemDaVitrineDoAluno, TipoDoItem } from '../api/vitrineTipos';
import type { PlataformaDoApp } from './financeiro';
import {
  comoMostrarItem, comTipoDoItem, contagemDeItens, corpoDoItem, emPromocao, erroDaListaDeConsultoriasDoItem, erroDaPaginaPublicaDoItem, interruptorDaPaginaPublica, itensDoCartaoDoInicio,
  moverItem, MOTIVO_SO_DIGITAL, MOTIVO_SO_DIGITAL_NA_LISTA, podeAdicionarItem, problemasDoItem, rascunhoDoItem, rascunhoVazio, textoDoPreco, TETO_DE_ITENS, type RascunhoDoItem,
} from './vitrine';

const HOJE = '2026-11-16';

describe('comoMostrarItem (regra das lojas de aplicativo, D6)', () => {
  const casos: [TipoDoItem, PlataformaDoApp, boolean][] = [
    ['DIGITAL', 'web', true],
    ['DIGITAL', 'ios', false],
    ['DIGITAL', 'android', false],
    ['FISICO', 'web', true],
    ['FISICO', 'ios', true],
    ['FISICO', 'android', true],
  ];
  it.each(casos)('%s no %s: preço, cupom e link = %s; foto, nome e descrição sempre', (tipo, plataforma, tudo) => {
    expect(comoMostrarItem(tipo, plataforma)).toEqual({ foto: true, nome: true, descricao: true, preco: tudo, cupom: tudo, link: tudo });
  });
});

describe('textos de preço e validade', () => {
  const base = { precoCentavos: 14900, precoEspecialCentavos: 9900, precoVigenteCentavos: 9900, especialAte: '2026-11-27' };

  it('especial valendo: preço atual, o normal para riscar e o prazo', () => {
    expect(emPromocao(base)).toBe(true);
    expect(textoDoPreco(base, HOJE)).toEqual({ atual: 'R$ 99,00', antes: 'R$ 149,00', validade: 'Preço especial até 27/11/2026' });
  });

  it('especial sem prazo: só "Preço especial"', () => {
    expect(textoDoPreco({ ...base, especialAte: null }, HOJE).validade).toBe('Preço especial');
  });

  it('especial vencido (o servidor já devolve o normal como vigente): sem risco e com o aviso de encerrado', () => {
    const vencido = { ...base, precoVigenteCentavos: 14900, especialAte: '2026-11-10' };
    expect(emPromocao(vencido)).toBe(false);
    expect(textoDoPreco(vencido, HOJE)).toEqual({ atual: 'R$ 149,00', antes: null, validade: 'Preço especial encerrado em 10/11/2026' });
  });

  it('o último dia do prazo ainda não é encerrado', () => {
    const noDia = { ...base, precoVigenteCentavos: 14900, especialAte: HOJE };
    expect(textoDoPreco(noDia, HOJE).validade).toBeNull();
  });

  it('sem preço: "—", nunca R$ 0,00', () => {
    expect(textoDoPreco({ precoCentavos: null, precoEspecialCentavos: null, precoVigenteCentavos: null, especialAte: null }, HOJE)).toEqual({ atual: '—', antes: null, validade: null });
  });

  it('só preço normal: sem promoção nem validade', () => {
    expect(textoDoPreco({ precoCentavos: 5000, precoVigenteCentavos: 5000, especialAte: null }, HOJE)).toEqual({ atual: 'R$ 50,00', antes: null, validade: null });
  });

  it('só preço especial (sem normal): vale como promoção, sem preço para riscar', () => {
    const so = { precoCentavos: null, precoEspecialCentavos: 7000, precoVigenteCentavos: 7000, especialAte: null };
    expect(textoDoPreco(so, HOJE)).toEqual({ atual: 'R$ 70,00', antes: null, validade: 'Preço especial' });
  });
});

describe('cartão do Início do aluno', () => {
  const item = (id: string, vigente: number | null, normal: number | null = vigente): ItemDaVitrineDoAluno => ({
    id, nome: id, descricao: null, tipo: 'DIGITAL', precoCentavos: normal, precoVigenteCentavos: vigente, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null,
  });
  it('até 2 itens, o de preço especial vigente primeiro e o resto na ordem recebida', () => {
    const lista = [item('a', 100), item('b', 100), item('c', 80, 100), item('d', 50, 90)];
    expect(itensDoCartaoDoInicio(lista).map((i) => i.id)).toEqual(['c', 'd']);
    expect(itensDoCartaoDoInicio(lista.slice(0, 3)).map((i) => i.id)).toEqual(['c', 'a']);
    expect(itensDoCartaoDoInicio([item('a', 100)]).map((i) => i.id)).toEqual(['a']);
    expect(itensDoCartaoDoInicio([])).toEqual([]);
  });
});

describe('teto e ordem', () => {
  it('mostra "N de 30" e recusa o 31º com o motivo', () => {
    expect(contagemDeItens(7)).toBe('7 de 30');
    expect(podeAdicionarItem(TETO_DE_ITENS - 1)).toEqual({ pode: true, motivo: null });
    const cheio = podeAdicionarItem(TETO_DE_ITENS);
    expect(cheio.pode).toBe(false);
    expect(cheio.motivo).toContain('30');
  });

  it('Subir e Descer trocam com o vizinho; nas pontas nada muda; id desconhecido é ignorado', () => {
    const ids = ['a', 'b', 'c'];
    expect(moverItem(ids, 'b', 'subir')).toEqual(['b', 'a', 'c']);
    expect(moverItem(ids, 'b', 'descer')).toEqual(['a', 'c', 'b']);
    expect(moverItem(ids, 'a', 'subir')).toEqual(ids);
    expect(moverItem(ids, 'c', 'descer')).toEqual(ids);
    expect(moverItem(ids, 'x', 'subir')).toEqual(ids);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('editor: validação espelhada da API', () => {
  const valido = (): RascunhoDoItem => ({ ...rascunhoVazio(), nome: 'Memento Mori', preco: 'R$ 149,00' });

  it('item mínimo (nome) e item completo passam', () => {
    expect(problemasDoItem({ ...rascunhoVazio(), nome: 'Boné' }, HOJE)).toEqual({});
    expect(
      problemasDoItem({ ...valido(), precoEspecial: 'R$ 99,00', especialAte: '2026-11-27', cupom: 'BLACK', linkUrl: 'https://exemplo.com/p', descricao: 'Planilha de 12 semanas' }, HOJE),
    ).toEqual({});
  });

  it('nome obrigatório e com teto, sem repetir o valor', () => {
    expect(problemasDoItem({ ...valido(), nome: '   ' }, HOJE).nome).toBeTruthy();
    const longo = 'x'.repeat(101);
    const erro = problemasDoItem({ ...valido(), nome: longo }, HOJE).nome;
    expect(erro).toContain('100');
    expect(erro).not.toContain(longo);
  });

  it('descrição até 300 depois do strip', () => {
    expect(problemasDoItem({ ...valido(), descricao: ` ${'d'.repeat(300)} ` }, HOJE).descricao).toBeUndefined();
    expect(problemasDoItem({ ...valido(), descricao: 'd'.repeat(301) }, HOJE).descricao).toContain('300');
  });

  it('preço: vazio é sem preço; zero, ilegível e acima do teto dão erro no campo certo', () => {
    expect(problemasDoItem({ ...valido(), preco: '' }, HOJE).precoCentavos).toBeUndefined();
    for (const ruim of ['0', 'abc', '-5', 'R$ 10.000.000,01']) {
      expect(problemasDoItem({ ...valido(), preco: ruim }, HOJE).precoCentavos).toBeTruthy();
      expect(problemasDoItem({ ...valido(), precoEspecial: ruim }, HOJE).precoEspecialCentavos).toBeTruthy();
    }
    expect(problemasDoItem({ ...valido(), preco: 'R$ 10.000.000,00' }, HOJE).precoCentavos).toBeUndefined();
  });

  it('prazo exige preço especial e uma data na faixa de planejamento', () => {
    expect(problemasDoItem({ ...valido(), especialAte: '2026-11-27' }, HOJE).especialAte).toContain('preço especial');
    const comEspecial = { ...valido(), precoEspecial: '99' };
    expect(problemasDoItem({ ...comEspecial, especialAte: '2026-11-27' }, HOJE).especialAte).toBeUndefined();
    expect(problemasDoItem({ ...comEspecial, especialAte: '1999-12-31' }, HOJE).especialAte).toBeTruthy();
    expect(problemasDoItem({ ...comEspecial, especialAte: '2032-01-01' }, HOJE).especialAte).toBeTruthy();
    // especial sem prazo é permitido
    expect(problemasDoItem(comEspecial, HOJE).especialAte).toBeUndefined();
  });

  it('preço especial exige o preço normal e precisa ser menor que ele (regras da API)', () => {
    expect(problemasDoItem({ ...valido(), preco: '', precoEspecial: '99' }, HOJE).precoEspecialCentavos).toContain('preço normal');
    expect(problemasDoItem({ ...valido(), precoEspecial: '149,00' }, HOJE).precoEspecialCentavos).toContain('menor');
    expect(problemasDoItem({ ...valido(), precoEspecial: '200' }, HOJE).precoEspecialCentavos).toContain('menor');
    expect(problemasDoItem({ ...valido(), precoEspecial: '148,99' }, HOJE).precoEspecialCentavos).toBeUndefined();
    // preço normal inválido: o erro fica só no preço normal
    expect(problemasDoItem({ ...valido(), preco: 'x', precoEspecial: '99' }, HOJE).precoEspecialCentavos).toBeUndefined();
  });

  it('cupom até 40 depois do strip (a regra do suplemento)', () => {
    expect(problemasDoItem({ ...valido(), cupom: ` ${'c'.repeat(40)} ` }, HOJE).cupom).toBeUndefined();
    expect(problemasDoItem({ ...valido(), cupom: 'c'.repeat(41) }, HOJE).cupom).toContain('40');
  });

  it('link só https; vazio é aceito', () => {
    expect(problemasDoItem({ ...valido(), linkUrl: '' }, HOJE).linkUrl).toBeUndefined();
    for (const ruim of ['http://exemplo.com', 'exemplo.com', 'javascript:alert(1)', 'https://u:s@exemplo.com']) {
      expect(problemasDoItem({ ...valido(), linkUrl: ruim }, HOJE).linkUrl).toBeTruthy();
    }
  });

  it('reúne vários erros de uma vez', () => {
    expect(Object.keys(problemasDoItem({ ...rascunhoVazio(), preco: 'x', linkUrl: 'http://a.com' }, HOJE)).sort()).toEqual(['linkUrl', 'nome', 'precoCentavos']);
  });
});

describe('corpo do POST/PUT', () => {
  it('centavos inteiros, textos aparados, em branco = nulo e versão só na edição', () => {
    const r: RascunhoDoItem = {
      nome: '  Fullbody ', descricao: '  ', tipo: 'DIGITAL', preco: '149,9', precoEspecial: 'R$ 99,00', especialAte: '2026-11-27', cupom: ' BLACK ', linkUrl: ' https://exemplo.com ', ativo: false, naPaginaPublica: true, noMarketplace: true,
    };
    expect(corpoDoItem(r)).toEqual({
      nome: 'Fullbody', descricao: null, tipo: 'DIGITAL', precoCentavos: 14990, precoEspecialCentavos: 9900, especialAte: '2026-11-27', cupom: 'BLACK', linkUrl: 'https://exemplo.com', ativo: false, naPaginaPublica: true, noMarketplace: true,
    });
    expect(corpoDoItem(r, 3).versao).toBe(3);
    expect(corpoDoItem(rascunhoVazio())).toMatchObject({ precoCentavos: null, precoEspecialCentavos: null, especialAte: null, cupom: null, linkUrl: null, ativo: true, tipo: 'DIGITAL', naPaginaPublica: false, noMarketplace: false });
  });

  it('o rascunho de um item salvo volta ao mesmo corpo', () => {
    const item: ItemDaVitrine = {
      id: 'i', nome: 'Camiseta', descricao: 'Algodão', tipo: 'FISICO', precoCentavos: 12000, precoEspecialCentavos: 9000, precoVigenteCentavos: 9000, especialAte: '2026-11-30', cupom: 'BF', linkUrl: 'https://loja.exemplo/c', ativo: true, naPaginaPublica: false, noMarketplace: false, ordem: 2, versao: 4, temFoto: true, fotoAtualizadaEm: "2026-11-16T03:00:00Z",
    };
    expect(problemasDoItem(rascunhoDoItem(item), HOJE)).toEqual({});
    expect(corpoDoItem(rascunhoDoItem(item), item.versao)).toEqual({
      nome: 'Camiseta', descricao: 'Algodão', tipo: 'FISICO', precoCentavos: 12000, precoEspecialCentavos: 9000, especialAte: '2026-11-30', cupom: 'BF', linkUrl: 'https://loja.exemplo/c', ativo: true, naPaginaPublica: false, noMarketplace: false, versao: 4,
    });
  });
});

describe('lista de consultorias: marcar o item', () => {
  it('o corpo manda noMarketplace sempre (falso por padrão) e o valor que o item já tinha', () => {
    expect(corpoDoItem(rascunhoVazio()).noMarketplace).toBe(false);
    expect(corpoDoItem({ ...rascunhoVazio(), nome: 'A', noMarketplace: true }).noMarketplace).toBe(true);
  });

  it('item físico nunca vai marcado, e o editor recusa a marca no campo noMarketplace', () => {
    const fisico = { ...rascunhoVazio(), nome: 'A', tipo: 'FISICO' as const, noMarketplace: true };
    expect(corpoDoItem(fisico).noMarketplace).toBe(false);
    expect(problemasDoItem(fisico, HOJE)).toEqual({ noMarketplace: MOTIVO_SO_DIGITAL_NA_LISTA });
    expect(problemasDoItem({ ...rascunhoVazio(), nome: 'A', noMarketplace: true }, HOJE)).toEqual({});
  });

  it('trocar o tipo para não digital desmarca; para digital mantém; o texto não diz "marketplace"', () => {
    const marcado = { ...rascunhoVazio(), noMarketplace: true };
    expect(comTipoDoItem(marcado, 'FISICO')).toMatchObject({ tipo: 'FISICO', noMarketplace: false });
    expect(comTipoDoItem(marcado, 'DIGITAL').noMarketplace).toBe(true);
    expect(MOTIVO_SO_DIGITAL_NA_LISTA).not.toMatch(/marketplace/i);
  });

  it('o 422 da API no campo vira a mensagem; outro campo, nada', () => {
    expect(erroDaListaDeConsultoriasDoItem({ noMarketplace: 'x' })).toBe(MOTIVO_SO_DIGITAL_NA_LISTA);
    expect(erroDaListaDeConsultoriasDoItem({ naPaginaPublica: 'x' })).toBeNull();
  });
});

describe('página pública da loja: marcar o item', () => {
  it('o corpo manda naPaginaPublica sempre (falso por padrão) e o valor que o item já tinha', () => {
    expect(corpoDoItem(rascunhoVazio()).naPaginaPublica).toBe(false);
    expect(corpoDoItem({ ...rascunhoVazio(), nome: 'A', naPaginaPublica: true }).naPaginaPublica).toBe(true);
  });

  it('só item digital pode aparecer: o corpo de item físico vai falso mesmo com o rascunho marcado', () => {
    expect(corpoDoItem({ ...rascunhoVazio(), nome: 'A', tipo: 'FISICO', naPaginaPublica: true }).naPaginaPublica).toBe(false);
  });

  it('trocar o tipo para não digital desmarca; para digital mantém', () => {
    const marcado = { ...rascunhoVazio(), naPaginaPublica: true };
    expect(comTipoDoItem(marcado, 'FISICO')).toMatchObject({ tipo: 'FISICO', naPaginaPublica: false });
    expect(comTipoDoItem(marcado, 'DIGITAL')).toMatchObject({ tipo: 'DIGITAL', naPaginaPublica: true });
    expect(comTipoDoItem({ ...marcado, tipo: 'FISICO', naPaginaPublica: false }, 'DIGITAL').naPaginaPublica).toBe(false);
  });

  it('o interruptor: habilitado só para digital, com o motivo; visível só com a chave da loja', () => {
    expect(interruptorDaPaginaPublica('DIGITAL', true)).toEqual({ visivel: true, habilitado: true, motivo: null });
    expect(interruptorDaPaginaPublica('FISICO', true)).toEqual({ visivel: true, habilitado: false, motivo: MOTIVO_SO_DIGITAL });
    expect(interruptorDaPaginaPublica('DIGITAL', false).visivel).toBe(false);
  });

  it('o editor recusa marca em item físico, no campo naPaginaPublica; digital passa', () => {
    expect(problemasDoItem({ ...rascunhoVazio(), nome: 'A', tipo: 'FISICO', naPaginaPublica: true }, HOJE)).toEqual({ naPaginaPublica: MOTIVO_SO_DIGITAL });
    expect(problemasDoItem({ ...rascunhoVazio(), nome: 'A', naPaginaPublica: true }, HOJE)).toEqual({});
  });

  it('o 422 da API no campo vira a mensagem do interruptor; outro campo, nada', () => {
    expect(erroDaPaginaPublicaDoItem({ naPaginaPublica: 'Só item digital pode aparecer na página pública.' })).toBe(MOTIVO_SO_DIGITAL);
    expect(erroDaPaginaPublicaDoItem({ nome: 'x' })).toBeNull();
  });
});
