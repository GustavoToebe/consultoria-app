import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useMarcadoAgora } from './useMarcadoAgora';

function Sonda({ feito }: { feito: boolean }) {
  return useMarcadoAgora(feito) ? 'verde' : 'neutro';
}

describe('useMarcadoAgora', () => {
  it('o que já abriu feito fica neutro; marcar com a tela aberta acende; desmarcar apaga', () => {
    let arvore!: ReactTestRenderer;
    const cor = () => arvore.toJSON();
    act(() => { arvore = create(<Sonda feito />); });
    expect(cor()).toBe('neutro');
    act(() => { arvore.update(<Sonda feito={false} />); });
    expect(cor()).toBe('neutro');
    act(() => { arvore.update(<Sonda feito />); });
    expect(cor()).toBe('verde');
    act(() => { arvore.update(<Sonda feito={false} />); });
    expect(cor()).toBe('neutro');
  });
});
