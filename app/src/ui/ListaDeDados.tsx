import { Children, createContext, Fragment, isValidElement, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { empilhaDados, larguraDoRotulo, partesNumericas, VAO_DA_LINHA } from '../dominio/listaDeDados';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { Texto } from './Texto';

interface Arranjo {
  empilhado: boolean;
  rotulo: number;
}

const ArranjoDaLista = createContext<Arranjo>({ empilhado: true, rotulo: larguraDoRotulo() });
/** A linha é a primeira do grupo: sem fio em cima (o fio fica só entre as linhas). */
const PrimeiraDoGrupo = createContext(true);

/** Desfaz os fragmentos, para o `<>…</>` de quem chama não contar como uma linha só. */
function itensDe(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((filho) =>
    isValidElement<{ children?: ReactNode }>(filho) && filho.type === Fragment ? itensDe(filho.props.children) : [filho]);
}

const ehSubtitulo = (filho: ReactNode): filho is ReactElement => isValidElement(filho) && filho.type === SubtituloDeDados;

/**
 * Lista de dados (24/11; plano `docs/planos/ficha-lista-de-dados.md`): pares rótulo–valor com uma coluna de ações à
 * direita, fio `divisor` só entre as linhas e a mesma altura mínima em todas. Mede a própria largura (nunca a janela) e
 * decide uma vez para a lista toda (`dominio/listaDeDados.empilhaDados`): rótulo numa coluna fixa (200 px, maior no texto
 * grande) ou rótulo em cima do valor, em todas as linhas juntas; as ações ficam à direita nos dois arranjos. Antes da
 * primeira medida, o palpite é o da janela (o mesmo do `Par` antigo), para o PC não piscar empilhado.
 *
 * Filhos: `LinhaDeDado` e `SubtituloDeDados` (que abre um grupo novo, sem fio em cima da primeira linha dele). Quem chama
 * decide antes quais linhas existem: um componente que às vezes devolve `null` não pode ser o primeiro do grupo (ele
 * levaria o "primeira" e a linha seguinte ganharia um fio sobrando). Acessibilidade: cada grupo é uma lista
 * (`role="list"`, o `ul` do react-native-web) e cada linha um item com `term` e `definition` (o react-native-web 0.21 não
 * gera `dl`/`dt`/`dd`); o par também tem o nome "Rótulo: valor", que no celular é o que o leitor de tela lê. Sem
 * `aria-labelledby` no valor: ele daria à definição o nome do rótulo ("Nome", "Telefone") e a confundiria com o campo
 * do formulário de mesmo rótulo.
 */
export function ListaDeDados({ children }: { children: ReactNode }) {
  const { fatorTexto } = useTema();
  const { width } = useWindowDimensions();
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => {
    const proxima = e.nativeEvent.layout.width;
    setLargura((atual) => (atual === proxima ? atual : proxima));
  };
  const arranjo: Arranjo = {
    empilhado: largura > 0 ? empilhaDados(largura, fatorTexto) : width < LARGURA_MENU_LATERAL,
    rotulo: larguraDoRotulo(fatorTexto),
  };
  // Grupos: o subtítulo fica fora da lista (uma lista só tem itens) e começa a seguinte.
  const grupos: { subtitulo: ReactElement | null; linhas: ReactNode[] }[] = [];
  for (const filho of itensDe(children)) {
    if (ehSubtitulo(filho)) grupos.push({ subtitulo: filho, linhas: [] });
    else if (grupos.length === 0) grupos.push({ subtitulo: null, linhas: [filho] });
    else grupos[grupos.length - 1].linhas.push(filho);
  }
  return (
    <ArranjoDaLista.Provider value={arranjo}>
      <View onLayout={aoMedir}>
        {grupos.map((g, i) => (
          <View key={g.subtitulo?.key ?? i} style={i > 0 ? estilos.grupoSeguinte : null}>
            {g.subtitulo}
            {g.linhas.length > 0 ? (
              <View role="list">
                {g.linhas.map((linha, j) => <PrimeiraDoGrupo.Provider key={isValidElement(linha) && linha.key != null ? linha.key : j} value={j === 0}>{linha}</PrimeiraDoGrupo.Provider>)}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ArranjoDaLista.Provider>
  );
}

/** Subtítulo de grupo dentro da lista (caixa alta, `textoSuave`, como o sobretítulo de seção); título de 4º nível. */
export function SubtituloDeDados({ children }: { children: string }) {
  return <Texto variante="secao" role="heading" aria-level={4} style={estilos.subtitulo}>{children}</Texto>;
}

interface PropsDaLinha {
  rotulo: string;
  /** Texto do valor (também o que o leitor de tela ouve). Vazio ou só espaços = `vazio`. */
  valor: string | null | undefined;
  /** O que aparece sem valor: "—" por padrão; os Dados do aluno usam "Não informado". */
  vazio?: string;
  /** Fonte numérica só nos números do valor ("15" de "15 dias"; data, CPF, telefone). */
  numerico?: boolean;
  /** No lugar do texto (chips, selo); o nome acessível continua "Rótulo: valor". */
  conteudo?: ReactNode;
  /** Abaixo do valor: texto vira linha pequena; outro elemento (aviso de erro, duas notas) entra como veio. */
  nota?: ReactNode;
  /** Dica do valor (a data completa de um "Ontem, 18:38"): `title` na web e parte do nome acessível, porque o mouse não pode ser o único caminho. */
  dica?: string;
  /** Botões da linha, à direita e centralizados na altura dela. Ficam fora do par com nome (no celular, o nome esconderia os filhos). */
  acoes?: ReactNode;
}

export function LinhaDeDado({ rotulo, valor, vazio = '—', numerico, conteudo, nota, dica, acoes }: PropsDaLinha) {
  const { cores } = useTema();
  const { empilhado, rotulo: larguraRotulo } = useContext(ArranjoDaLista);
  const primeira = useContext(PrimeiraDoGrupo);
  const semValor = !valor?.trim();
  const texto = semValor ? vazio : valor!;
  // O react-native-web não repassa `title`: vai direto no elemento.
  const comDica = (el: View | null) => {
    if (dica && Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', dica);
  };
  return (
    <View role="listitem" style={[estilos.linha, primeira ? null : { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
      <View style={[estilos.par, empilhado ? null : estilos.parEmLinha]} accessibilityLabel={`${rotulo}: ${texto}${dica ? ` (${dica})` : ''}`}>
        <Texto variante="rotulo" role="term" style={empilhado ? null : { width: larguraRotulo, flexShrink: 0 }}>{rotulo}</Texto>
        <View ref={comDica} role="definition" style={[estilos.valor, empilhado ? null : estilos.valorEmLinha]}>
          {conteudo && !semValor ? conteudo : semValor ? <Texto variante="suave">{texto}</Texto> : <ValorEmTexto texto={texto} numerico={numerico} />}
          {typeof nota === 'string' ? <Texto variante="pequeno">{nota}</Texto> : nota ?? null}
        </View>
      </View>
      {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
    </View>
  );
}

/** Texto com a fonte numérica só nos números (datas, CPF, telefone, "15" em "15 dias"). */
export function ValorEmTexto({ texto, numerico }: { texto: string; numerico?: boolean }) {
  if (!numerico) return <Texto>{texto}</Texto>;
  return <Texto>{partesNumericas(texto).map((p, i) => (p.numerico ? <Texto key={i} numerico>{p.texto}</Texto> : p.texto))}</Texto>;
}

const estilos = StyleSheet.create({
  grupoSeguinte: { marginTop: espaco(2) },
  subtitulo: { paddingBottom: espaco(0.5) },
  // 48 de altura mínima em toda linha; a ação (44) entra na mesma altura pela margem negativa, sem esticar a linha.
  linha: { flexDirection: 'row', alignItems: 'center', gap: VAO_DA_LINHA, minHeight: 48, paddingVertical: espaco(1) },
  par: { flex: 1, minWidth: 0, gap: espaco(0.25) },
  parEmLinha: { flexDirection: 'row', alignItems: 'baseline', gap: VAO_DA_LINHA },
  valor: { gap: espaco(0.5) },
  // Só em linha: na coluna (empilhado), o `flex: 1` do react-native-web zeraria a altura do valor.
  valorEmLinha: { flex: 1, minWidth: 0 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), marginVertical: -espaco(0.75), flexShrink: 0 },
});
