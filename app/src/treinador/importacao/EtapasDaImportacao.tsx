import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { ETAPAS_DA_IMPORTACAO, type ContagemDaEtapa, type NumeroDaEtapa } from '../../dominio/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/** ~360 px ao lado do conteúdo, com o vão de 32 (o mesmo da lateral da Equipe e do Mural). */
const LARGURA_DA_LATERAL = 360;
export const VAO_DA_LATERAL = 32;

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo da `LateralDosMembros`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), overflowY: 'auto' } : {}) as unknown as ViewStyle;

type Situacao = 'feita' | 'atual' | 'pendente';
const situacao = (n: number, atual: NumeroDaEtapa): Situacao => (n < atual ? 'feita' : n === atual ? 'atual' : 'pendente');
const nomeAcessivel = (n: number, titulo: string, s: Situacao) =>
  `Etapa ${n} de ${ETAPAS_DA_IMPORTACAO.length}: ${titulo}${s === 'feita' ? ', concluída' : s === 'atual' ? ', etapa atual' : ''}`;
// `aria-current` só na atual (APG: indicador de passos).
const atributosDoPasso = (s: Situacao) => (s === 'atual' ? { 'aria-current': 'step' as const } : {});

/** Círculo da etapa: a atual cheia na cor de ação; a concluída com ✓ neutro; a próxima só com o contorno. Só desenho. */
function Marcador({ n, s }: { n: number; s: Situacao }) {
  const { cores, fatorTexto } = useTema();
  const cor = s === 'atual' ? cores.acao : s === 'feita' ? cores.texto : cores.bordaCampo;
  return (
    <View aria-hidden style={[estilos.circulo, { borderColor: cor, backgroundColor: s === 'atual' ? cores.acao : 'transparent' }]}>
      {s === 'feita'
        ? <Check size={14} color={cores.texto} strokeWidth={3} />
        : <Texto style={[estilos.numero, { fontSize: 12 / fatorTexto, lineHeight: 16 / fatorTexto, color: s === 'atual' ? cores.sobreAcao : cores.textoSuave }]}>{String(n)}</Texto>}
    </View>
  );
}

/**
 * Coluna "Etapas da importação" a partir da faixa larga (1600 px de área, `useFaixaDaTela`), grudada ao rolar na web:
 * as cinco etapas em passo a passo vertical. Sem sessão (`contagens` nulo), cada etapa com a linha curta e a 1 com
 * "Comece aqui"; com sessão, as contagens da sessão embaixo de cada uma ("—" onde ainda não há dado). Embaixo, a
 * próxima etapa (botão, erro e resultado vêm de quem chama). A altura é a do conteúdo.
 */
export function ColunaDasEtapas({ atual, contagens, children }: {
  atual: NumeroDaEtapa;
  contagens: ContagemDaEtapa[][] | null;
  children?: ReactNode;
}) {
  const janela = useWindowDimensions();
  const { cores } = useTema();
  return (
    <View role="complementary" aria-label="Etapas da importação"
      style={[estilos.lateral, GRUDADA, Platform.OS === 'web' && { maxHeight: janela.height - espaco(4) }]}>
      <Cartao titulo="Etapas da importação">
        {/* Sem nome próprio: a coluna e o título do cartão já dizem "Etapas da importação". */}
        <View role="list">
          {ETAPAS_DA_IMPORTACAO.map((e, i) => {
            const n = i + 1;
            const s = situacao(n, atual);
            const ultima = n === ETAPAS_DA_IMPORTACAO.length;
            return (
              <View key={e.titulo} role="listitem" {...atributosDoPasso(s)} style={estilos.passo}>
                <View style={estilos.trilho}>
                  <Marcador n={n} s={s} />
                  {ultima ? null : <View style={[estilos.fio, { backgroundColor: cores.divisor }]} />}
                </View>
                <View style={[estilos.corpo, ultima ? null : estilos.corpoComFio]}>
                  <Texto variante="bloco" cor={s === 'atual' ? cores.acao : cores.texto} accessibilityLabel={nomeAcessivel(n, e.titulo, s)}>
                    {e.titulo}
                  </Texto>
                  {contagens ? (
                    contagens[i].map((c) => <LinhaDaContagem key={c.rotulo} contagem={c} />)
                  ) : (
                    <>
                      {n === 1 ? <Texto variante="pequeno" cor={cores.acao} style={estilos.comece}>Comece aqui</Texto> : null}
                      <Texto variante="suave">{e.linha}</Texto>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        {children ? <View style={[estilos.proxima, { borderTopColor: cores.divisor }]}>{children}</View> : null}
      </Cartao>
    </View>
  );
}

function LinhaDaContagem({ contagem }: { contagem: ContagemDaEtapa }) {
  return (
    <View style={estilos.contagem}>
      <Texto variante="suave" style={estilos.rotulo}>{contagem.rotulo}</Texto>
      {/* Âmbar só quando há o que conferir; o número vai junto (o sinal nunca é só a cor). */}
      {contagem.atencao ? <View><Selo texto={contagem.valor} tipo="atencao" /></View>
        : <Texto numerico style={estilos.valor}>{contagem.valor}</Texto>}
    </View>
  );
}

/**
 * Abaixo da faixa larga, as etapas numa linha compacta no topo: os cinco números com a atual cheia e o nome dela ao lado
 * (só os números não dizem onde se está). A linha não quebra: no celular é o nome que quebra em duas linhas, nunca um
 * número que desce. Cada número é um item "Etapa N de 5: título" e a atual leva `aria-current="step"`.
 */
export function LinhaDasEtapas({ atual }: { atual: NumeroDaEtapa }) {
  const { cores } = useTema();
  return (
    <View role="list" aria-label="Etapas da importação" style={estilos.linha}>
      {ETAPAS_DA_IMPORTACAO.map((e, i) => {
        const n = i + 1;
        const s = situacao(n, atual);
        return (
          <View key={e.titulo} role="listitem" aria-label={nomeAcessivel(n, e.titulo, s)} {...atributosDoPasso(s)}
            style={[estilos.itemDaLinha, s === 'atual' && estilos.itemAtual]}>
            <Marcador n={n} s={s} />
            {s === 'atual' ? <Texto aria-hidden variante="bloco" cor={cores.acao} style={estilos.nomeDaAtual}>{e.titulo}</Texto> : null}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0, alignSelf: 'flex-start' },
  circulo: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fontes.semi },
  passo: { flexDirection: 'row', gap: espaco(1.5) },
  trilho: { alignItems: 'center' },
  fio: { width: 1, flex: 1, minHeight: espaco(1.5), marginVertical: espaco(0.5) },
  corpo: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  corpoComFio: { paddingBottom: espaco(2) },
  comece: { fontFamily: fontes.semi },
  contagem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: 24 },
  rotulo: { flex: 1, minWidth: 0 },
  valor: { fontFamily: fontes.semi },
  proxima: { gap: espaco(2), borderTopWidth: 1, paddingTop: espaco(2) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  itemDaLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 32, flexShrink: 0 },
  itemAtual: { flexShrink: 1, minWidth: 0 },
  nomeDaAtual: { flexShrink: 1 },
});
