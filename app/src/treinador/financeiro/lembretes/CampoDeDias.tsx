import { StyleSheet, View } from 'react-native';

import { lerDiasDigitados, opcoesDeDias, textoDaOpcaoDeDias } from '../../../dominio/telaDosLembretes';
import { espaco } from '../../../tema/tokens';
import { MensagemDeErro } from '../../../ui/Campo';
import { EscolhaSuspensa } from '../../../ui/EscolhaSuspensa';

/**
 * "Dias antes" / "Dias depois": o "digite ou escolha" das Séries e do Descanso (`ui/EscolhaSuspensa` com `digitado`), de 0
 * ao máximo da API (0 = "Não manda"). O 422 do servidor aparece embaixo, no campo.
 */
export function CampoDeDias({ rotulo, titulo, valor, maximo, aoMudar, desabilitado, motivo, erro }: {
  rotulo: string;
  titulo: string;
  valor: number;
  maximo: number;
  aoMudar: (n: number) => void;
  desabilitado: boolean;
  motivo?: string;
  erro?: string | null;
}) {
  return (
    <View style={estilos.campo}>
      <EscolhaSuspensa<number> rotulo={rotulo} titulo={titulo} valor={valor} opcoes={opcoesDeDias(maximo)}
        rotuloDaBusca="Digite ou escolha" textoVazio={`Digite um número de 0 a ${maximo}.`}
        digitado={{ maxLength: 2, opcao: (t) => { const n = lerDiasDigitados(t, maximo); return n === null ? null : { valor: n, rotulo: textoDaOpcaoDeDias(n) }; } }}
        desabilitado={desabilitado} motivo={motivo}
        aoMudar={(n) => { if (n !== valor) aoMudar(n); }} />
      {erro ? <MensagemDeErro erro={erro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5), flexGrow: 1, flexBasis: 200, maxWidth: 280 },
});
