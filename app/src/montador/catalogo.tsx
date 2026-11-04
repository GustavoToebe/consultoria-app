import type { Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DEFINICOES_DE_BLOCO,
  lerPontosDoGrafico,
  lerSelosDoTexto,
  TIPOS_DE_BLOCO,
  type AlturaPecaNova,
  type DefinicaoDeBloco,
  type TipoBotaoMontador,
  type TipoDeBloco,
} from '../dominio/montador';
import { useTema } from '../tema/TemaProvider';
import { BORDA_BLOCO, espaco, RAIO, tingido } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Campo } from '../ui/Campo';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Alerta, type TomDoAlerta } from '../ui/Estados';
import { FaixaDeChips } from '../ui/FaixaDeChips';
import { Grade } from '../ui/Grade';
import { GraficoLinha } from '../ui/GraficoLinha';
import { ItemDeLista } from '../ui/ItemDeLista';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../ui/Tabela';
import { Texto, type Variante } from '../ui/Texto';

export interface TipoNoCatalogo extends DefinicaoDeBloco {
  desenhar(props: Record<string, unknown>, filhos: ReactNode): ReactNode;
}

function AbasControladas({ rotulos, ativaInicial }: { rotulos: string[]; ativaInicial: string }) {
  const opcoes = (rotulos.length > 0 ? rotulos : ['Aba 1']).map((r) => ({ valor: r, rotulo: r }));
  const padrao = opcoes.some((o) => o.valor === ativaInicial) ? ativaInicial : opcoes[0].valor;
  const [ativa, setAtiva] = useState(padrao);
  return <Abas abas={opcoes} ativa={ativa} aoMudar={setAtiva} />;
}

function CampoControlado({
  rotulo,
  valorInicial,
  ajuda,
  erro,
  linhas,
}: {
  rotulo: string;
  valorInicial: string;
  ajuda?: string;
  erro?: string;
  linhas?: number;
}) {
  const [valor, setValor] = useState(valorInicial);
  return (
    <Campo
      rotulo={rotulo}
      valor={valor}
      aoMudar={setValor}
      ajuda={ajuda || undefined}
      erro={erro || undefined}
      linhas={linhas && linhas > 1 ? linhas : undefined}
    />
  );
}

function EscolhaControlada({
  rotulo,
  rotulos,
  selecionadaInicial,
}: {
  rotulo?: string;
  rotulos: string[];
  selecionadaInicial: string;
}) {
  const opcoes = (rotulos.length > 0 ? rotulos : ['Opção 1']).map((r) => ({ valor: r, rotulo: r }));
  const padrao = opcoes.some((o) => o.valor === selecionadaInicial) ? selecionadaInicial : opcoes[0].valor;
  const [valor, setValor] = useState(padrao);
  return <Escolha rotulo={rotulo || undefined} descricao={rotulo || 'Escolha'} opcoes={opcoes} valor={valor} aoMudar={setValor} />;
}

function InterruptorControlado({ rotulo, ligadoInicial }: { rotulo: string; ligadoInicial: boolean }) {
  const [ligado, setLigado] = useState(ligadoInicial);
  return <Interruptor rotulo={rotulo} valor={ligado} aoMudar={setLigado} />;
}

function ChipsControlados({ rotulos }: { rotulos: string[] }) {
  const opcoes = (rotulos.length > 0 ? rotulos : ['Chip']).map((r) => ({ valor: r, rotulo: r }));
  const [valor, setValor] = useState(opcoes[0].valor);
  return (
    <FaixaDeChips quebrar>
      <Escolha compacta descricao="Chips" opcoes={opcoes} valor={valor} aoMudar={setValor} />
    </FaixaDeChips>
  );
}

function CaixaAnotacao({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View
      style={[
        estilos.rascunho,
        {
          borderColor: cores.atencao,
          backgroundColor: tingido(cores.atencao, cores.superficie),
        },
      ]}
    >
      <Texto variante="secao" cor={cores.atencao}>
        Anotação de rascunho
      </Texto>
      <Texto cor={cores.atencao}>{texto || '—'}</Texto>
    </View>
  );
}

const ALTURA_PECA: Record<AlturaPecaNova, number> = { P: 72, M: 128, G: 200 };

function CaixaPecaNova({ nome, descricao, altura }: { nome: string; descricao: string; altura: AlturaPecaNova }) {
  const { cores } = useTema();
  const minHeight = ALTURA_PECA[altura] ?? ALTURA_PECA.M;
  return (
    <View
      style={[
        estilos.rascunho,
        {
          minHeight,
          borderColor: cores.neutro,
          backgroundColor: tingido(cores.neutro, cores.superficie),
        },
      ]}
    >
      <Texto variante="bloco" cor={cores.texto}>
        {`Peça nova: ${nome || 'Sem nome'}`}
      </Texto>
      {descricao ? <Texto variante="suave">{descricao}</Texto> : null}
    </View>
  );
}

function linhasDeTexto(bruto: unknown): string[] {
  return String(bruto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const DESENHADORES: Record<TipoDeBloco, (props: Record<string, unknown>, filhos: ReactNode) => ReactNode> = {
  cabecalho: (props) => (
    <Cabecalho
      titulo={String(props.titulo ?? '') || undefined}
      subtitulo={String(props.subtitulo ?? '') || undefined}
    />
  ),
  cartao: (props, filhos) => (
    <Cartao
      titulo={String(props.titulo ?? '') || undefined}
      descricao={String(props.descricao ?? '') || undefined}
      recolhivel={Boolean(props.recolhivel)}
      faixa={props.faixa !== false}
    >
      {filhos}
    </Cartao>
  ),
  faixaDeGrupo: (props) => (
    <CabecalhoDeGrupo
      titulo={String(props.titulo ?? 'Grupo')}
      resumo={String(props.resumo ?? '') || undefined}
      linha={props.linha === 'fina' ? 'fina' : 'forte'}
    />
  ),
  grade: (_props, filhos) => <Grade>{filhos}</Grade>,
  abas: (props) => {
    const rotulos = linhasDeTexto(props.abas);
    const ativa = String(props.ativa ?? '');
    return <AbasControladas key={`${rotulos.join('|')}::${ativa}`} rotulos={rotulos} ativaInicial={ativa} />;
  },
  texto: (props) => {
    const nivelBruto = String(props.nivel ?? 'nenhum');
    const nivel = nivelBruto === '1' ? 1 : nivelBruto === '2' ? 2 : nivelBruto === '3' ? 3 : undefined;
    return (
      <Texto variante={(props.variante as Variante) ?? 'corpo'} nivel={nivel}>
        {String(props.texto ?? '')}
      </Texto>
    );
  },
  listaDeLinhas: (props, filhos) => <ListaDeLinhas emColunas={Boolean(props.emColunas)}>{filhos}</ListaDeLinhas>,
  linha: (props) => {
    const selos = lerSelosDoTexto(String(props.selos ?? ''));
    return (
      <LinhaDaLista
        titulo={String(props.titulo ?? 'Item')}
        metadados={String(props.metadados ?? '') || undefined}
        descricao={String(props.descricao ?? '') || undefined}
        selos={selos.length > 0 ? selos : undefined}
        href={'/montador' as Href}
        aoAbrir={() => undefined}
      />
    );
  },
  itemDeLista: (props) => {
    const seloTexto = String(props.seloTexto ?? '').trim();
    const seloTipo = ((props.seloTipo as TipoSelo) ?? 'neutro');
    return (
      <ItemDeLista
        titulo={String(props.titulo ?? 'Item')}
        detalhe={String(props.detalhe ?? '') || undefined}
        selo={seloTexto ? { texto: seloTexto, tipo: seloTipo } : undefined}
        aoTocar={() => undefined}
      />
    );
  },
  tabela: (props) => {
    const titulos = linhasDeTexto(props.colunas);
    const colunasValidas = titulos.length > 0 ? titulos : ['Coluna'];
    const colunas: ColunaDaTabela<{ id: string; celulas: string[] }>[] = colunasValidas.map((titulo, idx) => ({
      chave: `col-${idx}`,
      titulo,
      principal: idx === 0,
      render: (linha) => <Texto>{linha.celulas[idx]?.trim() || '—'}</Texto>,
    }));
    const linhas = linhasDeTexto(props.linhas).map((l, idx) => ({
      id: `linha-${idx}`,
      celulas: l.split(';'),
    }));
    return <Tabela colunas={colunas} linhas={linhas} chave={(l) => l.id} rotulo="Tabela do rascunho" />;
  },
  campo: (props) => {
    const valorInicial = String(props.valor ?? '');
    const linhas = typeof props.linhas === 'number' ? props.linhas : 1;
    return (
      <CampoControlado
        key={`${valorInicial}::${linhas}`}
        rotulo={String(props.rotulo ?? 'Campo')}
        valorInicial={valorInicial}
        ajuda={String(props.ajuda ?? '')}
        erro={String(props.erro ?? '')}
        linhas={linhas}
      />
    );
  },
  campoLeitura: (props) => (
    <CampoLeitura rotulo={String(props.rotulo ?? 'Campo')} valor={String(props.valor ?? '')} />
  ),
  escolha: (props) => {
    const rotulos = linhasDeTexto(props.opcoes);
    const selecionada = String(props.selecionada ?? '');
    return (
      <EscolhaControlada
        key={`${rotulos.join('|')}::${selecionada}`}
        rotulo={String(props.rotulo ?? '')}
        rotulos={rotulos}
        selecionadaInicial={selecionada}
      />
    );
  },
  interruptor: (props) => {
    const ligado = Boolean(props.ligado);
    return <InterruptorControlado key={String(ligado)} rotulo={String(props.rotulo ?? 'Opção')} ligadoInicial={ligado} />;
  },
  botao: (props) => (
    <Botao
      rotulo={String(props.rotulo ?? 'Botão')}
      tipo={(props.tipo as TipoBotaoMontador) ?? 'primario'}
      desabilitado={Boolean(props.desabilitado)}
      motivo={String(props.motivo ?? '') || undefined}
      cheio={Boolean(props.cheio)}
      aoTocar={() => undefined}
    />
  ),
  linhaDeBotoes: (_props, filhos) => <LinhaDeAcoes>{filhos}</LinhaDeAcoes>,
  selo: (props) => <Selo texto={String(props.texto ?? 'Selo')} tipo={(props.tipo as TipoSelo) ?? 'neutro'} />,
  alerta: (props) => (
    <Alerta
      tom={(props.tom as TomDoAlerta) ?? 'atencao'}
      titulo={String(props.titulo ?? '') || undefined}
      texto={String(props.texto ?? '') || undefined}
    />
  ),
  barraProgresso: (props) => (
    <BarraProgresso feitas={Number(props.feitas ?? 0)} total={Number(props.total ?? 1)} />
  ),
  graficoLinha: (props) => {
    const pontos = lerPontosDoGrafico(String(props.pontos ?? ''));
    const unidade = String(props.unidade ?? 'kg');
    if (pontos.length === 0) {
      return <Texto variante="suave">Informe ao menos um ponto no formato data;valor.</Texto>;
    }
    return <GraficoLinha pontos={pontos} unidade={unidade} descricao={`Gráfico em ${unidade}`} />;
  },
  chips: (props) => {
    const rotulos = linhasDeTexto(props.rotulos);
    return <ChipsControlados key={rotulos.join('|')} rotulos={rotulos} />;
  },
  anotacao: (props) => <CaixaAnotacao texto={String(props.texto ?? '')} />,
  pecaNova: (props) => (
    <CaixaPecaNova
      nome={String(props.nome ?? '')}
      descricao={String(props.descricao ?? '')}
      altura={(props.altura as AlturaPecaNova) ?? 'M'}
    />
  ),
};

export const CATALOGO_MONTADOR: Record<TipoDeBloco, TipoNoCatalogo> = Object.fromEntries(
  TIPOS_DE_BLOCO.map((tipo) => [
    tipo,
    {
      ...DEFINICOES_DE_BLOCO[tipo],
      desenhar: DESENHADORES[tipo],
    },
  ]),
) as Record<TipoDeBloco, TipoNoCatalogo>;

export const LISTA_DO_CATALOGO: readonly TipoNoCatalogo[] = TIPOS_DE_BLOCO.map((t) => CATALOGO_MONTADOR[t]);

const estilos = StyleSheet.create({
  rascunho: {
    borderWidth: BORDA_BLOCO,
    borderStyle: 'dashed',
    borderRadius: RAIO,
    padding: espaco(2),
    gap: espaco(0.75),
    justifyContent: 'center',
  },
});
