import { useLocalSearchParams } from 'expo-router';
import { receita } from '../../../../api/rotas';
import EditorDeDieta from '../../../../treinador/dieta/EditorDeDieta';
import { EditorModelo } from '../../../../treinador/planejamento/EditorModelo';
import EditorDeTreino from '../../../../treinador/treino/EditorDeTreino';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { MensagemErro } from '../../../../ui/Estados';
import { textoDoErro } from '../../../../ui/erros';
import { Tela } from '../../../../ui/Tela';
import { useCarregar } from '../../../../ui/useCarregar';

export default function Modelo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const carga = useCarregar(`modelo:${id}`, () => receita(id));
  if (!carga.dados) return <Tela bordas={['top']}><Cabecalho titulo="Modelo" voltar="/treinador/planejamento" />{carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} tentarDeNovo={carga.recarregar} /> : <Esqueleto />}</Tela>;
  if (carga.dados.tipo === 'PLANO_TREINO' || carga.dados.tipo === 'SESSAO_TREINO') return <EditorDeTreino key={id} modelo unica={carga.dados.tipo === 'SESSAO_TREINO'} />;
  if (carga.dados.tipo === 'PLANO_DIETA' || carga.dados.tipo === 'REFEICAO') return <EditorDeDieta key={id} modelo unica={carga.dados.tipo === 'REFEICAO'} />;
  return <EditorModelo key={`${id}:${carga.dados.versao}`} receita={carga.dados} aoRecarregar={carga.recarregar} />;
}
