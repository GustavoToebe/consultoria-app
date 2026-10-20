import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { DIAS_CURTOS, resumoDaSessao, TIPOS_SESSAO } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
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
  /** Todos os exercícios da sessão estão abertos; com `aoAlternarTodos`, o botão "Fechar todos"/"Abrir todos". */
  todosAbertos?: boolean;
  aoAlternarTodos?: () => void;
  /** Os exercícios (cartões) já montados pela tela do editor. */
  children: ReactNode;
}

/**
 * A sessão selecionada do plano (um dia): faixa de grupo com nome, resumo e ordem (← →, só com mais de uma sessão);
 * uma linha Nome · Dia · Tipo, "Cardio e observação" recolhível, os exercícios (nível 3) e, no rodapé, adicionar
 * exercício à esquerda e as ações da sessão à direita.
 */
export function CartaoSessao(p: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });
  // Cardio e observação ficam em "Mais da sessão", aberto quando um dos dois já tem texto: os exercícios sobem.
  const [maisAberto, setMaisAberto] = useState(!!(s.cardio || s.observacao));

  return (
    <AlvoDeRolagem chave={s.uid}><Cartao
      style={p.comProblema ? { borderColor: cores.perigo } : undefined}
      cabecalho={
        <CabecalhoDeGrupo
          titulo={s.nome || `Sessão ${p.posicao + 1}`}
          resumo={resumoDaSessao(s)}
          selo={p.comProblema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          acoesJuntas
          acoes={p.total > 1 ? (
            <>
              <IconeBotao Icone={ArrowLeft} rotulo="Mover sessão para antes" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
              <IconeBotao Icone={ArrowRight} rotulo="Mover sessão para depois" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
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
      <CabecalhoDeGrupo titulo="Cardio e observação" resumo={maisAberto ? undefined : resumoDoMais(s)} aberto={maisAberto} aoAlternar={() => setMaisAberto((v) => !v)} />
      {maisAberto ? (
        <>
          <Campo
            rotulo="Cardio (opcional)"
            valor={s.cardio ?? ''}
            aoMudar={(t) => mudar({ cardio: t || null })}
            placeholder="Ex.: Cardio 50 min ou HIIT de 25 min"
            maxLength={500}
          />
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
      <LinhaDeAcoes alinhar="entre">
        <LinhaDeAcoes>
          <Botao rotulo="Adicionar exercício" tipo="secundario" Icone={Plus} aoTocar={p.aoNovoExercicio} />
          {p.aoSalvarModelo ? <Botao rotulo={rotuloSalvarComo('SESSAO_TREINO')} rotuloAcessivel={`${rotuloSalvarComo('SESSAO_TREINO')} no Planejamento`} tipo="fantasma" aoTocar={p.aoSalvarModelo} /> : null}
        </LinhaDeAcoes>
        {p.removivel !== false ? <Botao rotulo="Remover sessão" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} /> : null}
      </LinhaDeAcoes>
    </Cartao></AlvoDeRolagem>
  );
}

/** Resumo de "Cardio e observação" fechado: o que tem, sem repetir o texto. */
function resumoDoMais(s: Sessao): string {
  const partes = [s.cardio ? 'com cardio' : null, s.observacao ? 'com observação' : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Nada preenchido';
}

const estilos = StyleSheet.create({
  tituloExercicios: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  linhaSessao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1.5) },
  coluna: { flexDirection: 'column', alignItems: 'stretch' },
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
});
