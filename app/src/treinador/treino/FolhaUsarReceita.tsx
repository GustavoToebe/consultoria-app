import { ArrowLeft, ListPlus, Replace } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { listarPastasModelos, listarReceitas } from '../../api/rotas';
import type { Configuracao, Receita } from '../../api/tipos';
import { motivoParaAcrescentar, seriesDaReceita, type ModoDaReceita } from '../../dominio/editorTreino';
import {
  ABAS_DE_RECEITAS, abaInicial, avisoDasSeriesAtuais, contagemPorAba, filtroEfetivo, filtrosDasReceitas, idDaTecla, receitaEscolhida, receitasDaAba,
  receitasDaLista, rotuloDeSubstituir, SEM_FILTRO, type AbaDeReceitas,
} from '../../dominio/listaDeReceitas';
import { trechosDaComposicao } from '../../dominio/receitasDeSeries';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { usePassoNoHistorico } from '../../ui/historicoDasFolhas';
import { corDaSerie } from '../../ui/pinturaDaSerie';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { PreviaDaReceita } from './PreviaDaReceita';

/** Folha grande, só desta tela (27/11): 1100 px no PC; abaixo de 1200 px de janela, 92% dela. */
const LARGURA_DA_FOLHA = 1100;
const JANELA_DA_LARGURA_CHEIA = 1200;
/**
 * O que a folha gasta fora das duas partes (cabeçalho, rodapé com o aviso, respiros e a margem da janela): as partes têm
 * altura fixa para o rodapé não subir e descer enquanto se busca ou filtra; cada uma rola sozinha.
 * shortcut: conferido pelo e2e em 1024×720, 1280×720 (com o motivo sob "Acrescentar ao fim") e 1920×1080; se o rodapé
 * ganhar outra linha fixa, medir de novo.
 */
const FORA_DAS_PARTES = 250;
const ALTURA_MAXIMA_DAS_PARTES = 720;
const ALTURA_MINIMA_DAS_PARTES = 320;

/**
 * "Usar receita" do editor de treino (27/11, pedido do Gustavo): no PC uma folha larga em duas partes, a lista à esquerda
 * (busca, abas Completas, Partes e Minhas com a contagem, chips de tipo e técnica e uma linha por receita com os selos da
 * composição) e a prévia fixa à direita; o rodapé fixo aplica a escolhida ("Substituir as N séries" ou "Acrescentar ao
 * fim"; sem séries, só "Usar receita"). A lista é um `listbox` (APG): só a escolhida entra no Tab, setas, Home e End trocam
 * a escolha e Enter aplica. No celular é um passo de cada vez: a lista e, ao tocar, a prévia com "Voltar"; o X, o voltar
 * do aparelho e o do navegador voltam à lista antes de fechar. O editor oferece "Desfazer" depois de aplicar.
 */
export function FolhaUsarReceita({ config, seriesAtuais, aoUsar, aoFechar }: {
  config: Configuracao | null;
  /** Quantas séries o exercício já tem: com alguma, substituir ou acrescentar; sem nenhuma, "Usar receita". */
  seriesAtuais: number;
  aoUsar: (r: Receita, modo: ModoDaReceita) => void;
  aoFechar: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const { cores } = useTema();
  const duasPartes = width >= LARGURA_MENU_LATERAL;
  const largura = width >= JANELA_DA_LARGURA_CHEIA ? LARGURA_DA_FOLHA : Math.round(width * 0.92);
  const alturaDasPartes = Math.min(ALTURA_MAXIMA_DAS_PARTES, Math.max(ALTURA_MINIMA_DAS_PARTES, Math.round(height * 0.9) - FORA_DAS_PARTES));
  const { dados, erro, recarregar } = useCarregar('receitas:SERIES', () => listarReceitas('SERIES'));
  const colecoes = useCarregar('pastas-modelos', listarPastasModelos);
  const [busca, setBusca] = useState('');
  const [abaEscolhida, setAba] = useState<AbaDeReceitas | null>(null);
  const [filtro, setFiltro] = useState(SEM_FILTRO);
  const [idEscolhido, setIdEscolhido] = useState<string | null>(null);
  // Celular: a prévia é um passo da folha. No PC a prévia está sempre à vista e o passo não vale.
  const [naPrevia, setNaPrevia] = useState(false);
  const previaNoCelular = naPrevia && !duasPartes;

  const receitas = useMemo(() => (dados ?? []).filter((r) => r.tipo === 'SERIES'), [dados]);
  const contagem = contagemPorAba(receitas, busca, config);
  // Sem aba escolhida, abre na primeira que tem receita (Completas, senão Partes; "Minhas" só se tocada).
  const aba: AbaDeReceitas = abaEscolhida ?? abaInicial(receitas, config);
  const daAba = useMemo(() => receitasDaAba(receitas, aba, config), [receitas, aba, config]);
  const filtros = useMemo(() => filtrosDasReceitas(daAba, config), [daAba, config]);
  const chip = filtroEfetivo(daAba, filtro, config);
  const lista = receitasDaLista(receitas, { aba, busca, filtro }, config);
  const escolhida = receitaEscolhida(lista, idEscolhido);
  const nomeDaColecao = useMemo(() => new Map((colecoes.dados ?? []).map((c) => [c.id, c.nome])), [colecoes.dados]);

  const voltarALista = () => setNaPrevia(false);
  usePassoNoHistorico(previaNoCelular, voltarALista);

  // Foco (web): setas movem a escolha e o foco juntos; ao abrir a prévia no celular o foco vai ao "Voltar" e, ao voltar, à
  // receita escolhida. Os nós ficam por id, para achar a opção depois de a escolha mudar.
  const opcoes = useRef(new Map<string, View | null>());
  const voltar = useRef<View>(null);
  const focar = (no: View | null | undefined) => {
    const el = no as unknown as HTMLElement | null | undefined;
    el?.focus?.();
    el?.scrollIntoView?.({ block: 'nearest' });
  };
  // Só na troca de passo (a escolha mudar não puxa o foco): a opção escolhida é achada pelo `aria-selected` na lista.
  const jaAbriuPrevia = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || duasPartes) return;
    if (previaNoCelular) {
      jaAbriuPrevia.current = true;
      (voltar.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('button, [role="button"]')?.focus();
    } else if (jaAbriuPrevia.current) {
      focar(document.querySelector<HTMLElement>('[role="listbox"][aria-label="Receitas"] [aria-selected="true"]') as unknown as View | null);
    }
  }, [previaNoCelular, duasPartes]);

  const aplicar = (modo: ModoDaReceita) => { if (escolhida) aoUsar(escolhida, modo); };
  const quantasDaReceita = escolhida ? seriesDaReceita(escolhida.conteudo).length : 0;
  const motivoAcrescentar = seriesAtuais > 0 ? motivoParaAcrescentar(seriesAtuais, quantasDaReceita) : undefined;

  // Teclado da lista (web): escuta na captura do documento, como o `ui/EscolhaSuspensa`, porque o `Pressable` do
  // react-native-web para a propagação; o Enter não chega a virar o toque da opção (aplicaria e escolheria duas vezes).
  const teclado = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    teclado.current = (e: KeyboardEvent) => {
      const alvo = e.target as unknown as View;
      const id = [...opcoes.current.entries()].find(([, no]) => no === alvo)?.[0];
      if (!id) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const r = lista.find((x) => x.id === id);
        if (!r) return;
        if (!duasPartes) { setIdEscolhido(r.id); setNaPrevia(true); return; }
        aoUsar(r, 'substituir');
        return;
      }
      const proximo = idDaTecla(lista, id, e.key);
      if (proximo === null) return;
      e.preventDefault();
      e.stopPropagation();
      setIdEscolhido(proximo);
      focar(opcoes.current.get(proximo));
    };
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => teclado.current(e);
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, []);

  const tocar = (r: Receita) => {
    setIdEscolhido(r.id);
    if (!duasPartes) setNaPrevia(true);
  };

  const rotuloDoChip = filtros.find((f) => f.valor === chip)?.rotulo ?? '';
  const vazioDaLista = !lista.length ? (
    busca.trim() && chip !== SEM_FILTRO
      ? <Vazio texto={`Nenhuma receita com ${rotuloDoChip} nessa busca.`} acao={{ rotulo: 'Mostrar todos os tipos', aoTocar: () => setFiltro(SEM_FILTRO) }} />
      : busca.trim()
        ? <Vazio texto="Nenhuma receita com essa busca." acao={{ rotulo: 'Limpar busca', aoTocar: () => setBusca('') }} />
        : aba === 'MINHAS'
          ? <Vazio titulo="Você ainda não tem receitas suas" texto="Num exercício com séries, toque em “Salvar como receita” para guardar a estrutura; ela aparece aqui." />
          : <Vazio texto={aba === 'COMPLETAS' ? 'Nenhuma receita completa ainda.' : 'Nenhuma receita de partes ainda.'} />
  ) : null;

  const listaDeReceitas = (
    <View {...({ role: 'listbox' } as object)} aria-label="Receitas" style={estilos.lista}>
      {lista.map((r) => (
        <LinhaDaReceita key={r.id} receita={r} config={config} escolhida={escolhida?.id === r.id}
          guardar={(no) => { opcoes.current.set(r.id, no); }} aoTocar={() => tocar(r)} />
      ))}
    </View>
  );

  const chips = <Escolha compacta chips descricao="Filtrar por tipo ou técnica" opcoes={filtros} valor={chip} aoMudar={setFiltro} />;
  const controles = (
    <View style={estilos.controles}>
      <Campo rotulo="Buscar receita" valor={busca} aoMudar={setBusca} placeholder="Nome, tipo ou técnica (ex.: back off, cluster)" autoCorrect={false} />
      <Abas abas={ABAS_DE_RECEITAS.map((a) => ({ ...a, contagem: contagem[a.valor] }))} ativa={aba} aoMudar={setAba} />
      {/* Um tipo só não pede filtro. Os chips quebram linha na largura da coluna, sem a `FaixaDeChips` (no celular ela rola e
          o escolhido ficava sob o esmaecido; no PC, numa coluna estreita, o último chip passava da borda). */}
      {filtros.length > 2 ? chips : null}
    </View>
  );

  const previa = escolhida
    ? <PreviaDaReceita key={escolhida.id} receita={escolhida} config={config} colecao={escolhida.pastaId ? nomeDaColecao.get(escolhida.pastaId) ?? null : null} />
    : <Texto variante="suave">A prévia aparece quando houver uma receita na lista.</Texto>;

  const comRodape = duasPartes ? !!dados && receitas.length > 0 : previaNoCelular;
  const motivoSemEscolha = escolhida ? undefined : 'Escolha uma receita na lista.';
  const rodape = !comRodape ? undefined : seriesAtuais > 0 ? (
    <>
      <Botao rotulo="Acrescentar ao fim" rotuloAcessivel={escolhida ? `Acrescentar ao fim as séries de ${escolhida.nome}` : undefined} tipo="secundario" Icone={ListPlus}
        desabilitado={!escolhida || !!motivoAcrescentar} motivo={motivoAcrescentar ?? motivoSemEscolha} aoTocar={() => aplicar('acrescentar')} />
      <Botao rotulo={rotuloDeSubstituir(seriesAtuais)} rotuloAcessivel={escolhida ? `${rotuloDeSubstituir(seriesAtuais)} por ${escolhida.nome}` : undefined} Icone={Replace}
        desabilitado={!escolhida} aoTocar={() => aplicar('substituir')} />
    </>
  ) : (
    <Botao rotulo="Usar receita" rotuloAcessivel={escolhida ? `Usar receita ${escolhida.nome}` : undefined} desabilitado={!escolhida} motivo={motivoSemEscolha} aoTocar={() => aplicar('substituir')} />
  );
  const aviso = comRodape ? avisoDasSeriesAtuais(seriesAtuais) : null;

  const corpo = () => {
    if (erro && !dados) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
    if (!dados) return <Esqueleto texto="Carregando as receitas" />;
    if (!receitas.length) {
      return <Vazio titulo="Nenhuma receita de séries ainda" texto={`Num exercício com séries, use “${rotuloSalvarComo('SERIES')}” para guardar a estrutura e reaproveitar aqui.`} />;
    }
    if (previaNoCelular) {
      return (
        <View style={estilos.passo}>
          <View ref={voltar} collapsable={false} style={estilos.voltar}>
            <Botao rotulo="Voltar à lista" tipo="secundario" Icone={ArrowLeft} aoTocar={voltarALista} />
          </View>
          {previa}
        </View>
      );
    }
    if (!duasPartes) return <View style={estilos.passo}>{controles}{vazioDaLista ?? listaDeReceitas}</View>;
    return (
      <View style={[estilos.partes, { height: alturaDasPartes }]}>
        <View style={estilos.esquerda}>
          {controles}
          <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.rolagemDaLista}>{vazioDaLista ?? listaDeReceitas}</ScrollView>
        </View>
        <View role="region" aria-label="Prévia da receita" style={[estilos.direita, { borderLeftColor: cores.divisor }]}>
          <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.rolagemDaPrevia}>{previa}</ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Folha visivel titulo="Usar receita" aoFechar={previaNoCelular ? voltarALista : aoFechar} largura={largura}
      rodape={rodape} statusDoRodape={aviso ? <Texto variante="suave">{aviso}</Texto> : undefined}>
      {corpo()}
    </Folha>
  );
}

/**
 * Uma receita da lista: o nome em negrito e, embaixo, os selos da composição ("FS ×3"), cada um na cor do tipo pela
 * preferência "Cor das séries" (no modo "Cor de ação" os selos ficam neutros, como no editor). A escolhida tem o destaque
 * do item ativo (`superficie3`, a barrinha da marca e o nome no semi; o índice da Ajuda e a coluna das Configurações).
 */
function LinhaDaReceita({ receita: r, config, escolhida, guardar, aoTocar }: {
  receita: Receita;
  config: Configuracao | null;
  escolhida: boolean;
  guardar: (no: View | null) => void;
  aoTocar: () => void;
}) {
  const { cores, identificacao, preferencias, marcaPeca } = useTema();
  const trechos = useMemo(() => trechosDaComposicao(seriesDaReceita(r.conteudo), config), [r.conteudo, config]);
  const composicao = trechos.map((t) => `${t.nome} ×${t.quantas}`).join(', ');
  return (
    <Pressable ref={guardar} nativeID={`receita-${r.id}`} role="option" aria-selected={escolhida} focusable={escolhida}
      accessibilityLabel={composicao ? `${r.nome}: ${composicao}` : `${r.nome}: sem séries`}
      onPress={aoTocar}
      style={(estado) => [estilos.opcao, escolhida ? { backgroundColor: cores.superficie3 } : sobre(estado) ? { backgroundColor: cores.superficie2 } : null]}>
      {escolhida ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      <Texto style={estilos.nome}>{r.nome}</Texto>
      {trechos.length ? (
        <View style={estilos.selos} aria-hidden>
          {trechos.map((t, i) => (
            <Selo key={i} texto={`${t.nome} ×${t.quantas}`} categoria={corDaSerie(preferencias?.corDasSeries ?? 'TIPO', t.cor, identificacao, cores).categoria ?? undefined} />
          ))}
        </View>
      ) : <Texto variante="pequeno" aria-hidden>Sem séries</Texto>}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  passo: { gap: espaco(2) },
  voltar: { alignItems: 'flex-start' },
  controles: { gap: espaco(1.5) },
  partes: { flexDirection: 'row', gap: espaco(2), minHeight: 0 },
  esquerda: { flexBasis: '42%', flexGrow: 0, flexShrink: 0, gap: espaco(1.5), minHeight: 0 },
  direita: { flex: 1, minWidth: 0, minHeight: 0, borderLeftWidth: 1, paddingLeft: espaco(2) },
  rolagem: { flex: 1, minHeight: 0 },
  // Folga de 2 px: o anel de foco da opção não é cortado pela rolagem.
  rolagemDaLista: { padding: 2 },
  rolagemDaPrevia: { paddingRight: espaco(1), paddingBottom: espaco(1) },
  lista: { gap: espaco(0.5) },
  opcao: { position: 'relative', gap: espaco(0.75), paddingVertical: espaco(1.25), paddingLeft: espaco(2), paddingRight: espaco(1.5), borderRadius: 8, minHeight: 44 },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  nome: { fontFamily: fontes.semi },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5) },
});
