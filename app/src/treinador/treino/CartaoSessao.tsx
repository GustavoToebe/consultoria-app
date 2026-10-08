import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../../api/tipos';
import { DIAS_CURTOS, DIAS_SEMANA, TIPOS_SESSAO } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

const DIAS = [
  { valor: null, rotulo: 'Sem dia' },
  ...DIAS_CURTOS.map((rotulo, i) => ({ valor: i + 1, rotulo })),
] as { valor: number | null; rotulo: string }[];

interface Props {
  sessao: Sessao;
  posicao: number;
  total: number;
  aberta: boolean;
  comProblema: boolean;
  aoAbrir: () => void;
  aoMudar: (s: Sessao) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoNovoExercicio: () => void;
  /** Os exercícios (cartões) já montados pela tela do editor. */
  children: ReactNode;
}

/** Sessão do plano (um dia): nome, dia da semana, tipo, cardio, observação e os exercícios. */
export function CartaoSessao(p: Props) {
  const { cores } = useTema();
  const s = p.sessao;
  const mudar = (parcial: Partial<Sessao>) => p.aoMudar({ ...s, ...parcial });
  const tipo = TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo;
  const dia = s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1] : 'Sem dia fixo';

  return (
    <View style={[estilos.cartao, { borderColor: p.comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie }]}>
      <View style={estilos.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${p.aberta ? 'Fechar' : 'Abrir'} sessão ${s.nome || p.posicao + 1}`}
          accessibilityState={{ expanded: p.aberta }}
          onPress={p.aoAbrir}
          style={estilos.titulo}>
          <Texto variante="subtitulo">{s.nome || `Sessão ${p.posicao + 1}`}</Texto>
          <Texto cor="suave">
            {dia} · {tipo} · {s.exercicios.length} {s.exercicios.length === 1 ? 'exercício' : 'exercícios'}
          </Texto>
          {p.comProblema ? <Selo texto="Corrigir" tipo="perigo" /> : null}
        </Pressable>
        <View style={estilos.acoes}>
          <IconeBotao Icone={ArrowUp} rotulo="Subir sessão" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao Icone={ArrowDown} rotulo="Descer sessão" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
          <IconeBotao Icone={p.aberta ? ChevronUp : ChevronDown} rotulo={p.aberta ? 'Fechar sessão' : 'Abrir sessão'} aoTocar={p.aoAbrir} />
        </View>
      </View>
      {p.aberta ? (
        <View style={estilos.corpo}>
          <Campo rotulo="Nome da sessão" valor={s.nome} aoMudar={(nome) => mudar({ nome })} maxLength={80} placeholder="Ex.: Segunda - Costas" />
          <Escolha rotulo="Dia da semana" opcoes={DIAS} valor={s.diaSemana} aoMudar={(diaSemana) => mudar({ diaSemana })} />
          <Escolha rotulo="Tipo" opcoes={TIPOS_SESSAO} valor={s.tipo} aoMudar={(t) => mudar({ tipo: t, frequenciaSemanal: t === 'ACESSORIOS' ? s.frequenciaSemanal : null })} />
          {s.tipo === 'ACESSORIOS' ? (
            <View style={estilos.campoCurto}>
              <CampoNumerico rotulo="Vezes por semana" inteiro valor={s.frequenciaSemanal} aoMudar={(frequenciaSemanal) => mudar({ frequenciaSemanal })} />
            </View>
          ) : null}
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
          <Texto variante="secao">Exercícios</Texto>
          <View style={estilos.exercicios}>{p.children}</View>
          <View style={estilos.botoes}>
            <Botao rotulo="Adicionar exercício" tipo="secundario" Icone={Plus} aoTocar={p.aoNovoExercicio} />
            <Botao rotulo="Remover sessão" tipo="fantasma" Icone={Trash2} aoTocar={p.aoRemover} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  titulo: { flex: 1, gap: espaco(0.5), minHeight: 44 },
  acoes: { flexDirection: 'row' },
  corpo: { gap: espaco(1.5) },
  campoCurto: { width: 180 },
  exercicios: { gap: espaco(1) },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), justifyContent: 'space-between' },
});
