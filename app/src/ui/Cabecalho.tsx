import { Link, router, usePathname, type Href } from 'expo-router';
import { ArrowLeft, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';
import { voltarAutomatico } from '../dominio/telas';
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
  /**
   * `sempre` (área do aluno, sem menu lateral) ou `celular` (treinador: no PC a marca já está no menu). Regra única:
   * a marca só aparece no Início de cada área (`/treinador`, `/aluno`); nas outras telas o pedido é ignorado.
   */
  mostrarMarca?: 'sempre' | 'celular';
  /**
   * Seta de voltar. Sem histórico (link aberto direto na web), vai para este endereço. Sem isto, as telas abertas fora
   * da barra inferior (Equipe, Ajuda, Atualizações...) ganham a seta para a tela de origem quando a barra está à vista
   * (`voltarAutomatico`).
   */
  voltar?: Href;
}

/**
 * Topo das telas: marca do treinador (ou título da página), selo de "sem conexão" e ações à direita. O título é o
 * único h1 da tela (a marca sem título vira o h1 nas telas públicas e do aluno).
 */
export function Cabecalho({ titulo, subtitulo, trilha, acoes, mostrarMarca, voltar: voltarPedido }: Props) {
  const { marca, offline, usuario } = useSessao();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const caminho = usePathname();
  const { confirmar, pendente } = useSaidaGuardada();
  const naRaiz = caminho === '/treinador' || caminho === '/aluno';
  const comMarca = naRaiz && (mostrarMarca === 'sempre' || (mostrarMarca === 'celular' && width < LARGURA_MENU_LATERAL));
  // O aluno tem a barra inferior em qualquer largura; o treinador, só abaixo do menu lateral.
  const comBarraInferior = usuario?.papel === 'ALUNO' || width < LARGURA_MENU_LATERAL;
  const voltar = voltarPedido ?? (voltarAutomatico(caminho, comBarraInferior) as Href | undefined);
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.inicio}>
        {voltar ? (
          <View style={estilos.seta}>
            <IconeBotao
              Icone={ArrowLeft}
              rotulo="Voltar"
              moldura
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
                        // Com alteração pendente a trilha pergunta antes; sem, o link segue como sempre. Ctrl/Cmd+clique abre
                        // outra guia, e a guia atual não perde nada.
                        if (!pendente() || !p.href || deixarParaONavegador(e as unknown as CliqueDoNavegador)) return;
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
          {/* A linha segura o selo à esquerda: a pílula com ícone se centra no eixo cruzado, e numa coluna iria ao meio. */}
          {offline && usuario?.papel !== 'ALUNO' ? <View style={estilos.linhaDoSelo}><Selo texto="Sem conexão" tipo="neutro" Icone={WifiOff} /></View> : null}
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
  // Com moldura (40 px) a seta encosta na coluna e fica centrada na primeira linha do título (30 px).
  seta: { marginRight: espaco(0.5), marginTop: -5 },
  esquerda: { flexShrink: 1, gap: espaco(0.5) },
  // A trilha é a primeira linha: os passos têm 44 px de alvo, mas a margem negativa evita um buraco acima do título.
  trilha: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.5), marginTop: -espaco(1.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  linhaDoSelo: { flexDirection: 'row' },
  alvoPasso: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingVertical: 12 },
  link: { textDecorationLine: 'underline' },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' },
});
