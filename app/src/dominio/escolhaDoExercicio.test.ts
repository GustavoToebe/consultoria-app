import { filtrosAoAbrir, grupoDoAtual, linhaDoManual, linhaVizinha } from './escolhaDoExercicio';
import { SEM_FILTROS_DE_EXERCICIOS } from './exerciciosDaBiblioteca';

const biblioteca = [{ id: 'a', grupoMuscular: ' Peito ' }, { id: 'b', grupoMuscular: null }];

describe('pré-filtro da troca', () => {
  it('o grupo vem da biblioteca pelo id do exercício atual', () => {
    expect(grupoDoAtual({ exercicioId: 'a' }, biblioteca)).toBe('Peito');
    expect(grupoDoAtual({ exercicioId: 'b' }, biblioteca)).toBeNull();
    expect(grupoDoAtual({ exercicioId: 'saiu' }, biblioteca)).toBeNull();
    expect(grupoDoAtual({ exercicioId: null }, biblioteca)).toBeNull();
    expect(grupoDoAtual(undefined, biblioteca)).toBeNull();
  });
  it('com grupo abre filtrado por ele; sem grupo, sem filtro', () => {
    expect([...filtrosAoAbrir('Peito').grupos]).toEqual(['Peito']);
    expect(filtrosAoAbrir(null)).toBe(SEM_FILTROS_DE_EXERCICIOS);
  });
});

describe('linha do exercício manual', () => {
  const ctx = { alternativa: false, cardio: false, nomesDaLista: ['Supino reto'] };
  it('com texto vira a última linha, com o texto digitado', () => {
    expect(linhaDoManual('  Flexão diamante ', ctx)).toEqual({
      nome: 'Flexão diamante', texto: 'Usar “Flexão diamante” como exercício manual', rotulo: 'Usar só o nome Flexão diamante, fora da biblioteca',
    });
    expect(linhaDoManual('Esteira', { ...ctx, cardio: true })?.texto).toBe('Usar “Esteira” como cardio manual');
  });
  it('não existe sem texto, na alternativa nem quando o texto já é o nome de um da lista', () => {
    expect(linhaDoManual('  ', ctx)).toBeNull();
    expect(linhaDoManual('Flexão', { ...ctx, alternativa: true })).toBeNull();
    expect(linhaDoManual('supino RETO', ctx)).toBeNull();
  });
});

describe('teclado na lista', () => {
  it('anda um e dá a volta; sem ativa, ↓ vai à primeira e ↑ à última', () => {
    expect(linhaVizinha(-1, 1, 3)).toBe(0);
    expect(linhaVizinha(-1, -1, 3)).toBe(2);
    expect(linhaVizinha(0, 1, 3)).toBe(1);
    expect(linhaVizinha(2, 1, 3)).toBe(0);
    expect(linhaVizinha(0, -1, 3)).toBe(2);
    expect(linhaVizinha(7, 1, 3)).toBe(0);
    expect(linhaVizinha(0, 1, 0)).toBe(-1);
  });
});
