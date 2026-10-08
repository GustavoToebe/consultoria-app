import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronUp, NotebookTabs, Save, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { EditorSeries } from './EditorSeries';
import { MODALIDADES } from './FolhaBiblioteca';

interface Props {
  exercicio: ExercicioPlano;
  posicao: number;
  total: number;
  aberto: boolean;
  comProblema: boolean;
  config: Configuracao | null;
  aoAbrir: () => void;
  aoMudar: (e: ExercicioPlano) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoEscolherDaBiblioteca: () => void;
  aoUsarReceita: () => void;
  aoSalvarReceita: () => void;
}

/** Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. */
export function CartaoExercicio(p: Props) {
  const { cores } = useTema();
  const e = p.exercicio;
  const resumo = descreverSeries(e.series);
  const mudar = (parcial: Partial<ExercicioPlano>) => p.aoMudar({ ...e, ...parcial });

  return (
    <View
      style={[
        estilos.cartao,
        { borderColor: p.comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 },
      ]}>
      <View style={estilos.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${p.aberto ? 'Fechar' : 'Editar'} ${e.nome || 'exercício sem nome'}`}
          accessibilityState={{ expanded: p.aberto }}
          onPress={p.aoAbrir}
          style={estilos.titulo}>
          <Texto style={estilos.nome}>
            {p.posicao + 1}. {e.nome || 'Exercício sem nome'}
          </Texto>
          {!p.aberto ? (
            resumo.length ? (
              resumo.map((r, i) => (
                <Texto key={i} variante="suave">
                  {r}
                </Texto>
              ))
            ) : (
              <Texto variante="suave">Sem séries</Texto>
            )
          ) : null}
          <View style={estilos.selos}>
            {p.comProblema ? <Selo texto="Corrigir" tipo="perigo" /> : null}
            {!e.progressao ? <Selo texto="Sem progressão" tipo="neutro" /> : null}
            {e.exercicioId === null && e.nome ? <Selo texto="Fora da biblioteca" tipo="neutro" /> : null}
          </View>
        </Pressable>
        <View style={estilos.acoes}>
          <IconeBotao Icone={ArrowUp} rotulo="Subir exercício" desabilitado={p.posicao === 0} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao Icone={ArrowDown} rotulo="Descer exercício" desabilitado={p.posicao === p.total - 1} aoTocar={() => p.aoMover(1)} />
          <IconeBotao Icone={p.aberto ? ChevronUp : ChevronDown} rotulo={p.aberto ? 'Fechar exercício' : 'Editar exercício'} aoTocar={p.aoAbrir} />
        </View>
      </View>
      {p.aberto ? (
        <View style={estilos.corpo}>
          <View style={estilos.botoes}>
            <Botao rotulo="Escolher da biblioteca" tipo="secundario" Icone={BookOpen} aoTocar={p.aoEscolherDaBiblioteca} />
            <Botao rotulo="Usar receita de séries" tipo="secundario" Icone={NotebookTabs} aoTocar={p.aoUsarReceita} />
          </View>
          <Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} />
          {e.modalidade ? <Texto variante="pequeno">Modalidade: {MODALIDADES[e.modalidade] ?? e.modalidade}</Texto> : null}
          <Campo
            rotulo="Observação para o aluno"
            valor={e.observacao ?? ''}
            aoMudar={(t) => mudar({ observacao: t || null })}
            linhas={2}
            maxLength={1000}
          />
          <Campo
            rotulo="Vídeo (link do YouTube, opcional)"
            valor={e.videoUrl ?? ''}
            aoMudar={(t) => mudar({ videoUrl: t.trim() || null })}
            erro={erroDoVideo(e.videoUrl)}
            autoCapitalize="none"
            keyboardType="url"
            maxLength={500}
          />
          <Interruptor
            rotulo="Progressão de carga"
            ajuda={e.progressao ? 'O aluno busca subir a carga.' : 'O aluno vê "Foco em controle, não em carga".'}
            valor={e.progressao}
            aoMudar={(progressao) => mudar({ progressao })}
          />
          <Escolha
            rotulo="Carga"
            opcoes={[
              { valor: 'kg', rotulo: 'Em kg' },
              { valor: 'nenhuma', rotulo: 'Sem carga (elástico, peso corporal)' },
            ]}
            valor={e.unidade}
            aoMudar={(unidade) => mudar({ unidade })}
          />
          <Texto variante="secao">Séries</Texto>
          <EditorSeries series={e.series} config={p.config} aoMudar={(series) => mudar({ series })} />
          <View style={estilos.rodape}>
            {e.series.length ? (
              <Botao rotulo="Salvar séries como receita" tipo="fantasma" Icone={Save} aoTocar={p.aoSalvarReceita} />
            ) : null}
            <Botao rotulo="Remover exercício" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  titulo: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  nome: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5), marginTop: 2 },
  acoes: { flexDirection: 'row' },
  corpo: { gap: espaco(1.5) },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espaco(1) },
});
