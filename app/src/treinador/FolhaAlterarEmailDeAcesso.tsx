import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { alterarEmailDeAcessoDoAluno } from '../api/rotas';
import type { AlunoDetalhe, EmailDeAcessoAlterado } from '../api/tipos';
import { errosDoNovoEmail, LIMITE_DO_EMAIL, traduzirErroDoAcesso, type ErrosDoNovoEmail } from '../dominio/acessoAoApp';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { Alerta } from '../ui/Estados';
import { focarPrimeiroComErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { LinhaDeDado, ListaDeDados } from '../ui/ListaDeDados';
import { Texto } from '../ui/Texto';

type CampoDoEmail = keyof ErrosDoNovoEmail;

/**
 * Folha "Alterar e-mail de acesso" (25/11), aberta pela linha E-mail de acesso do cartão. Novo e-mail e a confirmação;
 * a própria folha diz o efeito (sessões encerradas, aviso por e-mail se o envio estiver ligado), então não há outro
 * painel de confirmação. O aviso de sucesso (com `emailEnviado`) é de quem abriu a folha (`textoDoEmailAlterado`). Montada só aberta: cada abertura nasce limpa. Os campos não sugerem preenchimento automático (que
 * traria o e-mail do próprio treinador).
 */
export function FolhaAlterarEmailDeAcesso({ aluno, aoFechar, aoSalvar }: {
  aluno: AlunoDetalhe;
  aoFechar: () => void;
  aoSalvar: (resposta: EmailDeAcessoAlterado) => void;
}) {
  const [form, setForm] = useState({ email: '', confirmacao: '' });
  const [tocados, setTocados] = useState<ReadonlySet<CampoDoEmail>>(new Set());
  const [tentou, setTentou] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosDoNovoEmail>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refs = { email: useRef<TextInput>(null), confirmacao: useRef<TextInput>(null) };

  const locais = errosDoNovoEmail(form.email, form.confirmacao, aluno.emailDeAcesso);
  const erroDe = (c: CampoDoEmail) => ((tentou || tocados.has(c)) ? locais[c] : undefined) ?? doServidor[c] ?? null;
  const focar = (erros: ErrosDoNovoEmail) => focarPrimeiroComErro(erros as Record<string, string>, [['email', refs.email], ['confirmacao', refs.confirmacao]]);

  const mudar = (c: CampoDoEmail, valor: string) => {
    setForm((f) => ({ ...f, [c]: valor }));
    setDoServidor((e) => ({ ...e, [c]: undefined }));
    setGeral(null);
  };

  const salvar = () => {
    if (enviando) return;
    setTentou(true);
    if (Object.keys(locais).length > 0) {
      setGeral(null);
      focar(locais);
      return;
    }
    setEnviando(true);
    setGeral(null);
    alterarEmailDeAcessoDoAluno(aluno.id, form.email.trim()).then(
      (resposta) => { setEnviando(false); aoSalvar(resposta); },
      (e: unknown) => {
        setEnviando(false);
        const t = traduzirErroDoAcesso(e);
        setDoServidor(t.campos);
        setGeral(t.mensagem);
        focar(t.campos);
      },
    );
  };

  const campo = (c: CampoDoEmail, rotulo: string, ajuda?: string) => (
    <Campo ref={refs[c]} rotulo={rotulo} valor={form[c]} erro={erroDe(c)} editable={!enviando} ajuda={ajuda}
      aoMudar={(t) => mudar(c, t)} onBlur={() => setTocados((s) => (s.has(c) ? s : new Set(s).add(c)))}
      onSubmitEditing={c === 'email' ? () => refs.confirmacao.current?.focus() : salvar}
      keyboardType="email-address" inputMode="email" autoCapitalize="none" autoCorrect={false} spellCheck={false}
      autoComplete="off" maxLength={LIMITE_DO_EMAIL} />
  );

  return (
    <Folha visivel titulo="Alterar e-mail de acesso" aoFechar={aoFechar}
      rodape={(
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} desabilitado={enviando} motivo="Salvando o e-mail" />
          <Botao rotulo="Alterar e-mail" aoTocar={salvar} carregando={enviando} />
        </>
      )}>
      <View style={estilos.coluna}>
        <ListaDeDados>
          <LinhaDeDado rotulo="E-mail atual" valor={aluno.emailDeAcesso} />
        </ListaDeDados>
        <Texto variante="suave">
          Ao salvar, as sessões abertas do aluno são encerradas e ele passa a entrar com o novo e-mail. Se o envio de
          e-mails estiver ligado, ele recebe um aviso.
        </Texto>
        {geral ? <View aria-live="assertive"><Alerta tom="perigo" texto={geral} /></View> : null}
        {campo('email', 'Novo e-mail')}
        {campo('confirmacao', 'Confirme o novo e-mail', 'Digite de novo para conferir.')}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
