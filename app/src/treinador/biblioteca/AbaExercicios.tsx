import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { alterarExercicio, criarExercicio, inativarExercicio, listarExerciciosPagina, TAMANHO_DA_PAGINA_DE_EXERCICIOS } from '../../api/rotas';
import type { Exercicio, ExercicioRequest, Modalidade } from '../../api/tipos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { LinhaDaLista } from '../../ui/LinhaDaLista';
import { ListaEmColunas } from '../ListaEmColunas';
import { espaco, LARGURA_FOLHA_LARGA, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { useTema } from '../../tema/TemaProvider';
import { erroDoVideo } from '../../dominio/video';
import { MODALIDADES } from '../../dominio/modalidades';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { gruposDaConsulta, marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import {
  chipsDosExercicios, midiaParaApi, modalidadesExistentes, opcoesDeModalidade,
  ORDEM_DAS_MODALIDADES, SEM_FILTROS_DE_EXERCICIOS, semOFiltro, type FiltrosDeExercicios,
} from '../../dominio/exerciciosDaBiblioteca';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { DetalheDoExercicio, LegendaDasModalidades, SeletoresDeExercicios } from './ModalidadeDoExercicio';
import { ImagemDoExercicioEditor } from './ImagemDoExercicioEditor';
import { ImportarDePlanilha } from './ImportarDePlanilha';
import { VideoDoExercicioEditor } from './VideoDoExercicioEditor';

const OPCOES_MODALIDADE = Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor: valor as Modalidade, rotulo }));

/**
 * Largura do corpo da folha (medida) a partir da qual Modalidade, Grupo e Equipamento ficam numa linha e Vídeo e Imagem
 * lado a lado: a folha de ~640 px; abaixo disso, tudo empilha (nunca 2 + 1).
 */
const LARGURA_DAS_COLUNAS = 600;

const estilos = StyleSheet.create({
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  // Mesma composição da `FolhaAlimento`: um cartão com faixa de título por assunto, 24 px entre eles.
  partes: { gap: espaco(3) },
  // Pela base: a Modalidade (`EscolhaSuspensa`) traz o rótulo dentro da caixa, os outros dois o têm acima.
  linhaDeCampos: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(2) },
  colunaDeCampos: { gap: espaco(1.5) },
  campoIgual: { flex: 1, minWidth: 0 },
  midia: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  midiaEmpilhada: { gap: espaco(3) },
  imagemDepois: { gap: espaco(1) },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});

/** Exercícios da consultoria: lista, novo/editar (com vídeo) e inativar (planos já montados guardam a cópia). */
export function AbaExercicios() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosDeExercicios>(SEM_FILTROS_DE_EXERCICIOS);
  const buscaAtrasada = useAtrasado(busca.trim());
  // Os grupos da última resposta: a consulta só leva os marcados que ainda existem (senão "Todos os grupos" na tela e 0 no servidor).
  const [gruposConhecidos, setGruposConhecidos] = useState<string[]>([]);
  const gruposEscolhidos = gruposDaConsulta(filtros.grupos, gruposConhecidos);
  // Modalidades marcadas, na ordem da tela (chave estável). Sempre vão à consulta, mesmo a que sumiu da biblioteca: o chip
  // continua lá e "Limpar filtros" resolve, em vez de a lista voltar inteira com a caixa marcada.
  const modalidadesEscolhidas = ORDEM_DAS_MODALIDADES.filter((m) => filtros.modalidades.has(m));
  const video = midiaParaApi(filtros.video);
  const imagem = midiaParaApi(filtros.imagem);
  // Chave própria da página: a 'biblioteca-exercicios' é da lista inteira, usada em outras telas.
  const chave = JSON.stringify(['biblioteca-exercicios-pagina', pagina, buscaAtrasada, gruposEscolhidos, modalidadesEscolhidas, video, imagem]);
  const { dados, erro, carregando, recarregar } = useCarregar(chave, () =>
    listarExerciciosPagina({ texto: buscaAtrasada, grupos: gruposEscolhidos, modalidades: modalidadesEscolhidas, video, imagem, pagina }));
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Exercicio | null>(null);
  // Guardar a lista de grupos da resposta durante o render (não em efeito): a próxima consulta já sai com os grupos certos.
  if (dados && dados.grupos !== gruposConhecidos) setGruposConhecidos(dados.grupos);
  const grupos = dados?.grupos ?? gruposConhecidos;
  const opcoesDeGrupo = grupos.map((g) => ({ valor: g, rotulo: g }));
  // Grupo que já não existe (o último exercício dele saiu) não filtra: sem isso a lista ficaria vazia sem explicação.
  const gruposAtivos = marcadosExistentes(opcoesDeGrupo, filtros.grupos);
  const aplicados = { ...filtros, grupos: gruposAtivos };
  const chips = chipsDosExercicios(aplicados, opcoesDeGrupo);
  const lista = dados?.itens ?? [];
  const opcoesDeModalidades = opcoesDeModalidade(dados?.modalidades ?? [], filtros.modalidades);
  const total = dados?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA_DE_EXERCICIOS));
  const semFiltro = !buscaAtrasada && chips.length === 0;
  const mudarBusca = (texto: string) => { setBusca(texto); setPagina(0); };
  // Todos os filtros vão à API: trocar qualquer um volta à primeira página.
  const mudarFiltros = (novos: FiltrosDeExercicios) => { setFiltros(novos); setPagina(0); };

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarExercicio(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        // Tirou o único da última página: volta uma página, em vez de abrir uma vazia.
        if (pagina > 0 && lista.length === 1) setPagina(pagina - 1);
        else recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Exercícios da biblioteca"
      descricao="Os exercícios que você escolhe ao montar o treino, com vídeo quando houver."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo exercício" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <BarraDeFiltros busca={{ rotulo: 'Buscar exercício', placeholder: 'Nome ou grupo', valor: busca, aoMudar: mudarBusca }}
        valor={aplicados} aoAplicar={mudarFiltros} limpo={SEM_FILTROS_DE_EXERCICIOS} chips={chips}
        aoTirar={(chave) => mudarFiltros(semOFiltro(aplicados, chave))} painelLateral={{ titulo: 'Filtros de exercícios' }}
        seletores={(atual, mudar) => <SeletoresDeExercicios atual={atual} mudar={mudar} opcoesDeGrupo={opcoesDeGrupo} opcoesDeModalidades={opcoesDeModalidades} />} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && total === 0 ? (
        <>
        <Vazio titulo={!semFiltro ? 'Nenhum exercício encontrado' : 'Biblioteca de exercícios vazia'} texto={!semFiltro ? 'Tente outro termo de busca ou outros filtros.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um exercício.' : 'Ainda não há itens cadastrados.'} acao={chips.length > 0 ? { rotulo: 'Limpar filtros', aoTocar: () => mudarFiltros(SEM_FILTROS_DE_EXERCICIOS) } : !semFiltro ? { rotulo: 'Limpar busca', aoTocar: () => mudarBusca('') } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar exercício', aoTocar: () => setEditando('novo') } : undefined} />
        {/* Só a biblioteca realmente vazia: busca ou filtro sem resultado leva a limpar, não a importar. */}
        {semFiltro ? <ImportarDePlanilha destino="exercicios" /> : null}
        </>
      ) : null}
      {lista.length ? <LegendaDasModalidades modalidades={modalidadesExistentes(lista)} /> : null}
      {lista.length ? <ListaEmColunas divisorias>{lista.map((e) => (
        <LinhaDaLista key={e.id} titulo={e.nome}
          valores={<DetalheDoExercicio exercicio={e} />}
          inicio={<DemonstracaoDoExercicio exercicioId={e.id} nome={e.nome} imagens={e.imagens} imagemPropriaEm={e.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} preencher ampliavel reservarEspaco />}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} moldura rotulo={`Editar ${e.nome}`} aoTocar={() => setEditando(e)} /></Permitido>} />
      ))}</ListaEmColunas> : null}
      {total > TAMANHO_DA_PAGINA_DE_EXERCICIOS ? (
        <View style={estilos.paginacao}>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
          <Texto variante="suave">Página {pagina + 1} de {paginas} · {total} exercícios</Texto>
          <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
        </View>
      ) : null}
      {editando ? (
        <FolhaExercicio
          inicial={editando === 'novo' ? null : editando}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoImagemMudou={recarregar}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Exercício salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="Os planos que já usam este exercício continuam com ele. Ele só deixa de aparecer para novos planos."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </Cartao>
  );
}

function FolhaExercicio({ inicial, aoFechar, aoSalvar, aoTirar, aoImagemMudou }: { aoTirar?: () => void; inicial: Exercicio | null; aoFechar: () => void; aoSalvar: () => void; aoImagemMudou: () => void }) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const janela = useWindowDimensions().width;
  // Até medir, a estimativa da janela (no PC a folha média): a folha não abre empilhada para logo depois se arrumar.
  const [larguraMedida, setLarguraMedida] = useState<number | null>(null);
  const emColunas = (larguraMedida ?? (janela >= LARGURA_MENU_LATERAL ? LARGURA_FOLHA_LARGA : janela)) >= LARGURA_DAS_COLUNAS;
  const [atual, setAtual] = useState<Exercicio | null>(inicial);
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [grupo, setGrupo] = useState(inicial?.grupoMuscular ?? '');
  const [equipamento, setEquipamento] = useState(inicial?.equipamento ?? '');
  const [modalidade, setModalidade] = useState<Modalidade>(inicial?.modalidade ?? 'MAQUINA');
  const [video, setVideo] = useState(inicial?.videoUrl ?? '');
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);

  const salvar = () => {
    const dados: ExercicioRequest = {
      nome: nome.trim(),
      grupoMuscular: grupo.trim() || null,
      equipamento: equipamento.trim() || null,
      modalidade,
      videoUrl: video.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarExercicio(inicial.id, dados) : criarExercicio(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

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
          {/* Três colunas iguais na folha média; no celular, uma embaixo da outra. */}
          <View style={emColunas ? estilos.linhaDeCampos : estilos.colunaDeCampos}>
            <View style={emColunas ? estilos.campoIgual : null}>
              <EscolhaSuspensa rotulo="Modalidade" opcoes={OPCOES_MODALIDADE} valor={modalidade} aoMudar={setModalidade} semBusca />
            </View>
            <View style={emColunas ? estilos.campoIgual : null}>
              <Campo rotulo="Grupo muscular (opcional)" valor={grupo} aoMudar={setGrupo} erro={campos.grupoMuscular} maxLength={60} />
            </View>
            <View style={emColunas ? estilos.campoIgual : null}>
              <Campo rotulo="Equipamento (opcional)" valor={equipamento} aoMudar={setEquipamento} erro={campos.equipamento} maxLength={60} />
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Instruções" nivel={3}>
          <Campo rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} linhas={3} maxLength={4000} />
        </Cartao>

        {/* Vídeo e imagem lado a lado, cada prévia na largura da sua coluna; empilhados na folha estreita. */}
        <Cartao titulo="Vídeo e imagem" nivel={3}>
          <View style={emColunas ? estilos.midia : estilos.midiaEmpilhada}>
            <View style={emColunas ? estilos.campoIgual : null}>
              <VideoDoExercicioEditor valor={video} aoMudar={setVideo} erroDaApi={campos.videoUrl} nome={nome} />
            </View>
            <View style={emColunas ? estilos.campoIgual : null}>
              {atual ? (
                <ImagemDoExercicioEditor exercicio={atual} podeAlterar={pode('BIBLIOTECA_ALTERAR')} aoMudar={(e) => { setAtual(e); aoImagemMudou(); }} />
              ) : (
                <View style={estilos.imagemDepois}>
                  <Texto variante="rotulo" cor={cores.texto}>Imagem ou GIF</Texto>
                  <Texto variante="suave">Depois de salvar, você pode enviar uma imagem ou GIF deste exercício.</Texto>
                </View>
              )}
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

