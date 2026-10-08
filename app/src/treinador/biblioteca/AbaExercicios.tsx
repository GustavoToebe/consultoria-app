import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarExercicio, criarExercicio, inativarExercicio, listarExercicios } from '../../api/rotas';
import type { Exercicio, ExercicioRequest, Modalidade } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { erroDoVideo } from '../../dominio/video';
import { MODALIDADES, normalizar } from '../treino/FolhaBiblioteca';

const OPCOES_MODALIDADE = Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor: valor as Modalidade, rotulo }));

/** Exercícios da consultoria: lista, novo/editar (com vídeo) e inativar (planos já montados guardam a cópia). */
export function AbaExercicios() {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-exercicios', () => listarExercicios());
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Exercicio | null>(null);
  const termo = normalizar(busca.trim());
  const lista = (dados ?? []).filter((e) => !termo || normalizar(`${e.nome} ${e.grupoMuscular ?? ''}`).includes(termo));

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
    <View style={estilos.aba}>
      <View style={estilos.topo}>
        <View style={estilos.busca}>
          <Campo rotulo="Buscar exercício" valor={busca} aoMudar={setBusca} placeholder="Nome ou grupo" />
        </View>
        <Botao rotulo="Novo exercício" Icone={Plus} aoTocar={() => setEditando('novo')} />
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio titulo={dados.length ? 'Nenhum exercício encontrado' : 'Biblioteca de exercícios vazia'} texto={dados.length ? 'Tente outro termo de busca.' : 'Importe do catálogo ou cadastre um exercício.'} acao={dados.length ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : { rotulo: 'Cadastrar exercício', aoTocar: () => setEditando('novo') }} />
      ) : null}
      {lista.map((e) => (
        <View key={e.id} style={[estilos.linha, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          <View style={estilos.dados}>
            <Texto>{e.nome}</Texto>
            <Texto variante="pequeno">
              {[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento, e.videoUrl ? 'com vídeo' : null].filter(Boolean).join(' · ')}
            </Texto>
          </View>
          <IconeBotao Icone={Pencil} rotulo={`Editar ${e.nome}`} aoTocar={() => setEditando(e)} />
          <IconeBotao Icone={Trash2} rotulo={`Tirar ${e.nome} da biblioteca`} cor={cores.perigo} aoTocar={() => setInativar(e)} />
        </View>
      ))}
      {editando ? (
        <FolhaExercicio
          inicial={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
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
    </View>
  );
}

function FolhaExercicio({ inicial, aoFechar, aoSalvar }: { inicial: Exercicio | null; aoFechar: () => void; aoSalvar: () => void }) {
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
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !!erroDoVideo(video)} />
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
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(1) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1.5), marginBottom: espaco(1) },
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  linha: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingVertical: 2 },
  dados: { flex: 1, gap: 2, paddingVertical: espaco(0.75) },
});
