package br.com.treinos.api.fotos;

import br.com.treinos.api.web.NaoEncontradoException;
import jakarta.annotation.PreDestroy;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;

/**
 * Cliente S3 compatível com o R2 (e com o MinIO dos testes). Só PutObject, GetObject e DeleteObject. Endereço em estilo de
 * caminho e soma de verificação "só quando exigida" (o R2 não aceita os somatórios adicionais que o SDK recente manda por
 * padrão). Cliente HTTP do JDK: o Netty e o Apache ficam fora do build.
 */
final class ArmazenamentoS3 implements ArmazenamentoDeFotos, AutoCloseable {

    private final S3Client s3;
    private final String bucket;

    ArmazenamentoS3(FotosProperties p) {
        p.exigirCompleta();
        this.bucket = p.bucket();
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(p.endpoint()))
                .region(Region.of(p.regiao()))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(p.chave(), p.segredo())))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build();
    }

    @Override
    public void gravar(String chave, byte[] jpeg) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(chave).contentType("image/jpeg")
                .contentLength((long) jpeg.length).build(), RequestBody.fromBytes(jpeg));
    }

    @Override
    public byte[] ler(String chave) {
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(chave).build()).asByteArray();
        } catch (NoSuchKeyException e) {
            throw new NaoEncontradoException("Foto não encontrada.");
        }
    }

    @Override
    public void apagar(String chave) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(chave).build());
    }

    @PreDestroy
    @Override
    public void close() {
        s3.close();
    }
}
