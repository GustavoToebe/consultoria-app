import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CartaoDoPainel, FolhaDoPainelId } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco, type Cores } from '../../tema/tokens';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';

/**
 * Cor de situação do cartão (cartão pintado, 23/11: cor só onde significa algo). Pela função do número (`enfase`):
 * verde = `sucesso`, âmbar = `atencao` (para revisar, retornos de hoje, trocas, sem registro, a renovar), vermelho =
 * `perigo`, violeta (recordes) = `conquista`; no Financeiro o recebido do mês é verde (`sucesso`), as vencendo âmbar e as vencidas
 * vermelho (sem azul nem roxo, 25/11). Azul e ciano (próximas, novos interessados) são medida sem juízo: neutros. Zero e sem dado, neutros.
 */
function corDoCartao(cartao: CartaoDoPainel, cores: Cores): string | null {
  if (cartao.estado !== 'valor') return null;
  switch (cartao.enfase) {
    case 'verde': return cores.sucesso;
    case 'ambar': return cores.atencao;
    case 'vermelho': return cores.perigo;
    case 'violeta': return cores.conquista;
    default: return null;
  }
}

/** "R$ 1.240" vira o "R$" pequeno e o número grande; o resto fica inteiro. */
function partesDoValor(texto: string, moeda: boolean): { prefixo: string | null; numero: string } {
  const m = moeda ? /^(-?R\$)\s(.+)$/.exec(texto) : null;
  return m ? { prefixo: m[1], numero: m[2] } : { prefixo: null, numero: texto };
}

/**
 * Mini-cartão do painel (guia de 11/11, pág. 16), pintado como o `ui/CartaoDeIndicador` (23/11) sem migrar para ele (é
 * tocável, tem o layout deitado e o "R$" pequeno): com situação, degradê e borda na cor (`ui/superficiePintada`), ponto
 * com brilho e rótulo e número na cor quando ela passa 4,5:1; zero ("0"), "Não carregou" e "…" em `textoSuave`, neutros (D5). Não há "—" solto
 * no Início (D14): o que falta diz "Não carregou" (ou "Sem permissão") por extenso, nos quatro layouts. O cartão
 * inteiro é o toque: abre a lista filtrada (link) ou uma Folha (botão), com o hover no fundo tonalizado sobre
 * `superficie2`. `linha`: a linha de baixo do bloco.
 */
export function CartaoMini({ cartao, aoAbrirFolha, linha }: { cartao: CartaoDoPainel; aoAbrirFolha: (folha: FolhaDoPainelId) => void; linha?: boolean }) {
  const { cores, bordas, fatorTexto, variante } = useTema();
  const comValor = cartao.estado === 'valor';
  const tom = corDoCartao(cartao, cores);
  // Poço (`superficie2`) dentro do bloco; com o mouse em cima a tinta passa para `superficie3`, o mesmo hover do cartão neutro
  // (sobre `sobre` o `textoSuave` cairia abaixo de 4,5:1 nas claras com a tinta de 14%).
  const pintura = tom ? superficiePintada(tom, cores.superficie2, variante, cores) : null;
  const pinturaSobre = tom ? superficiePintada(tom, cores.superficie3, variante, cores) : null;
  // A cor no texto só se passar 4,5:1 parado e com o mouse em cima (no Oceano o perigo cai abaixo no hover): senão `texto`.
  const textoNaCor = pintura && pinturaSobre ? (pintura.texto === pinturaSobre.texto ? pintura.texto : cores.texto) : null;
  const cor = comValor ? textoNaCor ?? cores.texto : cores.textoSuave;
  const deitado = cartao.largo || !!linha;
  const { prefixo, numero } = partesDoValor(cartao.texto, cartao.moeda);

  const conteudo = (
    <>
      <View style={estilos.topoRotulo}>
        {tom ? <View aria-hidden style={[estilos.ponto, { backgroundColor: tom, boxShadow: `0px 0px 10px ${tom}` }]} /> : null}
        <Texto variante={linha ? 'corpo' : 'rotulo'} cor={cores.textoSuave}
          style={[deitado ? estilos.rotuloDeitado : null, linha ? estilos.rotuloDaLinha : null]}>
          {cartao.rotulo}
        </Texto>
      </View>
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

  const base = !deitado && cartao.moeda ? { flexBasis: Math.round(BASE_DO_DINHEIRO * fatorTexto) } : null;
  const fundo = (emCima: boolean) => {
    const p = emCima ? pinturaSobre : pintura;
    return p ? fundoPintado(p) : { backgroundColor: emCima ? cores.superficie3 : cores.superficie2 };
  };
  const estilo = [
    estilos.cartao,
    deitado ? estilos.deitado : estilos.empe,
    base,
    cartao.largo && !linha ? estilos.largo : null,
    // Cartão pintado (23/11): com cor, borda de 1 px na cor a 50% e o degradê; sem cor, o contorno `divisor` de sempre.
    { borderWidth: bordas.bloco, borderColor: pintura?.borda ?? cores.divisor, borderRadius: 14 },
  ];
  const destino = cartao.destino;
  if (!destino) {
    return (
      <View accessible accessibilityLabel={cartao.falado} style={[...estilo, fundo(false)]}>{conteudo}</View>
    );
  }
  const href = destino.tipo === 'endereco' ? (destino.href as Href) : null;
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={cartao.falado}
      {...(href ? propsDeLink(href, () => router.push(href)) : { onPress: () => destino.tipo === 'folha' && aoAbrirFolha(destino.folha) })}
      style={(e) => [...estilo, fundo(sobre(e))]}>
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
  topoRotulo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  valor: { gap: 2 },
  valorDeitado: { alignItems: 'flex-end', flexShrink: 0 },
  numero: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  prefixo: { fontSize: 14 },
  numeroDaLinha: { fontSize: 22, lineHeight: 28 },
});
