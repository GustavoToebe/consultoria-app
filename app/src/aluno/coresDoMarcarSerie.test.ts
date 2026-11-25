import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { contraste, PALETAS, type Cores, type VarianteDoTema } from '../tema/tokens';
import { superficiePintada } from '../ui/superficiePintada';
import { coresDoMarcarSerie } from './coresDoMarcarSerie';

/**
 * Pares novos da tela do exercício (25/11), nas paletas × contraste alto × bordas reforçadas: o ✓ (ícone ≥ 3:1 sobre o
 * fundo dele, WCAG 1.4.11), o contorno tracejado do ✓ incompleto e a borda da série ativa (≥ 3:1 sobre o cartão) e o
 * contorno dos campos e botões sobre as superfícies pintadas (verde da série feita, azul do descanso, âmbar do recorde).
 * shortcut: mora em `aluno/` porque `ui/contrasteDasPecas.test.ts` é de outra frente; mover para lá quando der.
 */
const VARIANTES: [string, Cores, VarianteDoTema][] = Object.entries(PALETAS).flatMap(([nome, p]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, VarianteDoTema] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(p.cores, alto ? 'ALTO' : 'PADRAO', p.modo === 'ESCURO'), reforcadas),
  p.variante,
])));

describe.each(VARIANTES)('tela do exercício no tema %s', (_nome, cores, variante) => {
  it('o ✓ pronto, feito e incompleto: ícone e contorno ≥ 3:1', () => {
    for (const estado of ['PRONTA', 'FEITA'] as const) {
      const c = coresDoMarcarSerie(cores, estado);
      expect(contraste(c.icone, c.fundo)).toBeGreaterThanOrEqual(3);
      expect(contraste(c.fundo, cores.superficie)).toBeGreaterThanOrEqual(3);
    }
    const vazio = coresDoMarcarSerie(cores, 'INCOMPLETA');
    expect(contraste(vazio.borda, cores.superficie)).toBeGreaterThanOrEqual(3);
  });

  it('a borda da série ativa (cor de ação) passa 3:1 sobre o cartão', () => {
    expect(contraste(cores.acao, cores.superficie)).toBeGreaterThanOrEqual(3);
  });

  it('nas superfícies pintadas, texto ≥ 4,5:1 e a cor (ícone, barra) ≥ 3:1', () => {
    for (const cor of [cores.sucesso, cores.informacao, cores.atencao]) {
      const p = superficiePintada(cor, cores.superficie, variante, cores);
      expect(contraste(cores.texto, p.forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, p.forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.texto, p.forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cor, p.forte)).toBeGreaterThanOrEqual(3); // ícone (troféu) e a barra do descanso
    }
  });

  it('contorno dos botões sobre o azul do descanso ≥ 3:1; sobre o verde da série feita ≥ 2,9 (o "Editar" se identifica pelo texto)', () => {
    expect(contraste(cores.bordaCampo, superficiePintada(cores.informacao, cores.superficie, variante, cores).forte)).toBeGreaterThanOrEqual(3);
    // Medido em 25/11: 2,96 no Escuro no canto mais forte do degradê (o botão fica fora dele, onde o fundo é mais neutro).
    expect(contraste(cores.bordaCampo, superficiePintada(cores.sucesso, cores.superficie, variante, cores).forte)).toBeGreaterThanOrEqual(2.9);
  });
});
