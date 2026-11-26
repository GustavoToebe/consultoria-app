import { useEffect, useRef, useState, type Ref, type RefObject } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileSearch, FileUp, RotateCcw } from 'lucide-react-native';
import type { Href } from 'expo-router';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, View } from 'react-native';

import { dataHoraParaTela, plural } from '../../dominio/formatos';
import {
  campoDoErroDoTexto,
  contagensDasEtapas,
  duvidasVisiveis,
  DICA_DE_TREINO_DESMONTADO,
  duvidasComSugestaoUnica,
  etapaDaImportacao,
  focoAoEntrar,
  type FocoAoEntrar,
  gerarChaveIdempotencia,
  grupoResumido,
  idsComErro,
  idsSelecionaveisProntos,
  lidoSemIa,
  linhasDoGrupo,
  motivoDoErroDoArquivo,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  opcoesDoDestino,
  pedidoDoDestino,
  precisaEscolherAluno,
  recarregarDepoisDoErro,
  resumoDaCoberturaDoArquivo,
  resumoDoModoProcessamento,
  resumoDoResultado,
  seloDoGrupo,
  sessaoPodeCancelar,
  sessaoRetomavel,
  textoDaLeitura,
  textoDoErroDaImportacao,
  textoDoEstadoDaSessao,
  tituloDoGrupoResumido,
  valorDoDestino,
  type ValorDoDestino,
} from '../../dominio/importacaoAssistida';
import {
  aceitarSugestoes,
  adicionarArquivo,
  adicionarTexto,
  atualizarGrupo,
  cancelarSessao,
  confirmarSessao,
  criarSessao,
  listarSessoes,
  obterSessao,
  processarSessao,
  responderDuvida,
  revogarDecisao,
  type ConfirmacaoResultado,
  type DecisaoImportacao,
  type DuvidaImportacao,
  type GrupoImportavel,
  type ObjetivoImportacao,
  type SessaoDetalhe,
  type SessaoListaItem,
} from '../../servicos/importacaoAssistida';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { AreaDeSoltarArquivos } from './AreaDeSoltarArquivos';
import { EscolhaDoQueImportar } from './EscolhaDoQueImportar';
import { ColunaDasEtapas, LinhaDasEtapas, VAO_DA_LATERAL } from './EtapasDaImportacao';
import { ImportacoesEmAberto } from './LinhaDeImportacaoEmAberto';
import { TermosParaConferir } from './TermosParaConferir';

/** O mesmo destino de `FolhaNovaImportacao`: cria o modelo de Semana de Treino já com a Folha de colar aberta. */
const COLAR_TREINO: Href = { pathname: '/treinador/planejamento', params: { aba: 'treino', tipo: 'plano_treino', novo: '1', colar: '1' } };

/** Qual ação está em andamento: cada botão mostra o próprio carregando, e só o processar mostra o cartão de espera. */
type Acao = 'arquivos' | 'texto' | 'processar' | 'responder' | 'aceitar' | 'revogar' | 'destino' | 'confirmar' | 'cancelar' | 'retomar';
/**
 * Cartão onde o erro aparece: perto do botão que o causou, não no topo da página (no celular ficaria fora da vista).
 * `proxima` acompanha o botão da próxima etapa (ler, gravar), que na faixa larga mora na coluna lateral.
 */
type Onde = 'entrada' | 'abertas' | 'duvidas' | 'grupos' | 'proxima';

export function PainelImportacaoAssistida({ sessaoIdInicial }: { sessaoIdInicial?: string } = {}) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const faixa = useFaixaDaTela();

  const [objetivo, setObjetivo] = useState<ObjetivoImportacao>('CADASTROS_E_PLANOS_ATUAIS');
  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
  const [sessoesAbertas, setSessoesAbertas] = useState<SessaoListaItem[]>([]);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [erro, setErro] = useState<{ texto: string; tom: 'perigo' | 'atencao'; onde: Onde; causa: unknown } | null>(null);
  const [descartar, setDescartar] = useState(false);
  // Importação da lista "Em aberto": a que está abrindo (carregando só nela) e a que o ⋯ pediu para descartar.
  const [retomando, setRetomando] = useState<string | null>(null);
  const [descartarDaLista, setDescartarDaLista] = useState<SessaoListaItem | null>(null);

  // Entrada de texto colado
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [tituloTexto, setTituloTexto] = useState('Texto livre do WhatsApp');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [erroDoTexto, setErroDoTexto] = useState<{ campo: 'titulo' | 'conteudo'; texto: string } | null>(null);

  // Resolução de dúvida ativa
  const [duvidaAtiva, setDuvidaAtiva] = useState<DuvidaImportacao | null>(null);
  const [respostaEscolhida, setRespostaEscolhida] = useState('');
  const [referenciaEscolhida, setReferenciaEscolhida] = useState<string | null>(null);
  const [salvarDicionario, setSalvarDicionario] = useState(true);

  // Seleção explícita de grupos para gravar e chave de idempotência estável por tentativa
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const chaveIdempotenciaRef = useRef<{ assinatura: string; chave: string } | null>(null);

  // Grupos em que o treinador já disse se o aluno parecido é a mesma pessoa (só nesta tela; a API não guarda).
  const [conferidos, setConferidos] = useState<ReadonlySet<string>>(new Set());
  const [resultado, setResultado] = useState<ConfirmacaoResultado | null>(null);
  // Qual botão de gravar foi tocado, para o carregando girar só nele.
  const [gravando, setGravando] = useState<'pendentes' | 'erros'>('pendentes');

  // Foco ao entrar (T-206): sem sessão no endereço já se sabe que é o título; com ela, só depois de lê-la.
  const [focoInicial, setFocoInicial] = useState<FocoAoEntrar | null>(() => (sessaoIdInicial ? null : { tipo: 'titulo' }));
  const refRaiz = useRef<View>(null);
  const refLer = useRef<View>(null);
  const refTermo = useRef<View>(null);
  const refAluno = useRef<Focavel | null>(null);
  useFocoAoEntrar(focoInicial, refRaiz, refLer, refTermo, refAluno);

  const carregarSessoesAbertas = async () => {
    const lista = await listarSessoes().catch(() => [] as SessaoListaItem[]);
    setSessoesAbertas(lista.filter(sessaoRetomavel));
  };

  useEffect(() => {
    let ativo = true;
    const iniciar = async () => {
      if (sessaoIdInicial) {
        try {
          const s = await obterSessao(sessaoIdInicial);
          if (ativo) {
            setSessao(s);
            setFocoInicial(focoAoEntrar(s));
          }
          return;
        } catch {
          // Se falhar ao abrir a sessão da URL, lista as abertas.
        }
      }
      const lista = await listarSessoes().catch(() => [] as SessaoListaItem[]);
      if (ativo) {
        setSessoesAbertas(lista.filter(sessaoRetomavel));
        setFocoInicial((atual) => atual ?? { tipo: 'titulo' });
      }
    };
    void iniciar();
    return () => { ativo = false; };
  }, [sessaoIdInicial]);

  const sessaoId = sessao?.id;
  const sessaoEstado = sessao?.estado;

  useEffect(() => {
    if (!sessaoId || sessaoEstado !== 'PROCESSANDO') return;
    let ativo = true;
    const timer = setInterval(() => {
      void obterSessao(sessaoId)
        .then((atual) => {
          if (ativo) setSessao(atual);
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [sessaoId, sessaoEstado]);

  /**
   * Roda uma ação com o carregando dela. Erro de sessão que mudou no servidor busca a sessão de novo e avisa em âmbar;
   * `noCampo` deixa o erro ir para um campo (o texto colado) em vez do alerta.
   */
  const executar = async (qual: Acao, onde: Onde, passo: () => Promise<void>, noCampo?: (e: unknown) => boolean) => {
    setAcao(qual);
    setErro(null);
    setErroDoTexto(null);
    try {
      await passo();
    } catch (e: unknown) {
      if (noCampo?.(e)) return;
      const recarregar = recarregarDepoisDoErro(e) && sessao;
      if (recarregar) setSessao(await obterSessao(sessao.id).catch(() => sessao));
      setErro({ texto: textoDoErroDaImportacao(e, qual === 'confirmar' ? 'confirmar' : undefined), tom: recarregar ? 'atencao' : 'perigo', onde, causa: e });
    } finally {
      setAcao(null);
    }
  };

  // Sessão criada cujo primeiro envio falhou: a próxima tentativa a reaproveita, para não abrir outra (conta no limite de sessões).
  const sessaoReservada = useRef<string | null>(null);

  /** A tela passa à sessão quando ela tem algum arquivo, mesmo se outro do lote falhar (os aceitos não se perdem). */
  const comSessaoNova = async (enviar: (id: string) => Promise<void>) => {
    const id = sessao?.id ?? sessaoReservada.current ?? (await criarSessao(objetivo)).id;
    sessaoReservada.current = id;
    try {
      await enviar(id);
    } finally {
      const atual = await obterSessao(id).catch(() => null);
      if (atual && atual.arquivos.length > 0) {
        setSessao(atual);
        sessaoReservada.current = null;
      }
    }
  };

  /** Sobe os arquivos um a um na sessão (a atual, a reservada ou uma nova); o picker e o soltar da web usam o mesmo caminho. */
  const subir = (lista: readonly { parte: Blob; nome: string }[]) =>
    comSessaoNova(async (id) => {
      for (const a of lista) await adicionarArquivo(id, a.parte, a.nome);
    });

  const escolherArquivos = () => executar('arquivos', 'entrada', async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        '*/*',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    await subir(res.assets.map((asset) => ({
      nome: asset.name,
      // No celular o FormData do React Native recebe { uri, name, type } no lugar do Blob (não existe File ali).
      parte: Platform.OS === 'web' && asset.file
        ? asset.file
        : ({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob),
    })));
  });

  const soltarArquivos = (arquivos: File[]) =>
    void executar('arquivos', 'entrada', () => subir(arquivos.map((f) => ({ parte: f, nome: f.name }))));

  const enviarTextoLivre = () => executar('texto', 'entrada', async () => {
    await comSessaoNova((id) => adicionarTexto(id, tituloTexto, conteudoTexto).then(() => undefined));
    setConteudoTexto('');
    setMostrarTexto(false);
  }, (e) => {
    const campo = campoDoErroDoTexto(e);
    if (campo) setErroDoTexto({ campo, texto: textoDoErroDaImportacao(e) });
    return !!campo;
  });

  const processar = () => {
    if (!sessao) return;
    void executar('processar', 'proxima', async () => setSessao(await processarSessao(sessao.id)));
  };

  const resolverDuvida = () => {
    if (!sessao || !duvidaAtiva || !respostaEscolhida.trim()) return;
    void executar('responder', 'duvidas', async () => {
      const atualizada = await responderDuvida(
        sessao.id,
        duvidaAtiva.id,
        respostaEscolhida.trim(),
        salvarDicionario,
        duvidaAtiva.tipo,
        duvidaAtiva.termoOriginal,
        referenciaEscolhida,
        duvidaAtiva.ocorrenciaIds ?? null
      );
      setSessao(atualizada);
      setDuvidaAtiva(null);
      setRespostaEscolhida('');
      setReferenciaEscolhida(null);
    });
  };

  const aceitarTodas = () => {
    if (!sessao) return;
    void executar('aceitar', 'duvidas', async () => {
      setSessao(await aceitarSugestoes(sessao.id, sessao.revisao));
      setDuvidaAtiva(null);
      setReferenciaEscolhida(null);
    });
  };

  const revogar = (decisao: DecisaoImportacao) => {
    if (!sessao) return;
    void executar('revogar', 'duvidas', async () => {
      const atualizada = await revogarDecisao(sessao.id, decisao.decisaoId, sessao.revisao);
      setSessao(atualizada);
    });
  };

  const limparEstadoLocalDaSessao = () => {
    setResultado(null);
    setErro(null);
    setErroDoTexto(null);
    setDuvidaAtiva(null);
    setRespostaEscolhida('');
    setReferenciaEscolhida(null);
    setDescartar(false);
    setConferidos(new Set());
    setSelecionados(new Set());
    chaveIdempotenciaRef.current = null;
  };

  const retomar = (id: string) => {
    setRetomando(id);
    void executar('retomar', 'abertas', async () => {
      limparEstadoLocalDaSessao();
      setSessao(await obterSessao(id));
    }).finally(() => setRetomando(null));
  };

  /** O mesmo cancelar da sessão aberta, para uma importação da lista; depois a lista é lida de novo. */
  const confirmarDescarteDaLista = () => {
    const alvo = descartarDaLista;
    setDescartarDaLista(null);
    if (!alvo) return;
    void executar('cancelar', 'abertas', async () => {
      await cancelarSessao(alvo.id);
      await carregarSessoesAbertas();
    });
  };

  const conferir = (grupoId: string) => setConferidos((atual) => new Set(atual).add(grupoId));

  const alternarSelecao = (grupoId: string, marcado: boolean) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(grupoId);
      else proximo.delete(grupoId);
      return proximo;
    });
  };

  const alterarDestinoDoGrupo = (grupo: GrupoImportavel, valor: ValorDoDestino | null) => {
    if (!sessao || valor === null) return;
    // "Criar aluno novo" já é o destino: só registra que o treinador respondeu, sem ir à API.
    if (valor === 'NOVO' && grupo.destino === 'CRIAR_ALUNO') return conferir(grupo.id);
    void executar('destino', 'grupos', async () => {
      setSessao(await atualizarGrupo(sessao.id, grupo.id, pedidoDoDestino(valor)));
      conferir(grupo.id);
    });
  };

  const chaveParaTentativa = (ids: string[]): string => {
    if (!sessao) return gerarChaveIdempotencia();
    const assinatura = `${sessao.id}:${sessao.revisao}:${[...ids].sort().join(',')}:${sessao.hashPrevia ?? ''}`;
    if (chaveIdempotenciaRef.current?.assinatura === assinatura) {
      return chaveIdempotenciaRef.current.chave;
    }
    const chave = gerarChaveIdempotencia();
    chaveIdempotenciaRef.current = { assinatura, chave };
    return chave;
  };

  /** Grava os grupos dados e busca a sessão de novo: com erro ela volta à revisão, com os gravados já resumidos. */
  const gravar = (ids: string[], quais: 'pendentes' | 'erros') => {
    if (!sessao || ids.length === 0 || !sessao.hashPrevia) return;
    setGravando(quais);
    const chave = chaveParaTentativa(ids);
    const hashPrevia = sessao.hashPrevia;
    void executar('confirmar', 'proxima', async () => {
      setResultado(await confirmarSessao(sessao.id, ids, sessao.revisao, hashPrevia, chave));
      const atual = await obterSessao(sessao.id).catch(() => null);
      setSessao(atual && atual.estado !== 'CONCLUIDA' ? atual : null);
      void carregarSessoesAbertas();
    });
  };

  const resetar = () => {
    setSessao(null);
    limparEstadoLocalDaSessao();
    sessaoReservada.current = null;
    void carregarSessoesAbertas();
  };

  const confirmarCancelamento = () => {
    if (!sessao) {
      resetar();
      return;
    }
    setDescartar(false);
    void executar('cancelar', 'entrada', async () => {
      await cancelarSessao(sessao.id);
      resetar();
    });
  };

  const erroEm = (onde: Onde) => {
    if (erro?.onde !== onde) return null;
    return erro.tom === 'atencao' ? <Alerta tom="atencao" texto={erro.texto} /> : <MensagemErro texto={erro.texto} erro={erro.causa} />;
  };

  const resumo = resultado ? resumoDoResultado(resultado) : null;

  if (resumo && !sessao) {
    return (
      <Cartao titulo={resumo.titulo} descricao={resumo.descricao ?? undefined}>
        {resumo.alerta ? <Alerta tom={resumo.alerta.tom} texto={resumo.alerta.texto} /> : null}
        <View style={estilos.lista}>
          {resumo.linhas.map((l) => <Texto key={l} numerico>{l}</Texto>)}
        </View>
        <LinhaDeAcoes>
          <Botao rotulo="Fazer outra importação" tipo="primario" aoTocar={resetar} Icone={FileUp} />
        </LinhaDeAcoes>
      </Cartao>
    );
  }

  const idsSelecionaveis = new Set(
    (sessao?.grupos ?? []).filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR').map((g) => g.id)
  );
  const selecionadosAtivos = new Set([...selecionados].filter((id) => idsSelecionaveis.has(id)));
  const gravaveisSelecionados = sessao ? [...selecionadosAtivos] : [];
  const prontosIds = sessao ? idsSelecionaveisProntos(sessao.grupos, pode, conferidos) : [];
  const comErro = sessao ? idsComErro(sessao.grupos) : [];
  const temPendentes =
    !!sessao?.grupos.some((g) => !grupoResumido(g) && g.destino !== 'IGNORAR');
  const motivoConfirmar = sessao
    ? motivoParaNaoConfirmar(sessao.grupos, pode, conferidos, selecionadosAtivos, sessao.hashPrevia)
    : null;
  const modo = sessao ? resumoDoModoProcessamento(sessao.modoProcessamento) : null;
  const decisoesAtivasPorDuvida = new Map<string, DecisaoImportacao>();
  for (const dec of sessao?.decisoes ?? []) {
    if (dec.ativa) decisoesAtivasPorDuvida.set(dec.duvidaId, dec);
  }

  // Tela larga (25/11): da faixa larga em diante, o resumo e a próxima etapa vão para a coluna ao lado, grudada ao rolar.
  // Um botão da próxima etapa por vez, num lugar só: na lateral nessa faixa, nos cartões abaixo dela.
  const comLateral = faixa === 'larga' || faixa === 'ultralarga';
  // Na coluna das etapas o botão da próxima etapa é a ação de apoio (cor de ação); nos cartões, o principal.
  const tipoDaProxima = comLateral ? 'acao' : 'primario';
  const duvidas = duvidasVisiveis(sessao?.duvidas);
  const sugestoesUnicas = duvidasComSugestaoUnica(duvidas).length;
  const podeLer = sessao?.estado === 'RECEBENDO' || sessao?.estado === 'RASCUNHO';
  const botaoLer = podeLer ? (
    <LinhaDeAcoes>
      <Botao ref={refLer} rotulo="Ler os arquivos" tipo={tipoDaProxima} Icone={FileSearch} carregando={acao === 'processar'} aoTocar={processar} />
    </LinhaDeAcoes>
  ) : null;
  // Resultado junto dos botões: quem tocou em gravar o vê sem rolar a página.
  const blocoDoResultado = resumo ? (
    <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.lista}>
        <Texto variante="bloco" nivel={3}>{resumo.titulo}</Texto>
        {resumo.descricao ? <Texto variante="suave">{resumo.descricao}</Texto> : null}
      </View>
      {resumo.alerta ? <Alerta tom={resumo.alerta.tom} texto={resumo.alerta.texto} /> : null}
      <View style={estilos.lista}>
        {resumo.linhas.map((l) => <Texto key={l} numerico>{l}</Texto>)}
      </View>
    </View>
  ) : null;
  const botoesDeGravar = sessao && (temPendentes || comErro.length > 0) ? (
    <LinhaDeAcoes>
      {temPendentes ? (
        <Botao
          rotulo={gravaveisSelecionados.length > 0 ? `Gravar selecionados (${gravaveisSelecionados.length})` : 'Gravar selecionados'}
          tipo={tipoDaProxima}
          Icone={CheckCircle2}
          carregando={acao === 'confirmar' && gravando === 'pendentes'}
          desabilitado={!!motivoConfirmar || acao === 'destino' || acao === 'confirmar'}
          motivo={motivoConfirmar ?? (acao === 'destino' ? 'Salvando o destino…' : 'Aguarde a gravação terminar.')}
          aoTocar={() => gravar(gravaveisSelecionados, 'pendentes')}
        />
      ) : null}
      {comErro.length > 0 ? (
        <Botao
          rotulo="Tentar de novo os que deram erro"
          tipo={temPendentes ? 'secundario' : tipoDaProxima}
          Icone={RotateCcw}
          carregando={acao === 'confirmar' && gravando === 'erros'}
          desabilitado={acao === 'confirmar' || acao === 'destino' || !sessao.hashPrevia}
          motivo={!sessao.hashPrevia ? 'Atualize a sessão antes de tentar de novo.' : 'Aguarde a gravação terminar.'}
          aoTocar={() => gravar(comErro, 'erros')}
        />
      ) : null}
    </LinhaDeAcoes>
  ) : null;
  const doGravar = sessao && sessao.grupos.length > 0 ? <>{blocoDoResultado}{erroEm('proxima')}{botoesDeGravar}</> : null;
  // Etapas (26/11): a atual sai da máquina de estados da sessão; as contagens, do que a tela já tem.
  const etapaAtual = etapaDaImportacao(sessao, !temPendentes || !motivoConfirmar);
  const contagens = sessao ? contagensDasEtapas(sessao, pode, { marcados: selecionadosAtivos.size, possiveis: idsSelecionaveis.size }) : null;

  const blocos = (
    <>
      {comLateral ? null : <LinhaDasEtapas atual={etapaAtual} />}
      {!sessao ? (
        <>
          <Cartao
            titulo="Enviar arquivos ou texto"
            descricao="PDFs de treino, DOCX de dieta, planilhas e mensagens num lote só. Você confere os termos e escolhe o que gravar antes de confirmar."
          >
          <EscolhaDoQueImportar valor={objetivo} aoMudar={(o) => { setObjetivo(o); sessaoReservada.current = null; }} />
          <AreaDeSoltarArquivos
            aoEscolher={() => void escolherArquivos()}
            aoSoltar={soltarArquivos}
            aoColar={() => setMostrarTexto(!mostrarTexto)}
            colando={mostrarTexto}
            enviando={acao === 'arquivos'}
            ocupado={acao !== null}
          />
          {erroEm('entrada')}

          {mostrarTexto ? (
            <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Campo
                rotulo="Título ou origem"
                valor={tituloTexto}
                aoMudar={setTituloTexto}
                erro={erroDoTexto?.campo === 'titulo' ? erroDoTexto.texto : null}
              />
              <Campo
                rotulo="Texto colado (WhatsApp, notas, e-mail)"
                valor={conteudoTexto}
                aoMudar={setConteudoTexto}
                linhas={6}
                erro={erroDoTexto?.campo === 'conteudo' ? erroDoTexto.texto : null}
                placeholder="Exemplo: Aluno: Gabriel Santos&#10;Treino A - Peito&#10;Supino Reto 4x10&#10;…"
              />
              <LinhaDeAcoes>
                <Botao
                  rotulo="Adicionar o texto"
                  tipo="acao"
                  carregando={acao === 'texto'}
                  desabilitado={!conteudoTexto.trim()}
                  motivo="Cole o texto antes de adicionar."
                  aoTocar={() => void enviarTextoLivre()}
                />
              </LinhaDeAcoes>
            </View>
          ) : null}
          </Cartao>

          {sessoesAbertas.length > 0 ? (
            <Cartao titulo="Importações em aberto" descricao="Retome uma importação antes que ela expire.">
              {erroEm('abertas')}
              <ImportacoesEmAberto sessoes={sessoesAbertas} retomando={retomando} aoRetomar={retomar} aoDescartar={setDescartarDaLista} />
            </Cartao>
          ) : null}
        </>
      ) : (
        <>
          <Cartao
            titulo="Arquivos da importação"
            descricao={`${textoDoEstadoDaSessao(sessao.estado)} · ${plural(sessao.arquivos.length, 'arquivo ou texto', 'arquivos ou textos')}${modo ? ` · ${modo.titulo}` : ''}`}
            acoes={sessaoPodeCancelar(sessao.estado) ? (
              <Botao rotulo="Cancelar importação" tipo="perigoTexto" carregando={acao === 'cancelar'} aoTocar={() => setDescartar(true)} />
            ) : undefined}
          >
            {modo?.alertaFallback ? (
              <Alerta tom="atencao" texto={modo.alertaFallback} />
            ) : modo ? (
              <Texto variante="suave">{modo.descricao}</Texto>
            ) : null}
            {lidoSemIa(sessao.modoProcessamento) ? (
              <View style={estilos.lista}>
                <Texto variante="suave">{DICA_DE_TREINO_DESMONTADO}</Texto>
                {pode('MODELO_LER') && pode('MODELO_ALTERAR') ? <LinkTexto href={COLAR_TREINO} texto="Colar treino de PDF / Docs" /> : null}
              </View>
            ) : null}
            <View style={estilos.lista}>
              {sessao.arquivos.map((arq) => {
                const cobertura = resumoDaCoberturaDoArquivo(arq.cobertura);
                return (
                  <View key={arq.id} style={[estilos.arquivo, { borderBottomColor: cores.divisor }]}>
                    <View style={estilos.linha}>
                      <Texto style={estilos.encolher}>{arq.nomeOriginal}</Texto>
                      {arq.erroCodigo ? <Selo texto="Não lido" tipo="perigo" /> : <Selo texto={arq.formato} tipo="neutro" />}
                    </View>
                    {cobertura ? (
                      <Texto variante="pequeno" cor={cobertura.tom === 'perigo' ? cores.perigo : cobertura.tom === 'atencao' ? cores.atencao : cores.textoSuave}>
                        {cobertura.texto}
                      </Texto>
                    ) : null}
                    {arq.erroCodigo ? <Texto variante="suave">{motivoDoErroDoArquivo(arq.erroCodigo)}</Texto> : null}
                  </View>
                );
              })}
            </View>

            {erroEm('entrada')}
            {!comLateral && podeLer ? <>{erroEm('proxima')}{botaoLer}</> : null}
          </Cartao>

          {acao === 'processar' || sessao.estado === 'PROCESSANDO' ? (
            <Cartao
              titulo="Lendo os arquivos…"
              descricao={textoDaLeitura(sessao.leitura) ?? 'Acompanhando o processamento no servidor automaticamente.'}
            >
              <Esqueleto />
            </Cartao>
          ) : null}

          {duvidas.length > 0 ? (
            <Cartao
              titulo="Termos para conferir"
              descricao="Abreviações e nomes de exercícios ou alimentos que o sistema não reconheceu com certeza."
              acoes={sugestoesUnicas > 0 ? (
                <Botao
                  rotulo={`Aceitar todas as sugestões (${sugestoesUnicas})`}
                  tipo="secundario"
                  carregando={acao === 'aceitar'}
                  desabilitado={!!acao}
                  motivo="Aguarde a ação em andamento."
                  aoTocar={aceitarTodas}
                />
              ) : undefined}
            >
              {erroEm('duvidas')}
              <TermosParaConferir
                duvidas={duvidas}
                decisoes={decisoesAtivasPorDuvida}
                edicao={duvidaAtiva ? { id: duvidaAtiva.id, resposta: respostaEscolhida, salvarDicionario } : null}
                salvando={acao === 'responder'}
                revogando={acao === 'revogar'}
                pendente={focoInicial?.tipo === 'termo' ? { id: focoInicial.duvidaId, ref: refTermo } : undefined}
                aoEditar={(d, resposta, referenciaId) => {
                  setDuvidaAtiva(d);
                  setRespostaEscolhida(resposta);
                  setReferenciaEscolhida(referenciaId);
                }}
                aoMudarResposta={(texto) => {
                  setRespostaEscolhida(texto);
                  setReferenciaEscolhida(null);
                }}
                aoMudarDicionario={setSalvarDicionario}
                aoSalvar={resolverDuvida}
                aoCancelar={() => {
                  setDuvidaAtiva(null);
                  setReferenciaEscolhida(null);
                }}
                aoRevogar={revogar}
              />
            </Cartao>
          ) : null}

          {sessao.estado === 'REVISANDO' && sessao.grupos.length === 0 ? (
            <Cartao titulo="Nenhum aluno ou plano encontrado">
              <Alerta
                tom={sessao.arquivos.length > 0 && sessao.arquivos.every((a) => !!a.erroCodigo) ? 'perigo' : 'atencao'}
                texto={
                  sessao.arquivos.some((a) => a.cobertura?.status === 'SEM_TEXTO')
                    ? 'O arquivo enviado não tem texto selecionável (como um PDF escaneado). Envie um arquivo com texto selecionável ou cole o texto manualmente.'
                    : sessao.arquivos.length > 0 && sessao.arquivos.every((a) => !!a.erroCodigo)
                      ? 'Não foi possível ler nenhum dos arquivos enviados. Confira o motivo em cada arquivo acima.'
                      : 'Não foi possível identificar alunos, treinos ou dietas nos arquivos enviados.'
                }
              />
              <LinhaDeAcoes>
                <Botao rotulo="Cancelar e começar outra" tipo="secundario" aoTocar={() => setDescartar(true)} />
              </LinhaDeAcoes>
            </Cartao>
          ) : null}

          {sessao.grupos && sessao.grupos.length > 0 ? (
            <Cartao
              titulo="Alunos encontrados"
              descricao="Confira cada aluno, escolha o destino e selecione quais grupos gravar."
            >
              {temPendentes ? (
                <LinhaDeAcoes>
                  <Botao
                    rotulo={`Selecionar prontos (${prontosIds.length})`}
                    tipo="secundario"
                    desabilitado={prontosIds.length === 0}
                    motivo="Nenhum grupo pronto disponível."
                    aoTocar={() => setSelecionados(new Set(prontosIds))}
                  />
                  <Botao
                    rotulo="Limpar seleção"
                    tipo="fantasma"
                    desabilitado={selecionadosAtivos.size === 0}
                    motivo="Nenhum grupo selecionado."
                    aoTocar={() => setSelecionados(new Set())}
                  />
                </LinhaDeAcoes>
              ) : null}

              {sessao.grupos.map((g) => (grupoResumido(g) ? <LinhaResumida key={g.id} grupo={g} /> : (
                <GrupoParaConferir
                  key={g.id}
                  grupo={g}
                  pode={pode}
                  conferidos={conferidos}
                  selecionado={selecionadosAtivos.has(g.id)}
                  aoSelecionar={g.destino !== 'IGNORAR' ? (m) => alternarSelecao(g.id, m) : undefined}
                  aoMudar={(v) => alterarDestinoDoGrupo(g, v)}
                  refDoDestino={focoInicial?.tipo === 'aluno' && focoInicial.grupoId === g.id ? refAluno : undefined}
                />
              )))}

              {erroEm('grupos')}
              {comLateral ? null : doGravar}
            </Cartao>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <View ref={refRaiz} style={estilos.blocos}>
      {comLateral ? (
        <View style={estilos.ladoALado}>
          <View style={[estilos.blocos, estilos.principal]}>{blocos}</View>
          <ColunaDasEtapas atual={etapaAtual} contagens={contagens}>
            {podeLer ? <>{erroEm('proxima')}{botaoLer}</> : doGravar}
          </ColunaDasEtapas>
        </View>
      ) : blocos}

      <PainelConfirmacao
        visivel={descartar}
        titulo="Cancelar a importação?"
        mensagem="A sessão será cancelada e os arquivos temporários serão descartados. O que já foi gravado permanece."
        rotuloConfirmar="Cancelar importação"
        perigo
        aoConfirmar={confirmarCancelamento}
        aoCancelar={() => setDescartar(false)}
      />
      <PainelConfirmacao
        visivel={!!descartarDaLista}
        titulo={`Descartar a importação de ${descartarDaLista ? dataHoraParaTela(descartarDaLista.criadoEm) : ''}?`}
        mensagem="A sessão será cancelada e os arquivos temporários serão descartados. O que já foi gravado permanece."
        rotuloConfirmar="Descartar importação"
        perigo
        aoConfirmar={confirmarDescarteDaLista}
        aoCancelar={() => setDescartarDaLista(null)}
      />
    </View>
  );
}

type Focavel = { focus: () => void };

/** O h1 da tela (o título do `Cabecalho`, que não expõe ref): o mais perto do painel, subindo pelos ancestrais. */
function tituloDaTela(raiz: View | null): HTMLElement | null {
  for (let no = (raiz as unknown as HTMLElement | null)?.parentElement; no; no = no.parentElement) {
    const titulo = no.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"]');
    if (titulo) return titulo;
  }
  return null;
}

const emCampo = (el: Element | null) =>
  !!el && ((el as HTMLElement).isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

/**
 * Foco ao entrar (T-206), uma vez por montagem: no título da tela ou na primeira ação pendente (`focoAoEntrar`). Não
 * rouba: se a pessoa já tocou ou teclou desde que a tela abriu, ou está num campo, o foco fica onde está. Espera dois
 * quadros, porque a tabela dos termos se mede e, estreita, vira cartões (o botão remonta), e confere de novo em 300 ms:
 * se o botão focado sumiu nessa troca (foco no `body`), foca o novo. O título não rola a página; a ação rola só se
 * estiver fora da vista. No nativo o leitor de tela já começa no topo da tela nova: só a ação pendente recebe o foco
 * (`setAccessibilityFocus`, como em `ConferirOArquivo`).
 */
function useFocoAoEntrar(
  foco: FocoAoEntrar | null,
  raiz: RefObject<View | null>,
  ler: RefObject<View | null>,
  termo: RefObject<View | null>,
  aluno: RefObject<Focavel | null>,
) {
  const interagiu = useRef(false);
  const feito = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const marcar = () => { interagiu.current = true; };
    document.addEventListener('keydown', marcar, true);
    document.addEventListener('pointerdown', marcar, true);
    return () => {
      document.removeEventListener('keydown', marcar, true);
      document.removeEventListener('pointerdown', marcar, true);
    };
  }, []);

  useEffect(() => {
    if (!foco || feito.current) return;
    let noNativo: number | null = null;
    const focar = () => {
      if (interagiu.current) return;
      if (Platform.OS !== 'web') {
        const no = findNodeHandle(foco.tipo === 'ler' ? ler.current : foco.tipo === 'termo' ? termo.current : null);
        // O mesmo nó já tem o foco; outro nó é o botão remontado.
        if (!no || no === noNativo) return;
        AccessibilityInfo.setAccessibilityFocus(no);
        noNativo = no;
        feito.current = true;
        return;
      }
      const ativo = document.activeElement;
      // Na segunda passada só refaz se o foco se perdeu (o botão sumiu); a primeira tira o foco do menu que abriu a tela.
      if (feito.current && ativo && ativo !== document.body) return;
      if (emCampo(ativo)) return;
      if (foco.tipo === 'aluno') {
        if (!aluno.current) return;
        aluno.current.focus();
      } else if (foco.tipo === 'titulo') {
        const titulo = tituloDaTela(raiz.current);
        if (!titulo) return;
        if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
      } else {
        const botao = (foco.tipo === 'ler' ? ler.current : termo.current) as unknown as HTMLElement | null;
        if (!botao) return;
        botao.focus();
      }
      feito.current = true;
    };
    let segundo = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const primeiro = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => {
        focar();
        espera = setTimeout(focar, 300);
      });
    });
    return () => {
      cancelAnimationFrame(primeiro);
      cancelAnimationFrame(segundo);
      clearTimeout(espera);
    };
  }, [foco, raiz, ler, termo, aluno]);
}

/** Grupo gravado, ignorado no fim ou com erro na gravação: uma linha com o selo, sem ações. O erro diz o motivo. */
function LinhaResumida({ grupo }: { grupo: GrupoImportavel }) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  return (
    <View style={[estilos.resumida, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalhoItem}>
        <Texto style={estilos.encolher}>{tituloDoGrupoResumido(grupo)}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>
      {grupo.estado === 'ERRO' ? <Texto variante="suave">{motivoDoErroDoGrupo(grupo.erroCodigo)}</Texto> : null}
    </View>
  );
}

/** Grupo ainda não gravado: o que foi lido ("—" onde não há dado ou a pessoa não pode ver) e o destino. */
function GrupoParaConferir({ grupo, pode, conferidos, selecionado, aoSelecionar, aoMudar, refDoDestino }: {
  grupo: GrupoImportavel;
  pode: (codigo: string) => boolean;
  conferidos: ReadonlySet<string>;
  selecionado: boolean;
  aoSelecionar?: (marcado: boolean) => void;
  aoMudar: (valor: ValorDoDestino | null) => void;
  /** Só no aluno parecido que recebe o foco ao entrar na tela (T-206). */
  refDoDestino?: Ref<Focavel | null>;
}) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  return (
    <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalhoItem}>
        <Texto variante="bloco" nivel={3} style={estilos.encolher}>{grupo.nomeDetectado}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>

      <Texto variante="suave">Origem: {grupo.arquivosOrigem.join(', ') || '—'}</Texto>

      <View style={estilos.lista}>
        {linhasDoGrupo(grupo, pode).map((l) => <Texto key={l.rotulo} numerico>{l.rotulo}: {l.valor}</Texto>)}
      </View>

      {(grupo.avisos ?? []).map((aviso) => <Alerta key={aviso} tom="atencao" texto={aviso} />)}

      {precisaEscolherAluno(grupo, conferidos) ? (
        <Alerta tom="atencao" texto="Já existe aluno cadastrado parecido com este. Escolha se é a mesma pessoa ou crie um aluno novo." />
      ) : null}

      <Escolha<ValorDoDestino | null>
        ref={refDoDestino}
        rotulo="Destino"
        valor={valorDoDestino(grupo, conferidos)}
        aoMudar={aoMudar}
        opcoes={opcoesDoDestino(grupo, pode)}
      />

      {aoSelecionar ? (
        <CaixaSelecao
          rotulo="Incluir na gravação"
          marcado={selecionado}
          aoMudar={aoSelecionar}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  lista: { gap: espaco(1) },
  arquivo: { gap: espaco(0.5), paddingVertical: espaco(1), borderBottomWidth: 1 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(2) },
  // A linha resumida é mais baixa que o grupo para conferir: diz o que houve sem disputar a atenção.
  resumida: { borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2), gap: espaco(0.5) },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_LATERAL },
  principal: { flex: 1, minWidth: 0 },
  encolher: { flex: 1, minWidth: 0 },
});
