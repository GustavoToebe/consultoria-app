import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Link2, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { DIAS_CURTOS, resumoDaSessao, TIPOS_SESSAO } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
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
  /** Abre a folha "Modelos" do editor (sessões e exercícios prontos). */
  aoAbrirModelos?: () => void;
  /** "Criar grupo" (superset, circuito...): abre a escolha do tipo e dos exercícios. */
  aoCriarGrupo?: () => void;
  /** Por que não dá para criar grupo agora (poucos exercícios soltos); vazio = pode. */
  motivoSemGrupo?: string | null;
  /** Todos os exercícios da sessão estão abertos; com `aoAlternarTodos`, o botão "Fechar todos"/"Abrir todos". */
  todosAbertos?: boolean;
  aoAlternarTodos?: () => void;
  /** Os exercícios (cartões) já montados pela tela do editor. */
  children: ReactNode;
}

/**
 * A sessão selecionada do plano (um dia): faixa de grupo com nome, resumo e ordem (← →, só com mais de uma sessão);
 * uma linha Nome · Dia · Tipo, "Observação" recolhível, os exercícios e os grupos (nível 3) e, no rodapé, adicionar
 * exercício e criar grupo à esquerda e as ações da sessão à direita. O cardio é um exercício de modalidade Cardio.
 */
export function CartaoSessao(p: Props) {
  const { cores, marca } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });
  // A observação fica recolhida, aberta quando já tem texto: os exercícios sobem.
  const [maisAberto, setMaisAberto] = useState(!!(s.cardio || s.observacao));
  // O texto livre de cardio da sessão só aparece enquanto existir; cardio novo é um exercício de modalidade Cardio.
  const [comTextoDeCardio] = useState(!!s.cardio);

  return (
    <AlvoDeRolagem chave={s.uid}><Cartao
      // Barra de 4 px na cor da marca à esquerda: onde a sessão começa (protótipo de 30/10). É identidade, não status.
      style={[{ borderLeftWidth: BARRA_DA_SESSAO, borderLeftColor: marca }, p.comProblema ? { borderColor: cores.perigo, borderLeftColor: marca } : null]}
      cabecalho={
        <CabecalhoDeGrupo
          titulo={s.nome || `Sessão ${p.posicao + 1}`}
          resumo={resumoDaSessao(s)}
          selo={p.comProblema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          acoesJuntas
          acoes={p.total > 1 ? (
            <>
              <IconeBotao moldura Icone={ArrowLeft} rotulo="Mover sessão para antes" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
              <IconeBotao moldura Icone={ArrowRight} rotulo="Mover sessão para depois" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
            </>
          ) : undefined}
        />
      }>
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
      <CabecalhoDeGrupo titulo={comTextoDeCardio ? 'Cardio (texto) e observação' : 'Observação'} resumo={maisAberto ? undefined : resumoDoMais(s)} aberto={maisAberto} aoAlternar={() => setMaisAberto((v) => !v)} />
      {maisAberto ? (
        <>
          {comTextoDeCardio ? (
            <Campo
              rotulo="Cardio da sessão (texto)"
              valor={s.cardio ?? ''}
              aoMudar={(t) => mudar({ cardio: t || null })}
              ajuda="Texto livre. Para prescrever duração, ritmo e zona, adicione um exercício com modalidade Cardio."
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
      <View style={estilos.tituloExercicios}>
        <Texto variante="secao">Exercícios ({s.exercicios.length})</Texto>
        {p.aoAlternarTodos && s.exercicios.length > 1 ? (
          <Botao rotulo={p.todosAbertos ? 'Fechar todos' : 'Abrir todos'} tipo="fantasma" Icone={p.todosAbertos ? ChevronsDownUp : ChevronsUpDown} aoTocar={p.aoAlternarTodos} />
        ) : null}
      </View>
      <View style={estilos.exercicios}>{p.children}</View>
      {/* "Adicionar próximo exercício" (protótipo de 30/10): o fim da lista é um bloco tracejado com as ações de acrescentar. */}
      <View style={[estilos.proximo, { borderColor: cores.bordaCampo }]}>
        <View style={estilos.textoDoProximo}>
          <Texto variante="bloco" nivel={3}>Adicionar próximo exercício</Texto>
          <Texto variante="suave">Escolha da biblioteca da consultoria ou use um modelo pronto.</Texto>
        </View>
        <LinhaDeAcoes>
          {p.aoAbrirModelos ? <Botao rotulo="Modelos prontos" tipo="secundario" Icone={NotebookTabs} aoTocar={p.aoAbrirModelos} /> : null}
          {p.aoCriarGrupo ? <Botao rotulo="Criar grupo" tipo="secundario" Icone={Link2} aoTocar={p.aoCriarGrupo} desabilitado={!!p.motivoSemGrupo} motivo={p.motivoSemGrupo ?? undefined} /> : null}
          <Botao rotulo="Adicionar exercício" tipo="secundario" Icone={Plus} aoTocar={p.aoNovoExercicio} />
        </LinhaDeAcoes>
      </View>
      <LinhaDeAcoes alinhar="entre">
        {p.aoSalvarModelo ? <Botao rotulo={rotuloSalvarComo('SESSAO_TREINO')} rotuloAcessivel={`${rotuloSalvarComo('SESSAO_TREINO')} no Planejamento`} tipo="fantasma" aoTocar={p.aoSalvarModelo} /> : <View />}
        {p.removivel !== false ? <Botao rotulo="Remover sessão" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} /> : null}
      </LinhaDeAcoes>
    </Cartao></AlvoDeRolagem>
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
  proximo: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  textoDoProximo: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 2 },
  tituloExercicios: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  linhaSessao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5) },
  coluna: { flexDirection: 'column', alignItems: 'stretch' },
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
});
