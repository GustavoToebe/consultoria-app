import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import * as api from '../../api/rotas';
import type { PerfilEquipe, PermissaoEquipe } from '../../api/equipeTipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { arranjoDaMatriz, filtrarMatriz, montarMatriz, perfilAlterado, resumoDasPermissoes, rotulosDaMatriz } from '../../dominio/matrizDePermissoes';
import { permissaoMarcavel } from '../../dominio/perfilEquipe';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { SecaoDePermissoes } from './SecaoDePermissoes';
import { useAtorEquipe } from './useAtorEquipe';

/** Folha larga do editor de perfil (pedido de 23/11: ~900 px); constante da tela, como a coluna da Comunidade. */
const LARGURA_DA_FOLHA_DO_PERFIL = 900;

/**
 * Editar ou criar perfil de acesso, com as permissões em matriz (plano `docs/planos/permissoes-em-matriz.md`). O teto
 * (`permissaoMarcavel`), as dependências e o lock otimista (`versao`) seguem os de antes; a API decide de verdade. O corpo
 * enviado é o mesmo: `permissoes` é a lista de códigos marcados.
 */
export function EditorDePerfil({ inicial, catalogo, aoFechar, aoSalvar }: { inicial: PerfilEquipe | null; catalogo: PermissaoEquipe[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  // Largura do corpo da folha, medida; antes da medida, a estimada pela janela (folha de 900 no PC, tela cheia no celular).
  const [larguraMedida, setLarguraMedida] = useState<number | null>(null);
  const arranjo = arranjoDaMatriz(larguraMedida ?? (width >= LARGURA_MENU_LATERAL ? Math.min(width - espaco(4), LARGURA_DA_FOLHA_DO_PERFIL) : width) - espaco(4));
  const ator = useAtorEquipe();
  const partida = { nome: inicial?.nome ?? '', descricao: inicial?.descricao ?? '', ativo: inicial?.ativo ?? true, permissoes: inicial?.permissoes ?? [] };
  const [nome, setNome] = useState(partida.nome);
  const [descricao, setDescricao] = useState(partida.descricao);
  const [ativo, setAtivo] = useState(partida.ativo);
  const [permissoes, setPermissoes] = useState<readonly string[]>(partida.permissoes);
  const [filtro, setFiltro] = useState('');
  const [erro, setErro] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);

  const matriz = montarMatriz(catalogo);
  const rotulos = rotulosDaMatriz(matriz);
  const visiveis = filtrarMatriz(matriz, filtro);
  const secoes = useSecoesAbertas(matriz.map((s) => s.secao));
  const marcadas = new Set(permissoes);
  const marcavel = (codigo: string) => permissaoMarcavel(ator, codigo);
  const resumo = resumoDasPermissoes(marcadas, catalogo);
  const alterado = perfilAlterado(partida, { nome, descricao, ativo, permissoes });
  const { fechar, aviso } = useFecharComAviso(true, alterado && !ocupado, aoFechar);

  const filtrar = (termo: string) => { setFiltro(termo); secoes.aoBuscar(termo, filtrarMatriz(matriz, termo).map((s) => s.secao)); };
  const salvar = async () => {
    setOcupado(true); setErro(null);
    try {
      const dados = { nome: nome.trim(), descricao: descricao.trim() || null, permissoes: [...permissoes], ativo, versao: inicial?.versao ?? null };
      if (inicial) await api.alterarPerfilEquipe(inicial.id, dados); else await api.criarPerfilEquipe(dados);
      aoSalvar();
    } catch (e) { setErro(e); } finally { setOcupado(false); }
  };

  return (
    <Folha visivel titulo={inicial ? 'Editar perfil' : 'Novo perfil'} aoFechar={fechar} largura={LARGURA_DA_FOLHA_DO_PERFIL} telaCheiaNoCelular
      statusDoRodape={erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : alterado ? (
        <View aria-live="polite"><Texto variante="suave" cor={cores.texto}>Alterações não salvas</Texto></View>
      ) : undefined}
      rodape={<>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
        <Botao rotulo="Salvar perfil" carregando={ocupado} desabilitado={!nome.trim()} motivo="Preencha o nome do perfil." aoTocar={() => void salvar()} />
      </>}>
      <View style={estilos.campos}>
        <Campo rotulo="Nome do perfil" valor={nome} aoMudar={setNome} maxLength={120} />
        <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={500} />
        <CaixaSelecao rotulo="Perfil ativo" marcado={ativo} aoMudar={setAtivo} />
      </View>

      <View style={estilos.topoDasPermissoes} onLayout={(e) => setLarguraMedida(e.nativeEvent.layout.width)}>
        <Texto variante="bloco" nivel={3}>Permissões</Texto>
        {/* Resumo vivo: muda a cada caixa; fonte numérica só nos números. */}
        <View aria-live="polite" style={estilos.resumo}>
          <Texto variante="suave"><Texto variante="suave" numerico cor={cores.texto}>{resumo.total}</Texto> {resumo.unidade} · <Texto variante="suave" numerico cor={cores.texto}>{resumo.sensiveis}</Texto> com dado sensível</Texto>
        </View>
      </View>
      <Texto variante="suave">As permissões necessárias para outra ficam marcadas e travadas. Para liberar uma delas, desmarque a que depende dela.</Texto>
      <Campo rotulo="Filtrar permissões" valor={filtro} aoMudar={filtrar} maxLength={60} placeholder="Ex.: treino, convite, anonimizar…" />

      {visiveis.length ? visiveis.map((s) => (
        <SecaoDePermissoes key={s.secao} secao={s} marcadas={marcadas} marcavel={marcavel} rotulos={rotulos} forma={arranjo.forma} seloAbaixo={arranjo.seloAbaixo}
          aberta={secoes.estaAberta(s.secao)} aoAlternar={() => secoes.alternar(s.secao)} aoMudar={(f) => setPermissoes((atuais) => f(atuais))} />
      )) : (
        <View style={estilos.vazio}>
          <Texto>Nenhuma permissão com “{filtro.trim()}”.</Texto>
          <Botao rotulo="Limpar filtro" tipo="secundario" aoTocar={() => filtrar('')} />
        </View>
      )}
      {aviso}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  // Na largura toda, alinhados com "Filtrar permissões" (antes paravam em 640 px e sobrava uma faixa vazia à direita).
  campos: { gap: espaco(2) },
  topoDasPermissoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: espaco(2), rowGap: 4, marginTop: espaco(1) },
  resumo: { flexShrink: 1 },
  vazio: { gap: espaco(1.5), alignItems: 'flex-start' },
});
