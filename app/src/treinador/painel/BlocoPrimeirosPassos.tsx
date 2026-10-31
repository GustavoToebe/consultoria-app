import { router, type Href } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Circle, CircleAlert, Lock, Minus, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  DESCRICAO_DO_BLOCO,
  TITULO_DO_BLOCO,
  type AcaoDoBotao,
  type BotaoDoItem,
  type IconeDoSelo,
  type ItemDosPrimeirosPassos,
  type PrimeirosPassos,
} from '../../dominio/primeirosPassos';
import { ALVO_PRIMEIROS_PASSOS } from '../../dominio/passeio';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { useAlvoDoPasseio } from '../../ui/Passeio';
import { Selo } from '../../ui/Selo';
import { LARGURA_TABELA } from '../../ui/Tabela';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { FaixaDoPainel } from './FaixaDoPainel';

const ICONES: Record<IconeDoSelo, LucideIcon> = { check: Check, menos: Minus, alerta: CircleAlert, cadeado: Lock, circulo: Circle };

/** Ação de um botão de item que não é "abrir" (essa só navega). */
export type AcaoGuardada = Exclude<AcaoDoBotao, 'abrir'>;

/**
 * Primeiros passos aberto, no topo do Início (fora do "Editar"): faixa com o título, o andamento ("3 de 6"), Dispensar e
 * a seta de recolher; à vista só os itens que faltam, e os resolvidos numa linha ("3 feitos e 1 deixado para depois")
 * que abre ao tocar. O item que recebe o primário tem borda forte, a descrição e o único botão vermelho do Início.
 */
export function PrimeirosPassosAberto({ passos, aoAcao, aoDispensar }: {
  passos: PrimeirosPassos;
  aoAcao: (item: ItemDosPrimeirosPassos, acao: AcaoGuardada) => void;
  aoDispensar: () => void;
}) {
  const { cores } = useTema();
  const alvo = useAlvoDoPasseio(ALVO_PRIMEIROS_PASSOS);
  const [recolhido, setRecolhido] = useState(false);
  const [feitosAbertos, setFeitosAbertos] = useState(false);
  const Seta = recolhido ? ChevronDown : ChevronUp;
  const { progresso } = passos;
  const acoes = (
    <>
      <View accessible accessibilityLabel={progresso.rotuloAcessivel} style={estilos.progresso}>
        <Texto variante="rotulo" numerico cor={cores.texto}>{progresso.texto}</Texto>
        <View style={estilos.barra}><BarraProgresso feitas={progresso.resolvidos} total={progresso.total} cor={cores.texto} trilho={cores.superficie} /></View>
      </View>
      <Botao rotulo="Dispensar" rotuloAcessivel="Dispensar os primeiros passos" tipo="fantasma" aoTocar={aoDispensar} />
      <IconeBotao Icone={Seta} moldura rotulo={recolhido ? 'Mostrar os primeiros passos' : 'Recolher os primeiros passos'} aoTocar={() => setRecolhido((v) => !v)} />
    </>
  );
  return (
    <Cartao cabecalho={<FaixaDoPainel ref={alvo} titulo={TITULO_DO_BLOCO} descricao={DESCRICAO_DO_BLOCO} acoes={acoes} />}>
      {recolhido ? null : (
        <View style={estilos.lista}>
          {passos.recolhidos.length && passos.resumoDosRecolhidos ? (
            <View style={[estilos.feitos, { borderColor: cores.borda }]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: feitosAbertos }}
                accessibilityLabel={`${passos.resumoDosRecolhidos}. ${feitosAbertos ? 'Esconder' : 'Mostrar'}`}
                onPress={() => setFeitosAbertos((v) => !v)}
                style={(e) => [estilos.linhaFeitos, { backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
                <View style={[estilos.numero, { borderColor: cores.sucesso }]}><Check size={14} color={cores.sucesso} strokeWidth={2.5} /></View>
                <Texto variante="bloco" style={estilos.flex}>{passos.resumoDosRecolhidos}</Texto>
                {feitosAbertos ? <ChevronUp size={18} color={cores.textoSuave} /> : <ChevronDown size={18} color={cores.textoSuave} />}
              </Pressable>
              {feitosAbertos ? (
                <View accessibilityRole="list" style={estilos.listaFeitos}>
                  {passos.recolhidos.map((i) => <ItemDoPasso key={i.id} item={i} aoAcao={aoAcao} />)}
                </View>
              ) : null}
            </View>
          ) : null}
          <View accessibilityRole="list" style={estilos.lista}>
            {passos.aVista.map((i) => <ItemDoPasso key={i.id} item={i} aoAcao={aoAcao} />)}
          </View>
        </View>
      )}
    </Cartao>
  );
}

/**
 * Tudo resolvido: uma linha "Primeiros passos · Concluídos · 6 de 6 · também na Ajuda", com "Ver" (abre a lista) e o X
 * que tira do Início sem confirmação (continua na Ajuda).
 */
export function PrimeirosPassosConcluidos({ passos, aoAcao, aoFechar }: {
  passos: PrimeirosPassos;
  aoAcao: (item: ItemDosPrimeirosPassos, acao: AcaoGuardada) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const l = passos.linhaConcluidos;
  return (
    <Cartao cabecalho={(
      <FaixaDoPainel titulo={l.titulo} descricao={l.resumo}
        meio={<Selo texto={l.selo} tipo="sucesso" Icone={Check} />}
        acoes={(
          <>
            <Botao rotulo={aberto ? 'Esconder' : 'Ver'} rotuloAcessivel={aberto ? 'Esconder os primeiros passos' : 'Ver os primeiros passos'} tipo="fantasma" aoTocar={() => setAberto((v) => !v)} />
            <IconeBotao Icone={X} rotulo={l.rotuloFechar} aoTocar={aoFechar} />
          </>
        )} />
    )}>
      {aberto ? (
        <View accessibilityRole="list" style={[estilos.lista, { borderColor: cores.borda }]}>
          {passos.itens.map((i) => <ItemDoPasso key={i.id} item={i} aoAcao={aoAcao} />)}
        </View>
      ) : null}
    </Cartao>
  );
}

function ItemDoPasso({ item, aoAcao }: { item: ItemDosPrimeirosPassos; aoAcao: (item: ItemDosPrimeirosPassos, acao: AcaoGuardada) => void }) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const destaque = item.recebePrimario;
  // No celular os botões ficam embaixo do texto, alinhados com ele (ao lado, desceriam sozinhos para a direita).
  const embaixo = destaque || width < LARGURA_TABELA;
  const tocar = (b: BotaoDoItem) => {
    if (b.acao === 'abrir') {
      if (b.destino) router.push(b.destino as Href);
      return;
    }
    aoAcao(item, b.acao);
  };
  const IconeDoSelo = ICONES[item.selo.icone];
  const botoes = item.botoes.map((b) => (
    <Botao key={b.acao} rotulo={b.rotulo} rotuloAcessivel={b.rotuloAcessivel} tipo={b.primario ? 'primario' : 'secundario'}
      Icone={b.acao === 'conferido' ? Check : undefined}
      desabilitado={b.desabilitado} motivo={b.desabilitado ? item.bloqueio ?? undefined : undefined} aoTocar={() => tocar(b)} />
  ));
  return (
    <View role="listitem"
      style={[estilos.item, { borderColor: destaque ? cores.texto : cores.borda, borderWidth: destaque ? bordas.bloco : 1, backgroundColor: destaque ? cores.superficie : cores.superficie2 }]}>
      <View style={[estilos.numero, { borderColor: item.resolvido ? cores.sucesso : cores.texto }]} accessible={false}>
        {item.resolvido ? <Check size={14} color={cores.sucesso} strokeWidth={2.5} /> : <Texto variante="rotulo" numerico cor={cores.texto}>{String(item.numero)}</Texto>}
      </View>
      <View style={estilos.corpoDoItem}>
        <View style={estilos.tituloDoItem}>
          <Texto variante="bloco" nivel={3}>{item.titulo}</Texto>
          {item.opcional ? (
            <View style={[estilos.opcional, { borderColor: cores.bordaCampo }]}><Texto variante="secao" cor={cores.texto}>Opcional</Texto></View>
          ) : null}
          <Selo texto={item.selo.rotulo} tipo={item.selo.tom} Icone={IconeDoSelo} />
        </View>
        {item.textoExibido ? <Texto variante="suave">{item.textoExibido}</Texto> : null}
        {embaixo && botoes.length ? <View style={estilos.botoes}>{botoes}</View> : null}
      </View>
      {!embaixo && botoes.length ? <View style={estilos.botoesAoLado}>{botoes}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  progresso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  barra: { width: 72 },
  lista: { gap: espaco(1) },
  feitos: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaFeitos: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE + 4, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75) },
  listaFeitos: { gap: espaco(1), padding: espaco(1) },
  item: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1.25), borderRadius: RAIO, padding: espaco(1.5) },
  numero: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  corpoDoItem: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, gap: espaco(0.75) },
  tituloDoItem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), minHeight: 28 },
  opcional: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), alignItems: 'flex-start' },
  botoesAoLado: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), alignItems: 'center', marginLeft: 'auto' },
});
