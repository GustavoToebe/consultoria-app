import { Check, Circle, Eye, Square, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { EnqueteDoMural, OpcaoDaEnquete } from '../api/comunidadeTipos';
import {
  AVISO_ANTES_DO_VOTO, percentualDaOpcao, textoDosParticipantes, textoDosVotos, votosAoTocar,
} from '../dominio/comunidade';
import { dataHoraParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { FotoDePerfil, IniciaisDePerfil } from '../ui/FotoDePerfil';
import { useDestaques } from '../ui/NumeroDeDestaque';
import { Selo } from '../ui/Selo';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

const MOTIVO_ENCERRADA = 'A enquete foi encerrada.';

/**
 * Enquete de um post (D9; a pergunta é o texto do post, mostrado pelo cartão). O aviso de que o voto é identificado vem
 * **antes** das opções, sempre que ainda dá para votar. Cada opção é o próprio controle: tocar vota (escolha única troca o
 * voto, tocar de novo retira; várias respostas liga e desliga), sem botão "Votar" (o cartão não ganha um primário por post).
 * O resultado é neutro no texto ("40% · 4 votos", sobre as pessoas que votaram) e a barra usa o azul de destaque; a opção
 * em que a pessoa votou ganha seleção neutra (superfície de seleção, contorno forte, ✓ e "Seu voto"), nunca verde. Sem total
 * de elegíveis. `motivo` (sem internet, por exemplo) desabilita as opções e é dito embaixo delas.
 */
export function BlocoDaEnquete({ postId, enquete, aoVotar, motivo, ocupado, aoMostrarVotos, baixarFotoDoVotante }: {
  postId: string;
  enquete: EnqueteDoMural;
  /** O conjunto novo de opções; sem isso (quem não pode votar), só o resultado. */
  aoVotar?: (opcaoIds: string[]) => void;
  motivo?: string;
  ocupado?: boolean;
  aoMostrarVotos: () => void;
  baixarFotoDoVotante: (autorId: string) => Promise<Blob>;
}) {
  const { cores } = useTema();
  const azul = useDestaques().azul.cor;
  const bloqueio = enquete.encerrada ? MOTIVO_ENCERRADA : motivo;
  const podeTocar = !!aoVotar && !bloqueio && !ocupado;
  const varias = enquete.variasRespostas;
  const tipoDoControle = varias ? 'checkbox' : 'radio';
  return (
    <View style={estilos.bloco}>
      <View style={estilos.meta}>
        <Texto variante="suave">{varias ? 'Escolha uma ou mais opções' : 'Escolha uma opção'}</Texto>
        {enquete.encerrada
          ? <Selo texto="Encerrada" tipo="neutro" />
          : enquete.encerraEm ? <Texto variante="suave">{`Encerra em ${dataHoraParaTela(enquete.encerraEm)}`}</Texto> : null}
      </View>

      {aoVotar && !enquete.encerrada ? (
        <View style={estilos.aviso} accessibilityRole="text">
          <Eye size={16} color={cores.textoSuave} aria-hidden style={estilos.iconeDoAviso} />
          <Texto variante="pequeno" style={estilos.textoDoAviso}>{AVISO_ANTES_DO_VOTO}</Texto>
        </View>
      ) : null}

      {/* Rádios só quando votável e de escolha única; senão, grupo (os filhos não são itens de lista nem rádios). */}
      <View accessibilityRole={aoVotar && !varias ? 'radiogroup' : undefined} role={aoVotar && !varias ? 'radiogroup' : 'group'}
        accessibilityLabel="Opções da enquete"
        style={estilos.opcoes}>
        {enquete.opcoes.map((o) => (
          <LinhaDaOpcao key={o.id} postId={postId} opcao={o} enquete={enquete} azul={azul} tipo={tipoDoControle}
            interativa={!!aoVotar} desabilitada={!podeTocar} motivo={bloqueio}
            aoTocar={() => aoVotar?.(votosAoTocar(enquete, o.id))} baixarFotoDoVotante={baixarFotoDoVotante} />
        ))}
      </View>
      {aoVotar && bloqueio && !enquete.encerrada ? <Texto variante="pequeno">{bloqueio}</Texto> : null}

      <View style={[estilos.meta, estilos.rodape]}>
        <View style={estilos.participantes}>
          <Users size={16} color={cores.textoSuave} aria-hidden />
          <Texto variante="suave" numerico>{textoDosParticipantes(enquete.participantes)}</Texto>
        </View>
        {enquete.participantes > 0 ? <Botao rotulo="Mostrar votos" tipo="fantasma" aoTocar={aoMostrarVotos} /> : null}
      </View>
    </View>
  );
}

function LinhaDaOpcao({ postId, opcao, enquete, azul, tipo, interativa, desabilitada, motivo, aoTocar, baixarFotoDoVotante }: {
  postId: string;
  opcao: OpcaoDaEnquete;
  enquete: EnqueteDoMural;
  azul: string;
  tipo: 'radio' | 'checkbox';
  interativa: boolean;
  desabilitada: boolean;
  motivo?: string;
  aoTocar: () => void;
  baixarFotoDoVotante: (autorId: string) => Promise<Blob>;
}) {
  const { cores } = useTema();
  const minha = enquete.meusVotos.includes(opcao.id);
  const pct = percentualDaOpcao(opcao.votos, enquete.participantes);
  const resultado = `${pct}% · ${textoDosVotos(opcao.votos)}`;
  const rotulo = `${opcao.texto}, ${textoDosVotos(opcao.votos)}, ${pct}%${minha ? ', seu voto' : ''}`;
  const Marcador = minha ? Check : tipo === 'radio' ? Circle : Square;
  const corpo = (hover: boolean) => (
    <View style={[estilos.opcao, {
      backgroundColor: minha ? cores.superficie3 : hover ? cores.superficie2 : cores.superficie,
      borderColor: minha ? cores.bordaCampo : cores.divisor,
    }]}>
      <View style={estilos.topoDaOpcao}>
        {interativa ? <Marcador size={18} color={cores.texto} strokeWidth={minha ? 2.75 : 2} aria-hidden /> : null}
        <Texto style={[estilos.textoDaOpcao, { fontFamily: minha ? fontes.semi : fontes.medio }]} cor={cores.texto}>{opcao.texto}</Texto>
        <Texto numerico cor={cores.texto} aria-hidden>{resultado}</Texto>
      </View>
      {/* Trilha em `fundo` (rebaixada no cartão): com `divisor`, as bordas reforçadas deixavam o azul abaixo de 3:1 (coresDaEnquete.test). */}
      <View style={[estilos.trilha, { backgroundColor: cores.fundo }]} aria-hidden>
        <View style={[estilos.barra, { width: `${pct}%`, backgroundColor: azul }]} />
      </View>
      {minha || opcao.votantesAmostra.length ? (
        <View style={estilos.pe} aria-hidden>
          <View style={estilos.amostra}>
            {opcao.votantesAmostra.map((v, i) => (
              <View key={v.autorId} style={[estilos.rosto, i > 0 && estilos.rostoSobreposto, { borderColor: cores.superficie }]}>
                {v.temFoto
                  ? <FotoDePerfil chave={`votante:${postId}:${v.autorId}`} carregar={() => baixarFotoDoVotante(v.autorId)} nome={v.nome} tamanho={TAMANHO_DO_ROSTO} />
                  : <IniciaisDePerfil nome={v.nome} tamanho={TAMANHO_DO_ROSTO} />}
              </View>
            ))}
          </View>
          {minha ? <Texto variante="pequeno" cor={cores.texto} style={{ fontFamily: fontes.semi }}>Seu voto</Texto> : null}
        </View>
      ) : null}
    </View>
  );
  if (!interativa) return <View accessible accessibilityLabel={rotulo}>{corpo(false)}</View>;
  return (
    <Pressable
      accessibilityRole={tipo}
      role={tipo}
      accessibilityLabel={rotulo}
      accessibilityHint={desabilitada ? motivo : undefined}
      accessibilityState={{ checked: minha, disabled: desabilitada }}
      aria-checked={minha}
      aria-disabled={desabilitada}
      disabled={desabilitada}
      onPress={aoTocar}
      style={estilos.alvo}>
      {(estado) => corpo(!desabilitada && sobre(estado))}
    </Pressable>
  );
}

const TAMANHO_DO_ROSTO = 22;

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.25) },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  rodape: { minHeight: ALVO_TOQUE },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  iconeDoAviso: { marginTop: 2 },
  textoDoAviso: { flexShrink: 1 },
  opcoes: { gap: espaco(1) },
  alvo: { minHeight: ALVO_TOQUE },
  opcao: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25), gap: espaco(0.75), minHeight: ALVO_TOQUE },
  topoDaOpcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  textoDaOpcao: { flex: 1, minWidth: 0 },
  trilha: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 3 },
  pe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: TAMANHO_DO_ROSTO },
  amostra: { flexDirection: 'row' },
  rosto: { borderWidth: 2, borderRadius: TAMANHO_DO_ROSTO, overflow: 'hidden' },
  rostoSobreposto: { marginLeft: -6 },
  participantes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
});
