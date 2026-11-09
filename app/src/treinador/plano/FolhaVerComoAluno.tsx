import { ArrowLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { CabecalhoDoGrupo } from '../../aluno/CabecalhoDoGrupo';
import { DietaDoAluno } from '../../aluno/DietaDoAluno';
import { ExercicioAluno } from '../../aluno/ExercicioAluno';
import { ExerciciosDoDia } from '../../aluno/ExerciciosDoDia';
import { LinhaDaDivisao } from '../../aluno/LinhaDaDivisao';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import type { ConteudoDieta, ConteudoTreino } from '../../api/tipos';
import { posicaoNoGrupo } from '../../dominio/combinacoes';
import { contagem } from '../../dominio/contagens';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { ehDeHoje, letraDaDivisao } from '../../dominio/inicioDoAluno';
import { alimentosDaDieta } from '../../dominio/listaDeCompras';
import { configDoTreino } from '../../dominio/metodologia';
import { MODALIDADES } from '../../dominio/modalidades';
import { periodoCurto } from '../../dominio/periodoCurto';
import { dietaDaPrevia, treinoDaPrevia, type PlanoNoEditor } from '../../dominio/previaDoAluno';
import { contagemDoExercicio, nomeComDia, sessoesDaSemana } from '../../dominio/semana';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { useRolagem } from '../../ui/RolagemComTopo';
import { ContextoDaUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';
import { buscarFatores } from '../dieta/buscarFatores';

/** Texto exato da D4 do plano `ver-como-aluno`. */
export const TEXTO_DA_PREVIA = 'Prévia: é assim que o aluno vê. Nada é registrado aqui.';
/** D5: no PC a prévia tem a largura de um celular grande, para parecer a tela do aluno. */
const LARGURA_DO_CELULAR = 420;
/** Sem o pacote do aluno a prévia não sabe o arredondamento da consultoria: o mesmo padrão do `useSessaoDoDia` sem pacote. */
const BASE_SEM_PACOTE = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };
const SEM_EFEITO = () => undefined;
const TOPO = 'previa-do-aluno-topo';

export type PreviaDoPlano =
  | { tipo: 'treino'; estado: PlanoNoEditor<ConteudoTreino> }
  | { tipo: 'dieta'; estado: PlanoNoEditor<ConteudoDieta> };

/**
 * "Ver como o aluno" (C34): o que está no editor, salvo ou não, montado com os componentes das telas do aluno, só para
 * ler. Não monta o `AlunoProvider` (ele grava pacote e fila no aparelho em nome de quem está logado) e nada aqui grava:
 * os botões de marcar ficam desabilitados (`ExercicioAluno previa`, `DietaDoAluno previa`) e a única chamada é o
 * `GET /alimentos/fatores` da dieta. O conteúdo é a cópia tirada ao abrir; a Folha cobre o editor enquanto está aberta.
 */
export function FolhaVerComoAluno({ previa, aoFechar }: { previa: PreviaDoPlano; aoFechar: () => void }) {
  // "Agora" da versão simulada: fixo enquanto a folha está aberta.
  const [agora] = useState(() => new Date());
  return (
    <Folha visivel titulo="Ver como o aluno" largura={LARGURA_EDITOR} aoFechar={aoFechar} faixa={<Alerta tom="atencao" texto={TEXTO_DA_PREVIA} />}>
      {/* Decisão 17 (Gustavo, 04/11): a unidade do aluno fica no aparelho dele, então a prévia mostra em kg, que é como o plano é guardado. */}
      <ContextoDaUnidadeDeCarga.Provider value="kg">
        <TelaDoCelular>
          {previa.tipo === 'treino' ? <PreviaDoTreino estado={previa.estado} agora={agora} /> : <PreviaDaDieta estado={previa.estado} agora={agora} />}
        </TelaDoCelular>
      </ContextoDaUnidadeDeCarga.Provider>
    </Folha>
  );
}

/** No PC, uma "tela" de celular no meio da folha, com o fundo do app do aluno; no celular, a folha já tem essa largura. */
function TelaDoCelular({ children }: { children: ReactNode }) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_LATERAL;
  return (
    <View
      testID="previa-do-aluno"
      style={[estilos.tela, largo && [estilos.moldura, { backgroundColor: cores.fundo, borderColor: cores.borda, borderWidth: bordas.bloco }]]}>
      {children}
    </View>
  );
}

/** Título de cada "tela" da prévia, como o cabeçalho do app do aluno (abaixo do título da folha). */
function TituloDaTela({ titulo, subtitulo }: { titulo: string; subtitulo?: string | null }) {
  return (
    <View style={estilos.titulo}>
      <Texto variante="titulo" nivel={3}>{titulo}</Texto>
      {subtitulo ? <Texto variante="suave" numerico>{subtitulo}</Texto> : null}
    </View>
  );
}

/** Troca de "tela" sem segurar nada: um fade curto, nenhum com o movimento reduzido. */
function Entrada({ chave, children }: { chave: string; children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  return (
    <Animated.View key={chave} style={estilos.pilha} entering={reduzido ? undefined : FadeIn.duration(160).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}

/**
 * O caminho do aluno: divisões da semana (aba Treino) → o dia (lista de exercícios) → o exercício (séries). A navegação é
 * estado local da folha, com "Voltar"; sem `href`, para nenhuma rota do aluno abrir com a sessão do treinador.
 */
function PreviaDoTreino({ estado, agora }: { estado: PlanoNoEditor<ConteudoTreino>; agora: Date }) {
  const { rolarAte } = useRolagem();
  const [sessaoUid, setSessaoUid] = useState<string | null>(null);
  const [exercicioUid, setExercicioUid] = useState<string | null>(null);
  const [cargasDoDia, setCargasDoDia] = useState<Record<string, number | null>>({});
  const treino = treinoDaPrevia(estado, agora);
  const conteudo = treino.conteudo;
  const hoje = hojeIso();
  const config = configDoTreino(conteudo, BASE_SEM_PACOTE);
  const divisoes = sessoesDaSemana(conteudo);
  const sessao = divisoes.find((s) => s.uid === sessaoUid) ?? null;
  const posicao = sessao && exercicioUid ? sessao.exercicios.findIndex((e) => e.uid === exercicioUid) : -1;
  const exercicio = sessao && posicao >= 0 ? sessao.exercicios[posicao] : null;
  const ir = (sessaoNova: string | null, exercicioNovo: string | null) => {
    setSessaoUid(sessaoNova);
    setExercicioUid(exercicioNovo);
    rolarAte([TOPO]);
  };

  if (sessao && exercicio) {
    const noGrupo = posicaoNoGrupo(sessao, posicao, config.metodologia);
    const modalidade = exercicio.modalidade ? `${MODALIDADES[exercicio.modalidade] ?? exercicio.modalidade} · ` : '';
    return (
      <Entrada chave={`exercicio-${exercicio.uid}`}>
        <AlvoDeRolagem chave={TOPO}><Voltar rotulo="Lista do dia" aoTocar={() => ir(sessao.uid, null)} /></AlvoDeRolagem>
        <TituloDaTela titulo={exercicio.nome || 'Exercício'} subtitulo={`${modalidade}Exercício ${posicao + 1} de ${sessao.exercicios.length} · ${nomeComDia(sessao)}`} />
        {noGrupo ? (
          <Cartao>
            <CabecalhoDoGrupo bloco={noGrupo.grupo} metodologia={config.metodologia} />
            <Texto numerico>Exercício {noGrupo.posicao} de {noGrupo.tamanho}</Texto>
          </Cartao>
        ) : null}
        <ExercicioAluno
          key={exercicio.uid}
          previa
          exercicio={exercicio}
          data={hoje}
          cargaDoDia={cargasDoDia[exercicio.uid] ?? null}
          ultima={null}
          registroDe={SEM_EFEITO}
          config={config}
          aoMudarCargaDoDia={(kg) => setCargasDoDia((atual) => ({ ...atual, [exercicio.uid]: kg }))}
          aoRegistrar={SEM_EFEITO}
          chaveDaExecucao={(serieUid) => `${treino.versaoId}|${serieUid}|${hoje}`}
          descansoNaSerie={!noGrupo || noGrupo.descansoPorSerie}
        />
      </Entrada>
    );
  }

  if (sessao) {
    return (
      <Entrada chave={`sessao-${sessao.uid}`}>
        <AlvoDeRolagem chave={TOPO}><Voltar rotulo="Divisões da semana" aoTocar={() => ir(null, null)} /></AlvoDeRolagem>
        <TituloDaTela titulo={nomeComDia(sessao)} subtitulo={contagem(sessao.exercicios.length, 'exercício programado', 'exercícios programados')} />
        {sessao.cardio || sessao.observacao ? (
          <Cartao>
            {sessao.cardio ? <Texto>Cardio: {sessao.cardio}</Texto> : null}
            {sessao.observacao ? <Texto variante="suave">{sessao.observacao}</Texto> : null}
          </Cartao>
        ) : null}
        <ExerciciosDoDia
          sessao={sessao}
          metodologia={config.metodologia}
          tipoTrabalho={config.tipoTrabalho}
          contagemDe={(e) => contagemDoExercicio(e, () => false, config.metodologia)}
          cargaDoDia={() => null}
          ultimaCarga={() => null}
          aoAbrir={(e) => ir(sessao.uid, e.uid)}
          animar={false}
        />
      </Entrada>
    );
  }

  const periodo = periodoCurto(treino, hoje);
  return (
    <Entrada chave="divisoes">
      <AlvoDeRolagem chave={TOPO}><TituloDaTela titulo="Treino" subtitulo="As divisões da semana, do jeito que o treinador montou." /></AlvoDeRolagem>
      <Texto variante="subtitulo" numerico>{periodo ? `${treino.titulo} · ${periodo}` : treino.titulo}</Texto>
      {divisoes.length ? (
        <SecaoDoInicio titulo="Divisões da semana">
          <View style={estilos.pilhaCurta}>
            {divisoes.map((s) => (
              <LinhaDaDivisao
                key={s.uid}
                sessao={s}
                letra={letraDaDivisao(conteudo, s)}
                hoje={ehDeHoje(s, diaDaSemana())}
                aoAbrir={s.exercicios.length ? () => ir(s.uid, null) : undefined}
              />
            ))}
          </View>
        </SecaoDoInicio>
      ) : (
        <Vazio titulo="Sem divisões" texto="O aluno ainda não veria nenhuma divisão: adicione uma no editor." />
      )}
      {conteudo.objetivo || conteudo.orientacoes ? (
        <Cartao titulo="Orientações do treinador">
          {conteudo.objetivo ? <Texto>Objetivo: {conteudo.objetivo}</Texto> : null}
          {conteudo.orientacoes ? <Texto variante="suave">{conteudo.orientacoes}</Texto> : null}
        </Cartao>
      ) : null}
    </Entrada>
  );
}

/** A aba Dieta do aluno com os fatores e o grupo da biblioteca nos itens (D7), buscados ao abrir, como a lista de compras. */
function PreviaDaDieta({ estado, agora }: { estado: PlanoNoEditor<ConteudoDieta>; agora: Date }) {
  const ids = alimentosDaDieta(estado.conteudo);
  // A folha cobre o editor: o conteúdo não muda enquanto ela está aberta, então a chave só serve para buscar uma vez.
  const fatores = useCarregar(ids.length ? `previa-fatores:${ids.join(',')}` : null, () => buscarFatores(ids));
  const prontos = ids.length ? fatores.dados : [];
  return (
    <View style={estilos.pilha}>
      <TituloDaTela titulo="Dieta" subtitulo="A dieta que o seu treinador publicou, só para consulta." />
      {fatores.erro ? <MensagemErro texto={textoDoErro(fatores.erro)} erro={fatores.erro} tentarDeNovo={fatores.recarregar} /> : null}
      {!fatores.erro && !prontos ? <Esqueleto /> : null}
      {!fatores.erro && prontos ? <DietaDoAluno versao={dietaDaPrevia(estado, prontos, agora)} salva={false} previa /> : null}
    </View>
  );
}

function Voltar({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <View style={estilos.voltar}>
      <Botao rotulo={rotulo} rotuloAcessivel={`Voltar para ${rotulo.toLowerCase()}`} tipo="fantasma" Icone={ArrowLeft} aoTocar={aoTocar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { width: '100%', maxWidth: LARGURA_DO_CELULAR, alignSelf: 'center' },
  moldura: { borderRadius: RAIO, padding: espaco(2) },
  pilha: { gap: espaco(1.5) },
  pilhaCurta: { gap: espaco(1) },
  titulo: { gap: 2 },
  voltar: { alignItems: 'flex-start', marginLeft: -espaco(1) },
});
