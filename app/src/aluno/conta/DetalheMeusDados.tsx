import { Pencil } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { salvarMeusDados } from '../../api/rotas';
import type { MeusDadosResponse } from '../../api/tipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { CAMPOS_DO_ENDERECO, CPF_EM_USO, enderecoParaLeitura, MENSAGEM_CPF_EM_USO, mascaraCpf, mascaraTelefone } from '../../dominio/cadastroDoAluno';
import { cpfMascarado } from '../../dominio/contaDoAluno';
import {
  ALUNO_ANONIMIZADO, corpoDoPut, cpfEditavel, CPF_SO_PELO_TREINADOR, ehConflitoDeEdicao, emailParaLeitura, errosDoForm, errosDoServidor, formDeMeusDados,
  houveMudanca, mensagemDeErroMeusDados, temErros, TEXTO_SO_LEITURA, type ErrosMeusDados, type FormMeusDados,
} from '../../dominio/meusDados';
import { OPCOES_DE_SEXO, rotuloDoSexo, sexoDoCampo } from '../../dominio/sexo';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CamposDeEndereco } from '../../ui/CamposDeEndereco';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Texto } from '../../ui/Texto';
import { avisarQueOSexoMudou } from '../versaoDoSexo';
import type { Carga } from './tipos';

const SEM_ERROS: ErrosMeusDados = { endereco: {} };
const OPCOES_DO_SEXO = [{ valor: '', rotulo: 'Não informado' }, ...OPCOES_DE_SEXO];
const NAO_INFORMADO = 'Não informado';
/** Recusas em que o que está na tela já não vale: a edição volta à leitura com os dados do servidor e o aviso neutro. */
const RECARREGAM = new Set([CPF_SO_PELO_TREINADOR, ALUNO_ANONIMIZADO]);

/**
 * Detalhe "Meus dados" da Conta (23/11; antes o cartão `CartaoMeusDados`): lê primeiro (nome e e-mail só leitura, com quem
 * muda) numa `ListaDeDados` (24/11) e, em "Editar", telefone, sexo, CPF (só se vazio) e endereço com a busca de CEP. O CPF aparece mascarado, com
 * "Mostrar CPF". O rodapé da folha segue a barra de salvar do app ("Tudo salvo" / "Alterações não salvas", Cancelar e
 * Salvar); fechar com alteração pergunta "Sair sem salvar?". Só com internet; nada fica no aparelho. Versão velha (409)
 * recarrega e avisa sem cor de erro. Salvar outro sexo avisa o ciclo, que consulta de novo.
 */
export function DetalheMeusDados({ dados, aoFechar }: { dados: Carga<MeusDadosResponse>; aoFechar: () => void }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [form, setForm] = useState<FormMeusDados | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosMeusDados>(SEM_ERROS);
  const [verCpf, setVerCpf] = useState(false);
  const status = useRef<View>(null);
  const resp = dados.dados;
  const mudou = !!form && !!resp && houveMudanca(form, resp);
  const { fechar, aviso } = useFecharComAviso(true, mudou, aoFechar);

  const cancelar = () => {
    setForm(null);
    setDoServidor(SEM_ERROS);
  };

  const salvar = () => {
    if (!form || !resp || salvando) return;
    if (!houveMudanca(form, resp) || temErros(errosDoForm(form, resp))) return;
    setSalvando(true);
    const sexoAntes = sexoDoCampo(resp.sexo);
    salvarMeusDados(corpoDoPut(form, resp)).then(
      (novo) => {
        setSalvando(false);
        dados.definir(novo);
        setForm(null);
        if (sexoDoCampo(novo.sexo) !== sexoAntes) avisarQueOSexoMudou();
        avisar('Seus dados foram salvos.', 'sucesso');
      },
      (erro: unknown) => {
        setSalvando(false);
        if (ehConflitoDeEdicao(erro) || RECARREGAM.has(codigoApi(erro) ?? '')) {
          setForm(null);
          dados.recarregar();
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

  const locais = form && resp ? errosDoForm(form, resp) : SEM_ERROS;
  const invalido = temErros(locais);
  const rodape = !resp ? undefined : form ? (
    <>
      <Botao rotulo="Cancelar" tipo="secundario" desabilitado={salvando} motivo="Salvando seus dados." aoTocar={() => { cancelar(); requestAnimationFrame(() => status.current?.focus()); }} />
      {mudou ? <Botao rotulo="Salvar" carregando={salvando} desabilitado={invalido} motivo="Corrija os campos marcados." aoTocar={salvar} /> : null}
    </>
  ) : (
    <Botao rotulo="Editar" tipo="secundario" Icone={Pencil} desabilitado={dados.carregando} motivo="Atualizando seus dados."
      aoTocar={() => setForm(formDeMeusDados(resp))} />
  );
  const statusDoRodape = form ? (
    <View ref={status} tabIndex={-1} aria-live="polite" style={estilos.status}>
      <Texto variante="suave" cor={mudou ? cores.texto : undefined}>{mudou ? 'Alterações não salvas' : 'Tudo salvo'}</Texto>
    </View>
  ) : undefined;

  const mudar = (parcial: Partial<FormMeusDados>) => {
    // Qualquer digitação tira os erros do servidor (senão um 422 antigo ficaria marcado no campo já corrigido).
    setDoServidor(SEM_ERROS);
    setForm((atual) => (atual ? { ...atual, ...parcial } : atual));
  };
  const erroDoEndereco = Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, locais.endereco[c] ?? doServidor.endereco[c]]));
  const cpf = resp?.cpf?.trim() ? resp.cpf : null;
  // Linha do CPF (leitura e edição sem CPF editável): mascarado, com "Mostrar CPF" na coluna de ações.
  const linhaDoCpf = (
    <LinhaDeDado rotulo="CPF" valor={cpf ? (verCpf ? cpf : cpfMascarado(cpf)) : null} vazio={NAO_INFORMADO} numerico
      acoes={cpf ? <Botao rotulo={verCpf ? 'Esconder CPF' : 'Mostrar CPF'} tipo="fantasma" aoTocar={() => setVerCpf((v) => !v)} /> : undefined} />
  );

  return (
    <Folha visivel lateral titulo="Meus dados" aoFechar={fechar} rodape={rodape} statusDoRodape={statusDoRodape}>
      <View testID="detalhe-meus-dados" style={estilos.bloco}>
        {!resp ? (
          dados.erro ? <MensagemErro texto={textoDoErro(dados.erro)} erro={dados.erro} tentarDeNovo={dados.recarregar} /> : <Esqueleto cartoes={1} texto="Carregando seus dados" />
        ) : (
          <>
            <SoLeitura resp={resp} />
            <View style={[estilos.bloco, estilos.divisoria, { borderTopColor: cores.divisor }]}>
              {form ? (
                <>
                  <Campo rotulo="Telefone (opcional)" valor={form.telefone} aoMudar={(t) => mudar({ telefone: mascaraTelefone(t) })}
                    erro={locais.telefone ?? doServidor.telefone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} numerico />
                  <View style={estilos.campo}>
                    <Escolha rotulo="Sexo" valor={form.sexo} aoMudar={(sexo) => mudar({ sexo })} opcoes={OPCOES_DO_SEXO} />
                    {doServidor.sexo ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{doServidor.sexo}</Texto> : null}
                  </View>
                  {cpfEditavel(resp) ? (
                    <Campo rotulo="CPF (opcional)" valor={form.cpf} aoMudar={(t) => mudar({ cpf: mascaraCpf(t) })} erro={locais.cpf ?? doServidor.cpf}
                      keyboardType="number-pad" inputMode="numeric" maxLength={14} numerico ajuda="Depois de salvo, só o seu treinador pode mudar." />
                  ) : (
                    <View style={estilos.campo}>
                      <ListaDeDados>{linhaDoCpf}</ListaDeDados>
                      <Texto variante="pequeno">{TEXTO_SO_LEITURA}</Texto>
                    </View>
                  )}
                  <CamposDeEndereco valor={form.endereco} aoMudar={(endereco) => mudar({ endereco })} erros={erroDoEndereco} desabilitado={salvando} />
                </>
              ) : (
                <ListaDeDados>
                  <LinhaDeDado rotulo="Telefone" valor={resp.telefone} numerico />
                  <LinhaDeDado rotulo="Sexo" valor={rotuloDoSexo(resp.sexo)} />
                  {linhaDoCpf}
                  <LinhaDeDado rotulo="Endereço" valor={enderecoParaLeitura(resp.endereco)} />
                </ListaDeDados>
              )}
            </View>
          </>
        )}
      </View>
      {aviso}
    </Folha>
  );
}

/** Nome e um e-mail (o de acesso); quem muda é o treinador. Se o cadastro tem outro e-mail, a nota diz qual. */
function SoLeitura({ resp }: { resp: MeusDadosResponse }) {
  const email = emailParaLeitura(resp);
  return (
    <ListaDeDados>
      <LinhaDeDado rotulo="Nome" valor={resp.nome} />
      <LinhaDeDado rotulo={email.rotulo} valor={email.valor} nota={(
        <>
          <Texto variante="pequeno">{TEXTO_SO_LEITURA}</Texto>
          {email.nota ? <Texto variante="pequeno">{email.nota}</Texto> : null}
        </>
      )} />
    </ListaDeDados>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  // Linha fina entre o que só o treinador muda e o que o aluno muda.
  divisoria: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espaco(2) },
  campo: { gap: espaco(0.5) },
  status: { minHeight: 44, justifyContent: 'center' },
});
