import { Permitido } from '../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarLesao, excluirLesao, listarLesoes, registrarLesao } from '../api/rotas';
import type { Lesao, SituacaoLesao } from '../api/tipos';
import { dataDaTela, dataParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo, type TipoSelo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const SITUACOES: { valor: SituacaoLesao; rotulo: string; selo: TipoSelo }[] = [
  { valor: 'ATIVA', rotulo: 'Ativa', selo: 'atencao' },
  { valor: 'EM_RECUPERACAO', rotulo: 'Em recuperação', selo: 'neutro' },
  { valor: 'RECUPERADA', rotulo: 'Recuperada', selo: 'sucesso' },
];

function periodoDaLesao(l: Lesao): string {
  if (!l.dataInicio && !l.dataFim) return 'Sem datas';
  return `${dataParaTela(l.dataInicio) || '—'} a ${dataParaTela(l.dataFim) || 'em aberto'}`;
}

/** Histórico de lesões do aluno (dado sensível): o treinador registra; o sistema só guarda e mostra. */
export function CartaoLesoes({ alunoId }: { alunoId: string }) {
  const { cores } = useTema();
  const { dados, erro, carregando, recarregar } = useCarregar(`lesoes:${alunoId}`, () => listarLesoes(alunoId));
  const [editando, setEditando] = useState<Lesao | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<Lesao | null>(null);
  const [erroExcluir, setErroExcluir] = useState<unknown>(null);

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    excluirLesao(alunoId, alvo.id).then(recarregar, (e: unknown) => setErroExcluir(e));
  };

  return (
    <Cartao titulo="Histórico de lesões" descricao="Lesões registradas na ficha do aluno.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {erroExcluir ? <MensagemErro texto={textoDoErro(erroExcluir)} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando lesões" /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhuma lesão registrada.</Texto> : null}
      {dados?.map((l) => {
        const situacao = SITUACOES.find((s) => s.valor === l.situacao);
        return (
          <View key={l.id} style={[estilos.item, { borderColor: cores.borda }]}>
            <View style={estilos.dados}>
              <Texto variante="subtitulo">{l.regiao}</Texto>
              <View style={estilos.linha}>
                {situacao ? <Selo texto={situacao.rotulo} tipo={situacao.selo} /> : null}
                <Texto numerico variante="suave">{periodoDaLesao(l)}</Texto>
              </View>
              {l.descricao ? <Texto>{l.descricao}</Texto> : null}
              {l.observacao ? <Texto variante="suave">{l.observacao}</Texto> : null}
            </View>
            <View style={estilos.acoes}>
              <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar lesão em ${l.regiao}`} aoTocar={() => setEditando(l)} /></Permitido>
              <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><IconeBotao Icone={Trash2} rotulo={`Excluir lesão em ${l.regiao}`} cor={cores.textoSuave} aoTocar={() => setExcluir(l)} /></Permitido>
            </View>
          </View>
        );
      })}
      {editando ? (
        <FolhaLesao
          alunoId={alunoId}
          lesao={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
          }}
        />
      ) : null}
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR">
        <Botao rotulo="Registrar lesão" tipo="secundario" Icone={Plus} aoTocar={() => setEditando('nova')} />
      </Permitido>
      <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir este registro de lesão?"
        mensagem={excluir ? excluir.regiao : undefined}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />
    </Cartao>
  );
}

function FolhaLesao({ alunoId, lesao, aoFechar, aoSalvar }: { alunoId: string; lesao: Lesao | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [regiao, setRegiao] = useState(lesao?.regiao ?? '');
  const [descricao, setDescricao] = useState(lesao?.descricao ?? '');
  const [inicio, setInicio] = useState(dataParaTela(lesao?.dataInicio ?? null));
  const [fim, setFim] = useState(dataParaTela(lesao?.dataFim ?? null));
  const [situacao, setSituacao] = useState<SituacaoLesao>(lesao?.situacao ?? 'ATIVA');
  const [observacao, setObservacao] = useState(lesao?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido = regiao.trim() !== '' && ini !== undefined && fi !== undefined;

  const salvar = () => {
    if (!valido) return;
    const dados = {
      regiao: regiao.trim(),
      descricao: descricao.trim() || null,
      dataInicio: ini ?? null,
      dataFim: fi ?? null,
      situacao,
      observacao: observacao.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (lesao ? alterarLesao(alunoId, lesao.id, dados) : registrarLesao(alunoId, dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={lesao ? 'Editar lesão' : 'Registrar lesão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Campo rotulo="Região do corpo" valor={regiao} aoMudar={setRegiao} maxLength={80} placeholder="Ex.: Ombro direito" />
      <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} maxLength={500} multiline />
      <Escolha rotulo="Situação" opcoes={SITUACOES} valor={situacao} aoMudar={setSituacao} />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} />
        </View>
      </View>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={500} multiline />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start', justifyContent: 'space-between' },
  dados: { flexShrink: 1, gap: espaco(0.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  acoes: { flexDirection: 'row' },
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 190 },
});
