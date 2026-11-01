import { StyleSheet, View } from 'react-native';

import { agruparErros, textoDoGrupoDeErros } from '../../../dominio/assistenteDaImportacao';
import { ondeDaAba } from '../../../dominio/planilhaCompleta';
import { useTema } from '../../../tema/TemaProvider';
import { RAIO, espaco } from '../../../tema/tokens';
import { Texto } from '../../../ui/Texto';

const GRUPOS_NA_TELA = 50;

/** Problemas agrupados por aba e motivo, até `GRUPOS_NA_TELA` grupos. */
export function ProblemasAgrupados({ erros, alem }: { erros: readonly { linha: number; campo: string; motivo: string }[]; alem: number }) {
  const { cores } = useTema();
  const grupos = agruparErros(erros);
  return (
    <View style={estilos.coluna}>
      {grupos.slice(0, GRUPOS_NA_TELA).map((g) => (
        <View key={`${g.campo}-${g.motivo}`} style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <Texto>{textoDoGrupoDeErros(g, ondeDaAba(g.campo))}</Texto>
        </View>
      ))}
      {grupos.length > GRUPOS_NA_TELA ? <Texto variante="suave">{`E mais ${grupos.length - GRUPOS_NA_TELA} tipos de problema.`}</Texto> : null}
      {alem > 0 ? <Texto variante="suave">{`E mais ${alem} ${alem === 1 ? 'linha' : 'linhas'} com problema além das listadas.`}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(1) },
  grupo: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
});
