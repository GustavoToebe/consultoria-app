import { Plus, Trash2 } from 'lucide-react-native';
import type { Ref } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import type { PerguntaDaRegra } from '../../api/tipos';
import type { OpcaoSuspensa } from '../../dominio/escolhaSuspensa';
import {
  perguntaDaRegra, perguntaFora, perguntasDoModelo, TEXTOS_DAS_REGRAS, textoDosQuestionarios,
  type ErrosDaRegra, type ModeloDeRegra, type RegraEmEdicao,
} from '../../dominio/regrasDeAtencao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO_CONTROLE } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { LinhaDeOpcao } from '../financeiro/AjustesDaAba';

/** O que a linha do modelo pede ao formulário (o rascunho mora lá; aqui só se desenha e se avisa). */
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
 * Um dos 6 modelos em Configurações › Regras de atenção: título, descrição e o interruptor (a linha de opção das abas de
 * ajustes do Financeiro). Ligado (ou com erro numa regra gravada desligada), mostra os campos: o número digitado pelo
 * treinador (nunca sugerido) e, nos modelos de pergunta, uma linha por pergunta com "Adicionar outra pergunta". O modelo de
 * pergunta sem nenhuma pergunta do tipo nos questionários publicados nasce com o interruptor desligado e o motivo.
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
  const usadas = new Set(regras.map((r) => r.perguntaId).filter((id): id is string => !!id));
  const livres = doTipo.filter((p) => !usadas.has(p.perguntaId));
  const motivoDoAdicionar = teto ?? (livres.length === 0 ? SEM_PERGUNTA_LIVRE : null);

  return (
    <LinhaDeOpcao titulo={modelo.titulo} descricao={modelo.descricao}
      interruptor={{ valor: ligado, aoMudar: acoes.alternar, desabilitado: semPergunta && !ligado }}>
      {semPergunta && modelo.semPergunta ? (
        <View style={estilos.motivo}>
          <Texto variante="pequeno">{modelo.semPergunta}</Texto>
          {podeVerQuestionarios ? <LinkTexto href="/treinador/planejamento?aba=atualizacao" texto={TEXTOS_DAS_REGRAS.verQuestionarios} /> : null}
        </View>
      ) : null}
      {aberto ? (
        <View style={estilos.campos}>
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
    </LinhaDeOpcao>
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
  const erroDoNumero = acoes.erro(regra.chave, 'limite');
  const escala = modelo.tipo === 'NOTA_ABAIXO' && pergunta?.escala ? `Escala desta pergunta: ${pergunta.escala.min} a ${pergunta.escala.max}.` : undefined;
  const nomeDaLinha = pergunta?.rotulo ?? modelo.titulo;

  const numero = modelo.campo ? (
    <Campo ref={acoes.refDoNumero(regra.chave)} numerico rotulo={modelo.campo} valor={regra.limite} autoComplete="off"
      keyboardType={modelo.tipo === 'PESO_MUDOU' ? 'decimal-pad' : 'number-pad'} maxLength={5}
      aoMudar={(t) => acoes.mudar(regra.chave, { limite: t.replace(/[^\d,.]/g, '') })}
      onBlur={() => acoes.sairDoNumero(regra.chave)} erro={erroDoNumero ?? null} ajuda={escala} />
  ) : null;

  // Só o número (Nota que caiu, Peso mudou, Poucos dias com treino): o campo sozinho, sem caixa em volta.
  if (!modelo.pergunta) return <View style={estilos.soNumero}>{numero}</View>;

  return (
    <View style={[estilos.regra, { backgroundColor: cores.superficie2 }]}>
      {fora || (ligado && !regra.ativa) ? (
        <View style={estilos.selos}>
          {fora ? <Selo texto={TEXTOS_DAS_REGRAS.seloPerguntaFora} tipo="atencao" /> : null}
          {ligado && !regra.ativa ? <Selo texto={TEXTOS_DAS_REGRAS.desligada} /> : null}
        </View>
      ) : null}
      {/* Pergunta e número empilhados: a escolha tem o rótulo dentro da caixa e o campo, acima; lado a lado as bases não se
          alinhavam. Remover é a lixeira ao lado da pergunta (só com mais de uma linha no modelo). */}
      <View style={estilos.campo}>
        <View style={estilos.linhaDaPergunta}>
          <View style={estilos.escolha}>
            <EscolhaSuspensa<string | null> rotulo="Pergunta" titulo={`Pergunta: ${modelo.titulo}`} valor={regra.perguntaId} opcoes={opcoes}
              rotuloDaBusca="Buscar pergunta" textoVazio="Nenhuma pergunta encontrada."
              aoMudar={(v) => acoes.mudar(regra.chave, { perguntaId: v })}
              style={erroDaPergunta ? { borderColor: cores.perigo } : undefined} />
          </View>
          {removivel ? (
            <IconeBotao Icone={Trash2} moldura rotulo={`Remover a regra de ${nomeDaLinha}`} aoTocar={() => acoes.remover(regra.chave)} />
          ) : null}
        </View>
        {erroDaPergunta ? <MensagemDeErro erro={erroDaPergunta} /> : null}
        {fora ? <Texto variante="pequeno">{TEXTOS_DAS_REGRAS.ajudaPerguntaFora}</Texto> : null}
      </View>
      {numero ? <View style={estilos.soNumero}>{numero}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  motivo: { gap: espaco(0.5), alignItems: 'flex-start' },
  campos: { gap: espaco(1.5), alignItems: 'stretch' },
  adicionar: { alignItems: 'flex-start' },
  regra: { borderRadius: RAIO_CONTROLE, padding: espaco(1.5), gap: espaco(1.5) },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  campo: { gap: espaco(0.5) },
  linhaDaPergunta: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  escolha: { flex: 1, minWidth: 0, maxWidth: 420 },
  soNumero: { maxWidth: 320 },
});
