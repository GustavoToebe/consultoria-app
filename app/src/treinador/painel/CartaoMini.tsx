import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CartaoDoPainel, FolhaDoPainelId } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { contornoDoNumero } from '../../ui/destaqueDoNumero';
import { useAparenciaDoNumero } from '../../ui/NumeroDeDestaque';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** "R$ 1.240" vira o "R$" pequeno e o número grande; o resto fica inteiro. */
function partesDoValor(texto: string, moeda: boolean): { prefixo: string | null; numero: string } {
  const m = moeda ? /^(-?R\$)\s(.+)$/.exec(texto) : null;
  return m ? { prefixo: m[1], numero: m[2] } : { prefixo: null, numero: texto };
}

/**
 * Mini-cartão do painel (guia de 11/11, pág. 16, com as cores de destaque de 13/11, `docs/planos/cores-de-destaque.md`):
 * rótulo curto e detalhe neutros (D1), número na cor da função do cartão com a faixa lateral e o fundo tonalizado
 * (`ui/NumeroDeDestaque`); zero ("0"), "Não carregou" e "…" em `textoSuave`, sem cor nem faixa (D5). Não há "—" solto
 * no Início (D14): soma vazia é zero e o que falta diz "Não carregou" por extenso, nos quatro layouts. O cartão
 * inteiro é o toque: abre a lista filtrada (link) ou uma Folha (botão), com o hover no fundo tonalizado sobre
 * `superficie2`. `linha`: a linha de baixo do bloco.
 */
export function CartaoMini({ cartao, aoAbrirFolha, linha }: { cartao: CartaoDoPainel; aoAbrirFolha: (folha: FolhaDoPainelId) => void; linha?: boolean }) {
  const { cores, bordas, fatorTexto } = useTema();
  const comValor = cartao.estado === 'valor';
  const aparencia = useAparenciaDoNumero(cartao.enfase);
  const cor = aparencia.numero;
  const deitado = cartao.largo || !!linha;
  const { prefixo, numero } = partesDoValor(cartao.texto, cartao.moeda);

  const conteudo = (
    <>
      <Texto variante={linha ? 'corpo' : 'rotulo'} cor={cores.texto}
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
        {cartao.detalhe && comValor && !deitado ? <Texto variante="pequeno" numerico cor={cores.textoSuave}>{cartao.detalhe}</Texto> : null}
      </View>
    </>
  );

  // `largo` ocupa a linha inteira dentro da fileira de cartões; a `linha` fica fora dela, na coluna do bloco, onde
  // `flexBasis: 100%` viraria altura e esticaria o cartão até o fim do bloco.
  // Dinheiro em pé pede a largura de "R$ 100.000" no tamanho de texto escolhido: sem ela, desce para um por linha em vez
  // de cortar ou diminuir a fonte. shortcut: dimensionado para até R$ 999.999; acima disso, medir o texto.
  const base = !deitado && cartao.moeda ? { flexBasis: Math.round(BASE_DO_DINHEIRO * fatorTexto) } : null;
  const estilo = [estilos.cartao, deitado ? estilos.deitado : estilos.empe, base, cartao.largo && !linha ? estilos.largo : null, contornoDoNumero(aparencia.faixa, cores, bordas.bloco, RECUO)];
  const destino = cartao.destino;
  if (!destino) {
    return (
      <View accessible accessibilityLabel={cartao.falado} style={[...estilo, { backgroundColor: aparencia.fundo }]}>{conteudo}</View>
    );
  }
  const href = destino.tipo === 'endereco' ? (destino.href as Href) : null;
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={cartao.falado}
      {...(href ? propsDeLink(href, () => router.push(href)) : { onPress: () => destino.tipo === 'folha' && aoAbrirFolha(destino.folha) })}
      style={(e) => [...estilo, { backgroundColor: sobre(e) ? aparencia.fundoSobre : aparencia.fundo }]}>
      {conteudo}
    </Pressable>
  );
}

const RECUO = espaco(1.25);
/** "R$" (14) + "100.000" (28) + recuo e faixa, no texto padrão: dois por linha em 390, um por linha com o texto maior. */
const BASE_DO_DINHEIRO = 155;

const estilos = StyleSheet.create({
  cartao: { padding: RECUO, minWidth: 0 },
  empe: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minHeight: 76, gap: espaco(0.5) },
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
