import { useRouter, type Href } from 'expo-router';
import { Check, FileSearch, FileSpreadsheet, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Folha } from '../../ui/Folha';
import { depoisDeFecharAsFolhas, marcarFolhaDoTopoFechando } from '../../ui/historicoDasFolhas';
import { LinkTexto } from '../../ui/LinkTexto';
import { coresDaEdicao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

type Opcao = 'manual' | 'assistida';

/** Tópicos tirados do que cada fluxo faz hoje (`AssistenteDaImportacao` e `PainelImportacaoAssistida`); não prometer recurso que não existe. */
const OPCOES: { valor: Opcao; titulo: string; Icone: LucideIcon; topicos: string[]; rota: Href }[] = [
  {
    valor: 'manual', titulo: 'Importação manual', Icone: FileSpreadsheet, rota: '/treinador/importacao/nova',
    topicos: [
      'Uma planilha .xlsx ou .csv no modelo, para o destino que você escolhe.',
      'Você confere coluna por coluna e pode corrigir uma célula ou tirar uma linha.',
      'Valida antes de gravar: mostra o que é novo, atualizado ou tem erro.',
    ],
  },
  {
    valor: 'assistida', titulo: 'Importação assistida', Icone: FileSearch, rota: '/treinador/importacao/assistida',
    topicos: [
      'PDF, DOCX, planilhas e texto colado num lote só.',
      'O app lê, separa por aluno e sugere; você responde as dúvidas e confere.',
      'Treino e dieta entram como rascunho: nada vai ao aluno sem publicar.',
    ],
  },
];

/** O mesmo destino do antigo botão da tela: cria o modelo de Semana de Treino já com a Folha de colar aberta. */
const COLAR_TREINO: Href = { pathname: '/treinador/planejamento', params: { aba: 'treino', tipo: 'plano_treino', novo: '1', colar: '1' } };

const PASSO_DA_TECLA: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * "Nova importação": escolha entre a manual e a assistida, como um grupo de rádio em cartões (nenhuma vem marcada).
 * Na web as setas trocam a opção (o foco vai junto, roving tabindex), Home e End vão às pontas, Espaço marca e Enter
 * continua. Continuar fecha a Folha e só então navega, para a entrada dela no histórico não sobrar.
 */
export function FolhaNovaImportacao({ aoFechar }: { aoFechar: () => void }) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const router = useRouter();
  const [escolha, setEscolha] = useState<Opcao | null>(null);
  const cartoes = useRef<(View | null)[]>([]);

  const continuar = (valor: Opcao | null) => {
    const rota = OPCOES.find((o) => o.valor === valor)?.rota;
    if (!rota) return;
    marcarFolhaDoTopoFechando();
    aoFechar();
    depoisDeFecharAsFolhas(() => router.push(rota));
  };

  const aoTecla = (i: number) => (e: { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void }) => {
    const tecla = e.key ?? e.nativeEvent?.key ?? '';
    if (tecla === 'Enter') {
      e.preventDefault?.();
      continuar(escolha);
      return;
    }
    if (tecla === ' ') {
      e.preventDefault?.();
      setEscolha(OPCOES[i].valor);
      return;
    }
    const alvo = tecla === 'Home' ? 0 : tecla === 'End' ? OPCOES.length - 1 : PASSO_DA_TECLA[tecla] !== undefined ? (i + PASSO_DA_TECLA[tecla] + OPCOES.length) % OPCOES.length : null;
    if (alvo === null) return;
    e.preventDefault?.();
    setEscolha(OPCOES[alvo].valor);
    cartoes.current[alvo]?.focus();
  };
  // Só um cartão no Tab: o escolhido ou, sem escolha, o primeiro.
  const parada = Math.max(0, OPCOES.findIndex((o) => o.valor === escolha));
  const edicao = coresDaEdicao(cores);

  return (
    <Folha visivel titulo="Nova importação" aoFechar={aoFechar} largura={LARGURA_FOLHA_LARGA}
      rodape={<>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
        <Botao rotulo="Continuar" desabilitado={escolha === null} motivo="Escolha uma das opções para continuar." aoTocar={() => continuar(escolha)} />
      </>}>
      <Texto variante="suave">Escolha como quer importar</Texto>
      <View role="radiogroup" aria-label="Como importar" accessibilityRole="radiogroup" accessibilityLabel="Como importar" style={estilos.opcoes}>
        {OPCOES.map((o, i) => {
          const ativo = o.valor === escolha;
          return (
            <View key={o.valor} style={[estilos.cartao, {
              backgroundColor: ativo ? edicao.fundo : cores.superficie,
              borderColor: ativo ? edicao.borda : cores.divisor,
              // A borda cresce 1 px para dentro (o conteúdo não pula ao escolher), como no `OpcaoCartao`.
              borderWidth: ativo ? 2 : 1,
              margin: ativo ? 0 : 1,
              boxShadow: ativo ? edicao.halo : undefined,
            }]}>
              <Pressable ref={(no) => { cartoes.current[i] = no; }}
                role="radio" accessibilityRole="radio" aria-checked={ativo} accessibilityState={{ checked: ativo }}
                accessibilityLabel={`${o.titulo}. ${o.topicos.join(' ')}`}
                onPress={() => setEscolha(o.valor)}
                {...(Platform.OS === 'web' ? ({ tabIndex: i === parada ? 0 : -1, onKeyDown: aoTecla(i) } as object) : null)}
                style={(e) => [estilos.toque, !ativo && sobre(e) ? { backgroundColor: cores.sobre } : null]}>
                <View style={estilos.topo}>
                  <View style={[estilos.icone, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                    <o.Icone size={20} color={cores.texto} strokeWidth={2} />
                  </View>
                  {/* Marca de rádio: vazia sem escolha, cheia com ✓ na escolhida (a escolha não depende só da cor). */}
                  <View style={[estilos.marca, ativo ? { backgroundColor: edicao.borda, borderColor: edicao.borda } : { borderColor: cores.bordaCampo }]}>
                    {ativo ? <Check size={14} color={cores.superficie} strokeWidth={3} /> : null}
                  </View>
                </View>
                <Texto variante="bloco">{o.titulo}</Texto>
                <View style={estilos.topicos}>
                  {o.topicos.map((t) => (
                    <View key={t} style={estilos.topico}>
                      {/* Marcador em texto: acompanha a linha também com o texto Extra (um ponto desenhado ficava alto). */}
                      <Texto variante="suave" aria-hidden>•</Texto>
                      <Texto variante="suave" style={estilos.textoDoTopico}>{t}</Texto>
                    </View>
                  ))}
                </View>
              </Pressable>
              {/* Fora do rádio (interativo dentro de interativo confunde o leitor de tela e marcaria o cartão). */}
              {o.valor === 'assistida' && pode('MODELO_LER') && pode('MODELO_ALTERAR') ? (
                <View style={estilos.link}><LinkTexto href={COLAR_TREINO} texto="Colar treino de PDF / Docs" /></View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  // Lado a lado na folha média do PC (`LARGURA_FOLHA_LARGA`, a mesma do resultado da planilha completa), na mesma altura
  // (a linha estica os dois); abaixo de ~520 px de conteúdo, um embaixo do outro.
  cartao: { flexGrow: 1, flexBasis: 240, borderRadius: RAIO, overflow: 'hidden' },
  toque: { flexGrow: 1, padding: espaco(2), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  icone: { width: 36, height: 36, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  marca: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  topicos: { gap: espaco(0.75) },
  topico: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDoTopico: { flex: 1 },
  link: { paddingHorizontal: espaco(2), paddingBottom: espaco(1) },
});
