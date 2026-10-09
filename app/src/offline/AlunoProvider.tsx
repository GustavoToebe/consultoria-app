import { iniciarDescanso as novoDescanso, ajustarDescanso as ajustar, terminado, type Descanso } from '../dominio/descanso';
import { vibrar } from '../ui/vibrar';
import { cancelarLembretesAtualizacao, iniciarLembretesAtualizacao, reagendarLembretesAtualizacao } from '../aluno/atualizacao/lembretes';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ErroApi } from '../api/cliente';
import { enviarRegistros, painelAluno, planosDaPastaAluno } from '../api/rotas';
import type { Atualizacao, PastaDoAluno, PlanosDaPasta } from '../api/tipos';
import { novoUid } from '../dominio/uid';
import { useSessao } from '../sessao/SessaoProvider';
import { abrirRepositorio } from './abrirRepositorio';
import type { DadosRegistro, PacoteSalvo, RegistroLocal, RepositorioLocal } from './repositorioLocal';
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
  /** Ainda lendo o aparelho na abertura. */
  carregando: boolean;
  /** Não deu para baixar o pacote e não há nada salvo. */
  erroPacote: unknown;
  registros: RegistroLocal[];
  /** Por `planoVersaoId|serieUid|data`. */
  registroDe: (planoVersaoId: string, serieUid: string, data: string) => RegistroLocal | undefined;
  cargasDeTrabalho: Record<string, number>;
  pendentes: number;
  falhas: RegistroLocal[];
  envio: EstadoEnvio;
  mensagemEnvio: string | null;
  online: boolean;
  registrar: (dados: DadosRegistro) => Promise<void>;
  salvarCargaDeTrabalho: (exercicioUid: string, data: string, carga: number | null) => Promise<void>;
  sincronizarAgora: () => Promise<void>;
  tentarDeNovo: () => Promise<void>;
}

const Contexto = createContext<ValorAluno | null>(null);
const ESPERA_APOS_GRAVAR_MS = 2_000;
const INTERVALO_COM_PENDENCIA_MS = 60_000;

/**
 * Área do aluno sem depender de internet (seção 11): o plano vem do pacote salvo; cada série marcada grava no
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
  const sincronizador = useMemo(() => new Sincronizador(repositorio, enviarRegistros), [repositorio]);

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
  const [escolhida, setEscolhida] = useState<PlanoEscolhido | null>(null);
  const escolherPasta = useCallback(async (pasta: PastaDoAluno) => {
    setEscolhida(pasta.atual ? null : { pasta, planos: await planosDaPastaAluno(pasta.id) });
  }, []);
  const [carregando, setCarregando] = useState(true);
  const [erroPacote, setErroPacote] = useState<unknown>(null);
  const [registros, setRegistros] = useState<RegistroLocal[]>([]);
  const [cargas, setCargas] = useState<Record<string, number>>({});
  const [envio, setEnvio] = useState<EstadoEnvio>('ocioso');
  const [mensagemEnvio, setMensagemEnvio] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const falhasSeguidas = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregarRegistros = useCallback(() => repositorio.listar().then(setRegistros), [repositorio]);

  const baixarPacote = useCallback(async () => {
    try {
      const novo = await painelAluno();
      await repositorio.salvarPacote(novo);
      if(novo.atualizacao)await atualizarAtualizacao(novo.atualizacao);
      setPacote(await repositorio.lerPacote());
      setErroPacote(null);
      atualizarMarca(novo.marca);
    } catch (erro) {
      // Sem conexão: segue com o pacote salvo. Sem pacote salvo, a tela explica.
      if (!(erro instanceof ErroApi && erro.semConexao)) setErroPacote(erro);
      else setErroPacote((atual: unknown) => atual ?? erro);
    }
  }, [repositorio, atualizarMarca, atualizarAtualizacao]);

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
      const pendentes = await repositorio.pendentes(1);
      if (pendentes.length) {
        const ms = ESPERAS_MS[Math.min(falhasSeguidas.current, ESPERAS_MS.length - 1)];
        falhasSeguidas.current++;
        espera.current = setTimeout(() => void sincronizar(), ms);
      }
    } else {
      setEnvio('erro');
      setMensagemEnvio(r.mensagem);
    }
  }, [sincronizador, repositorio, recarregarRegistros, baixarPacote]);

  // Abertura: lê o aparelho e depois tenta baixar o pacote e enviar o que ficou.
  useEffect(() => {
    let vivo = true;
    Promise.all([repositorio.lerPacote(), repositorio.listar(), repositorio.lerCargasDeTrabalho(),repositorio.lerAtualizacao()]).then(
      ([p, r, c, a]) => {
        if (!vivo) return;
        setPacote(p);
        setRegistros(r);
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

  const pendentes = registros.filter((r) => r.situacao === 'LOCAL').length;

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

  // Ao sair da conta, os dados deste aluno saem do aparelho (o painel de sair avisa se havia pendência).
  useEffect(
    () =>
      sessao.aoSair(async (id) => {
        await cancelarLembretesAtualizacao(id).catch(()=>undefined);
        await (id === repositorio.usuarioId ? repositorio : abrirRepositorio(id, novoUid)).apagarTudo();
      }),
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
    const indice = new Map(registros.map((r) => [`${r.planoVersaoId}|${r.serieUid}|${r.data}`, r]));
    return {
      atualizacao,atualizarAtualizacao,
      descanso, iniciarDescanso, ajustarDescanso, pularDescanso,
      repositorio,
      escolhida,
      escolherPasta,
      pacote,
      carregando,
      erroPacote,
      registros,
      registroDe: (v, s, d) => indice.get(`${v}|${s}|${d}`),
      cargasDeTrabalho: cargas,
      pendentes,
      falhas: registros.filter((r) => r.situacao === 'FALHOU'),
      envio,
      mensagemEnvio,
      online,
      registrar,
      salvarCargaDeTrabalho,
      sincronizarAgora: sincronizar,
      tentarDeNovo,
    };
  }, [atualizacao,atualizarAtualizacao,descanso, iniciarDescanso, ajustarDescanso, pularDescanso, repositorio, escolhida, escolherPasta, pacote, carregando, erroPacote, registros, cargas, pendentes, envio, mensagemEnvio, online, registrar, salvarCargaDeTrabalho, sincronizar, tentarDeNovo]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAluno(): ValorAluno {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useAluno fora do AlunoProvider');
  return valor;
}
