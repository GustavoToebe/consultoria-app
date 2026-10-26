import { router } from 'expo-router';
import { useState } from 'react';

import { ativarCiclo, definirSexoDaAluna, eu } from '../api/rotas';
import {
  AJUDA_MOSTRAR_FASES, faseNaData, hojeDoCiclo, TEXTO_DO_CONSENTIMENTO, textoDaLeitura, VERSAO_CONSENTIMENTO, type ConfigDoCiclo,
} from '../dominio/cicloMenstrual';
import { OPCOES_DE_SEXO, sexoDoCampo } from '../dominio/sexo';
import { useSessao } from '../sessao/SessaoProvider';
import { Botao } from '../ui/Botao';
import { CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useAviso } from '../ui/Aviso';
import { useCarregar } from '../ui/useCarregar';
import { useCicloDaAluna } from './useCicloDaAluna';

/** Sexo da própria aluna, na Conta. A lista de alunos não mostra este campo. */
export function CartaoSexoDaAluna() {
  const { recarregarPerfil } = useSessao();
  const { avisar } = useAviso();
  const perfil = useCarregar('eu-sexo', () => eu());
  const atual = sexoDoCampo(perfil.dados?.aluno?.sexo) ?? '';
  const [sexo, setSexo] = useState<string | null>(null);
  const valor = sexo ?? atual;
  const salvar = (proximo: string) => {
    setSexo(proximo);
    definirSexoDaAluna(sexoDoCampo(proximo)).then(
      () => recarregarPerfil().then(() => avisar('Sexo salvo.', 'sucesso')),
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };
  if (!perfil.dados?.aluno) return null;
  return (
    <Cartao titulo="Meus dados">
      <Escolha rotulo="Sexo" valor={valor} aoMudar={salvar}
        opcoes={[{ valor: '', rotulo: 'Não informado' }, ...OPCOES_DE_SEXO]} />
    </Cartao>
  );
}

/** Cartão da Conta. Some quando o sexo não é Feminino. Ligar pede o consentimento. */
export function CartaoCiclo() {
  const ciclo = useCicloDaAluna();
  const { avisar } = useAviso();
  const [ativar, setAtivar] = useState(false);
  const [duracao, setDuracao] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (!ciclo.dados) return ciclo.erro ? <MensagemErro texto={textoDoErro(ciclo.erro)} tentarDeNovo={ciclo.recarregar} /> : null;
  if (!ciclo.dados.disponivel) return null;
  if (!ciclo.online) {
    return (
      <Cartao titulo="Ciclo menstrual">
        <Texto>Precisa de conexão.</Texto>
      </Cartao>
    );
  }
  const ligado = ciclo.dados.ativo === true;
  const config: ConfigDoCiclo = {
    duracaoHabitual: ciclo.dados.duracaoHabitual ?? null,
    mostrarFases: ciclo.dados.mostrarFases !== false,
    hoje: hojeDoCiclo(),
  };
  const leitura = ligado ? faseNaData(ciclo.dados.registros ?? [], config, config.hoje) : null;
  const duracaoInvalida = duracao != null && (duracao < 21 || duracao > 45);
  const confirmar = () => {
    setOcupado(true);
    ativarCiclo(VERSAO_CONSENTIMENTO, duracao).then(
      (dados) => { setOcupado(false); setAtivar(false); ciclo.definir(dados); avisar('Acompanhamento ligado.', 'sucesso'); },
      (e: unknown) => { setOcupado(false); avisar(textoDoErro(e), 'perigo'); },
    );
  };
  return (
    <Cartao titulo="Ciclo menstrual">
      {ligado && leitura ? (
        <>
          <Texto>{textoDaLeitura(leitura)}</Texto>
          <Botao rotulo="Abrir" aoTocar={() => router.push('/aluno/ciclo')} />
        </>
      ) : (
        <>
          <Texto>O acompanhamento é opcional. Seu treinador e a equipe com acesso a dados sensíveis veem as datas para acompanhar seu treino e sua dieta.</Texto>
          <Texto variante="pequeno">Você pode desligar e apagar quando quiser.</Texto>
          <Botao rotulo="Ativar acompanhamento" aoTocar={() => setAtivar(true)} />
        </>
      )}
      <PainelConfirmacao visivel={ativar} titulo="Ativar acompanhamento?" mensagem={TEXTO_DO_CONSENTIMENTO}
        rotuloConfirmar="Ativar" carregando={ocupado} desabilitado={duracaoInvalida}
        motivo={duracaoInvalida ? 'A duração habitual vai de 21 a 45 dias.' : undefined}
        aoConfirmar={confirmar} aoCancelar={() => setAtivar(false)}>
        <CampoNumerico rotulo="Duração habitual do ciclo (opcional)" inteiro valor={duracao} aoMudar={setDuracao} sufixo="dias"
          ajuda={AJUDA_MOSTRAR_FASES} erro={duracaoInvalida ? 'Use de 21 a 45 dias.' : null} />
      </PainelConfirmacao>
    </Cartao>
  );
}
