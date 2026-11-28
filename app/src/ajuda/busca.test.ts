import { artigosDaAjuda, buscarNaAjuda, PERGUNTAS, textoDoResultado, trechoDoResultado } from './busca';
import type { SecaoGuia } from './conteudo';

const secoes: SecaoGuia[] = [
  { id: 'a', titulo: 'Anamnese', itens: [{ titulo: 'Enviar', texto: 'Peça ao aluno.' }, { titulo: 'Revisar', texto: 'Confira as respostas.' }] },
  { id: 'b', titulo: 'Financeiro', itens: [{ titulo: 'Cobranças', texto: 'Filtro por **emissão** e pagamento.' }, { titulo: 'Lançamentos', texto: 'Entradas e saídas.' }] },
];
const perguntas = [{ pergunta: 'Esqueci a senha.', resposta: 'Use o link do e-mail.' }];
const artigos = artigosDaAjuda(secoes, perguntas);

describe('artigosDaAjuda', () => {
  it('uma seção por artigo, com o tópico pelo título, e as perguntas por último', () => {
    expect(artigos.map((a) => a.id)).toEqual(['a', 'b', PERGUNTAS]);
    expect(artigos[1].topicos[0]).toEqual({ id: 'cobrancas', titulo: 'Cobranças', texto: 'Filtro por **emissão** e pagamento.' });
    expect(artigos[2].topicos[0].id).toBe('esqueci-a-senha');
    expect(artigosDaAjuda(secoes, []).map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('buscarNaAjuda', () => {
  it('sem termo, nenhum resultado', () => {
    expect(buscarNaAjuda(artigos, '   ')).toEqual([]);
  });

  it('ignora acento, maiúsculas e a marcação; um resultado por tópico, com o trecho destacado', () => {
    const [r, ...resto] = buscarNaAjuda(artigos, 'EMISSAO');
    expect(resto).toEqual([]);
    expect(r).toEqual({ artigoId: 'b', artigoTitulo: 'Financeiro', topicoId: 'cobrancas', topicoTitulo: 'Cobranças', trecho: { antes: 'Filtro por ', achado: 'emissão', depois: ' e pagamento.' } });
  });

  it('o nome do assunto traz os tópicos dele, depois dos que casam pelo título', () => {
    expect(buscarNaAjuda(artigos, 'anamnese').map((r) => r.topicoId)).toEqual(['enviar', 'revisar']);
    expect(buscarNaAjuda(artigos, 'revisar').map((r) => r.topicoId)).toEqual(['revisar']);
  });

  it('exige todas as palavras', () => {
    expect(buscarNaAjuda(artigos, 'saidas pagamento')).toEqual([]);
    expect(buscarNaAjuda(artigos, 'entradas saidas')).toHaveLength(1);
  });

  it('procura nas perguntas', () => {
    expect(buscarNaAjuda(artigos, 'senha')[0]).toMatchObject({ artigoId: PERGUNTAS, topicoId: 'esqueci-a-senha' });
  });

  it('conta os resultados', () => {
    expect(textoDoResultado(0)).toBe('Nenhum resultado');
    expect(textoDoResultado(1)).toBe('1 resultado');
    expect(textoDoResultado(3)).toBe('3 resultados');
  });
});

describe('trechoDoResultado', () => {
  const longo = `${'palavra '.repeat(20)}Atualização ${'depois '.repeat(40)}fim`;

  it('corta em volta da palavra, com reticências, e mantém o acento do original', () => {
    const t = trechoDoResultado(longo, ['atualizacao']);
    expect(t.achado).toBe('Atualização');
    expect(t.antes.startsWith('…')).toBe(true);
    expect(t.depois.endsWith('…')).toBe(true);
    expect(t.antes.length).toBeLessThanOrEqual(62);
  });

  it('palavra no começo e no fim do texto', () => {
    expect(trechoDoResultado('Ação rápida.', ['acao'])).toEqual({ antes: '', achado: 'Ação', depois: ' rápida.' });
    expect(trechoDoResultado('Toque em Salvar', ['salvar'])).toEqual({ antes: 'Toque em ', achado: 'Salvar', depois: '' });
  });

  it('com várias palavras, destaca a que aparece primeiro; sem nenhuma no texto, o começo dele', () => {
    expect(trechoDoResultado('Abra a pasta e publique.', ['publique', 'pasta']).achado).toBe('pasta');
    expect(trechoDoResultado('Texto curto.', ['titulo'])).toEqual({ antes: 'Texto curto.', achado: '', depois: '' });
  });
});
