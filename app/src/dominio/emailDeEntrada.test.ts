import { ASSUNTO_DO_SUPORTE, avisoSemEmail, fraseDoEmailDeEntrada, mailtoDoSuporte } from './emailDeEntrada';
import { CONTATO_DO_SUPORTE } from './produto';

it('administrador fala com o suporte do Overtraining', () => {
  expect(fraseDoEmailDeEntrada(true)).toBe('Para mudar o e-mail de entrada, fale com o suporte do Overtraining.');
});

it('os outros perfis falam com o administrador da consultoria', () => {
  expect(fraseDoEmailDeEntrada(false)).toBe('Para mudar o e-mail de entrada, fale com o administrador da consultoria.');
});

describe('mailtoDoSuporte', () => {
  it('um e-mail vira mailto com o assunto fixo e nada da pessoa', () => {
    expect(ASSUNTO_DO_SUPORTE).toBe('Suporte Overtraining');
    expect(mailtoDoSuporte('suporte@overtraining.app')).toBe('mailto:suporte@overtraining.app?subject=Suporte%20Overtraining');
  });

  it('o contato do produto é nulo (recuo) ou um endereço que vira mailto', () => {
    if (CONTATO_DO_SUPORTE !== null) expect(mailtoDoSuporte(CONTATO_DO_SUPORTE)).toBe(`mailto:${CONTATO_DO_SUPORTE}?subject=Suporte%20Overtraining`);
  });

  it('sem contato (recuo: a constante vira null) não há link, e o botão some', () => {
    expect(mailtoDoSuporte(null)).toBeNull();
    expect(mailtoDoSuporte('')).toBeNull();
  });

  it('recusa endereço que mudaria o mailto (outro destinatário, corpo, cópia) ou que não é e-mail', () => {
    for (const ruim of ['a@b.app?body=x', 'a@b.app,c@d.app', 'a@b.app&cc=c@d.app', 'a b@c.app', 'https://overtraining.app', 'sem-arroba', 'a@b']) {
      expect(mailtoDoSuporte(ruim)).toBeNull();
    }
  });

  it('o aviso da falha traz o endereço para escrever à mão', () => {
    expect(avisoSemEmail('suporte@overtraining.app')).toBe('Não foi possível abrir o e-mail. Escreva para suporte@overtraining.app.');
  });
});
