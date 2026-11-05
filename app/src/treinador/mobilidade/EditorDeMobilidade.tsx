import { router, useLocalSearchParams } from 'expo-router';
import { NotebookTabs } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { salvarPlanoComoReceita } from '../../api/rotas';
import type { ResultadoValidacao } from '../../api/tipos';
import { aplicarModeloDeMobilidade, type ConteudoMobilidade, normalizarMobilidade } from '../../dominio/mobilidade';
import { tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { FolhaReceitas } from '../FolhaReceitas';
import { FolhaSalvarReceita } from '../FolhaSalvarReceita';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
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
 * versão imutável, PDF do rascunho ou da versão publicada pela `BarraDoPlano`), com as seções e itens do modelo de
 * mobilidade. "Modelos" (como no treino e na dieta) usa um modelo de mobilidade no rascunho, com "Desfazer", ou guarda o
 * rascunho como modelo no Planejamento.
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
      <FaixaDoPlanoDoAluno tipo="mobilidade" />
      <ProblemasDoPlano editor={editor} problemas={problemas} aoProblemas={setProblemas}
        aoIrAoPrimeiro={(uids) => setIrPara((p) => ({ uids, vez: (p?.vez ?? 0) + 1 }))} />
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
      <ConfiguracaoDoPlano editor={editor} recolhido={estado.titulo.trim() !== ''} descricao="Título e período da mobilidade." />
      <SecoesDeMobilidade conteudo={estado.conteudo} aoMudar={(c) => editor.alterarConteudo(() => c)} irPara={irPara}
        acoes={escritaLiberada ? <Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} /> : null} />

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

/** Linha de ação da folha "Modelos": título, o que faz e um toque para escolher (a mesma do treino e da dieta). */
function OpcaoDeModelo({ titulo, descricao, aoEscolher }: { titulo: string; descricao: string; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={aoEscolher}
      style={({ pressed }) => [estilos.opcaoModelo, { backgroundColor: pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda }]}>
      <Texto variante="bloco">{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcaoModelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
});
