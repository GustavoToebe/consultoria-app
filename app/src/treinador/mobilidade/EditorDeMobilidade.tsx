import { router, useLocalSearchParams } from 'expo-router';
import { NotebookTabs } from 'lucide-react-native';
import { useState } from 'react';

import { salvarPlanoComoReceita } from '../../api/rotas';
import type { ResultadoValidacao } from '../../api/tipos';
import { aplicarModeloDeMobilidade, type ConteudoMobilidade, normalizarMobilidade } from '../../dominio/mobilidade';
import { tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { FolhaReceitas } from '../FolhaReceitas';
import { FolhaSalvarReceita } from '../FolhaSalvarReceita';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { OpcaoDeModelo } from '../plano/OpcaoDeModelo';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { BarraDoPlano, ProblemasDoPlano } from '../plano/TopoPlano';
import { ComColunas } from '../plano/ColunasDoEditor';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { usePlanoEditor } from '../plano/usePlanoEditor';
import { SecoesDeMobilidade } from './SecoesDeMobilidade';

/**
 * Editor do plano de mobilidade do aluno: mesmo ciclo do treino e da dieta (salvar rascunho, validar, publicar
 * versão imutável, PDF do rascunho ou da versão publicada pela `BarraDoPlano`), com as seções e itens do modelo de
 * mobilidade. "Modelos" (como no treino e na dieta) usa um modelo de mobilidade no rascunho, com "Desfazer", ou guarda o
 * rascunho como modelo no Planejamento. Não há "Ver como o aluno" na mobilidade.
 */
export default function EditorDeMobilidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editor = usePlanoEditor<ConteudoMobilidade>('mobilidade', id, normalizarMobilidade);
  const nomeDoAluno = useNomeDoAluno(editor.estado?.plano.alunoId);
  const { avisar } = useAviso();
  const { temFuncionalidade } = useSessao();
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [irPara, setIrPara] = useState<{ uids: string[]; vez: number } | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoMobilidade> | null>(null);
  const [modelos, setModelos] = useState(false);
  const [folha, setFolha] = useState<'usar' | 'salvar' | null>(null);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de mobilidade" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar}
          acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/alunos') }} /> : <Esqueleto />}
      </Tela>
    );
  }

  const titulo = tituloDoPlanoDoAluno('mobilidade', nomeDoAluno);
  // Fora do plano a mobilidade abre só para consulta (a API recusa salvar): sem "Modelos", como sem Salvar e Publicar.
  const escritaLiberada = temFuncionalidade('MOBILIDADE');

  return (
    <TelaDoEditor
      colunas
      cabecalho={<Cabecalho titulo={titulo} trilha={trilhaDoPlano(false, estado.plano.alunoId, titulo)} subtitulo={estado.plano.titulo} voltar={`/treinador/alunos/${estado.plano.alunoId}`} />}
      barra={<BarraDoPlano tipo="mobilidade" editor={editor} aoProblemas={setProblemas} />}>
      {/* Plano de uma pasta: volta à Folha dela e lê a atualização sem perder o rascunho (reunião de 30/10). */}
      {estado.plano.pastaId ? (
        <LinhaDeAcoes>
          <VoltarParaAPasta alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
          <AtualizacaoDoPlano alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
        </LinhaDeAcoes>
      ) : null}
      {/* A mesma ordem do treino e da dieta: pasta, problemas, de quem é o plano, o plano. */}
      <ProblemasDoPlano editor={editor} problemas={problemas} aoProblemas={setProblemas}
        aoIrAoPrimeiro={(uids) => setIrPara((p) => ({ uids, vez: (p?.vez ?? 0) + 1 }))} />
      <FaixaDoPlanoDoAluno tipo="mobilidade" />
      {/* O modelo aplicado troca as seções inteiras: o Desfazer fica logo acima delas. */}
      {desfazer ? (
        <BarraDesfazer
          desfazer={desfazer}
          aoDesfazer={() => {
            const anterior = desfazer.conteudo;
            setDesfazer(null);
            editor.alterarConteudo(() => anterior);
          }}
          aoFechar={() => setDesfazer(null)}
        />
      ) : null}
      <SecoesDeMobilidade conteudo={estado.conteudo} aoMudar={(c) => editor.alterarConteudo(() => c)} irPara={irPara}
        acoes={escritaLiberada ? <Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} /> : null}
        aoLado={<ComColunas>{(duas) => (
          // Em duas colunas a configuração divide a linha com as Orientações: aberta não custa altura, então começa aberta.
          <ConfiguracaoDoPlano editor={editor} recolhido={!duas && estado.titulo.trim() !== ''} descricao="Título e período da mobilidade." />
        )}</ComColunas>} />

      {modelos ? (
        <Folha visivel titulo="Modelos" aoFechar={() => setModelos(false)}>
          <OpcaoDeModelo
            titulo="Usar modelo de mobilidade"
            descricao="Troca as seções do plano pelas do modelo (as orientações ficam). Dá para desfazer."
            aoEscolher={() => { setModelos(false); setFolha('usar'); }}
          />
          <OpcaoDeModelo
            titulo={rotuloSalvarComo('MOBILIDADE')}
            descricao="Guarda as seções e os itens deste rascunho para reutilizar. O plano continua igual."
            aoEscolher={() => { setModelos(false); setFolha('salvar'); }}
          />
        </Folha>
      ) : null}
      {folha === 'usar' ? (
        <FolhaReceitas
          tipo="MOBILIDADE"
          titulo="Usar modelo de mobilidade"
          explicacao="As seções do plano são trocadas pelas do modelo (as orientações ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            setDesfazer({ rotulo: `Modelo “${r.nome}” aplicado.`, conteudo: estado.conteudo });
            editor.alterarConteudo((a) => aplicarModeloDeMobilidade(a, r.conteudo));
          }}
        />
      ) : null}
      {folha === 'salvar' && id ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('MOBILIDADE')}
          explicacao="Guarda as seções e os itens do rascunho como modelo de mobilidade no Planejamento. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('mobilidade', id, nome, descricao);
            setFolha(null);
            avisar(avisoModeloSalvo('MOBILIDADE'), 'sucesso');
          }}
        />
      ) : null}
    </TelaDoEditor>
  );
}
