import {
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
