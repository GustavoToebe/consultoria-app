import { iniciarDescanso as novoDescanso, ajustarDescanso as ajustar, terminado, type Descanso } from '../dominio/descanso';
import { vibrar } from '../ui/vibrar';
import { iniciarLembretesAtualizacao, reagendarLembretesAtualizacao } from '../aluno/atualizacao/lembretes';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ErroApi } from '../api/cliente';
import {
  enviarRegistros,
  enviarRegistrosMobilidade,
  historicoAluno,
  demonstracoesDoAluno,
  mobilidadeAluno,
  painelAluno,
  planosDaPastaAluno,
  registrosMobilidadeDoAluno,
} from '../api/rotas';
import type { Atualizacao, ConteudoMobilidadeApi, DemonstracaoDoAluno, PastaDoAluno, PlanosDaPasta, RegistroMobilidadeFeito, VersaoDetalhe } from '../api/tipos';
import { hojeIso, somarDias } from '../dominio/formatos';
import { periodoDaSemana } from '../dominio/progressoSemana';
import { fundirMarcas, type MarcaDeMobilidade } from '../dominio/mobilidadeFeita';
import { novoUid } from '../dominio/uid';
import { useSessao } from '../sessao/SessaoProvider';
import { abrirRepositorio } from './abrirRepositorio';
import { fundirComServidor, registrosDoServidor, trocarPeriodo } from './execucoesDoServidor';
import { limparDadosDoAluno } from './limparDadosDoAluno';
import type { DadosMobilidade, DadosRegistro, PacoteSalvo, RegistroLocal, RegistroMobilidadeLocal, RepositorioLocal } from './repositorioLocal';
import { ESPERAS_MS, Sincronizador } from './sincronizacao';

/** Plano que o aluno escolheu só para consultar (não é o vigente). */
export interface PlanoEscolhido {
  pasta: PastaDoAluno;
  planos: PlanosDaPasta;
}

export type EstadoEnvio = 'ocioso' | 'enviando' | 'semConexao' | 'erro';

interface ValorAluno {
  atualizacao: Atualizacao | null;
  atualizarAtualizacao: (atualizacao: Atualizacao) => Promise<void>;
  descanso: Descanso | null;
  iniciarDescanso: (segundos: number) => void;
  ajustarDescanso: (segundos: number) => void;
  pularDescanso: () => void;
  repositorio: RepositorioLocal;
  /** Plano de outra pasta aberto para consulta (treino e dieta juntos); nulo = o plano vigente do pacote. */
  escolhida: PlanoEscolhido | null;
  /** Escolher a pasta vigente volta ao pacote salvo; outra pasta precisa de conexão. */
  escolherPasta: (pasta: PastaDoAluno) => Promise<void>;
  /** Pacote salvo no aparelho (plano publicado, marca, últimas cargas). */
  pacote: PacoteSalvo | null;
  /** Mobilidade publicada vigente (última vista neste aparelho); nulo = o aluno não tem e a aba não aparece. */
  mobilidade: VersaoDetalhe<ConteudoMobilidadeApi> | null;
  /** Demonstração (fotos do catálogo e se há imagem própria) dos exercícios dos planos; a última vista neste aparelho. */
  demonstracoes: DemonstracaoDoAluno[];
  /** Ainda lendo o aparelho na abertura. */
  carregando: boolean;
  /** Não deu para baixar o pacote e não há nada salvo. */
  erroPacote: unknown;
  /**
   * Registros do aparelho mais as séries que já estão no servidor e o aparelho não tem (outro aparelho, ou antes de
   * sair e entrar de novo), estas com situação `ENVIADO`. Na mesma série e dia, o do aparelho ganha.
   */
  registros: RegistroLocal[];
  /** A semana de `data` ainda não veio do servidor nesta abertura: busca (sem conexão, a semana atual sai do aparelho). */
  carregarSemanaDoServidor: (data: string) => Promise<void>;
  /** A semana atual não veio do servidor: a tela mostra o que ficou salvo no aparelho. */
  semanaDoAparelho: boolean;
  /** Por `planoVersaoId|serieUid|data`. */
  registroDe: (planoVersaoId: string, serieUid: string, data: string) => RegistroLocal | undefined;
  cargasDeTrabalho: Record<string, number>;
  /** Marcas de mobilidade: as do aparelho mais as que o servidor já tem (a do aparelho ganha). Só leitura. */
  marcasDeMobilidade: MarcaDeMobilidade[];
  /** O que a mobilidade tem no aparelho (inclui o que ainda não foi enviado). */
  mobilidadeNoAparelho: RegistroMobilidadeLocal[];
  /** Grava na hora e entra na mesma fila de envio das séries. Desmarcar é marcar com `feito: false`. */
  marcarMobilidade: (dados: DadosMobilidade) => Promise<void>;
  /** Séries e itens de mobilidade ainda na fila (LOCAL). */
  pendentes: number;
  /** Séries recusadas (a mobilidade recusada está em `falhasDeMobilidade`). */
  falhas: RegistroLocal[];
  falhasDeMobilidade: RegistroMobilidadeLocal[];
  envio: EstadoEnvio;
  mensagemEnvio: string | null;
  online: boolean;
  registrar: (dados: DadosRegistro) => Promise<void>;
  salvarCargaDeTrabalho: (exercicioUid: string, data: string, carga: number | null) => Promise<void>;
  sincronizarAgora: () => Promise<void>;
  tentarDeNovo: () => Promise<void>;
}

const Contexto = createContext<ValorAluno | null>(null);

/** Desde quando buscar as séries do servidor ao abrir: o início do plano, no máximo os 60 dias que o registro aceita. */
function desdeDoPlano(inicio: string | null): string {
  const limite = somarDias(hojeIso(), -60);
  return inicio && inicio > limite ? inicio : limite;
}
const ESPERA_APOS_GRAVAR_MS = 2_000;
const INTERVALO_COM_PENDENCIA_MS = 60_000;

/**
 * Área do aluno sem depender de internet: o plano vem do pacote salvo; cada série marcada grava no
 * aparelho na hora e vai para o servidor depois. Envia 2 s depois de gravar, quando a rede volta, quando o app volta
 * para a frente, a cada 60 s se houver pendência e no "Sincronizar agora". Falha de rede espera 5 s, 15 s, 60 s, 5 min.
 */
export function AlunoProvider({ usuarioId, children }: { usuarioId: string; children: ReactNode }) {
  const sessao = useSessao();
  const { atualizarMarca, offline: sessaoOffline } = sessao;
  const repositorio = useMemo(() => abrirRepositorio(usuarioId, novoUid), [usuarioId]);
  const [atualizacao,setAtualizacao]=useState<Atualizacao|null>(null);
  useEffect(()=>{iniciarLembretesAtualizacao(usuarioId);},[usuarioId]);
  const atualizarAtualizacao=useCallback(async (atual:Atualizacao)=>{
    await repositorio.salvarAtualizacao(atual);
    setAtualizacao(atual);
    await reagendarLembretesAtualizacao(usuarioId,atual).catch(()=>undefined);
  },[repositorio,usuarioId]);
  const sincronizador = useMemo(() => new Sincronizador(repositorio, enviarRegistros, enviarRegistrosMobilidade), [repositorio]);

  const [descanso, definirDescanso] = useState<Descanso | null>(null);
  const notificado = useRef<number | null>(null);
  const iniciarDescanso = useCallback((segundos: number) => definirDescanso(novoDescanso(segundos, Date.now())), []);
  const ajustarDescanso = useCallback((segundos: number) => definirDescanso(atual => atual ? ajustar(atual, segundos, Date.now()) : null), []);
  const pularDescanso = useCallback(() => definirDescanso(null), []);
  useEffect(() => {
    if (!descanso) return;
    const verificar = () => {
      if (terminado(descanso, Date.now()) && AppState.currentState === 'active' && notificado.current !== descanso.terminaEm) {
        notificado.current = descanso.terminaEm;
        vibrar.sucesso();
      }
    };
    const intervalo = setInterval(verificar, 250);
    const app = AppState.addEventListener('change', verificar);
    return () => { clearInterval(intervalo); app.remove(); };
  }, [descanso]);

  const [pacote, setPacote] = useState<PacoteSalvo | null>(null);
  const [mobilidade, setMobilidade] = useState<VersaoDetalhe<ConteudoMobilidadeApi> | null>(null);
  const [demonstracoes, setDemonstracoes] = useState<DemonstracaoDoAluno[]>([]);
  const [escolhida, setEscolhida] = useState<PlanoEscolhido | null>(null);
  const escolherPasta = useCallback(async (pasta: PastaDoAluno) => {
    setEscolhida(pasta.atual ? null : { pasta, planos: await planosDaPastaAluno(pasta.id) });
  }, []);
  const [carregando, setCarregando] = useState(true);
  const [erroPacote, setErroPacote] = useState<unknown>(null);
  const [registros, setRegistros] = useState<RegistroLocal[]>([]);
  const [mobilidadeLocal, setMobilidadeLocal] = useState<RegistroMobilidadeLocal[]>([]);
  const [marcasDoServidor, setMarcasDoServidor] = useState<RegistroMobilidadeFeito[]>([]);
  const [doServidor, setDoServidor] = useState<RegistroLocal[]>([]);
  const [semanaDoAparelho, setSemanaDoAparelho] = useState(false);
  const semanasPedidas = useRef(new Set<string>());
  const [cargas, setCargas] = useState<Record<string, number>>({});
  const [envio, setEnvio] = useState<EstadoEnvio>('ocioso');
  const [mensagemEnvio, setMensagemEnvio] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const falhasSeguidas = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregarRegistros = useCallback(
    () => Promise.all([repositorio.listar().then(setRegistros), repositorio.listarMobilidade().then(setMobilidadeLocal)]).then(() => undefined),
    [repositorio],
  );

  // Mobilidade vigente: 404 = o aluno não tem (some do aparelho); sem conexão ou erro = segue com a última salva.
  const baixarMobilidade = useCallback(async () => {
    try {
      const { mobilidade: nova } = await mobilidadeAluno();
      await repositorio.salvarMobilidade(nova);
      setMobilidade(nova);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 404) {
        await repositorio.salvarMobilidade(null);
        setMobilidade(null);
      }
    }
  }, [repositorio]);

  // Demonstrações dos exercícios do plano: sem conexão ou erro, segue com a última lista salva (a imagem própria some,
  // as fotos do catálogo ficam no cache de disco do aparelho); com resposta, a lista nova substitui a antiga.
  const baixarDemonstracoes = useCallback(async () => {
    try {
      const nova = await demonstracoesDoAluno();
      await repositorio.salvarDemonstracoes(nova);
      setDemonstracoes(nova);
    } catch {
      // Mantém a última lista.
    }
  }, [repositorio]);

  // Itens de mobilidade que o servidor já tem (60 dias para trás e para frente, a janela que ele aceita): só leitura.
  // Sem conexão ou erro, a tela segue com o que está no aparelho.
  const baixarMarcasDeMobilidade = useCallback(async () => {
    try {
      const hoje = hojeIso();
      setMarcasDoServidor(await registrosMobilidadeDoAluno(somarDias(hoje, -60), somarDias(hoje, 60)));
    } catch {
      // Fica como está.
    }
  }, []);

  // Séries já no servidor, por semana (segunda a domingo). Só leitura: nada disso entra na fila nem no repositório, a não
  // ser a semana atual guardada para abrir sem internet (a mesma cópia que o "Sua semana" já usava). `desde` alarga a
  // busca para trás numa chamada só (o período do plano, para as datas das divisões).
  const carregarSemanaDoServidor = useCallback(async (data: string, forcar = false, desde?: string) => {
    const { inicio: inicioDaData, fim } = periodoDaSemana(data);
    const inicio = desde && desde < inicioDaData ? periodoDaSemana(desde).inicio : inicioDaData;
    const semanaAtual = periodoDaSemana(hojeIso());
    const semanas: string[] = [];
    for (let s = inicio; s <= fim; s = somarDias(s, 7)) semanas.push(s);
    if (!forcar && semanas.every((s) => semanasPedidas.current.has(s))) return;
    for (const s of semanas) semanasPedidas.current.add(s);
    const temAtual = semanas.includes(semanaAtual.inicio);
    try {
      const dias = await historicoAluno(inicio, fim);
      setDoServidor((antes) => trocarPeriodo(antes, inicio, fim, registrosDoServidor(dias)));
      if (temAtual) {
        setSemanaDoAparelho(false);
        const daSemana = dias.filter((d) => d.data >= semanaAtual.inicio && d.data <= semanaAtual.fim);
        await repositorio.salvarHistoricoSemana({ inicio: semanaAtual.inicio, dias: daSemana }).catch(() => undefined);
      }
    } catch {
      // Sem conexão ou erro: tenta de novo na próxima vez que alguém pedir; a semana atual sai da cópia do aparelho.
      for (const s of semanas) semanasPedidas.current.delete(s);
      if (!temAtual) return;
      setSemanaDoAparelho(true);
      const salvo = await repositorio.lerHistoricoSemana().catch(() => null);
      if (salvo?.inicio === semanaAtual.inicio) {
        setDoServidor((antes) => trocarPeriodo(antes, semanaAtual.inicio, semanaAtual.fim, registrosDoServidor(salvo.dias)));
      }
    }
  }, [repositorio]);

  const baixarPacote = useCallback(async () => {
    try {
      const novo = await painelAluno();
      await repositorio.salvarPacote(novo);
      if(novo.atualizacao)await atualizarAtualizacao(novo.atualizacao);
      setPacote(await repositorio.lerPacote());
      setErroPacote(null);
      atualizarMarca(novo.marca);
      await baixarMobilidade();
      await baixarDemonstracoes();
      await baixarMarcasDeMobilidade();
      await carregarSemanaDoServidor(hojeIso(), true, desdeDoPlano(novo.treino?.inicio ?? null));
    } catch (erro) {
      // Sem conexão: segue com o pacote salvo. Sem pacote salvo, a tela explica.
      if (!(erro instanceof ErroApi && erro.semConexao)) setErroPacote(erro);
      else setErroPacote((atual: unknown) => atual ?? erro);
      await carregarSemanaDoServidor(hojeIso(), true);
    }
  }, [repositorio, atualizarMarca, atualizarAtualizacao, baixarMobilidade, baixarDemonstracoes, baixarMarcasDeMobilidade, carregarSemanaDoServidor]);

  const sincronizar = useCallback(async () => {
    if (espera.current) {
      clearTimeout(espera.current);
      espera.current = null;
    }
    setEnvio('enviando');
    const r = await sincronizador.sincronizar();
    await recarregarRegistros();
    if (r.tipo === 'ok' || r.tipo === 'emAndamento') {
      falhasSeguidas.current = 0;
      setEnvio('ocioso');
      setMensagemEnvio(null);
      // Depois de enviar, atualiza o plano (o treinador pode ter publicado versão nova).
      if (r.tipo === 'ok' && r.enviados > 0) void baixarPacote();
    } else if (r.tipo === 'semConexao') {
      setEnvio('semConexao');
      const [series, mobilidade] = await Promise.all([repositorio.pendentes(1), repositorio.pendentesMobilidade(1)]);
      if (series.length || mobilidade.length) {
        const ms = ESPERAS_MS[Math.min(falhasSeguidas.current, ESPERAS_MS.length - 1)];
        falhasSeguidas.current++;
        espera.current = setTimeout(() => void sincronizar(), ms);
      }
    } else {
      setEnvio('erro');
      setMensagemEnvio(r.mensagem);
    }
  }, [sincronizador, repositorio, recarregarRegistros, baixarPacote]);

  // Abertura: confere a fila que uma sessão recusada deixou (vencida = apagada; dentro do prazo = volta a ser a fila
  // normal deste usuário), lê o aparelho e depois tenta baixar o pacote e enviar o que ficou.
  useEffect(() => {
    let vivo = true;
    repositorio.descartarFilaRetidaVencida().then(() => repositorio.retomarFilaRetida()).catch(() => undefined).then(() => Promise.all([repositorio.lerPacote(), repositorio.listar(), repositorio.lerCargasDeTrabalho(),repositorio.lerAtualizacao(),repositorio.lerMobilidade(),repositorio.listarMobilidade(),repositorio.lerDemonstracoes()])).then(
      ([p, r, c, a, m, ml, dem]) => {
        if (!vivo) return;
        setPacote(p);
        setMobilidade(m);
        setDemonstracoes(dem);
        setRegistros(r);
        setMobilidadeLocal(ml);
        setCargas(c);
        const atual=a??p?.pacote.atualizacao??null;
        setAtualizacao(atual);
        void reagendarLembretesAtualizacao(usuarioId,atual).catch(()=>undefined);
        void baixarPacote().finally(() => vivo && setCarregando(false));
        void sincronizar();
      },
      () => vivo && setCarregando(false),
    );
    return () => {
      vivo = false;
    };
  }, [repositorio, baixarPacote, sincronizar,usuarioId]);

  // Rede voltou, app voltou para a frente, sessão renovada depois de abrir sem internet.
  useEffect(() => {
    let anterior: boolean | null = null;
    const cancelarRede = NetInfo.addEventListener((estado) => {
      const conectado = estado.isConnected !== false;
      setOnline(conectado);
      if (conectado && anterior === false) {
        falhasSeguidas.current = 0;
        void sincronizar();
      }
      anterior = conectado;
    });
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void sincronizar();
    });
    return () => {
      cancelarRede();
      app.remove();
    };
  }, [sincronizar]);

  useEffect(() => {
    if (!sessaoOffline) {
      const relogio = setTimeout(() => void sincronizar(), 0);
      return () => clearTimeout(relogio);
    }
  }, [sessaoOffline, sincronizar]);

  const pendentes = registros.filter((r) => r.situacao === 'LOCAL').length + mobilidadeLocal.filter((r) => r.situacao === 'LOCAL').length;

  useEffect(() => {
    if (!pendentes) return;
    const relogio = setInterval(() => void sincronizar(), INTERVALO_COM_PENDENCIA_MS);
    return () => clearInterval(relogio);
  }, [pendentes, sincronizar]);

  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  // Ao sair da conta, os dados deste aluno saem do aparelho (o painel de sair avisa se havia pendência). Quando é o
  // servidor que recusa a sessão, sai tudo o que é dado sensível (plano, dieta, mobilidade, rascunhos, fotos locais...)
  // e fica só a fila de registros ainda não enviados, para o mesmo aluno enviar ao entrar de novo (`DIAS_FILA_RETIDA`).
  useEffect(
    () =>
      sessao.aoSair((id, motivo) => limparDadosDoAluno(id, motivo, id === repositorio.usuarioId ? repositorio : undefined)),
    [sessao, repositorio],
  );

  // Trocou de usuário ou saiu da área do aluno: fecha a conexão do banco (reabre sozinho se voltar a ser usado).
  useEffect(() => () => void repositorio.fechar(), [repositorio]);

  const envioAgendado = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registrar = useCallback(
    async (dados: DadosRegistro) => {
      await repositorio.registrar(dados);
      await recarregarRegistros();
      if (envioAgendado.current) clearTimeout(envioAgendado.current);
      envioAgendado.current = setTimeout(() => void sincronizar(), ESPERA_APOS_GRAVAR_MS);
    },
    [repositorio, recarregarRegistros, sincronizar],
  );

  const marcarMobilidade = useCallback(
    async (dados: DadosMobilidade) => {
      await repositorio.registrarMobilidade(dados);
      await recarregarRegistros();
      if (envioAgendado.current) clearTimeout(envioAgendado.current);
      envioAgendado.current = setTimeout(() => void sincronizar(), ESPERA_APOS_GRAVAR_MS);
    },
    [repositorio, recarregarRegistros, sincronizar],
  );

  const salvarCargaDeTrabalho = useCallback(
    async (exercicioUid: string, data: string, carga: number | null) => {
      setCargas(await repositorio.salvarCargaDeTrabalho(exercicioUid, data, carga));
    },
    [repositorio],
  );

  const tentarDeNovo = useCallback(async () => {
    await repositorio.reenviarFalhas();
    await sincronizar();
  }, [repositorio, sincronizar]);

  const valor = useMemo<ValorAluno>(() => {
    const todos = fundirComServidor(registros, doServidor);
    const indice = new Map(todos.map((r) => [`${r.planoVersaoId}|${r.serieUid}|${r.data}`, r]));
    return {
      atualizacao,atualizarAtualizacao,
      descanso, iniciarDescanso, ajustarDescanso, pularDescanso,
      repositorio,
      escolhida,
      escolherPasta,
      pacote,
      mobilidade,
      demonstracoes,
      carregando,
      erroPacote,
      registros: todos,
      carregarSemanaDoServidor,
      semanaDoAparelho,
      registroDe: (v, s, d) => indice.get(`${v}|${s}|${d}`),
      cargasDeTrabalho: cargas,
      marcasDeMobilidade: fundirMarcas(mobilidadeLocal, marcasDoServidor),
      mobilidadeNoAparelho: mobilidadeLocal,
      marcarMobilidade,
      pendentes,
      falhas: registros.filter((r) => r.situacao === 'FALHOU'),
      falhasDeMobilidade: mobilidadeLocal.filter((r) => r.situacao === 'FALHOU'),
      envio,
      mensagemEnvio,
      online,
      registrar,
      salvarCargaDeTrabalho,
      sincronizarAgora: sincronizar,
      tentarDeNovo,
    };
  }, [atualizacao,atualizarAtualizacao,descanso, iniciarDescanso, ajustarDescanso, pularDescanso, repositorio, escolhida, escolherPasta, pacote, mobilidade, demonstracoes, carregando, erroPacote, registros, doServidor, mobilidadeLocal, marcasDoServidor, marcarMobilidade, carregarSemanaDoServidor, semanaDoAparelho, cargas, pendentes, envio, mensagemEnvio, online, registrar, salvarCargaDeTrabalho, sincronizar, tentarDeNovo]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAluno(): ValorAluno {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useAluno fora do AlunoProvider');
  return valor;
}
