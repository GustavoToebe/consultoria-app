import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, marcaParaPeca, textoSobre } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

/**
 * Barrinha das partes da inscrição (27/11; antes, "Parte 2 de 2 · Sobre você" em texto): um círculo numerado por parte com o
 * nome ao lado, a atual na cor da marca da consultoria (peça a 3:1 sobre o cartão, `marcaParaPeca`) e as anteriores com ✓.
 * A cor nunca fala sozinha: a atual também tem o nome em semibold e `aria-current="step"`; a lista se chama "Parte N de M".
 */
export function PassosDaInscricao({ partes, atual, cor }: { partes: readonly string[]; atual: number; cor: string }) {
  const { cores } = useTema();
  const peca = marcaParaPeca(cor, [cores.superficie]);
  const total = partes.length;
  return (
    <View role="list" aria-label={`Parte ${atual} de ${total}`} style={estilos.linha}>
      {partes.map((nome, i) => {
        const numero = i + 1;
        const feita = numero < atual;
        const agora = numero === atual;
        const situacao = feita ? ', concluída' : agora ? ', atual' : '';
        return (
          <Fragment key={nome}>
            {i > 0 ? <View aria-hidden style={[estilos.ligacao, { backgroundColor: feita || agora ? cores.bordaCampo : cores.divisor }]} /> : null}
            <View role="listitem" aria-current={agora ? 'step' : undefined} aria-label={`Parte ${numero} de ${total}: ${nome}${situacao}`}
              style={estilos.passo}>
              <View aria-hidden style={[estilos.circulo, agora
                ? { backgroundColor: peca, borderColor: peca }
                : { backgroundColor: feita ? cores.superficie2 : 'transparent', borderColor: cores.bordaCampo }]}>
                {feita
                  ? <Check size={16} color={cores.texto} strokeWidth={3} />
                  : <Texto variante="rotulo" numerico cor={agora ? textoSobre(peca) : cores.textoSuave}>{String(numero)}</Texto>}
              </View>
              <Texto aria-hidden variante={agora ? 'rotulo' : 'pequeno'} cor={agora ? cores.texto : cores.textoSuave} numberOfLines={1}
                style={estilos.nome}>{nome}</Texto>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, minWidth: 0 },
  circulo: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nome: { flexShrink: 1 },
  ligacao: { flexGrow: 1, flexBasis: espaco(2), height: 1, maxWidth: espaco(8) },
});
