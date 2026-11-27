import type { PlanoResumo } from '../api/tipos';
import { linhaDoPlano } from './linhaDoPlano';

const BASE: PlanoResumo = {
  id: 'p1', alunoId: 'a1', pastaId: 'f1', titulo: 'Treino', inicio: null, fim: null, ativo: false, versaoPublicada: 0,
  publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};
const HOJE = '2026-11-27';
const EM = '2026-11-20T12:00:00Z';

describe('linha do plano na Folha da pasta', () => {
  it('1) agendado vence tudo: selo com a data e a versão que o aluno vê até lá', () => {
    const p = { ...BASE, ativo: true, versaoPublicada: 4, publicadoEm: EM, rascunhoAlteradoDepoisDePublicar: true, liberarEm: '2026-12-01', versaoLiberada: 3 };
    expect(linhaDoPlano(p, HOJE)).toEqual({
      selo: { texto: 'Agendado para 01/12', tipo: 'neutro', agendado: true },
      meta: 'Publicado v4 · o aluno vê a v3 até lá',
      discreto: false,
    });
  });

  it('1) agendado sem versão liberada (0 ou ausente): só a versão publicada', () => {
    const p = { ...BASE, versaoPublicada: 1, publicadoEm: EM, liberarEm: '2026-12-01' };
    expect(linhaDoPlano({ ...p, versaoLiberada: 0 }, HOJE).meta).toBe('Publicado v1');
    expect(linhaDoPlano(p, HOJE).meta).toBe('Publicado v1');
  });

  it('2) alterações não publicadas: diz se está em uso', () => {
    const p = { ...BASE, versaoPublicada: 3, publicadoEm: EM, rascunhoAlteradoDepoisDePublicar: true };
    expect(linhaDoPlano({ ...p, ativo: true }, HOJE)).toEqual({
      selo: { texto: 'Alterações não publicadas', tipo: 'neutro', agendado: false },
      meta: 'Em uso pelo aluno · Publicado v3 em 20/11',
      discreto: false,
    });
    expect(linhaDoPlano(p, HOJE).meta).toBe('Publicado v3 em 20/11');
  });

  it('3) rascunho nunca publicado: selo neutro, sem meta, discreto (mesmo com o rascunho marcado como alterado)', () => {
    const rascunho = { selo: { texto: 'Rascunho', tipo: 'neutro', agendado: false }, meta: null, discreto: true };
    expect(linhaDoPlano(BASE, HOJE)).toEqual(rascunho);
    expect(linhaDoPlano({ ...BASE, rascunhoAlteradoDepoisDePublicar: true }, HOJE)).toEqual(rascunho);
  });

  it('4) em uso: o único selo verde', () => {
    expect(linhaDoPlano({ ...BASE, ativo: true, versaoPublicada: 3, publicadoEm: EM }, HOJE)).toEqual({
      selo: { texto: 'Em uso pelo aluno', tipo: 'sucesso', agendado: false },
      meta: 'Publicado v3 em 20/11',
      discreto: false,
    });
  });

  it('5) publicado fora de uso: sem selo, a meta diz que não está em uso', () => {
    expect(linhaDoPlano({ ...BASE, versaoPublicada: 2, publicadoEm: '2026-10-10T12:00:00Z' }, HOJE)).toEqual({
      selo: null, meta: 'Publicado v2 em 10/10 · não está em uso', discreto: false,
    });
  });

  it('publicadoEm nulo: meta sem a data; outro ano leva o ano', () => {
    expect(linhaDoPlano({ ...BASE, ativo: true, versaoPublicada: 3 }, HOJE).meta).toBe('Publicado v3');
    expect(linhaDoPlano({ ...BASE, versaoPublicada: 2 }, HOJE).meta).toBe('Publicado v2 · não está em uso');
    expect(linhaDoPlano({ ...BASE, ativo: true, versaoPublicada: 1, publicadoEm: '2025-03-04T12:00:00Z' }, HOJE).meta).toBe('Publicado v1 em 04/03/2025');
  });
});
