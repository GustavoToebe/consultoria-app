import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import { criarPastaModelo } from '../../api/rotas';
import type { PastaModelo } from '../../api/tipos';
import { colecaoDoDigitado, erroDoNomeDaColecao, SEM_COLECAO } from '../../dominio/colecoes';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useTema } from '../../tema/TemaProvider';
import { Campo } from '../../ui/Campo';
import { textoDoErro } from '../../ui/erros';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Texto } from '../../ui/Texto';

/** Chaves da lista: "Sem coleção" (vazio), o id de cada coleção, "+ Nova coleção…" e a nova com o nome digitado. */
const SEM = '';
const ABRIR = '+';
const NOVA = '+:';
const MAXIMO_DO_NOME = 120;

/**
 * Campo "Coleção" da folha de novo modelo: escolha única com busca (sem acento nem caixa, `EscolhaSuspensa`), "Sem coleção"
 * primeiro e, no fim, "+ Nova coleção…". Com texto na busca que não é uma coleção, a opção vira "+ Nova coleção “texto”" e
 * cria ali mesmo; sem texto, abre o campo do nome logo abaixo (Enter cria). A coleção criada já vem escolhida.
 * O mesmo `POST /pastas-modelos` e a mesma regra de nome (`erroDoNomeDaColecao`) do "Organizar coleções".
 */
export function SeletorDeColecao({ valor, colecoes, aoEscolher, aoCriar }: {
  valor: string | null;
  colecoes: readonly PastaModelo[];
  aoEscolher: (pastaId: string | null) => void;
  /** A coleção criada: quem usa a põe na lista, a escolhe e recarrega as coleções. */
  aoCriar: (colecao: PastaModelo) => void;
}) {
  const { cores } = useTema();
  // `null` = campo do nome fechado.
  const [nome, setNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const enviando = useRef(false);
  const campo = useRef<TextInput>(null);
  const aberto = nome !== null;
  useEffect(() => {
    // Na web o foco vai ao campo depois de a lista fechar e devolver o foco ao botão dela.
    if (!aberto || Platform.OS !== 'web') return undefined;
    const t = setTimeout(() => campo.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [aberto]);

  const criar = async (texto: string) => {
    if (enviando.current) return;
    const problema = erroDoNomeDaColecao(texto, colecoes);
    if (problema) { setNome(texto); setErro(problema); campo.current?.focus(); return; }
    enviando.current = true; setCriando(true); setErro(null);
    try {
      aoCriar(await criarPastaModelo(texto.replace(/\s+/g, ' ').trim()));
      setNome(null);
    } catch (e) {
      // O nome digitado fica no campo para tentar de novo.
      setNome(texto); setErro(textoDoErro(e));
    } finally { enviando.current = false; setCriando(false); }
  };

  return (
    <View style={estilos.grupo}>
      <EscolhaSuspensa<string> rotulo="Coleção" titulo="Coleção do modelo" valor={valor ?? SEM}
        rotuloDaBusca="Buscar ou criar coleção" textoVazio="Nenhuma coleção encontrada."
        opcoes={[{ valor: SEM, rotulo: SEM_COLECAO }, ...[...colecoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => ({ valor: c.id, rotulo: c.nome }))]}
        digitado={{
          maxLength: MAXIMO_DO_NOME,
          opcao: (t) => {
            const d = colecaoDoDigitado(t, colecoes);
            if ('semNome' in d) return { valor: ABRIR, rotulo: '+ Nova coleção…' };
            if ('existente' in d) return { valor: d.existente.id, rotulo: d.existente.nome };
            return { valor: `${NOVA}${d.nova}`, rotulo: `+ Nova coleção “${d.nova}”`, detalhe: 'Cria e escolhe para este modelo' };
          },
        }}
        aoMudar={(k) => {
          if (k === ABRIR) { setErro(null); setNome(''); }
          else if (k.startsWith(NOVA)) void criar(k.slice(NOVA.length));
          else { setNome(null); setErro(null); aoEscolher(k || null); }
        }} />
      {aberto ? (
        <View style={estilos.novo}>
          {/* Rótulo fora do `Campo` (como no "Organizar coleções"): os botões alinham com a caixa, também com o erro embaixo dela. */}
          <Texto variante="rotulo" cor={cores.texto} aria-hidden>Nome da nova coleção</Texto>
          <View style={estilos.linha}>
            <View style={estilos.campo}>
              <Campo ref={campo} rotulo="Nome da nova coleção" rotuloOculto valor={nome} erro={erro} maxLength={MAXIMO_DO_NOME} autoComplete="off"
                autoFocus={Platform.OS !== 'web'} returnKeyType="done"
                aoMudar={(t) => { setNome(t); if (erro) setErro(null); }} onSubmitEditing={() => void criar(nome)} />
            </View>
            <View style={estilos.acoes}>
              <Botao rotulo="Cancelar" rotuloAcessivel="Cancelar nova coleção" tipo="secundario" desabilitado={criando} motivo="Criando a coleção."
                aoTocar={() => { setNome(null); setErro(null); }} />
              <Botao rotulo="Criar coleção" tipo="secundario" carregando={criando} aoTocar={() => void criar(nome)} />
            </View>
          </View>
        </View>
      ) : criando ? <Texto variante="pequeno" accessibilityLiveRegion="polite">Criando a coleção…</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  novo: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1) },
  campo: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
