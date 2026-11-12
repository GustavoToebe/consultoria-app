import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { espaco } from '../../tema/tokens';
import { erroDoVideo } from '../../dominio/video';
import { MODALIDADES } from '../../dominio/modalidades';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { gruposDaConsulta, marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import { BarraDaBiblioteca } from './BarraDaBiblioteca';
import { ImagemDoExercicioEditor } from './ImagemDoExercicioEditor';

const OPCOES_MODALIDADE = Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor: valor as Modalidade, rotulo }));

const estilos = StyleSheet.create({
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  // As medidas da `FolhaAlimento`: 180 px por campo deixa o par lado a lado na folha do PC (600) e empilhado no celular.
  partes: { gap: espaco(3) },
  linhaDeCampos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  campoLargo: { flexGrow: 1, flexBasis: 180 },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});

/** Exercícios da consultoria: lista, novo/editar (com vídeo) e inativar (planos já montados guardam a cópia). */
export function AbaExercicios() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [gruposMarcados, setGruposMarcados] = useState<Set<string>>(new Set());
  const buscaAtrasada = useAtrasado(busca.trim());
  // Os grupos da última resposta: a consulta só leva os marcados que ainda existem (senão "Todos os grupos" na tela e 0 no servidor).
  const [gruposConhecidos, setGruposConhecidos] = useState<string[]>([]);
  const gruposEscolhidos = gruposDaConsulta(gruposMarcados, gruposConhecidos);
  // Chave própria da página: a 'biblioteca-exercicios' é da lista inteira, usada em outras telas.
  const chave = JSON.stringify(['biblioteca-exercicios-pagina', pagina, buscaAtrasada, gruposEscolhidos]);
  const { dados, erro, carregando, recarregar } = useCarregar(chave, () =>
    listarExerciciosPagina({ texto: buscaAtrasada, grupos: gruposEscolhidos, pagina }));
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Exercicio | null>(null);
  // Guardar a lista de grupos da resposta durante o render (não em efeito): a próxima consulta já sai com os grupos certos.
  if (dados && dados.grupos !== gruposConhecidos) setGruposConhecidos(dados.grupos);
  const grupos = dados?.grupos ?? gruposConhecidos;
  const opcoesDeGrupo = grupos.map((g) => ({ valor: g, rotulo: g }));
  // Grupo que já não existe (o último exercício dele saiu) não filtra: sem isso a lista ficaria vazia sem explicação.
  const gruposAtivos = marcadosExistentes(opcoesDeGrupo, gruposMarcados);
  const lista = dados?.itens ?? [];
  const total = dados?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA_DE_EXERCICIOS));
  const semFiltro = !buscaAtrasada && gruposEscolhidos.length === 0;
  const mudarBusca = (texto: string) => { setBusca(texto); setPagina(0); };
  const mudarGrupos = (novos: Set<string>) => { setGruposMarcados(novos); setPagina(0); };

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
      <BarraDaBiblioteca rotulo="Buscar exercício" placeholder="Nome ou grupo" valor={busca} aoMudar={mudarBusca}
        filtro={grupos.length > 0 ? { tipo: 'varias', rotulo: 'Grupo muscular', rotuloDeTodos: 'Todos os grupos', opcoes: opcoesDeGrupo, marcados: gruposAtivos, aoMudar: mudarGrupos } : null} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && total === 0 ? (
        <Vazio titulo={!semFiltro ? 'Nenhum exercício encontrado' : 'Biblioteca de exercícios vazia'} texto={!semFiltro ? 'Tente outro termo de busca ou outro grupo muscular.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um exercício.' : 'Ainda não há itens cadastrados.'} acao={!semFiltro ? { rotulo: 'Limpar filtros', aoTocar: () => { mudarBusca(''); mudarGrupos(new Set()); } } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar exercício', aoTocar: () => setEditando('novo') } : undefined} />
      ) : null}
      {lista.length ? <ListaDeLinhas divisorias>{lista.map((e) => (
        <LinhaDaLista key={e.id} titulo={e.nome}
          metadados={[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento, e.videoUrl ? 'com vídeo' : null].filter(Boolean).join(' · ')}
          inicio={<DemonstracaoDoExercicio exercicioId={e.id} nome={e.nome} imagens={e.imagens} imagemPropriaEm={e.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} preencher ampliavel />}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} moldura rotulo={`Editar ${e.nome}`} aoTocar={() => setEditando(e)} /></Permitido>} />
      ))}</ListaDeLinhas> : null}
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
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !!erroDoVideo(video)} motivo={!nome.trim() ? 'Informe o nome.' : 'Corrija o link do vídeo.'} />
        </>
      }>
      {/* Mesma composição da `FolhaAlimento`: um cartão com faixa de título por assunto, 24 px entre eles. */}
      <View style={estilos.partes}>
        <Cartao titulo="Identificação" nivel={3}>
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
          <EscolhaSuspensa rotulo="Modalidade" opcoes={OPCOES_MODALIDADE} valor={modalidade} aoMudar={setModalidade} semBusca />
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Grupo muscular (opcional)" valor={grupo} aoMudar={setGrupo} erro={campos.grupoMuscular} maxLength={60} />
            </View>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Equipamento (opcional)" valor={equipamento} aoMudar={setEquipamento} erro={campos.equipamento} maxLength={60} />
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Instruções" nivel={3}>
          <Campo rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} linhas={3} maxLength={4000} />
        </Cartao>

        <Cartao titulo="Vídeo e imagem" nivel={3}>
          <Campo
            rotulo="Vídeo (link do YouTube, opcional)"
            valor={video}
            aoMudar={setVideo}
            erro={campos.videoUrl ?? erroDoVideo(video)}
            autoCapitalize="none"
            keyboardType="url"
            maxLength={500}
          />
          {atual ? (
            <ImagemDoExercicioEditor exercicio={atual} podeAlterar={pode('BIBLIOTECA_ALTERAR')} aoMudar={(e) => { setAtual(e); aoImagemMudou(); }} />
          ) : (
            <Texto variante="suave">Depois de salvar, você pode enviar uma imagem ou GIF deste exercício.</Texto>
          )}
        </Cartao>

        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {inicial && aoTirar ? (
          <Cartao>
            <View style={estilos.tirar}>
              <Texto variante="suave" style={estilos.textoDoTirar}>Os planos que já usam este exercício continuam com ele.</Texto>
              <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} />
            </View>
          </Cartao>
        ) : null}
      </View>
    </Folha>
  );
}

