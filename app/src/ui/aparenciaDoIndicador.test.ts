import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { PALETAS, contraste, coresDeDestaque, type Cores, type VarianteDoTema } from '../tema/tokens';
import { aparenciaDoIndicador } from './aparenciaDoIndicador';

const BASES: [string, Cores, boolean, VarianteDoTema][] = Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO', p.variante]);

/**
 * Só o marcador (25/11, "Treinos esta semana" da ficha): a cor de categoria vai só na bolinha; o cartão segue neutro (sem
 * pintura, contorno `divisor`, rótulo `textoSuave`, valor `texto`) e a bolinha passa 3:1 sobre a base do lugar, nos 9
 * temas com e sem contraste alto e bordas reforçadas (a paleta de destaque não acompanha o contraste alto).
 */
describe.each(BASES.flatMap(([nome, base, escuro, variante]) => [false, true].map((alto): [string, Cores, VarianteDoTema] => [
  `${nome}${alto ? ', contraste alto e bordas reforçadas' : ''}`,
  alto ? coresComBordasReforcadas(coresComContraste(base, 'ALTO', escuro), true) : base,
  variante,
])))('CartaoDeIndicador só com o marcador no tema %s', (_nome, cores, variante) => {
  const azul = coresDeDestaque(cores, variante).azul.cor;

  it.each(['pagina', 'cartao'] as const)('%s: cartão neutro, bolinha azul ≥ 3:1 sobre a base, texto ≥ 4,5:1', (lugar) => {
    for (const estado of ['valor', 'zero'] as const) {
      const a = aparenciaDoIndicador(null, estado, lugar, cores, variante, azul);
      expect(a).toMatchObject({ pintura: null, marca: azul, borda: cores.divisor, rotulo: cores.textoSuave, valor: estado === 'zero' ? cores.textoSuave : cores.texto });
      expect(contraste(azul, a.fundo)).toBeGreaterThanOrEqual(3);
      expect(contraste(a.valor, a.fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sem o marcador nada muda; com tom, a cor da situação vence o marcador', () => {
    expect(aparenciaDoIndicador(null, 'valor', 'cartao', cores, variante).marca).toBeNull();
    expect(aparenciaDoIndicador(cores.sucesso, 'valor', 'cartao', cores, variante, azul).marca).toBe(cores.sucesso);
  });
});
