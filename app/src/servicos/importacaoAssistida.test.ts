import { requisicao } from '../api/cliente';
import { adicionarArquivo, adicionarTexto, atualizarGrupo, confirmarSessao, criarSessao, juntarGrupos } from './importacaoAssistida';

jest.mock('../api/cliente', () => ({ requisicao: jest.fn(() => Promise.resolve({})) }));

const BASE = '/importacoes/assistidas/sessoes';

describe('serviço da importação assistida', () => {
  it('cria a sessão sem corpo: "O que importar" saiu (D3)', async () => {
    await criarSessao();
    expect(requisicao).toHaveBeenLastCalledWith(BASE, { metodo: 'POST' });
  });

  it('o envio de arquivo e de texto espera 60 s; a confirmação, 120 s (0.5)', async () => {
    const dados = new FormData();
    await adicionarArquivo('s1', dados);
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/arquivos`, { metodo: 'POST', corpoBruto: dados, limiteMs: 60000 });
    await adicionarTexto('s1', '', 'Treino A');
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/textos`, { metodo: 'POST', corpo: { titulo: '', conteudo: 'Treino A' }, limiteMs: 60000 });
    await confirmarSessao('s1', ['g1'], 3, 'h3', 'chave');
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/confirmar`, {
      metodo: 'POST',
      corpo: { gruposIds: ['g1'], revisaoEsperada: 3, hashPrevia: 'h3', chaveIdempotencia: 'chave' },
      limiteMs: 120000,
    });
  });

  it('corrige o cadastro pelo PUT do aluno e junta dois alunos pelo POST de juntar', async () => {
    await atualizarGrupo('s1', 'g1', { email: 'aluna@exemplo.test', telefone: '' });
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/grupos/g1`, { metodo: 'PUT', corpo: { email: 'aluna@exemplo.test', telefone: '' } });
    await juntarGrupos('s1', 'g1', 'g2');
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/grupos/g1/juntar`, { metodo: 'POST', corpo: { comGrupoId: 'g2' } });
    await juntarGrupos('s1', 'g1', ['g2', 'g3']);
    expect(requisicao).toHaveBeenLastCalledWith(`${BASE}/s1/grupos/g1/juntar`, { metodo: 'POST', corpo: { comGruposIds: ['g2', 'g3'] } });
  });
});
