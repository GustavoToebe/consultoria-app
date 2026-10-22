import type { ExercicioPlano } from '../api/tipos';
import { posicaoNoGrupo } from './combinacoes';
import { exercicio, grupo } from './exemplosDeTreino.apoioTeste';
import { vezNoGrupo } from './vezNoGrupo';

const ex = (nome: string, grupoUid: string | null = null): ExercicioPlano => exercicio(nome, { nome, grupoUid });

describe('vez no grupo', () => {
  const sessao = { exercicios: [ex('Sozinho'), ex('Puxada', 'g'), ex('Remada', 'g'), ex('Rosca', 'g')], grupos: [grupo('g', 'TRI_SET')] };
  const pendentes = new Set(['Puxada', 'Remada', 'Rosca']);
  const pendente = (e: ExercicioPlano) => pendentes.has(e.nome);

  it('vai para o seguinte do grupo e, no último, volta ao primeiro com série por fazer', () => {
    expect(vezNoGrupo(posicaoNoGrupo(sessao, 1), pendente)?.nome).toBe('Remada');
    expect(vezNoGrupo(posicaoNoGrupo(sessao, 3), pendente)?.nome).toBe('Puxada');
  });

  it('pula quem já terminou e devolve nulo com o grupo feito ou exercício sozinho', () => {
    expect(vezNoGrupo(posicaoNoGrupo(sessao, 3), (e) => e.nome === 'Remada')?.nome).toBe('Remada');
    expect(vezNoGrupo(posicaoNoGrupo(sessao, 2), () => false)).toBeNull();
    expect(vezNoGrupo(posicaoNoGrupo(sessao, 0), pendente)).toBeNull();
  });
});
