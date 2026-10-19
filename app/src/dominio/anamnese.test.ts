import { linhaDaAnamnese, mostrarCartaoAnamnese, respostasIniciais, seloDaAnamnese, temPendente } from './anamnese';

describe('anamnese', () => {
  it('selo com cor de significado, diferente para o aluno e para a equipe', () => {
    expect(seloDaAnamnese('PENDENTE')).toEqual({ texto: 'Aguardando o aluno', tipo: 'atencao' });
    expect(seloDaAnamnese('PENDENTE', true)).toEqual({ texto: 'Para responder', tipo: 'atencao' });
    expect(seloDaAnamnese('ENVIADA')).toEqual({ texto: 'Para revisar', tipo: 'atencao' });
    expect(seloDaAnamnese('ENVIADA', true).tipo).toBe('sucesso');
    expect(seloDaAnamnese('REVISADA').tipo).toBe('sucesso');
    expect(seloDaAnamnese('DISPENSADA').tipo).toBe('neutro');
  });
  it('uma pendente por aluno', () => {
    expect(temPendente([{ situacao: 'ENVIADA' }, { situacao: 'DISPENSADA' }])).toBe(false);
    expect(temPendente([{ situacao: 'PENDENTE' }])).toBe(true);
  });
  it('linha de datas mostra o último marco', () => {
    const base = { atribuidaEm: '2026-10-01T12:00:00Z', enviadaEm: '2026-10-03T12:00:00Z', revisadaEm: '2026-10-04T12:00:00Z', dispensadaEm: null };
    expect(linhaDaAnamnese({ ...base, situacao: 'PENDENTE' })).toBe('Enviada ao aluno em 01/10/2026');
    expect(linhaDaAnamnese({ ...base, situacao: 'REVISADA' })).toBe('Respondida em 03/10/2026 · revisada em 04/10/2026');
    expect(linhaDaAnamnese({ ...base, situacao: 'DISPENSADA' })).toBe('Dispensada em —');
  });
  it('cartão do início só com pendente', () => {
    expect(mostrarCartaoAnamnese({ situacao: 'PENDENTE' })).toBe(true);
    expect(mostrarCartaoAnamnese({ situacao: 'ENVIADA' })).toBe(false);
    expect(mostrarCartaoAnamnese(null)).toBe(false);
  });
  it('o rascunho só vale para a mesma versão; enviada abre com as enviadas', () => {
    const a = { situacao: 'PENDENTE' as const, questionarioVersaoId: 'v1', respostas: {} };
    const rascunho = { questionarioVersaoId: 'v1', respostas: { x: 'fictício' }, fotosLocais: { f: ['a.jpg'] } };
    expect(respostasIniciais(a, rascunho)).toEqual({ respostas: { x: 'fictício' }, locais: { f: ['a.jpg'] } });
    expect(respostasIniciais(a, { ...rascunho, questionarioVersaoId: 'v2' })).toEqual({ respostas: {}, locais: {} });
    expect(respostasIniciais({ ...a, situacao: 'ENVIADA', respostas: { y: true } }, rascunho)).toEqual({ respostas: { y: true }, locais: {} });
  });
});
