import { comDigitado, destaqueInicial,filtrarOpcoesSuspensas, moverDestaque, posicaoDaLista, VAO_DO_PAINEL } from './escolhaSuspensa';

const OPCOES = [
  { valor: null, rotulo: 'Não importar' },
  { valor: 'nome', rotulo: 'Cadastro > Nome', detalhe: 'Obrigatório' },
  { valor: 'cep', rotulo: 'Endereço > CEP' },
];

describe('filtrarOpcoesSuspensas', () => {
  it('filtra pelo rótulo e pelo detalhe, sem acento nem caixa', () => {
    expect(filtrarOpcoesSuspensas(OPCOES, 'endereco').map((o) => o.valor)).toEqual(['cep']);
    expect(filtrarOpcoesSuspensas(OPCOES, 'OBRIGAT').map((o) => o.valor)).toEqual(['nome']);
    expect(filtrarOpcoesSuspensas(OPCOES, 'importar').map((o) => o.valor)).toEqual([null]);
  });
  it('filtro vazio ou só espaços devolve todas, na mesma ordem', () => {
    expect(filtrarOpcoesSuspensas(OPCOES, '  ')).toEqual(OPCOES);
  });
});

describe('comDigitado', () => {
  const novo = { valor: 'rua', rotulo: 'Usar “rua”' };
  it('sem texto, a lista fica como está', () => {
    expect(comDigitado(OPCOES, OPCOES, null)).toEqual(OPCOES);
  });
  it('valor novo vai no fim (o Enter continua escolhendo o que já existe)', () => {
    expect(comDigitado(OPCOES.slice(1), OPCOES, novo).map((o) => o.valor)).toEqual(['nome', 'cep', 'rua']);
  });
  it('valor que já é uma opção: vale a de lá, no topo, sem repetir, mesmo se o filtro a escondia', () => {
    const doTexto = { valor: 'cep', rotulo: 'Usar “cep”' };
    expect(comDigitado(OPCOES, OPCOES, doTexto)).toEqual([OPCOES[2], OPCOES[0], OPCOES[1]]);
    expect(comDigitado([], OPCOES, doTexto)).toEqual([OPCOES[2]]);
  });
});

describe('destaqueInicial', () => {
  it('começa na escolhida quando ela está visível, senão na primeira', () => {
    expect(destaqueInicial(OPCOES, 'cep')).toBe(2);
    expect(destaqueInicial(OPCOES, null)).toBe(0);
    expect(destaqueInicial(OPCOES.slice(1), null)).toBe(0);
    expect(destaqueInicial([], 'cep')).toBe(-1);
  });
});

describe('moverDestaque', () => {
  it('anda uma opção e para nas pontas', () => {
    expect(moverDestaque(0, 3, 'ArrowDown')).toBe(1);
    expect(moverDestaque(2, 3, 'ArrowDown')).toBe(2);
    expect(moverDestaque(0, 3, 'ArrowUp')).toBe(0);
    expect(moverDestaque(-1, 3, 'ArrowUp')).toBe(2);
    expect(moverDestaque(-1, 3, 'ArrowDown')).toBe(0);
  });
  it('Home e End vão às pontas; outra tecla não mexe; sem opções é -1', () => {
    expect(moverDestaque(1, 3, 'Home')).toBe(0);
    expect(moverDestaque(1, 3, 'End')).toBe(2);
    expect(moverDestaque(1, 3, 'a')).toBe(1);
    expect(moverDestaque(1, 0, 'ArrowDown')).toBe(-1);
  });
  it('destaque fora da lista (o filtro encolheu) volta para dentro', () => {
    expect(moverDestaque(5, 2, 'ArrowDown')).toBe(1);
  });
});

describe('posicaoDaLista', () => {
  const BUSCA = 80;
  test('cabe embaixo: abre embaixo com a altura inteira', () => {
    expect(posicaoDaLista(600, 100, BUSCA, 320, 88)).toEqual({ abreEmbaixo: true, alturaMaxima: 320 });
  });
  test('não cabe embaixo e em cima há mais espaço: abre em cima', () => {
    expect(posicaoDaLista(300, 500, BUSCA, 320, 88)).toEqual({ abreEmbaixo: false, alturaMaxima: 320 });
  });
  test('a lista nunca passa do espaço do lado escolhido (o painel inteiro fica na janela)', () => {
    const { abreEmbaixo, alturaMaxima } = posicaoDaLista(300, 200, BUSCA, 320, 88);
    expect(abreEmbaixo).toBe(true);
    expect(VAO_DO_PAINEL + BUSCA + alturaMaxima).toBeLessThanOrEqual(300);
    const emCima = posicaoDaLista(150, 380, BUSCA, 320, 88);
    expect(emCima.abreEmbaixo).toBe(false);
    expect(VAO_DO_PAINEL + BUSCA + emCima.alturaMaxima).toBeLessThanOrEqual(380);
  });
  test('janela muito baixa: ao menos a altura mínima (a lista rola)', () => {
    expect(posicaoDaLista(60, 40, BUSCA, 320, 88).alturaMaxima).toBe(88);
  });
});
