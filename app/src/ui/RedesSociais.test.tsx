/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import { REDES_SOCIAIS_DO_ALUNO, type ValoresDasRedes, type RedeSocialDoAluno } from '../dominio/redesSociais';
import { RedesSociais } from './RedesSociais';

/**
 * A peça das redes nos dois modos. Leitura: só as preenchidas, nada sem rede, nomes "Abrir <Rede>" (os dos e2e), WhatsApp
 * primeiro e o aviso quando o link não abre. Edição: adicionar e remover, o menu só com as que faltam (e some com todas),
 * foco no campo novo e erro por campo. Botão e campo trocados por versões mínimas que só expõem nome, valor e toque; só
 * dados fictícios.
 */
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, variante: 'escuro', fatorTexto: 1, bordas: { bloco: 1 } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('./IconesDeRedes', () => ({ ICONE_DA_REDE: new Proxy({}, { get: () => () => null }) }));
const mockAvisar = jest.fn();
jest.mock('./Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
const mockAbrir = jest.fn();
/** Quem recebeu o foco (o campo mínimo anota o próprio nome). */
const mockFocados: string[] = [];
jest.mock('./abrirLinkExterno', () => ({ abrirLinkExterno: (url: string) => mockAbrir(url) }));
const h = (...a: unknown[]) => (require('react').createElement as (...x: unknown[]) => unknown)(...a);
jest.mock('./Texto', () => ({ Texto: ({ children }: { children?: unknown }) => h(require('react-native').Text, null, children) }));
// O `View` do jest não mede: o botão expõe a medida que o menu usa para se posicionar.
jest.mock('./Botao', () => ({
  Botao: function Botao({ ref, rotulo, aoTocar }: { ref?: never; rotulo: string; aoTocar: () => void }) {
    require('react').useImperativeHandle(ref, () => ({ measureInWindow: (cb: (...n: number[]) => void) => cb(16, 100, 160, 44), focus: () => undefined }));
    return h(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar });
  },
}));
jest.mock('./IconeBotao', () => ({
  IconeBotao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => h(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
jest.mock('./Campo', () => ({
  Campo: function Campo({ ref, rotuloAcessivel, valor, aoMudar, erro }: { ref?: never; rotuloAcessivel: string; valor: string; aoMudar: (t: string) => void; erro?: string }) {
    require('react').useImperativeHandle(ref, () => ({ focus: () => mockFocados.push(rotuloAcessivel) }));
    return h(require('react-native').TextInput, { accessibilityLabel: rotuloAcessivel, value: valor, onChangeText: aoMudar, accessibilityHint: erro });
  },
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');
const RN = require('react-native') as typeof import('react-native');

function montar(elemento: unknown): ReactTestRenderer {
  let raiz!: ReactTestRenderer;
  Renderer.act(() => { raiz = Renderer.create(elemento as never); });
  return raiz;
}
const botoes = (raiz: ReactTestRenderer) => raiz.root.findAll((n) => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string');
const nomes = (raiz: ReactTestRenderer) => botoes(raiz).map((b) => b.props.accessibilityLabel as string);
const porNome = (raiz: ReactTestRenderer, nome: string): ReactTestInstance => botoes(raiz).find((b) => b.props.accessibilityLabel === nome)!;
const tocar = (raiz: ReactTestRenderer, nome: string) => Renderer.act(() => { (porNome(raiz, nome).props.onPress as () => void)(); });
const campos = (raiz: ReactTestRenderer) => raiz.root.findAllByType(RN.TextInput);

beforeEach(() => {
  mockAvisar.mockReset();
  mockAbrir.mockReset();
  mockFocados.length = 0;
});

describe('leitura', () => {
  const REDES = [{ rede: 'instagram', url: 'https://www.instagram.com/consultoria.ficticia' }, { rede: 'site', url: 'https://consultoria-ficticia.test/sobre' }] as const;

  it('só as redes que vieram, com os nomes de sempre e o @ na dica', () => {
    const raiz = montar(<RedesSociais modo="leitura" redes={[...REDES]} />);
    expect(nomes(raiz)).toEqual(['Abrir Instagram', 'Abrir site']);
    expect(porNome(raiz, 'Abrir Instagram').props.accessibilityHint).toBe('@consultoria.ficticia');
    expect(porNome(raiz, 'Abrir site').props.accessibilityHint).toBe('consultoria-ficticia.test/sobre');
  });

  it('sem rede e sem WhatsApp, nada', () => {
    expect(montar(<RedesSociais modo="leitura" redes={[]} />).toJSON()).toBeNull();
    expect(montar(<RedesSociais modo="leitura" redes={[]} whatsapp={null} />).toJSON()).toBeNull();
  });

  it('o WhatsApp vem primeiro, com o dono no nome; sozinho também aparece', () => {
    const raiz = montar(<RedesSociais modo="leitura" redes={[...REDES]} de="Aluno Fictício" whatsapp={{ url: 'https://wa.me/5545999998888', rotulo: '(45) 99999-8888' }} />);
    expect(nomes(raiz)).toEqual(['Abrir WhatsApp de Aluno Fictício', 'Abrir Instagram de Aluno Fictício', 'Abrir site de Aluno Fictício']);
    expect(nomes(montar(<RedesSociais modo="leitura" redes={[]} whatsapp={{ url: 'https://wa.me/5545999998888' }} />))).toEqual(['Abrir WhatsApp']);
  });

  it('abre o link fora do app e avisa quando o sistema recusa', async () => {
    mockAbrir.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const raiz = montar(<RedesSociais modo="leitura" redes={[...REDES]} />);
    await Renderer.act(async () => { (porNome(raiz, 'Abrir Instagram').props.onPress as () => void)(); });
    expect(mockAbrir).toHaveBeenLastCalledWith('https://www.instagram.com/consultoria.ficticia');
    expect(mockAvisar).not.toHaveBeenCalled();
    await Renderer.act(async () => { (porNome(raiz, 'Abrir site').props.onPress as () => void)(); });
    expect(mockAvisar).toHaveBeenCalledWith('Não foi possível abrir o link. Tente de novo.', 'perigo');
  });
});

describe('edição', () => {
  /** A peça é controlada: quem chama guarda os valores (aqui, um estado). */
  function Formulario({ inicial, erros }: { inicial: ValoresDasRedes<RedeSocialDoAluno>; erros?: Partial<Record<RedeSocialDoAluno, string>> }) {
    const [valores, setValores] = React.useState(inicial);
    ultimo = valores;
    return <RedesSociais modo="edicao" redesPermitidas={REDES_SOCIAIS_DO_ALUNO} valores={valores} aoMudar={setValores} erros={erros} />;
  }
  let ultimo: ValoresDasRedes<RedeSocialDoAluno> = {};

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sem rede, só o "Adicionar rede", sem campo vazio', () => {
    const raiz = montar(<Formulario inicial={{}} />);
    expect(campos(raiz)).toHaveLength(0);
    expect(nomes(raiz)).toEqual(['Adicionar rede']);
  });

  it('uma linha por rede adicionada, com o nome do campo, o remover e o erro de fora', () => {
    const raiz = montar(<Formulario inicial={{ instagram: '@aluno.ficticio', youtube: '' }} erros={{ instagram: 'Use @usuario ou o link do perfil no Instagram.' }} />);
    expect(campos(raiz).map((c) => c.props.accessibilityLabel)).toEqual(['Instagram: @usuário ou link', 'YouTube: @usuário ou link']);
    expect(campos(raiz)[0].props.value).toBe('@aluno.ficticio');
    expect(campos(raiz)[0].props.accessibilityHint).toBe('Use @usuario ou o link do perfil no Instagram.');
    expect(campos(raiz)[1].props.accessibilityHint).toBeUndefined();
    expect(nomes(raiz)).toEqual(expect.arrayContaining(['Remover Instagram', 'Remover YouTube', 'Adicionar rede']));
  });

  it('o menu só oferece as que faltam; a escolhida entra vazia e recebe o foco', () => {
    const raiz = montar(<Formulario inicial={{ instagram: '@aluno.ficticio' }} />);
    tocar(raiz, 'Adicionar rede');
    const menu = raiz.root.find((n) => n.props.role === 'menu');
    expect(menu.findAll((n) => n.props.role === 'menuitem' && typeof n.props.onPress === 'function').map((n) => n.props.accessibilityLabel))
      .toEqual(['TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Telegram']);
    tocar(raiz, 'Telegram');
    expect(raiz.root.findAll((n) => n.props.role === 'menu')).toHaveLength(0);
    expect(ultimo).toEqual({ instagram: '@aluno.ficticio', telegram: '' });
    Renderer.act(() => { jest.runAllTimers(); });
    expect(mockFocados).toEqual(['Telegram: @usuário ou link']);
  });

  it('digitar muda só a rede do campo', () => {
    const raiz = montar(<Formulario inicial={{ instagram: '@a', facebook: '' }} />);
    Renderer.act(() => { (campos(raiz)[1].props.onChangeText as (t: string) => void)('facebook.com/aluno.ficticio'); });
    expect(ultimo).toEqual({ instagram: '@a', facebook: 'facebook.com/aluno.ficticio' });
  });

  it('remover tira a rede dos valores (quem envia manda em branco) e ela volta ao menu', () => {
    const raiz = montar(<Formulario inicial={{ instagram: '@aluno.ficticio', tiktok: '@aluno.tt' }} />);
    tocar(raiz, 'Remover Instagram');
    expect(ultimo).toEqual({ tiktok: '@aluno.tt' });
    expect(campos(raiz).map((c) => c.props.accessibilityLabel)).toEqual(['TikTok: @usuário ou link']);
    tocar(raiz, 'Adicionar rede');
    expect(raiz.root.findAll((n) => n.props.role === 'menuitem' && typeof n.props.onPress === 'function').map((n) => n.props.accessibilityLabel)[0]).toBe('Instagram');
  });

  it('com todas adicionadas, o "Adicionar rede" some', () => {
    const todas = Object.fromEntries(REDES_SOCIAIS_DO_ALUNO.map((r) => [r, ''])) as ValoresDasRedes<RedeSocialDoAluno>;
    const raiz = montar(<Formulario inicial={todas} />);
    expect(campos(raiz)).toHaveLength(6);
    expect(nomes(raiz)).not.toContain('Adicionar rede');
  });

  it('só as redes permitidas: X e site da consultoria não entram no aluno', () => {
    const raiz = montar(<RedesSociais modo="edicao" redesPermitidas={REDES_SOCIAIS_DO_ALUNO} valores={{ instagram: '@a' }} aoMudar={() => undefined} />);
    tocar(raiz, 'Adicionar rede');
    const oferecidas = raiz.root.findAll((n) => n.props.role === 'menuitem' && typeof n.props.onPress === 'function').map((n) => n.props.accessibilityLabel);
    expect(oferecidas).not.toContain('X');
    expect(oferecidas).not.toContain('Site');
  });

  it('o site da consultoria pede o link, não o @', () => {
    const raiz = montar(<RedesSociais modo="edicao" redesPermitidas={['instagram', 'site'] as const} valores={{ site: '' }} aoMudar={() => undefined} />);
    expect(campos(raiz)[0].props.accessibilityLabel).toBe('Site: link');
  });
});
