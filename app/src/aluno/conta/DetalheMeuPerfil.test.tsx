/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { definirMeuApelido, meuPerfilDaComunidade, salvarMeuPerfilDaComunidade } from '../../api/comunidade';
import { meusDados } from '../../api/rotas';
import type { PreferenciasDoPerfil } from '../../api/comunidadeTipos';
import { NOTA_SEM_APELIDO, TEXTO_LIMITE_DO_PERFIL } from '../../dominio/perfilDaComunidade';
import { useCarregar } from '../../ui/useCarregar';
import { DetalheMeuPerfil } from './DetalheMeuPerfil';

/**
 * O detalhe "Meu perfil" da Conta (conta do aluno reorganizada, 23/11; antes `CartaoMeuPerfil` e `CartaoApelido`) com as
 * regras de verdade e as peças de UI trocadas por nós simples: corpo do PUT, limite de 4, aviso, erros e o salvar único do
 * apelido e do perfil.
 */
const mockAvisar = jest.fn();
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../api/cliente', () => ({ ErroApi: require('@plataforma/web').ErroApi }));
jest.mock('../../api/comunidade', () => ({ meuPerfilDaComunidade: jest.fn(), salvarMeuPerfilDaComunidade: jest.fn(), definirMeuApelido: jest.fn() }));
jest.mock('../../api/rotas', () => ({ baixarFotoDePerfil: jest.fn(), meusDados: jest.fn() }));
jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => ({ usuario: { nome: 'Aluno Fictício' } }) }));
jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../../tema/tokens').CLARO, modo: 'CLARO', variante: 'claro' }) }));
jest.mock('../versaoDaFotoDePerfil', () => ({ useVersaoDaFotoDePerfil: () => 0 }));
jest.mock('../versaoDoApelido', () => ({ avisarQueOApelidoMudou: jest.fn() }));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
jest.mock('../../ui/RolagemComTopo', () => ({ useRolagem: () => ({ rolarAte: jest.fn() }) }));
jest.mock('../../ui/AlvoDeRolagem', () => ({ AlvoDeRolagem: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../../ui/FotoDePerfil', () => ({ FotoDePerfil: () => null }));
jest.mock('../../comunidade/useFecharComAviso', () => ({ useFecharComAviso: (_v: boolean, _a: boolean, descartar: () => void) => ({ fechar: descartar, aviso: null }) }));
jest.mock('../../ui/Folha', () => ({
  Folha: ({ children, faixa, rodape, statusDoRodape }: { children?: ReactNode; faixa?: ReactNode; rodape?: ReactNode; statusDoRodape?: ReactNode }) =>
    require('react').createElement(require('react-native').View, null, faixa, children, statusDoRodape, rodape),
}));
jest.mock('../../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../../ui/GradeDeOpcoes', () => ({ GradeDeOpcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/Selo', () => ({ Selo: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto) }));
jest.mock('../../ui/Campo', () => ({
  MensagemDeErro: ({ erro }: { erro: string }) => require('react').createElement(require('react-native').Text, null, erro),
  Campo: ({ rotulo, valor, aoMudar, erro }: { rotulo: string; valor: string; aoMudar: (t: string) => void; erro?: string | null }) =>
    require('react').createElement(require('react-native').View, null,
      require('react').createElement(require('react-native').TextInput, { accessibilityLabel: rotulo, value: valor, onChangeText: aoMudar }),
      erro ? require('react').createElement(require('react-native').Text, null, erro) : null),
}));
jest.mock('../../ui/Estados', () => ({
  Alerta: ({ texto, children }: { texto?: string; children?: ReactNode }) =>
    require('react').createElement(require('react-native').View, null, require('react').createElement(require('react-native').Text, null, texto), children),
  Vazio: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto),
  MensagemErro: () => null,
}));
const mockPressionavel = (rotulo: string, onPress: () => void, extra: object = {}) =>
  require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress, ...extra });
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar, desabilitado }: { rotulo: string; aoTocar: () => void; desabilitado?: boolean }) =>
    mockPressionavel(rotulo, () => { if (!desabilitado) aoTocar(); }, { accessibilityState: { disabled: !!desabilitado } }),
}));
jest.mock('../../ui/Campos', () => ({
  Interruptor: ({ rotulo, valor, aoMudar }: { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void }) =>
    mockPressionavel(rotulo, () => aoMudar(!valor), { accessibilityState: { checked: valor } }),
}));
jest.mock('../../ui/CaixaSelecao', () => ({
  CaixaSelecao: ({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (v: boolean) => void }) =>
    mockPressionavel(rotulo, () => aoMudar(!marcado), { accessibilityState: { checked: marcado } }),
}));
jest.mock('../../ui/OpcaoCartao', () => ({
  OpcaoCartao: ({ titulo, descricao, aoEscolher, selecionada }: { titulo: string; descricao?: string; aoEscolher: () => void; selecionada: boolean }) =>
    mockPressionavel(titulo, aoEscolher, {
      accessibilityState: { checked: selecionada },
      children: descricao ? require('react').createElement(require('react-native').Text, null, `${titulo}: ${descricao}`) : undefined,
    }),
}));

const ErroApi = require('@plataforma/web').ErroApi as typeof import('@plataforma/web').ErroApi;
const ler = meuPerfilDaComunidade as jest.Mock;
const lerMeusDados = meusDados as jest.Mock;
const salvar = salvarMeuPerfilDaComunidade as jest.Mock;
const salvarApelido = definirMeuApelido as jest.Mock;

const conquista = (tipo: string) => ({ id: `id-${tipo}`, tipo, titulo: `Conquista ${tipo}`, descricao: 'Fictícia', icone: 'award', conquistadaEm: '2026-11-01T12:00:00Z' });
const perfil = (p: Partial<PreferenciasDoPerfil> = {}): PreferenciasDoPerfil => ({
  perfilReservado: false, reservadoEfetivo: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', exibicaoDoNome: 'NOME',
  opcoesDeDestaque: ['A', 'B', 'C', 'D', 'E'].map(conquista), ...p,
});

/** A tela lê o perfil e os dados (como `TelaDaConta`) e passa as duas cargas ao detalhe. */
function Montado() {
  const p = useCarregar('perfil', () => meuPerfilDaComunidade());
  const d = useCarregar('dados', () => meusDados());
  return <DetalheMeuPerfil perfil={p} dados={d} online focarReservar={false} aoFechar={() => undefined} />;
}

const textos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'Text').map((n) => [n.props.children].flat().join('')).filter(Boolean);
const achar = (r: ReactTestRenderer, rotulo: string) =>
  r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
const alvo = (r: ReactTestRenderer, rotulo: string) => {
  const achado = achar(r, rotulo);
  if (!achado) throw new Error(`Não achei “${rotulo}”.`);
  return achado;
};
const tocar = async (r: ReactTestRenderer, rotulo: string) => { await act(async () => { alvo(r, rotulo).props.onPress(); }); };
const digitarApelido = async (r: ReactTestRenderer, texto: string) => {
  const campo = r.root.findAll((n) => n.props.accessibilityLabel === 'Apelido (opcional)' && typeof n.props.onChangeText === 'function')[0];
  await act(async () => { campo.props.onChangeText(texto); });
};
const montar = async (lido: PreferenciasDoPerfil, apelido: string | null = 'Fictí') => {
  ler.mockResolvedValueOnce(lido);
  lerMeusDados.mockResolvedValue({ nome: 'Aluno Fictício da Silva', email: 'aluno@exemplo.test', apelido, versao: 1 });
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<Montado />); });
  return r;
};

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { ler.mockReset(); salvar.mockReset(); salvarApelido.mockReset(); lerMeusDados.mockReset(); mockAvisar.mockReset(); });

it('reservado por padrão e sem escolha: trocar só a cor manda perfilReservado null e o resto como estava', async () => {
  const lido = perfil({ perfilReservado: null, reservadoEfetivo: true, destaques: ['B'], moldura: 'DUPLA' });
  const r = await montar(lido);
  expect(alvo(r, 'Reservar meu perfil').props.accessibilityState.checked).toBe(true);
  expect(textos(r).some((t) => t.includes('começa reservado'))).toBe(true);
  expect(textos(r)).not.toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');

  salvar.mockResolvedValueOnce({ ...lido, cor: 'ROSA' });
  await tocar(r, 'Rosa');
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenCalledWith({ perfilReservado: null, destaques: ['B'], cor: 'ROSA', moldura: 'DUPLA', exibicaoDoNome: 'NOME' });
  expect(salvarApelido).not.toHaveBeenCalled();
  expect(mockAvisar).toHaveBeenCalledWith('Perfil salvo.', 'sucesso');
});

it('até 4 destaques na ordem marcada; o 5º é recusado, explicado e não entra no PUT', async () => {
  const r = await montar(perfil());
  for (const t of ['C', 'A', 'D', 'B']) await tocar(r, `Conquista ${t}`);
  await tocar(r, 'Conquista E');
  expect(alvo(r, 'Conquista E').props.accessibilityState.checked).toBe(false);
  expect(textos(r).some((t) => t.endsWith('. Você já escolheu 4: desmarque um para trocar.'))).toBe(true);
  expect(salvar).not.toHaveBeenCalled();

  salvar.mockResolvedValueOnce(perfil({ destaques: ['C', 'A', 'D', 'B'] }));
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ destaques: ['C', 'A', 'D', 'B'], perfilReservado: false }));
});

it('aviso único: "Entendi" grava false com destaques, cor e moldura salvos e some', async () => {
  const lido = perfil({ perfilReservado: null, reservadoEfetivo: false, destaques: ['A'], cor: 'VERDE', moldura: 'GROSSA' });
  const r = await montar(lido);
  expect(textos(r)).toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');
  // Mexer na moldura antes não muda o corpo do "Entendi" (que usa o salvo) e continua na tela depois.
  await tocar(r, 'Tracejada. Linha em traços');
  salvar.mockResolvedValueOnce({ ...lido, perfilReservado: false });
  await tocar(r, 'Entendi, manter visível');
  expect(salvar).toHaveBeenCalledWith({ perfilReservado: false, destaques: ['A'], cor: 'VERDE', moldura: 'GROSSA', exibicaoDoNome: 'NOME' });
  expect(textos(r)).not.toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');
  expect(alvo(r, 'Tracejada. Linha em traços').props.accessibilityState.checked).toBe(true);
});

it('sem mudança: "Tudo salvo" e nenhum botão; 422 aparece no grupo e 429 vira texto amigável', async () => {
  const r = await montar(perfil());
  expect(textos(r)).toContain('Tudo salvo');
  expect(achar(r, 'Salvar perfil')).toBeUndefined();
  expect(achar(r, 'Descartar')).toBeUndefined();

  await tocar(r, 'Conquista A');
  expect(textos(r)).toContain('Alterações não salvas');
  salvar.mockRejectedValueOnce(new ErroApi(422, 'PERFIL_INVALIDO', 'Confira o perfil.', [{ field: 'destaques', message: 'Só dá para destacar uma conquista que você já ganhou.' }]));
  await tocar(r, 'Salvar perfil');
  expect(textos(r)).toContain('Só dá para destacar uma conquista que você já ganhou.');
  expect(mockAvisar).not.toHaveBeenCalled();

  salvar.mockRejectedValueOnce(new ErroApi(429, 'LOGIN_LIMITADO', 'Muitas tentativas.'));
  await tocar(r, 'Salvar perfil');
  expect(mockAvisar).toHaveBeenCalledWith(TEXTO_LIMITE_DO_PERFIL, 'perigo');
  // As escolhas continuam na tela para tentar de novo; "Descartar" volta ao salvo.
  expect(alvo(r, 'Conquista A').props.accessibilityState.checked).toBe(true);
  await tocar(r, 'Descartar');
  expect(alvo(r, 'Conquista A').props.accessibilityState.checked).toBe(false);
  expect(textos(r)).toContain('Tudo salvo');
});

it('nome para os colegas: prévia de cada opção com o nome e o apelido, o PUT leva a escolha e o 422 fica no grupo', async () => {
  const lido = perfil({ exibicaoDoNome: 'APELIDO' });
  const r = await montar(lido);
  expect(textos(r)).toEqual(expect.arrayContaining([
    'Primeiro nome: Aluno', 'Nome completo: Aluno Fictício da Silva', 'Apelido: Fictí', 'Nome e apelido: Aluno (Fictí)',
  ]));
  expect(textos(r)).toContain('Fictí');
  expect(alvo(r, 'Apelido').props.accessibilityState.checked).toBe(true);
  expect(textos(r)).not.toContain(NOTA_SEM_APELIDO);

  salvar.mockResolvedValueOnce({ ...lido, cor: 'ROXO' });
  await tocar(r, 'Roxo');
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenLastCalledWith(expect.objectContaining({ cor: 'ROXO', exibicaoDoNome: 'APELIDO' }));

  await tocar(r, 'Nome completo');
  expect(textos(r)).toContain('Aluno Fictício da Silva');
  salvar.mockRejectedValueOnce(new ErroApi(422, 'PERFIL_INVALIDO', 'Confira o perfil.', [{ field: 'exibicaoDoNome', message: 'Escolha uma das opções.' }]));
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenLastCalledWith(expect.objectContaining({ exibicaoDoNome: 'NOME_COMPLETO' }));
  expect(textos(r)).toContain('Escolha uma das opções.');
  expect(alvo(r, 'Nome completo').props.accessibilityState.checked).toBe(true);
});

it('sem apelido: as opções com apelido mostram o primeiro nome e a nota explica, sem travar a escolha', async () => {
  const r = await montar(perfil(), null);
  expect(textos(r)).toEqual(expect.arrayContaining(['Apelido: Aluno', 'Nome e apelido: Aluno', NOTA_SEM_APELIDO]));
  await tocar(r, 'Nome e apelido');
  expect(alvo(r, 'Nome e apelido').props.accessibilityState.checked).toBe(true);
  expect(alvo(r, 'Salvar perfil').props.accessibilityState.disabled).toBe(false);
});

it('um Salvar só: o apelido vai primeiro, depois o perfil; a prévia já usa o apelido digitado', async () => {
  const lido = perfil({ exibicaoDoNome: 'APELIDO' });
  const r = await montar(lido, null);
  await digitarApelido(r, ' Novo ');
  expect(textos(r)).toContain('Novo');
  await tocar(r, 'Dupla. Duas linhas, uma dentro da outra');
  const ordem: string[] = [];
  salvarApelido.mockImplementationOnce(async () => { ordem.push('apelido'); });
  salvar.mockImplementationOnce(async () => { ordem.push('perfil'); return { ...lido, moldura: 'DUPLA' }; });
  await tocar(r, 'Salvar perfil');
  expect(salvarApelido).toHaveBeenCalledWith('Novo');
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ moldura: 'DUPLA', exibicaoDoNome: 'APELIDO' }));
  expect(ordem).toEqual(['apelido', 'perfil']);
  expect(textos(r)).toContain('Tudo salvo');
  expect(mockAvisar).toHaveBeenCalledWith('Perfil salvo.', 'sucesso');
});

it('falha parcial: o apelido fica salvo e só o perfil continua como alteração; apelido em branco apaga', async () => {
  const lido = perfil();
  const r = await montar(lido, 'Fictí');
  await digitarApelido(r, '');
  await tocar(r, 'Roxo');
  salvarApelido.mockResolvedValueOnce(undefined);
  salvar.mockRejectedValueOnce(new ErroApi(429, 'LOGIN_LIMITADO', 'Muitas tentativas.'));
  await tocar(r, 'Salvar perfil');
  expect(salvarApelido).toHaveBeenCalledWith(null);
  expect(mockAvisar).toHaveBeenCalledWith(TEXTO_LIMITE_DO_PERFIL, 'perigo');
  expect(textos(r)).toContain('Alterações não salvas');

  salvar.mockResolvedValueOnce({ ...lido, cor: 'ROXO' });
  await tocar(r, 'Salvar perfil');
  // O apelido já gravado não vai de novo.
  expect(salvarApelido).toHaveBeenCalledTimes(1);
  expect(textos(r)).toContain('Tudo salvo');
});

it('apelido inválido mostra o erro no campo e o Salvar espera a correção', async () => {
  const r = await montar(perfil(), null);
  await digitarApelido(r, 'a');
  expect(alvo(r, 'Salvar perfil').props.accessibilityState.disabled).toBe(true);
  await tocar(r, 'Salvar perfil');
  expect(salvarApelido).not.toHaveBeenCalled();
});
