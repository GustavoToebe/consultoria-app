import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { atribuirPod, listarPods } from '../../api/comunidade';
import type { AlunoDetalhe } from '../../api/tipos';
import { EscolhaDoGrupo, POD_TETO } from '../../comunidade/EscolhaDoGrupo';
import { avisoDoPod, traduzirErroDoPod } from '../../dominio/comunidade';
import { primeiroNome } from '../../dominio/gruposDeAlunos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Por que o aluno não entra num grupo agora (as mesmas recusas da API, ditas antes de tentar); `null` = pode. */
function motivoSemGrupo(aluno: AlunoDetalhe): string | null {
  if (aluno.anonimizado) return 'Aluno anonimizado não entra num grupo.';
  if (!aluno.ativo) return 'Aluno inativo não entra num grupo.';
  if (!aluno.temAcesso) return 'Só entra num grupo quem já tem acesso ao app.';
  return null;
}

/** A folha monta a cada abertura: a lista (e o "N de 12") vem de novo, sem número velho. */
function FolhaDoGrupo({ aluno, aoFechar }: { aluno: AlunoDetalhe; aoFechar: () => void }) {
  const { avisar } = useAviso();
  const pods = useCarregar('ficha-grupos-da-comunidade', () => listarPods());
  // `undefined` = nada escolhido: a ficha ainda não sabe o grupo atual, então nada vem marcado.
  const [escolhido, setEscolhido] = useState<string | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const grupo = escolhido ? pods.dados?.find((p) => p.id === escolhido) ?? null : null;
  const aviso = avisoDoPod(grupo);
  const nome = primeiroNome(aluno.nome);

  const salvar = async () => {
    if (escolhido === undefined || salvando) return;
    setSalvando(true);
    setRecusa(null);
    try {
      await atribuirPod(aluno.id, escolhido);
      avisar(grupo ? `${nome} está no grupo ${grupo.nome}.` : `${nome} ficou sem grupo.`, 'sucesso');
      aoFechar();
    } catch (e) {
      setRecusa(traduzirErroDoPod(e).mensagem);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha visivel titulo="Grupo da comunidade" aoFechar={aoFechar}
      rodape={
        <LinhaDeAcoes>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar grupo" tipo="primario" carregando={salvando} desabilitado={escolhido === undefined}
            motivo="Escolha um grupo ou Sem grupo." aoTocar={() => void salvar()} />
        </LinhaDeAcoes>
      }>
      {recusa ? <Alerta tom="perigo" texto={recusa} /> : null}
      <Texto variante="suave">
        {`Em qual grupo ${nome} fica. Cada aluno está em um grupo só: escolher aqui substitui o atual, que ainda não aparece na ficha.`}
      </Texto>
      {pods.erro ? (
        <MensagemErro texto={textoDoErro(pods.erro)} erro={pods.erro} tentarDeNovo={pods.recarregar} />
      ) : !pods.dados ? (
        <Esqueleto cartoes={1} texto="Carregando os grupos" />
      ) : !pods.dados.length ? (
        <Vazio texto="Nenhum grupo criado ainda. Crie em Comunidade, na aba Mural, no botão Grupos." />
      ) : (
        <>
          <EscolhaDoGrupo rotulo="Grupo" rotuloDoNulo="Sem grupo" grupos={pods.dados} valor={escolhido}
            aoMudar={(v) => { setEscolhido(v); setRecusa(null); }} />
          {grupo ? <Texto variante="suave" numerico>{`${grupo.membros} de ${POD_TETO} alunos neste grupo.`}</Texto> : null}
          {escolhido === null ? <Texto variante="suave">{`${nome} sai do grupo e passa a ver só o mural Geral.`}</Texto> : null}
          {aviso ? <Alerta tom="atencao" texto={aviso} /> : null}
        </>
      )}
    </Folha>
  );
}

/**
 * "Grupo da comunidade" nos Dados do aluno, só com `COMUNIDADE_MODERAR`. A ficha (`AlunoDetalhe`) ainda não traz o grupo
 * atual, então a linha é uma ação ("Mudar grupo"), não uma leitura; aluno inativo, sem acesso ou anonimizado não entra.
 */
export function GrupoDoAlunoNaFicha({ aluno }: { aluno: AlunoDetalhe }) {
  const [aberta, setAberta] = useState(false);
  const motivo = motivoSemGrupo(aluno);
  return (
    <View style={estilos.linha}>
      <View style={estilos.textos}>
        <Texto variante="rotulo">Grupo da comunidade</Texto>
        <Texto variante="pequeno">Mural próprio de até {POD_TETO} alunos.</Texto>
      </View>
      <Botao rotulo="Mudar grupo" tipo="secundario" Icone={Users} desabilitado={!!motivo} motivo={motivo ?? undefined}
        aoTocar={() => setAberta(true)} />
      {aberta ? <FolhaDoGrupo aluno={aluno} aoFechar={() => setAberta(false)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textos: { flexShrink: 1, minWidth: 0, gap: espaco(0.25) },
});
