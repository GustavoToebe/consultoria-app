import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { gerarConvite } from '../api/rotas';
import type { AlunoDetalhe, ConviteGerado } from '../api/tipos';
import { dataHoraParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Acesso do aluno ao app: com conta criada mostra "com acesso"; sem conta, gera o convite (código de 10 letras e
 * link, válidos por 7 dias). O código só aparece nesta resposta; gerar outro invalida o anterior.
 */
export function CartaoAcesso({ aluno }: { aluno: AlunoDetalhe }) {
  const { avisar } = useAviso();
  const [convite, setConvite] = useState<ConviteGerado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const gerar = () => {
    setConfirmar(false);
    setGerando(true);
    setErro(null);
    gerarConvite(aluno.id).then(
      (c) => {
        setGerando(false);
        setConvite(c);
      },
      (e: unknown) => {
        setGerando(false);
        setErro(e);
      },
    );
  };

  const copiar = (texto: string, oque: string) => {
    Clipboard.setStringAsync(texto).then(
      () => avisar(`${oque} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  if (aluno.temAcesso) {
    return (
      <Cartao titulo="Acesso ao app">
        <Selo texto="Com acesso" tipo="sucesso" />
        <Texto cor="suave">O aluno já criou a conta e entra com o e-mail e a senha dele.</Texto>
      </Cartao>
    );
  }

  const conviteAnterior = !convite && aluno.conviteExpiraEm;
  return (
    <Cartao titulo="Acesso ao app">
      <Selo texto="Sem acesso" tipo="neutro" />
      {convite ? (
        <View style={estilos.convite}>
          <Texto cor="suave">
            Envie o link ou o código para o aluno. Válido até {dataHoraParaTela(convite.expiraEm)}. O código não
            aparece de novo depois que você sair desta tela.
          </Texto>
          <Destaque rotulo="Código" texto={convite.codigo} aoCopiar={() => copiar(convite.codigo, 'Código')} grande />
          <Destaque rotulo="Link" texto={convite.link} aoCopiar={() => copiar(convite.link, 'Link')} />
        </View>
      ) : (
        <Texto cor="suave">
          {conviteAnterior
            ? `Há um convite válido até ${dataHoraParaTela(aluno.conviteExpiraEm)}. Gerar outro invalida o anterior.`
            : 'Gere um convite para o aluno criar a conta dele no app.'}
        </Texto>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.botoes}>
        <Botao
          rotulo={convite || conviteAnterior ? 'Gerar outro convite' : 'Gerar convite'}
          tipo={convite ? 'secundario' : 'primario'}
          carregando={gerando}
          aoTocar={() => (convite || conviteAnterior ? setConfirmar(true) : gerar())}
        />
      </View>
      <PainelConfirmacao
        visivel={confirmar}
        titulo="Gerar outro convite?"
        mensagem="O código e o link anteriores param de funcionar."
        rotuloConfirmar="Gerar outro"
        aoConfirmar={gerar}
        aoCancelar={() => setConfirmar(false)}
      />
    </Cartao>
  );
}

function Destaque({ rotulo, texto, aoCopiar, grande }: { rotulo: string; texto: string; aoCopiar: () => void; grande?: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.destaque, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.textoDestaque}>
        <Texto variante="pequeno">{rotulo}</Texto>
        <Texto selectable style={grande ? estilos.codigo : estilos.link}>{texto}</Texto>
      </View>
      <Botao rotulo="Copiar" tipo="secundario" Icone={Copy} aoTocar={aoCopiar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  convite: { gap: espaco(1.5) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
  destaque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    flexWrap: 'wrap',
  },
  textoDestaque: { flex: 1, minWidth: 180, gap: 2 },
  codigo: { fontFamily: fontes.negrito, fontSize: 24, letterSpacing: 3 },
  link: { fontFamily: fontes.normal, fontSize: 14 },
});
