import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarExercicio, criarExercicio, inativarExercicio, listarExercicios } from '../../api/rotas';
import type { Exercicio, ExercicioRequest, Modalidade } from '../../api/tipos';
import { espaco } from '../../tema/tokens';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { gruposDosExercicios } from '../../dominio/catalogo';
import { erroDoVideo } from '../../dominio/video';
import { MODALIDADES } from '../../dominio/modalidades';
import { normalizar } from '../treino/FolhaBiblioteca';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { marcadosExistentes } from '../../dominio/selecaoMultiplaSuspensa';
import { ImagemDoExercicioEditor } from './ImagemDoExercicioEditor';

const OPCOES_MODALIDADE = Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor: valor as Modalidade, rotulo }));

/** Exercícios da consultoria: lista, novo/editar (com vídeo) e inativar (planos já montados guardam a cópia). */
export function AbaExercicios() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-exercicios', () => listarExercicios());
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Exercicio | null>(null);
  const [gruposMarcados, setGruposMarcados] = useState<Set<string>>(new Set());
  const termo = normalizar(busca.trim());
  const grupos = gruposDosExercicios(dados ?? []);
  const opcoesDeGrupo = grupos.map((g) => ({ valor: g, rotulo: g }));
  // Grupo que já não existe na lista (o último exercício dele saiu) não filtra: sem isso a lista ficaria vazia sem explicação.
  const gruposAtivos = marcadosExistentes(opcoesDeGrupo, gruposMarcados);
  const lista = (dados ?? []).filter(
    (e) => (gruposAtivos.size === 0 || gruposAtivos.has(e.grupoMuscular?.trim() ?? '')) && (!termo || normalizar(`${e.nome} ${e.grupoMuscular ?? ''}`).includes(termo)),
  );

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarExercicio(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Exercícios da biblioteca"
      descricao="Os exercícios que você escolhe ao montar o treino, com vídeo quando houver."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo exercício" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <View style={estilos.filtros}>
        <View style={estilos.busca}>
          <Campo rotulo="Buscar exercício" valor={busca} aoMudar={setBusca} placeholder="Nome ou grupo" />
        </View>
        {/* Os grupos passam de uma dúzia: lista em folha com busca em vez de cinco linhas de chips. */}
        {grupos.length > 0 ? <SelecaoMultiplaSuspensa rotulo="Grupo muscular" rotuloDeTodos="Todos os grupos" opcoes={opcoesDeGrupo} marcados={gruposMarcados} aoMudar={setGruposMarcados} style={estilos.aoPeDoCampo} /> : null}
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio titulo={dados.length ? 'Nenhum exercício encontrado' : 'Biblioteca de exercícios vazia'} texto={dados.length ? 'Tente outro termo de busca ou outro grupo muscular.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um exercício.' : 'Ainda não há itens cadastrados.'} acao={dados.length ? { rotulo: 'Limpar filtros', aoTocar: () => { setBusca(''); setGruposMarcados(new Set()); } } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar exercício', aoTocar: () => setEditando('novo') } : undefined} />
      ) : null}
      {lista.length ? <ListaDeLinhas>{lista.map((e) => (
        <LinhaDaLista key={e.id} titulo={e.nome}
          metadados={[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento, e.videoUrl ? 'com vídeo' : null].filter(Boolean).join(' · ')}
          inicio={<DemonstracaoDoExercicio exercicioId={e.id} nome={e.nome} imagens={e.imagens} imagemPropriaEm={e.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} preencher ampliavel />}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${e.nome}`} aoTocar={() => setEditando(e)} /></Permitido>} />
      ))}</ListaDeLinhas> : null}
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
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
      <Escolha rotulo="Modalidade" opcoes={OPCOES_MODALIDADE} valor={modalidade} aoMudar={setModalidade} />
      <Campo rotulo="Grupo muscular (opcional)" valor={grupo} aoMudar={setGrupo} erro={campos.grupoMuscular} maxLength={60} />
      <Campo rotulo="Equipamento (opcional)" valor={equipamento} aoMudar={setEquipamento} erro={campos.equipamento} maxLength={60} />
      <Campo
        rotulo="Vídeo (link do YouTube, opcional)"
        valor={video}
        aoMudar={setVideo}
        erro={campos.videoUrl ?? erroDoVideo(video)}
        autoCapitalize="none"
        keyboardType="url"
        maxLength={500}
      />
      <Campo rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} linhas={3} maxLength={4000} />
      {atual ? (
        <ImagemDoExercicioEditor exercicio={atual} podeAlterar={pode('BIBLIOTECA_ALTERAR')} aoMudar={(e) => { setAtual(e); aoImagemMudou(); }} />
      ) : (
        <Texto variante="suave">Depois de salvar, você pode enviar uma imagem ou GIF deste exercício.</Texto>
      )}
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5) },
  aoPeDoCampo: { alignSelf: 'flex-end' },
  busca: { flexGrow: 1, flexBasis: 220, maxWidth: 480 },
});
