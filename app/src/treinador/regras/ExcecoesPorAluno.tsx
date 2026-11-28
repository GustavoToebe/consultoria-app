import { StyleSheet, View } from 'react-native';

import type { RegrasDeAtencaoResposta } from '../../api/tipos';
import { TEXTOS_DAS_EXCECOES, textoDosAlunosComExcecao } from '../../dominio/excecoesDeAtencao';
import { ehTipoDeRegra, perguntaDaRegra, textoDaRegra, TIPOS_DE_REGRA } from '../../dominio/regrasDeAtencao';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';

/**
 * Apoio de Configurações › Regras de atenção (etapa 2): quantos alunos têm exceção em cada regra gravada (só a contagem que a
 * API manda em `alunosComExcecao`; nunca quem, então não há link para a ficha de cada um). Por regra, sem somar: um aluno com
 * duas exceções contaria duas vezes. Sem exceção, uma linha só, que já diz onde ajustar.
 */
export function ExcecoesPorAluno({ dados }: { dados: RegrasDeAtencaoResposta }) {
  const { cores } = useTema();
  const linhas = dados.regras
    .filter((r) => ehTipoDeRegra(r.tipo) && textoDosAlunosComExcecao(r.alunosComExcecao))
    .sort((a, b) => TIPOS_DE_REGRA.indexOf(a.tipo) - TIPOS_DE_REGRA.indexOf(b.tipo))
    .map((r) => {
      const texto = textoDaRegra(r.tipo, r.limite, perguntaDaRegra(r.tipo, r.perguntaId, dados.perguntas)?.rotulo);
      return { id: r.id, regra: `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`, contagem: textoDosAlunosComExcecao(r.alunosComExcecao)! };
    });
  return (
    <Cartao titulo={TEXTOS_DAS_EXCECOES.titulo}>
      {linhas.length ? (
        <>
          <View role="list" style={estilos.itens}>
            {linhas.map((l) => (
              <View key={l.id} role="listitem" style={estilos.item}>
                <Texto variante="pequeno" cor={cores.texto}>{l.regra}</Texto>
                <Texto variante="pequeno" numerico>{l.contagem}</Texto>
              </View>
            ))}
          </View>
          <Texto variante="pequeno">{TEXTOS_DAS_EXCECOES.ondeFica}</Texto>
        </>
      ) : <Texto variante="pequeno">{TEXTOS_DAS_EXCECOES.semExcecao}</Texto>}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  itens: { gap: espaco(1) },
  item: { gap: 2 },
});
