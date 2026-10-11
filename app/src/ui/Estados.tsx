import { Inbox, Info, Lock, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { Texto } from './Texto';

export function Carregando({ texto }: { texto?: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.centro} accessibilityLabel={texto ?? 'Carregando'}>
      <ActivityIndicator color={cores.textoSuave} />
      {texto ? <Texto variante="suave">{texto}</Texto> : null}
    </View>
  );
}

export function Vazio({ titulo, texto, Icone = Inbox, acao }: {
  titulo?: string;
  texto: string;
  Icone?: LucideIcon;
  acao?: { rotulo: string; aoTocar: () => void };
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.centro}>
      <Icone size={32} color={cores.textoSuave} accessible={false} />
      {titulo ? <Texto variante="subtitulo" style={estilos.textoCentro}>{titulo}</Texto> : null}
      <Texto variante="suave" style={estilos.textoCentro}>{texto}</Texto>
      {acao ? <Botao rotulo={acao.rotulo} tipo="secundario" aoTocar={acao.aoTocar} /> : null}
    </View>
  );
}

/** Tela que o perfil não pode abrir: título, explicação e uma saída, em vez de uma linha solta. */
export function SemPermissao({ acao }: { acao?: { rotulo: string; aoTocar: () => void } }) {
  return (
    <Vazio
      Icone={Lock}
      titulo="Sem acesso a esta tela"
      texto="Seu perfil não tem permissão para abrir esta tela. Peça a um administrador da consultoria."
      acao={acao}
    />
  );
}

/**
 * Faixa no topo de um formulário bloqueado (atualização que ainda não liberou, plano publicado): diz o porquê antes
 * dos campos apagados, com uma ação quando houver.
 */
export function Bloqueado({ titulo, texto, Icone = Lock, acao, children }: {
  titulo: string;
  texto?: string;
  Icone?: LucideIcon;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View accessibilityRole="summary" style={[estilos.faixa, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <Icone size={20} color={cores.textoSuave} accessible={false} />
      <View style={estilos.faixaTextos}>
        <Texto variante="subtitulo">{titulo}</Texto>
        {texto ? <Texto variante="suave">{texto}</Texto> : null}
        {children}
        {acao ? <View style={estilos.faixaAcao}>{acao}</View> : null}
      </View>
    </View>
  );
}

/** Linha pequena com ícone para um total ou lista com valores faltando ("Há itens sem valor informado"). O "—" fica. */
export function Incompleto({ texto = 'Há itens sem valor informado.' }: { texto?: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.incompleto}>
      <Info size={14} color={cores.textoSuave} accessible={false} />
      <Texto variante="pequeno" style={estilos.textoIncompleto}>{texto}</Texto>
    </View>
  );
}

/** Erro na própria tela, com o texto da API e, se der, um "tentar de novo" (nunca para "não encontrado"). */
export function MensagemErro({ texto, tentarDeNovo, erro }: { texto: string; tentarDeNovo?: () => void; erro?: unknown }) {
  const definitivo = erro instanceof ErroApi && erro.status === 404;
  const { cores } = useTema();
  return (
    <View
      accessibilityRole="alert"
      style={[estilos.erro, { borderColor: cores.perigo, backgroundColor: `${cores.perigo}18` }]}>
      <Texto cor={cores.perigo}>{texto}</Texto>
      {tentarDeNovo && !definitivo ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={tentarDeNovo} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center', gap: espaco(1.5), padding: espaco(4) },
  textoCentro: { textAlign: 'center' },
  erro: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  faixa: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  faixaTextos: { flex: 1, gap: espaco(0.5) },
  faixaAcao: { marginTop: espaco(1) },
  incompleto: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  textoIncompleto: { flexShrink: 1 },
});
