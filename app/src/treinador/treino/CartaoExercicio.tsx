import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { MAXIMO_POR_GRUPO } from '../../dominio/combinacoes';
import { erroDaCadencia, erroDaIsometria, normalizarCadencia, textoExecucao } from '../../dominio/execucaoDoExercicio';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Texto } from '../../ui/Texto';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { EditorSeries } from './EditorSeries';
import { MODALIDADES } from '../../dominio/modalidades';

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
  /** Ligar ao anterior não passa do máximo do grupo (falso no primeiro da sessão). */
  podeJuntar: boolean;
  /** Primeiro de um grupo de exatamente 2: oferece "Bi-set" ou "Supersérie". */
  primeiroDeDupla: boolean;
  /** Imagem do exercício na biblioteca (nulo = fora dela ou sem imagem). */
  demonstracao?: { imagens: string[]; imagemPropriaEm: string | null } | null;
}

const NOMES_DA_DUPLA: { valor: 'BISET' | 'SUPERSERIE'; rotulo: string }[] = [
  { valor: 'BISET', rotulo: 'Bi-set' },
  { valor: 'SUPERSERIE', rotulo: 'Supersérie' },
];

/** Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. */
export function CartaoExercicio(p: Props) {
  const { cores } = useTema();
  const e = p.exercicio;
  const resumo = descreverSeries(e.series);
  const execucao = textoExecucao(e);
  const mudar = (parcial: Partial<ExercicioPlano>) => p.aoMudar({ ...e, ...parcial });
  // "Observação e vídeo" começa aberto quando algum dos dois já está preenchido.
  const [extrasAbertos, setExtrasAbertos] = useState(!!(e.observacao || e.videoUrl));

  return (
    <AlvoDeRolagem chave={e.uid}
      style={[
        estilos.cartao,
        { borderColor: p.comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 },
      ]}>
      <View style={estilos.topo}>
        {p.demonstracao ? (
          <DemonstracaoDoExercicio exercicioId={e.exercicioId} nome={e.nome} imagens={p.demonstracao.imagens}
            imagemPropriaEm={p.demonstracao.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} />
        ) : null}
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
          {!p.aberto && execucao ? <Texto variante="suave">{execucao}</Texto> : null}
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
          <View style={estilos.linhaNome}>
            <View style={estilos.campoNome}>
              <Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} />
            </View>
            <Botao rotulo="Trocar" tipo="secundario" Icone={ArrowLeftRight} style={estilos.trocar} aoTocar={p.aoEscolherDaBiblioteca} />
          </View>
          {e.modalidade ? <Texto variante="pequeno">Modalidade: {MODALIDADES[e.modalidade] ?? e.modalidade}</Texto> : null}
          {p.posicao > 0 ? (
            p.podeJuntar || e.juntoComAnterior ? (
              <Interruptor
                rotulo="Fazer junto com o anterior (sem descanso)"
                ajuda="Bi-set, tri-set ou circuito: o aluno faz um exercício logo depois do outro. Ponha o descanso no último do grupo."
                valor={!!e.juntoComAnterior}
                aoMudar={(junto) => mudar({ juntoComAnterior: junto || null })}
              />
            ) : (
              <Texto variante="pequeno">O grupo anterior já tem {MAXIMO_POR_GRUPO} exercícios, o máximo para fazer juntos.</Texto>
            )
          ) : null}
          {p.primeiroDeDupla ? (
            <Escolha
              rotulo="Nome do grupo"
              opcoes={NOMES_DA_DUPLA}
              valor={e.combinacao === 'SUPERSERIE' ? 'SUPERSERIE' : 'BISET'}
              aoMudar={(v) => mudar({ combinacao: v === 'SUPERSERIE' ? 'SUPERSERIE' : null })}
            />
          ) : null}
          <Texto variante="secao">Séries</Texto>
          <Escolha
            rotulo="Carga"
            opcoes={[
              { valor: 'kg', rotulo: 'Em kg' },
              { valor: 'nenhuma', rotulo: 'Sem carga (elástico, peso corporal)' },
            ]}
            valor={e.unidade}
            aoMudar={(unidade) => mudar({ unidade })}
          />
          <EditorSeries series={e.series} config={p.config} aoMudar={(series) => mudar({ series })} aoUsarReceita={p.aoUsarReceita} />
          <Interruptor
            rotulo="Progressão de carga"
            ajuda={e.progressao ? 'O aluno busca subir a carga.' : 'O aluno vê "Foco em controle, não em carga".'}
            valor={e.progressao}
            aoMudar={(progressao) => mudar({ progressao })}
          />
          <Texto variante="secao">Execução (opcional)</Texto>
          <View style={estilos.linhaExecucao}>
            <View style={estilos.cadencia}>
              <Campo
                rotulo="Cadência"
                valor={e.cadencia ?? ''}
                aoMudar={(t) => mudar({ cadencia: normalizarCadencia(t) })}
                erro={erroDaCadencia(e.cadencia)}
                ajuda="Descida-pausa embaixo-subida-pausa em cima, em segundos; X = o mais rápido possível."
                placeholder="Ex.: 3-1-1-0"
                autoCapitalize="characters"
                maxLength={15}
              />
            </View>
            <View style={estilos.isometria}>
              <CampoNumerico
                rotulo="Isometria"
                inteiro
                sufixo="s"
                valor={e.isometriaSegundos ?? null}
                aoMudar={(isometriaSegundos) => mudar({ isometriaSegundos })}
                erro={erroDaIsometria(e.isometriaSegundos)}
                ajuda="Segure N s; diga onde na observação."
              />
            </View>
          </View>
          <CabecalhoDeGrupo titulo="Observação e vídeo" aberto={extrasAbertos} aoAlternar={() => setExtrasAbertos((v) => !v)} />
          {extrasAbertos ? (
            <>
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
            </>
          ) : null}
          <View style={estilos.rodape}>
            {e.series.length ? (
              <Botao rotulo={rotuloSalvarComo('SERIES')} tipo="fantasma" Icone={Save} aoTocar={p.aoSalvarReceita} />
            ) : null}
            <Botao rotulo="Remover exercício" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} />
          </View>
        </View>
      ) : null}
    </AlvoDeRolagem>
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
  linhaNome: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(1) },
  campoNome: { flex: 1 },
  // O Botao se alinha ao topo por padrão; aqui fica na base, rente ao campo.
  trocar: { alignSelf: 'flex-end' },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espaco(1) },
  linhaExecucao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  cadencia: { flexGrow: 1, flexBasis: 220 },
  isometria: { width: 180 },
});
