import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  Atualizacao, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao,
} from '../../api/tipos';
import {
  ajudaDoNumero, alternarMarcado, escolhaParaSimNao, NAO_SE_APLICA, progressoDasSecoes, simNaoParaEscolha, textoDaResposta,
  textoDoProgresso, type SimNao,
} from '../../dominio/atualizacaoQuestionario';
import { dataDaTela, dataParaTela, numeroParaTela } from '../../dominio/formatos';
import { LIMITES_QUESTIONARIO as L, TIPOS_DE_PERGUNTA } from '../../dominio/questionario';
import { notaDoCadastro } from '../../dominio/anamnese';
import { enderecoParaForm, respostaDeEndereco } from '../../dominio/cadastroDoAluno';
import { avaliarRespostas, tamanhoDoTexto } from '../../dominio/respostasAtualizacao';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
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
import { Texto } from '../../ui/Texto';
import { CampoFotos } from './fotos/CampoFotos';
import { ImagemDaPergunta } from './ImagemDaPergunta';

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
  /** Mostra "N de M respondidas" por seção e a barra geral (formulário longo, como a anamnese). */
  progresso?: boolean;
}

const SIM_NAO = [{ valor: 'sim' as SimNao, rotulo: 'Sim' }, { valor: 'nao' as SimNao, rotulo: 'Não' }];

/**
 * O modelo da API define ordem, tipos, rótulos e condições; aluno e treinador leem a mesma versão. Respondendo, pergunta
 * ou seção escondida por condição some da tela (e a resposta dela não é enviada); na leitura aparece como "Não se aplica".
 */
export function QuestionarioAtualizacao({ modelo, respostas, aoMudar, erros = {}, campos, dataAtualizacao, resumo, carregarFotoDaEquipe, progresso }: Props) {
  const { cores } = useTema();
  if (!modelo) return null;
  const { escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas, true);
  const contagem = progresso ? progressoDasSecoes(modelo, respostas, true) : [];
  const total = contagem.reduce((n, c) => n + (c?.total ?? 0), 0);
  const feitas = contagem.reduce((n, c) => n + (c?.respondidas ?? 0), 0);
  const leitura = !aoMudar;
  return <>
    {progresso && total > 0 ? <View style={estilos.progresso}>
      <Texto variante="pequeno" numerico>{`${feitas} de ${total} respondidas`}</Texto>
      <BarraProgresso feitas={feitas} total={total} cor={cores.sucesso} />
    </View> : null}
    {modelo.secoes.map((secao, si) => {
      const escondida = secoesEscondidas.has(si);
      if (escondida && !leitura) return null;
      return <Cartao key={secao.uid ?? secao.titulo}
        cabecalho={<CabecalhoDeGrupo titulo={secao.titulo} resumo={escondida ? NAO_SE_APLICA : progresso ? textoDoProgresso(contagem[si] ?? null) : undefined} />}>
        {escondida ? <Texto variante="suave">Seção que não se aplica, pelas respostas anteriores.</Texto>
          : secao.perguntas.map((p) => {
            if (escondidas.has(p.id)) {
              return leitura ? <View key={p.id} style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto variante="suave">{NAO_SE_APLICA}</Texto></View> : null;
            }
            return <View key={p.id} collapsable={false}
              ref={(view) => { if (view) campos?.current.set(p.id, view); else campos?.current.delete(p.id); }}>
              <Pergunta pergunta={p} valor={respostas[p.id] ?? null} dataAtualizacao={dataAtualizacao} resumo={resumo} erro={erros[p.id]}
                notaDoCadastro={leitura ? null : notaDoCadastro(p, modelo)}
                carregarFotoDaEquipe={carregarFotoDaEquipe} aoMudar={aoMudar ? (valor) => aoMudar(p.id, valor) : undefined} />
            </View>;
          })}
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
      <Texto variante="secao">{p.rotulo}</Texto>
      {p.texto ? <Texto>{p.texto}</Texto> : null}
      {imagem}
    </View>;
  }
  if (!imagem) return <Controle p={p} valor={valor} dataAtualizacao={dataAtualizacao} resumo={resumo} erro={erro} nota={nota} carregarFotoDaEquipe={carregarFotoDaEquipe} aoMudar={aoMudar} />;
  return <View style={estilos.pergunta}>
    {imagem}
    <Controle p={p} valor={valor} dataAtualizacao={dataAtualizacao} resumo={resumo} erro={erro} nota={nota} carregarFotoDaEquipe={carregarFotoDaEquipe} aoMudar={aoMudar} />
  </View>;
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
  const mensagemErro = erro ? <Texto cor={cores.perigo}>{erro}</Texto> : null;
  if (p.tipo === 'DATA_AUTOMATICA') return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto><Texto numerico>{dataParaTela(dataAtualizacao ?? null) || '—'}</Texto></View>;
  if (p.tipo === 'FOTOS') return <View style={estilos.pergunta}>
    <CampoFotos pergunta={p} valor={valor} carregarDaEquipe={carregarFotoDaEquipe} rotulo={rotulo} />{mensagemErro}
  </View>;
  if (!TIPOS_DE_PERGUNTA.includes(p.tipo)) return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{p.rotulo}</Texto><Texto variante="pequeno">{aoMudar ? 'Atualize o app para responder esta pergunta.' : 'Atualize o app para ver esta resposta.'}</Texto>
  </View>;
  if (!aoMudar) return <View style={estilos.pergunta}><Texto variante="rotulo">{p.rotulo}</Texto>
    {p.tipo === 'ACEITE' && p.texto ? <Texto variante="suave">{p.texto}</Texto> : null}
    {temImagemNasOpcoes(p) ? <OpcoesComImagem p={p} valor={valor} /> : <Texto>{textoDaResposta(p, valor)}</Texto>}
    {ajudaTexto}</View>;
  if (p.tipo === 'PESO') return <CampoNumerico rotulo={rotulo} valor={typeof valor === 'number' ? valor : null}
    aoMudar={aoMudar} ajuda={['Em kg, de 20 a 400, com uma casa decimal.', nota].filter(Boolean).join(' ')} erro={erro} />;
  if (p.tipo === 'NUMERO') return <CampoNumerico rotulo={rotulo} valor={typeof valor === 'number' ? valor : null} aoMudar={aoMudar}
    sufixo={p.unidade} inteiro={(p.casas ?? 0) === 0} ajuda={[ajudaDoNumero(p), ajuda].filter(Boolean).join(' ')} erro={erro} />;
  if (p.tipo === 'NOTA') return <View style={estilos.pergunta}>
    <EscalaDeNota rotulo={rotulo} valor={typeof valor === 'number' ? valor : null} aoMudar={aoMudar} />
    {mensagemErro}
  </View>;
  if (p.tipo === 'SIM_NAO') return <View style={estilos.pergunta}>
    <Escolha rotulo={rotulo} opcoes={SIM_NAO} valor={simNaoParaEscolha(valor)} limpavel={!p.obrigatoria}
      aoMudar={(escolha) => aoMudar(escolhaParaSimNao(escolha))} />
    {ajudaTexto}{mensagemErro}
  </View>;
  if (temImagemNasOpcoes(p)) return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{rotulo}</Texto>
    <OpcoesComImagem p={p} valor={valor} aoMudar={aoMudar} />
    {ajudaTexto}{mensagemErro}
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
      {opcoes.map((o) => <CaixaSelecao key={o.id} rotulo={o.rotulo} marcado={marcadas.includes(o.id)}
        aoMudar={() => aoMudar(alternarMarcado(marcadas, opcoes, o.id))} />)}
      {ajudaTexto}{mensagemErro}
    </View>;
  }
  if (p.tipo === 'NOTAS_POR_DIA') {
    const dias = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, number | null> : {};
    return <View style={estilos.pergunta}><Texto variante="rotulo">{rotulo}</Texto>
      {(p.dias ?? []).map((d) => <EscalaDeNota key={d} rotulo={`Dia ${d}`} valor={dias[String(d)] ?? null}
        aoMudar={(nota) => aoMudar({ ...dias, [String(d)]: nota })} />)}
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'GRADE') {
    const marcadas = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, string> : {};
    const colunas = (p.colunas ?? []).map((c) => ({ valor: c.id, rotulo: c.rotulo }));
    return <View style={estilos.pergunta}>
      <Texto variante="rotulo">{rotulo}</Texto>
      {ajudaTexto}
      {(p.linhas ?? []).map((l) => <Escolha key={l.id} rotulo={l.rotulo} opcoes={colunas} valor={marcadas[l.id] ?? null} limpavel
        aoMudar={(coluna) => {
          const nova = { ...marcadas };
          if (coluna == null) delete nova[l.id]; else nova[l.id] = coluna;
          aoMudar(Object.keys(nova).length ? nova : null);
        }} />)}
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'ENDERECO') {
    const atual = enderecoParaForm(typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, string> : null);
    return <View style={estilos.pergunta}>
      <Texto variante="rotulo">{rotulo}</Texto>
      {ajudaTexto}
      {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
      <CamposDeEndereco valor={atual} aoMudar={(e) => aoMudar(respostaDeEndereco(e))} />
      {mensagemErro}
    </View>;
  }
  if (p.tipo === 'ACEITE') return <View style={estilos.pergunta}>
    <Texto variante="rotulo">{rotulo}</Texto>
    {p.texto ? <Texto>{p.texto}</Texto> : null}
    <CaixaSelecao rotulo={p.declaracao ?? 'Li e concordo.'} marcado={valor === true} aoMudar={(marcado) => aoMudar(marcado ? true : null)} />
    {ajudaTexto}{mensagemErro}
  </View>;
  if (p.tipo === 'DATA') return <CampoDeData rotulo={rotulo} valor={valor} ajuda={ajuda ?? (p.somentePassado ? 'Hoje ou antes.' : undefined)} erro={erro} aoMudar={aoMudar} />;
  if (p.tipo === 'TELEFONE') return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? valor : ''} aoMudar={aoMudar}
    keyboardType="phone-pad" autoComplete="tel" maxLength={L.telefoneTamanho} erro={erro} ajuda={ajuda ?? 'Com DDD, ex.: (45) 99999-8888.'} />;
  if (p.tipo === 'EMAIL') return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? valor : ''} aoMudar={aoMudar}
    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={L.emailTamanho} erro={erro} ajuda={ajuda} />;
  return <Campo rotulo={rotulo} valor={typeof valor === 'string' ? valor : ''} aoMudar={aoMudar}
    linhas={p.tipo === 'TEXTO_LONGO' ? 4 : undefined} maxLength={tamanhoDoTexto(p)} erro={erro} ajuda={[ajuda, nota].filter(Boolean).join(' ') || undefined} />;
}

const temImagemNasOpcoes = (p: PerguntaAtualizacao) =>
  (p.tipo === 'ESCOLHA_UNICA' || p.tipo === 'MULTIPLA_ESCOLHA') && (p.opcoes ?? []).some((o) => !!o.imagemId);

/**
 * Escolha com imagem por opção (escala de referência, aparelhos): cada opção é a imagem com a caixa de marcar embaixo.
 * Na escolha única marcar uma desmarca a outra. Sem `aoMudar`, só leitura (marca as escolhidas).
 */
function OpcoesComImagem({ p, valor, aoMudar }: { p: PerguntaAtualizacao; valor: RespostaAtualizacao; aoMudar?: (valor: RespostaAtualizacao) => void }) {
  const opcoes = p.opcoes ?? [];
  const unica = p.tipo === 'ESCOLHA_UNICA';
  const marcadas = unica ? (typeof valor === 'string' ? [valor] : []) : Array.isArray(valor) ? valor : [];
  return <View style={estilos.grade}>
    {opcoes.map((o) => <View key={o.id} style={estilos.opcaoComImagem}>
      {o.imagemId ? <ImagemDaPergunta id={o.imagemId} descricao={`Imagem da opção ${o.rotulo}`} pequena /> : null}
      <CaixaSelecao rotulo={o.rotulo} marcado={marcadas.includes(o.id)} desabilitado={!aoMudar}
        aoMudar={(marcado) => {
          if (!aoMudar) return;
          if (unica) aoMudar(marcado ? o.id : p.obrigatoria ? o.id : null);
          else aoMudar(alternarMarcado(marcadas, opcoes, o.id));
        }} />
    </View>)}
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
    {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
  </View>;
}

const estilos = StyleSheet.create({
  pergunta: { gap: espaco(1) },
  progresso: { gap: espaco(0.5) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  opcaoComImagem: { gap: espaco(0.5), maxWidth: 200 },
});
