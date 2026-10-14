import { textoDosProblemas, uidsDoPrimeiroProblema } from './problemasDoPlano';

const conteudo = {
  sessoes: [
    { uid: 's1', nome: 'Segunda', exercicios: [{ uid: 'e1', nome: 'Remada', series: [{ uid: 'x1' }] }] },
    { uid: 's2', nome: 'Terça', exercicios: [{ uid: 'e2', nome: 'Supino', series: [] }] },
  ],
};

describe('problemasDoPlano', () => {
  it('conta os problemas no singular e no plural, e não diz nada sem erro', () => {
    expect(textoDosProblemas(0)).toBe('');
    expect(textoDosProblemas(1)).toBe('1 problema para publicar');
    expect(textoDosProblemas(3)).toBe('3 problemas para publicar');
  });

  it('o primeiro problema devolve os uids do mais específico para o mais geral', () => {
    const erros = [{ caminho: 'sessoes[1].exercicios[0].series', mensagem: 'x' }, { caminho: 'sessoes[0]', mensagem: 'y' }];
    expect(uidsDoPrimeiroProblema(conteudo, erros)).toEqual(['e2', 's2']);
  });

  it('erro sem item (período) ou lista vazia não aponta lugar nenhum', () => {
    expect(uidsDoPrimeiroProblema(conteudo, [{ caminho: 'fim', mensagem: 'z' }])).toEqual([]);
    expect(uidsDoPrimeiroProblema(conteudo, [])).toEqual([]);
  });
});
