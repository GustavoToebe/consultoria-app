import { CHAVES_DE_IDENTIFICACAO, CODIGOS_DA_COR_DE_ACAO, PALETA_DE_IDENTIFICACAO, PALETAS, coresDaAcao, contraste } from '../../tema/tokens';
import { pinturaDaSerie } from '../../ui/pinturaDaSerie';

/**
 * A série aberta (Gustavo, 28/11): o mesmo fundo pintado na cor do tipo da linha fechada, com a borda de ação (`ATIVA`).
 * Os campos, o texto secundário, o chevron, o "Excluir série" e o ícone da prévia ficam sobre o ponto mais forte do
 * degradê. A cor de ação é trocável (Ajustes) e a marca entra como opção: cada par confere em todas as paletas, opções,
 * marcas extremas e cores de tipo (e a própria cor de ação, na preferência "Cor das séries: de ação").
 */
describe.each(Object.entries(PALETAS))('bloco aberto da série (%s)', (_codigo, { cores, variante }) => {
  it.each(CODIGOS_DA_COR_DE_ACAO)('%s', (opcao) => {
    for (const marca of ['#386CB8', '#FFFF00', '#1F2937']) {
      const acao = coresDaAcao(opcao, cores, variante, marca);
      const comAcao = { ...cores, ...acao };
      for (const cor of [acao.acao, ...CHAVES_DE_IDENTIFICACAO.map((c) => PALETA_DE_IDENTIFICACAO[variante][c])]) {
        const p = pinturaDaSerie(cor, 'ATIVA', comAcao, variante, 1);
        const fundo = p.pintada!.forte;
        // Texto (1.4.3): o título da linha, "1 série", a variação e as ajudas; "Excluir série", "Falta a carga" e
        // "● Falta o descanso" são texto em `perigo`/`atencao` na linha da aberta.
        for (const texto of [cores.texto, cores.textoSuave, cores.perigo, cores.atencao]) expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
        // Não textual (1.4.11): a borda de ação (o destaque de edição), contorno dos campos, anel do foco, chevron e o ícone da prévia.
        for (const peca of [p.borda, cores.bordaCampo, cores.anelFoco, acao.acao, cores.sucesso, cores.atencao, cores.perigo]) expect(contraste(peca, fundo)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
