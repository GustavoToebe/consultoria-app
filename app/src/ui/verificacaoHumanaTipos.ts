/** Props das duas implementações de `VerificacaoHumana` (`.tsx` celular com WebView, `.web.tsx` com o script da Cloudflare). */
export interface PropsVerificacaoHumana {
  /** Chave pública do widget (`GET /publico/configuracao`). */
  siteKey: string;
  /** Token novo (uso único) ou `null` quando o que valia expirou, deu erro ou o widget foi renovado. Nunca vai a log. */
  onToken: (token: string | null) => void;
  /** Muda para pedir um desafio novo (depois de cada envio: o token é de uso único). */
  chave: number;
  /**
   * O widget desistiu ou a pessoa tocou em "Tentar de novo": a tela confere a configuração de novo (a verificação pode ter sido
   * desligada, a saída de emergência do servidor) e solta o botão se não for mais exigida.
   */
  aoReconferir?: () => void;
}
