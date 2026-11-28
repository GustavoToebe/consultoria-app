import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import type { ConsultoriaResponse } from '../../api/tipos';
import { mascaraTelefone } from '../../dominio/cadastroDoAluno';
import { linkParaFalarComOTreinador, NOME_DO_REMETENTE_MAXIMO, problemasDoContato, RESPONDER_PARA_MAXIMO } from '../../dominio/contatoDaConsultoria';
import { remetenteDosEmails } from '../../dominio/previaDaMarca';
import { corpoDasRedes, erroDaRede, formDasRedes, REDES_DA_CONSULTORIA, redesAlteradas, valoresDasRedesDaConsultoria, type ValoresDasRedes } from '../../dominio/redesSociais';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, fontes } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { RedesSociais } from '../../ui/RedesSociais';
import { Texto } from '../../ui/Texto';
import { LARGURA_DO_FORMULARIO_DO_CONTATO } from './arranjoDaMarca';
import { ComPrevia } from './ComPrevia';
import { PreviaDoContato } from './PreviaDoContato';
import { RodapeDeSalvar } from './RodapeDeSalvar';
import { useSalvarConsultoria } from './useSalvarConsultoria';

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

const ROTULO_DO_WHATSAPP = 'WhatsApp da consultoria';

/**
 * Contato da consultoria (Configurações › Contato, 27/11; saiu da Marca): WhatsApp, remetente e "responder para" dos
 * e-mails e as redes sociais, com a prévia ao vivo da Conta do aluno e do e-mail de lembrete (28/11, o padrão da Marca).
 * Grava no mesmo `PUT /consultoria/marca`, com o resto como está gravado, pelo rodapé fixo (Cancelar volta ao salvo).
 * O WhatsApp é guardado como a API o devolve, `(45) 99999-8888`; o +55 fica fixo ao lado do campo.
 */
export function FormContato({ consultoria, aoSalvar, aoConflito }: Props) {
  const { usuario } = useSessao();
  const { avisar } = useAviso();
  const contatoSalvo = { whatsapp: consultoria.whatsapp ?? '', emailRemetenteNome: consultoria.emailRemetenteNome ?? '', emailResponderPara: consultoria.emailResponderPara ?? '' };
  const [contato, setContato] = useState(contatoSalvo);
  const campoDoWhatsApp = useRef<TextInput>(null);
  // Com o balão do ⓘ aberto, o primeiro cartão sobe de camada: o balão passa por cima do cartão de baixo (na web cada
  // `View` empilha os filhos, e o de baixo vem depois).
  const [dicaAberta, setDicaAberta] = useState(false);
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
  // "Testar" só com um número que o aluno conseguiria usar (o mesmo link do "Falar com o treinador").
  const linkDoWhatsApp = contato.whatsapp.trim() && !problemas.whatsapp ? linkParaFalarComOTreinador(contato.whatsapp) : null;
  const nomeDoRemetente = [...contato.emailRemetenteNome].length;

  const enviar = () => salvar(
    // Os três sempre: em branco apaga na API.
    { whatsapp: contato.whatsapp.trim(), emailRemetenteNome: contato.emailRemetenteNome.trim(), emailResponderPara: contato.emailResponderPara.trim(), redesSociais: corpoDasRedes(redes) },
    (c) => setRedes(valoresDasRedesDaConsultoria(c.redesSociais)),
  );
  const cancelar = () => {
    setContato(contatoSalvo);
    setRedes(valoresDasRedesDaConsultoria(consultoria.redesSociais));
    // O rodapé some com os botões: o foco vai ao primeiro campo (que continua na tela).
    campoDoWhatsApp.current?.focus();
  };

  const formulario = (
    <>
      <Cartao titulo="Como o aluno fala com você" descricao="Opcional. Vazio, o botão não aparece para o aluno." style={dicaAberta ? estilos.porCima : null}>
        <View style={estilos.campoDoWhatsApp}>
          <View style={estilos.rotuloComDica}>
            <Texto variante="rotulo" aria-hidden>{ROTULO_DO_WHATSAPP}</Texto>
            <DicaDeTexto rotulo="Onde o aluno vê o WhatsApp" texto="Aparece para o aluno em Conta › Falar com o treinador." aoMudar={setDicaAberta} />
          </View>
          <View style={estilos.linhaDoWhatsApp}>
            <Texto style={estilos.pais} aria-hidden>+55</Texto>
            <View style={estilos.whatsapp}>
              <Campo ref={campoDoWhatsApp} rotulo={ROTULO_DO_WHATSAPP} rotuloOculto rotuloAcessivel={ROTULO_DO_WHATSAPP}
                valor={contato.whatsapp} aoMudar={(t) => mudarContato('whatsapp')(mascaraTelefone(t))}
                erro={problemas.whatsapp ?? campos.whatsapp} keyboardType="phone-pad" inputMode="tel" autoComplete="tel" textContentType="telephoneNumber"
                maxLength={15} placeholder="(45) 99999-9999" />
            </View>
            {linkDoWhatsApp ? (
              <Botao rotulo="Testar" rotuloAcessivel="Testar o WhatsApp (abre fora do app)" tipo="fantasma"
                aoTocar={() => void abrirLinkExterno(linkDoWhatsApp).then((ok) => { if (!ok) avisar('Não foi possível abrir o WhatsApp.', 'perigo'); })} />
            ) : null}
          </View>
        </View>
      </Cartao>
      <Cartao titulo="E-mails do app" descricao="De quem o lembrete de cobrança e o convite de equipe parecem vir.">
        <View style={estilos.campoMedio}>
          <Campo rotulo="Nome que aparece nos e-mails" valor={contato.emailRemetenteNome} aoMudar={mudarContato('emailRemetenteNome')}
            erro={problemas.emailRemetenteNome ?? campos.emailRemetenteNome} autoComplete="off" maxLength={NOME_DO_REMETENTE_MAXIMO}
            placeholder={consultoria.marca.nome} sufixo={`${nomeDoRemetente}/${NOME_DO_REMETENTE_MAXIMO}`}
            ajuda="Vazio, vai o nome da consultoria." />
        </View>
        <View style={estilos.campoMedio}>
          <Campo rotulo="Responder para" valor={contato.emailResponderPara} aoMudar={mudarContato('emailResponderPara')}
            erro={problemas.emailResponderPara ?? campos.emailResponderPara} keyboardType="email-address" inputMode="email" autoCapitalize="none"
            autoComplete="email" spellCheck={false} maxLength={RESPONDER_PARA_MAXIMO} placeholder={usuario?.email || undefined}
            ajuda="Quem responde ao lembrete de cobrança ou ao convite de equipe escreve para este e-mail." />
        </View>
      </Cartao>
      <Cartao titulo="Redes sociais" descricao="O aluno vê as preenchidas na Conta, como botões que abrem fora do app. Use @usuário ou o link do perfil; no site, o link completo.">
        <View style={estilos.campoMedio}>
          <RedesSociais modo="edicao" redesPermitidas={REDES_DA_CONSULTORIA} valores={redes} aoMudar={setRedes} erros={errosDasRedes} />
        </View>
      </Cartao>
    </>
  );

  return (
    <ComPrevia
      largura={LARGURA_DO_FORMULARIO_DO_CONTATO}
      formulario={formulario}
      previa={(arranjo) => (
        <PreviaDoContato marca={consultoria.marca} temWhatsApp={!!linkDoWhatsApp} redes={redes} arranjo={arranjo}
          remetente={problemas.emailRemetenteNome ? consultoria.marca.nome : remetenteDosEmails(contato.emailRemetenteNome, consultoria.marca.nome)}
          responderPara={problemas.emailResponderPara ? '' : contato.emailResponderPara} />
      )}
      fim={(
        <>
          {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
          <RodapeDeSalvar alterado={alterado} rotulo="Salvar contato" salvando={salvando} aoSalvar={enviar} aoCancelar={cancelar}
            motivo={valido ? null : 'Corrija os campos marcados.'} />
        </>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  campoDoWhatsApp: { gap: espaco(0.5) },
  rotuloComDica: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  linhaDoWhatsApp: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), flexWrap: 'wrap' },
  // A mesma altura da caixa do campo (44), para o +55 ficar na linha do texto digitado.
  pais: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 44 },
  whatsapp: { width: 240, maxWidth: '100%', flexShrink: 1 },
  campoMedio: { maxWidth: 480 },
  // O `Cartao` com título corta o que passa da borda (`overflow: hidden`); com o balão aberto, não corta.
  porCima: { zIndex: 2, overflow: 'visible' },
});
