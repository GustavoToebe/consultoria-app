import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns2, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FotoDaLinha } from '../api/tipos';
import { dataParaTela } from '../dominio/formatos';
import {
  fotosEmOrdem,
  grupoDaFoto,
  indiceDaFoto,
  MOTIVO_SEM_PAR,
  parPadrao,
  passoDoDeslize,
  pesoDaFoto,
  quemEnviou,
  textoDaPosicao,
  vizinho,
  type ParDeDatas,
} from '../dominio/visualizadorDeFotos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, CAMADA_DA_FOTO, ESCURO, espaco, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA, RAIO_CONTROLE } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { useFolhaNoHistorico, usePassoNoHistorico } from '../ui/historicoDasFolhas';
import { IconeBotao } from '../ui/IconeBotao';
import { ImagemProtegida } from '../ui/ImagemProtegida';
import { LinhaDeDado, ListaDeDados } from '../ui/ListaDeDados';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { CompararFotos } from './CompararFotos';
import { FotoNoPalco } from './FotoNoPalco';

/** Painel dos dados ao lado da foto no PC. */
const LARGURA_DO_PAINEL = 320;
const MINIATURA = 56;
const VAO_DAS_MINIATURAS = espaco(1);
/** Moldura da miniatura aberta: 2 px de anel + 2 px de folga. */
const ANEL = 2;
/** No PC as setas ficam na margem do palco, fora da foto; no celular, por cima das bordas dela. */
const MARGEM_DAS_SETAS = ALVO_TOQUE + espaco(3);

interface Props {
  fotos: readonly FotoDaLinha[];
  fotoInicialId: string;
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  aoFechar: () => void;
}

/**
 * Visualizador das fotos de evolução, em tela cheia: a foto inteira no centro, sobre o palco escuro (o mesmo em todos os
 * temas: a foto pode ter qualquer cor), setas ‹ › (e ← → no teclado, deslizar no celular), "3 de 12" no topo, miniaturas
 * embaixo e os dados da foto ao lado (PC) ou num painel recolhido embaixo (celular). "Comparar" troca o corpo pelo par do
 * mesmo ângulo. Para o leitor de tela é um diálogo modal; Esc e o voltar (do navegador e do Android) fecham primeiro o
 * Comparar, depois o visualizador: na web o Comparar ocupa uma entrada própria do histórico (`usePassoNoHistorico`).
 * As faixas de controle seguem o tema (o anel de foco do tema não apareceria sobre o palco); só as setas ficam no palco,
 * com a camada da foto (`CAMADA_DA_FOTO`) e o anel branco.
 */
export function VisualizadorDeFotos({ fotos, fotoInicialId, baixar, aoFechar }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const margem = useSafeAreaInsets();
  const largo = width >= LARGURA_MENU_LATERAL;
  const ordenadas = fotosEmOrdem(fotos);
  const [atualId, setAtualId] = useState(fotoInicialId);
  const [par, setPar] = useState<ParDeDatas | null>(null);
  const indice = indiceDaFoto(ordenadas, atualId);
  const atual = ordenadas[indice];
  const grupo = atual ? grupoDaFoto(ordenadas, atual.fotoId) : undefined;
  const padrao = parPadrao(grupo);
  const total = ordenadas.length;
  const ir = (passo: -1 | 1) => {
    const seguinte = vizinho(indice, total, passo);
    if (seguinte !== null) setAtualId(ordenadas[seguinte].fotoId);
  };
  const voltarOuFechar = () => (par ? setPar(null) : aoFechar());

  const portal = useId();
  useFolhaNoHistorico(aoFechar, { nome: portal, elemento: null });
  // Registrado depois do visualizador, fica por cima: o voltar do navegador com o Comparar aberto volta só à foto.
  usePassoNoHistorico(par !== null, () => setPar(null));
  useFocoDoDialogo();
  // ← → trocam de foto (só na web: no celular é o deslize). Campo e lista aberta ficam com as próprias setas.
  useEffect(() => {
    if (Platform.OS !== 'web' || par) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey) return;
      if ((evento.target as HTMLElement | null)?.closest?.('input, textarea, [role="listbox"]')) return;
      const passo = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0;
      if (!passo) return;
      evento.preventDefault();
      setAtualId((id) => {
        const seguinte = vizinho(indiceDaFoto(ordenadas, id), ordenadas.length, passo);
        return seguinte === null ? id : ordenadas[seguinte].fotoId;
      });
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [par, ordenadas]);

  if (!atual) return null;
  const descricao = `${atual.posicao || 'Foto'}, ${dataParaTela(atual.data)}`;
  const titulo = par && grupo ? `Comparar · ${grupo.rotulo}` : textoDaPosicao(indice, total);

  return (
    <Modal ref={semPapelNoModal} transparent visible animationType="none" onRequestClose={voltarOuFechar}>
      <GestureHandlerRootView style={estilos.raiz}>
        <View role="dialog" aria-modal aria-label={par ? 'Comparar fotos' : 'Foto'} accessibilityViewIsModal
          style={[estilos.raiz, { backgroundColor: cores.fundo, paddingBottom: margem.bottom }]}>
          <View style={[estilos.topo, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo, paddingTop: espaco(1) + margem.top }]}>
            <Texto variante="bloco" nivel={2} numerico style={estilos.titulo} numberOfLines={1}>{titulo}</Texto>
            <View style={estilos.acoesDoTopo}>
              {par ? (
                <Botao rotulo="Voltar à foto" tipo="secundario" Icone={ArrowLeft} aoTocar={() => setPar(null)} />
              ) : (
                <Botao rotulo="Comparar" tipo="secundario" Icone={Columns2} desabilitado={!padrao} motivo={MOTIVO_SEM_PAR}
                  aoTocar={() => setPar(padrao)} />
              )}
              <View {...({ dataSet: { fecharVisualizador: 'sim' } } as object)}>
                <IconeBotao Icone={X} rotulo="Fechar" aoTocar={aoFechar} moldura />
              </View>
            </View>
          </View>
          {par && grupo ? (
            <CompararFotos grupo={grupo} par={par} aoMudarPar={setPar} baixar={baixar} />
          ) : (
            <>
              <View style={[estilos.meio, !largo && estilos.meioEmColuna]}>
                <Palco largo={largo} indice={indice} total={total} aoIr={ir}>
                  {(area) => (
                    <FotoNoPalco chave={`visualizador:${atual.fotoId}`} carregar={() => baixar(atual)} descricao={descricao}
                      largura={area.largura} altura={area.altura} />
                  )}
                </Palco>
                {largo ? (
                  <View style={[estilos.painelLateral, { backgroundColor: cores.superficie, borderLeftColor: cores.divisor }]}>
                    <ScrollView contentContainerStyle={estilos.conteudoDoPainel}>
                      <DadosDaFoto foto={atual} />
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              <Miniaturas fotos={ordenadas} indice={indice} baixar={baixar} aoEscolher={setAtualId} />
              {largo ? null : <PainelDeBaixo foto={atual} />}
            </>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function DadosDaFoto({ foto }: { foto: FotoDaLinha }) {
  return (
    <>
      <Texto variante="bloco" nivel={3}>Dados da foto</Texto>
      <ListaDeDados>
        <LinhaDeDado rotulo="Data" valor={dataParaTela(foto.data)} numerico />
        {foto.posicao ? <LinhaDeDado rotulo="Ângulo" valor={foto.posicao} /> : null}
        <LinhaDeDado rotulo="Peso registrado" valor={pesoDaFoto(foto)} numerico />
        <LinhaDeDado rotulo="Enviada por" valor={quemEnviou(foto)} />
      </ListaDeDados>
    </>
  );
}

/** Área escura da foto, com as setas e o deslize. Mede a si mesma e passa à foto a área livre. */
function Palco({ largo, indice, total, aoIr, children }: {
  largo: boolean;
  indice: number;
  total: number;
  aoIr: (passo: -1 | 1) => void;
  children: (area: { largura: number; altura: number }) => ReactNode;
}) {
  const [medida, setMedida] = useState({ largura: 0, altura: 0 });
  const folgaX = largo ? MARGEM_DAS_SETAS : espaco(1);
  const area = { largura: medida.largura - 2 * folgaX, altura: medida.altura - 2 * espaco(largo ? 3 : 1) };
  // Arrastar na horizontal troca de foto; o vertical fica com a rolagem e o painel.
  const deslize = Gesture.Pan().runOnJS(true).activeOffsetX([-16, 16]).failOffsetY([-24, 24])
    .onEnd((evento) => {
      const passo = passoDoDeslize(evento.translationX);
      if (passo) aoIr(passo);
    });
  return (
    <GestureDetector gesture={deslize}>
      <View style={[estilos.palco, { backgroundColor: ESCURO.fundo }]}
        onLayout={(e) => setMedida({ largura: Math.floor(e.nativeEvent.layout.width), altura: Math.floor(e.nativeEvent.layout.height) })}>
        {area.largura > 0 && area.altura > 0 ? children(area) : null}
        <SetaDoPalco Icone={ChevronLeft} rotulo="Foto anterior" motivo="Esta é a primeira foto." lado="esquerda"
          desabilitada={vizinho(indice, total, -1) === null} aoTocar={() => aoIr(-1)} />
        <SetaDoPalco Icone={ChevronRight} rotulo="Próxima foto" motivo="Esta é a última foto." lado="direita"
          desabilitada={vizinho(indice, total, 1) === null} aoTocar={() => aoIr(1)} />
      </View>
    </GestureDetector>
  );
}

/** Seta sobre o palco: círculo da camada da foto, ícone e anel de foco brancos (o anel do tema some no escuro). */
function SetaDoPalco({ Icone, rotulo, motivo, lado, desabilitada, aoTocar }: {
  Icone: LucideIcon;
  rotulo: string;
  motivo: string;
  lado: 'esquerda' | 'direita';
  desabilitada: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityHint={desabilitada ? motivo : undefined}
      accessibilityState={{ disabled: desabilitada }} aria-disabled={desabilitada} disabled={desabilitada} onPress={aoTocar}
      style={(estado) => [
        estilos.seta, lado === 'esquerda' ? estilos.setaEsquerda : estilos.setaDireita,
        { backgroundColor: sobre(estado) && !desabilitada ? CAMADA_DA_FOTO.sobre : CAMADA_DA_FOTO.fundo },
        estilos.anelBranco,
      ]}>
      {/* Desabilitada é cinza, sem opacidade (regra do projeto). */}
      <Icone size={24} color={desabilitada ? CAMADA_DA_FOTO.iconeDesabilitado : CAMADA_DA_FOTO.icone} strokeWidth={2} />
    </Pressable>
  );
}

/** Faixa rolável das miniaturas, com a aberta marcada (anel neutro do texto) e sempre à vista. */
function Miniaturas({ fotos, indice, baixar, aoEscolher }: {
  fotos: readonly FotoDaLinha[];
  indice: number;
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
  aoEscolher: (fotoId: string) => void;
}) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef<ScrollView>(null);
  const [largura, setLargura] = useState(0);
  const passo = MINIATURA + 2 * ANEL * 2 + VAO_DAS_MINIATURAS;
  // shortcut: cada miniatura baixa a foto inteira (a mesma do cartão e a do palco: até 3 cópias por foto, sem cache entre
  // elas); trocar por miniatura no servidor ou por um cache de blobs por foto se o aluno tiver muitas fotos.
  useEffect(() => {
    if (!largura) return;
    rolagem.current?.scrollTo({ x: Math.max(0, indice * passo - (largura - passo) / 2), animated: !reduzido });
  }, [indice, largura, passo, reduzido]);
  return (
    <View style={[estilos.faixaDasMiniaturas, { backgroundColor: cores.superficie, borderTopColor: cores.divisor }]}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <ScrollView ref={rolagem} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.rolagemDasMiniaturas}>
        <View role="list" aria-label="Todas as fotos" style={estilos.miniaturas}>
        {fotos.map((foto, i) => {
          const aberta = i === indice;
          return (
            <View key={foto.fotoId} role="listitem">
              {/* Botão próprio: o `imagebutton` da `ImagemProtegida` não vira papel nenhum na web. */}
              {/* A aberta: `aria-current` na web e ", aberta" no nome (o leitor do celular não lê o `aria-current`). */}
              <Pressable accessibilityRole="button" aria-current={aberta ? 'true' : undefined}
                accessibilityLabel={`${textoDaPosicao(i, fotos.length)}: ${foto.posicao || 'Foto'}, ${dataParaTela(foto.data)}${aberta ? ', aberta' : ''}`}
                onPress={() => aoEscolher(foto.fotoId)} style={[estilos.moldura, { borderColor: aberta ? cores.texto : 'transparent' }]}>
                <ImagemProtegida chave={`lista:${foto.fotoId}`} carregar={() => baixar(foto)} tamanho={MINIATURA} descricao={foto.posicao || 'Foto'} dentroDeBotao />
              </Pressable>
            </View>
          );
        })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Celular: os dados ficam num painel recolhido embaixo; tocar ou puxar para cima abre, puxar para baixo recolhe. */
function PainelDeBaixo({ foto }: { foto: FotoDaLinha }) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const puxar = Gesture.Pan().runOnJS(true).activeOffsetY([-12, 12])
    .onEnd((evento) => {
      if (evento.translationY < -24) setAberto(true);
      else if (evento.translationY > 24) setAberto(false);
    });
  const resumo = [dataParaTela(foto.data), foto.posicao, pesoDaFoto(foto)].filter(Boolean).join(' · ');
  const Seta = aberto ? ChevronDown : ChevronUp;
  return (
    <View style={[estilos.painelDeBaixo, { backgroundColor: cores.superficie, borderTopColor: cores.divisor }]}>
      <GestureDetector gesture={puxar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dados da foto" accessibilityState={{ expanded: aberto }} aria-expanded={aberto}
          onPress={() => setAberto((a) => !a)} style={estilos.alca}>
          <View style={[estilos.pegador, { backgroundColor: cores.bordaCampo }]} />
          <View style={estilos.linhaDaAlca}>
            <Texto numerico style={estilos.resumo} numberOfLines={1}>{resumo}</Texto>
            <Seta size={20} color={cores.texto} strokeWidth={2} />
          </View>
        </Pressable>
      </GestureDetector>
      {aberto ? (
        <ScrollView style={estilos.dadosDeBaixo} contentContainerStyle={estilos.conteudoDeBaixo}>
          <DadosDaFoto foto={foto} />
        </ScrollView>
      ) : null}
    </View>
  );
}

/**
 * Na web o `Modal` do react-native-web põe `role=dialog` sem nome na camada de tela cheia em volta: o leitor de tela
 * anunciaria dois diálogos. O papel sai dela (e volta a sair se ela o repuser), como na `Folha`.
 */
// shortcut: cópia do `semPapelNoModal` de `ui/Folha.tsx`; exportar o de lá e usar aqui quando a `Folha` puder ser mexida.
function semPapelNoModal(modal: Modal | null) {
  if (Platform.OS !== 'web' || typeof MutationObserver === 'undefined' || !modal) return;
  const no = modal as unknown as HTMLElement;
  const limpar = () => {
    if (no.hasAttribute('role')) no.removeAttribute('role');
    if (no.hasAttribute('aria-modal')) no.removeAttribute('aria-modal');
  };
  limpar();
  const observador = new MutationObserver(limpar);
  observador.observe(no, { attributes: true, attributeFilter: ['role', 'aria-modal'] });
  return () => observador.disconnect();
}

/** Web: o foco entra no "Fechar" ao abrir (as setas do teclado já trocam de foto) e volta a quem abriu ao sair. */
function useFocoDoDialogo() {
  const [quemAbriu] = useState(() => (Platform.OS === 'web' ? (document.activeElement as HTMLElement | null) : null));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.querySelector<HTMLElement>('[data-fechar-visualizador] button, [data-fechar-visualizador] [tabindex="0"]')?.focus();
    return () => {
      if (quemAbriu?.isConnected) quemAbriu.focus();
    };
  }, [quemAbriu]);
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5),
    paddingLeft: espaco(2), paddingRight: espaco(1.5), paddingBottom: espaco(1), borderBottomWidth: LINHA_DA_FAIXA,
  },
  titulo: { flexShrink: 1 },
  acoesDoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  meio: { flex: 1, minHeight: 0, flexDirection: 'row' },
  meioEmColuna: { flexDirection: 'column' },
  palco: { flex: 1, minHeight: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  seta: { position: 'absolute', top: '50%', marginTop: -ALVO_TOQUE / 2, width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: ALVO_TOQUE / 2, alignItems: 'center', justifyContent: 'center' },
  setaEsquerda: { left: espaco(1.5) },
  setaDireita: { right: espaco(1.5) },
  // O anel de foco global usa a cor do texto do tema; sobre o palco escuro ele é branco em todos os temas.
  anelBranco: { outlineColor: CAMADA_DA_FOTO.icone } as unknown as ViewStyle,
  painelLateral: { width: LARGURA_DO_PAINEL, borderLeftWidth: 1 },
  conteudoDoPainel: { padding: espaco(3), gap: espaco(1.5) },
  faixaDasMiniaturas: { borderTopWidth: 1 },
  rolagemDasMiniaturas: { paddingHorizontal: espaco(2), paddingVertical: espaco(1.5) },
  miniaturas: { flexDirection: 'row', gap: VAO_DAS_MINIATURAS },
  moldura: { borderWidth: ANEL, padding: ANEL, borderRadius: RAIO_CONTROLE + 2 * ANEL },
  painelDeBaixo: { borderTopWidth: 1 },
  alca: { minHeight: 56, paddingHorizontal: espaco(2), paddingTop: espaco(0.75), paddingBottom: espaco(1), gap: espaco(0.75) },
  pegador: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  linhaDaAlca: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  resumo: { flex: 1 },
  dadosDeBaixo: { maxHeight: 280 },
  conteudoDeBaixo: { paddingHorizontal: espaco(2), paddingBottom: espaco(2), gap: espaco(1) },
});
