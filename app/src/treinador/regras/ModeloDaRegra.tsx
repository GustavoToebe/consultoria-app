import { Plus, Trash2 } from 'lucide-react-native';
import { useId, type ReactNode, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { Switch } from '../../components/ui/switch';
import type { PerguntaDaRegra } from '../../api/tipos';
import type { OpcaoSuspensa } from '../../dominio/escolhaSuspensa';
import { contornoDoCartao } from '../../dominio/preferencias';
import {
  fraseDaRegra, perguntaDaRegra, perguntaFora, perguntasDoModelo, TEXTOS_DAS_REGRAS, textoDosQuestionarios,
  type ErrosDaRegra, type ModeloDeRegra, type RegraEmEdicao,
} from '../../dominio/regrasDeAtencao';
import { useTema } from '../../tema/TemaProvider';
import { contornoDoCampoPintado } from './cartaoDaRegra';
import { ALVO_TOQUE, espaco, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';

/** O que o cartão do modelo pede ao formulário (o rascunho mora lá; aqui só se desenha e se avisa). */
export interface AcoesDoModelo {
  alternar: (ligar: boolean) => void;
  mudar: (chave: string, parcial: Partial<Pick<RegraEmEdicao, 'perguntaId' | 'limite'>>) => void;
  sairDoNumero: (chave: string) => void;
  adicionar: () => void;
  remover: (chave: string) => void;
  /** Erro visível de um campo da regra (o local depois de tocado ou de tentar salvar, ou o do 422). */
  erro: (chave: string, campo: keyof ErrosDaRegra) => string | undefined;
  refDoNumero: (chave: string) => Ref<TextInput>;
}

const SEM_PERGUNTA_LIVRE = 'Todas as perguntas deste tipo já têm uma regra.';

/**
 * Casca do cartão de um modelo na grade de Configurações › Regras de atenção (28/11): título e o controle no topo, a
 * descrição curta embaixo e o conteúdo. Ligado, o cartão é pintado com a cor de ação (`ui/superficiePintada`, como o
 * `AvisoDePlanoNovo`) e ganha a borda na mesma cor, por pedido do Gustavo (exceção à seleção neutra e à borda neutra da
 * pintura); desligado, a superfície e o contorno neutros do `Cartao`. Não usa o `Cartao`: a faixa do título pintaria
 * `superficie` por cima da pintura. A edição e a leitura usam a mesma casca.
 */
export function CascaDaRegra({ modelo, ligado, controle, children }: {
  modelo: ModeloDeRegra;
  ligado: boolean;
  controle?: ReactNode;
  children?: ReactNode;
}) {
  const { cores, bordas, variante, preferencias } = useTema();
  const { width } = useWindowDimensions();
  const pintura = ligado ? superficiePintada(cores.acao, cores.superficie, variante, cores) : null;
  return (
    <View testID={`regra-${modelo.tipo}`}
      style={[
        estilos.cartao,
        { padding: espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2), borderWidth: bordas.bloco, boxShadow: cores.sombra },
        pintura ? [fundoPintado(pintura), { borderColor: cores.acao }] : { backgroundColor: cores.superficie, borderColor: contornoDoCartao(cores, preferencias.contraste) },
      ]}>
      <View style={estilos.cabeca}>
        <View style={estilos.titulo}>
          <Texto variante="bloco" nivel={3}>{modelo.titulo}</Texto>
          <Texto variante="suave">{modelo.descricao}</Texto>
        </View>
        {controle ?? null}
      </View>
      {children}
    </View>
  );
}

/**
 * Um dos 6 modelos, editável: o interruptor no topo (o nome acessível é o título) e, ligado (ou com erro numa regra gravada
 * desligada), o valor numa frase com o campo no meio ("Avisar quando uma nota cair [2] pontos ou mais"; o número é sempre
 * do treinador, nunca sugerido) e, nos modelos de pergunta, a escolha da pergunta (`EscolhaSuspensa`) com "Adicionar outra
 * pergunta". O modelo de pergunta sem nenhuma pergunta do tipo nos questionários publicados fica desligado, com o
 * interruptor visivelmente indisponível, o selo do que falta e "Ver questionários"; ligado assim (a pergunta sumiu depois),
 * o interruptor continua livre para desligar.
 */
export function ModeloDaRegra({ modelo, regras, ligado, aberto, perguntas, teto, acoes, podeVerQuestionarios }: {
  modelo: ModeloDeRegra;
  /** As regras deste modelo no rascunho. */
  regras: readonly RegraEmEdicao[];
  ligado: boolean;
  /** Mostrar os campos (ligado, ou uma regra deste modelo tem erro a corrigir). */
  aberto: boolean;
  perguntas: readonly PerguntaDaRegra[];
  /** Motivo do "Adicionar outra pergunta" desligado pelo teto da consultoria; nulo = cabe. */
  teto: string | null;
  acoes: AcoesDoModelo;
  podeVerQuestionarios: boolean;
}) {
  const doTipo = perguntasDoModelo(modelo.tipo, perguntas);
  const semPergunta = !!modelo.pergunta && doTipo.length === 0;
  const indisponivel = semPergunta && !ligado;
  const usadas = new Set(regras.map((r) => r.perguntaId).filter((id): id is string => !!id));
  const livres = doTipo.filter((p) => !usadas.has(p.perguntaId));
  const motivoDoAdicionar = teto ?? (livres.length === 0 ? SEM_PERGUNTA_LIVRE : null);
  const fraseSemNumero = modelo.campo ? null : fraseDaRegra(modelo.tipo, '').antes;

  return (
    <CascaDaRegra modelo={modelo} ligado={ligado}
      controle={indisponivel
        ? <InterruptorIndisponivel rotulo={modelo.titulo} motivo={modelo.semPergunta ?? undefined} />
        : <Switch checked={ligado} onCheckedChange={acoes.alternar} accessibilityLabel={modelo.titulo} />}>
      {semPergunta && modelo.semPergunta ? (
        <View style={estilos.motivo}>
          <Selo texto={modelo.semPergunta} />
          {podeVerQuestionarios ? <LinkTexto href="/treinador/planejamento?aba=atualizacao" texto={TEXTOS_DAS_REGRAS.verQuestionarios} /> : null}
        </View>
      ) : null}
      {aberto ? (
        <View style={estilos.campos}>
          {fraseSemNumero ? <Texto>{fraseSemNumero}</Texto> : null}
          {regras.map((r) => (
            <LinhaDaRegra key={r.chave} modelo={modelo} regra={r} ligado={ligado} perguntas={perguntas}
              opcoes={opcoesDaLinha(r, doTipo, usadas)} removivel={regras.length > 1} acoes={acoes} />
          ))}
          {modelo.pergunta ? (
            <View style={estilos.adicionar}><Botao rotulo={TEXTOS_DAS_REGRAS.adicionarPergunta} rotuloAcessivel={`${TEXTOS_DAS_REGRAS.adicionarPergunta}: ${modelo.titulo}`}
              tipo="secundario" Icone={Plus} aoTocar={acoes.adicionar} desabilitado={!!motivoDoAdicionar} motivo={motivoDoAdicionar ?? undefined} /></View>
          ) : null}
        </View>
      ) : null}
    </CascaDaRegra>
  );
}

/**
 * O interruptor que não dá para ligar (falta pergunta do tipo): o desenho do `Switch` no cinza do desabilitado
 * (`ui/desabilitado`), para não parecer livre; o `Switch` desabilitado tem as cores do desligado normal.
 * shortcut: cópia local do desenho do `components/ui/switch`; troque pelo `Switch` quando ele tiver o visual de desabilitado.
 */
function InterruptorIndisponivel({ rotulo, motivo }: { rotulo: string; motivo?: string }) {
  const { cores } = useTema();
  const cinza = coresDoDesabilitado(cores);
  return (
    <View role="switch" aria-checked={false} aria-disabled accessibilityState={{ checked: false, disabled: true }}
      accessibilityLabel={rotulo} accessibilityHint={motivo} style={estilos.alvo}>
      <View style={[estilos.trilho, { backgroundColor: cinza.fundo, borderColor: cinza.borda }]}>
        <View style={[estilos.botao, { backgroundColor: cinza.borda }]} />
      </View>
    </View>
  );
}

/** Perguntas que a linha pode escolher: as do tipo que nenhuma outra linha do modelo usa, mais a atual (mesmo fora dos questionários). */
function opcoesDaLinha(regra: RegraEmEdicao, doTipo: readonly PerguntaDaRegra[], usadas: ReadonlySet<string>): OpcaoSuspensa<string | null>[] {
  const opcoes: OpcaoSuspensa<string | null>[] = doTipo
    .filter((p) => p.perguntaId === regra.perguntaId || !usadas.has(p.perguntaId))
    .map((p) => ({ valor: p.perguntaId, rotulo: p.rotulo, detalhe: textoDosQuestionarios(p) || undefined }));
  if (regra.perguntaId && !opcoes.some((o) => o.valor === regra.perguntaId)) {
    // Rótulo diferente do selo acima da escolha: o motivo aparece uma vez só.
    opcoes.unshift({ valor: regra.perguntaId, rotulo: 'Pergunta indisponível' });
  }
  return opcoes;
}

/**
 * Uma regra do modelo: nos de pergunta, a escolha (com a lixeira quando há mais de uma) e, na nota, a frase com o número;
 * nos de número, só a frase. Com mais de uma pergunta, cada linha vai num poço `superficie2`, para separar as regras.
 */
function LinhaDaRegra({ modelo, regra, ligado, perguntas, opcoes, removivel, acoes }: {
  modelo: ModeloDeRegra;
  regra: RegraEmEdicao;
  ligado: boolean;
  perguntas: readonly PerguntaDaRegra[];
  opcoes: OpcaoSuspensa<string | null>[];
  removivel: boolean;
  acoes: AcoesDoModelo;
}) {
  const { cores } = useTema();
  const pergunta = perguntaDaRegra(regra.tipo, regra.perguntaId, perguntas);
  const fora = perguntaFora(regra, perguntas);
  const erroDaPergunta = acoes.erro(regra.chave, 'perguntaId');
  const escala = modelo.tipo === 'NOTA_ABAIXO' && pergunta?.escala ? `Escala desta pergunta: ${pergunta.escala.min} a ${pergunta.escala.max}.` : null;
  const nomeDaLinha = pergunta?.rotulo ?? modelo.titulo;
  // Ligado, o campo fica sobre a pintura (ou no poço `superficie2`): o contorno reforçado mantém 3:1 nos dois.
  const contorno = ligado ? contornoDoCampoPintado(cores) : undefined;
  const numero = modelo.campo ? <FraseComNumero modelo={modelo} regra={regra} acoes={acoes} ajuda={escala ?? modelo.ajuda} contorno={contorno} /> : null;

  if (!modelo.pergunta) return numero;

  return (
    <View style={[estilos.regra, removivel ? [estilos.poco, { backgroundColor: cores.superficie2 }] : null]}>
      {fora || (ligado && !regra.ativa) ? (
        <View style={estilos.selos}>
          {fora ? <Selo texto={TEXTOS_DAS_REGRAS.seloPerguntaFora} tipo="atencao" /> : null}
          {ligado && !regra.ativa ? <Selo texto={TEXTOS_DAS_REGRAS.desligada} /> : null}
        </View>
      ) : null}
      <View style={estilos.campo}>
        <View style={estilos.linhaDaPergunta}>
          <View style={estilos.escolha}>
            <EscolhaSuspensa<string | null> rotulo="Pergunta" titulo={`Pergunta: ${modelo.titulo}`} valor={regra.perguntaId} opcoes={opcoes}
              rotuloDaBusca="Buscar pergunta" textoVazio="Nenhuma pergunta encontrada."
              aoMudar={(v) => acoes.mudar(regra.chave, { perguntaId: v })}
              style={erroDaPergunta ? { borderColor: cores.perigo } : contorno ? { borderColor: contorno } : undefined} />
          </View>
          {removivel ? (
            <IconeBotao Icone={Trash2} moldura rotulo={`Remover a regra de ${nomeDaLinha}`} aoTocar={() => acoes.remover(regra.chave)} />
          ) : null}
        </View>
        {erroDaPergunta ? <MensagemDeErro erro={erroDaPergunta} /> : null}
        {fora ? <Texto variante="pequeno">{TEXTOS_DAS_REGRAS.ajudaPerguntaFora}</Texto> : null}
      </View>
      {numero}
    </View>
  );
}

/**
 * O valor numa frase: o texto, o campo estreito (o nome acessível é o rótulo do modelo, `campo`) e a unidade, quebrando
 * linha quando não cabe. O erro vai embaixo da frase inteira (`erroSemTexto`: a mensagem não cabe sob um campo de 80 px);
 * sem erro, a ajuda do modelo ou a escala da pergunta.
 */
function FraseComNumero({ modelo, regra, acoes, ajuda, contorno }: {
  modelo: ModeloDeRegra;
  regra: RegraEmEdicao;
  acoes: AcoesDoModelo;
  ajuda: string | null;
  /** Contorno do campo sobre o cartão pintado (`contornoDoCampoPintado`); sem ele, o de sempre. */
  contorno?: string;
}) {
  const id = useId();
  const frase = fraseDaRegra(modelo.tipo, regra.limite);
  const erro = acoes.erro(regra.chave, 'limite');
  if (!modelo.campo) return null;
  return (
    <View style={estilos.campo}>
      <View style={estilos.frase}>
        <Texto style={estilos.pedaco}>{frase.antes}</Texto>
        <View style={estilos.numero}>
          <Campo ref={acoes.refDoNumero(regra.chave)} numerico rotulo={modelo.campo} rotuloOculto valor={regra.limite} autoComplete="off"
            keyboardType={modelo.tipo === 'PESO_MUDOU' ? 'decimal-pad' : 'number-pad'} maxLength={5} centralizado
            aoMudar={(t) => acoes.mudar(regra.chave, { limite: t.replace(/[^\d,.]/g, '') })}
            onBlur={() => acoes.sairDoNumero(regra.chave)} erro={erro ?? null} erroSemTexto corDaBorda={contorno}
            ajudaForaDoCampo={ajuda && !erro ? { id, texto: ajuda } : undefined} />
        </View>
        {frase.depois ? <Texto style={estilos.pedaco}>{frase.depois}</Texto> : null}
      </View>
      {erro ? <MensagemDeErro erro={erro} /> : ajuda ? <Texto variante="pequeno" nativeID={id}>{ajuda}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: RAIO, gap: espaco(2) },
  cabeca: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  // O título alinha ao meio do alvo de 44 px do interruptor.
  titulo: { flex: 1, minWidth: 0, gap: 2, paddingTop: espaco(1.25) },
  motivo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  campos: { gap: espaco(2), alignItems: 'stretch' },
  adicionar: { alignItems: 'flex-start' },
  regra: { gap: espaco(1.5) },
  poco: { borderRadius: RAIO_CONTROLE, padding: espaco(1.5) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campo: { gap: espaco(0.5) },
  linhaDaPergunta: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  escolha: { flex: 1, minWidth: 0, maxWidth: 420 },
  frase: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  pedaco: { flexShrink: 1 },
  numero: { width: 80 },
  // O alvo e o desenho do `components/ui/switch` (44 px; trilho 40 × 24, raio 8; botão 18), com a borda do desabilitado.
  alvo: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  trilho: { width: 40, height: 24, borderRadius: 8, borderWidth: 1, padding: 2 },
  botao: { width: 18, height: 18, borderRadius: 6 },
});
