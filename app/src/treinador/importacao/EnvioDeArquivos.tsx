import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AVISO_DA_LEITURA_POR_IMAGEM, type ResultadoDoEnvio } from '../../dominio/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { AreaDeSoltarArquivos } from './AreaDeSoltarArquivos';

/**
 * Enviar arquivos ou texto (2.1): a área de soltar e o "Colar texto", antes da sessão e também com ela aberta (enquanto
 * não está lendo), e a lista do último envio, um arquivo por linha, "Enviado" ou "Recusado: motivo". Não fala com a API:
 * quem usa sobe os arquivos e o texto. O texto colado fica aqui até ser aceito (nada digitado se perde num erro).
 * Com a leitura por imagem ligada (4.2), o aviso de JPG/PNG e do que vai inteiro ao provedor fica logo abaixo da área.
 */
export function EnvioDeArquivos({ aoEscolher, aoSoltar, aoEnviarTexto, enviando, ocupado, erroDoTexto, resultados, erro, comImagem }: {
  aoEscolher: () => void;
  aoSoltar: (arquivos: File[]) => void;
  /** `true` = aceito (o campo limpa e fecha). */
  aoEnviarTexto: (titulo: string, conteudo: string) => Promise<boolean>;
  enviando: 'arquivos' | 'texto' | null;
  ocupado: boolean;
  erroDoTexto: { campo: 'titulo' | 'conteudo'; texto: string } | null;
  resultados: readonly ResultadoDoEnvio[];
  erro: ReactNode;
  /** `importacaoPorImagemHabilitada` do `GET /eu`. */
  comImagem: boolean;
}) {
  const { cores } = useTema();
  const [colando, setColando] = useState(false);
  // 2.2: sem valor padrão; a API chama de "Texto livre" quando vem em branco.
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');

  const enviarTexto = async () => {
    if (!(await aoEnviarTexto(titulo.trim(), conteudo))) return;
    setConteudo('');
    setTitulo('');
    setColando(false);
  };

  return (
    <>
      <AreaDeSoltarArquivos aoEscolher={aoEscolher} aoSoltar={aoSoltar} aoColar={() => setColando(!colando)} colando={colando}
        enviando={enviando === 'arquivos'} ocupado={ocupado} comImagem={comImagem} />
      {comImagem ? <Alerta tom="atencao" texto={AVISO_DA_LEITURA_POR_IMAGEM} /> : null}
      {erro}
      {resultados.length > 0 ? (
        <View role="list" aria-label="Arquivos do último envio" style={estilos.lista} accessibilityLiveRegion="polite">
          {resultados.map((r, i) => (
            <View key={`${i}-${r.nome}`} role="listitem" style={[estilos.resultado, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
              <View style={estilos.linha}>
                <Texto style={estilos.encolher}>{r.nome}</Texto>
                <Selo texto={r.motivo ? 'Recusado' : 'Enviado'} tipo={r.motivo ? 'perigo' : 'sucesso'} />
              </View>
              {r.motivo ? <Texto variante="suave">{r.motivo}</Texto> : null}
            </View>
          ))}
        </View>
      ) : null}
      {colando ? (
        <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
          <Campo
            rotulo="Nome do aluno (se o texto é de um aluno só)"
            valor={titulo}
            aoMudar={setTitulo}
            erro={erroDoTexto?.campo === 'titulo' ? erroDoTexto.texto : null}
          />
          <Campo
            rotulo="Texto colado (WhatsApp, notas, e-mail)"
            valor={conteudo}
            aoMudar={setConteudo}
            linhas={6}
            erro={erroDoTexto?.campo === 'conteudo' ? erroDoTexto.texto : null}
            placeholder="Exemplo: Treino A - Peito&#10;Supino Reto 4x10&#10;…"
          />
          <LinhaDeAcoes>
            <Botao
              rotulo="Adicionar o texto"
              tipo="acao"
              carregando={enviando === 'texto'}
              desabilitado={!conteudo.trim() || (ocupado && enviando !== 'texto')}
              motivo={!conteudo.trim() ? 'Cole o texto antes de adicionar.' : 'Aguarde a ação em andamento terminar.'}
              aoTocar={() => void enviarTexto()}
            />
          </LinhaDeAcoes>
        </View>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: 0 },
  resultado: { gap: espaco(0.5), paddingVertical: espaco(1) },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  encolher: { flex: 1, minWidth: 0 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(2) },
});
