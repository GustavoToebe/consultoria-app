import { ArrowLeft, ArrowRight, Ellipsis, HeartPulse, Link2, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { DIAS_CURTOS, resumoDaSessao, TIPOS_SESSAO } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Texto } from '../../ui/Texto';

const DIAS = [
  { valor: null, rotulo: 'Sem dia' },
  ...DIAS_CURTOS.map((rotulo, i) => ({ valor: i + 1, rotulo })),
] as { valor: number | null; rotulo: string }[];

interface Props {
  sessao: Sessao;
  posicao: number;
  total: number;
  comProblema: boolean;
  aoMudar: (s: Sessao) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  removivel?: boolean;
  aoSalvarModelo?: () => void;
  aoNovoExercicio: () => void;
  /** "+ Adicionar cardio": a mesma folha da biblioteca, e o item nasce de cardio (`modalidade: 'CARDIO'`). */
  aoNovoCardio: () => void;
  /** Abre a folha "Modelos" do editor (sessões e exercícios prontos). */
  aoAbrirModelos?: () => void;
  /** "Criar grupo" (superset, circuito...): abre a escolha do tipo e dos exercícios. */
  aoCriarGrupo?: () => void;
  /** Por que não dá para criar grupo agora (poucos exercícios soltos); vazio = pode. */
  motivoSemGrupo?: string | null;
  /** `false` quando o bloco "Adicionar próximo exercício" vai no fim da lista da coluna da esquerda (duas colunas). */
  adicionarNoFim?: boolean;
  /** Os exercícios (cartões) já montados pela tela do editor. */
  children: ReactNode;
}

/**
 * A sessão selecionada do plano (um dia): faixa de grupo com nome, resumo e ordem (← →, só com mais de uma sessão);
 * uma linha Nome · Dia · Tipo, "Observação" recolhível, os exercícios e os grupos (nível 3) e, no rodapé, adicionar
 * exercício e adicionar cardio (os primeiros controles), modelos e criar grupo; remover a sessão fica no ⋯ do cabeçalho. O cardio é
 * um exercício de cardio, que nasce do "+ Adicionar cardio".
 * A sessão não tem moldura em largura nenhuma, só a faixa do título: as duas molduras do editor são o exercício e a
 * série aberta (§5.1 e S4), e os campos ganham a largura toda.
 */
export function CartaoSessao(p: Props) {
  const { cores, marca, bordas } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });
  // A observação fica recolhida, aberta quando já tem texto: os exercícios sobem.
  const [maisAberto, setMaisAberto] = useState(!!(s.cardio || s.observacao));
  // O texto livre de cardio da sessão só aparece enquanto existir; cardio novo é um exercício de cardio ("+ Adicionar cardio").
  const [comTextoDeCardio] = useState(!!s.cardio);
  const [menu, setMenu] = useState(false);
  const comMenu = p.removivel !== false;

  const cabecalho = (
        <CabecalhoDeGrupo
          titulo={s.nome || `Sessão ${p.posicao + 1}`}
          resumo={resumoDaSessao(s)}
          selo={p.comProblema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          acoesJuntas
          acoes={p.total > 1 || comMenu ? (
            <>
              {p.total > 1 ? (
                <>
                  <IconeBotao moldura Icone={ArrowLeft} rotulo="Mover sessão para antes" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
                  <IconeBotao moldura Icone={ArrowRight} rotulo="Mover sessão para depois" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
                </>
              ) : null}
              {comMenu ? <IconeBotao moldura Icone={Ellipsis} rotulo={`Mais ações da sessão ${s.nome || p.posicao + 1}`} aoTocar={() => setMenu(true)} /> : null}
            </>
          ) : undefined}
        />
  );
  const corpo = <>
      {/* Dados da sessão na medida (Nome, Dia, Tipo) e a Observação ao lado quando as duas cabem (1440 e 1920); abaixo
          disso ela desce, como antes. */}
      <View style={estilos.topoDaSessao}>
        <View style={estilos.dadosDaSessao}>
          <View style={[estilos.linhaSessao, largo ? null : estilos.coluna]}>
            <View style={largo ? estilos.nome : null}>
              <Campo rotulo="Nome da sessão" valor={s.nome} aoMudar={(nome) => mudar({ nome })} maxLength={80} placeholder="Ex.: Segunda - Costas" />
            </View>
            <View style={estilos.escolhas}>
              <EscolhaEmFolha rotulo="Dia" titulo="Dia da semana" opcoes={DIAS} valor={s.diaSemana} aoMudar={(diaSemana) => mudar({ diaSemana })} />
              <EscolhaEmFolha rotulo="Tipo" titulo="Tipo da sessão" opcoes={TIPOS_SESSAO} valor={s.tipo} aoMudar={(t) => mudar({ tipo: t, frequenciaSemanal: t === 'ACESSORIOS' ? s.frequenciaSemanal : null })} />
            </View>
          </View>
          {s.tipo === 'ACESSORIOS' ? (
            <View style={estilos.campoCurto}>
              <CampoNumerico rotulo="Vezes por semana" inteiro valor={s.frequenciaSemanal} aoMudar={(frequenciaSemanal) => mudar({ frequenciaSemanal })} />
            </View>
          ) : null}
        </View>
        <View style={estilos.observacaoDaSessao}>
          <CabecalhoDeGrupo titulo={comTextoDeCardio ? 'Cardio (texto) e observação' : 'Observação'} resumo={maisAberto ? undefined : resumoDoMais(s)} aberto={maisAberto} aoAlternar={() => setMaisAberto((v) => !v)} />
          {maisAberto ? (
            <>
              {comTextoDeCardio ? (
                <Campo
                  rotulo="Cardio da sessão (texto)"
                  valor={s.cardio ?? ''}
                  aoMudar={(t) => mudar({ cardio: t || null })}
                  ajuda="Texto livre. Para prescrever duração, ritmo e zona, use “Adicionar cardio”."
                  maxLength={500}
                />
              ) : null}
              <Campo
                rotulo="Observação da sessão (opcional)"
                valor={s.observacao ?? ''}
                aoMudar={(t) => mudar({ observacao: t || null })}
                linhas={2}
                maxLength={1000}
              />
            </>
          ) : null}
        </View>
      </View>
      <Texto variante="secao">Exercícios ({s.exercicios.length})</Texto>
      <View style={estilos.exercicios}>{p.children}</View>
      {p.adicionarNoFim !== false ? (
        <AdicionarProximoExercicio aoNovoExercicio={p.aoNovoExercicio} aoNovoCardio={p.aoNovoCardio} aoAbrirModelos={p.aoAbrirModelos} aoCriarGrupo={p.aoCriarGrupo} motivoSemGrupo={p.motivoSemGrupo} />
      ) : null}
      {p.aoSalvarModelo ? (
        <LinhaDeAcoes>
          <Botao rotulo={rotuloSalvarComo('SESSAO_TREINO')} rotuloAcessivel={`${rotuloSalvarComo('SESSAO_TREINO')} no Planejamento`} tipo="secundario" aoTocar={p.aoSalvarModelo} />
        </LinhaDeAcoes>
      ) : null}
      {menu ? (
        <FolhaDeAcoes titulo={s.nome || `Sessão ${p.posicao + 1}`} aoFechar={() => setMenu(false)} acoes={[
          { rotulo: 'Remover sessão', detalhe: 'Dá para desfazer logo depois.', Icone: Trash2, perigo: true, aoTocar: p.aoRemover },
        ]} />
      ) : null}
  </>;
  // Barra de 4 px na cor da marca à esquerda da faixa: onde a sessão começa (protótipo de 30/10). É identidade, não status.
  return (
    <AlvoDeRolagem chave={s.uid}>
      <View style={estilos.semMoldura}>
        <View style={[estilos.faixaSolta, { borderWidth: bordas.bloco, borderColor: p.comProblema ? cores.perigo : cores.borda, borderLeftWidth: BARRA_DA_SESSAO, borderLeftColor: marca }]}>{cabecalho}</View>
        {corpo}
      </View>
    </AlvoDeRolagem>
  );
}

/**
 * "Adicionar próximo exercício" (protótipo de 30/10): o fim da lista é um bloco tracejado com as ações de acrescentar.
 * No fim do cartão da sessão (coluna única) ou da lista da coluna da esquerda (duas colunas).
 */
export function AdicionarProximoExercicio(p: Pick<Props, 'aoNovoExercicio' | 'aoNovoCardio' | 'aoAbrirModelos' | 'aoCriarGrupo' | 'motivoSemGrupo'>) {
  return (
    <BlocoAdicionar titulo="Adicionar próximo exercício" descricao="Escolha da biblioteca da consultoria ou use um modelo pronto.">
      <Botao rotulo="Adicionar exercício" tipo="secundario" Icone={Plus} aoTocar={p.aoNovoExercicio} />
      <Botao rotulo="Adicionar cardio" tipo="secundario" Icone={HeartPulse} aoTocar={p.aoNovoCardio} />
      {p.aoAbrirModelos ? <Botao rotulo="Modelos prontos" tipo="secundario" Icone={NotebookTabs} aoTocar={p.aoAbrirModelos} /> : null}
      {p.aoCriarGrupo ? <Botao rotulo="Criar grupo" tipo="secundario" Icone={Link2} aoTocar={p.aoCriarGrupo} desabilitado={!!p.motivoSemGrupo} motivo={p.motivoSemGrupo ?? undefined} /> : null}
    </BlocoAdicionar>
  );
}

/** Resumo de "Cardio e observação" fechado: o que tem, sem repetir o texto. */
function resumoDoMais(s: Sessao): string {
  const partes = [s.cardio ? 'com texto de cardio' : null, s.observacao ? 'com observação' : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Nada preenchido';
}

/** Largura da barra na cor da marca à esquerda do cartão da sessão. */
const BARRA_DA_SESSAO = 4;

const estilos = StyleSheet.create({
  // 640 + 480 + o vão: lado a lado a partir de ~1140 px de conteúdo (1440 e 1920); em 1280 e no celular quebra.
  topoDaSessao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  dadosDaSessao: { flexGrow: 1, flexShrink: 1, flexBasis: 640, minWidth: 0, maxWidth: LARGURA_EDITOR, gap: espaco(2) },
  observacaoDaSessao: { flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 0, gap: espaco(2) },
  linhaSessao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5) },
  coluna: { flexDirection: 'column', alignItems: 'stretch' },
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
  semMoldura: { gap: espaco(2) },
  faixaSolta: { borderRadius: RAIO, overflow: 'hidden' },
});
