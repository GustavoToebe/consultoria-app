import { agruparGruposParecidos } from './gruposMusculares';
import {
  contagemDoGrupo, corpoDaUniao, erroDoNomeDoGrupo, mensagemDeGruposUnidos, motivoDoUnir, nomesMarcados, sugestaoDoNome, textoDaPrevia,
} from './unirGruposMusculares';

const linhas = agruparGruposParecidos([
  { nome: 'Panturrilhas', contagem: 5 }, { nome: 'Panturrilha', contagem: 1 }, { nome: 'Peito', contagem: 84 }, { nome: 'Ombro', contagem: 4 },
]);
const chave = (rotulo: string) => linhas.find((l) => l.rotulo === rotulo)!.chave;

describe('nomesMarcados e motivoDoUnir', () => {
  test('a linha agrupada marcada sozinha já traz as duas variações e libera o Unir', () => {
    const nomes = nomesMarcados(linhas, new Set([chave('Panturrilha')]));
    expect(nomes).toEqual(['Panturrilha', 'Panturrilhas']);
    expect(motivoDoUnir(nomes)).toBeNull();
  });
  test('um grupo só não une; dois quaisquer unem, em ordem alfabética', () => {
    expect(motivoDoUnir(nomesMarcados(linhas, new Set([chave('Peito')])))).toBe('Marque dois ou mais grupos para unir.');
    expect(motivoDoUnir([])).toBe('Marque dois ou mais grupos para unir.');
    expect(nomesMarcados(linhas, new Set([chave('Peito'), chave('Ombro')]))).toEqual(['Ombro', 'Peito']);
  });
  test('acima de 50 nomes pede para dividir', () => {
    expect(motivoDoUnir(Array.from({ length: 51 }, (_, i) => `G${i}`))).toBe('Marque até 50 grupos de cada vez.');
    expect(motivoDoUnir(Array.from({ length: 50 }, (_, i) => `G${i}`))).toBeNull();
  });
});

describe('sugestaoDoNome', () => {
  test('o mais curto; empate, o primeiro em ordem alfabética', () => {
    expect(sugestaoDoNome(['Panturrilhas', 'Panturrilha'])).toBe('Panturrilha');
    expect(sugestaoDoNome(['Peito', 'Ombro'])).toBe('Ombro');
    expect(sugestaoDoNome([])).toBe('');
  });
});

describe('erroDoNomeDoGrupo', () => {
  test('vazio, só espaços e acima de 60 depois do trim', () => {
    expect(erroDoNomeDoGrupo('')).toBe('Informe o nome do grupo.');
    expect(erroDoNomeDoGrupo('   ')).toBe('Informe o nome do grupo.');
    expect(erroDoNomeDoGrupo('a'.repeat(61))).toBe('Use até 60 caracteres.');
    expect(erroDoNomeDoGrupo(`  ${'a'.repeat(60)}  `)).toBeNull();
    expect(erroDoNomeDoGrupo('Glúteos e posterior')).toBeNull();
  });
});

describe('corpoDaUniao', () => {
  test('nomes limpos e sem repetir, mantendo o igual ao destino; destino sem espaços nas pontas', () => {
    expect(corpoDaUniao(['Ombro', ' Ombros ', 'Ombro', ''], '  Ombro ')).toEqual({ origem: ['Ombro', 'Ombros'], destino: 'Ombro' });
  });
});

describe('textos', () => {
  test('contagem da linha e prévia no singular, plural e zero, com milhar', () => {
    expect(contagemDoGrupo(1)).toBe('1 exercício');
    expect(contagemDoGrupo(1250)).toBe('1.250 exercícios');
    expect(textoDaPrevia(0)).toBe('Nenhum exercício muda');
    expect(textoDaPrevia(1)).toBe('1 exercício muda');
    expect(textoDaPrevia(129)).toBe('129 exercícios mudam');
  });
  test('aviso de sucesso', () => {
    expect(mensagemDeGruposUnidos(6)).toBe('Grupos unidos: 6 exercícios renomeados.');
    expect(mensagemDeGruposUnidos(1)).toBe('Grupos unidos: 1 exercício renomeado.');
    expect(mensagemDeGruposUnidos(0)).toBe('Grupos unidos: nenhum exercício precisou mudar.');
  });
});
