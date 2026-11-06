import { router, useLocalSearchParams } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { baixarFotoDePerfilDoAluno, listarExercicios } from '../../api/rotas';
import type { ConteudoTreino, ExercicioPlano, Receita, ResultadoValidacao, Sessao } from '../../api/tipos';
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
  comModalidade,
  mover,
  normalizarTreino,
  novaSessao,
  novoExercicio,
  sessaoSelecionadaDepois,
  substituir,
  trocaApagaSeries,
} from '../../dominio/editorTreino';
import { textoDoResumo, trazerParaOEditor } from '../../dominio/importarTreinoDeTexto';
import { proximaSelecao, resumoDaSessaoPorContagem, serieDoProblema } from '../../dominio/inspetorDoTreino';
import { validarTreino } from '../../dominio/validacaoDoTreino';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { BarraDoModeloDoEditor, NomeDoModelo } from '../../treinador/plano/TopoModelo';
import { BarraDoPlano, ProblemasDoPlano } from '../../treinador/plano/TopoPlano';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { ComColunas, useDuasColunas } from '../plano/ColunasDoEditor';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { CartaoExercicio } from '../../treinador/treino/CartaoExercicio';
import { EditorDoGrupo, GrupoNaLista } from '../../treinador/treino/CartaoGrupo';
import { novoUid } from '../../dominio/uid';
import { CartaoSessao } from '../../treinador/treino/CartaoSessao';
import { FolhaBiblioteca } from '../../treinador/treino/FolhaBiblioteca';
import { FolhaCriarGrupo } from '../../treinador/treino/FolhaCriarGrupo';
import { FolhaImportarDeTexto } from '../../treinador/treino/FolhaImportarDeTexto';
import { criarGrupoPronto, dicaDoGrupo, motivoSemGrupo, vizinhosQuePodemEntrar } from '../../treinador/treino/acoesDeGrupo';
import { juntarProblemas, problemasDoExercicio, problemasDoGrupo } from '../../treinador/treino/problemasDaSessao';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { nomeDaCombinacao } from '../../dominio/metodologia';
import { descansoSoDoGrupo } from '../../dominio/textoDoGrupo';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { AtualizacaoDoPlano } from '../plano/AtualizacaoDoPlano';
import { VoltarParaAPasta } from '../plano/VoltarParaAPasta';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { ConfiguracaoDoTreino } from './ConfiguracaoDoTreino';
import { ContadoresDoTreino } from './ContadoresDoTreino';
import { FolhasDoTreino, type FolhaDoTreino } from './FolhasDoTreino';
import { InspetorDoExercicio, type PropsDoInspetor } from './InspetorDoExercicio';
import { ItemDaListaDeExercicios, ListaDeExercicios } from './ListaDeExercicios';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { SeletorDeSessoes } from './SeletorDeSessoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { useCarregar } from '../../ui/useCarregar';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { CartaoCicloNoPeriodo } from '../ciclo/CicloNaFicha';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';

/** Exercício alvo da folha; `exercicio` nulo = um novo no fim da sessão, criado só quando se escolhe algo. `cardio` = o item é de cardio. */
type Alvo = { sessao: number; exercicio: number | null; cardio?: boolean };
type FolhaAberta = FolhaDoTreino | { tipo: 'biblioteca'; alvo: Alvo } | { tipo: 'grupo' };

/** Troca de exercício da biblioteca que apagaria as séries (de ou para cardio): espera a confirmação. */
interface TrocaPendente {
  sessaoUid: string;
  exercicioUid: string;
  novo: ExercicioPlano;
  apagadas: number;
}

/** Editor do plano de treino: a tela mais importante do treinador. */
export default function EditorDeTreino({ modelo = false, unica = false, receita }: { modelo?: boolean; unica?: boolean; receita?: Receita }) {
  const { id, colar } = useLocalSearchParams<{ id: string; colar?: string }>();
  const { avisar } = useAviso();
  // "Colar treino (Docs / PDF)": a Folha abre pelo botão ou, vinda do atalho da Importação, já na chegada (`?colar=1`,
  // consumido ao abrir para o voltar não ter passo sobrando).
  const [colando, setColando] = useState(false);
  useEffect(() => {
    if (colar !== '1') return;
    let vivo = true;
    void Promise.resolve().then(() => { if (!vivo) return; setColando(true); router.setParams({ colar: undefined }); });
    return () => { vivo = false; };
  }, [colar]);
  const editor = usePlanoEditor<ConteudoTreino>('treino', id, normalizarTreino, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const config = editor.estado?.conteudo.metodologia?.configuracao ?? CONFIGURACAO_PADRAO;
  // Exercício escolhido na sessão aberta (`selecionadaUid` é o da sessão). Duas colunas: o do inspetor, nunca vazio com
  // exercício na sessão. Uma coluna: o único aberto; nulo = todos fechados. Uid que saiu da sessão vale como o primeiro.
  const [exercicioSelecionadoUid, setExercicioSelecionadoUid] = useState<string | null>(null);
  // Aba de séries aberta por exercício (D8): uid de uma série do grupo. Fica aqui para o "ir ao primeiro" e a receita abrirem a certa.
  const [grupoAbertoPorExercicio, setGrupoAbertoPorExercicio] = useState<Record<string, string | null>>({});
  const abrirGrupo = (exercicioUid: string, serieUid: string | null) => setGrupoAbertoPorExercicio((a) => ({ ...a, [exercicioUid]: serieUid }));
  // Grupo de exercícios escolhido (superset, circuito...): a edição dele vai ao inspetor (duas colunas) ou abre embaixo da
  // linha do grupo (empilhado). Escolher um exercício limpa; uid que saiu da sessão vale como nenhum.
  const [grupoEscolhidoUid, setGrupoEscolhidoUid] = useState<string | null>(null);
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
  // Miniatura da demonstração: vem da biblioteca, pelo vínculo `exercicioId`. Sem permissão ou sem internet, fica sem miniatura.
  const biblioteca = useCarregar('biblioteca-exercicios', () => listarExercicios());
  const demonstracoes = new Map((biblioteca.dados ?? []).map((x) => [x.id, { imagens: x.imagens, imagemPropriaEm: x.imagemPropriaEm, grupoMuscular: x.grupoMuscular }]));

  const conteudoDaTela = editor.estado?.conteudo ?? null;
  const validacaoLocal = useMemo(() => (verificando && conteudoDaTela ? validarTreino(conteudoDaTela) : null), [verificando, conteudoDaTela]);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de treino" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar}
          acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/alunos') }} /> : <Esqueleto />}
      </Tela>
    );
  }

  const c = estado.conteudo;
  const errosDoServidor = servidor && servidor.para === c ? servidor.resultado.erros : [];
  const errosVivos = juntarProblemas(validacaoLocal?.erros ?? [], errosDoServidor);
  const comErro = uidsComProblema(c, errosVivos.map((p) => p.caminho));
  // O "Validar", o "Salvar rascunho", o "Publicar" e o "Salvar modelo" ligam a validação local antes de agir; nenhum é travado por ela.
  const comVerificacao = {
    ...editor,
    salvar: () => { setVerificando(true); return editor.salvar(); },
    validar: () => { setVerificando(true); return editor.validar(); },
    publicar: (...args: Parameters<typeof editor.publicar>) => { setVerificando(true); return editor.publicar(...args); },
  };
  const indiceSelecionado = Math.max(0, c.sessoes.findIndex((x) => x.uid === selecionadaUid));
  const sessaoAtual = c.sessoes[indiceSelecionado] ?? null;
  const uidsDaSessao = sessaoAtual?.exercicios.map((e) => e.uid) ?? [];
  /** O escolhido de verdade: em uma coluna, nulo continua nulo (tudo fechado); uid que saiu da sessão vira o primeiro. */
  const escolhidoEm = (duas: boolean) =>
    duas || exercicioSelecionadoUid !== null ? proximaSelecao(uidsDaSessao, uidsDaSessao, exercicioSelecionadoUid) : null;
  /** Uma coluna: tocar no aberto fecha; tocar em outro abre só ele (e fecha o grupo aberto). */
  const alternar = (uid: string) => { setGrupoEscolhidoUid(null); setExercicioSelecionadoUid(escolhidoEm(false) === uid ? null : uid); };
  const escolherExercicio = (uid: string) => { setGrupoEscolhidoUid(null); setExercicioSelecionadoUid(uid); };
  const grupoEscolhido = sessaoAtual?.grupos.find((g) => g.uid === grupoEscolhidoUid && sessaoAtual.exercicios.some((e) => e.grupoUid === g.uid)) ?? null;
  /** Duas colunas: o grupo vai ao inspetor. Empilhado: tocar no aberto fecha; abrir o grupo fecha o exercício aberto. */
  const escolherGrupo = (uid: string, duas: boolean) => {
    if (duas) { setGrupoEscolhidoUid(uid); return; }
    setExercicioSelecionadoUid(null);
    setGrupoEscolhidoUid(grupoEscolhido?.uid === uid ? null : uid);
  };
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

  /**
   * "Ir ao primeiro" da lista de erros: seleciona a sessão dele, abre o exercício e, se o problema é de uma série, a aba
   * do grupo dela (D9). A rolagem é do `TopoPlano`.
   */
  const irAoPrimeiro = (uids: string[], caminho?: string) => {
    const sessao = c.sessoes.find((x) => uids.includes(x.uid) || x.exercicios.some((e) => uids.includes(e.uid)) || (x.grupos ?? []).some((g) => uids.includes(g.uid)));
    if (sessao) setSelecionadaUid(sessao.uid);
    const exercicio = sessao?.exercicios.find((e) => uids.includes(e.uid));
    if (!exercicio) {
      // Problema só do grupo de exercícios (tipo, voltas, descanso do grupo): abre a edição dele.
      const grupo = sessao?.grupos.find((g) => uids.includes(g.uid));
      if (grupo) { setExercicioSelecionadoUid(null); setGrupoEscolhidoUid(grupo.uid); }
      return;
    }
    escolherExercicio(exercicio.uid);
    const serie = caminho ? serieDoProblema(exercicio, caminho) : null;
    if (serie) abrirGrupo(exercicio.uid, serie);
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
  // O cardio entra pela mesma folha, com os cardios da biblioteca, e nasce `CARDIO` (04/11: não há seletor de modalidade).
  const adicionarExercicio = (si: number, cardio = false) => setFolha({ tipo: 'biblioteca', alvo: { sessao: si, exercicio: null, cardio } });

  const blocos = sessaoAtual ? gruposDaSessao(sessaoAtual, config) : [];

  /** Props do exercício, as mesmas no cartão empilhado (uma coluna) e no inspetor (duas colunas). */
  const propsDoExercicio = (sessao: Sessao, e: ExercicioPlano, ei: number, noGrupo: boolean, descansoPorSerie: boolean): PropsDoInspetor => ({
    exercicio: e,
    posicao: ei,
    total: sessao.exercicios.length,
    comProblema: comErro.has(e.uid),
    config,
    erros: problemasDoExercicio(errosVivos, indiceSelecionado, ei),
    noGrupo,
    descansoPorSerie,
    demonstracao: e.exercicioId ? demonstracoes.get(e.exercicioId) ?? null : null,
    grupoMuscular: e.exercicioId ? demonstracoes.get(e.exercicioId)?.grupoMuscular ?? null : null,
    aoMudar: (novo) => mudarExercicios(indiceSelecionado, (lista) => substituir(lista, ei, novo)),
    aoMover: (d) => mudarGrupos((s) => moverExercicio(s, ei, d)),
    aoRemover: () => {
      // Apagar o escolhido passa ao vizinho (o que fica no mesmo lugar, ou o novo último).
      setExercicioSelecionadoUid((atual) => (atual === e.uid ? proximaSelecao(uidsDaSessao, uidsDaSessao.filter((u) => u !== e.uid), atual) : atual));
      comDesfazer(`Exercício “${e.nome || ei + 1}” removido.`, (a) => ({
        ...a,
        sessoes: substituir(a.sessoes, indiceSelecionado, { ...a.sessoes[indiceSelecionado], ...removerExercicio(a.sessoes[indiceSelecionado], ei) }),
      }));
    },
    aoTirarDoGrupo: () => mudarGrupos((s) => tirarDoGrupo(s, ei)),
    aoEscolherDaBiblioteca: () => setFolha({ tipo: 'biblioteca', alvo: { sessao: indiceSelecionado, exercicio: ei, cardio: e.modalidade === 'CARDIO' } }),
    aoUsarReceita: () => setFolha({ tipo: 'receitaSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } }),
    aoSalvarReceita: () => setFolha({ tipo: 'salvarSeries', alvo: { sessao: indiceSelecionado, exercicio: ei } }),
    grupoAbertoUid: grupoAbertoPorExercicio[e.uid] ?? null,
    aoAbrirGrupo: (uid) => abrirGrupo(e.uid, uid),
  });

  // Fica visível com o plano vazio e no dia de treino (sem cabeçalho de sessões): é por onde o treino colado entra.
  const botaoDeColar = <Botao rotulo="Colar treino (Docs / PDF)" tipo="secundario" Icone={FileText} aoTocar={() => setColando(true)} />;

  const titulo = modelo ? tituloDoModelo(unica ? 'SESSAO_TREINO' : 'PLANO_TREINO') : tituloDoPlanoDoAluno('treino', nomeDoAluno);

  return (
    <TelaDoEditor
      colunas
      cabecalho={<Cabecalho titulo={titulo} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={modelo ? undefined : estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />}
      barra={modelo ? <BarraDoModeloDoEditor editor={comVerificacao} receita={receita} /> : <BarraDoPlano tipo="treino" editor={comVerificacao} aoProblemas={aoProblemas} inicio={<FotoNaBarra alunoId={estado.plano.alunoId} nome={nomeDoAluno} />} />}>
      {/* Plano de uma pasta: volta à Folha dela e lê a atualização sem perder o rascunho (reunião de 30/10). */}
      {!modelo && estado.plano.pastaId ? (
        <LinhaDeAcoes>
          <VoltarParaAPasta alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
          <AtualizacaoDoPlano alunoId={estado.plano.alunoId} pastaId={estado.plano.pastaId} />
        </LinhaDeAcoes>
      ) : null}
      <ProblemasDoPlano editor={editor} problemas={problemas ?? validacaoLocal} aoProblemas={fecharVerificacao} aoIrAoPrimeiro={irAoPrimeiro} />
      {/* Contexto (de quem é o plano, o ciclo da aluna) junto; depois o plano; depois as sessões. */}
      <View style={estilos.grupo}>
        {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="treino" />}
        {modelo ? null : <CartaoCicloNoPeriodo alunoId={estado.plano.alunoId} inicio={estado.plano.inicio} fim={estado.plano.fim} />}
      </View>
      {modelo ? <NomeDoModelo editor={editor} /> : null}
      {unica ? null : <ConfiguracaoDoTreino editor={editor} modelo={modelo} aoTrocarMetodologia={() => setFolha({ tipo: 'metodologia' })} />}
      {unica ? null : (
        <View style={estilos.grupo}>
          <ContadoresDoTreino conteudo={c} sessao={sessaoAtual} acao={botaoDeColar} aoIrAoPrimeiro={(uids, caminho) => { setVerificando(true); irAoPrimeiro(uids, caminho); }} />
          <SeletorDeSessoes
            sessoes={c.sessoes}
            selecionada={sessaoAtual?.uid ?? null}
            comProblema={sessoesComProblema}
            aoSelecionar={setSelecionadaUid}
            aoAdicionar={adicionarSessao}
          />
        </View>
      )}
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
      {unica ? <LinhaDeAcoes>{botaoDeColar}</LinhaDeAcoes> : null}
      {c.sessoes.length === 0 ? (
        <Vazio texto="O plano ainda não tem sessões. Adicione uma ou comece de uma semana de treino pronta."
          acao={unica ? undefined : { rotulo: 'Modelos prontos', aoTocar: () => setFolha({ tipo: 'modelos' }) }} />
      ) : null}
      {sessaoAtual ? <ComColunas>{(duas) => {
        // Com um grupo de exercícios escolhido, nenhum exercício fica realçado e o inspetor mostra o grupo.
        const escolhido = grupoEscolhido ? null : escolhidoEm(duas);
        let noInspetor: PropsDoInspetor | null = null;
        let grupoNoInspetor: ReactNode = null;
        const itens = blocos.map((g, bi) => {
          const descansoPorSerie = !(g.grupo && descansoSoDoGrupo(g.grupo));
          // Uma coluna: o cartão de hoje, com o corpo aberto só no escolhido. Duas: o item da lista, e o escolhido vai ao inspetor.
          const cartoes = g.exercicios.map((e, i) => {
            const ei = g.inicio + i;
            if (!duas) return <CartaoExercicio key={e.uid} {...propsDoExercicio(sessaoAtual, e, ei, g.grupo !== null, descansoPorSerie)} aberto={e.uid === escolhido} aoAbrir={() => alternar(e.uid)} />;
            if (e.uid === escolhido) noInspetor = propsDoExercicio(sessaoAtual, e, ei, g.grupo !== null, descansoPorSerie);
            return <ItemDaListaDeExercicios key={e.uid} exercicio={e} posicao={ei} total={sessaoAtual.exercicios.length} config={config}
              escolhido={e.uid === escolhido} comProblema={comErro.has(e.uid)} aoEscolher={() => escolherExercicio(e.uid)} />;
          });
          const grupo = g.grupo;
          if (!grupo) return <Fragment key={g.exercicios[0].uid}>{cartoes}</Fragment>;
          const indiceDoGrupo = sessaoAtual.grupos.findIndex((x) => x.uid === grupo.uid);
          const erros = problemasDoGrupo(errosVivos, indiceSelecionado, indiceDoGrupo);
          const aberto = grupoEscolhido?.uid === grupo.uid;
          const edicao = aberto ? (
            <EditorDoGrupo
              grupo={grupo}
              config={config}
              tamanho={g.exercicios.length}
              primeiro={bi === 0}
              ultimo={bi === blocos.length - 1}
              erros={erros}
              vizinhos={vizinhosQuePodemEntrar(sessaoAtual, grupo.uid)}
              dica={dicaDoGrupo(sessaoAtual, grupo.uid, grupo.tecnica)}
              aoMudar={(m: MudancaDoGrupo) => mudarGrupos((s) => alterarGrupoDaSessao(s, grupo.uid, m))}
              aoMover={(d) => mudarGrupos((s) => moverGrupoDeExercicios(s, grupo.uid, d))}
              aoIncluir={(indice) => mudarGrupos((s) => juntarAoGrupo(s, indice, grupo.uid))}
              aoDesfazer={() => {
                // Os exercícios ficam soltos: a escolha passa ao primeiro deles.
                escolherExercicio(g.exercicios[0].uid);
                comDesfazer(`${nomeDaCombinacao(config, grupo.tecnica)} desfeito.`, (a) => ({
                  ...a,
                  sessoes: substituir(a.sessoes, indiceSelecionado, { ...a.sessoes[indiceSelecionado], ...desfazerGrupo(a.sessoes[indiceSelecionado], grupo.uid) }),
                }));
              }}
            />
          ) : null;
          if (duas && aberto) grupoNoInspetor = edicao;
          return (
            <GrupoNaLista key={`grupo-${g.exercicios[0].uid}`} grupo={grupo} config={config} tamanho={g.exercicios.length}
              comErro={Object.keys(erros).length > 0} escolhido={aberto} duas={duas} aoEscolher={() => escolherGrupo(grupo.uid, duas)}
              edicao={duas ? null : edicao}>
              {cartoes}
            </GrupoNaLista>
          );
        });
        const adicionar = {
          aoNovoExercicio: () => adicionarExercicio(indiceSelecionado),
          aoNovoCardio: () => adicionarExercicio(indiceSelecionado, true),
          aoAbrirModelos: unica ? undefined : () => setFolha({ tipo: 'modelos' }),
          aoCriarGrupo: () => setFolha({ tipo: 'grupo' }),
          motivoSemGrupo: motivoSemGrupo(sessaoAtual, config),
        };
        return (
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
            {...adicionar}
            adicionarNoFim={!duas}>
            {duas ? (
              // Lista (mestre) com largura fixa à esquerda; o inspetor (detalhe) do escolhido no resto.
              <View style={estilos.colunas}>
                <ListaDeExercicios
                  vazia={sessaoAtual.exercicios.length === 0}
                  resumo={resumoDaSessaoPorContagem(sessaoAtual, config, (e) => (e.exercicioId ? demonstracoes.get(e.exercicioId)?.grupoMuscular ?? null : null))}
                  adicionar={adicionar}>
                  {itens}
                </ListaDeExercicios>
                <InspetorDoExercicio props={noInspetor} grupo={grupoNoInspetor} />
              </View>
            ) : itens}
          </CartaoSessao>
        );
      }}</ComColunas> : null}

      <FolhasDoTreino folha={folha} abrir={setFolha} fechar={() => setFolha(null)} conteudo={c} config={config} modelo={modelo} unica={unica}
        planoId={id} salvar={editor.salvar} comDesfazer={comDesfazer} abrirGrupo={abrirGrupo} />
      {colando ? (
        <FolhaImportarDeTexto
          conteudo={c}
          config={config}
          biblioteca={biblioteca.dados ?? []}
          bibliotecaCarregando={biblioteca.carregando && !biblioteca.dados}
          bibliotecaIndisponivel={!!biblioteca.erro && !biblioteca.dados}
          unica={unica}
          aoFechar={() => setColando(false)}
          aoTrazer={(lidas) => {
            if (lidas.length === 0) return;
            setColando(false);
            // Dia de treino tem uma sessão só: a lida troca a do plano. No resto, substitui o plano vazio ou acrescenta ao fim.
            const total = { divisoes: lidas.length, exercicios: lidas.reduce((s, x) => s + x.exercicios.length, 0), series: lidas.reduce((s, x) => s + x.exercicios.reduce((n, e) => n + e.series.length, 0), 0) };
            comDesfazer('Treino colado trazido para o editor.', (a) => (unica ? { ...a, sessoes: lidas.slice(0, 1) } : trazerParaOEditor(a, lidas)));
            setGrupoEscolhidoUid(null);
            setExercicioSelecionadoUid(null);
            setSelecionadaUid(lidas[0].uid);
            avisar(`Treino trazido: ${textoDoResumo({ ...total, semBiblioteca: 0, semSeries: 0 })}. Confira e salve o rascunho.`, 'sucesso');
          }}
        />
      ) : null}
      <FolhaBiblioteca
        visivel={folha?.tipo === 'biblioteca'}
        multiplo={folha?.tipo === 'biblioteca' && folha.alvo.exercicio === null}
        cardio={folha?.tipo === 'biblioteca' && !!folha.alvo.cardio}
        aoFechar={() => setFolha(null)}
        aoEscolher={(escolhidos) => {
          if (folha?.tipo !== 'biblioteca' || escolhidos.length === 0) return;
          const { sessao: si, exercicio: ei, cardio } = folha.alvo;
          setFolha(null);
          // Na folha do cardio tudo vira `CARDIO`, também o nome digitado; na outra vale a modalidade da biblioteca.
          const daBiblioteca = (escolhido: (typeof escolhidos)[number]) =>
            'id' in escolhido
              ? { campos: { exercicioId: escolhido.id, nome: escolhido.nome, videoUrl: escolhido.videoUrl }, modalidade: cardio ? 'CARDIO' : escolhido.modalidade as string | null }
              : { campos: { exercicioId: null, nome: escolhido.nome }, modalidade: cardio ? 'CARDIO' : null };
          if (ei === null) {
            // Exercícios novos no fim da sessão, na ordem marcada; o primeiro fica escolhido (aberto) para continuar dali.
            const novos = escolhidos.map((e) => {
              const d = daBiblioteca(e);
              return comModalidade({ ...novoExercicio(), ...d.campos }, d.modalidade);
            });
            // Com um grupo escolhido, o inspetor ficaria no grupo: escolher o exercício tira o grupo da seleção.
            escolherExercicio(novos[0].uid);
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
            // O grupo novo fica escolhido (como o exercício novo): a edição dele abre na hora.
            const uid = novoUid();
            mudarGrupos((s) => criarGrupoPronto(s, indices, tecnica, voltas, uid));
            setExercicioSelecionadoUid(null);
            setGrupoEscolhidoUid(uid);
          }}
        />
      ) : null}
    </TelaDoEditor>
  );
}

/**
 * Foto pequena do aluno no início da barra do editor, só em duas colunas (no celular a barra já é apertada). Sem foto,
 * sem internet ou sem permissão, as iniciais. Modelo não tem aluno: o editor não a passa.
 */
function FotoNaBarra({ alunoId, nome }: { alunoId: string; nome: string | null }) {
  const duas = useDuasColunas();
  if (!duas) return null;
  return <FotoDePerfil chave={`perfil:${alunoId}`} carregar={() => baixarFotoDePerfilDoAluno(alunoId)} nome={nome} tamanho={32} />;
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  // Partes que andam juntas ficam mais perto entre si que dos outros blocos da tela (24).
  grupo: { gap: espaco(1.5) },
});
