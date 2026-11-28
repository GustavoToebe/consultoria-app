import { Minus, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Tecnica } from '../../api/tipos';
import {
  blocosValidos, estadoInicialDosBlocos, lerBlocos, MAXIMO_DE_BLOCOS, MAXIMO_REPS_POR_BLOCO, MINIMO_DE_BLOCOS, reduzirBlocos,
  resumoDaLinhaDosBlocos, type AcaoDosBlocos, type ModoDosBlocos,
} from '../../dominio/blocos';
import { aplicarPausa, dicaDaPausaEntreBlocos } from '../../dominio/pausaDaTecnica';
import { escalar } from '../../dominio/preferencias';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from './BotaoDeAbrir';
import { ErroDoCampo } from './CamposBasicos';
import { ALTURA_DO_CONTROLE, CampoDaSerie, LinhaDoFormulario } from './LinhaDoFormulario';

/**
 * As linhas próprias do Cluster na série aberta (SERIE-ABERTA.md, seção 3): "Blocos" (Blocos iguais · Blocos diferentes,
 * os campos B1…Bn e os botões − e + no fim da fileira, o resumo e o "Digitar como texto") e "Pausa entre blocos"
 * (`[15] s · [3] respirações (opcional)`). `emLinhas` falso é o padrão da metodologia: os mesmos controles sem a linha de
 * nome à esquerda (o cartão da técnica já diz de quem é).
 */
export function CamposDoCluster({ tecnica: t, mudar, e, emLinhas, aoMudarBlocos }: {
  tecnica: Tecnica; mudar: (parte: Partial<Tecnica>) => void; e: Problemas; emLinhas: boolean;
  /** Os blocos gravados (ou `null`, sem lista gravável): quem usa ajusta o que depende deles (a carga de cada bloco). */
  aoMudarBlocos: (blocos: number[] | null) => void;
}) {
  return <>
    <CampoDosBlocos valor={t.blocos} aoMudar={aoMudarBlocos} erro={e.blocos} emLinhas={emLinhas} />
    <PausaEntreBlocos t={t} mudar={mudar} e={e} emLinhas={emLinhas} />
  </>;
}

/** A linha da série (`LinhaDoFormulario`) ou, na metodologia, o nome pequeno em cima e os controles embaixo. */
function Linha({ emLinhas, nome, dica, children }: { emLinhas: boolean; nome: string; dica: ReactNode; children: ReactNode }) {
  if (emLinhas) return <LinhaDoFormulario nome={nome} dica={dica ?? undefined}>{children}</LinhaDoFormulario>;
  return <View style={estilos.bloco} role="group" aria-label={nome}>
    <Texto variante="rotulo">{nome}</Texto>
    <View style={estilos.controles}>{children}</View>
    {dica}
  </View>;
}

/** Caixa de um bloco: dois dígitos e o padding (~56 px), crescendo com o tamanho do texto. */
const LARGURA_DO_BLOCO = 56;

/**
 * Os blocos do Cluster. O estado mora no `reduzirBlocos` (`dominio/blocos`): o campo é dono do rascunho e do modo, e o eco
 * do que ele mesmo gravou (o `valor` que volta do pai a cada render) não refaz nada; só lista de fora (desfazer, receita)
 * troca os campos. Era aqui o defeito do "+": refazer o modo pelo formato da lista a cada mudança fazia "Blocos
 * diferentes" com 5-5-5-5 virar "5×5" ao somar um bloco e os campos sumiam (teste em `CamposDoCluster.test.tsx`).
 */
function CampoDosBlocos({ valor, aoMudar, erro, emLinhas }: {
  valor: number[] | null | undefined; aoMudar: (v: number[] | null) => void; erro?: string | null; emLinhas: boolean;
}) {
  const { fatorTexto } = useTema();
  const [guardado, setGuardado] = useState(() => estadoInicialDosBlocos(valor));
  // Estado derivado da prop (padrão do React): só muda quando chega lista de fora; o eco devolve o mesmo objeto.
  const estado = reduzirBlocos(guardado, { tipo: 'chegou', valor }).estado;
  if (estado !== guardado) setGuardado(estado);
  const enviar = (acao: AcaoDosBlocos) => {
    const r = reduzirBlocos(estado, acao);
    setGuardado(r.estado);
    if (r.gravar !== undefined) aoMudar(r.gravar);
  };
  const { rascunho, modo, invalidos, confirmar, texto, notacaoAberta, focar } = estado;
  const corrigir = invalidos.size > 0;
  const noMaximo = rascunho.length >= MAXIMO_DE_BLOCOS;
  const caixa = { width: escalar(LARGURA_DO_BLOCO, fatorTexto) };
  const foraDaFaixa = (reps: number | null) => (reps != null && (reps < 1 || reps > MAXIMO_REPS_POR_BLOCO) ? `De 1 a ${MAXIMO_REPS_POR_BLOCO} repetições.` : null);
  const erroDosCampos = rascunho.map(foraDaFaixa).find(Boolean) ?? null;
  const resumo = resumoDaLinhaDosBlocos(rascunho);
  const campo = (i: number, rotulo: string) => <CampoNumerico rotulo={rotulo} rotuloOculto erroSemTexto inteiro altura={ALTURA_DO_CONTROLE} mono centralizado
    valor={rascunho[i] ?? null} erro={foraDaFaixa(rascunho[i] ?? null)} autoFocus={focar === i}
    aoMudar={(v) => enviar({ tipo: 'editar', indice: i, valor: v })} aoValidade={(ok) => enviar({ tipo: 'invalidar', indice: i, ok })} />;
  const botoes = <View style={estilos.botoes}>
    <IconeBotao moldura Icone={Minus} rotulo="Remover um bloco" desabilitado={rascunho.length <= MINIMO_DE_BLOCOS} aoTocar={() => enviar({ tipo: 'menos' })} />
    <IconeBotao moldura Icone={Plus} rotulo="Adicionar um bloco" desabilitado={noMaximo || corrigir} aoTocar={() => enviar({ tipo: 'mais' })} />
  </View>;
  // A dica (a descrição da linha) só tem texto: o erro dos campos (que marcam só a caixa) e o limite. O resumo com o
  // "Digitar como texto" e o campo da notação são controles: ficam na coluna dos controles, embaixo dos blocos.
  const mensagem = erroDosCampos ?? (corrigir ? 'Use só números inteiros.' : null);
  const notacaoInvalida = !!texto && !blocosValidos(lerBlocos(texto));
  const frases = [
    mensagem ? <ErroDoCampo key="campos" mensagem={mensagem} /> : erro ? <ErroDoCampo key="validacao" mensagem={erro} /> : null,
    noMaximo && !confirmar ? <Texto key="maximo" variante="pequeno">{`Máximo de ${MAXIMO_DE_BLOCOS} blocos.`}</Texto> : null,
  ].filter(Boolean);
  return <Linha emLinhas={emLinhas} nome="Blocos" dica={frases.length ? <View style={estilos.bloco}>{frases}</View> : null}>
    <Escolha<ModoDosBlocos> descricao="Distribuição dos blocos" compacta valor={modo} aoMudar={(m) => enviar({ tipo: 'modo', modo: m })}
      opcoes={[{ valor: 'iguais', rotulo: 'Blocos iguais' }, { valor: 'diferentes', rotulo: 'Blocos diferentes' }]} />
    {confirmar ? <View style={[estilos.inteira, estilos.bloco]}>
      <Texto variante="pequeno">Todos os blocos ficam com as repetições do primeiro.</Texto>
      <LinhaDeAcoes>
        <Botao tipo="secundario" rotulo="Converter para blocos iguais" aoTocar={() => enviar({ tipo: 'converterParaIguais' })} />
        <Botao tipo="fantasma" rotulo="Manter blocos diferentes" aoTocar={() => enviar({ tipo: 'manterDiferentes' })} />
      </LinhaDeAcoes>
    </View> : null}
    {modo === 'iguais' && !confirmar ? <View style={[estilos.inteira, estilos.fileira]}>
      <View style={caixa}>{campo(0, 'Repetições em cada bloco')}</View>
      <Texto numerico accessibilityLiveRegion="polite">{`× ${rascunho.length} blocos`}</Texto>
      {botoes}
    </View> : null}
    {modo === 'diferentes' ? <View style={[estilos.inteira, estilos.fileira, estilos.fileiraComNomes]} role="group" aria-label="Repetições de cada bloco">
      {/* Chave pela posição: os blocos só entram e saem no fim e não têm outra identidade (B3 é sempre o 3º). */}
      {rascunho.map((_, i) => <View key={`B${i + 1}`} style={[caixa, estilos.blocoComNome]}>
        <Texto variante="pequeno" aria-hidden>{`B${i + 1}`}</Texto>
        {campo(i, `Bloco ${i + 1}`)}
      </View>)}
      {botoes}
    </View> : null}
    {mensagem ? null : <View style={[estilos.inteira, estilos.resumo]}>
      <Texto variante="pequeno" numerico accessibilityLiveRegion="polite">{resumo ?? 'Complete os blocos'}</Texto>
      <Texto variante="pequeno" aria-hidden>·</Texto>
      <BotaoDeAbrir pequeno texto={`Digitar como texto${texto ? ` (${texto})` : ''}`} aberto={notacaoAberta} aoAlternar={() => enviar({ tipo: 'alternarNotacao' })} />
    </View>}
    {notacaoAberta ? <View style={[estilos.inteira, estilos.notacao]}>
      <Campo rotulo="Blocos de repetições" valor={texto} maxLength={60} placeholder="5-5-5-5 ou 4+2"
        erro={notacaoInvalida ? `De ${MINIMO_DE_BLOCOS} a ${MAXIMO_DE_BLOCOS} blocos, cada um com 1 a ${MAXIMO_REPS_POR_BLOCO} repetições.` : null}
        aoMudar={(t) => enviar({ tipo: 'texto', texto: t })} />
    </View> : null}
  </Linha>;
}

/**
 * "Pausa entre blocos": dois campos fixos, `[15] s · [3] respirações (opcional)` (`aplicarPausa`: cada um grava só o seu
 * valor, sem conversão). A dica diz o texto que o aluno lê; o erro da validação (sem pausa, fora da faixa) toma o lugar dela.
 */
function PausaEntreBlocos({ t, mudar, e, emLinhas }: { t: Tecnica; mudar: (parte: Partial<Tecnica>) => void; e: Problemas; emLinhas: boolean }) {
  const erro = e.pausaSegundos ?? e.pausaRespiracoes;
  return <Linha emLinhas={emLinhas} nome="Pausa entre blocos" dica={erro ? <ErroDoCampo mensagem={erro} /> : dicaDaPausaEntreBlocos(t)}>
    <CampoDaSerie rotulo="Pausa entre blocos (s)" inteiro unidade="s ·" valor={t.pausaSegundos ?? null} erro={e.pausaSegundos}
      aoMudar={(segundos) => mudar(aplicarPausa(t, { segundos }))} />
    <CampoDaSerie rotulo="Pausa entre blocos em respirações" inteiro unidade="respirações (opcional)" valor={t.pausaRespiracoes ?? null} erro={e.pausaRespiracoes}
      aoMudar={(respiracoes) => mudar(aplicarPausa(t, { respiracoes }))} />
  </Linha>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.75) },
  controles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(1) },
  // Ocupa a fileira inteira dos controles da linha (a escolha fica em cima, os blocos embaixo).
  inteira: { flexBasis: '100%' },
  fileira: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  // Com "B1…" em cima das caixas, os botões descem até a linha delas.
  fileiraComNomes: { alignItems: 'flex-end' },
  blocoComNome: { gap: espaco(0.5), alignItems: 'center' },
  botoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1) },
  notacao: { maxWidth: 320 },
});
