import { somenteDigitos, UFS } from '@plataforma/web';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { buscarCep } from '../api/rotas';
import { useTema } from '../tema/TemaProvider';

import { enderecoComCep, LIMITES_ENDERECO, mascaraCep, type CampoDoEndereco, type EnderecoNoForm } from '../dominio/cadastroDoAluno';
import { espaco } from '../tema/tokens';
import { Campo } from './Campo';
import { Texto } from './Texto';
import { EscolhaEmFolha, type OpcaoDaFolha } from './EscolhaEmFolha';

const OPCOES_UF: readonly OpcaoDaFolha<string | null>[] = [{ valor: '', rotulo: 'Não informar' }, ...UFS.map((uf) => ({ valor: uf as string, rotulo: uf as string }))];

interface Props {
  valor: EnderecoNoForm;
  aoMudar: (valor: EnderecoNoForm) => void;
  /** Erro por campo (o servidor e a conferência local usam os mesmos nomes). */
  erros?: Partial<Record<CampoDoEndereco, string | undefined>>;
  desabilitado?: boolean;
}

/**
 * Os sete campos do endereço: o endereço inteiro é opcional, mas preenchido qualquer campo, CEP, rua, número (ou "s/n"),
 * cidade e UF são obrigatórios (marcados com *); complemento e bairro são opcionais. CEP com máscara, UF numa folha
 * de escolha. Ao completar um CEP novo (8 dígitos), rua, bairro, cidade e UF vêm da busca de CEP da própria API (o app
 * não fala com serviço de fora); se a busca falha, a pessoa preenche à mão. Um CEP que já veio preenchido (edição) não é
 * buscado de novo, para não trocar um endereço salvo. Usado na ficha do aluno e na pergunta de endereço da anamnese.
 */
export function CamposDeEndereco({ valor, aoMudar, erros = {}, desabilitado }: Props) {
  const { cores } = useTema();
  const mudar = (campo: CampoDoEndereco) => (texto: string) => aoMudar({ ...valor, [campo]: texto });
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // `tratado`: CEP (só dígitos) que já veio preenchido ou já foi buscado: apagar um dígito e digitar o mesmo não busca de novo
  // (não troca um endereço que a pessoa corrigiu). `busca`: número da busca em curso; qualquer digitação ou sair da tela o
  // muda, e a resposta de uma busca antiga é descartada.
  const tratado = useRef(somenteDigitos(valor.cep));
  const busca = useRef(0);
  const atual = useRef(valor);
  useEffect(() => { atual.current = valor; });
  useEffect(() => () => { busca.current += 1; }, []);
  const mudarCep = (texto: string) => {
    const cep = mascaraCep(texto);
    aoMudar({ ...valor, cep });
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
      .then((achado) => { if (busca.current === id) aoMudar(enderecoComCep(atual.current, achado)); })
      .catch((erro: unknown) => {
        if (busca.current !== id) return;
        tratado.current = '';
        if (erro instanceof ErroApi && erro.status === 404) setAviso('CEP não encontrado. Confira o número ou preencha o endereço.');
      })
      .finally(() => { if (busca.current === id) setBuscando(false); });
  };
  return (
    <View style={estilos.grupo}>
      <Texto variante="pequeno">Endereço (opcional). Se preencher, informe CEP, rua, número, cidade e UF (* obrigatório).</Texto>
      <Campo rotulo="CEP *" valor={valor.cep} aoMudar={mudarCep} erro={erros.cep} ajuda={buscando ? 'Buscando o endereço…' : aviso ?? undefined}
        keyboardType="number-pad" inputMode="numeric" autoComplete="postal-code" maxLength={LIMITES_ENDERECO.cep} editable={!desabilitado} />
      <Campo rotulo="Rua, avenida… *" valor={valor.logradouro} aoMudar={mudar('logradouro')} erro={erros.logradouro} autoComplete="street-address"
        maxLength={LIMITES_ENDERECO.logradouro} editable={!desabilitado} />
      <View style={estilos.linha}>
        <View style={estilos.estreito}>
          <Campo rotulo="Número *" placeholder="ou s/n" valor={valor.numero} aoMudar={mudar('numero')} erro={erros.numero} maxLength={LIMITES_ENDERECO.numero} editable={!desabilitado} />
        </View>
        <View style={estilos.largo}>
          <Campo rotulo="Complemento (opcional)" valor={valor.complemento} aoMudar={mudar('complemento')} erro={erros.complemento}
            maxLength={LIMITES_ENDERECO.complemento} editable={!desabilitado} />
        </View>
      </View>
      <Campo rotulo="Bairro (opcional)" valor={valor.bairro} aoMudar={mudar('bairro')} erro={erros.bairro} maxLength={LIMITES_ENDERECO.bairro} editable={!desabilitado} />
      {/* Cidade e UF na mesma linha; o rótulo vazio em cima da UF alinha o botão com o campo da cidade. Sem UF o botão diz
          só "—" ("Não informar" fica na folha), para a cidade não ficar espremida no celular. */}
      <View style={estilos.linha}>
        <View style={estilos.largo}>
          <Campo rotulo="Cidade *" valor={valor.cidade} aoMudar={mudar('cidade')} erro={erros.cidade} autoComplete="off" maxLength={LIMITES_ENDERECO.cidade}
            editable={!desabilitado} />
        </View>
        <View style={estilos.uf}>
          <Texto variante="rotulo" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"> </Texto>
          <EscolhaEmFolha<string | null> rotulo="UF *" titulo="Escolha a UF" valor={valor.uf || null} opcoes={OPCOES_UF} aoMudar={(uf) => mudar('uf')(uf ?? '')} rotuloDoValor="—"
            desabilitado={desabilitado} />
          {erros.uf ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erros.uf}</Texto> : null}
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
