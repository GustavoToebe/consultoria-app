import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario, PerguntaAtualizacao } from '../../api/tipos';
import { aceitaAjudaAutomatica, aceitaDestaque, aceitaObrigatoria, novaOpcao, podeDestacar } from '../../dominio/editorQuestionario';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { LIMITES_QUESTIONARIO as L, temOpcoes } from '../../dominio/questionario';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { SelecaoMultipla } from '../../ui/SelecaoMultipla';
import { Texto } from '../../ui/Texto';

const CASAS = [{ valor: 0, rotulo: '0' }, { valor: 1, rotulo: '1' }, { valor: 2, rotulo: '2' }];
const DIAS = Array.from({ length: L.diaValorMaximo }, (_, i) => ({ valor: String(i + 1), rotulo: `Dia ${i + 1}` }));

/**
 * Propriedades de uma pergunta, por tipo. O tipo nunca muda aqui (a resposta já gravada depende dele): para trocar,
 * remova a pergunta e adicione outra.
 */
export function PropriedadesDaPergunta({ pergunta: p, conteudo, problemas, somenteLeitura, aoMudar }: {
  pergunta: PerguntaAtualizacao; conteudo: ConteudoQuestionario; problemas: string[]; somenteLeitura?: boolean;
  aoMudar: (parcial: Partial<PerguntaAtualizacao>) => void;
}) {
  const { cores } = useTema();
  const opcoes = p.opcoes ?? [];
  const destaque = podeDestacar(conteudo, p.id);
  const mudarOpcao = (indice: number, rotulo: string) => aoMudar({ opcoes: substituir(opcoes, indice, { ...opcoes[indice], rotulo }) });
  if (somenteLeitura) return <Texto variante="suave">{p.ajuda || 'Sem texto de ajuda.'}</Texto>;
  return <View style={estilos.bloco}>
    {problemas.map((m) => <Texto key={m} variante="pequeno" cor={cores.perigo}>{m}</Texto>)}
    <Campo rotulo="Texto da pergunta" valor={p.rotulo} maxLength={L.rotuloTamanho} aoMudar={(rotulo) => aoMudar({ rotulo })} />
    <Campo rotulo="Ajuda para o aluno (opcional)" valor={p.ajuda ?? ''} maxLength={L.ajudaTamanho} linhas={2} aoMudar={(ajuda) => aoMudar({ ajuda })} />
    {aceitaObrigatoria(p.tipo) ? <Interruptor rotulo="Obrigatória" valor={p.obrigatoria} aoMudar={(obrigatoria) => aoMudar({ obrigatoria })} /> : null}
    {p.tipo === 'PESO' ? <Texto variante="suave">A resposta vai para o registro de peso do aluno.</Texto> : null}
    {p.tipo === 'DATA_AUTOMATICA' ? <Texto variante="suave">Mostra a data da atualização; o aluno não responde.</Texto> : null}
    {p.tipo === 'FOTOS' ? <Texto variante="suave">Envio de fotos ainda não implementado.</Texto> : null}

    {temOpcoes(p.tipo) ? <View style={estilos.bloco}>
      <Texto variante="rotulo">Opções ({opcoes.length} de {L.opcoesMaximo})</Texto>
      {opcoes.map((o, i) => <View key={o.id} style={estilos.opcao}>
        <View style={estilos.campoOpcao}><Campo rotulo={`Opção ${i + 1}`} valor={o.rotulo} maxLength={L.opcaoTamanho} aoMudar={(r) => mudarOpcao(i, r)} /></View>
        <IconeBotao Icone={ArrowUp} rotulo={`Subir opção ${i + 1}`} desabilitado={i === 0} aoTocar={() => aoMudar({ opcoes: mover(opcoes, i, -1) })} />
        <IconeBotao Icone={ArrowDown} rotulo={`Descer opção ${i + 1}`} desabilitado={i === opcoes.length - 1} aoTocar={() => aoMudar({ opcoes: mover(opcoes, i, 1) })} />
        <IconeBotao Icone={Trash2} rotulo={`Remover opção ${i + 1}`} desabilitado={opcoes.length <= L.opcoesMinimo} aoTocar={() => aoMudar({ opcoes: remover(opcoes, i) })} />
      </View>)}
      <View style={estilos.linha}>
        <Botao rotulo="Adicionar opção" tipo="secundario" Icone={Plus} desabilitado={opcoes.length >= L.opcoesMaximo}
          motivo={`No máximo ${L.opcoesMaximo} opções.`} aoTocar={() => aoMudar({ opcoes: [...opcoes, novaOpcao()] })} />
      </View>
    </View> : null}

    {p.tipo === 'NUMERO' ? <View style={estilos.bloco}>
      <Campo rotulo="Unidade (opcional, ex.: kg, passos)" valor={p.unidade ?? ''} maxLength={L.unidadeTamanho} aoMudar={(unidade) => aoMudar({ unidade })} />
      <CampoNumerico rotulo="Valor mínimo (opcional)" valor={p.min ?? null} aoMudar={(min) => aoMudar({ min: min ?? undefined })} />
      <CampoNumerico rotulo="Valor máximo (opcional)" valor={p.max ?? null} aoMudar={(max) => aoMudar({ max: max ?? undefined })} />
      <Escolha rotulo="Casas decimais" opcoes={CASAS} valor={p.casas ?? 0} aoMudar={(casas) => aoMudar({ casas })} />
    </View> : null}

    {p.tipo === 'NOTAS_POR_DIA' ? <SelecaoMultipla rotulo={`Dias que o aluno avalia (até ${L.diasMaximo})`} opcoes={DIAS} limite={L.diasMaximo}
      marcados={new Set((p.dias ?? []).map(String))}
      aoMudar={(marcados) => aoMudar({ dias: [...marcados].map(Number).sort((a, b) => a - b) })} /> : null}

    {aceitaAjudaAutomatica(p.tipo) ? <Interruptor rotulo="Mostrar a média de dias com treino como ajuda"
      valor={p.ajudaAutomatica === 'MEDIA_DIAS_TREINO'} aoMudar={(ligado) => aoMudar({ ajudaAutomatica: ligado ? 'MEDIA_DIAS_TREINO' : undefined })} /> : null}

    {aceitaDestaque(p.tipo) ? (destaque.pode || p.destaque === true
      ? <View style={estilos.bloco}>
        <Interruptor rotulo="Mostrar no resumo do treinador" valor={p.destaque === true} aoMudar={(ligado) => aoMudar({ destaque: ligado, rotuloCurto: ligado ? p.rotuloCurto : undefined })} />
        {p.destaque === true ? <Campo rotulo="Nome curto no resumo (opcional)" valor={p.rotuloCurto ?? ''} maxLength={L.rotuloCurtoTamanho} aoMudar={(rotuloCurto) => aoMudar({ rotuloCurto })} /> : null}
      </View>
      : <Texto variante="pequeno">{destaque.motivo}</Texto>) : null}
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  opcao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoOpcao: { flex: 1 },
});
