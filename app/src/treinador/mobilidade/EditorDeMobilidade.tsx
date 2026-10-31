import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { ResultadoValidacao } from '../../api/tipos';
import { type ConteudoMobilidade, normalizarMobilidade } from '../../dominio/mobilidade';
import { tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { BarraDoPlano, ProblemasDoPlano } from '../plano/TopoPlano';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { usePlanoEditor } from '../plano/usePlanoEditor';
import { SecoesDeMobilidade } from './SecoesDeMobilidade';

/**
 * Editor do plano de mobilidade do aluno: mesmo ciclo do treino e da dieta (salvar rascunho, validar, publicar
 * versão imutável), com as seções e itens do modelo de mobilidade. Sem PDF nesta versão.
 */
export default function EditorDeMobilidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editor = usePlanoEditor<ConteudoMobilidade>('mobilidade', id, normalizarMobilidade);
  const nomeDoAluno = useNomeDoAluno(editor.estado?.plano.alunoId);
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

  const titulo = tituloDoPlanoDoAluno('mobilidade', nomeDoAluno);

  return (
    <TelaDoEditor
      cabecalho={<Cabecalho titulo={titulo} trilha={trilhaDoPlano(false, estado.plano.alunoId, titulo)} subtitulo={estado.plano.titulo} voltar={`/treinador/alunos/${estado.plano.alunoId}`} />}
      barra={<BarraDoPlano tipo="mobilidade" editor={editor} aoProblemas={setProblemas} />}>
      {/* Plano de uma pasta: volta à Folha dela e lê a atualização sem perder o rascunho (reunião de 30/10). */}
      {estado.plano.pastaId ? (
        <LinhaDeAcoes>
          <VoltarParaAPasta alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
          <AtualizacaoDoPlano alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
        </LinhaDeAcoes>
      ) : null}
      <FaixaDoPlanoDoAluno tipo="mobilidade" />
      <ProblemasDoPlano editor={editor} problemas={problemas} aoProblemas={setProblemas} />
      <ConfiguracaoDoPlano editor={editor} recolhido={estado.titulo.trim() !== ''} descricao="Título e período da mobilidade." />
      <SecoesDeMobilidade conteudo={estado.conteudo} aoMudar={(c) => editor.alterarConteudo(() => c)} />
    </TelaDoEditor>
  );
}
