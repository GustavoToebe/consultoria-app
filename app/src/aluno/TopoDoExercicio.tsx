import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Sessao } from '../api/tipos';
import { duracaoDoTreino } from '../dominio/conclusaoDoTreino';
import { TETO_DA_TELA_DO_ALUNO } from '../dominio/telaLargaDoAluno';
import type { ProgressoDoExercicio } from '../dominio/telaDoExercicio';
import { duracaoDaFaixa, duracaoFalada, textoDaDuracaoAoVivo } from '../dominio/treinoAoVivo';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { useFundoDaArea } from '../ui/fundoDaArea';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { IconeBotao } from '../ui/IconeBotao';
import { Texto } from '../ui/Texto';

/**
 * Topo fixo da tela do exercício (25/11): voltar, "Quarta - Pernas" e "Exercício 1 de 5", o tempo do treino (fonte
 * numérica) e uma barra por exercício da sessão. O tempo só aparece quando existe (com "Concluir treino" ligado e a
 * primeira série marcada hoje; "—" não aparece). Neutro: a barra cheia é `texto`, o trilho `superficie3`.
 */
export function TopoDoExercicio({ titulo, posicao, voltar, progresso, atual, versaoId, sessao, data, hoje, bloco }: {
  titulo: string;
  posicao: string;
  voltar: Href;
  progresso: ProgressoDoExercicio[];
  /** Índice do exercício aberto. */
  atual: number;
  versaoId: string;
  sessao: Sessao;
  data: string;
  hoje: string;
  /**
   * Na web larga, o bloco do conteúdo medido pela rota (`esquerda` a partir da borda deste topo): o topo se alinha a ele, e
   * não à janela (a barra de rolagem da página desloca o conteúdo). Sem ele, centralizado no teto do aluno.
   */
  bloco?: { esquerda: number; largura: number } | null;
}) {
  const { cores } = useTema();
  const fundo = useFundoDaArea();
  const { confirmar } = useSaidaGuardada();
  const completos = progresso.filter((x) => x.completo).length;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: fundo, borderBottomWidth: 1, borderBottomColor: cores.divisor }}>
      <View style={[estilos.conteudo, bloco && { marginLeft: bloco.esquerda, width: bloco.largura, maxWidth: undefined, paddingHorizontal: 0, alignSelf: 'flex-start' }]}>
        <View style={estilos.linha}>
          <IconeBotao Icone={ArrowLeft} rotulo="Voltar" moldura aoTocar={() => confirmar(() => (router.canGoBack() ? router.back() : router.replace(voltar)))} />
          <View style={estilos.textos}>
            <Texto style={estilos.titulo} numberOfLines={1}>{titulo}</Texto>
            <Texto variante="pequeno" numerico>{posicao}</Texto>
          </View>
          <TempoDoTreino versaoId={versaoId} sessao={sessao} data={data} hoje={hoje} />
        </View>
        <View style={estilos.barras} accessible accessibilityRole="progressbar"
          accessibilityLabel={`Exercícios completos: ${completos} de ${progresso.length}`}>
          {progresso.map((x, i) => (
            <View key={x.uid} style={[estilos.trilho, { backgroundColor: cores.superficie3 }, i === atual && { height: 6 }]}>
              <View style={[estilos.cheio, { width: `${x.total > 0 ? Math.min(1, x.feitas / x.total) * 100 : 0}%`, backgroundColor: cores.texto }]} />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** O relógio mora aqui para só esta linha redesenhar a cada segundo, não a tela inteira (como `FaixaDoTreino`). */
function TempoDoTreino({ versaoId, sessao, data, hoje }: { versaoId: string; sessao: Sessao; data: string; hoje: string }) {
  const { retornoHabilitado } = useSessao();
  const { inicioDoTreino, sessaoConcluidaDe } = useAluno();
  const inicio = inicioDoTreino(versaoId, sessao.uid, data);
  const conclusao = sessaoConcluidaDe(versaoId, sessao.uid, data);
  const contando = retornoHabilitado && !!inicio && !conclusao?.concluida && data === hoje;
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!contando) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [contando]);
  if (!retornoHabilitado) return null;
  const { segundos } = duracaoDaFaixa({ concluida: conclusao?.concluida ? conclusao : null, data, hoje, contada: duracaoDoTreino(inicio, new Date(agora)) });
  const texto = textoDaDuracaoAoVivo(segundos);
  if (texto === '—') return null;
  return <Texto numerico style={estilos.tempo} accessibilityLabel={`Duração do treino: ${duracaoFalada(segundos)}`}>{texto}</Texto>;
}

const estilos = StyleSheet.create({
  conteudo: { width: '100%', maxWidth: TETO_DA_TELA_DO_ALUNO, alignSelf: 'center', paddingHorizontal: espaco(2), paddingTop: espaco(0.5), paddingBottom: espaco(1), gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  textos: { flex: 1, minWidth: 0 },
  titulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  tempo: { fontFamily: fontes.mono, fontSize: 16, fontVariant: ['tabular-nums'] },
  barras: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  trilho: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden' },
  cheio: { height: '100%' },
});
