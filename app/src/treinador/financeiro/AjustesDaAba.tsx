import { Link, router } from 'expo-router';
import { Children, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Switch } from '../../components/ui/switch';
import { deixarParaONavegador, type CliqueDoNavegador } from '../../dominio/cliqueDeLink';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_DUAS_COLUNAS, LARGURA_FORMULARIO, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { RodapeDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Peças das abas de ajustes do Financeiro (Lembretes e Recebimento; lembretes e recebimento, 19/11): as duas colunas
 * (ajustes 2fr, apoio 1fr), a linha de opção com interruptor, a barra de salvar no rodapé do cartão e o link para outra aba.
 * Locais de propósito: se uma terceira tela precisar, sobem para `ui/` (sugestão para o design system).
 */

/**
 * Ajustes à esquerda (2fr) e o cartão de apoio à direita (1fr), alinhados pelo topo, a partir de `LARGURA_DUAS_COLUNAS` (960)
 * medidos na própria área (como `ui/Grade`), não na janela: com o menu aberto (240) isso é uma janela de ~1230 px, com o menu
 * recolhido ~1060. Abaixo, uma coluna, ajustes primeiro. A mesma árvore nas duas formas: só o estilo muda e os campos não remontam.
 */
export function ColunasDeAjustes({ ajustes, apoio }: { ajustes: ReactNode; apoio: ReactNode }) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const lado = largura >= LARGURA_DUAS_COLUNAS;
  // A largura nasce 0 e só vem do `onLayout`, depois da primeira pintura: sem isto a aba aparecia numa coluna e saltava para
  // duas (a "piscada" do Lembretes e do Recebimento). Medido e invisível no primeiro quadro, sem remontar nada.
  return (
    <View onLayout={aoMedir} style={[estilos.colunas, lado ? estilos.lado : null, largura === 0 ? estilos.semMedida : null]}>
      <View style={[estilos.coluna, estilos.colunaAjustes, lado ? estilos.ajustes : null]}>{ajustes}</View>
      <View style={[estilos.coluna, estilos.colunaApoio, lado ? estilos.apoio : null]}>{apoio}</View>
    </View>
  );
}

/** Largura da coluna da direita, a mesma para o interruptor e para "Sempre ligado": todas as linhas terminam na mesma borda. */
const COLUNA_DO_CONTROLE = 112;

/** Opções numa lista, com um fio `divisor` só entre elas (o que vier nulo não conta). */
export function GrupoDeOpcoes({ children }: { children: ReactNode }) {
  const { cores, bordas } = useTema();
  return (
    <View>
      {Children.toArray(children).map((filho, i) => (
        <View key={i} style={i === 0 ? null : { borderTopWidth: bordas.item, borderTopColor: cores.divisor }}>{filho}</View>
      ))}
    </View>
  );
}

/**
 * Uma opção: título e descrição à esquerda, o controle à direita, centralizado na vertical, numa coluna de largura fixa.
 * Com `interruptor`, tocar no título também alterna (como o `ui/Interruptor`); o nome acessível do interruptor é o título.
 * `children` fica embaixo da linha, na largura toda (os dados do Pix).
 */
export function LinhaDeOpcao({ titulo, descricao, interruptor, controle, children }: {
  titulo: string;
  descricao?: ReactNode;
  interruptor?: { valor: boolean; aoMudar: (v: boolean) => void; desabilitado?: boolean };
  controle?: ReactNode;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const tituloTexto = <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>;
  return (
    <View style={estilos.opcao}>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          {interruptor && !interruptor.desabilitado ? (
            <Pressable accessible={false} tabIndex={-1} onPress={() => interruptor.aoMudar(!interruptor.valor)}>{tituloTexto}</Pressable>
          ) : tituloTexto}
          {descricao ? <Texto variante="pequeno">{descricao}</Texto> : null}
        </View>
        <View style={estilos.controle}>
          {interruptor ? (
            <Switch checked={interruptor.valor} onCheckedChange={interruptor.aoMudar} disabled={interruptor.desabilitado} accessibilityLabel={titulo} />
          ) : controle}
        </View>
      </View>
      {children}
    </View>
  );
}

/**
 * Rodapé do cartão de ajustes, separado por um fio `divisor` de ponta a ponta. Sem alteração, só o texto (`semAlteracao`,
 * "Tudo salvo"), sem botão desativado; com alteração, "Alterações não salvas", "Descartar" e "Salvar". O status é região viva;
 * descartar leva o foco a ele (os botões somem). No celular as ações vão em coluna, a principal em cima (`RodapeDeAcoes`).
 */
export function BarraDeSalvar({ mudou, enviando, aoSalvar, aoDescartar, rotuloSalvar = 'Salvar', rotuloAcessivelSalvar, rotuloAcessivelDescartar, semAlteracao = 'Tudo salvo', erro }: {
  mudou: boolean;
  enviando: boolean;
  aoSalvar: () => void;
  aoDescartar: () => void;
  rotuloSalvar?: string;
  rotuloAcessivelSalvar?: string;
  rotuloAcessivelDescartar?: string;
  semAlteracao?: string;
  /** Erro do salvar que não é de um campo: fica na barra, perto da ação. */
  erro?: ReactNode;
}) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const status = useRef<View>(null);
  // O mesmo recuo do `Cartao`: o fio vai de borda a borda do cartão, como o filete da faixa do título.
  const recuo = espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2);
  const descartar = () => {
    aoDescartar();
    requestAnimationFrame(() => status.current?.focus());
  };
  return (
    <View style={[estilos.barra, { borderTopWidth: bordas.item, borderTopColor: cores.divisor, marginHorizontal: -recuo, paddingHorizontal: recuo }]}>
      {erro}
      <RodapeDeAcoes empilhar={width < LARGURA_MENU_LATERAL} status={(
        <View ref={status} tabIndex={-1} aria-live="polite" style={estilos.status}>
          <Texto variante="suave" cor={mudou ? cores.texto : undefined}>{mudou ? 'Alterações não salvas' : semAlteracao}</Texto>
        </View>
      )}>
        {mudou ? (
          <>
            <Botao rotulo="Descartar" rotuloAcessivel={rotuloAcessivelDescartar} tipo="secundario" desabilitado={enviando} aoTocar={descartar} />
            <Botao rotulo={rotuloSalvar} rotuloAcessivel={rotuloAcessivelSalvar} carregando={enviando} aoTocar={aoSalvar} />
          </>
        ) : null}
      </RodapeDeAcoes>
    </View>
  );
}

type Aba = 'cobrancas' | 'planos';

/**
 * Link de texto para outra aba do Financeiro, dentro de uma frase. O `ui/LinkTexto` não serve: ele trata a mesma rota com
 * outra `?aba=` como a tela atual e não navega. Com alteração não salva, pergunta antes (`confirmar` da guarda de saída).
 */
export function LinkDeAba({ aba, texto }: { aba: Aba; texto: string }) {
  const { cores } = useTema();
  const { confirmar } = useSaidaGuardada();
  const href = { pathname: '/treinador/financeiro', params: { aba } } as const;
  const aoTocar = (clique: CliqueDoNavegador & { preventDefault?: () => void }) => {
    if (deixarParaONavegador(clique)) return;
    clique.preventDefault?.();
    confirmar(() => router.push(href));
  };
  return (
    <Link href={href} accessibilityRole="link" onPress={aoTocar} style={[estilos.link, { color: cores.texto }]}>{texto}</Link>
  );
}

const estilos = StyleSheet.create({
  colunas: { gap: espaco(2) },
  semMedida: { opacity: 0 },
  lado: { flexDirection: 'row', alignItems: 'flex-start' },
  coluna: { gap: espaco(2) },
  colunaAjustes: { width: '100%', maxWidth: LARGURA_FORMULARIO },
  colunaApoio: { width: '100%', maxWidth: LARGURA_FORMULARIO },
  ajustes: { flex: 2, minWidth: 0 },
  apoio: { flex: 1, minWidth: 0 },
  opcao: { paddingVertical: espaco(1.5), gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2) },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  // Em linha e encostado à direita: o `Selo` tem `alignSelf: flex-start`, que numa coluna o puxaria para a esquerda.
  controle: { width: COLUNA_DO_CONTROLE, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  barra: { paddingTop: espaco(2), gap: espaco(1) },
  status: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
});
