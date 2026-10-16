package br.com.treinos.api;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.net.URI;
import java.util.UUID;

/**
 * Bucket de mentira para as fotos: um MinIO por execução da suíte, com credenciais sorteadas a cada vez. Nenhum teste fala
 * com o R2 de verdade. A imagem é a do Chainguard porque o {@code minio/minio} saiu do Docker Hub.
 */
public final class MinioDeTeste {

    public static final String IMAGEM = "cgr.dev/chainguard/minio:latest";
    public static final String BUCKET = "fotos-de-teste";

    private static final String USUARIO = "u" + UUID.randomUUID().toString().replace("-", "");
    private static final String SENHA = UUID.randomUUID().toString().replace("-", "");
    private static final MinIOContainer MINIO = new MinIOContainer(DockerImageName.parse(IMAGEM).asCompatibleSubstituteFor("minio/minio"))
            .withUserName(USUARIO).withPassword(SENHA);
    private static S3Client cliente;

    private MinioDeTeste() {
    }

    private static synchronized void iniciar() {
        if (cliente == null) {
            MINIO.start();
            cliente = novoCliente();
            cliente.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build());
        }
    }

    private static S3Client novoCliente() {
        return S3Client.builder().endpointOverride(URI.create(MINIO.getS3URL())).region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(USUARIO, SENHA)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClientBuilder(UrlConnectionHttpClient.builder()).build();
    }

    /** Aponta as fotos da aplicação para este bucket (quem liga é o application-test.yml; a manutenção agendada fica desligada: os testes chamam os jobs à mão) */
    public static void registrar(DynamicPropertyRegistry registry) {
        iniciar();
        registry.add("treinos.fotos.endpoint", MINIO::getS3URL);
        registry.add("treinos.fotos.bucket", () -> BUCKET);
        registry.add("treinos.fotos.chave", () -> USUARIO);
        registry.add("treinos.fotos.segredo", () -> SENHA);
        registry.add("treinos.fotos.manutencao-ativa", () -> "false");
    }

    /** O objeto existe no bucket? (conferência direta, sem passar pela aplicação) */
    public static boolean existe(UUID objeto) {
        iniciar();
        try {
            cliente.headObject(HeadObjectRequest.builder().bucket(BUCKET).key(objeto.toString()).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
    }

    /** Bytes guardados, para conferir que não sobrou metadado. */
    public static byte[] ler(UUID objeto) {
        iniciar();
        return cliente.getObjectAsBytes(b -> b.bucket(BUCKET).key(objeto.toString())).asByteArray();
    }

    /** Nomes de todos os objetos do bucket (só UUIDs). */
    public static java.util.List<String> chaves() {
        iniciar();
        return cliente.listObjectsV2(b -> b.bucket(BUCKET)).contents().stream().map(o -> o.key()).toList();
    }

    /** Derruba o MinIO de propósito, para provar que a remoção tenta de novo (e religa depois). */
    public static void pausar() {
        MINIO.getDockerClient().pauseContainerCmd(MINIO.getContainerId()).exec();
    }

    public static void retomar() {
        MINIO.getDockerClient().unpauseContainerCmd(MINIO.getContainerId()).exec();
    }
}
