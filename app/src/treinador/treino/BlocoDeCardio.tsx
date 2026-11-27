import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Cardio, MedidaDeCardio, ModoDeCardio, ProtocoloDeCardio, TipoDeRecuperacao } from '../../api/tipos';
import { SECAO_CARDIO_E_HIIT } from '../../ajuda/conteudo';
import { lerQuantidade, opcoesDeQuantidade } from '../../dominio/camposDaSerie';
import {
  alterarIntervalado, avisoDoIntervaladoAntigo, avisoDoIntervaladoDesligado, avisoForaDaFaixa, comEsforco, definicaoDoProtocolo, esforcoDoBloco, lerTempo, modoDoBloco,
  mostraMedida, opcoesDeEsforco, opcoesDeTempo, padraoDoProtocolo, previaDoBloco, PROTOCOLOS, protocoloDoBloco, resumoDoBloco, ritmoTexto,
  tempoCurto, textoDoAquecimento, trocarModoDoBloco, type CampoDeTempo, type EsforcoDoBloco,
} from '../../dominio/cardio';
import { escalar } from '../../dominio/preferencias';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';
import { BotaoDeInfo, Explicacao } from './BotaoDeAbrir';
import { AvisoDoCampo, ErroDoCampo } from './CamposBasicos';
import { Faixa, ParaOAluno, type Nivel } from './EditorDoGrupoDeSeries';

const MODOS: { valor: ModoDeCardio; rotulo: string }[] = [{ valor: 'CONTINUO', rotulo: 'Contínuo' }, { valor: 'INTERVALADO', rotulo: 'Intervalado' }];
/** Chave `cardioIntervaladoHabilitado` desligada (D16): só o contínuo, que sai com as chaves de sempre. */
const SO_CONTINUO = MODOS.slice(0, 1);
const AJUDA_DO_SO_CONTINUO = 'O intervalado ainda não foi liberado: por enquanto, só contínuo.';
const PROTOCOLOS_DO_SELECT = PROTOCOLOS.map((p) => ({ valor: p.codigo, rotulo: p.rotulo, detalhe: p.definicao }));
const RECUPERACOES: { valor: TipoDeRecuperacao | null; rotulo: string }[] = [{ valor: 'ATIVA', rotulo: 'Ativa' }, { valor: 'PASSIVA', rotulo: 'Passiva' }];
const AJUDA_DO_TEMPO = 'Use 30 s, 1:30 ou 2 min, até 60 min.';
/** Os campos que esta tela mostra; erro de outro campo (dado antigo) vai numa linha no fim, para nunca sumir. */
const CAMPOS_NA_TELA = new Set(['duracaoMin', 'distanciaKm', 'ritmo', 'zona', 'esforcoMaximo', 'protocolo', 'aquecimentoSeg', 'desaquecimentoSeg',
  'intervalos.trabalhoSeg', 'intervalos.descansoSeg', 'intervalos.voltas']);
/** Tempo e voltas: selects curtos "Digite ou escolha", como o descanso da série; o protocolo, até 320 px. */
const LARGURA_DO_TEMPO = 168;
const LARGURA_DO_PROTOCOLO = 320;

/**
 * O bloco de cardio aberto (docs/planos/cardio-e-hiit.md, P2): o segmento Contínuo · Intervalado e os campos do modo. O
 * contínuo tem duração, distância e ritmo (as medidas que a biblioteca marcou, `mostraMedida`) e a zona. O intervalado tem
 * o protocolo (com o ⓘ e o "Saiba mais" da Ajuda), os tempos "Digite ou escolha" (`segundosDoTexto`), as voltas, o tipo da
 * recuperação e o esforço (zona ou máximo), com o resumo `resumoDoBloco` e o aviso de fora da faixa, que não bloqueia. Os
 * erros são os de `erroDoBloco`, no campo, os mesmos que o servidor devolve. No rodapé, "Para o aluno" (`previaDoBloco`).
 * Com `intervaladoLiberado` falso (D16) o segmento só tem o contínuo e o intervalado que já existe fica só para leitura,
 * com o aviso (`avisoDoIntervaladoDesligado`): "Contínuo" e "Excluir bloco" continuam valendo.
 */
export function BlocoDeCardio({ cardio: c, numero, erros, medidas, nivel, intervaladoLiberado, aoMudar, aoRemover, aoFechar }: {
  cardio: Cardio; numero: number; erros: Problemas; medidas: readonly MedidaDeCardio[] | null | undefined; nivel: Nivel;
  intervaladoLiberado: boolean; aoMudar: (c: Cardio) => void; aoRemover: () => void; aoFechar: () => void;
}) {
  const modo = modoDoBloco(c);
  const travado = avisoDoIntervaladoDesligado(c, intervaladoLiberado);
  const resumo = resumoDoBloco(c);
  const outros = Object.entries(erros).filter(([campo]) => !CAMPOS_NA_TELA.has(campo)).map(([, m]) => m);
  return <View style={estilos.corpo}>
    <View style={estilos.modo}>
      <Escolha descricao={`Modo do bloco ${numero}`} opcoes={intervaladoLiberado ? MODOS : SO_CONTINUO} valor={modo} aoMudar={(m) => aoMudar(trocarModoDoBloco(c, m))} />
      {intervaladoLiberado ? null : <Texto variante="pequeno" cor="suave">{AJUDA_DO_SO_CONTINUO}</Texto>}
    </View>
    {travado ? <Alerta tom="atencao" texto={travado} /> : null}
    {modo === 'CONTINUO'
      ? <Continuo c={c} erros={erros} medidas={medidas} aoMudar={aoMudar} />
      : travado
        ? (resumo ? <Texto numerico>{resumo}</Texto> : null)
        : <Intervalado c={c} erros={erros} aoMudar={aoMudar} />}
    {outros.map((m) => <ErroDoCampo key={m} mensagem={m} />)}

    <Faixa>
      <View style={estilos.rodape}>
        <ParaOAluno nivel={nivel} cor={null} texto={previaDoBloco(c)} descanso={null} extra={textoDoAquecimento(c)} />
        <LinhaDeAcoes alinhar="fim" style={estilos.acoesDoRodape}>
          <Botao tipo="perigoTexto" rotulo="Excluir bloco" rotuloAcessivel={`Excluir bloco ${numero}`} Icone={Trash2} aoTocar={aoRemover} />
          <Botao tipo="secundario" rotulo="Fechar edição" rotuloAcessivel={`Fechar edição do bloco ${numero}`} Icone={X} aoTocar={aoFechar} />
        </LinhaDeAcoes>
      </View>
    </Faixa>
  </View>;
}

function Continuo({ c, erros, medidas, aoMudar }: { c: Cardio; erros: Problemas; medidas: readonly MedidaDeCardio[] | null | undefined; aoMudar: (c: Cardio) => void }) {
  const mudar = (parte: Partial<Cardio>) => aoMudar({ ...c, ...parte });
  return <>
    <Faixa titulo="Volume">
      <View style={estilos.linha}>
        <View style={estilos.campo}><CampoNumerico rotulo="Duração" inteiro sufixo="min" valor={c.duracaoMin ?? null} aoMudar={(duracaoMin) => mudar({ duracaoMin })} erro={erros.duracaoMin} /></View>
        {mostraMedida('DISTANCIA', medidas, c)
          ? <View style={estilos.campo}><CampoNumerico rotulo="Distância" sufixo="km" valor={c.distanciaKm ?? null} aoMudar={(distanciaKm) => mudar({ distanciaKm })} erro={erros.distanciaKm} /></View>
          : null}
        {mostraMedida('RITMO', medidas, c)
          ? <View style={estilos.campoLargo}>
            {/* O ritmo é texto (D11): "6" ou "5:30" ganham " min/km" ao sair do campo; o que já veio escrito fica. */}
            <Campo rotulo="Ritmo (opcional)" valor={c.ritmo ?? ''} maxLength={40} placeholder="Ex.: 5:30"
              aoMudar={(t) => mudar({ ritmo: t.trim() ? t : null })}
              onBlur={() => { const r = ritmoTexto(c.ritmo); if (r !== (c.ritmo ?? null)) mudar({ ritmo: r }); }} erro={erros.ritmo} />
          </View>
          : null}
      </View>
    </Faixa>
    <Faixa titulo="Esforço">
      <Esforco c={c} modo="CONTINUO" erros={erros} aoMudar={mudar} />
    </Faixa>
  </>;
}

function Intervalado({ c, erros, aoMudar }: { c: Cardio; erros: Problemas; aoMudar: (c: Cardio) => void }) {
  const { fatorTexto } = useTema();
  const [info, setInfo] = useState(false);
  const protocolo = protocoloDoBloco(c);
  const definicao = definicaoDoProtocolo(protocolo);
  const mudar = (parte: Parameters<typeof alterarIntervalado>[1]) => aoMudar(alterarIntervalado(c, parte));
  const i = c.intervalos;
  const largura = { width: escalar(LARGURA_DO_TEMPO, fatorTexto) };
  const antigo = avisoDoIntervaladoAntigo(c);
  const faixa = avisoForaDaFaixa(c);
  const resumo = resumoDoBloco(c);
  const temRecuperacao = !!i?.descansoSeg || c.recuperacaoTipo != null;
  const tempo = (campo: CampoDeTempo, rotulo: string, valor: number | null | undefined, erro: string | undefined, aoEscolher: (v: number | null) => void) =>
    <View style={largura}>
      <EscolhaSuspensa<number | null> rotulo={rotulo} valor={valor ?? null} opcoes={opcoesDeTempo(campo, valor)}
        rotuloDaBusca="Digite ou escolha" textoVazio={AJUDA_DO_TEMPO}
        digitado={{ maxLength: 12, opcao: (t) => { const s = lerTempo(campo, t); return s != null ? { valor: s, rotulo: tempoCurto(s) } : null; } }}
        aoMudar={aoEscolher} />
      <ErroDoCampo mensagem={erro} />
    </View>;
  return <>
    <Faixa titulo="Protocolo">
      {antigo ? <Alerta tom="atencao" texto={antigo} /> : null}
      <View style={estilos.selectEInfo}>
        <View style={[estilos.protocolo, { maxWidth: escalar(LARGURA_DO_PROTOCOLO, fatorTexto) }]}>
          <EscolhaSuspensa<ProtocoloDeCardio> rotulo="Protocolo" valor={protocolo} opcoes={PROTOCOLOS_DO_SELECT} semBusca
            // O protocolo preenche os valores típicos dele (D7); "Personalizado" guarda o que já está escrito.
            aoMudar={(p) => { if (p !== protocolo || c.modo == null) aoMudar(padraoDoProtocolo(p, c)); }} />
        </View>
        <BotaoDeInfo rotulo={`O que é ${definicao.rotulo}?`} aberto={info} aoAlternar={() => setInfo(!info)} />
      </View>
      {info ? <View style={estilos.explicacao}>
        <Explicacao texto={definicao.definicao} />
        <LinkTexto href={`/treinador/ajuda?secao=${SECAO_CARDIO_E_HIIT}`} texto="Saiba mais sobre os protocolos" />
      </View> : null}
      <ErroDoCampo mensagem={erros.protocolo} />
    </Faixa>
    <Faixa titulo="Tempos e voltas">
      <View style={estilos.linha}>
        {tempo('aquecimento', 'Aquecimento', c.aquecimentoSeg, erros.aquecimentoSeg, (aquecimentoSeg) => mudar({ aquecimentoSeg }))}
        {tempo('estimulo', 'Estímulo', i?.trabalhoSeg, erros['intervalos.trabalhoSeg'], (trabalhoSeg) => mudar({ intervalos: { trabalhoSeg } }))}
        {tempo('recuperacao', 'Recuperação', i?.descansoSeg, erros['intervalos.descansoSeg'], (descansoSeg) => mudar({ intervalos: { descansoSeg } }))}
        <View style={largura}>
          <EscolhaSuspensa<number | null> rotulo="Voltas" valor={i?.voltas ?? null} opcoes={opcoesDeQuantidade(i?.voltas ?? 0, 100)}
            rotuloDaBusca="Digite ou escolha" textoVazio="Digite um número de 1 a 100."
            digitado={{ maxLength: 3, opcao: (t) => { const n = lerQuantidade(t, 100); return n ? { valor: n, rotulo: String(n) } : null; } }}
            aoMudar={(voltas) => mudar({ intervalos: { voltas } })} />
          <ErroDoCampo mensagem={erros['intervalos.voltas']} />
        </View>
        {tempo('desaquecimento', 'Desaquecimento', c.desaquecimentoSeg, erros.desaquecimentoSeg, (desaquecimentoSeg) => mudar({ desaquecimentoSeg }))}
      </View>
      {temRecuperacao
        ? <Escolha rotulo="Tipo da recuperação (opcional)" opcoes={RECUPERACOES} valor={c.recuperacaoTipo ?? null} limpavel
          aoMudar={(recuperacaoTipo) => mudar({ recuperacaoTipo })} />
        : null}
      {resumo ? <Texto numerico accessibilityLiveRegion="polite">{resumo}</Texto> : null}
      <AvisoDoCampo mensagem={faixa} />
    </Faixa>
    <Faixa titulo="Esforço">
      <Esforco c={c} modo="INTERVALADO" erros={erros} aoMudar={(parte) => mudar(parte)} />
    </Faixa>
  </>;
}

/** Zona de 1 a 5 ou, no intervalado, "Máximo (all-out)": uma escolha só, porque os dois juntos são recusados (D5). */
function Esforco({ c, modo, erros, aoMudar }: { c: Cardio; modo: ModoDeCardio; erros: Problemas; aoMudar: (parte: Pick<Cardio, 'zona' | 'esforcoMaximo'>) => void }) {
  return <Escolha<EsforcoDoBloco> descricao={modo === 'INTERVALADO' ? 'Esforço do estímulo' : 'Zona de esforço'} opcoes={opcoesDeEsforco(modo)}
    valor={esforcoDoBloco(c)} limpavel chips aoMudar={(v) => aoMudar(comEsforco(v))} erro={erros.esforcoMaximo ?? erros.zona} />;
}

const estilos = StyleSheet.create({
  // O mesmo recuo da série aberta (`EditorDoGrupoDeSeries`), para os campos começarem embaixo do "Bloco N".
  corpo: { gap: espaco(2.5), paddingHorizontal: espaco(1.5), paddingTop: espaco(0.25), paddingBottom: espaco(2) },
  modo: { gap: espaco(0.75) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(1.5) },
  campo: { width: 140 },
  campoLargo: { flexGrow: 1, flexBasis: 180, maxWidth: 260 },
  selectEInfo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  protocolo: { flex: 1, minWidth: 0 },
  explicacao: { gap: espaco(0.5) },
  acoesDoRodape: { marginLeft: 'auto' },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
});
