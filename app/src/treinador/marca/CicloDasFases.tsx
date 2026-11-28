import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FaseDoCiclo } from '../../dominio/cicloMenstrual';
import { faseDaPrevia, FASES_DOS_TEXTOS, type ChaveDaFase } from '../../dominio/padroesDoAcompanhamento';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { Cartao } from '../../ui/Cartao';
import { corDaFase } from '../../ui/FaixaDoCiclo';
import { Texto } from '../../ui/Texto';
import { ContadorDeCaracteres } from '../dieta/ContadorDeCaracteres';
import { textosDasFases } from './corpoDaConsultoria';
import { PreviaDaFaseDaAluna } from './PreviaDaFaseDaAluna';

/** Limite de cada texto (o mesmo que a tela sempre mandou). */
const MAXIMO_DO_TEXTO = 1000;
/** Abaixo disto os dois campos de uma linha ficariam com menos de ~270 px: a grade vira uma coluna. */
const LARGURA_DA_GRADE_LADO_A_LADO = 560;
const LINHAS_DA_GRADE = [FASES_DOS_TEXTOS.slice(0, 2), FASES_DOS_TEXTOS.slice(2)];

export type TextosDigitados = Record<ChaveDaFase, string>;

/**
 * "Ciclo menstrual: textos das fases" (Padrões do acompanhamento, 28/11): recolhível, o aviso de que o app não recomenda nada
 * logo abaixo do título, os quatro campos em grade 2×2 (Menstrual · Folicular / Ovulatória · Lútea; uma coluna quando
 * estreito: duas linhas explícitas, nunca 3 + 1) e, embaixo, "Como a aluna vê" com o texto da fase em que o cursor está.
 * Cada rótulo leva a bolinha da cor da fase do app da aluna (`corDaFase`, a da faixa e do calendário do ciclo).
 */
export function CicloDasFases({ fases, aoMudar, erros }: {
  fases: TextosDigitados;
  aoMudar: (chave: ChaveDaFase, valor: string) => void;
  erros: Partial<Record<ChaveDaFase, string>>;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const [focada, setFocada] = useState<ChaveDaFase | null>(null);
  const atuais = textosDasFases(fases);
  const naPrevia = faseDaPrevia(focada, atuais);
  const ladoALado = largura >= LARGURA_DA_GRADE_LADO_A_LADO;
  return (
    <Cartao titulo="Ciclo menstrual: textos das fases" recolhivel recolhido>
      <View style={estilos.aviso}>
        <View aria-hidden style={estilos.icone}><Info size={16} color={cores.textoSuave} strokeWidth={2} /></View>
        <Texto variante="suave" style={estilos.textoDoAviso}>O app não recomenda nada por conta própria: escreva só o que você orienta.</Texto>
      </View>
      <View style={estilos.grade} onLayout={(e) => setLargura(Math.round(e.nativeEvent.layout.width))}>
        {LINHAS_DA_GRADE.map((linha) => (
          <View key={linha[0].chave} style={ladoALado ? estilos.linhaLadoALado : estilos.linhaEmpilhada}>
            {linha.map(({ chave, fase, rotulo }) => (
              <CampoDaFase key={chave} fase={fase} rotulo={rotulo} valor={fases[chave]} erro={erros[chave]} ladoALado={ladoALado}
                aoMudar={(valor) => aoMudar(chave, valor)}
                aoFocar={() => setFocada(chave)}
                aoSair={() => setFocada((atual) => (atual === chave ? null : atual))} />
            ))}
          </View>
        ))}
      </View>
      <PreviaDaFaseDaAluna fase={FASES_DOS_TEXTOS.find((f) => f.chave === naPrevia)?.fase ?? 'MENSTRUAL'} texto={atuais[naPrevia]} />
    </Cartao>
  );
}

function CampoDaFase({ fase, rotulo, valor, erro, ladoALado, aoMudar, aoFocar, aoSair }: {
  fase: FaseDoCiclo; rotulo: string; valor: string; erro?: string; ladoALado: boolean;
  aoMudar: (valor: string) => void; aoFocar: () => void; aoSair: () => void;
}) {
  const { cores } = useTema();
  return (
    <View style={[estilos.campo, ladoALado ? estilos.campoLadoALado : null]}>
      <View style={estilos.rotulo}>
        <View aria-hidden style={[estilos.ponto, { backgroundColor: corDaFase(cores, fase) }]} />
        <Texto variante="rotulo">{rotulo}</Texto>
      </View>
      <CampoQueCresce rotulo={rotulo} rotuloOculto valor={valor} aoMudar={aoMudar} maxLength={MAXIMO_DO_TEXTO} linhas={3} maximoDeLinhas={12}
        erro={erro} onFocus={aoFocar} onBlur={aoSair} />
      <ContadorDeCaracteres usados={valor.length} maximo={MAXIMO_DO_TEXTO} />
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  icone: { paddingTop: 2 },
  textoDoAviso: { flexShrink: 1 },
  grade: { gap: espaco(2) },
  linhaLadoALado: { flexDirection: 'row', gap: espaco(2), alignItems: 'flex-start' },
  linhaEmpilhada: { gap: espaco(2) },
  campo: { gap: espaco(0.5) },
  campoLadoALado: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  ponto: { width: 10, height: 10, borderRadius: 5 },
});
