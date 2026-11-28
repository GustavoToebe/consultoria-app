import { ChevronRight, CircleCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino, Problema } from '../../api/tipos';
import { contarPlano, textoDosTotaisDoPlano } from '../../dominio/contagemDoTreino';
import { primeiraPendencia, type PrimeiraPendencia } from '../../dominio/editorDeTreino';
import { pontosDoPlano, resumoDasPendencias, type PontoParaRevisar } from '../../dominio/pontosParaRevisar';
import { uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** Ids no DOM (web) da sessão e da configuração: o foco procura o campo marcado só dentro da área da pendência. */
export const idDaSessao = (uid: string) => `sessao-${uid}`;
export const ID_DA_CONFIGURACAO = 'configuracao-do-treino';

/** Tempo para a seleção (sessão, exercício, bloco) renderizar antes de procurar o campo marcado. */
export const ESPERA_DA_SELECAO = 80;

interface PropsDoEstado {
  conteudo: ConteudoTreino;
  /** Erros vivos: a validação local (sempre ligada aqui) junto com os do servidor (`juntarProblemas`). */
  erros: readonly Problema[];
  /** Modelo do Planejamento: nada se publica, então "Sem pendências"; no plano do aluno, "Pronto para publicar". */
  modelo: boolean;
  /** Seleciona sessão, exercício e bloco da primeira pendência, abre o recolhido e foca o campo (o editor faz). */
  aoIrAPendencia: (p: PrimeiraPendencia, uids: string[]) => void;
  /**
   * Abre a série do ponto para revisar ("Série 5 sem descanso", SERIE-ABERTA 0.6): sessão, exercício e bloco. Só com ele
   * os pontos entram no selo; sem ele o selo conta só os erros, como antes da proposta de 27/11.
   */
  aoIrAoPonto?: (p: PontoParaRevisar) => void;
}

/**
 * O selo das Sessões (proposta de 27/11): "✓ Sem pendências" / "Pronto para publicar" ou "● N pendências", que leva à
 * primeira (o erro que impede publicar antes do ponto para revisar). Texto e tom vêm de `resumoDasPendencias`: vermelho
 * com erro, âmbar só com pontos. Só informa: nada trava salvar.
 */
export function EstadoDasPendencias({ conteudo, erros, modelo, aoIrAPendencia, aoIrAoPonto }: PropsDoEstado) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const resumo = resumoDasPendencias({ erros, pontos: aoIrAoPonto ? pontosDoPlano(conteudo) : [], modelo });
  const alvo = resumo.alvo;
  if (!alvo) {
    return (
      <View style={estilos.estado}>
        <Selo tipo="sucesso" Icone={CircleCheck} texto={resumo.texto} />
      </View>
    );
  }
  const ir = () => {
    if (alvo.tipo === 'ponto') {
      aoIrAoPonto?.(alvo.ponto);
      if (Platform.OS !== 'web') rolarAte([alvo.ponto.exercicioUid, alvo.ponto.sessaoUid]);
      return;
    }
    const pendencia = primeiraPendencia(conteudo, erros);
    if (!pendencia) return;
    const uids = uidsDoPrimeiroProblema(conteudo, erros);
    aoIrAPendencia(pendencia, uids);
    if (Platform.OS !== 'web') { rolarAte(uids); return; }
    // Depois de a seleção abrir sessão, exercício, bloco e o recolhido: foca o 1º campo marcado e o põe no meio da tela
    // (fora da barra grudada). Pendência sem campo (sessão de treino sem exercício) só rola até o item.
    // shortcut: no celular nativo só rola até o item, sem focar o campo; trocar por ref por campo se pedirem foco lá.
    setTimeout(() => {
      const area = pendencia.sessaoUid ? `[id="${idDaSessao(pendencia.sessaoUid)}"]` : `[id="${ID_DA_CONFIGURACAO}"]`;
      const campo = document.querySelector<HTMLElement>(`${area} [aria-invalid="true"]`);
      if (!campo) { rolarAte(uids); return; }
      campo.focus({ preventScroll: true });
      campo.scrollIntoView({ block: 'center' });
    }, ESPERA_DA_SELECAO);
  };
  const tom = resumo.tom === 'perigo' ? 'perigo' : 'atencao';
  // Na tela, o selo e a seta; o nome acessível diz o que o toque faz ("… · Ir à primeira pendência").
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${resumo.texto} · Ir à primeira pendência`} onPress={ir}
      style={(estado) => [estilos.estado, estilos.clicavel, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
      <Selo tipo={tom} texto={resumo.texto} />
      <ChevronRight size={16} color={cores.textoSuave} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Cabeçalho das Sessões do editor (proposta de 27/11): "Sessões" e, na mesma linha, os totais do plano ("7 sessões · 27
 * exercícios · 81 séries"); os da sessão aberta moram no cabeçalho dela. À direita, o selo das pendências (a mesma
 * validação da publicação, ao vivo) e depois a ação ("Colar treino").
 */
export function ContadoresDoTreino({ acao, ...estado }: PropsDoEstado & {
  /** Ação do cabeçalho, depois do selo ("Colar treino (Docs / PDF)"). */
  acao?: ReactNode;
}) {
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" nivel={2}>Sessões</Texto>
        <Texto variante="suave" numerico style={estilos.contagem}>{textoDosTotaisDoPlano(contarPlano(estado.conteudo))}</Texto>
      </View>
      <View style={estilos.direita}>
        <EstadoDasPendencias {...estado} />
        {acao}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  // Título e totais na mesma linha; em 390 px ou com texto grande os totais descem para baixo do título.
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 280, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), rowGap: espaco(0.25) },
  direita: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  contagem: { flexShrink: 1 },
  // A altura do "Colar treino" ao lado; o selo clicável tem o alvo de 44.
  estado: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, maxWidth: '100%' },
  clicavel: { paddingHorizontal: espaco(1), borderRadius: RAIO },
});
