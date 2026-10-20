import { dataSemAnoCorrente, infoDoPlano, quandoPublicado, seloDoEditor } from './barraDoEditor';

const AGORA = new Date(2026, 9, 19, 20, 0);

describe('seloDoEditor', () => {
  it('o que acontece agora vem antes da publicação', () => {
    expect(seloDoEditor('pendente', null, { versao: 3, alterado: false })).toEqual({ texto: 'Alterações não salvas', tipo: 'atencao' });
    expect(seloDoEditor('salvando', null, null).texto).toBe('Salvando…');
    expect(seloDoEditor('erro', null, null).tipo).toBe('perigo');
    expect(seloDoEditor('conflito', null, null).texto).toBe('Alterado em outra aba');
    expect(seloDoEditor('dataInvalida', null, null).tipo).toBe('perigo');
  });

  it('modelo não tem publicação: só salvo', () => {
    expect(seloDoEditor('salvo', null, null)).toEqual({ texto: 'Salvo', tipo: 'sucesso' });
    expect(seloDoEditor('salvo', new Date(2026, 9, 19, 9, 5), null).texto).toBe('Salvo às 09:05');
  });

  it('plano salvo diz a relação com o que o aluno vê', () => {
    expect(seloDoEditor('salvo', null, { versao: 0, alterado: false })).toEqual({ texto: 'Ainda não publicado', tipo: 'atencao' });
    expect(seloDoEditor('salvo', null, { versao: 2, alterado: true })).toEqual({ texto: 'Rascunho diferente do publicado', tipo: 'atencao' });
    expect(seloDoEditor('salvo', null, { versao: 2, alterado: false })).toEqual({ texto: 'Publicado v2', tipo: 'sucesso' });
  });

  it('salvo nesta tela e ainda não publicado mostra a hora', () => {
    expect(seloDoEditor('salvo', new Date(2026, 9, 19, 14, 30), { versao: 1, alterado: true }).texto).toBe('Salvo às 14:30');
    // Publicou depois de salvar: vale a publicação.
    expect(seloDoEditor('salvo', new Date(2026, 9, 19, 14, 30), { versao: 2, alterado: false }).texto).toBe('Publicado v2');
  });
});

describe('infoDoPlano', () => {
  it('omite o ano corrente', () => {
    expect(dataSemAnoCorrente('19/10/2026', AGORA)).toBe('19/10');
    expect(dataSemAnoCorrente('19/10/2027', AGORA)).toBe('19/10/2027');
    expect(dataSemAnoCorrente('', AGORA)).toBe('');
  });

  it('período e publicação numa linha', () => {
    const publicado = new Date(2026, 9, 19, 18, 32).toISOString();
    expect(quandoPublicado(publicado, AGORA)).toBe('19/10 às 18:32');
    expect(infoDoPlano({ inicio: '19/10/2026', fim: '03/11/2026', daPasta: true, publicadoEm: publicado }, AGORA))
      .toBe('19/10 a 03/11 (da pasta) · publicado em 19/10 às 18:32');
    expect(infoDoPlano({ inicio: '', fim: '', daPasta: false, publicadoEm: null }, AGORA)).toBe('O aluno ainda não vê');
    expect(infoDoPlano({ inicio: '01/11/2026', fim: '', daPasta: false, publicadoEm: null }, AGORA)).toBe('01/11 a — · o aluno ainda não vê');
  });
});
