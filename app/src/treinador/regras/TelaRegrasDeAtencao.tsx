import { BellRing, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { obterRegrasDeAtencao } from '../../api/rotas';
import { TEXTOS_DAS_REGRAS } from '../../dominio/regrasDeAtencao';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { FormularioDasRegras } from './FormularioDasRegras';

export const REGRAS_ATENCAO_INDISPONIVEIS = 'REGRAS_ATENCAO_INDISPONIVEIS';
const TEXTO_SEM_INTERNET = 'Confira a internet e tente de novo.';

/** Status de erro do `ApiError` (403 = o perfil não lê as regras). */
const statusDoErro = (erro: unknown): number | undefined =>
  typeof erro === 'object' && erro !== null && 'status' in erro && typeof erro.status === 'number' ? erro.status : undefined;

/**
 * Configurações › Regras de atenção (`docs/planos/regras-de-atencao.md`, R1 a R9 e C1 a C4): os 6 modelos "me avise quando",
 * salvos num lote só. Lê com `ATUALIZACAO_LER` (a guarda da rota); edita com `REGRA_ATENCAO_ALTERAR`, senão só leitura. Com a
 * chave da plataforma desligada (`regrasAtencaoHabilitada`, padrão falso) ou o 503 `REGRAS_ATENCAO_INDISPONIVEIS`, diz que o
 * recurso não está ativo e não chama a API. Casca no molde de `TelaContratos`; o corpo no de `AbaLembretes`.
 */
export function TelaRegrasDeAtencao() {
  const { pode, regrasAtencaoHabilitada } = useSessao();
  const carga = useCarregar(regrasAtencaoHabilitada ? 'regras-de-atencao' : null, () => obterRegrasDeAtencao());
  const desligado = !regrasAtencaoHabilitada || codigoApi(carga.erro) === REGRAS_ATENCAO_INDISPONIVEIS;

  const corpo = () => {
    if (desligado) {
      return <Vazio Icone={BellRing} titulo="Regras de atenção não estão ativas" texto="Este recurso não está ativo nesta instalação do app." />;
    }
    if (carga.erro && !carga.dados) {
      if (statusDoErro(carga.erro) === 403) {
        return <Vazio Icone={Lock} titulo="Sem acesso às regras de atenção" texto="Seu perfil não tem permissão para ver as regras de atenção. Peça a quem administra a consultoria." />;
      }
      const texto = erroDeConexao(carga.erro) ? `${TEXTOS_DAS_REGRAS.erroDeCarga} ${TEXTO_SEM_INTERNET}` : `${TEXTOS_DAS_REGRAS.erroDeCarga} ${textoDoErro(carga.erro)}`;
      return <MensagemErro texto={texto} erro={carga.erro} tentarDeNovo={carga.recarregar} />;
    }
    if (!carga.dados) return <Esqueleto texto="Carregando as regras de atenção" cartoes={2} />;
    // A chave é a versão: salvar (ou recarregar depois de um conflito) traz outra e o formulário nasce de novo, sem resto.
    return (
      <FormularioDasRegras key={carga.dados.versao} dados={carga.dados} podeAlterar={pode('REGRA_ATENCAO_ALTERAR')}
        aoSalvar={carga.definir} aoRecarregar={carga.recarregar} />
    );
  };

  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo={TEXTOS_DAS_REGRAS.titulo} descricao={TEXTOS_DAS_REGRAS.descricao}
        voltar="/treinador/configuracoes"
        trilha={[{ rotulo: 'Configurações', href: '/treinador/configuracoes' }, { rotulo: TEXTOS_DAS_REGRAS.titulo }]} />
      <View style={estilos.corpo}>{corpo()}</View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2), width: '100%' },
});
