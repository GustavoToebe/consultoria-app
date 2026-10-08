import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { Texto } from './Texto';

export function Carregando({ texto }: { texto?: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.centro} accessibilityLabel={texto ?? 'Carregando'}>
      <ActivityIndicator color={cores.textoSuave} />
      {texto ? <Texto cor="suave">{texto}</Texto> : null}
    </View>
  );
}

export function Vazio({ texto, acao }: { texto: string; acao?: { rotulo: string; aoTocar: () => void } }) {
  return (
    <View style={estilos.centro}>
      <Texto cor="suave" style={estilos.textoCentro}>{texto}</Texto>
      {acao ? <Botao rotulo={acao.rotulo} tipo="secundario" aoTocar={acao.aoTocar} /> : null}
    </View>
  );
}

/** Erro na própria tela, com o texto da API e, se der, um "tentar de novo" (nunca para "não encontrado"). */
export function MensagemErro({ texto, tentarDeNovo, erro }: { texto: string; tentarDeNovo?: () => void; erro?: unknown }) {
  const definitivo = erro instanceof ErroApi && erro.status === 404;
  const { cores } = useTema();
  return (
    <View
      accessibilityRole="alert"
      style={[estilos.erro, { borderColor: cores.perigo, backgroundColor: `${cores.perigo}18` }]}>
      <Texto cor={cores.perigo}>{texto}</Texto>
      {tentarDeNovo && !definitivo ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={tentarDeNovo} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center', gap: espaco(1.5), padding: espaco(4) },
  textoCentro: { textAlign: 'center' },
  erro: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
});
