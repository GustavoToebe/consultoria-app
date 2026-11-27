import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type {
  Atualizacao, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, SecaoAtualizacao,
} from '../../api/tipos';
import {
  arranjoDaLeitura, linhaDaMediaDeTreino, NAO_RESPONDEU, NAO_SE_APLICA, notasPorDiaEmTabela, RESPIRO_DA_LEITURA, respostaLida,
  textoDasPerguntas, type RespostaLida,
} from '../../dominio/atualizacaoQuestionario';
import { avaliarRespostas } from '../../dominio/respostasAtualizacao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_MENU_LATERAL, LARGURA_TEXTO_CORRIDO, RAIO } from '../../tema/tokens';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { CampoFotos } from './fotos/CampoFotos';
import { ImagemDaPergunta } from './ImagemDaPergunta';
import { OpcoesComImagem } from './OpcoesComImagem';

interface Props {
  modelo: ConteudoQuestionario;
  respostas: RespostasAtualizacao;
  dataAtualizacao?: string | null;
  resumo?: Atualizacao['resumo'];
  carregarFotoDaEquipe?: (fotoId: string) => Promise<Blob>;
}

/**
 * Leitura das respostas (bloco B de `docs/planos/atualizacao-pasta-e-questionarios.md`; medidas na 2.1 de
 * `orientacoes-de-design-26-11.md`), a mesma para o aluno e a equipe (atualização, anamnese e inscrição já enviadas):
 * cada seção é um cartão com o título na faixa e "N perguntas" à direita; cada pergunta, uma linha da `ui/ListaDeDados`
 * com o `arranjo` da leitura (`dominio/atualizacaoQuestionario.arranjoDaLeitura`): cartão abaixo de 760, pergunta em cima
 * e resposta embaixo; a partir dele, pergunta à esquerda em 40% até 320; 12 até o fio. Fotos (miniaturas que abrem) e
 * texto informativo não cabem num par: interrompem a lista entre dois fios.
 */
export function LeituraDasRespostas({ modelo, respostas, dataAtualizacao, resumo, carregarFotoDaEquipe }: Props) {
  const { escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas, true);
  const media = linhaDaMediaDeTreino(resumo);
  return <>
    {media ? <Texto variante="suave" numerico>{media}</Texto> : null}
    {modelo.secoes.map((secao, si) => {
      const escondida = secoesEscondidas.has(si);
      // Seção escondida: o motivo fica só no corpo (dizer "Não se aplica" também na faixa repetia a mensagem).
      return <Cartao key={secao.uid ?? `${si}:${secao.titulo}`}
        cabecalho={<CabecalhoDeGrupo titulo={secao.titulo}
          acoes={escondida ? undefined : <Texto variante="suave" numerico>{textoDasPerguntas(secao.perguntas)}</Texto>} />}>
        {escondida ? <Texto variante="suave">Seção que não se aplica, pelas respostas anteriores.</Texto> : <>
          <TextoFormatado texto={secao.descricao} />
          <PerguntasDaSecao secao={secao} respostas={respostas} escondidas={escondidas} dataAtualizacao={dataAtualizacao}
            carregarFotoDaEquipe={carregarFotoDaEquipe} />
        </>}
      </Cartao>;
    })}
  </>;
}

type Trecho = { tipo: 'linhas'; perguntas: { p: PerguntaAtualizacao; lida: RespostaLida | null }[] } | { tipo: 'bloco'; p: PerguntaAtualizacao; lida: RespostaLida };

/** As linhas seguidas vão numa lista só (uma decisão de arranjo para todas); fotos e informativo abrem um bloco entre listas. */
function PerguntasDaSecao({ secao, respostas, escondidas, dataAtualizacao, carregarFotoDaEquipe }: {
  secao: SecaoAtualizacao; respostas: RespostasAtualizacao; escondidas: ReadonlySet<string>; dataAtualizacao?: string | null;
  carregarFotoDaEquipe?: (fotoId: string) => Promise<Blob>;
}) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  // A lista mede a largura útil do cartão: o limite de 760 de cartão desconta o recuo do corpo (20 no PC, 16 no celular).
  const arranjo = arranjoDaLeitura(espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2));
  const trechos: Trecho[] = [];
  for (const p of secao.perguntas) {
    const lida = escondidas.has(p.id) ? null : respostaLida(p, respostas[p.id], dataAtualizacao);
    if (lida && (lida.forma === 'fotos' || lida.forma === 'informativo')) { trechos.push({ tipo: 'bloco', p, lida }); continue; }
    const ultimo = trechos[trechos.length - 1];
    if (ultimo?.tipo === 'linhas') ultimo.perguntas.push({ p, lida }); else trechos.push({ tipo: 'linhas', perguntas: [{ p, lida }] });
  }
  return <View>
    {trechos.map((t, i) => {
      if (t.tipo === 'linhas') {
        return <ListaDeDados key={t.perguntas[0].p.id} arranjo={arranjo}>
          {t.perguntas.map(({ p, lida }) => <LinhaLida key={p.id} p={p} valor={respostas[p.id] ?? null} lida={lida} />)}
        </ListaDeDados>;
      }
      // A última linha de uma lista fica sem fio: o bloco põe o dele em cima e, antes de outra lista, embaixo.
      const fio = { borderColor: cores.divisor, borderTopWidth: i > 0 ? 1 : 0, borderBottomWidth: trechos[i + 1]?.tipo === 'linhas' ? 1 : 0 };
      return <View key={t.p.id} style={[estilos.bloco, fio]}>
        {t.lida.forma === 'fotos'
          ? <CampoFotos pergunta={t.p} valor={respostas[t.p.id] ?? null} carregarDaEquipe={carregarFotoDaEquipe} rotulo={t.p.rotulo} respondendo={false} />
          : <>
            <Texto variante="secao" nivel={3}>{t.p.rotulo}</Texto>
            <TextoFormatado texto={t.p.texto} />
            {t.p.imagemId ? <ImagemDaPergunta id={t.p.imagemId} descricao={`Imagem da pergunta: ${t.p.rotulo}`} /> : null}
          </>}
      </View>;
    })}
  </View>;
}

/**
 * Uma pergunta numa `LinhaDeDado`. `lida` nula = escondida pela condição. O `valor` é também o nome do par para o leitor de
 * tela ("Pergunta: resposta"); sem valor, a peça mostra o `vazio` em texto suave.
 */
function LinhaLida({ p, valor, lida }: { p: PerguntaAtualizacao; valor: RespostaAtualizacao; lida: RespostaLida | null }) {
  const nota: ReactNode = p.tipo === 'ACEITE' && p.texto?.trim() ? <TextoFormatado texto={p.texto} variante="suave" /> : null;
  if (!lida) return <LinhaDeDado rotulo={p.rotulo} valor={null} vazio={NAO_SE_APLICA} />;
  switch (lida.forma) {
    case 'vazia': return <LinhaDeDado rotulo={p.rotulo} valor={null} vazio={NAO_RESPONDEU} nota={nota} />;
    case 'desconhecida': return <LinhaDeDado rotulo={p.rotulo} valor={null} vazio="Atualize o app para ver esta resposta." />;
    // Resposta longa respeita a largura de leitura dentro da coluna.
    case 'texto': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota}
      conteudo={<Texto numerico={lida.numerico} style={estilos.textoCorrido}>{lida.texto}</Texto>} />;
    case 'nota': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={lida.escala ?? undefined}
      conteudo={<Texto style={estilos.nota}>{lida.nota}</Texto>} />;
    // Sim/Não no texto normal da resposta: nunca mais fraco que a pergunta.
    case 'simNao': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota} />;
    case 'notasPorDia': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota} conteudo={<NotasPorDia dias={lida.dias} />} />;
    // Um item por bloco: o nome em texto normal e, embaixo, rótulo e motivo em texto suave (em 390 o motivo longo quebrava no meio da linha).
    case 'itens': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota} conteudo={<View style={estilos.itensLidos}>
      {lida.itens.map((i) => <View key={i.id} style={estilos.itemLido}>
        <Texto style={estilos.textoCorrido}>{i.nome}</Texto>
        {i.motivo ? <Texto variante="suave" style={estilos.textoCorrido}>{`${lida.rotuloDoMotivo} ${i.motivo}`}</Texto> : null}
      </View>)}
    </View>} />;
    case 'grade': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota} conteudo={<GradeLida linhas={lida.linhas} />} />;
    case 'opcoesComImagem': return <LinhaDeDado rotulo={p.rotulo} valor={lida.texto} nota={nota} conteudo={<OpcoesComImagem p={p} valor={valor} />} />;
    // Fotos e informativo viram bloco antes de chegar aqui.
    case 'fotos':
    case 'informativo': return null;
    default: {
      const semCaso: never = lida;
      return semCaso;
    }
  }
}

/** Até 6 dias, chips neutros "Dia 1 · 8" que quebram linha; com 7 ou mais, uma tabelinha de uma linha que rola dentro do cartão. */
function NotasPorDia({ dias }: { dias: { dia: number; nota: string }[] }) {
  const { cores } = useTema();
  const nota = (n: string) => <Texto style={estilos.notaDoDia} cor={n === '—' ? cores.textoSuave : undefined}>{n}</Texto>;
  if (notasPorDiaEmTabela(dias.length)) {
    // `alignSelf: stretch` no próprio ScrollView: sem ele, cresceria até o conteúdo e vazaria o cartão.
    return <ScrollView horizontal showsHorizontalScrollIndicator style={estilos.rolagem} contentContainerStyle={[estilos.tabela, { borderColor: cores.divisor }]}>
      {dias.map((d, i) => <View key={d.dia} style={[estilos.celula, i > 0 && { borderLeftWidth: 1, borderLeftColor: cores.divisor }]}>
        <Texto variante="pequeno">{`Dia ${d.dia}`}</Texto>{nota(d.nota)}
      </View>)}
    </ScrollView>;
  }
  return <View style={estilos.chips}>
    {dias.map((d) => <View key={d.dia} style={[estilos.chip, { borderColor: cores.divisor, backgroundColor: cores.superficie2 }]}>
      <Texto variante="pequeno">{`Dia ${d.dia} ·`}</Texto>{nota(d.nota)}
    </View>)}
  </View>;
}

/** GRADE: uma linha por item, com a coluna escolhida à direita (ou "—"). */
function GradeLida({ linhas }: { linhas: { id: string; linha: string; resposta: string }[] }) {
  const { cores } = useTema();
  return <View style={[estilos.grade, { borderColor: cores.divisor }]}>
    {linhas.map((l, i) => <View key={l.id} style={[estilos.itemDaGrade, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
      <Texto style={estilos.itemRotulo}>{l.linha}</Texto>
      <Texto style={estilos.itemValor} cor={l.resposta === '—' ? cores.textoSuave : undefined}>{l.resposta}</Texto>
    </View>)}
  </View>;
}

const estilos = StyleSheet.create({
  // O mesmo respiro das linhas da lista até o fio.
  bloco: { gap: espaco(1), paddingVertical: RESPIRO_DA_LEITURA },
  itensLidos: { gap: espaco(1) },
  itemLido: { gap: espaco(0.25) },
  textoCorrido: { maxWidth: LARGURA_TEXTO_CORRIDO },
  // A nota em destaque: 20, semibold, algarismos tabulares.
  nota: { fontFamily: fontes.semi, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  notaDoDia: { fontFamily: fontes.semi, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.5), borderWidth: 1, borderRadius: 999, paddingVertical: espaco(0.5), paddingHorizontal: espaco(1.25) },
  rolagem: { alignSelf: 'stretch', maxWidth: '100%' },
  tabela: { flexDirection: 'row', borderWidth: 1, borderRadius: RAIO },
  celula: { minWidth: 56, alignItems: 'center', paddingVertical: espaco(0.75), paddingHorizontal: espaco(1) },
  grade: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden', alignSelf: 'stretch' },
  itemDaGrade: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  itemRotulo: { flex: 1 },
  itemValor: { flexShrink: 0, maxWidth: '50%', textAlign: 'right', fontFamily: fontes.semi },
});
