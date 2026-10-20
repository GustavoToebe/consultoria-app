import type { ConteudoMobilidadeApi } from '../api/tipos';
import {
  contagemDaMobilidadeNoTreinador,
  contagemDoDia,
  dataInicialDaMobilidade,
  datasDaMobilidade,
  diasComAlgoFeito,
  feitosDoDia,
  fundirMarcas,
  itensDaMobilidade,
  textoDaContagem,
  textoDosDiasDeMobilidade,
  type MarcaDeMobilidade,
  type MarcaLocalDeMobilidade,
} from './mobilidadeFeita';

const conteudo: ConteudoMobilidadeApi = {
  orientacoes: null,
  secoes: [
    { uid: 's1', titulo: 'Alongamentos', itens: [
      { uid: 'i1', nome: 'Lunge', prescricao: null, videoUrl: null },
      { uid: 'i2', nome: 'Gato e vaca', prescricao: null, videoUrl: null },
    ] },
    { uid: 's2', titulo: 'Quadril', itens: [{ uid: 'i3', nome: 'Agachamento profundo', prescricao: null, videoUrl: null }] },
  ],
};

const marca = (itemUid: string, data: string, feito = true, planoVersaoId = 'v1'): MarcaDeMobilidade => ({ planoVersaoId, itemUid, data, feito });
const local = (m: MarcaDeMobilidade, situacao: MarcaLocalDeMobilidade['situacao'] = 'LOCAL'): MarcaLocalDeMobilidade => ({ ...m, secaoUid: 's1', situacao });

describe('feitosDoDia e contagemDoDia', () => {
  it('só considera a versão, o dia e o que está feito', () => {
    const marcas = [marca('i1', '2026-10-19'), marca('i2', '2026-10-19', false), marca('i3', '2026-10-18'), marca('i1', '2026-10-19', true, 'v0')];
    expect([...feitosDoDia(marcas, 'v1', '2026-10-19')]).toEqual(['i1']);
  });

  it('conta "N de M" só com itens que existem na versão exibida', () => {
    expect(itensDaMobilidade(conteudo)).toEqual(['i1', 'i2', 'i3']);
    expect(contagemDoDia(conteudo, new Set(['i1', 'i3']))).toEqual({ feitos: 2, total: 3 });
    // Marca de um item que não está na versão (sobrou de outra) não conta.
    expect(contagemDoDia(conteudo, new Set(['i1', 'outro-item']))).toEqual({ feitos: 1, total: 3 });
    expect(contagemDoDia(conteudo, new Set())).toEqual({ feitos: 0, total: 3 });
  });
});

describe('textoDaContagem', () => {
  it('diz Hoje ou a data', () => {
    expect(textoDaContagem({ feitos: 2, total: 3 }, true, '19/10')).toBe('Hoje: 2 de 3 feitos');
    expect(textoDaContagem({ feitos: 0, total: 3 }, false, '14/10')).toBe('Em 14/10: 0 de 3 feitos');
    expect(textoDaContagem({ feitos: 1, total: 1 }, true, '19/10')).toBe('Hoje: 1 de 1 feito');
  });
});

describe('fundirMarcas', () => {
  it('o aparelho ganha do servidor na mesma versão, item e dia', () => {
    const servidor = [marca('i1', '2026-10-19', true), marca('i2', '2026-10-19', true)];
    const aparelho = [local(marca('i1', '2026-10-19', false))];
    const juntas = fundirMarcas(aparelho, servidor);
    expect(juntas).toHaveLength(2);
    expect(juntas.find((m) => m.itemUid === 'i1')?.feito).toBe(false);
    expect(juntas.find((m) => m.itemUid === 'i2')?.feito).toBe(true);
  });

  it('marca recusada pelo servidor não conta e deixa valer a do servidor', () => {
    const servidor = [marca('i1', '2026-10-19', true)];
    const aparelho = [local(marca('i1', '2026-10-19', false), 'FALHOU')];
    expect(fundirMarcas(aparelho, servidor)).toEqual(servidor);
    expect(fundirMarcas(aparelho, [])).toEqual([]);
  });

  it('versões diferentes não se misturam', () => {
    const juntas = fundirMarcas([local(marca('i1', '2026-10-19', true, 'v2'))], [marca('i1', '2026-10-19', true, 'v1')]);
    expect(juntas).toHaveLength(2);
  });
});

describe('datasDaMobilidade', () => {
  it('hoje e os 6 dias anteriores, da mais antiga para a mais nova', () => {
    const datas = datasDaMobilidade({ inicio: '2026-09-01', fim: '2026-12-31' }, '2026-10-19');
    expect(datas).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
  });

  it('respeita o início do período', () => {
    expect(datasDaMobilidade({ inicio: '2026-10-17', fim: '2026-12-31' }, '2026-10-19')).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
  });

  it('passado o fim, mostra os últimos dias do período', () => {
    expect(datasDaMobilidade({ inicio: '2026-09-01', fim: '2026-10-15' }, '2026-10-19', 3)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('antes do início não há data para marcar', () => {
    expect(datasDaMobilidade({ inicio: '2026-11-01', fim: '2026-12-31' }, '2026-10-19')).toEqual([]);
  });

  it('sem período vale a semana corrida; fora dos 60 dias que a API aceita, nada', () => {
    expect(datasDaMobilidade({ inicio: null, fim: null }, '2026-10-19')).toHaveLength(7);
    expect(datasDaMobilidade({ inicio: '2026-01-01', fim: '2026-01-31' }, '2026-10-19')).toEqual([]);
  });

  it('a data que a tela abre é hoje, senão a mais recente', () => {
    expect(dataInicialDaMobilidade(['2026-10-18', '2026-10-19'], '2026-10-19')).toBe('2026-10-19');
    expect(dataInicialDaMobilidade(['2026-10-13', '2026-10-15'], '2026-10-19')).toBe('2026-10-15');
    expect(dataInicialDaMobilidade([], '2026-10-19')).toBeNull();
  });
});

describe('contagem no treinador', () => {
  const marcas = [
    marca('i1', '2026-10-19'),
    marca('i2', '2026-10-19'), // mesmo dia: conta uma vez
    marca('i1', '2026-10-15'),
    marca('i1', '2026-10-14', false), // desmarcado não conta
    marca('i3', '2026-10-05'),
    marca('i3', '2026-11-30'), // depois do período
  ];

  it('conta dias distintos com algo feito, nas pontas inclusive', () => {
    expect(diasComAlgoFeito(marcas, '2026-10-19', '2026-10-25')).toBe(1);
    expect(diasComAlgoFeito(marcas, '2026-10-05', '2026-10-19')).toBe(3);
    expect(diasComAlgoFeito([], '2026-10-05', '2026-10-19')).toBe(0);
  });

  it('semana e pasta; sem mobilidade na pasta é null', () => {
    const semana = { inicio: '2026-10-19', fim: '2026-10-25' };
    const pasta = { inicio: '2026-10-01', fim: '2026-10-31' };
    expect(contagemDaMobilidadeNoTreinador(marcas, semana, pasta, true)).toEqual({ naSemana: 1, naPasta: 3 });
    expect(contagemDaMobilidadeNoTreinador(marcas, semana, pasta, false)).toBeNull();
    expect(contagemDaMobilidadeNoTreinador(marcas, semana, null, true)).toEqual({ naSemana: 1, naPasta: 0 });
  });

  it('o texto: "—", "Nenhum registro" ou as contagens', () => {
    expect(textoDosDiasDeMobilidade(null)).toBe('—');
    expect(textoDosDiasDeMobilidade(0)).toBe('Nenhum registro');
    expect(textoDosDiasDeMobilidade(1)).toBe('1 dia');
    expect(textoDosDiasDeMobilidade(12)).toBe('12 dias');
  });
});
