import { CARTOES_DE_CONFIGURACAO } from '../../dominio/configuracoes';
import { ICONES_DAS_CONFIGURACOES } from './icones';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

test('todo cartão do catálogo tem ícone próprio, e o mapa não guarda id que saiu do catálogo', () => {
  const ids = CARTOES_DE_CONFIGURACAO.map((c) => c.id);
  expect(ids.filter((id) => !ICONES_DAS_CONFIGURACOES[id])).toEqual([]);
  expect(Object.keys(ICONES_DAS_CONFIGURACOES).filter((id) => !ids.includes(id))).toEqual([]);
});
