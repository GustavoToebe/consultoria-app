import { ArrowLeft, ArrowRight, Ellipsis, HeartPulse, Link2, NotebookTabs, Plus, Save, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { DIAS_CURTOS, DIAS_SEMANA, TIPOS_SESSAO } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { idDaSessao } from './ContadoresDoTreino';

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
  /** Totais e "Ver distribuição da sessão", logo abaixo da faixa. */
  resumo?: ReactNode;
  /** Há erro num campo da própria sessão (nome, tipo...): "Editar sessão" fica aberto para o campo estar à vista. */
  comErroNosDados?: boolean;
  /** Os exercícios (cartões) já montados pela tela do editor, ou o convite da sessão vazia. */
  children: ReactNode;
}

/**
 * A sessão selecionada do plano (um dia): faixa com nome, dia · tipo e ordem (← →, só com mais de uma sessão) e o ⋯
 * ("Salvar como dia de treino", "Remover sessão"); embaixo, os totais e a distribuição recolhida, "Editar sessão"
 * (nome, dia, tipo e observação, recolhido quando a sessão já tem nome; o botão diz se há observação), os exercícios e,
 * no fim, adicionar exercício, cardio, modelos e criar grupo. Reorganização de 10/11: menos faixas e títulos repetidos.
 * A sessão não tem moldura em largura nenhuma, só a faixa do título.
 */
export function CartaoSessao(p: Props) {
  const { cores, marca, bordas } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });
  // Recolhido quando já tem nome; aberto na sessão nova e enquanto um campo dele tiver erro (ir à primeira pendência).
  const [escolhaDosDados, setEscolhaDosDados] = useState<boolean | null>(null);
  const dadosAbertos = !!p.comErroNosDados || (escolhaDosDados ?? !s.nome.trim());
  // O texto livre de cardio da sessão só aparece enquanto existir; cardio novo é um exercício de cardio ("+ Adicionar cardio").
  const [comTextoDeCardio] = useState(!!s.cardio);
  const [menu, setMenu] = useState(false);
  const acoesDoMenu = [
    ...(p.aoSalvarModelo ? [{ rotulo: rotuloSalvarComo('SESSAO_TREINO'), detalhe: 'Guarda uma cópia no Planejamento.', Icone: Save, aoTocar: p.aoSalvarModelo }] : []),
    ...(p.removivel !== false ? [{ rotulo: 'Remover sessão', detalhe: 'Dá para desfazer logo depois.', Icone: Trash2, perigo: true, aoTocar: p.aoRemover }] : []),
  ];
  const titulo = s.nome || `Sessão ${p.posicao + 1}`;

  const cabecalho = (
        <CabecalhoDeGrupo
          titulo={titulo}
          resumo={diaETipo(s)}
          selo={p.comProblema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          acoesJuntas
          acoes={p.total > 1 || acoesDoMenu.length ? (
            <>
              {p.total > 1 ? (
                <>
                  <IconeBotao moldura Icone={ArrowLeft} rotulo="Mover sessão para antes" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
                  <IconeBotao moldura Icone={ArrowRight} rotulo="Mover sessão para depois" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
                </>
              ) : null}
              {acoesDoMenu.length ? <IconeBotao moldura Icone={Ellipsis} rotulo={`Mais ações da sessão ${s.nome || p.posicao + 1}`} aoTocar={() => setMenu(true)} /> : null}
            </>
          ) : undefined}
        />
  );
  const corpo = <>
      {p.resumo}
      <View style={estilos.dados}>
        <BotaoDeAbrir texto={textoDosDados(s)} aberto={dadosAbertos} aoAlternar={() => setEscolhaDosDados(!dadosAbertos)} />
        {dadosAbertos ? (
          <View style={[estilos.areaDosDados, { borderColor: cores.borda }]}>
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
          </View>
        ) : null}
      </View>
      <View style={estilos.exercicios}>{p.children}</View>
      {p.adicionarNoFim !== false && s.exercicios.length > 0 ? (
        <AdicionarProximoExercicio aoNovoExercicio={p.aoNovoExercicio} aoNovoCardio={p.aoNovoCardio} aoAbrirModelos={p.aoAbrirModelos} aoCriarGrupo={p.aoCriarGrupo} motivoSemGrupo={p.motivoSemGrupo} />
      ) : null}
      {menu ? <FolhaDeAcoes titulo={titulo} aoFechar={() => setMenu(false)} acoes={acoesDoMenu} /> : null}
  </>;
  // Barra de 4 px na cor da marca à esquerda da faixa: onde a sessão começa (protótipo de 30/10). É identidade, não status.
  return (
    <AlvoDeRolagem chave={s.uid}>
      <View style={estilos.semMoldura} nativeID={idDaSessao(s.uid)}>
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

/** "Segunda · Treino": o dia e o tipo, na faixa (os totais ficam na linha de baixo). */
function diaETipo(s: Sessao): string {
  const dia = s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1] : 'Sem dia fixo';
  return `${dia} · ${TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo}`;
}

/** "Editar sessão", com o que já tem além do nome entre parênteses: o recolhido não esconde conteúdo sem avisar. */
function textoDosDados(s: Sessao): string {
  const tem = [s.cardio ? 'texto de cardio' : null, s.observacao ? 'observação' : null].filter(Boolean);
  return `Editar sessão${tem.length ? ` (com ${tem.join(' e ')})` : ''}`;
}

/** Largura da barra na cor da marca à esquerda do cartão da sessão. */
const BARRA_DA_SESSAO = 4;

const estilos = StyleSheet.create({
  dados: { gap: espaco(1) },
  // Os campos na medida de leitura, com o fio à esquerda do acordeão (como as instruções do exercício).
  areaDosDados: { gap: espaco(2), maxWidth: LARGURA_EDITOR, paddingLeft: espaco(1.5), borderLeftWidth: 2 },
  linhaSessao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5) },
  coluna: { flexDirection: 'column', alignItems: 'stretch' },
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
  semMoldura: { gap: espaco(2) },
  faixaSolta: { borderRadius: RAIO, overflow: 'hidden' },
});
