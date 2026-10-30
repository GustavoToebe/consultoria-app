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

/** Frase padrão do HTTP em inglês (erro que não passou pelo tratador da API, como um id fora do formato). */
const PADRAO_EM_INGLES = /^(bad request|not found|forbidden|unauthorized|internal server error|method not allowed|service unavailable)\.?$/i;

/** Texto em português quando a API devolveu só a frase padrão do HTTP; senão o texto recebido. */
export function textoSemIngles(texto: string, erro?: unknown): string {
  if (!PADRAO_EM_INGLES.test(texto.trim())) return texto;
  const status = erro instanceof ErroApi ? erro.status : 0;
  if (status === 403) return 'Seu perfil não permite esta ação.';
  if (status >= 500) return 'O servidor não respondeu como devia. Tente de novo em instantes.';
  return 'Não encontramos o que você procura. Confira o endereço ou volte à lista.';
}

/** Tentar de novo só ajuda quando o problema pode passar: sem conexão, servidor fora, tempo esgotado ou limite. */
function valeTentarDeNovo(erro: unknown): boolean {
  if (!(erro instanceof ErroApi)) return true;
  return erro.status === 0 || erro.status === 408 || erro.status === 429 || erro.status >= 500;
}

export type TomDoAlerta = 'perigo' | 'atencao' | 'sucesso';

/**
 * Caixa de aviso: fundo claro e borda na cor do tom, texto na mesma cor (pedido do Gustavo em 30/10: "pode usar nos avisos
 * de atenção"). `perigo` é erro (região de alerta para o leitor de tela), `atencao` é o que pede cuidado mas não impede
 * (aluno ocupado, avisos da validação, prévia) e `sucesso` confirma. A cor diz o tipo; o texto sempre diz o que houve.
 */
export function Alerta({ tom, titulo, texto, children }: { tom: TomDoAlerta; titulo?: string; texto?: string; children?: ReactNode }) {
  const { cores } = useTema();
  const cor = cores[tom];
  return (
    <View
      accessibilityRole={tom === 'perigo' ? 'alert' : 'summary'}
      style={[estilos.erro, { borderColor: cor, backgroundColor: `${cor}18` }]}>
      {titulo ? <Texto variante="subtitulo" cor={cor}>{titulo}</Texto> : null}
      {texto ? <Texto cor={cor}>{texto}</Texto> : null}
      {children}
    </View>
  );
}

/**
 * Erro na própria tela, com o texto da API e, se der, um "tentar de novo" (só quando repetir pode resolver: nunca para
 * 400, 403, 404 ou 409). Frase padrão do HTTP em inglês ("Bad Request") vira português.
 */
export function MensagemErro({ texto, tentarDeNovo, erro }: { texto: string; tentarDeNovo?: () => void; erro?: unknown }) {
  return (
    <Alerta tom="perigo" texto={textoSemIngles(texto, erro)}>
      {tentarDeNovo && valeTentarDeNovo(erro) ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={tentarDeNovo} /> : null}
    </Alerta>
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
