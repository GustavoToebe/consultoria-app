import { Uniwind } from 'uniwind';
import { variaveisDoTema } from './variaveis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Tema } from '../api/tipos';
import {
  chaveDasPreferencias,
  coresComBordasReforcadas,
  coresComContraste,
  espessurasDasBordas,
  fatorDoTexto,
  normalizarPreferencias,
  PREFERENCIAS_PADRAO,
  type Preferencias,
} from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { definirVibracaoLigada } from '../ui/vibrar';
import { criarArmazemDePreferencias } from './armazemDePreferencias';
import { AREIA, CLARO, ESCURO, MARCA_NEUTRA, marcaParaTexto, textoSobre, type Cores } from './tokens';

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
  /** Espessura da borda do bloco e do item (2 px; 3 px no bloco com "Bordas reforçadas"). */
  bordas: { bloco: number; item: number };
  marca: string;
  sobreMarca: string;
  /**
   * A cor da marca para texto e ícone sobre o fundo e as superfícies (≥ 4,5:1): a própria cor quando contrasta,
   * senão a variante mais clara (tema escuro) ou mais escura (tema claro). Fundo de botão e sublinhado de aba
   * continuam com `marca`.
   */
  marcaTexto: string;
  preferencias: Preferencias;
  /** A leitura das preferências gravadas terminou; antes disso `preferencias` é o padrão. */
  preferenciasLidas: boolean;
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
            (preferencias) => AsyncStorage.setItem(chaveDasPreferencias(usuarioId), JSON.stringify(preferencias)),
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
  const preferenciasLidas = useSyncExternalStore(
    useCallback((aviso: () => void) => armazem?.assinar(aviso) ?? (() => undefined), [armazem]),
    () => armazem?.lidas() ?? true,
    () => false,
  );
  const gravar = useCallback((parcial: Partial<Preferencias>) => armazem?.escolher(parcial), [armazem]);

  const valor = useMemo<ValorTema>(() => {
    const doAparelho: Tema = esquemaDoAparelho === 'light' ? 'CLARO' : 'ESCURO';
    // Tela pública (sem consultoria conhecida) segue o aparelho; logado, o padrão é o da marca do treinador.
    const doTreinador: Tema = sessao.marca?.temaPadrao ?? doAparelho;
    // "Claro areia" é o modo claro com outra paleta (fundo e faixas em tom areia).
    const modo: Tema =
      preferencias.tema === 'ESCURO' || preferencias.tema === 'CLARO'
        ? preferencias.tema
        : preferencias.tema === 'AREIA'
          ? 'CLARO'
          : preferencias.tema === 'SISTEMA'
            ? doAparelho
            : doTreinador;
    const marca = sessao.marca?.corPrimaria ?? MARCA_NEUTRA;
    const base = modo === 'CLARO' ? (preferencias.tema === 'AREIA' ? AREIA : CLARO) : ESCURO;
    const cores = coresComBordasReforcadas(coresComContraste(base, preferencias.contraste, modo !== 'CLARO'), preferencias.bordasReforcadas);
    return {
      modo,
      cores,
      bordas: espessurasDasBordas(preferencias.bordasReforcadas),
      marca,
      sobreMarca: textoSobre(marca),
      // Contra a superfície de pior contraste: `superficie3` é a mais clara no escuro e a mais escura no claro.
      marcaTexto: marcaParaTexto(marca, cores.superficie3),
      preferencias,
      preferenciasLidas,
      fatorTexto: fatorDoTexto(preferencias.tamanhoTexto),
      escolherPreferencia: gravar,
      restaurarPadrao: () => gravar({ ...PREFERENCIAS_PADRAO }),
    };
  }, [preferencias, preferenciasLidas, sessao.marca, esquemaDoAparelho, gravar]);

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

async function lerPreferencias(usuarioId: string): Promise<Preferencias> {
  const atual = await AsyncStorage.getItem(chaveDasPreferencias(usuarioId));
  return atual === null ? { ...PREFERENCIAS_PADRAO } : normalizarPreferencias(atual);
}
