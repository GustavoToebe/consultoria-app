import { Check } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { coresDoDestaque, MODELOS_PDF, valoresDoModelo, type DestaquePdf, type ModeloPdf, type ValoresPdf } from '../../../dominio/configuracaoPdf';
import { PAPEL_DA_FOLHA } from '../../../dominio/editorDoPdf';
import { BORDA_SUAVE, CINZA_DO_TEXTO_FRACO, DIVISORIA_NEUTRA, FUNDO_LEVE } from '../../../pdf/cssDosTemas';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, fontes, RAIO, RAIO_CONTROLE } from '../../../tema/tokens';
import { Grade } from '../../../ui/Grade';
import { sobre } from '../../../ui/sobre';
import { Texto } from '../../../ui/Texto';

interface Props {
  escolhido: ModeloPdf;
  /** O destaque em uso no rascunho: pinta as seis miniaturas. */
  destaque: DestaquePdf;
  corDaMarca: string;
  aoEscolher: (modelo: ModeloPdf) => void;
}

const DESCRICAO = 'Trocar de modelo volta as opções aos valores dele. Dá para desfazer.';
/**
 * Duas colunas no painel de 420; com o painel em cima da prévia (janela abaixo de 1280), 3 ou 6 (divisores de 6, nenhum
 * cartão sozinho), para o cartão ficar com ~160 px como no painel: o desenho é de tamanho fixo e sobra num cartão largo.
 */
const colunas = (largura: number) => (largura >= 960 ? 6 : largura >= 640 ? 3 : 2);

/**
 * Os seis modelos em cartões com o desenho do topo e de uma tabela naquele estilo (27/11). Desenho leve com Views, sem
 * gerar o PDF nem abrir seis WebViews no celular: os valores vêm do próprio modelo (`valoresDoModelo`), o mesmo que a
 * troca aplica, menos a cor: todos usam o destaque atual do rascunho (pedido de 27/11), para comparar só o desenho.
 * Contraste: o texto sobre o preenchimento é o `sobreFundo` (a conta de `textoSobre`, a dos botões) e o desenho sobre o
 * papel branco é o `texto` (≥ 4,5:1), de modo que um destaque claro (a cor da marca) continua legível. Escolhido: borda na cor de ação e ✓ (exceção à seleção neutra, pedida em 27/11; o ✓ e o `aria-checked` dizem a escolha
 * sem depender da cor).
 */
export function MiniaturasDosModelos({ escolhido, destaque, corDaMarca, aoEscolher }: Props) {
  const cor = coresDoDestaque(destaque, corDaMarca);
  return (
    <View style={estilos.grupo}>
      <Texto variante="pequeno">{DESCRICAO}</Texto>
      <View role="radiogroup" aria-label="Modelo">
        <Grade gap={espaco(1)} colunas={colunas}>
          {MODELOS_PDF.map((m) => (
            <Cartao key={m.id} nome={m.nome} descricao={m.descricao} selecionado={m.id === escolhido} valores={valoresDoModelo(m.id)}
              cor={cor} aoEscolher={() => aoEscolher(m.id)} />
          ))}
        </Grade>
      </View>
    </View>
  );
}

type Cores = ReturnType<typeof coresDoDestaque>;

function Cartao({ nome, descricao, selecionado, valores, cor, aoEscolher }: {
  nome: string; descricao: string; selecionado: boolean; valores: ValoresPdf; cor: Cores; aoEscolher: () => void;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionado }}
      aria-checked={selecionado}
      accessibilityLabel={`${nome}. ${descricao}`}
      onPress={aoEscolher}
      style={(estado) => [
        estilos.cartao,
        {
          backgroundColor: sobre(estado) ? cores.superficie2 : cores.superficie,
          borderColor: selecionado ? cores.acao : sobre(estado) ? cores.bordaCampo : cores.divisor,
          // A borda cresce 1 px para dentro (como a `OpcaoCartao`): o desenho não pula ao escolher.
          borderWidth: selecionado ? 2 : 1,
          padding: espaco(1) - (selecionado ? 1 : 0),
        },
      ]}>
      <View aria-hidden pointerEvents="none" style={[estilos.papel, { borderColor: cores.divisor }]}>
        <Topo valores={valores} cor={cor} />
        <Tabela valores={valores} cor={cor} />
      </View>
      <View style={estilos.linhaDoNome}>
        <Texto style={[estilos.nome, selecionado ? { color: cores.acao } : null]}>{nome}</Texto>
        {selecionado ? <Check size={18} color={cores.acao} strokeWidth={3} /> : null}
      </View>
      {/* Uma linha com reticências (pedido de 27/11); o texto inteiro vai no nome acessível. */}
      <Texto variante="pequeno" numberOfLines={1}>{descricao}</Texto>
    </Pressable>
  );
}

const LADO_DA_LOGO: Record<ValoresPdf['cabecalho']['tamanhoLogo'], number> = { P: 7, M: 10, G: 14 };
const CORPO_DO_TITULO: Record<ValoresPdf['texto']['tamanho'], number> = { P: 7, M: 8, G: 9.5 };
const ALTURA_DA_LINHA: Record<ValoresPdf['tabelas']['densidade'], number> = { COMPACTA: 6, NORMAL: 9, ESPACOSA: 12 };
/** As fontes do `cssDasOpcoes`; no nativo, a família do sistema mais próxima. */
const FAMILIA: Record<ValoresPdf['texto']['fonte'], string | undefined> = {
  SEM_SERIFA: undefined,
  SERIFADA: Platform.select({ web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', default: 'serif' }),
  CONDENSADA: Platform.select({ web: '"Arial Narrow", "Roboto Condensed", sans-serif', ios: 'AvenirNextCondensed-DemiBold', default: 'sans-serif-condensed' }),
};

/** O topo: FAIXA = faixa cheia de ponta a ponta; CARTAO = bloco arredondado cheio; LINHA = logo e nome com um fio embaixo. */
function Topo({ valores, cor }: { valores: ValoresPdf; cor: Cores }) {
  const { estilo, logo, tamanhoLogo } = valores.cabecalho;
  const cheio = estilo !== 'LINHA';
  // Na LINHA a marca fica sobre o papel: o `texto` do destaque, como a `.faixa-marca` do `cssDasOpcoes`.
  const tinta = cheio ? cor.sobreFundo : cor.texto;
  const lado = LADO_DA_LOGO[tamanhoLogo];
  const marca = (
    <View style={[estilos.marca, logo === 'CENTRO' ? estilos.marcaNoCentro : null]}>
      <View style={{ width: lado, height: lado, borderRadius: 2, backgroundColor: tinta }} />
      <View style={[estilos.barra, { width: 34, backgroundColor: tinta }]} />
    </View>
  );
  const titulo = (
    <Text numberOfLines={1} style={[estilos.titulo, { fontFamily: FAMILIA[valores.texto.fonte], fontSize: CORPO_DO_TITULO[valores.texto.tamanho], color: estilo === 'CARTAO' ? cor.sobreFundo : cor.texto }]}>
      Plano de treino
    </Text>
  );
  if (estilo === 'FAIXA') return <><View style={[estilos.faixa, { backgroundColor: cor.fundo }]}>{marca}</View>{titulo}</>;
  if (estilo === 'CARTAO') return <View style={[estilos.cartaoDoTopo, { backgroundColor: cor.fundo }]}>{marca}{titulo}</View>;
  return <><View style={[estilos.linhaDoTopo, { borderBottomColor: cor.fundo }]}>{marca}</View>{titulo}</>;
}

/** A tabela: cabeçalho preenchido só no topo FAIXA (leve no CARTAO, só um fio no LINHA), como o `cssDasOpcoes`. */
function Tabela({ valores, cor }: { valores: ValoresPdf; cor: Cores }) {
  const topo = valores.cabecalho.estilo;
  const { estilo, densidade } = valores.tabelas;
  const altura = ALTURA_DA_LINHA[densidade];
  const cabecalho = topo === 'FAIXA' ? { backgroundColor: cor.fundo } : topo === 'CARTAO' ? { backgroundColor: FUNDO_LEVE, borderBottomWidth: 1, borderBottomColor: BORDA_SUAVE } : { borderBottomWidth: 1, borderBottomColor: DIVISORIA_NEUTRA };
  const linha = (tinta: string, i?: number) => (
    <View key={i ?? 'cabecalho'} style={[estilos.linhaDaTabela, { height: altura },
      i === undefined ? cabecalho : estilo === 'LISTRADA' ? (i % 2 === 1 ? { backgroundColor: FUNDO_LEVE } : null) : { borderBottomWidth: 1, borderBottomColor: BORDA_SUAVE }]}>
      <View style={[estilos.celula, { flex: 2, backgroundColor: tinta }]} />
      <View style={[estilos.celula, { backgroundColor: tinta }]} />
      <View style={[estilos.celula, { backgroundColor: tinta }]} />
    </View>
  );
  return (
    <View style={[estilos.tabela, estilo === 'CARTOES' ? estilos.tabelaEmCartao : null]}>
      {linha(topo === 'FAIXA' ? cor.sobreFundo : CINZA_DO_TEXTO_FRACO)}
      {[0, 1, 2, 3].map((i) => linha(DIVISORIA_NEUTRA, i))}
    </View>
  );
}

const RECUO_DO_PAPEL = 8;

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  cartao: { flex: 1, borderRadius: RAIO, gap: espaco(0.75) },
  // A proporção fixa mantém os seis cartões da mesma altura; o que passa (a tabela espaçosa) é cortado.
  papel: { aspectRatio: 4 / 3, backgroundColor: PAPEL_DA_FOLHA, borderRadius: RAIO_CONTROLE, borderWidth: 1, overflow: 'hidden', padding: RECUO_DO_PAPEL, gap: 4 },
  faixa: { marginHorizontal: -RECUO_DO_PAPEL, marginTop: -RECUO_DO_PAPEL, paddingHorizontal: RECUO_DO_PAPEL, paddingVertical: 5 },
  cartaoDoTopo: { borderRadius: 4, padding: 5, gap: 3 },
  linhaDoTopo: { borderBottomWidth: 1, paddingBottom: 4 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  marcaNoCentro: { flexDirection: 'column', gap: 2 },
  barra: { height: 3, borderRadius: 1.5 },
  titulo: { fontWeight: '600' },
  tabela: { gap: 0 },
  tabelaEmCartao: { borderWidth: 1, borderColor: BORDA_SUAVE, borderRadius: 4, padding: 2, overflow: 'hidden' },
  linhaDaTabela: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 3 },
  celula: { flex: 1, height: 2, borderRadius: 1 },
  linhaDoNome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(0.5) },
  nome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21 },
});
