import { Ellipsis, Pencil, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../../api/tipos';
import { COMPARAR_MINIMO, type VariacaoCurta } from '../../dominio/avaliacaoFisica';
import { GRUPOS_DO_HISTORICO, linhaDoHistorico, maisRecentesPrimeiro, type CelulaDoHistorico, type ColunaDoGrupo } from '../../dominio/comparacaoDeAvaliacoes';
import { dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_BLOCO, espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { corDaVariacao } from './apresentacao';

const LINHAS_INICIAIS = 6;
/** Larguras mínimas (× tamanho do texto): a coluna da data (data, selo e balão quebram dentro dela) e a de cada valor. */
const MINIMO_DA_DATA = 120;
const MINIMO_DO_VALOR = 52;
const VAO = espaco(0.75);
const RECUO = espaco(1.5);
const LARGURA_DAS_ACOES = ALVO_TOQUE * 2;
const COLUNAS = GRUPOS_DO_HISTORICO.flatMap((g) => g.colunas);

/** Abaixo disso as 11 colunas cortariam os números: cada avaliação vira um cartão. */
function larguraDaTabela(fatorTexto: number, comAcoes: boolean): number {
  return escalar(MINIMO_DA_DATA + COLUNAS.length * MINIMO_DO_VALOR, fatorTexto) + VAO * (COLUNAS.length + 1) + 2 * RECUO + (comAcoes ? LARGURA_DAS_ACOES + VAO : 0);
}

/** Pares do cartão do celular (grade 2 × 5): direito e esquerdo lado a lado, o tronco de dois em dois. */
const PARES_DO_CARTAO: ColunaDoGrupo[][] = GRUPOS_DO_HISTORICO.slice(1).flatMap((g) => {
  const pares: ColunaDoGrupo[][] = [];
  for (let i = 0; i < g.colunas.length; i += 2) pares.push(g.colunas.slice(i, i + 2));
  return pares;
});

const falado = (nome: string, c: CelulaDoHistorico) => {
  const v = c.variacao;
  const depois = v.tipo === 'primeira' ? `; ${v.falado}` : v.falado ? `; desde a anterior, ${v.falado}` : '';
  return `${nome}: ${c.texto === SEM_DADO ? 'não medido' : c.texto}${depois}`;
};

interface Props {
  avaliacoes: AvaliacaoFisica[];
  /** Meta efetiva do peso do aluno (do registro de peso); sem ela, tudo neutro. */
  meta: MetaDoPeso | null | undefined;
  podeGravar: boolean;
  aoEditar: (a: AvaliacaoFisica) => void;
  aoExcluir: (a: AvaliacaoFisica) => void;
  aoComparar: () => void;
}

/**
 * Histórico em tabela (27/11, pedido do Gustavo): a mais recente em cima, uma coluna por medida em dois níveis (Peso · Braço
 * · Tronco · Coxa · Panturrilha, com a unidade no grupo), valor em mono e, embaixo, a variação desde a anterior ("▲ 0,5",
 * neutra; peso, cintura, abdômen e quadril na cor da meta do peso; zero "0,0" sem seta, sem anterior "Primeira"). "Mais recente" é selo ao lado da data e a observação, o
 * balão. Sem largura para as colunas, um cartão por avaliação com as medidas em grade 2 × 5. Lápis e ⋯ (Excluir) só com
 * `ALUNO_SENSIVEL_ALTERAR`.
 */
export function HistoricoDeAvaliacoes({ avaliacoes, meta, podeGravar, aoEditar, aoExcluir, aoComparar }: Props) {
  const { fatorTexto } = useTema();
  const [todas, setTodas] = useState(false);
  const [menu, setMenu] = useState<AvaliacaoFisica | null>(null);
  const [largura, setLargura] = useState<number | null>(null);
  // Linha com o balão da observação aberto: sobe de camada (cada View da web empilha; as linhas de baixo pintariam por cima).
  const [comDica, setComDica] = useState<string | null>(null);
  const ordenadas = maisRecentesPrimeiro(avaliacoes);
  const maisRecente = ordenadas[0]?.id ?? null;
  const visiveis = todas ? ordenadas : ordenadas.slice(0, LINHAS_INICIAIS);
  const linhas = visiveis.map((a) => ({ a, celulas: linhaDoHistorico(avaliacoes, a, meta) }));
  const emTabela = largura !== null && largura >= larguraDaTabela(fatorTexto, podeGravar);
  const poucas = avaliacoes.length < COMPARAR_MINIMO;

  const data = (a: AvaliacaoFisica) => (
    <DataDaAvaliacao a={a} maisRecente={a.id === maisRecente} aoMudarDica={(aberta) => setComDica((atual) => (aberta ? a.id : atual === a.id ? null : atual))} />
  );
  const acoes = (a: AvaliacaoFisica) => {
    if (!podeGravar) return null;
    const d = dataParaTela(a.data);
    return (
      <View style={estilos.acoes}>
        <IconeBotao compacto Icone={Pencil} rotulo={`Editar avaliação de ${d}`} aoTocar={() => aoEditar(a)} />
        <IconeBotao compacto Icone={Ellipsis} rotulo={`Mais ações da avaliação de ${d}`} aoTocar={() => setMenu(a)} />
      </View>
    );
  };

  return (
    <View style={estilos.bloco}>
      <View style={estilos.topo}>
        <Texto variante="secao" nivel={3}>Histórico</Texto>
        <Botao rotulo="Comparar" tipo="secundario" aoTocar={aoComparar}
          desabilitado={poucas} motivo={poucas ? 'Com duas avaliações dá para comparar.' : undefined} />
      </View>
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={comDica ? estilos.porCima : null}>
        {largura === null ? null : emTabela ? (
          <TabelaDoHistorico linhas={linhas} data={data} acoes={podeGravar ? acoes : null} comDica={comDica} />
        ) : (
          <View accessibilityRole="list" accessibilityLabel="Histórico de avaliações" style={estilos.cartoes}>
            {linhas.map(({ a, celulas }) => (
              <CartaoDaAvaliacao key={a.id} data={data(a)} acoes={acoes(a)} celulas={celulas} porCima={comDica === a.id} />
            ))}
          </View>
        )}
      </View>
      {avaliacoes.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todas ? 'Mostrar só as últimas' : `Mostrar todas (${avaliacoes.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
      ) : null}
      {menu ? (
        <FolhaDeAcoes
          titulo={`Avaliação de ${dataParaTela(menu.data)}`}
          aoFechar={() => setMenu(null)}
          acoes={[{ rotulo: 'Excluir avaliação', detalhe: 'As medidas saem; o registro de peso continua.', Icone: Trash2, perigo: true, aoTocar: () => aoExcluir(menu) }]}
        />
      ) : null}
    </View>
  );
}

/** Data, o selo "Mais recente" e o balão da observação, que quebram dentro da coluna sem ganhar linha própria. */
function DataDaAvaliacao({ a, maisRecente, aoMudarDica }: { a: AvaliacaoFisica; maisRecente: boolean; aoMudarDica: (aberta: boolean) => void }) {
  const d = dataParaTela(a.data);
  return (
    <View style={estilos.data}>
      <Texto numerico style={estilos.forte}>{d}</Texto>
      {maisRecente ? <Selo texto="Mais recente" /> : null}
      {a.observacao ? <DicaDeTexto rotulo={`Observação de ${d}`} texto={a.observacao} aoMudar={aoMudarDica} /> : null}
    </View>
  );
}

function Variacao({ v }: { v: VariacaoCurta }) {
  const { cores } = useTema();
  return <Texto variante="pequeno" numerico cor={corDaVariacao(v.tom, cores)}>{v.texto}</Texto>;
}

function Valor({ c, alinhar }: { c: CelulaDoHistorico; alinhar: 'direita' | 'esquerda' }) {
  const { cores } = useTema();
  return (
    <View style={alinhar === 'direita' ? estilos.aDireita : null} aria-hidden>
      <Texto numerico cor={c.texto === SEM_DADO ? cores.textoSuave : cores.texto}>{c.texto}</Texto>
      <Variacao v={c.variacao} />
    </View>
  );
}

type Linha = { a: AvaliacaoFisica; celulas: Record<string, CelulaDoHistorico> };

/**
 * A tabela larga. O react-native-web não tem `colspan`: cada grupo é uma caixa com o título por cima e as colunas dele
 * embaixo, e o corpo repete a mesma caixa (as bordas batem sem medir). O título do grupo sai da leitura; cada cabeçalho
 * de coluna tem o nome inteiro com a unidade ("Cintura (cm)").
 */
function TabelaDoHistorico({ linhas, data, acoes, comDica }: {
  linhas: Linha[]; data: (a: AvaliacaoFisica) => ReactNode; acoes: ((a: AvaliacaoFisica) => ReactNode) | null; comDica: string | null;
}) {
  const { cores, bordas } = useTema();
  const minimoDaData = { flex: 2, minWidth: MINIMO_DA_DATA };
  return (
    <View role="table" accessibilityLabel="Histórico de avaliações" style={[estilos.tabela, { borderWidth: bordas.bloco, borderColor: cores.divisor }]}>
      <View role="row" style={[estilos.linha, estilos.cabecalho, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo, borderTopLeftRadius: RAIO - bordas.bloco, borderTopRightRadius: RAIO - bordas.bloco }]}>
        <View role="columnheader" style={[minimoDaData, estilos.fundoDoCabecalho]}><Texto variante="secao">Data</Texto></View>
        {GRUPOS_DO_HISTORICO.map((g) => (
          <View key={g.titulo} style={[estilos.grupo, { flex: g.colunas.length }]}>
            <View aria-hidden style={[estilos.tituloDoGrupo, { borderColor: cores.divisor }]}>
              <Texto variante="pequeno" numberOfLines={1} style={estilos.forte}>{g.titulo}</Texto>
            </View>
            <View style={estilos.colunasDoGrupo}>
              {g.colunas.map((c) => (
                <View key={c.chave} role="columnheader" aria-label={`${c.nome} (${c.chave === 'peso' ? 'kg' : 'cm'})`} style={estilos.celula}>
                  <Texto variante="secao" numberOfLines={1} style={estilos.textoADireita}>{c.curto}</Texto>
                </View>
              ))}
            </View>
          </View>
        ))}
        {acoes ? <View role="columnheader" aria-label="Ações" style={estilos.colunaDasAcoes} /> : null}
      </View>
      {linhas.map(({ a, celulas }, i) => (
        <View key={a.id} role="row" style={[estilos.linha, i < linhas.length - 1 ? { borderBottomWidth: 1, borderColor: cores.divisor } : null, comDica === a.id ? estilos.porCima : null]}>
          <View role="cell" style={minimoDaData}>{data(a)}</View>
          {GRUPOS_DO_HISTORICO.map((g) => (
            <View key={g.titulo} style={[estilos.colunasDoGrupo, { flex: g.colunas.length }]}>
              {g.colunas.map((c) => (
                <View key={c.chave} role="cell" aria-label={falado(c.nome, celulas[c.chave])} style={estilos.celula}>
                  <Valor c={celulas[c.chave]} alinhar="direita" />
                </View>
              ))}
            </View>
          ))}
          {acoes ? <View role="cell" style={estilos.colunaDasAcoes}>{acoes(a)}</View> : null}
        </View>
      ))}
    </View>
  );
}

/** Celular: a data e o peso no topo, as medidas em grade 2 × 5 (rótulo à esquerda, valor e variação à direita). */
function CartaoDaAvaliacao({ data, acoes, celulas, porCima }: { data: ReactNode; acoes: ReactNode; celulas: Record<string, CelulaDoHistorico>; porCima: boolean }) {
  const { cores, bordas } = useTema();
  const peso = celulas.peso;
  return (
    <View role="listitem" style={[estilos.cartao, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: cores.superficie }, porCima ? estilos.porCima : null]}>
      <View style={estilos.topoDoCartao}>
        <View style={estilos.encolhe}>{data}</View>
        {acoes}
      </View>
      <ParDoCartao etiqueta="Peso (kg)" nome="Peso" c={peso} />
      <View style={[estilos.grade, { borderColor: cores.divisor }]}>
        {PARES_DO_CARTAO.map((par) => (
          <View key={par[0].chave} style={estilos.linhaDaGrade}>
            {par.map((c) => <ParDoCartao key={c.chave} etiqueta={c.etiqueta} nome={c.nome} c={celulas[c.chave]} />)}
          </View>
        ))}
      </View>
      <Texto variante="pequeno">Medidas em cm.</Texto>
    </View>
  );
}

function ParDoCartao({ etiqueta, nome, c }: { etiqueta: string; nome: string; c: CelulaDoHistorico }) {
  return (
    <View style={estilos.par} accessible accessibilityLabel={falado(nome, c)}>
      <Texto variante="pequeno" style={estilos.encolhe}>{etiqueta}</Texto>
      <Valor c={c} alinhar="direita" />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  acoes: { flexDirection: 'row', flexShrink: 0 },
  forte: { fontFamily: fontes.semi },
  data: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 0 },
  aDireita: { alignItems: 'flex-end' },
  textoADireita: { textAlign: 'right' },
  // Sem `overflow: hidden` (cortaria o balão da observação): o cabeçalho arredonda sozinho os cantos de cima.
  tabela: { borderWidth: BORDA_BLOCO, borderRadius: RAIO },
  porCima: { zIndex: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: VAO, paddingHorizontal: RECUO, paddingVertical: espaco(1), minHeight: 56 },
  cabecalho: { alignItems: 'flex-end', borderBottomWidth: 1, paddingTop: espaco(1), paddingBottom: espaco(0.75) },
  fundoDoCabecalho: { justifyContent: 'flex-end' },
  grupo: { gap: espaco(0.5), minWidth: 0 },
  // O fio embaixo do título mostra até onde vai o grupo (sem borda vertical entre as colunas).
  tituloDoGrupo: { borderBottomWidth: 1, paddingBottom: espaco(0.25), alignItems: 'center' },
  colunasDoGrupo: { flexDirection: 'row', gap: VAO, minWidth: 0 },
  celula: { flex: 1, minWidth: MINIMO_DO_VALOR, alignItems: 'flex-end' },
  colunaDasAcoes: { width: LARGURA_DAS_ACOES, alignItems: 'flex-end' },
  cartoes: { gap: espaco(1) },
  cartao: { borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  topoDoCartao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  encolhe: { flex: 1, minWidth: 0 },
  grade: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(1) },
  linhaDaGrade: { flexDirection: 'row', gap: espaco(2) },
  par: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), minWidth: 0 },
});
