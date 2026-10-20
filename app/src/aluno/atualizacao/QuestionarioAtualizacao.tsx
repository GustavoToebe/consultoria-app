import { useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Check } from 'lucide-react-native';

import type {
  Atualizacao, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, SecaoAtualizacao,
} from '../../api/tipos';
import {
  ajudaDoNumero, alternarMarcado, colunasDasOpcoes, escolhaParaSimNao, NAO_SE_APLICA, progressoDasSecoes,
  respostasDaGrade, simNaoParaEscolha, textoDaNota, textoDaResposta, textoDoProgresso, type SimNao,
} from '../../dominio/atualizacaoQuestionario';
import { dataDaTela, dataParaTela, mascaraDeNumero, numeroParaTela } from '../../dominio/formatos';
import { textoDaParte } from '../../dominio/paginasDoQuestionario';
import { escalaDaNota, LIMITES_QUESTIONARIO as L, TIPOS_DE_PERGUNTA } from '../../dominio/questionario';
import { notaDoCadastro } from '../../dominio/anamnese';
import { enderecoParaForm, errosDoEndereco, mascaraCpf, mascaraTelefone, respostaDeEndereco } from '../../dominio/cadastroDoAluno';
import { avaliarRespostas, tamanhoDoTexto } from '../../dominio/respostasAtualizacao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CamposDeEndereco } from '../../ui/CamposDeEndereco';
import { CampoData, CampoNumerico } from '../../ui/Campos';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { EscalaDeNota } from '../../ui/EscalaDeNota';
import { useRolagem } from '../../ui/RolagemComTopo';
import { SeletorDeNota } from '../../ui/SeletorDeNota';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useControleDeFotos } from './fotos/ControleDeFotos';
import { CampoFotos } from './fotos/CampoFotos';
import { ImagemDaOpcao, ImagemDaPergunta } from './ImagemDaPergunta';

/** Página da anamnese: a seção (índice em `modelo.secoes`) e a posição dela entre as visíveis. */
export interface PaginaDoQuestionario { secao: number; posicao: number; total: number }

interface Props {
  /** A versão respondida (ou a vigente, enquanto aberta): define ordem, tipos, rótulos e condições. */
  modelo: ConteudoQuestionario | null;
  respostas: RespostasAtualizacao;
  aoMudar?: (id: string, valor: RespostaAtualizacao) => void;
  erros?: Record<string, string>;
  campos?: RefObject<Map<string, View>>;
  /** Só na atualização: data mostrada pela DATA_AUTOMATICA e o resumo da ajuda automática. */
  dataAtualizacao?: string | null;
  resumo?: Atualizacao['resumo'];
  /** Treinador: como baixar as fotos já enviadas (rota da atualização ou da anamnese). */
  carregarFotoDaEquipe?: (fotoId: string) => Promise<Blob>;
  /** Anamnese respondida em páginas: mostra só esta seção, com "Parte N de M". Sem isto, todas numa rolagem. */
  pagina?: PaginaDoQuestionario;
  /** Numa rolagem só (atualização): "N de M respondidas" por seção e a barra geral no topo. */
  progresso?: boolean;
}

const SIM_NAO = [{ valor: 'sim' as SimNao, rotulo: 'Sim' }, { valor: 'nao' as SimNao, rotulo: 'Não' }];

/** Chave com que cada pergunta se registra na rolagem da tela (`useRolagem().rolarAte`), para levar ao erro. */
export const alvoDaPergunta = (id: string) => `pergunta:${id}`;

/**
 * O modelo da API define ordem, tipos, rótulos e condições; aluno e treinador leem a mesma versão. Respondendo, pergunta
 * ou seção escondida por condição some da tela (e a resposta dela não é enviada); na leitura aparece como "Não se aplica".
 * Perguntas não são numeradas (a condição esconde algumas e a numeração pularia); obrigatória leva " *" no rótulo.
 */
export function QuestionarioAtualizacao({ modelo, respostas, aoMudar, erros = {}, campos, dataAtualizacao, resumo, carregarFotoDaEquipe, pagina, progresso }: Props) {
  const { cores } = useTema();
  const fotos = useControleDeFotos();
  const rolagem = useRolagem();
  if (!modelo) return null;
  const { escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas, true);
  const leitura = !aoMudar;
  const perguntas = (secao: SecaoAtualizacao) => <View style={estilos.perguntas}>
    {secao.perguntas.map((p) => {
      if (escondidas.has(p.id)) {
        return leitura ? <View key={p.id} style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto variante="suave">{NAO_SE_APLICA}</Texto></View> : null;
      }
      return <View key={p.id} collapsable={false}
        ref={(view) => {
          if (view) campos?.current.set(p.id, view); else campos?.current.delete(p.id);
          rolagem.registrar(alvoDaPergunta(p.id), view);
        }}>
        <Pergunta pergunta={p} valor={respostas[p.id] ?? null} dataAtualizacao={dataAtualizacao} resumo={resumo} erro={erros[p.id]}
          notaDoCadastro={leitura ? null : notaDoCadastro(p, modelo)}
          carregarFotoDaEquipe={carregarFotoDaEquipe} aoMudar={aoMudar ? (valor) => aoMudar(p.id, valor) : undefined} />
      </View>;
    })}
  </View>;

  // Fotos desligadas não contam: a pergunta não tem como ser respondida.
  const contagens = pagina || progresso ? progressoDasSecoes(modelo, respostas, fotos?.habilitado === true) : [];
  if (pagina) {
    const secao = modelo.secoes[pagina.secao];
    if (!secao) return null;
    const contagem = contagens[pagina.secao] ?? null;
    return <Cartao>
      <View style={estilos.parte}>
        <View style={estilos.linhaDaParte}>
          <Texto variante="pequeno" numerico>{textoDaParte(pagina.posicao, pagina.total)}</Texto>
          {contagem && contagem.total ? <Texto variante="pequeno" numerico>{textoDoProgresso(contagem)}</Texto> : null}
        </View>
        <BarraProgresso feitas={pagina.posicao + 1} total={pagina.total} />
      </View>
      <Texto variante="bloco" nivel={2}>{secao.titulo}</Texto>
      <TextoFormatado texto={secao.descricao} />
      {perguntas(secao)}
    </Cartao>;
  }

  const total = contagens.reduce((n, c) => n + (c?.total ?? 0), 0);
  const feitas = contagens.reduce((n, c) => n + (c?.respondidas ?? 0), 0);
  return <>
    {progresso && total > 0 ? <View style={estilos.parte}>
      <Texto variante="pequeno" numerico>{`${feitas} de ${total} respondidas`}</Texto>
      <BarraProgresso feitas={feitas} total={total} cor={cores.sucesso} />
    </View> : null}
    {modelo.secoes.map((secao, si) => {
      const escondida = secoesEscondidas.has(si);
      if (escondida && !leitura) return null;
      return <Cartao key={secao.uid ?? `${si}:${secao.titulo}`}
        cabecalho={<CabecalhoDeGrupo titulo={secao.titulo} resumo={escondida ? NAO_SE_APLICA : progresso ? textoDoProgresso(contagens[si] ?? null) : undefined} />}>
        {escondida ? <Texto variante="suave">Seção que não se aplica, pelas respostas anteriores.</Texto> : <>
          <TextoFormatado texto={secao.descricao} />
          {perguntas(secao)}
        </>}
      </Cartao>;
    })}
  </>;
}

function Pergunta({ pergunta: p, valor, dataAtualizacao, resumo, erro, notaDoCadastro: nota, carregarFotoDaEquipe, aoMudar }: {
  pergunta: PerguntaAtualizacao; valor: RespostaAtualizacao; dataAtualizacao?: string | null; resumo?: Atualizacao['resumo'];
  erro?: string; notaDoCadastro?: string | null; carregarFotoDaEquipe?: (fotoId: string) => Promise<Blob>; aoMudar?: (valor: RespostaAtualizacao) => void;
}) {
  const imagem = p.imagemId ? <ImagemDaPergunta id={p.imagemId} descricao={`Imagem da pergunta: ${p.rotulo}`} /> : null;
  if (p.tipo === 'INFORMATIVO') {
    return <View style={estilos.pergunta}>
      <Texto variante="secao" nivel={3}>{p.rotulo}</Texto>
      <TextoFormatado texto={p.texto} />
      {imagem}
    </View>;
  }
  const controle = <Controle p={p} valor={valor} dataAtualizacao={dataAtualizacao} resumo={resumo} erro={erro} nota={nota} carregarFotoDaEquipe={carregarFotoDaEquipe} aoMudar={aoMudar} />;
  if (!imagem) return controle;
  return <View style={estilos.pergunta}>{imagem}{controle}</View>;
}

function Controle({ p, valor, dataAtualizacao, resumo, erro, nota, carregarFotoDaEquipe, aoMudar }: {
  p: PerguntaAtualizacao; valor: RespostaAtualizacao; dataAtualizacao?: string | null; resumo?: Atualizacao['resumo'];
  erro?: string; nota?: string | null; carregarFotoDaEquipe?: (fotoId: string) => Promise<Blob>; aoMudar?: (valor: RespostaAtualizacao) => void;
}) {
  const { cores } = useTema();
  const rotulo = `${p.rotulo}${p.obrigatoria ? ' *' : ''}`;
  const ajuda = p.ajudaAutomatica === 'MEDIA_DIAS_TREINO' && resumo?.mediaDiasPorSemana != null
    ? `Pelo app, você treinou em média ${numeroParaTela(resumo.mediaDiasPorSemana, 1)} ${resumo.mediaDiasPorSemana < 2 ? 'dia' : 'dias'} por semana neste período.`
    : p.ajuda;
  const ajudaTexto = ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null;
  // Mesmo tom e região viva do erro do `Campo`, para todos os controles avisarem igual.
  const mensagemErro = erro ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erro}</Texto> : null;
  if (p.tipo === 'DATA_AUTOMATICA') return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto numerico>{dataParaTela(dataAtualizacao ?? null) || '—'}</Texto></View>;
  if (p.tipo === 'FOTOS') return <View style={estilos.pergunta}>
    <CampoFotos pergunta={p} valor={valor} carregarDaEquipe={carregarFotoDaEquipe} rotulo={aoMudar ? rotulo : p.rotulo} />{mensagemErro}
  </View>;
  if (!TIPOS_DE_PERGUNTA.includes(p.tipo)) return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto><Texto variante="pequeno">{aoMudar ? 'Atualize o app para responder esta pergunta.' : 'Atualize o app para ver esta resposta.'}</Texto>
  </View>;
  if (!aoMudar) return <Leitura p={p} valor={valor} ajuda={ajudaTexto} />;
  if (p.tipo === 'PESO') return <CampoNumerico rotulo={rotulo} valor={typeof valor === 'number' ? valor : null}
    aoMudar={aoMudar} ajuda={['Em kg, de 20 a 400, com uma casa decimal.', nota].filter(Boolean).join(' ')} erro={erro} />;
  if (p.tipo === 'NUMERO') return <CampoNumerico rotulo={rotulo} valor={typeof valor === 'number' ? valor : null} aoMudar={aoMudar}
    sufixo={p.unidade} inteiro={(p.casas ?? 0) === 0} mascara={(t) => mascaraDeNumero(t, p.casas ?? 0, {
      // Altura: em metros e com teto abaixo de 10, os algarismos viram "1,75". Outra medida em metros digita a vírgula.
      emMetros: p.unidade === 'm' && typeof p.max === 'number' && p.max < 10, negativo: typeof p.min === 'number' && p.min < 0,
    })} ajuda={[ajudaDoNumero(p), ajuda].filter(Boolean).join(' ')} erro={erro} />;
  if (p.tipo === 'NOTA') {
    const { min: minimo, max: maximo } = escalaDaNota(p);
    return <View style={estilos.pergunta}>
      <SeletorDeNota rotulo={rotulo} valor={typeof valor === 'number' ? valor : null} minimo={minimo} maximo={maximo}
        rotuloMinimo={p.rotuloMin} rotuloMaximo={p.rotuloMax} limpavel={!p.obrigatoria} aoMudar={aoMudar} />
      {ajudaTexto}{mensagemErro}
    </View>;
  }
  if (p.tipo === 'SIM_NAO') return <View style={estilos.pergunta}>
    <Escolha rotulo={rotulo} opcoes={SIM_NAO} valor={simNaoParaEscolha(valor)} limpavel={!p.obrigatoria}
      aoMudar={(escolha) => aoMudar(escolhaParaSimNao(escolha))} />
    {ajudaTexto}{mensagemErro}
  </View>;
  if (temImagemNasOpcoes(p)) return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{rotulo}</Texto>
    {ajudaTexto}
    <OpcoesComImagem p={p} valor={valor} aoMudar={aoMudar} />
    {mensagemErro}
  </View>;
  if (p.tipo === 'ESCOLHA_UNICA') {
    const opcoes = (p.opcoes ?? []).map((o) => ({ valor: o.id, rotulo: o.rotulo }));
    const escolhida = typeof valor === 'string' ? valor : null;
    return <View style={estilos.pergunta}>
      {opcoes.length > OPCOES_PARA_BUSCAR ? <>
        <EscolhaEmFolha rotulo={rotulo} valor={escolhida} opcoes={opcoes} aoMudar={aoMudar} rotuloDoValor="Escolher" />
        {!p.obrigatoria && escolhida ? <Botao tipo="fantasma" rotulo="Limpar" rotuloAcessivel={`Limpar ${p.rotulo}`} aoTocar={() => aoMudar(null)} /> : null}
      </> : <Escolha rotulo={rotulo} opcoes={opcoes} valor={escolhida} limpavel={!p.obrigatoria} aoMudar={aoMudar} />}
      {ajudaTexto}{mensagemErro}
    </View>;
  }
  if (p.tipo === 'MULTIPLA_ESCOLHA') {
    const opcoes = p.opcoes ?? [];
    const marcadas = Array.isArray(valor) ? valor : [];
    return <View style={estilos.pergunta}>
      <Texto variante="rotulo">{rotulo}</Texto>
      {ajudaTexto}
      {opcoes.map((o) => <CaixaSelecao key={o.id} rotulo={o.rotulo} marcado={marcadas.includes(o.id)}
        aoMudar={() => aoMudar(alternarMarcado(marcadas, opcoes, o.id))} />)}
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'NOTAS_POR_DIA') {
    // Vários dias numa pergunta: o deslizante cabe numa linha por dia (os números tocáveis da NOTA ocupariam duas).
    const dias = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, number | null> : {};
    return <View style={estilos.pergunta}><Texto variante="rotulo">{rotulo}</Texto>
      {ajudaTexto}
      {(p.dias ?? []).map((d) => <EscalaDeNota key={d} rotulo={`Dia ${d}`} valor={dias[String(d)] ?? null}
        aoMudar={(n) => aoMudar({ ...dias, [String(d)]: n })} />)}
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'GRADE') return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{rotulo}</Texto>
    {ajudaTexto}
    <GradeParaResponder p={p} valor={valor} aoMudar={aoMudar} faltando={!!erro} />
    {mensagemErro}
  </View>;
  if (p.tipo === 'ENDERECO') {
    const atual = enderecoParaForm(typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, string> : null);
    return <View style={estilos.pergunta}>
      <Texto variante="rotulo">{rotulo}</Texto>
      {ajudaTexto}
      {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
      <CamposDeEndereco valor={atual} aoMudar={(e) => aoMudar(respostaDeEndereco(e))} erros={erro ? errosDoEndereco(atual) : undefined} />
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'ACEITE') return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{rotulo}</Texto>
    {/* O texto (regras, termo) num quadro próprio: lê-se como um documento, separado da caixa de aceitar. */}
    {p.texto?.trim() ? <View style={[estilos.documento, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <TextoFormatado texto={p.texto} />
    </View> : null}
    <CaixaSelecao rotulo={p.declaracao ?? 'Li e concordo.'} marcado={valor === true} aoMudar={(marcado) => aoMudar(marcado ? true : null)} />
    {ajudaTexto}{mensagemErro}
  </View>;
  if (p.tipo === 'DATA') return <CampoDeData rotulo={rotulo} valor={valor} ajuda={ajuda ?? (p.somentePassado ? 'Hoje ou antes.' : undefined)} erro={erro} aoMudar={aoMudar} />;
  // Telefone e CPF só aceitam números e se formatam enquanto se digita ("(45) 99999-8888", "123.456.789-09"): o servidor aceita
  // exatamente essas formas.
  if (p.tipo === 'TELEFONE') return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? mascaraTelefone(valor) : ''} aoMudar={(t) => aoMudar(mascaraTelefone(t))}
    keyboardType="phone-pad" inputMode="tel" autoComplete="tel" maxLength={L.telefoneTamanho} erro={erro} ajuda={[ajuda ?? 'Com DDD, ex.: (45) 99999-8888.', nota].filter(Boolean).join(' ')} />;
  if (p.tipo === 'TEXTO' && p.destino === 'CPF') return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? mascaraCpf(valor) : ''} aoMudar={(t) => aoMudar(mascaraCpf(t))}
    keyboardType="number-pad" inputMode="numeric" maxLength={14} erro={erro} ajuda={[ajuda ?? 'Só números, ex.: 123.456.789-09.', nota].filter(Boolean).join(' ')} />;
  if (p.tipo === 'EMAIL') return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? valor : ''} aoMudar={aoMudar}
    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={L.emailTamanho} erro={erro} ajuda={ajuda} />;
  return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? valor : ''} aoMudar={aoMudar}
    linhas={p.tipo === 'TEXTO_LONGO' ? 5 : undefined} maxLength={tamanhoDoTexto(p)} erro={erro} ajuda={[ajuda, nota].filter(Boolean).join(' ') || undefined} />;
}

/** Resposta na leitura (treinador, anamnese já enviada): rótulo sem asterisco e o valor em texto. */
function Leitura({ p, valor, ajuda }: { p: PerguntaAtualizacao; valor: RespostaAtualizacao; ajuda: ReactNode }) {
  const { cores } = useTema();
  let resposta: ReactNode;
  if (p.tipo === 'GRADE') {
    resposta = <View style={[estilos.listaDaGrade, { borderColor: cores.borda }]}>
      {respostasDaGrade(p, valor).map((r, i) => <View key={r.id} style={[estilos.itemDaLista, i > 0 && { borderTopWidth: 1, borderTopColor: cores.borda }]}>
        <Texto style={estilos.itemRotulo}>{r.linha}</Texto>
        <Texto style={estilos.itemValor}>{r.resposta}</Texto>
      </View>)}
    </View>;
  } else if (temImagemNasOpcoes(p)) resposta = <OpcoesComImagem p={p} valor={valor} />;
  else if (p.tipo === 'NOTA') resposta = <Texto numerico>{textoDaNota(p, valor)}</Texto>;
  else resposta = <Texto>{textoDaResposta(p, valor)}</Texto>;
  return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto>
    {p.tipo === 'ACEITE' ? <TextoFormatado texto={p.texto} variante="suave" /> : null}
    {resposta}
    {ajuda}
  </View>;
}

/**
 * GRADE para responder: uma linha da tabela por bloco, com o item em destaque, os botões das colunas embaixo (quebram
 * linha no celular, mesmo com "Ocasionalmente" e "Frequentemente") e um divisor entre os blocos. Com o erro de
 * "responda todas as linhas", cada linha vazia diz que falta.
 */
function GradeParaResponder({ p, valor, aoMudar, faltando }: {
  p: PerguntaAtualizacao; valor: RespostaAtualizacao; aoMudar: (valor: RespostaAtualizacao) => void; faltando: boolean;
}) {
  const { cores } = useTema();
  const marcadas = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, string> : {};
  const colunas = (p.colunas ?? []).map((c) => ({ valor: c.id, rotulo: c.rotulo }));
  return <View style={[estilos.listaDaGrade, { borderColor: cores.borda }]}>
    {(p.linhas ?? []).map((l, i) => <View key={l.id} style={[estilos.linhaDaGrade, i > 0 && { borderTopWidth: 1, borderTopColor: cores.borda }]}>
      <Texto style={estilos.rotuloDaLinha}>{l.rotulo}</Texto>
      {faltando && marcadas[l.id] == null ? <Texto variante="pequeno" cor={cores.perigo}>Falta responder esta linha.</Texto> : null}
      <Escolha descricao={l.rotulo} opcoes={colunas} valor={marcadas[l.id] ?? null} limpavel
        aoMudar={(coluna) => {
          const nova = { ...marcadas };
          if (coluna == null) delete nova[l.id]; else nova[l.id] = coluna;
          aoMudar(Object.keys(nova).length ? nova : null);
        }} />
    </View>)}
  </View>;
}

const temImagemNasOpcoes = (p: PerguntaAtualizacao) =>
  (p.tipo === 'ESCOLHA_UNICA' || p.tipo === 'MULTIPLA_ESCOLHA') && (p.opcoes ?? []).some((o) => !!o.imagemId);

const VAO_OPCOES = espaco(1.5);

/**
 * Escolha com imagem por opção (aparelhos da academia, escala de referência): cartões em grade (2 por linha no
 * celular, 3 ou 4 no PC), o cartão inteiro marca, imagem inteira numa proporção fixa e o nome embaixo. Marcado = borda
 * grossa na cor do texto, fundo realçado e a caixinha cheia. Na escolha única marcar uma desmarca a outra. Sem
 * `aoMudar`, só leitura: as escolhidas em destaque e as outras apagadas.
 */
function OpcoesComImagem({ p, valor, aoMudar }: { p: PerguntaAtualizacao; valor: RespostaAtualizacao; aoMudar?: (valor: RespostaAtualizacao) => void }) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const opcoes = p.opcoes ?? [];
  const unica = p.tipo === 'ESCOLHA_UNICA';
  const marcadas = unica ? (typeof valor === 'string' ? [valor] : []) : Array.isArray(valor) ? valor : [];
  const colunas = colunasDasOpcoes(largura);
  const celula = largura > 0 ? Math.floor((largura - VAO_OPCOES * (colunas - 1)) / colunas) : 0;
  const imagem = Math.max(0, celula - 2 * espaco(1) - 4);
  const tocar = (id: string) => {
    if (!aoMudar) return;
    const marcado = marcadas.includes(id);
    if (unica) aoMudar(marcado ? (p.obrigatoria ? id : null) : id);
    else aoMudar(alternarMarcado(marcadas, opcoes, id));
  };
  return <View style={estilos.gradeDeOpcoes} onLayout={(e: LayoutChangeEvent) => setLargura(Math.floor(e.nativeEvent.layout.width))}
    accessibilityRole={unica ? 'radiogroup' : undefined} accessibilityLabel={p.rotulo}>
    {celula > 0 ? opcoes.map((o) => {
      const marcado = marcadas.includes(o.id);
      return <Pressable key={o.id} disabled={!aoMudar} onPress={() => tocar(o.id)}
        accessibilityRole={unica ? 'radio' : 'checkbox'} accessibilityLabel={o.rotulo}
        accessibilityState={{ checked: marcado, disabled: !aoMudar }} aria-checked={marcado}
        style={({ pressed }) => [estilos.opcaoComImagem, {
          width: celula,
          borderWidth: marcado ? 2 : 1,
          padding: marcado ? espaco(1) - 1 : espaco(1),
          borderColor: marcado ? cores.texto : cores.borda,
          backgroundColor: marcado || pressed ? cores.superficie3 : cores.superficie2,
          opacity: !aoMudar && !marcado ? 0.55 : 1,
        }]}>
        {o.imagemId ? <ImagemDaOpcao id={o.imagemId} descricao={`Imagem da opção ${o.rotulo}`} largura={imagem} />
          : <View style={[estilos.semImagem, { height: Math.round(imagem * 0.75), borderColor: cores.borda }]} />}
        <View style={estilos.rodapeDaOpcao}>
          <View style={[unica ? estilos.bolinha : estilos.caixinha, { borderColor: marcado ? cores.texto : cores.bordaCampo, backgroundColor: marcado ? cores.texto : cores.campo }]}>
            {marcado ? <Check size={14} color={cores.fundo} /> : null}
          </View>
          <Texto style={estilos.rotuloDaOpcao}>{o.rotulo}</Texto>
        </View>
      </Pressable>;
    }) : null}
  </View>;
}

/**
 * Data digitada DD/MM/AAAA (com o calendário do campo). A resposta é AAAA-MM-DD; enquanto o texto não é uma data inteira
 * ele vai como está, e a conferência do envio aponta o campo (o rascunho não perde o que foi digitado).
 */
function CampoDeData({ rotulo, valor, ajuda, erro, aoMudar }: {
  rotulo: string; valor: RespostaAtualizacao; ajuda?: string; erro?: string; aoMudar: (valor: RespostaAtualizacao) => void;
}) {
  const [texto, setTexto] = useState(() => (typeof valor === 'string' ? dataParaTela(valor) || valor : ''));
  return <View style={estilos.pergunta}>
    <CampoData rotulo={rotulo} valor={texto} erro={erro} aoMudar={(t) => {
      setTexto(t);
      const iso = dataDaTela(t);
      aoMudar(t.trim() === '' ? null : typeof iso === 'string' ? iso : t);
    }} />
    {/* Como no `Campo`: com erro, só o erro (a ajuda volta quando ele some). */}
    {ajuda && !erro ? <Texto variante="pequeno">{ajuda}</Texto> : null}
  </View>;
}

const estilos = StyleSheet.create({
  // 24 px entre perguntas (o mesmo vão entre blocos): num formulário longo cada pergunta precisa se separar da próxima.
  perguntas: { gap: espaco(3) },
  pergunta: { gap: espaco(1) },
  parte: { gap: espaco(0.75) },
  linhaDaParte: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  documento: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  listaDaGrade: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaDaGrade: { gap: espaco(1), padding: espaco(1.5) },
  rotuloDaLinha: { fontFamily: fontes.semi },
  itemDaLista: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2), paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  itemRotulo: { flex: 1 },
  itemValor: { flexShrink: 0, maxWidth: '50%', textAlign: 'right', fontFamily: fontes.semi },
  gradeDeOpcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: VAO_OPCOES, alignSelf: 'stretch' },
  opcaoComImagem: { borderRadius: RAIO, gap: espaco(1) },
  semImagem: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO },
  rodapeDaOpcao: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), minHeight: 24 },
  caixinha: { width: 22, height: 22, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  bolinha: { width: 22, height: 22, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rotuloDaOpcao: { flex: 1 },
});
