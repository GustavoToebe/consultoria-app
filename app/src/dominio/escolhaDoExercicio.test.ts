import { filtrosAoAbrir, linhaDoManual, linhaVizinha, preFiltroDaTroca } from './escolhaDoExercicio';
import { SEM_FILTROS_DE_EXERCICIOS } from './exerciciosDaBiblioteca';

const biblioteca = [
  { id: 'a', grupoMuscular: ' Peito ' }, { id: 'b', grupoMuscular: null },
  // Cardio antigo do catálogo (grupo "Cardio", sem tipo) e o novo (sem grupo, com tipo; D13).
  { id: 'esteira-antiga', grupoMuscular: 'Cardio', tipoDeCardio: null }, { id: 'escada', grupoMuscular: null, tipoDeCardio: 'ESCADA' as const },
];
const nada = { grupo: null, tipoDeCardio: null };

describe('pré-filtro da troca', () => {
  it('o grupo vem da biblioteca pelo id do exercício atual', () => {
    expect(preFiltroDaTroca({ exercicioId: 'a' }, biblioteca, false)).toEqual({ grupo: 'Peito', tipoDeCardio: null });
    expect(preFiltroDaTroca({ exercicioId: 'b' }, biblioteca, false)).toEqual(nada);
    expect(preFiltroDaTroca({ exercicioId: 'saiu' }, biblioteca, false)).toEqual(nada);
    expect(preFiltroDaTroca({ exercicioId: null }, biblioteca, false)).toEqual(nada);
    expect(preFiltroDaTroca(undefined, biblioteca, false)).toEqual(nada);
  });
  it('no cardio vale o tipo, nunca o grupo "Cardio" do catálogo (esconderia os cardios novos, sem grupo)', () => {
    expect(preFiltroDaTroca({ exercicioId: 'escada' }, biblioteca, true)).toEqual({ grupo: null, tipoDeCardio: 'ESCADA' });
    expect(preFiltroDaTroca({ exercicioId: 'esteira-antiga' }, biblioteca, true)).toEqual(nada);
  });
  it('com grupo ou tipo abre filtrado por ele; sem nenhum, sem filtro', () => {
    expect([...filtrosAoAbrir({ grupo: 'Peito', tipoDeCardio: null }).grupos]).toEqual(['Peito']);
    const doCardio = filtrosAoAbrir({ grupo: null, tipoDeCardio: 'ESCADA' });
    expect([...doCardio.tiposDeCardio]).toEqual(['ESCADA']);
    expect(doCardio.grupos.size).toBe(0);
    expect(filtrosAoAbrir(nada)).toBe(SEM_FILTROS_DE_EXERCICIOS);
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
