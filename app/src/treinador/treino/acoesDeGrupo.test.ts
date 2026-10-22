import type { Configuracao, ExercicioPlano, Sessao } from '../../api/tipos';
import { novoExercicio } from '../../dominio/editorTreino';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import {
  criarGrupoPronto,
  dicaDoGrupo,
  exercicioSolto,
  exigenciaDoGrupo,
  motivoParaCriarGrupo,
  motivoSemCandidatos,
  opcoesDeGrupo,
  vizinhosQuePodemEntrar,
} from './acoesDeGrupo';

const ex = (nome: string, grupoUid: string | null = null): ExercicioPlano => ({ ...novoExercicio(), uid: `ex-${nome}`, nome, grupoUid });
const sessaoCom = (nomes: string[], grupos: Sessao['grupos'] = [], grupoDe: Record<string, string> = {}): Pick<Sessao, 'exercicios' | 'grupos'> => ({
  exercicios: nomes.map((n) => ex(n, grupoDe[n] ?? null)),
  grupos,
});
const grupo = (uid: string, tecnica: Sessao['grupos'][number]['tecnica']): Sessao['grupos'][number] => ({ uid, tecnica, descansoAposSegundos: null, voltas: null });

describe('opções dos tipos de grupo', () => {
  it('são sete, com o nome da metodologia e o que cada um pede', () => {
    const opcoes = opcoesDeGrupo(CONFIGURACAO_PADRAO);
    expect(opcoes.map((o) => o.valor)).toEqual(['SUPERSET', 'AGONISTA_ANTAGONISTA', 'TRI_SET', 'GIANT_SET', 'CIRCUITO', 'PRE_EXAUSTAO', 'POS_EXAUSTAO']);
    expect(opcoes.map((o) => o.rotulo)).toContain('Pré-exaustão');
    expect(opcoes.find((o) => o.valor === 'TRI_SET')?.exigencia).toBe('de 3 a 6 exercícios');
    expect(opcoes.find((o) => o.valor === 'PRE_EXAUSTAO')?.exigencia).toBe('exatamente 2 exercícios');
  });
  it('usa o nome que a metodologia deu', () => {
    const config: Configuracao = { ...CONFIGURACAO_PADRAO, combinacoes: CONFIGURACAO_PADRAO.combinacoes.map((c) => (c.tipo === 'SUPERSET' ? { ...c, nome: 'Super-série' } : c)) };
    expect(opcoesDeGrupo(config).find((o) => o.valor === 'SUPERSET')?.rotulo).toBe('Super-série');
  });
  it('sem metodologia usa os nomes fixos', () => {
    expect(opcoesDeGrupo(null).find((o) => o.valor === 'CIRCUITO')?.rotulo).toBe('Circuito');
    expect(exigenciaDoGrupo('SUPERSET')).toBe('de 2 a 6 exercícios');
  });
});

describe('quem pode formar grupo', () => {
  it('exercício com marca de grupo que não existe mais conta como solto', () => {
    const s = sessaoCom(['a', 'b'], [grupo('g1', 'SUPERSET')], { a: 'g1', b: 'fantasma' });
    expect(exercicioSolto(s, 0)).toBe(false);
    expect(exercicioSolto(s, 1)).toBe(true);
    expect(exercicioSolto(s, 9)).toBe(false);
  });
  it('o botão "Criar grupo" explica por que está travado', () => {
    expect(motivoSemCandidatos(sessaoCom([]))).toMatch(/pelo menos 2 exercícios/);
    expect(motivoSemCandidatos(sessaoCom(['a']))).toMatch(/pelo menos 2 exercícios/);
    expect(motivoSemCandidatos(sessaoCom(['a', 'b']))).toBeNull();
    const dois = sessaoCom(['a', 'b', 'c'], [grupo('g1', 'SUPERSET')], { a: 'g1', b: 'g1' });
    expect(motivoSemCandidatos(dois)).toMatch(/soltos, um ao lado do outro/);
    const separados = sessaoCom(['a', 'b', 'c'], [grupo('g1', 'SUPERSET')], { b: 'g1' });
    expect(motivoSemCandidatos(separados)).toMatch(/soltos/);
  });
});

describe('motivo para não criar o grupo', () => {
  const s = sessaoCom(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  it('pede a seleção, a vizinhança e a quantidade da técnica', () => {
    expect(motivoParaCriarGrupo(s, [], 'SUPERSET', null)).toMatch(/Marque/);
    expect(motivoParaCriarGrupo(s, [0, 2], 'SUPERSET', null)).toMatch(/um ao lado do outro/);
    expect(motivoParaCriarGrupo(s, [0], 'SUPERSET', null)).toMatch(/pelo menos 2/);
    expect(motivoParaCriarGrupo(s, [0, 1], 'TRI_SET', null)).toMatch(/Tri-set precisa de pelo menos 3/);
    expect(motivoParaCriarGrupo(s, [0, 1, 2], 'PRE_EXAUSTAO', null)).toMatch(/Pré-exaustão tem exatamente 2/);
    expect(motivoParaCriarGrupo(s, [0, 1, 2, 3, 4, 5, 6], 'GIANT_SET', null)).toMatch(/até 6/);
  });
  it('o circuito pede as voltas, de 1 a 20', () => {
    expect(motivoParaCriarGrupo(s, [0, 1, 2], 'CIRCUITO', null)).toMatch(/voltas/);
    expect(motivoParaCriarGrupo(s, [0, 1, 2], 'CIRCUITO', 0)).toMatch(/de 1 a 20/);
    expect(motivoParaCriarGrupo(s, [0, 1, 2], 'CIRCUITO', 21)).toMatch(/de 1 a 20/);
    expect(motivoParaCriarGrupo(s, [0, 1, 2], 'CIRCUITO', 4)).toBeNull();
  });
  it('exercício que já está num grupo não entra em outro', () => {
    const com = sessaoCom(['a', 'b', 'c'], [grupo('g1', 'SUPERSET')], { a: 'g1', b: 'g1' });
    expect(motivoParaCriarGrupo(com, [1, 2], 'SUPERSET', null)).toMatch(/já está em outro grupo/);
  });
  it('liberado quando o grupo é válido', () => {
    expect(motivoParaCriarGrupo(s, [3, 4], 'AGONISTA_ANTAGONISTA', null)).toBeNull();
    expect(motivoParaCriarGrupo(s, [0, 1], 'POS_EXAUSTAO', null)).toBeNull();
  });
});

describe('criar o grupo', () => {
  it('cria com a técnica e marca os exercícios', () => {
    const s = sessaoCom(['a', 'b', 'c']);
    const r = criarGrupoPronto(s, [0, 1], 'SUPERSET', null, 'g1');
    expect(r.grupos).toEqual([{ uid: 'g1', tecnica: 'SUPERSET', descansoAposSegundos: null, voltas: null }]);
    expect(r.exercicios.map((e) => e.grupoUid)).toEqual(['g1', 'g1', null]);
  });
  it('o circuito já nasce com as voltas e os outros tipos não guardam voltas', () => {
    const s = sessaoCom(['a', 'b', 'c']);
    expect(criarGrupoPronto(s, [0, 1, 2], 'CIRCUITO', 3, 'g1').grupos[0].voltas).toBe(3);
    expect(criarGrupoPronto(s, [0, 1, 2], 'TRI_SET', 3, 'g1').grupos[0].voltas).toBeNull();
  });
  it('devolve a mesma sessão quando não dá', () => {
    const s = sessaoCom(['a', 'b', 'c']);
    expect(criarGrupoPronto(s, [0, 2], 'SUPERSET', null, 'g1')).toBe(s);
  });
});

describe('quem pode entrar num grupo', () => {
  it('o solto logo antes do primeiro e logo depois do último', () => {
    const s = sessaoCom(['a', 'b', 'c', 'd'], [grupo('g1', 'TRI_SET')], { b: 'g1', c: 'g1' });
    expect(vizinhosQuePodemEntrar(s, 'g1')).toEqual([
      { indice: 0, nome: 'a', lado: 'antes' },
      { indice: 3, nome: 'd', lado: 'depois' },
    ]);
  });
  it('vizinho que já é de outro grupo não entra', () => {
    const s = sessaoCom(['a', 'b', 'c', 'd'], [grupo('g1', 'TRI_SET'), grupo('g2', 'SUPERSET')], { a: 'g2', b: 'g1', c: 'g1', d: 'g2' });
    expect(vizinhosQuePodemEntrar(s, 'g1')).toEqual([]);
  });
  it('pré e pós-exaustão ficam em 2 e o grupo cheio não recebe mais', () => {
    const pre = sessaoCom(['a', 'b', 'c'], [grupo('g1', 'PRE_EXAUSTAO')], { a: 'g1', b: 'g1' });
    expect(vizinhosQuePodemEntrar(pre, 'g1')).toEqual([]);
    expect(dicaDoGrupo(pre, 'g1', 'PRE_EXAUSTAO')).toMatch(/exatamente 2/);
    const nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const cheio = sessaoCom(nomes, [grupo('g1', 'GIANT_SET')], Object.fromEntries(nomes.slice(0, 6).map((n) => [n, 'g1'])));
    expect(vizinhosQuePodemEntrar(cheio, 'g1')).toEqual([]);
    expect(dicaDoGrupo(cheio, 'g1', 'GIANT_SET')).toMatch(/máximo/);
  });
  it('grupo inexistente não tem vizinho', () => {
    expect(vizinhosQuePodemEntrar(sessaoCom(['a', 'b']), 'nao-existe')).toEqual([]);
  });
  it('exercício sem nome aparece como "Exercício sem nome"', () => {
    const s = sessaoCom(['a', ' ', 'c'], [grupo('g1', 'SUPERSET')], { c: 'g1' });
    s.exercicios[1] = { ...s.exercicios[1], nome: ' ' };
    expect(vizinhosQuePodemEntrar(s, 'g1')[0].nome).toBe('Exercício sem nome');
  });
});
