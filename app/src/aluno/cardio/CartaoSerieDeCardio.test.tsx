import type { ReactTestInstance } from 'react-test-renderer';

import type { Cardio, Serie } from '../../api/tipos';
import { padraoDoProtocolo } from '../../dominio/cardio';
import { CartaoSerieDeCardio } from '../CartaoSerieDeCardio';

/**
 * Cartão do bloco de cardio (pedido 27, P3): o bloco novo traz o protocolo no cabeçalho, a prévia do treinador e o
 * aquecimento, com timer; o dado antigo mantém as linhas de sempre e o contínuo não tem timer. Mesmos mocks do
 * `TimerDoIntervalado.test.tsx` (o e2e do bloco novo depende de `normalizarTreino` levar as chaves novas, passo P2).
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../MarcarSerie', () => ({ MarcarSerie: () => null }));
jest.mock('../../ui/Botao', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react'); const { Pressable } = require('react-native');
  return {
    Botao: React.forwardRef(function Botao({ rotuloAcessivel, rotulo }: { rotuloAcessivel?: string; rotulo: string }, ref: unknown) {
      return React.createElement(Pressable, { ref, accessibilityLabel: rotuloAcessivel ?? rotulo, accessibilityRole: 'button' });
    }),
  };
});
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').CLARO, variante: 'claro', bordas: { bloco: 1, item: 1 }, fatorTexto: 1 }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const serie = (cardio: Cardio): Serie => ({
  uid: 's', tipo: null, repsMin: null, repsMax: null, amrap: null, carga: null, esforco: null, descansoSegundos: null, tecnica: null, cardio, alvoExtra: null,
});

async function textosDe(cardio: Cardio) {
  let arvore!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    arvore = Renderer.create(<CartaoSerieDeCardio serie={serie(cardio)} numero={2} feita={false} ultimaDoExercicio={false} aoMarcar={() => undefined} />);
  });
  const juntar = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(juntar).join(''));
  const textos = arvore.root.findAll((n) => String(n.type) === 'Text' && String(n.parent?.type) !== 'Text', { deep: true }).map(juntar);
  const timer = arvore.root.findAll((n) => n.props.accessibilityLabel === 'Iniciar timer do bloco 2' && typeof n.type !== 'string').length > 0;
  await Renderer.act(async () => arvore.unmount());
  return { textos, timer };
}

describe('cartão do bloco de cardio', () => {
  it('bloco novo: protocolo no cabeçalho, prévia do treinador, aquecimento e timer', async () => {
    const { textos, timer } = await textosDe({ ...padraoDoProtocolo('SIT'), recuperacaoTipo: 'PASSIVA' });
    expect(textos).toEqual(expect.arrayContaining(['Bloco 2 · SIT', '6 × 30 s all-out / 3 min (passiva) · ~25 min', 'Aquecimento 4 min · Desaquecimento 3 min']));
    expect(timer).toBe(true);
  });

  it('dado antigo: as linhas de sempre; o contínuo sem timer e o intervalado com', async () => {
    const continuo = await textosDe({ duracaoMin: 30, distanciaKm: null, ritmo: null, zona: 2, intervalos: null });
    expect(continuo.textos).toEqual(expect.arrayContaining(['Bloco 2 · Contínuo', 'Duração: 30 min', 'Zona: 2']));
    expect(continuo.timer).toBe(false);
    const intervalado = await textosDe({ duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } });
    expect(intervalado.textos).toEqual(expect.arrayContaining(['Bloco 2 · Intervalado', 'Intervalos: 8 voltas · 30 s de esforço · 60 s de descanso']));
    expect(intervalado.timer).toBe(true);
  });
});
