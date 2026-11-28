import { FileText, FileUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { FORMATOS_E_LIMITES, FORMATOS_E_LIMITES_COM_IMAGEM } from '../../dominio/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

const WEB = Platform.OS === 'web';

/**
 * Área grande de enviar (26/11): ícone, "Arraste os arquivos aqui", "Escolher arquivos" (principal) e "Colar texto", e os
 * formatos e limites dentro dela. Na web aceita soltar vários arquivos; arrastar por cima destaca na cor de ação. No
 * celular não há arrastar: só os botões (WCAG 2.5.7: arrastar sempre tem o botão como alternativa). A área não é um
 * botão (os dois botões ficam dentro dela) e não lê arquivo nem fala com a API: só chama de volta.
 */
export function AreaDeSoltarArquivos({ aoEscolher, aoSoltar, aoColar, colando, enviando, ocupado, comImagem = false }: {
  aoEscolher: () => void;
  /** Só na web: os arquivos soltos sobre a área. */
  aoSoltar: (arquivos: File[]) => void;
  aoColar: () => void;
  /** O campo do texto colado está aberto (o botão vira "Fechar o texto"). */
  colando: boolean;
  /** Os arquivos estão subindo: o "Escolher arquivos" mostra o carregando. */
  enviando: boolean;
  /** Alguma ação em andamento: soltar não faz nada. */
  ocupado: boolean;
  /** Leitura por imagem ligada (4.2): JPG e PNG entram na lista de formatos e a frase do PDF escaneado sai. */
  comImagem?: boolean;
}) {
  const { cores } = useTema();
  const area = useRef<View>(null);
  const [sobreAArea, setSobreAArea] = useState(false);
  const soltarRef = useRef(aoSoltar);
  const ocupadoRef = useRef(ocupado);
  useEffect(() => { soltarRef.current = aoSoltar; ocupadoRef.current = ocupado; });

  // O react-native-web não repassa os eventos de arrastar: vão direto no elemento, com limpeza (como na `AreaDeFoto`).
  // O contador evita o pisca do `dragleave` ao passar sobre os botões de dentro.
  useEffect(() => {
    const no = area.current as unknown as HTMLElement | null;
    if (!WEB || !no?.addEventListener) return undefined;
    let dentro = 0;
    const temArquivo = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const entrou = (e: DragEvent) => { if (!temArquivo(e)) return; e.preventDefault(); dentro += 1; setSobreAArea(true); };
    const passando = (e: DragEvent) => { if (!temArquivo(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = ocupadoRef.current ? 'none' : 'copy'; };
    const saiu = () => { dentro = Math.max(0, dentro - 1); if (dentro === 0) setSobreAArea(false); };
    const soltou = (e: DragEvent) => {
      e.preventDefault();
      dentro = 0;
      setSobreAArea(false);
      const arquivos = Array.from(e.dataTransfer?.files ?? []);
      if (arquivos.length && !ocupadoRef.current) soltarRef.current(arquivos);
    };
    no.addEventListener('dragenter', entrou);
    no.addEventListener('dragover', passando);
    no.addEventListener('dragleave', saiu);
    no.addEventListener('drop', soltou);
    return () => {
      no.removeEventListener('dragenter', entrou);
      no.removeEventListener('dragover', passando);
      no.removeEventListener('dragleave', saiu);
      no.removeEventListener('drop', soltou);
    };
  }, []);

  const destacada = sobreAArea && !ocupado;
  return (
    <View ref={area} collapsable={false} testID="area-de-soltar"
      style={[estilos.area, { borderColor: destacada ? cores.acao : cores.bordaCampo, backgroundColor: destacada ? cores.acaoSuave : cores.superficie2 }]}>
      <FileUp size={28} color={destacada ? cores.acao : cores.textoSuave} strokeWidth={1.75} aria-hidden />
      <Texto variante="bloco" cor={destacada ? cores.acao : cores.texto} style={estilos.centro} aria-live="polite">
        {WEB ? (destacada ? 'Solte para enviar' : 'Arraste os arquivos aqui') : 'Escolha os arquivos do aparelho'}
      </Texto>
      <LinhaDeAcoes style={estilos.botoes}>
        <Botao rotulo="Escolher arquivos" tipo="primario" Icone={FileUp} carregando={enviando}
          desabilitado={ocupado && !enviando} motivo="Aguarde a ação em andamento terminar." aoTocar={aoEscolher} />
        <Botao rotulo={colando ? 'Fechar o texto' : 'Colar texto'} tipo="secundario" Icone={FileText} aoTocar={aoColar} />
      </LinhaDeAcoes>
      <Texto variante="pequeno" numerico style={estilos.centro}>{comImagem ? FORMATOS_E_LIMITES_COM_IMAGEM : FORMATOS_E_LIMITES}</Texto>
      {comImagem ? null : <Texto variante="pequeno" style={estilos.centro}>PDF escaneado, sem texto selecionável, é sinalizado na leitura.</Texto>}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: {
    minHeight: 180, borderWidth: 2, borderStyle: 'dashed', borderRadius: RAIO,
    alignItems: 'center', justifyContent: 'center', gap: espaco(1.5), padding: espaco(3),
  },
  centro: { textAlign: 'center' },
  // Empilhados no celular, os dois botões ficam no eixo da área, como o texto.
  botoes: { justifyContent: 'center' },
});
