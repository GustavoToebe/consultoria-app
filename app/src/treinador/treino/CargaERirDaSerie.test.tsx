/* eslint-disable @typescript-eslint/no-require-imports */
import type { Serie } from '../../api/tipos';
import { agrupar } from '../../dominio/agrupamento';
import { carga, serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import type { UnidadeDeCarga } from '../../dominio/unidadeDeCarga';
import { mensagemDaCargaFixa } from '../../dominio/validacaoDeSerie';
import { ContextoDaUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { CargaERirDaSerie } from './CargaERirDaSerie';
import type { ProblemasDaSerie } from './opcoesDoEditor';

/**
 * A linha "Carga e RIR" da série aberta (SERIE-ABERTA.md, seções 1 e 2), com o pai guardando as séries: "Mesmo valor para
 * todas" (uma linha só ou uma por série), o seletor do RIR só com "RIR" visível (a série vai no nome acessível), o
 * segmento RIR · RPE e a estimativa da carga sobre a WS de referência.
 */
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Calendario', () => ({ BotaoCalendario: () => null, Calendario: () => null }));
jest.mock('../../ui/Botao', () => ({ Botao: () => null }));
jest.mock('../../ui/EscolhaSuspensa', () => ({
  EscolhaSuspensa: ({ rotulo, rotuloAcessivel, valor, aoMudar }: { rotulo: string; rotuloAcessivel?: string; valor: unknown; aoMudar: (v: unknown) => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, rotuloVisivel: rotulo, valor, aoEscolher: aoMudar }),
}));
jest.mock('../../ui/Escolha', () => ({
  Escolha: ({ descricao, opcoes, aoMudar }: { descricao: string; opcoes: { valor: unknown; rotulo: string }[]; aoMudar: (v: unknown) => void }) => {
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, null, ...opcoes.map((o) => createElement(Pressable, { key: String(o.valor), accessibilityLabel: `${descricao}: ${o.rotulo}`, onPress: () => aoMudar(o.valor) })));
  },
}));
// O painel de verdade vai a um portal: aqui ele é só o título, a mensagem e os dois botões, quando visível.
jest.mock('../../ui/PainelConfirmacao', () => ({
  PainelConfirmacao: ({ visivel, titulo, mensagem, rotuloConfirmar, aoConfirmar, aoCancelar }: { visivel: boolean; titulo: string; mensagem: string; rotuloConfirmar: string; aoConfirmar: () => void; aoCancelar: () => void }) => {
    if (!visivel) return null;
    const { createElement } = require('react'); const { Pressable, Text, View } = require('react-native');
    return createElement(View, null, createElement(Text, null, titulo), createElement(Text, null, mensagem),
      createElement(Pressable, { accessibilityLabel: rotuloConfirmar, onPress: aoConfirmar }), createElement(Pressable, { accessibilityLabel: 'Cancelar troca', onPress: aoCancelar }));
  },
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

type Raiz = import('react-test-renderer').ReactTestRenderer;

/** O grupo editado é o de índice `grupo` (as séries de fora dele servem de WS de referência). */
function montar(inicial: Serie[], grupo = 0, { porSerie = [], unidade = 'kg' }: { porSerie?: ProblemasDaSerie[]; unidade?: UnidadeDeCarga } = {}) {
  let atuais = inicial;
  // Troca as séries de fora sem remontar a linha (como o editor, que tem chave pela série aberta e não pelo grupo).
  let deFora!: (novas: Serie[]) => void;
  function Pai() {
    const [series, setSeries] = React.useState(inicial);
    deFora = setSeries;
    return <ContextoDaUnidadeDeCarga.Provider value={unidade}>
      <CargaERirDaSerie grupo={agrupar(series)[grupo]} series={series} config={CONFIGURACAO_PADRAO} porSerie={porSerie} semCarga={false}
        aoMudar={(novas) => { atuais = novas; setSeries(novas); }} />
    </ContextoDaUnidadeDeCarga.Provider>;
  }
  let raiz!: Raiz;
  Renderer.act(() => { raiz = Renderer.create(<Pai />); });
  const primeiro = (nome: string) => raiz.root.findAll((x) => x.props.accessibilityLabel === nome)[0];
  const textos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
  const doGrupo = (nome: string) => raiz.root.findAll((x) => typeof x.type === 'string' && x.props['aria-label'] === nome)[0];
  return {
    textos, primeiro, doGrupo,
    series: () => atuais,
    trocarDeFora: (novas: Serie[]) => Renderer.act(() => { atuais = novas; deFora(novas); }),
    tocar: (nome: string) => Renderer.act(() => primeiro(nome).props.onPress()),
    escolher: (nome: string, valor: unknown) => Renderer.act(() => primeiro(nome).props.aoEscolher(valor)),
    ligar: (nome: string, valor: boolean) => Renderer.act(() => primeiro(nome).props.onCheckedChange(valor)),
  };
}

const comRir = (uid: string, rir: number) => serie(uid, { esforco: { rir, rpe: null } });

describe('CargaERirDaSerie', () => {
  it('valores diferentes: "Mesmo valor para todas" nasce desligado, uma linha por série e o RIR com só "RIR" visível', () => {
    const c = montar([comRir('a', 2), comRir('b', 1), comRir('c', 0)]);
    expect(c.textos()).toEqual(expect.arrayContaining(['Carga e esforço', 'Série 1', 'Série 2', 'Série 3']));
    expect(c.primeiro('Mesmo valor para todas').props.checked).toBe(false);
    const rir2 = c.primeiro('Série 2 · RIR');
    expect(rir2.props.rotuloVisivel).toBe('RIR');
    expect(rir2.props.valor).toBe(1);
    c.escolher('Série 2 · RIR', 3);
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([2, 3, 0]);
  });

  it('ligar "Mesmo valor para todas" copia a Série 1 e deixa uma linha só, que vale para todas', () => {
    const c = montar([comRir('a', 2), comRir('b', 1), comRir('c', 0)]);
    c.ligar('Mesmo valor para todas', true);
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([2, 2, 2]);
    expect(c.textos()).not.toContain('Série 2');
    c.escolher('Todas as séries · RIR', 4);
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([4, 4, 4]);
  });

  it('o segmento RIR · RPE com RIR gravado pede confirmação; confirmar apaga o esforço e troca o seletor pelo do RPE', () => {
    const c = montar([comRir('a', 2), comRir('b', 2)]);
    expect(c.primeiro('Mesmo valor para todas').props.checked).toBe(true);
    c.tocar('Esforço por RIR ou RPE: RPE');
    // Nada muda antes de confirmar.
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([2, 2]);
    expect(c.textos()).toContain('Trocar para RPE apaga o RIR de 2 séries.');
    c.tocar('Cancelar troca');
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([2, 2]);
    expect(c.primeiro('Todas as séries · RIR')).toBeDefined();
    c.tocar('Esforço por RIR ou RPE: RPE');
    c.tocar('Trocar para RPE');
    expect(c.series().map((s) => s.esforco)).toEqual([null, null]);
    expect(c.primeiro('Todas as séries · RPE')).toBeDefined();
    expect(c.textos()).toContain('RPE de 1 a 10, de meio em meio (ex.: 8 ou 8,5).');
  });

  it('sem esforço gravado, o segmento troca direto, sem painel', () => {
    const c = montar([serie('a'), serie('b')]);
    c.tocar('Esforço por RIR ou RPE: RPE');
    expect(c.primeiro('Trocar para RPE')).toBeUndefined();
    expect(c.primeiro('Todas as séries · RPE')).toBeDefined();
  });

  it('o grupo que cresce com outro RIR volta às linhas por série, sem gravar por cima', () => {
    // Série 1 sozinha com "Mesmo valor" ligado; a Série 2 (RIR 0) entra no grupo sem a linha remontar.
    const c = montar([comRir('a', 2)]);
    c.trocarDeFora([comRir('a', 2), comRir('b', 0)]);
    expect(c.primeiro('Mesmo valor para todas').props.checked).toBe(false);
    expect(c.primeiro('Todas as séries · RIR')).toBeUndefined();
    expect(c.primeiro('Série 2 · RIR').props.valor).toBe(0);
    expect(c.series().map((s) => s.esforco?.rir)).toEqual([2, 0]);
  });

  it('RPE gravado de fora (receita, desfazer) aparece pelo RPE, não escondido atrás do RIR', () => {
    // O RPE separa o grupo (`agrupamento`), então o caso é o mesmo grupo ganhar RPE sem a linha remontar.
    const c = montar([serie('a'), serie('b')]);
    expect(c.primeiro('Todas as séries · RIR')).toBeDefined();
    c.trocarDeFora([serie('a', { esforco: { rir: null, rpe: 8 } }), serie('b', { esforco: { rir: null, rpe: 8 } })]);
    expect(c.primeiro('Todas as séries · RPE').props.value).toBe('8');
  });

  it('aquecimento em % da WS: "Carga e RIR" (sem RPE) e a estimativa sobre a WS de referência na dica', () => {
    const aquecimento = serie('aq', { tipo: 'WARM_UP', carga: { modo: 'PERCENTUAL_WS', valorKg: null, percentualMin: 50, percentualMax: 60 } });
    const ws = serie('ws', { carga: { ...carga('CARGA_FIXA'), valorKg: 90 } });
    const c = montar([aquecimento, ws]);
    expect(c.textos()).toContain('Carga e RIR');
    expect(c.primeiro('Esforço por RIR ou RPE: RPE')).toBeUndefined();
    expect(c.textos().some((t) => /^≈ .+ kg com WS de 90 kg · em branco, o aluno não recebe sugestão de carga$/.test(t))).toBe(true);
  });

  it('valores por série: o erro de uma série fica embaixo da linha dela, não na dica da linha', () => {
    const fs = (uid: string, pct: number) => serie(uid, { tipo: 'FEEDER', carga: { modo: 'PERCENTUAL_WS', valorKg: null, percentualMin: pct, percentualMax: pct }, esforco: { rir: 2, rpe: null } });
    const erro = 'Percentual da WS entre 1 e 200.';
    const c = montar([fs('a', 50), fs('b', 70)], 0, { porSerie: [{ erros: {}, avisos: {} }, { erros: { 'carga.percentualMax': erro }, avisos: {} }] });
    const linhaDaSerie2 = c.doGrupo('Série 2');
    const dentro = linhaDaSerie2.findAll((x) => typeof x.type === 'string' && x.props.children === erro);
    expect(dentro.length).toBeGreaterThan(0);
    expect(c.textos().filter((t) => t.includes(erro))).toHaveLength(1);
  });

  it('carga fixa em libra: o campo diz "Carga, em libras" e o erro do teto sai em libra', () => {
    const fixa = serie('f', { carga: { ...carga('CARGA_FIXA'), valorKg: 9999 } });
    const c = montar([fixa], 0, { unidade: 'lb', porSerie: [{ erros: { 'carga.valorKg': mensagemDaCargaFixa() }, avisos: {} }] });
    expect(c.primeiro('Carga, em libras')).toBeDefined();
    expect(c.textos()).toContain(mensagemDaCargaFixa('lb'));
    expect(c.textos()).not.toContain(mensagemDaCargaFixa());
  });
});
