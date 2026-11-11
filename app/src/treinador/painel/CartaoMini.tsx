import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CartaoDoPainel, FolhaDoPainelId } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { corDoNumero } from '../../ui/indicador';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** "R$ 1.240" vira o "R$" pequeno e o número grande; o resto fica inteiro. */
function partesDoValor(texto: string, moeda: boolean): { prefixo: string | null; numero: string } {
  const m = moeda ? /^(-?R\$)\s(.+)$/.exec(texto) : null;
  return m ? { prefixo: m[1], numero: m[2] } : { prefixo: null, numero: texto };
}

/**
 * Mini-cartão do painel (guia de 11/11, pág. 16): cartão neutro (`superficie` e `divisor`), rótulo curto, número grande
 * pela `corDoNumero` (o comum em `texto`, o atrasado em `perigo`, o zero em `textoSuave` legível) e a linha de detalhe.
 * O atrasado leva o perigo também no rótulo e no detalhe, o mesmo do Próximo passo. O cartão inteiro é o toque: abre a
 * lista filtrada (link) ou uma Folha (botão), com o hover em `superficie2`. "Não carregou" e "…" ficam em cinza, nunca
 * como zero. `linha`: a linha neutra de baixo do bloco.
 */
export function CartaoMini({ cartao, aoAbrirFolha, linha }: { cartao: CartaoDoPainel; aoAbrirFolha: (folha: FolhaDoPainelId) => void; linha?: boolean }) {
  const { cores, bordas } = useTema();
  const comValor = cartao.estado === 'valor';
  const atraso = comValor && cartao.tom === 'perigo' && !linha;
  const cor = !comValor ? cores.textoSuave : corDoNumero(cores, atraso ? 'atraso' : cartao.valor === 0 ? 'zero' : 'geral');
  const deitado = cartao.largo || !!linha;
  const { prefixo, numero } = partesDoValor(cartao.texto, cartao.moeda);

  const conteudo = (
    <>
      <Texto variante={linha ? 'corpo' : 'rotulo'} cor={atraso ? cores.perigo : cores.texto} numberOfLines={2}
        style={[deitado ? estilos.rotuloDeitado : null, linha ? estilos.rotuloDaLinha : null]}>
        {cartao.rotulo}
      </Texto>
      <View style={deitado ? estilos.valorDeitado : estilos.valor}>
        {comValor ? (
          <View style={estilos.numero}>
            {prefixo ? <Texto variante="rotulo" numerico cor={cor} style={estilos.prefixo}>{prefixo}</Texto> : null}
            <Texto variante="destaque" cor={cor} style={linha ? estilos.numeroDaLinha : null}>{numero}</Texto>
          </View>
        ) : (
          <Texto variante={cartao.estado === 'carregando' ? 'destaque' : 'suave'} cor={cores.textoSuave}>{cartao.texto}</Texto>
        )}
        {cartao.detalhe && comValor && !deitado ? <Texto variante="pequeno" numerico cor={atraso ? cores.perigo : cores.textoSuave}>{cartao.detalhe}</Texto> : null}
      </View>
    </>
  );

  // `largo` ocupa a linha inteira dentro da fileira de cartões; a `linha` fica fora dela, na coluna do bloco, onde
  // `flexBasis: 100%` viraria altura e esticaria o cartão até o fim do bloco.
  const estilo = [estilos.cartao, deitado ? estilos.deitado : estilos.empe, cartao.largo && !linha ? estilos.largo : null, { borderColor: cores.divisor, borderWidth: bordas.bloco }];
  const destino = cartao.destino;
  if (!destino) {
    return (
      <View accessible accessibilityLabel={cartao.falado} style={[...estilo, { backgroundColor: cores.superficie }]}>{conteudo}</View>
    );
  }
  const href = destino.tipo === 'endereco' ? (destino.href as Href) : null;
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={cartao.falado}
      {...(href ? propsDeLink(href, () => router.push(href)) : { onPress: () => destino.tipo === 'folha' && aoAbrirFolha(destino.folha) })}
      style={(e) => [...estilo, { backgroundColor: sobre(e) ? cores.superficie2 : cores.superficie }]}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: RAIO, padding: espaco(1.25), minWidth: 0 },
  empe: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minHeight: 76, gap: espaco(0.5), justifyContent: 'space-between' },
  deitado: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  largo: { flexBasis: '100%' },
  rotuloDeitado: { flexShrink: 1 },
  rotuloDaLinha: { fontSize: 14 },
  valor: { gap: 2 },
  valorDeitado: { alignItems: 'flex-end', flexShrink: 0 },
  numero: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  prefixo: { fontSize: 14 },
  numeroDaLinha: { fontSize: 22, lineHeight: 28 },
});
