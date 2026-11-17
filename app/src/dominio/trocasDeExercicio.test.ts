import type { TrocaDeExercicio } from '../api/tipos';
import {
  chaveDaTroca, comVisto, descricaoDasTrocas, idDaTroca, metadadosDaTroca, rotulosDoVisto, seloDaTroca, textoDaTroca,
} from './trocasDeExercicio';

const troca = (extra: Partial<TrocaDeExercicio> = {}): TrocaDeExercicio => ({
  data: '2026-10-18', planoVersaoId: 'v1', sessaoUid: 's1', sessao: 'Treino A', exercicioUid: 'x1',
  principal: { exercicioId: 'e1', nome: 'Supino reto' }, alternativa: { exercicioId: 'e2', nome: 'Supino com halteres' },
  series: 3, vistoEm: null, ...extra,
});

describe('trocas de exercício', () => {
  it('a chave do visto é a do servidor: data, versão, exercício do plano e a alternativa feita', () => {
    expect(chaveDaTroca(troca())).toEqual({ data: '2026-10-18', planoVersaoId: 'v1', exercicioUid: 'x1', alternativaId: 'e2' });
    expect(idDaTroca(troca())).not.toBe(idDaTroca(troca({ alternativa: { exercicioId: 'e3', nome: 'Crucifixo' } })));
    expect(idDaTroca(troca())).not.toBe(idDaTroca(troca({ planoVersaoId: 'v2' })));
  });

  it('texto e metadados: só nomes; nome ausente vira "—"; sessão e séries opcionais', () => {
    expect(textoDaTroca(troca())).toBe('Supino reto trocado por Supino com halteres');
    expect(textoDaTroca(troca({ principal: { exercicioId: 'e1', nome: '  ' } }))).toBe('— trocado por Supino com halteres');
    expect(metadadosDaTroca(troca(), '2026-10-19')).toBe('Treino A · ontem · 3 séries');
    expect(metadadosDaTroca(troca({ sessao: null, series: 1 }), '2026-10-19')).toBe('ontem · 1 série');
  });

  it('selo: visto é neutro; não visto é âmbar só para quem pode marcar', () => {
    expect(seloDaTroca(troca({ vistoEm: '2026-10-19T10:00:00Z' }), true)).toEqual({ texto: 'Visto', tipo: 'neutro' });
    expect(seloDaTroca(troca(), true)).toEqual({ texto: 'Para ver', tipo: 'atencao' });
    expect(seloDaTroca(troca(), false)).toEqual({ texto: 'Não vista', tipo: 'neutro' });
  });

  it('rótulos acessíveis começam pelo texto do botão e dizem qual troca', () => {
    const r = rotulosDoVisto(troca(), '2026-10-19');
    expect(r.marcar).toBe('Marcar como visto: Supino reto trocado por Supino com halteres, ontem');
    expect(r.desfazer).toMatch(/^Desfazer o visto: Supino reto/);
  });

  it('descrição conta as que faltam ver', () => {
    const lista = [troca(), troca({ exercicioUid: 'x2' }), troca({ exercicioUid: 'x3', vistoEm: '2026-10-19T10:00:00Z' })];
    expect(descricaoDasTrocas(lista, true)).toBe('Últimos 7 dias · 2 para ver');
    expect(descricaoDasTrocas(lista.slice(0, 1), false)).toBe('Últimos 7 dias · 1 não vista');
    expect(descricaoDasTrocas(lista.slice(2), true)).toBe('Últimos 7 dias · todas vistas');
  });

  it('comVisto muda só a troca do id', () => {
    const dados = { de: '2026-10-13', ate: '2026-10-19', trocas: [troca(), troca({ exercicioUid: 'x2' })] };
    const novo = comVisto(dados, idDaTroca(dados.trocas[1]), '2026-10-19T10:00:00Z');
    expect(novo.trocas.map((t) => t.vistoEm)).toEqual([null, '2026-10-19T10:00:00Z']);
    expect(dados.trocas[1].vistoEm).toBeNull();
  });
});
