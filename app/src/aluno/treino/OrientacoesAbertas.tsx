import { StyleSheet, View } from 'react-native';

import { secoesDasOrientacoes } from '../../dominio/secoesDasOrientacoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';

/**
 * "Orientações do treinador" na coluna de apoio do Treino na web larga (seção 2 de `docs/planos/aluno-web-layout.md`): o
 * mesmo cartão de `OrientacoesDoTreinador`, mas nasce aberto e com as seções do texto à vista (há espaço ao lado das
 * divisões). Continua recolhível. No celular e na faixa `normal` fica o `OrientacoesDoTreinador` recolhido.
 */
export function OrientacoesAbertas({ objetivo, orientacoes }: { objetivo: string | null; orientacoes: string | null }) {
  const { cores } = useTema();
  if (!objetivo && !orientacoes) return null;
  const resumo = objetivo ? `Objetivo: ${objetivo}` : undefined;
  if (!orientacoes?.trim()) return <Cartao titulo="Orientações do treinador" resumo={resumo}>{null}</Cartao>;
  const { introducao, secoes } = secoesDasOrientacoes(orientacoes);
  return (
    <Cartao titulo="Orientações do treinador" resumo={resumo} recolhivel recolhido={false}>
      {introducao ? <Texto variante="suave">{introducao}</Texto> : null}
      {secoes.map((s, i) => (
        <View key={`${i}:${s.titulo}`} style={[estilos.secao, { borderTopColor: cores.divisor, borderTopWidth: i === 0 && !introducao ? 0 : 1 }]}>
          <Texto nivel={3} style={estilos.titulo}>{s.titulo}</Texto>
          {s.texto ? <Texto variante="suave">{s.texto}</Texto> : null}
        </View>
      ))}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(0.5), paddingTop: espaco(1.5) },
  titulo: { fontFamily: fontes.semi },
});
