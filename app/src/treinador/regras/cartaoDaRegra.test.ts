import { coresComContraste } from '../../dominio/preferencias';
import { CODIGOS_DA_COR_DE_ACAO, coresDaAcao, contraste, PALETAS, type Cores } from '../../tema/tokens';
import { coresDoInterruptor } from '../../ui/interruptor';
import { superficiePintada } from '../../ui/superficiePintada';
import { contornoDoCampoPintado } from './cartaoDaRegra';

/**
 * Cartão ligado de Configurações › Regras de atenção (28/11; regra sem exceção do Gustavo, 29/11): pintado com a cor de ação
 * a 14% e a borda na própria cor. Todo texto a 4,5:1 e toda borda, controle e ícone a 3:1 sobre o fundo REAL, que vai do
 * ponto mais forte da pintura (liso nas claras; o canto de 14% do degradê no escuro) à base onde o degradê termina: o
 * contraste contra uma mistura das duas fica entre os dois extremos, então medir os dois cobre o cartão inteiro. Em todas
 * as paletas, com e sem contraste alto e em toda cor de ação que a pessoa pode escolher (a da marca com uma cor de exemplo).
 */
const MARCA_DE_EXEMPLO = '#E4572E';

const casos = Object.entries(PALETAS).flatMap(([nome, p]) => {
  const escuro = p.modo === 'ESCURO';
  return [['normal', p.cores], ['contraste alto', coresComContraste(p.cores, 'ALTO', escuro)]].flatMap(([modo, base]) =>
    CODIGOS_DA_COR_DE_ACAO.map((opcao) => {
      const cores = base as Cores;
      const acao = coresDaAcao(opcao, cores, p.variante, MARCA_DE_EXEMPLO).acao;
      return [`${nome} ${modo} ${opcao}`, cores, acao, p.variante] as const;
    }));
});

describe.each(casos)('cartão ligado (%s)', (_nome, cores, acao, variante) => {
  const p = superficiePintada(acao, cores.superficie, variante, cores);
  const fundos = [p.forte, p.base];
  const interruptor = coresDoInterruptor(cores, true);

  it('título, frase, descrição, ajuda e erro a 4,5:1 em todo o fundo real', () => {
    for (const fundo of fundos) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.perigo, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('contorno do campo a 3:1 em todo o fundo real e no poço das regras (antes, 2,99:1 no Escuro Verde-água)', () => {
    const contorno = contornoDoCampoPintado(cores);
    for (const fundo of [...fundos, cores.superficie2]) expect(contraste(contorno, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('borda de foco do campo (anel de 2 px) a 3:1 em todo o fundo real', () => {
    for (const fundo of [...fundos, cores.superficie2]) expect(contraste(cores.anelFoco, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('interruptor ligado (trilho e botão) a 3:1; a borda de ação a 3:1 da página e de todo o fundo real', () => {
    for (const fundo of fundos) {
      expect(contraste(interruptor.trilho, fundo)).toBeGreaterThanOrEqual(3);
      expect(contraste(acao, fundo)).toBeGreaterThanOrEqual(3);
    }
    expect(contraste(interruptor.botao, interruptor.trilho)).toBeGreaterThanOrEqual(3);
    expect(contraste(acao, cores.painel)).toBeGreaterThanOrEqual(3);
  });
});
