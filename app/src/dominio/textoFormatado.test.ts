import { linhaFormatada, textoFormatado, textoSemMarcas } from './textoFormatado';

const t = (texto: string, negrito = false, sublinhado = false) => ({ texto, negrito, sublinhado });

describe('textoFormatado', () => {
  it('texto simples vira um trecho sem formato', () => {
    expect(linhaFormatada('Bem-vindo à consultoria.')).toEqual([t('Bem-vindo à consultoria.')]);
  });

  it('reconhece negrito e sublinhado no meio da linha', () => {
    expect(linhaFormatada('Leia **com atenção** e __responda tudo__.')).toEqual([
      t('Leia '), t('com atenção', true), t(' e '), t('responda tudo', false, true), t('.'),
    ]);
  });

  it('combina os dois marcadores, em qualquer ordem', () => {
    expect(linhaFormatada('**__importante__**')).toEqual([t('importante', true, true)]);
    expect(linhaFormatada('__**importante**__ agora')).toEqual([t('importante', true, true), t(' agora')]);
    expect(linhaFormatada('**tudo __isto__ junto**')).toEqual([t('tudo ', true), t('isto', true, true), t(' junto', true)]);
  });

  it('marcador sem par fica como texto', () => {
    expect(linhaFormatada('2 ** 3 é potência')).toEqual([t('2 ** 3 é potência')]);
    expect(linhaFormatada('**negrito** e ** solto')).toEqual([t('negrito', true), t(' e ** solto')]);
    expect(linhaFormatada('nome_do__arquivo')).toEqual([t('nome_do__arquivo')]);
  });

  it('par sem nada dentro fica como texto (linha de preencher)', () => {
    expect(linhaFormatada('Assinatura: ______')).toEqual([t('Assinatura: ______')]);
    expect(linhaFormatada('****')).toEqual([t('****')]);
    expect(linhaFormatada('** ** e **ok**')).toEqual([t('** ** e '), t('ok', true)]);
  });

  it('o marcador não atravessa a quebra de linha', () => {
    expect(textoFormatado('**começo\nfim**')).toEqual([[[t('**começo')], [t('fim**')]]]);
  });

  it('linhas seguidas formam um parágrafo; linha em branco separa', () => {
    expect(textoFormatado('Regra 1\nRegra 2\n\n\nObrigado!')).toEqual([[[t('Regra 1')], [t('Regra 2')]], [[t('Obrigado!')]]]);
    expect(textoFormatado('\r\nA\r\n\r\nB')).toEqual([[[t('A')]], [[t('B')]]]);
  });

  it('vazio, só espaços ou nulo não tem parágrafo', () => {
    expect(textoFormatado('')).toEqual([]);
    expect(textoFormatado('  \n \n')).toEqual([]);
    expect(textoFormatado(null)).toEqual([]);
  });

  it('textoSemMarcas tira só as marcas pareadas', () => {
    expect(textoSemMarcas('**A** e __B__\n2 ** 3\n\nC')).toBe('A e B\n2 ** 3\n\nC');
  });
});
