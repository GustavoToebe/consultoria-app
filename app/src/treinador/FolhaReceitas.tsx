import { ListPlus, Replace } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarPastasModelos, listarReceitas } from '../api/rotas';
import type { Configuracao, Receita, TipoReceita } from '../api/tipos';
import { motivoParaAcrescentar, seriesDaReceita, type ModoDaReceita } from '../dominio/editorTreino';
import { composicaoDaReceita, filtrarReceitasDeSeries, agruparReceitasDeSeries, pecasDaReceita, type PecaDaReceita } from '../dominio/receitasDeSeries';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
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
import { useSecoesAbertas } from '../ui/useSecoesAbertas';
import { metadadosDoModelo } from './planejamento/modelos';

/**
 * Receitas da consultoria (pontos de partida editáveis, como no Servirea): "Usar este modelo" troca o conteúdo do
 * alvo por uma cópia com uids novos. A tela do editor oferece "Desfazer" logo depois.
 *
 * Receitas de séries (reunião de 30/10; Frente G, D16, C16): busca no topo (nome, descrição e composição, "back off"),
 * seções recolhíveis por bloco e técnica (receitas completas, Aquecimento, Preparação, Trabalho, Pós-trabalho, uma por
 * técnica; `agruparReceitasDeSeries`), cada receita uma vez, com a sequência que vai entrar ("3x3 - FS 50% · 70% · 85% da
 * WS") e o selo do tipo na cor dele, antes de aplicar. Exercício sem séries: "Aplicar receita"; com séries (C81, D4):
 * "Substituir as séries" ou "Acrescentar ao fim" (desabilitado com o motivo acima do limite). A coleção aparece embaixo
 * da receita (sem as coleções, por erro ou permissão, a linha some). Semana e dia de treino dizem quando o modelo é só a
 * estrutura, sem exercícios.
 */
export function FolhaReceitas({
  tipo,
  titulo,
  explicacao,
  config,
  seriesAtuais = 0,
  aoUsar,
  aoFechar,
}: {
  tipo: TipoReceita;
  titulo: string;
  explicacao?: string;
  /** Metodologia do plano: dá os nomes dos tipos na sequência das receitas de séries. */
  config?: Configuracao | null;
  /** Quantas séries o exercício já tem (só receita de séries): com alguma, cada receita oferece substituir ou acrescentar. */
  seriesAtuais?: number;
  /** `modo` só vem na receita de séries; os outros tipos ignoram. */
  aoUsar: (r: Receita, modo?: ModoDaReceita) => void;
  aoFechar: () => void;
}) {
  const { dados, erro, carregando, recarregar } = useCarregar(`receitas:${tipo}`, () => listarReceitas(tipo));
  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}>
      {explicacao ? <Texto variante="suave">{explicacao}</Texto> : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Vazio titulo="Sem modelos deste tipo" texto="Cadastre um modelo em Planejamento para reutilizá-la nos planos." /> : null}
      {dados && dados.length > 0 && tipo === 'SERIES' ? <ReceitasDeSeries receitas={dados} config={config} seriesAtuais={seriesAtuais} aoUsar={aoUsar} /> : null}
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

function ReceitasDeSeries({ receitas, config, seriesAtuais, aoUsar }: {
  receitas: Receita[];
  config?: Configuracao | null;
  seriesAtuais: number;
  aoUsar: (r: Receita, modo: ModoDaReceita) => void;
}) {
  const colecoes = useCarregar('pastas-modelos', listarPastasModelos);
  const [busca, setBusca] = useState('');
  // Seções nascem fechadas (a única nasce aberta); a busca abre as que têm resultado e limpar volta ao de antes. Os ids
  // são os da lista completa, não os da busca. Cada abertura da folha começa de novo (nada vai ao aparelho).
  const completas = useMemo(() => agruparReceitasDeSeries(receitas, config), [receitas, config]);
  const abertas = useSecoesAbertas(completas.map((s) => s.chave));
  const buscar = (texto: string) => { setBusca(texto); abertas.aoBuscar(texto, agruparReceitasDeSeries(filtrarReceitasDeSeries(receitas, texto, config), config).map((s) => s.chave)); };
  // Sequência e composição de cada receita, calculadas uma vez por lista (os uids de leitura nascem aqui, não vão ao plano).
  const leituras = useMemo(() => new Map(receitas.map((r) => [r.id, { pecas: pecasDaReceita(r.conteudo, config), composicao: composicaoDaReceita(r.conteudo, config), quantas: seriesDaReceita(r.conteudo).length }])), [receitas, config]);
  const nomeDaColecao = useMemo(() => new Map((colecoes.dados ?? []).map((c) => [c.id, c.nome])), [colecoes.dados]);
  const filtradas = filtrarReceitasDeSeries(receitas, busca, config);
  const secoes = agruparReceitasDeSeries(filtradas, config);
  return (
    <View style={estilos.lista}>
      <Campo rotulo="Buscar receita" valor={busca} aoMudar={buscar} placeholder="Nome, tipo ou técnica (ex.: back off, cluster)" autoCorrect={false} />
      {filtradas.length === 0 ? <Vazio texto="Nenhuma receita com essa busca." /> : null}
      {secoes.map((secao) => {
        const aberto = abertas.estaAberta(secao.chave);
        return (
          <Cartao key={secao.chave} cabecalho={<CabecalhoDeGrupo titulo={secao.titulo} resumo={quantasReceitas(secao.receitas.length)} aberto={aberto} aoAlternar={() => abertas.alternar(secao.chave)} acoesJuntas />}>
            {aberto ? (
              <View style={estilos.lista}>
                {secao.receitas.map((r) => (
                  <CartaoDaReceita
                    key={r.id}
                    receita={r}
                    leitura={leituras.get(r.id)}
                    colecao={colecoes.dados ? (r.pastaId ? nomeDaColecao.get(r.pastaId) : null) ?? 'Sem coleção' : null}
                    seriesAtuais={seriesAtuais}
                    aoUsar={aoUsar}
                  />
                ))}
              </View>
            ) : null}
          </Cartao>
        );
      })}
    </View>
  );
}

function CartaoDaReceita({ receita: r, leitura, colecao, seriesAtuais, aoUsar }: {
  receita: Receita;
  leitura?: { pecas: PecaDaReceita[]; composicao: string; quantas: number };
  /** Nome da coleção da receita; `null` sem as coleções (a linha some). */
  colecao: string | null;
  seriesAtuais: number;
  aoUsar: (r: Receita, modo: ModoDaReceita) => void;
}) {
  const { cores } = useTema();
  const pecas = leitura?.pecas ?? [];
  const motivo = seriesAtuais > 0 ? motivoParaAcrescentar(seriesAtuais, leitura?.quantas ?? 0) : undefined;
  return (
    <View style={[estilos.receita, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Texto variante="subtitulo">{r.nome}</Texto>
      <Texto variante="suave" numerico>{leitura?.composicao || 'Sem séries'}</Texto>
      {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      {pecas.length ? (
        <View style={estilos.sequencia} accessibilityLabel={`Sequência de ${r.nome}: ${pecas.map((p) => p.texto).join('; ')}`}>
          <Texto variante="rotulo">Sequência</Texto>
          {pecas.map((p, i) => <PecaDaSequencia key={i} peca={p} />)}
        </View>
      ) : null}
      {colecao ? <Texto variante="pequeno">Coleção: {colecao}</Texto> : null}
      {/* Os botões dizem o que acontece com as séries de agora; o editor oferece "Desfazer" depois dos dois. */}
      <View style={estilos.aplicar}>
        {seriesAtuais > 0 ? <>
          <Botao rotulo="Substituir as séries" rotuloAcessivel={`Substituir as séries por ${r.nome}`} tipo="secundario" Icone={Replace} aoTocar={() => aoUsar(r, 'substituir')} />
          <Botao rotulo="Acrescentar ao fim" rotuloAcessivel={`Acrescentar ao fim as séries de ${r.nome}`} tipo="secundario" Icone={ListPlus}
            desabilitado={!!motivo} motivo={motivo} aoTocar={() => aoUsar(r, 'acrescentar')} />
        </> : <Botao rotulo="Aplicar receita" rotuloAcessivel={`Aplicar receita ${r.nome}`} tipo="secundario" aoTocar={() => aoUsar(r, 'substituir')} />}
      </View>
    </View>
  );
}

/**
 * Um trecho da sequência: barra e selo na cor do tipo (Frente G, D9 a D11; tipo sem cor fica neutro) e o texto do grupo.
 * A cor nunca é a única informação: o selo diz o nome do tipo e o texto repete a prescrição (D7).
 */
function PecaDaSequencia({ peca }: { peca: PecaDaReceita }) {
  const { cores, identificacao } = useTema();
  const cor = peca.cor ? identificacao[peca.cor] : null;
  return (
    <View style={[estilos.peca, { borderColor: cores.borda, borderLeftColor: cor?.cor ?? cores.bordaCampo, backgroundColor: cores.superficie }]}>
      <View style={[estilos.seloDoTipo, { borderColor: cor?.cor ?? cores.bordaCampo, backgroundColor: cor?.fundo ?? cores.superficie3 }]}>
        <Texto numerico cor={cor?.cor ?? cores.texto} style={estilos.textoDoSelo}>{peca.nomeDoTipo}</Texto>
      </View>
      <Texto numerico style={estilos.textoDaPeca}>{peca.texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  receita: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
  sequencia: { gap: espaco(0.75), marginTop: espaco(0.25) },
  peca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderLeftWidth: 4, borderRadius: 6, paddingVertical: espaco(0.5), paddingHorizontal: espaco(1) },
  seloDoTipo: { borderWidth: 1, borderRadius: 999, paddingHorizontal: espaco(1), paddingVertical: 1 },
  textoDoSelo: { fontFamily: fontes.negrito, fontSize: 12, lineHeight: 16 },
  textoDaPeca: { flexShrink: 1, flexGrow: 1, flexBasis: 160 },
  aplicar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'flex-end', gap: espaco(1), marginTop: espaco(0.5) },
});
