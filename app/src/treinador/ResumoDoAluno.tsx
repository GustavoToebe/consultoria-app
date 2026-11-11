import { router, useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { atualizacaoDoAluno } from '../api/rotas';
import type { AlunoDetalhe, PastaResumo } from '../api/tipos';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataRelativa, periodoCurto } from '../dominio/datasRelativas';
import { hojeIso } from '../dominio/formatos';
import { textoDaContagem } from '../dominio/frequencia';
import { proximoPassoDoAluno } from '../dominio/resumoDoAluno';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import type { useAcompanhamentoDoAluno } from './CartaoFrequencia';
import { FotoDePerfilEditavel } from './FotoDePerfilEditavel';

/**
 * Topo da ficha: o que o treinador precisa ver primeiro (situação só se for exceção, pasta vigente, atualização,
 * treinos da semana e o último registro) e, numa faixa, o próximo passo com a ação direta (revisar a atualização ou
 * renovar a pasta). `children` (os dados do aluno) vem depois de uma linha fina, no mesmo cartão.
 */
export function ResumoDoAluno({ aluno, acompanhamento, aoRenovar, aoAnonimizado, children }: {
  aluno: AlunoDetalhe;
  acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno>;
  /** Abre a confirmação de "Renovar" (a mesma da lista de pastas). */
  aoRenovar: (pasta: PastaResumo) => void;
  /** A troca da foto recebeu 409 `ALUNO_ANONIMIZADO`: a ficha busca de novo. */
  aoAnonimizado: () => void;
  children?: ReactNode;
}) {
  const { pode } = useSessao();
  // Os dados do aluno se editam neste cartão: sair para a revisão com a edição aberta pergunta antes (D7).
  const { confirmar } = useSaidaGuardada();
  const { cores } = useTema();
  const hoje = hojeIso();
  const verAtualizacao = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  const atual = useCarregar(verAtualizacao ? `resumo-atualizacao:${aluno.id}` : null, () => atualizacaoDoAluno(aluno.id));
  const recarregarAtual = atual.recarregar;
  // Voltando da revisão, o selo e o próximo passo já mudam.
  useFocusEffect(useCallback(() => { recarregarAtual(); }, [recarregarAtual]));
  const a = atual.dados?.alunoId === aluno.id && atual.dados.dataAtualizacao ? atual.dados : null;
  const dados = acompanhamento.dados;
  const selo = a ? statusAtualizacaoTreinador(a, hoje) : null;
  const passo = proximoPassoDoAluno({
    aluno, atualizacao: a, pasta: dados ? dados.pasta : undefined, pastas: dados?.pastas ?? [], hoje,
  });
  const pasta = dados?.pasta ?? null;
  const f = dados?.frequencia ?? null;
  const corFaixa = passo.tipo === 'perigo' ? cores.perigo : passo.tipo === 'atencao' ? cores.atencao : cores.divisor;
  const acao = passo.acao === 'revisar' && a && pode('ATUALIZACAO_LER')
    ? <Botao rotulo="Revisar atualização" aoTocar={() => confirmar(() => router.push(caminhoAtualizacaoTreinador(a)))} />
    : passo.acao === 'renovar' && pasta && pode('PASTA_ALTERAR')
      ? <Botao rotulo="Renovar pasta" aoTocar={() => aoRenovar(pasta)} />
      : null;
  return (
    <Cartao>
      <View style={estilos.topo}>
        <FotoDePerfilEditavel alunoId={aluno.id} alunoNome={aluno.nome} anonimizado={aluno.anonimizado} aoAnonimizado={aoAnonimizado} />
        <View style={estilos.fatos}>
          {aluno.anonimizado || !aluno.ativo ? <Selo texto={aluno.anonimizado ? 'Anonimizado' : 'Inativo'} tipo="neutro" /> : null}
          <View style={estilos.linhaFatos}>
            {/* "Pasta vencida" fica junto da pasta (guia de 11/11, pág. 13): o período já passou e ela não foi finalizada. */}
            <View style={estilos.fato}>
              <CampoLeitura rotulo="Pasta vigente" valor={dados ? (pasta ? `${pasta.titulo} · ${periodoCurto(pasta.inicio, pasta.fim, hoje)}` : 'Nenhuma') : null} numerico />
              {pasta?.fim && pasta.fim < hoje && !pasta.concluidaEm ? <Selo texto="Pasta vencida" tipo="perigo" /> : null}
            </View>
            {verAtualizacao ? (
              <View style={estilos.fato} accessibilityLabel={`Atualização: ${selo?.curto ?? 'nenhuma'}`}>
                <Texto variante="rotulo">Atualização</Texto>
                {selo ? <Selo texto={selo.curto} tipo={selo.tipo} /> : <Texto>—</Texto>}
              </View>
            ) : null}
            {f ? <CampoLeitura rotulo="Esta semana" valor={textoDaContagem(f.semana)} numerico /> : null}
            {f ? <CampoLeitura rotulo="Último registro" valor={f.ultimo ? dataRelativa(f.ultimo, hoje) : 'Nenhum nesta pasta'} numerico /> : null}
          </View>
        </View>
      </View>
      {/* Próximo passo: a borda à esquerda tem a cor do status (nunca a marca); a ação, quando há, é a principal da ficha. */}
      <View style={[estilos.passo, { borderColor: cores.divisor, borderLeftColor: corFaixa, backgroundColor: cores.superficie2 }]}>
        <View style={estilos.passoTexto}>
          <Texto variante="rotulo">Próximo passo</Texto>
          <Texto>{passo.texto}</Texto>
        </View>
        {acao}
      </View>
      {children ? (
        <>
          <View style={[estilos.divisor, { backgroundColor: cores.divisor }]} />
          {children}
        </>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  fatos: { flex: 1, gap: espaco(1) },
  linhaFatos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5) },
  fato: { gap: espaco(0.25) },
  passo: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5),
    borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(1.5),
  },
  passoTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2 },
  divisor: { height: StyleSheet.hairlineWidth, marginVertical: espaco(0.5) },
});
