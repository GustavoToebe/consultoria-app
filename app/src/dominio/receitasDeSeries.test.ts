import type { Receita, Serie } from '../api/tipos';
import { serie } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { agruparReceitasDeSeries, composicaoDaReceita, composicaoDasSeries, filtrarReceitasDeSeries, pecasDaReceita, secaoDaReceita } from './receitasDeSeries';

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

describe('"Usar receita" em blocos e técnicas (D16)', () => {
  const comTecnica = (tipo: 'CLUSTER' | 'REST_PAUSE' | 'DROP_SET', codigos: string[]) => ({
    series: codigos.map((c, i) => ({ tipo: c, ...(i === codigos.length - 1 ? { tecnica: { tipo, pausaSegundos: 15, blocos: tipo === 'CLUSTER' ? [4, 4] : null } } : {}) })),
  });

  it('classifica por técnica, completa ou papel', () => {
    expect(secaoDaReceita({ series: [{ tipo: 'FEEDER' }, { tipo: 'WORKING' }] }, config)).toEqual({ chave: 'COMPLETAS', titulo: 'Receitas completas' });
    expect(secaoDaReceita({ series: [{ tipo: 'WARM_UP' }, { tipo: 'WARM_UP' }] }, config).titulo).toBe('Aquecimento');
    expect(secaoDaReceita({ series: [{ tipo: 'FEEDER' }] }, config).titulo).toBe('Preparação');
    expect(secaoDaReceita({ series: [{ tipo: 'WORKING' }, { tipo: 'TOP_SET' }] }, config).titulo).toBe('Trabalho');
    expect(secaoDaReceita({ series: [{ tipo: 'BACK_OFF' }] }, config).titulo).toBe('Pós-trabalho');
    expect(secaoDaReceita(comTecnica('CLUSTER', ['FEEDER', 'WORKING']), config)).toEqual({ chave: 'TECNICA:CLUSTER', titulo: 'Técnica: Cluster' });
    expect(secaoDaReceita({ series: [{ tipo: 'NAO_EXISTE' }] }, config).titulo).toBe('Outras receitas');
    expect(secaoDaReceita({ series: [] }, config).titulo).toBe('Outras receitas');
  });

  it('o nome da técnica é o da metodologia', () => {
    const muscleRound = { ...config, tecnicas: config.tecnicas.map((t) => (t.tipo === 'CLUSTER' ? { ...t, nome: 'Muscle Round' } : t)) };
    expect(secaoDaReceita(comTecnica('CLUSTER', ['WORKING']), muscleRound).titulo).toBe('Técnica: Muscle Round');
  });

  it('sem metodologia no plano, o papel vem da padrão', () => {
    expect(secaoDaReceita({ series: [{ tipo: 'WARM_UP' }] }, null).titulo).toBe('Aquecimento');
  });

  it('agrupa na ordem combinada, cada receita uma vez, sem seção vazia', () => {
    const receitas = [
      { ...receita('a', 'Back off só', ['BACK_OFF']) },
      { ...receita('b', 'Completa', ['WARM_UP', 'FEEDER', 'WORKING']) },
      { ...receita('c', 'Cluster', []), conteudo: comTecnica('CLUSTER', ['WORKING']) },
      { ...receita('d', 'Drop', []), conteudo: comTecnica('DROP_SET', ['WORKING']) },
      { ...receita('e', 'Rest', []), conteudo: comTecnica('REST_PAUSE', ['WORKING']) },
      { ...receita('f', 'Aquecer', ['WARM_UP']) },
      { ...receita('g', 'Estranha', ['XYZ']) },
    ];
    const secoes = agruparReceitasDeSeries(receitas, config);
    expect(secoes.map((s) => s.titulo)).toEqual([
      'Receitas completas', 'Aquecimento', 'Pós-trabalho', 'Técnica: Rest pause', 'Técnica: Cluster', 'Técnica: Drop-set', 'Outras receitas',
    ]);
    expect(secoes.flatMap((s) => s.receitas.map((r) => r.id)).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('a sequência traz o texto do grupo, o nome e a cor do tipo', () => {
    const pecas = pecasDaReceita({ series: [{ tipo: 'FEEDER', repsMin: 3, repsMax: 3 }, { tipo: 'FEEDER', repsMin: 3, repsMax: 3 }, { tipo: 'WORKING', repsMin: 4, repsMax: 6 }, { tipo: 'BACK_OFF' }] }, config);
    expect(pecas.map((p) => [p.nomeDoTipo, p.cor])).toEqual([['FS', 'AZUL'], ['WS', 'INDIGO'], ['Back off', 'MAGENTA']]);
    expect(pecas[0].texto).toMatch(/^2x3 - FS/);
    expect(pecasDaReceita({ series: [{ tipo: 'XYZ' }] }, config)[0]).toMatchObject({ nomeDoTipo: 'XYZ', cor: null });
    expect(pecasDaReceita({ series: [{ tipo: 'CRIADO', }] }, { ...config, tipos: [...config.tipos, { ...config.tipos[0], codigo: 'CRIADO', nome: 'Meu aquec.', papel: 'AQUECIMENTO' }] })[0].cor).toBe('CIANO');
  });
});
