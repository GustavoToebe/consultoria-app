import { gruposDaSessao } from './combinacoes';
import { exercicio, grupo, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { detalheDoBloco, descansoSoDoGrupo, ordemDoGrupo, textoDasVoltas, textoDoDescansoDoGrupo } from './textoDoGrupo';

const doisEmGrupo = (tecnica: Parameters<typeof grupo>[1], extra: Parameters<typeof grupo>[2] = {}) =>
  gruposDaSessao(
    sessao(
      's',
      [
        exercicio('a', { nome: 'Supino reto', grupoUid: 'g', series: [serie('a1')] }),
        exercicio('b', { nome: 'Crucifixo', grupoUid: 'g', series: [serie('b1')] }),
        exercicio('c', { nome: 'Rosca direta', series: [serie('c1')] }),
      ],
      [grupo('g', tecnica, extra)],
    ),
  );

describe('texto dos grupos de exercícios', () => {
  it('ordem do grupo lista os nomes em seta e numera o exercício sem nome', () => {
    expect(ordemDoGrupo([{ nome: 'Supino' }, { nome: ' ' }, { nome: 'Remada' }])).toBe('Supino → exercício 2 → Remada');
  });

  it('voltas no singular e no plural; vazio sem voltas', () => {
    expect(textoDasVoltas(1)).toBe('1 volta');
    expect(textoDasVoltas(3)).toBe('3 voltas');
    expect(textoDasVoltas(null)).toBe('');
    expect(textoDasVoltas(0)).toBe('');
  });

  it('descanso do grupo: depois da volta, sem descanso, vazio e pré/pós-exaustão', () => {
    expect(textoDoDescansoDoGrupo({ tecnica: 'SUPERSET', descansoAposSegundos: 90 })).toBe('descanso de 1 min 30 s depois de cada volta do grupo');
    expect(textoDoDescansoDoGrupo({ tecnica: 'SUPERSET', descansoAposSegundos: 0 })).toBe('sem descanso depois do grupo');
    expect(textoDoDescansoDoGrupo({ tecnica: 'SUPERSET', descansoAposSegundos: null })).toBe('');
    expect(textoDoDescansoDoGrupo({ tecnica: 'PRE_EXAUSTAO', descansoAposSegundos: 90 })).toBe('cada série mantém o seu descanso');
    expect(textoDoDescansoDoGrupo({ tecnica: 'POS_EXAUSTAO', descansoAposSegundos: null })).toBe('cada série mantém o seu descanso');
  });

  it('só o descanso do grupo vale fora de pré e pós-exaustão', () => {
    expect(descansoSoDoGrupo({ tecnica: 'SUPERSET' })).toBe(true);
    expect(descansoSoDoGrupo({ tecnica: 'CIRCUITO' })).toBe(true);
    expect(descansoSoDoGrupo({ tecnica: 'PRE_EXAUSTAO' })).toBe(false);
    expect(descansoSoDoGrupo({ tecnica: 'POS_EXAUSTAO' })).toBe(false);
  });

  it('detalhe do bloco: quantidade, ordem e descanso', () => {
    const [bloco] = doisEmGrupo('SUPERSET', { descansoAposSegundos: 90 });
    expect(detalheDoBloco(bloco)).toBe('2 exercícios, nesta ordem: Supino reto → Crucifixo · descanso de 1 min 30 s depois de cada volta do grupo');
  });

  it('detalhe do bloco: circuito mostra as voltas, e outro grupo não', () => {
    const [circuito] = doisEmGrupo('CIRCUITO', { voltas: 3, descansoAposSegundos: 120 });
    expect(detalheDoBloco(circuito)).toContain('3 voltas');
    const [superset] = doisEmGrupo('SUPERSET', { voltas: 3, descansoAposSegundos: 120 });
    expect(detalheDoBloco(superset)).not.toContain('voltas');
  });

  it('exercício solto não tem detalhe', () => {
    const blocos = doisEmGrupo('SUPERSET');
    expect(detalheDoBloco(blocos[1])).toBe('');
  });
});
