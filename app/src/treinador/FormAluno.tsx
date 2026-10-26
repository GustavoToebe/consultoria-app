import { useSessao } from '../sessao/SessaoProvider';
import { Permitido } from '../ui/Permitido';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AlunoDetalhe, AlunoRequest } from '../api/tipos';
import { responsaveisEquipe } from '../api/rotas';
import {
  CAMPOS_DO_ENDERECO, CPF_EM_USO, ENDERECO_VAZIO, MENSAGEM_CPF_EM_USO, enderecoParaEnvio, enderecoParaForm, erroDoCpf, erroDoTelefone, errosDoEndereco,
  mascaraCpf, mascaraTelefone,
} from '../dominio/cadastroDoAluno';
import { CamposDeEndereco } from '../ui/CamposDeEndereco';
import { Escolha } from '../ui/Escolha';
import { useCarregar } from '../ui/useCarregar';
import { OPCOES_DE_SEXO, sexoDoCampo } from '../dominio/sexo';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../ui/erros';
import { Texto } from '../ui/Texto';
import { useAvisoDoPlano } from '../ui/useAvisoDoPlano';

interface Props {
  inicial?: AlunoDetalhe;
  rotuloSalvar: string;
  aoSalvar: (dados: AlunoRequest) => Promise<void>;
  aoCancelar?: () => void;
  /** Ciclo padrão da consultoria: aparece no campo vazio ("Padrão: 30 dias"), para não parecer "sem prazo". */
  diasPadrao?: number | null;
  /** Controle extra no começo da seção "Acompanhamento" (na ficha, a escolha do questionário, que grava na hora). */
  noAcompanhamento?: ReactNode;
}

/** Texto do campo em número de 1 a 365; vazio = sem prazo (undefined → null no envio) e inválido = null. */
/** Objetivo e observações são dados sensíveis (LGPD): a nota é a mesma nos dois campos. */
const SENSIVEL = 'Dado sensível: só membros com permissão de dados sensíveis veem.';

function diasDoCampo(texto: string): number | null {
  const n = Number(texto.trim());
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

/**
 * Dados do aluno em três seções: "Cadastro" (nome, e-mail, telefone, objetivo), "Dados pessoais" (CPF e endereço, só
 * com permissão de dados sensíveis) e "Acompanhamento" (responsável, ciclo, observações). O e-mail é opcional (o aluno
 * escolhe o dele ao aceitar o convite). O telefone é do usuário do aluno, então só aparece na edição de quem já tem
 * acesso. Objetivo, observações, CPF e endereço são dado sensível: ficam só no banco, nunca em log.
 */
export function FormAluno({ inicial, rotuloSalvar, aoSalvar, aoCancelar, diasPadrao = null, noAcompanhamento }: Props) {
  const {pode,usuario}=useSessao();
  const [responsavelId,setResponsavelId]=useState(inicial?.responsavelId??usuario?.id??'');
  const {dados:responsaveis,erro:erroResponsaveis,recarregar}=useCarregar('responsaveis-form',()=>responsaveisEquipe());
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [sexo, setSexo] = useState(inicial?.sexo ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '');
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '');
  const [cpf, setCpf] = useState(inicial?.cpf ?? '');
  const [endereco, setEndereco] = useState(() => (inicial ? enderecoParaForm(inicial.endereco) : ENDERECO_VAZIO));
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [dias, setDias] = useState(inicial?.diasAtualizacao ? String(inicial.diasAtualizacao) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const avisarDoPlano = useAvisoDoPlano();
  const campos = errosPorCampo(erro);
  const diasInvalidos = dias.trim() !== '' && diasDoCampo(dias) === null;
  // O telefone é do usuário do aluno (só existe depois do convite); CPF e endereço seguem a permissão de dados sensíveis.
  const comTelefone = !!inicial?.temAcesso && !inicial.anonimizado;
  const comSensivel = pode('ALUNO_SENSIVEL_ALTERAR');
  const erroTelefone = comTelefone ? erroDoTelefone(telefone) : undefined;
  const erroCpf = comSensivel ? erroDoCpf(cpf) : undefined;
  const errosEndereco = comSensivel ? errosDoEndereco(endereco) : {};
  const dadosInvalidos = !!erroTelefone || !!erroCpf || Object.keys(errosEndereco).length > 0;
  const cpfEmUso = codigoApi(erro) === CPF_EM_USO ? MENSAGEM_CPF_EM_USO : undefined;

  const salvar = () => {
    if (!nome.trim() || diasInvalidos || dadosInvalidos) {
      setErro(null);
      return;
    }
    setSalvando(true);
    setErro(null);
    aoSalvar({
      nome: nome.trim(),
      email: email.trim() || null,
      ...(comTelefone ? { telefone: telefone.trim() ? mascaraTelefone(telefone) : '' } : {}),
      ...(comSensivel ? {
        objetivo: objetivo.trim() || null, observacoes: observacoes.trim() || null,
        cpf: cpf.trim() ? mascaraCpf(cpf) : null, endereco: enderecoParaEnvio(endereco),
      } : {}),
      versao: inicial?.versao ?? null,
      sexo: sexoDoCampo(sexo),
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
      <Escolha rotulo="Sexo" valor={sexo} aoMudar={setSexo} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...OPCOES_DE_SEXO]} />
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
      {comTelefone ? (
        <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={(t) => setTelefone(mascaraTelefone(t))} erro={erroTelefone ?? campos.telefone}
          keyboardType="phone-pad" autoComplete="tel" maxLength={15} />
      ) : null}
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><Campo rotulo="Objetivo (opcional)" valor={objetivo} aoMudar={setObjetivo} erro={campos.objetivo} maxLength={200}
        ajuda={SENSIVEL} /></Permitido>
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR">
        <Texto variante="secao" style={estilos.secao}>Dados pessoais</Texto>
        <Campo rotulo="CPF (opcional)" valor={cpf} aoMudar={(t) => setCpf(mascaraCpf(t))} erro={erroCpf ?? cpfEmUso ?? campos.cpf} keyboardType="number-pad"
          inputMode="numeric" maxLength={14} ajuda={SENSIVEL} />
        <CamposDeEndereco valor={endereco} aoMudar={setEndereco}
          erros={Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, errosEndereco[c] ?? campos[`endereco.${c}`]]))} />
      </Permitido>
      <Texto variante="secao" style={estilos.secao}>Acompanhamento</Texto>
      {noAcompanhamento}
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
      {erro && Object.keys(campos).length === 0 && !cpfEmUso ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.botoes}>
        {aoCancelar ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} /> : null}
        <Botao rotulo={rotuloSalvar} aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || diasInvalidos || dadosInvalidos}
          motivo={!nome.trim() ? 'Informe o nome do aluno.' : diasInvalidos ? 'Os dias de atualização vão de 1 a 365.' : 'Corrija os campos marcados.'} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  form: { gap: espaco(1.5) },
  secao: { marginTop: espaco(1) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: espaco(1), flexWrap: 'wrap' },
});
