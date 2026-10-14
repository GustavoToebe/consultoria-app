import { LIMITE_LOTE, mensagemDaConfirmacao, textoDaSelecao, textoDoResultado } from './loteDeAlunos';

describe('loteDeAlunos', () => {
  it('conta os marcados no singular e no plural', () => {
    expect(textoDaSelecao(0)).toContain('Nenhum aluno marcado');
    expect(textoDaSelecao(1)).toBe(`1 aluno marcado (até ${LIMITE_LOTE} por vez).`);
    expect(textoDaSelecao(7)).toBe(`7 alunos marcados (até ${LIMITE_LOTE} por vez).`);
  });

  it('o resultado diz quantos mudaram e quantos já estavam assim', () => {
    expect(textoDoResultado('responsavel', { selecionados: 3, alterados: 3 })).toBe('3 alunos atualizados.');
    expect(textoDoResultado('responsavel', { selecionados: 3, alterados: 1 })).toBe('1 aluno atualizado. 2 já estavam assim.');
    expect(textoDoResultado('questionario', { selecionados: 2, alterados: 1 })).toBe('1 aluno atualizado. 1 já estava assim.');
    expect(textoDoResultado('desativar', { selecionados: 2, alterados: 2 })).toBe('2 alunos desativados.');
    expect(textoDoResultado('desativar', { selecionados: 1, alterados: 1 })).toBe('1 aluno desativado.');
  });

  it('sem mudança nenhuma não diz que atualizou', () => {
    expect(textoDoResultado('desativar', { selecionados: 2, alterados: 0 })).toContain('já estavam inativos');
    expect(textoDoResultado('responsavel', { selecionados: 2, alterados: 0 })).toContain('Nenhuma mudança');
  });

  it('desativar avisa que as sessões são encerradas', () => {
    expect(mensagemDaConfirmacao('desativar', 3)).toContain('sessões abertas deles são encerradas');
    expect(mensagemDaConfirmacao('desativar', 1)).toContain('sessões abertas dele são encerradas');
    expect(mensagemDaConfirmacao('responsavel', 2)).toContain('2 alunos');
    expect(mensagemDaConfirmacao('questionario', 1)).toContain('1 aluno passa');
  });
});
