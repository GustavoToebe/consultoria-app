import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { obterMeuRanking } from '../api/comunidade';
import { textoDoNivel, textoDoQueFalta } from '../dominio/perfilDoColega';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Cartao } from '../ui/Cartao';
import { textoDoErro } from '../ui/erros';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * "Seu nível" (plano `xp-e-niveis`, passo 3): o nível e a barra até o próximo, do `GET /aluno/comunidade/ranking`. A palavra
 * XP nunca aparece (decisão 6) e o número bruto não sai da API para a tela: só `nivel`, `xpNoNivel` e `faltam`.
 * Some com o retorno desligado (sem conclusão de treino todo mundo fica no nível 1). Nada fica no aparelho: sem internet
 * mostra o último valor lido nesta abertura, avisando; aberto já sem internet, não aparece. Lê de novo a cada vez que a
 * aba ganha o foco (a volta do "Bom trabalho!"), não a cada série sincronizada: cada leitura recalcula o histórico todo.
 * Sem props, como o `MapaDeTreinos`: vai no Início e no topo do próprio perfil.
 */
export function NivelDoAluno() {
  const { online } = useAluno();
  const { retornoHabilitado } = useSessao();
  const { cores, marcaPeca } = useTema();
  const leitura = useCarregar(online && retornoHabilitado ? 'nivel-do-aluno' : null, () => obterMeuRanking());
  const { recarregar } = leitura;
  // O primeiro foco é a própria montagem, que já busca: só as voltas leem de novo.
  const montou = useRef(false);
  useFocusEffect(useCallback(() => {
    if (montou.current) recarregar();
    montou.current = true;
  }, [recarregar]));

  if (!retornoHabilitado) return null;
  const dados = leitura.dados;
  if (!dados) {
    if (leitura.erro) {
      return (
        <Cartao titulo="Seu nível">
          <MensagemErro texto={textoDoErro(leitura.erro)} erro={leitura.erro} tentarDeNovo={recarregar} />
        </Cartao>
      );
    }
    return leitura.carregando ? <Esqueleto texto="Carregando seu nível" cartoes={1} /> : null;
  }

  const nivel = textoDoNivel(dados.nivel);
  const falta = textoDoQueFalta(dados.nivel, dados.faltam);
  return (
    <Cartao titulo="Seu nível">
      <View style={estilos.textos}>
        <View style={estilos.linha}>
          <Texto variante="subtitulo" numerico>{nivel}</Texto>
          <Texto variante="suave" numerico>{falta}</Texto>
        </View>
        <BarraProgresso feitas={dados.xpNoNivel} total={dados.xpNoNivel + dados.faltam} cor={marcaPeca} trilho={cores.faixaForte}
          rotulo={`Progresso até o nível ${dados.nivel + 1}`} valorEmTexto={`${nivel}. ${falta}.`} />
        <Texto variante="pequeno">Sobe com treinos concluídos, semanas completas, conquistas e recordes.</Texto>
        {!online ? <Texto variante="pequeno">Sem conexão: mostrando o último nível lido.</Texto> : null}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  textos: { gap: espaco(1) },
  // Nível e o que falta na mesma linha no PC; em 390 o "Faltam" desce sem cortar.
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: espaco(2), rowGap: espaco(0.5) },
});
