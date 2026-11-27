import type { Marca } from '../api/tipos';
import { htmlDoTextoFormatado, linhasDeEvidencia } from '../dominio/contratos';
import { cabecalhoDoPdf, cssBase, esc, type Documento } from './html';

/**
 * Comprovante da assinatura do contrato digital (`docs/planos/contrato-digital-telas.md`, T1): o texto assinado e, numa página
 * à parte, as "Evidências da assinatura". Não depende da funcionalidade `PDF` do plano (é evidência do aceite, não o PDF de
 * treino). A versão da equipe leva IP, aparelho e quem gerou; a do aluno não os leva (basta não passá-los). O código de
 * verificação é o SHA-256 que a API devolveu, impresso inteiro: o app NUNCA calcula hash. Texto, nome, IP e aparelho são dado
 * pessoal e passam por `esc()`; o título do documento (nome do arquivo) é fixo, sem nenhum deles.
 */
export interface DadosPdfContrato {
  marca: Marca;
  logoDataUri: string | null;
  /** Título do contrato (o que a equipe escreveu ao gerar). */
  titulo: string;
  /** O texto exato que o aluno leu e assinou (`**negrito**` e `__sublinhado__`); nulo no PDF próprio (o documento é o arquivo). */
  texto: string | null;
  sha256: string;
  /** Nome do aluno, quando a tela o conhece (a versão do aluno e a da ficha o têm). */
  aluno?: string | null;
  /** Instante ISO da assinatura e o nome digitado. */
  assinadoEm: string;
  nome: string;
  /** Só na versão da equipe: ausente some; `""` diz "Não registrado". */
  ip?: string | null;
  agente?: string | null;
  geradoPorNome?: string | null;
  /** Assinado pelo link do responsável, que declarou ser o responsável legal do aluno (D28). */
  responsavelLegal?: boolean;
  emitidoEm: Date;
}

export function documentoContrato(d: DadosPdfContrato): Documento {
  const evidencias = linhasDeEvidencia({
    nome: d.nome, assinadoEm: d.assinadoEm, sha256: d.sha256, ip: d.ip, agente: d.agente, geradoPorNome: d.geradoPorNome,
    responsavelLegal: d.responsavelLegal,
  });
  const corpo = [
    cabecalhoDoPdf({ marca: d.marca, logoDataUri: d.logoDataUri, documento: 'Comprovante do contrato', titulo: d.titulo, aluno: d.aluno, emitidoEm: d.emitidoEm }),
    `<div class="contrato-texto">${d.texto === null ? '<p>Documento em PDF anexo.</p>' : htmlDoTextoFormatado(d.texto)}</div>`,
    '<section class="evidencias"><h2>Evidências da assinatura</h2>',
    `<table class="ev"><tbody>${evidencias
      .map((l) => `<tr><th>${esc(l.rotulo)}</th><td${l.rotulo.startsWith('Código') ? ' class="codigo"' : ''}>${esc(l.valor)}</td></tr>`)
      .join('')}</tbody></table>`,
    d.texto === null
      ? '<p class="pequeno">O código de verificação identifica o arquivo PDF exato deste contrato. Se um só byte do arquivo mudar, o código muda.</p>'
      : '<p class="pequeno">O código de verificação identifica o texto exato deste contrato. Se uma só letra do texto mudar, o código muda.</p>',
    '</section>',
  ].join('\n');

  const css = `${cssBase(d.marca.corPrimaria, d.marca.temaPdf)}
.doc .contrato-texto p { margin: 0 0 8pt; overflow-wrap: anywhere; }
.doc .evidencias { break-before: page; page-break-before: always; }
.doc table.ev { table-layout: fixed; }
.doc table.ev th { width: 30%; background: #f1f3f5; color: #111; text-transform: none; letter-spacing: 0; font-size: 9.5pt; border-bottom: 1px solid #ddd; }
.doc table.ev td { overflow-wrap: anywhere; word-break: break-word; }
.doc table.ev td.codigo { font-family: "Courier New", Courier, monospace; font-size: 9pt; }
`;
  return { titulo: 'Comprovante do contrato', css, corpo };
}
