import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import type { PastaModelo, Receita, TipoReceita } from '../../api/tipos';
import { erroDoNomeDoModelo } from '../../dominio/colecoes';
import { LIMITE_DESCRICAO_DO_MODELO } from '../../dominio/modelos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { textoDoErro } from '../../ui/erros';
import { MensagemErro } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { rotuloNovoModelo } from './modelos';
import { SeletorDeColecao } from './SeletorDeColecao';

const MAXIMO_DO_NOME = 120;

/**
 * Folha "Nova …" do Planejamento ("Nova semana de treino", "Novo modelo de dieta"…) e, com `receita`, "Renomear ou mudar de
 * coleção". Nome focado ao abrir (Enter cria), descrição que começa com 2 linhas e cresce, com o contador, e a coleção num
 * seletor com busca que cria coleção ali mesmo. "Criar e editar" fica sempre habilitado: sem nome, o erro vai no campo.
 */
export function FolhaNovoModelo({ receita, pastaInicial, tipo, colecoes, aoCriarColecao, aoFechar, aoSalvar }: {
  receita: Receita | null;
  /** A coleção já escolhida ao abrir (a "+" da faixa de uma coleção); `null` = "Sem coleção". */
  pastaInicial: string | null;
  tipo: TipoReceita;
  colecoes: readonly PastaModelo[];
  /** Coleção criada pelo seletor: quem usa recarrega a lista. */
  aoCriarColecao: () => void;
  aoFechar: () => void;
  aoSalvar: (nome: string, descricao: string | null, pastaId: string | null) => Promise<void>;
}) {
  const [nome, setNome] = useState(receita?.nome ?? '');
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [descricao, setDescricao] = useState(receita?.descricao ?? '');
  const [colecao, setColecao] = useState<string | null>(receita ? receita.pastaId : pastaInicial);
  // A coleção criada aqui entra na lista na hora, antes de o recarregar da tela trazê-la.
  const [criadas, setCriadas] = useState<PastaModelo[]>([]);
  const lista = [...colecoes, ...criadas.filter((c) => !colecoes.some((x) => x.id === c.id))];
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const enviando = useRef(false);
  const campoNome = useRef<TextInput>(null);

  // Nome focado ao abrir. Na web, depois do efeito da `Folha`, que leva o foco ao primeiro controle (no celular, ao X).
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const t = setTimeout(() => campoNome.current?.focus());
    return () => clearTimeout(t);
  }, []);

  const enviar = () => {
    if (enviando.current) return;
    const problema = erroDoNomeDoModelo(nome);
    if (problema) { setErroDoNome(problema); campoNome.current?.focus(); return; }
    enviando.current = true; setSalvando(true); setErro(null);
    aoSalvar(nome.trim(), descricao.trim() || null, colecao).catch((e: unknown) => {
      enviando.current = false; setErro(e); setSalvando(false);
    });
  };

  return <Folha visivel titulo={receita ? 'Renomear ou mudar de coleção' : rotuloNovoModelo(tipo)} aoFechar={aoFechar} rodape={<>
    <Botao rotulo="Cancelar" tipo="secundario" desabilitado={salvando} motivo={receita ? 'Salvando o modelo.' : 'Criando o modelo.'} aoTocar={aoFechar} />
    <Botao rotulo={receita ? 'Salvar' : 'Criar e editar'} carregando={salvando} aoTocar={enviar} />
  </>}>
    <Campo ref={campoNome} rotulo="Nome do modelo" valor={nome} erro={erroDoNome} maxLength={MAXIMO_DO_NOME} autoComplete="off"
      autoFocus={Platform.OS !== 'web'} returnKeyType="done"
      aoMudar={(t) => { setNome(t); if (erroDoNome) setErroDoNome(null); }} onSubmitEditing={enviar} />
    <View style={estilos.descricao}>
      <CampoQueCresce rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={2} maximoDeLinhas={8} maxLength={LIMITE_DESCRICAO_DO_MODELO} />
      <Texto variante="pequeno" numerico style={estilos.contador} accessibilityLabel={`${descricao.length} de ${LIMITE_DESCRICAO_DO_MODELO} caracteres`}>
        {descricao.length}/{LIMITE_DESCRICAO_DO_MODELO}
      </Texto>
    </View>
    <SeletorDeColecao valor={colecao} colecoes={lista} aoEscolher={setColecao}
      aoCriar={(c) => { setCriadas((atual) => [...atual, c]); setColecao(c.id); aoCriarColecao(); }} />
    {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
  </Folha>;
}

const estilos = StyleSheet.create({
  descricao: { gap: espaco(0.5) },
  contador: { alignSelf: 'flex-end' },
});
