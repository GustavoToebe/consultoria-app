import { BotaoMarcar } from './BotaoMarcar';
jest.mock('lucide-react-native', () => ({ Check: () => null }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: { sucesso: '#1F9D55', borda: '#2A2A2F', superficie3: '#27272C', textoSuave: '#9A9AA2' } }) }));
it('importa o primeiro componente animado com o mock da versão instalada', () => {
  expect(typeof BotaoMarcar).toBe('function');
});
