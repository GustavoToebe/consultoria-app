import { CircleAlert, Plus } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { OpcaoRefeicao } from '../../api/tipos';
import { CONTA_NO_TOTAL, kcalDaAba, MAXIMO_DE_OPCOES, MOTIVO_NO_LIMITE_DE_OPCOES, nomeDaAba, tituloDaOpcao } from '../../dominio/opcoesDaRefeicao';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, misturar, RAIO_CONTROLE } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { AbasDasOpcoes } from '../../ui/MarcadorDeOpcao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';

interface Props {
  /** Nome da lista de abas para o leitor de tela ("Opções de 12:00 · Almoço"). */
  rotulo: string;
  /** Título da refeição, para o nome acessível do "+ Nova opção" ("Adicionar opção em 12:00 · Almoço"). */
  refeicao: string;
  opcoes: OpcaoRefeicao[];
  aberta: string;
  comProblema: ReadonlySet<string>;
  aoAbrir: (uid: string) => void;
  aoAdicionar: () => void;
  /** O ⋯ da aba aberta (com duas opções ou mais: a única opção não se exclui). */
  menuDaAberta?: ReactNode;
  /** Logo abaixo das abas, antes da opção aberta (a frase de apoio e o "Desfazer"). */
  apoio?: ReactNode;
  /** Guarda a aba de cada opção, para quem precisa pôr o foco nela (depois de criar ou excluir). */
  registrar: (uid: string, aba: View | null) => void;
  /** A opção aberta (`tabpanel`). */
  children: ReactNode;
  /** Arrastar a aba pela alça (26/11): a mesma ordem da comparação, num estado só (o da refeição). */
  reordenar?: ReordenarOpcoes;
}

/** O que as duas listas das opções (as abas e a comparação) recebem para reordenar: a mesma função, com o aviso dela. */
export interface ReordenarOpcoes {
  aoSoltar: (de: number, para: number) => (() => void) | void;
  mensagem: (de: number, para: number) => string;
}

/**
 * Opções da refeição em abas no editor (19/11; círculo com a letra desde 25/11; abas sempre, também com uma opção, desde
 * 25/11 à noite): a faixa é a `ui/AbasDasOpcoes`, a mesma da dieta do aluno. Aqui entram o que é do editor: "Opção A" com
 * "98 kcal" ou "vazia" em texto secundário (nunca "0 kcal"), o selo "Conta no total do dia" na primeira (só com duas ou
 * mais: com uma só não há o que escolher), o ícone da aba com erro da validação, o ⋯ da aberta e, no fim da fileira, o
 * "+ Nova opção" tracejado. Com `reordenar` (26/11), a aba aberta ganha a alça ⠿ ao lado (fora do gatilho) e as outras
 * são destino, só pelo x do ponteiro; a ordem é a mesma da comparação.
 */
export function AbasDeOpcao({ rotulo, refeicao, opcoes, aberta, comProblema, aoAbrir, aoAdicionar, menuDaAberta, apoio, registrar, children, reordenar }: Props) {
  const { cores } = useTema();
  // Uma fileira só: vale o x do ponteiro. Com uma opção a alça some (nada a reordenar); as outras abas são destino.
  const arraste = useArrasteDaLista({ total: reordenar ? opcoes.length : 0, eixo: 'horizontal', folga: 0, aoSoltar: (de, para) => reordenar?.aoSoltar(de, para), mensagem: reordenar?.mensagem });
  const varias = opcoes.length > 1;
  const noLimite = opcoes.length >= MAXIMO_DE_OPCOES;
  // Faixa estreita (celular, ~320 px): "+ Nova", para a aba aberta caber inteira com o ⋯ ao lado (medido em 25/11: com
  // "+ Nova opção" a aba A passava da faixa e o ⋯ ficava cortado).
  const [largura, setLargura] = useState(0);
  const curto = largura > 0 && largura < FAIXA_ESTREITA;
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
    <AbasDasOpcoes rotulo={rotulo} aberta={aberta} aoAbrir={aoAbrir} registrar={registrar} acaoDaAberta={menuDaAberta}
      // A alça só na aberta (pega-se a aba e arrasta): uma em cada aba não deixava as três caberem em 1280. Na faixa
      // estreita (celular) não há: a aba aberta, com o ⋯, já ocupa a faixa e a fileira rola de lado; lá ficam a alça da
      // comparação e o ⋯.
      // shortcut: a fileira não rola de lado sozinha durante o arraste (a rolagem automática da peça é vertical): com 5 ou 6
      // opções, a aba fora da vista só se alcança pela comparação ou pelo ⋯; trocar se aparecer refeição com tantas opções.
      // O toque longo na alça dentro da rolagem horizontal não foi conferido num aparelho.
      envolver={arraste.ativo && largura >= FAIXA_ESTREITA ? (aba, uid, i) => (
        <ItemArrastavel arraste={arraste} indice={i} style={estilos.comAlca}>{uid === aberta ? <AlcaDeArraste arraste={arraste} indice={i} /> : null}{aba}</ItemArrastavel>
      ) : undefined}
      depois={<NovaOpcao refeicao={refeicao} aoTocar={aoAdicionar} desabilitado={noLimite} curto={curto} />}
      apoio={noLimite || apoio ? <>
        {noLimite ? <Texto variante="pequeno">{MOTIVO_NO_LIMITE_DE_OPCOES}</Texto> : null}
        {apoio}
      </> : undefined}
      abas={opcoes.map((o, i) => {
        const problema = comProblema.has(o.uid);
        const vazia = o.itens.length === 0;
        return {
          valor: o.uid,
          letra: o.rotulo,
          titulo: tituloDaOpcao(o),
          rotuloAcessivel: nomeDaAba(o, varias && i === 0, problema),
          antes: problema ? <CircleAlert size={16} color={cores.perigo} strokeWidth={2.5} /> : undefined,
          detalhe: <Texto variante="suave" numerico={!vazia}>{kcalDaAba(o)}</Texto>,
          // O selo da primeira vai na linha de baixo: na mesma linha, a aba aberta passava da faixa em 390 e empurrava a
          // terceira para fora em 1280.
          abaixo: varias && i === 0 ? <Selo texto={CONTA_NO_TOTAL} /> : undefined,
        };
      })}>
      {children}
    </AbasDasOpcoes>
    </View>
  );
}

/** Abaixo desta largura de faixa, o "+ Nova opção" vira "+ Nova". */
const FAIXA_ESTREITA = 480;

/**
 * "+ Nova opção" (25/11): a próxima aba ainda por criar, de contorno tracejado (o mesmo tom do contorno do `Botao acao`)
 * com o texto na cor de ação e sem fundo, para ser achada sem pesar mais que as abas. Alvo de 44 px; no limite de opções
 * fica cinza e o motivo aparece embaixo da faixa (e no `accessibilityHint`). O `Botao` não tem desenho tracejado.
 */
function NovaOpcao({ refeicao, aoTocar, desabilitado, curto }: { refeicao: string; aoTocar: () => void; desabilitado: boolean; curto: boolean }) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const corDoTexto = desabilitado ? cores.textoSuave : cores.acao;
  const contorno = desabilitado ? cores.borda : misturar(cores.acaoSuave, cores.acao, 0.35);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar opção em ${refeicao}`}
      accessibilityHint={desabilitado ? MOTIVO_NO_LIMITE_DE_OPCOES : undefined} accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado} onPress={aoTocar} style={estilos.alvo}>
      {(estado) => {
        const ativo = sobre(estado) && !desabilitado;
        return (
          <View style={[estilos.desenho, !reduzido && Platform.OS === 'web' ? estilos.transicao : null,
            { borderColor: ativo ? cores.acao : contorno, backgroundColor: ativo ? cores.acaoSuave : 'transparent' }]}>
            <Plus size={16} color={corDoTexto} strokeWidth={2.25} />
            <Texto style={[estilos.texto, { color: corDoTexto }]}>{curto ? 'Nova' : 'Nova opção'}</Texto>
          </View>
        );
      }}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  comAlca: { flexDirection: 'row', alignItems: 'stretch' },
  alvo: { minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenho: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: 36, paddingHorizontal: espaco(1.5),
    borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO_CONTROLE,
  },
  texto: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 20 },
  // Só na web (o RN não anima estilo), como o `Botao`.
  transicao: { transitionProperty: 'background-color, border-color', transitionDuration: '120ms' } as ViewStyle,
});
