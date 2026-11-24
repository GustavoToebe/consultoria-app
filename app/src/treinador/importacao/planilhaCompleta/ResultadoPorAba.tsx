import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  LINHAS_VISIVEIS, ROTULO_DA_CLASSE, linhasVisiveis, textoDaListaDeProblemas, textoDosSemDetalhe, tituloDaAba, type AbaDoResultado, type GrupoDaAba,
} from '../../../dominio/resultadoDaPlanilha';
import { AVISO_NOME_DE_ABA_INVALIDO, temNomeDeAbaInvalido } from '../../../dominio/planilhaCompleta';
import { espaco } from '../../../tema/tokens';
import { Alerta } from '../../../ui/Estados';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cartao } from '../../../ui/Cartao';
import { Selo } from '../../../ui/Selo';
import { Tabela } from '../../../ui/Tabela';
import { Texto } from '../../../ui/Texto';

/**
 * Problemas do resultado da planilha completa, uma seção recolhível por aba (resultado da importação, 23/11): tabela
 * Problema | O que aconteceu | Linhas, e "Copiar lista de problemas" com tudo o que o histórico guardou, em texto simples.
 */
export function ResultadoPorAba({ abas, semDetalhe, tituloDaCopia }: { abas: readonly AbaDoResultado[]; semDetalhe: number; tituloDaCopia: string }) {
  const { avisar } = useAviso();
  const copiar = () => {
    Clipboard.setStringAsync(textoDaListaDeProblemas(abas, { titulo: tituloDaCopia, semDetalhe })).then(
      () => avisar('Lista de problemas copiada. Cole onde preferir para corrigir a planilha.', 'sucesso'),
      () => avisar('Não foi possível copiar a lista. Tente de novo.', 'perigo'),
    );
  };
  return (
    <View style={estilos.coluna}>
      <View style={estilos.topo}>
        <View style={estilos.titulo}>
          <Texto variante="bloco" nivel={2}>Problemas por aba</Texto>
          <Texto variante="suave">Corrija na planilha e importe de novo, ou ajuste depois no app.</Texto>
        </View>
        <Botao rotulo="Copiar lista de problemas" tipo="secundario" Icone={Copy} aoTocar={copiar} />
      </View>
      {temNomeDeAbaInvalido(abas.map((a) => a.aba)) ? <Alerta tom="atencao" texto={AVISO_NOME_DE_ABA_INVALIDO} /> : null}
      {abas.map((a) => (
        <Cartao key={a.aba} titulo={tituloDaAba(a)} nivel={3} recolhivel recolhido={abas.length > 1}>
          <Tabela rotulo={`Problemas da aba “${a.aba}”`} linhas={a.grupos} chave={(g) => g.codigo} alinharLinhas="topo" vao={16} colunas={[
            { chave: 'problema', titulo: 'Problema', flex: 2, minimo: 200, principal: true, render: (g) => <Texto>{g.texto}</Texto> },
            { chave: 'classe', titulo: 'O que aconteceu', largura: 136, render: (g) => <Selo texto={ROTULO_DA_CLASSE[g.classe]} tipo={g.classe === 'FORA' ? 'perigo' : 'atencao'} /> },
            { chave: 'linhas', titulo: 'Linhas', flex: 1.4, minimo: 160, render: (g) => <LinhasDoGrupo grupo={g} aba={a.aba} /> },
          ]} />
        </Cartao>
      ))}
      {semDetalhe > 0 ? <Texto variante="suave">{textoDosSemDetalhe(semDetalhe)}</Texto> : null}
    </View>
  );
}

/**
 * As 8 primeiras linhas e "e mais N", que mostra todas; o mesmo botão vira "Mostrar menos" (um botão só: o foco do
 * teclado não se perde ao expandir).
 */
function LinhasDoGrupo({ grupo, aba }: { grupo: GrupoDaAba; aba: string }) {
  const [todas, setTodas] = useState(false);
  const { mostradas } = linhasVisiveis(grupo.linhas, todas);
  const outras = grupo.linhas.length - LINHAS_VISIVEIS;
  return (
    <View style={estilos.linhas}>
      <Texto numerico>{mostradas.join(', ')}</Texto>
      {outras > 0 ? (
        <Botao rotulo={todas ? 'Mostrar menos' : `e mais ${outras}`} tipo="fantasma" aoTocar={() => setTodas(!todas)}
          rotuloAcessivel={todas ? `Mostrar menos linhas de “${grupo.texto}” na aba “${aba}”` : `Mostrar as outras ${outras} linhas de “${grupo.texto}” na aba “${aba}”`} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 260, gap: 2 },
  linhas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2 },
});
