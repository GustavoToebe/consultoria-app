import { Link, router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { useSaidaGuardada } from './GuardaDeSaida';
import { IconeBotao } from './IconeBotao';
import { MarcaTitulo } from './MarcaTitulo';
import { Selo } from './Selo';
import { Texto } from './Texto';

/** Um passo da trilha. O último é a tela atual e nunca é link. */
export interface PassoDaTrilha {
  rotulo: string;
  href?: Href;
}

interface Props {
  titulo?: string;
  /** "Alunos › Fulano › Plano de treino", só com o menu lateral; no celular fica a seta de voltar. */
  trilha?: PassoDaTrilha[];
  /** Linha menor abaixo do título (nome do aluno, período). */
  subtitulo?: string;
  acoes?: ReactNode;
  /** `sempre` (área do aluno, sem menu lateral) ou `celular` (treinador: no PC a marca já está no menu). */
  mostrarMarca?: 'sempre' | 'celular';
  /** Seta de voltar. Sem histórico (link aberto direto na web), vai para este endereço. */
  voltar?: Href;
}

/**
 * Topo das telas: marca do treinador (ou título da página), selo de "sem conexão" e ações à direita. O título é o
 * único h1 da tela (a marca sem título vira o h1 nas telas públicas e do aluno).
 */
export function Cabecalho({ titulo, subtitulo, trilha, acoes, mostrarMarca, voltar }: Props) {
  const { marca, offline, usuario } = useSessao();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const { confirmar, pendente } = useSaidaGuardada();
  const comMarca = mostrarMarca === 'sempre' || (mostrarMarca === 'celular' && width < LARGURA_MENU_LATERAL);
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.inicio}>
        {voltar ? (
          <View style={estilos.seta}>
            <IconeBotao
              Icone={ArrowLeft}
              rotulo="Voltar"
              aoTocar={() => confirmar(() => (router.canGoBack() ? router.back() : router.replace(voltar)))}
            />
          </View>
        ) : null}
        <View style={estilos.esquerda}>
          {trilha && trilha.length > 1 && width >= LARGURA_MENU_LATERAL ? (
            <View style={estilos.trilha} accessibilityRole="header" accessibilityLabel={`Você está em: ${trilha.map((p) => p.rotulo).join(', ')}`}>
              {trilha.map((p, i) => (
                <View key={`${i}:${p.rotulo}`} style={estilos.passo}>
                  {i > 0 ? <Texto variante="pequeno" accessible={false}>›</Texto> : null}
                  {p.href && i < trilha.length - 1 ? (
                    <Link href={p.href} accessibilityRole="link" style={estilos.alvoPasso}
                      onPress={(e) => {
                        // Com alteração pendente a trilha pergunta antes; sem, o link segue como sempre.
                        if (!pendente() || !p.href) return;
                        e.preventDefault();
                        const destino = p.href;
                        confirmar(() => router.navigate(destino));
                      }}>
                      <Texto variante="suave" style={[estilos.link, { color: cores.textoSuave }]}>{p.rotulo}</Texto>
                    </Link>
                  ) : (
                    <Texto variante="suave" style={{ fontFamily: fontes.semi, color: cores.texto }}>{p.rotulo}</Texto>
                  )}
                </View>
              ))}
            </View>
          ) : null}
          {comMarca ? <MarcaTitulo marca={marca} nivel={titulo ? undefined : 1} /> : null}
          {titulo ? <Texto variante="titulo" nivel={1}>{titulo}</Texto> : null}
          {subtitulo ? <Texto variante="suave">{subtitulo}</Texto> : null}
          {/* O aluno já vê o selo de sincronização, que diz se está sem conexão. */}
          {offline && usuario?.papel !== 'ALUNO' ? <Selo texto="Sem conexão" tipo="neutro" /> : null}
        </View>
      </View>
      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1),
  },
  inicio: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 1, gap: espaco(0.5) },
  seta: { marginLeft: -espaco(1.5), marginTop: -espaco(1) + 2 },
  esquerda: { flexShrink: 1, gap: espaco(0.5) },
  // A trilha é a primeira linha: os passos têm 44 px de alvo, mas a margem negativa evita um buraco acima do título.
  trilha: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.5), marginTop: -espaco(1.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  alvoPasso: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingVertical: 12 },
  link: { textDecorationLine: 'underline' },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' },
});
