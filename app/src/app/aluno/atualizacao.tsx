import { useLocalSearchParams } from 'expo-router';
import { FormularioAtualizacao } from '../../aluno/atualizacao/FormularioAtualizacao';
import { useAtualizacao } from '../../aluno/atualizacao/useAtualizacao';
import { SeloSincronizacao } from '../../aluno/SeloSincronizacao';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

export default function AtualizacaoAluno() {
  const {id,atraso}=useLocalSearchParams<{id?:string;atraso?:string}>();
  const resultado=useAtualizacao(id);
  const {repositorio}=useAluno();
  const pasta=resultado.dados?.pastaId;
  const rascunho=useCarregar(pasta??null,()=>repositorio.lerRascunhoAtualizacao(pasta!));
  return <Tela largura={720} rolar={false} bordas={['top']}>
    <Cabecalho titulo={`Atualização${resultado.dados?.dataAtualizacao?` · ${dataParaTela(resultado.dados.dataAtualizacao)}`:''}`}
      voltar="/aluno" acoes={<SeloSincronizacao />} />
    {resultado.carregando || rascunho.carregando?<Esqueleto texto="Carregando atualização" />:null}
    {resultado.erro?<MensagemErro texto={textoDoErro(resultado.erro)} />:null}
    {rascunho.erro?<MensagemErro texto="Não foi possível ler o rascunho. Volte e tente novamente." />:null}
    {resultado.dados && !resultado.dados.modelo?<Vazio titulo="Sem atualização" texto="Seu treinador ainda não publicou uma pasta com período." />:null}
    {resultado.dados?.modelo && !resultado.carregando && !rascunho.carregando && !rascunho.erro?<FormularioAtualizacao
      key={`${pasta}:${resultado.dados.versao}:${resultado.dados.modeloVersao}`}
      atualizacao={resultado.dados} rascunho={rascunho.dados??null} abrirAtraso={atraso==='sim'} recarregar={resultado.recarregar} />:null}
  </Tela>;
}
