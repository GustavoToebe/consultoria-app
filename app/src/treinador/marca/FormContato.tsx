import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConsultoriaResponse } from '../../api/tipos';
import { mascaraTelefone } from '../../dominio/cadastroDoAluno';
import { NOME_DO_REMETENTE_MAXIMO, problemasDoContato, RESPONDER_PARA_MAXIMO } from '../../dominio/contatoDaConsultoria';
import { corpoDasRedes, erroDaRede, formDasRedes, REDES_DA_CONSULTORIA, redesAlteradas, valoresDasRedesDaConsultoria, type ValoresDasRedes } from '../../dominio/redesSociais';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { RedesSociais } from '../../ui/RedesSociais';
import { RodapeDeSalvar } from './RodapeDeSalvar';
import { useSalvarConsultoria } from './useSalvarConsultoria';

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/**
 * Contato da consultoria (Configurações › Contato, 27/11; saiu da Marca): WhatsApp, remetente e "responder para" dos
 * e-mails e as redes sociais. Grava no mesmo `PUT /consultoria/marca`, com o resto como está gravado.
 */
export function FormContato({ consultoria, aoSalvar, aoConflito }: Props) {
  const contatoSalvo = { whatsapp: consultoria.whatsapp ?? '', emailRemetenteNome: consultoria.emailRemetenteNome ?? '', emailResponderPara: consultoria.emailResponderPara ?? '' };
  const [contato, setContato] = useState(contatoSalvo);
  const mudarContato = (campo: keyof typeof contato) => (valor: string) => setContato((atual) => ({ ...atual, [campo]: valor }));
  const problemas = problemasDoContato(contato);
  const valido = Object.keys(problemas).length === 0;
  const contatoAlterado = (Object.keys(contato) as (keyof typeof contato)[]).some((k) => contato[k].trim() !== contatoSalvo[k].trim());
  // Redes sociais: uma linha por rede adicionada, com o link gravado (a API normaliza o `@usuario`); depois de salvar, volta ao que ela devolveu.
  // Rede removida some das chaves: `corpoDasRedes` manda em branco e a API apaga; `redesAlteradas` conta a remoção como alteração.
  const redesSalvas = formDasRedes(consultoria.redesSociais);
  const [redes, setRedes] = useState<ValoresDasRedes>(() => valoresDasRedesDaConsultoria(consultoria.redesSociais));
  const { salvar, salvando, erro, campos } = useSalvarConsultoria({ consultoria, aoSalvar, aoConflito, sucesso: 'Contato salvo.' });
  const errosDasRedes = Object.fromEntries(REDES_DA_CONSULTORIA.flatMap((r) => { const e = erroDaRede(campos, r); return e ? [[r, e]] : []; }));
  const alterado = contatoAlterado || redesAlteradas(redes, redesSalvas);

  const enviar = () => salvar(
    // Os três sempre: em branco apaga na API.
    { whatsapp: contato.whatsapp.trim(), emailRemetenteNome: contato.emailRemetenteNome.trim(), emailResponderPara: contato.emailResponderPara.trim(), redesSociais: corpoDasRedes(redes) },
    (c) => setRedes(valoresDasRedesDaConsultoria(c.redesSociais)),
  );

  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Como o aluno fala com você" descricao="Opcional. Vazio, o botão não aparece para o aluno.">
        <View style={estilos.campoCurto}>
          <Campo rotulo="WhatsApp da consultoria" valor={contato.whatsapp} aoMudar={(t) => mudarContato('whatsapp')(mascaraTelefone(t))}
            erro={problemas.whatsapp ?? campos.whatsapp} keyboardType="phone-pad" autoComplete="tel" maxLength={15}
            ajuda="Aparece para o aluno em Conta › Falar com o treinador." />
        </View>
      </Cartao>
      <Cartao titulo="E-mails do app" descricao="De quem o lembrete de cobrança e o convite de equipe parecem vir.">
        <Campo rotulo="Nome que aparece nos e-mails" valor={contato.emailRemetenteNome} aoMudar={mudarContato('emailRemetenteNome')}
          erro={problemas.emailRemetenteNome ?? campos.emailRemetenteNome} autoComplete="off" maxLength={NOME_DO_REMETENTE_MAXIMO}
          ajuda={`Até ${NOME_DO_REMETENTE_MAXIMO} caracteres. Vazio, vai o nome da consultoria.`} />
        <Campo rotulo="Responder para" valor={contato.emailResponderPara} aoMudar={mudarContato('emailResponderPara')}
          erro={problemas.emailResponderPara ?? campos.emailResponderPara} keyboardType="email-address" autoCapitalize="none"
          autoComplete="email" spellCheck={false} maxLength={RESPONDER_PARA_MAXIMO}
          ajuda="Quem responde ao lembrete de cobrança ou ao convite de equipe escreve para este e-mail." />
      </Cartao>
      <Cartao titulo="Redes sociais" descricao="O aluno vê as preenchidas na Conta, como botões que abrem fora do app. Use @usuário ou o link do perfil; no site, o link completo.">
        <RedesSociais modo="edicao" redesPermitidas={REDES_DA_CONSULTORIA} valores={redes} aoMudar={setRedes} erros={errosDasRedes} />
      </Cartao>
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <RodapeDeSalvar alterado={alterado} rotulo="Salvar contato" salvando={salvando} aoSalvar={enviar}
        motivo={valido ? null : 'Corrija os campos marcados.'} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2), maxWidth: LARGURA_FORMULARIO },
  campoCurto: { maxWidth: 280 },
});
