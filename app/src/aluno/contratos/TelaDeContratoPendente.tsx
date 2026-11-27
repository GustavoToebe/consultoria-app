import { router } from 'expo-router';
import { FileSignature, LogOut, RefreshCw, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { situacaoDaTrava } from '../../dominio/travaDoContrato';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { erroDeConexao, textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAvisoAoSair } from '../useAvisoAoSair';
import { useContratosDoAluno, useRecarregarContratosAoFocar } from './ContratosDoAlunoProvider';

const TEXTOS = {
  assinar: {
    titulo: 'Assine o contrato para continuar',
    texto: 'O prazo para assinar o contrato terminou. Assine para voltar a usar o app.',
  },
  aguardaResponsavel: {
    titulo: 'Aguardando a assinatura do responsável',
    texto: 'O contrato precisa da assinatura do seu responsável. Fale com o seu treinador se precisar de um novo link.',
  },
} as const;
const FRASE_DA_PAUSA = 'Seu acesso também está pausado por pagamento em atraso. Depois de assinar, você vê os detalhes.';
const SEM_CONTRATO = 'Não encontramos o contrato para assinar. Tente de novo em instantes.';

/**
 * Tela de bloqueio do contrato pendente vencido (D3, D8, D19, D21; `docs/planos/contrato-digital.md`). Fica DENTRO do
 * `AlunoProvider` (a fila offline continua enviando: as quatro rotas de envio passam na trava) e no lugar do menu. O botão
 * leva à tela de assinar (`/aluno/contrato/[id]`, que o layout deixa abrir na trava). Menor com o contrato só do responsável
 * não tem o que assinar. Com a pausa por atraso junto, a frase dela fica embaixo. "Sair" avisa do que não foi enviado.
 */
export function TelaDeContratoPendente() {
  const { acessoPausado, contratoPendenteVencido, recarregarPerfil } = useSessao();
  const { online, tentarDeNovo } = useAluno();
  const { contratos, erro, recarregar } = useContratosDoAluno();
  // O push da tela de assinar empilha outro layout e este fica por baixo com a lista velha: ao voltar, busca de novo.
  useRecarregarContratosAoFocar();
  const avisoAoSair = useAvisoAoSair();
  const [saindo, setSaindo] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const situacao = situacaoDaTrava({ contratoPendenteVencido, acessoPausado, contratos });
  const variante = situacao.tela === 'contrato' ? situacao.variante : 'semLista';

  // A lista chegou sem nenhum vencido: a marca do perfil está velha (assinado pelo responsável, cancelado ou prorrogado).
  // Busca o /eu uma vez por lista; sem mudança o perfil não troca, então não entra em laço.
  const conferida = useRef<unknown>(null);
  useEffect(() => {
    if (variante !== 'semVencido' || conferida.current === contratos) return;
    conferida.current = contratos;
    void recarregarPerfil().catch(() => undefined);
  }, [variante, contratos, recarregarPerfil]);

  const verificar = () => {
    if (verificando) return;
    setVerificando(true);
    recarregar();
    void Promise.all([recarregarPerfil().catch(() => undefined), tentarDeNovo().catch(() => undefined)])
      .finally(() => setVerificando(false));
  };

  const textos = variante === 'aguardaResponsavel' ? TEXTOS.aguardaResponsavel : TEXTOS.assinar;
  const contratoId = situacao.tela === 'contrato' && situacao.variante === 'assinar' ? situacao.contratoId : null;
  const corpo = () => {
    if (contratoId || variante === 'aguardaResponsavel') return null;
    if (!online) {
      return <Vazio Icone={WifiOff} titulo="Sem internet" texto="O contrato só abre com conexão." nivel={2} acao={{ rotulo: 'Tentar de novo', aoTocar: verificar }} />;
    }
    if (erro !== undefined && !contratos) {
      return <MensagemErro texto={erroDeConexao(erro) ? 'Confira a internet e tente de novo.' : textoDoErro(erro)} erro={erro} tentarDeNovo={verificar} />;
    }
    if (variante === 'semVencido') {
      return (
        <View style={estilos.bloco}>
          <Texto variante="suave">{SEM_CONTRATO}</Texto>
          <Botao rotulo="Tentar de novo" tipo="secundario" Icone={RefreshCw} carregando={verificando} aoTocar={verificar} />
        </View>
      );
    }
    return <Esqueleto texto="Carregando o contrato" cartoes={1} />;
  };

  return (
    <Tela largura={720}>
      <View style={estilos.cabecalho}>
        <Texto variante="titulo" nivel={1}>{textos.titulo}</Texto>
        <Texto variante="suave" style={estilos.texto}>{textos.texto}</Texto>
      </View>
      {corpo()}
      <LinhaDeAcoes alinhar="inicio">
        {contratoId ? (
          <Botao rotulo="Assinar contrato" Icone={FileSignature} aoTocar={() => router.push(`/aluno/contrato/${encodeURIComponent(contratoId)}`)} />
        ) : null}
        <Botao rotulo="Sair" tipo="fantasma" Icone={LogOut} aoTocar={() => setSaindo(true)} />
      </LinhaDeAcoes>
      {acessoPausado ? <Alerta tom="atencao" texto={FRASE_DA_PAUSA} /> : null}
      <ConfirmarSaida visivel={saindo} aoFechar={() => setSaindo(false)} aviso={avisoAoSair} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco(1) },
  texto: { maxWidth: LARGURA_TEXTO_CORRIDO },
  bloco: { gap: espaco(1.5), alignItems: 'flex-start' },
});
