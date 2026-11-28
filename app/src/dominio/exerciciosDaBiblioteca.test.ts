import type { Exercicio } from '../api/tipos';
import { coresComBordasReforcadas, coresComContraste } from './preferencias';
import { CHAVES_DE_IDENTIFICACAO, PALETAS, contraste, coresDeIdentificacao, type Cores, type VarianteDoTema } from '../tema/tokens';
import {
  coincideComABusca,
  contagemDosGrupos,
  contagemDosTipos,
  passaNosFiltros,
  rotuloDoMostrar,
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

  test('cardio: o tipo no lugar do grupo ("● Cardio · Escada"); o antigo sem tipo mostra o equipamento, nunca o grupo "Cardio"', () => {
    expect(detalheDoExercicio(ex({ modalidade: 'CARDIO', grupoMuscular: null, tipoDeCardio: 'ESCADA' }))).toBe('Escada');
    expect(detalheDoExercicio(ex({ modalidade: 'CARDIO', grupoMuscular: 'Cardio', equipamento: 'Esteira', tipoDeCardio: null }))).toBe('Esteira');
    expect(detalheDoExercicio(ex({ modalidade: 'CARDIO', grupoMuscular: 'Cardio', equipamento: null }))).toBe('');
    // O catálogo não traz o tipo: o mesmo caminho do antigo.
    expect(detalheDoExercicio({ modalidade: 'CARDIO', grupoMuscular: 'Cardio', equipamento: 'Bicicleta' })).toBe('Bicicleta');
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
    const f = { grupos: new Set(['Costas']), modalidades: new Set(['CARDIO', 'MAQUINA']), video: 'SEM' as const, imagem: 'COM' as const, tiposDeCardio: new Set(['BIKE', 'ESTEIRA']) };
    expect(chipsDosExercicios(f, [{ valor: 'Costas', rotulo: 'Costas' }])).toEqual([
      { chave: 'grupos', texto: 'Grupo muscular: Costas' },
      { chave: 'tiposDeCardio', texto: 'Tipo de cardio: Esteira, Bike' },
      { chave: 'modalidades', texto: 'Modalidade: Máquina, Cardio' },
      { chave: 'video', texto: 'Vídeo: Sem vídeo' },
      { chave: 'imagem', texto: 'Imagem: Com imagem' },
    ]);
    const sem = semOFiltro(f, 'video');
    expect(sem.video).toBe('TODOS');
    expect(sem.imagem).toBe('COM');
    expect(semOFiltro(f, 'outra')).toBe(f);
    expect(semOFiltro(f, 'tiposDeCardio').tiposDeCardio.size).toBe(0);
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

describe('filtros da folha e do painel (passaNosFiltros, mesma regra da API)', () => {
  const comVideo = ex({ id: 'v', videoUrl: 'https://youtu.be/x', grupoMuscular: ' Peito ' });
  const comImagem = ex({ id: 'i', imagens: ['a.jpg'], modalidade: 'LIVRE' });
  const semGrupo = ex({ id: 's', grupoMuscular: null, modalidade: 'CARDIO' });
  it('sem filtro passa tudo', () => {
    for (const e of [comVideo, comImagem, semGrupo]) expect(passaNosFiltros(e, SEM_FILTROS_DE_EXERCICIOS)).toBe(true);
  });
  it('grupos em OU (sem espaço nas pontas), modalidades em OU, vídeo e imagem; tudo em E', () => {
    const f = { ...SEM_FILTROS_DE_EXERCICIOS, grupos: new Set(['Peito', 'Costas']) };
    expect([comVideo, comImagem, semGrupo].filter((e) => passaNosFiltros(e, f)).map((e) => e.id)).toEqual(['v', 'i']);
    expect(passaNosFiltros(comImagem, { ...f, modalidades: new Set(['MAQUINA']) })).toBe(false);
    expect(passaNosFiltros(comVideo, { ...f, video: 'COM' })).toBe(true);
    expect(passaNosFiltros(comVideo, { ...f, video: 'SEM' })).toBe(false);
    expect(passaNosFiltros(comImagem, { ...f, imagem: 'COM' })).toBe(true);
    expect(passaNosFiltros(comVideo, { ...f, imagem: 'COM' })).toBe(false);
    expect(passaNosFiltros(ex({ imagemPropriaEm: '2026-11-27T10:00:00Z' }), { ...SEM_FILTROS_DE_EXERCICIOS, imagem: 'SEM' })).toBe(false);
  });
  it('tipos de cardio em OU; cardio sem tipo não passa quando há tipo escolhido', () => {
    const f = { ...SEM_FILTROS_DE_EXERCICIOS, tiposDeCardio: new Set(['ESCADA', 'BIKE']) };
    expect(passaNosFiltros(ex({ modalidade: 'CARDIO', tipoDeCardio: 'ESCADA' }), f)).toBe(true);
    expect(passaNosFiltros(ex({ modalidade: 'CARDIO', tipoDeCardio: 'REMO' }), f)).toBe(false);
    expect(passaNosFiltros(ex({ modalidade: 'CARDIO', tipoDeCardio: null }), f)).toBe(false);
  });
  it('busca: nome, grupo e equipamento, sem acento e sem caixa', () => {
    const e = ex({ nome: 'Rosca Direta', grupoMuscular: 'Bíceps', equipamento: 'Barra W' });
    for (const t of ['rosca', 'BICEPS', ' barra w ', '']) expect(coincideComABusca(e, t)).toBe(true);
    expect(coincideComABusca(e, 'supino')).toBe(false);
    // O cardio novo não tem grupo nem equipamento: na folha (comTipo) o tipo entra na busca; na Biblioteca, não (o servidor não procura por ele).
    const subida = ex({ nome: 'Subida', grupoMuscular: null, modalidade: 'CARDIO', tipoDeCardio: 'ESCADA' });
    expect(coincideComABusca(subida, 'escada', true)).toBe(true);
    expect(coincideComABusca(subida, 'escada')).toBe(false);
    expect(coincideComABusca(ex({ nome: 'Subida', grupoMuscular: null, modalidade: 'CARDIO', tipoDeCardio: 'ELIPTICO' }), 'eliptico', true)).toBe(true);
  });
});

describe('tipos de cardio do painel', () => {
  it('contagem na ordem da Biblioteca, sem o cardio sem tipo', () => {
    const lista = [ex({ tipoDeCardio: 'ESCADA' }), ex({ tipoDeCardio: 'ESTEIRA' }), ex({ tipoDeCardio: 'ESCADA' }), ex({ tipoDeCardio: null }), ex({})];
    expect(contagemDosTipos(lista)).toEqual([
      { valor: 'ESTEIRA', rotulo: 'Esteira', contagem: 1 },
      { valor: 'ESCADA', rotulo: 'Escada', contagem: 2 },
    ]);
    expect(contagemDosTipos([ex({ tipoDeCardio: null })])).toEqual([]);
  });
});

describe('grupos do painel', () => {
  it('contagem por grupo em ordem alfabética do português, sem o vazio, juntando espaços nas pontas', () => {
    const lista = [ex({ grupoMuscular: 'Peito' }), ex({ grupoMuscular: ' Peito' }), ex({ grupoMuscular: 'Abdômen' }), ex({ grupoMuscular: 'Ombros' }), ex({ grupoMuscular: null }), ex({ grupoMuscular: '  ' })];
    expect(contagemDosGrupos(lista)).toEqual([
      { valor: 'Abdômen', rotulo: 'Abdômen', contagem: 1 },
      { valor: 'Ombros', rotulo: 'Ombros', contagem: 1 },
      { valor: 'Peito', rotulo: 'Peito', contagem: 2 },
    ]);
  });
  it('"Mostrar N exercícios" no singular, no plural, com milhar e sem número enquanto não conta', () => {
    expect(rotuloDoMostrar(1)).toBe('Mostrar 1 exercício');
    expect(rotuloDoMostrar(0)).toBe('Mostrar 0 exercícios');
    expect(rotuloDoMostrar(1234)).toBe('Mostrar 1.234 exercícios');
    expect(rotuloDoMostrar(null)).toBe('Mostrar exercícios');
    expect(rotuloDoMostrar(1, true)).toBe('Mostrar 1 cardio');
    expect(rotuloDoMostrar(3, true)).toBe('Mostrar 3 cardios');
  });
});
