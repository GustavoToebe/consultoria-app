import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { CHAVES_DE_IDENTIFICACAO, CODIGOS_DA_COR_DE_ACAO, coresDaAcao, coresDeIdentificacao, contraste, PALETA_DE_IDENTIFICACAO, PALETAS, type Cores, type VarianteDoTema } from '../tema/tokens';
import { corDaSerie, pinturaDaSerie, type EstadoDaSerie } from './pinturaDaSerie';
import { coresDaEdicao } from './selecao';

/**
 * Séries do treino pintadas (25/11; executar e montar), nas 9 paletas × contraste alto × bordas reforçadas e nos dois modos
 * da preferência "Cor das séries": no do tipo, as cinco cores de identificação; no de ação, cada opção da cor de ação (com
 * marcas extremas na opção "Marca"), já ajustada pelo `coresDaAcao` como no `TemaProvider`. Sobre o ponto mais forte do
 * degradê: texto, texto secundário, erro e "Falta a carga" (âmbar) ≥ 4,5:1; contorno dos campos e do ✓ incompleto, ✓ feito,
 * faixa (também sobre a base) e borda de ação ≥ 3:1. A faixa da linha aberta do editor vai sobre o fundo de edição.
 */
const VARIANTES: [string, Cores, VarianteDoTema][] = Object.entries(PALETAS).flatMap(([nome, p]) => [false, true].flatMap((alto) => [false, true].map((reforcadas): [string, Cores, VarianteDoTema] => [
  `${nome}${alto ? ', contraste alto' : ''}${reforcadas ? ', bordas reforçadas' : ''}`,
  coresComBordasReforcadas(coresComContraste(p.cores, alto ? 'ALTO' : 'PADRAO', p.modo === 'ESCURO'), reforcadas),
  p.variante,
])));
const ESTADOS: EstadoDaSerie[] = ['ATIVA', 'CHEIA', 'APAGADA'];
const MARCAS = ['#386CB8', '#FFFF00', '#1F2937'];

function conferir(cor: string, cores: Cores, variante: VarianteDoTema) {
  for (const estado of ESTADOS) {
    const p = pinturaDaSerie(cor, estado, cores, variante, 1);
    const forte = p.pintada!.forte;
    for (const texto of [cores.texto, cores.textoSuave, cores.perigo, cores.atencao]) expect(contraste(texto, forte)).toBeGreaterThanOrEqual(4.5);
    for (const peca of [cores.bordaCampo, cores.sucesso, p.faixa!]) expect(contraste(peca, forte)).toBeGreaterThanOrEqual(3);
    expect(contraste(p.faixa!, cores.superficie)).toBeGreaterThanOrEqual(3);
    if (estado === 'ATIVA') expect(contraste(p.borda, forte)).toBeGreaterThanOrEqual(3);
  }
}

describe.each(VARIANTES)('séries pintadas no tema %s', (_nome, cores, variante) => {
  it.each(CHAVES_DE_IDENTIFICACAO)('cor do tipo %s', (chave) => {
    conferir(PALETA_DE_IDENTIFICACAO[variante][chave], cores, variante);
  });
  it.each(CODIGOS_DA_COR_DE_ACAO)('cor de ação %s', (opcao) => {
    for (const marca of MARCAS) {
      const comAcao = { ...cores, ...coresDaAcao(opcao, cores, variante, marca) };
      conferir(comAcao.acao, comAcao, variante);
      // Linha aberta do editor: só a faixa (cheia) sobre o fundo de edição, que segue a cor de ação da pessoa.
      const fundoDoBloco = coresDaEdicao(comAcao).fundoDoBloco;
      for (const cor of [comAcao.acao, ...CHAVES_DE_IDENTIFICACAO.map((c) => PALETA_DE_IDENTIFICACAO[variante][c])]) expect(contraste(cor, fundoDoBloco)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('pinturaDaSerie e corDaSerie', () => {
  const cores = PALETAS.ESCURO.cores;
  const identificacao = coresDeIdentificacao(cores, 'escuro');
  it('série sem cor: neutra, sem faixa; a ativa só ganha a borda de ação', () => {
    expect(pinturaDaSerie(null, 'APAGADA', cores, 'escuro', 1)).toEqual({ pintada: null, faixa: null, borda: cores.divisor, larguraDaBorda: 1 });
    expect(pinturaDaSerie(null, 'ATIVA', cores, 'escuro', 1)).toEqual({ pintada: null, faixa: null, borda: cores.acao, larguraDaBorda: 1.5 });
  });
  it('cheia na cor inteira; apagada mais fraca; ativa com a borda de ação, a reforçada vence', () => {
    const cor = PALETA_DE_IDENTIFICACAO.escuro.CIANO;
    const cheia = pinturaDaSerie(cor, 'CHEIA', cores, 'escuro', 1);
    const apagada = pinturaDaSerie(cor, 'APAGADA', cores, 'escuro', 1);
    expect(cheia.faixa).toBe(cor);
    expect(cheia.borda).toBe(cheia.pintada!.borda);
    expect(contraste(apagada.pintada!.forte, cores.superficie)).toBeLessThan(contraste(cheia.pintada!.forte, cores.superficie));
    expect(contraste(apagada.faixa!, cores.superficie)).toBeLessThan(contraste(cor, cores.superficie));
    expect(pinturaDaSerie(cor, 'ATIVA', cores, 'escuro', 2)).toMatchObject({ borda: cores.acao, larguraDaBorda: 2 });
  });
  it('modo do tipo: a cor e o selo do tipo; modo de ação: a cor de ação e o selo neutro; sem tipo, sem cor', () => {
    expect(corDaSerie('TIPO', 'AZUL', identificacao, cores)).toEqual({ cor: identificacao.AZUL.cor, categoria: identificacao.AZUL });
    expect(corDaSerie('ACAO', 'AZUL', identificacao, cores)).toEqual({ cor: cores.acao, categoria: null });
    expect(corDaSerie('ACAO', null, identificacao, cores)).toEqual({ cor: null, categoria: null });
    expect(corDaSerie('TIPO', 'AZUL', undefined, cores)).toEqual({ cor: null, categoria: null });
  });
});
