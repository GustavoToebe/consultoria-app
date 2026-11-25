import type { Exercicio } from '../api/tipos';
import { coresComBordasReforcadas, coresComContraste } from './preferencias';
import { CHAVES_DE_IDENTIFICACAO, PALETAS, contraste, coresDeIdentificacao, type Cores, type VarianteDoTema } from '../tema/tokens';
import {
  chipsDosExercicios,
  COR_DA_MODALIDADE,
  detalheDoExercicio,
  midiaParaApi,
  modalidadesExistentes,
  opcoesDeModalidade,
  ORDEM_DAS_MODALIDADES,
  SEM_FILTROS_DE_EXERCICIOS,
  semOFiltro,
  temImagem,
  temVideo,
} from './exerciciosDaBiblioteca';
import { MODALIDADES } from './modalidades';

const base: Exercicio = {
  id: 'x', nome: 'Fictício', grupoMuscular: 'Costas', equipamento: null, modalidade: 'MAQUINA', videoUrl: null,
  observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
};
const ex = (p: Partial<Exercicio>): Exercicio => ({ ...base, ...p });

describe('cor da modalidade', () => {
  test('cinco com cor, cada uma de identificação e sem repetir; Outro fica neutro', () => {
    const cores = ORDEM_DAS_MODALIDADES.map((m) => COR_DA_MODALIDADE[m]).filter((c) => c !== null);
    expect(cores).toHaveLength(5);
    expect(new Set(cores).size).toBe(5);
    for (const c of cores) expect(CHAVES_DE_IDENTIFICACAO).toContain(c);
    expect(COR_DA_MODALIDADE.OUTRO).toBeNull();
  });

  test('a ordem é a de MODALIDADES', () => {
    expect(ORDEM_DAS_MODALIDADES).toEqual(Object.keys(MODALIDADES));
  });

  test('só as existentes, sem repetir, na ordem da tela', () => {
    expect(modalidadesExistentes([])).toEqual([]);
    expect(modalidadesExistentes([ex({ modalidade: 'CARDIO' }), ex({ modalidade: 'LIVRE' }), ex({ modalidade: 'CARDIO' })])).toEqual(['LIVRE', 'CARDIO']);
  });
});

describe('o que o exercício tem', () => {
  test('vídeo: link preenchido', () => {
    expect(temVideo(ex({ videoUrl: 'https://youtu.be/abcdefghijk' }))).toBe(true);
    expect(temVideo(ex({ videoUrl: '  ' }))).toBe(false);
    expect(temVideo(ex({}))).toBe(false);
  });

  test('imagem: própria ou foto do catálogo', () => {
    expect(temImagem(ex({ imagemPropriaEm: '2026-11-01T00:00:00Z' }))).toBe(true);
    expect(temImagem(ex({ imagens: ['A/0.jpg'] }))).toBe(true);
    expect(temImagem(ex({}))).toBe(false);
  });

  test('detalhe: grupo e equipamento que existirem', () => {
    expect(detalheDoExercicio(ex({ equipamento: 'Cabo' }))).toBe('Costas · Cabo');
    expect(detalheDoExercicio(ex({ grupoMuscular: null }))).toBe('');
  });
});

describe('filtros da aba', () => {
  test('vídeo e imagem vão à API como booleano; "Todos" não manda nada', () => {
    expect(midiaParaApi('TODOS')).toBeUndefined();
    expect(midiaParaApi('COM')).toBe(true);
    expect(midiaParaApi('SEM')).toBe(false);
  });

  test('opções de modalidade: as da biblioteca na ordem da tela, mais as marcadas que sumiram', () => {
    expect(opcoesDeModalidade([], new Set()).map((o) => o.valor)).toEqual([]);
    expect(opcoesDeModalidade(['CARDIO', 'LIVRE'], new Set()).map((o) => o.valor)).toEqual(['LIVRE', 'CARDIO']);
    expect(opcoesDeModalidade(['LIVRE'], new Set(['ELASTICO'])).map((o) => o.valor)).toEqual(['LIVRE', 'ELASTICO']);
    expect(opcoesDeModalidade(['LIVRE'], new Set(['LIVRE']))).toEqual([{ valor: 'LIVRE', rotulo: 'Peso livre' }]);
  });

  test('um chip por filtro, com a chave dele, na ordem do painel; o ✕ tira só aquele', () => {
    const f = { grupos: new Set(['Costas']), modalidades: new Set(['CARDIO', 'MAQUINA']), video: 'SEM' as const, imagem: 'COM' as const };
    expect(chipsDosExercicios(f, [{ valor: 'Costas', rotulo: 'Costas' }])).toEqual([
      { chave: 'grupos', texto: 'Grupo muscular: Costas' },
      { chave: 'modalidades', texto: 'Modalidade: Máquina, Cardio' },
      { chave: 'video', texto: 'Vídeo: Sem vídeo' },
      { chave: 'imagem', texto: 'Imagem: Com imagem' },
    ]);
    const sem = semOFiltro(f, 'video');
    expect(sem.video).toBe('TODOS');
    expect(sem.imagem).toBe('COM');
    expect(semOFiltro(f, 'outra')).toBe(f);
    expect(chipsDosExercicios(SEM_FILTROS_DE_EXERCICIOS, [])).toEqual([]);
  });
});

// A marca da modalidade (bolinha de 8 px) é só marca: precisa de 3:1 (WCAG 1.4.11) sobre a linha da lista (cartão, hover e o
// poço da folha) nas 9 paletas, com contraste alto e bordas reforçadas. O texto ao lado é neutro. "Outro" usa `textoSuave`.
const TEMAS: [string, Cores, VarianteDoTema][] = Object.entries(PALETAS).flatMap(([codigo, p]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, VarianteDoTema] => [
  `${codigo}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(p.cores, alto ? 'ALTO' : 'PADRAO', p.modo === 'ESCURO'), reforcadas),
  p.variante,
])));

describe.each(TEMAS)('marca da modalidade no tema %s', (_nome, cores, variante) => {
  test('3:1 sobre a superfície, o hover e o poço', () => {
    const identificacao = coresDeIdentificacao(cores, variante);
    for (const m of ORDEM_DAS_MODALIDADES) {
      const chave = COR_DA_MODALIDADE[m];
      const cor = chave ? identificacao[chave].cor : cores.textoSuave;
      for (const base of [cores.superficie, cores.sobre, cores.superficie2]) expect(contraste(cor, base)).toBeGreaterThanOrEqual(3);
    }
  });
});
