import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { urlDaApi } from '../../api/cliente';
import type { Marca } from '../../api/tipos';
import { coresDoDestaque, resolver, type ValoresPdf } from '../../dominio/configuracaoPdf';
import { PAPEL_DA_FOLHA } from '../../dominio/editorDoPdf';
import { BORDA_SUAVE, CINZA_DO_TEXTO_FRACO, DIVISORIA_NEUTRA, FUNDO_LEVE } from '../../pdf/cssDosTemas';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, marcaParaTexto, RAIO, RAIO_CONTROLE, textoSobre } from '../../tema/tokens';
import { FAMILIAS } from '../../ui/MarcaTitulo';
import { Texto } from '../../ui/Texto';

/** O corpo dos documentos de fora do app (PDF e e-mail): preto no branco, como o `pdf/html.ts`. */
const TINTA_DO_PAPEL = '#111111';

/**
 * Moldura de uma miniatura da Marca: o nome em cima (h3), o desenho no papel branco (só desenho: `role=img` com a
 * descrição, nada dentro é lido nem tocável) e, embaixo, o que for preciso (o link "Personalizar documentos").
 */
function Moldura({ titulo, descricao, testID, children, depois }: { titulo: string; descricao: string; testID: string; children: ReactNode; depois?: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={estilos.moldura}>
      <Texto variante="rotulo" nivel={3}>{titulo}</Texto>
      <View role="img" aria-label={descricao} testID={testID} pointerEvents="none"
        style={[estilos.papel, { borderColor: cores.divisor }]}>
        <View aria-hidden style={estilos.dentro}>{children}</View>
      </View>
      {depois}
    </View>
  );
}

/** Logo num quadro branco (como a `.faixa-logo` do PDF) ou nada; o nome vem ao lado, de quem chama. */
function Logo({ marca, altura }: { marca: Marca; altura: number }) {
  if (!marca.logoUrl) return null;
  return (
    <View style={estilos.quadroDaLogo}>
      <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={{ height: altura, width: altura * 3 }} contentFit="contain" contentPosition="left" />
    </View>
  );
}

const ALTURA_DA_LOGO: Record<ValoresPdf['cabecalho']['tamanhoLogo'], number> = { P: 14, M: 20, G: 28 };

/**
 * Topo de um PDF de treino no modelo escolhido em Documentos (`marca.temaPdf` e `opcoesPdf`, resolvidos como o gerador):
 * a faixa com a logo e o nome (FAIXA: faixa cheia; CARTAO: bloco arredondado cheio com o título dentro; LINHA: sobre o
 * papel, com um fio embaixo), o título "TREINO" e uma linha de tabela com dados de exemplo. Cores do destaque do modelo
 * (`coresDoDestaque`, ≥ 4,5:1 sobre o papel e sobre a faixa). O nome sai na fonte do PDF, não na "Fonte do nome": o PDF
 * real não a usa.
 */
export function MiniaturaDoPdf({ marca, depois }: { marca: Marca; depois?: ReactNode }) {
  const valores = resolver(marca.temaPdf, marca.opcoesPdf);
  const cor = coresDoDestaque(valores.cores.destaque, marca.corPrimaria);
  const { estilo, logo, tamanhoLogo, mostrarNome } = valores.cabecalho;
  const cheio = estilo !== 'LINHA';
  const tinta = cheio ? cor.sobreFundo : cor.texto;
  const nome = mostrarNome !== false || !marca.logoUrl
    ? <Texto numberOfLines={1} style={[estilos.nomeDaFaixa, { color: tinta }]}>{marca.nome.toUpperCase()}</Texto>
    : null;
  const faixa = (
    <View style={[estilos.faixa, logo === 'CENTRO' ? estilos.faixaNoCentro : null,
      estilo === 'FAIXA' ? { backgroundColor: cor.fundo } : null,
      estilo === 'CARTAO' ? estilos.faixaNoCartao : null,
      estilo === 'LINHA' ? [estilos.faixaEmLinha, { borderBottomColor: cor.fundo }] : null]}>
      <Logo marca={marca} altura={ALTURA_DA_LOGO[tamanhoLogo]} />
      {nome}
    </View>
  );
  const titulo = <Texto style={[estilos.tituloDoPdf, { color: estilo === 'CARTAO' ? cor.sobreFundo : cor.texto }]}>TREINO</Texto>;
  const cabecalhoDaTabela = estilo === 'FAIXA' ? { backgroundColor: cor.fundo } : estilo === 'CARTAO' ? { backgroundColor: FUNDO_LEVE } : { borderBottomWidth: 1, borderBottomColor: DIVISORIA_NEUTRA };
  const tintaDoCabecalho = estilo === 'FAIXA' ? cor.sobreFundo : TINTA_DO_PAPEL;
  return (
    <Moldura titulo="Cabeçalho do PDF" testID="miniatura-do-pdf"
      descricao={`Topo de um PDF de treino no modelo dos documentos, com ${marca.logoUrl ? 'a logo' : 'o nome'} de ${marca.nome}.`} depois={depois}>
      {estilo === 'CARTAO' ? <View style={[estilos.cartaoDoTopo, { backgroundColor: cor.fundo }]}>{faixa}{titulo}</View> : <>{faixa}{titulo}</>}
      <View style={[estilos.linhaDoAluno, { borderBottomColor: estilo === 'CARTAO' ? 'transparent' : cor.fundo }]}>
        <Texto style={estilos.miudoDoPapel}>Aluno: Ana Exemplo</Texto>
        <Texto style={estilos.miudoDoPapel}>01/12 a 31/12</Texto>
      </View>
      <View style={estilos.tabela}>
        <View style={[estilos.linhaDaTabela, cabecalhoDaTabela]}>
          {['Exercício', 'Séries', 'Repetições'].map((c, i) => (
            <Texto key={c} style={[estilos.celula, i === 0 ? estilos.celulaLarga : null, estilos.celulaForte, { color: tintaDoCabecalho }]}>{c}</Texto>
          ))}
        </View>
        <View style={[estilos.linhaDaTabela, { borderBottomWidth: 1, borderBottomColor: BORDA_SUAVE }]}>
          {['Supino reto', '4', '8 a 10'].map((c, i) => (
            <Texto key={c} style={[estilos.celula, i === 0 ? estilos.celulaLarga : null, { color: TINTA_DO_PAPEL }]}>{c}</Texto>
          ))}
        </View>
      </View>
    </Moldura>
  );
}

/**
 * E-mail do app em miniatura, com dados de exemplo: `convite` (logo ou nome na fonte, "Você foi convidado para a
 * <consultoria>", "Criar minha conta" na cor da marca) ou `lembrete` (de cobrança, o texto do `TextoDoLembrete` da API).
 * Em cima, "De:" (o remetente de Contato, ou o nome da consultoria) e, quando há, "Responder para:". A marca no papel
 * branco usa `marcaParaTexto` (4,5:1) e o botão, a cor da marca com `textoSobre` (a Marca já recusa cor que não segura
 * texto branco).
 */
export function MiniaturaDoEmail({ variante, marca, remetente, responderPara }: {
  variante: 'convite' | 'lembrete';
  marca: Marca;
  remetente: string;
  responderPara?: string | null;
}) {
  const corDoTexto = marcaParaTexto(marca.corPrimaria, PAPEL_DA_FOLHA);
  const topo = marca.logoUrl
    ? <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={estilos.logoDoEmail} contentFit="contain" contentPosition="left" />
    : <Texto numberOfLines={1} style={[estilos.nomeDoEmail, { color: corDoTexto, fontFamily: FAMILIAS[marca.fonteTitulo] ?? fontes.negrito }]}>{marca.nome}</Texto>;
  const responder = responderPara?.trim();
  const assunto = variante === 'convite' ? `Convite para a ${marca.nome}` : `Lembrete de mensalidade - ${marca.nome}`;
  return (
    <Moldura titulo={variante === 'convite' ? 'E-mail' : 'E-mail de lembrete de cobrança'} testID={`miniatura-do-email-${variante}`}
      descricao={`E-mail de ${variante === 'convite' ? 'convite' : 'lembrete de cobrança'} de exemplo, enviado por ${remetente}${responder ? `, com respostas para ${responder}` : ''}.`}>
      <View style={[estilos.envelope, { borderBottomColor: BORDA_SUAVE }]}>
        <Texto numberOfLines={1} style={estilos.miudoDoPapel}><Texto style={estilos.forte}>De: </Texto>{remetente}</Texto>
        {responder ? <Texto numberOfLines={1} style={estilos.miudoDoPapel}><Texto style={estilos.forte}>Responder para: </Texto>{responder}</Texto> : null}
        <Texto numberOfLines={1} style={estilos.miudoDoPapel}><Texto style={estilos.forte}>Assunto: </Texto>{assunto}</Texto>
      </View>
      {topo}
      {variante === 'convite' ? (
        <>
          <Texto style={estilos.fraseDoEmail}>{`Você foi convidado para a ${marca.nome}.`}</Texto>
          <View style={[estilos.botaoDoEmail, { backgroundColor: marca.corPrimaria }]}>
            <Texto style={[estilos.textoDoBotao, { color: textoSobre(marca.corPrimaria) }]}>Criar minha conta</Texto>
          </View>
        </>
      ) : (
        <>
          <Texto style={estilos.fraseDoEmail}>Olá, Ana.</Texto>
          <Texto style={estilos.fraseDoEmail}>{`A mensalidade de ${marca.nome} no valor de R$ 150,00 vence em 10/12.`}</Texto>
          <Texto style={estilos.fraseDoEmail}>Veja a cobrança no app, na sua <Texto style={[estilos.forte, { color: corDoTexto }]}>Conta</Texto>.</Texto>
        </>
      )}
      <Texto numberOfLines={2} style={[estilos.miudoDoPapel, estilos.rodapeDoEmail, { borderTopColor: BORDA_SUAVE }]}>{`Enviado por ${remetente}`}</Texto>
    </Moldura>
  );
}

const estilos = StyleSheet.create({
  moldura: { flex: 1, minWidth: 0, gap: espaco(1) },
  papel: { backgroundColor: PAPEL_DA_FOLHA, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  dentro: { padding: espaco(1.5), gap: espaco(1) },
  quadroDaLogo: { backgroundColor: PAPEL_DA_FOLHA, borderRadius: 3, padding: 2 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingVertical: 4, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1.5), marginTop: -espaco(1.5) },
  faixaNoCentro: { flexDirection: 'column', justifyContent: 'center', gap: 3 },
  faixaNoCartao: { marginHorizontal: 0, marginTop: 0, paddingHorizontal: 0, paddingTop: espaco(1) },
  faixaEmLinha: { marginHorizontal: 0, marginTop: 0, paddingHorizontal: 0, borderBottomWidth: 1 },
  cartaoDoTopo: { borderRadius: 6, overflow: 'hidden', paddingBottom: espaco(1), paddingHorizontal: espaco(1), gap: 4 },
  nomeDaFaixa: { fontFamily: fontes.negrito, fontSize: 11, lineHeight: 14, letterSpacing: 1, flexShrink: 1 },
  tituloDoPdf: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 22, letterSpacing: 1 },
  linhaDoAluno: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco(1), borderBottomWidth: 1, paddingBottom: 4 },
  miudoDoPapel: { fontFamily: fontes.normal, fontSize: 11, lineHeight: 15, color: CINZA_DO_TEXTO_FRACO },
  forte: { fontFamily: fontes.semi, color: TINTA_DO_PAPEL },
  tabela: { borderRadius: RAIO_CONTROLE, overflow: 'hidden' },
  linhaDaTabela: { flexDirection: 'row', gap: espaco(1), paddingVertical: 4, paddingHorizontal: espaco(0.75) },
  celula: { flex: 1, minWidth: 0, fontFamily: fontes.normal, fontSize: 11, lineHeight: 15 },
  celulaLarga: { flex: 2 },
  celulaForte: { fontFamily: fontes.semi },
  envelope: { gap: 1, borderBottomWidth: 1, paddingBottom: espaco(1) },
  logoDoEmail: { height: 32, width: 120 },
  nomeDoEmail: { fontSize: 18, lineHeight: 24 },
  fraseDoEmail: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18, color: TINTA_DO_PAPEL },
  botaoDoEmail: { alignSelf: 'flex-start', borderRadius: RAIO_CONTROLE, paddingHorizontal: espaco(2), paddingVertical: espaco(1) },
  textoDoBotao: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  rodapeDoEmail: { borderTopWidth: 1, paddingTop: espaco(1) },
});
