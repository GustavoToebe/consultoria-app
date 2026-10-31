import { router } from 'expo-router';
import { CheckCheck, RotateCcw, Trophy } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import type { Sessao } from '../api/tipos';
import {
  COMENTARIO_MAXIMO,
  contagemDeSeries,
  duracaoDoTreino,
  podeConcluirEm,
  precisaAjustarDuracao,
  sugestaoDoResultado,
  type ProblemasDaConclusao,
  type ResultadoDoTreino,
} from '../dominio/conclusaoDoTreino';
import {
  campoDaDuracao,
  disponivelAPartirDe,
  PERGUNTA_DURACAO_CURTA,
  resumoDaConclusao,
  ROTULO_DO_RESULTADO,
  segundosDoCampo,
  soMinutos,
  textoDasSeriesMarcadas,
} from '../dominio/conclusaoNaTela';
import { rotuloDoConcluir } from '../dominio/destaqueDaConclusao';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Escolha } from '../ui/Escolha';
import { Folha } from '../ui/Folha';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { caminhoDaConclusao } from './useSessaoDoDia';
import { vibrar } from '../ui/vibrar';

interface Props {
  /** Versão do plano executada (`treino.versaoId`). */
  versaoId: string;
  sessao: Sessao;
  /** Dia do treino na tela e o "hoje" do aparelho. */
  data: string;
  hoje: string;
  /** A série (pelo `uid`) está feita nesta data? Dá a sugestão "Fiz tudo"/"Fiz em parte". */
  feita: (serieUid: string) => boolean;
  /**
   * Um primário por área: o rodapé do último exercício (e o da lista quando não há o que começar) é primário; com todas
   * as séries marcadas, também o rodapé de qualquer exercício (`concluirEmDestaque`, B5).
   */
  tipo: 'primario' | 'secundario';
  cheio?: boolean;
  /** Em data futura, mostra aqui a linha "Você poderá concluir..." (só num dos pontos da tela, para não repetir). */
  avisarDataFutura?: boolean;
}

const OPCOES_DO_RESULTADO = (['COMPLETA', 'PARCIAL'] as const).map((valor) => ({ valor, rotulo: ROTULO_DO_RESULTADO[valor] }));

/**
 * "Concluir treino" (frente Engajamento, passo 0.1): o botão que abre a Folha, ou, depois de concluído, a linha
 * "Treino concluído" com o resultado, a duração e "Reabrir". O mesmo componente vai no topo e no rodapé da lista do dia
 * e do último exercício; todos leem a mesma conclusão do `AlunoProvider`, então mostram o mesmo estado. Com a chave
 * `retornoHabilitado` desligada não desenha nada. Funciona sem internet: grava no aparelho e entra na fila.
 * O comentário é dado do aluno: nunca vai a aviso, log ou mensagem de erro.
 */
export function ConcluirTreino({ versaoId, sessao, data, hoje, feita, tipo, cheio, avisarDataFutura }: Props) {
  const { retornoHabilitado } = useSessao();
  const { sessaoConcluidaDe, inicioDoTreino, concluirTreino, reabrirTreino } = useAluno();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const campoMinutos = useRef<TextInput>(null);

  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDoTreino>('PARCIAL');
  const [minutos, setMinutos] = useState('');
  const [comentario, setComentario] = useState('');
  /** O aluno respondeu "Manter" para a duração curta que está no campo. */
  const [manteve, setManteve] = useState(false);
  /** A pergunta da duração curta está na Folha (aparece ao tocar em "Concluir treino"). */
  const [perguntando, setPerguntando] = useState(false);
  const [erros, setErros] = useState<ProblemasDaConclusao>({});
  const [contagem, setContagem] = useState({ total: 0, feitas: 0 });
  const [salvando, setSalvando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  if (!retornoHabilitado) return null;
  if (!podeConcluirEm(data, hoje)) {
    return avisarDataFutura && data > hoje ? <Texto variante="suave">{disponivelAPartirDe(data)}</Texto> : null;
  }

  const conclusao = sessaoConcluidaDe(versaoId, sessao.uid, data);
  // B5 (30/10): com todas as séries marcadas o botão diz "Revisar e concluir treino"; o toque continua só abrindo a Folha.
  const marcadas = contagemDeSeries(sessao, feita);
  const rotulo = rotuloDoConcluir(marcadas.total, marcadas.feitas);

  // Estado da Folha montado no toque (nunca num efeito): sugestão pelas séries marcadas e duração desde a 1ª série.
  const abrir = () => {
    const c = contagemDeSeries(sessao, feita);
    setContagem(c);
    setResultado(sugestaoDoResultado(c.total, c.feitas));
    setMinutos(campoDaDuracao(duracaoDoTreino(inicioDoTreino(versaoId, sessao.uid, data), new Date())));
    // Reaberto e concluído de novo: o comentário que já estava volta para o campo.
    setComentario(conclusao?.comentario ?? '');
    setManteve(false);
    setPerguntando(false);
    setErros({});
    setAberto(true);
  };

  const concluir = async (mantida: boolean) => {
    const segundos = segundosDoCampo(minutos);
    if (precisaAjustarDuracao(segundos) && !mantida) {
      setPerguntando(true);
      return;
    }
    setSalvando(true);
    try {
      const r = await concluirTreino({ planoVersaoId: versaoId, sessaoUid: sessao.uid, data, resultado, duracaoSegundos: segundos, comentario });
      if (r.ok) {
        vibrar.sucesso();
        setAberto(false);
        avisar('Treino concluído.', 'sucesso');
        // "Bom trabalho!" (Engajamento 0.4): o voltar traz de volta a esta tela.
        router.push(caminhoDaConclusao(sessao.uid, data));
        return;
      }
      setErros(r.problemas);
      const geral = r.problemas.data ?? r.problemas.geral;
      if (geral) avisar(geral, 'perigo');
    } catch (erro) {
      avisar(textoDoErro(erro), 'perigo');
    } finally {
      setSalvando(false);
    }
  };

  const reabrir = async () => {
    setReabrindo(true);
    try {
      const r = await reabrirTreino({ planoVersaoId: versaoId, sessaoUid: sessao.uid, data });
      if (r.ok) avisar('Treino reaberto.', 'sucesso');
      else avisar(r.problemas.data ?? r.problemas.geral ?? 'Não foi possível reabrir o treino agora.', 'perigo');
    } catch (erro) {
      avisar(textoDoErro(erro), 'perigo');
    } finally {
      setReabrindo(false);
    }
  };

  const mudarMinutos = (texto: string) => {
    setMinutos(soMinutos(texto));
    // Valor novo: a resposta "Manter" e o erro do campo eram do anterior.
    setManteve(false);
    setPerguntando(false);
    setErros((antes) => ({ ...antes, duracao: undefined }));
  };

  const ajustar = () => {
    setPerguntando(false);
    campoMinutos.current?.focus();
  };

  const manter = () => {
    setManteve(true);
    setPerguntando(false);
    void concluir(true);
  };

  const semDuracao = minutos === '';
  const ajudaDaDuracao = semDuracao
    ? 'Deixe em branco se não souber.'
    : inicioDoTreino(versaoId, sessao.uid, data)
      ? 'Contada a partir da primeira série marcada. Você pode corrigir.'
      : undefined;

  const ponto = conclusao?.concluida ? (
    <Animated.View
      entering={reduzido ? undefined : FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      style={estilos.concluido}>
      <View style={estilos.textosConcluido}>
        <View style={estilos.selo}>
          <Selo texto="Treino concluído" tipo="sucesso" />
          {conclusao.vistoEm ? <Selo texto="Visto pelo treinador" tipo="sucesso" /> : null}
        </View>
        {resumoDaConclusao(conclusao) ? (
          <Texto variante="suave" numerico>
            {resumoDaConclusao(conclusao)}
          </Texto>
        ) : null}
      </View>
      <LinhaDeAcoes>
        <Botao
          rotulo="Ver resumo"
          rotuloAcessivel="Ver o resumo do treino"
          tipo="secundario"
          Icone={Trophy}
          aoTocar={() => router.push(caminhoDaConclusao(sessao.uid, data))}
        />
        <Botao
          rotulo="Reabrir"
          rotuloAcessivel="Reabrir o treino"
          tipo="secundario"
          Icone={RotateCcw}
          carregando={reabrindo}
          aoTocar={() => void reabrir()}
        />
      </LinhaDeAcoes>
    </Animated.View>
  ) : (
    <Botao rotulo={rotulo} tipo={tipo} cheio={cheio} Icone={CheckCheck} aoTocar={abrir} />
  );

  return (
    <>
      {ponto}
      <Folha
        visivel={aberto}
        titulo="Concluir treino"
        aoFechar={() => setAberto(false)}
        rodape={
          <>
            <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => setAberto(false)} />
            <Botao rotulo="Concluir treino" carregando={salvando} aoTocar={() => void concluir(manteve)} />
          </>
        }>
        <View style={estilos.bloco}>
          <Escolha rotulo="Resultado" opcoes={OPCOES_DO_RESULTADO} valor={resultado} aoMudar={setResultado} distribuida />
          <Texto variante="pequeno" numerico>
            {textoDasSeriesMarcadas(contagem.feitas, contagem.total)}
          </Texto>
          {erros.resultado ? (
            <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">
              {erros.resultado}
            </Texto>
          ) : null}
        </View>

        <View style={estilos.bloco}>
          <Campo
            ref={campoMinutos}
            numerico
            rotulo="Duração em minutos"
            valor={minutos}
            aoMudar={mudarMinutos}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
            placeholder="—"
            sufixo="min"
            erro={erros.duracao}
            ajuda={ajudaDaDuracao}
          />
          {perguntando ? (
            <View
              style={[estilos.pergunta, { backgroundColor: cores.superficie2, borderColor: cores.bordaCampo, borderLeftColor: cores.atencao }]}
              accessibilityRole="alert">
              <Texto accessibilityLiveRegion="polite">{PERGUNTA_DURACAO_CURTA}</Texto>
              <LinhaDeAcoes>
                <Botao rotulo="Ajustar duração" tipo="secundario" aoTocar={ajustar} />
                <Botao rotulo="Manter" tipo="secundario" aoTocar={manter} />
              </LinhaDeAcoes>
            </View>
          ) : null}
        </View>

        <View style={estilos.bloco}>
          <Campo
            rotulo="Como foi seu treino? (opcional)"
            valor={comentario}
            aoMudar={setComentario}
            linhas={3}
            maxLength={COMENTARIO_MAXIMO}
            erro={erros.comentario}
          />
          <Texto
            variante="pequeno"
            numerico
            style={estilos.contador}
            accessibilityLabel={`${comentario.length} de ${COMENTARIO_MAXIMO} caracteres`}>
            {comentario.length}/{COMENTARIO_MAXIMO}
          </Texto>
        </View>
      </Folha>
    </>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.75) },
  concluido: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  textosConcluido: { flexGrow: 1, flexShrink: 1, flexBasis: 180, gap: espaco(0.5) },
  selo: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  pergunta: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  contador: { alignSelf: 'flex-end' },
});
