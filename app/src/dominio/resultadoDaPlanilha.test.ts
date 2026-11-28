// resultado da importação (23/11): leitura do histórico, classificação, contagem por linha, abas e texto para copiar.
import { PROBLEMAS } from './planilhaCompleta';
import {
  CODIGOS_AJUSTADOS, CODIGOS_QUE_FICAM_DE_FORA, abasDoResultado, classeDoProblema, lerProblemas, linhasVisiveis, problemasSemDetalhe,
  resumoDosProblemas, textoDaListaDeProblemas, tituloDaAba,
} from './resultadoDaPlanilha';

const ERROS = [
  { linha: 4, campo: 'DATA', motivo: 'Histórico Pesos: SEM_DATA' },
  { linha: 3, campo: 'KCAL', motivo: 'Refeições: ITEM_SEM_KCAL' },
  { linha: 5, campo: 'KCAL', motivo: 'Refeições: ITEM_SEM_KCAL' },
  { linha: 5, campo: 'ALIMENTO', motivo: 'Refeições: ITEM_SEM_ALIMENTO' },
  { linha: 3, campo: 'KCAL', motivo: 'Refeições: ITEM_SEM_KCAL' },
];

test('resultado da importação (23/11): todo código conhecido tem uma classe só', () => {
  for (const codigo of Object.keys(PROBLEMAS)) {
    expect([CODIGOS_AJUSTADOS.has(codigo), CODIGOS_QUE_FICAM_DE_FORA.has(codigo)].filter(Boolean)).toHaveLength(1);
  }
  expect([...CODIGOS_AJUSTADOS, ...CODIGOS_QUE_FICAM_DE_FORA].every((c) => c in PROBLEMAS)).toBe(true);
});

test('resultado da importação (23/11): classe pelo código; desconhecido é "Ajustado"', () => {
  expect(classeDoProblema('ITEM_SEM_KCAL')).toBe('AJUSTADO');
  expect(classeDoProblema('SEM_DATA')).toBe('FORA');
  expect(classeDoProblema('CODIGO_NOVO_DA_API')).toBe('AJUSTADO');
});

test('importação (28/11, D7): situação desconhecida entra ativa e é "Ajustado", com texto próprio', () => {
  expect(classeDoProblema('STATUS_NAO_RECONHECIDO')).toBe('AJUSTADO');
  const [aba] = abasDoResultado(lerProblemas([{ linha: 7, campo: 'STATUS', motivo: 'Alunos: STATUS_NAO_RECONHECIDO' }]));
  expect(aba.grupos[0].texto).toBe('Situação não reconhecida: o aluno entrou como ativo. Confira.');
});

test('resultado da importação (23/11): o nome da aba acentuado volta inteiro', () => {
  expect(lerProblemas(ERROS).slice(0, 2)).toEqual([
    { aba: 'Histórico Pesos', linha: 4, codigo: 'SEM_DATA' },
    { aba: 'Refeições', linha: 3, codigo: 'ITEM_SEM_KCAL' },
  ]);
  expect(lerProblemas([{ linha: 2, campo: '', motivo: 'Notas: 2026: ALUNO_FORA' }])).toEqual([{ aba: 'Notas: 2026', linha: 2, codigo: 'ALUNO_FORA' }]);
  expect(lerProblemas([{ linha: 2, campo: '', motivo: 'ALUNO_FORA' }])).toEqual([{ aba: 'Planilha', linha: 2, codigo: 'ALUNO_FORA' }]);
});

test('resultado da importação (23/11): conta linhas distintas e a de fora não conta como ajustada', () => {
  // Refeições 3 (ajuste, repetido), Refeições 5 (ajuste e de fora = de fora), Histórico Pesos 4 (de fora).
  expect(resumoDosProblemas(lerProblemas(ERROS))).toEqual({ ajustadas: 1, fora: 2 });
  expect(resumoDosProblemas([])).toEqual({ ajustadas: 0, fora: 0 });
});

test('resultado da importação (23/11): por aba, de fora primeiro, linhas em ordem e sem repetir', () => {
  const abas = abasDoResultado(lerProblemas(ERROS));
  expect(abas.map((a) => [a.aba, a.linhas])).toEqual([['Histórico Pesos', 1], ['Refeições', 2]]);
  expect(abas[1].grupos).toEqual([
    { codigo: 'ITEM_SEM_ALIMENTO', texto: 'Item da dieta sem alimento.', classe: 'FORA', linhas: [5] },
    { codigo: 'ITEM_SEM_KCAL', texto: 'Item sem calorias: fica "—".', classe: 'AJUSTADO', linhas: [3, 5] },
  ]);
  expect(tituloDaAba(abas[1])).toBe('Aba “Refeições” · 2 linhas');
  expect(tituloDaAba({ aba: 'Histórico Pesos', linhas: 1 })).toBe('Aba “Histórico Pesos” · 1 linha');
});

test('resultado da importação (23/11): 8 linhas e "e mais N"; todas quando pedido', () => {
  const linhas = Array.from({ length: 25 }, (_, i) => i + 2);
  expect(linhasVisiveis(linhas, false)).toEqual({ mostradas: [2, 3, 4, 5, 6, 7, 8, 9], resto: 17 });
  expect(linhasVisiveis(linhas, true)).toEqual({ mostradas: linhas, resto: 0 });
  expect(linhasVisiveis([1, 2, 3, 4, 5, 6, 7, 8], false)).toEqual({ mostradas: [1, 2, 3, 4, 5, 6, 7, 8], resto: 0 });
});

test('resultado da importação (23/11): texto para copiar, por aba, com todas as linhas e o que o histórico não guardou', () => {
  const muitas = Array.from({ length: 12 }, (_, i) => ({ linha: i + 2, campo: 'KCAL', motivo: 'Refeições: ITEM_SEM_KCAL' }));
  const abas = abasDoResultado(lerProblemas([{ linha: 4, campo: 'DATA', motivo: 'Histórico Pesos: SEM_DATA' }, ...muitas]));
  expect(textoDaListaDeProblemas(abas, { titulo: 'Problemas da importação', semDetalhe: 0 })).toBe([
    'Problemas da importação',
    '',
    'Aba “Histórico Pesos” · 1 linha',
    '- Sem data. (Ficou de fora) Linha: 4',
    '',
    'Aba “Refeições” · 12 linhas',
    '- Item sem calorias: fica "—". (Ajustado) Linhas: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13',
  ].join('\n'));
  expect(textoDaListaDeProblemas([], { titulo: 'T', semDetalhe: 1234 })).toBe('T\n\nE mais 1.234 problemas que o histórico não guardou (ele guarda os primeiros 1.000).');
  expect(problemasSemDetalhe(1258, 1000)).toBe(258);
  expect(problemasSemDetalhe(3, 3)).toBe(0);
});
