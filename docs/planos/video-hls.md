# Vídeo próprio (HLS)

Situação: Planejando (só plano e comparação de preços; nada contratado, configurado nem codificado) · Onde: main · Atualizado: 16/11/2026

Fonte: preços lidos nas páginas oficiais dos fornecedores em 16/11/2026 (tabela abaixo); código lido em 16/11/2026, base 1f33299d. Validade: preço muda sem aviso, então reler a página do fornecedor antes de decidir; o mapa do código vale enquanto `dominio/comunidade.ts`, `PlayerDeVideo` e a CSP do Caddy não mudarem.

## Objetivo
Dizer ao Gustavo quais são as opções para o treinador subir vídeo próprio (demonstração de exercício, aulão) tocando dentro do app, o que cada uma custa e o que muda no app e na CSP. A decisão de infra e de custo é dele.

## Como é hoje (conferido)
- Só o YouTube toca embutido: `dominio/comunidade.ts:121-162` extrai o id; `PlayerDeVideo.tsx` (celular, WebView montado pelo id depois do toque) e `PlayerDeVideo.web.tsx` (iframe `youtube-nocookie.com`), sem token nem cookie nosso. Outro link abre fora do app (`LinksExternos`, https).
- A CSP do Caddy local (`deploy-local/Caddyfile:13`) tem `frame-src` do youtube-nocookie e **não tem `media-src`**; a de produção está no `central-api-back`. `connect-src 'self'`.
- Não existe upload de vídeo: o aluno e o treinador só colam link. Imagem e GIF do exercício ficam no banco (até 1 MB).
- Regra permanente (AGENTS.md): o app anexa token e cookie só à própria API; link de vídeo abre fora do app sem token.

## Opções (USD, lidas em 16/11/2026; "estimativa" = conta minha, "não confirmado" = a página não diz)
| Opção | Preço | Incluído | Segurança e limites | Fonte (data) |
| --- | --- | --- | --- | --- |
| Cloudflare Stream | US$5/mês por 1.000 min armazenados (blocos pré-pagos); US$1 por 1.000 min entregues | Upload e encoding grátis | URL assinada sim (`requireSignedURLs`, token com validade); origens permitidas; DRM não mencionado; upload até 30 GB por vídeo | developers.cloudflare.com/stream/pricing/ (página atualizada em 27/10/2026) |
| Mux Video (Basic, 1080p) | US$0,0030/min armazenado/mês; US$0,0010/min entregue | 100.000 min entregues/mês grátis; encoding grátis; crédito de US$20/mês no pay-as-you-go | URL assinada e restrição de domínio incluídas; DRM é add-on (US$100/mês + US$0,003/licença); limites de arquivo não confirmados | mux.com/pricing e mux.com/docs/pricing/video (sem data na página, lida em 16/11/2026) |
| Bunny Stream | "a partir de" US$0,01/GB armazenado e US$0,005/GB entregue; mínimo US$1/mês | Encoding, player e segurança sem custo; teste de 14 dias | Tarifa por região do Stream, detalhes do token e resolução máxima não confirmados; a página não é clara | bunny.net/pricing/stream/ (sem data, lida em 16/11/2026) |
| R2 + transcodificação própria | R2: US$0,015/GB-mês; US$4,50 por milhão de operações Classe A; US$0,36 por milhão de Classe B; saída grátis | 10 GB, 1 milhão (A) e 10 milhões (B) por mês | R2 não gera HLS nem tem player; URL assinada exige Worker ou presigned URL (estimativa); o ffmpeg num servidor nosso é o transcodificador (estimativa de custo extra zero se a VPS já existe); o Media Transformations da Cloudflare **não gera HLS** e aceita entrada de até 100 MB e 10 min | developers.cloudflare.com/r2/pricing/ (atualizada em 30/10/2026) |

### Conta de exemplo (genérica, não é dado do projeto)
200 vídeos de 90 s = 300 min armazenados; 1.000 espectadores × 100 min = 100.000 min entregues por mês.
- Cloudflare Stream: US$5 (1 bloco) + 100.000/1.000 × US$1 = **US$105/mês**. A página diz que "reprodução em cache não é cobrada" sem explicar como mede: o valor real pode ser menor.
- Mux: 300 × 0,003 = US$0,90; a entrega cabe nos 100.000 min grátis = **~US$0,90/mês** (US$0,72 em 720p), colado no limite grátis (cada minuto a mais custa US$0,001).
- Bunny: entrega estimada em ~2.250 GB (3 Mbps, estimativa) × US$0,005 a US$0,01 = **US$11 a US$23/mês** mais ~US$0,40 de armazenamento. Se valesse a tarifa do CDN padrão da América do Sul (US$0,045/GB, não confirmado para o Stream), seriam ~US$101/mês.
- R2 próprio: ~30 GB de HLS (estimativa) ≈ **US$0,30/mês** mais o servidor de transcodificação, o Worker que valida o token e o nosso trabalho de construir tudo (fila de transcodificação, player, limpeza, URL assinada).

## O que muda no app e na CSP (qualquer opção)
- **CSP** (local e `central-api-back`): `media-src` (HLS em `<video>`/hls.js) e `connect-src` para o domínio do fornecedor, e `frame-src` se usar o player embutido do fornecedor. Hoje `connect-src 'self'` é regra de segurança do projeto: mudar é decisão de segurança, não detalhe.
- **Player**: `PlayerDeVideo.web.tsx` ganha um segundo modo (hls.js ou iframe do fornecedor); no celular, `expo-video` ou WebView. Regra do AGENTS.md ("só o YouTube toca embutido") precisa ser reescrita junto.
- **Upload do treinador**: tela e rota novas (upload direto ao fornecedor por URL de upload assinada, sem passar pela API, que limita o corpo a 1 MiB); tamanho máximo, tipos aceitos, vídeo em fila/processando/erro.
- **Acesso**: URL assinada de vida curta emitida pela API só para quem tem direito (aluno do plano, equipe da consultoria; 404 fora do dono), nunca link permanente.
- **LGPD**: vídeo do treinador (demonstração) não é dado de saúde, mas se o aluno puder enviar vídeo (execução) passa a ser dado pessoal sensível: exportação, anonimização e remoção no fornecedor. Fora do escopo desta proposta.
- **Custo e dependência**: nova conta, novo segredo (`TREINOS_VIDEO_*`, sem valor padrão) e novo fornecedor no aviso de privacidade (revisão jurídica).

## O que fica como está hoje
YouTube embutido (comunidade e exercícios) e botão externo; nada muda enquanto o Gustavo não decidir. Vídeo em demonstração de exercício continua sendo link.

## Decisões para o Gustavo
Recomendada primeiro.

| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | Vale ter vídeo próprio agora? | **(a) Não por enquanto: manter YouTube até haver demanda real de treinadores (recomendada, ainda sem cliente real e o YouTube resolve)**; (b) sim, começar pelo mais barato e simples; (c) sim, com DRM |
| 2 | Se sim, qual fornecedor? | **(a) Cloudflare Stream (recomendada: já usamos Cloudflare, URL assinada nativa, conta previsível; custo de entrega é o que pesa)**; (b) Mux (mais barato no exemplo, mas outro fornecedor e preço sem data na página); (c) Bunny (preço não confirmado para o Stream); (d) R2 + ffmpeg próprio (mais barato, mas é construir e manter um transcodificador) |
| 3 | Quem pode subir vídeo? | **(a) Só a equipe da consultoria, para demonstração (recomendada)**; (b) também o aluno (execução): exige plano de LGPD à parte |
| 4 | Limite por consultoria | **(a) Teto de minutos armazenados por consultoria no plano comercial (recomendada, o custo cresce com a conta)**; (b) sem teto |
| 5 | A CSP pode ganhar `media-src`/`connect-src` do fornecedor? | **(a) Sim, só o domínio exato do fornecedor escolhido (recomendada)**; (b) não: só o player embutido (iframe) do fornecedor, com `frame-src` |
| 6 | Aviso de privacidade | **(a) Citar o fornecedor na revisão jurídica já pendente (recomendada)**; (b) não citar |

## Passos (só depois da decisão 1)
- [ ] 1. Decidir (Gustavo) — —
- [ ] 2. Se (1b) ou (1c): plano de implementação com trio (contrato de upload, URL assinada, CSP, limpeza no fornecedor) — —

## Fora do escopo
Contratar, configurar ou testar qualquer fornecedor; migrar os links de YouTube existentes; DRM; vídeo do aluno.

## O que ficou para trás
- Reler os preços na página do fornecedor no dia da decisão (Stream e R2 foram atualizadas em 27 e 30/10/2026; Mux e Bunny sem data).
