import { CODIGOS_DA_COR_DE_ACAO, contraste, coresDaAcao, PALETAS } from '../../tema/tokens';
import { superficiePintada } from '../../ui/superficiePintada';

/**
 * O aviso "Seu novo plano está disponível" é pintado na cor de ação, que cada pessoa troca em Ajustes: em todas as paletas,
 * com toda cor de ação (e a marca de uma cor ruim, como o amarelo), o título (`texto`), o texto (`textoSuave`) e o X passam
 * 4,5:1 sobre o ponto mais forte do fundo, e a bolinha na cor passa 3:1.
 */
describe.each(Object.entries(PALETAS))('aviso do plano novo (%s)', (_codigo, { cores, variante }) => {
  it.each(CODIGOS_DA_COR_DE_ACAO)('cor de ação %s', (opcao) => {
    for (const marca of ['#386CB8', '#FFFF00', '#1F2937']) {
      const { acao } = coresDaAcao(opcao, cores, variante, marca);
      const p = superficiePintada(acao, cores.superficie, variante, cores);
      expect(contraste(cores.texto, p.forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, p.forte)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(acao, p.forte)).toBeGreaterThanOrEqual(3);
    }
  });
});
