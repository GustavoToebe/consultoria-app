import { StyleSheet, Text as Trecho, View } from 'react-native';

import { textoFormatado, type LinhaFormatada } from '../dominio/textoFormatado';
import { espaco, fontes } from '../tema/tokens';
import { Texto, type Variante } from './Texto';

interface Props {
  texto: string | null | undefined;
  /** Tamanho e cor do texto: `corpo` (padrão) para conteúdo que a pessoa precisa ler; `suave` para leitura secundária. */
  variante?: Variante;
}

/**
 * Texto do treinador com o formato simples de `dominio/textoFormatado` (`**negrito**`, `__sublinhado__`, quebras de
 * linha): um `Texto` por parágrafo, com os trechos aninhados (o leitor de tela lê o parágrafo inteiro de uma vez).
 * Vazio não desenha nada.
 */
export function TextoFormatado({ texto, variante = 'corpo' }: Props) {
  const paragrafos = textoFormatado(texto);
  if (!paragrafos.length) return null;
  return (
    <View style={estilos.bloco}>
      {paragrafos.map((linhas, i) => (
        <Texto key={i} variante={variante}>
          {linhas.map((linha, l) => <Linha key={l} linha={linha} quebra={l > 0} />)}
        </Texto>
      ))}
    </View>
  );
}

function Linha({ linha, quebra }: { linha: LinhaFormatada; quebra: boolean }) {
  return <>
    {quebra ? '\n' : null}
    {linha.map((t, i) => (t.negrito || t.sublinhado
      ? <Trecho key={i} style={[t.negrito && estilos.negrito, t.sublinhado && estilos.sublinhado]}>{t.texto}</Trecho>
      : t.texto))}
  </>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  // Trecho aninhado é o `Text` puro, que herda tamanho, cor e escala do `Texto` de fora; só a família e o traço mudam.
  negrito: { fontFamily: fontes.negrito },
  sublinhado: { textDecorationLine: 'underline' },
});
