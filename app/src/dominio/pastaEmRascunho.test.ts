import type { PlanoResumo } from '../api/tipos';
import { pastaSoComRascunho } from './pastaEmRascunho';

const plano = (versaoPublicada: number): PlanoResumo => ({
  id: `p${versaoPublicada}`, alunoId: 'a', pastaId: 'x', titulo: 'Plano fictício', inicio: null, fim: null, ativo: false,
  versaoPublicada, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
});

describe('pastaSoComRascunho', () => {
  it('planos que nunca foram publicados: rascunho', () => {
    expect(pastaSoComRascunho({ treino: [plano(0)], dieta: [plano(0)], mobilidade: [] })).toBe(true);
  });

  it('algum plano publicado: não é rascunho', () => {
    expect(pastaSoComRascunho({ treino: [plano(0)], dieta: [plano(2)], mobilidade: [] })).toBe(false);
  });

  it('pasta sem plano nenhum: não é rascunho', () => {
    expect(pastaSoComRascunho({ treino: [], dieta: [], mobilidade: [] })).toBe(false);
  });

  it('lista desconhecida (falhou, carregando ou sem permissão): nunca afirma rascunho', () => {
    expect(pastaSoComRascunho({ treino: [plano(0)], dieta: null, mobilidade: [] })).toBe(false);
  });
});
