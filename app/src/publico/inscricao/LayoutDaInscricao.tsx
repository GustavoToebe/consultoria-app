import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import type { Marca } from '../../api/tipos';
import { NOME_DO_PRODUTO } from '../../dominio/produto';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FAIXA_NORMAL, LARGURA_FORMULARIO, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { LinksDosTermos } from '../../ui/LinksDosTermos';
import { IconeDoProduto } from '../../ui/MarcaDoProduto';
import { MarcaTitulo } from '../../ui/MarcaTitulo';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Container das duas colunas no computador (painel da consultoria ~45% e formulário ~55%). */
export const LARGURA_DA_INSCRICAO_LARGA = 1200;
/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo da `EtapasDaImportacao`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2) } : {}) as unknown as ViewStyle;
const HEX = /^#[0-9a-f]{6}$/i;

export const PASSOS_DE_COMO_FUNCIONA = [
  'Você envia seus dados',
  'A equipe fala com você no WhatsApp',
  'Você recebe o acesso ao app',
] as const;

/**
 * Casca das páginas públicas de inscrição ("Quero ser aluno" e Ficha rápida, 27/11): uma peça só para as duas, com
 * encaixes nomeados. No computador (janela ≥ 1024) duas colunas num container de até 1200 px: à esquerda o painel da
 * consultoria (logo, nome, a frase, "Como funciona" e as redes), fixo ao rolar na web; à direita o h1 e o formulário num
 * cartão. No celular uma coluna: logo menor e nome, h1, a frase, o formulário e, depois do envio, "Como funciona" e as
 * redes. O rodapé (Privacidade, Termos e o selo "feito com Overtraining") fecha as duas.
 */
export function LayoutDaInscricao({ marca, titulo, frase, redes, children }: {
  marca: Marca;
  /** O h1 da página. */
  titulo: string;
  frase?: string;
  /** Fileira de redes da consultoria (`RedesSociais` modo leitura); `null` sem redes. */
  redes?: ReactNode;
  /** Conteúdo do cartão do formulário (progresso, seções e envio). */
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const larga = width >= LARGURA_FAIXA_NORMAL;
  const formulario = <Cartao>{children}</Cartao>;
  if (larga) {
    return (
      <Tela largura={LARGURA_DA_INSCRICAO_LARGA}>
        <View style={estilos.colunas}>
          <View style={[estilos.colunaDoPainel, GRUDADA]}>
            <PainelDaConsultoria marca={marca} frase={frase} redes={redes} />
          </View>
          <View style={estilos.colunaDoFormulario}>
            <Texto variante="titulo" nivel={1}>{titulo}</Texto>
            {formulario}
            <Rodape />
          </View>
        </View>
      </Tela>
    );
  }
  return (
    <Tela largura={LARGURA_FORMULARIO}>
      <View style={estilos.topoCompacto}>
        <MarcaTitulo marca={marca} />
        {marca.logoUrl ? <Texto variante="bloco" numberOfLines={2} style={estilos.nomeAoLado}>{marca.nome}</Texto> : null}
      </View>
      <View style={estilos.titulos}>
        <Texto variante="titulo" nivel={1}>{titulo}</Texto>
        {frase ? <Texto variante="suave">{frase}</Texto> : null}
      </View>
      {formulario}
      <ComoFunciona />
      {redes}
      <Rodape />
    </Tela>
  );
}

/**
 * Painel da consultoria no computador: a superfície pintada com a cor da marca (`ui/superficiePintada`: 14% liso nas
 * paletas claras e degradê só no escuro, regra de 26/11), borda neutra, logo grande, nome, a frase e "Como funciona".
 */
function PainelDaConsultoria({ marca, frase, redes }: { marca: Marca; frase?: string; redes?: ReactNode }) {
  const { cores, variante } = useTema();
  // Cor de marca fora do formato (não deveria vir da API) não pinta: o painel fica neutro.
  const pintura = HEX.test(marca.corPrimaria ?? '') ? superficiePintada(marca.corPrimaria, cores.superficie, variante, cores) : null;
  const fundo = pintura ? fundoPintado(pintura) : { backgroundColor: cores.superficie };
  return (
    <View style={[estilos.painel, fundo, { borderColor: cores.divisor, boxShadow: cores.sombra }]}>
      <View style={estilos.identidade}>
        <MarcaTitulo marca={marca} tamanho="grande" fundo={pintura?.forte ?? cores.superficie} />
        {marca.logoUrl ? <Texto variante="subtitulo" style={estilos.nomeNoPainel}>{marca.nome}</Texto> : null}
        {frase ? <Texto variante="corpo">{frase}</Texto> : null}
      </View>
      <ComoFunciona />
      {redes}
    </View>
  );
}

/** "Como funciona" em três passos numerados (lista ordenada para o leitor de tela). Números neutros: não é situação. */
export function ComoFunciona() {
  const { cores } = useTema();
  return (
    <View style={estilos.comoFunciona}>
      <Texto variante="bloco" nivel={2}>Como funciona</Texto>
      <View role="list" aria-label="Como funciona" style={estilos.passos}>
        {PASSOS_DE_COMO_FUNCIONA.map((texto, i) => (
          <View key={texto} role="listitem" aria-label={`${i + 1}. ${texto}`} style={estilos.passo}>
            <View aria-hidden style={[estilos.numero, { borderColor: cores.bordaCampo, backgroundColor: cores.superficie }]}>
              <Texto variante="rotulo" numerico cor={cores.texto}>{String(i + 1)}</Texto>
            </View>
            <Texto style={estilos.textoDoPasso}>{texto}</Texto>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Seção do formulário: subtítulo (h2 ou h3) e, entre seções, a divisória; nunca cartão dentro do cartão. */
export function SecaoDoFormulario({ titulo, descricao, primeira, children }: {
  titulo?: string;
  descricao?: string;
  /** A primeira seção do cartão não leva a divisória em cima. */
  primeira?: boolean;
  children: ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View style={[estilos.secao, !primeira && [estilos.secaoComDivisoria, { borderTopColor: cores.divisor }]]}>
      {titulo ? (
        <View style={estilos.tituloDaSecao}>
          <Texto variante="bloco" nivel={3}>{titulo}</Texto>
          {descricao ? <Texto variante="suave">{descricao}</Texto> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Rodapé: Privacidade e Termos de uso, como em toda página pública, e o selo discreto do produto (sem logo nova). */
function Rodape() {
  return (
    <View style={estilos.rodape}>
      <LinksDosTermos />
      <View style={estilos.selo} accessible accessibilityLabel={`Feito com ${NOME_DO_PRODUTO}`}>
        <IconeDoProduto tamanho={16} />
        <Texto variante="pequeno">feito com {NOME_DO_PRODUTO}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(5) },
  // A coluna fixa precisa de `alignSelf: flex-start` (senão estica e não gruda).
  colunaDoPainel: { flexBasis: 0, flexGrow: 45, minWidth: 0, alignSelf: 'flex-start' },
  colunaDoFormulario: { flexBasis: 0, flexGrow: 55, minWidth: 0, gap: espaco(3) },
  painel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(4), gap: espaco(3) },
  identidade: { gap: espaco(1.5) },
  nomeNoPainel: { fontSize: 20, lineHeight: 26 },
  topoCompacto: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  nomeAoLado: { flexShrink: 1 },
  titulos: { gap: espaco(0.5) },
  comoFunciona: { gap: espaco(1.5) },
  passos: { gap: espaco(1.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  numero: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoDoPasso: { flexShrink: 1 },
  secao: { gap: espaco(2) },
  secaoComDivisoria: { borderTopWidth: 1, paddingTop: espaco(3) },
  tituloDaSecao: { gap: espaco(0.5) },
  rodape: { gap: espaco(2), alignItems: 'stretch' },
  selo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(0.75) },
});
