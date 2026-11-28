import { AtSign, BookOpen, ChevronRight, SlidersHorizontal, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Marca, RedeDaConsultoria } from '../../api/tipos';
import { linkParaAbrir } from '../../dominio/links';
import { REDES_DA_CONSULTORIA, type LinkDeRede, type ValoresDasRedes } from '../../dominio/redesSociais';
import { espaco, fontes, paletaDe, RAIO, type Cores } from '../../tema/tokens';
import { IconeWhatsApp } from '../../ui/IconeWhatsApp';
import { RedesSociais } from '../../ui/RedesSociais';
import { Texto } from '../../ui/Texto';
import { LARGURA_DO_CELULAR, type ArranjoDaMarca } from './arranjoDaMarca';
import { ALTURA_DO_CELULAR_COM_LEGENDA, Celular } from './Celular';
import { Escala, Inerte } from './Escala';
import { MiniaturaDoEmail } from './MiniaturasDaMarca';

const UM_CELULAR = { largura: LARGURA_DO_CELULAR, altura: ALTURA_DO_CELULAR_COM_LEGENDA };

interface Props {
  marca: Marca;
  /** WhatsApp digitado já válido (sem ele, o aluno não vê o botão). */
  temWhatsApp: boolean;
  /** As redes como estão no formulário (`@usuário` ou link). */
  redes: ValoresDasRedes;
  remetente: string;
  responderPara: string;
  arranjo: ArranjoDaMarca;
}

/**
 * Prévia ao vivo do Contato (28/11): o celular com a Conta do aluno na paleta padrão da consultoria ("Falar com o
 * treinador" só com o WhatsApp preenchido e válido; a fileira das redes) e a miniatura do e-mail de lembrete de cobrança
 * com o "De:" e o "Responder para:". Dados de exemplo; nada é tocável nem enviado.
 */
export function PreviaDoContato({ marca, temWhatsApp, redes, remetente, responderPara, arranjo }: Props) {
  const { nome, cores } = paletaDe(marca.temaPadrao);
  const larga = arranjo === 'larga';
  // Só desenho: o que ainda não é link (o `@usuário` antes de salvar) ganha um endereço qualquer, que nunca é aberto.
  const links: LinkDeRede[] = REDES_DA_CONSULTORIA.flatMap((rede: RedeDaConsultoria) => {
    const valor = redes[rede]?.trim();
    return valor ? [{ rede, url: linkParaAbrir(valor) ?? 'https://exemplo.invalid/' }] : [];
  });
  return (
    <View style={[estilos.previa, larga ? estilos.esticada : null]}>
      <View style={estilos.titulos}>
        <Texto variante="bloco" nivel={2}>Prévia</Texto>
        {/* O celular é inerte e fora do leitor de tela: este texto diz o que ele mostra. */}
        <Texto variante="suave">
          {`A Conta do aluno ${temWhatsApp ? 'com o botão "Falar com o treinador"' : 'sem o botão do WhatsApp'}${links.length ? ` e ${links.length === 1 ? '1 rede' : `${links.length} redes`}` : ''}, e o e-mail de lembrete de cobrança. Muda junto com o que você preenche ${larga ? 'ao lado' : 'acima'}; dados de exemplo, nada é enviado.`}
        </Texto>
      </View>
      <View style={[estilos.lado, larga ? estilos.esticada : estilos.quebra]}>
        <Inerte style={larga ? [estilos.celular, estilos.esticada] : estilos.celular}>
          <Escala base={UM_CELULAR} modo={larga ? 'caixa' : 'largura'}>
            <Celular legenda="Conta do aluno" descricao={`Prévia da Conta do aluno na paleta ${nome}`} testID="previa-da-conta" cores={cores}>
              <ContaDoAluno cores={cores} temWhatsApp={temWhatsApp} links={links} />
            </Celular>
          </Escala>
        </Inerte>
        <View style={estilos.email}>
          <MiniaturaDoEmail variante="lembrete" marca={marca} remetente={remetente} responderPara={responderPara} />
        </View>
      </View>
    </View>
  );
}

function Linha({ titulo, resumo, Icone, cores, children }: { titulo: string; resumo?: string; Icone: LucideIcon; cores: Cores; children?: ReactNode }) {
  return (
    <View style={[estilos.linha, { borderBottomColor: cores.divisor }]}>
      <View style={estilos.linhaDoTopo}>
        <Icone size={20} color={cores.texto} />
        <View style={estilos.textosDaLinha}>
          <Texto style={[estilos.tituloDaLinha, { color: cores.texto }]}>{titulo}</Texto>
          {resumo ? <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>{resumo}</Texto> : null}
        </View>
        {children ? null : <ChevronRight size={18} color={cores.textoSuave} />}
      </View>
      {children}
    </View>
  );
}

/** A seção "App" da Conta do aluno (`aluno/conta/TelaDaConta`), com as mesmas linhas e na mesma ordem. */
function ContaDoAluno({ cores, temWhatsApp, links }: { cores: Cores; temWhatsApp: boolean; links: LinkDeRede[] }) {
  return (
    <View style={estilos.corpo}>
      <Texto style={[estilos.tituloDaConta, { color: cores.texto }]}>Conta</Texto>
      <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
        <Texto style={[estilos.secao, { color: cores.textoSuave }]}>APP</Texto>
        <Linha titulo="Aparência e preferências" resumo="Tema, contraste e tamanho do texto" Icone={SlidersHorizontal} cores={cores} />
        {temWhatsApp
          ? <Linha titulo="Falar com o treinador" resumo="Abre o WhatsApp da consultoria" Icone={IconeWhatsApp} cores={cores} />
          : (
            <View style={[estilos.linha, { borderBottomColor: cores.divisor }]}>
              <Texto style={[estilos.miudo, { color: cores.textoSuave }]}>O aluno não vê o botão do WhatsApp</Texto>
            </View>
          )}
        {links.length ? (
          <Linha titulo="Redes da consultoria" resumo="Abrem fora do app" Icone={AtSign} cores={cores}>
            <RedesSociais modo="leitura" redes={links} />
          </Linha>
        ) : null}
        <Linha titulo="Ajuda" resumo="Primeiros passos e tutorial" Icone={BookOpen} cores={cores} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(2) },
  esticada: { flex: 1, minHeight: 0 },
  titulos: { gap: 2 },
  lado: { flexDirection: 'row', gap: espaco(2) },
  quebra: { flexWrap: 'wrap' },
  celular: { flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: LARGURA_DO_CELULAR },
  email: { flexGrow: 1, flexShrink: 1, flexBasis: 300, maxWidth: 480 },
  corpo: { padding: espaco(2), gap: espaco(1.5) },
  tituloDaConta: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  cartao: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingTop: espaco(1.5) },
  secao: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 16, letterSpacing: 0.6 },
  linha: { paddingVertical: espaco(1.25), borderBottomWidth: 1, gap: espaco(1) },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25) },
  textosDaLinha: { flex: 1, minWidth: 0 },
  tituloDaLinha: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  miudo: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18 },
});
