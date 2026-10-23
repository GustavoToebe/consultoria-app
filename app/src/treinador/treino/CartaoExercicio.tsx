import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, ChevronUp, Save, Trash2, Unlink } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { comModalidade, trocaApagaSeries } from '../../dominio/editorTreino';
import { erroDaCadencia, erroDaIsometria, normalizarCadencia, textoExecucao } from '../../dominio/execucaoDoExercicio';
import { MODALIDADES } from '../../dominio/modalidades';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { rotuloSalvarComo } from '../planejamento/modelos';
import { AvisoDoCampo } from './CamposDaPrescricao';
import { EditorSeries } from './EditorSeries';

interface Props {
  exercicio: ExercicioPlano;
  posicao: number;
  total: number;
  aberto: boolean;
  comProblema: boolean;
  config: Configuracao | null;
  /** Problemas do exercício que não são de uma série (`nome`, `videoUrl`, `cadencia`, `isometriaSegundos`): chave relativa a ele. */
  erros?: Problemas;
  /** Avisos do mesmo tipo (`progressao`...): aparecem, mas não travam nada. */
  avisos?: Problemas;
  /** O exercício é de um grupo: oferece "Tirar do grupo". */
  noGrupo?: boolean;
  aoAbrir: () => void;
  aoMudar: (e: ExercicioPlano) => void;
  /** Troca de modalidade que apaga as séries (de ou para cardio), já confirmada: a tela guarda o conteúdo anterior para o "Desfazer". */
  aoMudarApagandoSeries?: (e: ExercicioPlano) => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoTirarDoGrupo?: () => void;
  aoEscolherDaBiblioteca: () => void;
  aoUsarReceita: () => void;
  aoSalvarReceita: () => void;
  /** Imagem do exercício na biblioteca (nulo = fora dela ou sem imagem). */
  demonstracao?: { imagens: string[]; imagemPropriaEm: string | null } | null;
}

const OPCOES_DE_MODALIDADE: { valor: string | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Não informada' },
  ...Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor, rotulo })),
];

/** Exercício da sessão: fechado mostra o resumo das séries; aberto edita tudo. Cardio tem a prescrição própria. */
export function CartaoExercicio(p: Props) {
  const { cores } = useTema();
  const e = p.exercicio;
  const erros = p.erros ?? {};
  const avisos = p.avisos ?? {};
  const cardio = e.modalidade === 'CARDIO';
  const resumo = descreverSeries(e.series, p.config);
  const execucao = textoExecucao(e);
  const mudar = (parcial: Partial<ExercicioPlano>) => p.aoMudar({ ...e, ...parcial });
  // "Observação e vídeo" começa aberto quando algum dos dois já está preenchido.
  const [extrasAbertos, setExtrasAbertos] = useState(!!(e.observacao || e.videoUrl));
  // Modalidade pedida que apagaria as séries: espera a confirmação.
  const [modalidadePendente, setModalidadePendente] = useState<{ valor: string | null } | null>(null);
  const trocarModalidade = (valor: string | null) => {
    if (valor === e.modalidade) return;
    if (trocaApagaSeries(e, valor)) setModalidadePendente({ valor });
    else p.aoMudar(comModalidade(e, valor));
  };
  const confirmarModalidade = () => {
    if (!modalidadePendente) return;
    const novo = comModalidade(e, modalidadePendente.valor);
    setModalidadePendente(null);
    (p.aoMudarApagandoSeries ?? p.aoMudar)(novo);
  };

  return (
    <AlvoDeRolagem chave={e.uid}
      style={[
        estilos.cartao,
        { borderColor: p.comProblema ? cores.perigo : cores.borda, backgroundColor: cores.superficie2 },
      ]}>
      <View style={estilos.topo}>
        {p.demonstracao ? (
          <DemonstracaoDoExercicio exercicioId={e.exercicioId} nome={e.nome} imagens={p.demonstracao.imagens}
            imagemPropriaEm={p.demonstracao.imagemPropriaEm} papel="EQUIPE" largura={56} altura={56} preencher ampliavel />
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
              <Texto variante="suave">{cardio ? 'Sem prescrição de cardio' : 'Sem séries'}</Texto>
            )
          ) : null}
          {!p.aberto && execucao ? <Texto variante="suave">{execucao}</Texto> : null}
          <View style={estilos.selos}>
            {p.comProblema ? <Selo texto="Corrigir" tipo="perigo" /> : null}
            {cardio ? <Selo texto="Cardio" tipo="neutro" /> : null}
            {!e.progressao && !cardio ? <Selo texto="Sem progressão" tipo="neutro" /> : null}
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
              <Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => mudar({ nome })} maxLength={120} erro={erros.nome} />
            </View>
            <Botao rotulo="Trocar" tipo="secundario" Icone={ArrowLeftRight} style={estilos.trocar} aoTocar={p.aoEscolherDaBiblioteca} />
          </View>
          <Escolha rotulo="Modalidade" compacta opcoes={OPCOES_DE_MODALIDADE} valor={e.modalidade} aoMudar={trocarModalidade} />
          {!cardio ? (
            <Escolha
              rotulo="Carga do exercício"
              opcoes={[
                { valor: 'kg', rotulo: 'Em kg' },
                { valor: 'nenhuma', rotulo: 'Sem carga (elástico, peso corporal)' },
              ]}
              valor={e.unidade}
              aoMudar={(unidade) => mudar({ unidade })}
            />
          ) : null}
          {cardio ? <Texto variante="pequeno">Cardio tem prescrição própria: duração, distância, ritmo, zona e intervalos. Trocar de ou para cardio apaga as séries.</Texto> : null}
          {p.noGrupo && p.aoTirarDoGrupo ? (
            <Botao rotulo="Tirar do grupo" rotuloAcessivel={`Tirar ${e.nome || 'o exercício'} do grupo`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoTirarDoGrupo} />
          ) : null}
          <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
          <Texto variante="secao">{cardio ? 'Cardio' : 'Séries'}</Texto>
          <EditorSeries modalidade={e.modalidade} series={e.series} config={p.config} semCarga={e.unidade === 'nenhuma'} aoMudar={(series) => mudar({ series })} aoUsarReceita={p.aoUsarReceita} />
          {!cardio ? (
            <Interruptor
              rotulo="Progressão de carga"
              ajuda={e.progressao ? 'O aluno busca subir a carga.' : 'O aluno vê "Foco em controle, não em carga".'}
              valor={e.progressao}
              aoMudar={(progressao) => mudar({ progressao })}
            />
          ) : null}
          {!cardio ? <AvisoDoCampo mensagem={avisos.progressao} /> : null}
          <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
          <Texto variante="secao">Execução (opcional)</Texto>
          <View style={estilos.linhaExecucao}>
            <View style={estilos.cadencia}>
              <Campo
                rotulo="Cadência"
                valor={e.cadencia ?? ''}
                aoMudar={(t) => mudar({ cadencia: normalizarCadencia(t) })}
                erro={erroDaCadencia(e.cadencia) ?? erros.cadencia}
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
                erro={erroDaIsometria(e.isometriaSegundos) ?? erros.isometriaSegundos}
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
                erro={erroDoVideo(e.videoUrl) ?? erros.videoUrl}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={500}
              />
            </>
          ) : null}
          <View style={estilos.rodape}>
            {e.series.length && !cardio ? (
              <Botao rotulo={rotuloSalvarComo('SERIES')} tipo="fantasma" Icone={Save} aoTocar={p.aoSalvarReceita} />
            ) : null}
            <Botao rotulo="Remover exercício" tipo="perigoTexto" Icone={Trash2} aoTocar={p.aoRemover} />
          </View>
        </View>
      ) : null}
      <PainelConfirmacao
        visivel={modalidadePendente !== null}
        titulo={modalidadePendente?.valor === 'CARDIO' ? 'Trocar para cardio?' : 'Tirar o exercício do cardio?'}
        mensagem={`${e.series.length === 1 ? 'A série' : `As ${e.series.length} séries`} deste exercício ${e.series.length === 1 ? 'será apagada' : 'serão apagadas'}, porque a prescrição de cardio é outra. Dá para desfazer logo depois.`}
        rotuloConfirmar="Apagar séries e trocar"
        perigo
        aoCancelar={() => setModalidadePendente(null)}
        aoConfirmar={confirmarModalidade}
      />
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
  // Separa as partes do exercício (dados, séries, execução).
  divisor: { height: StyleSheet.hairlineWidth, marginVertical: espaco(0.5) },
});
