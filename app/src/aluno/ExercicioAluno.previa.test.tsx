import type { ExercicioPlano } from '../api/tipos';
import { tecnicaVazia } from '../dominio/editorTreino';
import { carga, exercicio as exercicioDeTeste, serie as serieDeTeste } from '../dominio/exemplosDeTreino.apoioTeste';
import { ExercicioAluno } from './ExercicioAluno';

/**
 * "Ver como o aluno" (C34, D4): na prévia do treinador os botões de marcar e registrar ficam desabilitados e não fazem
 * nada, mesmo se o toque chegar ao `onPress`. Monta o `ExercicioAluno` de verdade (série simples, Cluster e cardio) e conta
 * as chamadas que sairiam para a gravação, a carga do dia e o cronômetro. Mesmo harness de mocks do `ExercicioAluno.cargas.test.tsx`.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));
jest.mock('../ui/Aviso', () => ({ useAviso: () => ({ avisar: () => undefined }) }));
jest.mock('@rn-primitives/label', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/tabs', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
// O `Botao` real vem de uma biblioteca de primitivos que o Jest não transforma: aqui só importa o estado e o toque.
jest.mock('../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar, desabilitado }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void; desabilitado?: boolean }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, accessibilityRole: 'button', accessibilityState: { disabled: !!desabilitado }, disabled: !!desabilitado, onPress: aoTocar }),
}));
jest.mock('./SeloComExplicacao', () => ({ SeloComExplicacao: () => null }));
jest.mock('./TipoDaSerieComExplicacao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TipoDaSerieComExplicacao: ({ nome }: { nome: string }) => require('react').createElement(require('react-native').Text, null, nome),
}));
jest.mock('../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, identificacao: require('../tema/tokens').coresDeIdentificacao(require('../tema/tokens').ESCURO, true), bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

const simples = exercicioDeTeste('ex', { exercicioId: 'x', nome: 'Remada', modalidade: 'MAQUINA', series: [serieDeTeste('s1'), serieDeTeste('s2')] });
const comCluster = exercicioDeTeste('cl', {
  exercicioId: 'y',
  nome: 'Supino',
  modalidade: 'BARRA',
  series: [serieDeTeste('c1', { tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [3, 3], pausaSegundos: 20 }, carga: carga('CARGA_TRABALHO') })],
});
const cardio = exercicioDeTeste('cd', { nome: 'Esteira', modalidade: 'CARDIO', unidade: 'nenhuma', series: [serieDeTeste('d1', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20 } })] });

const montados: Arvore[] = [];
afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

async function montar(exercicio: ExercicioPlano, previa: boolean) {
  const chamadas = { registrar: jest.fn(), cargaDoDia: jest.fn(), pausa: jest.fn(), cancelarPausa: jest.fn() };
  let arvore!: Arvore;
  await Renderer.act(async () => {
    arvore = Renderer.create(
      <ExercicioAluno
        exercicio={exercicio}
        data="2026-11-03"
        cargaDoDia={40}
        ultima={null}
        // Um registro "feito" no aparelho não pode aparecer na prévia.
        registroDe={(uid) => ({ id: 'r', planoVersaoId: 'v', sessaoUid: 's', exercicioUid: exercicio.uid, serieUid: uid, exercicioId: null, trabalho: true, data: '2026-11-03', carga: 50, repeticoes: 5, concluida: true, observacao: null, etapas: null, referenciaCarga: null, referenciaOrigem: null, alteradoEm: '2026-11-03T10:00:00.000Z', situacao: 'LOCAL', motivo: null })}
        config={{ arredondamentoKg: 0.5, tipoTrabalho: 'WS' }}
        aoMudarCargaDoDia={chamadas.cargaDoDia}
        aoRegistrar={chamadas.registrar}
        aoIniciarPausa={chamadas.pausa}
        aoCancelarPausa={chamadas.cancelarPausa}
        chaveDaExecucao={(uid) => `v|${uid}|d`}
        previa={previa}
      />,
    );
    montados.push(arvore);
  });
  /** Os alvos de toque com a função de toque, pelo papel. */
  const alvos = (papel: 'checkbox' | 'button') => arvore.root.findAll((n) => n.props.accessibilityRole === papel && typeof n.props.onPress === 'function');
  return { chamadas, alvos, arvore };
}

describe('Ver como o aluno: o exercício em modo leitura', () => {
  it('série simples: os ✓ ficam desabilitados e tocar neles não registra nada', async () => {
    const t = await montar(simples, true);
    const marcas = t.alvos('checkbox');
    expect(marcas.length).toBeGreaterThanOrEqual(2);
    for (const m of marcas) {
      expect(m.props.accessibilityState).toMatchObject({ disabled: true, checked: false });
      expect(m.props.disabled).toBe(true);
      await Renderer.act(async () => m.props.onPress()); // mesmo se o toque chegasse ao onPress
    }
    expect(t.chamadas.registrar).not.toHaveBeenCalled();
    expect(t.chamadas.cargaDoDia).not.toHaveBeenCalled();
    expect(t.chamadas.pausa).not.toHaveBeenCalled();
  });

  it('série com etapas (Cluster): ✓, "Não fiz" e "Concluir série" desabilitados e sem efeito', async () => {
    const t = await montar(comCluster, true);
    const alvos = [...t.alvos('checkbox'), ...t.alvos('button')].filter((n) => /feito|feita|Não fiz|Concluir/.test(String(n.props.accessibilityLabel)));
    expect(alvos.length).toBeGreaterThanOrEqual(4); // 2 ✓ + 2 "Não fiz" + "Concluir série"
    for (const a of alvos) {
      expect(a.props.accessibilityState).toMatchObject({ disabled: true });
      await Renderer.act(async () => a.props.onPress());
    }
    expect(t.chamadas.registrar).not.toHaveBeenCalled();
    expect(t.chamadas.pausa).not.toHaveBeenCalled();
  });

  it('cardio: o "feito" fica desabilitado e sem efeito', async () => {
    const t = await montar(cardio, true);
    const [marca] = t.alvos('checkbox');
    expect(marca.props.accessibilityState).toMatchObject({ disabled: true });
    await Renderer.act(async () => marca.props.onPress());
    expect(t.chamadas.registrar).not.toHaveBeenCalled();
  });

  it('o que está salvo no aparelho não aparece: nenhuma série sai marcada como feita', async () => {
    const t = await montar(simples, true);
    expect(t.alvos('checkbox').every((m) => m.props.accessibilityState.checked === false)).toBe(true);
  });

  it('sem a prévia (o aluno), o ✓ continua habilitado e registra', async () => {
    const t = await montar(simples, false);
    const [marca] = t.alvos('checkbox');
    expect(marca.props.accessibilityState.disabled).toBeFalsy();
    await Renderer.act(async () => marca.props.onPress());
    expect(t.chamadas.registrar).toHaveBeenCalledTimes(1);
  });
});
