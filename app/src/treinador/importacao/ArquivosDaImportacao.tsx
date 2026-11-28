import { StyleSheet, View } from 'react-native';

import { motivoDoErroDoArquivo, resumoDaCoberturaDoArquivo, textoDoModoDoArquivo } from '../../dominio/importacaoAssistida';
import type { ArquivoResumo } from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/**
 * Os arquivos e textos da sessão, um por linha: nome, formato (ou "Não lido"), quanto foi lido e como foi lido (1.6:
 * com IA ou sem IA, e por quê, numa frase; 4.2: "Lido pela imagem do documento", sem a cobertura do texto). Âmbar só no
 * que pede atenção (caiu para as regras fixas, leitura parcial).
 */
export function ArquivosDaImportacao({ arquivos }: { arquivos: readonly ArquivoResumo[] }) {
  const { cores } = useTema();
  return (
    <View role="list" aria-label="Arquivos da importação" style={estilos.lista}>
      {arquivos.map((arq) => {
        const cobertura = resumoDaCoberturaDoArquivo(arq.cobertura, arq.enviadoComoArquivo);
        const modo = textoDoModoDoArquivo(arq);
        return (
          <View key={arq.id} role="listitem" style={[estilos.arquivo, { borderBottomColor: cores.divisor }]}>
            <View style={estilos.linha}>
              <Texto style={estilos.encolher}>{arq.nomeOriginal}</Texto>
              {arq.erroCodigo ? <Selo texto="Não lido" tipo="perigo" /> : <Selo texto={arq.formato} tipo="neutro" />}
            </View>
            {cobertura ? (
              <Texto variante="pequeno" cor={cobertura.tom === 'perigo' ? cores.perigo : cobertura.tom === 'atencao' ? cores.atencao : cores.textoSuave}>
                {cobertura.texto}
              </Texto>
            ) : null}
            {modo ? <Texto variante="pequeno" cor={modo.atencao ? cores.atencao : cores.textoSuave}>{modo.texto}</Texto> : null}
            {arq.erroCodigo ? <Texto variante="suave">{motivoDoErroDoArquivo(arq.erroCodigo)}</Texto> : null}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  arquivo: { gap: espaco(0.5), paddingVertical: espaco(1), borderBottomWidth: 1 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  encolher: { flex: 1, minWidth: 0 },
});
