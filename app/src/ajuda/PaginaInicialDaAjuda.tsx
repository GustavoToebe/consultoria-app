import { router, type Href } from 'expo-router';
import {
  BellRing, BookOpen, CalendarClock, CalendarCog, CalendarDays, CircleHelp, CircleUserRound, ClipboardCheck, ClipboardList,
  Dumbbell, FileSignature, FileSpreadsheet, Folder, Globe, HeartPulse, House, Library, MessageSquare, MousePointerClick, PlayCircle, RefreshCw,
  RotateCcw, Salad, Settings, ShieldCheck, Store, Trophy, UserPlus, Users, Wallet, WifiOff, type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AVISO_DE_VOLTA, mostrarDeNovo } from '../dominio/primeirosPassos';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_TEXTO_CORRIDO, RAIO } from '../tema/tokens';
import { usePrimeirosPassosGuardados } from '../treinador/painel/usePrimeirosPassosGuardados';
import { AlvoDeRolagem } from '../ui/AlvoDeRolagem';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Alerta } from '../ui/Estados';
import { Grade } from '../ui/Grade';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';
import { ALVO_DO_ARTIGO } from './ArtigoDaAjuda';
import type { Artigo } from './busca';
import type { Guia, Publico } from './conteudo';

/** Ícone de cada assunto na grade (neutro: a cor é sinal, não enfeite); assunto sem entrada usa o livro. */
const ICONE_DO_ASSUNTO: Readonly<Record<string, LucideIcon>> = {
  inicio: House, alunos: Users, importacao: FileSpreadsheet, interessados: UserPlus, agenda: CalendarDays, 'agendas-e-eventos': CalendarCog,
  comunidade: MessageSquare, privacidade: ShieldCheck, pastas: Folder, biblioteca: Library, planos: Dumbbell, 'cardio-e-hiit': HeartPulse,
  registros: ClipboardList, 'treinos-concluidos': Trophy, atualizacoes: RefreshCw, 'regras-de-atencao': BellRing, anamnese: ClipboardCheck,
  consultoria: Settings, financeiro: Wallet, contratos: FileSignature, vitrine: Store, 'vitrine-pagina-publica': Globe,
  compromissos: CalendarClock, treino: Dumbbell, 'concluir-treino': Trophy, dieta: Salad, 'sem-internet': WifiOff, atualizacao: RefreshCw,
  conta: CircleUserRound, 'meu-plano': Wallet, contrato: FileSignature, perguntas: CircleHelp,
};

const colunasDasAcoes = (largura: number) => (largura >= 900 ? 3 : largura >= 560 ? 2 : 1);
/** Cartões de assunto de ~240 px, até 4 por linha. */
const colunasDosAssuntos = (largura: number) => Math.max(1, Math.min(4, Math.floor((largura + espaco(1.5)) / (240 + espaco(1.5)))));

/**
 * Página inicial da Ajuda ("Começar a usar"): o tutorial, o passeio pelo menu e os Primeiros passos lado a lado e,
 * embaixo, a grade dos assuntos, cada um com ícone, nome e contagem, que abre o artigo.
 */
export function PaginaInicialDaAjuda({ publico, guia, artigos, comPrimeirosPassos, aoTutorial, aoConhecerOMenu, aoAbrir }: {
  publico: Publico; guia: Guia; artigos: readonly Artigo[]; comPrimeirosPassos: boolean;
  aoTutorial: () => void; aoConhecerOMenu: () => void; aoAbrir: (id: string) => void;
}) {
  return (
    <View style={estilos.pagina}>
      {/* O mesmo alvo do topo do artigo: voltar a "Começar a usar" pelo índice leva ao topo da página. */}
      <AlvoDeRolagem chave={ALVO_DO_ARTIGO}>
        <View style={estilos.cabeca}>
          <Texto variante="bloco" nivel={2} style={estilos.tituloDaPagina}>Começar a usar</Texto>
          <Texto variante="suave" style={estilos.textoCorrido}>O tutorial e o passeio pelo menu mostram o app na ordem de uso; os assuntos abaixo explicam cada tela.</Texto>
        </View>
      </AlvoDeRolagem>
      <Grade colunas={colunasDasAcoes} gap={espaco(1.5)}>
        <Cartao titulo="Tutorial passo a passo" nivel={3}>
          <Texto variante="suave">{`Passa pelas telas na ordem em que você vai usá-las (${guia.tutorial.length} passos). Dá para sair a qualquer momento.`}</Texto>
          <LinhaDeAcoes><Botao rotulo="Começar o tutorial" Icone={PlayCircle} aoTocar={aoTutorial} /></LinhaDeAcoes>
        </Cartao>
        <Cartao titulo="Conhecer o menu" nivel={3}>
          <Texto variante="suave">Destaca cada item do menu, como no primeiro acesso. Dá para sair a qualquer momento.</Texto>
          <LinhaDeAcoes><Botao rotulo="Conhecer o menu" tipo="secundario" Icone={MousePointerClick} aoTocar={aoConhecerOMenu} /></LinhaDeAcoes>
        </Cartao>
        {comPrimeirosPassos && publico === 'treinador' ? <CartaoPrimeirosPassosDoTreinador /> : null}
      </Grade>
      {comPrimeirosPassos && publico === 'aluno' ? <PrimeirosPassosDoAluno guia={guia} /> : null}
      <View style={estilos.cabeca}>
        <Texto variante="bloco" nivel={2} style={estilos.tituloDaPagina}>Assuntos</Texto>
      </View>
      <Grade colunas={colunasDosAssuntos} gap={espaco(1.5)}>
        {artigos.map((a) => <CartaoDoAssunto key={a.id} artigo={a} aoAbrir={() => aoAbrir(a.id)} />)}
      </Grade>
    </View>
  );
}

function CartaoDoAssunto({ artigo, aoAbrir }: { artigo: Artigo; aoAbrir: () => void }) {
  const { cores } = useTema();
  const Icone = ICONE_DO_ASSUNTO[artigo.id] ?? BookOpen;
  const quantos = artigo.topicos.length;
  const contagem = `${quantos} ${quantos === 1 ? 'tópico' : 'tópicos'}`;
  return (
    <Pressable accessibilityRole="button" aria-label={`${artigo.titulo}, ${contagem}`} onPress={aoAbrir}
      style={(estado) => [estilos.assunto, { backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie, borderColor: cores.divisor }]}>
      <Icone size={22} color={cores.textoSuave} aria-hidden />
      <View style={estilos.textoDoAssunto}>
        <Texto variante="bloco">{artigo.titulo}</Texto>
        <Texto variante="suave" numerico>{contagem}</Texto>
      </View>
    </Pressable>
  );
}

function PrimeirosPassosDoAluno({ guia }: { guia: Guia }) {
  const passos = guia.primeirosPassos.filter((p) => !p.soNoPdf);
  return (
    <Cartao titulo="Primeiros passos" nivel={3}>
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
    <Cartao titulo="Primeiros passos" nivel={3}>
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

const estilos = StyleSheet.create({
  pagina: { gap: espaco(3) },
  cabeca: { gap: espaco(0.5) },
  tituloDaPagina: { fontSize: 20, lineHeight: 26 },
  textoCorrido: { maxWidth: LARGURA_TEXTO_CORRIDO },
  assunto: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(2), borderRadius: RAIO, borderWidth: 1 },
  textoDoAssunto: { flex: 1, minWidth: 0, gap: 2 },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  textoDoPasso: { flex: 1, minWidth: 220, gap: espaco(0.5) },
});
