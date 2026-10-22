import type { Problema } from '../../api/tipos';
import { juntarProblemas, problemasDoExercicio, problemasDoGrupo } from './problemasDaSessao';

const p = (caminho: string, mensagem: string): Problema => ({ caminho, mensagem });

describe('problemas da sessão aberta', () => {
  it('junta as duas listas sem repetir o mesmo problema', () => {
    const local = [p('sessoes[0].nome', 'Sessão sem nome.')];
    const servidor = [p('sessoes[0].nome', 'Sessão sem nome.'), p('sessoes[0].tipo', 'Tipo de sessão inválido.')];
    expect(juntarProblemas(local, servidor)).toHaveLength(2);
  });
  it('o grupo recebe a mensagem do próprio caminho em `geral` e os campos pelo nome', () => {
    const lista = [
      p('sessoes[1].grupos[0]', 'Esse grupo precisa de pelo menos 3 exercícios.'),
      p('sessoes[1].grupos[0].voltas', 'Circuito: de 1 a 20 voltas.'),
      p('sessoes[1].grupos[1].descansoAposSegundos', 'Descanso depois do grupo entre 0 e 3600 segundos.'),
      p('sessoes[0].grupos[0].voltas', 'de outra sessão'),
    ];
    expect(problemasDoGrupo(lista, 1, 0)).toEqual({ geral: 'Esse grupo precisa de pelo menos 3 exercícios.', voltas: 'Circuito: de 1 a 20 voltas.' });
    expect(problemasDoGrupo(lista, 1, 1)).toEqual({ descansoAposSegundos: 'Descanso depois do grupo entre 0 e 3600 segundos.' });
    expect(problemasDoGrupo(lista, 1, 2)).toEqual({});
  });
  it('o exercício não leva os problemas das séries, que ficam nas séries', () => {
    const lista = [
      p('sessoes[0].exercicios[2].nome', 'Exercício sem nome.'),
      p('sessoes[0].exercicios[2].videoUrl', 'Link inválido.'),
      p('sessoes[0].exercicios[2].series[0].tipo', 'Série sem tipo.'),
      p('sessoes[0].exercicios[2].series', 'Exercício sem séries.'),
      p('sessoes[0].exercicios[12].nome', 'outro exercício'),
    ];
    expect(problemasDoExercicio(lista, 0, 2)).toEqual({ nome: 'Exercício sem nome.', videoUrl: 'Link inválido.' });
  });
  it('a primeira mensagem de cada campo vale', () => {
    const lista = [p('sessoes[0].exercicios[0].nome', 'primeira'), p('sessoes[0].exercicios[0].nome', 'segunda')];
    expect(problemasDoExercicio(lista, 0, 0).nome).toBe('primeira');
  });
});
