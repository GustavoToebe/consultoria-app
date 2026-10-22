import type { Configuracao, ExercicioPlano, Grupo } from '../api/tipos';
import {
  alterarGrupoDaSessao,
  criarGrupo,
  desfazerGrupo,
  gruposDaSessao,
  juntarAoGrupo,
  juntarComAnterior,
  limparGrupos,
  MAXIMO_POR_GRUPO,
  moverExercicio,
  moverGrupoDeExercicios,
  posicaoNoGrupo,
  removerExercicio,
  textoDaFaixa,
  tirarDoGrupo,
  type ExerciciosEGrupos,
} from './combinacoes';
import { exercicio, grupo, sessao } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContador}` }));

const ex = (nome: string, grupoUid: string | null = null): ExercicioPlano => exercicio(nome, { nome, grupoUid });
const nomes = (s: ExerciciosEGrupos) => s.exercicios.map((e) => e.nome);
const marcas = (s: ExerciciosEGrupos) => s.exercicios.map((e) => e.grupoUid);

/** Sessão fictícia: Supino + Remada (superset g1), Agachamento solto, Rosca + Tríceps + Elevação (tri-set g2). */
function exemplo(): ExerciciosEGrupos {
  return {
    exercicios: [ex('Supino', 'g1'), ex('Remada', 'g1'), ex('Agachamento'), ex('Rosca', 'g2'), ex('Tríceps', 'g2'), ex('Elevação', 'g2')],
    grupos: [grupo('g1', 'SUPERSET'), grupo('g2', 'TRI_SET')],
  };
}

describe('grupos de exercícios da sessão', () => {
  it('trechos na ordem: grupos pelo nome da técnica, soltos sozinhos', () => {
    const trechos = gruposDaSessao(exemplo());
    expect(trechos.map((g) => [g.inicio, g.exercicios.map((e) => e.nome), g.nome])).toEqual([
      [0, ['Supino', 'Remada'], 'Superset'],
      [2, ['Agachamento'], null],
      [3, ['Rosca', 'Tríceps', 'Elevação'], 'Tri-set'],
    ]);
  });

  it('o nome vem da metodologia quando ela renomeia a combinação', () => {
    const renomeada: Configuracao = {
      ...CONFIGURACAO_PADRAO,
      combinacoes: CONFIGURACAO_PADRAO.combinacoes.map((c) => (c.tipo === 'SUPERSET' ? { ...c, nome: 'Bi-set' } : c)),
    };
    expect(gruposDaSessao(exemplo(), renomeada)[0].nome).toBe('Bi-set');
  });

  it('marca de grupo que não existe na sessão é ignorada, e sessão sem a lista de grupos funciona', () => {
    const s = { exercicios: [ex('A', 'fantasma'), ex('B', 'fantasma')], grupos: [] };
    expect(gruposDaSessao(s).map((g) => g.exercicios.length)).toEqual([1, 1]);
    expect(gruposDaSessao({ exercicios: [ex('A')] }).map((g) => g.nome)).toEqual([null]);
  });

  it('posição e faixa do aluno', () => {
    const s = exemplo();
    const primeiro = posicaoNoGrupo(s, 3)!;
    expect(textoDaFaixa(primeiro, true)).toBe('Tri-set 1 de 3 · em seguida: Tríceps');
    const ultimo = posicaoNoGrupo(s, 5)!;
    expect(textoDaFaixa(ultimo, true)).toBe('Tri-set 3 de 3 · volte para Rosca e repita');
    expect(textoDaFaixa(ultimo, false)).toBe('Tri-set 3 de 3');
    expect(posicaoNoGrupo(s, 2)).toBeNull();
  });

  it('circuito diz as voltas, e pré-exaustão deixa o descanso para cada série', () => {
    const s: ExerciciosEGrupos = {
      exercicios: [ex('A', 'c'), ex('B', 'c'), ex('C', 'c'), ex('D', 'p'), ex('E', 'p')],
      grupos: [grupo('c', 'CIRCUITO', { voltas: 3, descansoAposSegundos: 60 }), grupo('p', 'PRE_EXAUSTAO', { descansoAposSegundos: 90 })],
    };
    expect(posicaoNoGrupo(s, 0)).toMatchObject({ voltas: 3, descansoAposSegundos: 60, descansoPorSerie: false });
    expect(posicaoNoGrupo(s, 3)).toMatchObject({ voltas: null, descansoAposSegundos: null, descansoPorSerie: true });
  });
});

describe('criar e desfazer grupo', () => {
  const lista = (): ExerciciosEGrupos => ({ exercicios: [ex('1'), ex('2'), ex('3'), ex('4')], grupos: [] });

  it('cria com exercícios seguidos e soltos, na técnica pedida, sem descanso nem voltas', () => {
    const r = criarGrupo(lista(), [1, 2], 'TRI_SET', 'novo');
    expect(marcas(r)).toEqual([null, 'novo', 'novo', null]);
    expect(r.grupos).toEqual([{ uid: 'novo', tecnica: 'TRI_SET', descansoAposSegundos: null, voltas: null }]);
  });

  it('recusa menos de 2, mais de 6, não seguidos, fora da lista ou já agrupados', () => {
    const l = lista();
    expect(criarGrupo(l, [1], 'SUPERSET')).toBe(l);
    expect(criarGrupo(l, [0, 2], 'SUPERSET')).toBe(l);
    expect(criarGrupo(l, [3, 4], 'SUPERSET')).toBe(l);
    const sete = { exercicios: Array.from({ length: 7 }, (_, i) => ex(String(i))), grupos: [] };
    expect(criarGrupo(sete, [0, 1, 2, 3, 4, 5, 6], 'CIRCUITO')).toBe(sete);
    expect(criarGrupo(sete, [0, 1, 2, 3, 4, 5], 'CIRCUITO').grupos).toHaveLength(1);
    const ja = exemplo();
    expect(criarGrupo(ja, [1, 2], 'SUPERSET')).toBe(ja);
  });

  it('desfazer solta os membros sem mexer na ordem; grupo inexistente não muda nada', () => {
    const r = desfazerGrupo(exemplo(), 'g2');
    expect(marcas(r)).toEqual(['g1', 'g1', null, null, null, null]);
    expect(r.grupos.map((g) => g.uid)).toEqual(['g1']);
    const s = exemplo();
    expect(desfazerGrupo(s, 'nada')).toBe(s);
  });

  it(`até ${MAXIMO_POR_GRUPO} exercícios por grupo`, () => {
    expect(MAXIMO_POR_GRUPO).toBe(6);
  });
});

describe('juntar ao anterior e ao grupo', () => {
  it('cria grupo de 2 com a técnica dada, ou entra no grupo do anterior', () => {
    const solto: ExerciciosEGrupos = { exercicios: [ex('A'), ex('B'), ex('C')], grupos: [] };
    const dois = juntarComAnterior(solto, 1, 'AGONISTA_ANTAGONISTA');
    expect(dois.grupos.map((g) => g.tecnica)).toEqual(['AGONISTA_ANTAGONISTA']);
    const gid = dois.grupos[0].uid;
    expect(marcas(dois)).toEqual([gid, gid, null]);
    // Grupo de agonista-antagonista aceita mais um membro; pré e pós-exaustão não.
    expect(marcas(juntarComAnterior(dois, 2))).toEqual([gid, gid, gid]);
    const pre = juntarComAnterior(solto, 1, 'PRE_EXAUSTAO');
    expect(juntarComAnterior(pre, 2)).toBe(pre);
  });

  it('o primeiro da sessão, o já agrupado e o índice fora não mudam nada', () => {
    const s = exemplo();
    expect(juntarComAnterior(s, 0)).toBe(s);
    expect(juntarComAnterior(s, 1)).toBe(s);
    expect(juntarComAnterior(s, 99)).toBe(s);
  });

  it('só entra no grupo o exercício solto ao lado dele, e o grupo cheio recusa', () => {
    const s = exemplo();
    expect(marcas(juntarAoGrupo(s, 2, 'g1'))).toEqual(['g1', 'g1', 'g1', 'g2', 'g2', 'g2']);
    expect(marcas(juntarAoGrupo(s, 2, 'g2'))).toEqual(['g1', 'g1', 'g2', 'g2', 'g2', 'g2']);
    const longe: ExerciciosEGrupos = { exercicios: [ex('A', 'g'), ex('B', 'g'), ex('X'), ex('Y')], grupos: [grupo('g', 'SUPERSET')] };
    expect(juntarAoGrupo(longe, 3, 'g')).toBe(longe);
    const cheio: ExerciciosEGrupos = {
      exercicios: [...Array.from({ length: 6 }, (_, i) => ex(`m${i}`, 'g')), ex('X')],
      grupos: [grupo('g', 'CIRCUITO', { voltas: 2 })],
    };
    expect(juntarAoGrupo(cheio, 6, 'g')).toBe(cheio);
  });
});

describe('tirar do grupo', () => {
  it('na ponta o exercício fica onde está; no meio vai para depois do grupo; abaixo do mínimo, o grupo some', () => {
    const s = exemplo();
    const ponta = tirarDoGrupo(s, 5);
    expect(nomes(ponta)).toEqual(nomes(s));
    // Tri-set com 3 que perde 1 fica com 2, abaixo do mínimo de 3: desfeito (nunca vira superset sozinho).
    expect(ponta.grupos.map((g) => g.uid)).toEqual(['g1']);
    expect(marcas(ponta)).toEqual(['g1', 'g1', null, null, null, null]);

    const quatro: ExerciciosEGrupos = { exercicios: [ex('A', 'g'), ex('B', 'g'), ex('C', 'g'), ex('D', 'g'), ex('E')], grupos: [grupo('g', 'GIANT_SET')] };
    const meio = tirarDoGrupo(quatro, 1);
    expect(nomes(meio)).toEqual(['A', 'C', 'D', 'B', 'E']);
    expect(marcas(meio)).toEqual([null, null, null, null, null]);
    expect(meio.grupos).toEqual([]);
  });

  it('exercício solto não muda nada', () => {
    const s = exemplo();
    expect(tirarDoGrupo(s, 2)).toBe(s);
  });
});

describe('alterar o grupo', () => {
  it('pré e pós-exaustão zeram o descanso depois do grupo; as voltas só valem no circuito', () => {
    const s: ExerciciosEGrupos = { exercicios: [ex('A', 'g'), ex('B', 'g'), ex('C', 'g')], grupos: [grupo('g', 'CIRCUITO', { voltas: 4, descansoAposSegundos: 60 })] };
    const tri = alterarGrupoDaSessao(s, 'g', { tecnica: 'TRI_SET' });
    expect(tri.grupos[0]).toMatchObject({ tecnica: 'TRI_SET', voltas: null, descansoAposSegundos: 60 });
    const pre = alterarGrupoDaSessao(tri, 'g', { tecnica: 'PRE_EXAUSTAO' });
    expect(pre.grupos[0]).toMatchObject({ descansoAposSegundos: null, voltas: null });
    const circuito = alterarGrupoDaSessao(tri, 'g', { tecnica: 'CIRCUITO', voltas: 5 });
    expect(circuito.grupos[0].voltas).toBe(5);
    expect(alterarGrupoDaSessao(s, 'nada', { voltas: 2 })).toBe(s);
  });

  it('o descanso por série dos exercícios nunca é tocado', () => {
    const comSerie = { ...ex('A', 'g'), series: [{ uid: 's', tipo: 'WORKING', repsMin: 6, repsMax: 6, carga: null, esforco: null, descansoSegundos: 90 }] };
    const s: ExerciciosEGrupos = { exercicios: [comSerie, ex('B', 'g')], grupos: [grupo('g', 'SUPERSET', { descansoAposSegundos: 30 })] };
    const r = alterarGrupoDaSessao(s, 'g', { tecnica: 'PRE_EXAUSTAO' });
    expect(r.exercicios[0].series[0].descansoSegundos).toBe(90);
  });
});

describe('mover e remover exercícios', () => {
  it('exercício solto passa por cima do grupo vizinho inteiro', () => {
    const s = exemplo();
    expect(nomes(moverExercicio(s, 2, -1))).toEqual(['Agachamento', 'Supino', 'Remada', 'Rosca', 'Tríceps', 'Elevação']);
    expect(nomes(moverExercicio(s, 2, 1))).toEqual(['Supino', 'Remada', 'Rosca', 'Tríceps', 'Elevação', 'Agachamento']);
  });

  it('membro troca de lugar com o vizinho do grupo', () => {
    const r = moverExercicio(exemplo(), 4, 1);
    expect(nomes(r)).toEqual(['Supino', 'Remada', 'Agachamento', 'Rosca', 'Elevação', 'Tríceps']);
    expect(marcas(r)).toEqual(['g1', 'g1', null, 'g2', 'g2', 'g2']);
  });

  it('na borda do grupo o membro sai e se move como solto; o grupo abaixo do mínimo é desfeito', () => {
    const r = moverExercicio(exemplo(), 3, -1);
    expect(nomes(r)).toEqual(['Supino', 'Remada', 'Rosca', 'Agachamento', 'Tríceps', 'Elevação']);
    expect(marcas(r)).toEqual(['g1', 'g1', null, null, null, null]);
    expect(r.grupos.map((g) => g.uid)).toEqual(['g1']);
  });

  it('fora da lista não muda nada', () => {
    const s = exemplo();
    expect(moverExercicio(s, 0, -1)).toBe(s);
    expect(moverExercicio(s, 5, 1)).toBe(s);
  });

  it('o grupo anda como um bloco', () => {
    const s = exemplo();
    expect(nomes(moverGrupoDeExercicios(s, 'g2', -1))).toEqual(['Supino', 'Remada', 'Rosca', 'Tríceps', 'Elevação', 'Agachamento']);
    expect(moverGrupoDeExercicios(s, 'g1', -1)).toBe(s);
    expect(moverGrupoDeExercicios(s, 'nada', 1)).toBe(s);
  });

  it('remover um membro desfaz o grupo que cai abaixo do mínimo, e remover um solto não mexe nos grupos', () => {
    const s = exemplo();
    const semMembro = removerExercicio(s, 4);
    expect(semMembro.grupos.map((g) => g.uid)).toEqual(['g1']);
    expect(marcas(semMembro)).toEqual(['g1', 'g1', null, null, null]);
    const semSolto = removerExercicio(s, 2);
    expect(semSolto.grupos).toHaveLength(2);
    expect(removerExercicio(s, 99)).toBe(s);
  });

  it('a sessão inteira acompanha: grupos e exercícios saem juntos pelo mesmo caminho', () => {
    const sessaoDeTeste = sessao('s', exemplo().exercicios, exemplo().grupos);
    const r = removerExercicio(sessaoDeTeste, 0);
    expect({ ...sessaoDeTeste, ...r }.grupos.map((g: Grupo) => g.uid)).toEqual(['g2']);
  });
});

describe('limpar grupos', () => {
  it('tira a marca de grupo que não existe e o grupo sem exercício', () => {
    const s: ExerciciosEGrupos = { exercicios: [ex('A', 'fantasma'), ex('B', 'g1'), ex('C', 'g1')], grupos: [grupo('g1', 'SUPERSET'), grupo('vazio', 'TRI_SET')] };
    const r = limparGrupos(s);
    expect(marcas(r)).toEqual([null, 'g1', 'g1']);
    expect(r.grupos.map((g) => g.uid)).toEqual(['g1']);
  });
});
