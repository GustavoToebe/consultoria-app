import { CircleHelp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { UltimaCarga } from '../api/tipos';
import { textoDoUltimoRegistro } from '../dominio/telaDoExercicio';
import { numeroDaCarga, textoDoPasso } from '../dominio/unidadeDeCarga';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO, type ChaveDeIdentificacao } from '../tema/tokens';
import { StepperDeCarga } from '../ui/AjusteDeCarga';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';

/**
 * "Carga de trabalho de hoje" (só com séries em % da WS ou na carga de trabalho, `usaCargaDeTrabalho`): o selo do tipo
 * de trabalho, o "?" com a explicação longa (numa folha, fora da tela) e o `[−] 90 kg [+]` de 52 px. Vazio, o campo mostra
 * apagada a última carga, que é de onde as séries em % saem; embaixo, "Último registro: …" ou "Sem registro anterior".
 */
export function BlocoDaCargaDeTrabalho({ tipoTrabalho, corDoTipo, valorKg, passo, ultima, progressaoKg, aoMudarKg }: {
  tipoTrabalho: string;
  corDoTipo: ChaveDeIdentificacao | null;
  /** O que a pessoa digitou (ou `null`). */
  valorKg: number | null;
  passo: number | null;
  ultima: UltimaCarga | null;
  /** Passo da progressão quando as sugestões de hoje já sobem (`SUBIR_CARGA`); `null` sem progressão. */
  progressaoKg: number | null;
  aoMudarKg: (kg: number | null) => void;
}) {
  const { cores, identificacao } = useTema();
  const unidade = useUnidadeDeCarga();
  const [ajuda, abrirAjuda] = useState(false);
  const tom = corDoTipo ? identificacao[corDoTipo] : null;
  const base = ultima?.carga ?? null;
  return (
    <View style={[estilos.bloco, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
      <View style={estilos.titulo}>
        <Texto variante="bloco" nivel={2} style={estilos.textoDoTitulo}>Carga de trabalho de hoje</Texto>
        <View><Selo texto={tipoTrabalho} categoria={tom ? { cor: tom.cor, fundo: tom.fundo } : undefined} /></View>
        <IconeBotao Icone={CircleHelp} rotulo="O que é a carga de trabalho de hoje" aoTocar={() => abrirAjuda(true)} />
      </View>
      <View style={estilos.stepper}>
        <StepperDeCarga
          valorKg={valorKg}
          sugestaoKg={base}
          passo={passo}
          rotulo="carga de trabalho"
          rotuloDoCampo="Carga de trabalho de hoje"
          aoMudarKg={aoMudarKg}
          placeholder={valorKg == null && base != null ? numeroDaCarga(base, unidade) : undefined}
        />
      </View>
      <Texto numerico variante="pequeno">{textoDoUltimoRegistro(ultima, unidade)}</Texto>
      <Folha visivel={ajuda} titulo="Carga de trabalho de hoje" aoFechar={() => abrirAjuda(false)}>
        <View style={estilos.ajuda}>
          <Texto>
            {`É o ponto de partida do dia${valorKg == null && base != null ? '; sem nada aqui, as séries em % saem do último registro e a série de trabalho sugere a progressão' : ''}.`}
          </Texto>
          <Texto>{`Depois que você registrar a ${tipoTrabalho} nesta sessão (marcando a série como feita), as séries em "% da ${tipoTrabalho}" passam a sair dela.`}</Texto>
          {progressaoKg != null ? (
            <Texto>{`As sugestões de hoje já incluem a progressão da metodologia (+${textoDoPasso(progressaoKg, unidade)}). Use − e + ou digite outra carga se quiser fixar a base do dia.`}</Texto>
          ) : null}
        </View>
      </Folha>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  titulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: espaco(1) },
  textoDoTitulo: { flexShrink: 1, fontFamily: fontes.semi },
  stepper: { maxWidth: 360 },
  ajuda: { gap: espaco(1.5) },
});
