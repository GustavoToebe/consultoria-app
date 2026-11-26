import { somenteDigitos, UFS } from '@plataforma/web';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type TextInputProps } from 'react-native';

import { ErroApi } from '../api/cliente';
import { buscarCep } from '../api/rotas';

import { enderecoComCep, LIMITES_ENDERECO, mascaraCep, type CampoDoEndereco, type EnderecoNoForm } from '../dominio/cadastroDoAluno';
import { separarNumeroDaRua } from '../dominio/enderecoDoNavegador';
import { espaco } from '../tema/tokens';
import { Campo, MensagemDeErro } from './Campo';
import { Texto } from './Texto';
import { EscolhaEmFolha, type OpcaoDaFolha } from './EscolhaEmFolha';

const OPCOES_UF: readonly OpcaoDaFolha<string | null>[] = [{ valor: '', rotulo: 'Não informar' }, ...UFS.map((uf) => ({ valor: uf as string, rotulo: uf as string }))];

/**
 * Tokens de `autocomplete` do endereço, para o navegador preencher cada campo. Na web valem os do HTML (o Chrome não tem
 * token de número: o Número fica sem token, e o número que vier na rua é separado por `separarNumeroDaRua`). No celular
 * ficam os que o React Native mapeia direito (o Android leva `address-line1` para "região"); os `address-level*` não existem
 * no tipo do React Native, por isso o `as`. A UF é um botão de escolha, não um `input`: o navegador não a preenche (vem da
 * busca de CEP ou da escolha da pessoa).
 */
const AUTOCOMPLETE = Platform.select<Partial<Record<'cep' | 'logradouro' | 'complemento' | 'bairro' | 'cidade', string>>>({
  web: { cep: 'postal-code', logradouro: 'address-line1', complemento: 'address-line2', bairro: 'address-level3', cidade: 'address-level2' },
  default: { cep: 'postal-code', logradouro: 'street-address', cidade: 'off' },
}) as Record<string, TextInputProps['autoComplete']>;

interface Props {
  valor: EnderecoNoForm;
  aoMudar: (valor: EnderecoNoForm) => void;
  /** Erro por campo (o servidor e a conferência local usam os mesmos nomes). */
  erros?: Partial<Record<CampoDoEndereco, string | undefined>>;
  desabilitado?: boolean;
  /**
   * Dentro de uma pergunta de endereço (que já tem o rótulo "Endereço" em cima): a linha de instrução não repete
   * "Endereço" e diz se a pergunta é obrigatória. Sem isto (ficha do aluno), a linha começa por "Endereço (opcional)".
   */
  naPergunta?: { obrigatoria: boolean };
}

/**
 * Os sete campos do endereço: o endereço inteiro é opcional, mas preenchido qualquer campo, CEP, rua, número (ou "s/n"),
 * cidade e UF são obrigatórios (marcados com *); complemento e bairro são opcionais. CEP com máscara, UF numa folha
 * de escolha. Ao completar um CEP novo (8 dígitos), rua, bairro, cidade e UF vêm da busca de CEP da própria API (o app
 * não fala com serviço de fora); se a busca falha, a pessoa preenche à mão. Um CEP que já veio preenchido (edição) não é
 * buscado de novo, para não trocar um endereço salvo. Usado na ficha do aluno e na pergunta de endereço da anamnese.
 */
export function CamposDeEndereco({ valor, aoMudar, erros = {}, desabilitado, naPergunta }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // `tratado`: CEP (só dígitos) que já veio preenchido ou já foi buscado: apagar um dígito e digitar o mesmo não busca de novo
  // (não troca um endereço que a pessoa corrigiu). `busca`: número da busca em curso; qualquer digitação ou sair da tela o
  // muda, e a resposta de uma busca antiga é descartada.
  const tratado = useRef(somenteDigitos(valor.cep));
  const busca = useRef(0);
  // O valor mais recente do endereço, atualizado na hora a cada mudança que sai daqui (não só depois de renderizar): o
  // preenchimento automático dispara vários `onChange` seguidos e cada um parte do resultado do anterior, nunca de um `valor`
  // velho do render; quando o pai manda outro valor, ele vale.
  const atual = useRef(valor);
  useEffect(() => { atual.current = valor; }, [valor]);
  useEffect(() => () => { busca.current += 1; }, []);
  const emitir = (parcial: Partial<EnderecoNoForm>) => {
    atual.current = { ...atual.current, ...parcial };
    aoMudar(atual.current);
  };
  const mudar = (campo: CampoDoEndereco, texto: string) => emitir({ [campo]: texto });
  // Salto de mais de um caractere = autofill ou colar: separa o número da rua na hora. Digitando, só ao sair do campo (senão
  // "Rua X, 1" viraria rua e número no meio da digitação).
  const mudarRua = (texto: string) => {
    const salto = Math.abs(texto.length - atual.current.logradouro.length) > 1;
    emitir(salto ? separarNumeroDaRua(texto, atual.current.numero) : { logradouro: texto });
  };
  const sairDaRua = () => {
    const separado = separarNumeroDaRua(atual.current.logradouro, atual.current.numero);
    if (separado.logradouro !== atual.current.logradouro) emitir(separado);
  };
  const mudarCep = (texto: string) => {
    const cep = mascaraCep(texto);
    emitir({ cep });
    const digitos = somenteDigitos(cep);
    const id = ++busca.current;
    setAviso(null);
    if (digitos.length !== 8 || digitos === tratado.current) {
      setBuscando(false);
      return;
    }
    tratado.current = digitos;
    setBuscando(true);
    buscarCep(digitos)
      .then((achado) => { if (busca.current === id) { atual.current = enderecoComCep(atual.current, achado); aoMudar(atual.current); } })
      .catch((erro: unknown) => {
        if (busca.current !== id) return;
        tratado.current = '';
        if (erro instanceof ErroApi && erro.status === 404) setAviso('CEP não encontrado. Confira o número ou preencha o endereço.');
      })
      .finally(() => { if (busca.current === id) setBuscando(false); });
  };
  return (
    <View style={estilos.grupo}>
      <Texto variante="pequeno">{!naPergunta ? 'Endereço (opcional). Se preencher, informe CEP, rua, número, cidade e UF (* obrigatório).'
        : naPergunta.obrigatoria ? 'Informe CEP, rua, número, cidade e UF; complemento e bairro são opcionais.'
          : 'Opcional. Se preencher, informe CEP, rua, número, cidade e UF (* obrigatório).'}</Texto>
      <Campo rotulo="CEP *" valor={valor.cep} aoMudar={mudarCep} erro={erros.cep} ajuda={buscando ? 'Buscando o endereço…' : aviso ?? undefined}
        keyboardType="number-pad" inputMode="numeric" autoComplete={AUTOCOMPLETE.cep} maxLength={LIMITES_ENDERECO.cep} editable={!desabilitado} />
      <Campo rotulo="Rua, avenida… *" valor={valor.logradouro} aoMudar={mudarRua} onBlur={sairDaRua} erro={erros.logradouro} autoComplete={AUTOCOMPLETE.logradouro}
        maxLength={LIMITES_ENDERECO.logradouro} editable={!desabilitado} />
      <View style={estilos.linha}>
        <View style={estilos.estreito}>
          <Campo rotulo="Número *" placeholder="ou s/n" valor={valor.numero} aoMudar={(t) => mudar('numero', t)} erro={erros.numero} maxLength={LIMITES_ENDERECO.numero} editable={!desabilitado} />
        </View>
        <View style={estilos.largo}>
          <Campo rotulo="Complemento (opcional)" valor={valor.complemento} aoMudar={(t) => mudar('complemento', t)} erro={erros.complemento}
            autoComplete={AUTOCOMPLETE.complemento} maxLength={LIMITES_ENDERECO.complemento} editable={!desabilitado} />
        </View>
      </View>
      <Campo rotulo="Bairro (opcional)" valor={valor.bairro} aoMudar={(t) => mudar('bairro', t)} erro={erros.bairro} autoComplete={AUTOCOMPLETE.bairro} maxLength={LIMITES_ENDERECO.bairro} editable={!desabilitado} />
      {/* Cidade e UF na mesma linha; o rótulo vazio em cima da UF alinha o botão com o campo da cidade. Sem UF o botão diz
          só "—" ("Não informar" fica na folha), para a cidade não ficar espremida no celular. */}
      <View style={estilos.linha}>
        <View style={estilos.largo}>
          <Campo rotulo="Cidade *" valor={valor.cidade} aoMudar={(t) => mudar('cidade', t)} erro={erros.cidade} autoComplete={AUTOCOMPLETE.cidade} maxLength={LIMITES_ENDERECO.cidade}
            editable={!desabilitado} />
        </View>
        <View style={estilos.uf}>
          <Texto variante="rotulo" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"> </Texto>
          <EscolhaEmFolha<string | null> rotulo="UF *" titulo="Escolha a UF" valor={valor.uf || null} opcoes={OPCOES_UF} aoMudar={(uf) => mudar('uf', uf ?? '')} rotuloDoValor="—"
            desabilitado={desabilitado} />
          {erros.uf ? <MensagemDeErro erro={erros.uf} /> : null}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', gap: espaco(1.5) },
  estreito: { flex: 1 },
  largo: { flex: 2 },
  uf: { gap: espaco(0.5) },
});
