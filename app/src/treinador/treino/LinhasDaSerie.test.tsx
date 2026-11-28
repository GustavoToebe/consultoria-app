/* eslint-disable @typescript-eslint/no-require-imports */
import type { Serie } from '../../api/tipos';
import { tecnicaVazia } from '../../dominio/editorTreino';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { CamposDasRepeticoes } from './CamposBasicos';
import { MENSAGEM_DESCANSO_DO_CLUSTER } from '../../dominio/camposDaSerie';
import { DICA_DO_DESCANSO_DO_CLUSTER, LinhasDaSerie } from './LinhasDaSerie';

jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
// Seletores e segmentos não desenham nada aqui: o teste lê as props que a linha passa a eles.
jest.mock('../../ui/Escolha', () => ({ Escolha: () => null }));
jest.mock('../../ui/EscolhaSuspensa', () => ({ EscolhaSuspensa: () => null }));
jest.mock('../../ui/Botao', () => ({ Botao: () => null }));
// O painel da troca RIR · RPE (`CargaERirDaSerie`) vai a um portal (alert-dialog), que o jest não lê.
jest.mock('../../ui/PainelConfirmacao', () => ({ PainelConfirmacao: () => null }));
jest.mock('../../ui/EscolhaEmFolha', () => ({ OPCOES_PARA_BUSCAR: 8 }));
jest.mock('./BotaoDeAbrir', () => ({ BotaoDeInfo: () => null, Explicacao: () => null, BotaoDeTexto: () => null }));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Raiz = import('react-test-renderer').ReactTestRenderer;
type No = import('react-test-renderer').ReactTestInstance;

const serie = (uid: string, parte: Partial<Serie> = {}): Serie => ({
  uid, tipo: 'WORKING', repsMin: 6, repsMax: 8, amrap: null, carga: { modo: 'CARGA_TRABALHO' },
  esforco: null, descansoSegundos: 60, tecnica: null, cardio: null, alvoExtra: null, ...parte,
});

function montar(elemento: React.ReactElement) {
  let raiz!: Raiz;
  Renderer.act(() => { raiz = Renderer.create(elemento); });
  const textos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
  const campo = (rotulo: string) => raiz.root.find((x) => typeof x.props.onChangeText === 'function' && x.props.accessibilityLabel === rotulo);
  const digitar = (rotulo: string, texto: string) => Renderer.act(() => campo(rotulo).props.onChangeText(texto));
  const porProp = (nome: string, valor: unknown) => raiz.root.findAll((x: No) => typeof x.type === 'function' && x.props[nome] === valor);
  // O nome da linha é o texto ligado por `aria-labelledby` (`LinhaDoFormulario`).
  const linhas = () => raiz.root.findAll((x) => typeof x.type === 'string' && x.props.role === 'group' && typeof x.props.onLayout === 'function')
    .map((x) => raiz.root.find((n) => typeof n.type === 'function' && n.props.nativeID === x.props['aria-labelledby']).props.children as string);
  return { raiz, textos, campo, digitar, porProp, linhas };
}

describe('CamposDasRepeticoes compacta (a fileira da série)', () => {
  it('faixa: dois números com "a" e "reps" ao lado; digitar muda só o lado mexido', () => {
    const aoMudar = jest.fn();
    const t = montar(<CamposDasRepeticoes compacta rotuloVisivel={false} valor={{ repsMin: 10, repsMax: 15, amrap: false }} erros={{}} aoMudar={aoMudar} forma="FAIXA" />);
    expect(t.campo('Reps mín.').props.value).toBe('10');
    expect(t.campo('Reps máx.').props.value).toBe('15');
    expect(t.textos()).toEqual(expect.arrayContaining(['a', 'reps']));
    t.digitar('Reps máx.', '12');
    expect(aoMudar).toHaveBeenLastCalledWith({ repsMin: 10, repsMax: 12, amrap: false });
  });

  it('exata: um número só; AMRAP: nenhum', () => {
    const exata = montar(<CamposDasRepeticoes compacta valor={{ repsMin: 8, repsMax: 8 }} erros={{}} aoMudar={jest.fn()} forma="EXATA" />);
    expect(exata.campo('Repetições').props.value).toBe('8');
    const amrap = montar(<CamposDasRepeticoes compacta valor={{ amrap: true }} erros={{}} aoMudar={jest.fn()} forma="AMRAP" />);
    expect(amrap.raiz.root.findAll((x) => typeof x.props.onChangeText === 'function')).toHaveLength(0);
  });
});

describe('LinhasDaSerie', () => {
  const tipos = [{ valor: 'WORKING', rotulo: 'WS', foraDaMetodologia: false }];
  const props = { config: CONFIGURACAO_PADRAO, semCarga: false, tipos, porSerie: [], aoAlterar: jest.fn(), aoMudarSeries: jest.fn(), aoQuantidade: jest.fn() };

  it('série simples: as cinco linhas na ordem e "Falta o descanso." sem descanso', () => {
    const s = serie('a', { descansoSegundos: null });
    const t = montar(<LinhasDaSerie {...props} grupo={{ inicio: 0, series: [s] }} series={[s]} />);
    // A de trabalho pode ir por RIR ou RPE: a linha da carga é "Carga e esforço" (`CargaERirDaSerie`).
    expect(t.linhas()).toEqual(['Tipo e técnica', 'Volume', 'Repetições', 'Carga e esforço', 'Observação']);
    expect(t.textos()).not.toContain(MENSAGEM_DESCANSO_DO_CLUSTER);
    expect(t.textos()).not.toContain(DICA_DO_DESCANSO_DO_CLUSTER);
    expect(t.textos()).toContain('Falta o descanso.');
    // Seletores com a mesma altura dos números.
    expect(t.porProp('rotulo', 'Descanso')[0].props.valor).toBeNull();
  });

  it('cluster: sem a linha Repetições, com as linhas da técnica e "Carga e esforço"', () => {
    const s = serie('c', { tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [5, 5] } });
    const { Text } = require('react-native') as typeof import('react-native');
    const t = montar(<LinhasDaSerie {...props} grupo={{ inicio: 0, series: [s] }} series={[s]} linhasDaTecnica={<Text>blocos</Text>} />);
    expect(t.linhas()).toEqual(['Tipo e técnica', 'Volume', 'Carga e esforço', 'Observação']);
    expect(t.textos()).toContain('blocos');
    // O descanso do cluster é o da série inteira: a dica diz isso embaixo do Volume; preenchido, sem a pendência.
    expect(t.textos()).toContain(DICA_DO_DESCANSO_DO_CLUSTER);
    expect(t.textos()).not.toContain(MENSAGEM_DESCANSO_DO_CLUSTER);
  });

  it('cluster sem descanso: pendência âmbar própria no lugar do "Falta o descanso.", sem erro no campo e sem travar', () => {
    const s = serie('c', { descansoSegundos: null, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [5, 5] } });
    const t = montar(<LinhasDaSerie {...props} grupo={{ inicio: 0, series: [s] }} series={[s]} />);
    expect(t.textos()).toEqual(expect.arrayContaining([MENSAGEM_DESCANSO_DO_CLUSTER, DICA_DO_DESCANSO_DO_CLUSTER]));
    expect(t.textos()).not.toContain('Falta o descanso.');
    // Aviso, não erro: o seletor do descanso fica sem erro e o campo segue editável (nada trava o salvar).
    const descanso = t.porProp('rotulo', 'Descanso')[0];
    expect(descanso.props.valor).toBeNull();
    expect(descanso.props.erro).toBeUndefined();
    expect(t.raiz.root.findAll((x) => x.props['aria-invalid'] === true)).toHaveLength(0);
  });

  it('membro de grupo com descanso só no fim: sem o aviso', () => {
    const s = serie('a', { descansoSegundos: null });
    const t = montar(<LinhasDaSerie {...props} grupo={{ inicio: 0, series: [s] }} series={[s]} descansoSoDoGrupo />);
    expect(t.textos()).not.toContain('Falta o descanso.');
  });

  it('observação: o contador dentro do campo e a quebra de linha vira espaço', () => {
    const aoAlterar = jest.fn();
    const s = serie('a', { alvoExtra: 'Desça devagar' });
    const t = montar(<LinhasDaSerie {...props} aoAlterar={aoAlterar} grupo={{ inicio: 0, series: [s] }} series={[s]} />);
    expect(t.textos()).toContain('13/120');
    t.digitar('Observação desta série (opcional), 13 de 120 caracteres', 'Desça\ndevagar');
    expect(aoAlterar).toHaveBeenLastCalledWith({ alvoExtra: 'Desça devagar' });
  });

  it('observação: o campo é sempre multilinha, curto ou longo (trocar remontaria o campo na web e tiraria o foco)', () => {
    const elemento = (texto: string) => { const s = serie('a', { alvoExtra: texto }); return <LinhasDaSerie {...props} grupo={{ inicio: 0, series: [s] }} series={[s]} />; };
    const t = montar(elemento('curta'));
    const observacao = () => t.raiz.root.find((x) => typeof x.props.onChangeText === 'function' && String(x.props.accessibilityLabel).startsWith('Observação'));
    expect(observacao().props.multiline).toBe(true);
    Renderer.act(() => t.raiz.update(elemento('x'.repeat(80))));
    expect(observacao().props.multiline).toBe(true);
    expect(observacao().props.numberOfLines).toBe(2);
  });
});
