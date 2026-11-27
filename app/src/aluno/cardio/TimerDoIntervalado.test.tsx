import type { ReactTestInstance } from 'react-test-renderer';

import { padraoDoProtocolo } from '../../dominio/cardio';
import { ProvedorDaPrevia } from '../../ui/emPrevia';
import { TimerDoIntervalado } from './TimerDoIntervalado';

/**
 * Timer do intervalado (pedido 27, P3) montado de verdade com o relógio falso do Jest (que também move o `Date.now`):
 * troca de fase pelo relógio de parede, "Volta 3 de 10", pausar segura o tempo, pular, e o fim marca o bloco uma vez só
 * (nunca na prévia do treinador nem num bloco já feito). Mesmo harness de mocks do `ExercicioAluno.previa.test.tsx`.
 */
const mockVibracoes = { leve: jest.fn(), sucesso: jest.fn() };
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../ui/vibrar', () => ({ vibrar: { leve: () => mockVibracoes.leve(), sucesso: () => mockVibracoes.sucesso() } }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Botao', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react'); const { Pressable } = require('react-native');
  return {
    Botao: React.forwardRef(function Botao({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }, ref: unknown) {
      return React.createElement(Pressable, { ref, accessibilityLabel: rotuloAcessivel ?? rotulo, accessibilityRole: 'button', onPress: aoTocar });
    }),
  };
});
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, variante: 'escuro', bordas: { bloco: 1, item: 1 }, fatorTexto: 1 }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

// CURTO padrão: 5 min de aquecimento, 10 × 30 s / 30 s, 5 min de desaquecimento (1170 s).
const curto = padraoDoProtocolo('CURTO');
const montados: Arvore[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  mockVibracoes.leve.mockClear();
  mockVibracoes.sucesso.mockClear();
});
afterEach(async () => {
  await Renderer.act(async () => montados.splice(0).forEach((m) => m.unmount()));
  jest.useRealTimers();
});

async function montar({ previa = false, feita = false } = {}) {
  const aoTerminar = jest.fn();
  let arvore!: Arvore;
  await Renderer.act(async () => {
    arvore = Renderer.create(
      <ProvedorDaPrevia value={previa}>
        <TimerDoIntervalado cardio={curto} numero={1} feita={feita} aoTerminar={aoTerminar} />
      </ProvedorDaPrevia>,
    );
  });
  montados.push(arvore);
  // O `Texto numerico` reparte números e palavras em filhos: junta o texto de cada `Text` de fora.
  const juntar = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(juntar).join(''));
  const textos = () => arvore.root.findAll((n) => String(n.type) === 'Text' && String(n.parent?.type) !== 'Text', { deep: true }).map(juntar);
  const botao = (nome: string): ReactTestInstance => arvore.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === nome && typeof n.props.onPress === 'function');
  const tocar = (nome: string) => Renderer.act(async () => botao(nome).props.onPress());
  const passar = (segundos: number) => Renderer.act(async () => { jest.advanceTimersByTime(segundos * 1000); });
  return { aoTerminar, textos, tocar, passar, botao };
}

describe('timer do intervalado', () => {
  it('conta pela fase, mostra a volta e vibra só na troca', async () => {
    const t = await montar();
    await t.tocar('Iniciar timer do bloco 1');
    expect(t.textos()).toEqual(expect.arrayContaining(['Aquecimento', '5:00', 'Depois: Estímulo 30 s', 'Aquecimento, 5 min']));
    await t.passar(420);
    expect(t.textos()).toEqual(expect.arrayContaining(['Estímulo', 'Zona 5', '0:30', 'Estímulo, Zona 5, volta 3 de 10, 30 s']));
    expect(t.textos().some((x) => x.includes('3 de 10'))).toBe(true);
    // Uma vibração por troca de fase (aquecimento → E1 → R1 → E2 → R2 → E3), nunca por segundo; a do começo é o toque.
    expect(mockVibracoes.leve).toHaveBeenCalledTimes(5);
  });

  it('de volta do segundo plano (sem tiques no meio), pula para a fase certa e vibra uma vez', async () => {
    const t = await montar();
    await t.tocar('Iniciar timer do bloco 1');
    // O relógio de parede anda 7 min sem nenhum tique (aba escondida, aparelho travado); o próximo tique acerta a fase.
    jest.setSystemTime(Date.now() + 420_000);
    await t.passar(0.25);
    expect(t.textos()).toEqual(expect.arrayContaining(['Estímulo', '0:30']));
    expect(t.textos().some((x) => x.includes('3 de 10'))).toBe(true);
    expect(mockVibracoes.leve).toHaveBeenCalledTimes(1);
  });

  it('pausar segura o tempo; retomar continua de onde parou', async () => {
    const t = await montar();
    await t.tocar('Iniciar timer do bloco 1');
    await t.passar(10);
    await t.tocar('Pausar timer do bloco 1');
    await t.passar(120);
    expect(t.textos()).toEqual(expect.arrayContaining(['4:50', 'Timer pausado']));
    await t.tocar('Retomar timer do bloco 1');
    await t.passar(5);
    expect(t.textos()).toContain('4:45');
  });

  it('pular vai à próxima fase e, no fim, marca o bloco uma vez', async () => {
    const t = await montar();
    await t.tocar('Iniciar timer do bloco 1');
    await t.tocar('Pular fase do bloco 1');
    expect(t.textos()).toEqual(expect.arrayContaining(['Estímulo', '0:30']));
    await t.passar(1170);
    expect(t.aoTerminar).toHaveBeenCalledTimes(1);
    expect(mockVibracoes.sucesso).toHaveBeenCalledTimes(1);
    expect(t.textos()).toContain('Bloco 1 concluído');
    // Acabou: volta ao "Iniciar timer", sem marcar de novo.
    await t.passar(60);
    expect(t.botao('Iniciar timer do bloco 1')).toBeTruthy();
    expect(t.aoTerminar).toHaveBeenCalledTimes(1);
  });

  it('parar não marca; na prévia do treinador e no bloco já feito o fim também não marca', async () => {
    const parado = await montar();
    await parado.tocar('Iniciar timer do bloco 1');
    await parado.tocar('Pausar timer do bloco 1');
    await parado.tocar('Parar timer do bloco 1');
    await parado.passar(1200);
    expect(parado.aoTerminar).not.toHaveBeenCalled();
    for (const opcoes of [{ previa: true }, { feita: true }]) {
      const t = await montar(opcoes);
      await t.tocar('Iniciar timer do bloco 1');
      await t.passar(1170);
      expect(t.textos()).toContain('Bloco 1 concluído');
      expect(t.aoTerminar).not.toHaveBeenCalled();
    }
  });
});
