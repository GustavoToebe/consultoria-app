/* eslint-disable @typescript-eslint/no-require-imports */
import type { Exercicio } from '../../api/tipos';

// Só a composição da Identificação: as peças viram nós simples que guardam as props.
const mockCaixa = (nome: string) => (props: Record<string, unknown>) =>
  require('react').createElement(require('react-native').View, { testID: nome, ...props }, props.children as never);
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => ({ pode: () => true }) }));
jest.mock('../../api/rotas', () => ({ alterarExercicio: jest.fn(), criarExercicio: jest.fn(), listarExercicios: jest.fn() }));
jest.mock('../../ui/useCarregar', () => ({ useCarregar: () => ({ dados: mockLista, erro: null, carregando: false }) }));
jest.mock('../../ui/Folha', () => ({ Folha: mockCaixa('folha') }));
jest.mock('../../ui/Cartao', () => ({ Cartao: mockCaixa('cartao') }));
jest.mock('../../ui/Botao', () => ({ Botao: mockCaixa('botao') }));
jest.mock('../../ui/Campo', () => ({ Campo: mockCaixa('campo'), MensagemDeErro: mockCaixa('erro') }));
jest.mock('../../ui/CampoQueCresce', () => ({ CampoQueCresce: mockCaixa('campoQueCresce') }));
jest.mock('../../ui/EscolhaSuspensa', () => ({ EscolhaSuspensa: mockCaixa('escolha') }));
jest.mock('../../ui/Estados', () => ({ MensagemErro: mockCaixa('mensagemErro') }));
jest.mock('../../ui/Texto', () => ({ Texto: mockCaixa('texto') }));
jest.mock('./VideoDoExercicioEditor', () => ({ VideoDoExercicioEditor: mockCaixa('video') }));
jest.mock('./ImagemDoExercicioEditor', () => ({ ImagemDoExercicioEditor: mockCaixa('imagem') }));
jest.mock('./CamposDoCardio', () => ({ TipoDoCardio: mockCaixa('tipoDoCardio'), DetalhesDoCardio: mockCaixa('detalhesDoCardio'), medidasEmOrdem: (m: string[]) => m }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { FolhaExercicio } = require('./FolhaExercicio') as typeof import('./FolhaExercicio');

const exercicio = (n: number, grupoMuscular: string | null, equipamento: string | null): Exercicio => ({
  id: `e${n}`, nome: `Exercício ${n}`, grupoMuscular, equipamento, modalidade: 'MAQUINA', videoUrl: null, observacoes: null,
  origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
});
const mockLista: Exercicio[] = [exercicio(1, 'Panturrilha', 'Smith'), exercicio(2, 'Panturrilha', 'Esteira'), exercicio(3, 'Peito', null)];

interface PropsDaEscolha { rotulo: string; valor: string; style: object; opcoes: { valor: string; rotulo: string; detalhe?: string }[]; aoMudar: (v: string) => void;
  digitado?: { opcao: (t: string) => { rotulo: string } | null } }

function montar(inicial: Exercicio | null = null) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<FolhaExercicio inicial={inicial} aoFechar={() => undefined} aoSalvar={() => undefined} aoImagemMudou={() => undefined} todos={mockLista} erroDaBiblioteca={null} />);
  });
  const escolhas = () => raiz.root.findAll((x) => x.props.testID === 'escolha' && typeof x.type === 'string').map((x) => x.props as PropsDaEscolha);
  const escolha = (rotulo: string) => escolhas().find((e) => e.rotulo === rotulo)!;
  return { raiz, escolhas, escolha };
}

describe('FolhaExercicio › Identificação', () => {
  it('Modalidade, Grupo muscular e Equipamento: três seletores com o rótulo dentro e a mesma altura (46)', () => {
    const { escolhas } = montar();
    expect(escolhas().map((e) => e.rotulo)).toEqual(['Modalidade', 'Grupo muscular · opcional', 'Equipamento · opcional']);
    for (const e of escolhas()) expect(e.style).toMatchObject({ minHeight: 46 });
  });

  it('grupo: os que existem com a contagem, "+ Usar" para um novo e o parecido sugerido', () => {
    const { escolha } = montar();
    const grupo = escolha('Grupo muscular · opcional');
    expect(grupo.opcoes).toEqual([
      { valor: '', rotulo: 'Não informado' },
      { valor: 'Panturrilha', rotulo: 'Panturrilha', detalhe: '2 exercícios' },
      { valor: 'Peito', rotulo: 'Peito', detalhe: '1 exercício' },
    ]);
    expect(grupo.digitado?.opcao('Glúteo')?.rotulo).toBe('+ Usar “Glúteo”');
    expect(grupo.digitado?.opcao('panturrilhas')?.rotulo).toBe('Panturrilha');
  });

  it('equipamento: os padrão primeiro, depois os da consultoria; o nome novo escolhido fica como valor', () => {
    const { escolha } = montar();
    const rotulos = escolha('Equipamento · opcional').opcoes.map((o) => o.rotulo);
    expect(rotulos.slice(0, 4)).toEqual(['Não informado', 'Barra', 'Halter', 'Máquina']);
    expect(rotulos.at(-1)).toBe('Esteira');
    Renderer.act(() => escolha('Equipamento · opcional').aoMudar('Corda naval'));
    expect(escolha('Equipamento · opcional').valor).toBe('Corda naval');
    expect(escolha('Equipamento · opcional').opcoes[1]).toEqual({ valor: 'Corda naval', rotulo: 'Corda naval' });
  });

  it('Cardio: somem Grupo e Equipamento e entra o Tipo de cardio, na mesma altura', () => {
    const { raiz, escolhas, escolha } = montar();
    Renderer.act(() => escolha('Modalidade').aoMudar('CARDIO'));
    expect(escolhas().map((e) => e.rotulo)).toEqual(['Modalidade']);
    const tipo = raiz.root.find((x) => x.props.testID === 'tipoDoCardio' && typeof x.type === 'string');
    expect(tipo.props.style).toMatchObject({ minHeight: 46 });
    expect(raiz.root.findAll((x) => x.props.testID === 'detalhesDoCardio' && typeof x.type === 'string')).toHaveLength(1);
  });

  it('Observações: o campo que cresce começa com 3 linhas, e o contador mostra o uso', () => {
    const { raiz } = montar({ ...mockLista[0], observacoes: 'Texto fictício' });
    const campo = raiz.root.find((x) => x.props.testID === 'campoQueCresce' && typeof x.type === 'string');
    expect(campo.props).toMatchObject({ linhas: 3, maxLength: 4000, rotulo: 'Observações (opcional)' });
    expect(raiz.root.findAll((x) => x.props.accessibilityLabel === '14 de 4000 caracteres' && typeof x.type === 'string')).toHaveLength(1);
  });
});
