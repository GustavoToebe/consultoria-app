import { useLocalSearchParams } from 'expo-router';
import { NotebookTabs } from 'lucide-react-native';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { criarReceita, listarExercicios, salvarPlanoComoReceita } from '../../api/rotas';
import type { Configuracao, ConteudoTreino, ExercicioPlano, Receita, ResultadoValidacao, Sessao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import {
  alterarGrupoDaSessao,
  desfazerGrupo,
  gruposDaSessao,
  juntarAoGrupo,
  moverExercicio,
  moverGrupoDeExercicios,
  removerExercicio,
  tirarDoGrupo,
  type ExerciciosEGrupos,
  type MudancaDoGrupo,
} from '../../dominio/combinacoes';
import {
  aplicarReceitaDePlano,
  comModalidade,
  comUidsNovos,
  mover,
  normalizarTreino,
  novaSessao,
  novoExercicio,
  sessaoSelecionadaDepois,
  seriesDaReceita,
  seriesParaReceita,
  substituir,
  trocaApagaSeries,
} from '../../dominio/editorTreino';
import { validarTreino } from '../../dominio/validacaoDoTreino';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { BarraDoModeloDoEditor, NomeDoModelo } from '../../treinador/plano/TopoModelo';
import { BarraDoPlano, ProblemasDoPlano } from '../../treinador/plano/TopoPlano';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { useAviso } from '../../ui/Aviso';
import { CartaoExercicio } from '../../treinador/treino/CartaoExercicio';
import { CartaoGrupo } from '../../treinador/treino/CartaoGrupo';
import { CartaoSessao } from '../../treinador/treino/CartaoSessao';
import { FolhaBiblioteca } from '../../treinador/treino/FolhaBiblioteca';
import { FolhaCriarGrupo } from '../../treinador/treino/FolhaCriarGrupo';
import { criarGrupoPronto, dicaDoGrupo, motivoSemGrupo, vizinhosQuePodemEntrar } from '../../treinador/treino/acoesDeGrupo';
import { juntarProblemas, problemasDoExercicio, problemasDoGrupo } from '../../treinador/treino/problemasDaSessao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
import { nomeDaCombinacao } from '../../dominio/metodologia';
import { descansoSoDoGrupo } from '../../dominio/textoDoGrupo';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { SeletorDeSessoes } from './SeletorDeSessoes';
import { Folha } from '../../ui/Folha';
import { Botao } from '../../ui/Botao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Esqueleto } from '../../ui/Esqueleto';
import { useCarregar } from '../../ui/useCarregar';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { Tela } from '../../ui/Tela';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { CartaoCicloNoPeriodo } from '../ciclo/CicloNaFicha';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';

/** Exercício alvo da folha; `exercicio` nulo = um novo no fim da sessão, criado só quando se escolhe algo. */
type Alvo = { sessao: number; exercicio: number | null };
type AlvoExistente = { sessao: number; exercicio: number };
type FolhaAberta =
  | { tipo: 'biblioteca'; alvo: Alvo }
  | { tipo: 'receitaSeries'; alvo: AlvoExistente }
  | { tipo: 'salvarSeries'; alvo: AlvoExistente }
  | { tipo: 'receitaPlano' }
  | { tipo: 'salvarPlano' } | { tipo: 'metodologia' } | { tipo: 'sessao' } | { tipo: 'salvarSessao'; indice: number } | { tipo: 'grupo' };

/** Troca de exercício da biblioteca que apagaria as séries (de ou para cardio): espera a confirmação. */
interface TrocaPendente {
  sessaoUid: string;
  exercicioUid: string;
  novo: ExercicioPlano;
  apagadas: number;
}

/** Editor do plano de treino: a tela mais importante do treinador. */
export default function EditorDeTreino({ modelo = false, unica = false, receita }: { modelo?: boolean; unica?: boolean; receita?: Receita }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoTreino>('treino', id, normalizarTreino, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const config = editor.estado?.conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  // Resultado do servidor (Validar, Publicar) com o conteúdo a que se refere: ao editar, as marcas dele saem e ficam só as da validação local.
  const [servidor, setServidor] = useState<{ resultado: ResultadoValidacao; para: ConteudoTreino } | null>(null);
  const problemas = servidor?.resultado ?? null;
  // Depois da primeira tentativa de salvar, validar ou publicar, `validarTreino` roda a cada edição: erros por campo e avisos, sem bloquear.
  const [verificando, setVerificando] = useState(false);
  const [trocaPendente, setTrocaPendente] = useState<TrocaPendente | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoTreino> | null>(null);
  // Uma sessão aparece por vez. Se o uid sumiu (desfazer, recarregar), vale a primeira.
  const [selecionadaUid, setSelecionadaUid] = useState<string | null>(null);
  const [modelos, setModelos] = useState(false);
  // Miniatura da demonstração: vem da biblioteca, pelo vínculo `exercicioId`. Sem permissão ou sem internet, fica sem miniatura.
  const biblioteca = useCarregar('biblioteca-exercicios', () => listarExercicios());
  const demonstracoes = new Map((biblioteca.dados ?? []).map((x) => [x.id, { imagens: x.imagens, imagemPropriaEm: x.imagemPropriaEm }]));

  const conteudoDaTela = editor.estado?.conteudo ?? null;
  const validacaoLocal = useMemo(() => (verificando && conteudoDaTela ? validarTreino(conteudoDaTela) : null), [verificando, conteudoDaTela]);

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
  const errosDoServidor = servidor && servidor.para === c ? servidor.resultado.erros : [];
  const errosVivos = juntarProblemas(validacaoLocal?.erros ?? [], errosDoServidor);
  const avisosVivos = validacaoLocal?.avisos ?? [];
  const comErro = uidsComProblema(c, errosVivos.map((p) => p.caminho));
  // O "Validar", o "Salvar rascunho", o "Publicar" e o "Salvar modelo" ligam a validação local antes de agir; nenhum é travado por ela.
  const comVerificacao = {
    ...editor,
    salvar: () => { setVerificando(true); return editor.salvar(); },
    validar: () => { setVerificando(true); return editor.validar(); },
    publicar: (...args: Parameters<typeof editor.publicar>) => { setVerificando(true); return editor.publicar(...args); },
  };
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
    setServidor(r ? { resultado: r, para: c } : null);
    if (r?.erros.length) {
      const uids = uidsComProblema(c, r.erros.map((p) => p.caminho));
      setSelecionadaUid(sessaoSelecionadaDepois(c.sessoes, sessaoAtual?.uid ?? null, { tipo: 'erros', uidsComErro: uids }));
    }
  };

  /** "Fechar" a lista de resultados desliga a validação ao vivo; qualquer outro resultado segue o fluxo do servidor. */
  const fecharVerificacao = (r: ResultadoValidacao | null) => {
    if (r === null) { setServidor(null); setVerificando(false); } else aoProblemas(r);
  };

  /** "Ir ao primeiro" da lista de erros: seleciona a sessão dele e abre o exercício; a rolagem é do `TopoPlano`. */
  const irAoPrimeiro = (uids: string[]) => {
    const sessao = c.sessoes.find((x) => uids.includes(x.uid) || x.exercicios.some((e) => uids.includes(e.uid)) || (x.grupos ?? []).some((g) => uids.includes(g.uid)));
    if (sessao) setSelecionadaUid(sessao.uid);
    for (const u of uids) if (c.sessoes.some((x) => x.exercicios.some((e) => e.uid === u))) abrir(u);
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

  /** Operação sobre os exercícios e os grupos da sessão aberta (mover, tirar do grupo, criar, alterar...). */
  const mudarGrupos = (fn: (s: Sessao) => ExerciciosEGrupos) =>
    mudarSessoes((sessoes) => substituir(sessoes, indiceSelecionado, { ...sessoes[indiceSelecionado], ...fn(sessoes[indiceSelecionado]) }));

  /** Troca um exercício pelo uid (a confirmação da troca de modalidade chega depois de o conteúdo poder ter mudado). */
  const trocarExercicioPorUid = (a: ConteudoTreino, sessaoUid: string, exercicioUid: string, novo: ExercicioPlano): ConteudoTreino => ({
    ...a,
    sessoes: a.sessoes.map((s) => (s.uid === sessaoUid ? { ...s, exercicios: s.exercicios.map((x) => (x.uid === exercicioUid ? novo : x)) } : s)),
  });

  const adicionarSessao = () => {
    const usados = new Set(c.sessoes.map((s) => s.diaSemana));
    const dia = [1, 2, 3, 4, 5, 6, 7].find((d) => !usados.has(d)) ?? null;
    const nova = novaSessao(dia);
    mudarSessoes((s) => [...s, nova]);
    setSelecionadaUid(nova.uid);
  };

  // O exercício novo só nasce quando se escolhe algo na folha: fechar a folha não deixa um "5." vazio nem rascunho pendente.
  const adicionarExercicio = (si: number) => setFolha({ tipo: 'biblioteca', alvo: { sessao: si, exercicio: null } });

  const blocos = sessaoAtual ? gruposDaSessao(sessaoAtual, config) : [];

  const cartaoDoExercicio = (sessao: Sessao, e: ExercicioPlano, ei: number, noGrupo: boolean, descansoPorSerie = true) => (
    <CartaoExercicio
      key={e.uid}
      exercicio={e}
      posicao={ei}
      total={sessao.exercicios.length}
      aberto={abertos.has(e.uid)}
      comProblema={comErro.has(e.uid)}
      config={config}
      erros={problemasDoExercicio(errosVivos, indiceSelecionado, ei)}
      avisos={problemasDoExercicio(avisosVivos, indiceSelecionado, ei)}
      noGrupo={noGrupo}
      descansoPorSerie={descansoPorSerie}
      demonstracao={e.exercicioId ? demonstracoes.get(e.exercicioId) ?? null : null}
      aoAbrir={() => alternar(e.uid)}
      aoMudar={(novo) => mudarExercicios(indiceSelecionado, (lista) => substituir(lista, ei, novo))}
      aoMudarApagandoSeries={(novo) => comDesfazer(`Modalidade de “${e.nome || ei + 1}” trocada; séries apagadas.`, (a) => trocarExercicioPorUid(a, sessao.uid, e.uid, novo))}
      aoMover={(d) => mudarGrupos((s) => moverExercicio(s, ei, d))}
      aoRemover={() =>
        comDesfazer(`Exercício “${e.nome || ei + 1}” removido.`, (a) => ({
          ...a,
          sessoes: substituir(a.sessoes, indiceSelecionado, { ...a.sessoes[indiceSelecionado], ...removerExercicio(a.sessoes[indiceSelecionado], ei) }),
        }))
      }
      aoTirarDoGrupo={() => mudarGrupos((s) => tirarDoGrupo(s, ei))}
      aoEscolherDaBiblioteca={() => setFolha({ tipo: 'biblioteca', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
      aoUsarReceita={() => setFolha({ tipo: 'receitaSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
      aoSalvarReceita={() => setFolha({ tipo: 'salvarSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } })}
    />
  );

  const titulo = modelo ? tituloDoModelo(unica ? 'SESSAO_TREINO' : 'PLANO_TREINO') : tituloDoPlanoDoAluno('treino', nomeDoAluno);

  return (
    <TelaDoEditor
      cabecalho={<Cabecalho titulo={titulo} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={modelo ? undefined : estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />}
      barra={modelo ? <BarraDoModeloDoEditor editor={comVerificacao} receita={receita} /> : <BarraDoPlano tipo="treino" editor={comVerificacao} aoProblemas={aoProblemas} />}>
      {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="treino" />}
      {modelo ? null : <CartaoCicloNoPeriodo alunoId={estado.plano.alunoId} inicio={estado.plano.inicio} fim={estado.plano.fim} />}
      {modelo ? <NomeDoModelo editor={editor} /> : null}
      <ProblemasDoPlano editor={editor} problemas={problemas ?? validacaoLocal} aoProblemas={fecharVerificacao} aoIrAoPrimeiro={irAoPrimeiro} />
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
      {unica ? null :       <ConfiguracaoDoPlano
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
      </ConfiguracaoDoPlano>}
      {unica ? null : (
        <View style={estilos.cabecalhoSessoes}>
          <Texto variante="bloco" nivel={2}>Sessões ({c.sessoes.length})</Texto>
          <Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} />
        </View>
      )}
      {unica ? null : (
        <SeletorDeSessoes
          sessoes={c.sessoes}
          selecionada={sessaoAtual?.uid ?? null}
          comProblema={sessoesComProblema}
          aoSelecionar={setSelecionadaUid}
          aoAdicionar={adicionarSessao}
        />
      )}
      {c.sessoes.length === 0 ? (
        <Vazio texto="O plano ainda não tem sessões. Adicione uma ou comece de uma semana de treino pronta (botão Modelos)." />
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
          aoCriarGrupo={() => setFolha({ tipo: 'grupo' })}
          motivoSemGrupo={motivoSemGrupo(sessaoAtual, config)}
          todosAbertos={sessaoAtual.exercicios.length > 0 && sessaoAtual.exercicios.every((e) => abertos.has(e.uid))}
          aoAlternarTodos={() => {
            const uids = sessaoAtual.exercicios.map((e) => e.uid);
            const todos = uids.every((u) => abertos.has(u));
            setAbertos((a) => { const novo = new Set(a); uids.forEach((u) => (todos ? novo.delete(u) : novo.add(u))); return novo; });
          }}>
          {blocos.map((g, bi) => {
            const descansoPorSerie = !(g.grupo && descansoSoDoGrupo(g.grupo));
            const cartoes = g.exercicios.map((e, i) => cartaoDoExercicio(sessaoAtual, e, g.inicio + i, g.grupo !== null, descansoPorSerie));
            const grupo = g.grupo;
            if (!grupo) return <Fragment key={g.exercicios[0].uid}>{cartoes}</Fragment>;
            return (
              <CartaoGrupo
                key={`grupo-${g.exercicios[0].uid}`}
                grupo={grupo}
                config={config}
                tamanho={g.exercicios.length}
                primeiro={bi === 0}
                ultimo={bi === blocos.length - 1}
                erros={problemasDoGrupo(errosVivos, indiceSelecionado, sessaoAtual.grupos.findIndex((x) => x.uid === grupo.uid))}
                vizinhos={vizinhosQuePodemEntrar(sessaoAtual, grupo.uid)}
                dica={dicaDoGrupo(sessaoAtual, grupo.uid, grupo.tecnica)}
                aoMudar={(m: MudancaDoGrupo) => mudarGrupos((s) => alterarGrupoDaSessao(s, grupo.uid, m))}
                aoMover={(d) => mudarGrupos((s) => moverGrupoDeExercicios(s, grupo.uid, d))}
                aoIncluir={(indice) => mudarGrupos((s) => juntarAoGrupo(s, indice, grupo.uid))}
                aoDesfazer={() =>
                  comDesfazer(`${nomeDaCombinacao(config, grupo.tecnica)} desfeito.`, (a) => ({
                    ...a,
                    sessoes: substituir(a.sessoes, indiceSelecionado, { ...a.sessoes[indiceSelecionado], ...desfazerGrupo(a.sessoes[indiceSelecionado], grupo.uid) }),
                  }))
                }>
                {cartoes}
              </CartaoGrupo>
            );
          })}
        </CartaoSessao>
      ) : null}

      {modelos ? (
        <Folha visivel titulo="Modelos" aoFechar={() => setModelos(false)}>
          <OpcaoDeModelo
            titulo="Usar semana de treino"
            descricao="Troca as sessões do plano pelas da semana escolhida (objetivo e orientações ficam). Dá para desfazer."
            desabilitado={unica}
            aoEscolher={() => { setModelos(false); setFolha({ tipo: 'receitaPlano' }); }}
          />
          <OpcaoDeModelo
            titulo="Adicionar dia de treino"
            descricao="Acrescenta ao plano as sessões de um dia de treino pronto."
            desabilitado={unica}
            aoEscolher={() => { setModelos(false); setFolha({ tipo: 'sessao' }); }}
          />
          {!modelo && c.sessoes.length ? (
            <OpcaoDeModelo
              titulo={rotuloSalvarComo('PLANO_TREINO')}
              descricao="Guarda as sessões, os exercícios e as séries deste rascunho para reutilizar. O plano continua igual."
              aoEscolher={() => { setModelos(false); setFolha({ tipo: 'salvarPlano' }); }}
            />
          ) : null}
        </Folha>
      ) : null}

      {folha?.tipo === 'metodologia' ? <FolhaReceitas tipo="METODOLOGIA" titulo="Vincular metodologia" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Metodologia vinculada.', (a) => ({ ...a, metodologia: { id: r.id, nome: r.nome, configuracao: JSON.parse(JSON.stringify(r.conteudo)) as Configuracao } }));
      }} /> : null}
      {folha?.tipo === 'sessao' ? <FolhaReceitas tipo="SESSAO_TREINO" titulo="Adicionar dia de treino" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Dia de treino adicionado.', (a) => ({ ...a, sessoes: [...a.sessoes, ...comUidsNovos(normalizarTreino(r.conteudo)).sessoes] }));
      }} /> : null}
      {folha?.tipo === 'salvarSessao' ? <FolhaSalvarReceita titulo={rotuloSalvarComo('SESSAO_TREINO')} aoFechar={() => setFolha(null)} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'SESSAO_TREINO', nome, descricao, conteudo: { ...c, sessoes: [c.sessoes[folha.indice]] } });
        setFolha(null); avisar(avisoModeloSalvo('SESSAO_TREINO'), 'sucesso');
      }} /> : null}
      <FolhaBiblioteca
        visivel={folha?.tipo === 'biblioteca'}
        multiplo={folha?.tipo === 'biblioteca' && folha.alvo.exercicio === null}
        aoFechar={() => setFolha(null)}
        aoEscolher={(escolhidos) => {
          if (folha?.tipo !== 'biblioteca' || escolhidos.length === 0) return;
          const { sessao: si, exercicio: ei } = folha.alvo;
          setFolha(null);
          const daBiblioteca = (escolhido: (typeof escolhidos)[number]) =>
            'id' in escolhido
              ? { campos: { exercicioId: escolhido.id, nome: escolhido.nome, videoUrl: escolhido.videoUrl }, modalidade: escolhido.modalidade as string | null }
              : { campos: { exercicioId: null, nome: escolhido.nome }, modalidade: null as string | null };
          if (ei === null) {
            // Exercícios novos no fim da sessão, na ordem marcada; abre o primeiro para continuar de onde a lista começa.
            const novos = escolhidos.map((e) => {
              const d = daBiblioteca(e);
              return comModalidade({ ...novoExercicio(), ...d.campos }, d.modalidade);
            });
            abrir(novos[0].uid);
            mudarExercicios(si, (lista) => [...lista, ...novos]);
            return;
          }
          const sessao = c.sessoes[si];
          const atual = sessao?.exercicios[ei];
          if (!sessao || !atual) return;
          const d = daBiblioteca(escolhidos[0]);
          const base = { ...atual, ...d.campos };
          const novo = d.modalidade === atual.modalidade ? base : comModalidade(base, d.modalidade);
          // De ou para cardio as séries não servem mais: pergunta antes de apagar.
          if (trocaApagaSeries(atual, d.modalidade)) {
            setTrocaPendente({ sessaoUid: sessao.uid, exercicioUid: atual.uid, novo, apagadas: atual.series.length });
            return;
          }
          mudarExercicios(si, (lista) => substituir(lista, ei, novo));
        }}
      />
      {trocaPendente ? (
        <PainelConfirmacao
          visivel
          titulo="Trocar o exercício apaga as séries?"
          mensagem={`O novo exercício ${trocaPendente.novo.modalidade === 'CARDIO' ? 'é de cardio' : 'não é de cardio'}, e a prescrição de cardio é outra. ${trocaPendente.apagadas === 1 ? 'A série atual será apagada' : `As ${trocaPendente.apagadas} séries atuais serão apagadas`}. Dá para desfazer logo depois.`}
          rotuloConfirmar="Apagar séries e trocar"
          perigo
          aoCancelar={() => setTrocaPendente(null)}
          aoConfirmar={() => {
            const t = trocaPendente;
            setTrocaPendente(null);
            comDesfazer(`Exercício trocado por “${t.novo.nome || 'sem nome'}”; séries apagadas.`, (a) => trocarExercicioPorUid(a, t.sessaoUid, t.exercicioUid, t.novo));
          }}
        />
      ) : null}
      {folha?.tipo === 'grupo' && sessaoAtual ? (
        <FolhaCriarGrupo
          sessao={sessaoAtual}
          config={config}
          aoFechar={() => setFolha(null)}
          aoCriar={(indices, tecnica, voltas) => {
            setFolha(null);
            mudarGrupos((s) => criarGrupoPronto(s, indices, tecnica, voltas));
          }}
        />
      ) : null}
      {folha?.tipo === 'receitaSeries' ? (
        <FolhaReceitas
          tipo="SERIES"
          titulo="Usar receita de séries"
          explicacao="As séries do exercício são trocadas pelas da receita. Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            const { sessao: si, exercicio: ei } = folha.alvo;
            setFolha(null);
            comDesfazer(`Receita “${r.nome}” aplicada.`, (a) => {
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
          titulo="Usar semana de treino"
          explicacao="As sessões do plano são trocadas pelas da semana escolhida (o objetivo e as orientações ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            comDesfazer(`Semana “${r.nome}” aplicada.`, (a) => aplicarReceitaDePlano(a, r.conteudo));
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarSeries' ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('SERIES')}
          explicacao="Guarda a estrutura das séries deste exercício (tipos, repetições, carga, esforço e técnica) para usar em outros exercícios e planos."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            const exercicio = c.sessoes[folha.alvo.sessao]?.exercicios[folha.alvo.exercicio];
            if (!exercicio) return;
            await criarReceita({ tipo: 'SERIES', nome, descricao, conteudo: seriesParaReceita(exercicio.series) });
            setFolha(null);
            avisar(avisoModeloSalvo('SERIES'), 'sucesso');
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarPlano' && id ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('PLANO_TREINO')}
          explicacao="Guarda as sessões, os exercícios e as séries do rascunho como semana de treino no Planejamento. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('treino', id, nome, descricao);
            setFolha(null);
            avisar(avisoModeloSalvo('PLANO_TREINO'), 'sucesso');
          }}
        />
      ) : null}
    </TelaDoEditor>
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
  cabecalhoSessoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  metodologia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  metodologiaTexto: { flexShrink: 1 },
  opcaoModelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
});
