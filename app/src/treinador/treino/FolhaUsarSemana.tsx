import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { listarExercicios, listarPastasModelos, listarReceitas } from '../../api/rotas';
import type { Receita } from '../../api/tipos';
import { idDaTecla, receitaEscolhida } from '../../dominio/listaDeReceitas';
import {
  ABAS_DE_SEMANAS, abaInicial, contagemPorAba, filtroEfetivo, filtrosDeColecao, semanasDaAba, semanasDaLista, TODAS_AS_COLECOES, type AbaDeSemanas,
} from '../../dominio/listaDeSemanas';
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
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { metadadosDoModelo, rotuloSalvarComo } from '../planejamento/modelos';
import { PreviaDaSemana } from './PreviaDaSemana';

/** Folha grande, como a "Usar receita": 1100 px no PC; abaixo de 1200 px de janela, 92% dela. */
const LARGURA_DA_FOLHA = 1100;
const JANELA_DA_LARGURA_CHEIA = 1200;
/**
 * O que a folha gasta fora das duas partes (cabeçalho, rodapé com o aviso, respiros e a margem da janela): as partes têm
 * altura fixa para o rodapé não subir e descer enquanto se busca ou filtra; cada uma rola sozinha.
 * shortcut: copiado da "Usar receita" com folga para o aviso em duas linhas, sem medir; se o rodapé subir ou o corpo da
 * folha rolar em 1280×720 no e2e, medir de novo.
 */
const FORA_DAS_PARTES = 270;
const ALTURA_MAXIMA_DAS_PARTES = 720;
const ALTURA_MINIMA_DAS_PARTES = 320;

const AVISO = 'As sessões deste plano serão trocadas pelas da semana escolhida. O objetivo e as orientações ficam.';

/**
 * "Usar semana de treino" do editor de treino (27/11, no padrão da "Usar receita"): no PC uma folha larga em duas partes,
 * a lista à esquerda (busca, abas Semanas completas e Estruturas com a contagem, chips de coleção e uma linha por modelo) e
 * a prévia fixa à direita (`PreviaDaSemana`); o rodapé fixo avisa o que muda e usa o escolhido. A lista é um `listbox`
 * (APG): só o escolhido entra no Tab, setas, Home e End trocam a escolha e Enter usa. No celular é um passo de cada vez: a
 * lista e, ao tocar, a prévia com "Voltar"; o X, o voltar do aparelho e o do navegador voltam à lista antes de fechar. O
 * editor oferece "Desfazer" no aviso depois de usar.
 */
export function FolhaUsarSemana({ aoUsar, aoFechar }: { aoUsar: (r: Receita) => void; aoFechar: () => void }) {
  const { width, height } = useWindowDimensions();
  const { cores } = useTema();
  const duasPartes = width >= LARGURA_MENU_LATERAL;
  const largura = width >= JANELA_DA_LARGURA_CHEIA ? LARGURA_DA_FOLHA : Math.round(width * 0.92);
  const alturaDasPartes = Math.min(ALTURA_MAXIMA_DAS_PARTES, Math.max(ALTURA_MINIMA_DAS_PARTES, Math.round(height * 0.9) - FORA_DAS_PARTES));
  const { dados, erro, recarregar } = useCarregar('receitas:PLANO_TREINO', () => listarReceitas('PLANO_TREINO'));
  const colecoes = useCarregar('pastas-modelos', listarPastasModelos);
  // Só para o grupo muscular de cada exercício da prévia. O `useCarregar` não guarda cache entre telas: a mesma chave do
  // editor não reaproveita a lista dele, e abrir a folha faz o próprio `GET /exercicios`.
  // shortcut: um GET a cada abertura; trocar por prop do editor quando ele passar a lista que já tem.
  const biblioteca = useCarregar('biblioteca-exercicios', () => listarExercicios());
  const [busca, setBusca] = useState('');
  const [abaEscolhida, setAba] = useState<AbaDeSemanas | null>(null);
  const [filtro, setFiltro] = useState(TODAS_AS_COLECOES);
  const [idEscolhido, setIdEscolhido] = useState<string | null>(null);
  // Celular: a prévia é um passo da folha. No PC a prévia está sempre à vista e o passo não vale.
  const [naPrevia, setNaPrevia] = useState(false);
  const previaNoCelular = naPrevia && !duasPartes;

  const semanas = useMemo(() => (dados ?? []).filter((r) => r.tipo === 'PLANO_TREINO'), [dados]);
  const listaDeColecoes = colecoes.dados ?? null;
  const contagem = contagemPorAba(semanas, busca);
  const aba: AbaDeSemanas = abaEscolhida ?? abaInicial(semanas);
  const daAba = useMemo(() => semanasDaAba(semanas, aba), [semanas, aba]);
  const filtros = useMemo(() => filtrosDeColecao(daAba, listaDeColecoes), [daAba, listaDeColecoes]);
  const chip = filtroEfetivo(daAba, filtro, listaDeColecoes);
  const lista = semanasDaLista(semanas, { aba, busca, filtro }, listaDeColecoes);
  const escolhida = receitaEscolhida(lista, idEscolhido);
  const nomeDaColecao = useMemo(() => new Map((listaDeColecoes ?? []).map((c) => [c.id, c.nome])), [listaDeColecoes]);
  const gruposMusculares = useMemo(() => new Map((biblioteca.dados ?? []).map((x) => [x.id, x.grupoMuscular])), [biblioteca.dados]);

  const voltarALista = () => setNaPrevia(false);
  usePassoNoHistorico(previaNoCelular, voltarALista);

  // Foco (web): setas movem a escolha e o foco juntos; ao abrir a prévia no celular o foco vai ao "Voltar" e, ao voltar, ao
  // modelo escolhido. Os nós ficam por id, para achar a opção depois de a escolha mudar.
  const opcoes = useRef(new Map<string, View | null>());
  const voltar = useRef<View>(null);
  const focar = (no: View | null | undefined) => {
    const el = no as unknown as HTMLElement | null | undefined;
    el?.focus?.();
    el?.scrollIntoView?.({ block: 'nearest' });
  };
  const jaAbriuPrevia = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || duasPartes) return;
    if (previaNoCelular) {
      jaAbriuPrevia.current = true;
      (voltar.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('button, [role="button"]')?.focus();
    } else if (jaAbriuPrevia.current) {
      focar(document.querySelector<HTMLElement>('[role="listbox"][aria-label="Semanas"] [aria-selected="true"]') as unknown as View | null);
    }
  }, [previaNoCelular, duasPartes]);

  // Teclado da lista (web): escuta na captura do documento, como a "Usar receita", porque o `Pressable` do react-native-web
  // para a propagação; o Enter não chega a virar o toque da opção.
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
        aoUsar(r);
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
    chip !== TODAS_AS_COLECOES
      ? <Vazio texto={`Nenhum modelo em ${rotuloDoChip} nessa busca.`} acao={{ rotulo: 'Mostrar todas as coleções', aoTocar: () => setFiltro(TODAS_AS_COLECOES) }} />
      : busca.trim()
        ? <Vazio texto="Nenhum modelo com essa busca." acao={{ rotulo: 'Limpar busca', aoTocar: () => setBusca('') }} />
        : aba === 'ESTRUTURAS'
          ? <Vazio texto="Nenhuma estrutura de semana ainda. Uma semana sem exercícios aparece aqui." />
          : <Vazio texto="Nenhuma semana completa ainda." />
  ) : null;

  const listaDeSemanas = (
    <View {...({ role: 'listbox' } as object)} aria-label="Semanas" style={estilos.lista}>
      {lista.map((r) => (
        <LinhaDaSemana key={r.id} semana={r} escolhida={escolhida?.id === r.id}
          guardar={(no) => { opcoes.current.set(r.id, no); }} aoTocar={() => tocar(r)} />
      ))}
    </View>
  );

  const controles = (
    <View style={estilos.controles}>
      <Campo rotulo="Buscar semana" valor={busca} aoMudar={setBusca} placeholder="Nome ou descrição (ex.: full body, ABC)" autoCorrect={false} />
      <Abas abas={ABAS_DE_SEMANAS.map((a) => ({ ...a, contagem: contagem[a.valor] }))} ativa={aba} aoMudar={setAba} />
      {/* Uma coleção só não pede filtro. Os chips quebram linha na largura da coluna, como na "Usar receita". */}
      {filtros.length > 2 ? <Escolha compacta chips descricao="Filtrar por coleção" opcoes={filtros} valor={chip} aoMudar={setFiltro} /> : null}
    </View>
  );

  const previa = escolhida
    ? <PreviaDaSemana key={escolhida.id} semana={escolhida} gruposMusculares={gruposMusculares} colecao={escolhida.pastaId ? nomeDaColecao.get(escolhida.pastaId) ?? null : null} />
    : <Texto variante="suave">A prévia aparece quando houver um modelo na lista.</Texto>;

  const comRodape = duasPartes ? !!dados && semanas.length > 0 : previaNoCelular;
  const rodape = comRodape ? (
    <>
      <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
      <Botao rotulo="Usar este modelo" rotuloAcessivel={escolhida ? `Usar este modelo: ${escolhida.nome}` : undefined}
        desabilitado={!escolhida} motivo={escolhida ? undefined : 'Escolha um modelo na lista.'} aoTocar={() => { if (escolhida) aoUsar(escolhida); }} />
    </>
  ) : undefined;

  const corpo = () => {
    if (erro && !dados) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
    if (!dados) return <Esqueleto texto="Carregando as semanas" />;
    if (!semanas.length) {
      return <Vazio titulo="Nenhuma semana de treino ainda" texto={`Crie uma no Planejamento ou, num plano pronto, use “${rotuloSalvarComo('PLANO_TREINO')}” para reaproveitar aqui.`} />;
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
    if (!duasPartes) return <View style={estilos.passo}>{controles}{vazioDaLista ?? listaDeSemanas}</View>;
    return (
      <View style={[estilos.partes, { height: alturaDasPartes }]}>
        <View style={estilos.esquerda}>
          {controles}
          <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.rolagemDaLista}>{vazioDaLista ?? listaDeSemanas}</ScrollView>
        </View>
        <View role="region" aria-label="Prévia da semana" style={[estilos.direita, { borderLeftColor: cores.divisor }]}>
          <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.rolagemDaPrevia}>{previa}</ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Folha visivel titulo="Usar semana de treino" aoFechar={previaNoCelular ? voltarALista : aoFechar} largura={largura}
      rodape={rodape} statusDoRodape={comRodape ? <Texto variante="suave">{AVISO}</Texto> : undefined}>
      {corpo()}
    </Folha>
  );
}

/**
 * Um modelo da lista: o nome em negrito e, embaixo, "7 sessões · 27 exercícios" (ou "· sem exercícios", a mesma linha do
 * Planejamento). O escolhido tem o destaque do item ativo (`superficie3`, a barrinha da marca), como na "Usar receita".
 */
function LinhaDaSemana({ semana: r, escolhida, guardar, aoTocar }: {
  semana: Receita;
  escolhida: boolean;
  guardar: (no: View | null) => void;
  aoTocar: () => void;
}) {
  const { cores, marcaPeca } = useTema();
  const resumo = metadadosDoModelo('PLANO_TREINO', r.conteudo);
  return (
    <Pressable ref={guardar} nativeID={`semana-${r.id}`} role="option" aria-selected={escolhida} focusable={escolhida}
      accessibilityLabel={`${r.nome}: ${resumo}`}
      onPress={aoTocar}
      style={(estado) => [estilos.opcao, escolhida ? { backgroundColor: cores.superficie3 } : sobre(estado) ? { backgroundColor: cores.superficie2 } : null]}>
      {escolhida ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      <Texto style={estilos.nome}>{r.nome}</Texto>
      <Texto variante="pequeno" numerico aria-hidden>{resumo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  passo: { gap: espaco(2) },
  voltar: { alignItems: 'flex-start' },
  controles: { gap: espaco(1.5) },
  partes: { flexDirection: 'row', gap: espaco(2), minHeight: 0 },
  esquerda: { flexBasis: '40%', flexGrow: 0, flexShrink: 0, gap: espaco(1.5), minHeight: 0 },
  direita: { flex: 1, minWidth: 0, minHeight: 0, borderLeftWidth: 1, paddingLeft: espaco(2) },
  rolagem: { flex: 1, minHeight: 0 },
  // Folga de 2 px: o anel de foco da opção não é cortado pela rolagem.
  rolagemDaLista: { padding: 2 },
  rolagemDaPrevia: { paddingRight: espaco(1), paddingBottom: espaco(1) },
  lista: { gap: espaco(0.5) },
  opcao: { position: 'relative', gap: espaco(0.5), paddingVertical: espaco(1.25), paddingLeft: espaco(2), paddingRight: espaco(1.5), borderRadius: 8, minHeight: 44 },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  nome: { fontFamily: fontes.semi },
});
