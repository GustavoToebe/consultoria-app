/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import type { AlunoDetalhe, AlunoRequest } from '../api/tipos';
import { GuardaDeSaida, useSaidaGuardada } from '../ui/GuardaDeSaida';
import { FormAluno } from './FormAluno';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ addListener: () => () => undefined }),
  usePathname: () => '/treinador/alunos/novo',
}));
jest.mock('../sessao/SessaoProvider', () => ({
  useSessao: () => ({ pode: () => true, usuario: { id: 'u1', papel: 'TREINADOR', nome: 'Quem cadastra' } }),
}));
jest.mock('../ui/useAvisoDoPlano', () => ({ useAvisoDoPlano: () => () => false }));
jest.mock('../ui/useCarregar', () => ({
  useCarregar: () => ({
    dados: [{ id: 'u1', nome: 'Quem cadastra' }, { id: 'u2', nome: 'Outra pessoa' }],
    erro: null,
    recarregar: jest.fn(),
  }),
}));
jest.mock('../api/rotas', () => ({ responsaveisEquipe: jest.fn() }));
jest.mock('../ui/Permitido', () => ({
  Permitido: ({ children }: { children?: ReactNode }) => children ?? null,
}));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Campo', () => ({
  Campo: ({ rotulo, aoMudar }: { rotulo: string; aoMudar?: (valor: string) => void }) =>
    require('react').createElement(require('react-native').Pressable, {
      accessibilityLabel: rotulo,
      onPress: () => aoMudar?.('Ana Amostra'),
    }),
}));
jest.mock('../ui/CamposDeEndereco', () => ({ CamposDeEndereco: () => null }));
// Tocar no campo de data apaga o que estava escrito (o suficiente para conferir o envio).
jest.mock('../ui/Campos', () => ({
  CampoData: ({ rotulo, aoMudar, erro }: { rotulo: string; aoMudar: (valor: string) => void; erro?: string | null }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, accessibilityHint: erro ?? undefined, onPress: () => aoMudar('') }),
}));
jest.mock('../ui/Estados', () => ({ MensagemErro: () => null }));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar, desabilitado }: { rotulo: string; aoTocar: () => void; desabilitado?: boolean }) =>
    require('react').createElement(require('react-native').Pressable, {
      accessibilityLabel: rotulo,
      accessibilityState: { disabled: !!desabilitado },
      onPress: () => { if (!desabilitado) aoTocar(); },
    }),
}));
jest.mock('../ui/Escolha', () => ({
  Escolha: ({ rotulo, opcoes, valor, aoMudar }: { rotulo: string; opcoes: { valor: string; rotulo: string }[]; valor: string; aoMudar: (valor: string) => void }) =>
    require('react').createElement(require('react-native').View, { accessibilityLabel: rotulo },
      opcoes.map((opcao) => require('react').createElement(require('react-native').Pressable, {
        key: `${rotulo}-${opcao.valor}`,
        accessibilityLabel: opcao.rotulo,
        accessibilityState: { selected: opcao.valor === valor },
        onPress: () => aoMudar(opcao.valor),
      }))),
}));
jest.mock('../ui/PainelConfirmacao', () => ({
  PainelConfirmacao: (p: { visivel: boolean; titulo: string }) =>
    p.visivel ? require('react').createElement(require('react-native').Text, { accessibilityLabel: p.titulo }, p.titulo) : null,
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

function aluno(parcial: Partial<AlunoDetalhe> = {}): AlunoDetalhe {
  return {
    id: 'aluno-1', nome: 'Ana Amostra', email: null, ativo: true, temAcesso: false, conviteExpiraEm: null,
    versao: 1, diasAtualizacao: null, anonimizado: false, emailDeAcesso: null, aguardandoPrimeiroAcesso: false,
    responsavelId: null, ...parcial,
  };
}

let saiu = false;

function Sonda() {
  const { confirmar } = useSaidaGuardada();
  return <Pressable accessibilityLabel="Sair da edição" onPress={() => confirmar(() => { saiu = true; })} />;
}

function alvoDe(raiz: import('react-test-renderer').ReactTestRenderer, rotulo: string) {
  const alvo = raiz.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function').at(-1);
  if (!alvo) throw new Error(`Não achei “${rotulo}”.`);
  return alvo;
}

function tocar(raiz: import('react-test-renderer').ReactTestRenderer, rotulo: string) {
  const alvo = alvoDe(raiz, rotulo);
  Renderer.act(() => { (alvo.props.onPress as () => void)(); });
}

async function tocarEEsperar(raiz: import('react-test-renderer').ReactTestRenderer, rotulo: string) {
  const alvo = alvoDe(raiz, rotulo);
  await Renderer.act(async () => {
    (alvo.props.onPress as () => void)();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function escolhida(raiz: import('react-test-renderer').ReactTestRenderer, rotulo: string) {
  const grupo = raiz.root.findByProps({ accessibilityLabel: 'Treinador responsável' });
  const opcao = grupo.findAll((n) => n.props.accessibilityLabel === rotulo && n.props.accessibilityState).at(-1);
  if (!opcao) throw new Error(`Não achei “${rotulo}”.`);
  return opcao.props.accessibilityState.selected === true;
}

async function montar(inicial?: AlunoDetalhe) {
  saiu = false;
  const aoSalvar = jest.fn((_dados: AlunoRequest) => Promise.resolve());
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    raiz = Renderer.create(
      <GuardaDeSaida>
        <FormAluno inicial={inicial} rotuloSalvar={inicial ? 'Salvar' : 'Cadastrar'} aoSalvar={aoSalvar} />
        <Sonda />
      </GuardaDeSaida>,
    );
  });
  return { raiz, aoSalvar };
}

describe('FormAluno responsável', () => {
  it('editar aluno sem responsável e salvar sem mexer manda null e não marca alteração', async () => {
    const { raiz, aoSalvar } = await montar(aluno());

    expect(escolhida(raiz, 'Sem responsável')).toBe(true);
    tocar(raiz, 'Sair da edição');
    expect(saiu).toBe(true);
    expect(raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?')).toHaveLength(0);

    await tocarEEsperar(raiz, 'Salvar');
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: null }));
    await Renderer.act(async () => { raiz.unmount(); });
  });

  it('aluno novo começa com quem está cadastrando', async () => {
    const { raiz, aoSalvar } = await montar();

    expect(escolhida(raiz, 'Quem cadastra')).toBe(true);
    tocar(raiz, 'Nome');
    await tocarEEsperar(raiz, 'Cadastrar');
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'u1' }));
    await Renderer.act(async () => { raiz.unmount(); });
  });

  it('escolher Sem responsável manda null', async () => {
    const { raiz, aoSalvar } = await montar(aluno({ responsavelId: 'u2' }));

    expect(escolhida(raiz, 'Outra pessoa')).toBe(true);
    tocar(raiz, 'Sem responsável');
    await tocarEEsperar(raiz, 'Salvar');
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: null }));
    await Renderer.act(async () => { raiz.unmount(); });
  });
});

describe('FormAluno data de nascimento', () => {
  it('salvar outro campo reenvia a data que já estava, sem apagar', async () => {
    const { raiz, aoSalvar } = await montar(aluno({ dataNascimento: '2001-03-09' }));
    await tocarEEsperar(raiz, 'Salvar');
    expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ dataNascimento: '2001-03-09' }));
    await Renderer.act(async () => { raiz.unmount(); });
  });

  it('sem data antes e sem digitar manda null (não mexe); apagar a que havia manda texto vazio', async () => {
    const semData = await montar(aluno());
    await tocarEEsperar(semData.raiz, 'Salvar');
    expect(semData.aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ dataNascimento: null }));
    await Renderer.act(async () => { semData.raiz.unmount(); });

    const comData = await montar(aluno({ dataNascimento: '2001-03-09' }));
    tocar(comData.raiz, 'Data de nascimento (opcional)');
    await tocarEEsperar(comData.raiz, 'Salvar');
    expect(comData.aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ dataNascimento: '' }));
    await Renderer.act(async () => { comData.raiz.unmount(); });
  });

  it('422 da API na data aparece no próprio campo', async () => {
    const { ErroApi } = require('@plataforma/web') as typeof import('@plataforma/web');
    const { raiz, aoSalvar } = await montar(aluno({ dataNascimento: '2001-03-09' }));
    aoSalvar.mockImplementationOnce(() => Promise.reject(new ErroApi(422, 'ALUNO_INVALIDO', 'Confira os dados.', [{ field: 'dataNascimento', message: 'Data fora do intervalo permitido.' }])));
    await tocarEEsperar(raiz, 'Salvar');
    expect(alvoDe(raiz, 'Data de nascimento (opcional)').props.accessibilityHint).toBe('Data fora do intervalo permitido.');
    await Renderer.act(async () => { raiz.unmount(); });
  });
});
