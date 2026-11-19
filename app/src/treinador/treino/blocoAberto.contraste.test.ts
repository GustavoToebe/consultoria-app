import { CODIGOS_DA_COR_DE_ACAO, PALETAS, coresDaAcao, contraste } from '../../tema/tokens';
import { coresDaEdicao } from '../../ui/selecao';

/**
 * Séries no padrão da dieta (19/11): a série aberta é um bloco só com fundo tingido de ação (`coresDaEdicao().fundoDoBloco`),
 * e os campos, o texto secundário, o chevron, o "Excluir série" e o ícone da prévia passam a ficar sobre ele. A cor de ação
 * é trocável (Ajustes) e a marca entra como opção, então o fundo muda com ela: cada par confere em todas as paletas,
 * opções e marcas extremas. Com `acaoSuave` (13%) a marca amarela nos temas escuros deixava o `bordaCampo` em 2,79:1.
 */
describe.each(Object.entries(PALETAS))('bloco aberto da série (%s)', (_codigo, { cores, variante }) => {
  it.each(CODIGOS_DA_COR_DE_ACAO)('%s', (opcao) => {
    for (const marca of ['#386CB8', '#FFFF00', '#1F2937']) {
      const acao = coresDaAcao(opcao, cores, variante, marca);
      const fundo = coresDaEdicao({ ...cores, ...acao }).fundoDoBloco;
      // Texto (1.4.3): o título da linha, "1 série", a variação e as ajudas; o "Excluir série" é `perigoTexto`.
      for (const texto of [cores.texto, cores.textoSuave, cores.perigo]) expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(4.5);
      // Não textual (1.4.11): contorno dos campos e do secundário, anel do foco, chevron e o ícone da prévia "Para o aluno".
      for (const peca of [cores.bordaCampo, cores.anelFoco, acao.acao, cores.sucesso, cores.atencao, cores.perigo]) expect(contraste(peca, fundo)).toBeGreaterThanOrEqual(3);
    }
  });
});
