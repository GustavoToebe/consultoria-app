import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
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
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
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
 * A sessão selecionada do plano (um dia): faixa de grupo com nome, resumo e ordem; campos da sessão; os exercícios
 * (nível 3) e, no rodapé, adicionar exercício à esquerda e as ações da sessão à direita.
 */
export function CartaoSessao(p: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const duasColunas = width >= LARGURA_MENU_LATERAL;
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });

  return (
    <Cartao
      style={p.comProblema ? { borderColor: cores.perigo } : undefined}
      cabecalho={
        <CabecalhoDeGrupo
          titulo={s.nome || `Sessão ${p.posicao + 1}`}
          resumo={resumoDaSessao(s)}
          selo={p.comProblema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
          acoes={
            <>
              <Texto variante="pequeno" numerico>{p.posicao + 1} de {p.total}</Texto>
              <IconeBotao Icone={ArrowLeft} rotulo="Mover sessão para antes" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
              <IconeBotao Icone={ArrowRight} rotulo="Mover sessão para depois" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
            </>
          }
        />
      }>
      <View style={duasColunas ? estilos.linhaDupla : estilos.coluna}>
        <View style={duasColunas ? estilos.metade : undefined}>
          <Campo rotulo="Nome da sessão" valor={s.nome} aoMudar={(nome) => mudar({ nome })} maxLength={80} placeholder="Ex.: Segunda - Costas" />
        </View>
        <View style={duasColunas ? estilos.metade : undefined}>
          <Campo
            rotulo="Cardio (opcional)"
            valor={s.cardio ?? ''}
            aoMudar={(t) => mudar({ cardio: t || null })}
            placeholder="Ex.: Cardio 50 min ou HIIT de 25 min"
            maxLength={500}
          />
        </View>
      </View>
      <Escolha rotulo="Dia da semana" opcoes={DIAS} valor={s.diaSemana} aoMudar={(diaSemana) => mudar({ diaSemana })} />
      <Escolha rotulo="Tipo" opcoes={TIPOS_SESSAO} valor={s.tipo} aoMudar={(t) => mudar({ tipo: t, frequenciaSemanal: t === 'ACESSORIOS' ? s.frequenciaSemanal : null })} />
      {s.tipo === 'ACESSORIOS' ? (
        <View style={estilos.campoCurto}>
          <CampoNumerico rotulo="Vezes por semana" inteiro valor={s.frequenciaSemanal} aoMudar={(frequenciaSemanal) => mudar({ frequenciaSemanal })} />
        </View>
      ) : null}
      <Campo
        rotulo="Observação da sessão (opcional)"
        valor={s.observacao ?? ''}
        aoMudar={(t) => mudar({ observacao: t || null })}
        linhas={2}
        maxLength={1000}
      />
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
          {p.aoSalvarModelo ? <Botao rotulo="Salvar sessão como modelo" rotuloAcessivel="Salvar esta sessão como modelo" tipo="secundario" aoTocar={p.aoSalvarModelo} /> : null}
        </LinhaDeAcoes>
        {p.removivel !== false ? <Botao rotulo="Remover sessão" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} /> : null}
      </LinhaDeAcoes>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  tituloExercicios: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  linhaDupla: { flexDirection: 'row', gap: espaco(2) },
  metade: { flex: 1 },
  coluna: { gap: espaco(2) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
});
