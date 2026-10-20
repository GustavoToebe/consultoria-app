import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, RespostasAtualizacao } from '../../api/tipos';
import { paginasVisiveis, posicaoSegura } from '../../dominio/paginasDoQuestionario';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';

/**
 * Página atual da anamnese. Guarda a **seção** (índice em `modelo.secoes`), não a posição: quando uma resposta esconde
 * a seção, a posição segura é calculada na renderização (`posicaoSegura`), sem efeito nem estado a corrigir.
 */
export function usePaginas(modelo: ConteudoQuestionario | null, respostas: RespostasAtualizacao, secaoInicial: number) {
  const [secaoGuardada, setSecaoGuardada] = useState(secaoInicial);
  const paginas = modelo ? paginasVisiveis(modelo, respostas) : [];
  const posicao = posicaoSegura(paginas, secaoGuardada);
  const secao = paginas[posicao] ?? null;
  /** Vai à posição dada e devolve a seção dela (para gravar no rascunho), ou `null` se não existe. */
  const irPara = (pos: number): number | null => {
    const destino = paginas[pos];
    if (destino === undefined) return null;
    setSecaoGuardada(destino);
    return destino;
  };
  return { paginas, posicao, secao, total: paginas.length, ultima: posicao >= paginas.length - 1, irPara };
}

/**
 * Rodapé de cada página: "Voltar" (secundário, some na primeira) à esquerda e "Avançar" (primário) à direita; na última,
 * a ação final ("Enviar anamnese"). Um primário só por página.
 */
export function RodapeDasPaginas({ posicao, total, aoVoltar, aoAvancar, rotuloFinal, aoConcluir, ocupado }: {
  posicao: number; total: number; aoVoltar: () => void; aoAvancar: () => void; rotuloFinal: string; aoConcluir: () => void; ocupado?: boolean;
}) {
  const ultima = posicao >= total - 1;
  return <View style={estilos.rodape}>
    {posicao > 0 ? <Botao rotulo="Voltar" rotuloAcessivel="Voltar à parte anterior" tipo="secundario" desabilitado={ocupado} motivo="Aguarde o envio." aoTocar={aoVoltar} /> : <View />}
    {ultima ? <Botao rotulo={rotuloFinal} carregando={ocupado} aoTocar={aoConcluir} />
      : <Botao rotulo="Avançar" rotuloAcessivel="Avançar para a próxima parte" desabilitado={ocupado} motivo="Aguarde." aoTocar={aoAvancar} />}
  </View>;
}

const estilos = StyleSheet.create({
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: espaco(1), flexWrap: 'wrap' },
});
