import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import {
  aoEncerrar,
  definirUsuarioDaSessao,
  ErroApi,
  guardarSessao,
  limparSessaoLocal,
  recusadaPorTrocaDeUsuario,
  renovarSessao,
} from '../api/cliente';
import * as rotas from '../api/rotas';
import type { LoginResponse, Marca, UsuarioResumo, PerfilDaEquipe } from '../api/tipos';
import { apagarDadosDaSessaoLocal, type MotivoDoEncerramento } from '../dominio/encerrarSessaoLocal';
import { mesmaMarca } from '../dominio/marcaDaSessao';
import { temFuncionalidade as conferirFuncionalidade } from '../dominio/funcionalidadesDoPlano';
import { pode as conferirPermissao } from '../dominio/permissoes';
import { varrerFilasRetidas } from '../offline/filasRetidas';
import { limparDadosDoAluno } from '../offline/limparDadosDoAluno';
import { apagarArquivosTemporarios } from '../offline/arquivosTemporarios';
import { limparLogosEmMemoria } from '../pdf/logoEmMemoria';
import { lerRefresh } from './armazenamentoSeguro';

/**
 * Sessão do app. Ao abrir, tenta renovar com o refresh guardado (cookie na web, SecureStore no nativo):
 * - servidor aceitou: sessão aberta;
 * - servidor recusou (401): volta para "Entrar";
 * - sem conexão: abre offline com o último perfil salvo (o aluno precisa treinar sem internet).
 * O perfil salvo (nome, papel e marca) serve só para isso e é apagado ao sair.
 * Sessão recusada pelo servidor no meio do uso apaga os dados do aparelho como o "Sair", menos a fila de registros de
 * treino ainda não enviados (`MotivoDoEncerramento`).
 */
export type Situacao = 'carregando' | 'anonimo' | 'autenticado';

interface Perfil {
  perfil?: PerfilDaEquipe;
  permissoes?: string[];
  /** Funcionalidades ligadas no plano da consultoria; ausente (perfil antigo ou offline) = tudo liberado. */
  funcionalidadesDoPlano?: string[];
  /** Pagamentos do aluno ao treinador ligados para a consultoria; ausente (perfil antigo ou offline) = desligado. */
  pagamentosHabilitados?: boolean;
  /** Recebimento online (InfinitePay) ligado além dos pagamentos; ausente (perfil antigo ou offline) = desligado. */
  recebimentoOnlineHabilitado?: boolean;
  /** Chaves da plataforma do "Pagar" no celular; ausente (perfil antigo ou offline) = desligada. */
  pagarNoIos?: boolean;
  pagarNoAndroid?: boolean;
  /** Ciclo menstrual ligado na plataforma; ausente (perfil antigo ou offline) = desligado. */
  cicloHabilitado?: boolean;
  usuario: UsuarioResumo;
  marca: Marca;
  /** Termo de uso e aviso de privacidade ainda sem aceite na versão vigente (guardado para abrir offline). */
  termosPendentes?: boolean;
}

interface ValorSessao {
  /** Pendente de aceite: o app só mostra a tela dos termos até aceitar. */
  termosPendentes: boolean;
  aceitarTermos: (versao: string) => Promise<void>;
  perfilEquipe: PerfilDaEquipe | null;
  pode: (codigo:string) => boolean;
  /** A funcionalidade (`MOBILIDADE`, `PDF`, `EQUIPE`) está ligada no plano? Só apresentação; a API barra. */
  temFuncionalidade: (codigo: string) => boolean;
  /** Lista de liberadas para filtros puros (`undefined` = tudo). */
  funcionalidadesDoPlano: readonly string[] | undefined;
  /** Módulo de pagamentos ligado? Desligado ou desconhecido, o app esconde o financeiro e não o consulta. */
  pagamentosHabilitados: boolean;
  /** Pagamentos E InfinitePay ligados? Desligado ou desconhecido, o app esconde o recebimento online e não o consulta. */
  recebimentoOnlineHabilitado: boolean;
  /** Chave da plataforma ligada para o iOS? Sem ela o celular não tem "Pagar" (a web sempre tem). */
  pagarNoIos: boolean;
  pagarNoAndroid: boolean;
  /** Ciclo menstrual ligado? Desligado ou desconhecido, o app esconde tudo dele e não o consulta. */
  cicloHabilitado: boolean;
  recarregarPerfil: () => Promise<void>;
  situacao: Situacao;
  usuario: UsuarioResumo | null;
  marca: Marca | null;
  /** Aberta sem confirmar com o servidor (sem conexão). */
  offline: boolean;
  entrar: (email: string, senha: string, codigoMfa?: string, turnstileToken?: string, novaSenha?: string) => Promise<void>;
  cadastrarTreinador: (dados: { nomeConsultoria: string; nome: string; email: string; senha: string; turnstileToken?: string }) => Promise<void>;
  aceitarConvite: (codigo: string, email: string, senha: string) => Promise<void>;
  aceitarConviteEquipe: (codigo:string,senha:string) => Promise<void>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
  /** Ativa a verificação em duas etapas; devolve os códigos de recuperação (mostrados uma vez). As outras sessões caem. */
  ativarMfa: (senha: string, codigo: string) => Promise<string[]>;
  desativarMfa: (senha: string, codigo: string) => Promise<void>;
  /**
   * "Excluir minha conta" (só aluno): a API anonimiza e encerra as sessões; aqui sai tudo do aparelho como no "Sair",
   * inclusive a fila de envio (os registros não teriam mais dono).
   */
  excluirConta: (senha: string, confirmacao: string) => Promise<void>;
  atualizarMarca: (marca: Marca) => void;
  sair: () => Promise<void>;
  /**
   * Limpezas extras ao sair (ex.: dados offline do aluno). Recebem o motivo: `sair` apaga tudo; `recusada` (servidor
   * derrubou a sessão) apaga o que é dado sensível e preserva a fila de envio. Devolve a função que remove o registro.
   */
  aoSair: (limpeza: (usuarioId: string, motivo: MotivoDoEncerramento) => Promise<void>) => () => void;
}

const CHAVE_PERFIL = 'treinos:perfil';

/** Id do aluno de um perfil salvo (texto do AsyncStorage); nulo se não há, está ilegível ou não é de aluno. */
function alunoDoPerfilSalvo(salvo: string | null): string | null {
  if (!salvo) return null;
  try {
    const { usuario } = JSON.parse(salvo) as Partial<Perfil>;
    return usuario?.papel === 'ALUNO' && usuario.id ? usuario.id : null;
  } catch {
    return null;
  }
}
const Contexto = createContext<ValorSessao | null>(null);

/**
 * Na web, outra conta entrou em outra aba do mesmo navegador (o cookie de renovação é um só): esta aba já limpou a
 * sessão antiga como recusada e recarrega para abrir com a conta que está no navegador, em vez de mostrar 403.
 */
function recarregarSeTrocouDeConta() {
  if (recusadaPorTrocaDeUsuario() && Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [offline, setOffline] = useState(false);
  const limpezas = useRef(new Set<(usuarioId: string, motivo: MotivoDoEncerramento) => Promise<void>>());
  const perfilAtual = useRef<Perfil | null>(null);

  useEffect(() => {
    perfilAtual.current = perfil;
  }, [perfil]);

  const abrir = useCallback(async (resposta: LoginResponse) => {
    await guardarSessao(resposta);
    const eu = await rotas.eu();
    const novo: Perfil = {usuario:eu.usuario,marca:eu.marca,perfil:eu.perfil,permissoes:eu.permissoes,funcionalidadesDoPlano:eu.funcionalidadesDoPlano,pagamentosHabilitados:eu.pagamentosHabilitados,recebimentoOnlineHabilitado:eu.recebimentoOnlineHabilitado,pagarNoIos:eu.pagarNoIos,pagarNoAndroid:eu.pagarNoAndroid,cicloHabilitado:eu.cicloHabilitado,termosPendentes:eu.termosPendentes};
    perfilAtual.current=novo;
    definirUsuarioDaSessao(eu.usuario.id);
    setPerfil(novo);
    setOffline(false);
    setSituacao('autenticado');
    await AsyncStorage.setItem(CHAVE_PERFIL, JSON.stringify(novo)).catch(() => undefined);
    // Filas retidas de sessões recusadas: apaga as que passaram do prazo (de qualquer usuário; nunca envia nada).
    void varrerFilasRetidas({ exceto: eu.usuario.id }).catch(() => undefined);
  }, []);

  // Um encerramento por vez: "Sair" e o servidor recusando a sessão (várias requisições podem avisar juntas) dividem
  // a mesma execução. O id vem da ref na hora da chamada, não de uma cópia do registro do callback. Se a sessão já
  // está sendo encerrada como `recusada` e a pessoa pede "Sair", este segundo pedido roda depois, para apagar também a
  // fila que a recusa preservou.
  const encerrando = useRef<{ motivo: MotivoDoEncerramento; usuarioId: string | undefined; execucao: Promise<void> } | null>(null);
  const iniciarEncerramento = useCallback((motivo: MotivoDoEncerramento, usuarioId: string | undefined): Promise<void> => {
    const execucao = (async () => {
      try {
        await apagarDadosDaSessaoLocal({
          usuarioId,
          motivo,
          limparSessaoLocal,
          removerPerfilSalvo: () => AsyncStorage.removeItem(CHAVE_PERFIL),
          limpezas: limpezas.current,
        });
        // PDFs e exportação LGPD gravados para o compartilhar: nada de dado de aluno sobrando no cache.
        try { apagarArquivosTemporarios(); } catch { /* sem a pasta, nada a apagar */ }
      } finally {
        // Mesmo se apagar falhar, a pessoa sai: manter a tela aberta com a sessão morta é pior.
        limparLogosEmMemoria();
        definirUsuarioDaSessao(null);
        setPerfil(null);
        setOffline(false);
        setSituacao('anonimo');
      }
    })().finally(() => {
      encerrando.current = null;
    });
    encerrando.current = { motivo, usuarioId, execucao };
    return execucao;
  }, []);
  const encerrarLocal = useCallback(
    (motivo: MotivoDoEncerramento): Promise<void> => {
      const andamento = encerrando.current;
      if (!andamento) return iniciarEncerramento(motivo, perfilAtual.current?.usuario.id);
      if (motivo === 'sair' && andamento.motivo === 'recusada') {
        return andamento.execucao.then(() => iniciarEncerramento('sair', andamento.usuarioId));
      }
      return andamento.execucao;
    },
    [iniciarEncerramento],
  );

  useEffect(() => {
    let ativo = true;
    void varrerFilasRetidas().catch(() => undefined);
    aoEncerrar(() => {
      // O refresh foi recusado (401/403) no meio do uso: sessão encerrada no servidor, sem a pessoa ter pedido. Apaga os
      // dados do aparelho como no "Sair", mas guarda os registros de treino ainda não enviados. Erro de rede ou 5xx
      // não chega aqui (o cliente só avisa quando o servidor recusa).
      void encerrarLocal('recusada').then(recarregarSeTrocouDeConta, () => undefined);
    });
    (async () => {
      try {
        const sessao = await renovarSessao();
        if (!ativo) return;
        if (sessao) {
          await abrir(sessao);
        } else {
          // O servidor recusou a sessão guardada (ou ela já não existia). Com um perfil de aluno salvo, é sessão
          // derrubada na ausência: apaga o que é dado sensível e guarda só a fila de registros não enviados.
          const salvo = await AsyncStorage.getItem(CHAVE_PERFIL).catch(() => null);
          await AsyncStorage.removeItem(CHAVE_PERFIL).catch(() => undefined);
          const aluno = alunoDoPerfilSalvo(salvo);
          if (aluno) await limparDadosDoAluno(aluno, 'recusada').catch(() => undefined);
          if (!ativo) return;
          setSituacao('anonimo');
        }
      } catch (erro) {
        if (!ativo) return;
        const salvo = await AsyncStorage.getItem(CHAVE_PERFIL).catch(() => null);
        if (erro instanceof ErroApi && erro.semConexao && salvo) {
          const offlinePerfil = JSON.parse(salvo) as Perfil;
          definirUsuarioDaSessao(offlinePerfil.usuario?.id ?? null);
          setPerfil(offlinePerfil);
          setOffline(true);
          setSituacao('autenticado');
        } else {
          setSituacao('anonimo');
        }
      }
    })();
    return () => {
      ativo = false;
      aoEncerrar(null);
    };
  }, [abrir, encerrarLocal]);

  // Aberta sem internet: tenta renovar quando a rede volta (e a cada 30 s). Recusada no servidor, é sessão derrubada:
  // volta para "Entrar" e o aparelho guarda só a fila de registros (o mesmo aluno, ao entrar de novo, envia o que ficou).
  useEffect(() => {
    if (!offline) return;
    let ativo = true;
    const tentar = () => {
      renovarSessao().then(
        (sessao) => {
          if (!ativo) return;
          if (sessao) {
            void abrir(sessao);
          } else {
            // Recusada no servidor: o mesmo que no meio do uso (dados sensíveis saem, a fila de envio fica).
            void encerrarLocal('recusada').then(recarregarSeTrocouDeConta, () => undefined);
          }
        },
        () => undefined,
      );
    };
    const cancelarRede = NetInfo.addEventListener((estado) => {
      if (estado.isConnected) tentar();
    });
    const relogio = setInterval(tentar, 30_000);
    return () => {
      ativo = false;
      cancelarRede();
      clearInterval(relogio);
    };
  }, [offline, abrir, encerrarLocal]);

  const recarregarPerfil=useCallback(async()=>{
    const atual=perfilAtual.current;if(!atual || atual.usuario.papel!=='TREINADOR') return;
    const eu=await rotas.eu();
    if(perfilAtual.current?.usuario.id!==eu.usuario.id) return;
    const novo:Perfil={usuario:eu.usuario,marca:eu.marca,perfil:eu.perfil,permissoes:eu.permissoes,funcionalidadesDoPlano:eu.funcionalidadesDoPlano,pagamentosHabilitados:eu.pagamentosHabilitados,recebimentoOnlineHabilitado:eu.recebimentoOnlineHabilitado,pagarNoIos:eu.pagarNoIos,pagarNoAndroid:eu.pagarNoAndroid,cicloHabilitado:eu.cicloHabilitado,termosPendentes:eu.termosPendentes};
    perfilAtual.current=novo;setPerfil(novo);
    await AsyncStorage.setItem(CHAVE_PERFIL,JSON.stringify(novo)).catch(()=>undefined);
  },[]);
  const aceitarTermos = useCallback(async (versao: string) => {
    await rotas.aceitarTermos(versao);
    setPerfil((atual) => {
      if (!atual) return atual;
      const novo = { ...atual, termosPendentes: false };
      perfilAtual.current = novo;
      AsyncStorage.setItem(CHAVE_PERFIL, JSON.stringify(novo)).catch(() => undefined);
      return novo;
    });
  }, []);
  // Estável e sem efeito com a marca igual: o AlunoProvider chama a cada painel baixado e depende dela na abertura.
  const atualizarMarca = useCallback((marca: Marca) => {
    setPerfil((atual) => {
      if (!atual || mesmaMarca(atual.marca, marca)) return atual;
      const novo = { ...atual, marca };
      perfilAtual.current = novo;
      AsyncStorage.setItem(CHAVE_PERFIL, JSON.stringify(novo)).catch(() => undefined);
      return novo;
    });
  }, []);
  const valor = useMemo<ValorSessao>(
    () => ({
      termosPendentes: perfil?.termosPendentes ?? false,
      aceitarTermos,
      perfilEquipe:perfil?.perfil??null,
      aceitarConviteEquipe:async(codigo,senha)=>abrir(await rotas.aceitarConviteEquipe(codigo,senha)),
      pode:(codigo)=>conferirPermissao(perfil?.permissoes,codigo),
      temFuncionalidade:(codigo)=>conferirFuncionalidade(perfil?.funcionalidadesDoPlano,codigo),
      funcionalidadesDoPlano:perfil?.funcionalidadesDoPlano,
      pagamentosHabilitados:perfil?.pagamentosHabilitados===true,
      recebimentoOnlineHabilitado:perfil?.pagamentosHabilitados===true&&perfil?.recebimentoOnlineHabilitado===true,
      pagarNoIos:perfil?.pagarNoIos===true,
      pagarNoAndroid:perfil?.pagarNoAndroid===true,
      cicloHabilitado:perfil?.cicloHabilitado===true,
      recarregarPerfil,
      situacao,
      usuario: perfil?.usuario ?? null,
      marca: perfil?.marca ?? null,
      offline,
      entrar: async (email, senha, codigoMfa, turnstileToken, novaSenha) =>
        abrir(await rotas.entrar(email.trim(), senha, codigoMfa, turnstileToken, novaSenha)),
      cadastrarTreinador: async (dados) => abrir(await rotas.cadastrarTreinador(dados)),
      aceitarConvite: async (codigo, email, senha) => abrir(await rotas.aceitarConvite(codigo, email.trim(), senha)),
      trocarSenha: async (atual, nova) => abrir(await rotas.trocarSenha(atual, nova)),
      ativarMfa: async (senha, codigo) => {
        const ativacao = await rotas.mfaAtivar(senha, codigo);
        await abrir(ativacao.sessao);
        return ativacao.codigosDeRecuperacao;
      },
      desativarMfa: async (senha, codigo) => abrir(await rotas.mfaDesativar(senha, codigo)),
      excluirConta: async (senha, confirmacao) => {
        await rotas.excluirMinhaConta(senha, confirmacao);
        await encerrarLocal('sair');
      },
      atualizarMarca,
      sair: async () => {
        try {
          await rotas.sairDaApi(await lerRefresh());
        } catch {
          // Sem conexão: a sessão local é apagada mesmo assim; o refresh expira no servidor.
        }
        await encerrarLocal('sair');
      },
      aoSair: (limpeza) => {
        limpezas.current.add(limpeza);
        return () => {
          limpezas.current.delete(limpeza);
        };
      },
    }),
    [situacao, perfil, offline, abrir, encerrarLocal,recarregarPerfil,aceitarTermos,atualizarMarca],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ValorSessao {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useSessao fora do SessaoProvider');
  }
  return valor;
}
