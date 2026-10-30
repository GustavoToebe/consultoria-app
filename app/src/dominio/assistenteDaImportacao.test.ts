import {
  ajustarCelula, ajustesParaApi, alternarRemovida, avisoDoCorte, celulaAjustada, errosNaTabela, linhasDaPlanilha, opcoesDoCampoDaColuna,
  paginaDaPlanilha, rotuloNaLista, SEM_AJUSTES, totalDeAjustes, valorDaCelula,
  LINHA_DO_CABECALHO_MAXIMA, LINHA_DO_CABECALHO_PADRAO, opcoesDaLinhaDoCabecalho, primeiraLinhaDeDados,
  campoDaColuna, camposPermitidos, escolherCampoDaColuna, explicacaoDosExistentes, juntar, motivoParaNaoContinuar,
  resumoDaValidacao, tamanhoParaTela, textoDoErro, textoDoQueVaiAcontecer, tipoDoArquivo, type EstadoDoAssistente,
} from './assistenteDaImportacao';
import { DESTINOS } from './mapeamentoDaImportacao';

const ALUNOS = DESTINOS.find((d) => d.id === 'alunos')!;
const EXERCICIOS = DESTINOS.find((d) => d.id === 'exercicios')!;

const estado = (mudar: Partial<EstadoDoAssistente> = {}): EstadoDoAssistente => ({
  destino: EXERCICIOS, arquivo: { nome: 'exercicios.xlsx' }, lendo: false, temColunas: true, chave: 'nome', mapa: { nome: 0 }, ...mudar,
});

describe('assistente da importação', () => {
  it('aceita só .xlsx e .csv, sem diferença de caixa; .xls antigo não', () => {
    expect(tipoDoArquivo('Alunos.XLSX')).toBe('Excel');
    expect(tipoDoArquivo('alunos.csv ')).toBe('CSV');
    expect(tipoDoArquivo('alunos.xls')).toBeNull();
    expect(tipoDoArquivo('alunos.pdf')).toBeNull();
  });

  it('mostra o tamanho em bytes, KB ou MB com vírgula', () => {
    expect(tamanhoParaTela(850)).toBe('850 bytes');
    expect(tamanhoParaTela(12 * 1024)).toBe('12 KB');
    expect(tamanhoParaTela(1.25 * 1024 * 1024)).toBe('1,3 MB');
    expect(tamanhoParaTela(undefined)).toBeNull();
    expect(tamanhoParaTela(-1)).toBeNull();
  });

  it('escolher o campo de uma coluna tira o campo da coluna anterior e a coluna do campo anterior', () => {
    const mapa = { nome: 0, grupo: 1, equipamento: null };
    expect(campoDaColuna(mapa, 1)).toBe('grupo');
    expect(campoDaColuna(mapa, 2)).toBeNull();
    const trocado = escolherCampoDaColuna(mapa, 1, 'nome');
    expect(trocado).toEqual({ nome: 1, grupo: null, equipamento: null });
    expect(escolherCampoDaColuna(trocado, 1, null)).toEqual({ nome: null, grupo: null, equipamento: null });
    expect(escolherCampoDaColuna(mapa, 2, 'equipamento')).toEqual({ nome: 0, grupo: 1, equipamento: 2 });
  });

  it('sem a permissão de dado sensível, os campos sensíveis não aparecem para escolher', () => {
    const ids = camposPermitidos(ALUNOS, false).map((c) => c.id);
    expect(ids).toContain('nome');
    expect(ids).not.toContain('cpf');
    expect(camposPermitidos(ALUNOS, true).map((c) => c.id)).toContain('cpf');
  });

  it('diz por que não dá para continuar em cada etapa', () => {
    expect(motivoParaNaoContinuar(1, estado({ destino: null }))).toBe('Escolha o que vai importar.');
    expect(motivoParaNaoContinuar(1, estado({ arquivo: null }))).toBe('Escolha o arquivo da planilha.');
    expect(motivoParaNaoContinuar(1, estado({ arquivo: { nome: 'velho.xls' } }))).toBe('Envie um arquivo .xlsx ou .csv.');
    expect(motivoParaNaoContinuar(1, estado())).toBeNull();
    expect(motivoParaNaoContinuar(2, estado({ lendo: true }))).toBe('Aguarde a leitura da planilha.');
    expect(motivoParaNaoContinuar(2, estado({ temColunas: false }))).toBe('A planilha ainda não foi lida.');
    expect(motivoParaNaoContinuar(3, estado({ mapa: { nome: null } }))).toBe('Escolha a coluna de Nome.');
    expect(motivoParaNaoContinuar(3, estado({ destino: ALUNOS, chave: 'email', mapa: { nome: null, email: null } })))
      .toBe('Escolha a coluna de Nome e E-mail.');
    expect(motivoParaNaoContinuar(3, estado())).toBeNull();
  });

  it('junta nomes em português', () => {
    expect(juntar([])).toBe('');
    expect(juntar(['Nome'])).toBe('Nome');
    expect(juntar(['Nome', 'E-mail', 'Data'])).toBe('Nome, E-mail e Data');
  });

  it('explica cada regra do que já existe', () => {
    expect(explicacaoDosExistentes('ATUALIZAR')).toContain('célula vazia não apaga');
    expect(explicacaoDosExistentes('COMPLETAR')).toContain('vazio');
    expect(explicacaoDosExistentes('X')).toBe('');
  });

  it('resume a validação em total, com erro e corretas', () => {
    expect(resumoDaValidacao({ linhas: 17, comErro: 2 })).toEqual({ total: 17, comErro: 2, corretas: 15 });
    expect(resumoDaValidacao({ linhas: 0, comErro: 0 })).toEqual({ total: 0, comErro: 0, corretas: 0 });
  });

  it('diz o que a confirmação faz sem chamar ignoradas de criadas', () => {
    expect(textoDoQueVaiAcontecer({ novos: 2, atualizados: 1, ignorados: 3 }))
      .toBe('Ao confirmar, a importação vai criar 2 registros e atualizar 1. 3 linhas já existem e ficam como estão.');
    expect(textoDoQueVaiAcontecer({ novos: 1, atualizados: 0, ignorados: 1 }))
      .toBe('Ao confirmar, a importação vai criar 1 registro. 1 linha já existe e fica como está.');
    expect(textoDoQueVaiAcontecer({ novos: 0, atualizados: 0, ignorados: 0 })).toBe('Ao confirmar, nada será criado nem atualizado.');
  });

  it('o erro traz a linha, o campo pelo rótulo e a coluna de origem', () => {
    expect(textoDoErro({ linha: 4, campo: 'nome', motivo: 'Informe o nome.' }, ALUNOS, ['Aluno', 'E-mail'], { nome: 0 }))
      .toBe('Linha 4 · Nome (coluna “Aluno”): Informe o nome.');
    expect(textoDoErro({ linha: 5, campo: 'email', motivo: 'E-mail inválido.' }, ALUNOS, ['Aluno'], { email: null }))
      .toBe('Linha 5 · E-mail: E-mail inválido.');
    expect(textoDoErro({ linha: 6, campo: 'linha', motivo: 'Vaga do plano.' }, ALUNOS, [], {})).toBe('Linha 6 · linha: Vaga do plano.');
  });
});

describe('linha do cabeçalho', () => {
  it('oferece Nenhuma e as linhas de 1 ao teto da API, com o número como valor', () => {
    const opcoes = opcoesDaLinhaDoCabecalho();
    expect(opcoes[0]).toEqual({ valor: 0, rotulo: 'Nenhuma' });
    expect(opcoes[1]).toEqual({ valor: 1, rotulo: 'Linha 1' });
    expect(opcoes).toHaveLength(LINHA_DO_CABECALHO_MAXIMA + 1);
    expect(opcoes[opcoes.length - 1]).toEqual({ valor: 50, rotulo: 'Linha 50' });
    expect(opcoes.map((o) => o.valor)).toContain(LINHA_DO_CABECALHO_PADRAO);
  });

  it('a primeira linha de dados é a seguinte ao cabeçalho, ou a 1 sem cabeçalho', () => {
    expect(primeiraLinhaDeDados(0)).toBe(1);
    expect(primeiraLinhaDeDados(1)).toBe(2);
    expect(primeiraLinhaDeDados(4)).toBe(5);
  });
});

describe('tabela do mapeamento', () => {
  const AMOSTRA = [['Ana Fictícia', 'ana@exemplo.test'], ['Bia Fictícia', 'nao-e-email'], ['Caio Fictício', 'caio@exemplo.test']];

  it('rótulo com grupo e opções com "Não importar" primeiro, obrigatório e onde o campo já está', () => {
    const nome = ALUNOS.campos.find((c) => c.id === 'nome')!;
    const cep = ALUNOS.campos.find((c) => c.id === 'cep')!;
    expect(rotuloNaLista(nome)).toBe('Cadastro > Nome');
    expect(rotuloNaLista(cep)).toBe('Endereço > CEP');
    expect(rotuloNaLista(EXERCICIOS.campos[0])).toBe('Nome');
    const opcoes = opcoesDoCampoDaColuna(ALUNOS.campos, { email: 1 }, 0, (i) => ['Aluno', 'Contato'][i]);
    expect(opcoes[0]).toEqual({ valor: null, rotulo: 'Não importar' });
    expect(opcoes.find((o) => o.valor === 'nome')?.detalhe).toBe('Obrigatório');
    expect(opcoes.find((o) => o.valor === 'email')?.detalhe).toBe('Hoje na coluna “Contato”');
  });

  it('numera pelo arquivo, busca sem acento em qualquer célula ou pelo número e esconde as tiradas', () => {
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 5], 1, '').map((l) => l.numero)).toEqual([2, 3, 5]);
    expect(linhasDaPlanilha(AMOSTRA, undefined, 1, '').map((l) => l.numero)).toEqual([2, 3, 4]);
    expect(linhasDaPlanilha(AMOSTRA, undefined, 3, '').map((l) => l.numero)).toEqual([4, 5, 6]);
    expect(linhasDaPlanilha(AMOSTRA, undefined, 0, '').map((l) => l.numero)).toEqual([1, 2, 3]);
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 4], 1, 'ficticio').map((l) => l.numero)).toEqual([4]);
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 4], 1, '3').map((l) => l.numero)).toEqual([3]);
    const tirada = alternarRemovida(SEM_AJUSTES, 3);
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 4], 1, '', tirada).map((l) => l.numero)).toEqual([2, 4]);
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 4], 1, '', SEM_AJUSTES, new Set([3])).map((l) => l.numero)).toEqual([3]);
  });

  it('pagina de 50 em 50 e puxa a página para dentro quando a busca encolhe a lista', () => {
    const muitas = Array.from({ length: 120 }, (_, i) => ({ numero: i + 2, valores: [`L${i}`] }));
    expect(paginaDaPlanilha(muitas, 0)).toMatchObject({ pagina: 0, total: 3 });
    expect(paginaDaPlanilha(muitas, 2).linhas).toHaveLength(20);
    expect(paginaDaPlanilha(muitas.slice(0, 10), 2)).toMatchObject({ pagina: 0, total: 1 });
    expect(paginaDaPlanilha([], 0)).toMatchObject({ pagina: 0, total: 1, linhas: [] });
  });

  it('aviso só quando a amostra não trouxe todas as linhas', () => {
    expect(avisoDoCorte({ linhas: 3, amostra: [1, 2, 3], amostraCortada: false })).toBeNull();
    expect(avisoDoCorte({ linhas: 1500, amostra: new Array(1000), amostraCortada: true }))
      .toBe('Mostrando as primeiras 1000 de 1500 linhas. A validação confere todas.');
  });

  it('ajuste de célula: troca o texto, volta ao original quando igual e entra na busca', () => {
    let ajustes = ajustarCelula(SEM_AJUSTES, 3, 1, 'bia@exemplo.test', 'nao-e-email');
    expect(valorDaCelula(ajustes, 3, 1, 'nao-e-email')).toBe('bia@exemplo.test');
    expect(celulaAjustada(ajustes, 3, 1)).toBe(true);
    expect(linhasDaPlanilha(AMOSTRA, [2, 3, 4], 1, 'bia@exemplo', ajustes).map((l) => l.numero)).toEqual([3]);
    ajustes = ajustarCelula(ajustes, 3, 1, 'nao-e-email', 'nao-e-email');
    expect(celulaAjustada(ajustes, 3, 1)).toBe(false);
    expect(ajustes.celulas).toEqual({});
  });

  it('para a API: listas ordenadas e célula de linha tirada não vai', () => {
    let ajustes = ajustarCelula(SEM_AJUSTES, 4, 0, 'Caio', 'Caio Fictício');
    ajustes = ajustarCelula(ajustes, 3, 1, 'x@exemplo.test', 'nao-e-email');
    ajustes = alternarRemovida(alternarRemovida(ajustes, 9), 4);
    expect(ajustesParaApi(ajustes)).toEqual({ celulas: [{ linha: 3, coluna: 1, valor: 'x@exemplo.test' }], removidas: [4, 9] });
    expect(totalDeAjustes(ajustes)).toEqual({ celulas: 1, removidas: 2 });
    expect(ajustesParaApi(alternarRemovida(ajustes, 4)).removidas).toEqual([9]);
  });

  it('erros da validação vão para a célula da coluna mapeada; sem coluna, para a linha', () => {
    const t = errosNaTabela([
      { linha: 3, campo: 'email', motivo: 'E-mail inválido.' },
      { linha: 4, campo: 'cpf', motivo: 'CPF inválido.' },
    ], { nome: 0, email: 1 });
    expect(t.motivoDaCelula(3, 1)).toBe('E-mail inválido.');
    expect(t.motivoDaCelula(3, 0)).toBeNull();
    expect(t.motivosDaLinha(4)).toEqual(['CPF inválido.']);
    expect([...t.linhas]).toEqual([3, 4]);
  });
});
