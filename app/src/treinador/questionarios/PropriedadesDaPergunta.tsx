import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, DestinoNoPerfil, FinalidadeQuestionario, OpcaoPergunta, PerguntaAtualizacao } from '../../api/tipos';
import { ImagemDaPergunta } from '../../aluno/atualizacao/ImagemDaPergunta';
import { FotoRecusada } from '../../aluno/atualizacao/fotos/prepararFoto';
import {
  aceitaAjudaAutomatica, aceitaDestaque, aceitaImagem, aceitaObrigatoria, condicaoPara, controlesAnteriores, datasDaPesagem, destinosPossiveis, novaOpcao,
  podeDestacar, podeUsarDestino, posicaoDaPergunta,
} from '../../dominio/editorQuestionario';
import { ROTULO_DO_DESTINO } from '../../dominio/anamnese';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { escalaDaNota, LIMITES_QUESTIONARIO as L, maximoDeFotos, temOpcoes } from '../../dominio/questionario';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { SelecaoMultipla } from '../../ui/SelecaoMultipla';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { escolherEEnviarImagem } from './enviarImagem';

const CASAS = [{ valor: 0, rotulo: '0' }, { valor: 1, rotulo: '1' }, { valor: 2, rotulo: '2' }];
const INICIO_DA_ESCALA = [{ valor: 0, rotulo: '0' }, { valor: 1, rotulo: '1' }];
const FIM_DA_ESCALA = Array.from({ length: L.notaMaxPadrao - L.notaMaxMinimo + 1 }, (_, i) => ({ valor: L.notaMaxMinimo + i, rotulo: String(L.notaMaxMinimo + i) }));
const QUANTAS_FOTOS = Array.from({ length: L.fotosPorPergunta }, (_, i) => ({ valor: i + 1, rotulo: String(i + 1) }));
const DIAS = Array.from({ length: L.diaValorMaximo }, (_, i) => ({ valor: String(i + 1), rotulo: `Dia ${i + 1}` }));
const AVISO_LICENCA = 'Use só imagens suas ou com licença de uso: você responde pelo que envia.';

/**
 * Propriedades de uma pergunta, por tipo. O tipo nunca muda aqui (a resposta já gravada depende dele): para trocar,
 * remova a pergunta e adicione outra.
 */
export function PropriedadesDaPergunta({ pergunta: p, conteudo, problemas, somenteLeitura, finalidade = 'ATUALIZACAO', aoMudar }: {
  pergunta: PerguntaAtualizacao; conteudo: ConteudoQuestionario; problemas: string[]; somenteLeitura?: boolean;
  finalidade?: FinalidadeQuestionario; aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void;
}) {
  const { cores } = useTema();
  const opcoes = p.opcoes ?? [];
  const destaque = podeDestacar(conteudo, p.id);
  // A página pública de inscrição não mostra imagem (D6): sem o botão de enviar.
  const comImagem = aceitaImagem(finalidade);
  if (somenteLeitura) return <Texto variante="suave">{p.ajuda || 'Sem texto de ajuda.'}</Texto>;
  return <View style={estilos.bloco}>
    {problemas.map((m) => <Texto key={m} variante="pequeno" cor={cores.perigo}>{m}</Texto>)}
    <Campo rotulo={p.tipo === 'INFORMATIVO' ? 'Título' : 'Texto da pergunta'} valor={p.rotulo} maxLength={L.rotuloTamanho} aoMudar={(rotulo) => aoMudar({ rotulo })} />
    {p.tipo === 'INFORMATIVO' ? <Campo rotulo="Texto (opcional)" valor={p.texto ?? ''} maxLength={L.textoInformativoTamanho} linhas={5} aoMudar={(texto) => aoMudar({ texto })} />
      : <Campo rotulo="Ajuda para o aluno (opcional)" valor={p.ajuda ?? ''} maxLength={L.ajudaTamanho} linhas={2} aoMudar={(ajuda) => aoMudar({ ajuda })} />}
    {aceitaObrigatoria(p.tipo) ? <Interruptor rotulo={p.tipo === 'GRADE' ? 'Obrigatória (todas as linhas)' : 'Obrigatória'} valor={p.obrigatoria}
      aoMudar={(obrigatoria) => aoMudar({ obrigatoria })} /> : null}
    {p.tipo === 'PESO' && finalidade === 'ATUALIZACAO' ? <Texto variante="suave">A resposta vai para o registro de peso do aluno.</Texto> : null}
    {destinosPossiveis(p.tipo, finalidade).length > 0 ? <DestinoNoCadastro pergunta={p} conteudo={conteudo} finalidade={finalidade} aoMudar={aoMudar} /> : null}
    {p.tipo === 'DATA_AUTOMATICA' ? <Texto variante="suave">Mostra a data da atualização; o aluno não responde.</Texto> : null}
    {p.tipo === 'FOTOS' ? <>
      <Escolha rotulo="Quantas fotos o aluno pode anexar" opcoes={QUANTAS_FOTOS} valor={maximoDeFotos(p)}
        aoMudar={(n) => aoMudar({ max: n === L.fotosPorPergunta ? undefined : n })} />
      <Texto variante="suave">Elas só aparecem para você depois do envio, e só com o envio de fotos ligado no servidor.</Texto>
    </> : null}
    {p.tipo === 'NOTA' ? <EscalaDaNota pergunta={p} aoMudar={aoMudar} /> : null}
    {p.tipo === 'DATA' ? <Interruptor rotulo="Só hoje ou antes (ex.: nascimento, última pesagem)" valor={p.somentePassado === true}
      aoMudar={(somentePassado) => aoMudar({ somentePassado: somentePassado || undefined })} /> : null}
    {p.tipo === 'ACEITE' ? <>
      <Campo rotulo="Texto que o aluno lê (regras)" valor={p.texto ?? ''} maxLength={L.textoInformativoTamanho} linhas={6} aoMudar={(texto) => aoMudar({ texto })} />
      <Campo rotulo="Frase que o aluno marca para aceitar" valor={p.declaracao ?? ''} maxLength={L.declaracaoTamanho} aoMudar={(declaracao) => aoMudar({ declaracao })} />
      <Texto variante="suave">A resposta guarda a versão do questionário: se você mudar o texto e publicar, quem já aceitou continua com o texto que aceitou.</Texto>
    </> : null}

    {temOpcoes(p.tipo) ? <ListaDeItens titulo="Opções" itens={opcoes} minimo={L.opcoesMinimo} maximo={L.opcoesMaximo} nome="opção" comImagem={comImagem}
      sexo={p.destino === 'SEXO'} aoMudar={(novas) => aoMudar({ opcoes: novas })} /> : null}
    {p.tipo === 'GRADE' ? <>
      <ListaDeItens titulo="Linhas" itens={p.linhas ?? []} minimo={L.linhasMinimo} maximo={L.linhasMaximo} nome="linha" aoMudar={(linhas) => aoMudar({ linhas })} />
      <ListaDeItens titulo="Colunas" itens={p.colunas ?? []} minimo={L.colunasMinimo} maximo={L.colunasMaximo} nome="coluna" aoMudar={(colunas) => aoMudar({ colunas })} />
    </> : null}

    {p.tipo === 'NUMERO' ? <View style={estilos.bloco}>
      <Campo rotulo="Unidade (opcional, ex.: kg, passos)" valor={p.unidade ?? ''} maxLength={L.unidadeTamanho} aoMudar={(unidade) => aoMudar({ unidade })} />
      <CampoNumerico rotulo="Valor mínimo (opcional)" valor={p.min ?? null} aoMudar={(min) => aoMudar({ min: min ?? undefined })} />
      <CampoNumerico rotulo="Valor máximo (opcional)" valor={p.max ?? null} aoMudar={(max) => aoMudar({ max: max ?? undefined })} />
      <Escolha rotulo="Casas decimais" opcoes={CASAS} valor={p.casas ?? 0} aoMudar={(casas) => aoMudar({ casas })} />
    </View> : null}

    {p.tipo === 'NOTAS_POR_DIA' ? <SelecaoMultipla rotulo={`Dias que o aluno avalia (até ${L.diasMaximo})`} opcoes={DIAS} limite={L.diasMaximo}
      marcados={new Set((p.dias ?? []).map(String))}
      aoMudar={(marcados) => aoMudar({ dias: [...marcados].map(Number).sort((a, b) => a - b) })} /> : null}

    {aceitaAjudaAutomatica(p.tipo, finalidade) ? <Interruptor rotulo="Mostrar a média de dias com treino como ajuda"
      valor={p.ajudaAutomatica === 'MEDIA_DIAS_TREINO'} aoMudar={(ligado) => aoMudar({ ajudaAutomatica: ligado ? 'MEDIA_DIAS_TREINO' : undefined })} /> : null}

    {aceitaDestaque(p.tipo) && finalidade === 'ATUALIZACAO' ? (destaque.pode || p.destaque === true
      ? <View style={estilos.bloco}>
        <Interruptor rotulo="Mostrar no resumo do treinador" valor={p.destaque === true} aoMudar={(ligado) => aoMudar({ destaque: ligado, rotuloCurto: ligado ? p.rotuloCurto : undefined })} />
        {p.destaque === true ? <Campo rotulo="Nome curto no resumo (opcional)" valor={p.rotuloCurto ?? ''} maxLength={L.rotuloCurtoTamanho} aoMudar={(rotuloCurto) => aoMudar({ rotuloCurto })} /> : null}
      </View>
      : <Texto variante="pequeno">{destaque.motivo}</Texto>) : null}

    {comImagem ? <ImagemDoItem imagemId={p.imagemId} rotulo={p.tipo === 'INFORMATIVO' ? 'Imagem (opcional)' : 'Imagem de referência (opcional)'}
      aoMudar={(imagemId) => aoMudar({ imagemId })} /> : null}
    <EditorDeCondicao conteudo={conteudo} perguntaId={p.id} condicao={p.mostrarSe} aoMudar={(mostrarSe) => aoMudar({ mostrarSe })} />
  </View>;
}

/**
 * Escala da NOTA: começa em 0 ou 1 e termina de 2 a 10, as duas como escolha (como "Quantas fotos": nada a digitar nem
 * valor fora da faixa), com texto opcional embaixo de cada ponta ("Nada", "Muito"), lado a lado quando cabe. O padrão
 * (0 a 10) não é gravado, para o JSON ficar igual ao de sempre.
 */
function EscalaDaNota({ pergunta: p, aoMudar }: { pergunta: PerguntaAtualizacao; aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void }) {
  const { min, max } = escalaDaNota(p);
  return <View style={estilos.bloco}>
    <View style={estilos.lado}>
      <View style={estilos.inicioDaEscala}>
        <Escolha rotulo="A escala começa em" opcoes={INICIO_DA_ESCALA} valor={min}
          aoMudar={(n) => aoMudar({ min: n === L.notaMinPadrao ? undefined : n })} />
      </View>
      <View style={estilos.metade}>
        <Escolha rotulo="E termina em" opcoes={FIM_DA_ESCALA} valor={max}
          aoMudar={(n) => aoMudar({ max: n === L.notaMaxPadrao ? undefined : n })} />
      </View>
    </View>
    <View style={estilos.lado}>
      <View style={estilos.metade}>
        <Campo rotulo="Texto na ponta de baixo (opcional)" placeholder="ex.: Nada" valor={p.rotuloMin ?? ''} maxLength={L.rotuloPontaTamanho}
          aoMudar={(rotuloMin) => aoMudar({ rotuloMin })} />
      </View>
      <View style={estilos.metade}>
        <Campo rotulo="Texto na ponta de cima (opcional)" placeholder="ex.: Muito" valor={p.rotuloMax ?? ''} maxLength={L.rotuloPontaTamanho}
          aoMudar={(rotuloMax) => aoMudar({ rotuloMax })} />
      </View>
    </View>
  </View>;
}

const SEM_DATA = '__envio__';

/** Rótulo do interruptor (um destino possível) e do item da escolha (vários) para cada campo do cadastro. */
const ROTULO_DO_INTERRUPTOR: Record<DestinoNoPerfil, string> = {
  PESO: 'Guardar no registro de peso do aluno', OBJETIVO: 'Guardar no objetivo do cadastro do aluno', CPF: 'Guardar no CPF do cadastro do aluno',
  TELEFONE: 'Guardar no telefone do cadastro do aluno', ENDERECO: 'Guardar no endereço do cadastro do aluno',
  SEXO: 'Guardar no sexo do cadastro do aluno',
};
const AJUDA_DO_DESTINO: Record<Exclude<DestinoNoPerfil, 'PESO'>, string> = {
  OBJETIVO: `Até ${L.objetivoTamanho} caracteres. Objetivo vazio é preenchido; se já houver outro, a mudança fica para você revisar na ficha.`,
  CPF: 'A resposta precisa ser um CPF válido. CPF vazio é preenchido; se já houver outro, ou se for de outro aluno, a mudança fica para você revisar na ficha.',
  TELEFONE: 'Vale para quem já tem acesso. Telefone vazio é preenchido; se já houver outro, a mudança fica para você revisar na ficha.',
  ENDERECO: 'Endereço vazio é preenchido; se já houver outro, a mudança fica para você revisar na ficha.',
  SEXO: 'Sexo vazio é preenchido; se já houver outro, a mudança fica para você revisar na ficha. Uma opção sem valor, como “Prefiro não dizer”, não muda o cadastro.',
};
const SEM_DESTINO = '__nenhum__';

/**
 * "Guardar no cadastro do aluno" (só na anamnese): peso → registro de peso, texto curto → objetivo ou CPF, telefone →
 * telefone, endereço → endereço. Campo vazio é preenchido no envio; com outro valor, a mudança fica para a equipe
 * revisar na ficha. No peso, escolhe a data: a de uma pergunta de data "só hoje ou antes" ou a do envio (o aluno vê
 * qual vale). Um destino possível = interruptor; mais de um (texto curto) = escolha entre eles.
 */
function DestinoNoCadastro({ pergunta: p, conteudo, finalidade, aoMudar }: {
  pergunta: PerguntaAtualizacao; conteudo: ConteudoQuestionario; finalidade: FinalidadeQuestionario;
  aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void;
}) {
  const possiveis = destinosPossiveis(p.tipo, finalidade);
  if (possiveis.length === 0) return null;
  const peso = p.destino === 'PESO';
  const datas = datasDaPesagem(conteudo);
  const dataEscolhida = datas.find((d) => d.id === p.destinoData);
  const ajudaDe = (d: DestinoNoPerfil) => (d === 'PESO'
    ? 'Sem peso na data, entra no registro. Com outro peso na mesma data, nada é trocado: a mudança fica para você revisar na ficha.' : AJUDA_DO_DESTINO[d]);
  const escolha = possiveis.length > 1;
  const livres = possiveis.filter((d) => d === p.destino || podeUsarDestino(conteudo, p.id, d, finalidade).pode);
  // Um destino só: se outra pergunta já o usa, o motivo no lugar do interruptor. Vários: só os livres entram na escolha.
  if (!escolha && !p.destino && livres.length === 0) return <Texto variante="pequeno">{podeUsarDestino(conteudo, p.id, possiveis[0], finalidade).motivo}</Texto>;
  return <View style={estilos.bloco}>
    {escolha ? (
      <Escolha rotulo="Guardar no cadastro do aluno" valor={p.destino ?? SEM_DESTINO}
        opcoes={[{ valor: SEM_DESTINO, rotulo: 'Não guardar' }, ...livres.map((d) => ({ valor: d as string, rotulo: ROTULO_DO_DESTINO[d] }))]}
        aoMudar={(v) => aoMudar({ destino: v === SEM_DESTINO ? undefined : (v as DestinoNoPerfil), destinoData: undefined })} />
    ) : (
      <Interruptor rotulo={ROTULO_DO_INTERRUPTOR[possiveis[0]]} valor={p.destino === possiveis[0]}
        aoMudar={(ligar) => aoMudar({ destino: ligar ? possiveis[0] : undefined, destinoData: undefined })} ajuda={ajudaDe(possiveis[0])} />
    )}
    {escolha && p.destino ? <Texto variante="pequeno">{ajudaDe(p.destino)}</Texto> : null}
    {p.destino && peso ? <>
      <EscolhaEmFolha rotulo="Data da pesagem" titulo="Data da pesagem" valor={dataEscolhida ? dataEscolhida.id : SEM_DATA}
        opcoes={[{ valor: SEM_DATA, rotulo: 'Data do envio' }, ...datas.map((d) => ({ valor: d.id, rotulo: d.rotulo }))]}
        aoMudar={(id) => aoMudar({ destinoData: id === SEM_DATA ? undefined : id })} />
      <Texto variante="pequeno">{dataEscolhida
        ? `O peso entra com a data respondida em “${dataEscolhida.rotulo}”; sem resposta, com a data do envio. O aluno vê isso embaixo da pergunta.`
        : datas.length ? 'O peso entra com a data do envio. O aluno vê isso embaixo da pergunta.'
          : 'O peso entra com a data do envio. Para usar a data da pesagem, adicione uma pergunta de data com “Só hoje ou antes”.'}</Texto>
      {p.destinoData && !dataEscolhida ? <Texto variante="pequeno">A data escolhida antes não é mais uma pergunta de data só no passado. Escolha outra.</Texto> : null}
    </> : null}
  </View>;
}

/** Imagem da pergunta ou da opção: envia, mostra e tira. */
function ImagemDoItem({ imagemId, rotulo, aoMudar, compacta }: { imagemId?: string; rotulo: string; aoMudar: (id: string | undefined) => void; compacta?: boolean }) {
  const { avisar } = useAviso();
  const [enviando, setEnviando] = useState(false);
  const enviar = () => {
    setEnviando(true);
    escolherEEnviarImagem().then((id) => { if (id) aoMudar(id); }, (e: unknown) => avisar(e instanceof FotoRecusada ? e.message : textoDoErro(e), 'perigo'))
      .finally(() => setEnviando(false));
  };
  return <View style={estilos.bloco}>
    {compacta ? null : <Texto variante="rotulo">{rotulo}</Texto>}
    {imagemId ? <ImagemDaPergunta id={imagemId} descricao={rotulo} pequena={compacta} /> : null}
    <View style={estilos.linha}>
      <Botao rotulo={imagemId ? 'Trocar imagem' : compacta ? 'Imagem' : 'Enviar imagem'} tipo="secundario" Icone={ImagePlus} carregando={enviando} aoTocar={enviar} />
      {imagemId ? <Botao rotulo="Tirar imagem" tipo="perigoTexto" aoTocar={() => aoMudar(undefined)} /> : null}
    </View>
    {compacta || imagemId ? null : <Texto variante="pequeno">PNG ou JPEG; o app reduz para caber em 300 KB. {AVISO_LICENCA}</Texto>}
  </View>;
}

/** Opções de escolha, linhas e colunas da grade: texto, ordem e (só nas opções) imagem. */
function ListaDeItens({ titulo, itens, minimo, maximo, nome, comImagem, sexo, aoMudar }: {
  titulo: string; itens: OpcaoPergunta[]; minimo: number; maximo: number; nome: string; comImagem?: boolean; sexo?: boolean;
  aoMudar: (itens: OpcaoPergunta[]) => void;
}) {
  const mudar = (i: number, parcial: Partial<OpcaoPergunta>) => aoMudar(substituir(itens, i, { ...itens[i], ...parcial }));
  const Nome = `${nome[0].toUpperCase()}${nome.slice(1)}`;
  return <View style={estilos.bloco}>
    <Texto variante="rotulo">{`${titulo} (${itens.length} de ${maximo})`}</Texto>
    {itens.map((o, i) => <View key={o.id} style={estilos.bloco}>
      <View style={estilos.opcao}>
        <View style={estilos.campoOpcao}><Campo rotulo={`${Nome} ${i + 1}`} valor={o.rotulo} maxLength={L.opcaoTamanho} aoMudar={(rotulo) => mudar(i, { rotulo })} /></View>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nome} ${i + 1}`} desabilitado={i === 0} aoTocar={() => aoMudar(mover(itens, i, -1))} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nome} ${i + 1}`} desabilitado={i === itens.length - 1} aoTocar={() => aoMudar(mover(itens, i, 1))} />
        <IconeBotao Icone={Trash2} rotulo={`Remover ${nome} ${i + 1}`} desabilitado={itens.length <= minimo} aoTocar={() => aoMudar(remover(itens, i))} />
      </View>
      {comImagem ? <ImagemDoItem imagemId={o.imagemId} rotulo={`Imagem da ${nome} ${i + 1}`} compacta aoMudar={(imagemId) => mudar(i, { imagemId })} /> : null}
      {sexo ? <Escolha rotulo="No cadastro" valor={o.valorNoCadastro ?? ''} aoMudar={(valor) => mudar(i, { valorNoCadastro: valor || undefined })}
        opcoes={[{ valor: '', rotulo: '—' }, { valor: 'MASCULINO', rotulo: 'Masculino' }, { valor: 'FEMININO', rotulo: 'Feminino' }, { valor: 'OUTRO', rotulo: 'Outro' }]} /> : null}
    </View>)}
    <View style={estilos.linha}>
      <Botao rotulo={`Adicionar ${nome}`} tipo="secundario" Icone={Plus} desabilitado={itens.length >= maximo}
        motivo={`No máximo ${maximo}.`} aoTocar={() => aoMudar([...itens, novaOpcao()])} />
    </View>
    {comImagem ? <Texto variante="pequeno">{AVISO_LICENCA}</Texto> : null}
  </View>;
}

/**
 * "Mostrar só se...": escolhe uma pergunta de escolha anterior e as respostas que mostram esta pergunta (ou seção).
 * Escondida, não é obrigatória e a resposta dela não é enviada.
 */
export function EditorDeCondicao({ conteudo, perguntaId, secao, condicao, aoMudar }: {
  conteudo: ConteudoQuestionario; perguntaId?: string; secao?: number; condicao?: PerguntaAtualizacao['mostrarSe'];
  aoMudar: (condicao: PerguntaAtualizacao['mostrarSe']) => void;
}) {
  const posicao = perguntaId ? posicaoDaPergunta(conteudo, perguntaId) : secao != null ? { secao, pergunta: -1 } : null;
  const controles = posicao ? controlesAnteriores(conteudo, posicao.secao, posicao.pergunta) : [];
  const ligado = !!condicao;
  if (!ligado && controles.length === 0) {
    return <Texto variante="pequeno">{perguntaId ? 'Para mostrar esta pergunta só em alguns casos, ponha antes dela uma pergunta de escolha ou de sim ou não.'
      : 'Para mostrar esta seção só em alguns casos, ponha numa seção anterior uma pergunta de escolha ou de sim ou não.'}</Texto>;
  }
  const alvo = controles.find((c) => c.id === condicao?.perguntaId);
  return <View style={estilos.bloco}>
    <Interruptor rotulo={perguntaId ? 'Mostrar só conforme uma resposta anterior' : 'Mostrar a seção só conforme uma resposta anterior'} valor={ligado}
      aoMudar={(ligar) => aoMudar(ligar ? condicaoPara(controles[0]?.id ?? '') : undefined)} />
    {ligado ? <>
      <EscolhaEmFolha rotulo="Pergunta" valor={condicao?.perguntaId ?? ''} rotuloDoValor="escolher"
        opcoes={controles.map((c) => ({ valor: c.id, rotulo: c.rotulo }))} aoMudar={(id) => aoMudar(condicaoPara(id))} />
      {alvo ? <SelecaoMultipla rotulo="Mostrar quando a resposta for" opcoes={alvo.valores} marcados={new Set(condicao?.valores ?? [])}
        aoMudar={(marcados) => aoMudar({ perguntaId: alvo.id, valores: alvo.valores.map((v) => v.valor).filter((v) => marcados.has(v)) })} />
        : <Texto variante="pequeno">A pergunta escolhida não está mais antes desta. Escolha outra.</Texto>}
    </> : null}
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  // Dois campos lado a lado no PC; no celular cada um ocupa a linha.
  lado: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  inicioDaEscala: { flexShrink: 0 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  opcao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoOpcao: { flex: 1 },
});
