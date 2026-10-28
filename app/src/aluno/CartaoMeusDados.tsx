import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { meusDados, salvarMeusDados } from '../api/rotas';
import type { MeusDadosResponse } from '../api/tipos';
import { CAMPOS_DO_ENDERECO, CPF_EM_USO, enderecoParaLeitura, MENSAGEM_CPF_EM_USO, mascaraCpf, mascaraTelefone } from '../dominio/cadastroDoAluno';
import {
  ALUNO_ANONIMIZADO, corpoDoPut, cpfEditavel, CPF_SO_PELO_TREINADOR, ehConflitoDeEdicao, errosDoForm, errosDoServidor, formDeMeusDados,
  houveMudanca, mensagemDeErroMeusDados, temErros, TEXTO_SO_LEITURA, type ErrosMeusDados, type FormMeusDados,
} from '../dominio/meusDados';
import { OPCOES_DE_SEXO, rotuloDoSexo, sexoDoCampo } from '../dominio/sexo';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoLeitura } from '../ui/CampoLeitura';
import { CamposDeEndereco } from '../ui/CamposDeEndereco';
import { CamposEmLinha } from '../ui/CamposEmLinha';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, textoDoErro } from '../ui/erros';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { avisarQueOSexoMudou } from './versaoDoSexo';

const SEM_ERROS: ErrosMeusDados = { endereco: {} };
const OPCOES_DO_SEXO = [{ valor: '', rotulo: 'Não informado' }, ...OPCOES_DE_SEXO];
const NAO_INFORMADO = 'Não informado';
/** Recusas em que o que está na tela já não vale: a tela volta à leitura com os dados do servidor e o aviso neutro. */
const RECARREGAM = new Set([CPF_SO_PELO_TREINADOR, ALUNO_ANONIMIZADO]);

/**
 * "Meus dados" na Conta do aluno: lê primeiro (nome e e-mails só leitura, com a frase de quem muda) e, em "Editar",
 * telefone, sexo, CPF (só se estiver vazio) e endereço, com a busca de CEP. Só com internet: sem conexão o cartão some e
 * nada fica no aparelho. Erros de campo vêm da regra local primeiro e do servidor como reserva; versão velha (409)
 * recarrega e avisa sem cor de erro. Salvar um sexo diferente avisa o ciclo, que consulta de novo.
 */
export function CartaoMeusDados() {
  const { online } = useAluno();
  const carga = useCarregar(online ? 'aluno-meus-dados' : null, () => meusDados());
  const [form, setForm] = useState<FormMeusDados | null>(null);
  if (!online && !form) return null;
  if (carga.erro instanceof ErroApi && carga.erro.semConexao && !form) return null;
  if (!carga.dados) {
    return (
      <Cartao titulo="Meus dados">
        {carga.erro ? <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} /> : <Esqueleto cartoes={1} texto="Carregando seus dados" />}
      </Cartao>
    );
  }
  const resp = carga.dados;
  return (
    <Cartao titulo="Meus dados"
      acoes={form ? null : (
        <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} desabilitado={carga.carregando} motivo="Atualizando seus dados"
          aoTocar={() => setForm(formDeMeusDados(resp))} />
      )}>
      <SoLeitura resp={resp} />
      {form ? (
        <Edicao resp={resp} form={form} aoMudar={setForm}
          aoTerminar={(novo) => { carga.definir(novo); setForm(null); }}
          aoRecarregar={() => { setForm(null); carga.recarregar(); }}
          aoCancelar={() => setForm(null)} />
      ) : <Leitura resp={resp} />}
    </Cartao>
  );
}

/** Nome, e-mail do cadastro e e-mail de acesso: o aluno lê, quem muda é o treinador (uma frase para os três). */
function SoLeitura({ resp }: { resp: MeusDadosResponse }) {
  return (
    <View style={estilos.bloco}>
      <CamposEmLinha minimo={200}>
        <CampoLeitura rotulo="Nome" valor={resp.nome} />
        <CampoLeitura rotulo="E-mail do cadastro" valor={resp.email} />
        <CampoLeitura rotulo="E-mail de acesso" valor={resp.emailDeAcesso} />
      </CamposEmLinha>
      <Texto variante="pequeno">{TEXTO_SO_LEITURA}</Texto>
    </View>
  );
}

/** O que o aluno pode mudar, na mesma ordem da edição (o endereço, mais longo, por último). */
function Leitura({ resp }: { resp: MeusDadosResponse }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.bloco, estilos.divisoria, { borderTopColor: cores.borda }]}>
      <CamposEmLinha minimo={200}>
        <CampoLeitura rotulo="Telefone" valor={resp.telefone} numerico />
        <CampoLeitura rotulo="Sexo" valor={rotuloDoSexo(resp.sexo)} />
        <CampoLeitura rotulo="CPF" valor={resp.cpf?.trim() ? resp.cpf : NAO_INFORMADO} numerico />
      </CamposEmLinha>
      <CampoLeitura rotulo="Endereço" valor={enderecoParaLeitura(resp.endereco)} />
    </View>
  );
}

interface PropsEdicao {
  resp: MeusDadosResponse;
  form: FormMeusDados;
  aoMudar: (form: FormMeusDados) => void;
  aoTerminar: (novo: MeusDadosResponse) => void;
  aoRecarregar: () => void;
  aoCancelar: () => void;
}

function Edicao({ resp, form, aoMudar, aoTerminar, aoRecarregar, aoCancelar }: PropsEdicao) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [salvando, setSalvando] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosMeusDados>(SEM_ERROS);
  const locais = errosDoForm(form, resp);
  const mudou = houveMudanca(form, resp);
  const invalido = temErros(locais);
  const comCpf = cpfEditavel(resp);
  // Qualquer digitação tira os erros do servidor (senão um 422 antigo ficaria marcado no campo já corrigido).
  const mudar = (parcial: Partial<FormMeusDados>) => {
    setDoServidor(SEM_ERROS);
    aoMudar({ ...form, ...parcial });
  };

  const salvar = () => {
    if (!mudou || invalido || salvando) return;
    setSalvando(true);
    const sexoAntes = sexoDoCampo(resp.sexo);
    salvarMeusDados(corpoDoPut(form, resp)).then(
      (novo) => {
        setSalvando(false);
        aoTerminar(novo);
        if (sexoDoCampo(novo.sexo) !== sexoAntes) avisarQueOSexoMudou();
        avisar('Seus dados foram salvos.', 'sucesso');
      },
      (erro: unknown) => {
        setSalvando(false);
        if (ehConflitoDeEdicao(erro) || RECARREGAM.has(codigoApi(erro) ?? '')) {
          aoRecarregar();
          avisar(mensagemDeErroMeusDados(erro), 'neutro');
          return;
        }
        const campos = errosDoServidor(erro);
        if (codigoApi(erro) === CPF_EM_USO) campos.cpf = MENSAGEM_CPF_EM_USO;
        setDoServidor(campos);
        avisar(mensagemDeErroMeusDados(erro), 'perigo');
      },
    );
  };

  const erroDoEndereco = Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, locais.endereco[c] ?? doServidor.endereco[c]]));
  return (
    <View style={[estilos.bloco, estilos.divisoria, { borderTopColor: cores.borda }]}>
      <Campo rotulo="Telefone (opcional)" valor={form.telefone} aoMudar={(t) => mudar({ telefone: mascaraTelefone(t) })}
        erro={locais.telefone ?? doServidor.telefone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} numerico />
      <View style={estilos.campo}>
        <Escolha rotulo="Sexo" valor={form.sexo} aoMudar={(sexo) => mudar({ sexo })} opcoes={OPCOES_DO_SEXO} />
        {doServidor.sexo ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{doServidor.sexo}</Texto> : null}
      </View>
      {comCpf ? (
        <Campo rotulo="CPF (opcional)" valor={form.cpf} aoMudar={(t) => mudar({ cpf: mascaraCpf(t) })} erro={locais.cpf ?? doServidor.cpf}
          keyboardType="number-pad" inputMode="numeric" maxLength={14} numerico ajuda="Depois de salvo, só o seu treinador pode mudar." />
      ) : (
        <View style={estilos.campo}>
          <CampoLeitura rotulo="CPF" valor={resp.cpf} numerico />
          <Texto variante="pequeno">{TEXTO_SO_LEITURA}</Texto>
        </View>
      )}
      <CamposDeEndereco valor={form.endereco} aoMudar={(endereco) => mudar({ endereco })} erros={erroDoEndereco} desabilitado={salvando} />
      <LinhaDeAcoes alinhar="fim">
        <Botao rotulo="Cancelar" tipo="secundario" desabilitado={salvando} motivo="Salvando seus dados" aoTocar={aoCancelar} />
        <Botao rotulo="Salvar" carregando={salvando} desabilitado={!mudou || invalido}
          motivo={invalido ? 'Corrija os campos marcados.' : 'Nada foi alterado ainda.'} aoTocar={salvar} />
      </LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  // Linha fina entre o que só o treinador muda e o que o aluno muda.
  divisoria: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espaco(2) },
  campo: { gap: espaco(0.5) },
});
