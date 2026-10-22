import { problemasDaMetodologia, type MetodologiaEmEdicao } from '../../dominio/edicaoMetodologia';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { LINHAS_VISIVEIS, listaDeProblemas, motivoDoSalvar, problemasDoItem } from './problemasDaTela';

const copia = (): MetodologiaEmEdicao => JSON.parse(JSON.stringify(CONFIGURACAO_PADRAO));

describe('problemas da metodologia na tela', () => {
  it('metodologia válida não tem lista nem motivo', () => {
    const c = copia();
    const linhas = listaDeProblemas(c, problemasDaMetodologia(c));
    expect(linhas).toEqual([]);
    expect(motivoDoSalvar(linhas)).toBeNull();
  });

  it('cada problema aponta o cartão e diz onde está', () => {
    const c = copia();
    c.tipos[1].nome = '';
    c.tipos[2].repeticoes = { min: 20, max: 10 };
    c.tecnicas[0].explicacao = 'x'.repeat(501);
    c.combinacoes[0].nome = 'y'.repeat(31);
    const linhas = listaDeProblemas(c, problemasDaMetodologia(c));
    const dosTipos = linhas.filter((l) => l.secao === 'tipo');
    expect(dosTipos.map((l) => l.chave)).toEqual(expect.arrayContaining(['tipos[1].nome', 'tipos[2].repeticoes']));
    const nome = linhas.find((l) => l.chave === 'tipos[1].nome');
    expect(nome?.alvo).toBe(`tipo:${c.tipos[1].codigo}`);
    expect(nome?.onde).toBe('Tipo “sem nome” · Nome');
    expect(linhas.find((l) => l.chave === 'tipos[2].repeticoes')?.onde).toBe(`Tipo “${c.tipos[2].nome}” · Repetições`);
    const tecnica = linhas.find((l) => l.secao === 'tecnica');
    expect(tecnica?.alvo).toBe(`tecnica:${c.tecnicas[0].tipo}`);
    expect(tecnica?.onde).toMatch(/^Técnica “.+” · Explicação$/);
    const combinacao = linhas.find((l) => l.secao === 'combinacao');
    expect(combinacao?.alvo).toBe(`combinacao:${c.combinacoes[0].tipo}`);
    expect(combinacao?.onde).toMatch(/^Combinação “y+” · Nome$/);
  });

  it('o problema da lista inteira (nenhum tipo de trabalho) vai para os tipos', () => {
    const c = copia();
    c.tipos = c.tipos.map((t) => ({ ...t, papel: 'OUTRO', regraPercentuais: null }));
    const linha = listaDeProblemas(c, problemasDaMetodologia(c)).find((l) => l.chave === 'tipos');
    expect(linha).toMatchObject({ secao: 'tipo', indice: null, alvo: 'tipos', onde: 'Tipos de série' });
  });

  it('o problema geral aparece com o nome do campo', () => {
    const c = copia();
    c.arredondamentoKg = -1;
    const linha = listaDeProblemas(c, problemasDaMetodologia(c)).find((l) => l.secao === 'geral');
    expect(linha?.alvo).toBe('geral');
    expect(linha?.onde).toBe('Arredondamento da carga');
  });

  it('os problemas de um item chegam com a chave relativa a ele', () => {
    const c = copia();
    c.tipos[1].nome = '';
    c.tipos[1].cargaPadrao = { modo: 'PERCENTUAL_WS', percentualMin: 0, percentualMax: null, referenciaUid: null };
    const problemas = problemasDaMetodologia(c);
    const doTipo = problemasDoItem(problemas, 'tipos', 1);
    expect(Object.keys(doTipo)).toEqual(expect.arrayContaining(['nome']));
    expect(Object.keys(doTipo).some((k) => k.startsWith('cargaPadrao'))).toBe(true);
    expect(problemasDoItem(problemas, 'tipos', 0)).toEqual({});
    expect(problemasDoItem(problemas, 'tecnicas', 1)).toEqual({});
  });

  it('o botão Salvar modelo cita quantos problemas e o primeiro, com onde está', () => {
    const c = copia();
    c.tipos[1].nome = '';
    const um = motivoDoSalvar(listaDeProblemas(c, problemasDaMetodologia(c)));
    expect(um).toMatch(/^Corrija 1 problema da metodologia antes de salvar\. Primeiro: Tipo “sem nome” · Nome: /);
    c.tipos[2].nome = '';
    const varios = motivoDoSalvar(listaDeProblemas(c, problemasDaMetodologia(c)));
    expect(varios).toMatch(/^Corrija \d+ problemas da metodologia/);
  });

  it('a lista mostra poucas linhas de início', () => {
    expect(LINHAS_VISIVEIS).toBe(6);
  });
});
