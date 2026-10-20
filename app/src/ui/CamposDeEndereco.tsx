import { UFS } from '@plataforma/web';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';

import { LIMITES_ENDERECO, mascaraCep, type CampoDoEndereco, type EnderecoNoForm } from '../dominio/cadastroDoAluno';
import { espaco } from '../tema/tokens';
import { Campo } from './Campo';
import { Texto } from './Texto';
import { EscolhaEmFolha, type OpcaoDaFolha } from './EscolhaEmFolha';

const OPCOES_UF: readonly OpcaoDaFolha<string>[] = [{ valor: '', rotulo: 'Não informar' }, ...UFS.map((uf) => ({ valor: uf as string, rotulo: uf as string }))];

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
 * de escolha. Sem busca de CEP na internet (o app só fala com a própria API). Usado na ficha do aluno e na pergunta de
 * endereço da anamnese.
 */
export function CamposDeEndereco({ valor, aoMudar, erros = {}, desabilitado }: Props) {
  const { cores } = useTema();
  const mudar = (campo: CampoDoEndereco) => (texto: string) => aoMudar({ ...valor, [campo]: texto });
  return (
    <View style={estilos.grupo}>
      <Texto variante="pequeno">Endereço (opcional). Se preencher, informe CEP, rua, número, cidade e UF (* obrigatório).</Texto>
      <Campo rotulo="CEP *" valor={valor.cep} aoMudar={(t) => mudar('cep')(mascaraCep(t))} erro={erros.cep} keyboardType="number-pad" inputMode="numeric"
        autoComplete="postal-code" maxLength={LIMITES_ENDERECO.cep} editable={!desabilitado} />
      <Campo rotulo="Rua, avenida… *" valor={valor.logradouro} aoMudar={mudar('logradouro')} erro={erros.logradouro} autoComplete="street-address"
        maxLength={LIMITES_ENDERECO.logradouro} editable={!desabilitado} />
      <View style={estilos.linha}>
        <View style={estilos.estreito}>
          <Campo rotulo="Número * (ou s/n)" valor={valor.numero} aoMudar={mudar('numero')} erro={erros.numero} maxLength={LIMITES_ENDERECO.numero} editable={!desabilitado} />
        </View>
        <View style={estilos.largo}>
          <Campo rotulo="Complemento (opcional)" valor={valor.complemento} aoMudar={mudar('complemento')} erro={erros.complemento}
            maxLength={LIMITES_ENDERECO.complemento} editable={!desabilitado} />
        </View>
      </View>
      <Campo rotulo="Bairro (opcional)" valor={valor.bairro} aoMudar={mudar('bairro')} erro={erros.bairro} maxLength={LIMITES_ENDERECO.bairro} editable={!desabilitado} />
      <Campo rotulo="Cidade *" valor={valor.cidade} aoMudar={mudar('cidade')} erro={erros.cidade} autoComplete="off" maxLength={LIMITES_ENDERECO.cidade}
        editable={!desabilitado} />
      <EscolhaEmFolha rotulo="UF *" titulo="Escolha a UF" valor={valor.uf} opcoes={OPCOES_UF} aoMudar={mudar('uf')} rotuloDoValor="Não informada"
        desabilitado={desabilitado} />
      {erros.uf ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erros.uf}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', gap: espaco(1.5) },
  estreito: { flex: 1 },
  largo: { flex: 2 },
});
