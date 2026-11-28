import { useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileSearch, FileUp, RotateCcw } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { plural } from '../../dominio/formatos';
import {
  AVISO_DA_ESPERA_LONGA,
  AVISO_LEITURA_NAO_TERMINOU,
  AVISO_TERMO_NAO_CONFERIDO,
  campoDoErroDoTexto,
  contagensDasEtapas,
  DICA_DE_TREINO_DESMONTADO,
  duvidasComSugestaoUnica,
  duvidasVisiveis,
  etapaDaImportacao,
  FALHAS_ATE_AVISAR,
  focoAoEntrar,
  gerarChaveIdempotencia,
  gruposSelecionaveis,
  grupoResumido,
  idsComErro,
  idsSelecionaveisProntos,
  lidoSemIa,
  motivoParaNaoConfirmar,
  motivosAntesDeEnviar,
  partesParaJuntar,
  pedidoDoDestino,
  PODE_SAIR_DURANTE_A_LEITURA,
  recarregarDepoisDoErro,
  resumoDaGravacao,
  resumoDoModoProcessamento,
  resumoDoResultado,
  rotuloDoLer,
  sessaoAceitaArquivos,
  sessaoPodeCancelar,
  sessaoPodeLer,
  tetoDaEsperaMs,
  textoDaLeitura,
  textoDoErroDaImportacao,
  textoDoEstadoDaSessao,
  textoDosTravados,
  type CadastroEditavel,
  type FocoAoEntrar,
  type ResultadoDoEnvio,
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
  juntarGrupos,
  obterSessao,
  processarSessao,
  responderDuvida,
  revogarDecisao,
  type ConfirmacaoResultado,
  type DecisaoImportacao,
  type DuvidaImportacao,
  type GrupoImportavel,
  type SessaoDetalhe,
  type SugestaoDuvida,
} from '../../servicos/importacaoAssistida';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { AlunoParaConferir, LinhaResumida } from './AlunoParaConferir';
import { ArquivosDaImportacao } from './ArquivosDaImportacao';
import { EnvioDeArquivos } from './EnvioDeArquivos';
import { ColunaDasEtapas, LinhaDasEtapas, VAO_DA_LATERAL } from './EtapasDaImportacao';
import { formulario, type ArquivoEscolhido } from './formularioDaImportacao';
import { ImportacoesAssistidasEmAberto } from './ImportacoesAssistidasEmAberto';
import { ResultadoDaGravacao } from './ResultadoDaGravacao';
import { TermosParaConferir } from './TermosParaConferir';
import { useFocoAoEntrar, type Focavel } from './useFocoAoEntrar';

/** O mesmo destino de `FolhaNovaImportacao`: cria o modelo de Semana de Treino já com a Folha de colar aberta. */
const COLAR_TREINO: Href = { pathname: '/treinador/planejamento', params: { aba: 'treino', tipo: 'plano_treino', novo: '1', colar: '1' } };

/** Qual ação está em andamento: uma por vez (2.7); cada botão mostra o próprio carregando. */
type Acao = 'arquivos' | 'texto' | 'processar' | 'responder' | 'aceitar' | 'revogar' | 'destino' | 'cadastro' | 'juntar' | 'confirmar' | 'cancelar' | 'retomar';
/**
 * Onde o erro aparece: perto do botão que o causou, não no topo da página (no celular ficaria fora da vista). `proxima`
 * acompanha o botão da próxima etapa (ler, gravar), que na faixa larga mora na coluna lateral; `grupo:<id>`, no aluno.
 */
type Onde = 'entrada' | 'duvidas' | 'proxima' | `grupo:${string}`;

const ACOMPANHAR_A_CADA_MS = 2000;

/**
 * Importação assistida: enviar arquivos ou texto, ler, conferir termos e alunos, escolher o que gravar e gravar em
 * rascunho. A sessão fica no endereço (`?sessaoId=`, 2.6): sair e voltar retoma. Uma ação por vez (2.7): a resposta de
 * uma ação nunca briga com a de outra, e o acompanhamento da leitura não sobrescreve uma ação em andamento.
 */
export function PainelImportacaoAssistida({ sessaoIdInicial }: { sessaoIdInicial?: string } = {}) {
  const { pode, importacaoPorImagemHabilitada } = useSessao();
  const faixa = useFaixaDaTela();
  const router = useRouter();

  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
  const [acao, setAcaoNoEstado] = useState<Acao | null>(null);
  const acaoAtual = useRef<Acao | null>(null);
  const [erro, setErro] = useState<{ texto: string; tom: 'perigo' | 'atencao'; onde: Onde; causa: unknown } | null>(null);
  const [descartar, setDescartar] = useState(false);
  const [recarregarAbertas, setRecarregarAbertas] = useState(0);

  // Envio (2.1): o resultado por arquivo do último envio; o erro do texto colado vai no campo.
  const [envios, setEnvios] = useState<ResultadoDoEnvio[]>([]);
  const [erroDoTexto, setErroDoTexto] = useState<{ campo: 'titulo' | 'conteudo'; texto: string } | null>(null);

  // Termo em edição e as respostas de um toque.
  const [duvidaAtiva, setDuvidaAtiva] = useState<DuvidaImportacao | null>(null);
  const [respostaEscolhida, setRespostaEscolhida] = useState('');
  const [referenciaEscolhida, setReferenciaEscolhida] = useState<string | null>(null);
  const [salvarDicionario, setSalvarDicionario] = useState(true);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  // Aluno em que a ação corre (destino, cadastro) e o parceiro do "Juntar com…".
  const [grupoEmAcao, setGrupoEmAcao] = useState<string | null>(null);
  const [juntando, setJuntando] = useState<string | null>(null);

  // Seleção: `null` = a pessoa ainda não mexeu e valem os prontos (2.7: a seleção já nasce com eles marcados).
  const [selecionados, setSelecionados] = useState<Set<string> | null>(null);
  const chaveIdempotenciaRef = useRef<{ assinatura: string; chave: string } | null>(null);

  // Alunos em que o treinador já disse se o aluno parecido é a mesma pessoa (só nesta tela; a API não guarda).
  const [conferidos, setConferidos] = useState<ReadonlySet<string>>(new Set());
  const [resultado, setResultado] = useState<ConfirmacaoResultado | null>(null);
  const [gravando, setGravando] = useState<'pendentes' | 'erros'>('pendentes');

  // Espera da leitura (2.6): 5 falhas seguidas do acompanhamento, ou passar do teto, param e perguntam.
  const [esperaLonga, setEsperaLonga] = useState(false);
  const falhas = useRef(0);
  const inicioDaEspera = useRef<number | null>(null);

  const [focoInicial, setFocoInicial] = useState<FocoAoEntrar | null>(() => (sessaoIdInicial ? null : { tipo: 'titulo' }));
  const refRaiz = useRef<View>(null);
  const refLer = useRef<View>(null);
  const refTermo = useRef<View>(null);
  const refAluno = useRef<Focavel | null>(null);
  useFocoAoEntrar(focoInicial, refRaiz, refLer, refTermo, refAluno);

  const sessaoId = sessao?.id;
  const sessaoEstado = sessao?.estado;
  const totalDeArquivos = sessao?.arquivos.length ?? 0;

  // A sessão do endereço (retomar, voltar à tela). Quando é a que já está aberta (o próprio `setParams`), não lê de novo.
  const sessaoNaTela = useRef<string | undefined>(undefined);
  useEffect(() => { sessaoNaTela.current = sessaoId; }, [sessaoId]);
  useEffect(() => {
    // Sem sessão no endereço o foco já nasce no título (estado inicial).
    if (!sessaoIdInicial || sessaoIdInicial === sessaoNaTela.current) return undefined;
    let ativo = true;
    obterSessao(sessaoIdInicial).then(
      (s) => {
        if (!ativo) return;
        setSessao(s);
        setFocoInicial((atual) => atual ?? focoAoEntrar(s));
      },
      // Sessão do endereço que não abre (expirou, outra conta): fica o começo, com as importações em aberto.
      () => { if (ativo) setFocoInicial((atual) => atual ?? { tipo: 'titulo' }); },
    );
    return () => { ativo = false; };
  }, [sessaoIdInicial]);

  // Sessão aberta no endereço (2.6): sair e voltar retoma; fechar a sessão tira o parâmetro.
  const noEndereco = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (noEndereco.current === sessaoId) return;
    noEndereco.current = sessaoId;
    router.setParams({ sessaoId });
  }, [sessaoId, router]);

  useEffect(() => {
    if (!sessaoId || sessaoEstado !== 'PROCESSANDO') {
      inicioDaEspera.current = null;
      return undefined;
    }
    if (esperaLonga) return undefined;
    inicioDaEspera.current ??= Date.now();
    let ativo = true;
    const timer = setInterval(() => {
      if (Date.now() - (inicioDaEspera.current ?? Date.now()) > tetoDaEsperaMs(totalDeArquivos)) {
        setEsperaLonga(true);
        return;
      }
      obterSessao(sessaoId).then(
        (atual) => {
          if (!ativo) return;
          falhas.current = 0;
          // Na fila a leitura ainda não começou: o teto da espera conta a partir da vaga, como o corte do servidor.
          if (atual.leitura?.aguardando) inicioDaEspera.current = Date.now();
          // Uma ação em andamento traz a sessão dela: o acompanhamento não a sobrescreve com uma mais velha.
          if (!acaoAtual.current) setSessao(atual);
        },
        () => {
          if (!ativo) return;
          falhas.current += 1;
          if (falhas.current >= FALHAS_ATE_AVISAR) setEsperaLonga(true);
        },
      );
    }, ACOMPANHAR_A_CADA_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [sessaoId, sessaoEstado, esperaLonga, totalDeArquivos]);

  const continuarEsperando = () => {
    falhas.current = 0;
    inicioDaEspera.current = Date.now();
    setEsperaLonga(false);
  };

  const definirAcao = (qual: Acao | null) => {
    acaoAtual.current = qual;
    setAcaoNoEstado(qual);
  };

  /**
   * Roda uma ação com o carregando dela; com outra em andamento, não roda (2.7). Erro de sessão que mudou no servidor
   * busca a sessão de novo e avisa em âmbar; `noCampo` deixa o erro ir para um campo em vez do alerta. `true` = deu certo.
   */
  const executar = async (qual: Acao, onde: Onde, passo: () => Promise<void>, noCampo?: (e: unknown) => boolean): Promise<boolean> => {
    if (acaoAtual.current) return false;
    definirAcao(qual);
    setErro(null);
    setErroDoTexto(null);
    try {
      await passo();
      return true;
    } catch (e: unknown) {
      if (noCampo?.(e)) return false;
      const recarregar = recarregarDepoisDoErro(e) && sessao;
      if (recarregar) setSessao(await obterSessao(sessao.id).catch(() => sessao));
      setErro({ texto: textoDoErroDaImportacao(e, qual === 'confirmar' ? 'confirmar' : undefined), tom: recarregar ? 'atencao' : 'perigo', onde, causa: e });
      return false;
    } finally {
      definirAcao(null);
    }
  };

  // Sessão criada cujo primeiro envio falhou: a próxima tentativa a reaproveita, para não abrir outra (conta no limite de sessões).
  const sessaoReservada = useRef<string | null>(null);

  /** A tela passa à sessão quando ela tem algum arquivo, mesmo se outro do lote falhar (os aceitos não se perdem). */
  const comSessaoNova = async (enviar: (id: string) => Promise<void>) => {
    const id = sessao?.id ?? sessaoReservada.current ?? (await criarSessao()).id;
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

  /**
   * Sobe os arquivos um a um (2.1): o que o app já sabe que a API recusaria nem sobe, e um recusado não para os outros.
   * O resultado de cada um fica na lista do envio.
   */
  const subir = async (lista: readonly ArquivoEscolhido[]) => {
    const naSessao = { quantos: sessao?.arquivos.length ?? 0, bytes: (sessao?.arquivos ?? []).reduce((t, a) => t + (a.tamanhoBytes ?? 0), 0) };
    const motivos = motivosAntesDeEnviar(lista, naSessao, importacaoPorImagemHabilitada);
    const resultados: ResultadoDoEnvio[] = lista.map((a, i) => ({ nome: a.nome, motivo: motivos[i] }));
    if (motivos.some((m) => m === null)) {
      await comSessaoNova(async (id) => {
        for (const [i, arquivo] of lista.entries()) {
          if (motivos[i]) continue;
          try {
            await adicionarArquivo(id, await formulario(arquivo));
          } catch (e: unknown) {
            resultados[i] = { nome: arquivo.nome, motivo: textoDoErroDaImportacao(e) };
          }
        }
      });
    }
    setEnvios(resultados);
  };

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
    // Fora da web o envio vai pelos bytes (`anexarArquivoDoAparelho`, via `formulario`), como a importação manual (0.4).
    await subir(res.assets.map((asset) => ({
      nome: asset.name,
      tamanho: asset.size,
      parte: Platform.OS === 'web' && asset.file ? asset.file : { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' },
    })));
  });

  const soltarArquivos = (arquivos: File[]) =>
    void executar('arquivos', 'entrada', () => subir(arquivos.map((f) => ({ parte: f, nome: f.name, tamanho: f.size }))));

  const enviarTextoLivre = (titulo: string, conteudo: string) => executar('texto', 'entrada', async () => {
    await comSessaoNova((id) => adicionarTexto(id, titulo, conteudo).then(() => undefined));
    setEnvios([]);
  }, (e) => {
    const campo = campoDoErroDoTexto(e);
    if (campo) setErroDoTexto({ campo, texto: textoDoErroDaImportacao(e) });
    return !!campo;
  });

  const processar = () => {
    if (!sessao) return;
    void executar('processar', 'proxima', async () => {
      setSessao(await processarSessao(sessao.id));
      setEnvios([]);
    });
  };

  /** Responde um termo: pela edição (`d` é a dúvida ativa) ou direto da linha ("Usar…", "Manter como está"). */
  const responder = (d: DuvidaImportacao, resposta: string, referenciaId: string | null, salvar: boolean, daLinha: boolean) => {
    // Com outra ação em andamento nada roda: o carregando da linha é o da ação que está rodando (2.7).
    if (!sessao || !resposta.trim() || acaoAtual.current) return;
    if (daLinha) setRespondendo(d.id);
    void executar('responder', 'duvidas', async () => {
      setSessao(await responderDuvida(sessao.id, d.id, resposta.trim(), salvar, d.tipo, d.termoOriginal, referenciaId, d.ocorrenciaIds ?? null));
      if (!daLinha) {
        setDuvidaAtiva(null);
        setRespostaEscolhida('');
        setReferenciaEscolhida(null);
      }
    }).finally(() => setRespondendo(null));
  };

  const responderDaLinha = (d: DuvidaImportacao, sugestao: SugestaoDuvida | null) =>
    sugestao
      // Um toque não grava no dicionário (como "Aceitar todas as sugestões"): lembrar é escolha da edição.
      ? responder(d, sugestao.termo, sugestao.referenciaId ?? null, false, true)
      // "Manter como está": fica o nome do documento, sem vínculo, e nada vai ao dicionário.
      : responder(d, d.termoOriginal, null, false, true);

  const aceitarTodas = () => {
    if (!sessao) return;
    void executar('aceitar', 'duvidas', async () => {
      setSessao(await aceitarSugestoes(sessao.id, sessao.revisao));
      setDuvidaAtiva(null);
      setReferenciaEscolhida(null);
    });
  };

  const revogar = (decisao: DecisaoImportacao) => {
    if (!sessao || acaoAtual.current) return;
    setRevogando(decisao.decisaoId);
    void executar('revogar', 'duvidas', async () => {
      setSessao(await revogarDecisao(sessao.id, decisao.decisaoId, sessao.revisao));
    }).finally(() => setRevogando(null));
  };

  const limparEstadoLocalDaSessao = () => {
    setResultado(null);
    setErro(null);
    setErroDoTexto(null);
    setEnvios([]);
    setDuvidaAtiva(null);
    setRespostaEscolhida('');
    setReferenciaEscolhida(null);
    setDescartar(false);
    setConferidos(new Set());
    setSelecionados(null);
    setEsperaLonga(false);
    falhas.current = 0;
    chaveIdempotenciaRef.current = null;
  };

  const retomar = async (id: string) => {
    let falha: unknown = null;
    await executar('retomar', 'entrada', async () => {
      try {
        const s = await obterSessao(id);
        limparEstadoLocalDaSessao();
        setSessao(s);
      } catch (e: unknown) {
        falha = e;
      }
    });
    // O erro fica no cartão das importações em aberto, junto da linha tocada.
    if (falha) throw falha;
  };

  const conferir = (grupoId: string) => setConferidos((atual) => new Set(atual).add(grupoId));

  /** Ação num aluno: o carregando e o erro ficam nele. */
  const noGrupo = (qual: 'destino' | 'cadastro' | 'juntar', grupo: GrupoImportavel, passo: () => Promise<void>) => {
    if (acaoAtual.current) return Promise.resolve(false);
    setGrupoEmAcao(grupo.id);
    return executar(qual, `grupo:${grupo.id}`, passo).finally(() => setGrupoEmAcao(null));
  };

  const alterarDestinoDoGrupo = (grupo: GrupoImportavel, valor: ValorDoDestino | null) => {
    if (!sessao || valor === null) return;
    // "Criar aluno novo" já é o destino: só registra que o treinador respondeu, sem ir à API.
    if (valor === 'NOVO' && grupo.destino === 'CRIAR_ALUNO') return conferir(grupo.id);
    void noGrupo('destino', grupo, async () => {
      setSessao(await atualizarGrupo(sessao.id, grupo.id, pedidoDoDestino(valor)));
      conferir(grupo.id);
    });
  };

  const salvarCadastro = (grupo: GrupoImportavel, mudancas: Partial<CadastroEditavel>) => {
    if (!sessao) return Promise.resolve(false);
    return noGrupo('cadastro', grupo, async () => setSessao(await atualizarGrupo(sessao.id, grupo.id, mudancas)));
  };

  /** "Juntar as N partes": um pedido só; nunca sozinho, só no toque. */
  const juntarPartes = (grupo: GrupoImportavel, outras: string[]) => {
    if (!sessao || acaoAtual.current) return;
    setJuntando(grupo.id);
    void noGrupo('juntar', grupo, async () => setSessao(await juntarGrupos(sessao.id, grupo.id, outras))).finally(() => setJuntando(null));
  };

  const juntar = (grupo: GrupoImportavel, comGrupoId: string) => {
    if (!sessao || acaoAtual.current) return;
    setJuntando(comGrupoId);
    void noGrupo('juntar', grupo, async () => setSessao(await juntarGrupos(sessao.id, grupo.id, comGrupoId))).finally(() => setJuntando(null));
  };

  const chaveParaTentativa = (ids: string[]): string => {
    if (!sessao) return gerarChaveIdempotencia();
    const assinatura = `${sessao.id}:${sessao.revisao}:${[...ids].sort().join(',')}:${sessao.hashPrevia ?? ''}`;
    if (chaveIdempotenciaRef.current?.assinatura === assinatura) return chaveIdempotenciaRef.current.chave;
    const chave = gerarChaveIdempotencia();
    chaveIdempotenciaRef.current = { assinatura, chave };
    return chave;
  };

  /**
   * Grava os alunos dados e busca a sessão de novo: com erro ela volta à revisão, com os gravados já resumidos. Se a
   * busca falhar, a sessão que a tela tem fica (2.7): nada some, e o resultado aparece junto dos botões.
   */
  const gravar = (ids: string[], quais: 'pendentes' | 'erros') => {
    if (!sessao || ids.length === 0 || !sessao.hashPrevia || acaoAtual.current) return;
    setGravando(quais);
    const chave = chaveParaTentativa(ids);
    const hashPrevia = sessao.hashPrevia;
    void executar('confirmar', 'proxima', async () => {
      setResultado(await confirmarSessao(sessao.id, ids, sessao.revisao, hashPrevia, chave));
      const atual = await obterSessao(sessao.id).catch(() => null);
      if (atual) setSessao(atual.estado !== 'CONCLUIDA' ? atual : null);
      setRecarregarAbertas((n) => n + 1);
    });
  };

  const resetar = () => {
    setSessao(null);
    limparEstadoLocalDaSessao();
    sessaoReservada.current = null;
    setRecarregarAbertas((n) => n + 1);
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

  if (resultado && !sessao) {
    const resumo = resumoDoResultado(resultado);
    return (
      <Cartao titulo={resumo.titulo} descricao={resumo.descricao ?? undefined}>
        <ResultadoDaGravacao resultado={resultado} titulo={false} />
        <LinhaDeAcoes>
          <Botao rotulo="Fazer outra importação" tipo="primario" aoTocar={resetar} Icone={FileUp} />
        </LinhaDeAcoes>
      </Cartao>
    );
  }

  const grupos = sessao?.grupos ?? [];
  const selecionaveis = gruposSelecionaveis(grupos);
  const idsSelecionaveis = new Set(selecionaveis.map((g) => g.id));
  const prontosIds = sessao ? idsSelecionaveisProntos(grupos, pode, conferidos) : [];
  const marcados = new Set([...(selecionados ?? prontosIds)].filter((id) => idsSelecionaveis.has(id)));
  const gravaveisSelecionados = [...marcados];
  const partes = sessao ? partesParaJuntar(sessao) : new Map<string, string[]>();
  const travados = textoDosTravados(grupos);
  const comErro = idsComErro(grupos);
  const temPendentes = selecionaveis.length > 0;
  const motivoConfirmar = sessao ? motivoParaNaoConfirmar(grupos, pode, conferidos, marcados, sessao.hashPrevia) : null;
  const fraseDaGravacao = motivoConfirmar ? null : resumoDaGravacao(grupos, marcados);
  // O modo só depois de ler: antes, "Lido sem IA" seria uma afirmação sobre o que ainda não aconteceu.
  const modo = sessao && (sessao.estado === 'REVISANDO' || sessao.estado === 'CONCLUIDA') ? resumoDoModoProcessamento(sessao.modoProcessamento) : null;
  const decisoesAtivasPorDuvida = new Map<string, DecisaoImportacao>();
  for (const dec of sessao?.decisoes ?? []) {
    if (dec.ativa) decisoesAtivasPorDuvida.set(dec.duvidaId, dec);
  }

  const alternarSelecao = (grupoId: string, marcado: boolean) => {
    const proximo = new Set(marcados);
    if (marcado) proximo.add(grupoId);
    else proximo.delete(grupoId);
    setSelecionados(proximo);
  };

  // Tela larga (25/11): da faixa larga em diante, o resumo e a próxima etapa vão para a coluna ao lado, grudada ao rolar.
  // Um botão da próxima etapa por vez, num lugar só: na lateral nessa faixa, nos cartões abaixo dela.
  const comLateral = faixa === 'larga' || faixa === 'ultralarga';
  // Na coluna das etapas o botão da próxima etapa é a ação de apoio (cor de ação); nos cartões, o principal.
  const tipoDaProxima = comLateral ? 'acao' : 'primario';
  const duvidas = duvidasVisiveis(sessao?.duvidas);
  const sugestoesUnicas = duvidasComSugestaoUnica(duvidas).length;
  const lendo = acao === 'processar' || sessao?.estado === 'PROCESSANDO';
  const podeLer = !!sessao && sessaoPodeLer(sessao.estado, sessao.arquivos);
  const botaoLer = podeLer && sessao ? (
    <View style={estilos.lista}>
      {sessao.estado === 'ERRO' ? <Alerta tom="atencao" texto={AVISO_LEITURA_NAO_TERMINOU} /> : null}
      <LinhaDeAcoes>
        <Botao ref={refLer} rotulo={rotuloDoLer(sessao.estado)} tipo={tipoDaProxima} Icone={sessao.estado === 'ERRO' ? RotateCcw : FileSearch}
          carregando={acao === 'processar'} desabilitado={!!acao && acao !== 'processar'} motivo="Aguarde a ação em andamento terminar." aoTocar={processar} />
      </LinhaDeAcoes>
    </View>
  ) : null;
  // Resultado junto dos botões: quem tocou em gravar o vê sem rolar a página.
  const blocoDoResultado = resultado ? <ResultadoDaGravacao resultado={resultado} /> : null;
  const botoesDeGravar = sessao && (temPendentes || comErro.length > 0) ? (
    <View style={estilos.lista}>
      {temPendentes && fraseDaGravacao ? <Texto variante="suave">{fraseDaGravacao}</Texto> : null}
      {temPendentes && travados ? <Texto variante="suave">{travados}</Texto> : null}
      <LinhaDeAcoes>
        {temPendentes ? (
          <Botao
            rotulo={gravaveisSelecionados.length > 0 ? `Gravar selecionados (${gravaveisSelecionados.length})` : 'Gravar selecionados'}
            tipo={tipoDaProxima}
            Icone={CheckCircle2}
            carregando={acao === 'confirmar' && gravando === 'pendentes'}
            desabilitado={!!motivoConfirmar || (!!acao && !(acao === 'confirmar' && gravando === 'pendentes'))}
            motivo={motivoConfirmar ?? 'Aguarde a ação em andamento terminar.'}
            aoTocar={() => gravar(gravaveisSelecionados, 'pendentes')}
          />
        ) : null}
        {comErro.length > 0 ? (
          <Botao
            rotulo="Tentar de novo os que deram erro"
            tipo={temPendentes ? 'secundario' : tipoDaProxima}
            Icone={RotateCcw}
            carregando={acao === 'confirmar' && gravando === 'erros'}
            desabilitado={!sessao.hashPrevia || (!!acao && !(acao === 'confirmar' && gravando === 'erros'))}
            motivo={!sessao.hashPrevia ? 'Atualize a sessão antes de tentar de novo.' : 'Aguarde a ação em andamento terminar.'}
            aoTocar={() => gravar(comErro, 'erros')}
          />
        ) : null}
      </LinhaDeAcoes>
    </View>
  ) : null;
  const doGravar = sessao && sessao.grupos.length > 0 ? <>{blocoDoResultado}{erroEm('proxima')}{botoesDeGravar}</> : null;
  // Etapas (26/11): a atual sai da máquina de estados da sessão; as contagens, do que a tela já tem.
  const etapaAtual = etapaDaImportacao(sessao, !temPendentes || !motivoConfirmar);
  const contagens = sessao ? contagensDasEtapas(sessao, pode, { marcados: marcados.size, possiveis: idsSelecionaveis.size }) : null;

  const envio = (
    <EnvioDeArquivos
      aoEscolher={() => void escolherArquivos()}
      aoSoltar={soltarArquivos}
      aoEnviarTexto={enviarTextoLivre}
      enviando={acao === 'arquivos' || acao === 'texto' ? acao : null}
      ocupado={acao !== null}
      erroDoTexto={erroDoTexto}
      resultados={envios}
      erro={erroEm('entrada')}
      comImagem={importacaoPorImagemHabilitada}
    />
  );

  const blocos = (
    <>
      {comLateral ? null : <LinhaDasEtapas atual={etapaAtual} />}
      {!sessao ? (
        <>
          <Cartao
            titulo="Enviar arquivos ou texto"
            descricao="PDFs de treino, DOCX de dieta, planilhas e mensagens num lote só. Você confere os termos e escolhe o que gravar antes de confirmar."
          >
            {envio}
          </Cartao>
          <ImportacoesAssistidasEmAberto aoRetomar={retomar} recarregar={recarregarAbertas} />
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
            {modo?.alertaFallback ? <Alerta tom="atencao" texto={modo.alertaFallback} /> : null}
            {modo && lidoSemIa(sessao.modoProcessamento) ? (
              <View style={estilos.lista}>
                <Texto variante="suave">{DICA_DE_TREINO_DESMONTADO}</Texto>
                {pode('MODELO_LER') && pode('MODELO_ALTERAR') ? <LinkTexto href={COLAR_TREINO} texto="Colar treino de PDF / Docs" /> : null}
              </View>
            ) : null}
            <ArquivosDaImportacao arquivos={sessao.arquivos} />
            {/* 2.1: dá para acrescentar arquivos e texto enquanto a sessão está aberta e não está lendo. */}
            {sessaoAceitaArquivos(sessao.estado) && !lendo ? envio : erroEm('entrada')}
            {!comLateral && podeLer ? <>{erroEm('proxima')}{botaoLer}</> : null}
          </Cartao>

          {lendo ? (
            <Cartao titulo={sessao.leitura?.aguardando ? 'Leitura dos arquivos' : 'Lendo os arquivos…'} descricao={textoDaLeitura(sessao.leitura) ?? 'Acompanhando a leitura.'}>
              <Texto>{PODE_SAIR_DURANTE_A_LEITURA}</Texto>
              {esperaLonga ? (
                <View style={estilos.lista}>
                  <Alerta tom="atencao" texto={AVISO_DA_ESPERA_LONGA} />
                  <LinhaDeAcoes>
                    <Botao rotulo="Continuar esperando" tipo="secundario" aoTocar={continuarEsperando} />
                    <Botao rotulo="Cancelar importação" tipo="perigoTexto" aoTocar={() => setDescartar(true)} />
                  </LinhaDeAcoes>
                </View>
              ) : <Esqueleto />}
            </Cartao>
          ) : null}

          {duvidas.length > 0 ? (
            <Cartao
              titulo="Termos para conferir"
              descricao={`Abreviações e nomes de exercícios ou alimentos que não foram reconhecidos com certeza. ${AVISO_TERMO_NAO_CONFERIDO}`}
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
                salvando={acao === 'responder' && !respondendo}
                respondendo={respondendo}
                revogando={revogando}
                buscaNaBiblioteca={pode('BIBLIOTECA_LER')}
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
                aoSalvar={() => { if (duvidaAtiva) responder(duvidaAtiva, respostaEscolhida, referenciaEscolhida, salvarDicionario, false); }}
                aoCancelar={() => {
                  setDuvidaAtiva(null);
                  setReferenciaEscolhida(null);
                }}
                aoResponder={responderDaLinha}
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
                    ? 'O arquivo enviado não tem texto selecionável (como um PDF escaneado). Envie um arquivo com texto selecionável ou cole o texto.'
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

          {sessao.grupos.length > 0 ? (
            <Cartao titulo="Alunos encontrados" descricao="Confira cada aluno, escolha o destino e selecione quais gravar.">
              {temPendentes ? (
                <LinhaDeAcoes>
                  <Botao
                    rotulo={`Selecionar prontos (${prontosIds.length})`}
                    tipo="secundario"
                    desabilitado={prontosIds.length === 0}
                    motivo="Nenhum aluno pronto."
                    aoTocar={() => setSelecionados(new Set(prontosIds))}
                  />
                  <Botao
                    rotulo="Limpar seleção"
                    tipo="fantasma"
                    desabilitado={marcados.size === 0}
                    motivo="Nenhum aluno selecionado."
                    aoTocar={() => setSelecionados(new Set())}
                  />
                </LinhaDeAcoes>
              ) : null}

              {sessao.grupos.map((g, i) => (grupoResumido(g) ? <LinhaResumida key={g.id} grupo={g} /> : (
                <AlunoParaConferir
                  key={g.id}
                  grupo={g}
                  numero={i + 1}
                  pode={pode}
                  conferidos={conferidos}
                  selecionado={marcados.has(g.id)}
                  aoSelecionar={idsSelecionaveis.has(g.id) ? (m) => alternarSelecao(g.id, m) : undefined}
                  aoMudarDestino={(v) => alterarDestinoDoGrupo(g, v)}
                  aoSalvarCadastro={(m) => salvarCadastro(g, m)}
                  aoJuntar={(com) => juntar(g, com)}
                  partes={partes.get(g.id)}
                  aoJuntarPartes={() => juntarPartes(g, partes.get(g.id) ?? [])}
                  juntandoPartes={grupoEmAcao === g.id && juntando === g.id}
                  ocupado={acao !== null}
                  salvando={acao === 'cadastro' && grupoEmAcao === g.id}
                  juntando={grupoEmAcao === g.id ? juntando : null}
                  erro={erroEm(`grupo:${g.id}`)}
                  refDoDestino={focoInicial?.tipo === 'aluno' && focoInicial.grupoId === g.id ? refAluno : undefined}
                />
              )))}

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
    </View>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 8 px dentro de um grupo de texto e ações.
  blocos: { gap: espaco(3) },
  lista: { gap: espaco(1) },
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_LATERAL },
  principal: { flex: 1, minWidth: 0 },
});
