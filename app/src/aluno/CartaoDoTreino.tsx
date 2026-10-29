import { forwardRef } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Image as SvgImagem, Rect, Text as SvgTexto } from 'react-native-svg';

import type { DiaDoCalendario } from '../dominio/calendario';
import { ALTURA_DO_CARTAO, coresDoCartao, cortar, LARGURA_DO_CARTAO } from '../dominio/cartaoDoTreino';

/** `id` do elemento que envolve o cartão: na web a imagem sai do `<svg>` dentro dele. */
export const ID_DO_CARTAO = 'cartao-do-treino';

export interface DadosDoCartao {
  nomeDaConsultoria: string;
  corPrimaria: string | null;
  /** Data URI da logo (reduzida); nulo = só o nome. */
  logo: string | null;
  titulo: string;
  subtitulo: string;
  mes: string;
  semanas: DiaDoCalendario[][];
  treinados: ReadonlySet<string>;
  /** Dia do treino (anel quando não está marcado). */
  data: string;
  dias: string;
  /** "Volume: 3.450 kg"; nulo = não aparece (P8: só se o aluno ligar). */
  volume: string | null;
}

const FONTE = 'Arial, Helvetica, sans-serif';
const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const ESQUERDA = 90;
const CELULA = (LARGURA_DO_CARTAO - 2 * ESQUERDA) / 7;

/**
 * O cartão do treino concluído (Engajamento 0.4, P8) em SVG 1080 × 1920 (Stories): faixa com a marca, número do treino,
 * calendário do mês e os dias treinados. O mesmo desenho é a prévia na tela (escalado) e a imagem que sai: no celular por
 * `toDataURL` do `Svg` (`ref`), na web pelo `<svg>` dentro de `ID_DO_CARTAO`. Sem peso, foto, medidas, dieta nem o nome
 * do aluno. Cores e fonte fixas: é uma imagem, não segue o tema.
 */
export const CartaoDoTreino = forwardRef<Svg, { dados: DadosDoCartao; largura: number }>(function CartaoDoTreino({ dados, largura }, ref) {
  const c = coresDoCartao(dados.corPrimaria);
  const comLogo = !!dados.logo;
  const topoDoCalendario = 860;
  const linha = 140;
  const fimDoCalendario = topoDoCalendario + 40 + dados.semanas.length * linha;
  return (
    <View nativeID={ID_DO_CARTAO} accessible accessibilityRole="image"
      accessibilityLabel={`Cartão do treino: ${dados.titulo}, ${dados.subtitulo}. ${dados.dias}.${dados.volume ? ` ${dados.volume}.` : ''}`}>
      <Svg ref={ref} width={largura} height={(largura * ALTURA_DO_CARTAO) / LARGURA_DO_CARTAO} viewBox={`0 0 ${LARGURA_DO_CARTAO} ${ALTURA_DO_CARTAO}`}>
        <Rect x={0} y={0} width={LARGURA_DO_CARTAO} height={ALTURA_DO_CARTAO} fill={c.fundo} />
        <Rect x={0} y={0} width={LARGURA_DO_CARTAO} height={260} fill={c.marca} />
        {comLogo ? (
          <>
            <Rect x={60} y={60} width={140} height={140} rx={24} fill="#FFFFFF" />
            <SvgImagem x={72} y={72} width={116} height={116} href={dados.logo!} preserveAspectRatio="xMidYMid meet" />
          </>
        ) : null}
        <SvgTexto x={comLogo ? 236 : 60} y={150} fill={c.sobreMarca} fontSize={56} fontWeight="bold" fontFamily={FONTE}>
          {cortar(dados.nomeDaConsultoria, comLogo ? 24 : 30)}
        </SvgTexto>
        <SvgTexto x={ESQUERDA} y={400} fill={c.suave} fontSize={44} fontFamily={FONTE}>Treino concluído</SvgTexto>
        <SvgTexto x={ESQUERDA} y={540} fill={c.texto} fontSize={128} fontWeight="bold" fontFamily={FONTE}>{cortar(dados.titulo, 22)}</SvgTexto>
        <SvgTexto x={ESQUERDA} y={630} fill={c.suave} fontSize={48} fontFamily={FONTE}>{dados.subtitulo}</SvgTexto>
        <SvgTexto x={ESQUERDA} y={topoDoCalendario - 80} fill={c.texto} fontSize={56} fontWeight="bold" fontFamily={FONTE}>{dados.mes}</SvgTexto>
        {INICIAIS.map((letra, i) => (
          <SvgTexto key={`d${i}`} x={ESQUERDA + CELULA * (i + 0.5)} y={topoDoCalendario} fill={c.suave} fontSize={38} fontWeight="bold" textAnchor="middle" fontFamily={FONTE}>
            {letra}
          </SvgTexto>
        ))}
        {dados.semanas.flatMap((semana, s) =>
          semana.map((d, i) => {
            if (!d.doMes) return null;
            const cx = ESQUERDA + CELULA * (i + 0.5);
            const cy = topoDoCalendario + 80 + s * linha;
            const treinou = dados.treinados.has(d.iso);
            return (
              <SvgGrupoDoDia key={d.iso} cx={cx} cy={cy} dia={d.dia} treinou={treinou} anel={!treinou && d.iso === dados.data} cores={c} />
            );
          }),
        )}
        <SvgTexto x={ESQUERDA} y={Math.max(fimDoCalendario + 60, 1700)} fill={c.texto} fontSize={48} fontWeight="bold" fontFamily={FONTE}>
          {dados.dias}
        </SvgTexto>
        {dados.volume ? (
          <SvgTexto x={ESQUERDA} y={Math.max(fimDoCalendario + 130, 1770)} fill={c.suave} fontSize={44} fontFamily={FONTE}>{dados.volume}</SvgTexto>
        ) : null}
      </Svg>
    </View>
  );
});

function SvgGrupoDoDia({ cx, cy, dia, treinou, anel, cores }: {
  cx: number; cy: number; dia: number; treinou: boolean; anel: boolean; cores: ReturnType<typeof coresDoCartao>;
}) {
  return (
    <>
      {treinou ? <Circle cx={cx} cy={cy} r={52} fill={cores.marcado} /> : null}
      {anel ? <Circle cx={cx} cy={cy} r={50} fill="none" stroke={cores.texto} strokeWidth={4} /> : null}
      <SvgTexto x={cx} y={cy + 15} fill={treinou ? cores.sobreMarcado : anel ? cores.texto : cores.suave} fontSize={42}
        fontWeight={treinou || anel ? 'bold' : 'normal'} textAnchor="middle" fontFamily={FONTE}>
        {String(dia)}
      </SvgTexto>
    </>
  );
}
