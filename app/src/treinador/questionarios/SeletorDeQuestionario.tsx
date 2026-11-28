import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { opcoesDeQuestionario } from '../../api/rotas';
import { opcoesDoSeletor, textoDoQuestionarioEscolhido } from '../../dominio/seletorQuestionario';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

interface Props {
  rotulo: string;
  /** Questionário escolhido; nulo = nenhum (vale o `rotuloDoNulo`). */
  valor: string | null | undefined;
  /** Texto de "sem escolha": "Padrão da consultoria" no aluno, "O mesmo do aluno" na pasta. */
  rotuloDoNulo: string;
  podeAlterar: boolean;
  aoEscolher: (questionarioId: string | null) => Promise<void>;
}

/** Largura do select, a mesma do "Tipo da série" (até 320 px; encolhe no celular). */
const LARGURA = 320;

/**
 * Escolha do questionário de atualização (ficha do aluno e folha da pasta), no mesmo select do "Tipo da série"
 * (`ui/EscolhaSuspensa`: rótulo dentro, valor em negrito embaixo, ✓ na opção atual; lista colada no PC, folha no celular).
 * As opções são só os publicados e ativos. Sem permissão para alterar é só leitura; sem acesso nem às opções (403) a linha
 * some, porque não há o que mostrar.
 */
export function SeletorDeQuestionario({ rotulo, valor, rotuloDoNulo, podeAlterar, aoEscolher }: Props) {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  // As mesmas permissões da rota: sem nenhuma delas nem se pergunta (a API ainda responderia 403, tratado abaixo).
  const podeVer = pode('QUESTIONARIO_LER') || pode('ALUNO_ALTERAR') || pode('PASTA_ALTERAR');
  const opcoes = useCarregar(podeVer ? 'questionarios-opcoes' : null, () => opcoesDeQuestionario());
  // A escolha que está sendo gravada (`undefined` = nenhuma); enquanto isso o valor mostra "Salvando…".
  const [salvando, setSalvando] = useState<{ id: string | null } | undefined>(undefined);
  const ocupado = salvando !== undefined;

  if (!podeVer || (opcoes.erro instanceof ErroApi && opcoes.erro.status === 403)) return null;
  if (!opcoes.dados) return <View style={estilos.caixa}><CampoLeitura rotulo={rotulo} valor={opcoes.erro ? textoDoErro(opcoes.erro) : null} /></View>;

  const texto = textoDoQuestionarioEscolhido(valor, opcoes.dados, rotuloDoNulo);
  if (!podeAlterar) return <View style={estilos.caixa}><CampoLeitura rotulo={rotulo} valor={texto} /></View>;

  const escolher = (id: string | null) => {
    // O select não tem estado desabilitado: enquanto a troca anterior não volta, o toque é ignorado, mas o valor diz
    // "Salvando…" (o toque não some em silêncio).
    if (ocupado || id === (valor ?? null)) return;
    setSalvando({ id });
    aoEscolher(id).then(
      () => avisar('Questionário atualizado.', 'sucesso'),
      (e: unknown) => {
        // Arquivado ou despublicado depois de a lista abrir: busca as opções de novo para não oferecer o mesmo erro.
        if (e instanceof ErroApi && e.codigo === 'QUESTIONARIO_INDISPONIVEL') opcoes.recarregar();
        avisar(textoDoErro(e), 'perigo');
      },
    ).finally(() => setSalvando(undefined));
  };
  const daLista = opcoesDoSeletor(opcoes.dados, rotuloDoNulo);
  // Escolhido que saiu das opções (arquivado): uma opção a mais com o texto de sempre, para o botão não mostrar "—".
  const comEscolhido = valor && !daLista.some((o) => o.valor === valor) ? [{ valor, rotulo: texto }, ...daLista] : daLista;
  const lista = salvando ? comEscolhido.map((o) => (o.valor === salvando.id ? { ...o, rotulo: 'Salvando…' } : o)) : comEscolhido;
  return (
    <View style={estilos.caixa}>
      <EscolhaSuspensa<string | null> rotulo={rotulo} valor={salvando ? salvando.id : valor ?? null} opcoes={lista} aoMudar={escolher}
        semBusca={lista.length <= OPCOES_PARA_BUSCAR} rotuloDaBusca="Buscar questionário" textoVazio="Nenhum questionário encontrado." />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Largura do pai até 320 (numa linha com outros, quem chama dá a base da coluna).
  caixa: { width: '100%', maxWidth: LARGURA },
});
