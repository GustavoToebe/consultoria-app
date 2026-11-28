import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { alterarExercicio, criarExercicio } from '../../api/rotas';
import type { Exercicio, ExercicioRequest, MedidaDeCardio, Modalidade, TipoDeCardio } from '../../api/tipos';
import { MODALIDADES } from '../../dominio/modalidades';
import {
  contarNomes, EQUIPAMENTOS_PADRAO, LIMITE_DO_NOME, nomesDoSeletor, opcaoDoDigitado, opcoesDoSeletor,
} from '../../dominio/opcoesDoExercicio';
import type { GrupoContado } from '../../dominio/gruposMusculares';
import { erroDoVideo } from '../../dominio/video';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FOLHA_LARGA, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { Cartao } from '../../ui/Cartao';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { alturaDaMidia } from './areaDaMidia';
import { DetalhesDoCardio, medidasEmOrdem, TipoDoCardio } from './CamposDoCardio';
import { ImagemDoExercicioEditor } from './ImagemDoExercicioEditor';
import { VideoDoExercicioEditor } from './VideoDoExercicioEditor';

const OPCOES_MODALIDADE = Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor: valor as Modalidade, rotulo }));

/**
 * Largura do corpo da folha (medida) a partir da qual Modalidade, Grupo e Equipamento ficam numa linha e Vídeo e Imagem
 * lado a lado: a folha de ~640 px; abaixo disso, tudo empilha (nunca 2 + 1).
 */
const LARGURA_DAS_COLUNAS = 600;

const LIMITE_DAS_OBSERVACOES = 4000;
const NENHUM: readonly Exercicio[] = [];

/**
 * Os três seletores da Identificação com a mesma altura (46, pedido de 27/11): o rótulo pequeno e o valor dentro da caixa,
 * com menos recuo em cima e embaixo que o padrão da `EscolhaSuspensa` (52). Cresce com o texto ampliado.
 */
const SELETOR_DA_LINHA = { minHeight: 46, paddingVertical: 2 } as const;

interface Props {
  inicial: Exercicio | null;
  aoFechar: () => void;
  aoSalvar: () => void;
  /** Só na edição: fecha a folha e abre a confirmação de tirar da biblioteca. */
  aoTirar?: () => void;
  aoImagemMudou: () => void;
  /**
   * A biblioteca inteira (`GET /exercicios`) que a aba já carrega para os filtros: só para os nomes e as contagens dos
   * seletores. `undefined` enquanto não chegou (ou falhou: `erroDaBiblioteca`); a folha não espera por ela.
   */
  todos: readonly Exercicio[] | undefined;
  erroDaBiblioteca: unknown;
}

/**
 * Novo/Editar exercício da Biblioteca: Identificação (nome; Modalidade, Grupo muscular e Equipamento numa linha, os três
 * seletores com busca; no Cardio, Tipo de cardio e medidas no lugar dos dois), Instruções (observações que crescem com o
 * texto) e Vídeo e imagem (duas colunas com a área da mesma altura). Os grupos e equipamentos que já existem, com a
 * contagem, vêm da lista inteira da biblioteca (`todos`, a mesma das contagens dos filtros da aba); sem ela (carregando
 * ou com erro) os seletores seguem com o valor atual e o "+ Usar".
 */
export function FolhaExercicio({ inicial, aoFechar, aoSalvar, aoTirar, aoImagemMudou, todos = NENHUM, erroDaBiblioteca }: Props) {
  const { pode } = useSessao();
  const janela = useWindowDimensions().width;
  // Até medir, a estimativa da janela (no PC a folha média): a folha não abre empilhada para logo depois se arrumar.
  const [larguraMedida, setLarguraMedida] = useState<number | null>(null);
  const emColunas = (larguraMedida ?? (janela >= LARGURA_MENU_LATERAL ? LARGURA_FOLHA_LARGA : janela)) >= LARGURA_DAS_COLUNAS;
  const [larguraDaColuna, setLarguraDaColuna] = useState<number | null>(null);
  const alturaDaArea = larguraDaColuna ? alturaDaMidia(larguraDaColuna) : undefined;
  const [atual, setAtual] = useState<Exercicio | null>(inicial);
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [grupo, setGrupo] = useState(inicial?.grupoMuscular?.trim() ?? '');
  const [equipamento, setEquipamento] = useState(inicial?.equipamento?.trim() ?? '');
  const [modalidade, setModalidade] = useState<Modalidade>(inicial?.modalidade ?? 'MAQUINA');
  const [video, setVideo] = useState(inicial?.videoUrl ?? '');
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  // Cardio (D12): tipo e medidas. Fora do Cardio a API devolve as medidas vazias; ao passar para Cardio nascem as duas.
  const [tipoDeCardio, setTipoDeCardio] = useState<TipoDeCardio | null>(inicial?.tipoDeCardio ?? null);
  const [medidas, setMedidas] = useState<MedidaDeCardio[]>(
    inicial?.modalidade === 'CARDIO' && inicial.medidasDeCardio ? medidasEmOrdem(inicial.medidasDeCardio) : ['DISTANCIA', 'RITMO']);
  const cardio = modalidade === 'CARDIO';
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);

  const grupos = contarNomes(todos.map((e) => e.grupoMuscular));
  const equipamentos = nomesDoSeletor(contarNomes(todos.map((e) => e.equipamento)), EQUIPAMENTOS_PADRAO);

  const salvar = () => {
    // Grupo e equipamento ficam no estado ao trocar a modalidade (nada se perde ao voltar), mas o Cardio não os grava (D13).
    const dados: ExercicioRequest = {
      nome: nome.trim(),
      grupoMuscular: cardio ? null : grupo.trim() || null,
      equipamento: cardio ? null : equipamento.trim() || null,
      modalidade,
      videoUrl: video.trim() || null,
      observacoes: observacoes.trim() || null,
      // Só no Cardio; as medidas vão sempre explícitas, para a edição não cair no "mantém as gravadas".
      ...(cardio ? { tipoDeCardio, medidasDeCardio: medidas } : {}),
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarExercicio(inicial.id, dados) : criarExercicio(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  const coluna = emColunas ? estilos.campoIgual : null;
  // Abaixo da linha o erro diz de qual campo é (a caixa não tem o erro dentro).
  const errosDaLinha = cardio ? [] : ([['Grupo muscular', campos.grupoMuscular], ['Equipamento', campos.equipamento]] as const)
    .filter(([, e]) => !!e).map(([campo, e]) => ({ campo, texto: `${campo}: ${e}` }));

  return (
    <Folha
      visivel
      titulo={inicial ? 'Editar exercício' : 'Novo exercício'}
      largura={LARGURA_FOLHA_LARGA}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !!erroDoVideo(video)} motivo={!nome.trim() ? 'Informe o nome.' : 'Corrija o link do vídeo.'} />
        </>
      }>
      <View style={estilos.partes} onLayout={(e) => setLarguraMedida(Math.floor(e.nativeEvent.layout.width))}>
        <Cartao titulo="Identificação" nivel={3}>
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
          {/* Três colunas iguais na folha média (no Cardio, duas: Modalidade e Tipo); no celular, uma embaixo da outra. Os três
              seletores têm a mesma altura e o rótulo dentro, então os erros vêm abaixo da linha, sem desalinhar as caixas. */}
          <View style={emColunas ? estilos.linhaDeCampos : estilos.colunaDeCampos}>
            <View style={coluna}>
              <EscolhaSuspensa rotulo="Modalidade" opcoes={OPCOES_MODALIDADE} valor={modalidade} aoMudar={setModalidade} semBusca style={SELETOR_DA_LINHA} />
            </View>
            {cardio ? (
              <View style={coluna}>
                <TipoDoCardio valor={tipoDeCardio} aoMudar={setTipoDeCardio} style={SELETOR_DA_LINHA} />
              </View>
            ) : (
              <>
                <View style={coluna}>
                  <SeletorDeNome rotulo="Grupo muscular · opcional" titulo="Grupo muscular" valor={grupo} aoMudar={setGrupo} nomes={grupos}
                    rotuloDaBusca="Buscar ou criar grupo" textoVazio="Nenhum grupo encontrado." detalheDoNovo="Grupo muscular novo" />
                </View>
                <View style={coluna}>
                  <SeletorDeNome rotulo="Equipamento · opcional" titulo="Equipamento" valor={equipamento} aoMudar={setEquipamento} nomes={equipamentos}
                    rotuloDaBusca="Buscar ou criar equipamento" textoVazio="Nenhum equipamento encontrado." detalheDoNovo="Equipamento novo" />
                </View>
              </>
            )}
          </View>
          {errosDaLinha.map((e) => <MensagemDeErro key={e.campo} erro={e.texto} />)}
          {!cardio && erroDaBiblioteca ? (
            <Texto variante="pequeno">Não foi possível carregar os grupos e equipamentos que já existem. Digite na busca para usar um nome.</Texto>
          ) : null}
          {cardio ? (
            <DetalhesDoCardio medidas={medidas} aoMudar={setMedidas} emColunas={emColunas}
              erroDoTipo={campos.tipoDeCardio} erroDasMedidas={campos.medidasDeCardio}
              saemAoSalvar={[grupo.trim() && `o grupo muscular (${grupo.trim()})`, equipamento.trim() && `o equipamento (${equipamento.trim()})`].filter((t) => !!t)} />
          ) : null}
        </Cartao>

        <Cartao titulo="Instruções" nivel={3}>
          <View style={estilos.observacoes}>
            <CampoQueCresce rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} erro={campos.observacoes}
              linhas={3} maximoDeLinhas={12} maxLength={LIMITE_DAS_OBSERVACOES} />
            <Texto variante="pequeno" numerico style={estilos.contador} accessibilityLabel={`${observacoes.length} de ${LIMITE_DAS_OBSERVACOES} caracteres`}>
              {observacoes.length}/{LIMITE_DAS_OBSERVACOES}
            </Texto>
          </View>
        </Cartao>

        {/* Vídeo e imagem lado a lado, com a área da mesma altura (16:9 da coluna) e os botões na mesma linha; empilhados na
            folha estreita. A coluna do vídeo é medida: as duas têm a mesma largura. */}
        <Cartao titulo="Vídeo e imagem" nivel={3}>
          <View style={emColunas ? estilos.midia : estilos.midiaEmpilhada}>
            <View style={coluna} onLayout={(e) => setLarguraDaColuna(Math.floor(e.nativeEvent.layout.width))}>
              <VideoDoExercicioEditor valor={video} aoMudar={setVideo} erroDaApi={campos.videoUrl} nome={nome} altura={alturaDaArea} />
            </View>
            <View style={coluna}>
              <ImagemDoExercicioEditor exercicio={atual} podeAlterar={pode('BIBLIOTECA_ALTERAR')} altura={alturaDaArea}
                aoMudar={(e) => { setAtual(e); aoImagemMudou(); }} />
            </View>
          </View>
        </Cartao>

        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {inicial && aoTirar ? (
          <Cartao>
            <View style={estilos.tirar}>
              <Texto variante="suave" style={estilos.textoDoTirar}>Os planos que já usam este exercício continuam com ele.</Texto>
              <Botao rotulo="Tirar da biblioteca" tipo="perigo" Icone={Trash2} aoTocar={aoTirar} />
            </View>
          </Cartao>
        ) : null}
      </View>
    </Folha>
  );
}

/**
 * Grupo muscular ou Equipamento: escolha única com busca, "Não informado" primeiro, os nomes com a contagem e, para o que
 * foi digitado, o parecido que já existe no topo ou "+ Usar “texto”" no fim (`dominio/opcoesDoExercicio`). O valor é a
 * grafia escolhida (vazio = não informado).
 */
function SeletorDeNome({ rotulo, titulo, valor, aoMudar, nomes, rotuloDaBusca, textoVazio, detalheDoNovo }: {
  rotulo: string; titulo: string; valor: string; aoMudar: (v: string) => void; nomes: readonly GrupoContado[];
  rotuloDaBusca: string; textoVazio: string; detalheDoNovo: string;
}) {
  return (
    <EscolhaSuspensa<string> rotulo={rotulo} titulo={titulo} valor={valor} aoMudar={aoMudar} style={SELETOR_DA_LINHA}
      opcoes={opcoesDoSeletor(nomes, valor)} rotuloDaBusca={rotuloDaBusca} textoVazio={textoVazio}
      digitado={{ maxLength: LIMITE_DO_NOME, opcao: (t) => opcaoDoDigitado(t, nomes, detalheDoNovo) }} />
  );
}

const estilos = StyleSheet.create({
  // Mesma composição da `FolhaAlimento`: um cartão com faixa de título por assunto, 24 px entre eles.
  partes: { gap: espaco(3) },
  linhaDeCampos: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  colunaDeCampos: { gap: espaco(1.5) },
  campoIgual: { flex: 1, minWidth: 0 },
  observacoes: { gap: espaco(0.5) },
  contador: { alignSelf: 'flex-end' },
  midia: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  midiaEmpilhada: { gap: espaco(3) },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});
