import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { ResultadoValidacao } from '../../api/tipos';
import { type ConteudoMobilidade, normalizarMobilidade } from '../../dominio/mobilidade';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { TopoPlano } from '../plano/TopoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { usePlanoEditor } from '../plano/usePlanoEditor';
import { SecoesDeMobilidade } from './SecoesDeMobilidade';

/**
 * Editor do plano de mobilidade do aluno: mesmo ciclo do treino e da dieta (rascunho salvo sozinho, validar, publicar
 * versão imutável), com as seções e itens do modelo de mobilidade. Sem PDF nesta versão.
 */
export default function EditorDeMobilidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editor = usePlanoEditor<ConteudoMobilidade>('mobilidade', id, normalizarMobilidade);
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de mobilidade" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
      </Tela>
    );
  }

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Plano de mobilidade" trilha={trilhaDoPlano(false, estado.plano.alunoId, 'Plano de mobilidade')} subtitulo={estado.plano.titulo} voltar={`/treinador/alunos/${estado.plano.alunoId}`} />
      <TopoPlano tipo="mobilidade" editor={editor} problemas={problemas} aoProblemas={setProblemas} />
      <ConfiguracaoDoPlano editor={editor} recolhido={estado.titulo.trim() !== ''} descricao="Título e período da mobilidade." />
      <SecoesDeMobilidade conteudo={estado.conteudo} aoMudar={(c) => editor.alterarConteudo(() => c)} />
    </Tela>
  );
}
