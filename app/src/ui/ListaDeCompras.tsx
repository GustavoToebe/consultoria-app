import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../api/tipos';
import {
  detalheDaConversao,
  PERIODOS_DA_LISTA,
  escolhasDaLista,
  quantidadeParaTela,
  textoDasDuzias,
  textoDoPeriodo,
  type EscolhasDeOpcao,
  type LinhaDaLista,
  type PeriodoDaLista,
} from '../dominio/listaDeCompras';
import { agruparLista, contagemDoGrupo } from '../dominio/gruposDaLista';
import { textoDosDiasCurtos } from '../dominio/variacoesDaDieta';
import { espaco, fontes } from '../tema/tokens';
import { Alvenaria } from './Alvenaria';
import { Escolha } from './Escolha';
import { Vazio } from './Estados';
import { LinhaDeCompra } from './LinhaDeCompra';
import { ListaDeLinhas } from './LinhaDaLista';
import { Texto } from './Texto';

// "30 dias": o rótulo diz a conta, para ninguém ler o mês do calendário (reunião de 29/10; "7 dias · 14 dias · 30 dias" desde 25/11).
const PERIODOS = PERIODOS_DA_LISTA.map((valor) => ({ valor, rotulo: textoDoPeriodo(valor) }));

/** A lista de uma variação só (PDF de uma variação) diz qual e os dias dela; com várias, a conta de cada uma. */
export function textoDasVariacoes(conteudo: ConteudoDieta): string | null {
  const variacoes = conteudo.variacoes;
  if (variacoes.length === 1) return `Lista da variação ${variacoes[0].rotulo.trim() || 'sem nome'}, que vale em ${textoDosDiasCurtos(variacoes[0].dias)}.`;
  return variacoes.length > 1 ? 'Cada variação entra pelo número de dias dela na semana.' : null;
}

/** O segmento "7 dias · 14 dias · 30 dias". */
export function EscolhaDoPeriodo({ periodo, aoMudar }: { periodo: PeriodoDaLista; aoMudar: (periodo: PeriodoDaLista) => void }) {
  return <Escolha descricao="Período da lista" opcoes={PERIODOS} valor={periodo} aoMudar={aoMudar} />;
}

/** Nas refeições com mais de uma opção, qual entra na lista (nada quando nenhuma tem). */
export function OpcoesDaLista({ conteudo, escolhas, aoMudarEscolhas }: {
  conteudo: ConteudoDieta;
  escolhas: EscolhasDeOpcao;
  aoMudarEscolhas: (escolhas: EscolhasDeOpcao) => void;
}) {
  const comEscolha = escolhasDaLista(conteudo);
  if (!comEscolha.length) return null;
  const opcaoDe = (r: (typeof comEscolha)[number]['refeicao']) => r.opcoes.find((o) => o.uid === escolhas[r.uid]) ?? r.opcoes[0];
  return (
    <View style={estilos.opcoes}>
      <Texto variante="suave">Nas refeições com mais de uma opção, escolha a que vai comprar. A lista soma só a opção escolhida de cada refeição.</Texto>
      {comEscolha.map(({ refeicao: r, variacao }) => (
        <Escolha
          key={r.uid}
          rotulo={`${variacao ? `${variacao} · ` : ''}${r.horario ? `${r.horario} · ` : ''}${r.nome || 'Refeição'}`}
          opcoes={r.opcoes.map((o) => ({ valor: o.uid, rotulo: `Opção ${o.rotulo}` }))}
          valor={opcaoDe(r)?.uid ?? ''}
          aoMudar={(uid) => aoMudarEscolhas({ ...escolhas, [r.uid]: uid })}
        />
      ))}
    </View>
  );
}

/** Período e, quando a refeição tem mais de uma opção, qual entra na lista. O aluno e a folha do PDF da dieta usam isto. */
export function EscolhasDaLista({
  conteudo,
  periodo,
  aoMudarPeriodo,
  escolhas,
  aoMudarEscolhas,
}: {
  conteudo: ConteudoDieta;
  periodo: PeriodoDaLista;
  aoMudarPeriodo: (periodo: PeriodoDaLista) => void;
  escolhas: EscolhasDeOpcao;
  aoMudarEscolhas: (escolhas: EscolhasDeOpcao) => void;
}) {
  const variacoes = textoDasVariacoes(conteudo);
  return (
    <>
      {variacoes ? <Texto variante="suave">{variacoes}</Texto> : null}
      <EscolhaDoPeriodo periodo={periodo} aoMudar={aoMudarPeriodo} />
      <OpcoesDaLista conteudo={conteudo} escolhas={escolhas} aoMudarEscolhas={aoMudarEscolhas} />
    </>
  );
}

/** O que o PDF precisa da escolha feita na tela. */
export interface EscolhaDaLista {
  periodo: PeriodoDaLista;
  /** "Café da manhã: opção B" para cada refeição com mais de uma opção. */
  opcoes: string[];
  linhas: LinhaDaLista[];
}

/** Abaixo disto (largura medida da lista, não da janela) os grupos ficam numa coluna só: no celular e na folha estreita. */
const LARGURA_DAS_DUAS_COLUNAS = 640;

/**
 * Os itens da prévia do treinador (26/11), já calculados por quem chama: um título de seção por grupo do alimento
 * (`agruparLista`: catálogo na ordem do mercado, grupos do treinador depois, "Outros itens" por último), com a contagem
 * em secundário, sem cartão nem faixa; os itens em linhas com divisória (`ui/LinhaDeCompra`, a mesma do aluno, sem a
 * caixa). A partir de 640 px de lista, os grupos vão em duas colunas equilibradas (`Alvenaria`, cada um na coluna mais
 * baixa, na ordem de hoje; o Tab e o leitor seguem a ordem lógica). À direita de cada linha, o que comprar: a quantidade
 * em negrito e números tabulares, "cru" e o equivalente em dúzias do ovo em secundário.
 */
export function ListaDeCompras({ linhas }: { linhas: readonly LinhaDaLista[] }) {
  if (!linhas.length) return <Vazio titulo="Nada para listar" texto="A dieta não tem itens com quantidade." />;
  const grupos = agruparLista([...linhas], (l) => l.grupo);
  return (
    <Alvenaria
      colunas={(largura) => (largura >= LARGURA_DAS_DUAS_COLUNAS ? 2 : 1)}
      vao={espaco(3)}
      pecas={grupos.map((g) => ({
        chave: g.chave,
        peso: g.itens.length + 1,
        conteudo: (
          <View style={estilos.grupo}>
            <View style={estilos.tituloDoGrupo}>
              <Texto variante="bloco" nivel={3} style={estilos.encolhe}>{g.titulo}</Texto>
              <Texto variante="suave" numerico>{contagemDoGrupo(g.itens.length)}</Texto>
            </View>
            <ListaDeLinhas divisorias>
              {g.itens.map((l) => <LinhaDaPrevia key={l.chave} linha={l} />)}
            </ListaDeLinhas>
          </View>
        ),
      }))}
    />
  );
}

function LinhaDaPrevia({ linha: l }: { linha: LinhaDaLista }) {
  const duzias = textoDasDuzias(l);
  const complemento = l.cru ? ' cru' : duzias ? ` · ${duzias}` : '';
  return (
    <LinhaDeCompra
      nome={l.nome}
      linhasDoNome={2}
      detalhe={detalheDaConversao(l)}
      quantidade={(
        <Texto numerico style={estilos.quantidade}>
          {quantidadeParaTela(l.quantidade, l.unidade)}
          {complemento ? <Texto variante="suave">{complemento}</Texto> : null}
        </Texto>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  tituloDoGrupo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1) },
  encolhe: { flexShrink: 1 },
  quantidade: { fontFamily: fontes.semi, textAlign: 'right' },
  opcoes: { gap: espaco(1.5), paddingTop: espaco(1) },
});
