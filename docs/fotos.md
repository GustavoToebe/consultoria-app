# Fotos da atualização: armazenamento e saída de uma consultoria

As fotos da atualização do aluno são dado sensível (LGPD). O arquivo fica num bucket S3 privado (produção: R2 da Cloudflare, bucket
`consultoria-fotos`; local e testes: MinIO). No banco ficam só os metadados (`atualizacao_foto`) e a fila de remoção (`foto_remocao`).
O resumo das regras de código está no `AGENTS.md` (item "Fotos da atualização"). Desde a V013 a mesma tabela e o mesmo bucket
guardam também as fotos da **anamnese** (a foto pendente pertence a uma pasta ou a uma anamnese; o nome do objeto não muda), então
tudo o que vale aqui (nome do objeto, fila de remoção, saída de uma consultoria) vale para elas.

## Nome do objeto
```
consultorias/<consultoriaId>/fotos/<fotoId>.jpg
```
- Só UUIDs: nenhum nome, e-mail, telefone ou nome de arquivo de pessoa vai para o bucket.
- O `consultoriaId` vem **sempre do banco** (da linha do aluno ao subir, da própria linha da foto ao ler e remover, da fila ao apagar),
  nunca do cliente. O nome é montado num lugar só, `fotos/ChaveDeFoto`.
- A fila de remoção (`foto_remocao`) guarda o `consultoria_id` (sem chave estrangeira, de propósito: a fila tem de sobreviver à
  consultoria que saiu) para montar o mesmo nome na hora de apagar.
- Sem compatibilidade com o formato antigo (o objeto se chamava só `<fotoId>`): quando a V008 entrou o bucket estava vazio e as
  fotos desligadas.

## Quando uma consultoria sair: apagar tudo dela pelo prefixo
Tudo o que a consultoria tem no bucket está sob `consultorias/<consultoriaId>/`. Para encerrar:

1. **Banco primeiro.** Apague ou anonimize a consultoria e seus alunos como o contrato pedir. Enquanto a consultoria existir, o job
   ainda pode escrever na fila e a API ainda pode aceitar fotos novas (desative o acesso antes).
2. **Conferir o que há no prefixo** (só listar):
   ```
   aws s3 ls s3://consultoria-fotos/consultorias/<consultoriaId>/ --recursive --endpoint-url <TREINOS_FOTOS_ENDPOINT>
   ```
3. **Apagar o prefixo inteiro** (não tem volta; confira o id da consultoria duas vezes):
   ```
   aws s3 rm s3://consultoria-fotos/consultorias/<consultoriaId>/ --recursive --endpoint-url <TREINOS_FOTOS_ENDPOINT>
   ```
   Região `auto`; as credenciais são as do token do R2 (variáveis `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` só na sessão, nunca
   em arquivo nem em histórico). Também serve `rclone purge r2:consultoria-fotos/consultorias/<consultoriaId>`.
4. **Fila.** Linhas de `foto_remocao` dessa consultoria que sobrarem apontam para objetos que já não existem; apagar um objeto
   ausente não é erro, então o job as conclui sozinho. Para limpar à mão: `DELETE FROM foto_remocao WHERE consultoria_id = '<id>'`.

Anonimizar **um aluno** não precisa disso: a API já enfileira a remoção das fotos dele e o job apaga cada objeto.

## Variáveis
`TREINOS_FOTOS_HABILITADO` (padrão `false`), `TREINOS_FOTOS_ENDPOINT`, `TREINOS_FOTOS_BUCKET`, `TREINOS_FOTOS_CHAVE`,
`TREINOS_FOTOS_SEGREDO` e, opcional, `TREINOS_FOTOS_REGIAO` (`auto` no R2). Segredos só em variável de ambiente, sem valor padrão.
