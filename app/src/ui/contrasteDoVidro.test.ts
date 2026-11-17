import { coresComContraste } from '../dominio/preferencias';
import { contraste, misturar, PALETAS, tokensStndrdDe } from '../tema/tokens';

/**
 * Vidro (D11): o texto sobre ele passa de 4,5:1 e borda e ícone de 3:1 MESMO SEM BLUR (Android sem alvo, navegador sem
 * `backdrop-filter`), com o pior fundo atrás: branco puro, preto puro, a página, o painel e o cartão do tema. O vidro só
 * varia por modo, mas o texto varia por paleta: todas entram. Sólido (reduzir transparência, contraste alto) também.
 */
const TEXTOS = ['texto', 'textoSuave', 'perigo'] as const; // `perigo`: o erro da barra do editor.
const GRAFICOS = ['textoSuave', 'bordaCampo', 'sucesso'] as const; // ícone inativo, contorno do botão, anel do descanso.

const casos = Object.entries(PALETAS).map(([codigo, p]) => ({ codigo, cores: p.cores, escuro: p.modo === 'ESCURO', vidro: tokensStndrdDe(p.modo).glass }));

describe.each(casos)('vidro na paleta $codigo', ({ cores, escuro, vidro }) => {
  const atras = { branco: '#FFFFFF', preto: '#000000', pagina: cores.fundo, painel: cores.painel, cartao: cores.superficie };

  it.each(Object.entries(atras))('sem blur, sobre %s: texto ≥ 4,5:1 e ícone/borda ≥ 3:1', (_nome, cor) => {
    const fundo = misturar(cor, vidro.cor, vidro.opacidade);
    for (const chave of TEXTOS) expect({ chave, razao: contraste(cores[chave], fundo) >= 4.5 }).toEqual({ chave, razao: true });
    for (const chave of GRAFICOS) expect({ chave, razao: contraste(cores[chave], fundo) >= 3 }).toEqual({ chave, razao: true });
  });

  it.each([['padrão', cores], ['contraste alto', coresComContraste(cores, 'ALTO', escuro)]] as const)(
    'sólido (%s): texto ≥ 4,5:1 e ícone/borda ≥ 3:1',
    (_nome, c) => {
      for (const chave of TEXTOS) expect({ chave, razao: contraste(c[chave], vidro.cor) >= 4.5 }).toEqual({ chave, razao: true });
      for (const chave of GRAFICOS) expect({ chave, razao: contraste(c[chave], vidro.cor) >= 3 }).toEqual({ chave, razao: true });
    },
  );
});

it('opacidade perto de 0,8 a 0,9 (D11): nem vidro de enfeite nem chapa opaca', () => {
  for (const modo of ['ESCURO', 'CLARO'] as const) {
    const { opacidade } = tokensStndrdDe(modo).glass;
    expect(opacidade).toBeGreaterThanOrEqual(0.8);
    expect(opacidade).toBeLessThan(1);
  }
});
