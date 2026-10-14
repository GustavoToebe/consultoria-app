import { Uniwind } from 'uniwind';
import { variaveisDoTema } from './variaveis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Tema } from '../api/tipos';
import {
  coresComContraste,
  fatorDoTexto,
  normalizarPreferencias,
  PREFERENCIAS_PADRAO,
  type Preferencias,
} from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { definirVibracaoLigada } from '../ui/vibrar';
import { criarArmazemDePreferencias } from './armazemDePreferencias';
import { CLARO, ESCURO, MARCA_NEUTRA, marcaParaTexto, textoSobre, type Cores } from './tokens';

/**
 * Tema e preferências visuais de cada pessoa (tema, contraste, tamanho do texto, animações, vibração). Ficam no
 * aparelho, por usuário, num JSON só: é preferência visual, não dado sensível. Padrão do tema = o da marca do
 * treinador; sem marca conhecida (entrar, cadastro, convite), o do aparelho. A cor da marca é do treinador e não
 * muda por pessoa.
 */
interface ValorTema {
  /** Tema em uso agora (escuro ou claro), já resolvido: consultoria, escolha da pessoa ou aparelho. */
  modo: Tema;
  cores: Cores;
  marca: string;
  sobreMarca: string;
  /**
   * A cor da marca para texto e ícone sobre o fundo e as superfícies (≥ 4,5:1): a própria cor quando contrasta,
   * senão a variante mais clara (tema escuro) ou mais escura (tema claro). Fundo de botão e sublinhado de aba
   * continuam com `marca`.
   */
  marcaTexto: string;
  preferencias: Preferencias;
  /** Multiplicador dos tamanhos de texto (1; 1,12; 1,25; 1,40). */
  fatorTexto: number;
  /** Grava e aplica na hora. */
  escolherPreferencia: (parcial: Partial<Preferencias>) => void;
  restaurarPadrao: () => void;
}

const Contexto = createContext<ValorTema | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const sessao = useSessao();
  const usuarioId = sessao.usuario?.id ?? null;
  const esquemaDoAparelho = useColorScheme();
  // A escolha vale só para o usuário que a fez: um armazém por conta, e trocar de conta volta ao padrão até ler a do novo
  // usuário. Escolha feita enquanto a leitura corre não se perde (ver `armazemDePreferencias`).
  const armazem = useMemo(
    () =>
      usuarioId
        ? criarArmazemDePreferencias(
            () => lerPreferencias(usuarioId),
            (preferencias) => AsyncStorage.setItem(chave(usuarioId), JSON.stringify(preferencias)),
          )
        : null,
    [usuarioId],
  );
  useEffect(() => {
    armazem?.iniciar();
    return () => armazem?.parar();
  }, [armazem]);
  const preferencias = useSyncExternalStore(
    useCallback((aviso: () => void) => armazem?.assinar(aviso) ?? (() => undefined), [armazem]),
    () => armazem?.obter() ?? PREFERENCIAS_PADRAO,
    () => PREFERENCIAS_PADRAO,
  );
  const gravar = useCallback((parcial: Partial<Preferencias>) => armazem?.escolher(parcial), [armazem]);

  const valor = useMemo<ValorTema>(() => {
    const doAparelho: Tema = esquemaDoAparelho === 'light' ? 'CLARO' : 'ESCURO';
    // Tela pública (sem consultoria conhecida) segue o aparelho; logado, o padrão é o da marca do treinador.
    const doTreinador: Tema = sessao.marca?.temaPadrao ?? doAparelho;
    const modo: Tema =
      preferencias.tema === 'ESCURO' || preferencias.tema === 'CLARO'
        ? preferencias.tema
        : preferencias.tema === 'SISTEMA'
          ? doAparelho
          : doTreinador;
    const marca = sessao.marca?.corPrimaria ?? MARCA_NEUTRA;
    const cores = coresComContraste(modo === 'CLARO' ? CLARO : ESCURO, preferencias.contraste, modo !== 'CLARO');
    return {
      modo,
      cores,
      marca,
      sobreMarca: textoSobre(marca),
      // Contra a superfície de pior contraste: `superficie3` é a mais clara no escuro e a mais escura no claro.
      marcaTexto: marcaParaTexto(marca, cores.superficie3),
      preferencias,
      fatorTexto: fatorDoTexto(preferencias.tamanhoTexto),
      escolherPreferencia: gravar,
      restaurarPadrao: () => gravar({ ...PREFERENCIAS_PADRAO }),
    };
  }, [preferencias, sessao.marca, esquemaDoAparelho, gravar]);

  useEffect(() => {
    const tema = valor.modo === 'CLARO' ? 'light' : 'dark';
    Uniwind.setTheme(tema);
    Uniwind.updateCSSVariables(tema, variaveisDoTema(valor.cores, valor.marca));
  }, [valor.modo, valor.cores, valor.marca]);

  useEffect(() => {
    definirVibracaoLigada(preferencias.vibracao);
  }, [preferencias.vibracao]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useTema fora do TemaProvider');
  }
  return valor;
}

function chave(usuarioId: string) {
  return `treinos:${usuarioId}:preferencias`;
}

async function lerPreferencias(usuarioId: string): Promise<Preferencias> {
  const atual = await AsyncStorage.getItem(chave(usuarioId));
  return atual === null ? { ...PREFERENCIAS_PADRAO } : normalizarPreferencias(atual);
}
