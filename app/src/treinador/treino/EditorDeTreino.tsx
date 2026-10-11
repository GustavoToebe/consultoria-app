import { useLocalSearchParams } from 'expo-router';
import { NotebookTabs } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { consultoria, criarReceita, salvarPlanoComoReceita } from '../../api/rotas';
import type { Configuracao, ConteudoTreino, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import {
  aplicarReceitaDePlano,
  comUidsNovos,
  mover,
  normalizarTreino,
  novaSessao,
  novoExercicio,
  remover,
  sessaoSelecionadaDepois,
  seriesDaReceita,
  seriesParaReceita,
  substituir,
  unidadeDaModalidade,
} from '../../dominio/editorTreino';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { TopoModelo } from '../../treinador/plano/TopoModelo';
import { TopoPlano } from '../../treinador/plano/TopoPlano';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { useAviso } from '../../ui/Aviso';
import { CartaoExercicio } from '../../treinador/treino/CartaoExercicio';
import { CartaoSessao } from '../../treinador/treino/CartaoSessao';
import { FolhaBiblioteca } from '../../treinador/treino/FolhaBiblioteca';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { SeletorDeSessoes } from './SeletorDeSessoes';
import { Folha } from '../../ui/Folha';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';

type Alvo = { sessao: number; exercicio: number };
type FolhaAberta =
  | { tipo: 'biblioteca'; alvo: Alvo }
  | { tipo: 'receitaSeries'; alvo: Alvo }
  | { tipo: 'salvarSeries'; alvo: Alvo }
  | { tipo: 'receitaPlano' }
  | { tipo: 'salvarPlano' } | { tipo: 'metodologia' } | { tipo: 'sessao' } | { tipo: 'salvarSessao'; indice: number };

/** Editor do plano de treino (seção 10.4, item 4): a tela mais importante do treinador. */
export default function EditorDeTreino({ modelo = false, unica = false }: { modelo?: boolean; unica?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoTreino>('treino', id, normalizarTreino, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const global = useCarregar('consultoria', () => consultoria()).dados?.configuracao ?? null;
  const config = editor.estado?.conteudo.metodologia?.configuracao ?? global;
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoTreino> | null>(null);
  // Uma sessão aparece por vez. Se o uid sumiu (desfazer, recarregar), vale a primeira.
  const [selecionadaUid, setSelecionadaUid] = useState<string | null>(null);
  const [modelos, setModelos] = useState(false);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de treino" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
      </Tela>
    );
  }

  const c = estado.conteudo;
  const comErro = uidsComProblema(c, (problemas?.erros ?? []).map((p) => p.caminho));
  const alternar = (uid: string) =>
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(uid)) novo.delete(uid);
      else novo.add(uid);
      return novo;
    });
  const abrir = (uid: string) => setAbertos((a) => new Set(a).add(uid));
  const indiceSelecionado = Math.max(0, c.sessoes.findIndex((x) => x.uid === selecionadaUid));
  const sessaoAtual = c.sessoes[indiceSelecionado] ?? null;
  const sessoesComProblema = new Set(c.sessoes.filter((x) => comErro.has(x.uid) || x.exercicios.some((e) => comErro.has(e.uid))).map((x) => x.uid));
  /** Resultado da validação: com erro, abre a primeira sessão que precisa de correção. */
  const aoProblemas = (r: ResultadoValidacao | null) => {
    setProblemas(r);
    if (r?.erros.length) {
      const uids = uidsComProblema(c, r.erros.map((p) => p.caminho));
      setSelecionadaUid(sessaoSelecionadaDepois(c.sessoes, sessaoAtual?.uid ?? null, { tipo: 'erros', uidsComErro: uids }));
    }
  };

  /** Mudança grande (receita, remoção): guarda o conteúdo anterior para o "Desfazer". */
  const comDesfazer = (rotulo: string, mudanca: (c: ConteudoTreino) => ConteudoTreino) => {
    setDesfazer({ rotulo, conteudo: c });
    editor.alterarConteudo(mudanca);
  };

  const mudarSessoes = (fn: (s: ConteudoTreino['sessoes']) => ConteudoTreino['sessoes']) =>
    editor.alterarConteudo((atual) => ({ ...atual, sessoes: fn(atual.sessoes) }));

  const mudarExercicios = (si: number, fn: (e: ConteudoTreino['sessoes'][number]['exercicios']) => ConteudoTreino['sessoes'][number]['exercicios']) =>
    mudarSessoes((sessoes) => substituir(sessoes, si, { ...sessoes[si], exercicios: fn(sessoes[si].exercicios) }));

  const adicionarSessao = () => {
    const usados = new Set(c.sessoes.map((s) => s.diaSemana));
    const dia = [1, 2, 3, 4, 5, 6, 7].find((d) => !usados.has(d)) ?? null;
    const nova = novaSessao(dia);
    mudarSessoes((s) => [...s, nova]);
    setSelecionadaUid(nova.uid);
  };

  const adicionarExercicio = (si: number) => {
    const novo = novoExercicio();
    mudarExercicios(si, (e) => [...e, novo]);
    abrir(novo.uid);
    setFolha({ tipo: 'biblioteca', alvo: { sessao: si, exercicio: c.sessoes[si].exercicios.length } });
  };

  const titulo = modelo ? tituloDoModelo(unica ? 'SESSAO_TREINO' : 'PLANO_TREINO') : tituloDoPlanoDoAluno('treino', nomeDoAluno);

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo={titulo} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />
      {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="treino" />}
      {modelo ? <TopoModelo editor={editor} /> : <TopoPlano tipo="treino" editor={editor} problemas={problemas} aoProblemas={aoProblemas} />}
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
      <ConfiguracaoDoPlano
        editor={editor}
        modelo={modelo}
        recolhido={c.sessoes.length > 0 && estado.titulo.trim() !== ''}
        descricao="Título, período, metodologia e orientações gerais do plano.">
        <View style={estilos.metodologia}>
          <Texto style={estilos.metodologiaTexto}>{c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Metodologia: nenhuma vinculada'}</Texto>
          <Botao rotulo={c.metodologia ? 'Trocar' : 'Vincular'} tipo="secundario" aoTocar={() => setFolha({ tipo: 'metodologia' })} />
        </View>
        <Texto variante="suave">Uma cópia das regras acompanha este treino. Vincular outra metodologia orienta as novas séries; as séries existentes continuam editáveis.</Texto>
        <Campo
          rotulo="Objetivo (opcional)"
          valor={c.objetivo ?? ''}
          aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, objetivo: t || null }))}
          maxLength={200}
        />
        <Campo
          rotulo="Orientações gerais (opcional)"
          valor={c.orientacoes ?? ''}
          aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, orientacoes: t || null }))}
          linhas={4}
          maxLength={8000}
        />
      </ConfiguracaoDoPlano>
      <SeletorDeSessoes
        sessoes={c.sessoes}
        selecionada={sessaoAtual?.uid ?? null}
        comProblema={sessoesComProblema}
        aoSelecionar={setSelecionadaUid}
        aoAdicionar={adicionarSessao}
        adicionarDesabilitado={unica && c.sessoes.length >= 1}
        acao={<Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} />}
      />
      {c.sessoes.length === 0 ? (
        <Vazio texto="O plano ainda não tem sessões. Adicione uma ou comece de um modelo de semana (botão Modelos)." />
      ) : null}
      {sessaoAtual ? (
        <CartaoSessao
          key={sessaoAtual.uid}
          sessao={sessaoAtual}
          posicao={indiceSelecionado}
          total={c.sessoes.length}
          comProblema={sessoesComProblema.has(sessaoAtual.uid)}
          aoMudar={(nova) => mudarSessoes((lista) => substituir(lista, indiceSelecionado, nova))}
          aoMover={(d) => mudarSessoes((lista) => mover(lista, indiceSelecionado, d))}
          removivel={!unica}
          aoRemover={() => {
            const removida = sessaoAtual;
            setSelecionadaUid(sessaoSelecionadaDepois(c.sessoes, removida.uid, { tipo: 'remover', uid: removida.uid }));
            comDesfazer(`Sessão “${removida.nome || indiceSelecionado + 1}” removida.`, (a) => ({ ...a, sessoes: a.sessoes.filter((x) => x.uid !== removida.uid) }));
          }}
          aoSalvarModelo={() => setFolha({ tipo: 'salvarSessao', indice: indiceSelecionado })}
          aoNovoExercicio={() => adicionarExercicio(indiceSelecionado)}
          todosAbertos={sessaoAtual.exercicios.length > 0 && sessaoAtual.exercicios.every((e) => abertos.has(e.uid))}
          aoAlternarTodos={() => {
            const uids = sessaoAtual.exercicios.map((e) => e.uid);
            const todos = uids.every((u) => abertos.has(u));
            setAbertos((a) => { const novo = new Set(a); uids.forEach((u) => (todos ? novo.delete(u) : novo.add(u))); return novo; });
          }}>
          {sessaoAtual.exercicios.map((e, ei) => (
            <CartaoExercicio
              key={e.uid}
              exercicio={e}
              posicao={ei}
              total={sessaoAtual.exercicios.length}
              aberto={abertos.has(e.uid)}
              comProblema={comErro.has(e.uid)}
              config={config}
              aoAbrir={() => alternar(e.uid)}
              aoMudar={(novo) => mudarExercicios(indiceSelecionado, (lista) => substituir(lista, ei, novo))}
              aoMover={(d) => mudarExercicios(indiceSelecionado, (lista) => mover(lista, ei, d))}
              aoRemover={() =>
                comDesfazer(`Exercício “${e.nome || ei + 1}” removido.`, (a) => ({
                  ...a,
                  sessoes: substituir(a.sessoes, indiceSelecionado, { ...a.sessoes[indiceSelecionado], exercicios: remover(a.sessoes[indiceSelecionado].exercicios, ei) }),
                }))
              }
              aoEscolherDaBiblioteca={() => setFolha({ tipo: 'biblioteca', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
              aoUsarReceita={() => setFolha({ tipo: 'receitaSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
              aoSalvarReceita={() => setFolha({ tipo: 'salvarSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
            />
          ))}
        </CartaoSessao>
      ) : null}

      {modelos ? (
        <Folha visivel titulo="Modelos" aoFechar={() => setModelos(false)}>
          <OpcaoDeModelo
            titulo="Usar modelo de semana"
            descricao="Troca as sessões do plano pelas do modelo (objetivo e orientações ficam). Dá para desfazer."
            desabilitado={unica}
            aoEscolher={() => { setModelos(false); setFolha({ tipo: 'receitaPlano' }); }}
          />
          <OpcaoDeModelo
            titulo="Adicionar treino de um modelo"
            descricao="Acrescenta ao plano as sessões de um modelo de treino."
            desabilitado={unica}
            aoEscolher={() => { setModelos(false); setFolha({ tipo: 'sessao' }); }}
          />
          {!modelo && c.sessoes.length ? (
            <OpcaoDeModelo
              titulo="Salvar a semana como modelo"
              descricao="Guarda as sessões, os exercícios e as séries deste rascunho para reutilizar. O plano continua igual."
              aoEscolher={() => { setModelos(false); setFolha({ tipo: 'salvarPlano' }); }}
            />
          ) : null}
        </Folha>
      ) : null}

      {folha?.tipo === 'metodologia' ? <FolhaReceitas tipo="METODOLOGIA" titulo="Vincular metodologia" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Metodologia vinculada.', (a) => ({ ...a, metodologia: { id: r.id, nome: r.nome, configuracao: JSON.parse(JSON.stringify(r.conteudo)) as Configuracao } }));
      }} /> : null}
      {folha?.tipo === 'sessao' ? <FolhaReceitas tipo="SESSAO_TREINO" titulo="Adicionar treino do modelo" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Treino adicionado.', (a) => ({ ...a, sessoes: [...a.sessoes, ...comUidsNovos(normalizarTreino(r.conteudo)).sessoes] }));
      }} /> : null}
      {folha?.tipo === 'salvarSessao' ? <FolhaSalvarReceita titulo="Salvar treino como modelo" aoFechar={() => setFolha(null)} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'SESSAO_TREINO', nome, descricao, conteudo: { ...c, sessoes: [c.sessoes[folha.indice]] } });
        setFolha(null); avisar('Modelo de treino salvo.', 'sucesso');
      }} /> : null}
      <FolhaBiblioteca
        visivel={folha?.tipo === 'biblioteca'}
        aoFechar={() => setFolha(null)}
        aoEscolher={(escolhido) => {
          if (folha?.tipo !== 'biblioteca') return;
          const { sessao: si, exercicio: ei } = folha.alvo;
          setFolha(null);
          mudarExercicios(si, (lista) => {
            const atual = lista[ei];
            if (!atual) return lista;
            const daBiblioteca =
              'id' in escolhido
                ? {
                    exercicioId: escolhido.id,
                    nome: escolhido.nome,
                    modalidade: escolhido.modalidade,
                    videoUrl: escolhido.videoUrl,
                    unidade: unidadeDaModalidade(escolhido.modalidade),
                  }
                : { exercicioId: null, nome: escolhido.nome, modalidade: null };
            return substituir(lista, ei, { ...atual, ...daBiblioteca });
          });
        }}
      />
      {folha?.tipo === 'receitaSeries' ? (
        <FolhaReceitas
          tipo="SERIES"
          titulo="Modelo de séries"
          explicacao="As séries do exercício são trocadas pelas do modelo. Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            const { sessao: si, exercicio: ei } = folha.alvo;
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicada.`, (a) => {
              const sessao = a.sessoes[si];
              const exercicio = sessao?.exercicios[ei];
              if (!exercicio) return a;
              const novo = { ...exercicio, series: seriesDaReceita(r.conteudo) };
              return { ...a, sessoes: substituir(a.sessoes, si, { ...sessao, exercicios: substituir(sessao.exercicios, ei, novo) }) };
            });
          }}
        />
      ) : null}
      {folha?.tipo === 'receitaPlano' ? (
        <FolhaReceitas
          tipo="PLANO_TREINO"
          titulo="Modelo de semana"
          explicacao="As sessões do plano são trocadas pelas do modelo (o objetivo e as orientações ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicada.`, (a) => aplicarReceitaDePlano(a, r.conteudo));
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarSeries' ? (
        <FolhaSalvarReceita
          titulo="Salvar séries como modelo"
          explicacao="Guarda a estrutura das séries deste exercício (tipos, quantidades, faixas e intensidade) para usar em outros exercícios e planos."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            const exercicio = c.sessoes[folha.alvo.sessao]?.exercicios[folha.alvo.exercicio];
            if (!exercicio) return;
            await criarReceita({ tipo: 'SERIES', nome, descricao, conteudo: seriesParaReceita(exercicio.series) });
            setFolha(null);
            avisar('Modelo de séries salva.', 'sucesso');
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarPlano' && id ? (
        <FolhaSalvarReceita
          titulo="Salvar plano como modelo"
          explicacao="Guarda as sessões, os exercícios e as séries do rascunho como modelo de semana. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('treino', id, nome, descricao);
            setFolha(null);
            avisar('Modelo de semana salva.', 'sucesso');
          }}
        />
      ) : null}
    </Tela>
  );
}

/** Linha de ação da folha "Modelos": título, o que faz e um toque para escolher. */
function OpcaoDeModelo({ titulo, descricao, desabilitado, aoEscolher }: { titulo: string; descricao: string; desabilitado?: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.opcaoModelo,
        { backgroundColor: pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda, opacity: desabilitado ? 0.45 : 1 },
      ]}>
      <Texto variante="bloco">{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  metodologia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  metodologiaTexto: { flexShrink: 1 },
  opcaoModelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
});
