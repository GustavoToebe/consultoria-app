import { ArrowDown, ArrowUp, ChevronsDownUp, ChevronsUpDown, Copy, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, FinalidadeQuestionario, PerguntaAtualizacao, TipoPergunta } from '../../api/tipos';
import {
  aceitaObrigatoria, adicionarPergunta, adicionarPrimeiraPergunta, adicionarSecao, alterarCondicaoDaSecao, alterarDescricaoDaSecao, alterarPergunta, alterarSecao, duplicarPerguntaNaSecao, moverParaSecao, moverPergunta, moverSecao,
  editorVazio, novaPergunta, podeAdicionar, podeAdicionarSecao, podeDuplicar, removerPergunta, removerSecao, resumoDosItens, ROTULO_DO_TIPO, textoDaCondicao,
  type ProblemasAgrupados,
} from '../../dominio/editorQuestionario';
import { escalaDaNota, LIMITES_QUESTIONARIO as L, maximoDeFotos } from '../../dominio/questionario';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { chaveDaSecao, idDoBloco, quantasPerguntas } from '../../dominio/indiceDoQuestionario';
import { GaleriaDeTipos } from './GaleriaDeTipos';
import { EditorDeCondicao, PropriedadesDaPergunta } from './PropriedadesDaPergunta';

type Alvo = { secao: number; pergunta: number };

interface Props {
  conteudo: ConteudoQuestionario;
  aoMudar: (mudanca: (c: ConteudoQuestionario) => ConteudoQuestionario) => void;
  /** Quais perguntas estão abertas; o pai guarda (`useSecoesAbertas`) para poder abrir a nova e a que tem problema. */
  estaAberta: (id: string) => boolean;
  todasAbertas: boolean;
  aoAlternar: (id: string) => void;
  aoAlternarTodas: () => void;
  aoAbrir: (id: string) => void;
  problemas: ProblemasAgrupados;
  somenteLeitura?: boolean;
  finalidade?: FinalidadeQuestionario;
  /** Mudou algo na seção ou abriu uma pergunta dela (a prévia ao vivo da tela larga rola até a seção). */
  aoEditarSecao?: (secao: number) => void;
}

/**
 * Seções e perguntas do questionário (molde: `SecoesDeMobilidade`). Cada pergunta é um cartão recolhível, como o
 * exercício no treino; PESO e Data só uma vez, FOTOS até 6. Nada é salvo aqui: o pai guarda o rascunho.
 */
export function SecoesDoQuestionario({ conteudo: c, aoMudar, estaAberta, todasAbertas, aoAlternar, aoAlternarTodas, aoAbrir, problemas, somenteLeitura, finalidade = 'ATUALIZACAO', aoEditarSecao }: Props) {
  const { cores } = useTema();
  const [adicionarEm, setAdicionarEm] = useState<number | null>(null);
  const [removerPerguntaDe, setRemoverPerguntaDe] = useState<Alvo | null>(null);
  const [removerSecaoN, setRemoverSecaoN] = useState<number | null>(null);
  const perguntaARemover = removerPerguntaDe ? c.secoes[removerPerguntaDe.secao]?.perguntas[removerPerguntaDe.pergunta] : undefined;
  const secaoARemover = removerSecaoN === null ? undefined : c.secoes[removerSecaoN];
  const novaSecaoPermissao = podeAdicionarSecao(c);

  const adicionar = (secao: number, tipo: TipoPergunta) => {
    const nova = novaPergunta(tipo);
    aoEditarSecao?.(secao);
    aoMudar((atual) => adicionarPergunta(atual, secao, nova));
    aoAbrir(nova.id);
    setAdicionarEm(null);
  };

  const totalDePerguntas = c.secoes.reduce((n, sec) => n + sec.perguntas.length, 0);
  // Editor vazio (bloco G): o convite com a galeria no lugar do formulário da seção com que o questionário nasce.
  if (!somenteLeitura && editorVazio(c)) {
    return <Cartao titulo="Adicione a primeira pergunta" descricao="Escolha o tipo; depois você escreve o texto e ajusta as opções. Seções você cria quando precisar dividir o assunto.">
      <GaleriaDeTipos finalidade={finalidade} permissao={(tipo) => podeAdicionar(c, 0, tipo)} aoEscolher={(tipo) => {
        const nova = novaPergunta(tipo);
        aoEditarSecao?.(0);
        aoMudar((atual) => adicionarPrimeiraPergunta(atual, nova));
        aoAbrir(nova.id);
      }} />
    </Cartao>;
  }
  return <>
    <View style={estilos.cabecalhoLista}>
      <Texto variante="bloco" nivel={2}>Seções e perguntas ({totalDePerguntas})</Texto>
      {totalDePerguntas > 1 ? <Botao rotulo={todasAbertas ? 'Fechar todas' : 'Abrir todas'} tipo="fantasma" Icone={todasAbertas ? ChevronsDownUp : ChevronsUpDown} aoTocar={aoAlternarTodas} /> : null}
    </View>
    {/* Faixa compacta da seção (P5, resumo na faixa do `Cartao`): título e quantas perguntas tem, com ↑ ↓ e a lixeira à
        direita; o campo que edita o título fica no corpo. */}
    {c.secoes.map((sec, si) => {
      const mudar = (m: (x: ConteudoQuestionario) => ConteudoQuestionario) => { aoEditarSecao?.(si); aoMudar(m); };
      // `nativeID`: destino do índice da tela larga (rolagem, foco e seção visível); o `Cartao` não o recebe.
      return <View key={sec.uid ?? si} nativeID={idDoBloco(chaveDaSecao(si))} collapsable={false}><Cartao nivel={3} titulo={sec.titulo || `Seção ${si + 1}`} descricao={quantasPerguntas(sec.perguntas.length)}
      acoes={!somenteLeitura && c.secoes.length > 1 ? <View style={estilos.setas}>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir a seção ${si + 1}`} desabilitado={si === 0} aoTocar={() => aoMudar((x) => moverSecao(x, si, -1))} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer a seção ${si + 1}`} desabilitado={si === c.secoes.length - 1} aoTocar={() => aoMudar((x) => moverSecao(x, si, 1))} />
        <IconeBotao Icone={Trash2} rotulo={`Remover a seção ${sec.titulo || si + 1}`} aoTocar={() => setRemoverSecaoN(si)} />
      </View> : undefined}>
      {somenteLeitura ? null : <Campo rotulo={`Título da seção ${si + 1}`} valor={sec.titulo} maxLength={L.tituloTamanho} erro={problemas.porSecao.get(si)?.join(' ')}
        aoMudar={(titulo) => mudar((x) => alterarSecao(x, si, titulo))} />}
      {somenteLeitura ? null : <Campo rotulo="Descrição (opcional)" valor={sec.descricao ?? ''} maxLength={L.descricaoSecaoTamanho} linhas={3}
        ajuda={`Use **negrito** e __sublinhado__. Quebra de linha vale. ${(sec.descricao ?? '').length} de ${L.descricaoSecaoTamanho} caracteres.`}
        aoMudar={(descricao) => mudar((x) => alterarDescricaoDaSecao(x, si, descricao))} />}
      {somenteLeitura ? (sec.mostrarSe ? <Texto variante="pequeno">{textoDaCondicao(c, sec.mostrarSe)}</Texto> : null)
        : <EditorDeCondicao conteudo={c} secao={si} condicao={sec.mostrarSe} aoMudar={(m) => mudar((x) => alterarCondicaoDaSecao(x, si, m))} />}
      {sec.perguntas.length === 0 ? <Texto variante="suave">Seção sem pergunta. Adicione ao menos uma.</Texto> : null}
      {sec.perguntas.map((p, pi) => <CartaoDaPergunta key={p.id} pergunta={p} conteudo={c} posicao={pi} total={sec.perguntas.length}
        aberta={estaAberta(p.id)} problemas={problemas.porPergunta.get(p.id) ?? []} secoes={c.secoes.map((s, i) => ({ i, titulo: s.titulo || `Seção ${i + 1}` }))} secaoAtual={si}
        somenteLeitura={somenteLeitura} finalidade={finalidade} podeDuplicar={podeDuplicar(c, si, pi).pode}
        aoAlternar={() => { aoEditarSecao?.(si); aoAlternar(p.id); }}
        aoMudar={(parcial) => mudar((x) => alterarPergunta(x, si, pi, parcial))}
        aoMover={(d) => mudar((x) => moverPergunta(x, si, pi, d))}
        aoDuplicar={() => mudar((x) => duplicarPerguntaNaSecao(x, si, pi))}
        aoMoverParaSecao={(para) => mudar((x) => moverParaSecao(x, { secao: si, pergunta: pi }, para))}
        aoRemover={() => setRemoverPerguntaDe({ secao: si, pergunta: pi })} />)}
      {somenteLeitura ? null : <LinhaDeAcoes>
        <Botao rotulo="Adicionar pergunta" tipo="secundario" Icone={Plus} desabilitado={!podeAdicionar(c, si, 'TEXTO').pode}
          motivo={podeAdicionar(c, si, 'TEXTO').motivo} aoTocar={() => setAdicionarEm(si)} />
      </LinhaDeAcoes>}
    </Cartao></View>;
    })}
    {problemas.gerais.map((g) => <Texto key={g.caminho + g.mensagem} variante="pequeno" cor={cores.perigo}>{g.mensagem}</Texto>)}
    {somenteLeitura ? null : <LinhaDeAcoes>
      <Botao rotulo="Adicionar seção" tipo="acao" Icone={Plus} desabilitado={!novaSecaoPermissao.pode} motivo={novaSecaoPermissao.motivo}
        aoTocar={() => aoMudar((x) => adicionarSecao(x))} />
    </LinhaDeAcoes>}

    {adicionarEm !== null ? <Folha visivel titulo="Adicionar pergunta" largura={LARGURA_FOLHA_LARGA} aoFechar={() => setAdicionarEm(null)}>
      <GaleriaDeTipos finalidade={finalidade} permissao={(tipo) => podeAdicionar(c, adicionarEm, tipo)} aoEscolher={(tipo) => adicionar(adicionarEm, tipo)} />
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

function CartaoDaPergunta({ pergunta: p, conteudo, posicao, total, aberta, problemas, secoes, secaoAtual, somenteLeitura, finalidade, podeDuplicar: duplicavel,
  aoAlternar, aoMudar, aoMover, aoDuplicar, aoMoverParaSecao, aoRemover }: {
  pergunta: PerguntaAtualizacao; conteudo: ConteudoQuestionario; posicao: number; total: number; aberta: boolean; problemas: string[];
  secoes: { i: number; titulo: string }[]; secaoAtual: number; somenteLeitura?: boolean; finalidade: FinalidadeQuestionario; podeDuplicar: boolean;
  aoAlternar: () => void; aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void; aoMover: (d: -1 | 1) => void;
  aoDuplicar: () => void; aoMoverParaSecao: (para: number) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  // "opcional" só onde existe a escolha (INFORMATIVO, por exemplo, não é nem uma coisa nem outra).
  const resumo = [resumoDoTipo(p), aceitaObrigatoria(p.tipo) ? (p.obrigatoria ? 'obrigatória' : 'opcional') : null, p.destaque ? 'no resumo' : null,
    p.mostrarSe ? 'com condição' : null, p.imagemId ? 'com imagem' : null].filter(Boolean).join(' · ');
  const outras = secoes.filter((s) => s.i !== secaoAtual).map((s) => ({ valor: String(s.i), rotulo: s.titulo }));
  // Mesma gramática dos outros editores: setas ↑↓ movem, chevron abre, lixeira remove (antes as setas ficavam no rodapé).
  // Aberta = em edição: sobe para a superfície do cartão com o contorno forte (o "escolhido sobe" do segmento; a de
  // seleção, `superficie3`, apagaria a opção escolhida das `Escolha` de dentro); o erro vence o
  // contorno. O número da pergunta é contexto neutro, fora do título.
  return <View style={[estilos.pergunta, { backgroundColor: aberta ? cores.superficie : cores.superficie2, borderColor: problemas.length ? cores.perigo : aberta ? cores.bordaCampo : cores.divisor }]}>
    <CabecalhoDoItem titulo={p.rotulo || 'Pergunta sem texto'} contexto={`Pergunta ${posicao + 1}`} resumo={resumo} aberto={aberta} aoAlternar={aoAlternar} nomeDoItem={`a pergunta ${posicao + 1}`}
      selo={problemas.length ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
      posicao={posicao} total={total} aoMover={somenteLeitura ? undefined : aoMover}
      remover={somenteLeitura ? undefined : <IconeBotao Icone={Trash2} rotulo={`Remover a pergunta ${posicao + 1}`} aoTocar={aoRemover} />} />
    {aberta ? <View style={estilos.corpoPergunta}>
      {p.mostrarSe && somenteLeitura ? <Texto variante="pequeno">{textoDaCondicao(conteudo, p.mostrarSe)}</Texto> : null}
      <PropriedadesDaPergunta pergunta={p} conteudo={conteudo} problemas={problemas} somenteLeitura={somenteLeitura} finalidade={finalidade} aoMudar={aoMudar} />
      {somenteLeitura ? null : <LinhaDeAcoes>
        <Botao rotulo="Duplicar" tipo="secundario" Icone={Copy} desabilitado={!duplicavel} motivo={p.tipo === 'FOTOS' ? `No máximo ${L.perguntasFotos} perguntas de fotos.` : 'Este tipo só pode aparecer uma vez.'} aoTocar={aoDuplicar} />
        {outras.length ? <EscolhaEmFolha rotulo="Mover para a seção" valor="" opcoes={outras} rotuloDoValor="escolher" aoMudar={(v) => aoMoverParaSecao(Number(v))} /> : null}
      </LinhaDeAcoes>}
    </View> : null}
  </View>;
}

/** "Nota de 1 a 5", "Fotos (até 3)": o tipo com o que mais o distingue no cartão fechado. */
function resumoDoTipo(p: PerguntaAtualizacao): string {
  if (p.tipo === 'NOTA') { const { min, max } = escalaDaNota(p); return `Nota de ${min} a ${max}`; }
  if (p.tipo === 'FOTOS') { const n = maximoDeFotos(p); return `Fotos (até ${n})`; }
  if (p.tipo === 'ITENS_DO_PLANO') return resumoDosItens(p);
  return ROTULO_DO_TIPO[p.tipo] ?? p.tipo;
}

const estilos = StyleSheet.create({
  setas: { flexDirection: 'row', alignItems: 'center' },
  cabecalhoLista: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  pergunta: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  corpoPergunta: { gap: espaco(1.5), paddingVertical: espaco(1) },
});
