/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create } from 'react-test-renderer';

import { SelecaoMultipla } from './SelecaoMultipla';

jest.mock('./Botao', () => ({ Botao: () => null }));
jest.mock('./CabecalhoDeGrupo', () => ({ CabecalhoDeGrupo: () => null }));
jest.mock('./CaixaSelecao', () => ({ CaixaSelecao: () => null }));
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('Limpar tira só as marcações à vista: o que um filtro esconde continua marcado', () => {
  const aoMudar = jest.fn();
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(
      <SelecaoMultipla rotulo="Exercícios" opcoes={[{ valor: 'a', rotulo: 'A' }]} marcados={new Set(['a', 'escondido'])} aoMudar={aoMudar} />,
    );
  });
  const limpar = r.root.findAll((n) => n.props.rotulo === 'Limpar' && typeof n.props.aoTocar === 'function')[0];
  act(() => limpar.props.aoTocar());
  expect([...(aoMudar.mock.calls[0][0] as Set<string>)]).toEqual(['escondido']);
});
