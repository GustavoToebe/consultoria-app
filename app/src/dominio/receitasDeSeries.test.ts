import type { Receita, Serie } from '../api/tipos';
import { serie } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { composicaoDaReceita, composicaoDasSeries, filtrarReceitasDeSeries } from './receitasDeSeries';

const tipos = (...codigos: (string | null)[]): Serie[] => codigos.map((tipo, i) => serie(`s${i}`, { tipo }));

const receita = (id: string, nome: string, codigos: string[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', nome, descricao: null, ordem: 0, pastaId: null, versao: 0,
  conteudo: { series: tipos(...codigos).map(({ uid: _uid, ...resto }) => resto) }, ...extra,
});

describe('composição da receita de séries', () => {
  it('conta os tipos seguidos, pelo nome configurado', () => {
    expect(composicaoDasSeries(tipos('FEEDER', 'FEEDER', 'FEEDER', 'WORKING', 'BACK_OFF'), config)).toBe('FS ×3 · WS ×1 · Back off ×1');
  });

  it('só junta as seguidas; tipo fora da metodologia pelo código; sem tipo e cardio têm o seu', () => {
    expect(composicaoDasSeries(tipos('WORKING', 'FEEDER', 'WORKING'), config)).toBe('WS ×1 · FS ×1 · WS ×1');
    expect(composicaoDasSeries(tipos('OUTRO_X'), config)).toBe('OUTRO_X ×1');
    expect(composicaoDasSeries(tipos(null, null), config)).toBe('Sem tipo ×2');
    expect(composicaoDasSeries([{ tipo: null, cardio: { duracaoMin: 20, distanciaKm: null, ritmo: null, zona: null, intervalos: null } }], config)).toBe('Cardio ×1');
    expect(composicaoDasSeries([], config)).toBe('');
  });

  it('lê o conteúdo guardado da receita', () => {
    expect(composicaoDaReceita({ series: [{ tipo: 'FEEDER' }, { tipo: 'WORKING' }] }, config)).toBe('FS ×1 · WS ×1');
    expect(composicaoDaReceita(null, config)).toBe('');
  });
});

describe('busca das receitas de séries', () => {
  const receitas = [
    receita('a', 'Força básica', ['FEEDER', 'WORKING']),
    receita('b', 'Volume', ['WORKING', 'BACK_OFF', 'BACK_OFF'], { descricao: 'Para hipertrofia' }),
    receita('c', 'Pirâmide', ['WARM_UP', 'WORKING']),
    receita('d', 'Outra coisa', ['WORKING'], { tipo: 'SESSAO_TREINO' }),
  ];
  const ids = (busca: string) => filtrarReceitasDeSeries(receitas, busca, config).map((r) => r.id);

  it('busca vazia traz todas as de séries, na ordem', () => {
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('pelo nome e pela descrição, sem acento nem caixa', () => {
    expect(ids('FORCA')).toEqual(['a']);
    expect(ids('piramide')).toEqual(['c']);
    expect(ids('hipertrofia')).toEqual(['b']);
  });

  it('pela composição e pelo papel do tipo', () => {
    expect(ids('back off')).toEqual(['b']);
    expect(ids('preparacao')).toEqual(['a']);
    expect(ids('aquecimento')).toEqual(['c']);
    expect(ids('back off ×2')).toEqual(['b']);
    expect(ids('fs ×1 · ws')).toEqual(['a']);
    expect(ids('nada disso')).toEqual([]);
  });
});
