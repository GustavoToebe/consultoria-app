import { linhasDoComplemento } from './linhasDoComplemento';

describe('linhas da dose, horário e observação (dieta do aluno, A10)', () => {
  it('uma linha por informação, com o rótulo, na ordem dose, horário, observação', () => {
    expect(linhasDoComplemento({ dose: '2 cápsulas', horario: '08:00', observacao: 'Com água' })).toEqual(['Dose: 2 cápsulas', 'Horário: 08:00', 'Observação: Com água']);
  });

  it('só as preenchidas; espaço em branco não conta', () => {
    expect(linhasDoComplemento({ dose: null, horario: '  ', observacao: 'Antes de dormir' })).toEqual(['Observação: Antes de dormir']);
    expect(linhasDoComplemento({ horario: '22:00' })).toEqual(['Horário: 22:00']);
  });

  it('nada preenchido: lista vazia (a tela mostra "—")', () => {
    expect(linhasDoComplemento({})).toEqual([]);
    expect(linhasDoComplemento({ dose: '', horario: null, observacao: undefined })).toEqual([]);
  });

  it('o texto do treinador vai como está (sem conta nem unidade inventada)', () => {
    expect(linhasDoComplemento({ dose: '0,5 ml' })).toEqual(['Dose: 0,5 ml']);
  });
});
