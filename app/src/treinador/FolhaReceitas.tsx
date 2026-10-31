import { Replace } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarPastasModelos, listarReceitas } from '../api/rotas';
import type { Configuracao, Receita, TipoReceita } from '../api/tipos';
import { descreverSeries } from '../dominio/agrupamento';
import { agruparPorColecao, SEM_COLECAO } from '../dominio/colecoes';
import { seriesDaReceita } from '../dominio/editorTreino';
import { composicaoDaReceita, filtrarReceitasDeSeries } from '../dominio/receitasDeSeries';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { metadadosDoModelo } from './planejamento/modelos';

/**
 * Receitas da consultoria (pontos de partida editáveis, como no Servirea): "Usar este modelo" troca o conteúdo do
 * alvo por uma cópia com uids novos. A tela do editor oferece "Desfazer" logo depois.
 *
 * Receitas de séries (reunião de 30/10): busca pelo nome, pela descrição e pela composição ("back off"), agrupadas por
 * coleção como no Planejamento, e cada uma mostra a sequência que vai entrar ("3x3 - FS 50% · 70% · 85% da WS") antes de
 * aplicar, com o aviso fixo de que substitui as séries do exercício. Sem as coleções (erro ou sem permissão), a lista
 * fica numa coluna só. Semana e dia de treino dizem quando o modelo é só a estrutura, sem exercícios.
 */
export function FolhaReceitas({
  tipo,
  titulo,
  explicacao,
  config,
  aoUsar,
  aoFechar,
}: {
  tipo: TipoReceita;
  titulo: string;
  explicacao?: string;
  /** Metodologia do plano: dá os nomes dos tipos na sequência das receitas de séries. */
  config?: Configuracao | null;
  aoUsar: (r: Receita) => void;
  aoFechar: () => void;
}) {
  const { dados, erro, carregando, recarregar } = useCarregar(`receitas:${tipo}`, () => listarReceitas(tipo));
  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}>
      {explicacao ? <Texto variante="suave">{explicacao}</Texto> : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Vazio titulo="Sem modelos deste tipo" texto="Cadastre um modelo em Planejamento para reutilizá-la nos planos." /> : null}
      {dados && dados.length > 0 && tipo === 'SERIES' ? <ReceitasDeSeries receitas={dados} config={config} aoUsar={aoUsar} /> : null}
      {dados && tipo !== 'SERIES' ? dados.map((r) => <ModeloSimples key={r.id} receita={r} tipo={tipo} aoUsar={aoUsar} />) : null}
    </Folha>
  );
}

/** Semana ou dia de treino sem exercício nenhum: só a estrutura (os dias), dito antes de usar. */
function linhaDoModelo(tipo: TipoReceita, conteudo: unknown): string | null {
  if (tipo !== 'PLANO_TREINO' && tipo !== 'SESSAO_TREINO') return null;
  // `metadadosDoModelo` é a mesma linha do Planejamento ("6 sessões · sem exercícios"); o prefixo só entra aqui.
  const metadados = metadadosDoModelo(tipo, conteudo);
  if (!metadados.endsWith('sem exercícios')) return metadados;
  return `${tipo === 'PLANO_TREINO' ? 'Estrutura de semana' : 'Estrutura do dia'} · ${metadados}`;
}

function ModeloSimples({ receita: r, tipo, aoUsar }: { receita: Receita; tipo: TipoReceita; aoUsar: (r: Receita) => void }) {
  const { cores } = useTema();
  const linha = linhaDoModelo(tipo, r.conteudo);
  return (
    <View style={[estilos.receita, { borderColor: cores.borda }]}>
      <Texto variante="subtitulo">{r.nome}</Texto>
      {linha ? <Texto variante="suave" numerico>{linha}</Texto> : null}
      {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      <View style={estilos.botoes}>
        <Botao rotulo="Usar este modelo" tipo="secundario" aoTocar={() => aoUsar(r)} />
      </View>
    </View>
  );
}

const quantasReceitas = (n: number) => (n === 1 ? '1 receita' : `${n} receitas`);

function ReceitasDeSeries({ receitas, config, aoUsar }: { receitas: Receita[]; config?: Configuracao | null; aoUsar: (r: Receita) => void }) {
  const colecoes = useCarregar('pastas-modelos', listarPastasModelos);
  const [busca, setBusca] = useState('');
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(new Set());
  // A busca procura em todas as coleções e reabre as recolhidas, como no Planejamento.
  const buscar = (texto: string) => { setBusca(texto); if (texto.trim()) setRecolhidas(new Set()); };
  const alternar = (chave: string) => setRecolhidas((atual) => {
    const nova = new Set(atual);
    if (nova.has(chave)) nova.delete(chave);
    else nova.add(chave);
    return nova;
  });
  // Sequência e composição de cada receita, calculadas uma vez por lista (os uids de leitura nascem aqui, não vão ao plano).
  const leituras = useMemo(() => new Map(receitas.map((r) => {
    const series = seriesDaReceita(r.conteudo);
    return [r.id, { sequencia: descreverSeries(series, config), composicao: composicaoDaReceita(r.conteudo, config) }];
  })), [receitas, config]);
  const filtradas = filtrarReceitasDeSeries(receitas, busca, config);
  // Espera as coleções para não piscar "Sem coleção"; se elas falharem (ou sem permissão), uma lista só.
  const esperando = !colecoes.dados && !colecoes.erro;
  const grupos = colecoes.dados ? agruparPorColecao(filtradas, colecoes.dados) : null;
  const semGrupos = !grupos || (grupos.length === 1 && grupos[0].rotulo === SEM_COLECAO);
  const cartao = (r: Receita) => <CartaoDaReceita key={r.id} receita={r} leitura={leituras.get(r.id)} aoUsar={aoUsar} />;
  return (
    <View style={estilos.lista}>
      <Campo rotulo="Buscar receita" valor={busca} aoMudar={buscar} placeholder="Nome, descrição ou séries (ex.: back off)" autoCorrect={false} />
      {esperando ? <Esqueleto /> : null}
      {!esperando && filtradas.length === 0 ? <Vazio texto="Nenhuma receita com essa busca." /> : null}
      {!esperando && filtradas.length > 0 && semGrupos ? filtradas.map(cartao) : null}
      {!esperando && !semGrupos && grupos ? grupos.map((g) => {
        const chave = g.pastaId ?? '';
        const aberto = !recolhidas.has(chave);
        return (
          <Cartao key={chave} cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={quantasReceitas(g.itens.length)} aberto={aberto} aoAlternar={() => alternar(chave)} acoesJuntas />}>
            {aberto ? <View style={estilos.lista}>{g.itens.map(cartao)}</View> : null}
          </Cartao>
        );
      }) : null}
    </View>
  );
}

function CartaoDaReceita({ receita: r, leitura, aoUsar }: { receita: Receita; leitura?: { sequencia: string[]; composicao: string }; aoUsar: (r: Receita) => void }) {
  const { cores } = useTema();
  const sequencia = leitura?.sequencia ?? [];
  return (
    <View style={[estilos.receita, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="subtitulo">{r.nome}</Texto>
      <Texto variante="suave" numerico>{leitura?.composicao || 'Sem séries'}</Texto>
      {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      {sequencia.length ? (
        <View style={[estilos.sequencia, { borderLeftColor: cores.bordaCampo }]} accessibilityLabel={`Sequência de ${r.nome}: ${sequencia.join('; ')}`}>
          <Texto variante="rotulo">Sequência</Texto>
          {sequencia.map((linha, i) => <Texto key={i} numerico>{linha}</Texto>)}
        </View>
      ) : null}
      {/* O aviso fica sempre ao lado do botão: aplicar troca as séries do exercício (o editor oferece "Desfazer"). */}
      <View style={estilos.aplicar}>
        <View style={estilos.aviso}>
          <Replace size={16} color={cores.textoSuave} />
          <Texto variante="pequeno" style={estilos.textoDoAviso}>Substitui as séries deste exercício</Texto>
        </View>
        <Botao rotulo="Aplicar receita" rotuloAcessivel={`Aplicar receita ${r.nome}`} tipo="secundario" aoTocar={() => aoUsar(r)} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  receita: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
  sequencia: { borderLeftWidth: 3, paddingLeft: espaco(1.25), gap: 2, marginTop: espaco(0.25) },
  aplicar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(1), marginTop: espaco(0.5) },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexShrink: 1 },
  textoDoAviso: { flexShrink: 1 },
});
