import { router, type Href } from 'expo-router';
import { ChevronDown, ChevronUp, FileDown, MousePointerClick, PlayCircle, RotateCcw } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AVISO_DE_VOLTA, mostrarDeNovo } from '../dominio/primeirosPassos';
import { useSessao } from '../sessao/SessaoProvider';
import { usePrimeirosPassosGuardados } from '../treinador/painel/usePrimeirosPassosGuardados';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_EDITOR } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { Cartao } from '../ui/Cartao';
import { Alerta } from '../ui/Estados';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { usePasseio } from '../ui/Passeio';
import { sobre } from '../ui/sobre';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { GUIAS, secoesDoGuia, textoDoItem, type Publico } from './conteudo';
import { TutorialGuiado } from './TutorialGuiado';

/**
 * Ajuda de cada área: "Conhecer o app" (o passeio pelo menu e o tutorial passo a passo, que antes eram dois cartões com
 * nomes parecidos), primeiros passos (aluno: a lista com "Abrir"; treinador: o "Mostrar no Início de novo"), guia em PDF (web) e um cartão só
 * com as seções e as perguntas, cada uma numa linha que abre (antes eram vários cartões de ~85 px). Passo só do PDF (o
 * convite, para quem ainda não entrou) não aparece aqui. A seta de voltar vem do `Cabecalho` (origem: Perfil ou Conta).
 */
export function TelaAjuda({ publico }: { publico: Publico }) {
  const guia = GUIAS[publico];
  const [tutorial, setTutorial] = useState(false);
  const { rever } = usePasseio();
  const { cicloHabilitado, retornoHabilitado } = useSessao();
  const passos = guia.primeirosPassos.filter((p) => !p.soNoPdf);
  return (
    <Tela bordas={['top']} largura={publico === 'aluno' ? 720 : LARGURA_EDITOR}>
      <Cabecalho titulo="Ajuda" subtitulo={guia.introducao} />
      <Cartao titulo="Conhecer o app">
        <Texto variante="suave">
          {`O tutorial passa pelas telas, na ordem em que você vai usá-las (${guia.tutorial.length} passos). "Conhecer o menu" destaca cada item do menu, como no primeiro acesso. Dá para sair dos dois a qualquer momento.`}
        </Texto>
        <LinhaDeAcoes>
          <Botao rotulo="Tutorial passo a passo" Icone={PlayCircle} aoTocar={() => setTutorial(true)} />
          <Botao rotulo="Conhecer o menu" tipo="secundario" Icone={MousePointerClick} aoTocar={rever} />
        </LinhaDeAcoes>
      </Cartao>
      {publico === 'treinador' ? <CartaoPrimeirosPassosDoTreinador /> : (
        <Cartao titulo="Primeiros passos">
          {passos.map((p, i) => (
            <View key={p.titulo} style={estilos.passo}>
              <View style={estilos.textoDoPasso}>
                <Texto numerico variante="bloco">{i + 1}. {p.titulo}</Texto>
                <Texto variante="suave">{p.texto}</Texto>
              </View>
              {p.rota ? (
                <Botao rotulo="Abrir" rotuloAcessivel={`Abrir: ${p.titulo}`} tipo="secundario" aoTocar={() => router.navigate(p.rota as Href)} />
              ) : null}
            </View>
          ))}
        </Cartao>
      )}
      {Platform.OS === 'web' ? (
        <Cartao titulo="Guia do usuário em PDF" descricao="Para ler com calma, imprimir ou enviar."
          acoes={<Botao rotulo="Abrir o guia" rotuloAcessivel={`Abrir ${guia.titulo.toLowerCase()}`} tipo="secundario" Icone={FileDown} aoTocar={() => void Linking.openURL(`/guias/${guia.arquivoPdf}`)} />}>{null}</Cartao>
      ) : null}
      <Cartao titulo="Como usar">
        {secoesDoGuia(guia, retornoHabilitado).map((s) => (
          <LinhaRecolhivel key={s.titulo} titulo={s.titulo}>
            {s.itens.map((item) => (
              <View key={item.titulo} style={estilos.item}>
                <Texto variante="rotulo">{item.titulo}</Texto>
                <Texto>{textoDoItem(item.texto, cicloHabilitado)}</Texto>
              </View>
            ))}
          </LinhaRecolhivel>
        ))}
        <LinhaRecolhivel titulo="Perguntas frequentes">
          {guia.perguntas.map((p) => (
            <View key={p.pergunta} style={estilos.item}>
              <Texto variante="rotulo">{p.pergunta}</Texto>
              <Texto>{p.resposta}</Texto>
            </View>
          ))}
        </LinhaRecolhivel>
      </Cartao>
      {tutorial ? <TutorialGuiado passos={guia.tutorial} aoFechar={() => setTutorial(false)} /> : null}
    </Tela>
  );
}

/**
 * Treinador: os Primeiros passos moram no Início (bloco no topo). Aqui fica o texto curto e o "Mostrar no Início de novo"
 * para quem dispensou ou fechou; a lista dos passos (o `guia.primeirosPassos`) segue no guia em PDF.
 */
function CartaoPrimeirosPassosDoTreinador() {
  const { usuario } = useSessao();
  const { estado, gravar } = usePrimeirosPassosGuardados(usuario?.id ?? null);
  const [voltou, setVoltou] = useState(false);
  const noInicio = !!estado && !estado.dispensado && !estado.fechado;
  const motivo = !estado ? 'Conferindo o que ficou salvo neste aparelho.' : noInicio && !voltou ? 'Eles já estão no Início.' : undefined;
  return (
    <Cartao titulo="Primeiros passos">
      <Texto variante="suave">
        No topo do Início, enquanto você monta a consultoria: marca e logo, metodologia, modelos de treino, o primeiro aluno, o acesso dele ao app e o link de inscrição. Cada item abre a tela certa. Se dispensou ou fechou, traga de volta por aqui.
      </Texto>
      {voltou ? <Alerta tom="sucesso" texto={AVISO_DE_VOLTA} /> : null}
      <LinhaDeAcoes>
        <Botao rotulo="Mostrar no Início de novo" tipo="secundario" Icone={RotateCcw} desabilitado={!!motivo || voltou} motivo={voltou ? undefined : motivo}
          aoTocar={() => {
            gravar(mostrarDeNovo);
            setVoltou(true);
          }} />
        {noInicio ? <Botao rotulo="Abrir o Início" tipo="fantasma" aoTocar={() => router.navigate('/treinador')} /> : null}
      </LinhaDeAcoes>
    </Cartao>
  );
}

/** Linha que abre e fecha o conteúdo, com divisor; o título é o botão (alvo de 44 px). */
function LinhaRecolhivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  const Seta = aberta ? ChevronUp : ChevronDown;
  return (
    <View style={[estilos.linha, { borderColor: cores.divisor }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={titulo} accessibilityState={{ expanded: aberta }}
        onPress={() => setAberta((v) => !v)}
        style={(estado) => [estilos.cabecaLinha, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
        <Texto variante="bloco" nivel={3} style={estilos.tituloLinha}>{titulo}</Texto>
        <Seta size={18} color={cores.textoSuave} />
      </Pressable>
      {aberta ? <View style={estilos.corpoLinha}>{children}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  textoDoPasso: { flex: 1, minWidth: 220, gap: espaco(0.5) },
  item: { gap: espaco(0.25) },
  linha: { borderTopWidth: 1 },
  cabecaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(0.5) },
  tituloLinha: { flexShrink: 1 },
  corpoLinha: { gap: espaco(1.5), paddingHorizontal: espaco(0.5), paddingBottom: espaco(2) },
});
