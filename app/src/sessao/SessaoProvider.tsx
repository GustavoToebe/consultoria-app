import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { aoEncerrar, ErroApi, guardarSessao, limparSessaoLocal, renovarSessao } from '../api/cliente';
import * as rotas from '../api/rotas';
import type { LoginResponse, Marca, UsuarioResumo } from '../api/tipos';
import { lerRefresh } from './armazenamentoSeguro';

/**
 * Sessão do app. Ao abrir, tenta renovar com o refresh guardado (cookie na web, SecureStore no nativo):
 * - servidor aceitou: sessão aberta;
 * - servidor recusou (401): volta para "Entrar";
 * - sem conexão: abre offline com o último perfil salvo (o aluno precisa treinar sem internet, seção 11).
 * O perfil salvo (nome, papel e marca) serve só para isso e é apagado ao sair.
 */
export type Situacao = 'carregando' | 'anonimo' | 'autenticado';

interface Perfil {
  usuario: UsuarioResumo;
  marca: Marca;
}

interface ValorSessao {
  situacao: Situacao;
  usuario: UsuarioResumo | null;
  marca: Marca | null;
  /** Aberta sem confirmar com o servidor (sem conexão). */
  offline: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrarTreinador: (dados: { nomeConsultoria: string; nome: string; email: string; senha: string }) => Promise<void>;
  aceitarConvite: (codigo: string, email: string, senha: string) => Promise<void>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
  atualizarMarca: (marca: Marca) => void;
  sair: () => Promise<void>;
  /** Limpezas extras ao sair (ex.: dados offline do aluno). Devolve a função que remove o registro. */
  aoSair: (limpeza: (usuarioId: string) => Promise<void>) => () => void;
}

const CHAVE_PERFIL = 'treinos:perfil';
const Contexto = createContext<ValorSessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [offline, setOffline] = useState(false);
  const limpezas = useRef(new Set<(usuarioId: string) => Promise<void>>());
  const perfilAtual = useRef<Perfil | null>(null);

  useEffect(() => {
    perfilAtual.current = perfil;
  }, [perfil]);

  const abrir = useCallback(async (resposta: LoginResponse) => {
    await guardarSessao(resposta);
    const novo = { usuario: resposta.usuario, marca: resposta.marca };
    setPerfil(novo);
    setOffline(false);
    setSituacao('autenticado');
    await AsyncStorage.setItem(CHAVE_PERFIL, JSON.stringify(novo)).catch(() => undefined);
  }, []);

  const encerrarLocal = useCallback(async () => {
    const usuarioId = perfilAtual.current?.usuario.id;
    await limparSessaoLocal();
    await AsyncStorage.removeItem(CHAVE_PERFIL).catch(() => undefined);
    if (usuarioId) {
      for (const limpar of limpezas.current) {
        await limpar(usuarioId).catch(() => undefined);
      }
    }
    setPerfil(null);
    setOffline(false);
    setSituacao('anonimo');
  }, []);

  useEffect(() => {
    let ativo = true;
    aoEncerrar(() => {
      // O refresh foi recusado no meio do uso: sessão encerrada no servidor.
      setPerfil(null);
      setSituacao('anonimo');
    });
    (async () => {
      try {
        const sessao = await renovarSessao();
        if (!ativo) return;
        if (sessao) {
          await abrir(sessao);
        } else {
          await AsyncStorage.removeItem(CHAVE_PERFIL).catch(() => undefined);
          setSituacao('anonimo');
        }
      } catch (erro) {
        if (!ativo) return;
        const salvo = await AsyncStorage.getItem(CHAVE_PERFIL).catch(() => null);
        if (erro instanceof ErroApi && erro.semConexao && salvo) {
          setPerfil(JSON.parse(salvo) as Perfil);
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
  }, [abrir]);

  // Aberta sem internet: tenta renovar quando a rede volta (e a cada 30 s). Recusada no servidor, volta para
  // "Entrar" sem apagar os registros do aparelho (o mesmo aluno, ao entrar de novo, envia o que ficou).
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
            setPerfil(null);
            setOffline(false);
            setSituacao('anonimo');
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
  }, [offline, abrir]);

  const valor = useMemo<ValorSessao>(
    () => ({
      situacao,
      usuario: perfil?.usuario ?? null,
      marca: perfil?.marca ?? null,
      offline,
      entrar: async (email, senha) => abrir(await rotas.entrar(email.trim(), senha)),
      cadastrarTreinador: async (dados) => abrir(await rotas.cadastrarTreinador(dados)),
      aceitarConvite: async (codigo, email, senha) => abrir(await rotas.aceitarConvite(codigo, email.trim(), senha)),
      trocarSenha: async (atual, nova) => abrir(await rotas.trocarSenha(atual, nova)),
      atualizarMarca: (marca) => {
        setPerfil((atual) => {
          if (!atual) return atual;
          const novo = { ...atual, marca };
          AsyncStorage.setItem(CHAVE_PERFIL, JSON.stringify(novo)).catch(() => undefined);
          return novo;
        });
      },
      sair: async () => {
        try {
          await rotas.sairDaApi(await lerRefresh());
        } catch {
          // Sem conexão: a sessão local é apagada mesmo assim; o refresh expira no servidor.
        }
        await encerrarLocal();
      },
      aoSair: (limpeza) => {
        limpezas.current.add(limpeza);
        return () => {
          limpezas.current.delete(limpeza);
        };
      },
    }),
    [situacao, perfil, offline, abrir, encerrarLocal],
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
