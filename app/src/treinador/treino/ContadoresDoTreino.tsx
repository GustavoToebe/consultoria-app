import { CircleAlert, CircleCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoTreino, Problema } from '../../api/tipos';
import { contarPlano, textoDoPlanoInteiro } from '../../dominio/contagemDoTreino';
import { primeiraPendencia, type PrimeiraPendencia } from '../../dominio/editorDeTreino';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { useRolagem } from '../../ui/RolagemComTopo';
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
}

/** "Sem pendências" / "Pronto para publicar" ou "N pendências · Ir à primeira pendência". Só informa: nada trava salvar. */
export function EstadoDasPendencias({ conteudo, erros, modelo, aoIrAPendencia }: PropsDoEstado) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const pendencia = primeiraPendencia(conteudo, erros);
  if (!pendencia) {
    return (
      <View style={[estilos.estado, { borderColor: cores.sucesso, backgroundColor: cores.superficie }]}>
        <CircleCheck size={16} color={cores.sucesso} />
        <Texto cor={cores.sucesso} style={estilos.forte}>{modelo ? 'Sem pendências' : 'Pronto para publicar'}</Texto>
      </View>
    );
  }
  const ir = () => {
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
  const quantas = modelo ? `${pendencia.total} ${pendencia.total === 1 ? 'pendência' : 'pendências'}` : textoDosProblemas(pendencia.total);
  return (
    <Pressable accessibilityRole="button" onPress={ir}
      style={(estado) => [estilos.estado, { borderColor: cores.perigo, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie }]}>
      <CircleAlert size={16} color={cores.perigo} />
      <Texto cor={cores.perigo} style={estilos.forte}>{`${quantas} · Ir à primeira pendência`}</Texto>
    </Pressable>
  );
}

/**
 * Cabeçalho "Sessões (N)" do editor: embaixo do título, em texto, o plano inteiro ("Plano inteiro: 6 sessões · 32
 * exercícios · 120 séries cadastradas"); os totais da sessão aberta moram no cabeçalho dela (10/11). À direita, a ação
 * ("Colar treino") e o estado das pendências, pela mesma validação da publicação, ao vivo.
 */
export function ContadoresDoTreino({ acao, ...estado }: PropsDoEstado & {
  /** Ação do cabeçalho, antes do estado ("Colar treino (Docs / PDF)"). */
  acao?: ReactNode;
}) {
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" nivel={2}>{`Sessões (${estado.conteudo.sessoes.length})`}</Texto>
        <Contagem texto={textoDoPlanoInteiro(contarPlano(estado.conteudo))} />
      </View>
      <View style={estilos.direita}>
        {acao}
        <EstadoDasPendencias {...estado} />
      </View>
    </View>
  );
}

/** Uma contagem em texto suave: o "de quê" ("Plano inteiro:") em semi e os números depois. */
function Contagem({ texto }: { texto: string }) {
  const corte = texto.indexOf(': ');
  const titulo = corte >= 0 ? texto.slice(0, corte + 1) : '';
  const numeros = corte >= 0 ? texto.slice(corte + 2) : texto;
  return (
    <Texto variante="suave" numerico style={estilos.contagem}>
      {titulo ? <Texto variante="suave" numerico style={estilos.forte}>{titulo} </Texto> : null}{numeros}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 280, gap: espaco(0.5) },
  direita: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  // Em 390 px ou com texto grande a contagem quebra linha em vez de sair da tela.
  contagem: { flexShrink: 1 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), borderWidth: 1, borderRadius: RAIO, maxWidth: '100%' },
  forte: { fontFamily: fontes.semi, flexShrink: 1 },
});
