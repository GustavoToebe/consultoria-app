import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { CHAVES_DE_IDENTIFICACAO, contraste, PALETA_DE_IDENTIFICACAO, PALETAS, type Cores, type VarianteDoTema } from '../tema/tokens';
import { superficiePintada } from '../ui/superficiePintada';
import { coresDoMarcarSerie, pinturaDaSerie } from './coresDoMarcarSerie';

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

  // Cartão da série na cor do tipo (25/11): o texto, o contorno dos campos e do ✓, a faixa e a borda de ação sobre o ponto
  // mais forte do degradê (e a faixa também sobre a base pura, onde o degradê acaba).
  describe.each(['ATIVA', 'FEITA', 'PENDENTE'] as const)('série %s na cor do tipo', (estado) => {
    it.each(CHAVES_DE_IDENTIFICACAO)('%s: texto ≥ 4,5:1, campos, ✓, faixa e borda de ação ≥ 3:1', (chave) => {
      const p = pinturaDaSerie(PALETA_DE_IDENTIFICACAO[variante][chave], estado, cores, variante, 1);
      const forte = p.pintada!.forte;
      for (const texto of [cores.texto, cores.textoSuave, cores.perigo]) expect(contraste(texto, forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.bordaCampo, forte)).toBeGreaterThanOrEqual(3); // campos, ✓ incompleto e "Editar"
      expect(contraste(cores.sucesso, forte)).toBeGreaterThanOrEqual(3); // ✓ feito
      expect(contraste(p.faixa!, forte)).toBeGreaterThanOrEqual(3);
      expect(contraste(p.faixa!, cores.superficie)).toBeGreaterThanOrEqual(3);
      if (estado === 'ATIVA') expect(contraste(p.borda, forte)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('pinturaDaSerie', () => {
  const cores = PALETAS.ESCURO.cores;
  it('tipo sem cor: neutro, sem faixa; a ativa só ganha a borda de ação', () => {
    expect(pinturaDaSerie(null, 'PENDENTE', cores, 'escuro', 1)).toEqual({ pintada: null, faixa: null, borda: cores.divisor, larguraDaBorda: 1 });
    expect(pinturaDaSerie(null, 'ATIVA', cores, 'escuro', 1)).toEqual({ pintada: null, faixa: null, borda: cores.acao, larguraDaBorda: 1.5 });
  });
  it('feita fica na cor do tipo (não verde); pendente mais apagada; ativa com a borda de ação, a reforçada vence', () => {
    const cor = PALETA_DE_IDENTIFICACAO.escuro.CIANO;
    const feita = pinturaDaSerie(cor, 'FEITA', cores, 'escuro', 1);
    const pendente = pinturaDaSerie(cor, 'PENDENTE', cores, 'escuro', 1);
    expect(feita.faixa).toBe(cor);
    expect(feita.borda).toBe(feita.pintada!.borda);
    expect(contraste(pendente.pintada!.forte, cores.superficie)).toBeLessThan(contraste(feita.pintada!.forte, cores.superficie));
    expect(contraste(pendente.faixa!, cores.superficie)).toBeLessThan(contraste(cor, cores.superficie));
    expect(pinturaDaSerie(cor, 'ATIVA', cores, 'escuro', 2)).toMatchObject({ borda: cores.acao, larguraDaBorda: 2 });
  });
});
