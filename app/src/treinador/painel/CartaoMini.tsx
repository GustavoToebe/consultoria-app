import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CartaoDoPainel, FolhaDoPainelId } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco, type TokenNeon, type TokensStndrd } from '../../tema/tokens';
import { contornoDoNumero } from '../../ui/destaqueDoNumero';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

function neonDoCartao(cartao: CartaoDoPainel, stndrd: TokensStndrd): TokenNeon | null {
  if (cartao.estado !== 'valor' || cartao.enfase === 'zero' || cartao.enfase === 'indisponivel' || cartao.enfase === 'neutro') {
    return null;
  }
  switch (cartao.chave) {
    case 'financeiro.recebido':
    case 'treinos.concluidos':
      return stndrd.neon.emerald;
    case 'atualizacoes.atrasadas':
    case 'financeiro.vencidas':
      return stndrd.neon.crimson;
    case 'treinos.semRegistro':
      return stndrd.neon.acidLime;
    case 'treinos.recordes':
      return stndrd.neon.electricPurple;
    default:
      return stndrd.neon.electricBlue;
  }
}

/** "R$ 1.240" vira o "R$" pequeno e o número grande; o resto fica inteiro. */
function partesDoValor(texto: string, moeda: boolean): { prefixo: string | null; numero: string } {
  const m = moeda ? /^(-?R\$)\s(.+)$/.exec(texto) : null;
  return m ? { prefixo: m[1], numero: m[2] } : { prefixo: null, numero: texto };
}

/**
 * Mini-cartão do painel (guia de 11/11, pág. 16, com as cores de destaque de 13/11, `docs/planos/cores-de-destaque.md`):
 * rótulo curto e detalhe neutros (D1), número na cor da função do cartão com a faixa lateral e o fundo tonalizado
 * (`ui/NumeroDeDestaque`); zero ("0"), "Não carregou" e "…" em `textoSuave`, sem cor nem faixa (D5). Não há "—" solto
 * no Início (D14): o que falta diz "Não carregou" (ou "Sem permissão") por extenso, nos quatro layouts. O cartão
 * inteiro é o toque: abre a lista filtrada (link) ou uma Folha (botão), com o hover no fundo tonalizado sobre
 * `superficie2`. `linha`: a linha de baixo do bloco.
 */
export function CartaoMini({ cartao, aoAbrirFolha, linha }: { cartao: CartaoDoPainel; aoAbrirFolha: (folha: FolhaDoPainelId) => void; linha?: boolean }) {
  const { cores, bordas, fatorTexto, stndrd } = useTema();
  const comValor = cartao.estado === 'valor';
  const neon = neonDoCartao(cartao, stndrd);
  const cor = comValor ? cores.texto : cores.textoSuave;
  const deitado = cartao.largo || !!linha;
  const { prefixo, numero } = partesDoValor(cartao.texto, cartao.moeda);

  const conteudo = (
    <>
      <View style={estilos.topoRotulo}>
        {neon ? <View aria-hidden style={[estilos.pontoNeon, { backgroundColor: neon.accent }]} /> : null}
        <Texto variante={linha ? 'corpo' : 'rotulo'} cor={cores.textoSuave}
          style={[deitado ? estilos.rotuloDeitado : null, linha ? estilos.rotuloDaLinha : null]}>
          {cartao.rotulo}
        </Texto>
      </View>
      <View style={deitado ? estilos.valorDeitado : estilos.valor}>
        {comValor ? (
          <View style={estilos.numero}>
            {prefixo ? <Texto variante="rotulo" numerico cor={neon ? neon.textOnTint : cor} style={estilos.prefixo}>{prefixo}</Texto> : null}
            <Texto variante="destaque" cor={cor} style={linha ? estilos.numeroDaLinha : null}>{numero}</Texto>
          </View>
        ) : (
          <Texto variante={cartao.estado === 'carregando' ? 'destaque' : 'suave'} cor={cores.textoSuave}>{cartao.texto}</Texto>
        )}
        {cartao.detalhe && comValor && !deitado ? <Texto variante="pequeno" numerico cor={cores.textoSuave}>{cartao.detalhe}</Texto> : null}
      </View>
    </>
  );

  // Poço Nível 2 (`superficie2`) dentro do bloco Nível 1 (`superficie`), com contorno nítido e filete Neon semântico.
  const base = !deitado && cartao.moeda ? { flexBasis: Math.round(BASE_DO_DINHEIRO * fatorTexto) } : null;
  const fundoBase = cores.superficie2;
  const fundoHover = cores.superficie3;
  const estilo = [
    estilos.cartao,
    deitado ? estilos.deitado : estilos.empe,
    base,
    cartao.largo && !linha ? estilos.largo : null,
    contornoDoNumero(neon?.accent ?? null, { divisor: neon ? neon.tintBorder : cores.divisor }, bordas.bloco, RECUO),
    { borderRadius: 12 },
  ];
  const destino = cartao.destino;
  if (!destino) {
    return (
      <View accessible accessibilityLabel={cartao.falado} style={[...estilo, { backgroundColor: fundoBase }]}>{conteudo}</View>
    );
  }
  const href = destino.tipo === 'endereco' ? (destino.href as Href) : null;
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={cartao.falado}
      {...(href ? propsDeLink(href, () => router.push(href)) : { onPress: () => destino.tipo === 'folha' && aoAbrirFolha(destino.folha) })}
      style={(e) => [...estilo, { backgroundColor: sobre(e) ? fundoHover : fundoBase }]}>
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
  pontoNeon: { width: 6, height: 6, borderRadius: 3 },
  valor: { gap: 2 },
  valorDeitado: { alignItems: 'flex-end', flexShrink: 0 },
  numero: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  prefixo: { fontSize: 14 },
  numeroDaLinha: { fontSize: 22, lineHeight: 28 },
});
