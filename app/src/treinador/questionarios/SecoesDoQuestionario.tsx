import { ArrowDown, ArrowUp, ChevronsDownUp, ChevronsUpDown, Copy, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, FinalidadeQuestionario, PerguntaAtualizacao, TipoPergunta } from '../../api/tipos';
import {
  adicionarPergunta, adicionarSecao, alterarCondicaoDaSecao, alterarPergunta, alterarSecao, duplicarPerguntaNaSecao, moverParaSecao, moverPergunta, moverSecao,
  novaPergunta, podeAdicionar, podeAdicionarSecao, podeDuplicar, removerPergunta, removerSecao, ROTULO_DO_TIPO, textoDaCondicao, tiposParaAdicionar,
  type ProblemasAgrupados,
} from '../../dominio/editorQuestionario';
import { LIMITES_QUESTIONARIO as L } from '../../dominio/questionario';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { EditorDeCondicao, PropriedadesDaPergunta } from './PropriedadesDaPergunta';

type Alvo = { secao: number; pergunta: number };

interface Props {
  conteudo: ConteudoQuestionario;
  aoMudar: (mudanca: (c: ConteudoQuestionario) => ConteudoQuestionario) => void;
  /** Ids das perguntas abertas; o pai guarda para poder abrir a que tem problema. */
  abertas: ReadonlySet<string>;
  aoAlternar: (id: string) => void;
  aoAlternarTodas: () => void;
  aoAbrir: (id: string) => void;
  problemas: ProblemasAgrupados;
  somenteLeitura?: boolean;
  finalidade?: FinalidadeQuestionario;
}

/**
 * Seções e perguntas do questionário (molde: `SecoesDeMobilidade`). Cada pergunta é um cartão recolhível, como o
 * exercício no treino; PESO e Data só uma vez. Nada é salvo aqui: o pai guarda o rascunho.
 */
export function SecoesDoQuestionario({ conteudo: c, aoMudar, abertas, aoAlternar, aoAlternarTodas, aoAbrir, problemas, somenteLeitura, finalidade = 'ATUALIZACAO' }: Props) {
  const { cores } = useTema();
  const [adicionarEm, setAdicionarEm] = useState<number | null>(null);
  const [removerPerguntaDe, setRemoverPerguntaDe] = useState<Alvo | null>(null);
  const [removerSecaoN, setRemoverSecaoN] = useState<number | null>(null);
  const todasAbertas = c.secoes.length > 0 && c.secoes.every((s) => s.perguntas.every((p) => abertas.has(p.id)));
  const perguntaARemover = removerPerguntaDe ? c.secoes[removerPerguntaDe.secao]?.perguntas[removerPerguntaDe.pergunta] : undefined;
  const secaoARemover = removerSecaoN === null ? undefined : c.secoes[removerSecaoN];
  const novaSecaoPermissao = podeAdicionarSecao(c);

  const adicionar = (secao: number, tipo: TipoPergunta) => {
    const nova = novaPergunta(tipo);
    aoMudar((atual) => adicionarPergunta(atual, secao, nova));
    aoAbrir(nova.id);
    setAdicionarEm(null);
  };

  return <>
    {c.secoes.length > 0 && c.secoes.some((s) => s.perguntas.length > 0) ? <LinhaDeAcoes alinhar="fim">
      <Botao rotulo={todasAbertas ? 'Fechar todas' : 'Abrir todas'} tipo="fantasma" Icone={todasAbertas ? ChevronsDownUp : ChevronsUpDown} aoTocar={aoAlternarTodas} />
    </LinhaDeAcoes> : null}
    {c.secoes.map((sec, si) => <Cartao key={sec.uid ?? si} titulo={sec.titulo || `Seção ${si + 1}`}
      acoes={somenteLeitura ? undefined : <View style={estilos.setas}>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir a seção ${si + 1}`} desabilitado={si === 0} aoTocar={() => aoMudar((x) => moverSecao(x, si, -1))} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer a seção ${si + 1}`} desabilitado={si === c.secoes.length - 1} aoTocar={() => aoMudar((x) => moverSecao(x, si, 1))} />
        <Botao rotulo="Remover seção" tipo="perigoTexto" Icone={Trash2} desabilitado={c.secoes.length <= 1} motivo="O questionário precisa de ao menos uma seção." aoTocar={() => setRemoverSecaoN(si)} />
      </View>}>
      {somenteLeitura ? null : <Campo rotulo="Título da seção" valor={sec.titulo} maxLength={L.tituloTamanho} erro={problemas.porSecao.get(si)?.join(' ')}
        aoMudar={(titulo) => aoMudar((x) => alterarSecao(x, si, titulo))} />}
      {somenteLeitura ? (sec.mostrarSe ? <Texto variante="pequeno">{textoDaCondicao(c, sec.mostrarSe)}</Texto> : null)
        : <EditorDeCondicao conteudo={c} secao={si} condicao={sec.mostrarSe} aoMudar={(m) => aoMudar((x) => alterarCondicaoDaSecao(x, si, m))} />}
      {sec.perguntas.length === 0 ? <Texto variante="suave">Seção sem pergunta. Adicione ao menos uma.</Texto> : null}
      {sec.perguntas.map((p, pi) => <CartaoDaPergunta key={p.id} pergunta={p} conteudo={c} posicao={pi} total={sec.perguntas.length}
        aberta={abertas.has(p.id)} problemas={problemas.porPergunta.get(p.id) ?? []} secoes={c.secoes.map((s, i) => ({ i, titulo: s.titulo || `Seção ${i + 1}` }))} secaoAtual={si}
        somenteLeitura={somenteLeitura} finalidade={finalidade} fundo={cores.superficie2} podeDuplicar={podeDuplicar(c, si, pi).pode}
        aoAlternar={() => aoAlternar(p.id)}
        aoMudar={(parcial) => aoMudar((x) => alterarPergunta(x, si, pi, parcial))}
        aoMover={(d) => aoMudar((x) => moverPergunta(x, si, pi, d))}
        aoDuplicar={() => aoMudar((x) => duplicarPerguntaNaSecao(x, si, pi))}
        aoMoverParaSecao={(para) => aoMudar((x) => moverParaSecao(x, { secao: si, pergunta: pi }, para))}
        aoRemover={() => setRemoverPerguntaDe({ secao: si, pergunta: pi })} />)}
      {somenteLeitura ? null : <LinhaDeAcoes>
        <Botao rotulo="Adicionar pergunta" tipo="secundario" Icone={Plus} desabilitado={!podeAdicionar(c, si, 'TEXTO').pode}
          motivo={podeAdicionar(c, si, 'TEXTO').motivo} aoTocar={() => setAdicionarEm(si)} />
      </LinhaDeAcoes>}
    </Cartao>)}
    {problemas.gerais.map((g) => <Texto key={g.caminho + g.mensagem} variante="pequeno" cor={cores.perigo}>{g.mensagem}</Texto>)}
    {somenteLeitura ? null : <LinhaDeAcoes>
      <Botao rotulo="Adicionar seção" tipo="secundario" Icone={Plus} desabilitado={!novaSecaoPermissao.pode} motivo={novaSecaoPermissao.motivo}
        aoTocar={() => aoMudar((x) => adicionarSecao(x))} />
    </LinhaDeAcoes>}

    {adicionarEm !== null ? <Folha visivel titulo="Adicionar pergunta" aoFechar={() => setAdicionarEm(null)}>
      {tiposParaAdicionar(finalidade).map(({ tipo, descricao }) => {
        const permissao = podeAdicionar(c, adicionarEm, tipo);
        return <View key={tipo} style={estilos.tipo}>
          <Botao rotulo={ROTULO_DO_TIPO[tipo]} tipo="secundario" cheio desabilitado={!permissao.pode} motivo={permissao.motivo} aoTocar={() => adicionar(adicionarEm, tipo)} />
          <Texto variante="pequeno">{permissao.pode ? descricao : permissao.motivo}</Texto>
        </View>;
      })}
    </Folha> : null}

    <PainelConfirmacao visivel={perguntaARemover !== undefined} titulo={`Remover a pergunta “${perguntaARemover?.rotulo || 'sem texto'}”?`}
      mensagem="Quem já respondeu mantém as respostas na versão que respondeu. Nada é salvo até você salvar o rascunho."
      rotuloConfirmar="Remover pergunta" perigo aoCancelar={() => setRemoverPerguntaDe(null)}
      aoConfirmar={() => { const alvo = removerPerguntaDe; setRemoverPerguntaDe(null); if (alvo) aoMudar((x) => removerPergunta(x, alvo.secao, alvo.pergunta)); }} />
    <PainelConfirmacao visivel={secaoARemover !== undefined} titulo={`Remover a seção “${secaoARemover?.titulo || (removerSecaoN ?? 0) + 1}”?`}
      mensagem={secaoARemover?.perguntas.length ? `As ${secaoARemover.perguntas.length} perguntas dela saem junto. Nada é salvo até você salvar o rascunho.` : undefined}
      rotuloConfirmar="Remover seção" perigo aoCancelar={() => setRemoverSecaoN(null)}
      aoConfirmar={() => { const n = removerSecaoN; setRemoverSecaoN(null); if (n !== null) aoMudar((x) => removerSecao(x, n)); }} />
  </>;
}

function CartaoDaPergunta({ pergunta: p, conteudo, posicao, total, aberta, problemas, secoes, secaoAtual, somenteLeitura, finalidade, fundo, podeDuplicar: duplicavel,
  aoAlternar, aoMudar, aoMover, aoDuplicar, aoMoverParaSecao, aoRemover }: {
  pergunta: PerguntaAtualizacao; conteudo: ConteudoQuestionario; posicao: number; total: number; aberta: boolean; problemas: string[];
  secoes: { i: number; titulo: string }[]; secaoAtual: number; somenteLeitura?: boolean; finalidade: FinalidadeQuestionario; fundo: string; podeDuplicar: boolean;
  aoAlternar: () => void; aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void; aoMover: (d: -1 | 1) => void;
  aoDuplicar: () => void; aoMoverParaSecao: (para: number) => void; aoRemover: () => void;
}) {
  const resumo = [ROTULO_DO_TIPO[p.tipo] ?? p.tipo, p.obrigatoria ? 'obrigatória' : null, p.destaque ? 'no resumo' : null,
    p.mostrarSe ? 'com condição' : null, p.imagemId ? 'com imagem' : null].filter(Boolean).join(' · ');
  const outras = secoes.filter((s) => s.i !== secaoAtual).map((s) => ({ valor: String(s.i), rotulo: s.titulo }));
  return <Cartao style={{ backgroundColor: fundo }}
    cabecalho={<CabecalhoDeGrupo titulo={p.rotulo || 'Pergunta sem texto'} resumo={resumo} aberto={aberta} aoAlternar={aoAlternar}
      selo={problemas.length ? { texto: 'Corrigir', tipo: 'perigo' } : undefined} />}>
    {aberta ? <>
      {p.mostrarSe && somenteLeitura ? <Texto variante="pequeno">{textoDaCondicao(conteudo, p.mostrarSe)}</Texto> : null}
      <PropriedadesDaPergunta pergunta={p} conteudo={conteudo} problemas={problemas} somenteLeitura={somenteLeitura} finalidade={finalidade} aoMudar={aoMudar} />
      {somenteLeitura ? null : <LinhaDeAcoes>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir a pergunta ${posicao + 1}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer a pergunta ${posicao + 1}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
        <Botao rotulo="Duplicar" tipo="secundario" Icone={Copy} desabilitado={!duplicavel} motivo="Este tipo só pode aparecer uma vez." aoTocar={aoDuplicar} />
        {outras.length ? <EscolhaEmFolha rotulo="Mover para a seção" valor="" opcoes={outras} rotuloDoValor="escolher" aoMudar={(v) => aoMoverParaSecao(Number(v))} /> : null}
        <Botao rotulo="Remover pergunta" tipo="perigoTexto" Icone={Trash2} aoTocar={aoRemover} />
      </LinhaDeAcoes>}
    </> : null}
  </Cartao>;
}

const estilos = StyleSheet.create({
  setas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tipo: { gap: espaco(0.5) },
});
