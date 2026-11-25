/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create } from 'react-test-renderer';
import { Text as TextoNativo } from 'react-native';

import { fontes } from '../tema/tokens';
import { partirFilhos, partirNumeros } from './numerosNoTexto';
import { Texto } from './Texto';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, fatorTexto: 1 }) }));
jest.mock('../components/ui/text', () => ({ Text: require('react-native').Text }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dividir = (t: string) => partirNumeros(t)?.map((p) => (p.numerico ? `[${p.texto}]` : p.texto)).join('');

describe('partirNumeros (só o número em mono)', () => {
  it.each([
    ['147 ativos, 145 sem acesso', '[147] ativos, [145] sem acesso'],
    ['2 cobranças', '[2] cobranças'],
    ['4 refeições no seu plano', '[4] refeições no seu plano'],
    ['1 de 5 treinos', '[1] de [5] treinos'],
    ['Seus treinos concluídos aparecem aqui', 'Seus treinos concluídos aparecem aqui'],
    ['Vence em R$ 1.234,56', 'Vence em [R$ 1.234,56]'],
    ['Às 12:30 de hoje', 'Às [12:30] de hoje'],
    ['Desde 11/2026', 'Desde [11/2026]'],
    ['70% concluído', '[70%] concluído'],
    ['Carga +2 kg', 'Carga [+2] kg'],
    ['Faça 5x por semana', 'Faça [5x] por semana'],
    ['3x12 reps', '[3x12] reps'],
    ['70 kg', '[70] kg'],
    ['15min', '[15]min'],
    ['(45) 99999-8888 é o contato', '([45]) [99999-8888] é o contato'],
    ['Às 14h30 de hoje', 'Às [14h30] de hoje'],
    ['Das 9h às 14h', 'Das [9h] às [14h]'],
    ['Treino às 9h.', 'Treino às [9h].'],
    ['Variou -2 kg', 'Variou [-2] kg'],
    ['(-2,5 kg)', '([-2,5] kg)'],
    ['Meta: -3%', 'Meta: [-3%]'],
    ['Ontem, 18:38', 'Ontem, [18:38]'],
    ['Padrão da consultoria (15 dias)', 'Padrão da consultoria ([15] dias)'],
  ])('%s', (entrada, saida) => expect(dividir(entrada)).toBe(saida));

  it('"h" só é hora quando fecha o token: "2horas" e "14h30min" não colam a unidade', () => {
    expect(dividir('2horas')).toBe('[2]horas');
    expect(dividir('14h30min')).toBe('[14]h[30]min');
  });

  it('"-" ASCII colado a letra ou dígito antes é hífen, não sinal (sem lookbehind)', () => {
    expect(dividir('COVID-19 em alta')).toBe('COVID-[19] em alta');
    expect(dividir('Sala A-2')).toBe('Sala A-[2]');
    expect(dividir('Faixa 10-12 reps')).toBe('Faixa [10-12] reps');
  });

  it('"x" colado em letras não é multiplicador', () => expect(dividir('5xyz bola')).toBe('[5]xyz bola'));

  it.each(['1.234,56', 'R$ 1.234,56', '12:30 – 13:00', '70%', '—', '', '3x12', '14h30', '-2', '(45) 99999-8888', '123.456.789-09', '17/10/2026'])('sem palavra devolve null (mono inteiro): "%s"', (t) => {
    expect(partirNumeros(t)).toBeNull();
  });

  it('só palavra: uma parte, sem número', () => expect(partirNumeros('Sem dado')).toEqual([{ texto: 'Sem dado', numerico: false }]));
});

describe('partirFilhos', () => {
  const rot = (f: unknown) => partirFilhos(f)?.map((p) => ('elemento' in p ? '<el>' : p.numerico ? `[${p.texto}]` : p.texto)).join('');
  it('junta string, número e lista (interpolação)', () => {
    expect(rot('a')).toBe('a');
    expect(rot([2, ' cobranças'])).toBe('[2] cobranças');
    expect(rot([2, null, false, ' x'])).toBe('[2] x');
    expect(rot(['12', ':', '30', ' h'])).toBe('[12:30] h');
  });
  it('sem palavra: null', () => {
    expect(partirFilhos(undefined)).toBeNull();
    expect(partirFilhos(['1', ' / ', 2])).toBeNull();
  });
  it('elemento React fica no lugar e cada trecho de texto é dividido', () => {
    expect(rot(['Para o aluno: ', <TextoNativo key="k">b</TextoNativo>, ' 3 séries'])).toBe('Para o aluno: <el> [3] séries');
  });
});

function montar(el: React.ReactElement) {
  let r!: ReturnType<typeof create>;
  act(() => { r = create(el); });
  return r;
}
const estiloDe = (n: { props: { style?: unknown } }) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));

describe('Texto com numerico', () => {
  it('frase: Geist por fora, mono só no número (interpolação em lista)', () => {
    const r = montar(<Texto numerico>{2} cobranças</Texto>);
    const [fora] = r.root.findAllByType(TextoNativo);
    expect(estiloDe(fora).fontFamily).toBe(fontes.normal);
    expect(estiloDe(fora).fontVariant).toBeUndefined();
    const dentro = r.root.findAllByType(TextoNativo).slice(1);
    expect(dentro).toHaveLength(1);
    expect(estiloDe(dentro[0]).fontFamily).toBe(fontes.mono);
    expect(estiloDe(dentro[0]).fontVariant).toEqual(['tabular-nums']);
    expect(dentro[0].props.children).toBe('2');
  });

  it('só número: um Text só, tudo em mono, como antes', () => {
    const r = montar(<Texto numerico>R$ 1.234,56</Texto>);
    const textos = r.root.findAllByType(TextoNativo);
    expect(textos).toHaveLength(1);
    expect(estiloDe(textos[0]).fontFamily).toBe(fontes.mono);
  });

  it('frase sem número vira Geist puro, sem Text aninhado', () => {
    const r = montar(<Texto numerico>Seus treinos concluídos aparecem aqui</Texto>);
    const textos = r.root.findAllByType(TextoNativo);
    expect(textos).toHaveLength(1);
    expect(estiloDe(textos[0]).fontFamily).toBe(fontes.normal);
  });

  it('variante numero e destaque também separam; destaque mantém o tamanho e o aperto no número', () => {
    const r = montar(<Texto variante="destaque">12 alunos</Texto>);
    const [fora, dentro] = r.root.findAllByType(TextoNativo);
    expect(estiloDe(fora)).toMatchObject({ fontFamily: fontes.normal, fontSize: 30 });
    expect(estiloDe(dentro)).toMatchObject({ fontFamily: fontes.mono, letterSpacing: -0.9 });
  });

  it('o peso pedido vai para o número: monoSemi e semi dão número semi; palavras em Geist do mesmo peso', () => {
    const a = montar(<Texto numerico style={{ fontFamily: fontes.monoSemi }}>3 séries</Texto>).root.findAllByType(TextoNativo);
    expect(estiloDe(a[0]).fontFamily).toBe(fontes.semi);
    expect(estiloDe(a[1]).fontFamily).toBe(fontes.monoSemi);
    const b = montar(<Texto numerico style={{ fontFamily: fontes.semi }}>3 séries</Texto>).root.findAllByType(TextoNativo);
    expect(estiloDe(b[0]).fontFamily).toBe(fontes.semi);
    expect(estiloDe(b[1]).fontFamily).toBe(fontes.monoSemi);
  });

  it('sem `numerico` (código com style mono): uma peça só, sem dividir', () => {
    const r = montar(<Texto style={{ fontFamily: fontes.mono }}>ab12-cd34</Texto>);
    expect(r.root.findAllByType(TextoNativo)).toHaveLength(1);
  });

  it('sem numerico e variante comum: nada muda', () => {
    const r = montar(<Texto>2 cobranças</Texto>);
    expect(r.root.findAllByType(TextoNativo)).toHaveLength(1);
  });

  it('filho elemento React: o elemento fica, o texto em volta é dividido', () => {
    const r = montar(<Texto numerico>3 itens <TextoNativo>b</TextoNativo></Texto>);
    const todos = r.root.findAllByType(TextoNativo);
    expect(todos).toHaveLength(3);
    expect(estiloDe(todos[0]).fontFamily).toBe(fontes.normal);
    expect(estiloDe(todos[1]).fontFamily).toBe(fontes.mono);
  });
  it('elemento e texto sem palavra: tudo em mono, como antes', () => {
    const r = montar(<Texto numerico>3 <TextoNativo>b</TextoNativo></Texto>);
    expect(estiloDe(r.root.findAllByType(TextoNativo)[0]).fontFamily).toBe(fontes.mono);
  });

  it('numberOfLines e o resto das props seguem no Text de fora', () => {
    const r = montar(<Texto numerico numberOfLines={1} nivel={2}>3 de 5 treinos</Texto>);
    const [fora] = r.root.findAllByType(TextoNativo);
    expect(fora.props.numberOfLines).toBe(1);
    expect(fora.props['aria-level']).toBe(2);
  });
});
