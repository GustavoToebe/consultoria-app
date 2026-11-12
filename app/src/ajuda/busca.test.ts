import { buscarNaAjuda, textoDoResultado } from './busca';
import type { SecaoGuia } from './conteudo';

const secoes: SecaoGuia[] = [
  { id: 'a', titulo: 'Anamnese', itens: [{ titulo: 'Enviar', texto: 'Peça ao aluno.' }, { titulo: 'Revisar', texto: 'Confira as respostas.' }] },
  { id: 'b', titulo: 'Financeiro', itens: [{ titulo: 'Cobranças', texto: 'Filtro por emissão e pagamento.' }, { titulo: 'Lançamentos', texto: 'Entradas e saídas.' }] },
];
const perguntas = [{ pergunta: 'Esqueci a senha.', resposta: 'Use o link do e-mail.' }];

describe('buscarNaAjuda', () => {
  it('sem termo devolve tudo', () => {
    const r = buscarNaAjuda(secoes, perguntas, '   ');
    expect(r.secoes).toHaveLength(2);
    expect(r.total).toBe(5);
  });

  it('ignora acento e maiúsculas e traz a seção inteira quando o nome casa', () => {
    const r = buscarNaAjuda(secoes, perguntas, 'ANAMNÉSE');
    expect(r.secoes).toEqual([secoes[0]]);
    expect(r.perguntas).toEqual([]);
  });

  it('acha pelo texto sem acento e só os assuntos que casam', () => {
    const r = buscarNaAjuda(secoes, perguntas, 'emissao');
    expect(r.secoes).toEqual([{ ...secoes[1], itens: [secoes[1].itens[0]] }]);
    expect(r.total).toBe(1);
  });

  it('exige todas as palavras', () => {
    expect(buscarNaAjuda(secoes, perguntas, 'saidas pagamento').total).toBe(0);
    expect(buscarNaAjuda(secoes, perguntas, 'entradas saidas').total).toBe(1);
  });

  it('procura nas perguntas e "Perguntas frequentes" traz todas', () => {
    expect(buscarNaAjuda(secoes, perguntas, 'senha').perguntas).toEqual(perguntas);
    expect(buscarNaAjuda(secoes, perguntas, 'perguntas').perguntas).toEqual(perguntas);
  });

  it('nenhum resultado', () => {
    const r = buscarNaAjuda(secoes, perguntas, 'xyzzy');
    expect(r).toEqual({ secoes: [], perguntas: [], total: 0 });
    expect(textoDoResultado(r.total)).toBe('Nenhum resultado');
    expect(textoDoResultado(1)).toBe('1 resultado');
    expect(textoDoResultado(3)).toBe('3 resultados');
  });
});
