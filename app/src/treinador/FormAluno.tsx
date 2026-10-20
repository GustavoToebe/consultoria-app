import { useSessao } from '../sessao/SessaoProvider';
import { Permitido } from '../ui/Permitido';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AlunoDetalhe, AlunoRequest } from '../api/tipos';
import { responsaveisEquipe } from '../api/rotas';
import { Escolha } from '../ui/Escolha';
import { useCarregar } from '../ui/useCarregar';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useAvisoDoPlano } from '../ui/useAvisoDoPlano';

interface Props {
  inicial?: AlunoDetalhe;
  rotuloSalvar: string;
  aoSalvar: (dados: AlunoRequest) => Promise<void>;
  aoCancelar?: () => void;
  /** Ciclo padrão da consultoria: aparece no campo vazio ("Padrão: 30 dias"), para não parecer "sem prazo". */
  diasPadrao?: number | null;
}

/** Texto do campo em número de 1 a 365; vazio = sem prazo (undefined → null no envio) e inválido = null. */
/** Objetivo e observações são dados sensíveis (LGPD): a nota é a mesma nos dois campos. */
const SENSIVEL = 'Dado sensível: só membros com permissão de dados sensíveis veem.';

function diasDoCampo(texto: string): number | null {
  const n = Number(texto.trim());
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

/**
 * Dados do aluno em duas seções: "Cadastro" (nome, e-mail, objetivo) e "Acompanhamento" (responsável, ciclo,
 * observações). O e-mail é opcional (o aluno escolhe o dele ao aceitar o convite). Objetivo e observações são dado
 * sensível: ficam só no banco, nunca em log, e a nota aparece nos dois.
 */
export function FormAluno({ inicial, rotuloSalvar, aoSalvar, aoCancelar, diasPadrao = null }: Props) {
  const {pode,usuario}=useSessao();
  const [responsavelId,setResponsavelId]=useState(inicial?.responsavelId??usuario?.id??'');
  const {dados:responsaveis,erro:erroResponsaveis,recarregar}=useCarregar('responsaveis-form',()=>responsaveisEquipe());
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '');
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [dias, setDias] = useState(inicial?.diasAtualizacao ? String(inicial.diasAtualizacao) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const avisarDoPlano = useAvisoDoPlano();
  const campos = errosPorCampo(erro);
  const diasInvalidos = dias.trim() !== '' && diasDoCampo(dias) === null;

  const salvar = () => {
    if (!nome.trim() || diasInvalidos) {
      setErro(null);
      return;
    }
    setSalvando(true);
    setErro(null);
    aoSalvar({
      nome: nome.trim(),
      email: email.trim() || null,
      ...(pode("ALUNO_SENSIVEL_ALTERAR") ? {objetivo:objetivo.trim()||null,observacoes:observacoes.trim()||null} : {}),
      versao: inicial?.versao ?? null,
      diasAtualizacao: diasDoCampo(dias),
      responsavelId:responsavelId||null,
    }).then(
      () => setSalvando(false),
      (e: unknown) => {
        setSalvando(false);
        // Limite do plano: o aviso explica (com "Ver minha conta") e o formulário fica como está, sem erro de campo.
        if (!avisarDoPlano(e)) setErro(e);
      },
    );
  };

  return (
    <View style={estilos.form}>
      <Texto variante="secao">Cadastro</Texto>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} autoComplete="off" maxLength={120} />
      <Campo
        rotulo="E-mail (opcional)"
        valor={email}
        aoMudar={setEmail}
        erro={campos.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="off"
        maxLength={254}
      />
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><Campo rotulo="Objetivo (opcional)" valor={objetivo} aoMudar={setObjetivo} erro={campos.objetivo} maxLength={200}
        ajuda={SENSIVEL} /></Permitido>
      <Texto variante="secao" style={estilos.secao}>Acompanhamento</Texto>
      {responsaveis?<Escolha rotulo="Treinador responsável" opcoes={responsaveis.map(r=>({valor:r.id,rotulo:r.nome}))} valor={responsavelId} aoMudar={setResponsavelId}/>:null}
      {erroResponsaveis?<MensagemErro texto={textoDoErro(erroResponsaveis)} tentarDeNovo={recarregar}/>:null}
      <Campo
        numerico
        rotulo="Dias para nova atualização (opcional)"
        valor={dias}
        aoMudar={(t) => setDias(t.replace(/\D/g, '').slice(0, 3))}
        erro={diasInvalidos ? 'Use de 1 a 365 dias.' : campos.diasAtualizacao}
        placeholder={diasPadrao ? `Padrão: ${diasPadrao} dias` : undefined}
        ajuda="Ao criar uma pasta de plano, o fim do período já vem preenchido com esses dias (você pode mudar). Vazio usa o padrão da consultoria, se houver (Marca › Acompanhamento)."
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
      />
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><Campo
        rotulo="Observações (opcional)"
        valor={observacoes}
        aoMudar={setObservacoes}
        erro={campos.observacoes}
        linhas={4}
        maxLength={4000}
        ajuda={SENSIVEL}
      /></Permitido>
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.botoes}>
        {aoCancelar ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} /> : null}
        <Botao rotulo={rotuloSalvar} aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || diasInvalidos} motivo={!nome.trim() ? 'Informe o nome do aluno.' : 'Os dias de atualização vão de 1 a 365.'} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  form: { gap: espaco(1.5) },
  secao: { marginTop: espaco(1) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
});
