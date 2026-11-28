import type { Receita, Serie } from '../api/tipos';
import { serie } from './exemplosDeTreino.apoioTeste';
import {
  abaDaReceita, abaInicial, avisoDasSeriesAtuais, contagemPorAba, estaNaAba, filtroEfetivo, filtrosDasReceitas, idDaTecla, receitaEscolhida, receitasDaLista,
  receitasDaAba, rotuloDeSubstituir, SEM_FILTRO, type AbaDeReceitas,
} from './listaDeReceitas';
import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { trechosDaComposicao } from './receitasDeSeries';

const cluster = { tipo: 'CLUSTER' as const, pausaSegundos: 15, blocos: [4, 4] };

const receita = (id: string, nome: string, series: Partial<Serie>[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', origem: 'PADRAO', nome, descricao: null, ordem: 0, pastaId: null, versao: 0,
  conteudo: { series: series.map((s, i) => { const { uid: _uid, ...resto } = serie(`s${i}`, s); return resto; }) }, ...extra,
});

const forca = receita('forca', 'Força com preparação', [{ tipo: 'WARM_UP' }, { tipo: 'FEEDER' }, { tipo: 'FEEDER' }, { tipo: 'WORKING' }]);
const volume = receita('volume', 'Volume', [{ tipo: 'WORKING' }, { tipo: 'BACK_OFF' }, { tipo: 'BACK_OFF' }], { descricao: 'Para hipertrofia', origem: 'CONSULTORIA' });
const backOff = receita('backoff', 'Back off solto', [{ tipo: 'BACK_OFF' }]);
const clusterSo = receita('cluster', 'Cluster', [{ tipo: 'WORKING', tecnica: cluster }], { origem: 'CONSULTORIA' });
const todas = [forca, volume, backOff, clusterSo, receita('sessao', 'Outra', [{ tipo: 'WORKING' }], { tipo: 'SESSAO_TREINO', origem: 'CONSULTORIA' })];

describe('abas da folha "Usar receita"', () => {
  it('completas = mais de um papel; o resto são partes', () => {
    expect(abaDaReceita(forca.conteudo, config)).toBe('COMPLETAS');
    expect(abaDaReceita(volume.conteudo, config)).toBe('COMPLETAS');
    expect(abaDaReceita(backOff.conteudo, config)).toBe('PARTES');
    expect(abaDaReceita(clusterSo.conteudo, config)).toBe('PARTES');
    expect(abaDaReceita(null, config)).toBe('PARTES');
  });

  it('a contagem segue a busca e ignora o que não é receita de séries', () => {
    expect(contagemPorAba(todas, '', config)).toEqual({ COMPLETAS: 2, PARTES: 2, CONSULTORIA: 2 });
    expect(contagemPorAba(todas, 'back off', config)).toEqual({ COMPLETAS: 1, PARTES: 1, CONSULTORIA: 1 });
    expect(contagemPorAba(todas, 'nada assim', config)).toEqual({ COMPLETAS: 0, PARTES: 0, CONSULTORIA: 0 });
  });
});

describe('aba "Da consultoria"', () => {
  it('só as de séries que a equipe criou (origem CONSULTORIA), completas ou partes; elas seguem nas outras abas', () => {
    expect(receitasDaAba(todas, 'CONSULTORIA', config).map((r) => r.id)).toEqual(['volume', 'cluster']);
    expect(receitasDaAba(todas, 'COMPLETAS', config).map((r) => r.id)).toEqual(['forca', 'volume']);
    expect(estaNaAba(volume, 'CONSULTORIA', config)).toBe(true);
    expect(estaNaAba(forca, 'CONSULTORIA', config)).toBe(false);
  });

  it('busca e chip valem dentro dela; chip que ela não tem vale como "Todos"', () => {
    const ids = (busca: string, filtro: string) => receitasDaLista(todas, { aba: 'CONSULTORIA', busca, filtro }, config).map((r) => r.id);
    expect(ids('', SEM_FILTRO)).toEqual(['volume', 'cluster']);
    expect(ids('cluster', SEM_FILTRO)).toEqual(['cluster']);
    expect(ids('', 'TECNICA:CLUSTER')).toEqual(['cluster']);
    expect(ids('', 'TIPO:WARM_UP')).toEqual(['volume', 'cluster']);
    expect(receitasDaLista([forca, backOff], { aba: 'CONSULTORIA', busca: '', filtro: SEM_FILTRO }, config)).toEqual([]);
  });

  it('a folha nunca abre nela: Completas, ou Partes quando só há partes', () => {
    const abre = (rs: Receita[]): AbaDeReceitas => abaInicial(rs, config);
    expect(abre(todas)).toBe('COMPLETAS');
    expect(abre([backOff, clusterSo])).toBe('PARTES');
    expect(abre([])).toBe('COMPLETAS');
  });
});

describe('chips de tipo e técnica', () => {
  it('só os presentes, tipos na ordem da metodologia e técnicas depois, com "Todos" na frente', () => {
    expect(filtrosDasReceitas([volume, forca, clusterSo], config).map((f) => f.rotulo)).toEqual(['Todos', 'Aquecimento', 'FS', 'WS', 'Back off', 'Cluster']);
    expect(filtrosDasReceitas([], config)).toEqual([{ valor: SEM_FILTRO, rotulo: 'Todos' }]);
  });

  it('tipo fora da metodologia entra pelo código, depois dos conhecidos; cardio não vira chip', () => {
    const estranha = receita('x', 'Estranha', [{ tipo: 'OUTRO_X' }, { tipo: 'WORKING' }, { tipo: null, cardio: { duracaoMin: 10, distanciaKm: null, ritmo: null, zona: null, intervalos: null } }]);
    expect(filtrosDasReceitas([estranha], config).map((f) => f.valor)).toEqual([SEM_FILTRO, 'TIPO:WORKING', 'TIPO:OUTRO_X']);
  });

  it('o chip filtra a aba; chip que a aba não tem vale como "Todos"', () => {
    const ids = (aba: 'COMPLETAS' | 'PARTES', busca: string, filtro: string) => receitasDaLista(todas, { aba, busca, filtro }, config).map((r) => r.id);
    expect(ids('COMPLETAS', '', SEM_FILTRO)).toEqual(['forca', 'volume']);
    expect(ids('COMPLETAS', '', 'TIPO:BACK_OFF')).toEqual(['volume']);
    expect(ids('PARTES', '', 'TECNICA:CLUSTER')).toEqual(['cluster']);
    expect(ids('COMPLETAS', '', 'TECNICA:CLUSTER')).toEqual(['forca', 'volume']);
    expect(filtroEfetivo([forca, volume], 'TECNICA:CLUSTER', config)).toBe(SEM_FILTRO);
    // Busca e chip juntos podem não dar nada (o estado "filtro vazio").
    expect(ids('COMPLETAS', 'forca', 'TIPO:BACK_OFF')).toEqual([]);
  });
});

describe('selos da lista', () => {
  it('um por trecho seguido, com a quantidade e a cor do tipo', () => {
    expect(trechosDaComposicao(seriesDe(forca), config)).toEqual([
      { nome: 'Aquecimento', quantas: 1, cor: expect.any(String) },
      { nome: 'FS', quantas: 2, cor: expect.any(String) },
      { nome: 'WS', quantas: 1, cor: expect.any(String) },
    ]);
    expect(trechosDaComposicao([{ tipo: null, cardio: { duracaoMin: 10, distanciaKm: null, ritmo: null, zona: null, intervalos: null } }], config))
      .toEqual([{ nome: 'Cardio', quantas: 1, cor: null }]);
  });
});

describe('escolha e teclado', () => {
  const lista = [forca, volume, backOff];

  it('a escolhida sai da lista quando some; lista vazia = nenhuma', () => {
    expect(receitaEscolhida(lista, 'volume')?.id).toBe('volume');
    expect(receitaEscolhida(lista, 'sumiu')?.id).toBe('forca');
    expect(receitaEscolhida(lista, null)?.id).toBe('forca');
    expect(receitaEscolhida([], 'volume')).toBeNull();
  });

  it('setas sem dar a volta, Home e End às pontas, outra tecla nada', () => {
    expect(idDaTecla(lista, 'forca', 'ArrowDown')).toBe('volume');
    expect(idDaTecla(lista, 'backoff', 'ArrowDown')).toBe('backoff');
    expect(idDaTecla(lista, 'forca', 'ArrowUp')).toBe('forca');
    expect(idDaTecla(lista, 'volume', 'End')).toBe('backoff');
    expect(idDaTecla(lista, 'backoff', 'Home')).toBe('forca');
    expect(idDaTecla(lista, 'sumiu', 'ArrowDown')).toBe('volume');
    expect(idDaTecla(lista, 'forca', 'a')).toBeNull();
    expect(idDaTecla([], null, 'ArrowDown')).toBeNull();
  });
});

describe('textos do rodapé', () => {
  it('substituir diz quantas séries saem; o aviso só existe com séries', () => {
    expect(rotuloDeSubstituir(1)).toBe('Substituir a série');
    expect(rotuloDeSubstituir(5)).toBe('Substituir as 5 séries');
    expect(avisoDasSeriesAtuais(0)).toBeNull();
    expect(avisoDasSeriesAtuais(1)).toBe('Este exercício já tem 1 série.');
    expect(avisoDasSeriesAtuais(5)).toBe('Este exercício já tem 5 séries.');
  });
});

function seriesDe(r: Receita): Serie[] {
  return (r.conteudo as { series: Serie[] }).series;
}
