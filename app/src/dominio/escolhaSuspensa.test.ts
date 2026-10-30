import { destaqueInicial, filtrarOpcoesSuspensas, moverDestaque } from './escolhaSuspensa';

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
